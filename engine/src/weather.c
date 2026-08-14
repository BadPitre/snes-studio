/*
 * weather.c — particle weather, in the spirit of RM2003's Weather
 * Effects: rain or snow from a handful of recycled sprites, over the
 * game AND over the effect layer (OBJ priority 3, so drops pass in
 * front of clouds). GLOBAL state: persists across scenes until the
 * next change, like the tint.
 *
 * Reserved resources — all from the GENERATED video map (data/vidmap.h):
 *  - OAM: entries 100-123 (the player takes 0-1, the actors 2-49);
 *  - OBJ chars: two 16x16 blocks (c, c+1, c+16, c+17 each) near the
 *    END of the region. datagen CHECKS the scene sprite sets against
 *    them (vidmap.rs) — an earlier comment here claimed sets "cap out
 *    around 360 chars, so there is no collision", which was wrong: a
 *    legal 5-charset scene is 512 chars;
 *  - one OBJ palette — datagen already warns if a set occupies it,
 *    the same rule as BG palette 7 for pictures.
 *
 * The chars come from data_weather.c, ALWAYS emitted by datagen (no
 * data hardcoded in the engine), reloaded at every scene_load and after
 * a picture, whose closing reloads the OBJ region.
 *
 * Simulation in SCREEN coordinates (u8, wrapping at 256): rain falls
 * diagonally at two speeds, snow drifts down oscillating. A hand-rolled
 * 16-bit LCG — never libc's random.
 */
#include <snes.h>
#include "weather.h"
#include "vram.h"
#include "data/vidmap.h"

/* data_weather.c: 2 planar 4bpp 16x16 blocks (TL,TR then BL,BR) plus
   4 palette colours */
extern const u8 wea_rain[128];
extern const u8 wea_snow[128];
extern const u16 wea_pal[4];

#define WEA_MAX 24
#define WEA_OAM(i) ((u16)(VID_WEA_OAM_BASE + (i)) << 2)
#define WEA_CHAR_RAIN VID_WEA_CHAR_RAIN
#define WEA_CHAR_SNOW VID_WEA_CHAR_SNOW
#define WEA_PRIO 3 /* in front of everything, the effect layer included (BG1H) */

static u8 w_type = 0;  /* 0 none, 1 rain, 2 snow */
static u8 w_count = 0; /* active particles (8/16/24) */
static u8 w_shown = 0; /* OAM entries currently visible */
static u8 wx[WEA_MAX];
static u8 wy[WEA_MAX];
static u8 wv[WEA_MAX]; /* per-particle variant (speed/phase) */
static u16 w_seed = 0x1234;
static u8 w_frm = 0;

static u16 w_lcg(void)
{
  w_seed = w_seed * 25173 + 13849; /* 16-bit LCG, natural wrap */
  return w_seed;
}

void weather_load(void)
{
  /* 16x16 blocks: top row (c, c+1) then bottom row (c+16, c+17) —
     char c is at VRAM_OBJ_GFX + c*16 words */
  dmaCopyVram((u8 *)wea_rain, VRAM_OBJ_GFX + WEA_CHAR_RAIN * 16, 64);
  dmaCopyVram((u8 *)wea_rain + 64,
              VRAM_OBJ_GFX + (WEA_CHAR_RAIN + 16) * 16, 64);
  dmaCopyVram((u8 *)wea_snow, VRAM_OBJ_GFX + WEA_CHAR_SNOW * 16, 64);
  dmaCopyVram((u8 *)wea_snow + 64,
              VRAM_OBJ_GFX + (WEA_CHAR_SNOW + 16) * 16, 64);
  dmaCopyCGram((u8 *)wea_pal, 128 + (VID_WEA_PAL << 4), 8);
}

void weather_set(u8 type, u8 pow)
{
  u8 i;
  u16 r;

  w_type = type > 2 ? 0 : type;
  if (pow == 0)
    pow = 2;
  if (pow > 3)
    pow = 3;
  w_count = pow << 3; /* 8 / 16 / 24 */
  for (i = 0; i < WEA_MAX; i++)
  {
    r = w_lcg();
    wx[i] = (u8)r;
    wy[i] = (u8)((r >> 8) % 224);
    wv[i] = (u8)(r >> 4);
  }
}

void weather_draw(void)
{
  u8 i, x, y, v;
  u8 chlo, attr;
  u8 *om;
  u8 *px;
  u8 *py;
  u8 *pv;

  if (!w_type)
  {
    /* nothing to show: hide the still-visible entries, ONCE */
    for (i = 0; i < w_shown; i++)
      oamSetVisible(WEA_OAM(i), OBJ_HIDE);
    w_shown = 0;
    return;
  }
  /* Simulation AND drawing in ONE pointer-walking pass, written
     DIRECTLY into the shadow OAM (oamMemory). The two-indexed-loop
     version (update then draw) re-read wx/wy through u16 indexing;
     added to the S14 ripple, the frame overran (60 -> 30 FPS on the
     debug panel). 4 bytes per particle: x, y, low char, attr
     (vhoo pppc: priority 3, palette 7, 9th char bit) */
  w_frm++;
  chlo = w_type == 1 ? (u8)WEA_CHAR_RAIN : (u8)WEA_CHAR_SNOW;
  attr = 0x30 | (VID_WEA_PAL << 1) | 1; /* prio 3, weather palette,
      char 256+ (constant-folded) */
  om = oamMemory + ((u16)VID_WEA_OAM_BASE << 2);
  px = wx;
  py = wy;
  pv = wv;
  if (w_type == 1)
  {
    /* rain: fast diagonal fall, two speeds interleaved */
    for (i = 0; i < w_count; i++)
    {
      v = *pv++;
      x = *px - 2;
      y = *py + ((v & 1) ? 5 : 4);
      if (y >= 224)
      {
        y = 0;
        x = (u8)w_lcg();
      }
      *px++ = x;
      *py++ = y;
      om[0] = x;
      om[1] = y;
      om[2] = chlo;
      om[3] = attr;
      om += 4;
      if (i >= w_shown)
        oamSetEx(WEA_OAM(i), OBJ_SMALL, OBJ_SHOW); /* size + X9, ONE
          once (oamSetEx overwrites X's 9th bit — see actors.c) */
    }
  }
  else
  {
    /* snow: slow descent, gentle oscillation by phase */
    for (i = 0; i < w_count; i++)
    {
      v = *pv++;
      x = *px;
      y = *py;
      if ((w_frm ^ v) & 1)
        y++;
      if (((u8)(w_frm + v) & 15) == 0)
        x += (v & 2) ? 1 : 0xFF; /* +1 or -1 (u8 wrap) */
      if (y >= 224)
      {
        y = 0;
        x = (u8)w_lcg();
      }
      *px++ = x;
      *py++ = y;
      om[0] = x;
      om[1] = y;
      om[2] = chlo;
      om[3] = attr;
      om += 4;
      if (i >= w_shown)
        oamSetEx(WEA_OAM(i), OBJ_SMALL, OBJ_SHOW);
    }
  }
  for (i = w_count; i < w_shown; i++)
    oamSetVisible(WEA_OAM(i), OBJ_HIDE); /* reduced intensity */
  w_shown = w_count;
}
