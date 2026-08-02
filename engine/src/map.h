/*
 * map.h — the VRAM window and the streaming of both tilemap layers.
 *
 * Scenery has two layers, RPG Maker 2003 style: BG2 is the lower layer
 * (ground), BG1 the upper one (objects). In mode 1, BG1 at priority 0
 * draws over BG2 but behind priority-2 sprites; a tile marked in the
 * tileset's priority table gets the BG priority bit and draws IN FRONT
 * of the hero.
 *
 * VRAM only holds a window of 32x32 metatiles per layer — one full
 * SC_64x64 tilemap — on a map that may reach 255x255. The window follows
 * the camera; incoming columns and rows are prepared during the active
 * frame and transferred at VBlank.
 *
 * Constraint: map_w and map_h are at least 20x15, one screen. A map
 * smaller than the window fits inside it and never streams on that axis.
 */
#ifndef MAP_H
#define MAP_H

#include <snes.h>

/* The current metatile table (4 u16 BG entries per 16x16 tile) and
   priority table (one byte per metatile, 1 = draws in front, upper
   layer only). Passed by function call: indexing a far array symbol
   directly is miscompiled by tcc-816 — see
   docs/ENGINE_CONSTRAINTS.md §1.5. */
void map_set_metatiles(const u16 *table, const u8 *prio);

/* Fills the whole window of both layers from the current camera
   position and transfers it (2 x 8 KB). Call with the screen off,
   after camera_update(). */
void map_init(void);

/* Makes the window follow the camera: prepares the incoming column
   and/or row of both layers in WRAM, at most one of each per frame.
   Call during the active frame, after camera_update(). */
void map_update(void);

/* Transfers the pending columns and rows. Call just after
   WaitForVBlank(). */
void map_vblank(void);

#endif /* MAP_H */
