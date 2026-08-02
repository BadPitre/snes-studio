/*
 * m7.c — the Mode 7 screen (M7-A).
 *
 * VRAM PLAN while the screen is up. Mode 7 interleaves: for each word of
 * $0000-$3FFF the LOW byte is a tilemap entry and the HIGH byte is
 * character data. 16 KB of map (128x128 entries of one byte) plus 16 KB
 * of chars (256 patterns of 64 bytes), in the same address range.
 * $4000+ — the OBJ region — is untouched, which is what lets the
 * vignettes and the animation player keep running over the plane.
 *
 * THE UPLOAD is two passes with two VMAIN settings, which is exactly
 * what PVSnesLib's dmaCopyVram7 exists for: dmacontrol = (BBAD << 8) |
 * DMAP, so $1900 writes the high bytes through $2119 and $1800 the low
 * bytes through $2118. Proved byte-for-byte by the M7-0 spike against a
 * VRAM dump.
 *
 * THE MAP IS STORED COMPACT (wt x ht) and expanded here: the plane is
 * cleared to tile 0 and the image's rows are written into it one DMA
 * each. Storing the whole 128x128 plane would be 16 KB of mostly zeroes
 * per image in ROM.
 *
 * THE ZOOM is a table compiled by datagen — one 8.8 value per frame, fed
 * straight to M7A/M7D. No division at run time: the scale register wants
 * the RECIPROCAL of the zoom, and computing that per frame is exactly
 * what P4/P5/P6 spent their effort removing.
 *
 * B AND C ARE ZEROED at open and never touched again. setMode7Scale does
 * not clear them and a stale value shears the plane — a spike finding,
 * not a deduction.
 */
#include <snes.h>
#include "m7.h"
#include "picture.h"
#include "stage.h"
#include "screenfx.h"
#include "vignette.h"

/* mode 7 register (data_mode7.c — always emitted) */
extern const u8 m7_img_count;
extern const u8 *const m7_img_chars[];
extern const u16 *const m7_img_chars_sizes[];
extern const u8 *const m7_img_maps[];
extern const u16 *const m7_img_pals[];
extern const u8 m7_img_wt[];
extern const u8 m7_img_ht[];
/* world maps (data_m7world.c — always emitted) */
extern const u8 m7w_count;
extern const u8 m7w_scene[];
extern const u8 *const m7w_chars[];
extern const u16 *const m7w_chars_sizes[];
extern const u8 *const m7w_metas[];
extern const u8 *const m7w_maps[];
extern const u16 *const m7w_pals[];
extern const u8 m7w_w[];
extern const u8 m7w_h[];

extern const u8 m7_ramp_count;
extern const u16 *const m7_ramps[];
extern const u8 m7_ramp_lens[];

extern u8 videoMode; /* PVSnesLib mirror of REG_TM */

#define M7_TM 0x11    /* BG1 + OBJ — Mode 7 has no other layer */
#define M7_TM_GAME 0x17
#define M7_PLANE 128  /* the plane, in tiles */
#define M7_SCALE_ONE 0x0100 /* 8.8: 1:1 */

static u8 m7_on = 0;
static u8 m7_req = 0; /* 0 nothing, 1 open, 2 close */
static u8 m7_req_img = 0;
static u8 m7_req_dur = 0;
static u8 m7_close = 0; /* the loop must run the internal warp */

/* Current zoom ramp. rp_id 0xFF means none: the scale then stays where
   the last ramp left it, which is what makes "zoom in, hold, close"
   expressible without a second command. */
static u8 rp_id = 0xFF;
static u8 rp_pos = 0;
static u8 rp_loop = 0;
static u16 rp_scale = M7_SCALE_ONE;
static u8 rp_dirty = 0; /* the matrix must go out this VBlank */

/* Rotation centre, in plane pixels — the middle of the image. */
static u16 m7_cx = 0;
static u16 m7_cy = 0;

u8 m7_active(void)
{
  return m7_on;
}

u8 m7_busy(void)
{
  return m7_on && rp_id != 0xFF && !rp_loop;
}

void m7_request_open(u8 img, u8 dur)
{
  m7_req = 1;
  m7_req_img = img;
  m7_req_dur = dur;
}

void m7_request_close(u8 dur)
{
  m7_req = 2;
  m7_req_dur = dur;
}

void m7_zoom(u8 ramp, u8 flags)
{
  if (!m7_on)
    return;
  if (ramp == M7_ZOOM_STOP || ramp >= m7_ramp_count || !m7_ramp_lens[ramp])
  {
    rp_id = 0xFF; /* stop where we are — the scale is kept */
    return;
  }
  rp_id = ramp;
  rp_pos = 0;
  rp_loop = flags & M7_ZOOM_LOOP;
  rp_scale = m7_ramps[ramp][0];
  rp_dirty = 1;
}

/* Writes the whole matrix. Every register is a WRITE-TWICE pair. */
static void m7_matrix(u16 s)
{
  REG_M7A = (u8)(s & 0xFF);
  REG_M7A = (u8)(s >> 8);
  REG_M7B = 0;
  REG_M7B = 0;
  REG_M7C = 0;
  REG_M7C = 0;
  REG_M7D = (u8)(s & 0xFF);
  REG_M7D = (u8)(s >> 8);
}

/* Centre and scroll, so the zoom happens AROUND the image instead of
   dragging it off the top-left corner: the rotation centre sits on the
   middle of the image and the scroll brings that point to the middle of
   the screen (128, 112). */
static void m7_place(void)
{
  u16 hofs = m7_cx - 128;
  u16 vofs = m7_cy - 112;

  REG_M7X = (u8)(m7_cx & 0xFF);
  REG_M7X = (u8)(m7_cx >> 8);
  REG_M7Y = (u8)(m7_cy & 0xFF);
  REG_M7Y = (u8)(m7_cy >> 8);
  REG_M7HOFS = (u8)(hofs & 0xFF);
  REG_M7HOFS = (u8)(hofs >> 8);
  REG_M7VOFS = (u8)(vofs & 0xFF);
  REG_M7VOFS = (u8)(vofs >> 8);
}

static void m7_fade_out(u8 dur)
{
  u16 step, lvl, f;

  if (!dur)
    return;
  step = 0x0F00 / dur;
  lvl = 0x0F00;
  for (f = 0; f < dur; f++)
  {
    lvl = lvl > step ? lvl - step : 0;
    WaitForVBlank();
    REG_INIDISP = (u8)(lvl >> 8);
  }
}

static void m7_fade_in(u8 dur)
{
  u16 step, lvl, f;

  if (!dur)
  {
    REG_INIDISP = 0x0F;
    return;
  }
  step = 0x0F00 / dur;
  lvl = 0;
  for (f = 0; f < dur; f++)
  {
    lvl += step;
    WaitForVBlank();
    REG_INIDISP = (u8)(lvl >> 8 > 0x0F ? 0x0F : lvl >> 8);
  }
  REG_INIDISP = 0x0F;
}

static void m7_open(void)
{
  u8 id = m7_req_img;
  u8 wt, ht, ty;
  u16 zero;

  if (id >= m7_img_count)
    return; /* nothing to show: leave the scene alone */
  m7_fade_out(m7_req_dur);
  setScreenOff();
  picture_reset(); /* an image is showing: Mode 7 takes over */
  stage_reset();   /* likewise a composed screen */
  m7_on = 1;
  rp_id = 0xFF;
  rp_scale = M7_SCALE_ONE;
  rp_dirty = 0;

  /* The scene's sprites go away; the vignettes come back below. */
  for (ty = 0; ty < 128; ty++)
    oamSetVisible((u16)(ty << 2), OBJ_HIDE);

  REG_BGMODE = 0x07;
  videoMode = M7_TM;
  REG_TM = M7_TM;
  REG_TS = 0;
  screenfx_cm_hold(0);

  /* Clear BOTH bytes of $0000-$3FFF first: the chars then fill the high
     bytes and the image's rows the low ones, so every map cell not
     written stays tile 0 — no separate fill pass for the plane. */
  zero = 0;
  dmaFillVram16(&zero, 0x0000, 0x4000);

  wt = m7_img_wt[id];
  ht = m7_img_ht[id];
  dmaCopyVram7((u8 *)m7_img_chars[id], 0x0000, *m7_img_chars_sizes[id], 0x80,
               0x1900);
  for (ty = 0; ty < ht; ty++)
    dmaCopyVram7((u8 *)m7_img_maps[id] + (u16)ty * wt,
                 (u16)ty * M7_PLANE, wt, 0x00, 0x1800);
  /* 128 colours: CGRAM 0-127. 128-255 stays the sprites' — that is what
     keeps the vignettes usable over the plane. */
  dmaCopyCGram((u8 *)m7_img_pals[id], 0, 256);

  /* Outside the 128x128 tile area, show tile 0 rather than wrapping:
     zooming out past the plane then gives a clean border instead of a
     repeated image. */
  REG_M7SEL = M7_OUTTILE;
  m7_cx = (u16)wt << 2; /* wt * 8 / 2 */
  m7_cy = (u16)ht << 2;
  m7_place();
  m7_matrix(rp_scale);

  screenfx_warp_reset();
  vig_reload(); /* the upload overwrote CGRAM; the OBJ chars survived */
  setScreenOn();
  m7_fade_in(m7_req_dur);
}

/* One row of the plane, built in WRAM then pushed. 128 tiles wide, the
   full plane width, so a row is one DMA whatever the map's size. */
static u8 wrow[M7_PLANE];

/* Opens a world map scene on the plane. Returns 1 when it took over, so
   the caller skips the ordinary scene path. The camera is still fixed at
   the map's centre — see PLANNING_SYSTEME_MODE7 §7.2 for what follows. */
u8 m7_world_open(u8 scene_id, u8 dur)
{
  u8 i, w, h, bx, by, half;
  const u8 *meta;
  const u8 *map;
  u16 zero;

  for (i = 0; i < m7w_count; i++)
    if (m7w_scene[i] == scene_id)
      break;
  if (i >= m7w_count)
    return 0; /* not a world map — the caller carries on normally */

  m7_fade_out(dur);
  setScreenOff();
  picture_reset();
  stage_reset();
  m7_on = 1;
  rp_id = 0xFF;
  rp_scale = M7_SCALE_ONE;
  rp_dirty = 0;

  for (bx = 0; bx < 128; bx++)
    oamSetVisible((u16)(bx << 2), OBJ_HIDE);

  REG_BGMODE = 0x07;
  videoMode = M7_TM;
  REG_TM = M7_TM;
  REG_TS = 0;
  screenfx_cm_hold(0);

  zero = 0;
  dmaFillVram16(&zero, 0x0000, 0x4000);
  dmaCopyVram7((u8 *)m7w_chars[i], 0x0000, *m7w_chars_sizes[i], 0x80, 0x1900);
  dmaCopyCGram((u8 *)m7w_pals[i], 0, 256);

  /* Expand blocks to tiles: each 16x16 block is two tiles wide and two
     tall, so a block row produces TWO plane rows — the top one from
     quadrants 0 and 1, the bottom from 2 and 3. */
  w = m7w_w[i];
  h = m7w_h[i];
  meta = m7w_metas[i];
  map = m7w_maps[i];
  for (by = 0; by < h; by++)
  {
    for (half = 0; half < 2; half++)
    {
      for (bx = 0; bx < M7_PLANE; bx++)
        wrow[bx] = 0;
      for (bx = 0; bx < w; bx++)
      {
        u16 b = (u16)map[(u16)by * w + bx] << 2;
        wrow[bx << 1] = meta[b + (half << 1)];
        wrow[(bx << 1) + 1] = meta[b + (half << 1) + 1];
      }
      dmaCopyVram7(wrow, (u16)(((u16)by << 1) + half) * M7_PLANE, M7_PLANE,
                   0x00, 0x1800);
    }
  }

  REG_M7SEL = M7_OUTTILE;
  /* Centre on the middle of the painted map, in plane pixels. */
  m7_cx = (u16)w << 3;
  m7_cy = (u16)h << 3;
  m7_place();
  m7_matrix(rp_scale);

  screenfx_warp_reset();
  vig_reload();
  setScreenOn();
  m7_fade_in(dur);
  return 1;
}

void m7_apply(void)
{
  u8 r = m7_req;

  m7_req = 0;
  if (r == 1)
    m7_open();
  else if (r == 2 && m7_on)
  {
    m7_fade_out(m7_req_dur);
    setScreenOff();
    m7_close = 1; /* the loop goes on to the internal warp */
  }
}

u8 m7_take_close(void)
{
  u8 c = m7_close;

  m7_close = 0;
  return c;
}

void m7_reset(void)
{
  if (!m7_on)
    return;
  /* Back to the game's mode BEFORE scene_load: it reloads the scenery
     into a VRAM plan that only makes sense outside Mode 7. */
  setMode(BG_MODE1, 0x08); /* the engine's normal mode (main.c) */
  videoMode = M7_TM_GAME;
  REG_TM = M7_TM_GAME;
  m7_on = 0;
  m7_req = 0;
  rp_id = 0xFF;
  /* Vignettes shown during the screen are part of its staging. */
  vig_hide(0);
  vig_hide(1);
  vig_hide(2);
  vig_hide(3);
}

void m7_update(void)
{
  const u16 *t;

  if (!m7_on || rp_id == 0xFF)
    return;
  t = m7_ramps[rp_id];
  rp_scale = t[rp_pos];
  rp_dirty = 1;
  rp_pos++;
  if (rp_pos >= m7_ramp_lens[rp_id])
  {
    if (rp_loop)
      rp_pos = 0;
    else
      rp_id = 0xFF; /* held on the last value — see m7_zoom */
  }
}

void m7_vblank(void)
{
  if (!m7_on || !rp_dirty)
    return;
  rp_dirty = 0;
  m7_matrix(rp_scale);
}
