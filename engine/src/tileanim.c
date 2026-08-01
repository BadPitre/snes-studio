/*
 * tileanim.c — tiles de décor animées (T1). Voir tileanim.h.
 *
 * Données (data_tileanim.c, générées par datagen) :
 *   ta_first[scene]  : première séquence de la scène (bornes s..s+1)
 *   ta_ffirst[seq]   : première frame de la séquence (bornes f..f+1)
 *   ta_mode[seq]     : 0 = 1-2-3 (boucle), 1 = 1-2-3-2 (aller-retour)
 *   ta_speed[seq]    : frames d'affichage par pas
 *   ta_dest[seq*4]   : les 4 chars VRAM de la tile de base
 *   ta_src[frame*4]  : les 4 chars ROM de chaque frame (charset scène)
 *
 * Un PAS = 128 octets — une seule séquence par VBlank, les autres
 * retentent la frame suivante (files courtes, jamais de pic).
 *
 * P6 — Ces 128 octets partaient en QUATRE appels DMA, et le pas coûtait
 * 18 lignes écran pour 0,75 ligne de transfert réel : tout le reste
 * était des apprêts (voir vramjob.h). Deux corrections :
 *  - le plan de transfert est monté dans tileanim_update(), hors de la
 *    fenêtre VBlank — l'indirection longue sur gfx_chars[] et les huit
 *    lectures de tableau ne s'y paient plus ;
 *  - les chars CONSÉCUTIFs des deux côtés à la fois sont fusionnés. Le
 *    cas courant est une tile 16x16 dont les quatre quarts se suivent
 *    en ROM comme en VRAM : un seul transfert de 128 octets. Quand la
 *    déduplication du datagen a cassé la suite, on retombe sur deux ou
 *    trois transferts — c'est vérifié, pas supposé.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "tileanim.h"
#include "vbudget.h"
#include "vram.h"
#include "vramjob.h"

extern const u8 ta_first[];
extern const u8 ta_ffirst[];
extern const u8 ta_mode[];
extern const u8 ta_speed[];
extern const u16 ta_dest[];
extern const u16 ta_src[];
extern const u8 *const gfx_chars[]; /* charsets ROM par gfx set (scene.c) */

#define TA_MAX 8 /* séquences simultanées par scène */

/* init explicite : tcc-816 ne remet pas le BSS à zéro */
static u8 ta_n = 0;       /* séquences actives de la scène courante */
static u8 ta_base = 0;    /* index global de la première */
static u8 ta_cnt[TA_MAX]; /* compte à rebours par séquence */
static u8 ta_pos[TA_MAX]; /* position dans le cycle */
static u8 ta_pend = 0xFF; /* séquence dont un pas attend le VBlank */
static u8 ta_pfrm = 0;    /* frame (index global) du pas en attente */
static u16 ta_njobs = 0;  /* transferts du plan en attente (1 à 4) */

void tileanim_init(u8 scene_id)
{
  u8 i;

  ta_base = ta_first[scene_id];
  ta_n = (u8)(ta_first[scene_id + 1] - ta_base);
  if (ta_n > TA_MAX)
    ta_n = TA_MAX;
  for (i = 0; i < ta_n; i++)
  {
    ta_cnt[i] = ta_speed[ta_base + i];
    ta_pos[i] = 0;
  }
  ta_pend = 0xFF; /* un pas de l'ancienne scène ne doit jamais partir */
  ta_njobs = 0;
}

/* Monte le plan de transfert du pas armé. Appelé depuis tileanim_update,
   donc HORS fenêtre VBlank : c'est là tout l'intérêt — l'indirection
   longue sur gfx_chars[] et les huit lectures de tableau se paient sur
   le temps d'affichage, où il y en a de reste.

   Deux chars qui se suivent en ROM ET en VRAM tiennent dans le même
   transfert. La condition porte sur les DEUX côtés : le datagen
   déduplique les chars identiques, et une tile dont deux quarts se
   ressemblent casse la suite côté source sans la casser côté
   destination. */
static void ta_plan(void)
{
  const u8 *chars;
  u16 s4, f4, sc, dc, psc, pdc;
  u8 k;

  chars = gfx_chars[scene_ctx.tileset_id];
  s4 = (u16)(ta_base + ta_pend) << 2;
  f4 = (u16)ta_pfrm << 2;
  ta_njobs = 0;
  psc = 0;
  pdc = 0;
  for (k = 0; k < 4; k++)
  {
    sc = ta_src[f4 + k];
    dc = ta_dest[s4 + k];
    if (ta_njobs && sc == (u16)(psc + 1) && dc == (u16)(pdc + 1))
      vj_len[VJ_TILEANIM + ta_njobs - 1] += 32; /* la suite continue */
    else
    {
      /* 32 octets par char 4bpp : ROM (charset scène) -> région tileset */
      vj_set((u16)(VJ_TILEANIM + ta_njobs), chars + ((u32)sc << 5),
             (u16)(VRAM_BG1_GFX + (dc << 4)), 32);
      ta_njobs++;
    }
    psc = sc;
    pdc = dc;
  }
}

void tileanim_update(void)
{
  u8 i, s, nf, cyc, f;

  for (i = 0; i < ta_n; i++)
  {
    if (ta_cnt[i])
    {
      ta_cnt[i]--;
      continue;
    }
    if (ta_pend != 0xFF)
      continue; /* un pas par VBlank — celui-ci retentera */
    s = (u8)(ta_base + i);
    nf = (u8)(ta_ffirst[s + 1] - ta_ffirst[s]);
    /* cycle : 1-2-3 = nf pas, 1-2-3-2 = 2*nf-2 pas (ping-pong) */
    cyc = (ta_mode[s] && nf > 2) ? (u8)((nf << 1) - 2) : nf;
    ta_pos[i]++;
    if (ta_pos[i] >= cyc)
      ta_pos[i] = 0;
    f = ta_pos[i] < nf ? ta_pos[i] : (u8)((nf << 1) - 2 - ta_pos[i]);
    ta_pend = i;
    ta_pfrm = (u8)(ta_ffirst[s] + f);
    ta_cnt[i] = ta_speed[s];
    ta_plan();
  }
}

void tileanim_vblank(void)
{
  if (ta_pend == 0xFF)
    return;
  /* Un pas de tile animee est ce qu'on sacrifie en premier : il ne se
     voit pas, et ta_pend reste arme donc le pas passera a la frame
     suivante. */
  if (!vbl_take(VBL_COST_BURST(ta_njobs, 128)))
    return;
  vj_first = VJ_TILEANIM;
  vj_n = ta_njobs;
  vj_vmain = VJ_INC1;
  vj_ctrl = VJ_CTRL_VRAM;
  vram_burst();
  ta_pend = 0xFF;
}
