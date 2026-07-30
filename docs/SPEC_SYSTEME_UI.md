# SNES STUDIO — Spécification du Système UI

**Objectif :** Permettre aux créateurs de personnaliser entièrement l'interface de leur jeu
(dialogues, HUD, menus) — du style Dragon Quest au style Final Fantasy — sans coder,
via un système de **layouts déclaratifs** : les écrans d'UI sont des données, pas du code.
**Références design :** windowskins RPG Maker (habillage), menus FF6/DQ/Chrono Trigger
(diversité des layouts), Earthbound/Undertale (menus-scènes scriptés).
**S'appuie sur :** le système de database (`PLANNING_SYSTEME_DATABASE.md`) pour les thèmes,
le format de scène et la VM (`KIT_PHASE1_POC_MOTEUR.md`) pour les menus pleins écran.

---

## 1. Fondations techniques SNES

- **Canal d'affichage UI :** BG3 en mode 1 (2bpp = 4 couleurs par palette, 8 palettes).
  Économe en VRAM, priorité d'affichage au-dessus des BG de jeu.
- **Fenêtres :** construites en tiles via **windowskin 9-slice** (4 coins, 4 bords, 1 fond,
  tiles 8x8) — cadres de taille arbitraire à partir de 9 tiles. Fond translucide possible
  via color math (comme FF6).
- **Texte :** fonte 8x8 (1 tile = 1 caractère), v1 à largeur fixe. Jeu de glyphes défini
  par le créateur (PNG importé) : ASCII + accents français minimum.
- **Curseurs/ornements :** sprites (la main de DQ, la flèche de FF) — animables,
  indépendants de la grille de tiles.
- **Positions et tailles : TOUJOURS en tiles** (unités de 8px). Alignement garanti par
  construction, budgets vérifiables à la compilation.

---

## 2. Les trois contextes d'affichage

Un même format de layout, trois modes d'existence :

| Contexte | Description | Exemples | Mécanisme |
|----------|-------------|----------|-----------|
| **overlay** | Fenêtres permanentes pendant le gameplay | Barre HP, or, compteur de quête, boussole | Dessinées sur BG3 en continu ; zone limitée (max 4 rangées de tiles, haut ou bas) validée à la compilation |
| **popup** | Fenêtres temporaires par-dessus le jeu, monde en pause ou non | Textbox de dialogue, menu de choix, nom d'objet obtenu | Ouvertes/fermées par la VM ou le moteur ; recouvrent temporairement l'overlay |
| **screen** | Écrans pleins, changement de contexte graphique complet | Menu principal, inventaire, statut, écran de combat, boutiques | **Scène de type MENU** via la pile de scènes (voir §5) |

---

## 3. Format de layout déclaratif

Un fichier TOML par écran/ensemble, compilé en binaire par `uigen` (outil Rust, Phase 2/4).

```toml
# ui/menu_main_dq.toml — exemple style Dragon Quest
[screen]
id = "menu_main"
context = "screen"
theme = "THEME_DEFAULT"          # ref vers la table UITheme (database)

[[window]]
id = "commands"
pos = [1, 1]                     # en tiles [x, y]
size = [8, 12]                   # en tiles [w, h]
content = "command_list"
items = ["items", "magic", "equip", "status", "save"]  # IDs de commandes moteur
columns = 1

[[window]]
id = "gold"
pos = [22, 1]
size = [8, 3]
content = "gold_display"

[navigation]
initial_focus = "commands"
# v2 : graphe de navigation entre fenêtres (confirm/cancel → quelle fenêtre)
```

**Règles du format :**
- Positions/tailles en tiles uniquement ; le compilateur rejette les chevauchements
  interdits et les dépassements d'écran.
- `content` doit appartenir au catalogue (§4) ; les paramètres admis dépendent du type.
- Un layout référence un thème ; le thème est interchangeable sans toucher au layout
  (changer l'habillage ≠ changer la structure).
- Budgets validés à la compilation : tiles totaux du layout, fenêtres simultanées
  (max 8 par écran en v1), profondeur de texte.

---

## 4. Catalogue des content types

Le moteur sait dessiner chaque type dans une fenêtre de dimensions arbitraires.
C'est LE point d'extension du système : chaque version enrichit le catalogue.

### v1 (Phase 4)
| Type | Description | Paramètres |
|------|-------------|------------|
| `text` | Texte statique ou text_id | text_id, alignement |
| `message` | Le contenu de la textbox (typewriter, avance) | vitesse (via thème) |
| `choice_list` | Liste de choix pilotée par la VM | columns |
| `gold_display` | Or du joueur avec suffixe configurable | — |
| `variable_display` | Valeur d'une variable + libellé (compteurs de quête custom) | var_id, label text_id |
| `hp_bar` | Jauge de vie en tiles (pleine/partielle/vide) | actor_ref, style (jauge/nombres) |

### v2 (avec les systèmes RPG complets)
| Type | Description |
|------|-------------|
| `command_list` | Commandes de menu (branche vers les écrans moteur) |
| `party_list` | Liste des héros : nom, portrait, HP/MP, états |
| `item_grid` | Inventaire paginé, quantités, curseur 2D |
| `stat_block` | Bloc de stats d'un héros (lit la database Stats) |
| `portrait` | Portrait d'un acteur (streaming VRAM budgété) |
| `icon_row` | Rangée d'icônes (états, objets clés) |
| `timer_display` | Timer de jeu |

### v3+ (si demande communautaire)
- Content types scriptables : une fenêtre dont le contenu est dessiné par un script VM
  (opcodes de dessin tile/texte) — la soupape pour les besoins non couverts.

---

## 5. Menus pleins écran : la pile de scènes

**Principe :** un menu plein écran est une **scène** (`scene_type = MENU`) — le « téléport
vers le menu » est un vrai changement de contexte graphique, comme sur le hardware d'époque
(FF6 décharge réellement les tiles du monde pour charger ceux du menu).

**Mécanisme push/pop :**
```
[Scène jeu active]
   │  ouverture menu (event, touche START)
   ▼
scene_push(SCENE_MENU_MAIN)
   ├─ sauvegarde du contexte WRAM de la scène jeu (map, position, acteurs)
   ├─ fondu sortant (~2-3 frames), déchargement/chargement VRAM
   └─ la scène MENU s'exécute (layouts + VM)
   │  fermeture (cancel, commande "retour")
   ▼
scene_pop()
   ├─ restauration du contexte, rechargement des tiles du monde
   └─ fondu entrant — le joueur reprend exactement où il était
```

- **Profondeur de pile : 2 en v1** (jeu → menu). Extensible à 3 si besoin prouvé
  (jeu → menu → sous-écran plein).
- Les popups/overlays ne passent PAS par la pile (pas de changement de contexte VRAM).
- **Menus-scènes créatifs :** une scène de menu peut aussi être de type TOP_DOWN avec
  flag `pause_world` — un menu qui est une pièce où le perso marche entre des objets
  (à la Earthbound/Undertale). Deux briques existantes, zéro système nouveau.

---

## 6. Le thème (habillage) — table database `UITheme`

Schéma dans le système de database (une table comme les autres) :

```
UITheme {
  windowskin: asset_ref      # PNG 24x24 → 9-slice
  font: asset_ref            # PNG de glyphes 8x8
  text_color: u8             # index palette
  text_speed: u8             # frames par caractère (0 = instantané)
  window_opacity: u8         # via color math (0/25/50/100%)
  cursor_sprite: asset_ref
  cursor_anim_speed: u8
  sfx_cursor: ref:sounds     # v2, sons système
  sfx_confirm: ref:sounds
  sfx_cancel: ref:sounds
}
```

- Plusieurs thèmes par jeu possibles ; changement par event (opcode VM `SET_THEME`).
- Le thème est orthogonal aux layouts : mêmes écrans, habillage différent.

---

## 7. Côté éditeur

| Phase | Livrable |
|-------|----------|
| **P3** | Rien (textbox en dur du moteur) |
| **P4** | Onglet **UI/Thème** : import windowskin + fonte avec validation, formulaire de thème (généré par le schéma), **preview temps réel** (canvas simulant textbox + choix avec le thème, rendu fidèle tiles) |
| **v2** | **Designer de layouts à grille** : glisser des fenêtres sur la grille de tiles, choisir le content type dans une liste, paramètres en panneau, preview live. + **Presets livrés** : « Dragon Quest », « Final Fantasy », « Minimal » |
| **v3+** | Éditeur de navigation (graphe focus/confirm/cancel), content types scriptables |

**Principes éditeur :** le designer est *contraint par la grille* (pas de placement libre au
pixel — c'est une feature, pas une limite : impossible de créer un layout invalide).
La validation est celle de `uigen`, exposée en direct. Les presets sont de simples fichiers
TOML — la communauté pourra en partager.

---

## 8. Impact planning (précision, pas d'allongement)

- **Phase 1 :** textbox codée en dur — AUCUN changement au kit.
- **Phase 2 :** prévoir l'emplacement de `uigen` dans tools/ (squelette, pas d'implémentation).
- **Phase 4 :** le système naît — windowskin, thème, `uigen` v1, la textbox et le choice_list
  passent au format layout, contexte overlay minimal (hp_bar/gold en option). ~2-3 semaines
  intégrées à la phase.
- **v2 :** catalogue complet + pile de scènes MENU + designer à grille, au rythme des
  systèmes RPG (inventaire → item_grid, combat → écrans de combat, etc.).

---

## 9. Règles de conception

1. **Structure ≠ habillage ≠ contenu.** Layout (structure), thème (habillage), database/VM
   (contenu) sont trois axes indépendants et recomposables.
2. **Tout en tiles.** Aucune position au pixel dans les layouts — la grille est le contrat
   avec le hardware.
3. **Le compilateur refuse l'invalide.** Budgets VRAM/fenêtres/zones vérifiés par uigen,
   jamais découverts en jeu.
4. **Le catalogue s'étend, le format ne change pas.** Ajouter un content type = code moteur
   + une entrée au catalogue ; les layouts existants restent valides.
5. **Presets d'abord.** Chaque nouveau pouvoir arrive avec des presets soignés — 80 % des
   créateurs partent d'un preset, et les presets sont la vitrine des capacités de l'outil.

---

*Document généré le 28 juillet 2026 — à ranger dans `docs/`, à relire au démarrage de la Phase 4.*

---

## État d'implémentation (Phase 11)

- **Livré (cran A)** : windowskin 9-slice (24x24, palette de la fonte,
  chars BG3 97-105), thème v1 `project.json "ui"` (windowskin,
  text_speed), machine à écrire (A révèle puis ferme).
- **Livré (cran B)** : `ui/layout.toml` (uigen, module `ui.rs` de
  datagen) — fenêtres `message`/`choice` déplaçables, contexte
  **overlay** (4 rangées du haut, 8 fenêtres max, `variable_display`),
  validation compile (bornes/zone/chevauchements), moteur `ui_overlay.c`.
- **Livré (cran C)** : fenêtre éditeur « UI / Thème » (Tools →) —
  windowskin choisi parmi les ressources (l'import 24x24 validé vit
  dans le Gestionnaire de ressources, catégorie WindowSkin ; registre
  `windowskins` de project.json), vitesse du texte, layout complet
  (message/choice/overlays) avec les MÊMES règles que uigen (OK bloqué
  sur erreur, §9.3) et preview 256x224 fidèle tiles (fonte et skin
  réels du projet). Écrit `ui/layout.toml` + `project.json "ui"`. Réf
  `EDITOR.md`.
- **Livré (Phase 12 M1)** : tampon d'écran UI unifié `ui_screen.c` —
  ui_map[32*28] est LA vérité de BG3, textbox/overlay/timer y composent
  hors VBlank (ui_mark), un seul DMA du span sale au VBlank. Prérequis
  du placement libre des widgets et des écrans MENU. Réf
  `PLANNING_SYSTEME_MENUS.md` (plan contractuel Phase 12).
- **Livré (Phase 12 W1) — widgets HUD à la Zelda.** Le contexte
  `[[overlay]]` du layout devient un système de widgets :
  - **Placement LIBRE** sur l'écran 32x28 (la zone « rangées 0-3 » de
    v1 est abolie). Interdits : chevaucher un autre overlay, ou les
    fenêtres message/choice (les dialogues l'écraseraient — uigen et
    l'éditeur refusent). La bande du dialogue redessine les widgets
    qu'elle borde à chaque ouverture (`overlay_refresh`, idem timer).
  - `content` : `variable_display` (v1), `gauge` (barre pleine/demie/
    vide, `dir = "h"|"v"` — verticale remplie de BAS en haut, ALttP),
    `icon_row` (icônes répétées façon cœurs), `icon_value` (icône +
    compteur, `pad` = zéros de tête 0-5).
  - `frame = true|false` : cadre 9-slice/boîte ou widget NU posé sur le
    jeu (défaut : true pour variable_display, false pour les widgets).
    Minimums : cadré 3x3 (4x3 vardisp), nu 1x1 (2x1 icon_value, 3x1
    vardisp).
  - `var` = variable mesurée ; `max = n` constant OU `max_var = n`
    (jauges/cœurs, 2 unités par tile, clamp au max) ; `icon = n` dans
    la **planche d'icônes** : `project.json "ui" { "icons": png }`,
    bande Nx8 (≤ 64), palette de la fonte, chars `UI_ICON_BASE`+
    (après le windowskin) — gauge/icon_row consomment n, n+1, n+2 =
    pleine, demie, vide.
  - Moteur : `ui_ov_type/frame/icon/dir/pad/maxvar/maxlo+maxhi`
    (u16 scindé — pas de u16 nu), redessin quand var OU max_var change.
  - Éditeur : catégorie **IconSet** du Gestionnaire de ressources
    (import bande Nx8 validé, EXPORT PNG, renommer, supprimer bloqué si
    planche active ★, aperçu avec index sous chaque icône), sélection
    de la planche dans UI / Thème, formulaires par type de widget et
    preview fidèle (icônes réelles, jauge remplie à 58 %).
- **Livré (Phase 12 D1) — designer à canvas (modèle UMG).**
  `ui/layout.toml` passe au format ARBRE `[[node]]` (les `[[overlay]]`
  plats W1 restent acceptés — migration transparente) :
  - conteneurs : `window` (cadre 9-slice, size explicite, margin=[1,1],
    empile ses enfants verticalement), `vbox` (empilement vertical,
    gap), `hbox` (alignement horizontal, gap) ;
  - feuilles : `label` (texte statique), `value` (variable, width 1-5,
    alignée à droite), `image` (suite d'icônes), + les widgets W1
    (`gauge`/`icon_row`/`icon_value`/`variable_display`), + `list`
    (B6 : menu à curseur — `items = ["Attaque", ...]` 2-16 items ASCII,
    frame défaut true, taille AUTO : 1 colonne curseur + item le plus
    long ; piloté par l'opcode LISTSEL, voir SPEC_FORMATS §2) ;
  - `parent = "id"` rattache à un conteneur, une racine a `pos` ;
  - uigen APLATIT l'arbre en primitives positionnées en tiles (types
    moteur 4 panel / 5 label / 6 image — STATIQUES, 7 list (B6), plus 0-3 W1, cap
    32 primitives, tableau `ui_ov_bg` : les cellules vides d'un widget
    posé dans une window prennent le fond du cadre au lieu de percer
    jusqu'au jeu). Zéro conteneur au runtime.
  - Icônes sur panneau : datagen génère automatiquement une VARIANTE
    « fond de panneau » de chaque icône (pixels transparents → couleur
    1, chars UI_ICON_BASE + UI_ICON_COUNT + n) — le moteur l'utilise
    quand l'icône vit dans une window (ui_ov_bg), l'icône montre le
    cadre derrière elle et pas le jeu. Budget VRAM : 106 + 2×64 chars
    max ≤ 256.
  - `value` : `align = "left"` colle la valeur au texte précédent (via
    le flag dir, inutilisé par le type 0) — par défaut elle est alignée
    à droite dans sa largeur. Le pas des `gap` reste 1 tile = 8 px
    (grille matérielle BG3, pas de demi-tile sans fonte à largeur
    variable).
  - Widgets NOMMÉS dans l'éditeur : chaque racine = un widget ; la
    liste « Widgets » du designer permet ✧ Nouveau widget (posé sur
    une place LIBRE du canvas, designer ouvert dessus), l'édition
    scopée (structure limitée au widget, les autres estompés sur le
    canvas — cliquer un autre widget bascule dessus), ⛶ Tout l'écran
    pour dé-scoper.
  - Éditeur : la fenêtre UI / Thème devient le **designer** — palette
    d'objets, arborescence (sélection, ↑↓, suppression en cascade),
    canvas interactif (clic = sélection du nœud le plus profond,
    glisser = déplacer la racine, poignée coin = redimensionner, snap
    tiles), inspecteur par type (pickers variables/icônes), erreurs
    live miroir de uigen (uilayout.ts), OK bloqué si invalide.
    Round-trip prouvé : le TOML écrit par l'éditeur redonne les mêmes
    primitives dans uigen.
- **Livré (Phase 12, visibilité scriptée)** : les widgets sont CACHÉS
  par défaut (`visible = true` sur une racine = visible au boot ; les
  `[[overlay]]` W1 restent visibles — compat). Opcode VM 0x24 `SHOWUI
  [widget][on]` + commande d'event « Afficher/cacher un widget UI »
  (nom résolu vers l'index de racine à la compilation). Moteur :
  visibilité runtime par widget (`ui_ov_widget` par primitive,
  `ui_widget_vis` initiale, `overlay_show` dessine/efface, update et
  refresh respectent l'état, valeurs suivies même caché). Éditeur : la
  fenêtre devient « UI » en DEUX PAGES — liste des widgets (👁 visible
  au boot, Éditer…, 🗑, ✧ Nouveau) puis le designer scopé sur le widget
  choisi (← Widgets pour revenir, « Vue d'ensemble » pour tout
  l'écran).
- **Livré (Phase 12, S1 — styles de dialogue)** : plusieurs BOÎTES DE
  DIALOGUE nommées, en plus de la boîte par défaut (toujours là).
  - Layout : blocs `[[dialog_style]]` dans `ui/layout.toml` (max 3 en
    plus du défaut) — `id` ASCII unique, `windowskin` (défaut : celui
    du thème), `font` (PNG 768x8, défaut : `assets.font`), `message` /
    `choice` (fenêtres propres, min 8x3 ; choice hérite du message du
    style, message hérite de `[message]`). Les overlays ne doivent
    chevaucher AUCUNE fenêtre d'AUCUN style (union = bande UI_SHADOW).
  - Datagen : plan VRAM BG3 dédupliqué — fonte 0 (97 chars, base 1),
    skins 9 chars chacun, icônes 2×N, fontes SUPPLÉMENTAIRES 96 chars
    (base sur ' ') après les icônes ; budget 256 chars vérifié avec
    erreur détaillée. v1 : toutes les fontes et skins partagent la
    PALETTE de la fonte 0 (CGRAM 16-19). Tables `ui_styles.c`
    (`ui_st_mx/my/mw/mh/cx/cy/cw/ch/font/skin`, ligne 0 = défaut) +
    `UI_STYLE_COUNT` dans ui_cfg.h — TOUJOURS générées.
  - VM : opcode 0x27 `DLGSTYLE [n]` arme le style de la PROCHAINE
    boîte ; émis devant chaque msg/choice UNIQUEMENT si le projet a
    des styles (sinon bytecode byte-identique). Champ `style` sur les
    commandes msg/choice (absent = défaut) — nom résolu à la
    compilation, erreur avec la liste des styles connus.
  - Moteur : textbox à géométrie/fonte/skin RUNTIME
    (`textbox_set_style`, copie des tables ; `TB_CHAR` = base fonte du
    style). ATTENTION frame de lag : le test du skin est hissé HORS
    des boucles de `tb_box_at` — l'ouverture de message frôle le
    budget d'une frame, prudence sur ce chemin chaud.
  - Éditeur : Tools → UI → Dialogues et choix = liste « Boîtes de
    dialogue » ((défaut) ★ + styles : ✧ Nouveau, ✎ renommer, 🗑) ; par
    style : windowskin, fonte, fenêtres propres ; preview avec le skin
    ET la fonte du style sélectionné. Formulaires Message/Choix :
    select « Boîte de dialogue ». Ressource FontSet (import 768x8,
    EXPORT PNG, renommer — les styles suivent —, suppression bloquée
    si fonte du projet ★ ou utilisée par un style).
- **Livré (Phase 12, S2 — fonte par widget)** : `font` sur la RACINE
  d'un widget (`[[node]]` sans parent — erreur uigen sur un enfant) :
  tout le texte du widget (labels, valeurs, compteurs) se dessine avec
  cette fonte. Datagen : les fontes des widgets entrent dans le même
  plan VRAM dédupliqué que celles des styles (une fonte partagée ne
  coûte qu'une fois ses 96 chars) ; table `ui_ov_font[]` par PRIMITIVE
  (base du glyphe ' ', 1 = fonte du projet) dans ui_overlays.c —
  TOUJOURS émise. Moteur : `OV_FCHAR` = `ui_ov_font[i] + ascii - 32`
  dans ov_draw (types 0/3/5, chiffres compris) — équivalent à l'ancien
  `OV_CHAR` quand la table vaut 1, rendu inchangé pour les projets
  sans fonte de widget. Éditeur : select « Fonte du widget » dans
  l'inspecteur (racines seulement), canvas preview avec la fonte de
  chaque widget ; renommage/suppression de FontSet tiennent compte des
  widgets comme des styles.
- **À venir** (plan détaillé dans `PLANNING_SYSTEME_MENUS.md`) :
  écrans de menu déclaratifs M2, listes + curseur + pile M3 (menu FF4
  — l'objet liste deviendra NAVIGABLE, le designer le pose déjà),
  portraits/listes database/hp_bar M4, thèmes multiples en table
  database + SET_THEME.
