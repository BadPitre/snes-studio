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
  project.json        # nom, boot_scene, scènes, assets, musics (modules .it)
  texts.json          # [{name, text}] — l'ordre donne les text_id
  scenes/<nom>.json   # une scène par fichier
  assets/tileset.png  # bande de tiles 16x16, PNG indexé 16 couleurs max
  assets/sprites.png  # bande de frames 16x16 (max 64), PNG indexé
  assets/font.png     # 96 glyphes 8x8 (ASCII 32-127), bande 768x8, PNG indexé
```

**PNG indexés obligatoires** : l'index de palette de chaque pixel EST l'index
de couleur SNES (round-trip sans perte). Palette convertie en BGR555 par
troncature à 5 bits. Index 0 = transparent.

## Format de scène (`scenes/<nom>.json`)

```json
{
  "name": "plaine",
  "width": 48, "height": 40,            // en tiles 16x16, min 32x32 (spec)
  "player_start": [3, 3],               // en tiles
  "tilemap":   [[...], ...],            // height rangées de width indices
  "collision": [[...], ...],            // 0 = libre, 1 = solide
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

**Warps** : marcher sur la tile (x,y) téléporte le joueur vers la scène `to`
en (tx,ty). La tile doit être libre dans la couche collision auteur —
datagen y pose la valeur 0x02 (spec §1.4) et valide la cible.

**Musique (Phase 4b)** : `project.json` liste les modules Impulse Tracker
dans `"musics"` (l'ordre donne les music_id) ; chaque scène peut déclarer
`"music": "<stem>"` (absent = silence). datagen copie les .it vers
`engine/src/data/music/NN_stem.it` ; le Makefile moteur les convertit en
soundbank (smconv) épinglé en bank $87. La musique du demo (pollen8) vient
des exemples PVSnesLib — placeholder à remplacer.

`dir` : `down` / `up` / `left` / `right`. `sprite` : index de la frame « bas »
dans la feuille de sprites (convention metasprite : frame = sprite + dir).

**Tileset (Phase 5)** : tiles source 16x16 ; datagen découpe en chars 8x8,
déduplique (max 512) et génère la table de metatiles. **Feuille de sprites** :
frames 16x16, layout OBJ multi-rangées généré ; convention : joueur =
frames 0-7 (direction×2 + pas de marche), PNJ à partir de la frame 8
(4 frames directionnelles — `sprite` = frame de base).

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
- Validations : dimensions de map (>= 32, cohérence tilemap/collision),
  labels/textes inconnus, variables hors 0-63, textes non-ASCII, types
  d'acteur inconnus → erreur explicite, rien n'est écrit de corrompu.
- Vérifié en régression : le projet `demo/` régénère à l'identique les
  données validées de la Phase 1 (bytecode des scripts compris).
