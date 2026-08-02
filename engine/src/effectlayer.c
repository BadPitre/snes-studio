/*
 * effectlayer.c — the per-scene effect layer ("clouds over the
 * village"): a pattern — a TRANSPARENT image from the pictures
 * registry — drifting over the game while it plays, with NPCs visible
 * and everything working. Zelda 3's Lost Woods fog: the BG1 plane
 * changes job in those scenes.
 *
 * A scene with an effect LOSES its upper layer — the console only has
 * two scenery planes plus the text plane. The editor disables it and
 * datagen warns if it is not empty.
 *
 * VRAM plan: the old BG1 map region ($0000-$1000 words) is REPURPOSED.
 * The pattern's chars go at $0000 (at most 256, checked by datagen) and
 * its 32x32 map lives in the free gap at $1C00, after the BG3 map. The
 * tileset ($2000), sprites ($4000) and BG2 map ($6000) are untouched;
 * map.c stops streaming BG1 in those scenes.
 *
 * The map entries carry the PRIORITY bit (0x2000), so the pattern
 * passes IN FRONT of the sprites (clouds above the characters); under
 * blending, scenery AND characters stay visible through it (sub screen
 * BG2+OBJ — unlike pictures, the OBJ chars are valid here). Tint and
 * flash are suspended while a blend is active: same circuit, see
 * screenfx_cm_hold.
 *
 * A picture over an effect scene is safe: its chars go to the OBJ
 * region and its map to $7000, and picture_hide calls effect_restore
 * (registers and palette 7; the pattern's VRAM has not moved).
 */
#include <snes.h>
#include "effectlayer.h"
#include "screenfx.h"
#include "camera.h"
#include "vram.h"

/* data_effects.c (always emitted by datagen) — indexed by scene_id */
extern const u8 eff_pic[];    /* picture index, 0xFF = no effect */
extern const u8 eff_blend[];  /* 0 opaque, 1 semi, 2 additive, 3 subtractive */
extern const u8 eff_par[];    /* camera follow: camera >> n, 0 = fixed */
extern const u16 eff_dx[];    /* drift, 8.8 per frame (two's complement) */
extern const u16 eff_dy[];
extern const u8 eff_mode[];   /* 0 front (overlay), 1 back (panorama) */
extern const u8 eff_repeat[]; /* 1 repeated (scrolls), 0 fixed */

/* the pictures registry (data_pictures.c): the pattern IS a picture */
extern const u8 pic_count;
extern const u8 *const pic_chars[];
extern const u16 *const pic_chars_sizes[];
extern const u16 *const pic_maps[];
extern const u16 *const pic_pals[];

static u8 eff_on = 0;
static u8 eff_cur = 0;  /* picture id of the pattern (set by effect_load) */
static u8 eff_bl = 0;   /* blend mode of the current scene */
static u8 eff_pr = 0;   /* parallax: scroll += camera >> eff_pr (0 = none) */
static u8 eff_bk = 0;   /* 1 = panorama behind the map */
static u16 eff_vx = 0;  /* drift per frame (8.8) */
static u16 eff_vy = 0;
static u16 eff_x8 = 0;  /* accumulated position (8.8) — wraps at 256 px */
static u16 eff_y8 = 0;
/* the pattern's map (the priority bit only in overlay mode) — composed
   at load time */
static u16 eff_buf[1024];

u8 effect_active(void)
{
  return eff_on;
}

u8 effect_is_back(void)
{
  return (u8)(eff_on && eff_bk);
}

/* BG1 registers, colour math and palette 7 — shared by load and restore */
static void eff_regs(void)
{
  bgSetGfxPtr(0, VRAM_EFF_GFX);
  bgSetMapPtr(0, VRAM_EFF_MAP, SC_32x32);
  dmaCopyCGram((u8 *)pic_pals[eff_cur] + 2, 113, 30);
  if (eff_bl)
  { /* blending: overlay only (a panorama is opaque) */
    u8 adsub = eff_bl == 1 ? 0x41 /* semi-transparent */
                           : (eff_bl == 2 ? 0x01 /* additive */
                                          : 0x81 /* subtractive */);

    REG_TS = 0x12; /* BG2 + OBJ in sub: scenery AND characters visible */
    REG_CGWSEL = 0x02;
    REG_CGADSUB = adsub;
    screenfx_cm_hold_regs(0x12, 0x02, adsub); /* the lightning puts them back */
    screenfx_cm_hold(1);
  }
  else
  {
    REG_TS = 0;
    screenfx_cm_hold(0);
  }
}

void effect_load(u8 scene_id)
{
  u16 i;
  u8 p = eff_pic[scene_id];

  eff_x8 = 0;
  eff_y8 = 0;
  if (p == 0xFF || p >= pic_count)
  {
    eff_on = 0;
    eff_bl = 0;
    REG_TS = 0; /* scene with no effect: sub screen and colour math given back */
    screenfx_cm_hold(0);
    return;
  }
  eff_on = 1;
  eff_cur = p;
  eff_bk = eff_mode[scene_id];
  /* Panorama (back): opaque and BEHIND, so no blending even if asked
     for. Overlay (front): the scene's blend applies. */
  eff_bl = eff_bk ? 0 : eff_blend[scene_id];
  eff_pr = eff_par[scene_id];
  eff_vx = eff_dx[scene_id];
  eff_vy = eff_dy[scene_id];
  if (!eff_repeat[scene_id])
  {
    /* a fixed, non-repeating image: no drift, no parallax, one frame */
    eff_vx = 0;
    eff_vy = 0;
    eff_pr = 0;
  }
  dmaCopyVram((u8 *)pic_chars[p], VRAM_EFF_GFX, *pic_chars_sizes[p]);
  for (i = 0; i < 1024; i++)
    /* Palette 7 FORCED (0x1C00): the effect plane has its own dedicated
       palette, loaded by eff_regs, so an opaque image (palette 0) shows
       its real colours as a panorama and not the scenery's.
       front adds priority, in front of the sprites. back does not: a
       low-priority BG1 pattern, BEHIND the map — map.c forces the lower
       layer's priority to cover it. */
    eff_buf[i] = pic_maps[p][i] | 0x1C00 | (eff_bk ? 0 : 0x2000);
  dmaCopyVram((u8 *)eff_buf, VRAM_EFF_MAP, 1024 * 2);
  eff_regs();
}

void effect_restore(void)
{
  if (!eff_on)
    return;
  eff_regs(); /* the picture overwrote CGRAM 113-127 and the registers —
                 the pattern's chars and map have not moved */
}

void effect_update(void)
{
  if (!eff_on)
    return;
  eff_x8 += eff_vx;
  eff_y8 += eff_vy;
}

/* the pattern's current X scroll (drift plus camera follow), exported
   for the HDMA ripple, which must ripple around the same base */
u16 effect_hofs(void)
{
  u16 x = eff_x8 >> 8;

  if (eff_pr)
    x += camera.x >> (eff_pr == 3 ? 0 : eff_pr);
  return x;
}

void effect_vblank(void)
{
  u16 y = eff_y8 >> 8;

  /* Camera follow: the pattern slides at a FRACTION of the scenery
     (camera >> n; 3 means GLUED to it, full speed — ground shadows).
     The 32x32 map wraps at 256 px, so the scroll can overflow safely. */
  if (eff_pr)
    y += camera.y >> (eff_pr == 3 ? 0 : eff_pr);
  bgSetScroll(0, effect_hofs(), y);
}
