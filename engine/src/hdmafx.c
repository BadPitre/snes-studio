/*
 * hdmafx.c — scripted HDMA effects: screen RIPPLE (S14) and SKY
 * GRADIENT (S15).
 *
 * Ripple: the HDMA rewrites the BG1/BG2 horizontal scrolls in bands of
 * scanlines from WRAM tables — the screen undulates (desert heat,
 * underwater, a dream). Non-blocking, persists across scenes until
 * WAVE 0 (the RM2003 ambience model).
 * Gradient: channel 4 rewrites the color math's fixed colour line by
 * line — a vertical tint (sunset sky, dawn).
 *
 * Reserved channels: 4 (COLDATA $2132, mode 00), 5 (BG2HOFS $210F) and
 * 6 (BG1HOFS $210D) in mode 02 (one register written twice — the
 * scrolls are double-write registers). NEVER channel 7: the PVSnesLib
 * NMI does the general OAM DMA there on every VBlank (vblank.asm
 * writes $4370-75) and overwrites the HDMA config — on an overrunning
 * frame the channel would start with the OAM settings (flat wave plus
 * stray writes, seen on the rain+wave combination).
 * THIS MODULE IS THE SOLE OWNER of $420C (HDMAEN): the HDMA effects
 * compose a single mask (the spotlight will be added HERE). The
 * channels are reprogrammed on EVERY VBlank (robust against general
 * DMAs).
 *
 * Tables: 14 entries of [count=16][lo][hi] + terminator — one sine step
 * per band, the phase advancing every frame. The table folds in each
 * layer's scroll BASE (camera + shake for the scenery, pattern drift
 * for the effect layer): the HDMA writes ABSOLUTE values. Rebuilt every
 * frame: 14 iterations, no division and no multiplication (the S6 panel
 * lesson — a tight budget, see WV_BANDS).
 *
 * The sine table is a MATHEMATICAL CONSTANT of the engine (like the
 * register masks) — not game data.
 */
#include <snes.h>
#include "hdmafx.h"
#include "camera.h"
#include "screenfx.h"
#include "effectlayer.h"
#include "player.h" /* the spotlight (S16) follows the hero */

/* registers of channels 3 / 4 / 5 / 6 (7 belongs to the NMI's OAM
   DMA) */
#define DMAP3 (*(vuint8 *)0x4330)
#define BBAD3 (*(vuint8 *)0x4331)
#define A1T3L (*(vuint8 *)0x4332)
#define A1T3H (*(vuint8 *)0x4333)
#define A1B3 (*(vuint8 *)0x4334)
#define DMAP4 (*(vuint8 *)0x4340)
#define BBAD4 (*(vuint8 *)0x4341)
#define A1T4L (*(vuint8 *)0x4342)
#define A1T4H (*(vuint8 *)0x4343)
#define A1B4 (*(vuint8 *)0x4344)
#define DMAP5 (*(vuint8 *)0x4350)
#define BBAD5 (*(vuint8 *)0x4351)
#define A1T5L (*(vuint8 *)0x4352)
#define A1T5H (*(vuint8 *)0x4353)
#define A1B5 (*(vuint8 *)0x4354)
#define DMAP6 (*(vuint8 *)0x4360)
#define BBAD6 (*(vuint8 *)0x4361)
#define A1T6L (*(vuint8 *)0x4362)
#define A1T6H (*(vuint8 *)0x4363)
#define A1B6 (*(vuint8 *)0x4364)

/* 64-step sine, 0..64 (32 = centre) — a mathematical constant */
static const u8 wv_sin[64] = {
    32, 35, 38, 41, 44, 47, 49, 52, 54, 56, 58, 60, 61, 62, 63, 63,
    64, 63, 63, 62, 61, 60, 58, 56, 54, 52, 49, 47, 44, 41, 38, 35,
    32, 28, 25, 22, 19, 16, 14, 11, 9,  7,  5,  3,  2,  1,  0,  0,
    0,  0,  0,  1,  2,  3,  5,  7,  9,  11, 14, 16, 19, 22, 25, 28};

#define WV_BANDS 14 /* 224 lines in bands of 16 — measured on the S6
   panel: 56 iterations = 30 FPS on its own, 28 = 60 alone but 30 once
   the rain is added; 14 gives the margin back (the swell stays gentle,
   no more than 3 px between neighbouring bands at full amplitude) */
#define WV_LINES 16 /* height of a band (HDMA count) */
#define WV_STEP 6   /* phase step per band (64 steps ~= 2 screens) */

static u8 wv_pow = 0;
static u8 wv_spd = 1;
static u8 wv_phase = 0;
static u8 wv_hdr = 0; /* table headers laid down (once) */
static u8 hx_on = 0;  /* HDMAEN mask currently armed */
static u8 wv_t1[WV_BANDS * 3 + 1]; /* BG1: [count][lo][hi] per band + 0 */
static u8 wv_t2[WV_BANDS * 3 + 1]; /* BG2 */
/* PRECOMPUTED offsets (sin x amplitude, >>5) — built in hdmafx_wave: the
   per-frame rebuild does NO multiplication at all (56 software mults per
   frame = 21 FPS measured on the S6 panel, lesson learned). 256 entries
   (4 copies of the 64-step cycle): the u8 phase indexes WITHOUT a
   `& 63` mask — every cycle counts in the loaded loops */
static u8 wv_off[256];

void hdmafx_wave(u8 power, u8 speed)
{
  u16 i;

  wv_pow = power > 7 ? 7 : power;
  wv_spd = speed == 0 ? 1 : (speed > 8 ? 8 : speed);
  for (i = 0; i < 256; i++)
    wv_off[i] = (u8)(((u16)wv_sin[i & 63] * wv_pow) >> 5);
  if (!wv_hdr)
  {
    wv_hdr = 1;
    for (i = 0; i < WV_BANDS; i++)
    {
      wv_t1[i * 3] = WV_LINES;
      wv_t2[i * 3] = WV_LINES;
    }
    wv_t1[WV_BANDS * 3] = 0;
    wv_t2[WV_BANDS * 3] = 0;
  }
}

/* spotlight (S16) — defined below, used by hdmafx_update */
static u8 sp_rad;
static u8 sp_phase = 0; /* 0 = idle, 1 = bottom half still to do */
static void sp_build_high(void);
static void sp_build_low(void);

void hdmafx_update(void)
{
  u16 i, o, v1, v2;
  u16 b1, b2;
  u8 ph;
  u8 *q1;
  u8 *q2;

  if (wv_pow)
  {
    wv_phase += wv_spd;
    b2 = camera.x + screenfx_shake_x();
    b1 = effect_active() ? effect_hofs() : b2;
    b1 -= wv_pow; /* the -amplitude leaves the loop */
    b2 -= wv_pow;
    ph = wv_phase;
    q1 = wv_t1 + 1;
    q2 = wv_t2 + 1;
    for (i = 0; i < WV_BANDS; i++)
    {
      /* offset 0..2*power around the base — precomputed table, the u8
         phase used as a direct index: no division, no multiplication
         and no mask (frame budget of the loaded loops, S6 panel) */
      o = wv_off[ph];
      v1 = b1 + o;
      v2 = b2 + o;
      q1[0] = (u8)v1;
      q1[1] = (u8)(v1 >> 8);
      q2[0] = (u8)v2;
      q2[1] = (u8)(v2 >> 8);
      q1 += 3;
      q2 += 3;
      ph += WV_STEP; /* one swell step per band */
    }
  }
  if (sp_rad && screenfx_spot_active())
  {
    /* spotlight: the rebuild is SPREAD over TWO frames (top half then
       bottom half, the centre frozen — the circle is at most 2-3 px
       behind the hero, invisible) and only when the hero or the camera
       has moved. Standing still: zero cost. Rebuilding in a single pass
       dropped walking from 60 to 30 FPS (S6 panel). */
    if (sp_phase)
      sp_build_low();
    else
      sp_build_high();
  }
}

/*
 * Sky gradient (S15): a VERTICAL TINT — channel 4 rewrites the fixed
 * colour ($2132) line by line (mode 0, one byte per entry) from a
 * STATIC run-length table built HERE when the command runs: zero CPU
 * cost per frame. One entry per CHANGE of an R/G/B channel (<= 31 steps
 * per channel), the stable ranges are skipped through the count field.
 * CGWSEL/CGADSUB stay screenfx's property (the gradient's mode lives
 * there — the same circuit as the tint, which cancels it).
 */
static u8 gr_tr = 0, gr_tg = 0, gr_tb = 0; /* colour at the TOP */
static u8 gr_br = 0, gr_bg = 0, gr_bb = 0; /* colour at the BOTTOM */
static u8 gr_tab[256]; /* <= ~100 entries of [count][sel|val] + 0 */
static u8 *gr_q;       /* write cursor (construction) */
static u8 *gr_cnt;     /* count byte of the open entry */
static u8 gr_run;      /* lines covered by the open entry */

/* closes the open entry — splits ranges over 127 lines (the limit of the
   HDMA count field outside repeat mode) into padding entries */
static void gr_close(void)
{
  u8 v;

  while (gr_run > 127)
  {
    v = gr_cnt[1];
    *gr_cnt = 127;
    gr_run -= 127;
    gr_cnt = gr_q;
    gr_q[1] = v;
    gr_q += 2;
  }
  *gr_cnt = gr_run;
  gr_run = 0;
}

static void gr_emit(u8 byte)
{
  if (gr_cnt)
    gr_close();
  gr_cnt = gr_q;
  gr_q[1] = byte;
  gr_q += 2;
}

/* 8.8 step of a channel from top to bottom — same workaround as tg_step
   (no signed steps): magnitude + direction. Divisions AT command time. */
static u16 gr_step(u8 top, u8 bot, u8 *neg)
{
  if (bot >= top)
  {
    *neg = 0;
    return ((u16)(bot - top) << 8) / 224;
  }
  *neg = 1;
  return ((u16)(top - bot) << 8) / 224;
}

void hdmafx_grad_top(u8 r, u8 g, u8 b)
{
  gr_tr = r & 31;
  gr_tg = g & 31;
  gr_tb = b & 31;
}

void hdmafx_grad_bottom(u8 r, u8 g, u8 b)
{
  gr_br = r & 31;
  gr_bg = g & 31;
  gr_bb = b & 31;
}

void hdmafx_grad(u8 mode)
{
  u16 ar, ag, ab, sr, sg, sb;
  u8 nr, ng, nb; /* step direction (1 = decreasing) */
  u8 lr, lg, lb; /* last value emitted per channel */
  u8 v;
  u16 line;

  if (mode == 0 || mode > 2)
  {
    screenfx_skygrad(0); /* channel 4 cut at the next VBlank */
    return;
  }
  ar = (u16)gr_tr << 8;
  ag = (u16)gr_tg << 8;
  ab = (u16)gr_tb << 8;
  sr = gr_step(gr_tr, gr_br, &nr);
  sg = gr_step(gr_tg, gr_bg, &ng);
  sb = gr_step(gr_tb, gr_bb, &nb);
  gr_q = gr_tab;
  gr_cnt = 0;
  gr_run = 0;
  lr = 255; /* invalid: forces all 3 channels at the top of the screen */
  lg = 255;
  lb = 255;
  for (line = 0; line < 224; line++)
  {
    /* ONE COLDATA write per line (mode 0): a channel changing on the same
       line as another is pushed one line down — invisible */
    v = (u8)(ar >> 8);
    if (v != lr)
    {
      gr_emit(0x20 | v);
      lr = v;
    }
    else
    {
      v = (u8)(ag >> 8);
      if (v != lg)
      {
        gr_emit(0x40 | v);
        lg = v;
      }
      else
      {
        v = (u8)(ab >> 8);
        if (v != lb)
        {
          gr_emit(0x80 | v);
          lb = v;
        }
      }
    }
    gr_run++;
    ar = nr ? ar - sr : ar + sr;
    ag = ng ? ag - sg : ag + sg;
    ab = nb ? ab - sb : ab + sb;
  }
  gr_close();
  *gr_q = 0; /* terminator */
  screenfx_skygrad(mode); /* arms the circuit (and replaces the tint) */
}

/*
 * Spotlight (S16): a circle of light around the hero — channel 3
 * rewrites WH0/WH1 ($2126-27, mode 1: two adjacent registers) line by
 * line to trace the circle of the W1 colour window; screenfx darkens
 * the scenery OUTSIDE the window (the same circuit as the tint). The
 * circle's half-widths are precomputed AT COMMAND TIME (incremental
 * method, no multiplication and no square root); the table is rebuilt
 * ONLY when the hero or the camera moves — standing still, the
 * spotlight costs NOTHING per frame.
 */
#define SP_RMAX 96 /* max radius: the circle fits in the 224 lines */

/* sp_rad (radius, 0 = never commanded) is declared further up, above
   hdmafx_update which uses it */
static u8 sp_hw[SP_RMAX + 1]; /* half-width of the circle per |dy| */
static u16 sp_cx = 0xFFFF;    /* centre of the last table built */
static u16 sp_cy = 0xFFFF;
static u8 sp_tab[SP_RMAX * 6 + 24]; /* [1][WH0][WH1] per line of the
   circle (2r+1 max) + empty bands [count][255][0] + terminator */

void hdmafx_spot(u8 radius, u8 dark)
{
  u16 t, w2;
  u8 dy, w;

  sp_phase = 0; /* a command mid-build starts over from zero */
  if (radius == 0)
  {
    screenfx_spot(0); /* channel 3 cut at the next VBlank */
    return;
  }
  if (radius < 16)
    radius = 16;
  if (radius > SP_RMAX)
    radius = SP_RMAX;
  sp_rad = radius;
  /* half-widths: w = floor of sqrt(r^2 - dy^2), maintained by
     DIFFERENCES (t loses 2dy+1 per line, w^2 loses 2w-1 per step) — no
     multiplication and no square root; r^2 by additions (once, at
     command time) */
  t = 0;
  for (dy = 0; dy < radius; dy++)
    t += radius;
  w2 = t;
  w = radius;
  for (dy = 0; dy <= radius; dy++)
  {
    while (w2 > t && w)
    {
      w2 -= (u16)(w << 1) - 1;
      w--;
    }
    sp_hw[dy] = w;
    t -= ((u16)dy << 1) + 1;
  }
  sp_cx = 0xFFFF; /* forces a rebuild on the next frame */
  sp_cy = 0xFFFF;
  screenfx_spot(dark ? dark : 31);
}

/* Rebuilding the WH0/WH1 table is SPREAD over TWO frames:
   sp_build_high (the dark band on top + the circle's top half) then
   sp_build_low (the bottom half + the bottom band + the terminator),
   with the centre FROZEN between the two (sp_cx/sp_cy) so the table
   stays coherent. The camera centres the hero: in the common case the
   circle does not touch the edges -> FAST PATH in pure u8 arithmetic,
   no clamps, half-widths by POINTER. Rebuilding in a single pass
   (97 lines + indexed clamps) dropped walking from 60 to 30 FPS —
   the S6 panel lesson. */
static u8 *sp_q;    /* write cursor between the two phases */
static u16 sp_line; /* screen line reached by the top phase */

static void sp_build_high(void)
{
  u16 cx, cy, top, l, r;
  u16 line;
  u8 n, w, c8;
  u8 *q;
  u8 *hw;

  cx = player.x - camera.x + 8; /* centre of the 16x24 metasprite */
  cy = player.y - camera.y + 12;
  if (cx == sp_cx && cy == sp_cy)
    return;
  sp_cx = cx;
  sp_cy = cy;
  q = sp_tab;
  top = cy - sp_rad; /* u16 wrap if the circle runs off the top */
  line = 0;
  if (top < 224) /* no wrap: dark band above the circle */
    while (line < top)
    {
      n = (u8)(top - line) > 127 ? 127 : (u8)(top - line);
      q[0] = n;
      q[1] = 255; /* empty window: everything is "outside" -> dark */
      q[2] = 0;
      q += 3;
      line += n;
    }
  /* the circle in BANDS OF 2 LINES ([count=2][WH0][WH1]): half the
     entries — the 2 px step on the mask's edge is invisible, and the
     frame budget holds (S6 panel) */
  if (cx >= sp_rad && cx + sp_rad <= 255)
  {
    /* fast path: cx ± hw stays inside 0-255 — everything in u8 */
    c8 = (u8)cx;
    hw = sp_hw + (u8)(cy - line); /* dy of the first row */
    while (line < cy)
    {
      w = *hw;
      n = (u8)(cy - line) >= 2 ? 2 : 1;
      hw -= n;
      q[0] = n;
      q[1] = c8 - w;
      q[2] = c8 + w;
      q += 3;
      line += n;
    }
  }
  else
  {
    /* near a map edge: clamps (rare — the camera is against a stop) */
    while (line < cy)
    {
      w = sp_hw[cy - line];
      l = cx - w;
      if (l > 255) /* u16 wrap: left edge off screen */
        l = 0;
      r = cx + w;
      if (r > 255)
        r = 255;
      n = (u8)(cy - line) >= 2 ? 2 : 1;
      q[0] = n;
      q[1] = (u8)l;
      q[2] = (u8)r;
      q += 3;
      line += n;
    }
  }
  sp_q = q;
  sp_line = line;
  sp_phase = 1; /* the bottom half follows on the next frame */
}

static void sp_build_low(void)
{
  u16 cx, cy, bot, l, r;
  u16 line;
  u8 n, w, c8;
  u8 *q;
  u8 *hw;

  cx = sp_cx; /* centre FROZEN by the top phase */
  cy = sp_cy;
  q = sp_q;
  line = sp_line;
  bot = cy + sp_rad;
  if (bot > 223)
    bot = 223;
  if (cx >= sp_rad && cx + sp_rad <= 255)
  {
    c8 = (u8)cx;
    hw = sp_hw; /* dy = 0 on the centre line */
    while (line <= bot)
    {
      w = *hw;
      n = (u16)(bot - line) >= 1 ? 2 : 1; /* bands of 2 lines */
      hw += n;
      q[0] = n;
      q[1] = c8 - w;
      q[2] = c8 + w;
      q += 3;
      line += n;
    }
  }
  else
  {
    while (line <= bot)
    {
      w = sp_hw[line - cy];
      l = cx - w;
      if (l > 255)
        l = 0;
      r = cx + w;
      if (r > 255)
        r = 255;
      n = (u16)(bot - line) >= 1 ? 2 : 1;
      q[0] = n;
      q[1] = (u8)l;
      q[2] = (u8)r;
      q += 3;
      line += n;
    }
  }
  while (line < 224) /* dark band below the circle */
  {
    n = (u8)(224 - line) > 127 ? 127 : (u8)(224 - line);
    q[0] = n;
    q[1] = 255;
    q[2] = 0;
    q += 3;
    line += n;
  }
  *q = 0; /* terminator */
  sp_phase = 0;
}

void hdmafx_vblank(void)
{
  u16 a;
  u8 m = 0;

  if (wv_pow)
  {
    DMAP6 = 0x02; /* one register, written twice (scroll double write) */
    BBAD6 = 0x0D; /* BG1HOFS */
    a = (u16)(u8 *)wv_t1;
    A1T6L = (u8)a;
    A1T6H = (u8)(a >> 8);
    A1B6 = 0x7E;
    DMAP5 = 0x02;
    BBAD5 = 0x0F; /* BG2HOFS */
    a = (u16)(u8 *)wv_t2;
    A1T5L = (u8)a;
    A1T5H = (u8)(a >> 8);
    A1B5 = 0x7E;
    m = 0x60;
  }
  if (screenfx_skygrad_mode() && !screenfx_cm_held() &&
      !screenfx_flash_active())
  {
    /* sky gradient: cut when a blend holds the circuit or a flash
       borrows it (screenfx writes COLDATA on those frames) */
    DMAP4 = 0x00; /* one register, one byte per entry */
    BBAD4 = 0x32; /* COLDATA */
    a = (u16)(u8 *)gr_tab;
    A1T4L = (u8)a;
    A1T4H = (u8)(a >> 8);
    A1B4 = 0x7E;
    m |= 0x10;
  }
  if (sp_rad && screenfx_spot_active() && !screenfx_cm_held())
  {
    /* spotlight: the WH0/WH1 circle — inert during a flash (CGWSEL puts
       the window on "never": the whole screen flashes), cut under a
       blend, like the tint */
    DMAP3 = 0x01; /* two adjacent registers ($2126 then $2127) */
    BBAD3 = 0x26; /* WH0 */
    a = (u16)(u8 *)sp_tab;
    A1T3L = (u8)a;
    A1T3H = (u8)(a >> 8);
    A1B3 = 0x7E;
    m |= 0x08;
  }
  /* scripted wipe (S18c, scr_hide/scr_show): screenfx's channel 2 — its
     registers are set by screenfx_wipe_step, only the mask is composed
     HERE (this module stays the owner of $420C) */
  if (screenfx_wipe_active())
    m |= 0x04;
  if (m || hx_on)
    REG_HDMAEN = m;
  hx_on = m;
}

void hdmafx_suspend(void)
{
  /* the PICTURE/STAGE branch of the VBlank: a full-screen image must
     neither ripple nor take the gradient — HDMA cut while it is up. The
     scripted wipe (S18c) does stay active: a scr_hide/scr_show can
     curtain a picture or a composed screen. */
  if (screenfx_wipe_active())
  {
    REG_HDMAEN = 0x04;
    hx_on = 0x04;
    return;
  }
  if (hx_on)
  {
    REG_HDMAEN = 0;
    hx_on = 0;
  }
}
