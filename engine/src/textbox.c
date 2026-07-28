/*
 * textbox.c — fenêtre de dialogue sur BG3.
 *
 * BG3 reste toujours actif : sa map est remplie de char 0 (transparent)
 * quand la boîte est fermée — pas de bascule d'activation de layer.
 * Les glyphes ont un fond opaque (couleur 1), donc la boîte est le simple
 * rectangle des chars écrits. Écritures VRAM différées au VBlank.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "textbox.h"
#include "rom_layout.h"
#include "vram.h"
#include "vm.h" /* \v[n] : vars16 inserees au decodage (v0.17) */
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

/* Géométrie de la boîte (rangées de la map BG3 32x32) */
#define TB_ROW 20       /* première rangée de la boîte (y = 160 px) */
#define TB_ROWS 8       /* hauteur totale (64 px) */
#define TB_TEXT_COL 2   /* marge gauche du texte */
#define TB_TEXT_COLS 28 /* largeur utile en caractères */
#define TB_TEXT_ROW 1   /* première ligne de texte (relative à TB_ROW) */
#define TB_TEXT_ROWS 6  /* nombre de lignes de texte */

/* Entrée BG3 : char 2bpp + palette 4 (CGRAM 16) + priorité (au-dessus de
   tout avec le bit BG3-prio du mode 1) */
#define TB_ENTRY(c) ((u16)(c) | 0x3000)
#define TB_CHAR(ascii) ((u16)(ascii) - 31) /* char 0 = transparent, 1 = espace */

static u16 tb_shadow[32 * TB_ROWS];
static u8 tb_dirty;

static void tb_fill(u16 entry)
{
  u16 i;

  for (i = 0; i < 32 * TB_ROWS; i++)
    tb_shadow[i] = entry;
}

/* Fond de boîte : cadre 9-slice du windowskin s'il existe, sinon la
   boîte pleine historique (chars espace opaques) */
static void tb_box(void)
{
#if UI_HAS_SKIN
  u8 x, y, sx, sy;

  for (y = 0; y < TB_ROWS; y++)
  {
    sy = y == 0 ? 0 : (y == TB_ROWS - 1 ? 2 : 1);
    for (x = 0; x < 32; x++)
    {
      sx = x == 0 ? 0 : (x == 31 ? 2 : 1);
      tb_shadow[(u16)y * 32 + x] = TB_ENTRY(TB_SKIN_BASE + sy * 3 + sx);
    }
  }
#else
  tb_fill(TB_ENTRY(TB_CHAR(' ')));
#endif
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
  if (!c || tw_row >= TB_TEXT_ROW + TB_TEXT_ROWS)
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
    if (tw_row >= TB_TEXT_ROW + TB_TEXT_ROWS)
    {
      tw_active = 0;
      return;
    }
  }
  tb_shadow[(u16)tw_row * 32 + TB_TEXT_COL + tw_col] = TB_ENTRY(TB_CHAR(c));
  tw_col++;
  tw_s++;
  tb_dirty = 1;
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
  /* Fonte 2bpp + palette — écran éteint, transferts sûrs */
  bgInitTileSetData(2, (u8 *)font_gfx, font_gfx_size, VRAM_BG3_GFX);
  textbox_load_pal();
  bgSetMapPtr(2, VRAM_BG3_MAP, SC_32x32);

  /* Map BG3 entièrement transparente (char 0) : le shadow ne couvre que la
     zone de la boîte, on l'utilise 4 fois pour effacer les 32 rangées */
  tb_fill(0);
  dmaCopyVram((u8 *)tb_shadow, VRAM_BG3_MAP, 32 * TB_ROWS * 2);
  dmaCopyVram((u8 *)tb_shadow, VRAM_BG3_MAP + 32 * TB_ROWS, 32 * TB_ROWS * 2);
  dmaCopyVram((u8 *)tb_shadow, VRAM_BG3_MAP + 32 * TB_ROWS * 2,
              32 * TB_ROWS * 2);
  dmaCopyVram((u8 *)tb_shadow, VRAM_BG3_MAP + 32 * TB_ROWS * 3,
              32 * TB_ROWS * 2);
  tb_dirty = 0;

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
  tb_box();
  tw_active = 1;
  tw_timer = 0;
  tw_s = tb_text;
  tw_row = TB_TEXT_ROW;
  tw_col = 0;
  tb_dirty = 1;
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
  tb_box();

  if (s)
  {
    row = TB_TEXT_ROW;
    col = 0;
    while (*s && row < TB_TEXT_ROW + TB_TEXT_ROWS)
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
        if (row >= TB_TEXT_ROW + TB_TEXT_ROWS)
          break;
      }
      tb_shadow[(u16)row * 32 + TB_TEXT_COL + col] = TB_ENTRY(TB_CHAR(c));
      col++;
      s++;
    }
  }

  tb_dirty = 1;
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
  tb_box();
  for (i = 0; i < count; i++)
  {
    s = options[i];
    col = 0;
    while (s && *s && col < TB_TEXT_COLS - 2)
    {
      tb_shadow[(u16)(TB_TEXT_ROW + i) * 32 + TB_TEXT_COL + 2 + col] =
          TB_ENTRY(TB_CHAR(*s));
      col++;
      s++;
    }
  }
  tb_shadow[(u16)(TB_TEXT_ROW + sel) * 32 + TB_TEXT_COL] = TB_ENTRY(TB_CHAR('>'));
  tb_dirty = 1;
}

/* Déplace le curseur du CHOICE (redessine la colonne des '>') */
void textbox_choice_cursor(u8 sel)
{
  u8 i;

  for (i = 0; i < TB_TEXT_ROWS; i++)
    tb_shadow[(u16)(TB_TEXT_ROW + i) * 32 + TB_TEXT_COL] =
        TB_ENTRY(TB_CHAR(' '));
  tb_shadow[(u16)(TB_TEXT_ROW + sel) * 32 + TB_TEXT_COL] = TB_ENTRY(TB_CHAR('>'));
  tb_dirty = 1;
}

void textbox_close(void)
{
  tw_active = 0;
  tb_fill(0);
  tb_dirty = 1;
}

void textbox_vblank(void)
{
  if (tb_dirty)
  {
    tb_dirty = 0;
    dmaCopyVram((u8 *)tb_shadow, VRAM_BG3_MAP + TB_ROW * 32,
                32 * TB_ROWS * 2);
  }
}
