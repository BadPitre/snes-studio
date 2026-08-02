/*
 * m7.h — the MODE 7 SCREEN (M7-A): a full-screen image the hardware
 * scales, for an intro, a title screen or an entry into battle.
 *
 * Mode 7 is not an effect that can be applied to an existing view: it
 * takes over the whole low half of VRAM (the tilemap in the LOW bytes of
 * $0000-$3FFF, the characters in the HIGH bytes) and it has ONE layer.
 * BG2 and BG3 do not exist there — so no dialogue, no HUD, no scenery
 * underneath. Hence a screen of its own rather than an option.
 *
 * The OBJ region at $4000 is untouched, so the sprites keep working:
 * vignettes and animations play over the plane exactly as they do over
 * a composed screen.
 *
 * Closing is an INTERNAL WARP to the current scene, the same recipe
 * stage.c uses (see stage.h): scenery, sprites, palettes, ambience and
 * music all come back at once.
 *
 * Design and measurements: docs/PLANNING_SYSTEME_MODE7.md.
 */
#ifndef M7_H
#define M7_H

#include <snes.h>

/* The Mode 7 screen is up (the loop's *_draw calls are frozen). */
u8 m7_active(void);

/* A non-looping zoom ramp is playing — the VM waits on it. */
u8 m7_busy(void);

/* VM commands. Opening and closing happen from the MAIN LOOP under
   force blank: 32 KB is far past any VBlank budget, and there is
   nothing to show during the fade anyway. */
void m7_request_open(u8 img, u8 dur);
void m7_request_close(u8 dur);

/* Plays a compiled zoom ramp (datagen turns "from 100% to 150% in 90
   frames" into one 8.8 value per frame). flags bit 0 = loop. A looping
   ramp NEVER blocks a script — as with animations, waiting on it would
   never end. Ramp 0xFF stops the current one where it stands. */
void m7_zoom(u8 ramp, u8 flags);
#define M7_ZOOM_LOOP 0x01
#define M7_ZOOM_STOP 0xFF

/* Opening and closing from the main loop (the picture/stage recipe). */
void m7_apply(void);
/* Close requested: the loop runs the internal warp (do_warp). */
u8 m7_take_close(void);
/* Reset without restoring (a real warp during the screen) — scene_load
   reloads everything behind it. */
void m7_reset(void);

/* One ramp step (main loop) plus the matrix write (VBlank). */
void m7_update(void);
void m7_vblank(void);

#endif /* M7_H */
