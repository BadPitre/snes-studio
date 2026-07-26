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

/* Interaction (bouton A face à l'acteur) : lance le script de l'acteur
   sur la VM, s'il en a un (script_offset != SCRIPT_NONE). */
void actor_interact(u8 index);

#endif /* ACTORS_H */
