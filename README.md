# SNES Studio

Outil de création de jeux SNES no-code (esprit GB Studio / RPG Maker) —
l'utilisateur crée son jeu visuellement et exporte un ROM `.sfc` autonome,
jouable sur émulateur et vraie console.

**Architecture : moteur SNES fixe + VM bytecode — les jeux sont des DONNÉES,
pas du code.**

## État du projet

Les trois briques sont en place et se répondent : l'éditeur écrit les
fichiers du projet, `datagen` les traduit en C et en banks binaires, le
moteur les lit sans rien savoir du jeu.

```
editor/    # Éditeur Tauri + React + TS
tools/     # Pipeline d'assets en Rust (datagen)
engine/    # Moteur SNES en C (PVSnesLib) + ASM 65816
demo/      # Projet de référence — sujet de la régression pixel
showcase/  # Projet plus large — database, écrans composés, animations, UI
docs/      # Specs et conception — sources de vérité
```

## Build

Prérequis : [PVSnesLib](https://github.com/alekmaul/pvsneslib) installé,
variable `PVSNESLIB_HOME` définie (chemin style Unix, y compris sous
Windows/MSYS2 — ex. `/c/snesdev/pvsneslib`).

```bash
cd engine
make            # produit snesstudio.sfc
make clean      # en cas de doute sur les artefacts
make data       # regénère src/data/ depuis demo/ (nécessite Rust/cargo)
```

Les fichiers `engine/src/data/*.c` sont **générés** par `tools/datagen`
depuis le projet `demo/` — les éditer à la main sera écrasé ; éditer les
sources JSON/PNG de `demo/` à la place (voir `docs/TOOLS.md`).

Émulateurs de validation : **Mesen2** (debug quotidien) et **bsnes mode
accuracy** (juge de paix — un rendu correct dans Mesen2 seul ne suffit pas).

## Documentation

Pour contribuer, commencer par **`CONTRIBUTING.md`** : conventions,
politique de commentaires, et les trois garde-fous à lancer avant de
pousser.

- `docs/ENGINE_CONSTRAINTS.md` — pièges de la plateforme et de la
  toolchain. **À lire avant d'écrire du code moteur** : la plupart sont
  silencieux (C légal, build vert, sortie fausse).
- `docs/PERF_MEASUREMENTS.md` — le relevé de performance et la méthode
  qui l'a produit.
- `docs/SPEC_FORMATS.md` — spec contractuelle des formats de données et
  de la VM (tenue à jour avec le code).
- `docs/TOOLS.md` — le pipeline datagen.
- `docs/EDITOR.md` — architecture de l'éditeur.
