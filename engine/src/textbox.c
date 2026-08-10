/*
 * textbox.c — the dialogue window, on BG3.
 *
 * BG3 stays enabled at all times: its map is filled with char 0
 * (transparent) when the box is closed — no layer toggling. The glyphs
 * have an opaque background (colour 1), so the box is simply the
 * rectangle of the chars written. Since M1 the module composes into the
 * shared ui_map screen buffer (ui_screen.c) — the VRAM transfer is
 * centralised at VBlank by ui_screen_vblank.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "textbox.h"
#include "rom_layout.h"
#include "vram.h"
#include "m7.h"
#include "vm.h" /* \v[n]: vars16 inserted at decode time */
#include "ui_screen.h" /* shared BG3 buffer (M1) */
#include "ui_overlay.h" /* widget refresh after clearing (W1) */
#include "timer.h"
#include "data/ui_cfg.h" /* UI theme v1: windowskin + text_speed */

/* Dialogue styles (S1, generated ui_styles.c tables): window, windowskin
   (base char, 0 = solid box) and font (base char of the ' ' glyph) PER
   STYLE — style 0 = default, changed by DLGSTYLE. */
extern const u8 ui_st_mx[];
extern const u8 ui_st_my[];
extern const u8 ui_st_mw[];
extern const u8 ui_st_mh[];
extern const u8 ui_st_cx[];
extern const u8 ui_st_cy[];
extern const u8 ui_st_cw[];
extern const u8 ui_st_ch[];
extern const u8 ui_st_font[];
extern const u8 ui_st_skin[];

/* current style, copied out of the tables by textbox_set_style */
static u8 tb_mx, tb_my, tb_mw, tb_mh; /* message window */
static u8 tb_cx2, tb_cy2, tb_cw2, tb_ch2; /* choice window */
static u8 tb_font; /* base char of the font (' ' glyph) */
static u8 tb_skin; /* base char of the 9-slice (0 = solid box) */

/* Font + palette (data_font.c) */
extern const u8 font_gfx[];
extern const u16 font_gfx_size;
extern const u16 textbox_pal[];

/* Texts: header in bank $86 (multi-bank M1) — [u16 count][3-byte entries:
   ofs lo, ofs hi, CPU bank][256-byte DTE pair table]; the strings live in
   the bank named by their entry ($86 or an extra bank allocated by
   datagen). Codes 0x80-0xFF name a pair of characters from the table: we
   decode into a WRAM buffer before rendering (the word wrap reads
   ahead). */
/* Buffer for the decimal formatting of \v[n] (static: tcc caution) */
static char tb_num[5];

static void text_decode(u16 text_id, char *dst, u8 max)
{
  const u8 *tbl = make_far(BANK_TEXTS, BANK_BASE_ADDR);
  u16 count = (u16)tbl[0] | ((u16)tbl[1] << 8);
  const u8 *pairs;
  const u8 *s;
  const u8 *e;
  u16 ofs, k, v;
  u8 n = 0, c, d;

  dst[0] = 0;
  if (text_id >= count)
    return;
  /* 3-byte entries (multi-bank M1): the pairs follow the table */
  pairs = tbl + 2 + count + (count << 1);
  e = tbl + 2 + text_id + ((u16)text_id << 1);
  ofs = (u16)e[0] | ((u16)e[1] << 8);
  s = make_far(e[2], BANK_BASE_ADDR + ofs);
  while (*s && n < (u8)(max - 2))
  {
    c = *s++;
    if (c == 0x01)
    {
      /* \v[n] (v0.17): [0x01][n+1] — inserts vars16[n] in decimal (1 to
         5 digits) BEFORE the wrap, which stays natural */
      v = vm.vars16[(u8)(*s++ - 1)];
      d = 0;
      do
      {
        tb_num[d++] = '0' + (v % 10);
        v /= 10;
      } while (v && d < 5);
      while (d && n < (u8)(max - 2))
        dst[n++] = tb_num[--d];
    }
    else if (c == 0x02)
    {
      /* \s[n] (T2): copied through with its parameter — interpreted by
         the typewriter, invisible to the wrap */
      dst[n++] = c;
      dst[n++] = *s++;
    }
    else if (c < 0x20)
      dst[n++] = c; /* 1-byte codes (T2): pause, wait, instant */
    else if (c & 0x80)
    {
      k = (u16)(c & 0x7F) << 1;
      dst[n++] = pairs[k];
      dst[n++] = pairs[k + 1];
    }
    else
      dst[n++] = c;
  }
  dst[n] = 0;
}

/* Decoding buffers (WRAM): one full-screen message, 4 options */
static char tb_text[176];
static char tb_opts[4][28];

/* Geometry: the MESSAGE and CHOICE windows of the CURRENT STYLE (S1 —
   ui_styles.c tables, style 0 = the layout's default). ABSOLUTE
   addressing in ui_map (M1); UI_SHADOW_* bounds the band to clear (the
   union of every window of every style, computed by uigen). */
#define TB_TEXT_COLS ((u8)(tb_mw - 4)) /* frame: 2 tiles of margin per side */
#define TB_TEXT_ROWS ((u8)(tb_mh - 2)) /* frame: 1 row top and bottom */
#define TB_CHC_COLS ((u8)(tb_cw2 - 4))
#define TB_CHC_ROWS ((u8)(tb_ch2 - 2))
/* ui_map cell (text line l, column c) of each window */
#define TB_MSG_CELL(l, c) \
  ((u16)(tb_my + 1 + (l)) * 32 + tb_mx + 2 + (c))
#define TB_CHC_CELL(l, c) \
  ((u16)(tb_cy2 + 1 + (l)) * 32 + tb_cx2 + 2 + (c))

/* BG3 entry: 2bpp char + palette 4 (CGRAM 16) + priority (above
   everything thanks to the BG3-prio bit of mode 1) */
#define TB_ENTRY(c) ((u16)(c) | 0x3000)
/* glyph of the current STYLE: tb_font points at the ' ' char (font 0:
   base 1 -> 1 + ascii - 32 = ascii - 31, as before S1) */
#define TB_CHAR(ascii) ((u16)tb_font + (ascii) - 32)
/* Background tile of the current window (erasing the choice cursor) */
#define TB_BG_CHAR (tb_skin ? (u16)(tb_skin + 4) : TB_CHAR(' '))

/* Clears the dialogue BAND (the union of the message and choice rows)
   in the shared buffer, then redraws what may share those rows: the
   HUD widgets (freely placed since W1, and since U2 allowed to sit
   right over the band) and the timer.

   The CALLER owns ui_band_up: a box about to go down raises it first, so
   a widget straddling the band does not paint a stray row above the box;
   textbox_close drops it first, so the widget comes back whole. */
static void tb_clear_band(void)
{
  u16 i;

  for (i = (u16)UI_SHADOW_ROW * 32; i < (u16)(UI_SHADOW_ROW + UI_SHADOW_H) * 32; i++)
    ui_map[i] = 0;
  ui_mark(UI_SHADOW_ROW, UI_SHADOW_H);
  overlay_refresh();
  timer_refresh();
  /* On a Mode 7 world map the dialogue band is a MODE-1 band cut into
     the plane by HDMA (m7.c): no box, no band. Inert everywhere else. */
  m7_ui_band(0);
}

/* Draws the WINDOW (col,row,w,h in absolute tiles) into ui_map: the
   windowskin's 9-slice frame if there is one, otherwise a solid box —
   the rest of the dialogue band goes back to transparent. */
static void tb_box_at(u8 col, u8 row, u8 w, u8 h)
{
  u8 x, y, sy;
  u16 base, mid, fill;

  /* the band belongs to the box from here on (U2) */
  ui_band_up = 1;
  tb_clear_band();
  if (tb_skin) /* 9-slice of the current style — the test is OUTSIDE
                  the loops: opening a message must fit in its frame (the
                  engine has already grazed a lag frame here) */
  {
    for (y = 0; y < h; y++)
    {
      base = (u16)(row + y) * 32 + col;
      sy = y == 0 ? 0 : (y == (u8)(h - 1) ? 2 : 1);
      mid = TB_ENTRY(tb_skin + sy * 3 + 1);
      ui_map[base] = TB_ENTRY(tb_skin + sy * 3);
      for (x = 1; x < (u8)(w - 1); x++)
        ui_map[base + x] = mid;
      ui_map[base + w - 1] = TB_ENTRY(tb_skin + sy * 3 + 2);
    }
  }
  else
  {
    fill = TB_ENTRY(TB_CHAR(' '));
    for (y = 0; y < h; y++)
    {
      base = (u16)(row + y) * 32 + col;
      for (x = 0; x < w; x++)
        ui_map[base + x] = fill;
    }
  }
  /* A box is down: on a world map, cut a mode-1 band into the plane from
     the top of the DIALOGUE BAND (the layout's own reserved rows, not
     this box's) so every style lands inside it. */
  m7_ui_band((u8)(UI_SHADOW_ROW * 8));
}

/* Typewriter (UI_TEXT_SPEED frames per character, 0 = instant). State of
   the reveal in progress — EXPLICIT init (tcc statics).
   Special codes (T2): speed \s[n], pauses \. \|, wait \!, auto-close
   \^, instant block \> \< — control bytes < 0x20 left in the buffer
   decoded by text_decode. */
static u8 tw_active;
static u8 tw_timer;
static const char *tw_s;
static u8 tw_row, tw_col;
static u8 tw_speed;    /* current frames/character (\s[n], theme default) */
static u8 tw_pause;    /* pause frames left (\. \|) */
static u8 tw_waitkey;  /* \! wait point: A to resume */
static u8 tw_instant;  /* \> ... \< block: reveal with no delay */
static u8 tb_autoclose; /* \^: the VM closes without waiting for a press */

/* DISPLAYED length of the word following s[0] (word wrap): control bytes
   do not count, 0x01/0x02 carry a parameter. */
static u16 tw_word_len(const char *s)
{
  u16 wl = 0, j = 1;

  while (s[j] && s[j] != ' ')
  {
    if ((u8)s[j] >= 0x20)
    {
      wl++;
      j++;
    }
    else
      j += ((u8)s[j] <= 0x02) ? 2 : 1;
  }
  return wl;
}

/* Reveals ONE character — same word-wrap logic as the instant rendering
   in textbox_open_raw. Control codes are consumed first (in the same
   frame: a code never costs a tick, except those that suspend the
   reveal — pause, wait). */
static void tw_step(void)
{
  char c;
  u16 wl;

  for (;;)
  {
    c = *tw_s;
    if (c == 0x02) /* \s[n]: n frames/character, 0 = instant */
    {
      u8 n = (u8)(tw_s[1] - 1);

      tw_s += 2;
      if (n)
      {
        tw_speed = n;
        tw_instant = 0;
      }
      else
        tw_instant = 1;
      continue;
    }
    if (c == 0x03 || c == 0x04) /* \. short pause, \| long pause */
    {
      tw_s++;
      tw_pause = (c == 0x03) ? 15 : 60;
      return;
    }
    if (c == 0x05) /* \!: wait for A (resumed by textbox_resume) */
    {
      tw_s++;
      tw_waitkey = 1;
      return;
    }
    if (c == 0x06) /* \^: flag read by the VM at the end of the message */
    {
      tw_s++;
      tb_autoclose = 1;
      continue;
    }
    if (c == 0x07) /* \>: start of an instant block */
    {
      tw_s++;
      tw_instant = 1;
      continue;
    }
    if (c == 0x08) /* \<: end of an instant block */
    {
      tw_s++;
      tw_instant = 0;
      return; /* cuts the burst in progress in textbox_tick */
    }
    break;
  }
  if (!c || tw_row >= TB_TEXT_ROWS)
  {
    tw_active = 0;
    return;
  }
  if (c == ' ')
  {
    wl = tw_word_len(tw_s);
    if ((u16)tw_col + 1 + wl > TB_TEXT_COLS)
    {
      tw_row++;
      tw_col = 0;
      tw_s++;
      return;
    }
  }
  if (tw_col >= TB_TEXT_COLS)
  {
    tw_row++;
    tw_col = 0;
    if (tw_row >= TB_TEXT_ROWS)
    {
      tw_active = 0;
      return;
    }
  }
  ui_map[TB_MSG_CELL(tw_row, tw_col)] = TB_ENTRY(TB_CHAR(c));
  ui_mark((u8)(tb_my + 1 + tw_row), 1);
  tw_col++;
  tw_s++;
}

void textbox_tick(void)
{
  if (!tw_active || tw_waitkey)
    return; /* \!: the resume comes from the VM (textbox_resume) */
  if (tw_pause)
  {
    tw_pause--;
    return;
  }
  if (tw_instant)
  {
    /* \> ... \< block (or \s[0]): everything after it goes out at once,
       until the end of the block, a pause or a wait point */
    while (tw_active && tw_instant && !tw_pause && !tw_waitkey)
      tw_step();
    return;
  }
  tw_timer++;
  if (tw_timer < tw_speed)
    return;
  tw_timer = 0;
  tw_step();
}

u8 textbox_busy(void)
{
  return tw_active;
}

void textbox_finish(void)
{
  /* reveal everything at once — except past a \! wait point: the author
     put it there on purpose, the next press will cross it */
  while (tw_active && !tw_waitkey)
  {
    tw_pause = 0;
    tw_step();
  }
  tw_pause = 0;
}

u8 textbox_waiting_key(void)
{
  return (u8)(tw_active && tw_waitkey);
}

void textbox_resume(void)
{
  tw_waitkey = 0;
}

u8 textbox_autoclose(void)
{
  return tb_autoclose;
}

/* Font palette: CGRAM 16-19 (2bpp BG palette 4). Those slots are RESERVED
   (spec §4): datagen puts no tileset colour there, and loading a scene
   (the full BG CGRAM) overwrites them — so this must be called back after
   EVERY scene_load, not just at boot. */
void textbox_load_pal(void)
{
  dmaCopyCGram((u8 *)textbox_pal, 16, 4 * 2);
}

void textbox_set_style(u8 n)
{
  if (n >= UI_STYLE_COUNT)
    n = 0;
  tb_mx = ui_st_mx[n];
  tb_my = ui_st_my[n];
  tb_mw = ui_st_mw[n];
  tb_mh = ui_st_mh[n];
  tb_cx2 = ui_st_cx[n];
  tb_cy2 = ui_st_cy[n];
  tb_cw2 = ui_st_cw[n];
  tb_ch2 = ui_st_ch[n];
  tb_font = ui_st_font[n];
  tb_skin = ui_st_skin[n];
}

/* Puts BG3's chars and map somewhere else and re-uploads the font.
   TWO callers, both Mode 7: a world map moves the UI layer above the OBJ
   region because the plane owns the low half of VRAM, and coming back
   from ANY Mode 7 screen has to put it back — the plane's upload wiped
   the font where it stood, which is why a dialogue after a Mode 7 screen
   used to draw garbage. Screen off. */
void textbox_gfx_at(u16 gfx, u16 map)
{
  bgInitTileSetData(2, (u8 *)font_gfx, font_gfx_size, gfx);
  bgSetMapPtr(2, map, SC_32x32);
}

void textbox_init(void)
{
  /* 2bpp font + palette — screen off, safe transfers. Clearing the BG3
     map is ui_screen_init's job (shared buffer, M1). */
  textbox_gfx_at(VRAM_BG3_GFX, VRAM_BG3_MAP);
  textbox_load_pal();

  textbox_set_style(0); /* default style — EXPLICIT init (tcc) */

  /* typewriter state — EXPLICIT init (tcc statics) */
  tw_active = 0;
  tw_timer = 0;
  tw_s = 0;
  tw_row = 0;
  tw_col = 0;
  tw_speed = UI_TEXT_SPEED ? UI_TEXT_SPEED : 1;
  tw_pause = 0;
  tw_waitkey = 0;
  tw_instant = 0;
  tb_autoclose = 0;
}

void textbox_open(u16 text_id)
{
  text_decode(text_id, tb_text, sizeof(tb_text));
#if UI_TEXT_SPEED
  /* typewriter: empty box, the text reveals through textbox_tick */
  tb_box_at(tb_mx, tb_my, tb_mw, tb_mh);
  tw_active = 1;
  tw_timer = 0;
  tw_s = tb_text;
  tw_row = 0;
  tw_col = 0;
  tw_speed = UI_TEXT_SPEED; /* the previous message's \s[n] is forgotten */
  tw_pause = 0;
  tw_waitkey = 0;
  tw_instant = 0;
  tb_autoclose = 0; /* (re)set by tw_step if it meets \^ */
#else
  textbox_open_raw(tb_text);
#endif
}

/* Dialogue box from a C string (resolved game texts, or the engine
   vocabulary of the System menu) */
void textbox_open_raw(const char *s)
{
  u16 wl;
  u8 row, col;
  char c;

  tw_active = 0; /* an instant render cancels any reveal in progress */
  tb_autoclose = 0;
  tb_box_at(tb_mx, tb_my, tb_mw, tb_mh);

  if (s)
  {
    row = 0; /* text line, relative to the window */
    col = 0;
    while (*s && row < TB_TEXT_ROWS)
    {
      c = *s;
      if ((u8)c < 0x20)
      {
        /* instant rendering: the pacing codes mean nothing here — only
           \^ keeps its effect (close without a press) */
        if (c == 0x06)
          tb_autoclose = 1;
        s += ((u8)c <= 0x02) ? 2 : 1;
        continue;
      }
      if (c == ' ')
      {
        /* word wrap: displayed length of the word after the space */
        wl = tw_word_len(s);
        if ((u16)col + 1 + wl > TB_TEXT_COLS)
        {
          row++;
          col = 0;
          s++;
          continue;
        }
      }
      if (col >= TB_TEXT_COLS)
      {
        row++;
        col = 0;
        if (row >= TB_TEXT_ROWS)
          break;
      }
      ui_map[TB_MSG_CELL(row, col)] = TB_ENTRY(TB_CHAR(c));
      col++;
      s++;
    }
  }
}

/* CHOICE: 2-4 options, one per line, a '>' cursor in front of the
   selected one. Texts are single-line (no wrap). */
void textbox_open_choices(const u16 *text_ids, u8 count, u8 sel)
{
  const char *opts[4];
  u8 i;

  for (i = 0; i < count; i++)
  {
    text_decode(text_ids[i], tb_opts[i & 3], sizeof(tb_opts[0]));
    opts[i & 3] = tb_opts[i & 3];
  }
  textbox_choices_raw(opts, count, sel);
}

/* Choice from C strings (System menu: engine vocabulary) */
void textbox_choices_raw(const char *const *options, u8 count, u8 sel)
{
  const char *s;
  u8 i, col;

  tw_active = 0;
  tb_box_at(tb_cx2, tb_cy2, tb_cw2, tb_ch2);
  for (i = 0; i < count && i < TB_CHC_ROWS; i++)
  {
    s = options[i];
    col = 0;
    while (s && *s && col < TB_CHC_COLS - 2)
    {
      if ((u8)*s < 0x20)
      {
        /* pacing codes are pointless on an option line */
        s += ((u8)*s <= 0x02) ? 2 : 1;
        continue;
      }
      ui_map[TB_CHC_CELL(i, 2 + col)] = TB_ENTRY(TB_CHAR(*s));
      col++;
      s++;
    }
  }
  ui_map[TB_CHC_CELL(sel, 0)] = TB_ENTRY(TB_CHAR('>'));
}

/* Moves the CHOICE cursor (redraws the column of '>') */
void textbox_choice_cursor(u8 sel)
{
  u8 i;

  for (i = 0; i < TB_CHC_ROWS; i++)
    ui_map[TB_CHC_CELL(i, 0)] = TB_ENTRY(TB_BG_CHAR);
  ui_map[TB_CHC_CELL(sel, 0)] = TB_ENTRY(TB_CHAR('>'));
  ui_mark((u8)(tb_cy2 + 1), TB_CHC_ROWS);
}

void textbox_close(void)
{
  tw_active = 0;
  tw_waitkey = 0;
  tw_pause = 0;
  tb_autoclose = 0;
  ui_band_up = 0; /* the widgets laid over the band come back (U2) */
  tb_clear_band();
}
