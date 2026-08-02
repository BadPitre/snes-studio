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

/* Counters and frame selection (main loop, outside stage/picture). */
void tileanim_update(void);

/* Pushes the pending step. VBlank, normal path only — the composed
   screen reuses the tileset char region. */
void tileanim_vblank(void);

#endif /* TILEANIM_H */
