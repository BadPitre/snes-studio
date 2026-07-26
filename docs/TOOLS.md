# TOOLS — pipeline d'assets (Phase 2)

**Statut :** Phase 2a. `datagen` transforme un projet source (JSON + PNG
indexés) en fichiers de données C consommés par le moteur
(`engine/src/data/*.c`). **Ces fichiers sont désormais GÉNÉRÉS — la source de
vérité est le dossier projet (`demo/`).**

La Phase 2b fera émettre le format binaire byte-exact de la spec (banks
épinglées, Scene Table à adresse fixe, pointeurs far 24-bit) — voir
`SPEC_FORMATS.md` §0.

## Usage

```bash
# depuis la racine
cargo run --release --manifest-path tools/Cargo.toml -p datagen -- demo engine/src/data

# ou depuis engine/
make data
```

## Structure d'un projet source

```
demo/
  project.json        # nom, boot_scene, liste ordonnée des scènes, assets
  texts.json          # [{name, text}] — l'ordre donne les text_id
  scenes/<nom>.json   # une scène par fichier
  assets/tileset.png  # bande de chars 8x8, PNG indexé 16 couleurs max
  assets/sprites.png  # bande de frames 16x16 (max 8), PNG indexé
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
  "script": [ "...lignes assembleur..." ]
}
```

`dir` : `down` / `up` / `left` / `right`. `sprite` : index de la frame « bas »
dans la feuille de sprites (convention metasprite v0 : frame = sprite + dir).

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
