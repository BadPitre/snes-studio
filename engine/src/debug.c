/*
 * debug.c — in-game debug panel (S6).
 *
 * Compiled into every ROM but INERT without the dbg_enabled flag
 * (data_debug.c, emitted by datagen — "--debug" comes from the
 * editor's Play button, never from a cartridge build).
 *
 * Start+Select+R toggles a 2-row panel at the top of the UI layer
 * (BG3, above everything — dialogues, pictures, HUD):
 *
 *   FPS 60  LAG 00000
 *   SCN 02163/32768  TXT 00541/32768
 *
 * FPS: main loop iterations scaled to 60 VBlanks (window ~1 s). LAG:
 * display frames missed since boot — BLOCKING transitions (warp and
 * picture fades, 16 frames each) count in it: seeing it climb during
 * a warp is normal, seeing it climb while walking is not. SCN/TXT:
 * bytes actually used in the scene and text banks (32 KB each),
 * measured by datagen when it generates the data.
 *
 * PERF — a lesson paid for dearly: the game loop can be a few thousand
 * cycles from overrunning, and a panel that redraws every frame
 * BECOMES the lag it displays (feedback: lag -> redraw -> missed frame
 * -> lag). Hence: NO division here (the 65816 has none and tcc-816's
 * cost thousands of cycles), a LAG counter kept digit by digit
 * (carry), and rewriting limited to the cells that change — the full
 * re-blit only fires when a UI module has repainted our rows
 * (ui_dirty_overlap).
 */
#include <snes.h>
#include "debug.h"
#include "ui_screen.h"
#include "ui_overlay.h"

/* data_debug.c (always emitted by datagen) — the SCN/TXT row arrives
   PRE-FORMATTED (multi-bank M1: totals too large for a u16, and no
   division here) */
extern const u8 dbg_enabled;
extern const char dbg_banks_txt[];

extern u16 snes_vblank_count; /* PVSnesLib NMI counter */

#define DBG_COMBO (KEY_START | KEY_SELECT | KEY_R)
/* same entry as the overlay: project font (base 1), font palette +
   priority */
#define DBG_ENTRY(a) (((u16)(a)-31) | 0x3000)
#define DBG_FPS_COL 4 /* columns of the live values (row 0) */
#define DBG_LAG_COL 12

static u8 dbg_on = 0;
static u8 dbg_held = 0;    /* combo auto-repeat guard */
static u8 dbg_started = 0; /* first measurement: seeds dbg_last_vbl */
static u16 dbg_last_vbl = 0;
static u16 dbg_iters = 0; /* iterations within the measurement window */
static u16 dbg_win = 0;   /* VBlanks elapsed in the window */

/* Digits waiting to be displayed: pushing to ui_map from the frame that
   has just been missed makes the next one miss too (feedback measured on
   the harness: 4 -> 51 missed frames out of 1200 while walking, panel
   open). So we push on a HEALTHY frame (d <= 1), at most once every 16
   frames — a periodic fallback if the game misses continuously. */
static u8 dbg_lag_dirty = 0;
static u8 dbg_fps_dirty = 0;
static u16 dbg_last_push = 0;

/* Hidden lines (ASCII, 0 = transparent cell) — the panel's truth; LAG
   exists ONLY as digits, it is never converted. */
static u8 dbg_l0[32];
static u8 dbg_l1[32];

/* v in decimal, right-aligned (leading zeros) by SUBTRACTION — no
   division. u16 params: tcc-816 corrupts a (u8, u16) pair. */
/* power of 10 without a table (u16 arrays are fragile under tcc-816 —
   see the toolchain traps in formats.h) */
static u16 dbg_pow10(u16 i)
{
  if (i == 4)
    return 10000;
  if (i == 3)
    return 1000;
  if (i == 2)
    return 100;
  if (i == 1)
    return 10;
  return 1;
}

static void dbg_setnum(u8 *dst, u16 col, u16 v, u16 digits)
{
  u16 i = digits;

  while (i)
  {
    u16 p, n;

    i--;
    p = dbg_pow10(i);
    n = 0;
    while (v >= p)
    {
      v -= p;
      n++;
    }
    dst[col] = (u8)('0' + n);
    col++;
  }
}

static void dbg_set(u8 *dst, u16 col, const char *s)
{
  while (*s)
  {
    dst[col] = (u8)*s;
    col++;
    s++;
  }
}

/* Copies a range of the hidden line `src` (row `row`) into ui_map. */
static void dbg_cells(const u8 *src, u16 row, u16 col, u16 n)
{
  u16 base = row * 32;

  while (n)
  {
    u16 c = src[col];

    ui_map[base + col] = c ? DBG_ENTRY(c) : 0;
    col++;
    n--;
  }
  ui_mark((u8)row, 1);
}

/* displayed LAG += n, digit by digit (carry) — costs almost nothing */
static void dbg_lag_add(u16 n)
{
  while (n)
  {
    u16 i = DBG_LAG_COL + 4;

    n--;
    while (i >= DBG_LAG_COL)
    {
      if (dbg_l0[i] < '9')
      {
        dbg_l0[i]++;
        break;
      }
      dbg_l0[i] = '0'; /* carry */
      i--;
    }
  }
}

static void dbg_blit(void)
{
  dbg_cells(dbg_l0, 0, 0, 32);
  dbg_cells(dbg_l1, 1, 0, 32);
}

/* SPREAD-OUT re-blit: 16 cells per frame (4 frames for the panel) — a
   full re-blit in a single frame is enough to overrun an already full
   game loop, and it fires once a second as soon as a live HUD widget
   shares the rows. */
static u8 dbg_stage = 0; /* quarters left (4..1), 0 = nothing */

static void dbg_blit_chunk(void)
{
  u16 q = 4 - dbg_stage; /* 0..3: halves of row 0 then row 1 */

  if (q < 2)
    dbg_cells(dbg_l0, 0, q << 4, 16);
  else
    dbg_cells(dbg_l1, 1, (q - 2) << 4, 16);
  dbg_stage--;
}

static void dbg_build(void)
{
  u16 i;

  for (i = 0; i < 32; i++)
  {
    dbg_l0[i] = 0;
    dbg_l1[i] = 0;
  }
  dbg_set(dbg_l0, 0, "FPS ");
  dbg_setnum(dbg_l0, DBG_FPS_COL, 60, 2);
  dbg_set(dbg_l0, 8, "LAG 00000");
  dbg_set(dbg_l1, 0, dbg_banks_txt); /* pre-formatted by datagen (M1) */
}

/* Closing: rows made transparent, then the HUD redrawn (its widgets may
   share these rows — same recipe as the textbox). */
static void dbg_clear(void)
{
  u16 i;

  for (i = 0; i < 64; i++)
    ui_map[i] = 0;
  ui_mark(0, 2);
  overlay_refresh();
}

void debug_update(void)
{
  u16 pad, now, d;

  if (!dbg_enabled)
    return;
  /* Panel HIDDEN: only the combo is watched — no counting at all. The
     editor's Play button always enables --debug, and even a few dozen
     cycles per frame are paid for when the loop grazes its budget
     (measured on the harness: ~20 more missed frames out of 1200 while
     walking, panel closed). The FPS measurement re-anchors on opening. */
  pad = padsCurrent(0);
  if ((pad & DBG_COMBO) == DBG_COMBO)
  {
    if (!dbg_held)
    {
      dbg_held = 1;
      if (dbg_on)
      {
        dbg_on = 0;
        dbg_clear();
      }
      else
      {
        dbg_on = 1;
        dbg_build();
        dbg_blit();
        dbg_lag_dirty = 0;
        dbg_fps_dirty = 0;
        dbg_started = 0; /* re-anchor: no fake accumulated lag */
        dbg_iters = 0;
        dbg_win = 0;
      }
    }
  }
  else
    dbg_held = 0;
  if (!dbg_on)
    return;

  now = snes_vblank_count;
  if (!dbg_started)
  {
    dbg_started = 1;
    dbg_last_vbl = now;
    dbg_last_push = now;
  }
  d = now - dbg_last_vbl;
  dbg_last_vbl = now;
  dbg_iters++;
  dbg_win += d;
  if (d > 1)
  {
    dbg_lag_add(d - 1); /* the loop missed (d-1) VBlanks */
    dbg_lag_dirty = 1;
  }
  if (dbg_win >= 60)
  {
    /* FPS ~= iterations of the window (60-63 VBlanks) — an approximation
       WITHOUT division, 2 digits */
    u16 f = dbg_iters;

    if (f > 60)
      f = 60;
    dbg_setnum(dbg_l0, DBG_FPS_COL, f, 2);
    dbg_fps_dirty = 1;
    dbg_iters = 0;
    dbg_win = 0;
  }
  {
    if (ui_dirty_overlap(0, 2))
      dbg_stage = 4; /* HUD repainted under the panel: spread-out re-blit */
    if (dbg_stage)
      dbg_blit_chunk();
    else if ((dbg_lag_dirty || dbg_fps_dirty) && d <= 1 &&
             (u16)(now - dbg_last_push) >= 16)
    {
      /* push ONLY the digits that moved (<= 5 cells), on a healthy frame,
         at most every 16 frames (see above: pushing immediately kept
         alive the very lag it displays) */
      if (dbg_fps_dirty)
        dbg_cells(dbg_l0, 0, DBG_FPS_COL, 2);
      if (dbg_lag_dirty)
        dbg_cells(dbg_l0, 0, DBG_LAG_COL, 5);
      dbg_fps_dirty = 0;
      dbg_lag_dirty = 0;
      dbg_last_push = now;
    }
  }
}
