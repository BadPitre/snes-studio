# Legende de la Plaine — showcase JRPG

Mini-JRPG complet construit **uniquement avec les fonctionnalités de
l'éditeur** : zéro ligne de code moteur, tout est données (scènes, events,
common events, database, écrans composés, layouts UI). Il sert de
démonstration des briques B8 à B12.

Build : `cd tools/datagen && cargo run --release -- ../../showcase ../../engine`
puis `cd engine && make`.

## Ce que la démo montre

| Brique | Où la voir |
| --- | --- |
| B8 — tables database | `schemas/monsters.toml` + `data/monsters.toml` (PV/ATK/DEF/XP/or), `items.toml` (prix/soin). Les combats et le marchand lisent tout via « Lire la database » — changer une valeur TOML rééquilibre le jeu sans toucher aux scripts. |
| B9 — pack combat | `screens/combat_gobelin.json` / `combat_dragon.json` : écran composé (fond + monstre), menu liste Attaque/Objet/Fuite, HUD PV, dégâts ATK−DEF (min 1), riposte, potion, fuite aléatoire, gains XP/or. |
| B10 — inventaire scripté | common events `poll_menu` (parallel, Start) + `inventaire` (menu Potion/État/Fermer, soin plafonné aux PV max). |
| B11 — titre / game over | scène `titre` (image plein écran + « Appuyez sur A »), common event `game_over` (relais switch 30 : teinte sombre, message, retour au titre) — `nouvelle_partie` réinitialise toutes les stats. |
| B12 — XP / niveaux | common event `gagner_niveau` : boucle tant que XP ≥ seuil (montées multiples), +PV max/+ATK/+DEF, soin complet, seuil +15. |

## Déroulé

titre → village (Ancien : soin + conseils ; Marchand : achat de potions via
le prix en database) → plaine au nord → gobelin (combat imposé sur le
chemin) → montée de niveau → dragon (niveau 2 + potions recommandés) →
victoire → FIN. La défaite déclenche le game over et ramène au titre.

## Techniques de script notables

- **Comparaison de deux variables** : `if_var` ne compare qu'à une
  constante, donc `tmp = a - b` puis `tmp >= 32768` (wrap 16 bits) sert de
  test « a < b » (plafond de soin, bourse du marchand, seuil d'XP).
- **PNJ vaincus** : le gobelin n'a qu'une page conditionnée « switch 31
  OFF » — une fois le switch mis, plus aucune page n'est active et l'event
  disparaît.
- **Gains avant `stage_close`** : le retour de scène coupe le script, donc
  XP/or/messages/switchs se font avant, et les widgets (menu, HUD) sont
  cachés dès l'issue connue pour laisser le temps à l'effacement de
  s'afficher avant le warp.
- **Game over depuis un combat** : l'écran composé met le switch 30, un
  common event autorun fait le reste une fois revenu sur la carte.
