# TOOLS — pipeline d'assets (Phase 2)

**Statut :** Phase 2b. `datagen` transforme un projet source (JSON + PNG
indexés) en données moteur. **La source de vérité est le dossier projet
(`demo/`) — tout ce qui suit est GÉNÉRÉ :**

- `engine/src/data/scenes.bin` — bank $82 : Scene Table à $82:8000 + scènes,
  format binaire byte-exact de la spec §1 (far 24-bit)
- `engine/src/data/texts.bin` — bank $86 : table d'offsets + chaînes
- `engine/databanks.asm` — épingle les blobs dans leurs banks
- `engine/src/data/data_assets.c` + `data_font.c` — assets gfx (C arrays,
  pas de format binaire en spec pour eux)

## Usage

```bash
# depuis la racine
cargo run --release --manifest-path tools/Cargo.toml -p datagen -- demo engine

# ou depuis engine/
make data
```

## Structure d'un projet source

```
demo/
  project.json          # nom, boot_scene, scènes, assets, musics, tilesets
  texts.json            # [{name, text}] — l'ordre donne les text_id
  scenes/<nom>.json     # une scène par fichier
  assets/*.png          # tilesets : grille de tiles 16x16, PNG indexé 16 couleurs
  assets/<tileset>.json # sidecar : autotiles + passabilité (solid/above)
  assets/sprites.png    # bande de frames 16x16 (max 64), PNG indexé
  assets/font.png       # 96 glyphes 8x8 (ASCII 32-127), bande 768x8, PNG indexé
```

**PNG indexés obligatoires** : l'index de palette de chaque pixel EST l'index
de couleur SNES (round-trip sans perte). Palette convertie en BGR555 par
troncature à 5 bits. Index 0 = transparent.

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
     "dir": "left", "entry": "compteur"}   // entry : label du script (optionnel)
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

`dir` : `down` / `up` / `left` / `right`. `sprite` : index de la frame « bas »
dans la feuille de sprites (convention metasprite : frame = sprite + dir).

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
scène. **Feuille de sprites** : frames 16x16, layout OBJ multi-rangées
généré ; convention : joueur = frames 0-7 (direction×2 + pas de marche),
PNJ à partir de la frame 8 (4 frames directionnelles — `sprite` = frame de
base). Les tiles destinées à la couche sup doivent avoir un **fond index 0**
(transparent) pour laisser voir le sol.

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

## Assembleur de scripts (VM v0, spec §2)

Une instruction par ligne, `;` commentaire, `label:` pour les cibles de saut.
Les acteurs pointent sur un label via `entry` — plus d'offsets à la main.

```
compteur:
  JGEQ v0 2 deja_vu     ; v0..v63 = variables de scene
  MSG bonjour           ; nom d'un texte de texts.json
  ADDVAR v0 1
  END
deja_vu:
  MSG encore
  END
```

Opcodes : `END`, `MSG <texte>`, `SETVAR v<n> <val>`, `ADDVAR v<n> <val>`,
`SETGVAR g<n> <val>`, `JMP <label>`, `JEQ|JNE|JGEQ v<n> <val> <label>`.
La table est contractuelle (spec §2) — l'outil refuse tout le reste.

## Garanties

- Sortie déterministe : mêmes sources → mêmes fichiers.
- Validations : dimensions de map (min 20x15, cohérence des couches),
  labels/textes inconnus, variables hors 0-63, textes non-ASCII, types
  d'acteur inconnus → erreur explicite, rien n'est écrit de corrompu.
- Vérifié en régression : le projet `demo/` régénère à l'identique les
  données validées de la Phase 1 (bytecode des scripts compris).
