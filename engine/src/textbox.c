/*
 * textbox.c — fenêtre de dialogue sur BG3.
 *
 * BG3 reste toujours actif : sa map est remplie de char 0 (transparent)
 * quand la boîte est fermée — pas de bascule d'activation de layer.
 * Les glyphes ont un fond opaque (couleur 1), donc la boîte est le simple
 * rectangle des chars écrits. Depuis M1 (Phase 12), le module compose
 * dans le tampon d'écran partagé ui_map (ui_screen.c) — le transfert
 * VRAM est centralisé au VBlank par ui_screen_vblank.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "textbox.h"
#include "rom_layout.h"
#include "vram.h"
#include "vm.h" /* \v[n] : vars16 inserees au decodage (v0.17) */
#include "ui_screen.h" /* tampon BG3 partagé (Phase 12 M1) */
#include "data/ui_cfg.h" /* theme UI v1 : windowskin + text_speed (Ph. 11) */

/* Windowskin 9-slice (spec UI §1) : 9 chars 2bpp après la fonte —
   HG H HD / G C D / BG B BD, même palette que la fonte */
#define TB_SKIN_BASE 97

/* Fonte + palette (data_font.c) */
extern const u8 font_gfx[];
extern const u16 font_gfx_size;
extern const u16 textbox_pal[];

/* Textes : bank $86 (spec §2 v0.7) — [u16 count][u16 offsets]
   [table de paires DTE 256 o][chaînes encodées \0]. Les codes 0x80-0xFF
   désignent une paire de caractères de la table : on décode dans un
   buffer WRAM avant le rendu (le wrap par mot lit en avant). */
/* Tampon du formatage décimal de \v[n] (statique : prudence tcc) */
static char tb_num[5];

static void text_decode(u16 text_id, char *dst, u8 max)
{
  const u8 *tbl = make_far(BANK_TEXTS, BANK_BASE_ADDR);
  u16 count = (u16)tbl[0] | ((u16)tbl[1] << 8);
  const u8 *pairs;
  const u8 *s;
  u16 ofs, k, v;
  u8 n = 0, c, d;

  dst[0] = 0;
  if (text_id >= count)
    return;
  pairs = tbl + 2 + (count << 1);
  ofs = (u16)tbl[2 + (text_id << 1)] | ((u16)tbl[3 + (text_id << 1)] << 8);
  s = make_far(BANK_TEXTS, BANK_BASE_ADDR + ofs);
  while (*s && n < (u8)(max - 2))
  {
    c = *s++;
    if (c == 0x01)
    {
      /* \v[n] (v0.17, spec §2) : [0x01][n+1] — insère vars16[n] en
         décimal (1 à 5 chiffres) AVANT le wrap, qui reste naturel */
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

/* Buffers de décodage (WRAM) : un message plein écran, 4 options */
static char tb_text[176];
static char tb_opts[4][28];

/* Géométrie : fenêtres MESSAGE et CHOIX du layout uigen (ui_cfg.h,
   positions/tailles EN TILES — docs/SPEC_SYSTEME_UI.md §3). Depuis M1,
   l'adressage est ABSOLU dans ui_map ; UI_SHADOW_* ne sert plus qu'à
   borner la bande à effacer (union des rangées des deux fenêtres). */
#define TB_TEXT_COLS (UI_MSG_W - 4) /* cadre : 2 tiles de marge par côté */
#define TB_TEXT_ROWS (UI_MSG_H - 2) /* cadre : 1 rangée haut et bas */
#define TB_CHC_COLS (UI_CHC_W - 4)
#define TB_CHC_ROWS (UI_CHC_H - 2)
/* cellule ui_map (ligne de texte l, colonne c) de chaque fenêtre */
#define TB_MSG_CELL(l, c) \
  ((u16)(UI_MSG_ROW + 1 + (l)) * 32 + UI_MSG_COL + 2 + (c))
#define TB_CHC_CELL(l, c) \
  ((u16)(UI_CHC_ROW + 1 + (l)) * 32 + UI_CHC_COL + 2 + (c))

/* Entrée BG3 : char 2bpp + palette 4 (CGRAM 16) + priorité (au-dessus de
   tout avec le bit BG3-prio du mode 1) */
#define TB_ENTRY(c) ((u16)(c) | 0x3000)
#define TB_CHAR(ascii) ((u16)(ascii) - 31) /* char 0 = transparent, 1 = espace */
/* Tuile de fond d'une fenêtre (effacement du curseur de choix) */
#if UI_HAS_SKIN
#define TB_BG_CHAR (TB_SKIN_BASE + 4) /* centre du 9-slice */
#else
#define TB_BG_CHAR TB_CHAR(' ')
#endif

/* Efface la BANDE du dialogue (union des rangées message/choix) dans le
   tampon partagé — les autres zones de ui_map (HUD, timer) survivent. */
static void tb_clear_band(void)
{
  u16 i;

  for (i = (u16)UI_SHADOW_ROW * 32; i < (u16)(UI_SHADOW_ROW + UI_SHADOW_H) * 32; i++)
    ui_map[i] = 0;
  ui_mark(UI_SHADOW_ROW, UI_SHADOW_H);
}

/* Dessine la FENÊTRE (col,row,w,h en tiles absolus) dans ui_map :
   cadre 9-slice du windowskin s'il existe, sinon boîte pleine — le
   reste de la bande du dialogue redevient transparent. */
static void tb_box_at(u8 col, u8 row, u8 w, u8 h)
{
  u8 x, y, sy;
  u16 base;

  tb_clear_band();
  for (y = 0; y < h; y++)
  {
    base = (u16)(row + y) * 32 + col;
    sy = y == 0 ? 0 : (y == (u8)(h - 1) ? 2 : 1);
    for (x = 0; x < w; x++)
    {
#if UI_HAS_SKIN
      ui_map[base + x] = TB_ENTRY(
          TB_SKIN_BASE + sy * 3 + (x == 0 ? 0 : (x == (u8)(w - 1) ? 2 : 1)));
#else
      ui_map[base + x] = TB_ENTRY(TB_CHAR(' '));
#endif
    }
  }
}

/* Machine à écrire (UI_TEXT_SPEED frames par caractère, 0 = instantané).
   État de la révélation en cours — init EXPLICITE (statics tcc). */
static u8 tw_active;
static u8 tw_timer;
static const char *tw_s;
static u8 tw_row, tw_col;

/* Révèle UN caractère — même logique de wrap par mot que le rendu
   instantané de textbox_open_raw */
static void tw_step(void)
{
  char c;
  u16 wl;

  c = *tw_s;
  if (!c || tw_row >= TB_TEXT_ROWS)
  {
    tw_active = 0;
    return;
  }
  if (c == ' ')
  {
    wl = 0;
    while (tw_s[wl + 1] && tw_s[wl + 1] != ' ')
      wl++;
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
  ui_mark((u8)(UI_MSG_ROW + 1 + tw_row), 1);
  tw_col++;
  tw_s++;
}

void textbox_tick(void)
{
  if (!tw_active)
    return;
  tw_timer++;
  if (tw_timer < UI_TEXT_SPEED)
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
  while (tw_active)
    tw_step();
}

/* Palette de la fonte : CGRAM 16-19 (palette BG 2bpp n°4). Ces slots sont
   RÉSERVÉS (spec §4) : datagen n'y place aucune couleur de tileset, et le
   chargement de scène (CGRAM BG complète) les écrase — à rappeler après
   CHAQUE scene_load, pas seulement au boot. */
void textbox_load_pal(void)
{
  dmaCopyCGram((u8 *)textbox_pal, 16, 4 * 2);
}

void textbox_init(void)
{
  /* Fonte 2bpp + palette — écran éteint, transferts sûrs. Le nettoyage
     de la map BG3 est fait par ui_screen_init (tampon partagé, M1). */
  bgInitTileSetData(2, (u8 *)font_gfx, font_gfx_size, VRAM_BG3_GFX);
  textbox_load_pal();
  bgSetMapPtr(2, VRAM_BG3_MAP, SC_32x32);

  /* état machine à écrire — init EXPLICITE (statics tcc) */
  tw_active = 0;
  tw_timer = 0;
  tw_s = 0;
  tw_row = 0;
  tw_col = 0;
}

void textbox_open(u16 text_id)
{
  text_decode(text_id, tb_text, sizeof(tb_text));
#if UI_TEXT_SPEED
  /* machine à écrire : boîte vide, le texte se révèle via textbox_tick */
  tb_box_at(UI_MSG_COL, UI_MSG_ROW, UI_MSG_W, UI_MSG_H);
  tw_active = 1;
  tw_timer = 0;
  tw_s = tb_text;
  tw_row = 0;
  tw_col = 0;
#else
  textbox_open_raw(tb_text);
#endif
}

/* Boîte de dialogue depuis une chaîne C (textes du jeu résolus, ou
   vocabulaire moteur du menu Système — spec §5) */
void textbox_open_raw(const char *s)
{
  u16 wl;
  u8 row, col;
  char c;

  tw_active = 0; /* un rendu instantané annule toute révélation en cours */
  tb_box_at(UI_MSG_COL, UI_MSG_ROW, UI_MSG_W, UI_MSG_H);

  if (s)
  {
    row = 0; /* ligne de texte, relative à la fenêtre */
    col = 0;
    while (*s && row < TB_TEXT_ROWS)
    {
      c = *s;
      if (c == ' ')
      {
        /* wrap par mot : longueur du mot qui suit l'espace */
        wl = 0;
        while (s[wl + 1] && s[wl + 1] != ' ')
          wl++;
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

/* CHOICE (spec §2 v0.6) : 2-4 options, une par ligne, curseur '>' devant
   l'option sélectionnée. Textes sur une seule ligne (pas de wrap). */
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

/* Choix depuis des chaînes C (menu Système : vocabulaire moteur) */
void textbox_choices_raw(const char *const *options, u8 count, u8 sel)
{
  const char *s;
  u8 i, col;

  tw_active = 0;
  tb_box_at(UI_CHC_COL, UI_CHC_ROW, UI_CHC_W, UI_CHC_H);
  for (i = 0; i < count && i < TB_CHC_ROWS; i++)
  {
    s = options[i];
    col = 0;
    while (s && *s && col < TB_CHC_COLS - 2)
    {
      ui_map[TB_CHC_CELL(i, 2 + col)] = TB_ENTRY(TB_CHAR(*s));
      col++;
      s++;
    }
  }
  ui_map[TB_CHC_CELL(sel, 0)] = TB_ENTRY(TB_CHAR('>'));
}

/* Déplace le curseur du CHOICE (redessine la colonne des '>') */
void textbox_choice_cursor(u8 sel)
{
  u8 i;

  for (i = 0; i < TB_CHC_ROWS; i++)
    ui_map[TB_CHC_CELL(i, 0)] = TB_ENTRY(TB_BG_CHAR);
  ui_map[TB_CHC_CELL(sel, 0)] = TB_ENTRY(TB_CHAR('>'));
  ui_mark(UI_CHC_ROW + 1, TB_CHC_ROWS);
}

void textbox_close(void)
{
  tw_active = 0;
  tb_clear_band();
}
