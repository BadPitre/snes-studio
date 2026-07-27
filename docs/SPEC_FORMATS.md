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

1. **Metatiles (Phase 5) :** la valeur `t` du tilemap indexe la **table de
   metatiles** (4 entrées BG u16 par tile : TL, TR, BL, BR), générée par
   datagen depuis un tileset source de tiles 16x16 (chars 8x8 dédupliqués,
   max 512 — le **char 0 est réservé transparent**). Le PNG source est une
   grille de tiles 16x16 (dimensions multiples de 16), indexée **rangée par
   rangée** (comme la palette RPG Maker). Ids binaires : `0..N-1` tiles de
   la grille, puis les **variantes d'autotiles utilisées** (Phase 5c,
   format RM2003 : PNG 48x64, bordures composées par quarts 8x8, calculées
   par datagen — le moteur ne voit que des metatiles ordinaires), et en
   dernier le metatile transparent (couche sup vide). Max 256 ids au total
   (le tilemap indexe en u8).
   Attention : ne pas nommer un symbole « metatiles » — il entre en
   collision silencieuse avec un symbole interne de PVSnesLib (maps.asm).
2. **Contrainte de taille : minimum 20x15** (un écran, comme RM2003),
   maximum 255 (u8). Les maps plus grandes que la fenêtre VRAM 32x32 sont
   streamées (voir §4) ; les plus petites tiennent entièrement dans la
   fenêtre (pas de streaming sur l'axe concerné, zone hors map remplie de
   char 0 — jamais visible, la caméra est clampée aux bords).
3. **GFX compilés par scène (v0.4, Phase 5d)** : l'octet 1 du Scene Header
   est le `gfx_set_id` — index dans les tables générées `gfx_chars[]` /
   `gfx_chars_sizes[]` / `gfx_metas[]` / `gfx_prios[]` / `gfx_pals[]`
   (`data_assets.c`). datagen ne compile pour chaque scène QUE les tiles
   qu'elle utilise (budget VRAM réel : max 254 ids locaux, 512 chars,
   8 palettes de 15 couleurs par scène) ; les scènes au contenu identique
   partagent le même set. Les PNG sources peuvent avoir jusqu'à 256
   couleurs (chipsets RM2003) : les chars sont répartis en palettes
   multiples (bits 10-12 des entrées BG, fusion agglomérative) et la CGRAM
   BG complète (couleurs 0-127) est chargée par scène. Les assets gfx
   restent en C arrays générés — la spec ne définit pas (encore) de format
   binaire pour eux.
4. **Passabilité par tile (Phase 5c, modèle RM2003)** : le sidecar
   `assets/<tileset>.json` déclare `autotiles` (PNG 48x64), `solid` (ids X)
   et `above` (ids ☆, dessinés au-dessus du héros, passables). La couche
   collision binaire (§1.4) est **dérivée** par datagen : tile sup présente
   et non-☆ → sa passabilité l'emporte (ponts au-dessus de l'eau), sinon
   celle de la tile inférieure. `tileset_prios[]` donne 1 octet par id
   binaire (1 = ☆ → bit de priorité BG sur la couche sup).
5. **Une seule bank de scènes** ($82) : datagen refuse un blob > 32 Ko ; le
   débordement vers $83 (réservé, kit §3) sera implémenté au besoin.
6. **Ordre des pointeurs far 24-bit** dans les structures : `[bank][addr lo]
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

### 1.2 Scene Header (v0.3 — 28 octets)

```
Offset  Taille  Champ
0       1       scene_type      (u8)  — 0x01 = TOP_DOWN. Seule valeur en v0,
                                        MAIS LE CHAMP EXISTE DÈS MAINTENANT.
1       1       gfx_set_id      (u8)  — index dans les tables gfx_* générées
                                        (v0.4 ; avant : tileset_id/réservé)
2       1       map_width       (u8)  — en tiles 16x16 (max 255)
3       1       map_height      (u8)
4       3       ptr_tilemap     (far) — couche INFÉRIEURE (1 u8/tile, ids §0.1)
7       3       ptr_collision   (far) — 1 octet par tile 16x16 (voir §1.4)
10      3       ptr_actors      (far) — table des acteurs
13      3       ptr_scripts     (far) — bloc bytecode de la scène
16      1       actor_count     (u8)
17      1       player_start_x  (u8)  — en tiles
18      1       player_start_y  (u8)
19      1       music_id        (u8)  — index soundbank, 0xFF = silence (Phase 4b)
20      3       ptr_warps       (far) — table des warps (v0.2, Phase 4)
23      1       warp_count      (u8)
24      3       ptr_tilemap_upper (far) — couche SUPÉRIEURE (v0.3, Phase 5c ;
                                        cellule vide = id du metatile transparent)
27      1       reserved        (u8)
```

*Évolution v0 → v0.2 (Phase 4) : header étendu de 20 à 24 octets avec la
table des warps ; l'octet 19 (réservé) devient `music_id`. Le soundbank
snesmod (modules .it convertis par smconv) occupe la bank $87 (kit §3) ;
les music_id suivent l'ordre de `project.musics`. La musique de la scène
est (re)lancée au boot et à chaque warp — même id = pas d'interruption.*

*Évolution Phase 5b : l'octet 1 (réservé) devient `tileset_id` — le tileset
(chars + metatiles + palette BG) est chargé par scène au boot et à chaque
warp, comme la musique.*

*Évolution v0.2 → v0.3 (Phase 5c) : header étendu de 24 à 28 octets avec
`ptr_tilemap_upper` — deux couches de décor (modèle RPG Maker 2003, voir
§0.4 et §4). Le blob de scène gagne une grille w×h (couche sup).*

*Évolution v0.3 → v0.4 (Phase 5d) : l'octet 1 devient `gfx_set_id` — les
gfx (chars, metatiles, priorités, palettes) sont compilés PAR SCÈNE (§0.3),
les valeurs du tilemap sont des ids LOCAUX au set de la scène.*

### 1.3 Entrée acteur (8 octets par acteur)

```
Offset  Taille  Champ
0       1       actor_type    (u8)  — 0x01 = PNJ statique (seul type en v0)
1       1       x             (u8)  — en tiles
2       1       y             (u8)
3       1       sprite_id     (u8)  — index de BLOC de personnage (§5, v0.5)
4       2       script_offset (u16) — offset dans le bloc scripts (0xFFFF = aucun)
6       1       direction     (u8)  — 0=bas 1=haut 2=gauche 3=droite
7       1       reserved      (u8)
```

### 1.4 Collision (v0.2)

1 octet par tile 16x16 :

| Valeur | Sens |
|---|---|
| 0x00 | traversable |
| 0x01 | solide |
| 0x02 | déclencheur de warp (traversable — marcher dessus déclenche, §1.5) |

Les autres types étendus (eau, one-way) viendront au besoin.
Note pipeline (v0.3, Phase 5c) : cette couche est entièrement DÉRIVÉE par
datagen — 0/1 depuis la passabilité du tileset (sidecar, règle §0.4 :
la tile sup non-☆ l'emporte sur la tile inf), puis 0x02 posé d'après la
table des warps de la scène. Il n'y a plus de couche collision auteur
(le champ `collision` des vieux JSON de scène est ignoré).

### 1.5 Entrée warp (8 octets par warp — v0.2, Phase 4)

```
Offset  Taille  Champ
0       1       x            (u8) — tile déclencheuse (en tiles 16x16)
1       1       y            (u8)
2       1       dest_scene   (u8) — index dans la Scene Table
3       1       dest_x       (u8) — position d'arrivée du joueur (en tiles)
4       1       dest_y       (u8)
5       1       flags        (u8) — réservé (0)
6       2       reserved
```

Comportement moteur : quand la tile centrale du joueur ENTRE sur une tile
de collision 0x02, le warp correspondant est cherché dans la table ; la
transition v0 est fondu sortant → chargement de la scène cible (vars VM
remises à zéro, gvars conservées) → fondu entrant. Pas de re-déclenchement
tant que le joueur n'a pas quitté puis retrouvé une tile de warp.

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
| $0000 | Tilemap BG1, SC_64x64 — **couche supérieure** (8 Ko) |
| $1000 | Characters BG3 2bpp (fonte textbox : char 0 transparent + 96 glyphes ASCII 32-127) |
| $1800 | Tilemap BG3, SC_32x32 (textbox) |
| $2000 | Characters BG1+BG2 (tileset 4bpp partagé) |
| $4000 | Characters OBJ (sprites 4bpp) |
| $6000 | Tilemap BG2, SC_64x64 — **couche inférieure** (8 Ko) |

Mode vidéo : Mode 1 avec **BG3 priorité haute** (bit 3 de $2105) — la textbox
passe au-dessus de tout. **Deux couches de décor (modèle RPG Maker 2003,
Phase 5c)** : BG2 = couche inférieure (sol), BG1 = couche supérieure. Ordre
mode 1 : BG1 prio 0 devant BG2 mais derrière les sprites prio 2 (héros/PNJ) ;
une tile ☆ reçoit le bit de priorité BG (0x2000) sur la couche sup et passe
DEVANT les sprites. Les deux couches partagent charset, palettes, fenêtre de
streaming et scroll (budget VBlank : 1 Ko max par frame, 2 couches).
**Palettes multiples (v0.4)** : les entrées BG portent leurs bits de palette
(10-12), bakés par datagen ; la CGRAM BG complète (couleurs 0-127, 8
palettes de 16) est chargée au chargement de scène. **Slots CGRAM 16-19
RÉSERVÉS à la fonte de la textbox** (palette BG 2bpp n°4) : datagen n'y
place aucune couleur (palette 1 évitée jusqu'à 7 clusters ; à 8, le plus
petit cluster loge en palette 1 aux indices 4-15, max 12 couleurs), et le
moteur recharge la palette de la fonte après chaque scene_load. Layout
déclaré dans `engine/src/vram.h`.

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

**Feuille de sprites globale (v0.5, modèle charset RM2003)** : asset global
dans `data_assets.c` (`sprite_gfx[]` / `sprite_pal[]`), bande de **frames
16x24** 4bpp, organisée en **blocs de personnage de 12 frames** :
4 directions (0=bas 1=haut 2=gauche 3=droite) × 3 pas (repos, pas A, pas B).
Maximum 64 frames (5 blocs complets). Le joueur est le bloc 0.

- **Metasprite** : une frame = 2 OBJs 16x16 empilés, ancrés sur la tile de
  l'entité avec **8 px de débord au-dessus** (la tête chevauche la tile du
  dessus, comme dans RM2003). Une tile ☆ de la couche sup passe devant.
- **Layout VRAM OBJ** : un groupe de 8 frames = 4 rangées de 16 chars
  (rangées 0-1 : moitiés hautes 16x16, rangées 2-3 : moitiés basses — les
  8 dernières lignes de la frame sont vides). OBJ haut de la frame f :
  tile `((f&0xF8)<<3) | ((f&7)<<1)` ; OBJ bas : `+32`.
- **Palettes OBJ** : le bloc b utilise la palette OBJ b — datagen ré-indexe
  les couleurs de chaque bloc (15 max + transparent, fusion des plus
  proches au-delà, avec avertissement) et émet la CGRAM OBJ complète
  (couleurs 128-255).
- **Cycle de marche** : phase 0-3 → pas affiché repos, A, repos, B (avance
  toutes les 8 frames de mouvement).

**Convention metasprite (v0.5) :** le `sprite_id` d'un acteur est l'index
de son **bloc de personnage** ; la frame de repos affichée est
`sprite_id*12 + direction*3`, avec la palette OBJ `sprite_id`.

**Interaction (semaine 3)** : bouton A + acteur sur la tile face au joueur →
`actor_interact()`. Effet provisoire jalon S3 : bascule de la couleur 2 de la
palette BG (herbe) vers un rouge debug, écriture CGRAM différée au VBlank.
Remplacé par `vmStart(script_offset)` en semaine 4. Les acteurs sont solides
(collision joueur).
