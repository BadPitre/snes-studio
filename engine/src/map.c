/*
 * map.c — the VRAM window and the streaming of both tilemap layers.
 *
 * BG2 is the lower layer (ground), BG1 the upper one. Both share the
 * charset, the palette, the window and the scroll; only the upper layer
 * applies the priority table (bit 0x2000, in front of the sprites).
 *
 * SC_64x64 addressing: 4 consecutive screens of 32x32 words
 * (0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right).
 * Char (X,Y) in 0..63 maps to screen (X>>5) + ((Y>>5)<<1), at offset
 * (Y&31)*32 + (X&31).
 *
 * The BG hardware wraps at 512 px and the window is exactly that wrap
 * area: a VRAM char equals the map coordinate mod 64, and the scroll
 * registers take the camera position as it is.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "camera.h"
#include "map.h"
#include "vbudget.h"
#include "vram.h"
#include "vramjob.h"
#include "vblnmi.h"
#include "effectlayer.h"

#define WIN_W 32     /* window in metatiles = one full SC_64x64 tilemap */
#define WIN_H 32
#define WIN_MARGIN 8 /* how far ahead of the visible edge the window runs */

/* BG priority bit of a map entry ($2105) — upper-layer tiles drawn in front */
#define BG_PRIO 0x2000

/* Transfer plans, built by map_queue_col/row and PUBLISHED to the
   dispatcher (vblnmi.h, V3): the burst descriptor carries the queue
   slice and its $2115 mode, and fires from the NMI ISR (fast lane) or
   the VBlank tail under the budget. Defined further down. */
static void map_plan_col(u16 j, u16 base_vram, u16 bx, u16 *buf);
static void map_plan_row(u16 j, u16 base_vram, u16 by, u16 *buf);

/* Current tileset tables (see map_set_metatiles) */
static const u16 *mt_table;
static const u8 *prio_table;

/* Forced priority of the lower layer: BG_PRIO when a panorama is
   active, so the lower layer covers the low-priority BG1 pattern behind
   it — except on erased tiles. 0 leaves the rendering unchanged. */
static u16 lo_prio;

/* Top-left corner of the window, in metatiles */
static u16 win_x, win_y;

/* Full window for the initial fill (screen off), reused for both
   layers, one DMA at a time */
static u16 bg_map_buffer[4096];

/* Streaming buffers, indexed by absolute VRAM char coordinate (0..63).
   One metatile column or row is 2 columns or rows of DISTINCT chars (the
   metatile table), so there is one buffer per char column or row, per
   layer (lo = lower/BG2, up = upper/BG1). */
static u16 col_lo[2][64], col_up[2][64];
static u16 row_lo[2][64], row_up[2][64];
static u16 col_vram_x; /* VRAM char column (even, 0..62) */
static u16 row_vram_y; /* VRAM char row (even, 0..62) */

/* Target window position for a given camera. The camera is already
   clamped to the map edges by camera_update. A map smaller than the
   window fits entirely inside it: the window stays at 0 and that axis
   never streams. */
static u16 map_win_target(u16 cam, u8 map_size)
{
  u16 t;

  if ((u16)map_size <= WIN_W)
    return 0;
  t = cam >> 4;
  if (t > WIN_MARGIN)
    t -= WIN_MARGIN;
  else
    t = 0;
  if (t > (u16)map_size - WIN_W)
    t = (u16)map_size - WIN_W;
  return t;
}

void map_set_metatiles(const u16 *table, const u8 *prio)
{
  mt_table = table;
  prio_table = prio;
}

/* Fills bg_map_buffer with one layer's window and transfers it.
   with_prio = 0 for the lower layer, 1 to apply the priority table. */
static void map_fill_layer(const u8 *tilemap, u16 vram, u8 with_prio)
{
  u16 mx, my, amx, amy, bx, by, entry, screen, ofs, pr;
  const u8 *src;

  for (my = 0; my < WIN_H; my++)
  {
    amy = win_y + my;
    src = tilemap + amy * (u16)scene_ctx.map_w + win_x;
    for (mx = 0; mx < WIN_W; mx++)
    {
      amx = win_x + mx;
      /* Off-map (map smaller than the window): char 0, transparent and
         never visible — the camera is clamped to the map edges. */
      if (amy >= scene_ctx.map_h || amx >= scene_ctx.map_w)
      {
        for (by = (amy << 1) & 63; by <= ((amy << 1) & 63) + 1; by++)
        {
          for (bx = (amx << 1) & 63; bx <= ((amx << 1) & 63) + 1; bx++)
          {
            screen = (bx >> 5) + ((by >> 5) << 1);
            ofs = (screen << 10) + ((by & 31) << 5) + (bx & 31);
            bg_map_buffer[ofs] = 0;
          }
        }
        continue;
      }
      entry = (u16)(*src) << 2; /* base in the metatile table */
      pr = with_prio ? 0 : lo_prio; /* lower layer: priority when a panorama is up */
      if (with_prio && prio_table[*src])
        pr = BG_PRIO;
      src++;
      for (by = (amy << 1) & 63; by <= ((amy << 1) & 63) + 1; by++)
      {
        for (bx = (amx << 1) & 63; bx <= ((amx << 1) & 63) + 1; bx++)
        {
          screen = (bx >> 5) + ((by >> 5) << 1);
          ofs = (screen << 10) + ((by & 31) << 5) + (bx & 31);
          bg_map_buffer[ofs] = mt_table[entry + ((by & 1) << 1) + (bx & 1)] | pr;
        }
      }
    }
  }

  dmaCopyVram((u8 *)bg_map_buffer, vram, 4096 * 2);
}

void map_init(void)
{
  /* Panorama: the lower layer switches to priority so it covers the
     low-priority BG1 pattern behind it — except on erased tiles, which
     let the panorama show. 0 leaves the rendering unchanged. */
  lo_prio = effect_is_back() ? BG_PRIO : 0;
  win_x = map_win_target(camera.x, scene_ctx.map_w);
  win_y = map_win_target(camera.y, scene_ctx.map_h);
  vn_cancel(VN_MAPC); /* a burst planned for the OLD scene must not
                         land on the new one's freshly-filled maps */
  vn_cancel(VN_MAPR);

  map_fill_layer(scene_ctx.tilemap, VRAM_BG2_MAP, 0);
  /* Effect layer: the BG1 map region carries the pattern. The upper
     layer does not exist in those scenes — do NOT write there. */
  if (!effect_active())
    map_fill_layer(scene_ctx.tilemap_upper, VRAM_BG1_MAP, 1);
}

/* Prepares metatile column mx (rows win_y..win_y+31), both layers */
static void map_queue_col(u16 mx)
{
  u16 my, y, pr;
  const u8 *src = scene_ctx.tilemap + win_y * (u16)scene_ctx.map_w + mx;
  const u8 *usrc = scene_ctx.tilemap_upper + win_y * (u16)scene_ctx.map_w + mx;

  /* The buffers below are the WRAM the published burst reads: kill an
     in-flight descriptor BEFORE the first write (the ISR can interrupt
     this very loop), then publish the fresh one LAST. */
  vn_cancel(VN_MAPC);
  for (my = 0; my < WIN_H; my++)
  {
    const u16 *mt;
    const u16 *um;

    y = ((win_y + my) << 1) & 63; /* even, so y+1 <= 63 */
    if (win_y + my >= scene_ctx.map_h)
    {
      /* off-map (height < window): char 0, never visible */
      col_lo[0][y] = 0;
      col_lo[0][y + 1] = 0;
      col_lo[1][y] = 0;
      col_lo[1][y + 1] = 0;
      col_up[0][y] = 0;
      col_up[0][y + 1] = 0;
      col_up[1][y] = 0;
      col_up[1][y + 1] = 0;
      continue;
    }
    mt = mt_table + ((u16)(*src) << 2);
    um = mt_table + ((u16)(*usrc) << 2);
    pr = prio_table[*usrc] ? BG_PRIO : 0;
    col_lo[0][y] = mt[0] | lo_prio;     /* TL */
    col_lo[0][y + 1] = mt[2] | lo_prio; /* BL */
    col_lo[1][y] = mt[1] | lo_prio;     /* TR */
    col_lo[1][y + 1] = mt[3] | lo_prio; /* BR */
    col_up[0][y] = um[0] | pr;
    col_up[0][y + 1] = um[2] | pr;
    col_up[1][y] = um[1] | pr;
    col_up[1][y + 1] = um[3] | pr;
    src += scene_ctx.map_w;
    usrc += scene_ctx.map_w;
  }
  col_vram_x = (mx << 1) & 63;
  /* The transfer plan is built HERE, outside the VBlank window: the
     VBlank block only has to fire it. BG1 comes LAST — the effect layer
     stops at the fourth transfer. */
  map_plan_col(VJ_MAP_COL + 0, VRAM_BG2_MAP, col_vram_x, col_lo[0]);
  map_plan_col(VJ_MAP_COL + 2, VRAM_BG2_MAP, col_vram_x + 1, col_lo[1]);
  map_plan_col(VJ_MAP_COL + 4, VRAM_BG1_MAP, col_vram_x, col_up[0]);
  map_plan_col(VJ_MAP_COL + 6, VRAM_BG1_MAP, col_vram_x + 1, col_up[1]);
  /* When the effect layer runs, the BG1 VRAM region carries the
     pattern and not the upper layer: the plan's last four transfers
     are exactly the BG1 ones, so the burst stops before them. The
     state is per SCENE — stable between publish and fire. */
  if (effect_active())
    vn_publish_burst(VN_MAPC, VJ_MAP_COL, 4, VJ_INC32,
                     VBL_COST_MAPHALF(4));
  else
    vn_publish_burst(VN_MAPC, VJ_MAP_COL, 8, VJ_INC32,
                     VBL_COST_MAPHALF(8));
}

/* Prepares metatile row my (columns win_x..win_x+31), both layers */
static void map_queue_row(u16 my)
{
  u16 mx, x, pr;
  const u8 *src = scene_ctx.tilemap + my * (u16)scene_ctx.map_w + win_x;
  const u8 *usrc = scene_ctx.tilemap_upper + my * (u16)scene_ctx.map_w + win_x;

  vn_cancel(VN_MAPR); /* same WRAM rule as map_queue_col */
  for (mx = 0; mx < WIN_W; mx++)
  {
    const u16 *mt;
    const u16 *um;

    x = ((win_x + mx) << 1) & 63;
    if (win_x + mx >= scene_ctx.map_w)
    {
      /* off-map (width < window): char 0, never visible */
      row_lo[0][x] = 0;
      row_lo[0][x + 1] = 0;
      row_lo[1][x] = 0;
      row_lo[1][x + 1] = 0;
      row_up[0][x] = 0;
      row_up[0][x + 1] = 0;
      row_up[1][x] = 0;
      row_up[1][x + 1] = 0;
      continue;
    }
    mt = mt_table + ((u16)(*src) << 2);
    um = mt_table + ((u16)(*usrc) << 2);
    pr = prio_table[*usrc] ? BG_PRIO : 0;
    row_lo[0][x] = mt[0] | lo_prio;     /* TL */
    row_lo[0][x + 1] = mt[1] | lo_prio; /* TR */
    row_lo[1][x] = mt[2] | lo_prio;     /* BL */
    row_lo[1][x + 1] = mt[3] | lo_prio; /* BR */
    row_up[0][x] = um[0] | pr;
    row_up[0][x + 1] = um[1] | pr;
    row_up[1][x] = um[2] | pr;
    row_up[1][x + 1] = um[3] | pr;
    src++;
    usrc++;
  }
  row_vram_y = (my << 1) & 63;
  map_plan_row(VJ_MAP_ROW + 0, VRAM_BG2_MAP, row_vram_y, row_lo[0]);
  map_plan_row(VJ_MAP_ROW + 2, VRAM_BG2_MAP, row_vram_y + 1, row_lo[1]);
  map_plan_row(VJ_MAP_ROW + 4, VRAM_BG1_MAP, row_vram_y, row_up[0]);
  map_plan_row(VJ_MAP_ROW + 6, VRAM_BG1_MAP, row_vram_y + 1, row_up[1]);
  if (effect_active())
    vn_publish_burst(VN_MAPR, VJ_MAP_ROW, 4, VJ_INC1,
                     VBL_COST_MAPHALF(4));
  else
    vn_publish_burst(VN_MAPR, VJ_MAP_ROW, 8, VJ_INC1,
                     VBL_COST_MAPHALF(8));
}

void map_update(void)
{
  u16 tx = map_win_target(camera.x, scene_ctx.map_w);
  u16 ty = map_win_target(camera.y, scene_ctx.map_h);

  /* At most one step per frame and per axis — guaranteed, the camera
     moves 1 px per frame. Both windows are updated BEFORE the buffers
     are prepared, so column and row cover the final window. */
  if (ty > win_y)
  {
    win_y++;
    map_queue_row(win_y + WIN_H - 1);
  }
  else if (ty < win_y)
  {
    win_y--;
    map_queue_row(win_y);
  }

  if (tx > win_x)
  {
    win_x++;
    map_queue_col(win_x + WIN_W - 1);
  }
  else if (tx < win_x)
  {
    win_x--;
    map_queue_col(win_x);
  }
}

/* Queues the TWO vertical segments of a char column. Top screen is rows
   0-31, bottom screen rows 32-63; the VRAM address advances by 32 words
   between two rows. */
static void map_plan_col(u16 j, u16 base_vram, u16 bx, u16 *buf)
{
  u16 base = base_vram + ((bx >> 5) << 10) + (bx & 31);

  vj_set(j, (const u8 *)&buf[0], base, 32 * 2);
  vj_set(j + 1, (const u8 *)&buf[32], base + (2 << 10), 32 * 2);
}

/* Same for a char row: 2 horizontal segments (left screen, right
   screen), consecutive words. */
static void map_plan_row(u16 j, u16 base_vram, u16 by, u16 *buf)
{
  u16 base = base_vram + (((by >> 5) << 1) << 10) + ((by & 31) << 5);

  vj_set(j, (const u8 *)&buf[0], base, 32 * 2);
  vj_set(j + 1, (const u8 *)&buf[32], base + (1 << 10), 32 * 2);
}

/* The bursts fire from the DISPATCHER since V-NMI V3 (vblnmi.c): the
   map lanes walk FIRST in its table — a screen edge coming into view
   is still the priority transfer — and a full column (cost 14) fits
   the ISR's cap, so on most frames the edge lands at ~line 227
   instead of fighting the tail's leftovers. Column and row are
   separate descriptors: when the window is short, posting one beats
   posting neither, and what is not transferred stays published and
   comes back — the pending flags became the descriptors' tokens. */
