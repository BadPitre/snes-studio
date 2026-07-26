# EDITOR — l'éditeur SNES Studio (Phase 3)

**Statut : Phase 3a (MVP).** Application Tauri 2 + React + TypeScript dans
`editor/`. Elle ouvre un dossier projet (le format JSON/PNG documenté dans
`TOOLS.md` — ex. `demo/`) et édite **exactement les fichiers que `datagen`
consomme** : aucun format intermédiaire.

## Fonctionnalités (3a)

- Ouverture d'un projet, sélection de scène
- **Peinture de tiles** au pinceau (palette issue de `tileset.png`)
- **Couche collision** : peinture solide/libre + overlay rouge
- **Acteurs** : placement (+ PNJ), sélection, direction/sprite/label de
  script, suppression — sprites rendus depuis `sprites.png`
- **Départ joueur** (cadre bleu)
- **Script de scène** : édition texte (syntaxe assembleur datagen), les
  labels déclarés alimentent la liste « Script » des PNJ
- **Textes** : édition de la table (ASCII filtré, conforme v0)
- Sauvegarde (Ctrl+S) au format canonique (diffs lisibles)

Pas encore (3b+) : création/redimensionnement de scènes, édition des gfx,
bouton « Build ROM » intégré, undo/redo.

## Lancer

Prérequis : Node.js, Rust (déjà requis pour datagen). Sous Windows,
WebView2 est présent d'office.

```bash
cd editor
npm install
npm run tauri dev      # l'application de bureau
```

Flux de travail : éditer → sauvegarder → `make data && make` dans `engine/`
→ tester le ROM.

## Mode navigateur (dev UI)

Sans Tauri (`npm run dev` / `vite preview`), l'éditeur tourne en lecture
seule dans un navigateur : il charge le projet servi sur `/project`
(copier `demo/` dans `dist/project/` pour un preview). Les écritures sont
ignorées — ce mode sert au développement de l'interface et aux captures.
