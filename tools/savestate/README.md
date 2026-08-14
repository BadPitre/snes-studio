# Gate savestate — les assertions sur l'état de la machine

`../gate-savestate.sh` fait tourner la ROM sans écran (snesphoto), puis
`check.mjs` lit la savestate et vérifie des **faits**, pas des octets de
référence :

- cas `battle` : un showcase dérivé (`derive-battle.mjs`) démarre
  directement le combat des gobelins ; chaque sprite animé posé par
  l'écran doit être à la position que l'écran déclare, en OBJ 32×32,
  sur le bon char, avec des pixels dans ses chars et des couleurs dans
  sa palette. Chacune de ces assertions correspond à un bug réellement
  livré puis chassé à la savestate (battlers invisibles tant que l'ATB
  ne s'était pas remplie, coupés en deux par des rangées DMA perdues,
  affichés dans les couleurs d'une autre planche).
- cas `boot` : la demo démarre, le métasprite du joueur est à l'écran,
  ses chars et sa palette sont chargés.

Pourquoi des assertions et pas des références en or : un hachage de la
VRAM casserait à chaque retouche graphique légitime (le piège que
gate-datagen refuse déjà). Ici, déplacer un battler dans l'éditeur ne
casse rien — les positions attendues sont lues dans le JSON de l'écran ;
seul le moteur qui casse fait échouer le gate.

`check.mjs` est autonome (node seul, aucun npm install) : il embarque le
lecteur de savestate minimal. La référence complète est
`editor/src/s9xstate.ts` — si un snes9x futur déplace un champ du bloc
PPU, corriger les deux.

Ce qui n'est pas dans le dépôt : le core `snes9x_libretro.so` (même
règle et même découverte que `tools/regress/`).
