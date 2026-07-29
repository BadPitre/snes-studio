/*
 * screenfx.c — effets d'écran scriptés (v0.15, spec §2) : fondu
 * (SCRHIDE/SCRSHOW via INIDISP), teinte et flash (color math sur couleur
 * fixe, $2130-$2132), secousse (offset de scroll horizontal).
 *
 * Toutes les écritures registres partent au VBlank (screenfx_vblank).
 * setFadeEffect (warps) écrit INIDISP en bloquant : jamais en même temps
 * qu'un fondu scripté (SCRHIDE/SCRSHOW sont bloquants côté VM).
 */
#include <snes.h>
#include "screenfx.h"

/* Fondu scripté ($2100) — niveau 0 (noir) à 15 (plein) */
static u8 fade_level;
static u8 fade_target;
static u8 fade_speed;
static u8 fade_dirty;

/* Teinte : color math add/sub de la couleur fixe sur BG1+BG2+fond (les
   OBJ des palettes 0-3 ne participent jamais — hardware). BG3 (textbox)
   exclu : le texte reste lisible. */
static u8 tint_mode; /* 0 off, 1 add, 2 sub */
static u8 tint_r, tint_g, tint_b;
static u8 cm_dirty; /* réécrire $2130-$2132 au prochain VBlank */

/* Flash : addition (r,g,b) décroissant linéairement sur flash_dur frames,
   prioritaire sur la teinte pendant qu'il court */
static u8 flash_r, flash_g, flash_b;
static u8 flash_timer, flash_dur;

/* Secousse : offset horizontal ±power, alternance toutes speed frames */
static u8 shake_power, shake_speed, shake_frames, shake_phase, shake_tick;

/* Teinte GRADUELLE (S12, jour/nuit) : interpolation 8.8 de la teinte
   courante vers une cible en N frames — non bloquante, persiste comme
   la teinte. Bascule add<->sub en DEUX phases (descente vers 0 puis
   montée : le circuit ne connaît qu'un sens à la fois). */
static u8 tg_left;             /* frames restantes de la phase courante */
static u8 tg_mode;             /* mode FINAL (posé en fin de phase) */
static u8 tg_phase2;           /* frames de la phase 2 (0 = une phase) */
static u8 tg_tr, tg_tg, tg_tb; /* cible rgb de la PHASE courante */
static u8 tg_fr, tg_fg, tg_fb; /* cible rgb FINALE (screenfx_tintg_rgb) */
static u16 tg_r8, tg_g8, tg_b8; /* teinte courante en 8.8 */
static u16 tg_sr, tg_sg, tg_sb; /* pas par frame (magnitude 8.8) */
static u8 tg_rn, tg_gn, tg_bn;  /* sens du pas (1 = décroît) */

void screenfx_init(void)
{
  fade_level = 15; /* init EXPLICITE de tous les statics (tcc) */
  fade_target = 15;
  fade_speed = 1;
  fade_dirty = 0;
  tint_mode = 0;
  tint_r = 0;
  tint_g = 0;
  tint_b = 0;
  cm_dirty = 1; /* pose un état color math connu au premier VBlank */
  flash_r = 0;
  flash_g = 0;
  flash_b = 0;
  flash_timer = 0;
  flash_dur = 1;
  shake_power = 0;
  shake_speed = 1;
  shake_frames = 0;
  shake_phase = 0;
  shake_tick = 0;
  tg_left = 0; /* teinte graduelle (S12) — init explicite (tcc) */
  tg_mode = 0;
  tg_phase2 = 0;
  tg_tr = 0;
  tg_tg = 0;
  tg_tb = 0;
  tg_fr = 0;
  tg_fg = 0;
  tg_fb = 0;
  tg_r8 = 0;
  tg_g8 = 0;
  tg_b8 = 0;
  tg_sr = 0;
  tg_sg = 0;
  tg_sb = 0;
  tg_rn = 0;
  tg_gn = 0;
  tg_bn = 0;
}

/* Mélange picture actif (S8) : le color math appartient à l'image —
   screenfx_vblank ne touche plus $2130-$2132 tant que le hold est posé
   (teinte ET flash suspendus, même circuit). Relâcher = réaffirmer. */
static u8 cm_hold = 0; /* init explicite (tcc) — screenfx_init n'y touche
    PAS : au boot, effect_load (scene_load) pose le hold AVANT
    screenfx_init, et main réaffirme l'effet après setMode */
/* registres du mélange détenteur du hold (S13) : mémorisés pour que
   l'ÉCLAIR (flash) puisse emprunter le circuit le temps de sa
   décroissance puis les reposer — l'orage complet : nuages mélangés
   + pluie + flash */
static u8 hold_ts = 0;
static u8 hold_wsel = 0;
static u8 hold_adsub = 0;
static u8 cm_flash = 0; /* un flash a emprunté le circuit sous hold */

void screenfx_cm_hold_regs(u8 ts, u8 wsel, u8 adsub)
{
  hold_ts = ts;
  hold_wsel = wsel;
  hold_adsub = adsub;
}

void screenfx_cm_hold(u8 on)
{
  cm_hold = on;
  if (!on)
    cm_dirty = 1; /* la teinte persistante reprend ses droits */
}

void screenfx_warp_reset(void)
{
  fade_level = 15; /* le fondu du warp laisse l'écran allumé */
  fade_target = 15;
  fade_dirty = 0;
  flash_timer = 0;
  shake_power = 0;
  shake_frames = 0;
  cm_dirty = 1; /* réaffirme la teinte (persistante) sur la nouvelle scène */
}

void screenfx_hide(u8 speed)
{
  fade_target = 0;
  fade_speed = speed ? speed : 1;
}

void screenfx_show(u8 speed)
{
  fade_target = 15;
  fade_speed = speed ? speed : 1;
}

u8 screenfx_busy(void)
{
  return fade_level != fade_target;
}

void screenfx_tint_rgb(u8 r, u8 g, u8 b)
{
  tint_r = r & 31;
  tint_g = g & 31;
  tint_b = b & 31;
}

void screenfx_tint(u8 mode)
{
  tint_mode = mode <= 2 ? mode : 0;
  tg_left = 0; /* une teinte IMMÉDIATE annule la graduelle en cours */
  tg_phase2 = 0;
  cm_dirty = 1;
}

/* pas 8.8 d'un canal vers sa cible — une division par phase et par canal */
static u16 tg_step(u8 cur, u8 tgt, u8 frames, u8 *neg)
{
  u16 c = (u16)cur << 8;
  u16 t = (u16)tgt << 8;

  if (t >= c)
  {
    *neg = 0;
    return (t - c) / frames;
  }
  *neg = 1;
  return (c - t) / frames;
}

/* lance une phase depuis la teinte courante (tint_r/g/b) vers tg_t* */
static void tg_launch(u8 frames)
{
  tg_r8 = (u16)tint_r << 8;
  tg_g8 = (u16)tint_g << 8;
  tg_b8 = (u16)tint_b << 8;
  tg_sr = tg_step(tint_r, tg_tr, frames, &tg_rn);
  tg_sg = tg_step(tint_g, tg_tg, frames, &tg_gn);
  tg_sb = tg_step(tint_b, tg_tb, frames, &tg_bn);
  tg_left = frames;
}

void screenfx_tintg_rgb(u8 r, u8 g, u8 b)
{
  tg_fr = r & 31;
  tg_fg = g & 31;
  tg_fb = b & 31;
}

void screenfx_tintg(u8 mode, u8 frames)
{
  u8 half;

  if (mode > 2)
    mode = 0;
  if (mode == 0)
  {
    tg_fr = 0; /* « normale » : on fond la teinte courante vers zéro */
    tg_fg = 0;
    tg_fb = 0;
  }
  if (!frames)
  {
    screenfx_tint_rgb(tg_fr, tg_fg, tg_fb); /* durée 0 = TINT immédiat */
    screenfx_tint(mode);
    return;
  }
  if (tint_mode == 0)
  {
    /* pas de teinte affichée : partir de zéro dans le mode cible */
    tint_mode = mode ? mode : tint_mode;
    tint_r = 0;
    tint_g = 0;
    tint_b = 0;
  }
  tg_mode = mode;
  if (mode && tint_mode && mode != tint_mode)
  {
    /* add <-> sub : phase 1 vers zéro (moitié), bascule, phase 2 */
    half = frames >> 1;
    if (!half)
      half = 1;
    tg_phase2 = frames - half;
    tg_tr = 0;
    tg_tg = 0;
    tg_tb = 0;
    tg_launch(half);
    return;
  }
  tg_phase2 = 0;
  tg_tr = tg_fr;
  tg_tg = tg_fg;
  tg_tb = tg_fb;
  tg_launch(frames);
}

void screenfx_flash(u8 r, u8 g, u8 b)
{
  flash_r = r & 31;
  flash_g = g & 31;
  flash_b = b & 31;
}

void screenfx_flash_start(u8 frames)
{
  flash_dur = frames ? frames : 1;
  flash_timer = flash_dur;
  cm_dirty = 1;
}

void screenfx_shake(u8 power, u8 speed, u8 frames)
{
  shake_power = power;
  shake_speed = speed ? speed : 1;
  shake_frames = power ? frames : 0;
  shake_phase = 0;
  shake_tick = 0;
}

u16 screenfx_shake_x(void)
{
  u16 v = shake_power;

  if (!shake_frames)
    return 0;
  return shake_phase ? v : (u16)(0 - v); /* wrap u16 = soustraction */
}

void screenfx_update(void)
{
  if (fade_level < fade_target)
  {
    fade_level = (u8)(fade_target - fade_level) > fade_speed
                     ? fade_level + fade_speed
                     : fade_target;
    fade_dirty = 1;
  }
  else if (fade_level > fade_target)
  {
    fade_level = (u8)(fade_level - fade_target) > fade_speed
                     ? fade_level - fade_speed
                     : fade_target;
    fade_dirty = 1;
  }
  if (tg_left)
  {
    /* teinte graduelle (S12) : un pas 8.8 par frame, snap en fin de
       phase — puis phase 2 éventuelle (bascule add<->sub) */
    tg_left--;
    if (tg_left)
    {
      tg_r8 = tg_rn ? tg_r8 - tg_sr : tg_r8 + tg_sr;
      tg_g8 = tg_gn ? tg_g8 - tg_sg : tg_g8 + tg_sg;
      tg_b8 = tg_bn ? tg_b8 - tg_sb : tg_b8 + tg_sb;
      tint_r = (u8)(tg_r8 >> 8);
      tint_g = (u8)(tg_g8 >> 8);
      tint_b = (u8)(tg_b8 >> 8);
    }
    else
    {
      tint_r = tg_tr;
      tint_g = tg_tg;
      tint_b = tg_tb;
      if (tg_phase2)
      {
        tint_mode = tg_mode; /* bascule à zéro : l'autre sens démarre */
        tg_tr = tg_fr;
        tg_tg = tg_fg;
        tg_tb = tg_fb;
        tg_launch(tg_phase2);
        tg_phase2 = 0;
      }
      else
        tint_mode = tg_mode; /* cible atteinte (mode 0 = teinte retirée) */
    }
    cm_dirty = 1;
  }
  if (flash_timer)
  {
    flash_timer--;
    cm_dirty = 1; /* intensité recalculée chaque frame (décroissance) */
  }
  if (shake_frames)
  {
    shake_frames--;
    shake_tick++;
    if (shake_tick >= shake_speed)
    {
      shake_tick = 0;
      shake_phase = !shake_phase;
    }
    if (!shake_frames)
      shake_power = 0; /* le scroll retombe pile sur la caméra */
  }
}

void screenfx_vblank(void)
{
  u8 r, g, b;

  if (fade_dirty)
  {
    fade_dirty = 0;
    REG_INIDISP = fade_level; /* bit 7 = 0 : écran allumé */
  }
  if (cm_hold)
  {
    /* le mélange (S8/S9) possède le color math — SAUF l'éclair (S13) :
       un flash l'emprunte le temps de sa décroissance, puis les
       registres du mélange sont reposés tels que mémorisés */
    if (flash_timer)
    {
      r = (u8)(((u16)flash_r * flash_timer) / flash_dur);
      g = (u8)(((u16)flash_g * flash_timer) / flash_dur);
      b = (u8)(((u16)flash_b * flash_timer) / flash_dur);
      REG_CGWSEL = 0x00;
      REG_CGADSUB = 0x23;
      REG_COLDATA = 0x20 | r;
      REG_COLDATA = 0x40 | g;
      REG_COLDATA = 0x80 | b;
      cm_flash = 1;
    }
    else if (cm_flash)
    {
      cm_flash = 0;
      REG_TS = hold_ts;
      REG_CGWSEL = hold_wsel;
      REG_CGADSUB = hold_adsub;
      REG_COLDATA = 0x20; /* couleur fixe rendue à zéro (les 3 plans) */
      REG_COLDATA = 0x40;
      REG_COLDATA = 0x80;
    }
    return;
  }
  if (!cm_dirty)
    return;
  cm_dirty = 0;
  if (flash_timer)
  {
    /* flash : addition, intensité proportionnelle au temps restant */
    r = (u8)(((u16)flash_r * flash_timer) / flash_dur);
    g = (u8)(((u16)flash_g * flash_timer) / flash_dur);
    b = (u8)(((u16)flash_b * flash_timer) / flash_dur);
    REG_CGWSEL = 0x00;  /* opérande = couleur fixe */
    REG_CGADSUB = 0x23; /* addition sur BG1+BG2+fond (BG3/OBJ exclus) */
  }
  else if (tint_mode)
  {
    r = tint_r;
    g = tint_g;
    b = tint_b;
    REG_CGWSEL = 0x00;
    REG_CGADSUB = tint_mode == 2 ? 0xA3 : 0x23; /* bit 7 = soustraction */
  }
  else
  {
    r = 0;
    g = 0;
    b = 0;
    REG_CGADSUB = 0x00; /* plus de color math */
  }
  REG_COLDATA = 0x20 | r; /* plans R, G, B de la couleur fixe */
  REG_COLDATA = 0x40 | g;
  REG_COLDATA = 0x80 | b;
}
