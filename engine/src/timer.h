/*
 * timer.h — timer de jeu affichable (v0.13) : décompte en secondes piloté
 * par l'opcode TIMER, affichage « M:SS » sur BG3 (coin haut-droit).
 */
#ifndef TIMER_H
#define TIMER_H

#include <snes.h>

/* Init explicite (statics tcc) — à appeler au boot. */
void timer_init(void);

/* Un argument par fonction : (u8, u16) en couple est corrompu par
   tcc-816 (piège toolchain, cf. timer.c). */
void timer_set(u16 secs); /* règle et démarre le décompte */
void timer_stop(void);
void timer_display(u8 on);

/* Secondes restantes (opcode VAROP, source « timer »). */
u16 timer_secs(void);

/* Un tick par frame (boucle principale, hors menu Système). L'affichage
   est composé dans ui_map — transfert centralisé ui_screen_vblank (M1). */
void timer_tick(void);

#endif /* TIMER_H */
