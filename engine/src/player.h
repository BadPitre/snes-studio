/*
 * player.h — the top-down player module (spec §3).
 */
#ifndef PLAYER_H
#define PLAYER_H

#include <snes.h>

typedef struct
{
  u16 x, y;      /* position in pixels (top-left of the metasprite) */
  u8 dir;        /* DIR_* */
  u8 moving;
  u8 anim_frame;
  u8 anim_timer;
} Player;

extern Player player;

/* Init from the scene data (the Scene Header's start position) plus the
   player graphics into VRAM. Call after scene_load(). */
void player_init(void);

/* Reads the pad and moves in 4 directions, 1 px per frame, clamped to
   the map edges. */
void player_update(void);

/* Writes the metasprite into the shadow OAM, in screen coordinates via
   the camera. The OAM transfer leaves at VBlank (PVSnesLib's NMI). */
void player_draw(void);

/* Drops player_draw's OAM caches. Call it after touching the hero's OAM
   entries from outside — otherwise the next draw believes the shadow
   already holds what it is about to write, and writes nothing. */
void player_draw_reset(void);

/* Exact-frame override (CH3 — the charset animation player,
   charanim.c): while set, player_draw shows frame f of the scene's OBJ
   sheet with OBJ palette pal, walk state ignored. */
void player_frame_ovr(u8 f, u8 pal);
void player_frame_ovr_clear(void);

/* The charset the player CONTROLS (CH5 — the HEROGFX opcode): slot is
   the seat in the CURRENT scene's set, block the PROJECT block kept
   for re-resolution at the next scene load (scn_slot_block). */
void player_set_charset(u8 slot, u8 block);

/* Places the player on a tile (used on arriving from a warp) without
   re-triggering the destination tile's own warp. */
void player_set_pos(u8 tx, u8 ty);

/* Was a warp requested this frame? Returns 1 and fills in the
   destination — once: the call consumes the request. */
u8 player_take_warp(u8 *dest_scene, u8 *dest_x, u8 *dest_y);

/* Requests a warp from a script (the WARP opcode), consumed by the main
   loop like a tile warp. trans: 0 fade, 1 instant, 2 mosaic. */
void player_request_warp(u8 dest_scene, u8 dest_x, u8 dest_y, u8 trans);

/* Arrival facing of the last consumed warp: 0 keeps the hero's current
   direction, 1-4 are DIR_* + 1 (WarpDef.flags bits 0-2). */
u8 player_take_warp_dir(void);

/* Transition of the last consumed warp: 0 fade, 1 instant, 2 mosaic —
   consumed like the facing. */
u8 player_take_warp_trans(void);

#endif /* PLAYER_H */
