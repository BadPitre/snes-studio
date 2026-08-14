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
#include "vblnmi.h"
#include "data/vidmap.h"

/* generated register (data_vignettes.c — always emitted) */
extern const u8 vig_count;
extern const u8 vig_frames[];
extern const u8 vig_size[]; /* cell size INDEX: 0 = 16x16, 1 = 32x32,
                               2 = 64x64 (O-C) */
extern const u8 *const vig_chars[];
extern const u16 *const vig_pals[];

/* Per size index: rows of a cell, bytes per row, and the VBlank cost
   of one row on the vbudget scale (1 call + the bytes; the 128-byte
   row was measured at 4 — vbudget.h — the others scale with the DMA
   length). TABLES, not arithmetic: the sizes are powers of two and
   tcc-816 turns a variable shift into a loop. */
static const u8 vig_rows[3] = { 2, 4, 8 };
static const u16 vig_rowlen[3] = { 64, 128, 256 };
static const u8 vig_rowcost[3] = { 3, 4, 6 };

/* Slot OAM entries and char bases come from the GENERATED video map
   (data/vidmap.h — datagen computes it per project and checks the
   sprite sets against it, PLANNING_VIDMAP.md). TABLES, not
   conditionals: tcc-816 miscompiles a ?: inside a compound shift
   expression — with the macro form of these, vig_vblank's VRAM address
   lost its final << 4 and every slot 4-7 cell landed on chars 28-31
   (seen on a savestate dump: OAM correct, chars 448+ empty, the
   battler's bytes sitting in the sprite-set region). */
static const u16 vig_oam[VIG_SLOTS] = VID_VIG_OAMS;
static const u16 vig_char[VIG_SLOTS] = VID_VIG_CHARS;
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
static u8 v_shadow[VIG_SLOTS]; /* owner slot of the 64x64 QUAD covering
    this slot, 0xFF free. A 64x64 cell (size 2) is FOUR 32x32 OBJs and
    its 8x8-char block is exactly the char blocks of slots
    {s, s+1, s+4, s+5} — so a 64 shown in slot 0 or 2 freezes its three
    neighbours (their chars AND their OAM entries display the other
    quadrants) until vig_hide. */
static u8 pal_vig[VIG_PALS];  /* vignette loaded in OBJ palette p */
static u8 pal_rc[VIG_PALS];   /* slots using it */
static u8 v_dirty = 0;        /* bitmask: frame to transfer */

/* The cell's transfer lives in the DISPATCHER since V-NMI (vblnmi.c):
   vig_update publishes ONE descriptor — src, VRAM base, the cell's
   rows walking the 16-char name grid — and the dispatcher fires it
   from the NMI ISR (fast lane, ~line 227) or from the tail under the
   budget. The descriptor carries its own row progress, so v_row and
   the pr_* statics of the H-bugfix era are gone; what remains here
   is WHICH slot is in flight and the seq snapshot that lets the
   producer tell "landed whole" from "cancelled under a mutation".
   The measurements that shaped this contract (starved 15-line atoms,
   ~14 lines of in-window tcc address computation, rows dropped past
   the beam) are retold in vblnmi.h and PLANNING_VBLANK_UNIFIE.md. */
static u8 vp_slot = 0xFF; /* slot whose cell is in flight, 0xFF none */
static u8 vp_seq = 0;     /* vn_seq(VN_VIG) at publish time */

/* 1 << s, as data: tcc-816 compiles a variable shift into a loop —
   too slow for the paths that run inside the VBlank window. */
static const u8 vig_bit[VIG_SLOTS] = { 1, 2, 4, 8, 16, 32, 64, 128 };

static u8 v_pal = 0;          /* bitmask (per PALETTE): CGRAM to load */
static u8 v_init = 0;         /* statics seeded (explicit tcc init) */

/* Mutation notice to the dispatcher: any change under a published
   cell (new show, frame step, hide, reload) makes the in-flight
   descriptor stale. ONE seq for all slots — a mutation of slot B
   restarts slot A's interrupted cell, a rare and harmless redundancy
   that buys not carrying eight counters. */
static void vig_touch(void)
{
  vn_bump(VN_VIG);
}

/* Which OBJ palettes this context may touch. In a scene, character
   sets hold 0-4: the pool is the generated pair {A, B} plus C, the
   weather's palette, which datagen frees (7) when no weather command
   exists in the project and seals (0xFF, never matches) otherwise.
   On a composed screen the sprites are hidden and the weather
   stopped, so almost the whole set is in the pool — the digit palette
   excepted, it belongs to the popups (btlprim.c), and a battle that
   cannot pop its damage numbers is not a battle. That is what lets
   seven DIFFERENT sheets stand in a fight. One documented exclusivity
   remains: btl_pose (V1) draws its static battlers on the SAME chars
   as slots 4-7 and on palettes 0-3 — a battle uses vignettes OR
   btl_pose for its party, never both. */
static u8 pal_allowed(u8 p)
{
  if (stage_active())
    return p != VID_DIG_PAL;
  return p == VID_VIG_PAL_A || p == VID_VIG_PAL_B || p == VID_VIG_PAL_C;
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

/* Hides every OAM entry the slot drives: one, or the four quadrants
   of a 64x64. Call BEFORE clearing v_id — the size is read from it. */
static void vig_oam_hide(u8 s)
{
  oamSetVisible(VIG_OAM(s), OBJ_HIDE);
  if (v_id[s] != 0xFF && vig_size[v_id[s]] == 2)
  {
    oamSetVisible(VIG_OAM(s + 1), OBJ_HIDE);
    oamSetVisible(VIG_OAM(s + 4), OBJ_HIDE);
    oamSetVisible(VIG_OAM(s + 5), OBJ_HIDE);
  }
}

/* Releases the three slots a 64x64 in slot s froze (no-op otherwise). */
static void quad_release(u8 s)
{
  if (v_shadow[s + 1] == s)
    v_shadow[s + 1] = 0xFF;
  if (v_shadow[s + 4] == s)
    v_shadow[s + 4] = 0xFF;
  if (v_shadow[s + 5] == s)
    v_shadow[s + 5] = 0xFF;
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
    v_shadow[i] = 0xFF;
  }
  vp_slot = 0xFF;
  vn_cancel(VN_VIG);
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
  if (v_shadow[slot] != 0xFF)
    return; /* frozen under a neighbour's 64x64 quad */
  /* 64x64 (O-C): only slots 0 and 2 have the {s+1, s+4, s+5}
     neighbours whose chars the quad covers, and those three must be
     empty — datagen enforces the slot for named sheets, this guards
     the sheet-from-variable path. */
  if (vig_size[vig_id] == 2)
  {
    if (slot != 0 && slot != 2)
      return;
    if (v_id[slot + 1] != 0xFF || v_id[slot + 4] != 0xFF ||
        v_id[slot + 5] != 0xFF)
      return;
    if (v_shadow[slot + 1] != 0xFF || v_shadow[slot + 4] != 0xFF ||
        v_shadow[slot + 5] != 0xFF)
      return;
  }
  /* the palette first: if both are taken by other sheets, showing
     NOTHING beats showing the wrong colours */
  pal_release(slot);
  p = pal_acquire(vig_id);
  if (p == 0xFF)
  {
    vig_hide(slot);
    return;
  }
  /* the previous occupant may have been a quad; the new sheet claims
     its own shape */
  vig_oam_hide(slot);
  quad_release(slot);
  if (vig_size[vig_id] == 2)
  {
    v_shadow[slot + 1] = slot;
    v_shadow[slot + 4] = slot;
    v_shadow[slot + 5] = slot;
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
  vig_touch(); /* an in-flight cell for any slot is now stale */
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
    return; /* same cell: no DMA (a frame = cell^2/2 bytes) */
  v_frame[slot] = frame;
  vig_touch(); /* new cell: the published one is stale */
  v_dirty |= (u8)(1 << slot);
}

void vig_set_visible(u8 slot, u8 on)
{
  if (slot >= VIG_SLOTS)
    return;
  v_off[slot] = on ? 0 : 1;
  if (!on)
    vig_oam_hide(slot);
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
    if (v_id[s] == 0xFF && v_shadow[s] == 0xFF)
      return s; /* a shadowed slot shows a 64x64's quadrant: not free */
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
  vig_oam_hide(slot); /* BEFORE v_id clears: it reads the size */
  quad_release(slot);
  vig_touch(); /* an in-flight cell for this slot must not land */
  v_id[slot] = 0xFF;
  v_own[slot] = 0;
  v_dirty &= (u8)~(1 << slot);
}

void vig_reload(void)
{
  u8 s;

  if (!v_init)
    return;
  vig_touch(); /* whatever was in flight predates the reload */
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
    if (v_pi[s] < VIG_PALS && (v_pal & vig_bit[v_pi[s]]))
    {
      /* The sheet's palette has not reached CGRAM yet: shown now, the
         sprite would parade in whatever colours the palette slot last
         held (seen at battle open once the NMI fire made the PIXELS
         arrive first — the chars beat the colours by a few frames).
         Hidden until the palette lands; it only happens when a sheet
         APPEARS, a few frames at most. */
      vig_oam_hide(s);
      continue;
    }
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
      vig_touch(); /* new cell: the published one is stale */
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
    /* the SHEET's palette, not the slot's: two layers of the same
       animation share theirs. v_pi IS the OBJ palette index. The
       attribute byte and the size are reasserted every frame (a
       composed screen hides the whole OAM). */
    {
      u8 attr = 0x30 | ((u8)v_pi[s] << 1) | 1; /* chars >= 256 by the
          vidmap's construction: bit 8 baked to 1 */
      u8 sz = vig_size[v_id[s]];

      om = oamMemory + VIG_OAM(s);
      om[0] = sx;
      om[1] = sy;
      om[2] = (u8)(VIG_CHAR(s) - 256);
      om[3] = attr;
      oamSetEx(VIG_OAM(s), sz == 0 ? OBJ_SMALL : OBJ_LARGE, OBJ_SHOW);
      if (sz == 2)
      {
        /* the three other 32x32 quadrants, on the frozen neighbours'
           OAM entries and char blocks (the quad layout — see
           v_shadow's comment). Positions clamp by u8 wrap; the editor
           keeps 64x64 cells inside 0-192 / 0-160. */
        om = oamMemory + VIG_OAM(s + 1);
        om[0] = (u8)(sx + 32);
        om[1] = sy;
        om[2] = (u8)(VIG_CHAR(s + 1) - 256);
        om[3] = attr;
        oamSetEx(VIG_OAM(s + 1), OBJ_LARGE, OBJ_SHOW);
        om = oamMemory + VIG_OAM(s + 4);
        om[0] = sx;
        om[1] = (u8)(sy + 32);
        om[2] = (u8)(VIG_CHAR(s + 4) - 256);
        om[3] = attr;
        oamSetEx(VIG_OAM(s + 4), OBJ_LARGE, OBJ_SHOW);
        om = oamMemory + VIG_OAM(s + 5);
        om[0] = (u8)(sx + 32);
        om[1] = (u8)(sy + 32);
        om[2] = (u8)(VIG_CHAR(s + 5) - 256);
        om[3] = attr;
        oamSetEx(VIG_OAM(s + 5), OBJ_LARGE, OBJ_SHOW);
      }
    }
  }
  /* The producer's half of the dispatcher contract (vblnmi.h): read
     the fate of the cell in flight, then publish the next dirty one.
     All the slow bookkeeping runs HERE, in the main loop — the lanes
     only fire descriptors. */
  if (vp_slot != 0xFF)
  {
    if (vn_seq(VN_VIG) != vp_seq)
      vn_cancel(VN_VIG); /* mutated under the descriptor: the dirty
          bit survives, the republish below reads the fresh state */
    else if (vn_busy(VN_VIG))
      return; /* still in flight, untouched: let it land */
    else
      v_dirty &= (u8)~vig_bit[vp_slot]; /* landed whole */
    vp_slot = 0xFF;
  }
  for (s = 0; s < VIG_SLOTS; s++)
  {
    if (!(v_dirty & vig_bit[s]))
      continue;
    if (v_id[s] == 0xFF) /* hidden meanwhile: dirty bit dropped */
    {
      v_dirty &= (u8)~vig_bit[s];
      continue;
    }
    /* frame offset per cell size — CONSTANT shifts in branches (a
       variable shift is a tcc-816 loop): a frame is cell^2/2 bytes
       (128/512/2048). The descriptor starts at row 0 and carries its
       own progress: an interrupted cell resumes from the descriptor,
       on either lane, so no v_row lives here anymore. */
    {
      const u8 *src;
      u16 base;
      u8 sz = vig_size[v_id[s]];

      if (sz == 0)
        src = vig_chars[v_id[s]] + ((u16)v_frame[s] << 7);
      else if (sz == 1)
        src = vig_chars[v_id[s]] + ((u16)v_frame[s] << 9);
      else
        src = vig_chars[v_id[s]] + ((u16)v_frame[s] << 11);
      base = VRAM_OBJ_GFX + ((u16)VIG_CHAR(s) << 4);
      /* dst walks the 16-char name grid: 256 words per cell row */
      vn_publish(VN_VIG, src, base, vig_rowlen[sz], vig_rows[sz],
                 256, vig_rowcost[sz]);
    }
    vp_slot = s;
    vp_seq = vn_seq(VN_VIG);
    break;
  }
}

/* The cell rows moved to the dispatcher (vblnmi.c) with V-NMI: the
   ISR lane fires them at ~line 227 and the tail lane (vbl_nmi_tail,
   called by main.c right after this) drains the rest under the
   budget. What remains here is the CGRAM half — palettes are not
   VRAM descriptors until the dispatcher grows a ctrl field (V3). */
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
}
