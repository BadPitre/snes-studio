/*
 * stage.c — the composed screen (B3): background + multi-slot images.
 *
 * VRAM plan while the screen is up (the SCENE's regions are reused, and
 * closing goes back through scene_load — an internal warp):
 *  - BG2 = BACKGROUND: chars in the OBJ region ($4000, <= 512 — the
 *    sprites are hidden, as for pictures), 32x32 map at $7000;
 *  - BG1 = LAID-OUT IMAGES: chars in the tileset region ($2000, <= 512,
 *    char 0 reserved as transparent), 32x32 map in the $7800 gap;
 *  - BG3 (dialogues/HUD): untouched. Palettes: background -> BG palette
 *    0, slot i -> BG palette 2+i (the font in CGRAM 16-19 is preserved,
 *    palette 7 stays the pictures').
 *
 * OPENING/CLOSING: screen off under a fade (the do_warp recipe), from
 * the main loop. LAYING with the screen on: spread transfers (<= 1 KB of
 * chars per VBlank, then the palette, then the map 2 rows per frame —
 * built outside the VBlank); the VM waits for the end (VM_WAIT_STAGE):
 * the monsters "appear" one after the other.
 *
 * APPEND char allocator: laying a slot again with the SAME image
 * reloads nothing (a move is map-only); another image allocates after
 * it. The space is only given back when the screen closes — a budget of
 * 511 chars in total, a lay beyond that is ignored (the S6 panel and
 * the docs give the rule).
 *
 * The images are the project's PICTURES (same data, datagen does not
 * change): map entries rewritten on the fly (char + the slot's base,
 * the slot's palette).
 */
#include <snes.h>
#include "stage.h"
#include "scene.h"
#include "screenfx.h"
#include "picture.h"
#include "vignette.h"
#include "player.h"
#include "vram.h"

/* pictures register (data_pictures.c — always emitted) */
extern const u8 pic_count;
extern const u8 *const pic_chars[];
extern const u16 *const pic_chars_sizes[];
extern const u16 *const pic_maps[];
extern const u16 *const pic_pals[];
extern const u8 pic_wt[];
extern const u8 pic_ht[];

extern u8 videoMode; /* PVSnesLib mirror of REG_TM */

#define SG_MAP_BG1 0x7800 /* 32x32 map of the laid images (free gap) */
#define SG_MAP_BG2 VRAM_PIC_MAP /* background map ($7000 — the picture
                                   cannot be shown at the same time) */
#define SG_TM 0x17        /* BG1 + BG2 + BG3 + OBJ (vignettes B5 — the
   scene's sprites are hidden on opening, the OAM is clean) */
#define SG_TM_GAME 0x17
#define SG_CHUNK 1024     /* bytes of chars per VBlank (S6 budget) */

static u8 sg_on = 0;
static u8 sg_req = 0; /* 0 nothing, 1 open, 2 close */
static u8 sg_req_pic = 0;
static u8 sg_req_dur = 0;
static u8 sg_req_trans = 0; /* transition (S18): 0 fade, 1 instant,
                               2 mosaic */
static u8 sg_close = 0;     /* the loop must run the internal warp */
static u8 sg_close_tr = 0;  /* transition of the close in progress (S18) */
static u16 sg_next_char = 1; /* allocator (char 0 = transparent) */

static u8 sl_pic[STAGE_SLOTS];  /* 0xFF = empty slot */
static u8 sl_shown[STAGE_SLOTS]; /* posed and NOT cleared — sl_pic
   survives a clear (the char allocator keeps the base), so occupancy
   for the target cursor (V2) needs its own flag */
static u16 sl_base[STAGE_SLOTS];
static u8 sl_x[STAGE_SLOTS]; /* laid region (tiles) — for the erase */
static u8 sl_y[STAGE_SLOTS];

/* spread transfer of a lay: phases chars -> palette -> erase the old
   region -> map (2 rows per frame, built outside the VBlank) */
static u8 up_act = 0; /* 0 idle, 1 chars, 2 pal, 3 clear, 4 map */
static u8 up_slot = 0;
static u8 up_pic = 0;
static u8 up_tx = 0, up_ty = 0;
static u16 up_sent = 0; /* bytes of chars already sent */
static u8 up_row = 0;   /* current row (clear/map) */
static u8 up_rows = 0;  /* rows built in the buffer (0-2) */
static u16 up_buf[64];  /* 2 map rows max */
static u8 up_cx = 0, up_cy = 0, up_cw = 0, up_ch = 0; /* region to erase */
static u16 sg_zero = 0; /* pattern for dmaFillVram16 (transparent entry) */

/* Overlap COMPOSITION (B3-overlap). One tilemap carries every laid
   image, so two images that overlap used to fight for the map cell:
   the front one's rectangle replaced the back one's entries, blank
   tiles included, and the backdrop showed through the hole. The FF6
   answer, adopted here: when a laid cell lands on an OCCUPIED cell,
   merge the two chars pixel by pixel (front wins, its transparent
   pixels reveal the back) into a freshly allocated char. The merged
   tile takes the FRONT slot's palette — exact when the two images
   share colours (a formation of the same monster), an assumed
   approximation otherwise, same as FF6.

   sg_map is the WRAM shadow of the BG1 map — the truth the compose
   step reads (VRAM cannot be read with the display on). Blank front
   cells keep the back entry outright, fully covering front cells
   write plainly; only true pixel mixes cost a char. Composed chars
   are flagged in sg_cflag: a THIRD image landing on a composed cell
   falls back to the plain overwrite (its sources are no longer in
   ROM), and the chars are only reclaimed when the screen closes —
   endlessly re-laying overlapped slots can exhaust the 511-char
   budget until then. */
#define SG_COMP_MAX 4 /* composed chars per VBlank batch: 4 x 32 B of
   extra uncounted DMA (~8 lines worst) on top of the laying chunk */
static u16 sg_map[32 * 28];    /* shadow of SG_MAP_BG1 (rows seen) */
static u8 sg_cflag[64];        /* bit c: char c is a composed char */
static u8 cp_buf[SG_COMP_MAX * 32]; /* merged pixels, built in the
                                       main loop, sent at VBlank */
static u16 cp_dst[SG_COMP_MAX];     /* their char indexes */
static u8 cp_n = 0;
static const u8 sg_bit[8] = { 1, 2, 4, 8, 16, 32, 64, 128 };

/* Per-slot effects (B4): manipulating the PALETTE of the laid image
   — white flash, fade to black (death), darken, restore. One WRAM
   SHADOW per slot (the 15 useful colours): the fade halves it in
   BGR555 ((v >> 1) & 0x3DEF — one shift and one mask per colour, NEVER
   a multiplication, the S6 panel lesson), and the VBlank pushes 30
   bytes of CGRAM per slot marked dirty. */
static u16 sl_sh[STAGE_SLOTS][15]; /* shadow of the slot's palette */
static u8 fx_mode[STAGE_SLOTS];    /* 0 nothing, 1 flash, 2 fade-to-black */
static u8 fx_t[STAGE_SLOTS];       /* frames left in the effect */
static u8 fx_per[STAGE_SLOTS];     /* fade: period between half-tints */
static u8 fx_cnt[STAGE_SLOTS];     /* period counter (no modulo) */
static u8 fx_dirty = 0; /* bitmask: palettes to push at VBlank (the
   flash pushes WHITE while mode == 1, the shadow otherwise) */
static const u16 sg_white[15] = {
    0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF,
    0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF};

u8 stage_active(void)
{
  return sg_on;
}

u8 stage_busy(void)
{
  return up_act != 0;
}

u8 stage_slot_used(u8 slot)
{
  return slot < STAGE_SLOTS && sl_shown[slot];
}

void stage_request_open(u8 backdrop_pic, u8 fade_dur, u8 trans)
{
  sg_req = 1;
  sg_req_pic = backdrop_pic;
  sg_req_dur = fade_dur;
  sg_req_trans = trans;
}

void stage_request_close(u8 fade_dur, u8 trans)
{
  if (!sg_on)
    return;
  sg_req = 2;
  sg_req_dur = fade_dur;
  sg_req_trans = trans;
}

/* Transition of the LAST close (S18) — do_warp (the internal closing
   warp) applies it when the map reappears. */
u8 stage_close_trans(void)
{
  return sg_close_tr;
}

u8 stage_take_close(void)
{
  u8 c = sg_close;

  sg_close = 0;
  return c;
}

void stage_reset(void)
{
  if (!sg_on)
    return;
  videoMode = SG_TM_GAME;
  REG_TM = SG_TM_GAME;
  sg_on = 0; /* scene_load (warp) reloads scenery, sprites and scrolls */
  up_act = 0;
  sg_req = 0;
  /* the vignettes shown during the screen are part of its staging: the
     close hides them (otherwise they float over the map) */
  vig_hide(0);
  vig_hide(1);
}

/* in-house fades on $2100 — the picture recipe (S7), duration in frames.
   trans (S18): 2 = mosaic ($2106 on BG1-3) coupled to brightness — the
   screen pixelates as it darkens; 1 = instant (no ramp). */
static void sg_trans_regs(u8 trans, u8 b)
{
  if (trans == 2)
    REG_MOSAIC = (u8)(((15 - b) << 4) | 0x07);
  REG_INIDISP = b;
}

static void sg_fade_out(u8 dur, u8 trans)
{
  u16 step, lvl, f;

  if (!dur || trans == 1)
    return;
  if (trans >= 3)
  {
    /* wipe (S18b): the black curtain grows over dur frames */
    for (f = 1; f <= dur; f++)
    {
      WaitForVBlank();
      screenfx_wipe_step(trans, (u16)(224u * f / dur));
    }
    WaitForVBlank();
    screenfx_wipe_off();
    REG_INIDISP = 0; /* stays black until setScreenOff */
    return;
  }
  step = 0x0F00 / dur;
  lvl = 0x0F00;
  for (f = 0; f < dur; f++)
  {
    lvl = lvl > step ? lvl - step : 0;
    WaitForVBlank();
    sg_trans_regs(trans, (u8)(lvl >> 8));
  }
}

static void sg_fade_in(u8 dur, u8 trans)
{
  u16 step, lvl, f;

  if (!dur || trans == 1)
  {
    if (trans == 2)
      REG_MOSAIC = 0; /* ramp skipped: do not stay pixelated */
    return;
  }
  if (trans >= 3)
  {
    /* wipe: the full curtain is armed before turning the screen back on
       (setScreenOn set 15 — the HDMA writes $2100 from line 0) */
    REG_INIDISP = 0;
    screenfx_wipe_step(trans, 224);
    for (f = 1; f <= dur; f++)
    {
      WaitForVBlank();
      screenfx_wipe_step(trans, (u16)(224u - 224u * f / dur));
    }
    WaitForVBlank();
    screenfx_wipe_off();
    REG_INIDISP = 0x0F; /* the last HDMA value may be a band 0 */
    return;
  }
  step = 0x0F00 / dur;
  lvl = 0;
  REG_INIDISP = 0;
  for (f = 0; f < dur; f++)
  {
    lvl += step;
    if (lvl > 0x0F00)
      lvl = 0x0F00;
    WaitForVBlank();
    sg_trans_regs(trans, (u8)(lvl >> 8));
  }
  REG_INIDISP = 0x0F;
  if (trans == 2)
  {
    WaitForVBlank();
    REG_MOSAIC = 0; /* effect done (size 1, no BG) */
  }
}

static void sg_open(void)
{
  u16 i;
  u8 id = sg_req_pic;

  sg_fade_out(sg_req_dur, sg_req_trans);
  setScreenOff();
  if (sg_req_trans == 2)
    REG_MOSAIC = 0; /* the closing mosaic must not stick to the screen */
  picture_reset(); /* an image is showing: the composed screen takes over */
  sg_on = 1;
  up_act = 0;
  sg_next_char = 1;
  for (i = 0; i < STAGE_SLOTS; i++)
  {
    sl_pic[i] = 0xFF;
    sl_shown[i] = 0;
    fx_mode[i] = 0; /* palette effects (B4) reset */
  }
  fx_dirty = 0;
  /* overlap composition: fresh shadow map, no composed chars */
  {
    u16 j;

    for (j = 0; j < 32 * 28; j++)
      sg_map[j] = 0;
    for (j = 0; j < 64; j++)
      sg_cflag[j] = 0;
  }
  cp_n = 0;
  /* the scene's sprites are hidden (hero, NPCs, weather) — the loop's
     *_draw calls are frozen while the screen is up */
  for (i = 0; i < 128; i++)
    oamSetVisible((u16)(i << 2), OBJ_HIDE);
  videoMode = SG_TM;
  REG_TM = SG_TM;
  /* BG1 = the layer of laid images: chars in the tileset region (char 0
     made transparent), empty 32x32 map at $7800 */
  bgSetGfxPtr(0, VRAM_BG1_GFX);
  bgSetMapPtr(0, SG_MAP_BG1, SC_32x32);
  sg_zero = 0;
  dmaFillVram16(&sg_zero, VRAM_BG1_GFX, 16); /* char 0: 16 words of 0 */
  dmaFillVram16(&sg_zero, SG_MAP_BG1, 32 * 32);
  /* BG2 = the background: chars in the OBJ region, map at $7000 */
  bgSetGfxPtr(1, VRAM_OBJ_GFX);
  bgSetMapPtr(1, SG_MAP_BG2, SC_32x32);
  if (id < pic_count)
  {
    dmaCopyVram((u8 *)pic_chars[id], VRAM_OBJ_GFX, *pic_chars_sizes[id]);
    dmaCopyVram((u8 *)pic_maps[id], SG_MAP_BG2, 32 * 32 * 2);
    dmaCopyCGram((u8 *)pic_pals[id], 0, 32); /* BG palette 0 */
    /* a background WITH TRANSPARENCY has its entries marked palette 7
       (S4) — the same palette is laid there so it shows anyway (an
       opaque background is recommended, but never wild colours) */
    dmaCopyCGram((u8 *)pic_pals[id] + 2, 113, 30);
  }
  else
  {
    /* no background: black (transparent char 0 + empty map + CGRAM 0) */
    dmaFillVram16(&sg_zero, VRAM_OBJ_GFX, 16);
    dmaFillVram16(&sg_zero, SG_MAP_BG2, 32 * 32);
    dmaCopyCGram((u8 *)&sg_zero, 0, 2);
  }
  bgSetScroll(0, 0, 0);
  bgSetScroll(1, 0, 0);
  REG_TS = 0; /* no blend on the composed screen — tint/flash active */
  screenfx_cm_hold(0);
  screenfx_warp_reset();
  vig_reload(); /* the background may have overwritten chars 384+ (vignettes) */
  setScreenOn();
  sg_fade_in(sg_req_dur, sg_req_trans);
}

void stage_apply(void)
{
  u8 r = sg_req;

  sg_req = 0;
  if (r == 1)
    sg_open();
  else if (r == 2 && sg_on)
  {
    sg_fade_out(sg_req_dur, sg_req_trans);
    setScreenOff();
    if (sg_req_trans == 2)
      REG_MOSAIC = 0; /* the reappearance (do_warp) starts from a clean state */
    sg_close = 1; /* the loop goes on to the internal warp (do_warp) */
    sg_close_tr = sg_req_trans;
  }
}

void stage_pose(u8 slot, u8 pic, u8 tx, u8 ty)
{
  u16 need;
  u8 w, h;

  if (!sg_on || up_act || slot >= STAGE_SLOTS || pic >= pic_count)
    return;
  w = pic_wt[pic];
  h = pic_ht[pic];
  if (w == 0 || h == 0)
    return;
  if (tx > 32 - w) /* clamp to the screen (32x32 map, 28 rows seen) */
    tx = 32 - w;
  if (ty > 28 - h)
    ty = 28 - h;
  if (sl_pic[slot] != pic)
  {
      /* a new image in this slot: allocated AFTER the others — the space
         is only given back on close (budget 511 chars, a lay beyond that
         is ignored: simplify the images or close and reopen the screen) */
    need = *pic_chars_sizes[pic] >> 5; /* 32 bytes per char */
    if (sg_next_char + need > 512)
      return;
    up_sent = 0;
    up_act = 1; /* chars phase */
    sl_base[slot] = sg_next_char;
    sg_next_char += need;
  }
  else
    up_act = 3; /* same image: erase + map only */
  /* the slot's old region will be erased before the new one is written */
  up_cx = sl_x[slot];
  up_cy = sl_y[slot];
  if (sl_pic[slot] != 0xFF)
  {
    up_cw = pic_wt[sl_pic[slot]];
    up_ch = pic_ht[sl_pic[slot]];
  }
  else
    up_ch = 0; /* nothing to erase */
  up_slot = slot;
  up_pic = pic;
  up_tx = tx;
  up_ty = ty;
  up_row = 0;
  up_rows = 0;
  sl_pic[slot] = pic;
  sl_shown[slot] = 1;
  sl_x[slot] = tx;
  sl_y[slot] = ty;
  /* palette shadow (B4): a copy of the 15 useful colours from ROM — the
     effects always start from a clean palette */
  {
    const u16 *pp = pic_pals[pic] + 1;
    u8 i;

    for (i = 0; i < 15; i++)
      sl_sh[slot][i] = pp[i];
  }
  fx_mode[slot] = 0;
}

void stage_slotfx(u8 slot, u8 fx, u8 dur)
{
  const u16 *pp;
  u8 i;

  if (!sg_on || slot >= STAGE_SLOTS || sl_pic[slot] == 0xFF)
    return;
  switch (fx)
  {
  case 1: /* white FLASH: dur frames, then the current palette returns */
    fx_mode[slot] = 1;
    fx_t[slot] = dur ? dur : 6;
    fx_dirty |= (u8)(1 << slot);
    break;
  case 2: /* FADE to black (death): 5 half-tint steps over dur */
    fx_mode[slot] = 2;
    fx_t[slot] = dur ? dur : 30;
    if (dur >= 5)
      fx_per[slot] = dur / 5; /* ONE division, at command time */
    else
      fx_per[slot] = 1;
    fx_cnt[slot] = fx_per[slot];
    break;
  case 3: /* DARKEN by one step (persistent — poison, petrification) */
    for (i = 0; i < 15; i++)
      sl_sh[slot][i] = (sl_sh[slot][i] >> 1) & 0x3DEF;
    fx_dirty |= (u8)(1 << slot);
    break;
  default: /* 0: RESTORE the original palette (end of a status) */
    pp = pic_pals[sl_pic[slot]] + 1;
    for (i = 0; i < 15; i++)
      sl_sh[slot][i] = pp[i];
    fx_mode[slot] = 0;
    fx_dirty |= (u8)(1 << slot);
    break;
  }
}

/* one step of the palette effects per frame (called by stage_update) */
static void sg_fx_step(void)
{
  u8 s, i;

  for (s = 0; s < STAGE_SLOTS; s++)
  {
    if (!fx_mode[s])
      continue;
    fx_t[s]--;
    if (fx_mode[s] == 1)
    {
      if (!fx_t[s])
      {
        fx_mode[s] = 0; /* end of the flash: the current shadow comes back */
        fx_dirty |= (u8)(1 << s);
      }
    }
    else /* fade to black */
    {
      if (!fx_t[s])
      {
        for (i = 0; i < 15; i++)
          sl_sh[s][i] = 0;
        fx_mode[s] = 0;
        fx_dirty |= (u8)(1 << s);
      }
      else if (--fx_cnt[s] == 0) /* step: half-tint (no modulo) */
      {
        fx_cnt[s] = fx_per[s];
        for (i = 0; i < 15; i++)
          sl_sh[s][i] = (sl_sh[s][i] >> 1) & 0x3DEF;
        fx_dirty |= (u8)(1 << s);
      }
    }
  }
}

void stage_clear(u8 slot)
{
  if (!sg_on || up_act || slot >= STAGE_SLOTS || sl_pic[slot] == 0xFF)
    return;
  sl_shown[slot] = 0;
  up_cx = sl_x[slot];
  up_cy = sl_y[slot];
  up_cw = pic_wt[sl_pic[slot]];
  up_ch = pic_ht[sl_pic[slot]];
  up_slot = slot;
  up_row = 0;
  up_act = 5; /* erase only */
  /* the slot keeps its char base: laying the same image again later will
     only cost the map */
}

/* Merges one laid cell over one occupied cell (B3-overlap): the
   front's pixels win, its transparent pixels keep the back's. Returns
   the map entry to write — a plain overwrite when the mix costs
   nothing (blank front cell -> the back entry stays; fully covering
   front cell, exhausted char budget, back cell already composed ->
   the front entry), a freshly composed char otherwise. */
static u16 sg_compose(u16 over_entry, u16 under, u8 pal)
{
  const u8 *op, *upx;
  u8 *d;
  u16 uc, ub;
  u8 uslot, y, cover, kept;

  uc = under & 0x03FF;
  if (sg_cflag[uc >> 3] & sg_bit[uc & 7])
    return over_entry; /* three deep: the middle char's pixels are no
                          longer in ROM — plain overwrite */
  uslot = (u8)(((under >> 10) & 7) - 2);
  if (uslot >= STAGE_SLOTS || sl_pic[uslot] == 0xFF)
    return over_entry;
  if (cp_n >= SG_COMP_MAX || sg_next_char >= 512)
    return over_entry; /* batch full or budget out */
  op = pic_chars[up_pic] + (((over_entry & 0x03FF) - sl_base[up_slot]) << 5);
  upx = pic_chars[sl_pic[uslot]] + ((uc - sl_base[uslot]) << 5);
  d = cp_buf + ((u16)cp_n << 5);
  cover = 0xFF; /* front opaque everywhere so far */
  kept = 0;     /* back pixels that survive */
  for (y = 0; y < 8; y++)
  {
    u8 m, im;

    m = (u8)(op[y << 1] | op[(y << 1) + 1] |
             op[16 + (y << 1)] | op[16 + (y << 1) + 1]);
    im = (u8)~m;
    cover &= m;
    d[y << 1] = (u8)(op[y << 1] | (upx[y << 1] & im));
    d[(y << 1) + 1] = (u8)(op[(y << 1) + 1] | (upx[(y << 1) + 1] & im));
    d[16 + (y << 1)] = (u8)(op[16 + (y << 1)] | (upx[16 + (y << 1)] & im));
    d[16 + (y << 1) + 1] =
        (u8)(op[16 + (y << 1) + 1] | (upx[16 + (y << 1) + 1] & im));
    kept |= (u8)(d[y << 1] ^ op[y << 1]);
    kept |= (u8)(d[(y << 1) + 1] ^ op[(y << 1) + 1]);
    kept |= (u8)(d[16 + (y << 1)] ^ op[16 + (y << 1)]);
    kept |= (u8)(d[16 + (y << 1) + 1] ^ op[16 + (y << 1) + 1]);
  }
  if (cover == 0xFF || !kept)
    return over_entry; /* the front covers everything visible */
  ub = sg_next_char++;
  sg_cflag[ub >> 3] |= sg_bit[ub & 7];
  cp_dst[cp_n] = ub;
  cp_n++;
  return ub | ((u16)pal << 10);
}

/* Is this cell of the laid image entirely transparent? (all four
   plane bytes of every row zero — 32 ROM bytes checked) */
static u8 sg_cell_blank(u16 over_entry)
{
  const u8 *op;
  u8 k, acc;

  op = pic_chars[up_pic] + (((over_entry & 0x03FF) - sl_base[up_slot]) << 5);
  acc = 0;
  for (k = 0; k < 32; k++)
    acc |= op[k];
  return acc == 0;
}

/* builds up to 2 map rows into up_buf (main loop — never at VBlank: it
   rewrites char+palette for w entries per row). Overlap composition
   happens HERE, where scan lines are free; the VBlank only fires the
   result. A batch that composes stops at one row so its extra chars
   stay inside the SG_COMP_MAX transfer cap. */
void stage_update(void)
{
  const u16 *src;
  u16 *q;
  u16 base, under, entry;
  u8 w, r, i, pal;

  if (sg_on)
    sg_fx_step(); /* per-slot palette effects (B4) */
  if (up_act != 4 || up_rows)
    return;
  w = pic_wt[up_pic];
  base = sl_base[up_slot];
  pal = (u8)(2 + up_slot); /* BG palette of the slot */
  for (r = 0; r < 2 && (u8)(up_row + r) < pic_ht[up_pic]; r++)
  {
    src = pic_maps[up_pic] + ((u16)(up_row + r) << 5);
    q = up_buf + ((u16)r << 5); /* row 1 at +32 (the VBlank's stride) */
    for (i = 0; i < w; i++)
    {
      entry = ((*src++ & 0x03FF) + base) | ((u16)pal << 10);
      under = sg_map[(((u16)up_ty + up_row + r) << 5) + up_tx + i];
      if (under & 0x03FF)
      {
        if (sg_cell_blank(entry))
          entry = under; /* blank front cell: the back one stays */
        else
          entry = sg_compose(entry, under, pal);
      }
      *q++ = entry;
    }
    up_rows++;
    if (cp_n) /* composed chars pending: cap the batch at this row */
      break;
  }
}

void stage_vblank(void)
{
  u16 n, addr;
  u8 r;

  if (sg_on)
  {
    /* scrolls of the composed screen: fixed (+ scripted shake) */
    bgSetScroll(0, screenfx_shake_x(), 0);
    bgSetScroll(1, screenfx_shake_x(), 0);
    /* palette effects (B4): ONE slot palette pushed per VBlank (30 bytes
       — white while a flash runs, the shadow otherwise) */
    if (fx_dirty)
    {
      for (n = 0; n < STAGE_SLOTS; n++)
        if (fx_dirty & (1 << n))
        {
          dmaCopyCGram(fx_mode[(u8)n] == 1 ? (u8 *)sg_white
                                           : (u8 *)sl_sh[(u8)n],
                       (u16)(((2 + n) << 4) + 1), 30);
          fx_dirty &= (u8)~(1 << n);
          break;
        }
    }
  }
  switch (up_act)
  {
  case 1: /* image chars, in 1 KB chunks */
    n = *pic_chars_sizes[up_pic] - up_sent;
    if (n > SG_CHUNK)
      n = SG_CHUNK;
    dmaCopyVram((u8 *)pic_chars[up_pic] + up_sent,
                VRAM_BG1_GFX + (sl_base[up_slot] << 4) + (up_sent >> 1), n);
    up_sent += n;
    if (up_sent >= *pic_chars_sizes[up_pic])
      up_act = 2;
    break;
  case 2: /* slot palette (colours 1-15 of BG palette 2+slot) */
    dmaCopyCGram((u8 *)pic_pals[up_pic] + 2,
                 (u8)(((2 + up_slot) << 4) + 1), 30);
    up_act = 3;
    break;
  case 3: /* erasing the old region (2 rows per VBlank) */
  case 5:
    for (r = 0; r < 2 && up_row < up_ch; r++, up_row++)
    {
      u16 j, o;

      addr = SG_MAP_BG1 + ((u16)(up_cy + up_row) << 5) + up_cx;
      dmaFillVram16(&sg_zero, addr, up_cw);
      o = (((u16)up_cy + up_row) << 5) + up_cx; /* shadow follows */
      for (j = 0; j < up_cw; j++)
        sg_map[o + j] = 0;
    }
    if (up_row >= up_ch)
    {
      if (up_act == 5)
        up_act = 0; /* erase only: done */
      else
      {
        up_act = 4; /* now the map */
        up_row = 0;
        up_rows = 0;
      }
    }
    break;
  case 4: /* map: the rows built by stage_update */
    if (!up_rows)
      break;
    /* composed chars FIRST: the map rows below reference them */
    for (r = 0; r < cp_n; r++)
      dmaCopyVram(cp_buf + ((u16)r << 5),
                  VRAM_BG1_GFX + (cp_dst[r] << 4), 32);
    cp_n = 0;
    addr = SG_MAP_BG1 + ((u16)up_ty << 5) + up_tx + ((u16)up_row << 5);
    dmaCopyVram((u8 *)up_buf, addr, (u16)pic_wt[up_pic] << 1);
    if (up_rows > 1)
      dmaCopyVram((u8 *)(up_buf + 32), addr + 32,
                  (u16)pic_wt[up_pic] << 1);
    /* the shadow follows the truth, row by row */
    {
      u16 j, o;
      u8 k;

      for (k = 0; k < up_rows; k++)
      {
        o = (((u16)up_ty + up_row + k) << 5) + up_tx;
        for (j = 0; j < pic_wt[up_pic]; j++)
          sg_map[o + j] = up_buf[((u16)k << 5) + j];
      }
    }
    up_row += up_rows;
    up_rows = 0;
    if (up_row >= pic_ht[up_pic])
      up_act = 0; /* lay finished — the VM resumes */
    break;
  }
}
