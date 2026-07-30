/*
 * stage.c — écran composé (B3) : fond + images posées multi-slots.
 *
 * Plan VRAM pendant l'écran (les régions de la SCÈNE sont réutilisées,
 * la fermeture repasse par scene_load — warp interne) :
 *  - BG2 = FOND : chars dans la région OBJ ($4000, ≤ 512 — les sprites
 *    sont cachés, comme pour les pictures), carte 32x32 en $7000 ;
 *  - BG1 = IMAGES POSÉES : chars dans la région tileset ($2000, ≤ 512,
 *    char 0 réservé transparent), carte 32x32 dans le creux $7800 ;
 *  - BG3 (dialogues/HUD) : intact. Palettes : fond -> palette BG 0,
 *    slot i -> palette BG 2+i (la fonte en CGRAM 16-19 est préservée,
 *    la palette 7 reste celle des pictures).
 *
 * OUVERTURE/FERMETURE : écran éteint sous fondu (recette do_warp),
 * depuis la boucle principale. POSES écran allumé : transferts étalés
 * (≤ 1 Ko de chars par VBlank, puis palette, puis la carte 2 rangées
 * par frame — construites hors VBlank) ; la VM attend la fin
 * (VM_WAIT_STAGE) : les monstres « apparaissent » l'un après l'autre.
 *
 * Allocateur de chars APPEND : re-poser un slot avec la MÊME image ne
 * recharge rien (déplacement = carte seule) ; une autre image alloue à
 * la suite. La place n'est rendue qu'à la fermeture de l'écran —
 * budget 511 chars au total, pose ignorée au-delà (le panneau S6 et
 * les docs donnent la règle).
 *
 * Les images sont les PICTURES du projet (mêmes données, datagen ne
 * change pas) : entrées de carte réécrites à la volée
 * (char + base du slot, palette du slot).
 */
#include <snes.h>
#include "stage.h"
#include "scene.h"
#include "screenfx.h"
#include "picture.h"
#include "vignette.h"
#include "player.h"
#include "vram.h"

/* registre pictures (data_pictures.c — toujours émis) */
extern const u8 pic_count;
extern const u8 *const pic_chars[];
extern const u16 *const pic_chars_sizes[];
extern const u16 *const pic_maps[];
extern const u16 *const pic_pals[];
extern const u8 pic_wt[];
extern const u8 pic_ht[];

extern u8 videoMode; /* miroir PVSnesLib de REG_TM */

#define SG_MAP_BG1 0x7800 /* carte 32x32 des images posées (creux libre) */
#define SG_MAP_BG2 VRAM_PIC_MAP /* carte du fond ($7000 — la picture ne
                                   peut pas être affichée en même temps) */
#define SG_TM 0x17        /* BG1 + BG2 + BG3 + OBJ (vignettes B5 — les
   sprites de la scène sont cachés à l'ouverture, l'OAM est propre) */
#define SG_TM_GAME 0x17
#define SG_CHUNK 1024     /* octets de chars par VBlank (budget S6) */

static u8 sg_on = 0;
static u8 sg_req = 0; /* 0 rien, 1 ouvrir, 2 fermer */
static u8 sg_req_pic = 0;
static u8 sg_req_dur = 0;
static u8 sg_req_trans = 0; /* transition (S18) : 0 fondu, 1 instantané,
                               2 mosaïque */
static u8 sg_close = 0;     /* la boucle doit exécuter le warp interne */
static u8 sg_close_tr = 0;  /* transition de la fermeture en cours (S18) */
static u16 sg_next_char = 1; /* allocateur (char 0 = transparent) */

static u8 sl_pic[STAGE_SLOTS];  /* 0xFF = slot vide */
static u16 sl_base[STAGE_SLOTS];
static u8 sl_x[STAGE_SLOTS]; /* région posée (tiles) — pour l'effacement */
static u8 sl_y[STAGE_SLOTS];

/* transfert étalé d'une pose : phases chars -> palette -> effacement de
   l'ancienne région -> carte (2 rangées par frame, bâties hors VBlank) */
static u8 up_act = 0; /* 0 repos, 1 chars, 2 pal, 3 clear, 4 carte */
static u8 up_slot = 0;
static u8 up_pic = 0;
static u8 up_tx = 0, up_ty = 0;
static u16 up_sent = 0; /* octets de chars déjà envoyés */
static u8 up_row = 0;   /* rangée courante (clear/carte) */
static u8 up_rows = 0;  /* rangées bâties dans le tampon (0-2) */
static u16 up_buf[64];  /* 2 rangées de carte max */
static u8 up_cx = 0, up_cy = 0, up_cw = 0, up_ch = 0; /* région à effacer */
static u16 sg_zero = 0; /* motif du dmaFillVram16 (entrée transparente) */

/* Effets par slot (B4) : manipulation de la PALETTE de l'image posée
   — flash blanc, fondu vers noir (mort), assombrir, restaurer. Une
   OMBRE WRAM par slot (les 15 couleurs utiles) : le fondu la divise
   par demi-teintes BGR555 ((v >> 1) & 0x3DEF — un shift + un masque
   par couleur, JAMAIS de multiplication, leçon panneau S6), le
   VBlank pousse 30 octets de CGRAM par slot marqué sale. */
static u16 sl_sh[STAGE_SLOTS][15]; /* ombre de la palette du slot */
static u8 fx_mode[STAGE_SLOTS];    /* 0 rien, 1 flash, 2 fondu-noir */
static u8 fx_t[STAGE_SLOTS];       /* frames restantes de l'effet */
static u8 fx_per[STAGE_SLOTS];     /* fondu : période entre demi-teintes */
static u8 fx_cnt[STAGE_SLOTS];     /* compteur de période (pas de modulo) */
static u8 fx_dirty = 0; /* bitmask : palettes à pousser au VBlank (le
   flash pousse le BLANC tant que mode == 1, l'ombre sinon) */
static const u16 sg_white[15] = {
    0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF,
    0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF, 0x7FFF};

u8 stage_active(void)
{
  return sg_on;
}

u8 stage_busy(void)
{
  return up_act != 0;
}

void stage_request_open(u8 backdrop_pic, u8 fade_dur, u8 trans)
{
  sg_req = 1;
  sg_req_pic = backdrop_pic;
  sg_req_dur = fade_dur;
  sg_req_trans = trans;
}

void stage_request_close(u8 fade_dur, u8 trans)
{
  if (!sg_on)
    return;
  sg_req = 2;
  sg_req_dur = fade_dur;
  sg_req_trans = trans;
}

/* Transition de la DERNIÈRE fermeture (S18) — do_warp (warp interne de
   fermeture) l'applique à la réapparition de la map. */
u8 stage_close_trans(void)
{
  return sg_close_tr;
}

u8 stage_take_close(void)
{
  u8 c = sg_close;

  sg_close = 0;
  return c;
}

void stage_reset(void)
{
  if (!sg_on)
    return;
  videoMode = SG_TM_GAME;
  REG_TM = SG_TM_GAME;
  sg_on = 0; /* scene_load (warp) recharge décor, sprites et scrolls */
  up_act = 0;
  sg_req = 0;
  /* les vignettes affichées pendant l'écran font partie de sa mise en
     scène : la fermeture les masque (sinon elles flottent sur la map) */
  vig_hide(0);
  vig_hide(1);
}

/* fondus maison sur $2100 — recette picture (S7), durée en frames.
   trans (S18) : 2 = mosaïque ($2106 BG1-3) couplée à la luminosité —
   l'écran pixelise en s'assombrissant ; 1 = instantané (pas de rampe). */
static void sg_trans_regs(u8 trans, u8 b)
{
  if (trans == 2)
    REG_MOSAIC = (u8)(((15 - b) << 4) | 0x07);
  REG_INIDISP = b;
}

static void sg_fade_out(u8 dur, u8 trans)
{
  u16 step, lvl;
  u8 f;

  if (!dur || trans == 1)
    return;
  step = 0x0F00 / dur;
  lvl = 0x0F00;
  for (f = 0; f < dur; f++)
  {
    lvl = lvl > step ? lvl - step : 0;
    WaitForVBlank();
    sg_trans_regs(trans, (u8)(lvl >> 8));
  }
}

static void sg_fade_in(u8 dur, u8 trans)
{
  u16 step, lvl;
  u8 f;

  if (!dur || trans == 1)
  {
    if (trans == 2)
      REG_MOSAIC = 0; /* rampe sautée : ne pas rester pixelisé */
    return;
  }
  step = 0x0F00 / dur;
  lvl = 0;
  REG_INIDISP = 0;
  for (f = 0; f < dur; f++)
  {
    lvl += step;
    if (lvl > 0x0F00)
      lvl = 0x0F00;
    WaitForVBlank();
    sg_trans_regs(trans, (u8)(lvl >> 8));
  }
  REG_INIDISP = 0x0F;
  if (trans == 2)
  {
    WaitForVBlank();
    REG_MOSAIC = 0; /* effet rendu (taille 1, aucun BG) */
  }
}

static void sg_open(void)
{
  u16 i;
  u8 id = sg_req_pic;

  sg_fade_out(sg_req_dur, sg_req_trans);
  setScreenOff();
  if (sg_req_trans == 2)
    REG_MOSAIC = 0; /* la mosaïque de fermeture ne colle pas à l'écran */
  picture_reset(); /* une image affichée : l'écran composé prend tout */
  sg_on = 1;
  up_act = 0;
  sg_next_char = 1;
  for (i = 0; i < STAGE_SLOTS; i++)
  {
    sl_pic[i] = 0xFF;
    fx_mode[i] = 0; /* effets de palette (B4) remis à zéro */
  }
  fx_dirty = 0;
  /* sprites de la scène cachés (héros, PNJ, météo) — les *_draw de la
     boucle sont gelés tant que l'écran est là */
  for (i = 0; i < 128; i++)
    oamSetVisible((u16)(i << 2), OBJ_HIDE);
  videoMode = SG_TM;
  REG_TM = SG_TM;
  /* BG1 = couche des images posées : chars région tileset (char 0
     rendu transparent), carte 32x32 vide en $7800 */
  bgSetGfxPtr(0, VRAM_BG1_GFX);
  bgSetMapPtr(0, SG_MAP_BG1, SC_32x32);
  sg_zero = 0;
  dmaFillVram16(&sg_zero, VRAM_BG1_GFX, 16); /* char 0 : 16 words à 0 */
  dmaFillVram16(&sg_zero, SG_MAP_BG1, 32 * 32);
  /* BG2 = fond : chars région OBJ, carte en $7000 */
  bgSetGfxPtr(1, VRAM_OBJ_GFX);
  bgSetMapPtr(1, SG_MAP_BG2, SC_32x32);
  if (id < pic_count)
  {
    dmaCopyVram((u8 *)pic_chars[id], VRAM_OBJ_GFX, *pic_chars_sizes[id]);
    dmaCopyVram((u8 *)pic_maps[id], SG_MAP_BG2, 32 * 32 * 2);
    dmaCopyCGram((u8 *)pic_pals[id], 0, 32); /* palette BG 0 */
    /* un fond À TRANSPARENCE a ses entrées marquées palette 7 (S4) —
       la même palette y est posée pour qu'il s'affiche quand même
       (fond opaque recommandé, mais jamais de couleurs folles) */
    dmaCopyCGram((u8 *)pic_pals[id] + 2, 113, 30);
  }
  else
  {
    /* pas de fond : noir (char 0 transparent + carte vide + CGRAM 0) */
    dmaFillVram16(&sg_zero, VRAM_OBJ_GFX, 16);
    dmaFillVram16(&sg_zero, SG_MAP_BG2, 32 * 32);
    dmaCopyCGram((u8 *)&sg_zero, 0, 2);
  }
  bgSetScroll(0, 0, 0);
  bgSetScroll(1, 0, 0);
  REG_TS = 0; /* pas de mélange sur l'écran composé — teinte/flash actifs */
  screenfx_cm_hold(0);
  screenfx_warp_reset();
  vig_reload(); /* le fond a pu écraser les chars 384+ des vignettes */
  setScreenOn();
  sg_fade_in(sg_req_dur, sg_req_trans);
}

void stage_apply(void)
{
  u8 r = sg_req;

  sg_req = 0;
  if (r == 1)
    sg_open();
  else if (r == 2 && sg_on)
  {
    sg_fade_out(sg_req_dur, sg_req_trans);
    setScreenOff();
    if (sg_req_trans == 2)
      REG_MOSAIC = 0; /* la réapparition (do_warp) repart d'un état sain */
    sg_close = 1; /* la boucle enchaîne sur le warp interne (do_warp) */
    sg_close_tr = sg_req_trans;
  }
}

void stage_pose(u8 slot, u8 pic, u8 tx, u8 ty)
{
  u16 need;
  u8 w, h;

  if (!sg_on || up_act || slot >= STAGE_SLOTS || pic >= pic_count)
    return;
  w = pic_wt[pic];
  h = pic_ht[pic];
  if (w == 0 || h == 0)
    return;
  if (tx > 32 - w) /* clamp à l'écran (carte 32x32, 28 rangées vues) */
    tx = 32 - w;
  if (ty > 28 - h)
    ty = 28 - h;
  if (sl_pic[slot] != pic)
  {
    /* nouvelle image dans ce slot : allocation À LA SUITE — la place
       n'est rendue qu'à la fermeture (budget 511 chars, pose ignorée
       au-delà : simplifier les images ou fermer/rouvrir l'écran) */
    need = *pic_chars_sizes[pic] >> 5; /* 32 octets par char */
    if (sg_next_char + need > 512)
      return;
    up_sent = 0;
    up_act = 1; /* phase chars */
    sl_base[slot] = sg_next_char;
    sg_next_char += need;
  }
  else
    up_act = 3; /* même image : effacement + carte seulement */
  /* l'ancienne région du slot sera effacée avant d'écrire la nouvelle */
  up_cx = sl_x[slot];
  up_cy = sl_y[slot];
  if (sl_pic[slot] != 0xFF)
  {
    up_cw = pic_wt[sl_pic[slot]];
    up_ch = pic_ht[sl_pic[slot]];
  }
  else
    up_ch = 0; /* rien à effacer */
  up_slot = slot;
  up_pic = pic;
  up_tx = tx;
  up_ty = ty;
  up_row = 0;
  up_rows = 0;
  sl_pic[slot] = pic;
  sl_x[slot] = tx;
  sl_y[slot] = ty;
  /* ombre de la palette (B4) : copie des 15 couleurs utiles depuis la
     ROM — les effets partent toujours d'une palette propre */
  {
    const u16 *pp = pic_pals[pic] + 1;
    u8 i;

    for (i = 0; i < 15; i++)
      sl_sh[slot][i] = pp[i];
  }
  fx_mode[slot] = 0;
}

void stage_slotfx(u8 slot, u8 fx, u8 dur)
{
  const u16 *pp;
  u8 i;

  if (!sg_on || slot >= STAGE_SLOTS || sl_pic[slot] == 0xFF)
    return;
  switch (fx)
  {
  case 1: /* FLASH blanc : dur frames, puis la palette courante revient */
    fx_mode[slot] = 1;
    fx_t[slot] = dur ? dur : 6;
    fx_dirty |= (u8)(1 << slot);
    break;
  case 2: /* FONDU vers noir (mort) : 5 paliers de demi-teintes sur dur */
    fx_mode[slot] = 2;
    fx_t[slot] = dur ? dur : 30;
    if (dur >= 5)
      fx_per[slot] = dur / 5; /* UNE division, à la commande */
    else
      fx_per[slot] = 1;
    fx_cnt[slot] = fx_per[slot];
    break;
  case 3: /* ASSOMBRIR d'un cran (persistant — poison, pétrification) */
    for (i = 0; i < 15; i++)
      sl_sh[slot][i] = (sl_sh[slot][i] >> 1) & 0x3DEF;
    fx_dirty |= (u8)(1 << slot);
    break;
  default: /* 0 : RESTAURER la palette d'origine (fin d'état) */
    pp = pic_pals[sl_pic[slot]] + 1;
    for (i = 0; i < 15; i++)
      sl_sh[slot][i] = pp[i];
    fx_mode[slot] = 0;
    fx_dirty |= (u8)(1 << slot);
    break;
  }
}

/* un pas des effets de palette par frame (appelé par stage_update) */
static void sg_fx_step(void)
{
  u8 s, i;

  for (s = 0; s < STAGE_SLOTS; s++)
  {
    if (!fx_mode[s])
      continue;
    fx_t[s]--;
    if (fx_mode[s] == 1)
    {
      if (!fx_t[s])
      {
        fx_mode[s] = 0; /* fin du flash : l'ombre courante revient */
        fx_dirty |= (u8)(1 << s);
      }
    }
    else /* fondu vers noir */
    {
      if (!fx_t[s])
      {
        for (i = 0; i < 15; i++)
          sl_sh[s][i] = 0;
        fx_mode[s] = 0;
        fx_dirty |= (u8)(1 << s);
      }
      else if (--fx_cnt[s] == 0) /* palier : demi-teinte (pas de modulo) */
      {
        fx_cnt[s] = fx_per[s];
        for (i = 0; i < 15; i++)
          sl_sh[s][i] = (sl_sh[s][i] >> 1) & 0x3DEF;
        fx_dirty |= (u8)(1 << s);
      }
    }
  }
}

void stage_clear(u8 slot)
{
  if (!sg_on || up_act || slot >= STAGE_SLOTS || sl_pic[slot] == 0xFF)
    return;
  up_cx = sl_x[slot];
  up_cy = sl_y[slot];
  up_cw = pic_wt[sl_pic[slot]];
  up_ch = pic_ht[sl_pic[slot]];
  up_slot = slot;
  up_row = 0;
  up_act = 5; /* effacement seul */
  /* le slot garde sa base de chars : re-poser la même image plus tard
     ne recoûtera que la carte */
}

/* bâtit jusqu'à 2 rangées de carte dans up_buf (boucle principale —
   jamais au VBlank : réécriture char+palette de w entrées par rangée) */
void stage_update(void)
{
  const u16 *src;
  u16 *q;
  u16 base;
  u8 w, r, i, pal;

  if (sg_on)
    sg_fx_step(); /* effets de palette par slot (B4) */
  if (up_act != 4 || up_rows)
    return;
  w = pic_wt[up_pic];
  base = sl_base[up_slot];
  pal = (u8)(2 + up_slot); /* palette BG du slot */
  for (r = 0; r < 2 && (u8)(up_row + r) < pic_ht[up_pic]; r++)
  {
    src = pic_maps[up_pic] + ((u16)(up_row + r) << 5);
    q = up_buf + ((u16)r << 5); /* rangée 1 à +32 (stride du VBlank) */
    for (i = 0; i < w; i++)
      *q++ = ((*src++ & 0x03FF) + base) | ((u16)pal << 10);
    up_rows++;
  }
}

void stage_vblank(void)
{
  u16 n, addr;
  u8 r;

  if (sg_on)
  {
    /* scrolls de l'écran composé : fixes (+ secousse scriptée) */
    bgSetScroll(0, screenfx_shake_x(), 0);
    bgSetScroll(1, screenfx_shake_x(), 0);
    /* effets de palette (B4) : UNE palette de slot poussée par VBlank
       (30 octets — flash = blanc tant que l'effet court, ombre sinon) */
    if (fx_dirty)
    {
      for (n = 0; n < STAGE_SLOTS; n++)
        if (fx_dirty & (1 << n))
        {
          dmaCopyCGram(fx_mode[(u8)n] == 1 ? (u8 *)sg_white
                                           : (u8 *)sl_sh[(u8)n],
                       (u16)(((2 + n) << 4) + 1), 30);
          fx_dirty &= (u8)~(1 << n);
          break;
        }
    }
  }
  switch (up_act)
  {
  case 1: /* chars de l'image, par morceaux de 1 Ko */
    n = *pic_chars_sizes[up_pic] - up_sent;
    if (n > SG_CHUNK)
      n = SG_CHUNK;
    dmaCopyVram((u8 *)pic_chars[up_pic] + up_sent,
                VRAM_BG1_GFX + (sl_base[up_slot] << 4) + (up_sent >> 1), n);
    up_sent += n;
    if (up_sent >= *pic_chars_sizes[up_pic])
      up_act = 2;
    break;
  case 2: /* palette du slot (couleurs 1-15 de la palette BG 2+slot) */
    dmaCopyCGram((u8 *)pic_pals[up_pic] + 2,
                 (u8)(((2 + up_slot) << 4) + 1), 30);
    up_act = 3;
    break;
  case 3: /* effacement de l'ancienne région (2 rangées par VBlank) */
  case 5:
    for (r = 0; r < 2 && up_row < up_ch; r++, up_row++)
    {
      addr = SG_MAP_BG1 + ((u16)(up_cy + up_row) << 5) + up_cx;
      dmaFillVram16(&sg_zero, addr, up_cw);
    }
    if (up_row >= up_ch)
    {
      if (up_act == 5)
        up_act = 0; /* effacement seul : terminé */
      else
      {
        up_act = 4; /* place à la carte */
        up_row = 0;
        up_rows = 0;
      }
    }
    break;
  case 4: /* carte : les rangées bâties par stage_update */
    if (!up_rows)
      break;
    addr = SG_MAP_BG1 + ((u16)up_ty << 5) + up_tx + ((u16)up_row << 5);
    dmaCopyVram((u8 *)up_buf, addr, (u16)pic_wt[up_pic] << 1);
    if (up_rows > 1)
      dmaCopyVram((u8 *)(up_buf + 32), addr + 32,
                  (u16)pic_wt[up_pic] << 1);
    up_row += up_rows;
    up_rows = 0;
    if (up_row >= pic_ht[up_pic])
      up_act = 0; /* pose terminée — la VM reprend */
    break;
  }
}
