/*
 * actors.h — acteurs de scène (PNJ statiques v0) : affichage + interaction.
 */
#ifndef ACTORS_H
#define ACTORS_H

#include <snes.h>

#define ACTOR_NONE 0xFF

/* Init de l'état du module + attributs OAM des acteurs. À appeler après
   player_init() (la feuille de sprites doit être chargée). Ne jamais
   compter sur une mise à zéro implicite des statiques avec cette toolchain. */
void actors_init(void);

/* Écrit les metasprites des acteurs dans le shadow OAM (chaque frame).
   Les acteurs hors écran sont cachés. */
void actors_draw(void);

/* Index de l'acteur occupant la tile (tx,ty), ou ACTOR_NONE. */
u8 actor_at_tile(u8 tx, u8 ty);

/* Hook d'interaction (bouton A face à l'acteur).
   Semaine 3 : change une couleur de palette (preuve du hook).
   Semaine 4 : vmStart(script_offset). */
void actor_interact(u8 index);

/* Applique les effets CGRAM en attente. À appeler pendant le VBlank. */
void actors_vblank(void);

#endif /* ACTORS_H */
