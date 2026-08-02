/*
 * screenfx.h — scripted screen effects: fade (hide/show the screen),
 * tint, flash, shake. Opcodes SCRHIDE/SCRSHOW/TINT/FLASH/SHAKE
 * (spec §2).
 */
#ifndef SCREENFX_H
#define SCREENFX_H

#include <snes.h>

/* Explicit init at boot — never rely on statics being zeroed. */
void screenfx_init(void);

/* After a warp: the warp's own fade leaves the screen lit, so this
   resynchronises the scripted fade and cuts flash and shake. The TINT
   persists across scenes (RM2003's model). */
void screenfx_warp_reset(void);

/* Scripted fade: hide (to black) or show (to full), `dur` being a
   DURATION in frames (1-255, an 8.8 ramp). Blocking on the VM side
   through screenfx_busy. fx: 0 fade, 1 instant (dur ignored), 2 mosaic,
   3-5 wipe down/up/centre (an HDMA curtain, the same codes as the
   warps). */
void screenfx_hide(u8 dur, u8 fx);
void screenfx_show(u8 dur, u8 fx);
u8 screenfx_busy(void);

/* Tint: set r/g/b (0-31) THEN apply the mode — two calls, working
   around the multiple-parameter trap (docs/ENGINE_CONSTRAINTS.md §1.6;
   3 u8 are proven safe). Mode 0 normal, 1 lightens (additive), 2
   darkens (subtractive). It touches the SCENERY and the backdrop, not
   the characters: the hardware limits OBJ colour math to palettes 4-7.
   Persists across scenes until the next TINT. */
void screenfx_tint_rgb(u8 r, u8 g, u8 b);
void screenfx_tint(u8 mode);

/* GRADUAL tint (day/night): set the target rgb THEN start it (mode,
   frames) — the same two-call workaround. Non-blocking (chain a WAIT to
   wait for it), persists across scenes, frames 0 is immediate. Mode 0
   fades the current tint towards zero. add <-> sub goes through zero in
   two halves. An immediate TINT cancels a gradual one in progress. */
void screenfx_tintg_rgb(u8 r, u8 g, u8 b);
void screenfx_tintg(u8 mode, u8 frames);

/* Sky gradient: a VERTICAL TINT — the same colour-math circuit as the
   tint, but the fixed colour ($2132) is rewritten line by line by the
   HDMA (channel 4, a static table built by hdmafx_grad). screenfx only
   owns the MODE, as the source of truth: it sets CGWSEL/CGADSUB at
   VBlank and leaves COLDATA to the HDMA. A gradient REPLACES the flat
   tint; TINT/TINTG cancels it, sharing the register.
   Mode 0 off, 1 additive, 2 subtractive. */
void screenfx_skygrad(u8 mode);
u8 screenfx_skygrad_mode(void);

/* Spotlight: a circle of light around the hero — the scenery is
   darkened (a dark,dark,dark subtraction) OUTSIDE colour window W1,
   whose circle the HDMA traces (hdmafx_spot). dark 0 is off, 1-31 is
   the darkness (31 = black scenery). REPLACES tint and gradient;
   TINT/TINTG/SKYGRAD removes it, sharing the circuit. Sprites and text
   stay visible everywhere, the same limit as the tint. */
void screenfx_spot(u8 dark);
u8 screenfx_spot_active(void);

/* Circuit state for hdmafx: the COLDATA channel is cut when the circuit
   is held by a blend or borrowed by a flash */
u8 screenfx_cm_held(void);
u8 screenfx_flash_active(void);

/* Flash: an (r,g,b) addition decaying over `frames` frames, after which
   the current tint is restored. Non-blocking (chain a WAIT). */
void screenfx_flash(u8 r, u8 g, u8 b);
void screenfx_flash_start(u8 frames);

/* Shake: a horizontal offset of ±power px, alternating every `speed`
   frames, for `frames` frames. power 0 stops it. Non-blocking. */
void screenfx_shake(u8 power, u8 speed, u8 frames);

/* This frame's horizontal scroll offset (0 outside a shake) — added to
   the BG1/BG2 scroll by the main loop. */
u16 screenfx_shake_x(void);

/* Picture and effect-layer blending: with the hold set, screenfx stops
   touching the colour math ($2130-$2132) — the blend owns the circuit
   and the tint is suspended. EXCEPTION: a FLASH borrows it for the
   duration of its decay and then restores the registers memorised by
   screenfx_cm_hold_regs, which must be called BEFORE cm_hold(1) — a
   storm's lightning shows through blended clouds. Releasing the hold
   reasserts the persistent tint. */
void screenfx_cm_hold_regs(u8 ts, u8 wsel, u8 adsub);
void screenfx_cm_hold(u8 on);

/* Wipe: HDMA channel 2 drives brightness $2100 in scanline bands —
   BLACK bands that grow. trans: 3 downwards (black descends from the
   top), 4 upwards (black rises from the bottom), 5 towards the centre
   (two bands meet in the middle). `black` is the total of black lines
   (0-224). Use ONLY inside the blocking transition loops (warp,
   composed screen), one call per frame just after WaitForVBlank:
   hdmafx, which owns $420C in normal operation, does not run during
   those loops and reasserts its mask at the VBlank following the end. */
void screenfx_wipe_step(u8 trans, u16 black);
void screenfx_wipe_off(void);
/* wipe active — hdmafx adds channel 2 to its $420C mask */
u8 screenfx_wipe_active(void);

/* One effect step per frame (main loop, always). */
void screenfx_update(void);

/* Register writes ($2100, $2130-$2132) — VBlank only. */
void screenfx_vblank(void);

#endif /* SCREENFX_H */
