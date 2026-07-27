# EDITOR — l'éditeur SNES Studio

**Statut : Phase 5c.** Application Tauri 2 + React + TypeScript dans
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

## Fonctionnalités (5c) — autotiles, couches, passabilité (RM2003)

- **Deux couches de décor** : boutons « Couche inf. / Couche sup. » dans la
  barre d'outils. La couche non éditée est atténuée. La couche sup a une
  **gomme** (première cellule de la palette) ; ses tiles doivent avoir un
  fond transparent (index 0).
- **Autotiles** (bordures automatiques eau/chemin) : affichés en tête de
  palette (aperçu = tile îlot). En peignant, les bordures se recalculent
  toutes seules selon les voisins — comme RPG Maker 2003. Format source :
  PNG 48x64 déclaré dans le sidecar du tileset (voir TOOLS.md).
- **Passabilité dans la palette** : bouton « Passabilité O/X/☆ » — les
  cellules affichent leur état et un clic fait tourner O (passable) →
  X (solide) → ☆ (au-dessus du héros, passable). Plus d'outil de collision
  peinte : l'overlay rouge affiche la collision DÉRIVÉE (tile sup non-☆
  prioritaire — un pont sur l'eau est passable automatiquement).

- **Import de chipsets RM2003** (« Chipset RM2003… ») : découpe un chipset
  480x256 (tiles, 12 autotiles de sol, eau statique, couches basse/haute)
  et l'ajoute au projet — voir TOOLS.md. Avec un chipset, la palette est
  **filtrée par couche** comme dans RPG Maker (tiles basses sur la couche
  inf., objets sur la couche sup.).

Pas encore : animation des autotiles (eau), édition des gfx, `make` intégré.

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
