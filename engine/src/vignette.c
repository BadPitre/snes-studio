/*
 * vignette.c — animated vignettes (B5). See vignette.h.
 *
 * OBJ char plan: slot v occupies the 32x32 block at chars
 * 384 + v*4 (rows 24-27 of the name grid — a 32x32 OBJ addresses
 * the chars c, c+1..c+3 / c+16.. / c+32.. / c+48..). datagen emits
 * the frames as 4 rows of 4 chars: a frame change is 4 DMAs of 128
 * bytes (at VBlank, at most one slot per frame — the S6 panel
 * budget).
 *
 * OAM: entries 96-99 (the player takes 0-1, the actors 2-49, the
 * weather 100-123). The shadow (oamMemory) is written DIRECTLY every
 * frame, plus oamSetEx (LARGE 32x32 size + visibility) — reasserted
 * every frame: opening a composed screen hides the whole OAM.
 *
 * Palettes: allocated PER SHEET (see vignette.h). pal_vig[p] remembers
 * which vignette is loaded in OBJ palette 5+p, and pal_rc[p] counts
 * the slots using it — two layers of the same animation therefore
 * cost only ONE palette.
 */
#include <snes.h>
#include "vignette.h"
#include "stage.h"
#include "vbudget.h"
#include "player.h"
#include "actors.h"
#include "camera.h"
#include "vram.h"

/* generated register (data_vignettes.c — always emitted) */
extern const u8 vig_count;
extern const u8 vig_frames[];
extern const u8 *const vig_chars[];
extern const u16 *const vig_pals[];

/* Slots 0-3: OAM 96-99, chars 384+. Slots 4-7 (H1): OAM 50-53 (free —
   actors end at 49), chars 448+ (the weather's live at 484+ in scenes:
   documented collision, vignette.h). */
#define VIG_OAM(s) ((u16)((s) < 4 ? 96 + (s) : 50 + ((s) - 4)) << 2)
#define VIG_CHAR(s) ((s) < 4 ? 384 + (s) * 4 : 448 + ((s) - 4) * 4)

static u8 v_id[VIG_SLOTS]; /* 0xFF = empty slot */
static u8 v_frame[VIG_SLOTS];
static u8 v_mode[VIG_SLOTS]; /* 0 stop, 1 once then hide, 2 loop */
static u8 v_speed[VIG_SLOTS];
static u8 v_timer[VIG_SLOTS];
static u8 v_x[VIG_SLOTS];
static u8 v_y[VIG_SLOTS];
static u8 v_anc[VIG_SLOTS];   /* VIG_ANC_* (signed offsets when following) */
static u8 v_act[VIG_SLOTS];   /* actor followed (VIG_ANC_ACTOR) */
static u8 v_own[VIG_SLOTS];   /* 1 = driven by the animation player */
static u8 v_pi[VIG_SLOTS];    /* palette in use (0/1), 0xFF = none */
static u8 v_off[VIG_SLOTS];   /* 1 = sprite hidden, slot still reserved */
static u8 pal_vig[VIG_PALS];  /* vignette loaded in OBJ palette p */
static u8 pal_rc[VIG_PALS];   /* slots using it */
static u8 v_dirty = 0;        /* bitmask: frame to transfer */
static u8 v_pal = 0;          /* bitmask (per PALETTE): CGRAM to load */
static u8 v_init = 0;         /* statics seeded (explicit tcc init) */

/* Which OBJ palettes this context may touch. In a scene, character
   sets hold 0-4 and the weather 7: only 5 and 6 are ours. On a
   composed screen the sprites are hidden and the weather stopped, so
   almost the whole set is in the pool — palette 4 excepted, it
   belongs to the popup digits (btlprim.c), and a battle that cannot
   pop its damage numbers is not a battle. That is what lets seven
   DIFFERENT sheets stand in a fight. One documented exclusivity
   remains: btl_pose (V1) draws its static battlers on the SAME chars
   as slots 4-7 and on palettes 0-3 — a battle uses vignettes OR
   btl_pose for its party, never both. */
static u8 pal_allowed(u8 p)
{
  if (stage_active())
    return p != 4;
  return p == 5 || p == 6;
}

/* Reserves a palette for this sheet: the one already holding it, or an
   allowed unused one. 0xFF when the pool is exhausted. p IS the OBJ
   palette index (CGRAM 128 + p*16). */
static u8 pal_acquire(u8 vig_id)
{
  u8 p;

  for (p = 0; p < VIG_PALS; p++)
    if (pal_rc[p] && pal_vig[p] == vig_id && pal_allowed(p))
    {
      pal_rc[p]++;
      return p;
    }
  for (p = 0; p < VIG_PALS; p++)
    if (!pal_rc[p] && pal_allowed(p))
    {
      pal_vig[p] = vig_id;
      pal_rc[p] = 1;
      v_pal |= (u8)(1 << p); /* CGRAM to (re)load at VBlank */
      return p;
    }
  return 0xFF;
}

static void pal_release(u8 slot)
{
  u8 p = v_pi[slot];

  if (p < VIG_PALS && pal_rc[p])
    pal_rc[p]--;
  v_pi[slot] = 0xFF;
}

static void vig_init_once(void)
{
  u8 i;

  if (v_init)
    return;
  v_init = 1;
  for (i = 0; i < VIG_SLOTS; i++)
  {
    v_id[i] = 0xFF;
    v_own[i] = 0;
    v_anc[i] = VIG_ANC_SCREEN;
    v_act[i] = 0xFF;
    v_pi[i] = 0xFF;
    v_off[i] = 0;
  }
  for (i = 0; i < VIG_PALS; i++)
  {
    pal_vig[i] = 0xFF;
    pal_rc[i] = 0;
  }
  v_dirty = 0;
  v_pal = 0;
}

u8 vig_pal_available(u8 vig_id)
{
  u8 p;

  vig_init_once();
  for (p = 0; p < VIG_PALS; p++)
    if (pal_allowed(p) && (!pal_rc[p] || pal_vig[p] == vig_id))
      return 1;
  return 0;
}

void vig_show(u8 slot, u8 vig_id, u8 x, u8 y)
{
  u8 p;

  vig_init_once();
  if (slot >= VIG_SLOTS || vig_id >= vig_count)
    return;
  /* the palette first: if both are taken by other sheets, showing
     NOTHING beats showing the wrong colours */
  pal_release(slot);
  p = pal_acquire(vig_id);
  if (p == 0xFF)
  {
    vig_hide(slot);
    return;
  }
  v_pi[slot] = p;
  v_id[slot] = vig_id;
  v_frame[slot] = 0;
  v_mode[slot] = 0;
  v_own[slot] = 0; /* preemption: a scripted vig_show takes the
                      slot back from the animation player, which sees it
                      next frame and stops the animation quietly */
  v_x[slot] = x;
  v_y[slot] = y;
  v_off[slot] = 0;
  v_dirty |= (u8)(1 << slot);
}

void vig_anchor(u8 slot, u8 anchor)
{
  if (slot < VIG_SLOTS)
    v_anc[slot] = anchor;
}

void vig_anchor_actor(u8 slot, u8 index)
{
  if (slot >= VIG_SLOTS)
    return;
  v_anc[slot] = VIG_ANC_ACTOR;
  v_act[slot] = index;
}

void vig_set_frame(u8 slot, u8 frame)
{
  if (slot >= VIG_SLOTS || v_id[slot] == 0xFF)
    return;
  if (frame >= vig_frames[v_id[slot]] || frame == v_frame[slot])
    return; /* same cell: no DMA (a vignette frame = 512 b) */
  v_frame[slot] = frame;
  v_dirty |= (u8)(1 << slot);
}

void vig_set_visible(u8 slot, u8 on)
{
  if (slot >= VIG_SLOTS)
    return;
  v_off[slot] = on ? 0 : 1;
  if (!on)
    oamSetVisible(VIG_OAM(slot), OBJ_HIDE);
}

void vig_move(u8 slot, u8 x, u8 y)
{
  if (slot >= VIG_SLOTS)
    return;
  v_x[slot] = x;
  v_y[slot] = y;
}

u8 vig_free_slot(void)
{
  u8 s;

  vig_init_once();
  s = VIG_SLOTS;
  while (s--)
    if (v_id[s] == 0xFF)
      return s;
  return 0xFF;
}

void vig_own_anim(u8 slot)
{
  if (slot < VIG_SLOTS)
    v_own[slot] = 1;
}

u8 vig_is_anim(u8 slot)
{
  return (slot < VIG_SLOTS) ? v_own[slot] : 0;
}

void vig_play(u8 slot, u8 mode, u8 speed)
{
  if (slot >= VIG_SLOTS || v_id[slot] == 0xFF)
    return;
  v_mode[slot] = mode > 2 ? 2 : mode;
  v_speed[slot] = speed ? speed : 8;
  v_timer[slot] = v_speed[slot];
}

void vig_hide(u8 slot)
{
  if (slot >= VIG_SLOTS)
    return;
  pal_release(slot);
  v_id[slot] = 0xFF;
  v_own[slot] = 0;
  v_dirty &= (u8)~(1 << slot);
  oamSetVisible(VIG_OAM(slot), OBJ_HIDE);
}

void vig_reload(void)
{
  u8 s;

  if (!v_init)
    return;
  for (s = 0; s < VIG_SLOTS; s++)
    if (v_id[s] != 0xFF)
    {
      v_dirty |= (u8)(1 << s);
      if (v_pi[s] < VIG_PALS)
        v_pal |= (u8)(1 << v_pi[s]);
    }
}

void vig_update(void)
{
  u8 s, sx, sy;
  u16 wx, wy;
  u8 *om;

  if (!v_init)
    return;
  for (s = 0; s < VIG_SLOTS; s++)
  {
    if (v_id[s] == 0xFF)
      continue;
    if (v_off[s])
      continue; /* animation layer empty this frame: slot kept */
    /* animation: one step every speed frames */
    if (v_mode[s] && --v_timer[s] == 0)
    {
      v_timer[s] = v_speed[s];
      v_frame[s]++;
      if (v_frame[s] >= vig_frames[v_id[s]])
      {
        if (v_mode[s] == 1)
        {
          vig_hide(s); /* "once": the animation puts itself away */
          continue;
        }
        v_frame[s] = 0;
      }
      v_dirty |= (u8)(1 << s);
    }
    /* position: on screen, or pinned to the hero / an actor (signed
       offsets — (0,0) anchors the vignette's corner on the corner of
       the metasprite being followed) */
    if (v_anc[s] == VIG_ANC_ACTOR)
    {
      wx = actor_pos_x(v_act[s]) - camera.x + (s8)v_x[s];
      wy = actor_pos_y(v_act[s]) - camera.y + (s8)v_y[s];
      sx = (u8)wx;
      sy = (u8)wy;
    }
    else if (v_anc[s])
    {
      wx = player.x - camera.x + (s8)v_x[s];
      wy = player.y - camera.y + (s8)v_y[s];
      sx = (u8)wx;
      sy = (u8)wy;
    }
    else
    {
      sx = v_x[s];
      sy = v_y[s];
    }
    om = oamMemory + VIG_OAM(s);
    om[0] = sx;
    om[1] = sy;
    om[2] = (u8)(VIG_CHAR(s) - 256); /* chars 384+: 9th bit lives in attr */
    /* the SHEET's palette, not the slot's: two layers of the same
       animation share theirs. v_pi IS the OBJ palette index. */
    om[3] = 0x30 | ((u8)v_pi[s] << 1) | 1;
    oamSetEx(VIG_OAM(s), OBJ_LARGE, OBJ_SHOW); /* 32x32 + visible —
        reasserted every frame (a composed screen hides the whole OAM) */
  }
}

/* Cells transferred per VBlank: no more fixed ceiling, a request to the
   budget (P5). One cell = 4 DMAs of 128 bytes — the 32x32 block spans
   4 non-contiguous rows of the name grid — that is about 12 screen
   lines, 6 of them in DMA setup alone.

   The ceiling used to be 1, found by trial and error: at 2, the LAST
   TWO rows fell outside the window and VRAM IGNORED them (seen on a
   VRAM dump — the bottom half of the second cell stayed empty). Moving
   vig_vblank earlier in the sequence only got 6 of the 8 through: a
   time ceiling, not an ordering problem. P5 finally gives the
   figure: the window is 30 lines long and a dialogue frame already
   eats 29.

   The budget replaces the ceiling, so throughput now depends on the
   frame. On a quiet frame (no map streaming, clean UI layer) two
   cells get through; on a loaded frame, none. For LAYERS: K layers
   changing cell on the same frame update in K/2 to K screen frames,
   where it was a flat K before. datagen's warning about frames that
   are too short therefore still holds — it has simply become
   cautious. */

void vig_vblank(void)
{
  u8 s, r;
  const u8 *src;
  u16 base;

  if (!v_dirty && !v_pal)
    return;
  /* palettes first, one per VBlank: they only move when a sheet
     appears, never frame by frame */
  for (s = 0; s < VIG_PALS; s++)
    if (v_pal & (1 << s))
    {
      if (!vbl_take(2)) /* 1 call, 30 bytes */
        return;
      if (pal_rc[s])
        /* OBJ palette s (CGRAM 128 + s*16), colours 1-15 */
        dmaCopyCGram((u8 *)vig_pals[pal_vig[s]] + 2,
                     (u16)(128 + ((u16)s << 4) + 1), 30);
      v_pal &= (u8)~(1 << s);
      return;
    }
  for (s = 0; s < VIG_SLOTS; s++)
  {
    if (!(v_dirty & (1 << s)))
      continue;
    if (v_id[s] == 0xFF) /* hidden meanwhile: dirty bit dropped */
    {
      v_dirty &= (u8)~(1 << s);
      continue;
    }
    if (!vbl_take(VBL_COST_VIG))
      return; /* no room: the dirty bit stays, the cell will come back */
    /* current frame: 4 rows of 4 chars (512 bytes) */
    src = vig_chars[v_id[s]] + ((u16)v_frame[s] << 9);
    for (r = 0; r < 4; r++)
    {
      base = VRAM_OBJ_GFX + (((u16)VIG_CHAR(s) + ((u16)r << 4)) << 4);
      dmaCopyVram((u8 *)src + ((u16)r << 7), base, 128);
    }
    v_dirty &= (u8)~(1 << s);
  }
}
