# Système MENUS & WIDGETS — plan de construction (Phase 12)

Document de conception CONTRACTUEL (même statut que
`PLANNING_SYSTEME_DATABASE.md`) : tout écart d'implémentation se
répercute ici dans le MÊME commit. Réfs : `SPEC_SYSTEME_UI.md` (§2
overlay, §5 pile de scènes), `SPEC_FORMATS.md` §2/§4.

Objectif utilisateur (références visuelles validées avec Bertrand) :

- **HUD à la Zelda ALttP** : cœurs de vie, jauge de magie verticale,
  compteurs à icône (rubis/bombes/flèches), placés LIBREMENT à l'écran
  — pas seulement dans la bande du haut.
- **Menu à la FF4** : écran plein par-dessus le jeu en pause, fenêtres
  multiples (commandes, équipe, temps, or), curseur, sous-écrans
  empilés (Item/Magic/Status…), B dépile.

Tout est DONNÉES : layouts TOML compilés par uigen, contenus liés aux
variables/database. Zéro contenu de jeu en dur dans le moteur.

---

## M1 — tampon d'écran UI unifié (prérequis moteur)

**Problème** : BG3 avait trois écrivains disjoints — textbox (bande du
dialogue, shadow local), ui_overlay (rangées 0-3, shadow local), timer
(rangée 1, écriture VRAM directe). Chacun transférait SA zone : un
overlay hors de la bande 0-3 ou un widget latéral écraserait/serait
écrasé par le dialogue ; un redessin d'overlay effaçait déjà le timer
(conflit latent).

**Solution** : module `ui_screen.c` — UN tampon WRAM `ui_map[32*28]`
(1792 o, .bss $7E, sous le plafond checkwram) qui est LA vérité de la
couche BG3. Tous les modules UI y dessinent (hors VBlank) et déclarent
leurs rangées touchées via `ui_mark(row, h)` ; au VBlank, UN SEUL DMA
du span de rangées sale (`ui_screen_vblank`). `ui_screen_init` nettoie
la map entière écran éteint (rangées 28-31 de la map 32x32 comprises).

Conséquences :

- textbox/ui_overlay/timer perdent leurs shadows et leurs `*_vblank()`
  propres ; les macros de cellule deviennent ABSOLUES (plus de
  `UI_SHADOW_ROW` dans l'adressage — il reste la zone à effacer à la
  fermeture du dialogue).
- le timer est composé dans le tampon comme le reste : plus de conflit
  overlay/timer. (Cas assumé : une fenêtre de dialogue qui recouvre la
  rangée du timer l'efface jusqu'au tick suivant.)
- coût VBlank : span sale contigu, 64 o/rangée — dialogue type = 512 o
  (identique à avant), pire cas plein écran = 1792 o (rare, budget OK).

**Validation** : boot 200 frames pixel-identique ; séquence dialogue
demo (typewriter, \v[n]) et projet uitest (HUD + parallel + fenêtre
flottante) comparés IMAGE PAR IMAGE entre le ROM d'avant et d'après —
aucune différence attendue (refactor pur).

## W1 — widgets HUD à la Zelda (content types v2)

Extension du contexte overlay (uigen `[[overlay]]`) : nouveaux
`content`, placement LIBRE (M1 aidant) et cadre optionnel.

- **Placement libre** : `pos` n'importe où dans l'écran 32x28 (plus de
  zone rangées 0-3). Reste interdit : chevaucher la fenêtre message ou
  choice du layout (erreur uigen + éditeur). `UI_SHADOW_*` continue de
  décrire l'union message/choix ; les overlays hors de cette bande ne
  sont plus contraints.
- **`frame = false`** (défaut true) : pas de cadre 9-slice ni de fond —
  le widget se pose sur le jeu comme les cœurs de Zelda (chars
  transparents autour). Les tailles minimales tombent à 1x1.
- **Nouveaux `content`** :
  - `variable_display` (existant) : libellé + valeur.
  - `gauge` : barre de remplissage liée à `var`, `max` (constante ou
    seconde variable), `dir = "h"|"v"` — chars de jauge dédiés
    (pleine/demi/vide) dans la planche d'icônes.
  - `icon_row` : N icônes répétées (cœurs) — `var` = valeur courante,
    `max`, 2 unités par icône (pleine/demie/vide, arrondi RM).
  - `icon_value` : icône + compteur aligné (rubis « 072 », zéros de
    tête optionnels `pad`).
- **Planche d'icônes UI** : PNG `8xN` (chars 8x8, palette de la fonte,
  4 couleurs) importée via le **Gestionnaire de ressources**
  (catégorie IconSet), appendue par datagen après le windowskin (chars
  BG3 106+). Les widgets référencent l'icône par index. Budget : la
  VRAM BG3 tolère ≥ 64 icônes — dbgen valide.
- Redessin : comme aujourd'hui, uniquement quand `vars16[var]` change ;
  compose dans `ui_map` + `ui_mark`.
- Éditeur : la fenêtre UI / Thème gagne les nouveaux types (formulaire
  par type + preview fidèle, icônes réelles).

## M2 — écrans de menu déclaratifs

- `ui/menus/*.toml` (uigen) : un ÉCRAN = fenêtres avec contenus
  statiques (texte), liaisons (`\v[n]`, timer, champs database via la
  mécanique DBREAD), widgets W1.
- Ouverture : commande d'event « Ouvrir le menu » + option projet
  « bouton X ouvre le menu <id> ». Jeu en PAUSE dessous (modèle
  sysmenu) ; le HUD overlay est masqué pendant un menu plein écran.
- Le menu Système actuel (START : sauvegarder/charger) reste tel quel
  et sera absorbé plus tard (M4+).

## M3 — listes, curseur, pile

- Fenêtre `list` : entrées verticales, curseur (chars fonte ou icône),
  A déclenche l'ACTION de l'entrée — `open <écran>` (empile) ou
  `common_event <n>` ; B dépile, pile vide = retour jeu.
  Pile de 4 écrans (statique), modèle spec §5.
- C'est le cran qui rend le menu FF4 faisable : écran racine =
  fenêtre liste (Item/Magic/…) + fenêtre équipe (liaisons database) +
  fenêtres temps/or.

## M4 — confort FF4

- Portraits/images dans une fenêtre (tiles 4bpp dédiées — étude VRAM à
  faire, probablement budget par écran).
- Listes PEUPLÉES par une table database (inventaire = table items +
  quantités en variables), pagination.
- Jauges HP dans les fiches, `hp_bar` de la spec.

## Ordre retenu et état

| Cran | Contenu | État |
|------|---------|------|
| M1 | tampon unifié ui_screen | fait |
| W1 | widgets Zelda (gauge/icon_row/icon_value, frame, IconSet, placement libre) | fait — détail dans SPEC_SYSTEME_UI.md (appendice) |
| D1 | designer à canvas (arbre window/vbox/hbox/label/value/image, aplatisseur, palette/arborescence/inspecteur) | fait — demande explicite (modèle UMG/Chrono Trigger), détail dans SPEC_SYSTEME_UI.md |
| M2 | écrans déclaratifs + ouverture | à faire |
| M3 | listes + curseur + pile (l'objet liste du designer devient navigable) | à faire |
| M4 | portraits, listes database, hp_bar | à faire |

Écarts W1 vs le plan ci-dessus : `icon_row` est horizontal seulement
(un `gauge` vertical couvre le cas colonne) ; les demi-unités suivent
la règle « 2 unités par tile, troncature » (pas d'arrondi RM) ; le
timer est refresh comme les widgets après effacement de la bande
dialogue ; l'IconSet a aussi l'EXPORT PNG (demande utilisateur).
