/*
 * btlprim.c — the battle primitives (PLANNING_COMBAT_EN_EVENTS.md §2).
 *
 * The C1/C4 recipes, lifted out of btl.c's machine and put behind
 * event commands so the project's OWN scripts can run a battle:
 * battler pose, damage popup (digit sheet), the gauge clock, the
 * target cursor. Chars, OAM entries and palettes come from the
 * GENERATED video map (data/vidmap.h, PLANNING_VIDMAP.md).
 *
 * Visual state (poses, popup, uploads) belongs to the stage SESSION:
 * when the composed screen goes down, everything is forgotten. The
 * clock is the exception — a generic per-frame service on ordinary
 * variables, it runs on maps too and stops only on demand.
 */
#include <snes.h>
#include "btlprim.h"
#include "stage.h"
#include "vbudget.h"
#include "vblnmi.h"
#include "vm.h"
#include "vram.h"
#include "data/vidmap.h"

/* data_battle.c — always emitted, zeroed without battle data */
extern const u8 btl_battler_count; /* entries of the `heroes` db table */
extern const u8 *const btl_battler_cells[];
extern const u16 btl_battler_pals[]; /* 16 colours per entry, flat */
extern const u8 btl_digit_cells[]; /* 48 chars: 3 name rows, 0-9 on the
    even columns, 8 and 9 in the bottom half (battle.rs) */
extern const u16 btl_digit_pal[];  /* white + shadow, the digit palette */

/* Four battler SLOTS (a 32x32 cell each) and OBJ palettes 0-3 (CGRAM
   128 + slot*16). Char and OAM bases come from the GENERATED video map
   (data/vidmap.h): the cells alias vignette slots 4-7 by design — the
   documented exclusivity in vignette.h. The slot count is what VRAM
   allows; WHICH database entry a slot shows is the script's business
   (bp_ent) — that is how a party is swapped. */
#define BP_CHAR(h) (VID_BP_CHAR_BASE + (h) * 4)
#define BP_OAM(h) ((u16)(VID_BP_OAM_BASE + (h)) << 2)
#define BP_DIGCHAR VID_DIG_CHAR
#define BP_POPOAM(i) ((u16)(VID_POP_OAM_BASE + (i)) << 2)

/* ---- poses (BTLPOSE) ---- */
static u8 bp_shown = 0; /* bit h: battler posed */
static u8 bp_have = 0;  /* bit h: cells+palette in VRAM this session */
static u8 bp_x[4];
static u8 bp_y[4];
static u8 bp_ent[4] = { 0, 0, 0, 0 }; /* db entry shown per slot
    (explicit: tcc-816 does not clear the BSS) */
static u8 bp_q = 0;   /* upload queue, bit h (order: low bit first;
    the bit stays set until the PALETTE lands — btlprim_busy) */
static u8 bp_pal = 0; /* bit h: cells landed, palette still to load */

/* The cell and digit-sheet transfers travel as DESCRIPTORS on the
   dispatcher's VN_BP slot since V-NMI (vblnmi.h): bp_prep publishes,
   the ISR or the tail fires, and the descriptor carries its own row
   progress — bp_up/bp_row are gone. What remains is WHAT is in
   flight and the seq snapshot that tells "landed" from "cancelled". */
static u8 bp_pub = 0xFF; /* 0-3 battler slot, 0xFE digit sheet */
static u8 bp_seq = 0;    /* vn_seq(VN_BP) at publish time */

/* ---- popup (POPUP) ---- */
static u8 dig_want = 0; /* a popup asked for the digit sheet */
static u8 dig_up = 0;   /* 0 no, 1 cells in, 2 cells + palette in */
static u8 pop_t = 0;    /* frames left (0: hidden) */
static u8 pop_n = 0;    /* digit count */
static u8 pop_d[4];     /* digit values, units first */
static u8 pop_x, pop_y;

/* ---- clock (CLOCK) ---- */
static u8 ck_base = 0;
static u8 ck_n = 0;

/* ---- target cursor (TARGETSEL) ---- */
static u8 tg_on = 0;
static u8 tg_ally = 0;
static u8 tg_cur = 0;
static u8 tg_blink = 0;

void btlprim_pose(u8 slot, u8 entry, u8 x, u8 y, u8 op)
{
  u8 bit;

  if (slot >= 4 || !stage_active())
    return;
  bit = (u8)(1 << slot);
  if (!op)
  {
    bp_shown &= (u8)~bit;
    oamSetVisible(BP_OAM(slot), OBJ_HIDE);
    return;
  }
  if (entry >= btl_battler_count)
    return; /* no such entry in the heroes table */
  if (bp_ent[slot] != entry)
  {
    /* the slot changes character: its cells and palette are stale —
       including a descriptor in flight for the OLD entry (vn_bump
       drops it on both lanes; bp_prep republishes from bp_ent) */
    bp_ent[slot] = entry;
    bp_have &= (u8)~bit;
    bp_pal &= (u8)~bit;
    vn_bump(VN_BP);
  }
  bp_x[slot] = x;
  bp_y[slot] = y;
  bp_shown |= bit;
  if (!(bp_have & bit))
    bp_q |= bit; /* not in VRAM yet: queue the upload */
}

u8 btlprim_busy(void)
{
  return bp_q != 0;
}

void btlprim_popup(u16 v, u8 x, u8 y)
{
  if (!stage_active())
    return; /* the digit sheet's chars are only ours on a stage */
  pop_n = 0;
  if (v > 9999)
    v = 9999;
  do
  {
    pop_d[pop_n++] = (u8)(v % 10);
    v /= 10;
  } while (v && pop_n < 4);
  pop_x = x;
  pop_y = y;
  pop_t = 48;
  dig_want = 1;
}

void btlprim_clock(u8 base, u8 n)
{
  ck_base = base;
  ck_n = n > 8 ? 8 : n;
}

/* Candidate test: an occupied stage slot, or a posed living battler.
   "Living" is not this module's business — hiding a KO'd hero is the
   script's job (BTLPOSE op 0), and hidden battlers are skipped. */
static u8 tg_ok(u8 k)
{
  return tg_ally ? (u8)((bp_shown >> k) & 1) : stage_slot_used(k);
}

/* Walked range: 4 battler slots, or the stage's 5 slots. */
#define TG_N (tg_ally ? 4 : STAGE_SLOTS)

u8 btlprim_target_begin(u8 ally)
{
  u8 k;

  tg_ally = ally;
  for (k = 0; k < TG_N; k++)
    if (tg_ok(k))
    {
      tg_on = 1;
      tg_cur = k;
      tg_blink = 0;
      return k;
    }
  return 0xFF;
}

void btlprim_target_step(u8 dir)
{
  u8 i, k, n;

  n = TG_N;
  for (i = 1; i <= n; i++)
  {
    k = dir ? (u8)((tg_cur + i) % n) : (u8)((tg_cur + n + n - i) % n);
    if (tg_ok(k))
    {
      if (!tg_ally && k != tg_cur)
        stage_slotfx(tg_cur, 0, 0); /* palette back on the one we leave */
      tg_cur = k;
      break;
    }
  }
}

u8 btlprim_target_end(void)
{
  if (!tg_ally)
    stage_slotfx(tg_cur, 0, 0); /* restore before whatever lands next */
  tg_on = 0;
  return tg_cur;
}

void btlprim_target_tick(void)
{
  tg_blink++;
  if (!tg_ally && (tg_blink & 15) == 0)
    stage_slotfx(tg_cur, 1, 4); /* a short pulse on the candidate */
}

/* The posed battlers' OAM entries, reasserted every stage frame — the
   vignette discipline, with the target cursor's blink. */
static void bp_oam(void)
{
  u8 h, bit, show;
  u8 *om;

  bit = 1;
  for (h = 0; h < 4; h++)
  {
    /* Split into single tests on masks — the natural form,
       !((bp_shown >> h) & 1) || !((bp_have >> h) & 1) || (tg...),
       is MISCOMPILED by tcc-816 (a variable shift inside a chained
       ||): it took the show branch with both masks at ZERO, parading
       four garbage battlers at (0x55, 0x55) over every battle that
       had pixels on chars 448+. Found when the H1 battler vignettes
       first put pixels there; measured with counters in the branch
       (112 shows, 0 hides, bp_shown == 0). Same family as the
       "variable declared in a case" codegen bug the regression
       caught in a dialogue frame. */
    show = 0;
    if (bp_shown & bit)
      if (bp_have & bit)
        show = 1;
    if (show)
      if (tg_on)
        if (tg_ally)
          if (h == tg_cur)
            if (tg_blink & 8)
              show = 0; /* ally-target blink hides its battler */
    if (!show)
    {
      oamSetVisible(BP_OAM(h), OBJ_HIDE);
      bit = (u8)(bit << 1);
      continue;
    }
    om = oamMemory + BP_OAM(h);
    om[0] = bp_x[h];
    om[1] = bp_y[h];
    om[2] = (u8)(BP_CHAR(h) - 256); /* 9th char bit rides attr bit 0 */
    om[3] = (u8)(0x30 | (h << 1) | 1); /* prio 3, OBJ palette h */
    oamSetEx(BP_OAM(h), OBJ_LARGE, OBJ_SHOW);
    bit = (u8)(bit << 1);
  }
}

/* The popup's OAM — btl.c's bt_pop_oam, gated on the digit sheet. */
static void pop_oam(void)
{
  u8 i, y;
  u8 *om;

  y = (u8)(pop_y - ((u8)(48 - pop_t) >> 2)); /* rises 12 px, then holds */
  for (i = 0; i < 4; i++)
  {
    if (!pop_t || i >= pop_n || dig_up < 2)
    {
      oamSetVisible(BP_POPOAM(i), OBJ_HIDE);
      continue;
    }
    om = oamMemory + BP_POPOAM(i);
    /* units digit (pop_d[0]) rightmost; 8 and 9 live in the BOTTOM
       half of their cell (sheet rule) — risen 8 px to line up */
    om[0] = (u8)(pop_x + (((u16)(pop_n - 1 - i)) << 3));
    om[1] = pop_d[i] < 8 ? y : (u8)(y - 8);
    om[2] = (u8)(pop_d[i] < 8
                     ? BP_DIGCHAR - 256 + (pop_d[i] << 1)
                     : BP_DIGCHAR - 256 + ((pop_d[i] - 8) << 1) + 16);
    om[3] = 0x30 | (VID_DIG_PAL << 1) | 1; /* prio 3, digit palette,
        char bit 8 (folded to a constant at compile time) */
    oamSetEx(BP_POPOAM(i), OBJ_SMALL, OBJ_SHOW);
  }
  if (pop_t && dig_up == 2)
    pop_t--; /* the timer only runs once the digits can show */
}

/* The producer's half of the dispatcher contract (vblnmi.h), run in
   the MAIN LOOP where lines are free: read the fate of the published
   descriptor, then publish the next transfer. Battler cells first —
   a queued pose is a script WAITING — then the digit sheet. */
static void bp_prep(void)
{
  u8 h, bit;
  const u8 *src;
  u16 base;

  if (bp_pub != 0xFF)
  {
    if (vn_seq(VN_BP) != bp_seq)
      vn_cancel(VN_BP); /* mutated underneath: republish fresh below */
    else if (vn_busy(VN_BP))
      return; /* still in flight: let it land */
    else if (bp_pub == 0xFE)
      dig_up = 1; /* sheet landed whole: palette next (the tail) */
    else
      bp_pal |= (u8)(1 << bp_pub); /* cells landed: palette next */
    bp_pub = 0xFF;
  }
  if (stage_busy())
    return; /* the laying owns the window — poses upload after it,
               exactly the pre-V2 timing */
  for (h = 0; h < 4; h++)
  {
    bit = (u8)(1 << h);
    if (!(bp_q & bit) || (bp_pal & bit))
      continue; /* nothing queued, or only the palette remains */
    src = btl_battler_cells[bp_ent[h]];
    base = BP_CHAR(h);
    base <<= 4;
    base += VRAM_OBJ_GFX;
    /* 4 rows of 128 bytes walking the 16-char name grid — the same
       row a 32x32 vignette transfers, at the same measured cost. */
    vn_publish(VN_BP, src, base, 128, 4, 256, 4);
    bp_pub = h;
    bp_seq = vn_seq(VN_BP);
    return;
  }
  if (dig_want && dig_up == 0)
  {
    /* the digit sheet: once the engine's largest ATOM (1536 bytes,
       11 lines in one unprobed bite — dropped whole on a drifted
       ledger), now 3 sub-transfers of 512 bytes the descriptor
       resumes across VBlanks. */
    vn_publish(VN_BP, btl_digit_cells,
               (u16)(VRAM_OBJ_GFX + ((u16)BP_DIGCHAR << 4)),
               512, 3, 256, 10);
    bp_pub = 0xFE;
    bp_seq = vn_seq(VN_BP);
  }
}

void btlprim_update(void)
{
  u8 i;
  u16 g;

  /* The clock: the one per-frame service, stage or not. Speed/4 a
     frame, saturating at 255 — btl.c's exact gauge arithmetic, on
     ordinary variables. */
  for (i = 0; i < ck_n; i++)
  {
    g = vm.vars16[(u8)(ck_base + (i << 1))] +
        ((vm.vars16[(u8)(ck_base + (i << 1) + 1)] & 255) >> 2);
    vm.vars16[(u8)(ck_base + (i << 1))] = g > 255 ? 255 : g;
  }

  if (!stage_active())
  {
    if (bp_have | pop_n)
    {
      /* the screen just closed: hide our OAM entries once — nothing
         else rebuilds 100-107, and a stale popup or battler would
         float over the map (seen in V2's first full battle) */
      for (i = 0; i < 4; i++)
      {
        oamSetVisible(BP_POPOAM(i), OBJ_HIDE);
        oamSetVisible(BP_OAM(i), OBJ_HIDE);
      }
      pop_n = 0;
    }
    /* the session's visual state dies with the screen — including
       whatever descriptor was still in flight (once: this branch
       runs EVERY map frame, and the demo's dialogue frames sit close
       enough to the line that two long calls a frame moved the pixel
       regression) */
    if (bp_pub != 0xFF)
    {
      bp_pub = 0xFF;
      vn_bump(VN_BP);
      vn_cancel(VN_BP);
    }
    bp_shown = 0;
    bp_have = 0;
    bp_q = 0;
    bp_pal = 0;
    dig_want = 0;
    dig_up = 0;
    pop_t = 0;
    tg_on = 0;
    return;
  }
  bp_oam();
  pop_oam();
  bp_prep();
}

/* PALETTES only since V-NMI: the cells and the digit sheet travel as
   descriptors, fired by the dispatcher's two lanes. Pixels landing
   before their colours is safe HERE because display is gated on the
   palette's own flag (bp_have / dig_up == 2) — the OAM entry stays
   hidden until both halves are in. The probe is the one this tail
   never had: an unprobed take dropped the transfer silently on a
   drifted ledger, the exact failure vignette.c documented. */
void btlprim_vblank(void)
{
  u8 h, bit;
  u16 base, ofs;

  if (!stage_active() || stage_busy())
    return; /* the stage's own transfers keep the bus */
  for (h = 0; h < 4; h++)
  {
    bit = (u8)(1 << h);
    if (!(bp_pal & bit))
      continue;
    if (!vbl_take(2))
      return;
    vbl_probe();
    if (vbl_v >= VBL_LAST - 2)
      return; /* the beam is past what the ledger believes */
    /* palette of the ENTRY, into the SLOT's OBJ palette */
    ofs = bp_ent[h];
    ofs <<= 4;
    base = h;
    base <<= 4;
    dmaCopyCGram((u8 *)(btl_battler_pals + ofs), (u16)(128 + base), 32);
    bp_have |= bit;
    bp_pal &= (u8)~bit;
    bp_q &= (u8)~bit; /* the pose is DONE: btlprim_busy releases */
    return; /* one palette a frame: they only move on a pose change */
  }
  if (dig_want && dig_up == 1)
  {
    if (!vbl_take(2))
      return;
    vbl_probe();
    if (vbl_v >= VBL_LAST - 2)
      return;
    dmaCopyCGram((u8 *)btl_digit_pal, 128 + (VID_DIG_PAL << 4), 32);
    dig_up = 2;
  }
}
