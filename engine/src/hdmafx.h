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

/* Dégradé de ciel (SKYGRAD, S15) : teinte VERTICALE — couleur du haut,
   couleur du bas (0-31 par canal) PUIS le mode (parade tcc : 3 u8 max
   par appel). mode 0 = off, 1 = addition, 2 = soustraction. La table
   COLDATA (canal 4) est bâtie ICI, une fois, à la commande — zéro
   coût par frame. REMPLACE la teinte plate ; TINT/TINTG l'annule.
   Persiste entre les scènes ; coupé sous mélange/flash/picture. */
void hdmafx_grad_top(u8 r, u8 g, u8 b);
void hdmafx_grad_bottom(u8 r, u8 g, u8 b);
void hdmafx_grad(u8 mode);

/* Spotlight (SPOTLIGHT, S16) : cercle de lumière qui SUIT le héros —
   radius 16-96 px (0 = off), dark 1-31 = obscurité du décor hors du
   cercle (0 -> 31 = noir). Cercle précalculé à la commande, table
   fenêtre reconstruite seulement quand le héros/la caméra bouge.
   REMPLACE teinte et dégradé (même circuit) ; persiste entre les
   scènes ; sprites et texte restent visibles (limite hardware, comme
   la teinte). */
void hdmafx_spot(u8 radius, u8 dark);

/* Un pas par frame (boucle principale, toujours) : reconstruit les
   tables d'offsets (bandes de 16 lignes) depuis les scrolls courants. */
void hdmafx_update(void);

/* Programme les canaux + écrit HDMAEN — VBlank uniquement, branche
   normale. La branche PICTURE appelle hdmafx_suspend() à la place
   (l'image plein écran ne doit pas onduler ni être teintée). */
void hdmafx_vblank(void);
void hdmafx_suspend(void);

#endif /* HDMAFX_H */
