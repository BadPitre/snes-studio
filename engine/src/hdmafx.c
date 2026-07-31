/*
 * hdmafx.c — effets HDMA scriptés : ONDULATION de l'écran (S14) et
 * DÉGRADÉ DE CIEL (S15).
 *
 * Ondulation : le HDMA réécrit les scrolls horizontaux BG1/BG2 par
 * bandes de scanlines depuis des tables WRAM — l'écran ondule
 * (chaleur du désert, sous l'eau, rêve). Non bloquant, persiste entre
 * les scènes jusqu'à WAVE 0 (modèle des ambiances RM2003).
 * Dégradé : le canal 4 réécrit la couleur fixe du color math ligne à
 * ligne — teinte verticale (ciel de coucher de soleil, aube).
 *
 * Canaux réservés : 4 (COLDATA $2132, mode 00), 5 (BG2HOFS $210F) et
 * 6 (BG1HOFS $210D) en mode 02 (un registre écrit deux fois — les
 * scrolls sont des registres à double écriture). JAMAIS le canal 7 :
 * le NMI PVSnesLib y fait le DMA général de l'OAM à chaque VBlank
 * (vblank.asm écrit $4370-75) et écrase la config HDMA — sur une
 * frame en dépassement, le canal partait avec les réglages OAM
 * (vague plate + écritures parasites, observé au combo pluie+vague).
 * CE MODULE EST LE SEUL PROPRIÉTAIRE de $420C (HDMAEN) : les effets
 * HDMA composent un masque unique (le spotlight s'ajoutera ICI). Les
 * canaux sont reprogrammés à CHAQUE VBlank (robuste face aux DMA
 * généraux).
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
#include "player.h" /* le spotlight (S16) suit le héros */

/* registres des canaux 3 / 4 / 5 / 6 (le 7 appartient au DMA OAM du
   NMI) */
#define DMAP3 (*(vuint8 *)0x4330)
#define BBAD3 (*(vuint8 *)0x4331)
#define A1T3L (*(vuint8 *)0x4332)
#define A1T3H (*(vuint8 *)0x4333)
#define A1B3 (*(vuint8 *)0x4334)
#define DMAP4 (*(vuint8 *)0x4340)
#define BBAD4 (*(vuint8 *)0x4341)
#define A1T4L (*(vuint8 *)0x4342)
#define A1T4H (*(vuint8 *)0x4343)
#define A1B4 (*(vuint8 *)0x4344)
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
static u8 hx_on = 0;  /* masque HDMAEN actuellement armé */
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

/* spotlight (S16) — définis plus bas, utilisés par hdmafx_update */
static u8 sp_rad;
static u8 sp_phase = 0; /* 0 = repos, 1 = moitié basse à finir */
static void sp_build_high(void);
static void sp_build_low(void);

void hdmafx_update(void)
{
  u16 i, o, v1, v2;
  u16 b1, b2;
  u8 ph;
  u8 *q1;
  u8 *q2;

  if (wv_pow)
  {
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
  if (sp_rad && screenfx_spot_active())
  {
    /* spotlight : reconstruction étalée sur DEUX frames (moitié haute
       puis moitié basse, centre gelé — le cercle a au plus 2-3 px de
       retard sur le héros, invisible) et seulement si le héros ou la
       caméra a bougé. Immobile : coût nul. La reconstruction en une
       passe faisait retomber la marche de 60 à 30 FPS (panneau S6). */
    if (sp_phase)
      sp_build_low();
    else
      sp_build_high();
  }
}

/*
 * Dégradé de ciel (S15) : TEINTE VERTICALE — le canal 4 réécrit la
 * couleur fixe ($2132) ligne à ligne (mode 0, un octet par entrée)
 * depuis une table run-length STATIQUE bâtie ICI à la commande :
 * zéro coût CPU par frame. Une entrée par CHANGEMENT de canal R/G/B
 * (≤ 31 pas par canal), les plages stables sont sautées par le champ
 * count. CGWSEL/CGADSUB restent la propriété de screenfx (le mode du
 * dégradé y vit — même circuit que la teinte, qui l'annule).
 */
static u8 gr_tr = 0, gr_tg = 0, gr_tb = 0; /* couleur du HAUT */
static u8 gr_br = 0, gr_bg = 0, gr_bb = 0; /* couleur du BAS */
static u8 gr_tab[256]; /* ≤ ~100 entrées de [count][sel|val] + 0 */
static u8 *gr_q;       /* curseur d'écriture (construction) */
static u8 *gr_cnt;     /* octet count de l'entrée ouverte */
static u8 gr_run;      /* lignes couvertes par l'entrée ouverte */

/* ferme l'entrée ouverte — coupe les plages > 127 lignes (limite du
   champ count HDMA hors mode repeat) en entrées de bourrage */
static void gr_close(void)
{
  u8 v;

  while (gr_run > 127)
  {
    v = gr_cnt[1];
    *gr_cnt = 127;
    gr_run -= 127;
    gr_cnt = gr_q;
    gr_q[1] = v;
    gr_q += 2;
  }
  *gr_cnt = gr_run;
  gr_run = 0;
}

static void gr_emit(u8 byte)
{
  if (gr_cnt)
    gr_close();
  gr_cnt = gr_q;
  gr_q[1] = byte;
  gr_q += 2;
}

/* pas 8.8 d'un canal du haut vers le bas — même parade que tg_step
   (pas de signés) : magnitude + sens. Divisions à la COMMANDE. */
static u16 gr_step(u8 top, u8 bot, u8 *neg)
{
  if (bot >= top)
  {
    *neg = 0;
    return ((u16)(bot - top) << 8) / 224;
  }
  *neg = 1;
  return ((u16)(top - bot) << 8) / 224;
}

void hdmafx_grad_top(u8 r, u8 g, u8 b)
{
  gr_tr = r & 31;
  gr_tg = g & 31;
  gr_tb = b & 31;
}

void hdmafx_grad_bottom(u8 r, u8 g, u8 b)
{
  gr_br = r & 31;
  gr_bg = g & 31;
  gr_bb = b & 31;
}

void hdmafx_grad(u8 mode)
{
  u16 ar, ag, ab, sr, sg, sb;
  u8 nr, ng, nb; /* sens du pas (1 = décroît) */
  u8 lr, lg, lb; /* dernière valeur émise par canal */
  u8 v;
  u16 line;

  if (mode == 0 || mode > 2)
  {
    screenfx_skygrad(0); /* canal 4 coupé au prochain VBlank */
    return;
  }
  ar = (u16)gr_tr << 8;
  ag = (u16)gr_tg << 8;
  ab = (u16)gr_tb << 8;
  sr = gr_step(gr_tr, gr_br, &nr);
  sg = gr_step(gr_tg, gr_bg, &ng);
  sb = gr_step(gr_tb, gr_bb, &nb);
  gr_q = gr_tab;
  gr_cnt = 0;
  gr_run = 0;
  lr = 255; /* invalide : force l'émission des 3 canaux en haut d'écran */
  lg = 255;
  lb = 255;
  for (line = 0; line < 224; line++)
  {
    /* UNE écriture COLDATA par ligne (mode 0) : un canal qui change en
       même temps qu'un autre est décalé d'une ligne — invisible */
    v = (u8)(ar >> 8);
    if (v != lr)
    {
      gr_emit(0x20 | v);
      lr = v;
    }
    else
    {
      v = (u8)(ag >> 8);
      if (v != lg)
      {
        gr_emit(0x40 | v);
        lg = v;
      }
      else
      {
        v = (u8)(ab >> 8);
        if (v != lb)
        {
          gr_emit(0x80 | v);
          lb = v;
        }
      }
    }
    gr_run++;
    ar = nr ? ar - sr : ar + sr;
    ag = ng ? ag - sg : ag + sg;
    ab = nb ? ab - sb : ab + sb;
  }
  gr_close();
  *gr_q = 0; /* terminateur */
  screenfx_skygrad(mode); /* arme le circuit (et remplace la teinte) */
}

/*
 * Spotlight (S16) : cercle de lumière autour du héros — le canal 3
 * réécrit WH0/WH1 ($2126-27, mode 1 : deux registres adjacents) ligne
 * à ligne pour tracer le cercle de la fenêtre couleur W1 ; screenfx
 * assombrit le décor HORS fenêtre (même circuit que la teinte). Les
 * demi-largeurs du cercle sont précalculées À LA COMMANDE (méthode
 * incrémentale, ni multiplication ni racine) ; la table n'est
 * reconstruite QUE quand le héros ou la caméra bouge — immobile,
 * le spotlight ne coûte RIEN par frame.
 */
#define SP_RMAX 96 /* rayon max : le cercle tient dans les 224 lignes */

/* sp_rad (rayon, 0 = jamais commandé) est déclaré plus haut, au-dessus
   de hdmafx_update qui l'utilise */
static u8 sp_hw[SP_RMAX + 1]; /* demi-largeur du cercle par |dy| */
static u16 sp_cx = 0xFFFF;    /* centre de la dernière table bâtie */
static u16 sp_cy = 0xFFFF;
static u8 sp_tab[SP_RMAX * 6 + 24]; /* [1][WH0][WH1] par ligne du
   cercle (2r+1 max) + bandes vides [count][255][0] + terminateur */

void hdmafx_spot(u8 radius, u8 dark)
{
  u16 t, w2;
  u8 dy, w;

  sp_phase = 0; /* une commande en pleine construction repart de zéro */
  if (radius == 0)
  {
    screenfx_spot(0); /* canal 3 coupé au prochain VBlank */
    return;
  }
  if (radius < 16)
    radius = 16;
  if (radius > SP_RMAX)
    radius = SP_RMAX;
  sp_rad = radius;
  /* demi-largeurs : w = plancher de racine(r^2 - dy^2), maintenu par
     DIFFÉRENCES (t perd 2dy+1 par ligne, w^2 perd 2w-1 par pas) —
     aucune multiplication, aucune racine ; r^2 par additions (une
     fois à la commande) */
  t = 0;
  for (dy = 0; dy < radius; dy++)
    t += radius;
  w2 = t;
  w = radius;
  for (dy = 0; dy <= radius; dy++)
  {
    while (w2 > t && w)
    {
      w2 -= (u16)(w << 1) - 1;
      w--;
    }
    sp_hw[dy] = w;
    t -= ((u16)dy << 1) + 1;
  }
  sp_cx = 0xFFFF; /* force la reconstruction à la prochaine frame */
  sp_cy = 0xFFFF;
  screenfx_spot(dark ? dark : 31);
}

/* Reconstruction de la table WH0/WH1 étalée sur DEUX frames :
   sp_build_high (bande sombre du haut + moitié haute du cercle) puis
   sp_build_low (moitié basse + bande du bas + terminateur), centre
   GELÉ entre les deux (sp_cx/sp_cy) pour une table cohérente. La
   caméra centre le héros : dans le cas courant le cercle ne touche
   pas les bords -> CHEMIN RAPIDE en arithmétique u8 pure, sans
   clamp, demi-largeurs par POINTEUR. Une reconstruction en une seule
   passe (97 lignes + clamps indexés) faisait retomber la marche de
   60 à 30 FPS — leçon panneau S6. */
static u8 *sp_q;    /* curseur d'écriture entre les deux phases */
static u16 sp_line; /* ligne écran atteinte par la phase haute */

static void sp_build_high(void)
{
  u16 cx, cy, top, l, r;
  u16 line;
  u8 n, w, c8;
  u8 *q;
  u8 *hw;

  cx = player.x - camera.x + 8; /* centre du metasprite 16x24 */
  cy = player.y - camera.y + 12;
  if (cx == sp_cx && cy == sp_cy)
    return;
  sp_cx = cx;
  sp_cy = cy;
  q = sp_tab;
  top = cy - sp_rad; /* wrap u16 si le cercle dépasse en haut */
  line = 0;
  if (top < 224) /* pas de wrap : bande sombre au-dessus du cercle */
    while (line < top)
    {
      n = (u8)(top - line) > 127 ? 127 : (u8)(top - line);
      q[0] = n;
      q[1] = 255; /* fenêtre vide : tout est « dehors » -> sombre */
      q[2] = 0;
      q += 3;
      line += n;
    }
  /* cercle en BANDES DE 2 LIGNES ([count=2][WH0][WH1]) : moitié
     d'entrées — la marche de 2 px sur le bord du masque est
     invisible, et le budget frame est tenu (panneau S6) */
  if (cx >= sp_rad && cx + sp_rad <= 255)
  {
    /* chemin rapide : cx ± hw reste dans 0-255 — tout en u8 */
    c8 = (u8)cx;
    hw = sp_hw + (u8)(cy - line); /* dy de la première rangée */
    while (line < cy)
    {
      w = *hw;
      n = (u8)(cy - line) >= 2 ? 2 : 1;
      hw -= n;
      q[0] = n;
      q[1] = c8 - w;
      q[2] = c8 + w;
      q += 3;
      line += n;
    }
  }
  else
  {
    /* près d'un bord de map : clamps (rare — caméra en butée) */
    while (line < cy)
    {
      w = sp_hw[cy - line];
      l = cx - w;
      if (l > 255) /* wrap u16 : bord gauche hors écran */
        l = 0;
      r = cx + w;
      if (r > 255)
        r = 255;
      n = (u8)(cy - line) >= 2 ? 2 : 1;
      q[0] = n;
      q[1] = (u8)l;
      q[2] = (u8)r;
      q += 3;
      line += n;
    }
  }
  sp_q = q;
  sp_line = line;
  sp_phase = 1; /* la moitié basse suit à la prochaine frame */
}

static void sp_build_low(void)
{
  u16 cx, cy, bot, l, r;
  u16 line;
  u8 n, w, c8;
  u8 *q;
  u8 *hw;

  cx = sp_cx; /* centre GELÉ par la phase haute */
  cy = sp_cy;
  q = sp_q;
  line = sp_line;
  bot = cy + sp_rad;
  if (bot > 223)
    bot = 223;
  if (cx >= sp_rad && cx + sp_rad <= 255)
  {
    c8 = (u8)cx;
    hw = sp_hw; /* dy = 0 à la ligne du centre */
    while (line <= bot)
    {
      w = *hw;
      n = (u16)(bot - line) >= 1 ? 2 : 1; /* bandes de 2 lignes */
      hw += n;
      q[0] = n;
      q[1] = c8 - w;
      q[2] = c8 + w;
      q += 3;
      line += n;
    }
  }
  else
  {
    while (line <= bot)
    {
      w = sp_hw[line - cy];
      l = cx - w;
      if (l > 255)
        l = 0;
      r = cx + w;
      if (r > 255)
        r = 255;
      n = (u16)(bot - line) >= 1 ? 2 : 1;
      q[0] = n;
      q[1] = (u8)l;
      q[2] = (u8)r;
      q += 3;
      line += n;
    }
  }
  while (line < 224) /* bande sombre sous le cercle */
  {
    n = (u8)(224 - line) > 127 ? 127 : (u8)(224 - line);
    q[0] = n;
    q[1] = 255;
    q[2] = 0;
    q += 3;
    line += n;
  }
  *q = 0; /* terminateur */
  sp_phase = 0;
}

void hdmafx_vblank(void)
{
  u16 a;
  u8 m = 0;

  if (wv_pow)
  {
    DMAP6 = 0x02; /* un registre, écrit deux fois (scroll double write) */
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
    m = 0x60;
  }
  if (screenfx_skygrad_mode() && !screenfx_cm_held() &&
      !screenfx_flash_active())
  {
    /* dégradé de ciel : coupé quand un mélange tient le circuit ou
       qu'un flash l'emprunte (screenfx écrit COLDATA ces frames-là) */
    DMAP4 = 0x00; /* un registre, un octet par entrée */
    BBAD4 = 0x32; /* COLDATA */
    a = (u16)(u8 *)gr_tab;
    A1T4L = (u8)a;
    A1T4H = (u8)(a >> 8);
    A1B4 = 0x7E;
    m |= 0x10;
  }
  if (sp_rad && screenfx_spot_active() && !screenfx_cm_held())
  {
    /* spotlight : cercle WH0/WH1 — inerte pendant un flash (CGWSEL
       passe la fenêtre en « jamais » : tout l'écran flashe), coupé
       sous mélange comme la teinte */
    DMAP3 = 0x01; /* deux registres adjacents ($2126 puis $2127) */
    BBAD3 = 0x26; /* WH0 */
    a = (u16)(u8 *)sp_tab;
    A1T3L = (u8)a;
    A1T3H = (u8)(a >> 8);
    A1B3 = 0x7E;
    m |= 0x08;
  }
  /* balayage scripté (S18c, scr_hide/scr_show) : canal 2 de screenfx —
     ses registres sont posés par screenfx_wipe_step, seul le masque est
     composé ICI (ce module reste le propriétaire de $420C) */
  if (screenfx_wipe_active())
    m |= 0x04;
  if (m || hx_on)
    REG_HDMAEN = m;
  hx_on = m;
}

void hdmafx_suspend(void)
{
  /* branche PICTURE/STAGE du VBlank : l'image plein écran ne doit ni
     onduler ni recevoir le dégradé — HDMA coupé tant qu'elle est là.
     Le balayage scripté (S18c), lui, reste actif : un scr_hide/scr_show
     peut rideauter une picture ou un écran composé. */
  if (screenfx_wipe_active())
  {
    REG_HDMAEN = 0x04;
    hx_on = 0x04;
    return;
  }
  if (hx_on)
  {
    REG_HDMAEN = 0;
    hx_on = 0;
  }
}
