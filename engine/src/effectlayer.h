/*
 * effectlayer.h — the per-scene effect layer: a drifting pattern
 * (clouds, mist) carried by BG1 in place of the upper layer, with
 * optional colour-math blending. Data: data_effects.c.
 */
#ifndef EFFECTLAYER_H
#define EFFECTLAYER_H

#include <snes.h>

/* Loads (or turns off) the scene's effect layer. Called by scene_load with
   the SCREEN OFF — it DMAs chars, map and palette, and sets registers. */
void effect_load(u8 scene_id);

/* 1 when the scene has an effect layer: map.c stops streaming BG1 and
   the main loop routes the BG1 scroll to effect_vblank. */
u8 effect_active(void);

/* 1 when the effect layer is a PANORAMA ("back" mode): the pattern sits
   BEHIND the map on low-priority BG1, so map.c forces the lower layer's
   priority to cover it except on erased tiles. 0 means an overlay. */
u8 effect_is_back(void);

/* Restores the BG1 registers, colour math and palette 7 after a picture:
   the pattern's VRAM data has not moved. */
void effect_restore(void);

/* One drift step per frame (main loop, always). */
void effect_update(void);

/* BG1 scroll = the pattern's drift — VBlank only. */
void effect_vblank(void);

/* The pattern's current X scroll (drift plus camera follow), which is
   the base of the HDMA ripple when an effect layer is active. */
u16 effect_hofs(void);

#endif /* EFFECTLAYER_H */
