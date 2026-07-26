# SNES Studio

Outil de création de jeux SNES no-code (esprit GB Studio / RPG Maker) —
l'utilisateur crée son jeu visuellement et exporte un ROM `.sfc` autonome,
jouable sur émulateur et vraie console.

**Architecture : moteur SNES fixe + VM bytecode — les jeux sont des DONNÉES,
pas du code.**

## État du projet

**Phase 2 — pipeline d'assets Rust** (Phase 1 : POC moteur validé et mergé).
Le jeu (maps, collision, acteurs, scripts, textes, scène de boot) est défini
par le projet source `demo/` (JSON + PNG) ; l'outil `datagen` génère les
données C consommées par le moteur.

```
engine/   # Moteur SNES en C (PVSnesLib) — Phase 1 ✓
tools/    # Pipeline d'assets en Rust — Phase 2 (datagen)
editor/   # Éditeur Tauri + React + TS — Phase 3 (à venir)
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
