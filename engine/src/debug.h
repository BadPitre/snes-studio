/*
 * debug.h — panneau de debug en jeu (S6, option Réglages de l'éditeur).
 * Inerte sans le drapeau dbg_enabled (data_debug.c, émis par datagen).
 */
#ifndef DEBUG_H
#define DEBUG_H

#include <snes.h>

/* À appeler chaque itération de la boucle principale (hors VBlank) :
   mesure FPS/lag, scrute le combo Start+Select+R, dessine le panneau. */
void debug_update(void);

#endif /* DEBUG_H */
