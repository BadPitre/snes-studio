# SPEC_FORMATS — formats de données SNES Studio

**Statut :** v0 (Phase 1 — POC). Ce document est la copie vivante des sections 4-6 du
`KIT_PHASE1_POC_MOTEUR.md` : c'est LUI qui fait foi et qui évolue avec le code.
Tout écart entre le code et cette spec est un bug de l'un ou de l'autre.

Toutes les valeurs multi-octets sont **little-endian** (natif 65816).

---

## 0. État du format — v0.2 (Phase 2b, binaire en ROM)

**Depuis la Phase 2b, les scènes et les textes sont des BLOBS BINAIRES
byte-exacts** (`engine/src/data/scenes.bin` / `texts.bin`), générés par
`tools/datagen` depuis le projet source `demo/` (JSON + PNG — voir
`docs/TOOLS.md`) et épinglés dans leurs banks par `engine/databanks.asm`.
Les écarts de la Phase 1 (banks non épinglées, Scene Table symbolique,
pointeurs C au lieu de far 24-bit) sont **résolus** : le moteur lit le format
des sections 1-2 ci-dessous, tel quel, en ROM.

Écarts/conventions restants, assumés en v0 :

1. **Convention metatile v0 :** la valeur `t` du tilemap est directement l'index du
   character 8x8 dans le tileset ; le moteur l'affiche répété 2x2 pour couvrir le
   metatile 16x16. (Évolution prévue : table de metatiles → 4 chars.)
2. **Contrainte de taille v0 : `map_width` et `map_height` >= 32** (la taille de
   la fenêtre VRAM du moteur). Maximum : 255 (u8). Les maps plus grandes que
   32x32 sont streamées (voir §4).
3. **Tileset unique global v0** (`tileset[]` / `tileset_pal[]` dans
   `data_assets.c`) : le Scene Header n'a pas de pointeur d'assets, tous les
   écrans partagent le même tileset. Les assets gfx (tileset, sprites, fonte)
   restent en C arrays générés — la spec ne définit pas (encore) de format
   binaire pour eux.
4. **Une seule bank de scènes** ($82) : datagen refuse un blob > 32 Ko ; le
   débordement vers $83 (réservé, kit §3) sera implémenté au besoin.
5. **Ordre des pointeurs far 24-bit** dans les structures : `[bank][addr lo]
   [addr hi]` — même ordre que les entrées de la Scene Table.

---

## 1. Format binaire de scène (v0)

### 1.1 Scene Table (v0.2)

À une adresse fixe connue du moteur : **$82:8000** (début bank $82).

```
Offset  Taille  Champ
0       2       scene_count (u16)
2       1       boot_scene_id (u8)   — scène chargée au démarrage
3       1       reserved (u8)
4       4×N     entrées : { bank (u8), addr (u16), reserved (u8) } par scène
```

*Évolution v0 → v0.2 (Phase 2b) : ajout de `boot_scene_id` dans l'en-tête —
la scène de boot est une donnée, pas une constante moteur.*

### 1.2 Scene Header

```
Offset  Taille  Champ
0       1       scene_type      (u8)  — 0x01 = TOP_DOWN. Seule valeur en v0,
                                        MAIS LE CHAMP EXISTE DÈS MAINTENANT.
1       1       flags           (u8)  — réservé (0)
2       1       map_width       (u8)  — en tiles 16x16 (max 255)
3       1       map_height      (u8)
4       3       ptr_tilemap     (far) — bank + addr des indices de tiles (1 u8/tile)
7       3       ptr_collision   (far) — 1 octet par tile 16x16 (v0 : 0=libre, 1=solide)
10      3       ptr_actors      (far) — table des acteurs
13      3       ptr_scripts     (far) — bloc bytecode de la scène
16      1       actor_count     (u8)
17      1       player_start_x  (u8)  — en tiles
18      1       player_start_y  (u8)
19      1       reserved        (u8)
```

### 1.3 Entrée acteur (8 octets par acteur)

```
Offset  Taille  Champ
0       1       actor_type    (u8)  — 0x01 = PNJ statique (seul type en v0)
1       1       x             (u8)  — en tiles
2       1       y             (u8)
3       1       sprite_id     (u8)  — index dans la table de metasprites
4       2       script_offset (u16) — offset dans le bloc scripts (0xFFFF = aucun)
6       1       direction     (u8)  — 0=bas 1=haut 2=gauche 3=droite
7       1       reserved      (u8)
```

### 1.4 Collision (v0 volontairement simpliste)

1 octet par tile 16x16 : `0x00` = traversable, `0x01` = solide.
Les types étendus (eau, one-way, déclencheurs de warp) viendront en v1 —
ne pas sur-designer maintenant.

---

## 2. Spec VM v0 — le bytecode

### Philosophie

- La VM v0 fait UNE chose : les interactions PNJ/dialogue. Rien d'autre.
- Chaque opcode : 1 octet d'opcode + opérandes de taille fixe. Décodage trivial.
- Deux catégories : opcodes **immédiats** (exécutés en chaîne dans la frame)
  et opcodes **bloquants** (rendent la main à la boucle principale jusqu'à
  un événement — input, fin de frame).
- Budget : ne jamais exécuter plus de ~32 opcodes immédiats par frame (garde-fou
  anti-boucle infinie : compteur + arrêt d'urgence en debug).

### État de la VM (en WRAM)

```c
struct VmState {
  u8  active;          // 0 = inactive
  u8  bank;            // bank du bytecode courant
  u16 pc;              // program counter (offset dans la bank)
  u8  wait_mode;       // 0=non, 1=attend touche A, 2=attend fermeture textbox
  u8  vars[64];        // variables de scène (réinitialisées au chargement de scène)
  u8  gvars[64];       // variables globales (persistent entre scènes)
};
```

**Représentation C v0 (`engine/src/vm.c`) :** pas de champ `bank` — le bloc
scripts de la scène est déjà résolu en pointeur far (`scene_ctx.scripts`),
`pc` est l'offset dans ce bloc (même sémantique que le format binaire : les
offsets des opcodes de saut et les `script_offset` d'acteurs sont absolus
dans le bloc scripts de la scène). Garde-fou : 32 opcodes immédiats max par
frame, halt debug au-delà (idem opcode inconnu).

### Table des opcodes v0

| Op | Nom | Opérandes | Effet |
|----|-----|-----------|-------|
| 0x00 | END | — | Termine le script, VM inactive, rend le contrôle au joueur |
| 0x01 | MSG | text_id (u16) | **Bloquant.** Ouvre la textbox, affiche le texte `text_id`, attend A pour fermer |
| 0x02 | SETVAR | var (u8), val (u8) | vars[var] = val |
| 0x03 | ADDVAR | var (u8), val (u8) | vars[var] += val (wrap 8-bit assumé) |
| 0x04 | JMP | offset (u16) | pc = offset (absolu dans le bloc scripts) |
| 0x05 | JEQ | var (u8), val (u8), offset (u16) | si vars[var] == val → saut |
| 0x06 | JNE | var (u8), val (u8), offset (u16) | si vars[var] != val → saut |
| 0x07 | SETGVAR | var (u8), val (u8) | gvars[var] = val |
| 0x08 | JGEQ | var (u8), val (u8), offset (u16) | si vars[var] >= val → saut (utile compteurs) |

8 opcodes. C'est tout. Pas d'ajout sans besoin prouvé.

**Textes :** bank $86, à $86:8000 :

```
Offset      Taille  Champ
0           2       text_count (u16)
2           2×N     offsets (u16) — relatifs au début de bank ($8000)
(offsets)   ...     chaînes terminées par 0x00
```

`text_id` indexe la table d'offsets. Encodage v0 : ASCII simple (32-126,
accents en v1 avec la fonte définitive).

---

## 3. Structures WRAM du moteur

```c
// Joueur
struct Player {
  u16 x, y;            // position en pixels (subpixels en v1 si besoin)
  u8  dir;             // 0=bas 1=haut 2=gauche 3=droite
  u8  moving;
  u8  anim_frame;
  u8  anim_timer;
};

// Caméra
struct Camera {
  u16 x, y;            // coin haut-gauche en pixels, clampée aux bords de map
};

// Scène courante (copie WRAM du header + pointeurs résolus)
struct SceneCtx {
  u8  scene_type;
  u8  map_w, map_h;
  u8  actor_count;
  // pointeurs far résolus vers tilemap, collision, actors, scripts
};
```

**Budget VBlank :** par frame : max 1 colonne + 1 ligne de metatiles streamées
(256 + 256 octets, cf. streaming ci-dessous) + shadow OAM (544 octets, DMA
automatique du NMI PVSnesLib) — dans le budget DMA (~4,5 Ko). Le chargement
initial complet du tilemap (8 Ko) se fait écran éteint (forced blank), hors
budget frame.

**Streaming du tilemap (`engine/src/map.c`) :** la VRAM ne contient qu'une
fenêtre de 32x32 metatiles (= le tilemap SC_64x64 complet, qui est aussi la
zone de wrap hardware de 512 px — donc char VRAM = coordonnée map mod 64, et
les registres de scroll reçoivent la position caméra telle quelle). La fenêtre
suit la caméra avec 8 metatiles d'avance sur le bord visible ; à chaque pas de
fenêtre (max 1 par axe et par frame, garanti par la caméra à 1 px/frame), la
colonne/ligne entrante est préparée en WRAM pendant la frame active puis
transférée au VBlank via `dmaCopyVram7` (colonnes : incrément VRAM +32 mots,
2 segments par colonne de chars ; lignes : +1 mot, 2 segments par ligne).

---

## 4. Layout VRAM du moteur (v0)

Choix du moteur, pas des données — documenté ici pour référence :

| Adresse VRAM (words) | Contenu |
|----------------------|---------|
| $0000 | Tilemap BG1, SC_64x64 (4 écrans 32x32, 8 Ko) |
| $1000 | Characters BG3 2bpp (fonte textbox : char 0 transparent + 96 glyphes ASCII 32-127) |
| $1800 | Tilemap BG3, SC_32x32 (textbox) |
| $2000 | Characters BG1 (tileset 4bpp) |
| $4000 | Characters OBJ (sprites 4bpp) |

Mode vidéo : Mode 1 avec **BG3 priorité haute** (bit 3 de $2105) — la textbox
passe au-dessus de tout. BG1 = map, BG3 = textbox (toujours actif, map
transparente quand fermée), BG2 désactivé. Layout déclaré dans
`engine/src/vram.h`.

**Textbox (`engine/src/textbox.c`)** : rangées 20-27 de la map BG3 (bas
d'écran, 64 px), texte 28 colonnes × 6 lignes max, retour à la ligne par mot.
Glyphes à fond opaque (couleur 1 de la palette BG 2bpp n°4, CGRAM 16-19),
char BG3 = `1 + ascii - 32`. Fonte extraite de pvsneslibfont (PVSnesLib, MIT)
en C array (`data_font.c`).

---

## 5. Audit "constantes de jeu" — état semaine 5

Aucune donnée de jeu en dur dans le moteur : positions, maps, collision,
acteurs, scripts, textes et scène de boot viennent des banks de données.
Restent dans le code moteur, assumées comme **constantes moteur v0** (elles
deviendront des paramètres générés quand les outils Rust existeront) :

- vitesse joueur 1 px/frame et cadence de pseudo-anim (8 frames) — kit S2 ;
- géométrie de la textbox (rangées 20-27, 28 colonnes) ;
- marge de fenêtre de streaming (8 metatiles) ;
- layout VRAM (`vram.h`) et constantes hardware (écran 256x224, tiles 16 px,
  wrap BG 64 chars).

**Feuille de sprites globale (v0)** : asset global dans `data_assets.c`
(`sprite_gfx[]` / `sprite_pal[]`), frames 16x16 4bpp directionnelles
(0=bas 1=haut 2=gauche 3=droite), layout table OBJ (frame f = tiles
{2f, 2f+1, 2f+16, 2f+17}). Frames 0-3 : joueur (pas de sprite_id — gfx
global comme le tileset). Frames 4-7 : PNJ villageois.

**Convention metasprite v0 :** le `sprite_id` d'un acteur est l'index de sa
frame « bas » dans la feuille ; la frame affichée est `sprite_id + direction`.
(La « table de metasprites » deviendra une vraie structure quand les outils
Rust génèreront les assets, Phase 2.)

**Interaction (semaine 3)** : bouton A + acteur sur la tile face au joueur →
`actor_interact()`. Effet provisoire jalon S3 : bascule de la couleur 2 de la
palette BG (herbe) vers un rouge debug, écriture CGRAM différée au VBlank.
Remplacé par `vmStart(script_offset)` en semaine 4. Les acteurs sont solides
(collision joueur).
