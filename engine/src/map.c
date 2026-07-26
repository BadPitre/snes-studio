/*
 * map.c — fenêtre VRAM + streaming du tilemap BG1.
 *
 * Adressage SC_64x64 : 4 écrans consécutifs de 32x32 mots
 * (0=haut-gauche, 1=haut-droit, 2=bas-gauche, 3=bas-droit).
 * Char (X,Y) 0..63 → écran (X>>5) + ((Y>>5)<<1), offset (Y&31)*32 + (X&31).
 *
 * Le BG hardware boucle sur 512 px : la fenêtre est exactement la zone de
 * wrap, donc char VRAM = coordonnée map (mod 64) et les registres de scroll
 * reçoivent la position caméra telle quelle.
 *
 * Convention metatile v0 (spec §0.4) : 1 metatile 16x16 = 1 char répété 2x2 —
 * une seule valeur par metatile, écrite aux 4 positions.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "camera.h"
#include "map.h"
#include "vram.h"

#define WIN_W 32     /* fenêtre en metatiles = tilemap SC_64x64 complet */
#define WIN_H 32
#define WIN_MARGIN 8 /* avance de la fenêtre sur le bord visible */

/* $2115 : incrément VRAM après octet haut, +1 mot (lignes) / +32 mots
   (colonnes). $4300/01 : mode 1 (2 registres), gate $2118 (cf dmaCopyVram) */
#define VMAIN_INC1 0x80
#define VMAIN_INC32 0x81
#define DMA_VRAM_CTRL 0x1801

/* Table de metatiles courante (voir map_set_metatiles) */
static const u16 *mt_table;

/* Coin haut-gauche de la fenêtre, en metatiles */
static u16 win_x, win_y;

/* Fenêtre complète pour le remplissage initial (écran éteint) */
static u16 bg_map_buffer[4096];

/* Buffers de streaming, indexés par coordonnée char VRAM absolue (0..63).
   Une colonne/ligne de metatiles = 2 colonnes/lignes de chars DISTINCTS
   (table de metatiles) : un buffer par colonne/ligne de chars. */
static u16 col_buf[2][64];
static u16 row_buf[2][64];
static u8 col_pending, row_pending;
static u16 col_vram_x; /* colonne char VRAM (paire, 0..62) */
static u16 row_vram_y; /* ligne char VRAM (paire, 0..62) */

/* Position cible de la fenêtre pour une caméra donnée (caméra déjà clampée
   aux bords de map par camera_update — piège kit §8) */
static u16 map_win_target(u16 cam, u8 map_size)
{
  u16 t = cam >> 4;
  if (t > WIN_MARGIN)
    t -= WIN_MARGIN;
  else
    t = 0;
  if (t > (u16)map_size - WIN_W)
    t = (u16)map_size - WIN_W;
  return t;
}

void map_set_metatiles(const u16 *table)
{
  mt_table = table;
}

void map_init(void)
{
  u16 mx, my, amx, amy, bx, by, entry, screen, ofs;
  const u8 *src;

  win_x = map_win_target(camera.x, scene_ctx.map_w);
  win_y = map_win_target(camera.y, scene_ctx.map_h);
  col_pending = 0;
  row_pending = 0;

  for (my = 0; my < WIN_H; my++)
  {
    amy = win_y + my;
    src = scene_ctx.tilemap + amy * (u16)scene_ctx.map_w + win_x;
    for (mx = 0; mx < WIN_W; mx++)
    {
      amx = win_x + mx;
      entry = (u16)(*src++) << 2; /* base dans la table de metatiles */
      for (by = (amy << 1) & 63; by <= ((amy << 1) & 63) + 1; by++)
      {
        for (bx = (amx << 1) & 63; bx <= ((amx << 1) & 63) + 1; bx++)
        {
          screen = (bx >> 5) + ((by >> 5) << 1);
          ofs = (screen << 10) + ((by & 31) << 5) + (bx & 31);
          bg_map_buffer[ofs] = mt_table[entry + ((by & 1) << 1) + (bx & 1)];
        }
      }
    }
  }

  dmaCopyVram((u8 *)bg_map_buffer, VRAM_BG1_MAP, 4096 * 2);
}

/* Prépare la colonne de metatiles mx (rangées win_y..win_y+31) */
static void map_queue_col(u16 mx)
{
  u16 my, y;
  const u8 *src = scene_ctx.tilemap + win_y * (u16)scene_ctx.map_w + mx;

  for (my = 0; my < WIN_H; my++)
  {
    const u16 *mt = mt_table + ((u16)(*src) << 2);

    y = ((win_y + my) << 1) & 63; /* paire : y+1 <= 63 */
    col_buf[0][y] = mt[0];     /* TL */
    col_buf[0][y + 1] = mt[2]; /* BL */
    col_buf[1][y] = mt[1];     /* TR */
    col_buf[1][y + 1] = mt[3]; /* BR */
    src += scene_ctx.map_w;
  }
  col_vram_x = (mx << 1) & 63;
  col_pending = 1;
}

/* Prépare la ligne de metatiles my (colonnes win_x..win_x+31) */
static void map_queue_row(u16 my)
{
  u16 mx, x;
  const u8 *src = scene_ctx.tilemap + my * (u16)scene_ctx.map_w + win_x;

  for (mx = 0; mx < WIN_W; mx++)
  {
    const u16 *mt = mt_table + ((u16)(*src) << 2);

    x = ((win_x + mx) << 1) & 63;
    row_buf[0][x] = mt[0];     /* TL */
    row_buf[0][x + 1] = mt[1]; /* TR */
    row_buf[1][x] = mt[2];     /* BL */
    row_buf[1][x + 1] = mt[3]; /* BR */
    src++;
  }
  row_vram_y = (my << 1) & 63;
  row_pending = 1;
}

void map_update(void)
{
  u16 tx = map_win_target(camera.x, scene_ctx.map_w);
  u16 ty = map_win_target(camera.y, scene_ctx.map_h);

  /* 1 pas max par frame et par axe (caméra à 1 px/frame : garanti).
     Les deux fenêtres sont mises à jour AVANT de préparer les buffers,
     pour que colonne et ligne couvrent la fenêtre finale. */
  if (ty > win_y)
  {
    win_y++;
    map_queue_row(win_y + WIN_H - 1);
  }
  else if (ty < win_y)
  {
    win_y--;
    map_queue_row(win_y);
  }

  if (tx > win_x)
  {
    win_x++;
    map_queue_col(win_x + WIN_W - 1);
  }
  else if (tx < win_x)
  {
    win_x--;
    map_queue_col(win_x);
  }
}

/* Une colonne char : 2 segments verticaux (écran haut : rangées 0-31,
   écran bas : rangées 32-63), incrément VRAM +32 mots */
static void map_col_dma(u16 bx, u16 *buf)
{
  u16 base = VRAM_BG1_MAP + ((bx >> 5) << 10) + (bx & 31);

  dmaCopyVram7((u8 *)&buf[0], base, 32 * 2, VMAIN_INC32, DMA_VRAM_CTRL);
  dmaCopyVram7((u8 *)&buf[32], base + (2 << 10), 32 * 2, VMAIN_INC32,
               DMA_VRAM_CTRL);
}

/* Une ligne char : 2 segments horizontaux (écran gauche, écran droit),
   incrément VRAM +1 mot */
static void map_row_dma(u16 by, u16 *buf)
{
  u16 base = VRAM_BG1_MAP + (((by >> 5) << 1) << 10) + ((by & 31) << 5);

  dmaCopyVram7((u8 *)&buf[0], base, 32 * 2, VMAIN_INC1, DMA_VRAM_CTRL);
  dmaCopyVram7((u8 *)&buf[32], base + (1 << 10), 32 * 2, VMAIN_INC1,
               DMA_VRAM_CTRL);
}

void map_vblank(void)
{
  if (col_pending)
  {
    map_col_dma(col_vram_x, col_buf[0]);
    map_col_dma(col_vram_x + 1, col_buf[1]);
    col_pending = 0;
  }
  if (row_pending)
  {
    map_row_dma(row_vram_y, row_buf[0]);
    map_row_dma(row_vram_y + 1, row_buf[1]);
    row_pending = 0;
  }
}
