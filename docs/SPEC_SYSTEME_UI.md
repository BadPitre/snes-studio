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
- **À venir** : thèmes multiples en table database + SET_THEME,
  content types v2 (hp_bar, gold…), pile de scènes MENU (§5),
  designer à grille (§7).
