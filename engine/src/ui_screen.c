/*
 * ui_screen.c — the single buffer of the UI layer (BG3).
 *
 * BG3 used to have three writers with disjoint shadows (textbox,
 * ui_overlay, timer) that could overwrite one another, which is why
 * the permanent windows were frozen into the top band. Here: one WRAM
 * buffer for the whole screen, each module composes its area, and the
 * VBlank transfers the contiguous span of dirty rows (64 bytes each).
 */
#include <snes.h>
#include "vram.h"
#include "ui_screen.h"
#include "vbudget.h"
#include "vblnmi.h"

u16 ui_map[32 * UI_ROWS];
u8 ui_band_up = 0; /* EXPLICIT init: tcc-816 does not clear the BSS */
static u8 ui_lo, ui_hi; /* dirty span — lo > hi means nothing to transfer */
static u8 ui_starv = 0; /* truncated slices in a row that served the
   TOP of the span. Widgets that re-mark the top every frame (ATB
   gauges) must not starve an erase waiting at the bottom ("Fuite"
   lingering after the battle menu closed) — but plain alternation
   made a hide vanish in out-of-order BANDS, which reads far worse
   than a quick top-down wipe (seen and reported). So: top-down by
   default, and the bottom takes one slice only after waiting out a
   couple of truncated frames. */
/* Where the VRAM map lives. Constant everywhere except on a Mode 7 world
   map, whose plane owns the low half of VRAM (vram.h). */
static u16 ui_base = VRAM_BG3_MAP;

/* Rows of the span's head published to the dispatcher (V5), 0 none.
   The flight only lives from the END of the frame's logic
   (ui_screen_prep, after every ui_map writer ran) to the SAME
   frame's tail (ui_screen_vblank resolves it) — never while widgets
   write, so the WRAM discipline holds by construction and no writer
   needs a clearing hook. */
static u8 ui_pub = 0;

static void ui_blit_all(void)
{
  /* Whole VRAM map transparent: the buffer's 28 rows, then the 4
     off-screen rows of the 32x32 map (a copy of the start — zeros) */
  dmaCopyVram((u8 *)ui_map, ui_base, 32 * UI_ROWS * 2);
  dmaCopyVram((u8 *)ui_map, ui_base + 32 * UI_ROWS, 32 * 4 * 2);
}

void ui_screen_init(void)
{
  u16 i;

  for (i = 0; i < 32 * UI_ROWS; i++) /* EXPLICIT init (tcc statics) */
    ui_map[i] = 0;
  ui_lo = 255;
  ui_hi = 0;
  ui_blit_all();
}

void ui_screen_rebase(u16 addr)
{
  ui_base = addr;
  /* The buffer is the truth of the layer, so moving the map is a matter
     of writing it out again. Whatever was on screen stays on screen. */
  ui_blit_all();
  ui_lo = 255;
  ui_hi = 0;
}

void ui_mark(u8 row, u8 h)
{
  u8 hi = (u8)(row + h - 1);

  if (ui_lo > ui_hi)
  {
    ui_lo = row;
    ui_hi = hi;
    return;
  }
  if (row < ui_lo)
    ui_lo = row;
  if (hi > ui_hi)
    ui_hi = hi;
}

u8 ui_dirty_overlap(u8 row, u8 h)
{
  if (ui_lo > ui_hi)
    return 0;
  if ((u8)(row + h - 1) < ui_lo)
    return 0;
  if (row > ui_hi)
    return 0;
  return 1;
}

/* End of the frame's LOGIC (main.c, after the last ui_map writer):
   publish the span's head so the ISR can land up to 4 rows at ~line
   229 — the typewriter's fast lane. The tail below resolves the
   flight the same frame. */
void ui_screen_prep(void)
{
  u8 n;
  u16 ofs;

  if (vn_busy(VN_UI))
    vn_cancel(VN_UI); /* a branch without the ui tail (picture, flat
        m7) never resolved it: kill it before the buffer moves */
  ui_pub = 0;
  if (ui_lo > ui_hi)
    return;
  n = (u8)(ui_hi - ui_lo + 1);
  if (n > 4)
    n = 4;
  ofs = (u16)ui_lo << 5;
  vn_publish(VN_UI, (const u8 *)ui_map + (ofs << 1),
             (u16)(ui_base + ofs), (u16)((u16)n << 6), 1, 0,
             VBL_COST_UI(n));
  ui_pub = n;
}

void ui_screen_vblank(void)
{
  u16 ofs;
  u8 want, fit;

  /* Resolve the ISR flight first: landed means the span's head went
     out at ~line 229; a leftover (the cap went to higher slots) is
     cancelled so the splitter below owns the whole span again —
     either way nothing stays in flight past this point. */
  if (ui_pub)
  {
    if (!vn_busy(VN_UI))
      ui_lo += ui_pub;
    else
      vn_cancel(VN_UI);
    ui_pub = 0;
    if (ui_lo > ui_hi)
    {
      ui_lo = 255;
      ui_hi = 0;
      return;
    }
  }
  if (ui_lo > ui_hi)
    return;
  /* The only consumer that had NO ceiling: a dialogue repainting the
     whole layer pushes 28 rows, 1792 bytes at once — about a dozen
     lines, right before the vignettes. It SPLITS itself rather than
     give up: text stays readable arriving in slices, and would not if
     it skipped a whole frame now and then. */
  want = (u8)(ui_hi - ui_lo + 1);
  fit = VBL_UI_ROWS(vbl_left());
  if (fit == 0)
    return; /* nothing fits: the span stays dirty, we come back */
  if (fit < want)
    want = fit;
  /* The beam guard this consumer never had (the V-NMI inventory
     called it): the ledger can drift optimistic — and past line 261
     the counter WRAPS, which vbl_probe now reads as 511 — while the
     rows below advance ui_lo assuming the DMA landed. A dropped span
     stayed grass-through-the-textbox until the next ui_mark. But a
     SPLITTER's guard SIZES the slice, it does not reject the batch:
     the first cut of this guard refused on the full span's cost, and
     a dialogue opening (28 rows) with the beam at ~240 never drew
     its textbox at all — the pixel regression caught the frozen
     script within the hour. */
  vbl_probe();
  if (vbl_v >= (u16)(VBL_LAST - 3))
    return; /* not even one row fits: the span stays dirty */
  fit = VBL_UI_ROWS((u8)(VBL_LAST - vbl_v));
  if (fit == 0)
    return;
  if (fit < want)
    want = fit;
  if (want < (u8)(ui_hi - ui_lo + 1))
  {
    /* Truncated: top-down by default (a hide split over 2-3 frames
       reads as one quick wipe), but after two slices in a row spent
       on re-marked top rows, the BOTTOM takes this one — that is
       what keeps a menu's erase from lingering under widgets that
       redraw every frame. */
    if (ui_starv >= 2)
    {
      ui_starv = 0;
      ofs = (u16)(ui_hi - want + 1) << 5; /* the span's tail */
      dmaCopyVram((u8 *)ui_map + (ofs << 1), ui_base + ofs,
                  (u16)want << 6);
      (void)vbl_take(VBL_COST_UI(want));
      ui_hi -= want; /* lo <= hi still holds: want < span size */
      return;
    }
    ui_starv++;
  }
  else
    ui_starv = 0;
  ofs = (u16)ui_lo << 5; /* 32 entries per row */
  dmaCopyVram((u8 *)ui_map + (ofs << 1), ui_base + ofs,
              (u16)want << 6);
  (void)vbl_take(VBL_COST_UI(want));
  ui_lo += want;
  if (ui_lo > ui_hi)
  {
    ui_lo = 255;
    ui_hi = 0;
  }
}
