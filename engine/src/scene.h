/*
 * scene.h — scene loading and the WRAM context of the current scene.
 * Reference: docs/SPEC_FORMATS.md §3.
 */
#ifndef SCENE_H
#define SCENE_H

#include <snes.h>
#include "formats.h"

/* WRAM copy of the header plus resolved pointers (spec §3) */
typedef struct
{
  u8 scene_type;
  u8 map_w, map_h;
  u8 actor_count;
  const u8 *tilemap;       /* lower layer (BG2) */
  const u8 *tilemap_upper; /* upper layer (BG1) — spec §1.2 */
  const u8 *collision;
  const ActorDef *actors;
  const u8 *scripts;
  const WarpDef *warps;
  u8 warp_count;
  u8 music_id;   /* soundbank index; MUSIC_NONE is silence */
  u8 tileset_id; /* gfx_set_id: index into the gfx_* tables
                    (data_assets.c, compiled per scene) */
  u8 sprite_set_id; /* index into the sprite_* tables (sprites
                       compiled per scene; header byte 27) */
  u8 scene_id; /* index in the Scene Table (saves, spec §4) */
  u8 player_start_x, player_start_y;
} SceneCtx;

extern SceneCtx scene_ctx;

/* Boot scene — read from the binary Scene Table: data, not engine */
u8 scene_boot_id(void);

/*
 * Loads scene scene_id from the Scene Table: copies the header into WRAM,
 * loads the tileset and palette into VRAM/CGRAM, then builds and transfers
 * the BG1 tilemap. Call with the screen off (forced blank), before
 * setScreenOn().
 */
void scene_load(u8 scene_id);

/* Collision layer (spec §1.4): 0 is walkable, anything else is solid. */
u8 scene_collision(u8 tx, u8 ty);

#endif /* SCENE_H */
