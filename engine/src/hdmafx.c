/*
 * hdmafx.c — effets HDMA scriptés (S14) : ONDULATION de l'écran.
 *
 * Le HDMA réécrit les registres de scroll horizontal BG1/BG2 à chaque
 * bande de 4 scanlines depuis des tables WRAM — l'écran ondule
 * (chaleur du désert, sous l'eau, rêve). Non bloquant, persiste entre
 * les scènes jusqu'à WAVE 0 (modèle des ambiances RM2003).
 *
 * Canaux réservés : 5 (BG2HOFS $210F) et 6 (BG1HOFS $210D), mode 02
 * (un registre écrit deux fois — les scrolls sont des registres à
 * double écriture). JAMAIS le canal 7 : le NMI PVSnesLib y fait le
 * DMA général de l'OAM à chaque VBlank (vblank.asm écrit $4370-75)
 * et écrase la config HDMA — sur une frame en dépassement, le canal
 * partait avec les réglages OAM (vague plate + écritures parasites,
 * observé au combo pluie+vague). CE MODULE EST LE SEUL PROPRIÉTAIRE
 * de $420C (HDMAEN) : les futurs effets HDMA (dégradé, spotlight)
 * s'ajoutent ICI et composent le même masque. Les canaux sont
 * reprogrammés à CHAQUE VBlank (robuste face aux DMA généraux).
 *
 * Tables : 14 entrées de [count=16][lo][hi] + terminateur — un pas de
 * sinus par bande, phase qui avance chaque frame. La table intègre la
 * BASE de scroll de chaque couche (caméra + secousse pour le décor,
 * dérive du motif pour la couche d'effet) : le HDMA écrit des valeurs
 * ABSOLUES. Reconstruction par frame : 14 itérations, ni division ni
 * multiplication (leçon du panneau S6 — budget serré, voir WV_BANDS).
 *
 * La table de sinus est une CONSTANTE MATHÉMATIQUE du moteur (comme
 * les masques de registres) — pas une donnée de jeu.
 */
#include <snes.h>
#include "hdmafx.h"
#include "camera.h"
#include "screenfx.h"
#include "effectlayer.h"

/* registres des canaux 5 / 6 (le 7 appartient au DMA OAM du NMI) */
#define DMAP5 (*(vuint8 *)0x4350)
#define BBAD5 (*(vuint8 *)0x4351)
#define A1T5L (*(vuint8 *)0x4352)
#define A1T5H (*(vuint8 *)0x4353)
#define A1B5 (*(vuint8 *)0x4354)
#define DMAP6 (*(vuint8 *)0x4360)
#define BBAD6 (*(vuint8 *)0x4361)
#define A1T6L (*(vuint8 *)0x4362)
#define A1T6H (*(vuint8 *)0x4363)
#define A1B6 (*(vuint8 *)0x4364)

/* sinus 64 pas, 0..64 (32 = centre) — constante mathématique */
static const u8 wv_sin[64] = {
    32, 35, 38, 41, 44, 47, 49, 52, 54, 56, 58, 60, 61, 62, 63, 63,
    64, 63, 63, 62, 61, 60, 58, 56, 54, 52, 49, 47, 44, 41, 38, 35,
    32, 28, 25, 22, 19, 16, 14, 11, 9,  7,  5,  3,  2,  1,  0,  0,
    0,  0,  0,  1,  2,  3,  5,  7,  9,  11, 14, 16, 19, 22, 25, 28};

#define WV_BANDS 14 /* 224 lignes en bandes de 16 — mesuré au panneau
   S6 : 56 itérations = 30 FPS seul, 28 = 60 seul mais 30 cumulé à la
   pluie ; 14 redonne la marge (la houle reste douce, pas ≤ 3 px
   entre bandes voisines à amplitude max) */
#define WV_LINES 16 /* hauteur d'une bande (count HDMA) */
#define WV_STEP 6   /* pas de phase par bande (64 pas ~= 2 écrans) */

static u8 wv_pow = 0;
static u8 wv_spd = 1;
static u8 wv_phase = 0;
static u8 wv_hdr = 0; /* en-têtes de tables posés (une fois) */
static u8 wv_on = 0;  /* HDMAEN actuellement armé */
static u8 wv_t1[WV_BANDS * 3 + 1]; /* BG1 : [count][lo][hi] par bande + 0 */
static u8 wv_t2[WV_BANDS * 3 + 1]; /* BG2 */
/* offsets PRÉCALCULÉS (sin x amplitude, >>5) — bâtis à hdmafx_wave :
   la reconstruction par frame ne fait AUCUNE multiplication (56 mults
   logicielles/frame = 21 FPS mesurés au panneau S6, leçon retenue).
   256 entrées (4 copies du cycle de 64) : la phase u8 indexe SANS
   masque `& 63` — chaque cycle compte dans les boucles chargées */
static u8 wv_off[256];

void hdmafx_wave(u8 power, u8 speed)
{
  u16 i;

  wv_pow = power > 7 ? 7 : power;
  wv_spd = speed == 0 ? 1 : (speed > 8 ? 8 : speed);
  for (i = 0; i < 256; i++)
    wv_off[i] = (u8)(((u16)wv_sin[i & 63] * wv_pow) >> 5);
  if (!wv_hdr)
  {
    wv_hdr = 1;
    for (i = 0; i < WV_BANDS; i++)
    {
      wv_t1[i * 3] = WV_LINES;
      wv_t2[i * 3] = WV_LINES;
    }
    wv_t1[WV_BANDS * 3] = 0;
    wv_t2[WV_BANDS * 3] = 0;
  }
}

void hdmafx_update(void)
{
  u16 i, o, v1, v2;
  u16 b1, b2;
  u8 ph;
  u8 *q1;
  u8 *q2;

  if (!wv_pow)
    return;
  wv_phase += wv_spd;
  b2 = camera.x + screenfx_shake_x();
  b1 = effect_active() ? effect_hofs() : b2;
  b1 -= wv_pow; /* le -amplitude sort de la boucle */
  b2 -= wv_pow;
  ph = wv_phase;
  q1 = wv_t1 + 1;
  q2 = wv_t2 + 1;
  for (i = 0; i < WV_BANDS; i++)
  {
    /* offset 0..2*power autour de la base — table précalculée, phase
       u8 en index direct : ni division, ni multiplication, ni masque
       (budget frame des boucles chargées, panneau S6) */
    o = wv_off[ph];
    v1 = b1 + o;
    v2 = b2 + o;
    q1[0] = (u8)v1;
    q1[1] = (u8)(v1 >> 8);
    q2[0] = (u8)v2;
    q2[1] = (u8)(v2 >> 8);
    q1 += 3;
    q2 += 3;
    ph += WV_STEP; /* un pas de houle par bande */
  }
}

void hdmafx_vblank(void)
{
  u16 a;

  if (!wv_pow)
  {
    if (wv_on)
    {
      REG_HDMAEN = 0;
      wv_on = 0;
    }
    return;
  }
  DMAP6 = 0x02; /* un registre, écrit deux fois (scroll à double write) */
  BBAD6 = 0x0D; /* BG1HOFS */
  a = (u16)(u8 *)wv_t1;
  A1T6L = (u8)a;
  A1T6H = (u8)(a >> 8);
  A1B6 = 0x7E;
  DMAP5 = 0x02;
  BBAD5 = 0x0F; /* BG2HOFS */
  a = (u16)(u8 *)wv_t2;
  A1T5L = (u8)a;
  A1T5H = (u8)(a >> 8);
  A1B5 = 0x7E;
  REG_HDMAEN = 0x60;
  wv_on = 1;
}

void hdmafx_suspend(void)
{
  /* branche PICTURE du VBlank : l'image plein écran ne doit pas
     onduler — HDMA coupé tant qu'elle est là, réarmé au retour */
  if (wv_on)
  {
    REG_HDMAEN = 0;
    wv_on = 0;
  }
}
