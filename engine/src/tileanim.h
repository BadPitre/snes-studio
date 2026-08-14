/*
 * tileanim.h — ANIMATED scenery tiles (RM2003 water model).
 * Sequences are declared per tileset (the "anims" key of the
 * assets/<stem>.json sidecar) and resolved by datagen into chars of
 * each scene's gfx set (data_tileanim.c): at every step the 4 8x8
 * chars of the base tile receive the current frame's pixels. One
 * sequence per VBlank.
 */
#ifndef TILEANIM_H
#define TILEANIM_H

#include <snes.h>

/* Loads the scene's sequences (at the end of scene_load). */
void tileanim_init(u8 scene_id);

/* Counters, frame selection and the step's publication toward the
   dispatcher (main loop, outside stage/picture). The step fires from
   vblnmi.c's lanes since V-NMI V3 — no tileanim_vblank anymore. The
   composed screen reuses the tileset char region: every display
   takeover calls vn_cancel_scene (vblnmi.h) so a stale step never
   lands there. */
void tileanim_update(void);

#endif /* TILEANIM_H */
