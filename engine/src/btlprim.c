/*
 * btlprim.c — the battle primitives (PLANNING_COMBAT_EN_EVENTS.md §2).
 *
 * The C1/C4 recipes, lifted out of btl.c's machine and put behind
 * event commands so the project's OWN scripts can run a battle:
 * battler pose (chars 448+, OAM 104-107), damage popup (digit sheet
 * on chars 336+, OAM 100-103), the gauge clock, the target cursor.
 * Same VRAM/OAM territory as btl.c on purpose — a scripted battle and
 * a BATTLE-opcode battle never share a stage.
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
#include "vm.h"
#include "vram.h"

/* data_battle.c — always emitted, zeroed without battle data */
extern const u8 btl_hero_count;
extern const u8 *const btl_hero_cells[];
extern const u16 btl_hero_pals[]; /* 4 x 16 colours, flat */
extern const u8 btl_digit_cells[]; /* 32 chars: 0-9 on the even ones */
extern const u16 btl_digit_pal[];  /* white + shadow, OBJ palette 4 */

#define BP_CHAR(h) (448 + (h) * 4) /* the hero's 32x32 OBJ block */
#define BP_OAM(h) ((u16)(104 + (h)) << 2)
#define BP_DIGCHAR 336
#define BP_POPOAM(i) ((u16)(100 + (i)) << 2)

/* ---- poses (BTLPOSE) ---- */
static u8 bp_shown = 0; /* bit h: battler posed */
static u8 bp_have = 0;  /* bit h: cells+palette in VRAM this session */
static u8 bp_x[4];
static u8 bp_y[4];
static u8 bp_q = 0;   /* upload queue, bit h (order: low bit first) */
static u8 bp_up = 0;  /* hero being uploaded (when bp_q has its bit) */
static u8 bp_row = 0; /* next 128-byte step of the current cell */

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

void btlprim_pose(u8 hero, u8 x, u8 y, u8 op)
{
  u8 bit;

  if (hero >= btl_hero_count || !stage_active())
    return;
  bit = (u8)(1 << hero);
  if (!op)
  {
    bp_shown &= (u8)~bit;
    oamSetVisible(BP_OAM(hero), OBJ_HIDE);
    return;
  }
  bp_x[hero] = x;
  bp_y[hero] = y;
  bp_shown |= bit;
  if (!(bp_have & bit))
    bp_q |= bit; /* first show this session: queue the upload */
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

/* Walked range: 4 heroes, or the stage's 5 slots. */
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

/* The party's OAM entries, reasserted every stage frame — the
   vignette discipline (btl.c's bt_oam, with the cursor's blink). */
static void bp_oam(void)
{
  u8 h;
  u8 *om;

  for (h = 0; h < btl_hero_count; h++)
  {
    if (!((bp_shown >> h) & 1) || !((bp_have >> h) & 1) ||
        (tg_on && tg_ally && h == tg_cur && (tg_blink & 8)))
    {
      oamSetVisible(BP_OAM(h), OBJ_HIDE);
      continue;
    }
    om = oamMemory + BP_OAM(h);
    om[0] = bp_x[h];
    om[1] = bp_y[h];
    om[2] = (u8)(BP_CHAR(h) - 256); /* 9th char bit rides attr bit 0 */
    om[3] = (u8)(0x30 | (h << 1) | 1); /* prio 3, OBJ palette h */
    oamSetEx(BP_OAM(h), OBJ_LARGE, OBJ_SHOW);
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
    om[3] = 0x39; /* prio 3, OBJ palette 4, char bit 8 */
    oamSetEx(BP_POPOAM(i), OBJ_SMALL, OBJ_SHOW);
  }
  if (pop_t && dig_up == 2)
    pop_t--; /* the timer only runs once the digits can show */
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
    /* the session's visual state dies with the screen */
    bp_shown = 0;
    bp_have = 0;
    bp_q = 0;
    bp_row = 0;
    dig_want = 0;
    dig_up = 0;
    pop_t = 0;
    tg_on = 0;
    return;
  }
  bp_oam();
  pop_oam();
}

void btlprim_vblank(void)
{
  const u8 *src;
  u16 base, ofs;

  if (!stage_active() || stage_busy())
    return; /* the stage's own transfers keep the bus */
  /* battler cells first: a queued pose is a script WAITING */
  if (bp_q)
  {
    if (!((bp_q >> bp_up) & 1))
    {
      for (bp_up = 0; bp_up < 4 && !((bp_q >> bp_up) & 1); bp_up++)
      {
      }
      bp_row = 0;
      return;
    }
    /* ONE 128-byte transfer per frame — a burst straddling the end of
       the window lost its tail (the C1/C4 lesson, kept). */
    if (bp_row < 4)
    {
      if (!vbl_take(6))
        return;
      src = btl_hero_cells[bp_up];
      ofs = bp_row;
      ofs <<= 7;
      src += ofs; /* the cell's 128-byte row */
      base = BP_CHAR(bp_up);
      base <<= 4;
      base += VRAM_OBJ_GFX;
      ofs = bp_row;
      ofs <<= 8;
      base += ofs; /* one name row = 16 chars = 256 words */
      dmaCopyVram((u8 *)src, base, 128);
      bp_row++;
      return;
    }
    if (!vbl_take(2))
      return;
    ofs = bp_up;
    ofs <<= 4;
    dmaCopyCGram((u8 *)(btl_hero_pals + ofs), (u16)(128 + ofs), 32);
    bp_have |= (u8)(1 << bp_up);
    bp_q &= (u8)~(1 << bp_up);
    bp_row = 0;
    return;
  }
  /* then the digit sheet, once a popup wants it */
  if (dig_want && dig_up == 0)
  {
    if (!vbl_take(11))
      return;
    dmaCopyVram((u8 *)btl_digit_cells,
                (u16)(VRAM_OBJ_GFX + ((u16)BP_DIGCHAR << 4)), 1536);
    dig_up = 1;
    return;
  }
  if (dig_want && dig_up == 1)
  {
    if (!vbl_take(2))
      return;
    dmaCopyCGram((u8 *)btl_digit_pal, 192, 32); /* OBJ palette 4 */
    dig_up = 2;
  }
}
