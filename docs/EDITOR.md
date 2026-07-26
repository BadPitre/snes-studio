# EDITOR — l'éditeur SNES Studio

**Statut : Phase 5b.** Application Tauri 2 + React + TypeScript dans
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

## Fonctionnalités (3b)

- **Undo/redo** (Ctrl+Z / Ctrl+Y ou Ctrl+Shift+Z) sur toutes les éditions
- **Gestion des scènes** : création (nom + dimensions, contrainte spec
  >= 32x32, bordure de murs par défaut), choix de la **scène de boot** (★),
  suppression (la scène de boot est protégée)
- **« Générer les données »** : sauvegarde puis lance `datagen` directement
  depuis l'éditeur (cargo doit être dans le PATH Windows). Reste ensuite
  `make` dans engine/ (MSYS2) pour produire le .sfc.

- **Warps** (Phase 4) : outil « + Warp » (tile violette W), onglet dédié
  (scène cible + position d'arrivée)
- **Musique par scène** (Phase 4b) : sélecteur ♪ dans la barre d'outils
  (liste = `project.musics` ; ajouter un module = déposer le .it dans le
  projet et l'ajouter à `project.json`)

## Fonctionnalités (5b) — palette façon RPG Maker 2003

- **Palette de tileset verticale** (panneau gauche, 6 colonnes) : clic =
  tile seule, **glisser = sélection rectangulaire** utilisée comme tampon
  multi-tiles ; en peignant sur la map, le motif se répète aligné sur la
  première tile posée (comportement RPG Maker). La sélection reste
  visible quand un autre outil est actif.
- **Tileset par scène** : sélecteur en haut de la palette (liste =
  `project.tilesets`) — changer le tileset d'une scène rebascule la
  palette et le rendu de la map.
- **Import de tileset** : « Importer… » copie un PNG (indexé, grille de
  tiles 16x16, max 256 tiles) dans `assets/` et l'ajoute à
  `project.tilesets`.
- **Redimensionnement de scène** (« Redim. ») : extension en herbe ou
  rognage, bordure de murs reconstruite, acteurs/warps hors limites
  supprimés (avertissement affiché).

Pas encore (côté palette, par rapport à RPG Maker 2003) : autotiles
(bordures automatiques), couches inférieure/supérieure, édition de la
« passabilité » dans la palette (la collision reste une couche peinte à
part). Toujours pas : édition des gfx, `make` intégré.

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
