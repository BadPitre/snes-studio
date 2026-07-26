# SNES Studio

Outil de création de jeux SNES no-code (esprit GB Studio / RPG Maker) —
l'utilisateur crée son jeu visuellement et exporte un ROM `.sfc` autonome,
jouable sur émulateur et vraie console.

**Architecture : moteur SNES fixe + VM bytecode — les jeux sont des DONNÉES,
pas du code.**

## État du projet

**Phase 3 — éditeur no-code** (Phases 1-2 : moteur + pipeline validés et
mergés). Le jeu est défini par le projet source `demo/` (JSON + PNG),
éditable visuellement avec l'éditeur ; `datagen` génère les banks binaires
consommées par le moteur.

```
engine/   # Moteur SNES en C (PVSnesLib) — Phase 1 ✓
tools/    # Pipeline d'assets en Rust (datagen) — Phase 2 ✓
editor/   # Éditeur Tauri + React + TS — Phase 3 (MVP)
demo/     # Jeu de test permanent / régression — SOURCE des données
docs/     # Specs et planning — sources de vérité
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

- `docs/KIT_PHASE1_POC_MOTEUR.md` — le kit de la Phase 1 (architecture,
  planning, pièges)
- `docs/SPEC_FORMATS.md` — spec contractuelle des formats de données et de
  la VM (tenue à jour avec le code)
- `docs/CLAUDE.md` — conventions de développement du projet
