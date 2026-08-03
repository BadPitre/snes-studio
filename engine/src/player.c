/*
 * player.c — top-down module: inputs, movement + collision, metasprite,
 * interaction.
 *
 * Starting position and map dimensions come from the scene data
 * (SceneCtx). Gfx: the global sprite sheet (data_assets.c), 16x24 frames
 * in RM2003 character blocks — the player is block 0.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "player.h"
#include "camera.h"
#include "weather.h"
#include "vignette.h"
#include "actors.h"
#include "vm.h"
#include "vram.h"
#include "m7.h"

/* Sprite sets (data_assets.c) — compiled PER SCENE by datagen: 16x24
   frames in character blocks of 12 (RM2003 model), only the blocks the
   scene uses are loaded (local slot s -> OBJ palette s, player = slot 0).
   Tables indexed by sprite_set_id (header byte 27) — arrays of pointers:
   indexing those is reliable under tcc (the scene_table pattern). */
extern const u8 *const sprite_chars[];
extern const u16 *const sprite_chars_sizes[];
extern const u16 *const sprite_pals[];

/* Player OAM ids: 2 stacked 16x16 OBJs (id * 4, PVSnesLib structure) */
#define PLAYER_OAM_TOP 0
#define PLAYER_OAM_BOT 4

/* OBJ priority 2: above the low-priority BG tiles in mode 1 */
#define PLAYER_OBJ_PRIO 2

Player player;

/* Blocking tile: solid collision layer OR an actor (solid NPCs). Warp
   tiles (COL_WARP) stay walkable. */
static u8 tile_blocked(u8 tx, u8 ty)
{
  if (COL_TYPE(scene_collision(tx, ty)) == COL_SOLID)
    return 1;
  return actor_at_tile(tx, ty) != ACTOR_NONE;
}

/* Warp detection: fires when the player's CENTRE tile changes and lands
   on a COL_WARP tile (no re-firing on the spot). Same logic for CONTACT
   triggers (invisible actors): their script starts when you step on
   their tile. */
/* EXPLICIT init: tcc-816 does not clear the BSS — a bare static keeps the
   console's/emulator's boot pattern (0x55 on snes9x). The internal warp
   that closes a composed screen (B3) consumed warp_dest_dir before any
   write: dir = 0x54 -> chars off the table -> hero invisible/black. */
static u8 prev_ctx = 0, prev_cty = 0;
static u8 warp_pending = 0;
static u8 warp_dest_scene = 0, warp_dest_x = 0, warp_dest_y = 0;
/* Arrival direction (v0.16, WarpDef.flags bits 0-2): 0 = keep, 1-4 =
   DIR_* + 1 — consumed by do_warp through player_take_warp_dir. */
static u8 warp_dest_dir = 0;
/* Transition (S18, WarpDef.trans): 0 fade, 1 instant, 2 mosaic —
   consumed by do_warp through player_take_warp_trans. */
static u8 warp_dest_trans = 0;

static void check_warp(void)
{
  u8 ctx = (u8)((player.x + 8) >> 4);
  u8 cty = (u8)((player.y + 8) >> 4);
  u8 i;
  const WarpDef *w;

  if (ctx == prev_ctx && cty == prev_cty)
    return;
  prev_ctx = ctx;
  prev_cty = cty;

  /* On a WORLD MAP the collision byte comes from a per-block table
     (§7.5) and cannot carry the warp mark datagen bakes per CELL — so
     the list is scanned directly. It only runs when the hero ENTERS a
     tile, and a world map's warp list is short. */
  if (m7_world_active() || COL_TYPE(scene_collision(ctx, cty)) == COL_WARP)
  {
    w = scene_ctx.warps;
    for (i = 0; i < scene_ctx.warp_count; i++, w++)
    {
      if (w->x == ctx && w->y == cty)
      {
        warp_pending = 1;
        warp_dest_scene = w->dest_scene;
        warp_dest_x = w->dest_x;
        warp_dest_y = w->dest_y;
        warp_dest_dir = w->flags & 0x07;
        warp_dest_trans = w->trans; /* warp transition (S18) */
        return;
      }
    }
  }

  /* Contact trigger? (the script freezes the player from this frame) */
  i = actor_trigger_at(ctx, cty);
  if (i != ACTOR_NONE)
  {
    vm_start(scene_ctx.actors[i].script_offset);
    vm.script_actor = i; /* target of the "this event" ROUTE (v0.12) */
  }
}

/* Scripted warp (WARP opcode) — same path as the warp tiles: consumed by
   the main loop through player_take_warp(). */
void player_request_warp(u8 dest_scene, u8 dest_x, u8 dest_y, u8 trans)
{
  warp_pending = 1;
  warp_dest_scene = dest_scene;
  warp_dest_x = dest_x;
  warp_dest_y = dest_y;
  warp_dest_dir = 0; /* scripted warps keep the direction */
  warp_dest_trans = trans;
}

/* Arrival direction of the consumed warp (0 = keep, 1-4 = DIR_* + 1) —
   read it right after player_take_warp(). */
u8 player_take_warp_dir(void)
{
  u8 d = warp_dest_dir;

  /* consumed: a warp WITHOUT a direction (closing a composed screen,
     loading a save) must not inherit the previous warp's */
  warp_dest_dir = 0;
  return d;
}

/* Transition of the consumed warp (S18: 0 fade, 1 instant, 2 mosaic) —
   read it right after player_take_warp(), consumed like the direction. */
u8 player_take_warp_trans(void)
{
  u8 t = warp_dest_trans;

  warp_dest_trans = 0;
  return t;
}

void player_set_pos(u8 tx, u8 ty)
{
  player.x = (u16)tx << 4;
  player.y = (u16)ty << 4;
  prev_ctx = tx;
  prev_cty = ty;
  warp_pending = 0;
}

u8 player_take_warp(u8 *dest_scene, u8 *dest_x, u8 *dest_y)
{
  if (!warp_pending)
    return 0;
  warp_pending = 0;
  *dest_scene = warp_dest_scene;
  *dest_x = warp_dest_x;
  *dest_y = warp_dest_y;
  return 1;
}

/* AABB 16x16: does the target position (px,py) overlap anything solid?
   A step is 1 px, so the box covers at most 2 tiles per axis (4 corners).
   Corners are DEDUPLICATED: aligned on one axis (the common case when
   walking straight), 2 tests instead of 4 — tile_blocked walks the actor
   list, so every call avoided counts against the frame budget. */
static u8 blocked(u16 px, u16 py)
{
  u8 tx1 = px >> 4, ty1 = py >> 4;
  u8 tx2 = (px + 15) >> 4, ty2 = (py + 15) >> 4;

  if (tile_blocked(tx1, ty1))
    return 1;
  if (tx2 != tx1 && tile_blocked(tx2, ty1))
    return 1;
  if (ty2 != ty1)
  {
    if (tile_blocked(tx1, ty2))
      return 1;
    if (tx2 != tx1 && tile_blocked(tx2, ty2))
      return 1;
  }
  return 0;
}

/* Directional passage (T1): does moving to (nx,ny) cross a CLOSED SIDE?
   Tested on the CENTRE tile (RM2003 model: sides live on tile borders —
   counters, one-way ledges). Leaving A through side dir, or entering B
   through the opposite side (dir ^ 1), is forbidden when the matching
   bit is set. */
static u8 edge_blocked(u16 nx, u16 ny, u8 dir)
{
  u8 cx = (u8)((player.x + 8) >> 4);
  u8 cy = (u8)((player.y + 8) >> 4);
  u8 nx8 = (u8)((nx + 8) >> 4);
  u8 ny8 = (u8)((ny + 8) >> 4);

  if (cx == nx8 && cy == ny8)
    return 0; /* no border crossed */
  if (COL_SIDES(scene_collision(cx, cy)) & (u8)(1 << dir))
    return 1; /* exit closed */
  if (COL_SIDES(scene_collision(nx8, ny8)) & (u8)(1 << (dir ^ 1)))
    return 1; /* entry closed */
  return 0;
}

/* Anti-corner slide: when a horizontal move is blocked by only ONE of
   the two tiles in the target column tx, AND the overlap in the blocking
   row is <= 8 px (half a tile), we shift 1 px vertically towards the
   free row. Past half a tile the player is "aiming" at that row: we
   block outright (otherwise he would slide around NPCs and could never
   face them on an offset approach — found on the emulation
   harness). */
static void slide_v(u8 tx)
{
  u8 ty1 = player.y >> 4;
  u8 ty2 = (player.y + 15) >> 4;
  u8 ov = player.y & 15; /* overlap in the bottom row */

  if (ty1 == ty2)
    return;
  if (tile_blocked(tx, ty1) && !tile_blocked(tx, ty2))
  {
    /* the top row blocks: top overlap = 16 - ov */
    if (16 - ov <= 8 && !blocked(player.x, player.y + 1))
      player.y++;
  }
  else if (!tile_blocked(tx, ty1) && tile_blocked(tx, ty2))
  {
    if (ov <= 8 && !blocked(player.x, player.y - 1))
      player.y--;
  }
}

/* Symmetric for a blocked vertical move: horizontal shift. */
static void slide_h(u8 ty)
{
  u8 tx1 = player.x >> 4;
  u8 tx2 = (player.x + 15) >> 4;
  u8 ov = player.x & 15;

  if (tx1 == tx2)
    return;
  if (tile_blocked(tx1, ty) && !tile_blocked(tx2, ty))
  {
    if (16 - ov <= 8 && !blocked(player.x + 1, player.y))
      player.x++;
  }
  else if (!tile_blocked(tx1, ty) && tile_blocked(tx2, ty))
  {
    if (ov <= 8 && !blocked(player.x - 1, player.y))
      player.x--;
  }
}

/* A button: interact with the actor on the tile the player faces */
static void player_try_interact(void)
{
  u8 tx = (player.x + 8) >> 4;
  u8 ty = (player.y + 8) >> 4;
  u8 i;

  if (player.dir == DIR_LEFT)
  {
    if (tx == 0)
      return;
    tx--;
  }
  else if (player.dir == DIR_RIGHT)
    tx++;
  else if (player.dir == DIR_UP)
  {
    if (ty == 0)
      return;
    ty--;
  }
  else
    ty++;

  i = actor_at_tile(tx, ty);
  if (i == ACTOR_NONE)
  {
    /* nothing in front: an event "under the hero" beneath our feet?
       (a chest on the ground, below priority) */
    i = actor_standing_at((u8)((player.x + 8) >> 4),
                          (u8)((player.y + 8) >> 4));
  }
  if (i != ACTOR_NONE)
    actor_interact(i);
}

void player_init(void)
{
  player_set_pos(scene_ctx.player_start_x, scene_ctx.player_start_y);
  player.dir = DIR_DOWN;
  player.moving = 0;
  player.anim_frame = 0;
  player.anim_timer = 0;

  /* The scene's sprite set + the full OBJ CGRAM (one palette per block
     slot), 16x16 sprites by default (2 stacked OBJs per frame). Called
     with the screen off (boot and warps): safe transfers. */
  oamInitGfxSet((u8 *)sprite_chars[scene_ctx.sprite_set_id],
                *sprite_chars_sizes[scene_ctx.sprite_set_id],
                (u8 *)sprite_pals[scene_ctx.sprite_set_id], 128 * 2,
                0, VRAM_OBJ_GFX, OBJ_SIZE16_L32);
  weather_load(); /* weather particles (S13): chars at the end of the OBJ region
     + OBJ palette 7 — AFTER oamInitGfxSet, which overwrites the OBJ CGRAM */
  vig_reload();   /* vignette palettes/frames (B5) — same reason */

  oamSet(PLAYER_OAM_TOP, player.x, player.y, PLAYER_OBJ_PRIO, 0, 0, 0, 0);
  oamSet(PLAYER_OAM_BOT, player.x, player.y, PLAYER_OBJ_PRIO, 0, 0, 0, 0);
  oamSetEx(PLAYER_OAM_TOP, OBJ_SMALL, OBJ_SHOW);
  oamSetEx(PLAYER_OAM_BOT, OBJ_SMALL, OBJ_SHOW);
}

void player_update(void)
{
  u16 pad = padsCurrent(0);
  u16 max_x = (((u16)scene_ctx.map_w << 4)) - 16;
  u16 max_y = (((u16)scene_ctx.map_h << 4)) - 16;

  /* Noise guard: left+right or up+down at once means an invalid pad read
     (open bus, controller unplugged) — the frame is ignored */
  if ((pad & (KEY_LEFT | KEY_RIGHT)) == (KEY_LEFT | KEY_RIGHT) ||
      (pad & (KEY_UP | KEY_DOWN)) == (KEY_UP | KEY_DOWN))
    pad = 0;

  player.moving = 0;

  /* 4 exclusive directions, 1 px/frame, AABB collision + slide */
  if (pad & KEY_LEFT)
  {
    player.dir = DIR_LEFT;
    player.moving = 1;
    if (player.x > 0)
    {
      if (!blocked(player.x - 1, player.y) &&
          !edge_blocked(player.x - 1, player.y, DIR_LEFT))
        player.x--;
      else
        slide_v((player.x - 1) >> 4);
    }
  }
  else if (pad & KEY_RIGHT)
  {
    player.dir = DIR_RIGHT;
    player.moving = 1;
    if (player.x < max_x)
    {
      if (!blocked(player.x + 1, player.y) &&
          !edge_blocked(player.x + 1, player.y, DIR_RIGHT))
        player.x++;
      else
        slide_v((player.x + 16) >> 4);
    }
  }
  else if (pad & KEY_UP)
  {
    player.dir = DIR_UP;
    player.moving = 1;
    if (player.y > 0)
    {
      if (!blocked(player.x, player.y - 1) &&
          !edge_blocked(player.x, player.y - 1, DIR_UP))
        player.y--;
      else
        slide_h((player.y - 1) >> 4);
    }
  }
  else if (pad & KEY_DOWN)
  {
    player.dir = DIR_DOWN;
    player.moving = 1;
    if (player.y < max_y)
    {
      if (!blocked(player.x, player.y + 1) &&
          !edge_blocked(player.x, player.y + 1, DIR_DOWN))
        player.y++;
      else
        slide_h((player.y + 16) >> 4);
    }
  }

  check_warp();

  if (padsDown(0) & KEY_A)
    player_try_interact();

  /* RM2003 walk cycle: anim_frame 0-3 -> idle, step A, idle, step B
     (advances every 8 frames of movement) */
  if (player.moving)
  {
    player.anim_timer++;
    if (player.anim_timer >= 8)
    {
      player.anim_timer = 0;
      player.anim_frame = (player.anim_frame + 1) & 3;
    }
  }
  else
  {
    player.anim_timer = 0;
    player.anim_frame = 0;
  }
}

/* The hero's OAM words (tile + attribute): cached, see player_draw */
static u8 pl_lastf = 0xFF;
static u16 pl_w1 = 0, pl_w3 = 0;
static u8 pl_x9 = 0;

/* Those caches describe what is ALREADY in the OAM shadow. Anything that
   writes the hero's entries behind player_draw's back must say so, or
   the next draw SKIPS the very writes that would undo it. Mode 7's world
   map is the first path to hit this: it hides all 128 sprites on
   opening, and oamSetVisible parks them at x = 511 by setting the 9th X
   bit — which player_draw then never cleared, because its cached copy
   still said "not set". The hero was drawn, correctly, off screen. */
void player_draw_reset(void)
{
  pl_lastf = 0xFF;
  pl_x9 = 0xFF; /* neither 0 nor 1: both branches rewrite */
}

void player_draw(void)
{
  u16 sx = player.x - camera.x;
  u16 sy = player.y - camera.y;
  /* cycle phase 0-3 -> displayed step: 0, A, 0, B (no array indexing:
     tcc-816 is fragile on array symbols) */
  u8 add = (player.anim_frame & 1) ? (u8)(1 + (player.anim_frame >> 1)) : 0;
  /* player = block 0: frame = dir*3 + step, OBJ palette 0 */
  u8 f = (u8)(player.dir * 3 + add);

  /* Direct OAM writes (P3): going through oamSet cost ~10 % of the frame
     for the hero alone — mostly tcc-816 marshalling the eight arguments.
     The "tile + attribute" words only change with the displayed frame,
     so they are cached.
     2 stacked OBJs, anchored 8 px above the tile (RM2003-style head) — a
     negative y wraps past 224: the top lines vanish and the bottom ones
     come back at the top of the screen = correct clipping at the edge */
  {
    u16 *o = (u16 *)&oamMemory[PLAYER_OAM_TOP];
    u16 x8 = sx & 0xFF;
    u16 y8 = (sy - SPRITE_Y_OVERLAP) & 0xFF;

    if (f != pl_lastf)
    {
      u16 tile = OBJ_TOP_TILE(f);
      u16 attr = (u16)PLAYER_OBJ_PRIO << 4; /* OBJ palette 0 */

      pl_w1 = (tile & 0xFF) | ((attr | (tile >> 8)) << 8);
      tile += 32; /* OBJ_BOTTOM_TILE */
      pl_w3 = (tile & 0xFF) | ((attr | (tile >> 8)) << 8);
      pl_lastf = f;
    }
    o[0] = x8 | (y8 << 8);
    o[1] = pl_w1;
    o[2] = x8 | (((y8 + 16) & 0xFF) << 8);
    o[3] = pl_w3;
    /* 9th bit of X: the hero only crosses that edge at the map's end */
    add = (sx & 0x100) ? 1 : 0;
    if (add != pl_x9)
    {
      pl_x9 = add;
      if (add)
        oamMemory[512] |= 0x05; /* OBJ 0 and 1: same byte of table 2 */
      else
        oamMemory[512] &= (u8)~0x05;
    }
  }
}
