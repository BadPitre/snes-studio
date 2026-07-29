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
  >= 20x15, bordure de murs par défaut), choix de la **scène de boot** (★),
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
- **Onglet « Scène »** (premier onglet à droite) : paramètres de la scène
  courante — tileset (choix, imports, passabilité) et redimensionnement
  (rognage/extension, bordure reconstruite). Le panneau gauche ne garde
  que le dessin : modes, tiles, outils.

## Fonctionnalités (5e) — boucle de création

- **▶ Jouer** : sauvegarde → datagen → `make` (via le bash MSYS2) →
  lancement de l'émulateur sur le ROM compilé. Chemins du bash et de
  l'émulateur dans les réglages ⚙ (stockés sur la machine, pas dans le
  projet). PVSNESLIB_HOME doit être défini dans le profil MSYS2.
- **Modes de dessin** (comme RPG Maker 2003) : ✏ crayon, ▭ rectangle,
  ◯ ellipse, ▨ pot de peinture (zone connexe de même tile) — le motif du
  tampon se répète dans la forme, ancré au début du geste. Un geste = une
  entrée d'undo.
- **Survol façon RM2003** : la zone visée est encadrée à la taille du
  tampon, curseur crayon/pot ; aperçu de la forme pendant le glisser.
- **Pipette / copie de bloc** : clic droit = prendre la tile sous le
  curseur ; glisser-droit = copier un bloc de la map dans le tampon
  (fonctionne aussi comme copier/coller).
- **Arborescence des scènes** (sous la palette, comme RM2003) : racine =
  projet, scènes imbricables (champ `parent`, purement organisationnel —
  ignoré par datagen), glisser-déposer pour réorganiser, ＋ crée une scène
  sous la ligne sélectionnée, ★ scène de boot, 🗑 suppression (les enfants
  remontent d'un cran). Le séparateur palette/arborescence se redimensionne
  à la souris (hauteur mémorisée).
- **Zoom** : 4 niveaux 1/1 → 1/8 (barre d'état sous la map, ou
  Ctrl + molette) ; la barre d'état affiche aussi la position du curseur
  en tiles.

Pas encore : animation des autotiles (eau), édition des gfx.

## Fonctionnalités (6) — personnages façon RM2003

- **Sprites 16x24** : les acteurs sont dessinés sur la map avec leur frame
  de repos (bloc × 12 + direction × 3), ancrée en bas de leur tile — la
  tête dépasse de 8 px au-dessus, comme dans RM2003 et en jeu.
- **Charset (personnage)** : dans l'Event Editor, le sprite d'un PNJ se
  choisit parmi les personnages du projet (nommés via `project.charsets`).
  Le projet n'est pas limité (64 blocs max) ; chaque **scène** peut en
  afficher **5 différents** (héros inclus — limite VRAM SNES, datagen
  compile un sprite set par scène).
- **Import de charsets RM2003** : bouton « Charset RM2003… »
  (Gestionnaire de ressources) → choisir un PNG 288x256
  (8 personnages) ou 72x128 (un seul), cliquer le personnage dans
  l'aperçu, choisir le bloc de destination (existant ou nouveau) et un
  nom → `datagen import-charset` recadre les frames 24x32 en 16x24 et
  réécrit `assets/sprites.png`.
- **Gestionnaire de ressources** (🗂 Ressources, façon RM2003) :
  catégories **CharSet** (personnages), **ChipSet** (tilesets),
  **WindowSkin** (cadres 9-slice de la Phase 11), **IconSet**
  (planches d'icônes des widgets, W1 — bande PNG Nx8 validée à
  l'import, aperçu avec l'index sous chaque icône, ★ = planche active)
  et **FontSet** (fontes S1 — bande PNG 768x8, 96 glyphes 8x8, validée
  à l'import ; aperçu = texte d'exemple rendu avec la fonte + la bande
  des glyphes ; ★ = fonte du projet `assets.font`, non supprimable ;
  registre `fonts` de project.json ; renommer met à jour les styles de
  dialogue ET les widgets qui la pointent, supprimer est refusé si un
  style ou un widget l'utilise) et **Picture** (images S3 façon RM2003 —
  PNG indexé ≤ 16 couleurs, ≤ 256x224 en multiples de 8, validé à
  l'import avec comptage des couleurs ; aperçu réduit + dimensions ;
  affichées en jeu par la commande d'event **« Afficher une image »**
  (onglet Écran, avec « Effacer l'image ») — les dialogues se jouent
  par-dessus, et la fermeture rend la scène intacte ; registre
  `pictures` de project.json, LU par datagen. **Options S5 (façon Show
  Picture RM2003)** : le formulaire « Afficher une image » propose la
  **Position à l'écran** (Centrée, ou Position X/Y en pixels — X
  0-255, Y 0-216, validées contre les dimensions de l'image par
  datagen) et la **Transition** (Fondu ou Instantanée) ; « Effacer
  l'image » propose aussi la Transition. Champs JSON : `x`/`y`
  (absents = centrée) et `fade: false` (absent = fondu).
  **Transparence (S4)** : à l'import, le dialogue **« Import image »**
  montre l'image — un CLIC désigne la couleur à rendre transparente
  (aperçu en damier, ✕ pour retirer le choix), puis **Valider**
  (sans couleur cliquée = import sans transparence) ou **Annuler** —
  en jeu, le décor de
  la carte se voit à travers les pixels percés, mais pas les
  personnages ; ≤ 15 couleurs opaques dans ce cas. Le même sélecteur
  s'ouvre à l'import des **IconSets** et **CharSets** : pratique pour
  les planches à fond plein (blanc, magenta…) — la couleur cliquée
  devient l'index 0 transparent sans passer par GIMP),
  liste avec aperçu, et actions **Importer / Exporter / Renommer /
  Supprimer** sur chaque catégorie.
  Export charset au format RM2003 (72x128, PNG transparent) ; export
  chipset = copie de la grille PNG. Renommer un tileset renomme ses
  fichiers et met à jour les scènes ; supprimer est bloqué si la
  ressource est utilisée par une scène (et le bloc 0 = héros est
  protégé). Supprimer un personnage décale les blocs suivants (les
  acteurs sont mis à jour). Windowskins : l'import valide le PNG 24x24
  (copié dans `assets/`, registre `windowskins` de project.json —
  éditeur seulement, ignoré par datagen), l'aperçu montre la planche et
  une fenêtre 9-slice d'exemple, ★ marque le thème actif (suppression
  bloquée — le thème actif se choisit dans Tools → UI / Thème).
- **Musique de la scène** : dans l'onglet Scène (section Musique).
- **Événements façon RM2003 (v0.6)** : chaque acteur a un type de
  déclencheur — *Action* (PNJ visible, touche A), *Contact* (invisible,
  script quand le héros marche sur la tile — marqueur orange « C » sur la
  map) ou *Auto* (invisible, script au chargement de la scène — marqueur
  cyan « A »). Scripts : `CHOICE` (choix 2-4 avec curseur), variables
  globales `g<n>` dans les conditions (give/has), `WARP` (téléport
  scripté), `FACE` (tourner un PNJ) — voir docs/TOOLS.md.
- **Barre de menus** (façon RM2003) :
  - *Projet* : Nouveau projet (dossier vide → projet minimal jouable avec
    tileset/personnages/fonte de démarrage), Ouvrir, Fermer, Explorer le
    dossier du projet, Quitter.
  - *Edit* : Annuler/Rétablir (Ctrl+Z / Ctrl+Y), Couper/Copier/Coller/
    Supprimer le PNJ sélectionné, Réglages du projet (bash, émulateur).
  - *Tools* : réservé.
  - *Game* : Lancer le jeu, Vérifier le projet, Générer les données,
    **Build cartouche (.smc)** — un `.smc` prêt pour flashcart
    (miroité à 512 Ko, checksum recalculé, validé sur Super UFO
    Pro 8 : le `.sfc` de 256 Ko y donne « File type error »),
    Recompiler tout.
  - *Help* : Version.
  La barre de boutons se réduit à : 💾 (sauvegarder), couches, Ressources,
  Collision/Grille, puis « Générer les données » et « ▶ Jouer » en fin.
- **Vérification du projet** (Tools → Vérifier le projet…) : fenêtre de
  diagnostic — tableau des scènes (taille, budget tiles 8192, charsets
  n/5, acteurs, warps), problèmes bloquants et avertissements détectés
  côté éditeur (labels/textes/scènes manquants, dépassements de limites,
  déclencheurs sans script…), puis le verdict réel de datagen : tailles
  des banks (scènes/textes sur 32 Ko), gains de compression, warnings de
  génération (fusions de couleurs…), taille du dernier ROM.

## Fonctionnalités (A2) — système d'events façon RM2003

- **Couche Événements** (3e bouton de couche) : les events (boîte blanche),
  les warps (W), le départ du joueur (S). **Clic droit sur une tile** :
  nouvel événement, nouvel événement depuis un prefab, coller, nouveau
  warp, départ du joueur ici — ou, sur un event : éditer, couper/copier,
  prefab, supprimer. Double-clic = Event Editor. La palette d'outils
  (« Sélection / +PNJ / +Warp / Départ ») a disparu : tout se fait ici.
- **Event Editor** (calqué sur RM2003) : nom + pages (P4), conditions
  (P4), apparence (personnage + direction + aperçu), type de mouvement
  (PNJ mobiles à venir), déclencheur (Touche action / Contact /
  Auto-start), et la liste **Contenu** (`@>`) : Message, Choix (2-4, avec
  branches « : Quand […] »), Variables (= et +), Condition (si variable,
  branches Si vrai/Sinon), Téléporter le héros, Tourner un event. Les
  textes se tapent directement dans les commandes — datagen les collecte
  dans la bank de textes et compile le tout vers la VM.
- **L'apparence est indépendante du déclencheur** : un event de *Contact*
  ou *Auto* peut afficher un personnage (coffre, panneau, PNJ qui aborde
  le héros) tout en restant traversable ; « (invisible) » dans la liste
  des personnages le rend transparent.
- **Switches et variables (v0.9, P4)** : 512 switches ON/OFF et 256
  variables 16 bits, globaux, persistants et sauvegardés. Commandes :
  *Modifier un switch*, *Modifier une variable* (= ou +, négatif accepté),
  *Condition : switch*, *Condition : variable* (=, ≠, ≥) avec branches
  Si vrai/Sinon. C'est la mécanique give/has de RM2003 : un coffre =
  condition sur un switch + le switch passé à ON.
- **Pages d'events (v0.10)** : boutons 1..N / ＋ page / 🗑 page en haut de
  l'Event Editor — chaque page a sa **condition d'activation** (switch
  ON/OFF ou variable ≥, avec le bouton « … » vers la liste), son
  apparence, son déclencheur et ses commandes. En jeu, la dernière page
  dont la condition passe est active (coffre ouvert/fermé, PNJ à états).
- **PNJ mobiles (v0.11)** : le fieldset « Type de mouvement » de l'Event
  Editor est actif (par page) — Statique / Aléatoire / Vertical /
  Horizontal. En jeu : vitesse moitié du héros, demi-tour quand bloqué,
  jamais sur la tile du héros ni d'un autre event, gel pendant les
  dialogues et le menu.
- **Move Route (v0.12/v0.13)** : commande « Déplacer un event… » →
  fenêtre **Itinéraire** complète façon RM2003 : 3 colonnes de pas
  (marcher ×4 / au hasard / vers-fuir le héros / un pas en avant ;
  tourner ×4 / 90° D-G / demi-tour / au hasard / vers-dos au héros ;
  Vitesse ± / Fréquence ± / Direction fixe / Passe-muraille / Switch
  ON-OFF / Graphisme / Attendre), radios **Fréquence 1-8**, options
  Répéter / Ignorer si bloqué ; cible « Cet event » ou un event de la
  scène. L'itinéraire
  part en tâche de fond — le séquencer avec « Attendre la fin des
  déplacements » ; « Attendre » (frames) complète la panoplie cinématique.
- **v0.13** : « Modifier une variable » couvre l'arithmétique complète
  (=, +, −, ×, ÷, mod, hasard 0..N) et des sources (constante, autre
  variable, X/Y du héros, timer) ; commandes **Timer** (régler/arrêter/
  afficher « M:SS » au coin haut-droit), **Déplacer la caméra** (pan
  scripté non bloquant), **Caméra : retour au héros** et **Attendre la
  caméra**.
- **v0.14** : par page — **Type de mouvement « Route custom »** (bouton
  « Éditer la route… » vers la fenêtre Itinéraire, options
  Répéter/Ignorer/Fréquence incluses), **Priorité** (Sous le héros :
  traversable, s'active en se tenant dessus / Comme le héros / Au-dessus :
  traversable, dessiné par-dessus tout) et **Vitesse 1-4**. Raccourcis
  dans la liste Contenu et l'Itinéraire : **Ctrl+C / Ctrl+V / Suppr**.
- **v0.15** : la fenêtre Commande d'événement passe en **onglets** par
  catégorie (Messages, Logique, Déplacements, Temps, Écran, Caméra,
  Autres) — extensible quand la liste des commandes grossit. Les
  paramètres d'une commande s'éditent dans une **fenêtre séparée**
  (titre = nom de la commande, OK/Annuler) au lieu du formulaire inline
  sous la liste Contenu ; la rangée de boutons Ajouter/Modifier/…/↑/↓ a
  disparu — tout passe par le double-clic, le clic droit (Insérer /
  Éditer / ↑ Monter / ↓ Descendre / Supprimer) et le clavier. Nouvelles
  commandes Logique : **Boucle** (le corps entre « Boucle » et « : Fin
  de boucle » se répète), **Sortir de la boucle** et **Commentaire**
  (ligne verte italique, jamais compilée). Nouvelles commandes
  Déplacements : **Mémoriser la position du héros** (scène/X/Y → trois
  variables), **Téléporter aux variables** (rappel de la position
  mémorisée), **Placer un event** (coordonnées constantes ou lues dans
  des variables) et **Échanger deux events** ; « Modifier une variable »
  gagne la source **N° de la scène courante**. Onglet **Écran** :
  **Cacher / Montrer l'écran** (fondu bloquant), **Teinter l'écran**
  (normale / éclaircir / assombrir + RGB 0-31 — décor seulement, les
  personnages et le texte gardent leurs couleurs), **Flash d'écran** et
  **Secouer l'écran** (non bloquants — enchaîner avec « Attendre »).
- **Fenêtre « Common events »** (Tools →, v0.16 — onglet Common Events
  de la Database RM2003) : liste numérotée à gauche (＋ Ajouter / 🗑),
  à droite Nom, Déclencheur — **None (appelé)**, **Autorun** ou
  **Parallel process** — avec la **case « Condition switch »** (décochée
  = toujours actif, façon RM2003) et le Contenu, le même éditeur de
  commandes que
  l'Event Editor (double-clic, clic droit, Ctrl+C/V/Suppr, toutes les
  commandes). Un common event s'appelle depuis n'importe quel event avec
  **« Appeler un common event »** (onglet Autres). Autorun : relancé
  tant que son switch est ON, joueur gelé (penser à l'éteindre).
  Parallel process : tourne en tâche de fond, joueur libre — messages et
  choix interdits, rythmer avec « Attendre ». « Cet event » y désigne
  l'event appelant.
- **Fenêtre « Database »** (Tools →, Phase 10 — réf
  `PLANNING_SYSTEME_DATABASE.md` et `INTEGRATION_DATABASE_EDITEUR.md`) :
  l'expérience Database de RPG Maker, mais **générique et pilotée par
  les schémas** du projet (`schemas/*.toml`) — tables à gauche (badge
  N/255), instances au centre (Nouveau / Dupliquer / ↑↓ / 🗑),
  formulaire à droite généré depuis le schéma : numériques avec bornes
  affichées et validées, `flags8` en cases à cocher nommées, `ref:` en
  menus peuplés par la table cible (noms affichés, ids stockés),
  `text_id` relié à la banque de textes, type inconnu en lecture seule.
  Renommer un id **met à jour toutes les refs** ; supprimer une entrée
  référencée liste ses usages avant de confirmer ; OK est bloqué tant
  qu'un id est invalide ou en double ; la jauge d'octets ROM s'affiche
  en bas. OK écrit `data/*.toml` (clés dans l'ordre du schéma — diffs
  Git stables) ; dbgen les compile au prochain build. Ajouter un onglet
  = ajouter un schéma, zéro code.
  La commande d'event **« Lire la database »** (onglet Logique, v0.17)
  copie un champ d'une fiche dans une variable 16-bit — table, fiche
  (fixe, ou n° lu dans une variable) et champ choisis dans des menus
  peuplés par les schémas, mêmes listes que la fenêtre Database.
  **Créer SES tables depuis l'éditeur** : « ＋ Table » (nom snake_case +
  titre, enchaîne sur la structure), « Structure… » ouvre l'éditeur de
  champs — nom, type (u8/u16/s8/s16, flags8 avec ses noms de bits, ref
  vers une table au choix, text_id), défaut/min/max, optionnel, copie
  runtime ⟳, réordonner (l'ordre des champs = le layout ROM). Renommer
  un champ migre les valeurs des entrées ; le supprimer les retire ;
  « 🗑 » supprime la table (bloqué tant que des `ref:` la visent) et ses
  fichiers. OK écrit aussi `schemas/*.toml` — identiques à des schémas
  écrits à la main, dbgen ne voit pas la différence. Un projet sans
  database crée ses dossiers `schemas/`+`data/` à la première table.
- **Fenêtres « UI »** (Tools → UI → **sous-menu** : « Widgets… » et
  « Dialogues et choix… », Phase 12, réf
  `SPEC_SYSTEME_UI.md`) : un éditeur d'interface à canvas, modèle UMG.
  **Palette** à gauche (clic = ajouter) : Fenêtre (cadre 9-slice,
  conteneur), Liste verticale et Boîte horizontale (empilent leurs
  enfants, espacement réglable), Label (texte fixe), Image (icônes de
  la planche), Valeur (variable alignée à droite), et les widgets
  Zelda (Jauge, Cœurs, Icône + compteur, Libellé + valeur). L'objet
  s'ajoute DANS le conteneur sélectionné (sinon à côté, sinon sur le
  canvas). **Arborescence** : la structure (fenêtre > listes > lignes >
  labels), sélection au clic. **Canvas 256x224 fidèle tiles** (2x,
  fonte/windowskin/icônes réels) : clic = sélectionner l'objet le plus
  profond, glisser = déplacer sa racine (snap 8 px), poignée du coin =
  redimensionner. **Inspecteur** à droite : propriétés du sélectionné
  (↑↓ réordonner, 🗑 supprimer avec ses enfants, id, variable avec la
  liste nommée « … », vignettes d'icônes cliquables, cadre, max
  constant ou variable, direction de jauge…) ; sur une RACINE :
  visibilité au démarrage et **« Fonte du widget »** (S2 — un FontSet
  pour tout le texte du widget, le canvas la montre en direct). Un panneau façon Chrono
  Trigger = Fenêtre > Liste verticale > Boîtes horizontales > labels/
  valeurs/images. Les erreurs (mêmes règles que le compilateur —
  débordements, chevauchements avec les fenêtres de dialogue, icônes
  manquantes) s'affichent sous le canvas et bloquent OK. **« Dialogues
  et choix »** (S1) s'ouvre sur la liste **« Boîtes de dialogue »** :
  la boîte **(défaut) ★** (toujours là — thème windowskin + vitesse du
  texte + géométrie message/choix) et jusqu'à 3 **styles nommés**
  (✧ Nouveau style, ✎ renommer — ASCII —, 🗑 supprimer avec
  confirmation). Un style sélectionné édite SON windowskin (défaut :
  celui du thème), SA fonte (liste des FontSets, défaut : la fonte du
  projet ★) et SES fenêtres (message obligatoire, « fenêtre de choix
  distincte » optionnelle) ; la preview dessine la boîte du style
  sélectionné avec son skin ET sa fonte. Les formulaires des commandes
  **Message** et **Afficher un choix** gagnent un select « Boîte de
  dialogue » ((défaut) + styles — le libellé de la liste des commandes
  affiche `[style]`). **« Widgets »** s'ouvre sur la
  page liste : la planche d'icônes et la LISTE des widgets — 👁 = visible au
  démarrage (par défaut un widget est CACHÉ et s'affiche par la
  commande d'event **« Afficher/cacher un widget UI »**, onglet
  Écran), **✎ Renommer** (les enfants suivent), Éditer…/double-clic
  ouvre le **designer scopé** sur le
  widget (les autres estompés), ✧ Nouveau widget en crée un sur une
  place libre, « ← Widgets » revient à la liste. En tête du designer :
  Thème repliable (windowskin, planche d'icônes, vitesse du texte) et,
  sous le canvas, la géométrie des fenêtres message/choix. OK écrit
  `ui/layout.toml` (arbre `[[node]]` — les anciens layouts plats sont
  migrés à l'ouverture). La
  fenêtre applique **les mêmes règles que uigen** (tailles minimales,
  zone HUD, chevauchements, libellés ASCII bornés) : les erreurs
  s'affichent en rouge et **OK reste bloqué** tant qu'il en reste — le
  designer ne peut pas produire un layout que le build refuserait. OK
  écrit `ui/layout.toml` + la section `"ui"` de project.json.
- **Fenêtre « Switches / Variables »** (Tools → Switches et variables…,
  calquée sur les dialogues Switch/Variable de RM2003) : tranches de 20 à
  gauche, liste numérotée à droite, champ Nom sous la liste — les noms
  sont stockés dans project.json. Chaque formulaire de commande (switch,
  variable, conditions) a un bouton « … » qui ouvre cette liste en mode
  sélection (double-clic = choisir) et affiche le nom sous le numéro.
- **Fenêtre « Commande d'événement »** (façon Event Command de RM2003) :
  une boîte séparée avec des **onglets par catégorie** et une grille de
  boutons, un par commande (les commandes annoncées mais pas encore
  compilables restent grisées). Elle s'ouvre de deux façons :
  **double-clic sur une ligne vide** `@>`, ou **clic droit → Insérer…**.
  Le clic droit sur une ligne de commande donne aussi **Éditer…**,
  **↑ Monter / ↓ Descendre** et **Supprimer** ; le double-clic sur une
  ligne pleine ouvre la **fenêtre d'options** de la commande.
- **Prefabs d'events** (v0.16) : clic droit sur un event → « Enregistrer
  comme prefab… » ouvre une fenêtre **nom + catégorie** (libre — « PNJ »,
  « Coffres », … — pour ranger la bibliothèque). Clic droit sur une tile
  vide → **« Nouvel événement depuis un prefab… »** : la bibliothèque
  s'ouvre groupée par catégorie, double-clic (ou « Créer ici ») instancie
  l'event. **Tools → Prefabs…** gère la bibliothèque : renommer,
  recatégoriser, supprimer. Stockés dans project.json.
- Sur la couche Événements de la carte : **Ctrl+C / Ctrl+X / Ctrl+V /
  Suppr** sur l'event sélectionné (v0.16 — en plus du menu Edit et du
  clic droit). Un clic pose le **curseur de cellule** (cadre blanc/noir,
  façon RM2003) : Ctrl+V colle sur cette cellule. Les boutons de couches
  sont des **icônes RM2003 seules** (piles de tuiles, la couche éditée
  en surbrillance, info-bulle au survol). « Vérifier le projet… » vit
  désormais dans le menu **Game**.
- Les warps s'éditent au clic droit via la fenêtre **« Téléporter »**
  (v0.16, calquée sur Transfer Player de RM2003) : arbre des scènes à
  gauche, **aperçu de la scène cible** à droite (clic = tile d'arrivée,
  carré blanc), zoom 1/1-1/2-1/4, et **Direction à l'arrivée**
  (Conserver / Haut / Droite / Bas / Gauche — écrite dans les flags du
  warp, le héros la prend en sortant du fondu).
- **Sidebar allégée (Phase 12, demande utilisateur)** : les onglets
  **Acteurs**, **Warps** et **Textes** sont retirés — il ne reste que
  **Scène** et **Script**. Tout passe par la carte (couche Événements :
  double-clic = Event Editor, clic droit = créer/éditer/supprimer un
  event ou un warp) et par le menu Tools.
- **Fenêtre « Textes »** (Tools → Textes…) : la table des textes du
  projet (référencés par NOM dans les scripts), rangée par
  **catégories** — colonne de gauche : (tous), chaque catégorie avec
  son compteur, (sans catégorie) ; ✧ Nouvelle catégorie, ✎ renommer
  (ses textes suivent), 🗑 retirer (les textes deviennent « sans
  catégorie », rien n'est supprimé). Chaque texte a un select de
  catégorie ; « + Ajouter un texte » range le nouveau dans la catégorie
  affichée. La catégorie est un champ `cat` de texts.json — éditeur
  seulement, datagen l'ignore (les text_id suivent l'ordre du fichier).

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
