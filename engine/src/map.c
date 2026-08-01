/*
 * map.c — fenêtre VRAM + streaming des tilemaps des deux couches.
 *
 * BG2 = couche inférieure (sol), BG1 = couche supérieure. Les deux couches
 * partagent charset, palette, fenêtre et scroll ; seule la couche sup
 * applique la table de priorités (☆ → bit 0x2000, devant les sprites).
 *
 * Adressage SC_64x64 : 4 écrans consécutifs de 32x32 mots
 * (0=haut-gauche, 1=haut-droit, 2=bas-gauche, 3=bas-droit).
 * Char (X,Y) 0..63 → écran (X>>5) + ((Y>>5)<<1), offset (Y&31)*32 + (X&31).
 *
 * Le BG hardware boucle sur 512 px : la fenêtre est exactement la zone de
 * wrap, donc char VRAM = coordonnée map (mod 64) et les registres de scroll
 * reçoivent la position caméra telle quelle.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "camera.h"
#include "map.h"
#include "vbudget.h"
#include "vram.h"
#include "vramjob.h"
#include "effectlayer.h"

#define WIN_W 32     /* fenêtre en metatiles = tilemap SC_64x64 complet */
#define WIN_H 32
#define WIN_MARGIN 8 /* avance de la fenêtre sur le bord visible */

/* Bit de priorité d'une entrée BG ($2105) — tiles ☆ de la couche sup */
#define BG_PRIO 0x2000

/* Plans de transfert (P6) — montés par map_queue_col/row, déclenchés
   par map_vblank. Définis plus bas, près de map_vblank. */
static void map_plan_col(u16 j, u16 base_vram, u16 bx, u16 *buf);
static void map_plan_row(u16 j, u16 base_vram, u16 by, u16 *buf);

/* Tables courantes du tileset (voir map_set_metatiles) */
static const u16 *mt_table;
static const u8 *prio_table;

/* Priorité forcée de la couche basse (S17) : BG_PRIO quand un panorama
   est actif — la couche basse (BG2.1) couvre alors le motif BG1 basse
   priorité, sauf sur les tuiles gommées. 0 sinon (rendu inchangé). */
static u16 lo_prio;

/* Coin haut-gauche de la fenêtre, en metatiles */
static u16 win_x, win_y;

/* Fenêtre complète pour le remplissage initial (écran éteint) — réutilisée
   pour les deux couches, un DMA à la fois */
static u16 bg_map_buffer[4096];

/* Buffers de streaming, indexés par coordonnée char VRAM absolue (0..63).
   Une colonne/ligne de metatiles = 2 colonnes/lignes de chars DISTINCTS
   (table de metatiles) : un buffer par colonne/ligne de chars, par couche
   (lo = inférieure/BG2, up = supérieure/BG1). */
static u16 col_lo[2][64], col_up[2][64];
static u16 row_lo[2][64], row_up[2][64];
static u8 col_pending, row_pending;
static u16 col_vram_x; /* colonne char VRAM (paire, 0..62) */
static u16 row_vram_y; /* ligne char VRAM (paire, 0..62) */

/* Position cible de la fenêtre pour une caméra donnée (caméra déjà clampée
   aux bords de map par camera_update — piège kit §8). Une map plus petite
   que la fenêtre (min 20x15 depuis la v0.4) tient entièrement dedans :
   fenêtre fixe à 0, pas de streaming sur cet axe. */
static u16 map_win_target(u16 cam, u8 map_size)
{
  u16 t;

  if ((u16)map_size <= WIN_W)
    return 0;
  t = cam >> 4;
  if (t > WIN_MARGIN)
    t -= WIN_MARGIN;
  else
    t = 0;
  if (t > (u16)map_size - WIN_W)
    t = (u16)map_size - WIN_W;
  return t;
}

void map_set_metatiles(const u16 *table, const u8 *prio)
{
  mt_table = table;
  prio_table = prio;
}

/* Remplit bg_map_buffer avec la fenêtre d'une couche et la transfère.
   prio = 0 pour la couche inf, 1 pour appliquer la table de priorités. */
static void map_fill_layer(const u8 *tilemap, u16 vram, u8 with_prio)
{
  u16 mx, my, amx, amy, bx, by, entry, screen, ofs, pr;
  const u8 *src;

  for (my = 0; my < WIN_H; my++)
  {
    amy = win_y + my;
    src = tilemap + amy * (u16)scene_ctx.map_w + win_x;
    for (mx = 0; mx < WIN_W; mx++)
    {
      amx = win_x + mx;
      /* hors map (map plus petite que la fenêtre) : char 0 transparent —
         jamais visible, la caméra est clampée aux bords de map */
      if (amy >= scene_ctx.map_h || amx >= scene_ctx.map_w)
      {
        for (by = (amy << 1) & 63; by <= ((amy << 1) & 63) + 1; by++)
        {
          for (bx = (amx << 1) & 63; bx <= ((amx << 1) & 63) + 1; bx++)
          {
            screen = (bx >> 5) + ((by >> 5) << 1);
            ofs = (screen << 10) + ((by & 31) << 5) + (bx & 31);
            bg_map_buffer[ofs] = 0;
          }
        }
        continue;
      }
      entry = (u16)(*src) << 2; /* base dans la table de metatiles */
      pr = with_prio ? 0 : lo_prio; /* couche basse : priorité si panorama */
      if (with_prio && prio_table[*src])
        pr = BG_PRIO;
      src++;
      for (by = (amy << 1) & 63; by <= ((amy << 1) & 63) + 1; by++)
      {
        for (bx = (amx << 1) & 63; bx <= ((amx << 1) & 63) + 1; bx++)
        {
          screen = (bx >> 5) + ((by >> 5) << 1);
          ofs = (screen << 10) + ((by & 31) << 5) + (bx & 31);
          bg_map_buffer[ofs] = mt_table[entry + ((by & 1) << 1) + (bx & 1)] | pr;
        }
      }
    }
  }

  dmaCopyVram((u8 *)bg_map_buffer, vram, 4096 * 2);
}

void map_init(void)
{
  /* Panorama (S17) : la couche basse passe en priorité pour couvrir le
     motif BG1 (basse priorité) derrière elle — sauf sur les tuiles
     gommées, qui laissent voir le panorama. 0 = rendu inchangé. */
  lo_prio = effect_is_back() ? BG_PRIO : 0;
  win_x = map_win_target(camera.x, scene_ctx.map_w);
  win_y = map_win_target(camera.y, scene_ctx.map_h);
  col_pending = 0;
  row_pending = 0;

  map_fill_layer(scene_ctx.tilemap, VRAM_BG2_MAP, 0);
  /* Couche d'effet (S9) : la région VRAM de la carte BG1 porte le motif
     — la couche sup n'existe pas dans ces scènes, NE PAS y écrire */
  if (!effect_active())
    map_fill_layer(scene_ctx.tilemap_upper, VRAM_BG1_MAP, 1);
}

/* Prépare la colonne de metatiles mx (rangées win_y..win_y+31), 2 couches */
static void map_queue_col(u16 mx)
{
  u16 my, y, pr;
  const u8 *src = scene_ctx.tilemap + win_y * (u16)scene_ctx.map_w + mx;
  const u8 *usrc = scene_ctx.tilemap_upper + win_y * (u16)scene_ctx.map_w + mx;

  for (my = 0; my < WIN_H; my++)
  {
    const u16 *mt;
    const u16 *um;

    y = ((win_y + my) << 1) & 63; /* paire : y+1 <= 63 */
    if (win_y + my >= scene_ctx.map_h)
    {
      /* hors map (hauteur < fenêtre) : char 0, jamais visible */
      col_lo[0][y] = 0;
      col_lo[0][y + 1] = 0;
      col_lo[1][y] = 0;
      col_lo[1][y + 1] = 0;
      col_up[0][y] = 0;
      col_up[0][y + 1] = 0;
      col_up[1][y] = 0;
      col_up[1][y + 1] = 0;
      continue;
    }
    mt = mt_table + ((u16)(*src) << 2);
    um = mt_table + ((u16)(*usrc) << 2);
    pr = prio_table[*usrc] ? BG_PRIO : 0;
    col_lo[0][y] = mt[0] | lo_prio;     /* TL */
    col_lo[0][y + 1] = mt[2] | lo_prio; /* BL */
    col_lo[1][y] = mt[1] | lo_prio;     /* TR */
    col_lo[1][y + 1] = mt[3] | lo_prio; /* BR */
    col_up[0][y] = um[0] | pr;
    col_up[0][y + 1] = um[2] | pr;
    col_up[1][y] = um[1] | pr;
    col_up[1][y + 1] = um[3] | pr;
    src += scene_ctx.map_w;
    usrc += scene_ctx.map_w;
  }
  col_vram_x = (mx << 1) & 63;
  /* Plan de transfert monté ICI, hors fenêtre VBlank (P6) : le bloc
     VBlank n'a plus qu'à déclencher. BG1 en DERNIER — la couche
     d'effet (S9) s'arrête au quatrième transfert. */
  map_plan_col(VJ_MAP_COL + 0, VRAM_BG2_MAP, col_vram_x, col_lo[0]);
  map_plan_col(VJ_MAP_COL + 2, VRAM_BG2_MAP, col_vram_x + 1, col_lo[1]);
  map_plan_col(VJ_MAP_COL + 4, VRAM_BG1_MAP, col_vram_x, col_up[0]);
  map_plan_col(VJ_MAP_COL + 6, VRAM_BG1_MAP, col_vram_x + 1, col_up[1]);
  col_pending = 1;
}

/* Prépare la ligne de metatiles my (colonnes win_x..win_x+31), 2 couches */
static void map_queue_row(u16 my)
{
  u16 mx, x, pr;
  const u8 *src = scene_ctx.tilemap + my * (u16)scene_ctx.map_w + win_x;
  const u8 *usrc = scene_ctx.tilemap_upper + my * (u16)scene_ctx.map_w + win_x;

  for (mx = 0; mx < WIN_W; mx++)
  {
    const u16 *mt;
    const u16 *um;

    x = ((win_x + mx) << 1) & 63;
    if (win_x + mx >= scene_ctx.map_w)
    {
      /* hors map (largeur < fenêtre) : char 0, jamais visible */
      row_lo[0][x] = 0;
      row_lo[0][x + 1] = 0;
      row_lo[1][x] = 0;
      row_lo[1][x + 1] = 0;
      row_up[0][x] = 0;
      row_up[0][x + 1] = 0;
      row_up[1][x] = 0;
      row_up[1][x + 1] = 0;
      continue;
    }
    mt = mt_table + ((u16)(*src) << 2);
    um = mt_table + ((u16)(*usrc) << 2);
    pr = prio_table[*usrc] ? BG_PRIO : 0;
    row_lo[0][x] = mt[0] | lo_prio;     /* TL */
    row_lo[0][x + 1] = mt[1] | lo_prio; /* TR */
    row_lo[1][x] = mt[2] | lo_prio;     /* BL */
    row_lo[1][x + 1] = mt[3] | lo_prio; /* BR */
    row_up[0][x] = um[0] | pr;
    row_up[0][x + 1] = um[1] | pr;
    row_up[1][x] = um[2] | pr;
    row_up[1][x + 1] = um[3] | pr;
    src++;
    usrc++;
  }
  row_vram_y = (my << 1) & 63;
  map_plan_row(VJ_MAP_ROW + 0, VRAM_BG2_MAP, row_vram_y, row_lo[0]);
  map_plan_row(VJ_MAP_ROW + 2, VRAM_BG2_MAP, row_vram_y + 1, row_lo[1]);
  map_plan_row(VJ_MAP_ROW + 4, VRAM_BG1_MAP, row_vram_y, row_up[0]);
  map_plan_row(VJ_MAP_ROW + 6, VRAM_BG1_MAP, row_vram_y + 1, row_up[1]);
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

/* Range les DEUX segments verticaux d'une colonne char dans la file
   (P6). Écran haut = rangées 0-31, écran bas = rangées 32-63 ;
   l'adresse VRAM avance de 32 mots entre deux rangées. */
static void map_plan_col(u16 j, u16 base_vram, u16 bx, u16 *buf)
{
  u16 base = base_vram + ((bx >> 5) << 10) + (bx & 31);

  vj_set(j, (const u8 *)&buf[0], base, 32 * 2);
  vj_set(j + 1, (const u8 *)&buf[32], base + (2 << 10), 32 * 2);
}

/* Idem pour une ligne char : 2 segments horizontaux (écran gauche,
   écran droit), mots consécutifs. */
static void map_plan_row(u16 j, u16 base_vram, u16 by, u16 *buf)
{
  u16 base = base_vram + (((by >> 5) << 1) << 10) + ((by & 31) << 5);

  vj_set(j, (const u8 *)&buf[0], base, 32 * 2);
  vj_set(j + 1, (const u8 *)&buf[32], base + (1 << 10), 32 * 2);
}

void map_vblank(void)
{
  u16 n;

  /* La plupart des frames n'ont rien à poser : sortir avant même de
     demander où en est la couche d'effet. */
  if (!col_pending && !row_pending)
    return;
  /* S9 : quand la couche d'effet tourne, la région VRAM de BG1 porte le
     motif et pas la couche sup. Les quatre derniers transferts du plan
     sont justement ceux de BG1 — il suffit de s'arrêter avant. */
  n = effect_active() ? 4 : 8;

  /* Colonne et rangee se demandent leur place separement : quand la
     fenetre est courte, en poser une vaut mieux que n'en poser aucune.
     Ce qui n'est pas transfere reste marque et repassera. */
  if (col_pending && vbl_take(VBL_COST_MAPHALF(n)))
  {
    vj_first = VJ_MAP_COL;
    vj_n = n;
    vj_vmain = VJ_INC32;
    vj_ctrl = VJ_CTRL_VRAM;
    vram_burst();
    col_pending = 0;
  }
  if (row_pending && vbl_take(VBL_COST_MAPHALF(n)))
  {
    vj_first = VJ_MAP_ROW;
    vj_n = n;
    vj_vmain = VJ_INC1;
    vj_ctrl = VJ_CTRL_VRAM;
    vram_burst();
    row_pending = 0;
  }
}
