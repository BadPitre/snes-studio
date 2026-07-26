# SNES Studio

Outil de création de jeux SNES no-code (esprit GB Studio / RPG Maker) —
l'utilisateur crée son jeu visuellement et exporte un ROM `.sfc` autonome,
jouable sur émulateur et vraie console.

**Architecture : moteur SNES fixe + VM bytecode — les jeux sont des DONNÉES,
pas du code.**

## État du projet

**Phase 1 — POC moteur data-driven** (voir `docs/PLANNING_PHASES_DEV.md`).
Le POC : map scrollante streamée, joueur, collision, PNJ interactifs,
dialogues pilotés par une VM bytecode 8 opcodes — le tout défini par les
données de `engine/src/data/`.

```
engine/   # Moteur SNES en C (PVSnesLib) — Phase 1
tools/    # Pipeline d'assets en Rust — Phase 2 (à venir)
editor/   # Éditeur Tauri + React + TS — Phase 3 (à venir)
demo/     # Jeu de test permanent / régression
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
```

Émulateurs de validation : **Mesen2** (debug quotidien) et **bsnes mode
accuracy** (juge de paix — un rendu correct dans Mesen2 seul ne suffit pas).

## Documentation

- `docs/KIT_PHASE1_POC_MOTEUR.md` — le kit de la Phase 1 (architecture,
  planning, pièges)
- `docs/SPEC_FORMATS.md` — spec contractuelle des formats de données et de
  la VM (tenue à jour avec le code)
- `docs/CLAUDE.md` — conventions de développement du projet
