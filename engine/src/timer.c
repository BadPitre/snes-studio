/*
 * timer.c — the displayable game timer, RM2003 model.
 *
 * A countdown in seconds driven by the TIMER opcode (spec §2): set and
 * start, stop, show and hide. The "M:SS" display lives on BG3, using
 * the textbox font already in VRAM, in the TOP-RIGHT corner. It is
 * composed into the shared ui_map buffer as soon as the state changes,
 * outside the VBlank; ui_screen_vblank does the transfer.
 * Accepted case: a dialogue window covering its row erases it until the
 * next tick.
 */
#include <snes.h>
#include "formats.h"
#include "timer.h"
#include "ui_screen.h"

/* Same BG3 entry encoding as the textbox (textbox.c): char 0 is
   transparent and the font starts at char 1 (glyph = ascii - 31) */
#define T_ENTRY(c) ((u16)((c) - 31) | 0x3000)

/* Display position: row 1, columns 26-30 (of 32) */
#define T_ROW 1
#define T_COL 26
#define T_LEN 5

static u16 t_secs;    /* seconds left */
static u8 t_frames;   /* frames elapsed in the current second */
static u8 t_run;      /* 1 = countdown running */
static u8 t_show;     /* 1 = shown */

/* Composes "M:SS" into ui_map, or erases it — outside the VBlank */
static void t_render(void)
{
  u16 m, s, base;
  u8 i;

  base = (u16)T_ROW * 32 + T_COL;
  if (t_show)
  {
    m = t_secs / 60;
    s = t_secs % 60;
    if (m > 99)
      m = 99;
    /* no leading zero on the minutes — an OPAQUE space (the font's
       background), as before M1: the rendering must stay pixel-identical */
    ui_map[base + 0] = m < 10 ? T_ENTRY(' ') : T_ENTRY('0' + m / 10);
    ui_map[base + 1] = T_ENTRY('0' + m % 10);
    ui_map[base + 2] = T_ENTRY(':');
    ui_map[base + 3] = T_ENTRY('0' + s / 10);
    ui_map[base + 4] = T_ENTRY('0' + s % 10);
  }
  else
  {
    for (i = 0; i < T_LEN; i++)
      ui_map[base + i] = 0;
  }
  ui_mark(T_ROW, 1);
}

void timer_init(void)
{
  t_secs = 0;
  t_frames = 0;
  t_run = 0;
  t_show = 0;
}

/* Single-argument API: a (u8, u16) parameter pair was corrupted by
   tcc-816 — 90 arrived as ~556. See docs/ENGINE_CONSTRAINTS.md §1.6. */
void timer_set(u16 secs)
{
  t_secs = secs;
  t_frames = 0;
  t_run = 1;
  t_render();
}

void timer_stop(void)
{
  t_run = 0;
}

void timer_display(u8 on)
{
  t_show = on;
  t_render();
}

/* Unconditional redraw — the dialogue band has just been cleared and
   may cover the timer's row (tb_clear_band) */
void timer_refresh(void)
{
  if (t_show)
    t_render();
}

u16 timer_secs(void)
{
  return t_secs;
}

/* One tick per frame (60 Hz NTSC). Stops at zero. */
void timer_tick(void)
{
  if (!t_run || t_secs == 0)
    return;
  t_frames++;
  if (t_frames >= 60)
  {
    t_frames = 0;
    t_secs--;
    if (t_secs == 0)
      t_run = 0;
    if (t_show)
      t_render();
  }
}
