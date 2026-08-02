/*
 * hdmafx.h — scripted HDMA effects: screen ripple, sky gradient and
 * spotlight. One module owns $420C (HDMAEN): each effect programmes
 * its channels and the mask is written at a single point, at VBlank.
 */
#ifndef HDMAFX_H
#define HDMAFX_H

#include <snes.h>

/* Ripple (WAVE): power is 0-7 px of amplitude (0 stops it), speed 1-8
   is the swell rate. NON-blocking, persists across scenes. */
void hdmafx_wave(u8 power, u8 speed);

/* Sky gradient (SKYGRAD): a VERTICAL tint — top colour, bottom colour
   (0-31 per channel) and THEN the mode, because tcc takes at most 3 u8
   per call. Mode 0 off, 1 additive, 2 subtractive. The COLDATA table
   (channel 4) is built HERE, once, when the command runs — zero cost
   per frame. It REPLACES the flat tint; TINT/TINTG cancels it.
   Persists across scenes; suppressed under blending, flash or picture. */
void hdmafx_grad_top(u8 r, u8 g, u8 b);
void hdmafx_grad_bottom(u8 r, u8 g, u8 b);
void hdmafx_grad(u8 mode);

/* Spotlight (SPOTLIGHT): a circle of light that FOLLOWS the hero.
   radius 16-96 px (0 off), dark 1-31 is how dark the scenery goes
   outside the circle (31 = black). The circle is precomputed when the
   command runs and the window table is rebuilt only when the hero or
   the camera moves. REPLACES tint and gradient (same circuit) and
   persists across scenes; sprites and text stay visible, a hardware
   limit it shares with the tint. */
void hdmafx_spot(u8 radius, u8 dark);

/* One step per frame (main loop, always): rebuilds the offset tables
   (16-line bands) from the current scrolls. */
void hdmafx_update(void);

/* Programmes the channels and writes HDMAEN — VBlank only, normal
   branch. The PICTURE branch calls hdmafx_suspend() instead: a
   full-screen image must neither ripple nor be tinted. */
void hdmafx_vblank(void);
void hdmafx_suspend(void);

#endif /* HDMAFX_H */
