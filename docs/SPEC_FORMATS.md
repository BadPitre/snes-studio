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
   maximum 255 (u8) par axe et **8192 tiles au total** (v0.7 : les grilles
   voyagent compressées et sont décompressées vers des buffers WRAM de
   8192 octets — ex. 90x90, 64x128). Les maps plus grandes que la fenêtre
   VRAM 32x32 sont streamées (voir §4) ; les plus petites tiennent
   entièrement dans la fenêtre (pas de streaming sur l'axe concerné, zone
   hors map remplie de char 0 — jamais visible, la caméra est clampée).
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
27      1       sprite_set_id   (u8)  — index dans les tables sprite_*
                                        générées (v0.5 ; avant : réservé)
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

*Évolution v0.4 → v0.5 (Phase 6) : l'octet 27 devient `sprite_set_id` —
les sprites (chars OBJ + palettes) sont compilés PAR SCÈNE comme les
tilesets : seuls les blocs de personnage utilisés par la scène (joueur
inclus, 5 max) sont embarqués, et le `sprite_id` des acteurs est remappé
vers le slot local (§1.3, §5).*

### 1.3 Entrée acteur (8 octets par acteur)

```
Offset  Taille  Champ
0       1       actor_type    (u8)  — 0x01 = PNJ statique (parle avec A)
                                      0x02 = déclencheur de CONTACT (v0.6) :
                                      traversable — script lancé quand le
                                      héros marche sur la tile
                                      0x03 = déclencheur AUTO (v0.6) :
                                      script lancé au chargement de la
                                      scène (boot ou warp)
1       1       x             (u8)  — en tiles
2       1       y             (u8)
3       1       sprite_id     (u8)  — SLOT de bloc de personnage dans le
                                      sprite set de la scène (§5, v0.5 —
                                      datagen remappe le bloc projet du
                                      JSON vers le slot local, joueur = 0)
                                      0xFF = INVISIBLE (v0.8) : l'acteur ne
                                      consomme aucun slot OAM.
                                      L'APPARENCE EST INDÉPENDANTE DU
                                      DÉCLENCHEUR (v0.8) : un acteur de
                                      CONTACT ou AUTO peut porter un sprite
                                      (coffre, panneau, PNJ qui accoste le
                                      héros) et reste traversable
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

### 1.6 Compression des grilles — RLE (v0.7)

Les trois grilles d'une scène (`ptr_tilemap`, `ptr_tilemap_upper`,
`ptr_collision`) sont stockées en **RLE** : suites de paires
`[count (u8, 1-255)][valeur (u8)]`, décodées au chargement de scène vers
les buffers WRAM du moteur (3 × 8192 octets, écran éteint) jusqu'à
`w*h` octets exactement. datagen valide `w*h <= 8192`. Sur des maps
typées RM2003 le gain est massif (~85 % sur la demo) — c'est ce qui rend
des jeux de la taille d'un RM2003 possibles dans 4 Mo, avec le découpage
multi-bank à venir.

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
  u8  wait_mode;       // 0=non, 1=attend touche A, 2=attend fermeture textbox,
                       // 3=CHOICE en cours (curseur haut/bas, A valide — v0.6)
  u8  vars[64];        // variables de scène (réinitialisées au chargement de scène)
  u8  gvars[64];       // variables globales (persistent entre scènes)
  u8  choice_var;      // v0.6 : variable destination du CHOICE en cours
  u8  choice_count;    // v0.6 : nombre d'options (2-4)
  u8  choice_sel;      // v0.6 : option sous le curseur
};
```

**Représentation C v0 (`engine/src/vm.c`) :** pas de champ `bank` — le bloc
scripts de la scène est déjà résolu en pointeur far (`scene_ctx.scripts`),
`pc` est l'offset dans ce bloc (même sémantique que le format binaire : les
offsets des opcodes de saut et les `script_offset` d'acteurs sont absolus
dans le bloc scripts de la scène). Garde-fou : 32 opcodes immédiats max par
frame, halt debug au-delà (idem opcode inconnu).

### Table des opcodes — v0.6

**Octet variable (v0.6)** : bits 0-5 = numéro (0-63), **bit 7 = variable
GLOBALE** (`gvars`, persiste entre les scènes) — partout où « var »
apparaît ci-dessous. L'assembleur écrit `v<n>` (scène) ou `g<n>` (globale).
Le pattern RM2003 « donner/posséder un objet » = une gvar : `SETVAR g<n> 1`
pour donner, `JEQ g<n> 1 <label>` pour tester.

| Op | Nom | Opérandes | Effet |
|----|-----|-----------|-------|
| 0x00 | END | — | Termine le script, VM inactive, rend le contrôle au joueur |
| 0x01 | MSG | text_id (u16) | **Bloquant.** Ouvre la textbox, affiche le texte `text_id`, attend A pour fermer |
| 0x02 | SETVAR | var (u8), val (u8) | var = val |
| 0x03 | ADDVAR | var (u8), val (u8) | var += val (wrap 8-bit assumé) |
| 0x04 | JMP | offset (u16) | pc = offset (absolu dans le bloc scripts) |
| 0x05 | JEQ | var (u8), val (u8), offset (u16) | si var == val → saut |
| 0x06 | JNE | var (u8), val (u8), offset (u16) | si var != val → saut |
| 0x07 | SETGVAR | var (u8), val (u8) | gvars[var] = val (alias historique de SETVAR g) |
| 0x08 | JGEQ | var (u8), val (u8), offset (u16) | si var >= val → saut (utile compteurs) |
| 0x09 | CHOICE | var (u8), count (u8), count × text_id (u16) | **Bloquant.** Affiche 2-4 options (une par ligne, curseur `>` haut/bas), A valide → var = index choisi (0..count-1) |
| 0x0A | WARP | scene (u8), x (u8), y (u8) | Téléporte le héros (fondu, rechargement complet) et **termine le script** — le bloc scripts change de scène |
| 0x0B | FACE | acteur (u8), dir (u8) | Tourne l'acteur (index dans la table d'acteurs) vers dir (0=bas 1=haut 2=gauche 3=droite) |

*Évolution v0 → v0.6 (demande explicite) : CHOICE (Show Choices RM2003),
WARP (Teleport scripté), FACE (orientation d'événement), et le bit gvar
sur les opérandes variable — le déplacement pas-à-pas des PNJ par script
arrive avec le chantier « PNJ mobiles ». En complément, hors bytecode :
`wait_mode` 3 = VM_WAIT_CHOICE, et le PNJ à qui l'on parle se tourne vers
le héros (réflexe RM2003, moteur).*

**Textes (v0.7) :** bank $86, à $86:8000, chaînes compressées par
**dictionnaire de bigrammes (DTE)** :

```
Offset      Taille  Champ
0           2       text_count (u16)
2           2×N     offsets (u16) — relatifs au début de bank ($8000)
2+2N        256     table de paires : 128 × 2 caractères ASCII
(offsets)   ...     chaînes encodées terminées par 0x00
```

`text_id` indexe la table d'offsets. Dans une chaîne, un octet 0x80-0xFF
désigne la paire `(code & 0x7F)` de la table (2 caractères BRUTS — le
décodeur n'est pas récursif) ; la textbox décode vers un buffer WRAM
avant le rendu. datagen choisit les 128 bigrammes les plus fréquents du
projet (~40 % de gain sur du texte français). Encodage v0 : ASCII simple
(32-126, accents en v1 avec la fonte définitive).

---


**v0.9 (A2-P4) — switches et variables 16-bit, façon RM2003 :**

| Opcode | Nom | Opérandes | Effet |
|---|---|---|---|
| 0x0C | SW | idx u16, val u8 | switch idx (0-511) := val (0/1) |
| 0x0D | JSW | idx u16, attendu u8, ofs u16 | pc = ofs si switch == attendu |
| 0x0E | SET16 | var u8, val u16 | variable 16-bit var (0-255) := val |
| 0x0F | ADD16 | var u8, val u16 | var += val (wrap ; négatif = complément à deux) |
| 0x10 | JCMP16 | var u8, op u8, val u16, ofs u16 | pc = ofs si vrai — op : 0 `==`, 1 `!=`, 2 `>=` |

Les 512 switches (64 octets de bits) et 256 variables 16-bit sont
**globaux et persistants** (sauvegardés, §4bis v2). Les v/g 8-bit
d'origine restent valides (héritage + variable de travail des CHOICE).

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

### 3.1 Carte WRAM — où vivent les tampons (v0.8, contractuel)

| Zone | Contenu | Contrainte |
|---|---|---|
| `$7E:0000-1FFF` | lowram PVSnesLib (registres tcc, pads, VBlank) | intouchable |
| `$7E:2000-7FFF` | **`.bss` de tcc-816** (24 Ko utiles) | **plafond dur `$8000`** |
| `$7E:8000-9AB4` | variables PVSnesLib, dont **`oamMemory` (`$7E:9094`)** | intouchable |
| `$7F:8000-FFFF` | gros tampons du moteur (`wram7f.asm`) | 32 Ko |

**PIÈGE DE TOOLCHAIN (coûteux, vécu) :** le `.bss` de tcc-816 est alloué dans
le SLOT 2 (`$7E:2000-FFFF`) alors que PVSnesLib pose ses propres variables
dans le SLOT 0 de la **même bank** (`$7E:8000+`). WLA alloue les deux slots
**indépendamment et ne détecte pas le recouvrement** : un `.bss` qui dépasse
`$7E:8000` écrase l'OAM shadow **sans le moindre message du linker**. Les
symptômes ne ressemblent pas à une corruption mémoire : les entrées OAM
inutilisées, remises à zéro, deviennent des sprites 16x16 *visibles* empilés
en `(0,0)`, ce qui sature la limite matérielle de **32 sprites par ligne** sur
les 16 premières lignes — le héros et les PNJ y sont alors purement et
simplement **supprimés par le PPU**, comme si le moteur les découpait trop tôt
en haut de l'écran.

Conséquences contractuelles :
- Les grilles décompressées `scn_lower` / `scn_upper` / `scn_col`
  (3 x 8192 octets, §1.6) sont déclarées en **assembleur** dans
  `engine/wram7f.asm`, RAMSECTION `BANK $7F ORGA $8000 FORCE`, et vues du C
  via `extern` (les pointeurs tcc-816 sont far 24 bits, l'accès inter-bank est
  transparent).
- `make` **échoue** si un symbole `.bss` atterrit à `$7E:8000` ou au-delà
  (cible `checkwram` du Makefile) — la borne ne peut pas être exprimée dans
  `hdr.asm`, les libs PVSnesLib étant pré-compilées avec cette carte mémoire.
- Tout nouveau tampon de plus de ~1 Ko va en bank `$7F`.

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

## 4bis. Sauvegardes SRAM (v2 — v0.9)

SRAM LoROM bank `$70`, **8 Ko** (`SRAMSIZE $03`, cartouche à batterie).
**4 slots de 2048 octets** :

| Offset | Taille | Champ |
|---|---|---|
| 0-1 | 2 | magie `"SG"` |
| 2 | 1 | version = **2** |
| 3-6 | 4 | scène, x, y, direction du héros |
| 7 | 1 | réservé |
| 8-71 | 64 | gvars (variables globales 8-bit, héritage) |
| 72-135 | 64 | switches (512 bits — v0.9) |
| 136-647 | 512 | variables 16-bit [256], little-endian (v0.9) |
| 648-649 | 2 | checksum : somme 16-bit des octets 0-647 (LE) |
| 650+ | — | réservé (hors checksum) |

Un slot est valide si magie, version ET checksum concordent — sinon il
est traité comme vide. Les sauvegardes v1 (slots de 128 octets) ne sont
pas migrées (version ≠ 2 ⇒ vides).

## 5. Audit "constantes de jeu" — état semaine 5

Aucune donnée de jeu en dur dans le moteur : positions, maps, collision,
acteurs, scripts, textes et scène de boot viennent des banks de données.
Restent dans le code moteur, assumées comme **constantes moteur v0** (elles
deviendront des paramètres générés quand les outils Rust existeront) :

- vitesse joueur 1 px/frame et cadence de pseudo-anim (8 frames) — kit S2 ;
- géométrie de la textbox (rangées 20-27, 28 colonnes) ;
- vocabulaire du menu Système (« Sauvegarder », « Charger », « Slot n »…) —
  chaînes moteur v0.7, comme le menu intégré de RM2003 (configurable par
  projet en v1+) ;
- marge de fenêtre de streaming (8 metatiles) ;
- layout VRAM (`vram.h`) et constantes hardware (écran 256x224, tiles 16 px,
  wrap BG 64 chars).

**Sprites compilés par scène (v0.5, modèle charset RM2003)** : la feuille
source du projet (`assets.sprites`) est une bande de **frames 16x24**,
organisée en **blocs de personnage de 12 frames** : 4 directions (0=bas
1=haut 2=gauche 3=droite) × 3 pas (repos, pas A, pas B). Le joueur est le
bloc 0. Le projet peut avoir de nombreux blocs — datagen compile, pour
chaque scène, un **sprite set** ne contenant que le bloc joueur + les
blocs de ses acteurs (**5 blocs max par scène**, sinon erreur), dédupliqué
entre scènes identiques. Tables générées `sprite_chars[]` /
`sprite_chars_sizes[]` / `sprite_pals[]` (`data_assets.c`), indexées par
`sprite_set_id` (header octet 27) ; chargées en VRAM/CGRAM au boot et à
chaque warp, écran éteint. Les données de chaque set vivent dans leur
propre fichier généré (`data_sprites{i}.c` / `data_gfx{i}.c`) : une
section ROM est insécable (32 Ko), l'éclatement laisse wlalink répartir
les sets sur les banks libres — le budget d'assets du projet devient la
ROM entière, plus une seule bank.

- **Metasprite** : une frame = 2 OBJs 16x16 empilés, ancrés sur la tile de
  l'entité avec **8 px de débord au-dessus** (la tête chevauche la tile du
  dessus, comme dans RM2003). Une tile ☆ de la couche sup passe devant.
- **Layout VRAM OBJ** (frames LOCALES au set, 60 max) : un groupe de 8
  frames = 4 rangées de 16 chars (rangées 0-1 : moitiés hautes 16x16,
  rangées 2-3 : moitiés basses — les 8 dernières lignes de la frame sont
  vides). OBJ haut de la frame f : tile `((f&0xF8)<<3) | ((f&7)<<1)` ;
  OBJ bas : `+32`.
- **Palettes OBJ** : le slot s du set utilise la palette OBJ s — datagen
  ré-indexe les couleurs de chaque bloc (15 max + transparent, fusion des
  plus proches au-delà, avec avertissement) et émet la CGRAM OBJ complète
  (couleurs 128-255) par set.
- **Cycle de marche** : phase 0-3 → pas affiché repos, A, repos, B (avance
  toutes les 8 frames de mouvement).

**Convention metasprite (v0.5) :** le `sprite_id` binaire d'un acteur est
le **slot local** de son bloc dans le sprite set de la scène (le JSON
source déclare le bloc projet ; datagen remappe) ; la frame de repos
affichée est `sprite_id*12 + direction*3`, avec la palette OBJ `sprite_id`.

**Interaction (semaine 3)** : bouton A + acteur sur la tile face au joueur →
`actor_interact()`. Effet provisoire jalon S3 : bascule de la couleur 2 de la
palette BG (herbe) vers un rouge debug, écriture CGRAM différée au VBlank.
Remplacé par `vmStart(script_offset)` en semaine 4. Les acteurs sont solides
(collision joueur).
