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
  cm_dirty = 1;
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
