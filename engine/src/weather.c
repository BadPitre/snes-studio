/*
 * weather.c — météo en particules (S13, façon Weather Effects RM2003) :
 * pluie ou neige en une poignée de sprites recyclés, par-dessus le jeu
 * ET par-dessus la couche d'effet (priorité OBJ 3 — les gouttes passent
 * devant les nuages). État GLOBAL : persiste entre les scènes jusqu'au
 * prochain changement, comme la teinte.
 *
 * Ressources réservées, jamais utilisées ailleurs :
 *  - OAM : entrées 100-123 (le joueur occupe 0-1, les acteurs 2-49) ;
 *  - chars OBJ : blocs 16x16 en FIN de région ($4000) — pluie au char
 *    484, neige au char 486 (rangées basses de la 2e name table ; les
 *    sprite sets par scène plafonnent à ~360 chars, aucune collision).
 *    Un bloc 16x16 = chars c, c+1, c+16, c+17 (grille de names OBJ) ;
 *  - palette OBJ 7 (CGRAM 240-243) — datagen avertit déjà si un set
 *    l'occupe (même règle que la palette BG 7 des pictures).
 *
 * Les chars viennent de data_weather.c (TOUJOURS émis par datagen —
 * zéro donnée en dur dans le moteur), rechargés à chaque scene_load et
 * après une picture (sa fermeture recharge la région OBJ).
 *
 * Simulation en coordonnées ÉCRAN (u8, wrap 256) : la pluie tombe en
 * diagonale à deux vitesses, la neige descend lentement en oscillant.
 * Générateur LCG 16-bit maison — jamais de random de libc.
 */
#include <snes.h>
#include "weather.h"
#include "vram.h"

/* data_weather.c : 2 blocs 16x16 en 4bpp planaire (TL,TR puis BL,BR)
   + 4 couleurs de palette */
extern const u8 wea_rain[128];
extern const u8 wea_snow[128];
extern const u16 wea_pal[4];

#define WEA_MAX 24
#define WEA_OAM(i) ((u16)(100 + (i)) << 2) /* entrées OAM 100-123 */
#define WEA_CHAR_RAIN 484
#define WEA_CHAR_SNOW 486
#define WEA_PRIO 3 /* devant tout — y compris la couche d'effet (BG1H) */

static u8 w_type = 0;  /* 0 aucune, 1 pluie, 2 neige */
static u8 w_count = 0; /* particules actives (8/16/24) */
static u8 w_shown = 0; /* entrées OAM actuellement visibles */
static u8 wx[WEA_MAX];
static u8 wy[WEA_MAX];
static u8 wv[WEA_MAX]; /* variante par particule (vitesse/phase) */
static u16 w_seed = 0x1234;
static u8 w_frm = 0;

static u16 w_lcg(void)
{
  w_seed = w_seed * 25173 + 13849; /* LCG 16-bit, wrap naturel */
  return w_seed;
}

void weather_load(void)
{
  /* blocs 16x16 : rangée haute (c, c+1) puis rangée basse (c+16, c+17)
     — char c à VRAM_OBJ_GFX + c*16 words */
  dmaCopyVram((u8 *)wea_rain, VRAM_OBJ_GFX + WEA_CHAR_RAIN * 16, 64);
  dmaCopyVram((u8 *)wea_rain + 64,
              VRAM_OBJ_GFX + (WEA_CHAR_RAIN + 16) * 16, 64);
  dmaCopyVram((u8 *)wea_snow, VRAM_OBJ_GFX + WEA_CHAR_SNOW * 16, 64);
  dmaCopyVram((u8 *)wea_snow + 64,
              VRAM_OBJ_GFX + (WEA_CHAR_SNOW + 16) * 16, 64);
  dmaCopyCGram((u8 *)wea_pal, 240, 8); /* palette OBJ 7 */
}

void weather_set(u8 type, u8 pow)
{
  u8 i;
  u16 r;

  w_type = type > 2 ? 0 : type;
  if (pow == 0)
    pow = 2;
  if (pow > 3)
    pow = 3;
  w_count = pow << 3; /* 8 / 16 / 24 */
  for (i = 0; i < WEA_MAX; i++)
  {
    r = w_lcg();
    wx[i] = (u8)r;
    wy[i] = (u8)((r >> 8) % 224);
    wv[i] = (u8)(r >> 4);
  }
}

void weather_draw(void)
{
  u8 i, x, y, v;
  u8 chlo, attr;
  u8 *om;
  u8 *px;
  u8 *py;
  u8 *pv;

  if (!w_type)
  {
    /* rien à montrer : cacher les entrées encore visibles, UNE fois */
    for (i = 0; i < w_shown; i++)
      oamSetVisible(WEA_OAM(i), OBJ_HIDE);
    w_shown = 0;
    return;
  }
  /* simulation ET dessin en UNE passe à POINTEURS, écrite DIRECTEMENT
     dans le shadow OAM (oamMemory) : la version en deux boucles
     indexées (update puis draw) relisait wx/wy avec des indexations
     u16 — cumulée à l'ondulation S14, la frame débordait (60 -> 30
     FPS au panneau S6). 4 octets par particule : x, y, char bas,
     attr (vhoo pppc : prio 3, palette 7, 9e bit de char) */
  w_frm++;
  chlo = w_type == 1 ? (u8)WEA_CHAR_RAIN : (u8)WEA_CHAR_SNOW;
  attr = 0x30 | (7 << 1) | 1; /* prio 3, pal 7, char 256+ */
  om = oamMemory + ((u16)100 << 2);
  px = wx;
  py = wy;
  pv = wv;
  if (w_type == 1)
  {
    /* pluie : chute rapide en diagonale, deux vitesses entremêlées */
    for (i = 0; i < w_count; i++)
    {
      v = *pv++;
      x = *px - 2;
      y = *py + ((v & 1) ? 5 : 4);
      if (y >= 224)
      {
        y = 0;
        x = (u8)w_lcg();
      }
      *px++ = x;
      *py++ = y;
      om[0] = x;
      om[1] = y;
      om[2] = chlo;
      om[3] = attr;
      om += 4;
      if (i >= w_shown)
        oamSetEx(WEA_OAM(i), OBJ_SMALL, OBJ_SHOW); /* taille + X9, UNE
          fois (oamSetEx écrase le 9e bit de X — cf actors.c) */
    }
  }
  else
  {
    /* neige : descente lente, oscillation douce par phase */
    for (i = 0; i < w_count; i++)
    {
      v = *pv++;
      x = *px;
      y = *py;
      if ((w_frm ^ v) & 1)
        y++;
      if (((u8)(w_frm + v) & 15) == 0)
        x += (v & 2) ? 1 : 0xFF; /* +1 ou -1 (wrap u8) */
      if (y >= 224)
      {
        y = 0;
        x = (u8)w_lcg();
      }
      *px++ = x;
      *py++ = y;
      om[0] = x;
      om[1] = y;
      om[2] = chlo;
      om[3] = attr;
      om += 4;
      if (i >= w_shown)
        oamSetEx(WEA_OAM(i), OBJ_SMALL, OBJ_SHOW);
    }
  }
  for (i = w_count; i < w_shown; i++)
    oamSetVisible(WEA_OAM(i), OBJ_HIDE); /* intensité réduite */
  w_shown = w_count;
}
