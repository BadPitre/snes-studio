/*
 * ui_overlay.c — permanent HUD windows and WIDGETS: freely placed on
 * screen, up continuously during gameplay.
 *
 * Content types (ui_ov_type — PRIMITIVES flattened by uigen from the D1
 * designer tree; the vbox/hbox containers only exist at compile time):
 *   0 variable_display — label + value (the default window)
 *   1 gauge            — full/half/empty bar, horizontal or vertical
 *                        (filled from the BOTTOM up, ALttP style)
 *   2 icon_row         — repeated icons, Zelda hearts style
 *   3 icon_value       — icon + counter (optional leading zeros)
 *   4 panel            — frame only (the designer's CANVAS) — STATIC
 *   5 label            — fixed text (ui_ov_label) — STATIC
 *   6 image            — a run of icons from the sheet — STATIC
 *   7 list             — cursor menu (B6): items in ui_ov_label
 *                        separated by '\n', 1 column reserved for the
 *                        cursor ('>', or an icon when ui_ov_pad is set —
 *                        ui_ov_icon says which) — driven by the LISTSEL
 *                        opcode. More items than content rows = the
 *                        window SCROLLS (ls_top) with ^ / v indicators
 *                        in the last column.
 *                        When ui_ov_src is a table id, the rows ARE that
 *                        DATABASE table's entries (their names): the
 *                        inventory case. ui_ov_srcfilt names a column
 *                        holding a VARIABLE NUMBER — the row is skipped
 *                        while that variable is 0; ui_ov_srccnt names
 *                        one whose value is drawn right-aligned (the
 *                        quantity). LISTSEL then returns the chosen
 *                        ENTRY's number, ready for "read the database".
 *   8 image (picture)  — a project PICTURE laid into the UI layer:
 *                        datagen converts it to 2bpp chars brought back
 *                        to the font's 4 colours (no free palette: the
 *                        tileset takes colours 0-127), and ui_ov_icon
 *                        carries the base char — STATIC
 *   9 image (sliced)   — a 3x3 picture stretched over the widget's rect,
 *                        the windowskin recipe applied to any image —
 *                        STATIC
 *  10 image (fill)     — a picture revealed proportionally to var/max,
 *                        left to right or bottom up (ui_ov_dir). Half
 *                        tiles come from the CUT copy of the image that
 *                        datagen lays right after the full one, so a
 *                        fill has the gauge's two units per tile.
 *  11 label (dynamic)  — like 5, but the text carries \v[n] escapes:
 *                        byte 1, then the variable number + 1, then a
 *                        format byte (1 = plain, w+1 = right-aligned on
 *                        w columns, 0x80|(w+1) = zero-padded). Redrawn
 *                        like a value: ui_ov_var is the first variable
 *                        it reads, ui_ov_maxvar the second (0xFF none).
 * ui_ov_frame: 9-slice/box frame, or a bare widget over the game.
 * Icons: chars UI_ICON_BASE+n (the ui.icons sheet, after the windowskin);
 * gauge/icon_row: icon, icon+1, icon+2 = full, half, empty.
 *
 * The tables come from the uigen layout (generated ui_overlays.c); a
 * redraw only fires when var (or max_var) changes.
 *
 * WIDGETS MAY OVERLAP. The layer is one shared tilemap, so a primitive
 * can never be painted or erased on its own: everything goes through
 * ov_repaint, which clears a rect and replays — in emission order, which
 * IS the z-order — every visible primitive that meets it. The author's
 * widget order decides who is on top; a later widget wins.
 *
 * Composes into the shared ui_map buffer (M1) — the transfer is
 * centralised in ui_screen_vblank.
 */
#include <snes.h>
#include "vm.h"
#include "ui_overlay.h"
#include "ui_screen.h"
#include "data/ui_cfg.h"
#include "data/db_tables.h"

#if UI_OV_COUNT

extern const u8 ui_ov_x[];
extern const u8 ui_ov_y[];
extern const u8 ui_ov_w[];
extern const u8 ui_ov_h[];
extern const u8 ui_ov_var[];
extern const u8 ui_ov_type[];
extern const u8 ui_ov_frame[];
extern const u8 ui_ov_icon[];
extern const u8 ui_ov_dir[];
extern const u8 ui_ov_pad[];
extern const u8 ui_ov_bg[]; /* 1 = inside a window (frame background) */
extern const u8 ui_ov_widget[]; /* index of the prim's ROOT (widget) */
extern const u8 ui_ov_font[]; /* base of the ' ' glyph of the widget's font
    (S2) — 1 = project font, otherwise the base of the extra font in VRAM */
extern const u8 ui_widget_vis[]; /* INITIAL visibility per widget */
extern const u8 ui_ov_src[];     /* list: source table id (0xFF none) */
extern const u8 ui_ov_srcfilt[]; /* list: filter column offset (0xFF none) */
extern const u8 ui_ov_srccnt[];  /* list: quantity column offset (0xFF) */
extern const u8 ui_ov_maxvar[]; /* 0xFF = constant max (maxlo/maxhi) */
extern const u8 ui_ov_maxlo[];
extern const u8 ui_ov_maxhi[];
extern const char *const ui_ov_label[];

#define OV_ENTRY(c) ((u16)(c) | 0x3000) /* font palette + priority */
#define OV_CHAR(a) ((u16)(a) - 31)
/* glyph in the WIDGET's FONT (S2) — fb = ui_ov_font[i], local to
   ov_draw; same as OV_CHAR when fb == 1 (the project font) */
#define OV_FCHAR(a) ((u16)fb + (a) - 32)
#define OV_SKIN_BASE 97
/* background of the empty cells of a widget laid INSIDE a window (D1):
   the 9-slice centre — a 0 would punch through the panel to the game */
#if UI_HAS_SKIN
#define OV_BG_ENTRY OV_ENTRY(OV_SKIN_BASE + 4)
#else
#define OV_BG_ENTRY OV_ENTRY(OV_CHAR(' '))
#endif
/* icons: inside a window we take the "panel background" VARIANT
   (transparent pixels -> background, generated by datagen after the
   sheet) so the icon shows the frame behind it, not the game */
#define OV_ICON_BASE(i) \
  (UI_ICON_BASE + (ui_ov_bg[i] ? UI_ICON_COUNT : 0))

static u16 ov_last[UI_OV_COUNT];  /* last value drawn */
static u16 ov_lastm[UI_OV_COUNT]; /* last maximum (max_var) */
static u8 ov_vis[UI_WIDGET_COUNT ? UI_WIDGET_COUNT : 1]; /* visibility
    runtime visibility per widget: hidden by default, driven by SHOWUI */
static char ov_num[5];
/* the ACTIVE cursor list (B6) — only one at a time, driven by the VM
   (LISTSEL). Explicit init: tcc-816 does not clear the BSS. */
static u8 ls_prim = 0xFF; /* type 7 primitive in progress (0xFF = none) */
static u8 ls_sel = 0;     /* ROW under the cursor (absolute index) */
static u8 ls_top = 0;     /* first visible row (scrolling list) */
/* A list sourced on a database table: the rows that PASSED the filter,
   as entry numbers, frozen when the menu opens — the cursor must not
   move under the player because a quantity changed mid-menu. */
#define LS_ROWS_MAX 32
static u8 ls_row[LS_ROWS_MAX];
static u8 ls_rows = 0; /* 0 = the list is not sourced */

/* a widget's current maximum: compiled constant or variable */
static u16 ov_max(u8 i)
{
  if (ui_ov_maxvar[i] != 0xFF)
    return vm.vars16[ui_ov_maxvar[i]];
  return (u16)ui_ov_maxlo[i] | ((u16)ui_ov_maxhi[i] << 8);
}

/* A sourced list's column byte for one entry: the table's raw ROM. */
static u8 ov_src_col(u8 i, u8 entry, u8 ofs)
{
  u8 t = ui_ov_src[i];

  return db_tables[t][(u16)entry * db_table_sizes[t] + ofs];
}

/* Builds the visible rows of a sourced list: every entry of the table,
   minus those the filter column hides (its byte is a VARIABLE NUMBER,
   the row shows while that variable is non-zero). */
static u8 ov_src_rows(u8 i)
{
  u8 t = ui_ov_src[i];
  u8 filt = ui_ov_srcfilt[i];
  u8 e, n = 0;

  for (e = 0; e < db_table_counts[t] && n < LS_ROWS_MAX; e++)
  {
    if (filt != 0xFF && vm.vars16[ov_src_col(i, e, filt)] == 0)
      continue;
    ls_row[n++] = e;
  }
  return n;
}

/* Is widget i on screen right now? */
#define OV_VIS(i) (ov_vis[ui_ov_widget[i]])

/* Does primitive i meet the rect? */
static u8 ov_hits(u8 i, u8 rx, u8 ry, u8 rw, u8 rh)
{
  if (ui_ov_x[i] + ui_ov_w[i] <= rx || rx + rw <= ui_ov_x[i])
    return 0;
  if (ui_ov_y[i] + ui_ov_h[i] <= ry || ry + rh <= ui_ov_y[i])
    return 0;
  return 1;
}

static void ov_paint(u8 i);

/* Repaints a rect: clears it, then replays every VISIBLE primitive that
   meets it, in emission order (= z-order). This is the only honest way
   to let widgets overlap on a shared tilemap — a primitive drawn alone
   would punch a hole in whoever sits under or over it.

   The rect GROWS first: a primitive that only pokes into it paints its
   whole rect, which may cover a third one that was outside. Growing
   until nothing new is caught makes the repaint closed under that. */
static void ov_repaint(u8 rx, u8 ry, u8 rw, u8 rh)
{
  u8 i, grew, cx, cy;
  u16 base;

  do
  {
    grew = 0;
    for (i = 0; i < UI_OV_COUNT; i++)
    {
      if (!OV_VIS(i) || !ov_hits(i, rx, ry, rw, rh))
        continue;
      if (ui_ov_x[i] < rx)
      {
        rw = (u8)(rw + rx - ui_ov_x[i]);
        rx = ui_ov_x[i];
        grew = 1;
      }
      if (ui_ov_y[i] < ry)
      {
        rh = (u8)(rh + ry - ui_ov_y[i]);
        ry = ui_ov_y[i];
        grew = 1;
      }
      if (ui_ov_x[i] + ui_ov_w[i] > rx + rw)
      {
        rw = (u8)(ui_ov_x[i] + ui_ov_w[i] - rx);
        grew = 1;
      }
      if (ui_ov_y[i] + ui_ov_h[i] > ry + rh)
      {
        rh = (u8)(ui_ov_y[i] + ui_ov_h[i] - ry);
        grew = 1;
      }
    }
  } while (grew);

  for (cy = 0; cy < rh; cy++)
  {
    base = (u16)(ry + cy) * 32 + rx;
    for (cx = 0; cx < rw; cx++)
      ui_map[base + cx] = 0;
  }
  for (i = 0; i < UI_OV_COUNT; i++)
    if (OV_VIS(i) && ov_hits(i, rx, ry, rw, rh))
      ov_paint(i);
  ui_mark(ry, rh);
}

/* Redraws one primitive — through a repaint as soon as another visible
   one shares its rect, which is the overlapping case. */
static void ov_draw(u8 i)
{
  u8 k;

  for (k = 0; k < UI_OV_COUNT; k++)
    if (k != i && OV_VIS(k) &&
        ov_hits(k, ui_ov_x[i], ui_ov_y[i], ui_ov_w[i], ui_ov_h[i]))
    {
      ov_repaint(ui_ov_x[i], ui_ov_y[i], ui_ov_w[i], ui_ov_h[i]);
      return;
    }
  ov_paint(i);
  ui_mark(ui_ov_y[i], ui_ov_h[i]);
}

/* Paints one primitive into the buffer. Never called on its own from
   outside — see ov_draw / ov_repaint. */
static void ov_paint(u8 i)
{
  u8 x = ui_ov_x[i];
  u8 w = ui_ov_w[i];
  u8 h = ui_ov_h[i];
  u8 f = ui_ov_frame[i];
  u8 fb = ui_ov_font[i]; /* font base for the prim's text (S2) */
  u8 cx, cy, sy, d, cells, k, fill;
  /* nrow/top/r/nm serve the sourced list. Declared HERE, not inside the
     case: tcc-816 miscompiles a declaration inside a switch case (the
     bug that once corrupted the HUD's row of hearts). */
  u8 nrow, top, r;
  u16 base, v, units, ch;
  const char *l;
  const char *nm;

  if (f)
  {
    /* the window frame (9-slice or solid box, like the textbox) */
    for (cy = 0; cy < h; cy++)
    {
      base = (u16)(ui_ov_y[i] + cy) * 32 + x;
      sy = cy == 0 ? 0 : (cy == (u8)(h - 1) ? 2 : 1);
      for (cx = 0; cx < w; cx++)
      {
#if UI_HAS_SKIN
        ui_map[base + cx] = OV_ENTRY(
            OV_SKIN_BASE + sy * 3 + (cx == 0 ? 0 : (cx == (u8)(w - 1) ? 2 : 1)));
#else
        ui_map[base + cx] = OV_ENTRY(OV_CHAR(' '));
#endif
      }
    }
  }
  else
  {
    /* bare widget: the area goes back to the background (transparent, or
       the frame background if the widget lives in a designer window) */
    u16 bgent = ui_ov_bg[i] ? OV_BG_ENTRY : 0;

    for (cy = 0; cy < h; cy++)
    {
      base = (u16)(ui_ov_y[i] + cy) * 32 + x;
      for (cx = 0; cx < w; cx++)
        ui_map[base + cx] = bgent;
    }
  }

  /* content area: the whole rect, inset by 1 when there is a frame */
  x = (u8)(x + f);
  w = (u8)(w - (f << 1));
  h = (u8)(h - (f << 1));
  base = (u16)(ui_ov_y[i] + f) * 32; /* TOP row of the content */
  v = ov_last[i];

  switch (ui_ov_type[i])
  {
  case 1: /* gauge — full/half/empty, 2 units per tile */
  case 2: /* icon_row (hearts): same filling, always horizontal */
    cells = ui_ov_dir[i] ? h : w;
    units = (u16)cells << 1;
    {
      u16 m = ov_lastm[i];

      if (m == 0 || v == 0)
        fill = 0;
      else if (v >= m)
        fill = (u8)units;
      else
        fill = (u8)(((u32)v * units) / m);
    }
    for (k = 0; k < cells; k++)
    {
      /* 2=full 1=half 0=empty -> chars icon+0 / +1 / +2 */
      d = fill > (u8)(k << 1) ? (u8)(fill - (k << 1)) : 0;
      if (d > 2)
        d = 2;
      if (ui_ov_dir[i]) /* vertical: filled from the BOTTOM up (ALttP) */
        ui_map[base + (u16)(h - 1 - k) * 32 + x] =
            OV_ENTRY(OV_ICON_BASE(i) + ui_ov_icon[i] + 2 - d);
      else
        ui_map[base + x + k] = OV_ENTRY(OV_ICON_BASE(i) + ui_ov_icon[i] + 2 - d);
    }
    break;

  case 4: /* panel: frame only (drawn above) */
    break;

  case 5:  /* label: static text */
  case 11: /* label: text carrying \v[n] escapes (see the header) */
    cx = x;
    l = ui_ov_label[i];
    while (*l && cx < (u8)(x + w))
    {
      if (*l != 1)
      {
        ui_map[base + cx++] = OV_ENTRY(OV_FCHAR(*l++));
        continue;
      }
      /* \v[n]: variable number + 1, then the format byte */
      v = vm.vars16[(u8)(l[1] - 1)];
      d = (u8)l[2];
      l += 3;
      k = 0;
      do
      {
        ov_num[k++] = '0' + (v % 10);
        v /= 10;
      } while (v && k < 5);
      /* pad to the requested column count — with zeros or with spaces
         (the digits sit reversed, so padding appended comes out LEFT) */
      while (k < (u8)((d & 0x7F) - 1) && k < 5)
        ov_num[k++] = (d & 0x80) ? '0' : ' ';
      while (k && cx < (u8)(x + w))
        ui_map[base + cx++] = OV_ENTRY(OV_FCHAR(ov_num[--k]));
    }
    break;

  case 6: /* image: consecutive icons from the sheet */
    for (k = 0; k < w; k++)
      ui_map[base + x + k] = OV_ENTRY(OV_ICON_BASE(i) + ui_ov_icon[i] + k);
    break;

  case 8: /* image: a project PICTURE, converted to UI-layer chars
             by datagen (4 colours, the font's palette). The chars are
             consecutive, row by row — here ui_ov_icon carries the
             absolute BASE char, not an index into the icon sheet. */
    ch = ui_ov_icon[i];
    for (cy = 0; cy < h; cy++)
      for (k = 0; k < w; k++)
        ui_map[base + (u16)cy * 32 + x + k] = OV_ENTRY(ch++);
    break;

  case 9: /* image: a 3x3 picture SLICED over the widget's rect — the
             windowskin recipe, opened to any image */
    ch = ui_ov_icon[i];
    for (cy = 0; cy < h; cy++)
    {
      sy = cy == 0 ? 0 : (cy == (u8)(h - 1) ? 2 : 1);
      for (k = 0; k < w; k++)
        ui_map[base + (u16)cy * 32 + x + k] = OV_ENTRY(
            ch + sy * 3 + (k == 0 ? 0 : (k == (u8)(w - 1) ? 2 : 1)));
    }
    break;

  case 10: /* image: FILLED to var/max. Two units per tile — the full
              image, then its CUT copy, which datagen lays immediately
              after (chars ch .. ch + w*h - 1, then w*h more). The
              unfilled part keeps the background, so an "empty" image
              placed UNDER this one draws the rest of the bar. */
    ch = ui_ov_icon[i];
    cells = ui_ov_dir[i] ? h : w;
    units = (u16)cells << 1;
    {
      u16 m = ov_lastm[i];

      if (m == 0 || v == 0)
        fill = 0;
      else if (v >= m)
        fill = (u8)units;
      else
        fill = (u8)(((u32)v * units) / m);
    }
    for (k = 0; k < cells; k++)
    {
      d = fill > (u8)(k << 1) ? (u8)(fill - (k << 1)) : 0;
      if (d > 2)
        d = 2;
      if (d == 0)
        continue; /* empty: the background stays */
      if (ui_ov_dir[i]) /* vertical: filled from the BOTTOM up */
      {
        cy = (u8)(h - 1 - k);
        for (r = 0; r < w; r++)
          ui_map[base + (u16)cy * 32 + x + r] =
              OV_ENTRY(ch + (d == 1 ? (u16)w * h : 0) + (u16)cy * w + r);
      }
      else
        for (cy = 0; cy < h; cy++)
          ui_map[base + (u16)cy * 32 + x + k] =
              OV_ENTRY(ch + (d == 1 ? (u16)w * h : 0) + (u16)cy * w + k);
    }
    break;

  case 7: /* list (B6): one item per row, column 0 = the cursor ('>'
             or an icon when ui_ov_pad is set). The active list scrolls
             when the items outnumber the rows: ls_top items are
             skipped and the last column carries the ^ / v hints. */
    if (ui_ov_src[i] != 0xFF)
    {
      /* rows from a DATABASE table: the entry names, and the quantity
         column when there is one. Only the ACTIVE list has a row map;
         a sourced list drawn while closed shows the table as it
         stands, which is what the designer's preview promises. */
      nrow = (i == ls_prim && ls_rows) ? ls_rows : ov_src_rows(i);
      top = (i == ls_prim) ? ls_top : 0;
      for (cy = 0; cy < h; cy++)
      {
        r = (u8)(cy + top);
        if (r >= nrow)
          break;
        if (i == ls_prim && r == ls_sel)
          ui_map[base + (u16)cy * 32 + x] =
              ui_ov_pad[i] ? OV_ENTRY(OV_ICON_BASE(i) + ui_ov_icon[i])
                           : OV_ENTRY(OV_FCHAR('>'));
        nm = db_names[ui_ov_src[i]][ls_row[r]];
        cx = (u8)(x + 1);
        while (*nm && cx < (u8)(x + w - 1))
          ui_map[base + (u16)cy * 32 + cx++] = OV_ENTRY(OV_FCHAR(*nm++));
        if (ui_ov_srccnt[i] != 0xFF)
        {
          /* quantity, right-aligned on the row */
          v = vm.vars16[ov_src_col(i, ls_row[r], ui_ov_srccnt[i])];
          d = 0;
          do
          {
            ov_num[d++] = '0' + (v % 10);
            v /= 10;
          } while (v && d < 5);
          cx = (u8)(x + w - d);
          while (d)
            ui_map[base + (u16)cy * 32 + cx++] = OV_ENTRY(OV_FCHAR(ov_num[--d]));
        }
      }
      if (i == ls_prim && ls_top)
        ui_map[base + x + w - 1] = OV_ENTRY(OV_FCHAR('^'));
      if ((u16)top + h < nrow)
        ui_map[base + (u16)(h - 1) * 32 + x + w - 1] = OV_ENTRY(OV_FCHAR('v'));
      break;
    }
    l = ui_ov_label[i];
    k = (i == ls_prim) ? ls_top : 0;
    while (k && *l) /* skip the items scrolled out above */
      if (*l++ == '\n')
        k--;
    for (cy = 0; cy < h; cy++)
    {
      if (i == ls_prim && (u8)(cy + ls_top) == ls_sel)
        ui_map[base + (u16)cy * 32 + x] =
            ui_ov_pad[i] ? OV_ENTRY(OV_ICON_BASE(i) + ui_ov_icon[i])
                         : OV_ENTRY(OV_FCHAR('>'));
      cx = (u8)(x + 1);
      while (*l && *l != '\n' && cx < (u8)(x + w))
        ui_map[base + (u16)cy * 32 + cx++] = OV_ENTRY(OV_FCHAR(*l++));
      while (*l && *l != '\n') /* item wider than the widget: cut */
        l++;
      if (*l == '\n')
        l++;
      else
      {
        l = ""; /* no more items: the remaining rows keep the background */
        break;
      }
    }
    /* scroll hints in the last content column (a scrolling list is one
       column wider precisely so they never cover an item) */
    if (i == ls_prim && ls_top)
      ui_map[base + x + w - 1] = OV_ENTRY(OV_FCHAR('^'));
    if (*l) /* items remain below the window */
      ui_map[base + (u16)(h - 1) * 32 + x + w - 1] = OV_ENTRY(OV_FCHAR('v'));
    break;

  case 3: /* icon_value: icon + right-aligned counter, zero padded */
    ui_map[base + x] = OV_ENTRY(OV_ICON_BASE(i) + ui_ov_icon[i]);
    d = 0;
    do
    {
      ov_num[d++] = '0' + (v % 10);
      v /= 10;
    } while (v && d < 5);
    while (d < ui_ov_pad[i] && d < 5)
      ov_num[d++] = '0';
    if (d > (u8)(w - 1)) /* never outside the widget (the icon is kept) */
      d = (u8)(w - 1);
    cx = (u8)(x + w - d);
    while (d)
      ui_map[base + cx++] = OV_ENTRY(OV_FCHAR(ov_num[--d]));
    break;

  default: /* variable_display / value: label then value */
    cx = x;
    l = ui_ov_label[i];
    while (*l && cx < (u8)(x + w - 1))
      ui_map[base + cx++] = OV_ENTRY(OV_FCHAR(*l++));
    d = 0;
    do
    {
      ov_num[d++] = '0' + (v % 10);
      v /= 10;
    } while (v && d < 5);
    if (ui_ov_dir[i])
    {
      /* align = "left" (D1): the value STICKS to the label — no gap in
         front of small numbers */
      while (d && cx < (u8)(x + w))
        ui_map[base + cx++] = OV_ENTRY(OV_FCHAR(ov_num[--d]));
    }
    else
    {
      if (d > w) /* narrow window: the value may cover the label, but
                    never overflow the widget */
        d = w;
      cx = (u8)(x + w - d);
      while (d)
        ui_map[base + cx++] = OV_ENTRY(OV_FCHAR(ov_num[--d]));
    }
    break;
  }
}

void overlay_init(void)
{
  u8 i;

  for (i = 0; i < (UI_WIDGET_COUNT ? UI_WIDGET_COUNT : 1); i++)
    ov_vis[i] = UI_WIDGET_COUNT ? ui_widget_vis[i] : 0;
  /* ui_map has already been cleared by ui_screen_init (called first), so
     painting straight through in emission order gives the right z-order */
  for (i = 0; i < UI_OV_COUNT; i++)
  {
    ov_last[i] = vm.vars16[ui_ov_var[i]];
    ov_lastm[i] = ov_max(i);
  }
  for (i = 0; i < UI_OV_COUNT; i++)
    if (OV_VIS(i))
    {
      ov_paint(i);
      ui_mark(ui_ov_y[i], ui_ov_h[i]);
    }
}

void overlay_update(void)
{
  u8 i, t;
  u16 v, m;

  for (i = 0; i < UI_OV_COUNT; i++)
  {
    t = ui_ov_type[i];
    /* panel / static label / icons / picture / sliced: refresh only.
       A filled image (10) and an interpolating label (11) track their
       variables like a value does. */
    if (t >= 4 && t != 10 && t != 11)
      continue;
    v = vm.vars16[ui_ov_var[i]];
    m = ov_max(i);
    if (v != ov_last[i] || m != ov_lastm[i])
    {
      ov_last[i] = v;
      ov_lastm[i] = m;
      if (OV_VIS(i))
        ov_draw(i);
    }
  }
}

void overlay_refresh(void)
{
  u8 i;

  /* unconditional redraw: after the dialogue band is cleared
     (tb_clear_band), the widgets sharing its rows must reappear —
     except those hidden by SHOWUI. Straight through in emission order:
     that IS the z-order, so overlapping widgets land right. */
  for (i = 0; i < UI_OV_COUNT; i++)
    if (OV_VIS(i))
    {
      ov_paint(i);
      ui_mark(ui_ov_y[i], ui_ov_h[i]);
    }
}

void overlay_show(u8 widget, u8 on)
{
  u8 i;

  if (widget >= (UI_WIDGET_COUNT ? UI_WIDGET_COUNT : 1))
    return;
  ov_vis[widget] = on;
  /* Hiding: the rect goes back to whoever is underneath — ov_vis is
     already down, so the repaint leaves us out. Showing: ov_draw sorts
     the z-order out on its own as soon as anything overlaps. */
  for (i = 0; i < UI_OV_COUNT; i++)
  {
    if (ui_ov_widget[i] != widget)
      continue;
    if (on)
      ov_draw(i); /* values are up to date: ov_last tracked even when hidden */
    else
      ov_repaint(ui_ov_x[i], ui_ov_y[i], ui_ov_w[i], ui_ov_h[i]);
  }
}

/* ---- cursor list (B6) — driven by the VM (LISTSEL opcode) ---- */

/* number of rows — the FULL count: when it exceeds the widget's content
   rows the list scrolls (ls_top), so the cursor never lands on an empty
   row. A sourced list counts the entries that passed the filter. */
static u8 ov_list_count(u8 i)
{
  const char *l;
  u8 n = 1;

  if (ui_ov_src[i] != 0xFF)
    return ls_rows;
  l = ui_ov_label[i];
  if (!*l)
    return 0;
  while (*l)
    if (*l++ == '\n')
      n++;
  return n;
}

u8 overlay_list_open(u8 widget)
{
  u8 i;

  for (i = 0; i < UI_OV_COUNT; i++)
  {
    if (ui_ov_type[i] == 7 && ui_ov_widget[i] == widget)
    {
      ls_prim = i;
      ls_sel = 0;
      ls_top = 0;
      /* a sourced list freezes its rows here: what the table holds and
         the filter allows AT THIS MOMENT (an empty inventory returns 0,
         and the command is ignored — the script sees var untouched) */
      ls_rows = (ui_ov_src[i] != 0xFF) ? ov_src_rows(i) : 0;
      if (ui_ov_src[i] != 0xFF && ls_rows == 0)
      {
        ls_prim = 0xFF;
        return 0;
      }
      overlay_show(widget, 1); /* redraws — the cursor starts at the top */
      return ov_list_count(i);
    }
  }
  return 0; /* the widget has no list: LISTSEL is ignored */
}

void overlay_list_cursor(u8 sel)
{
  u8 rows;

  if (ls_prim == 0xFF)
    return;
  ls_sel = sel;
  /* keep the cursor inside the window: scroll the view when needed */
  rows = (u8)(ui_ov_h[ls_prim] - (ui_ov_frame[ls_prim] << 1));
  if (ls_sel < ls_top)
    ls_top = ls_sel;
  else if (rows && ls_sel >= (u8)(ls_top + rows))
    ls_top = (u8)(ls_sel - rows + 1);
  ov_draw(ls_prim); /* small rect: a full redraw is simpler */
}

/* Row -> what LISTSEL writes: the ROW NUMBER for a plain list, the
   chosen entry's DATABASE NUMBER for a sourced one (so "read the
   database" reads it straight away). */
u8 overlay_list_pick(u8 row)
{
  if (ls_prim != 0xFF && ui_ov_src[ls_prim] != 0xFF)
    return row < ls_rows ? ls_row[row] : 0;
  return row;
}

void overlay_list_close(u8 keep)
{
  u8 w, p;

  if (ls_prim == 0xFF)
    return;
  w = ui_ov_widget[ls_prim];
  p = ls_prim;
  ls_prim = 0xFF;
  ls_rows = 0;
  if (keep)
    ov_draw(p); /* multi-panel: the list stays, without the cursor */
  else
    overlay_show(w, 0);
}

#else /* no overlay in the layout: inert module */

void overlay_init(void)
{
}

void overlay_update(void)
{
}

void overlay_refresh(void)
{
}

void overlay_show(u8 widget, u8 on)
{
  (void)widget;
  (void)on;
}

u8 overlay_list_open(u8 widget)
{
  (void)widget;
  return 0;
}

u8 overlay_list_pick(u8 row)
{
  return row;
}

void overlay_list_cursor(u8 sel)
{
  (void)sel;
}

void overlay_list_close(u8 keep)
{
  (void)keep;
}

#endif /* UI_OV_COUNT */
