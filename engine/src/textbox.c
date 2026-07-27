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

/* Fonte + palette (data_font.c) */
extern const u8 font_gfx[];
extern const u16 font_gfx_size;
extern const u16 textbox_pal[];

/* Textes : bank $86 (spec §2) — [u16 count][u16 offsets][chaînes \0].
   Retourne 0 si text_id hors table. */
static const char *text_ptr(u16 text_id)
{
  const u8 *tbl = make_far(BANK_TEXTS, BANK_BASE_ADDR);
  u16 count = (u16)tbl[0] | ((u16)tbl[1] << 8);
  u16 ofs;

  if (text_id >= count)
    return 0;
  ofs = (u16)tbl[2 + (text_id << 1)] | ((u16)tbl[3 + (text_id << 1)] << 8);
  return (const char *)make_far(BANK_TEXTS, BANK_BASE_ADDR + ofs);
}

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
}

void textbox_open(u16 text_id)
{
  textbox_open_raw(text_ptr(text_id));
}

/* Boîte de dialogue depuis une chaîne C (textes du jeu résolus, ou
   vocabulaire moteur du menu Système — spec §5) */
void textbox_open_raw(const char *s)
{
  u16 wl;
  u8 row, col;
  char c;

  /* Fond de boîte : chars "espace" opaques partout */
  tb_fill(TB_ENTRY(TB_CHAR(' ')));

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
    opts[i & 3] = text_ptr(text_ids[i]);
  textbox_choices_raw(opts, count, sel);
}

/* Choix depuis des chaînes C (menu Système : vocabulaire moteur) */
void textbox_choices_raw(const char *const *options, u8 count, u8 sel)
{
  const char *s;
  u8 i, col;

  tb_fill(TB_ENTRY(TB_CHAR(' ')));
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
