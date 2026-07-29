# TOOLS — pipeline d'assets (Phase 2)

**Statut :** Phase 2b. `datagen` transforme un projet source (JSON + PNG
indexés) en données moteur. **La source de vérité est le dossier projet
(`demo/`) — tout ce qui suit est GÉNÉRÉ :**

- `engine/src/data/scenes.bin` — bank $82 : Scene Table à $82:8000 + scènes,
  format binaire byte-exact de la spec §1 (far 24-bit)
- `engine/src/data/texts.bin` — bank $86 : table d'offsets + chaînes
- `engine/databanks.asm` — épingle les blobs dans leurs banks
- `engine/src/data/data_gfx{i}.c` / `data_sprites{i}.c` — UN FICHIER PAR
  SET : le `.rodata` d'un .c est une section WLA insécable (32 Ko max, une
  bank LoROM) ; en éclatant par set, wlalink répartit les assets sur les
  banks libres et le total n'est plus plafonné à 32 Ko. datagen purge les
  fichiers d'une génération précédente avant d'écrire.
- `engine/src/data/data_assets.c` — uniquement les tables de pointeurs
  (`gfx_chars[]`, `sprite_chars[]`…) indexées par set_id, résolues au link
  (pointeurs far 24-bit, la bank de chaque set n'importe pas)
- `engine/src/data/data_font.c` — fonte de la textbox

## Usage

```bash
# depuis la racine
cargo run --release --manifest-path tools/Cargo.toml -p datagen -- demo engine

# ou depuis engine/
make data
```

**`--debug` (S6)** : grave le drapeau du menu de debug dans
`engine/src/data/data_debug.c` (TOUJOURS émis : `dbg_enabled` +
`dbg_scn_used`/`dbg_txt_used`/`dbg_bank_cap`, les octets réellement
occupés dans les banks scènes/textes — le moteur inclut `debug.c`
inconditionnellement, inerte sans le drapeau). En jeu,
**Start+Select+R** bascule le panneau (FPS, LAG, budgets). Le drapeau
vient de la case « Menu de debug » des réglages de l'éditeur (ROMs de
test uniquement) — le build cartouche ne le passe jamais. Piège
documenté dans debug.c : le panneau ne fait AUCUNE division et ne
réécrit que les cellules qui changent (re-blit étalé sur 4 frames),
sinon il devient lui-même le lag qu'il mesure sur une boucle de jeu
déjà pleine.

### Build cartouche (flashcart)

```bash
cd engine && make cart   # -> engine/snesstudio.smc
```

`tools/mkcart.sh` transforme le `.sfc` du build (256 Ko, refusé par
les flashcarts type Super UFO Pro 8 : « File type error ») en `.smc`
prêt pour cartouche : contenu **miroité** jusqu'à 512 Ko minimum (comme
le décodage d'adresses d'une vraie cartouche), octet de taille `$7FD7`
et checksum `$7FDC-$7FDF` recalculés. Validé sur Super UFO Pro 8 +
console. Aussi accessible depuis l'éditeur : Game → « Build cartouche
(.smc) ».

## Structure d'un projet source

```
demo/
  project.json          # nom, boot_scene, scènes, assets, musics, tilesets
  texts.json            # [{name, text}] — l'ordre donne les text_id
  scenes/<nom>.json     # une scène par fichier
  assets/*.png          # tilesets : grille de tiles 16x16, PNG indexé 16 couleurs
  assets/<tileset>.json # sidecar : autotiles + passabilité (solid/above)
  assets/sprites.png    # bande de frames 16x24 en blocs de personnage de 12
                        # (64 blocs max au projet, 5 par scène), PNG indexé ou RGBA
  assets/font.png       # 96 glyphes 8x8 (ASCII 32-127), bande 768x8, PNG indexé
```

**PNG indexés ou truecolor** : en PNG indexé, l'index de palette de chaque
pixel EST l'index de couleur SNES (round-trip sans perte, index 0 =
transparent). Les PNG non indexés (RGB/RGBA — chipsets re-sauvegardés,
exports d'éditeurs d'image) sont **indexés automatiquement** : couleurs
arrondies à la précision SNES (5 bits/canal), alpha < 128 = transparent,
maximum 255 couleurs opaques par image. Palette convertie en BGR555 par
troncature à 5 bits.

## Format de scène (`scenes/<nom>.json`)

```json
{
  "name": "plaine",
  "width": 48, "height": 40,            // en tiles 16x16, min 20x15 (spec)
  "player_start": [3, 3],               // en tiles
  "tileset": "tileset_automne",         // stem d'un tileset (optionnel, Phase 5b)
  "tilemap": [[...], ...],              // couche INFÉRIEURE : ids logiques
  "upper":   [[...], ...],              // couche SUPÉRIEURE : -1 = vide
  "actors": [
    {"type": "npc", "x": 8, "y": 4, "sprite": 4,
     "dir": "left", "entry": "compteur"},  // entry : label du script (optionnel)
    {"type": "trigger", "x": 12, "y": 10, "entry": "panneau"}, // au contact
    {"type": "auto", "x": 0, "y": 0, "entry": "intro"}  // au chargement
  ],
  "warps": [                               // optionnel (Phase 4)
    {"x": 12, "y": 1, "to": "clairiere", "tx": 16, "ty": 2}
  ],
  "script": [ "...lignes assembleur..." ]
}
```

**Ids logiques de tiles** : `0..N-1` = tile de la grille PNG (rangée par
rangée), `1000+k` = autotile k du sidecar, `-1` = vide (couche sup
uniquement). **Il n'y a plus de couche collision auteur** (Phase 5c) : la
collision est dérivée de la passabilité du tileset — le champ `collision`
des vieux fichiers est ignoré.

**Warps** : marcher sur la tile (x,y) téléporte le joueur vers la scène `to`
en (tx,ty). La tile doit être passable (passabilité dérivée) — datagen y
pose la valeur 0x02 (spec §1.4) et valide la cible.

**Musique (Phase 4b)** : `project.json` liste les modules Impulse Tracker
dans `"musics"` (l'ordre donne les music_id) ; chaque scène peut déclarer
`"music": "<stem>"` (absent = silence). datagen copie les .it vers
`engine/src/data/music/NN_stem.it` ; le Makefile moteur les convertit en
soundbank (smconv) épinglé en bank $87. La musique du demo (pollen8) vient
des exemples PVSnesLib — placeholder à remplacer.

`dir` : `down` / `up` / `left` / `right`. `sprite` : index du **bloc de
personnage** dans la feuille de sprites du projet (12 frames par bloc,
modèle RM2003). En binaire, datagen le remappe vers le slot local du
sprite set de la scène (5 blocs max par scène, spec §5).

**Types d'acteurs (v0.6, déclencheurs RM2003)** : `npc` = PNJ qui parle
avec A (et se tourne vers le héros) ; `trigger` = traversable, son script
part quand le héros **marche sur sa tile** (Player Touch) ; `auto` = son
script part **au chargement de la scène** (Autorun — boot ou arrivée par
warp). `trigger`/`auto` exigent `entry`.

Depuis la v0.8, **l'apparence est indépendante du déclencheur** : un acteur
de contact ou auto peut porter un `sprite` (coffre, panneau, PNJ qui aborde
le héros) et reste traversable ; `sprite: -1` le rend invisible (compilé en
`sprite_id = 0xFF`, spec §1.3).

## Événements (Event Editor — A2)

**`events`** est la forme moderne des acteurs (l'Event Editor de l'éditeur
les produit) : datagen les compile vers des acteurs + du bytecode VM, et
leurs textes INLINE rejoignent automatiquement la bank de textes
(dédupliqués). Le format binaire ne change pas.

```json
"events": [
  {"name": "Fleuriste", "x": 23, "y": 14,
   "trigger": "action",              // action (A) | touch (contact) | auto
   "sprite": 1, "dir": "down",       // apparence : bloc ; -1 = invisible
   "commands": [
     {"c": "msg", "text": "Bonjour !"},
     {"c": "choice", "options": [       // 2-4 options, branches "do"
        {"text": "Oui", "do": [ {"c": "set", "var": "g1", "value": 1} ]},
        {"text": "Non", "do": []} ]},
     {"c": "add", "var": "v0", "value": 1},
     {"c": "if", "var": "g1", "op": "==", "value": 1,
      "then": [ ... ], "else": [ ... ]},   // op : == != >=
     {"c": "warp", "to": "bourg", "x": 16, "y": 28},
     {"c": "face", "event": 0, "dir": "down"},
     {"c": "switch", "n": 12, "on": true},          // v0.9 : 512 switches
     {"c": "var", "n": 3, "op": "+", "value": -2},  // 256 variables 16-bit
     {"c": "if_sw", "n": 12, "on": true, "then": [], "else": []},
     {"c": "if_var", "n": 3, "op": ">=", "value": 10, "then": [], "else": []}
   ]}
]
```

L'apparence est libre quel que soit le déclencheur (v0.8) : `sprite >= 0`
affiche le personnage, `-1` rend l'event invisible. Seul un event « touche
action » **exige** une apparence — sans sprite, le héros n'aurait rien à
aborder. `entry` (label du script assembleur de la scène) reste possible pour les
events sans `commands` — les deux mondes cohabitent. La variable de
travail des `choice` sans `"var"` est **v63** (réservée par convention).

**PNJ mobiles (v0.11)** : `"move"` sur un event ou une page —
`"static"` (défaut), `"random"`, `"vertical"`, `"horizontal"`. Réservé aux
déclencheurs « touche action » ; le PNJ se déplace d'une tile à la fois à
la moitié de la vitesse du héros, sans jamais marcher sur lui ni sur un
autre event, et gèle pendant les dialogues.

**Move Route (v0.12)** : `{"c":"route","event":-1,"repeat":false,
"skip":false,"steps":[{"s":"right"},{"s":"wait","n":4},{"s":"face"}]}` —
`event` : -1 = cet event, sinon n° d'ENTRÉE (les pages comptent) ; pas :
`down/up/left/right`, `tdown/tup/tleft/tright` (tourner), `fwd`, `face`,
`{"s":"wait","n":1-15}` (n×8 frames), et v0.13 : `mrand/mhero/mflee`
(marcher au hasard / vers / fuir le héros), `t90r/t90l/t180/t90x/trand/
tflee` (rotations), `spd+/spd-` (vitesse 1-4), `frq+/frq-` (fréquence
1-8), `fixon/fixoff` (direction fixe), `thruon/thruoff` (passe-muraille),
`{"s":"swon"|"swoff","n":0-511}` (switch dans la route),
`{"s":"gfx","block":b}` (changer le graphisme — le bloc compte dans les
5 charsets de la scène). La route accepte `"freq":1-8` (défaut 3).
L'itinéraire part en tâche de fond ;
`{"c":"wait_route"}` bloque jusqu'à la fin des itinéraires non répétés,
`{"c":"wait","frames":n}` fait une pause. Assembleur : `ROUTE <acteur|self>
<r> <s> <pas...>`, `WAITROUTE`, `WAIT <frames>`.

**v0.13** : `{"c":"var"}` gagne l'arithmétique complète (`op` : `=`, `+`,
`-`, `*`, `/`, `%`, `rand`) et des sources (`from` : `const` (défaut),
`var` (value = n° de variable source), `hero_x`, `hero_y`, `timer`) ;
`{"c":"timer","op":"start|stop|show|hide","secs":n}` (affichage « M:SS »
coin haut-droit) ; `{"c":"campan","x","y","speed":1-8}` (non bloquant),
`{"c":"cam_return","speed"}`, `{"c":"wait_cam"}`. Assembleur : `VAROP
<dst> <op> <const|var|hx|hy|timer> <src>`, `TIMER <op> <val>`, `CAMPAN`,
`CAMRET`, `WAITCAM`.

**v0.15 (positions)** : `{"c":"hero_loc","vs":n,"vx":n,"vy":n}` mémorise
la position du héros (scène/X/Y) dans trois variables 16-bit — compilé
en trois `VAROP` (nouvelle source `scene`) ; `{"c":"warp_var","vs","vx",
"vy"}` la rappelle (téléport, termine le script — assembleur `WARPV`) ;
`{"c":"setpos","event":-1|n,"from":"const"|"vars","x","y"}` place un
event sur (x,y) ou (`vars16[x]`, `vars16[y]`) — assembleur `SETPOS
<acteur|self> <c|v> <x> <y>` ; `{"c":"swappos","a":-1|n,"b":-1|n}`
échange deux events — assembleur `SWAPPOS <a|self> <b|self>`. `-1`/`self`
= cet event (résolu en index d'entrée par datagen, comme route).

**Layouts uigen v1 (Phase 11, docs/SPEC_SYSTEME_UI.md §3)** :
`ui/layout.toml` — positions/tailles EN TILES (écran 32x28). `[message]`
et `[choice]` déplacent/retaillent les fenêtres de dialogue et de choix
(`pos = [x, y]`, `size = [w, h]`, minimum 8x3 — absentes = boîte
historique en bas pleine largeur). `[[overlay]]` déclare des fenêtres
PERMANENTES (HUD) dans les 4 rangées du haut (8 max, sans chevauchement,
content v1 : `variable_display` avec `var` + `label` ASCII) — redessinées
dès que la variable change, même pendant les dialogues. uigen refuse
l'invalide à la compilation (bornes, zone, chevauchements) et émet les
defines de ui_cfg.h + ui_overlays.c.

**Thème UI v1 (Phase 11, docs/SPEC_SYSTEME_UI.md)** : `project.json`
accepte `"ui": {"windowskin": "assets/....png", "text_speed": n}`. Le
windowskin est un PNG **24x24** (9-slice : 3x3 tiles 8x8, indexes 0-3 =
transparent/fond/bord/accent — la palette de la FONTE) converti par
datagen en 9 chars BG3 après la fonte ; la textbox et les choix se
dessinent avec ce cadre (absent = boîte pleine historique).
`text_speed` = frames par caractère de la machine à écrire (0 =
instantané, défaut) ; en jeu, A révèle tout puis ferme. datagen émet
`ui_cfg.h` (UI_HAS_SKIN, UI_TEXT_SPEED).

**\v[n] dans les textes (v0.17)** : `{"c":"msg"}` (et les options de
choix) acceptent `\v[n]` — la valeur de la variable 16-bit n (0-254)
est insérée en décimal au moment de l'affichage (spec §2). Exemple :
`"Tu as \v[12] pieces d'or."`.

**Database (Phase 10)** : datagen embarque « dbgen » (module `db.rs`) —
`schemas/*.toml` + `data/*.toml` → `db_<table>.c` (tables byte-packed)
+ `db_index.c` (registre pour l'opcode DBREAD, toujours émis — vide
sans schémas) + `db_tables.h` (constantes `TABLE_ID`, tailles,
offsets). Format et règles : `docs/PLANNING_SYSTEME_DATABASE.md`
(contractuel). Le fichier `schemas/_index.json` est un manifeste
maintenu par l'éditeur pour son mode navigateur — ignoré par dbgen (le
dossier fait foi).

**v0.17 (lire la database depuis les events)** :
`{"c":"db_read","table":"stats","from":"const"|"var","entry":"slime"|
<n° de variable>,"field":"attack","dst":n}` — `vars16[dst]` = champ de
la fiche ; `from:"var"` lit le n° de fiche dans une variable (hors
table → 0). events.rs résout table/entrée/champ symboliques vers
l'assembleur `DBREAD <table> <src> <entrée> <ofs> <taille> <dst>`
(spec §2). flags8 : l'octet des bits ; ref : l'index de la fiche visée.

**Phase 12 (visibilité des widgets UI)** :
`{"c":"ui_show","widget":"<id de racine du layout>","on":true|false}` —
affiche/cache un WIDGET du designer (ui/layout.toml). Les widgets sont
CACHÉS au démarrage (sauf `visible = true` sur la racine) ; events.rs
résout le nom vers son index de racine (`SHOWUI <widget> <0|1>`, opcode
0x24). Nom introuvable = erreur de compilation avec la liste des
widgets du projet.

**Phase 12 (Key Input Processing, façon RM2003)** :
`{"c":"key_input","var":n,"wait":true|false,"keys":[codes 1-12]}` —
écrit dans `vars16[var]` le code de la touche (1 bas, 2 gauche,
3 droite, 4 haut, 5 A, 6 B, 7 Y, 8 X, 9 L, 10 R, 11 Select, 12 Start ;
0 = aucune). `wait` bloque jusqu'à un appui NEUF d'une touche cochée
(marche aussi dans un Parallel process). `{"c":"sysmenu"}` ouvre le
menu Système (sauvegarde) — **le mapping START en dur du moteur est
retiré** : l'auteur choisit sa touche (key_input + condition, ou tout
autre déclencheur).

**Phase 12 S1 (styles de dialogue)** : `ui/layout.toml` accepte des
blocs `[[dialog_style]]` (max 3 en plus du défaut) — `id` ASCII unique,
`windowskin` (PNG 24x24, défaut : celui du thème), `font` (PNG 768x8 —
96 glyphes 8x8, défaut : `assets.font`), `message = { pos, size }`
(défaut : `[message]`), `choice = { pos, size }` (défaut : le message
du style). Fenêtres min 8x3 dans 32x28 ; les overlays ne doivent
chevaucher AUCUNE fenêtre d'AUCUN style. Les commandes msg/choice
prennent un champ optionnel `"style": "<id>"` (absent = boîte par
défaut, TOUJOURS présente) — events.rs résout le nom (erreur avec la
liste sinon) et émet `DLGSTYLE <n>` (opcode 0x27) devant la boîte,
UNIQUEMENT si le projet a des styles (sans styles le bytecode est
byte-identique). Budget VRAM BG3 : 256 chars — fonte 0 en occupe 97,
chaque windowskin 9, les icônes 2×N, chaque fonte supplémentaire 96
(dédupliqués) ; dépassement = erreur datagen détaillée. v1 : toutes
les fontes/skins partagent la palette de la fonte 0. `project.json`
accepte `"fonts": [...]` (registre éditeur des FontSets, ignoré par
datagen — layout.toml fait foi).

**Couche d'effet (S9, « nuages sur le village »)** : une scène accepte
`"effect": {"pic": "<stem>", "dx": px/s, "dy": px/s, "blend":
"half"|"add"|"sub", "parallax": "half"|"quarter"}` — un MOTIF (image à TRANSPARENCE de
project.pictures, ≤ 256 tiles uniques) dérive au-dessus du jeu pendant
qu'il se joue (personnages visibles, dialogues nets). Le plan BG1
porte le motif : la COUCHE SUP de ces scènes est ignorée
(avertissement si non vide). VRAM : chars à $0000-$1000, carte 32x32
au creux $1C00 (après la map BG3) ; entrées avec bit de
priorité (motif DEVANT les sprites) ; en mélange, sub screen BG2+OBJ
et teinte/flash suspendus (screenfx_cm_hold). Vitesses converties en
pas 8.8 par frame ; **parallax (S11)** : le scroll du motif reçoit
en plus `camera >> 1` (half) ou `camera >> 2` (quarter) — le motif
glisse à une fraction du décor quand la caméra bouge (profondeur),
absent = fixe à l'écran ; datagen émet `data_effects.c` (toujours — 0xFF =
scène sans effet). Le motif étant ≤ 224 px de haut, le défilement
vertical montre une bande vide de 32 px par période (motifs épars :
invisible). **Cellule vide (S10)** : `-1` est accepté sur les DEUX
couches des scènes (gomme) — char transparent, le fond (CGRAM 0,
forcé NOIR par le moteur) se voit, cellule passable.

**Phase 12 S3 (pictures, façon RM2003)** : `project.json` accepte
`"pictures": ["assets/....png", ...]` — LU par datagen (l'ordre donne
les pic_id). Chaque image : PNG **indexé ≤ 16 couleurs** (palette
paddée tolérée : seuls les INDEX utilisés comptent), dimensions
multiples de 8, max **256x224** (calée en HAUT-GAUCHE d'une carte
32x32 complétée de padding transparent — le placement écran se fait
par scroll), **≤ 512 tiles 8x8 uniques** après dédoublonnage (la
région VRAM des sprites, empruntée pendant l'affichage — aplats et
motifs répétés dédupliquent très bien). datagen émet `data_pic{i}.c`
(une section = une bank) + le registre `data_pictures.c` (toujours,
tables factices sans image ; max 32 images). Commandes :
`{"c":"pic_show","pic":"<stem>"}` (SHOWPIC, nom résolu — erreur avec
la liste sinon) affiche l'image — les messages et choix se jouent
PAR-DESSUS (BG3) ; `{"c":"pic_hide"}` (HIDEPIC) la referme, scène et
events INTACTS. Refermer dans le même script. **Options S5/S7 (façon
Show/Move Picture RM2003)** : `pic_show` accepte `"x"`/`"y"` (position
écran en pixels, défaut = image centrée — datagen calcule avec les
dimensions du PNG et valide x+w ≤ 256, y+h ≤ 224), `"pic_var"` (numéro
d'image lu dans une variable — remplace `"pic"`, flags bit 0),
`"x_var"`/`"y_var"` (position lue dans des variables, flags bit 1 —
le MOTEUR clampe alors aux dims réelles, tables `pic_wt`/`pic_ht` du
registre) et `"dur"` (frames de CHAQUE fondu, 0 = instantané, défaut
16 ; `"fade": false` = héritage S5, équivaut à dur 0). `pic_hide`
accepte `"dur"`. **`"blend"` (S8)** : `"half"` (semi-transparent 50 %),
`"add"` (additif) ou `"sub"` (soustractif) — l'image se fond avec le
décor par le color math (flags bits 3-4) ; absent = opaque. La teinte
d'écran est suspendue le temps de l'image (même circuit). **`pic_move` (S7)** : glisse l'image affichée vers
`x`/`y` (ou `x_var`/`y_var`) en `"dur"` frames, SANS bloquer le script
(0 = saut) — absent = centre. Émis en `SHOWPIC id x y flags dur` /
`HIDEPIC dur` / `MOVEPIC x y flags dur` (flags : bit 0 image-variable,
bit 1 position-variables, bit 2 centrage moteur).
**Transparence (S4)** : une entrée `{"path": "...", "trans": true}`
marque une image à TRANSPARENCE (pixels d'alpha < 128, percés par le
sélecteur de couleur de l'éditeur à l'import) — en jeu, la couche
DÉCOR de la carte reste visible derrière les pixels percés (pas les
personnages : leur mémoire vidéo porte l'image). Ces images vivent sur
la **palette BG 7** (entrées de tilemap marquées par datagen, couleurs
113-127 — les palettes 0-6 et la couleur de fond de la scène sont
préservées) ; ≤ 15 couleurs opaques. Si un tileset occupe déjà la
palette 7, datagen l'avertit : le décor serait faux dans SES scènes.

**Phase 12 S2 (fonte par widget)** : un `[[node]]` RACINE accepte
`font = "assets/....png"` (768x8 — erreur uigen si posé sur un enfant) :
tout le texte du widget est dessiné avec cette fonte. Même plan VRAM
dédupliqué que les fontes des styles (une fonte partagée entre style et
widget ne compte qu'une fois) ; uigen émet la table par-primitive
`ui_ov_font[]` (base du glyphe ' ', 1 = fonte du projet) dans
ui_overlays.c.

**v0.16 (common events)** : `project.json` porte `"common_events":
[{"name","trigger":"none"|"auto"|"parallel","switch":n?,"commands":
[...]}]` — des scripts globaux au projet, modèle RM2003.
`{"c":"call","n":k}` les appelle depuis n'importe quel event (assembleur
`CALL <label>` / `RET`, pile de 8 niveaux — un common peut en appeler un
autre). Le switch de condition est OPTIONNEL (absent = toujours actif,
comme la case décochée de RM2003) : `"auto"` = Autorun RM2003, relancé
tant que la condition passe dès que la VM est libre (gèle le joueur — le
script doit éteindre son switch, ou tourner pour toujours si aucun) ;
`"parallel"` = Parallel process, tourne en tâche de fond sans geler le
joueur (messages et choix REFUSÉS par datagen, transitivement à travers
les appels). datagen n'émet dans chaque scène que les corps
référencés (transitivement) et prépose la table `CETAB <a|p> <switch>
<label>…` en tête du bloc scripts (spec §2). Dans un common event,
« cet event » désigne l'acteur qui a lancé le script appelant.

**v0.16 (warps)** : une entrée warp accepte `"dir":"down"|"up"|"left"|
"right"` — direction du héros à l'arrivée ; absente = conservée
(« Retain » RM2003). Écrite dans WarpDef.flags (spec §1.5).

**v0.15 (écran)** : `{"c":"scr_hide","speed":1-15}` / `{"c":"scr_show",
"speed"}` — fondu sortant/entrant bloquant (assembleur `SCRHIDE`/
`SCRSHOW <vitesse>`) ; `{"c":"tint","mode":"off"|"add"|"sub","r","g",
"b"}` (0-31) — teinte du décor, immédiate et persistante (`TINT <mode>
<r> <g> <b>`) ; `{"c":"flash","r","g","b","frames"}` — flash décroissant
non bloquant (`FLASH`) ; `{"c":"shake","power":0-8,"speed":1-8,
"frames"}` — secousse horizontale non bloquante, power 0 = stop
(`SHAKE`). La teinte et le flash ne touchent ni le texte ni les
personnages (hardware SNES : color math OBJ limité aux palettes 4-7).

**v0.15** : `{"c":"loop","do":[...]}` — boucle RM2003 : le corps se
répète pour toujours ; `{"c":"break"}` saute à la fin de la boucle la
plus proche (hors d'une boucle : erreur datagen). Compilation pure
(label de tête + `JMP`, aucun opcode nouveau). Une boucle sans commande
bloquante est légale : la VM exécute 32 opcodes par frame puis rend la
main (plus de halt debug sur budget épuisé). `{"c":"rem","text":"..."}` —
commentaire décoratif de l'éditeur, aucun bytecode émis (le texte n'a
pas la contrainte ASCII des messages).

**v0.14** : par event ou par page — `"move": "custom"` +
`"move_route": {"freq":1-8,"repeat":bool,"skip":bool,"steps":[...]}`
(mêmes pas que la commande route) ; `"priority": "below"|"same"|"above"`
(défaut same) ; `"speed": 1-4` (défaut 1). En binaire : entrée acteur
16 octets, blob de route en queue du bloc scripts (directive interne
`RTBLOB`).

**Pages (v0.10)** : un event peut remplacer ses champs plats par
`"pages": [...]` — chaque page a `condition` (`{"switch": n, "on": bool}`
ou `{"var": n, "min": v}`, absente = toujours), `trigger`, `sprite`,
`dir`, `commands`. datagen compile chaque page en une entrée acteur
consécutive (12 octets, spec §1.3) ; en jeu, la dernière page dont la
condition passe est active. Exemple coffre : page 1 sans condition
(donne l'objet puis `switch 12 ON`), page 2 `{"switch":12,"on":true}`
(apparence ouverte, « déjà vide »).

**v0.9** : les `switch` (0-511) et `var` 16-bit (0-255) sont globaux,
persistants et sauvegardés (spec §4bis v2) — c'est le modèle RM2003. Les
commandes 8-bit `set`/`add`/`if` sur `v<n>`/`g<n>` restent compilées
(héritage), mais l'Event Editor ne propose plus que les versions
modernes. Assembleur : `SW`, `JSW`, `SET16`, `ADD16`, `JCMP16` (spec §2).
Imbrication maximale : 6 niveaux.

**Tilesets (Phase 5)** : PNG en grille de tiles 16x16 (dimensions multiples
de 16, max 999 tiles), indices **rangée par rangée** comme la palette
RPG Maker, jusqu'à 256 couleurs (chipsets). datagen compile les gfx **par
scène** (v0.4) : seules les tiles utilisées partent en VRAM — limites par
scène : 254 tiles distinctes, 512 chars 8x8 (char 0 réservé transparent),
8 palettes de 15 couleurs (réparties automatiquement par char).
**Par scène (Phase 5b)** : `project.json` liste les tilesets dans
`"tilesets"` (l'ordre donne les tileset_id ; absent = `assets.tileset`
seul) ; chaque scène peut déclarer `"tileset": "<stem>"` (absent = le
premier). datagen valide les ids des deux couches contre le tileset de la
scène. **Feuille de sprites (Phase 6)** : bande de frames **16x24**, en
**blocs de personnage de 12 frames** (4 directions bas/haut/gauche/droite ×
3 pas repos/pas A/pas B — modèle charset RM2003). Joueur = bloc 0,
`sprite` d'un acteur = index de bloc. Le projet peut avoir de nombreux
blocs (64 max) : datagen compile un **sprite set par scène** (comme les
tilesets) avec seulement le joueur + les blocs des acteurs de la scène —
**5 blocs max par scène** (limite VRAM SNES), erreur explicite au-delà.
Chaque bloc reçoit sa palette OBJ (15 couleurs + transparent ; au-delà,
fusion automatique des plus proches avec avertissement). Chaque frame est
rendue par 2 OBJs 16x16 empilés, ancrés avec 8 px de débord au-dessus de
la tile (la tête chevauche la tile du dessus). `project.json` peut porter
`"charsets": ["Héros", ...]` — noms des blocs affichés par l'éditeur
(ignoré par datagen). Les tiles destinées à la couche sup doivent avoir un
**fond index 0** (transparent) pour laisser voir le sol.

## Sidecar de tileset (Phase 5c — modèle RPG Maker 2003)

`assets/<tileset>.json`, optionnel (absent = tout passable, pas d'autotiles) :

```json
{
  "autotiles": ["assets/eau_auto.png", "assets/chemin_auto.png"],
  "solid": [1, 3, 4, 1000],
  "above": [5]
}
```

- **`autotiles`** : PNG 48x64 au format autotile RM2003 (3x4 tiles 16x16 :
  îlot d'aperçu, case inutilisée, coins internes, puis bloc 9-slice).
  datagen calcule les bordures par quarts 8x8 selon les voisins de même
  autotile (bord de map = même) et n'émet que les variantes utilisées.
  Id logique de l'autotile k : `1000+k`. Pas encore : animation (eau).
- **`solid`** : ids logiques bloquants (X). **`above`** : ids ☆ — dessinés
  AU-DESSUS du héros quand ils sont sur la couche sup, jamais bloquants.
- Collision dérivée par cellule : tile sup présente et non-☆ → sa
  passabilité l'emporte (un pont passable sur une eau solide), sinon celle
  de la tile inférieure.

## Import de chipsets RPG Maker 2003

```bash
cargo run --release --manifest-path tools/Cargo.toml -p datagen -- \
  import-chipset mon_chipset.png demo bourg
```

Découpe un chipset RM2003 (PNG indexé 480x256, layout LCF) en assets
projet : `assets/<nom>.png` (grille 6 colonnes : 144 tiles basses puis 144
hautes — le sidecar note `upper_start: 144` pour que l'éditeur filtre la
palette par couche), les **12 autotiles de sol** (copie directe, format
natif), l'**eau A** convertie en autotile statique (approximation : bordures
recomposées depuis la frame 0 — pas d'animation), et le sidecar. Le tileset
est ajouté à `project.json`. La couleur de fond de la première tile haute
devient l'index 0 (transparent). La passabilité arrive vierge (eau solide
par défaut) : se règle dans l'éditeur, mode « Passabilité O/X/☆ ». Non
importés : eau B/eau profonde, tiles d'animation (cascades).

## Import de charsets RPG Maker 2003

```bash
cargo run --release --manifest-path tools/Cargo.toml -p datagen -- \
  import-charset mon_charset.png demo 2 1
```

Importe un personnage d'un charset RM2003 (PNG **288x256** = 8 personnages
de 72x128, ou **72x128** = un seul) vers un **bloc** de la feuille de
sprites du projet (`assets.sprites`). Arguments : personnage (0-7, en
lisant par rangées) puis bloc de destination (0-63 ; 0 = joueur). Chaque
frame RM2003 24x32 est recadrée en 16x24 (centre-bas) ; l'ordre RM des
rangées (haut, droite, bas, gauche) et des colonnes (pas gauche, repos,
pas droit) est recomposé vers le nôtre. La feuille est réécrite en PNG
RGBA (étendue au besoin) — la transparence vient de l'alpha, ou de
l'index 0 de la palette pour un charset indexé (convention RM2003).

## Assembleur de scripts (VM v0, spec §2)

Une instruction par ligne, `;` commentaire, `label:` pour les cibles de saut.
Les acteurs pointent sur un label via `entry` — plus d'offsets à la main.

```
salut:
  JEQ g1 1 deja         ; g0..g63 = variables GLOBALES (persistent entre
  MSG q_fleur           ;   scenes) - pattern give/has de RM2003
  CHOICE v1 opt_oui opt_non   ; 2-4 choix, index choisi -> v1
  JEQ v1 1 refus
  MSG r_fleur
  SETVAR g1 1           ; « donner la fleur » : une gvar
  END
refus:
  MSG r_non
  END
deja:
  MSG deja_fleur
  END
panneau:                ; script d'un acteur "trigger" (au contact)
  CHOICE v2 opt_oui opt_non
  JEQ v2 0 va_bourg
  END
va_bourg:
  WARP bourg 16 28      ; teleporte le heros - termine le script
```

Opcodes (spec §2 v0.6) : `END`, `MSG <texte>`, `SETVAR|ADDVAR v<n>|g<n>
<val>`, `SETGVAR g<n> <val>` (alias), `JMP <label>`, `JEQ|JNE|JGEQ
v<n>|g<n> <val> <label>`, `CHOICE v<n>|g<n> <texte>...` (2-4 choix),
`WARP <scene> <x> <y>`, `FACE <acteur> <down|up|left|right>`.
La table est contractuelle (spec §2) — l'outil refuse tout le reste.

## Garanties

- Sortie déterministe : mêmes sources → mêmes fichiers.
- Validations : dimensions de map (min 20x15, cohérence des couches),
  labels/textes inconnus, variables hors 0-63, textes non-ASCII, types
  d'acteur inconnus → erreur explicite, rien n'est écrit de corrompu.
- Vérifié en régression : le projet `demo/` régénère à l'identique les
  données validées de la Phase 1 (bytecode des scripts compris).
