/*
 * hdmafx.h — effets HDMA scriptés (S14+) : ondulation de l'écran
 * (chaleur, sous l'eau, rêve), et bientôt dégradé de ciel et spotlight.
 * Un seul module possède $420C (HDMAEN) : chaque effet programme ses
 * canaux et le masque est écrit en un point unique au VBlank.
 */
#ifndef HDMAFX_H
#define HDMAFX_H

#include <snes.h>

/* Ondulation (WAVE) : power 0-7 px d'amplitude (0 = stop), speed 1-8 =
   vitesse de la houle. NON bloquant, persiste entre les scènes. */
void hdmafx_wave(u8 power, u8 speed);

/* Un pas par frame (boucle principale, toujours) : reconstruit les
   tables d'offsets (bandes de 16 lignes) depuis les scrolls courants. */
void hdmafx_update(void);

/* Programme les canaux + écrit HDMAEN — VBlank uniquement, branche
   normale. La branche PICTURE appelle hdmafx_suspend() à la place
   (l'image plein écran ne doit pas onduler ni être teintée). */
void hdmafx_vblank(void);
void hdmafx_suspend(void);

#endif /* HDMAFX_H */
