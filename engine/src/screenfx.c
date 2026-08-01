/*
 * screenfx.c — scripted screen effects (v0.15): fade (SCRHIDE/SCRSHOW
 * through INIDISP), tint and flash (color math on the fixed colour,
 * $2130-$2132), shake (a horizontal scroll offset).
 *
 * Every register write goes out at VBlank (screenfx_vblank).
 * setFadeEffect (warps) writes INIDISP blocking: never at the same time
 * as a scripted fade (SCRHIDE/SCRSHOW block on the VM side).
 */
#include <snes.h>
#include "screenfx.h"

/* Scripted fade ($2100) — 8.8 level: 0x0000 (black) to 0x0F00 (full).
   Duration in FRAMES (1-255, S18c) — one 8.8 step per frame, like the
   composed-screen fades: slow ramps (1 s+) are possible. */
static u16 fade_lvl8;
static u16 fade_tgt8;
static u16 fade_step;
static u8 fade_dirty;
/* Transition of the scripted fade (S18c): 0 fade, 1 instant, 2 mosaic,
   3-5 wipe (down/up/centre) — same codes as the warps */
static u8 fade_fx;
static u8 mos_fix; /* one MOSAIC=0 write at the next VBlank (left
                      over from a mosaic hide when the next command does
                      not use it) */

/* Tint: add/sub color math of the fixed colour on BG1+BG2+backdrop (the
   OBJs of palettes 0-3 never take part — hardware). BG3 (textbox) is
   excluded: the text stays readable. */
static u8 tint_mode; /* 0 off, 1 add, 2 sub */
static u8 tint_r, tint_g, tint_b;
static u8 cm_dirty; /* rewrite $2130-$2132 at the next VBlank */

/* Flash: an (r,g,b) addition decaying linearly over flash_dur frames,
   taking priority over the tint while it runs */
static u8 flash_r, flash_g, flash_b;
static u8 flash_timer, flash_dur;

/* Shake: horizontal offset ±power, alternating every speed frames */
static u8 shake_power, shake_speed, shake_frames, shake_phase, shake_tick;

/* Sky gradient (S15): the VERTICAL tint mode — the fixed colour is in
   the HDMA's hands (hdmafx, channel 4), screenfx only sets CGWSEL and
   CGADSUB. Exclusive with the flat tint (same register). */
static u8 grad_mode;

/* Spotlight (S16): a (dark,dark,dark) subtraction OUTSIDE the W1 colour
   window — the circle of light is drawn by the HDMA (hdmafx, channel 3,
   WH0/WH1). screenfx owns the intensity (the source of truth) and arms
   window + circuit at VBlank. Exclusive with tint and gradient. */
static u8 spot_dark;

/* GRADUAL tint (S12, day/night): an 8.8 interpolation from the current
   tint towards a target in N frames — non-blocking, persists like the
   tint. An add<->sub switch runs in TWO phases (down to 0 then up: the
   circuit only knows one direction at a time). */
static u8 tg_left;             /* frames left in the current phase */
static u8 tg_mode;             /* FINAL mode (set at the end of the phase) */
static u8 tg_phase2;           /* frames of phase 2 (0 = a single phase) */
static u8 tg_tr, tg_tg, tg_tb; /* rgb target of the CURRENT phase */
static u8 tg_fr, tg_fg, tg_fb; /* FINAL rgb target (screenfx_tintg_rgb) */
static u16 tg_r8, tg_g8, tg_b8; /* current tint in 8.8 */
static u16 tg_sr, tg_sg, tg_sb; /* step per frame (8.8 magnitude) */
static u8 tg_rn, tg_gn, tg_bn;  /* step direction (1 = decreasing) */

void screenfx_init(void)
{
  fade_lvl8 = 0x0F00; /* EXPLICIT init of every static (tcc) */
  fade_tgt8 = 0x0F00;
  fade_step = 0x0F00;
  fade_dirty = 0;
  fade_fx = 0;
  mos_fix = 0;
  tint_mode = 0;
  tint_r = 0;
  tint_g = 0;
  tint_b = 0;
  cm_dirty = 1; /* sets a known color math state at the first VBlank */
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
  grad_mode = 0; /* sky gradient (S15) */
  spot_dark = 0; /* spotlight (S16) */
  tg_left = 0; /* gradual tint (S12) — explicit init (tcc) */
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

/* Picture blend active (S8): the color math belongs to the image —
   screenfx_vblank stops touching $2130-$2132 while the hold is set (tint
   AND flash suspended, same circuit). Releasing = reasserting. */
static u8 cm_hold = 0; /* explicit init (tcc) — screenfx_init does
    NOT touch it: at boot, effect_load (scene_load) sets the hold BEFORE
    screenfx_init, and main reasserts the effect after setMode */
/* Registers of the blend holding the hold (S13): remembered so that the
   LIGHTNING (flash) can borrow the circuit for the length of its decay
   and then put them back — the full storm: blended clouds + rain +
   flash */
static u8 hold_ts = 0;
static u8 hold_wsel = 0;
static u8 hold_adsub = 0;
static u8 cm_flash = 0; /* a flash borrowed the circuit under hold */

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
    cm_dirty = 1; /* the persistent tint takes over again */
}

u8 screenfx_cm_held(void)
{
  return cm_hold;
}

void screenfx_warp_reset(void)
{
  fade_lvl8 = 0x0F00; /* the warp fade leaves the screen lit */
  fade_tgt8 = 0x0F00;
  fade_dirty = 0;
  fade_fx = 0; /* a scr_hide cut short by a warp leaves nothing */
  mos_fix = 0;
  screenfx_wipe_off();
  flash_timer = 0;
  shake_power = 0;
  shake_frames = 0;
  cm_dirty = 1; /* reasserts the tint (persistent) on the new scene */
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
  tg_left = 0;   /* an IMMEDIATE tint cancels the gradual one */
  tg_phase2 = 0;
  grad_mode = 0; /* ... and the sky gradient (same circuit, S15) */
  spot_dark = 0; /* ... and the spotlight (S16) */
  cm_dirty = 1;
}

void screenfx_skygrad(u8 mode)
{
  grad_mode = mode <= 2 ? mode : 0;
  if (grad_mode)
  {
    tint_mode = 0; /* the gradient REPLACES the flat tint */
    tg_left = 0;   /* and cuts a gradual tint in progress */
    tg_phase2 = 0;
    spot_dark = 0; /* ... and the spotlight (S16) */
  }
  cm_dirty = 1;
}

void screenfx_spot(u8 dark)
{
  spot_dark = dark > 31 ? 31 : dark;
  if (spot_dark)
  {
    tint_mode = 0; /* the spotlight REPLACES tint and gradient */
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

/* 8.8 step of a channel towards its target — one division per channel */
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

/* starts a phase from the current tint (tint_r/g/b) towards tg_t* */
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
  grad_mode = 0; /* a tint (even gradual) cancels the gradient (S15) */
  spot_dark = 0; /* ... and the spotlight (S16) */
  if (mode == 0)
  {
    tg_fr = 0; /* "normal": fade the current tint towards zero */
    tg_fg = 0;
    tg_fb = 0;
  }
  if (!frames)
  {
    screenfx_tint_rgb(tg_fr, tg_fg, tg_fb); /* duration 0 = immediate TINT */
    screenfx_tint(mode);
    return;
  }
  if (tint_mode == 0)
  {
    /* no tint displayed: start from zero in the target mode */
    tint_mode = mode ? mode : tint_mode;
    tint_r = 0;
    tint_g = 0;
    tint_b = 0;
  }
  tg_mode = mode;
  if (mode && tint_mode && mode != tint_mode)
  {
    /* add <-> sub: phase 1 down to zero (half), switch, phase 2 */
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
  return shake_phase ? v : (u16)(0 - v); /* u16 wrap = subtraction */
}

/* ---- Wipe (S18): an HDMA curtain over brightness --------------------
   Channel 2 (free: 3 = spotlight, 4 = gradient, 5/6 = wave, 7 = the
   NMI's OAM), mode 0 (1 byte to $2100), WRAM table rebuilt on every
   step. A band is [count][value] — the value written at the start of a
   band holds until the next one; bands over 127 lines are split. */
#define WP_LINES 224

static u8 wp_tbl[16]; /* 6 entries max (3 split bands) + terminator */
static u8 wp_on = 0;  /* explicit init (tcc) — curtain active: hdmafx
                         adds channel 2 to its $420C mask */

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
  if (trans == 3) /* downwards: the black comes down from the top */
  {
    p = wp_band(p, black, 0x00);
    p = wp_band(p, WP_LINES - black, 0x0F);
  }
  else if (trans == 4) /* upwards: the black rises from the bottom */
  {
    p = wp_band(p, WP_LINES - black, 0x0F);
    p = wp_band(p, black, 0x00);
  }
  else /* towards the centre: two bands meet in the middle */
  {
    half = black >> 1;
    p = wp_band(p, half, 0x00);
    p = wp_band(p, WP_LINES - (half << 1), 0x0F);
    p = wp_band(p, half, 0x00);
  }
  *p = 0; /* HDMA terminator */

  *(vuint8 *)0x4320 = 0x00; /* DMAP2: mode 0, one byte per entry */
  *(vuint8 *)0x4321 = 0x00; /* BBAD2: $2100 (INIDISP) */
  a = (u16)(u8 *)wp_tbl;
  *(vuint8 *)0x4322 = (u8)a;
  *(vuint8 *)0x4323 = (u8)(a >> 8);
  *(vuint8 *)0x4324 = 0x7E;
  wp_on = 1;
  REG_HDMAEN = 0x04; /* blocking loops: the only active channel; main
                        loop: hdmafx (last at VBlank) rewrites its full
                        mask, channel 2 included, through wp_on */
}

void screenfx_wipe_off(void)
{
  wp_on = 0;
  REG_HDMAEN = 0; /* hdmafx reasserts its mask at the next VBlank */
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
    /* gradual tint (S12): one 8.8 step per frame, snapped at the end of
       the phase — then an optional phase 2 (add<->sub switch) */
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
        tint_mode = tg_mode; /* switch at zero: the other direction starts */
        tg_tr = tg_fr;
        tg_tg = tg_fg;
        tg_tb = tg_fb;
        tg_launch(tg_phase2);
        tg_phase2 = 0;
      }
      else
        tint_mode = tg_mode; /* target reached (mode 0 = tint removed) */
    }
    cm_dirty = 1;
  }
  if (flash_timer)
  {
    flash_timer--;
    cm_dirty = 1; /* intensity recomputed every frame (decay) */
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
      shake_power = 0; /* the scroll lands exactly back on the camera */
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
      REG_MOSAIC = 0; /* left over from a previous mosaic hide */
  }
  if (fade_dirty)
  {
    fade_dirty = 0;
    if (fade_fx >= 3)
    {
      /* wipe (S18c): full brightness, the HDMA curtain (channel 2, mask
         composed by hdmafx) covers (0x0F00 - level) >> 4 lines (0..240,
         clamped to the 224 lines) */
      if (fade_lvl8 == fade_tgt8)
      {
        screenfx_wipe_off();
        REG_INIDISP = (u8)(fade_tgt8 >> 8); /* 0 = hidden, 15 = shown */
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
        /* mosaic coupled to the fade — rendered at the end of the ramp */
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
      REG_INIDISP = mz; /* bit 7 = 0: screen on */
    }
  }
  if (cm_hold)
  {
    /* the blend (S8/S9) owns the color math — EXCEPT for lightning (S13):
       a flash borrows it for the length of its decay, then the blend's
       registers are put back exactly as remembered */
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
      REG_COLDATA = 0x20; /* fixed colour given back to zero (all 3 planes) */
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
    /* flash: addition, intensity proportional to the time left */
    r = (u8)(((u16)flash_r * flash_timer) / flash_dur);
    g = (u8)(((u16)flash_g * flash_timer) / flash_dur);
    b = (u8)(((u16)flash_b * flash_timer) / flash_dur);
    REG_CGWSEL = 0x00;  /* operand = the fixed colour */
    REG_CGADSUB = 0x23; /* addition on BG1+BG2+backdrop (BG3/OBJ excluded) */
  }
  else if (spot_dark)
  {
    /* spotlight (S16): a (dark,dark,dark) subtraction OUTSIDE the W1
       colour window — the circle (WH0/WH1) is drawn by the HDMA (hdmafx,
       channel 3). The scenery is darkened around the hero; BG3 and the
       sprites do not take part (the same hardware limit as the
       tint). */
    r = spot_dark;
    g = spot_dark;
    b = spot_dark;
    REG_WOBJSEL = 0x20; /* W1 enabled for the COLOUR window */
    REG_CGWSEL = 0x20;  /* color math cut INSIDE the window */
    REG_CGADSUB = 0xA3; /* subtraction on BG1+BG2+backdrop */
  }
  else if (tint_mode)
  {
    r = tint_r;
    g = tint_g;
    b = tint_b;
    REG_WOBJSEL = 0x00; /* colour window given back (spotlight off) */
    REG_CGWSEL = 0x00;
    REG_CGADSUB = tint_mode == 2 ? 0xA3 : 0x23; /* bit 7 = subtraction */
  }
  else if (grad_mode)
  {
    /* sky gradient (S15): the circuit is armed HERE, but COLDATA belongs
       to the HDMA (hdmafx, channel 4) — do not write it */
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
    REG_CGADSUB = 0x00; /* no more color math */
  }
  REG_COLDATA = 0x20 | r; /* R, G, B planes of the fixed colour */
  REG_COLDATA = 0x40 | g;
  REG_COLDATA = 0x80 | b;
}
