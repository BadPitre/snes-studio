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

/* Fondu scripté ($2100) — niveau 8.8 : 0x0000 (noir) à 0x0F00 (plein).
   Durée en FRAMES (1-255, S18c) — un pas 8.8 par frame, comme les
   fondus des écrans composés : les rampes lentes (1 s+) sont possibles. */
static u16 fade_lvl8;
static u16 fade_tgt8;
static u16 fade_step;
static u8 fade_dirty;
/* Transition du fondu scripté (S18c) : 0 fondu, 1 instantané, 2 mosaïque,
   3-5 balayage (bas/haut/centre) — même codes que les warps */
static u8 fade_fx;
static u8 mos_fix; /* une écriture MOSAIC=0 au prochain VBlank (reliquat
                      d'un hide mosaïque quand la commande suivante ne
                      l'utilise pas) */

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

/* Dégradé de ciel (S15) : mode de la teinte VERTICALE — la couleur
   fixe est aux mains du HDMA (hdmafx, canal 4), screenfx ne pose que
   CGWSEL/CGADSUB. Exclusif avec la teinte plate (même registre). */
static u8 grad_mode;

/* Spotlight (S16) : soustraction (dark,dark,dark) HORS de la fenêtre
   couleur W1 — le cercle de lumière est tracé par le HDMA (hdmafx,
   canal 3, WH0/WH1). screenfx détient l'intensité (source de vérité)
   et arme fenêtre + circuit au VBlank. Exclusif avec teinte/dégradé. */
static u8 spot_dark;

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
  fade_lvl8 = 0x0F00; /* init EXPLICITE de tous les statics (tcc) */
  fade_tgt8 = 0x0F00;
  fade_step = 0x0F00;
  fade_dirty = 0;
  fade_fx = 0;
  mos_fix = 0;
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
  grad_mode = 0; /* dégradé de ciel (S15) */
  spot_dark = 0; /* spotlight (S16) */
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

u8 screenfx_cm_held(void)
{
  return cm_hold;
}

void screenfx_warp_reset(void)
{
  fade_lvl8 = 0x0F00; /* le fondu du warp laisse l'écran allumé */
  fade_tgt8 = 0x0F00;
  fade_dirty = 0;
  fade_fx = 0; /* un scr_hide interrompu par un warp ne laisse rien */
  mos_fix = 0;
  screenfx_wipe_off();
  flash_timer = 0;
  shake_power = 0;
  shake_frames = 0;
  cm_dirty = 1; /* réaffirme la teinte (persistante) sur la nouvelle scène */
}

void screenfx_hide(u8 dur, u8 fx)
{
  fade_tgt8 = 0;
  fade_step = fx == 1 ? 0x0F00 : 0x0F00 / (dur ? dur : (u8)1);
  fade_fx = fx;
  mos_fix = 1;
}

void screenfx_show(u8 dur, u8 fx)
{
  fade_tgt8 = 0x0F00;
  fade_step = fx == 1 ? 0x0F00 : 0x0F00 / (dur ? dur : (u8)1);
  fade_fx = fx;
  mos_fix = 1;
}

u8 screenfx_busy(void)
{
  return fade_lvl8 != fade_tgt8;
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
  tg_left = 0;   /* une teinte IMMÉDIATE annule la graduelle en cours */
  tg_phase2 = 0;
  grad_mode = 0; /* … et le dégradé de ciel (même circuit, S15) */
  spot_dark = 0; /* … et le spotlight (S16) */
  cm_dirty = 1;
}

void screenfx_skygrad(u8 mode)
{
  grad_mode = mode <= 2 ? mode : 0;
  if (grad_mode)
  {
    tint_mode = 0; /* le dégradé REMPLACE la teinte plate */
    tg_left = 0;   /* et coupe une graduelle en cours */
    tg_phase2 = 0;
    spot_dark = 0; /* … et le spotlight (S16) */
  }
  cm_dirty = 1;
}

void screenfx_spot(u8 dark)
{
  spot_dark = dark > 31 ? 31 : dark;
  if (spot_dark)
  {
    tint_mode = 0; /* le spotlight REMPLACE teinte et dégradé */
    tg_left = 0;
    tg_phase2 = 0;
    grad_mode = 0;
  }
  cm_dirty = 1;
}

u8 screenfx_spot_active(void)
{
  return spot_dark;
}

u8 screenfx_skygrad_mode(void)
{
  return grad_mode;
}

u8 screenfx_flash_active(void)
{
  return flash_timer != 0;
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
  grad_mode = 0; /* une teinte (même graduelle) annule le dégradé (S15) */
  spot_dark = 0; /* … et le spotlight (S16) */
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

/* ---- Balayage (S18) : rideau HDMA sur la luminosité ------------------
   Canal 2 (libre : 3 = spotlight, 4 = dégradé, 5/6 = vague, 7 = OAM du
   NMI), mode 0 (1 octet vers $2100), table WRAM reconstruite à chaque
   pas. Une bande = [count][valeur] — la valeur écrite en début de bande
   tient jusqu'à la suivante ; les bandes > 127 lignes sont découpées. */
#define WP_LINES 224

static u8 wp_tbl[16]; /* 6 entrées max (3 bandes découpées) + terminateur */
static u8 wp_on = 0;  /* init explicite (tcc) — rideau actif : hdmafx
                         ajoute le canal 2 à son masque $420C */

u8 screenfx_wipe_active(void)
{
  return wp_on;
}

static u8 *wp_band(u8 *p, u16 lines, u8 val)
{
  u8 n;

  while (lines)
  {
    n = lines > 127 ? 127 : (u8)lines;
    *p++ = n;
    *p++ = val;
    lines -= (u16)n;
  }
  return p;
}

void screenfx_wipe_step(u8 trans, u16 black)
{
  u8 *p = wp_tbl;
  u16 a, half;

  if (black > WP_LINES)
    black = WP_LINES;
  if (trans == 3) /* vers le bas : le noir descend du haut */
  {
    p = wp_band(p, black, 0x00);
    p = wp_band(p, WP_LINES - black, 0x0F);
  }
  else if (trans == 4) /* vers le haut : le noir monte du bas */
  {
    p = wp_band(p, WP_LINES - black, 0x0F);
    p = wp_band(p, black, 0x00);
  }
  else /* vers le centre : deux bandes se rejoignent au milieu */
  {
    half = black >> 1;
    p = wp_band(p, half, 0x00);
    p = wp_band(p, WP_LINES - (half << 1), 0x0F);
    p = wp_band(p, half, 0x00);
  }
  *p = 0; /* terminateur HDMA */

  *(vuint8 *)0x4320 = 0x00; /* DMAP2 : mode 0, un octet par entrée */
  *(vuint8 *)0x4321 = 0x00; /* BBAD2 : $2100 (INIDISP) */
  a = (u16)(u8 *)wp_tbl;
  *(vuint8 *)0x4322 = (u8)a;
  *(vuint8 *)0x4323 = (u8)(a >> 8);
  *(vuint8 *)0x4324 = 0x7E;
  wp_on = 1;
  REG_HDMAEN = 0x04; /* boucles bloquantes : seul canal actif ; boucle
                        principale : hdmafx (dernier au VBlank) réécrit
                        son masque complet, canal 2 inclus via wp_on */
}

void screenfx_wipe_off(void)
{
  wp_on = 0;
  REG_HDMAEN = 0; /* hdmafx réaffirme son masque au prochain VBlank */
}

void screenfx_update(void)
{
  if (fade_lvl8 < fade_tgt8)
  {
    fade_lvl8 = (u16)(fade_tgt8 - fade_lvl8) > fade_step
                    ? fade_lvl8 + fade_step
                    : fade_tgt8;
    fade_dirty = 1;
  }
  else if (fade_lvl8 > fade_tgt8)
  {
    fade_lvl8 = (u16)(fade_lvl8 - fade_tgt8) > fade_step
                    ? fade_lvl8 - fade_step
                    : fade_tgt8;
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
  u8 mz;
  u16 l;

  if (mos_fix)
  {
    mos_fix = 0;
    if (fade_fx != 2)
      REG_MOSAIC = 0; /* reliquat d'un hide mosaïque précédent */
  }
  if (fade_dirty)
  {
    fade_dirty = 0;
    if (fade_fx >= 3)
    {
      /* balayage (S18c) : luminosité pleine, le rideau HDMA (canal 2,
         masque composé par hdmafx) couvre (0x0F00 - niveau) >> 4 lignes
         (0..240, clampé aux 224 lignes) */
      if (fade_lvl8 == fade_tgt8)
      {
        screenfx_wipe_off();
        REG_INIDISP = (u8)(fade_tgt8 >> 8); /* 0 = caché, 15 = montré */
      }
      else
      {
        l = (u16)(0x0F00 - fade_lvl8) >> 4;
        if (l > 224)
          l = 224;
        screenfx_wipe_step(fade_fx, l);
        REG_INIDISP = 0x0F;
      }
    }
    else
    {
      mz = (u8)(fade_lvl8 >> 8);
      if (fade_fx == 2)
      {
        /* mosaïque couplée au fondu — rendue en fin de rampe montante */
        if (fade_lvl8 == 0x0F00)
          REG_MOSAIC = 0;
        else
        {
          mz = 15 - mz;
          mz = (mz << 4) | 0x07;
          REG_MOSAIC = mz;
          mz = (u8)(fade_lvl8 >> 8);
        }
      }
      REG_INIDISP = mz; /* bit 7 = 0 : écran allumé */
    }
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
  else if (spot_dark)
  {
    /* spotlight (S16) : soustraction (dark,dark,dark) HORS de la
       fenêtre couleur W1 — le cercle (WH0/WH1) est tracé par le HDMA
       (hdmafx, canal 3). Le décor est noirci autour du héros ; BG3 et
       les sprites ne participent pas (même limite hardware que la
       teinte). */
    r = spot_dark;
    g = spot_dark;
    b = spot_dark;
    REG_WOBJSEL = 0x20; /* W1 activée pour la fenêtre COULEUR */
    REG_CGWSEL = 0x20;  /* color math coupé À L'INTÉRIEUR de la fenêtre */
    REG_CGADSUB = 0xA3; /* soustraction sur BG1+BG2+fond */
  }
  else if (tint_mode)
  {
    r = tint_r;
    g = tint_g;
    b = tint_b;
    REG_WOBJSEL = 0x00; /* fenêtre couleur rendue (spotlight off) */
    REG_CGWSEL = 0x00;
    REG_CGADSUB = tint_mode == 2 ? 0xA3 : 0x23; /* bit 7 = soustraction */
  }
  else if (grad_mode)
  {
    /* dégradé de ciel (S15) : le circuit est armé ICI, mais COLDATA
       appartient au HDMA (hdmafx, canal 4) — ne pas l'écrire */
    REG_WOBJSEL = 0x00;
    REG_CGWSEL = 0x00;
    REG_CGADSUB = grad_mode == 2 ? 0xA3 : 0x23;
    return;
  }
  else
  {
    r = 0;
    g = 0;
    b = 0;
    REG_WOBJSEL = 0x00;
    REG_CGADSUB = 0x00; /* plus de color math */
  }
  REG_COLDATA = 0x20 | r; /* plans R, G, B de la couleur fixe */
  REG_COLDATA = 0x40 | g;
  REG_COLDATA = 0x80 | b;
}
