/*
 * vignette.c — animated vignettes (B5). See vignette.h.
 *
 * OBJ char plan: slot v occupies the 32x32 block at chars
 * 384 + v*4 (rows 24-27 of the name grid — a 32x32 OBJ addresses
 * the chars c, c+1..c+3 / c+16.. / c+32.. / c+48..). datagen emits
 * the frames as 4 rows of 4 chars: a frame change is 4 DMAs of 128
 * bytes, one row at a time under the VBlank budget — see the comment
 * over vig_vblank for why the row, not the cell, is the atom.
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
   documented collision, vignette.h). TABLES, not conditionals: tcc-816
   miscompiles a ?: inside a compound shift expression — with the macro
   form of these, vig_vblank's VRAM address lost its final << 4 and
   every slot 4-7 cell landed on chars 28-31 (seen on a savestate dump:
   OAM correct, chars 448+ empty, the battler's bytes sitting in the
   sprite-set region). */
static const u16 vig_oam[VIG_SLOTS] = {
  96 << 2, 97 << 2, 98 << 2, 99 << 2, 50 << 2, 51 << 2, 52 << 2, 53 << 2
};
static const u16 vig_char[VIG_SLOTS] = {
  384, 388, 392, 396, 448, 452, 456, 460
};
#define VIG_OAM(s) (vig_oam[(s)])
#define VIG_CHAR(s) (vig_char[(s)])

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
static u8 v_row[VIG_SLOTS];   /* next cell row (0-3) still to send */

/* The PREPARED row — computed in the main loop (vig_prep, called at
   the end of vig_update), fired at the very top of vig_vblank.
   Measured (H-bugfix): computing src and base inside the VBlank costs
   ~14 scan lines of tcc-816 code between entry and the DMA; the
   window often opens for us only around line 240-250, so a transfer
   decided there never lands. Precomputed, the DMA fires within ~2
   lines of entry. The pr_* copies double as a staleness check: if
   the slot changed meanwhile (new show, new frame), the fire is
   skipped and the next vig_prep recomputes. */
static const u8 *pr_src;      /* row source (far pointer) */
static u16 pr_base;           /* row VRAM word address */
static u8 pr_slot = 0xFF;     /* slot owning the row, 0xFF = none */
static u8 pr_id, pr_frame, pr_row; /* state the row was computed for */

/* 1 << s, as data: tcc-816 compiles a variable shift into a loop —
   too slow for the paths that run inside the VBlank window. */
static const u8 vig_bit[VIG_SLOTS] = { 1, 2, 4, 8, 16, 32, 64, 128 };
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
    v_row[i] = 0;
  }
  pr_slot = 0xFF;
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
  v_row[slot] = 0;
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
  v_row[slot] = 0; /* new cell: restart its rows */
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
      v_row[s] = 0;
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
      v_row[s] = 0; /* new cell: restart its rows */
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
  /* prepare the next row to transfer: all the slow bookkeeping runs
     HERE, in the main loop, so the VBlank only has to fire it */
  pr_slot = 0xFF;
  for (s = 0; s < VIG_SLOTS; s++)
  {
    if (!(v_dirty & vig_bit[s]))
      continue;
    if (v_id[s] == 0xFF) /* hidden meanwhile: dirty bit dropped */
    {
      v_dirty &= (u8)~vig_bit[s];
      continue;
    }
    pr_src = vig_chars[v_id[s]] + ((u16)v_frame[s] << 9)
             + ((u16)v_row[s] << 7);
    pr_base = VIG_CHAR(s) + ((u16)v_row[s] << 4); /* row's char index */
    pr_base = VRAM_OBJ_GFX + (pr_base << 4);
    pr_slot = s;
    pr_id = v_id[s];
    pr_frame = v_frame[s];
    pr_row = v_row[s];
    break;
  }
}

/* The transfer atom is one ROW of the cell (1 DMA, 128 bytes, 4 lines
   declared), PREPARED in the main loop and FIRED here. It used to be
   the whole cell (4 DMAs, 15 lines) computed in place, and that
   failed twice over, both measured with the V counter on the showcase
   gobelin battle (H-bugfix):

   - the 15-line atom never fit a battle frame — after the NMI, the
     stage registers and the battle UI, 6-11 real lines remain, so the
     slot STARVED (sprites shown with empty chars: invisible until the
     ATB gauges went quiet and stopped redrawing);
   - when the ledger drifted optimistic it granted at line ~253, and
     computing src and base in place added ~14 MORE lines of tcc-816
     code before the first byte moved — the PPU silently dropped what
     ran past the window (battlers cut in half).

   Three answers, one per cause:
   - the BUDGET meters the declared ledger (throughput fairness);
   - a fresh COUNTER READ before each row (vbl_probe — the asm read,
     free) rejects a row the ledger would have granted late: the
     ledger drifts, the beam does not;
   - the row's src and base are precomputed in vig_update (main loop,
     where lines are free), so the fire itself is two compares and a
     DMA — inside the window that the probe just confirmed.

   A cell completes in 1-4 VBlanks depending on the frame's load. At
   idle animation speeds that is invisible; a fast animation on a
   loaded screen coalesces steps instead of corrupting. v_row
   remembers the next row so a cell interrupted mid-way resumes where
   it stopped — and restarts at 0 whenever a NEW cell is queued. */

void vig_vblank(void)
{
  u8 s;

  /* Palettes first, one per VBlank: they only move when a sheet
     appears, never frame by frame — and the pixels they colour are
     still at least one VBlank away (their rows fire after). */
  if (v_pal)
  {
    for (s = 0; s < VIG_PALS; s++)
      if (v_pal & vig_bit[s])
      {
        if (!vbl_take(2)) /* 1 call, 30 bytes */
          return;
        vbl_probe();
        if (vbl_v >= VBL_LAST - 2)
          return; /* ledger optimistic: CGRAM is dropped outside the
                     window just like VRAM. v_pal stays, next frame. */
        if (pal_rc[s])
          /* OBJ palette s (CGRAM 128 + s*16), colours 1-15 */
          dmaCopyCGram((u8 *)vig_pals[pal_vig[s]] + 2,
                       (u16)(128 + ((u16)s << 4) + 1), 30);
        v_pal &= (u8)~vig_bit[s];
        return;
      }
  }
  /* Fire the prepared row — the transfer is decided in two compares
     and starts within ~2 lines of entry. The staleness gate re-checks
     the slot against the state the row was computed for: a vig_show
     or an animation step between the prep and this VBlank makes the
     fire skip; the next vig_update prepares the fresh row. The
     FOLLOWING rows of the same cell are pure increments (src += 128,
     base += one grid row), so they chain in the same VBlank as long
     as the budget and the beam both agree; the cell completes in 1-4
     VBlanks depending on the frame's load. */
  s = pr_slot;
  if (s == 0xFF)
    return;
  pr_slot = 0xFF; /* consumed either way: vig_update re-preps */
  if (pr_id != v_id[s] || pr_frame != v_frame[s] || pr_row != v_row[s])
    return;
  if (!(v_dirty & vig_bit[s]))
    return;
  while (v_row[s] < 4)
  {
    if (!vbl_take(VBL_COST_VIG_ROW))
      return; /* no room: v_row and the dirty bit stay put */
    vbl_probe();
    if (vbl_v >= VBL_LAST - VBL_COST_VIG_ROW)
      return; /* the beam is past what the ledger believes */
    dmaCopyVram((u8 *)pr_src, pr_base, 128);
    pr_src += 128;
    pr_base += 256; /* next name-grid row: 16 chars of 16 words */
    v_row[s]++;
  }
  v_row[s] = 0;
  v_dirty &= (u8)~vig_bit[s];
}
