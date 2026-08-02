/*
 * m7.c — the Mode 7 screen (M7-A).
 *
 * VRAM PLAN while the screen is up. Mode 7 interleaves: for each word of
 * $0000-$3FFF the LOW byte is a tilemap entry and the HIGH byte is
 * character data. 16 KB of map (128x128 entries of one byte) plus 16 KB
 * of chars (256 patterns of 64 bytes), in the same address range.
 * $4000+ — the OBJ region — is untouched, which is what lets the
 * vignettes and the animation player keep running over the plane.
 *
 * THE UPLOAD is two passes with two VMAIN settings, which is exactly
 * what PVSnesLib's dmaCopyVram7 exists for: dmacontrol = (BBAD << 8) |
 * DMAP, so $1900 writes the high bytes through $2119 and $1800 the low
 * bytes through $2118. Proved byte-for-byte by the M7-0 spike against a
 * VRAM dump.
 *
 * THE MAP IS STORED COMPACT (wt x ht) and expanded here: the plane is
 * cleared to tile 0 and the image's rows are written into it one DMA
 * each. Storing the whole 128x128 plane would be 16 KB of mostly zeroes
 * per image in ROM.
 *
 * THE ZOOM is a table compiled by datagen — one 8.8 value per frame, fed
 * straight to M7A/M7D. No division at run time: the scale register wants
 * the RECIPROCAL of the zoom, and computing that per frame is exactly
 * what P4/P5/P6 spent their effort removing.
 *
 * B AND C ARE ZEROED at open and never touched again. setMode7Scale does
 * not clear them and a stale value shears the plane — a spike finding,
 * not a deduction.
 */
#include <snes.h>
#include "m7.h"
#include "picture.h"
#include "stage.h"
#include "screenfx.h"
#include "vignette.h"
#include "player.h" /* the world map's camera IS the hero */
#include "camera.h"

/* mode 7 register (data_mode7.c — always emitted) */
extern const u8 m7_img_count;
extern const u8 *const m7_img_chars[];
extern const u16 *const m7_img_chars_sizes[];
extern const u8 *const m7_img_maps[];
extern const u16 *const m7_img_pals[];
extern const u8 m7_img_wt[];
extern const u8 m7_img_ht[];
/* world maps (data_m7world.c — always emitted) */
extern const u8 m7w_count;
extern const u8 m7w_scene[];
extern const u8 *const m7w_chars[];
extern const u16 *const m7w_chars_sizes[];
extern const u8 *const m7w_metas[];
extern const u8 *const m7w_maps[];
extern const u16 *const m7w_pals[];
extern const u8 m7w_w[];
extern const u8 m7w_h[];
extern const u8 m7w_horizon[];
extern const u8 m7w_anchor[];
/* ROTATION, opt-in per map (data_m7wrot*.c). FLAT tables indexed
   map*m7w_rot_stride + angle: one indirection, and a map that never
   turns costs a slice of null entries. The step count is PER MAP — 16,
   32 or 64 — because finer steps buy smoothness with ROM (§7.2d) and a
   map that only ever faces four ways should not pay for 64. */
extern const u8 m7w_rot[];      /* step count, 0 = the map never turns */
extern const u8 m7w_rot_stride; /* slice width of the flat tables */
extern const u8 *const m7w_rotp[];
extern const u8 *const m7w_rotr[];
extern const u16 m7w_rotox[];
extern const u16 m7w_rotoy[];
/* SKY: the band above the horizon, where BG1 is windowed off and the
   BACKDROP shows. m7w_sky is CGRAM 0 itself; the gradient's two ends
   drive a COLDATA table built below. */
extern const u16 m7w_sky[];
extern const u8 m7w_skyg[];
extern const u16 m7w_skytop[];
extern const u16 m7w_skybot[];
/* SKY IMAGE (§7.2f): mode 1 above the horizon, mode 7 below, switched
   mid-frame by HDMA on $2105. The picture rides on BG2 in the 16 KB the
   plane leaves free; its palette is already inside m7w_pals at 112-127. */
extern const u8 m7w_skyimg[];
extern const u8 *const m7w_skych[];
extern const u16 *const m7w_skych_sizes[];
extern const u16 *const m7w_skymaps[];
extern const u8 m7w_skyh[];

/* Arms one HDMA channel from a FAR pointer — vramfast.asm, because C
   cannot hand over a pointer's bank. This is what lets the rotation
   tables stay in ROM instead of being copied into WRAM. */
void m7_arm(u16 chan, u16 dmap_bbad, const u8 *tab);

extern const u8 m7_ramp_count;
extern const u16 *const m7_ramps[];
extern const u8 m7_ramp_lens[];

extern u8 videoMode; /* PVSnesLib mirror of REG_TM */

#define M7_TM 0x11    /* BG1 + OBJ — Mode 7 has no other layer */
#define M7_TM_GAME 0x17
#define M7_PLANE 128  /* the plane, in tiles */
#define M7_SCALE_ONE 0x0100 /* 8.8: 1:1 */

/* ---- PERSPECTIVE (world map only) ---------------------------------
 * A Mode 7 plane with the identity matrix is a FLAT TOP-DOWN MAP. The
 * hardware is in mode 7 and nothing about the picture says so — put it
 * side by side with the same scene in mode 1 and the two images are
 * almost identical. What makes a plane READ as Mode 7 is the pitch: the
 * floor laid down under the camera, converging to a horizon.
 *
 * The PPU computes, for screen pixel (x, y):
 *   px = A*(x + HOFS - X0) + B*(y + VOFS - Y0) + X0
 *   py = C*(x + HOFS - X0) + D*(y + VOFS - Y0) + Y0
 * Choosing HOFS = X0 - 128 and VOFS = Y0 - HORIZON turns the two
 * parenthesised terms into (x - 128) and d = y - HORIZON, the line's
 * distance below the horizon. Leaving B = C = 0 (no rotation: north
 * stays up, which is what a world map wants):
 *   px = A(y)*(x - 128) + X0
 *   py = D(y)*d + Y0
 * Perspective is then A(d) = dA/d — the plane widens as it comes closer
 * — and D(d) = -(dA/d)^2, negative so that FAR is UP the map. dA is the
 * distance from the horizon to the anchor line, the one row drawn 1:1.
 *
 * Both tables depend only on the horizon and the anchor, never on the
 * camera: they are built ONCE when the map opens, and the camera moves
 * through X0/Y0 alone — four register writes per frame, no per-frame
 * maths at all.
 *
 * A and D are per-scanline, which is what HDMA is for: channels 6 and 5
 * in mode $02 (one register written twice — M7A and M7D are
 * double-write registers). Channels 3-6 belong to hdmafx, but its three
 * effects are map ambience and the Mode 7 VBlank branch suspends them.
 */
#define M7P_FAR 0x3FFF /* above the horizon: sample far outside the
                          plane so M7SEL's "repeat character 0" gives a
                          clean sky rather than a stretched first row */
/* HDMA continuous mode caps a block at 127 lines, so 224 lines are two
   blocks of 112: [header][112 x 2 bytes][header][112 x 2][terminator] */
#define M7P_HALF 112
#define M7P_TAB (2 + M7P_HALF * 4 + 1)

/* THE CAMERA ANGLE, in the only two numbers that describe it: the screen
   line the ground vanishes into, and the screen line drawn 1:1 — where
   the hero stands. Their DIFFERENCE is the whole tilt: a large gap makes
   a gentle, almost top-down view, a small one a low raking one. They are
   scene data (datagen writes them) and a script can change them, which
   is what "several camera angles" means here.
   Not #defines any more: the tables are rebuilt when they change. */
#define M7P_HORIZON_DEF 56
#define M7P_ANCHOR_DEF 176
static u8 pv_horizon = M7P_HORIZON_DEF;
static u8 pv_anchor = M7P_ANCHOR_DEF;
static u8 pv_da = M7P_ANCHOR_DEF - M7P_HORIZON_DEF;
/* First line the plane is allowed to show. Above it the sampled point is
   still INSIDE the plane for the few screen columns near x = 128 — the
   near-horizon lines compress so hard that no finite A pushes them all
   out — and a floating rectangle of map hangs in the sky. Windowing BG1
   off up there settles it for good, and the sky becomes CGRAM 0. */
static u8 pv_sky = M7P_HORIZON_DEF + (M7P_ANCHOR_DEF - M7P_HORIZON_DEF) / 8 + 1;

/* channels 3, 5 and 6 (7 belongs to the NMI's OAM DMA — see hdmafx.c) */
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

/* Rotation state. rot_ok says the OPEN MAP carries tables built for its
   own pitch — m7_view changes the pitch, which invalidates them, so it
   clears this and snaps back to angle 0. Stated rather than hidden: a
   script that re-pitches a rotating map loses the rotation until the
   scene reloads. */
static u8 rot_ok = 0;    /* the open map carries valid tables */
static u8 rot_n = 0;     /* its step count: 16, 32 or 64 */
static u8 rot_ang = 0;
static u16 rot_base = 0; /* the open map's slice of the flat tables */
/* A TURN IN PROGRESS. Snapping to an angle is what m7_rotate does; what
   makes a turn read as smooth is the engine walking the steps itself,
   the same shape as the zoom ramp. Costs nothing: an angle change is
   four pointer writes, so this is a counter and a comparison. */
static u8 rt_target = 0;
static u8 rt_dir = 0;   /* 0 idle, 1 forward, 2 backward */
static u8 rt_every = 0; /* frames per step */
static u8 rt_wait = 0;

/* ---- SKY -----------------------------------------------------------
 * A flat sky is CGRAM 0: the plane is windowed off above the horizon, so
 * what shows there is the backdrop. One register write, no channel, and
 * it works with rotation.
 *
 * A GRADIENT is colour math on the backdrop ALONE — CGADSUB $20, no BG1
 * bit — with the fixed colour rewritten per scanline through HDMA on
 * COLDATA. screenfx's own gradient (S15) uses $23, which includes BG1:
 * on a world map that would tint the whole plane, not the sky. Hence a
 * circuit of its own here rather than a flag over there; this module
 * already owns the window registers for the same reason.
 *
 * CGRAM 0 stays BLACK under a gradient, so backdrop + fixed = fixed and
 * the sky is exactly the colour asked for.
 *
 * COLDATA takes ONE component per write (bits 7-5 select B/G/R), so mode
 * $02 pushes two components a line — over the ~70 lines of sky that is
 * far more than the 31 steps a channel can need. */
static u8 sky_on = 0;   /* a gradient is up: channel 4 is ours */
static u8 sk_tab[M7P_TAB];

/* ---- SKY IMAGE -----------------------------------------------------
 * A picture above the horizon needs a second layer, and Mode 7 has none.
 * So the VIDEO MODE ITSELF switches mid-frame — mode 1 down to the
 * horizon, mode 7 under it — through an HDMA on $2105. Super Mario Kart's
 * trick; the spike of §7.2f proved it holds here.
 *
 * It costs NO extra channel: this table REPLACES the sky window's. Above
 * the horizon we are not in mode 7, so the plane cannot leak there and
 * there is nothing left to mask.
 *
 * BG1 has to be silenced, because in mode 1 it draws too and its scroll
 * registers ARE M7HOFS/M7VOFS — rewritten every frame with plane
 * coordinates, so BG1 would show a wildly shifted copy of the sky.
 * Pointing its mode-1 tilemap at a ZEROED region makes it render char 0
 * everywhere, i.e. nothing. An HDMA on TM would work too and would cost
 * the channel we do not have. */
#define M7_SKY_CH 0x6000  /* sky chars — free while the plane is up */
#define M7_SKY_MAP 0x7000 /* sky tilemap (the picture map's region) */
#define M7_SKY_NUL 0x7800 /* BG1's blank mode-1 map */
static u8 img_on = 0;
static u8 img_h = 0;
static u8 md_tab[8];

static u8 pa_tab[M7P_TAB];
static u8 pd_tab[M7P_TAB];
/* The window table needs no per-line entry: two constant bands, so
   REPEAT mode (bit 7 clear) says "these two bytes for the next N
   lines". Ten bytes for the whole screen. */
static u8 pw_tab[10];

static u8 m7_on = 0;
static u8 m7_world = 0; /* a world map, not an image: perspective is on */
static u8 m7_req = 0; /* 0 nothing, 1 open, 2 close */
static u8 m7_req_img = 0;
static u8 m7_req_dur = 0;
static u8 m7_close = 0; /* the loop must run the internal warp */

/* Current zoom ramp. rp_id 0xFF means none: the scale then stays where
   the last ramp left it, which is what makes "zoom in, hold, close"
   expressible without a second command. */
static u8 rp_id = 0xFF;
static u8 rp_pos = 0;
static u8 rp_loop = 0;
static u16 rp_scale = M7_SCALE_ONE;
static u8 rp_dirty = 0; /* the matrix must go out this VBlank */

/* Rotation centre, in plane pixels — the middle of the image. */
static u16 m7_cx = 0;
static u16 m7_cy = 0;

u8 m7_active(void)
{
  return m7_on;
}

u8 m7_busy(void)
{
  return m7_on && rp_id != 0xFF && !rp_loop;
}

void m7_request_open(u8 img, u8 dur)
{
  m7_req = 1;
  m7_req_img = img;
  m7_req_dur = dur;
}

void m7_request_close(u8 dur)
{
  m7_req = 2;
  m7_req_dur = dur;
}

void m7_zoom(u8 ramp, u8 flags)
{
  if (!m7_on)
    return;
  /* INERT ON A WORLD MAP, and it cannot be otherwise: the perspective
     rewrites M7A and M7D every scanline through HDMA, so a matrix scale
     is overwritten before the first line is drawn. A world map's zoom is
     its CAMERA ANGLE (m7_view) — the gap between horizon and anchor —
     and that is what the editor points at. */
  if (m7_world)
    return;
  if (ramp == M7_ZOOM_STOP || ramp >= m7_ramp_count || !m7_ramp_lens[ramp])
  {
    rp_id = 0xFF; /* stop where we are — the scale is kept */
    return;
  }
  rp_id = ramp;
  rp_pos = 0;
  rp_loop = flags & M7_ZOOM_LOOP;
  rp_scale = m7_ramps[ramp][0];
  rp_dirty = 1;
}

/* Writes the whole matrix. Every register is a WRITE-TWICE pair. */
static void m7_matrix(u16 s)
{
  REG_M7A = (u8)(s & 0xFF);
  REG_M7A = (u8)(s >> 8);
  REG_M7B = 0;
  REG_M7B = 0;
  REG_M7C = 0;
  REG_M7C = 0;
  REG_M7D = (u8)(s & 0xFF);
  REG_M7D = (u8)(s >> 8);
}

/* Centre and scroll, so the zoom happens AROUND the image instead of
   dragging it off the top-left corner: the rotation centre sits on the
   middle of the image and the scroll brings that point to the middle of
   the screen (128, 112). */
static void m7_place(void)
{
  u16 hofs = m7_cx - 128;
  u16 vofs = m7_cy - 112;

  REG_M7X = (u8)(m7_cx & 0xFF);
  REG_M7X = (u8)(m7_cx >> 8);
  REG_M7Y = (u8)(m7_cy & 0xFF);
  REG_M7Y = (u8)(m7_cy >> 8);
  REG_M7HOFS = (u8)(hofs & 0xFF);
  REG_M7HOFS = (u8)(hofs >> 8);
  REG_M7VOFS = (u8)(vofs & 0xFF);
  REG_M7VOFS = (u8)(vofs >> 8);
}

/* One CGRAM entry, by hand: PVSnesLib's helpers all take a whole
   palette. */
static void m7_cgram0(u16 c)
{
  REG_CGADD = 0;
  *(vuint8 *)0x2122 = (u8)(c & 0xFF); /* CGDATA — PVSnesLib names the
                                         address but not the register */
  *(vuint8 *)0x2122 = (u8)(c >> 8);
}

/* Builds the per-scanline COLDATA table for a sky gradient. Same layout
   as the perspective tables — two continuous blocks of 112 — but mode
   $02, so two component writes a line. */
static void m7_sky_build(u16 top, u16 bot)
{
  u16 y, i, span;
  u8 c[3], t[3], b[3], k;

  t[0] = (u8)(top & 31);
  t[1] = (u8)((top >> 5) & 31);
  t[2] = (u8)((top >> 10) & 31);
  b[0] = (u8)(bot & 31);
  b[1] = (u8)((bot >> 5) & 31);
  b[2] = (u8)((bot >> 10) & 31);

  sk_tab[0] = 0x80 | M7P_HALF;
  sk_tab[1 + M7P_HALF * 2] = 0x80 | M7P_HALF;
  sk_tab[M7P_TAB - 1] = 0;

  /* The gradient spans the SKY, not the screen: below the horizon the
     plane covers the backdrop anyway, and stretching it to line 223
     would waste most of its range on pixels nobody sees. */
  span = pv_sky ? pv_sky : 1;
  for (y = 0; y < 224; y++)
  {
    u16 f = y < span ? y : span; /* held at the bottom colour below */
    for (k = 0; k < 3; k++)
      c[k] = (u8)(t[k] + ((int)(b[k] - t[k]) * (int)f) / (int)span);
    i = y < M7P_HALF ? 1 + y * 2 : 2 + y * 2;
    /* two components a line, rotating, so all three refresh every line
       and a half — a component one line stale is invisible */
    k = (u8)((y * 2) % 3);
    sk_tab[i] = (u8)((k == 0 ? 0x20 : k == 1 ? 0x40 : 0x80) | c[k]);
    k = (u8)((y * 2 + 1) % 3);
    sk_tab[i + 1] = (u8)((k == 0 ? 0x20 : k == 1 ? 0x40 : 0x80) | c[k]);
  }
}

/* Uploads the sky picture and puts mode 1 in a state where it shows
   nothing but that picture. Called once, screen off. */
static void m7_sky_image(u8 i)
{
  u16 zero;

  img_h = m7w_skyh[i];
  dmaCopyVram((u8 *)m7w_skych[i], M7_SKY_CH, *m7w_skych_sizes[i]);
  dmaCopyVram((u8 *)m7w_skymaps[i], M7_SKY_MAP, 2048);
  zero = 0;
  dmaFillVram16(&zero, M7_SKY_NUL, 2048); /* BG1 draws char 0 = nothing */

  REG_BG1SC = (u8)(M7_SKY_NUL >> 8);   /* 32x32 */
  REG_BG2SC = (u8)(M7_SKY_MAP >> 8);
  REG_BG12NBA = 0x66;                  /* BG1 and BG2 chars at $6000 */
  videoMode = 0x13;
  REG_TM = 0x13; /* BG1 (blank) + BG2 (the sky) + OBJ */

  /* mode 1 to the horizon, mode 7 under it. A repeat block caps at 127
     lines, so the lower band is two. */
  md_tab[0] = pv_sky;
  md_tab[1] = 0x01;
  md_tab[2] = 127;
  md_tab[3] = 0x07;
  md_tab[4] = (u8)(224 - pv_sky - 127);
  md_tab[5] = 0x07;
  md_tab[6] = 0;
}

/* The sky pans with the camera: a quarter of its travel for distance,
   plus a full screen width over a whole turn — which is exactly what a
   256-wide picture wants, BG2's map being 32 tiles and wrapping. */
static void m7_sky_scroll(void)
{
  u16 h = (m7_cx >> 2) + (u16)rot_ang * 16;
  u16 v = (u16)(img_h - pv_sky); /* the picture's BOTTOM on the horizon */

  REG_BG2HOFS = (u8)(h & 0xFF);
  REG_BG2HOFS = (u8)(h >> 8);
  REG_BG2VOFS = (u8)(v & 0xFF);
  REG_BG2VOFS = (u8)(v >> 8);
}

/* Sets the camera angle and derives everything that follows from it.
   CLAMPED rather than refused: a script can reach this, and a world map
   that stops rendering because a variable held a silly number is worse
   than one drawn at the nearest sane angle. datagen refuses bad values
   at build time, where the author can still see them.
   The 16-line floor on the gap is where D leaves its 8.8 register —
   below it the whole screen would be sky. */
static void m7_persp_set(u8 horizon, u8 anchor)
{
  if (horizon > 180)
    horizon = 180;
  if (anchor > 216)
    anchor = 216;
  if (anchor < horizon + 16)
    anchor = horizon + 16;
  pv_horizon = horizon;
  pv_anchor = anchor;
  pv_da = anchor - horizon;
  pv_sky = horizon + pv_da / 8 + 1;
}

/* Builds the two per-scanline tables. Called once, screen off — 224
   divisions here buy zero arithmetic per frame afterwards.
   Everything stays in 16 bits on purpose: tcc-816 has no 32-bit divide
   worth calling, and (dA/d)^2 fits if the quotient and the remainder are
   scaled separately. */
static void m7_persp_build(void)
{
  u16 y, d, a, t, q, r, i;

  pa_tab[0] = 0x80 | M7P_HALF;
  pd_tab[0] = 0x80 | M7P_HALF;
  pa_tab[1 + M7P_HALF * 2] = 0x80 | M7P_HALF;
  pd_tab[1 + M7P_HALF * 2] = 0x80 | M7P_HALF;
  pa_tab[M7P_TAB - 1] = 0; /* terminator */
  pd_tab[M7P_TAB - 1] = 0;

  for (y = 0; y < 224; y++)
  {
    /* two headers to step over, one before each half */
    i = y < M7P_HALF ? 1 + y * 2 : 2 + y * 2;
    d = y > pv_horizon ? y - pv_horizon : 0;
    /* D = (dA/d)^2 leaves the 8.8 register below d = dA/8. Rather than
       CLAMP those lines — which flattens them into a smeared wedge at the
       join, plainly visible on a capture — treat them as sky: they are
       past the render distance anyway. The horizon then reads as a clean
       edge instead of a crease. */
    if (y < pv_sky)
    {
      a = M7P_FAR;
      t = M7P_FAR;
    }
    else
    {
      a = (u16)(((u16)pv_da << 8) / d); /* dA/d in 8.8 */
      /* (dA/d)^2 = a*dA/d, split so the product never leaves 16 bits */
      q = a / d;
      r = a - q * d;
      t = q * pv_da + (r * pv_da) / d;
      t = (u16)(0 - t); /* NEGATIVE: far away is UP the map */
    }
    pa_tab[i] = (u8)a;
    pa_tab[i + 1] = (u8)(a >> 8);
    pd_tab[i] = (u8)t;
    pd_tab[i + 1] = (u8)(t >> 8);
  }

  /* Sky band: window 1 covers the whole line, so BG1 is masked and only
     the backdrop shows. Below: an EMPTY window (left > right). */
  pw_tab[0] = pv_sky;
  pw_tab[1] = 0x00; /* WH0 left */
  pw_tab[2] = 0xFF; /* WH1 right */
  pw_tab[3] = 127;  /* a repeat block caps at 127 lines */
  pw_tab[4] = 0x01;
  pw_tab[5] = 0x00;
  pw_tab[6] = (u8)(224 - pv_sky - 127);
  pw_tab[7] = 0x01;
  pw_tab[8] = 0x00;
  pw_tab[9] = 0;
}

/* Arms the two channels. Redone on every VBlank, like hdmafx's — a
   general DMA can have reused the channel between two frames. */
static void m7_persp_hdma(void)
{
  u16 a;
  u8 m, q;

  if (rot_ok)
  {
    /* ROTATION: four coefficients instead of two, so four channels
       instead of one pair. A = s*cos(t), C = s*sin(t) = s*cos(t-90) and
       D = -s^2*cos(t), B = s^2*sin(t) = -s^2*cos(t+90) — which is why
       ONE family of tables serves two registers, a quarter turn apart,
       and why there are 16 steps and not 15.
       Channels 1, 4, 5 and 6, plus 3 for the sky window: exactly the
       five free while a world map is up (0 is the general DMA's, 2 the
       scripted wipe's, 7 the NMI's OAM). */
    m = rot_ang;
    q = (u8)(rot_n >> 2); /* a quarter turn, in steps */
    m7_arm(6, 0x1B02, m7w_rotp[rot_base + m]);                        /* M7A */
    m7_arm(1, 0x1D02, m7w_rotp[rot_base + ((m - q) & (rot_n - 1))]);  /* M7C */
    m7_arm(5, 0x1E02, m7w_rotr[rot_base + m]);                        /* M7D */
    m7_arm(4, 0x1C02, m7w_rotr[rot_base + ((m + q) & (rot_n - 1))]);  /* M7B */
    if (img_on)
      m7_arm(3, 0x0500, (const u8 *)md_tab); /* $2105 BGMODE */
    else
      m7_arm(3, 0x2601, (const u8 *)pw_tab); /* $2126 window */
    REG_HDMAEN = screenfx_wipe_active() ? 0x7E : 0x7A;
    return;
  }

  DMAP6 = 0x02; /* one register, written twice */
  BBAD6 = 0x1B; /* M7A $211B */
  a = (u16)(u8 *)pa_tab;
  A1T6L = (u8)a;
  A1T6H = (u8)(a >> 8);
  A1B6 = 0x7E;
  DMAP5 = 0x02;
  BBAD5 = 0x1E; /* M7D $211E */
  a = (u16)(u8 *)pd_tab;
  A1T5L = (u8)a;
  A1T5H = (u8)(a >> 8);
  A1B5 = 0x7E;
  if (img_on)
  {
    DMAP3 = 0x00; /* one byte per entry */
    BBAD3 = 0x05; /* $2105 BGMODE */
    a = (u16)(u8 *)md_tab;
  }
  else
  {
    DMAP3 = 0x01; /* two adjacent registers: $2126 then $2127 */
    BBAD3 = 0x26; /* WH0 */
    a = (u16)(u8 *)pw_tab;
  }
  A1T3L = (u8)a;
  A1T3H = (u8)(a >> 8);
  A1B3 = 0x7E;
  /* This module writes $420C only while the plane is up, and the Mode 7
     VBlank branch has already let hdmafx stand down. The scripted wipe
     (S18c) keeps its channel: a scr_hide must still curtain a world
     map. */
  m = screenfx_wipe_active() ? 0x6C : 0x68;
  if (sky_on)
  {
    DMAP4 = 0x02; /* ONE register, written twice: two colour components a
                     line — COLDATA takes one component per write */
    BBAD4 = 0x32; /* COLDATA */
    a = (u16)(u8 *)sk_tab;
    A1T4L = (u8)a;
    A1T4H = (u8)(a >> 8);
    A1B4 = 0x7E;
    m |= 0x10;
    /* REASSERTED EVERY FRAME, not just at open: screenfx_vblank runs
       first in this branch and rewrites CGADSUB whenever its own state
       is dirty — the open-time value survived exactly one frame, and the
       sky came back black. */
    REG_CGWSEL = 0x00;
    REG_CGADSUB = 0x20; /* addition on the BACKDROP ALONE */
  }
  REG_HDMAEN = m;
}

/* Camera and pitch anchor. The whole perspective moves through these
   four registers — see the header comment. */
static void m7_persp_place(void)
{
  /* The rotation centre is the hero pushed dA units BEHIND the camera,
     and "behind" turns with it — hence a table rather than (0, +dA). */
  u16 x0 = rot_ok ? (u16)(m7_cx + m7w_rotox[rot_base + rot_ang]) : m7_cx;
  u16 y0 = rot_ok ? (u16)(m7_cy + m7w_rotoy[rot_base + rot_ang])
                  : (u16)(m7_cy + pv_da);
  u16 hofs = x0 - 128;
  u16 vofs = y0 - pv_horizon;

  REG_M7X = (u8)(x0 & 0xFF);
  REG_M7X = (u8)(x0 >> 8);
  REG_M7Y = (u8)(y0 & 0xFF);
  REG_M7Y = (u8)(y0 >> 8);
  REG_M7HOFS = (u8)(hofs & 0xFF);
  REG_M7HOFS = (u8)(hofs >> 8);
  REG_M7VOFS = (u8)(vofs & 0xFF);
  REG_M7VOFS = (u8)(vofs >> 8);
}

u8 m7_world_active(void)
{
  return m7_on && m7_world;
}

/* On a world map the camera IS the hero: he stands on the anchor line
   and the plane slides underneath. Placing the ORDINARY camera so that
   player_draw's `player.x - camera.x` lands on the anchor means the draw
   loop needs no Mode 7 case at all — the hero, his charset, his walking
   frames and his direction all keep working unchanged. */
void m7_world_track(void)
{
  if (!m7_on || !m7_world)
    return;
  m7_cx = player.x + 8; /* the hero's centre, in plane pixels */
  m7_cy = player.y + 8;
  camera.x = player.x - 120;
  camera.y = player.y - (u16)(pv_anchor - 16);
}

static void m7_fade_out(u8 dur)
{
  u16 step, lvl, f;

  if (!dur)
    return;
  step = 0x0F00 / dur;
  lvl = 0x0F00;
  for (f = 0; f < dur; f++)
  {
    lvl = lvl > step ? lvl - step : 0;
    WaitForVBlank();
    REG_INIDISP = (u8)(lvl >> 8);
  }
}

static void m7_fade_in(u8 dur)
{
  u16 step, lvl, f;

  if (!dur)
  {
    REG_INIDISP = 0x0F;
    return;
  }
  step = 0x0F00 / dur;
  lvl = 0;
  for (f = 0; f < dur; f++)
  {
    lvl += step;
    WaitForVBlank();
    REG_INIDISP = (u8)(lvl >> 8 > 0x0F ? 0x0F : lvl >> 8);
  }
  REG_INIDISP = 0x0F;
}

static void m7_open(void)
{
  u8 id = m7_req_img;
  u8 wt, ht, ty;
  u16 zero;

  if (id >= m7_img_count)
    return; /* nothing to show: leave the scene alone */
  m7_fade_out(m7_req_dur);
  setScreenOff();
  picture_reset(); /* an image is showing: Mode 7 takes over */
  stage_reset();   /* likewise a composed screen */
  m7_on = 1;
  m7_world = 0; /* an image is shown FLAT and zoomed, never pitched */
  rp_id = 0xFF;
  rp_scale = M7_SCALE_ONE;
  rp_dirty = 0;

  /* The scene's sprites go away; the vignettes come back below. */
  for (ty = 0; ty < 128; ty++)
    oamSetVisible((u16)(ty << 2), OBJ_HIDE);

  REG_BGMODE = 0x07;
  videoMode = M7_TM;
  REG_TM = M7_TM;
  REG_TS = 0;
  screenfx_cm_hold(0);

  /* Clear BOTH bytes of $0000-$3FFF first: the chars then fill the high
     bytes and the image's rows the low ones, so every map cell not
     written stays tile 0 — no separate fill pass for the plane. */
  zero = 0;
  dmaFillVram16(&zero, 0x0000, 0x4000);

  wt = m7_img_wt[id];
  ht = m7_img_ht[id];
  dmaCopyVram7((u8 *)m7_img_chars[id], 0x0000, *m7_img_chars_sizes[id], 0x80,
               0x1900);
  for (ty = 0; ty < ht; ty++)
    dmaCopyVram7((u8 *)m7_img_maps[id] + (u16)ty * wt,
                 (u16)ty * M7_PLANE, wt, 0x00, 0x1800);
  /* 128 colours: CGRAM 0-127. 128-255 stays the sprites' — that is what
     keeps the vignettes usable over the plane. */
  dmaCopyCGram((u8 *)m7_img_pals[id], 0, 256);

  /* Outside the 128x128 tile area, show tile 0 rather than wrapping:
     zooming out past the plane then gives a clean border instead of a
     repeated image. */
  REG_M7SEL = M7_OUTTILE;
  m7_cx = (u16)wt << 2; /* wt * 8 / 2 */
  m7_cy = (u16)ht << 2;
  m7_place();
  m7_matrix(rp_scale);

  screenfx_warp_reset();
  vig_reload(); /* the upload overwrote CGRAM; the OBJ chars survived */
  setScreenOn();
  m7_fade_in(m7_req_dur);
}

/* One row of the plane, built in WRAM then pushed. 128 tiles wide, the
   full plane width, so a row is one DMA whatever the map's size. */
static u8 wrow[M7_PLANE];

/* Opens a world map scene on the plane. Returns 1 when it took over, so
   the caller skips the ordinary scene path. */
u8 m7_world_open(u8 scene_id, u8 dur)
{
  u8 i, w, h, bx, by, half;
  const u8 *meta;
  const u8 *map;
  u16 zero;

  for (i = 0; i < m7w_count; i++)
    if (m7w_scene[i] == scene_id)
      break;
  if (i >= m7w_count)
    return 0; /* not a world map — the caller carries on normally */

  m7_fade_out(dur);
  setScreenOff();
  picture_reset();
  stage_reset();
  m7_on = 1;
  m7_world = 1;
  rp_id = 0xFF;
  rp_scale = M7_SCALE_ONE;
  rp_dirty = 0;

  for (bx = 0; bx < 128; bx++)
    oamSetVisible((u16)(bx << 2), OBJ_HIDE);

  REG_BGMODE = 0x07;
  videoMode = M7_TM;
  REG_TM = M7_TM;
  REG_TS = 0;
  screenfx_cm_hold(0);

  zero = 0;
  dmaFillVram16(&zero, 0x0000, 0x4000);
  dmaCopyVram7((u8 *)m7w_chars[i], 0x0000, *m7w_chars_sizes[i], 0x80, 0x1900);
  dmaCopyCGram((u8 *)m7w_pals[i], 0, 256);

  /* Expand blocks to tiles: each 16x16 block is two tiles wide and two
     tall, so a block row produces TWO plane rows — the top one from
     quadrants 0 and 1, the bottom from 2 and 3. */
  w = m7w_w[i];
  h = m7w_h[i];
  meta = m7w_metas[i];
  map = m7w_maps[i];
  for (by = 0; by < h; by++)
  {
    for (half = 0; half < 2; half++)
    {
      for (bx = 0; bx < M7_PLANE; bx++)
        wrow[bx] = 0;
      for (bx = 0; bx < w; bx++)
      {
        u16 b = (u16)map[(u16)by * w + bx] << 2;
        wrow[bx << 1] = meta[b + (half << 1)];
        wrow[(bx << 1) + 1] = meta[b + (half << 1) + 1];
      }
      dmaCopyVram7(wrow, (u16)(((u16)by << 1) + half) * M7_PLANE, M7_PLANE,
                   0x00, 0x1800);
    }
  }

  REG_M7SEL = M7_OUTTILE;
  /* B and C stay zero for good: no rotation on a world map, north is up.
     A and D are the HDMA's from here on — these writes only give the
     first frame something sane before the transfer starts. */
  m7_matrix(M7_SCALE_ONE);
  m7_persp_set(m7w_horizon[i], m7w_anchor[i]); /* the scene's camera angle */
  img_on = 0;
  /* SKY. A gradient keeps CGRAM 0 black so that backdrop + fixed colour
     IS the fixed colour; a flat sky is CGRAM 0 itself and needs no
     channel, which is why it still works under rotation. */
  sky_on = m7w_skyg[i];
  if (sky_on)
  {
    m7_cgram0(0);
    m7_sky_build(m7w_skytop[i], m7w_skybot[i]);
    REG_CGWSEL = 0x00;
    REG_CGADSUB = 0x20; /* addition on the BACKDROP ALONE — not BG1, or
                           the gradient would tint the whole plane */
  }
  else
  {
    m7_cgram0(m7w_sky[i]);
  }
  rot_n = m7w_rot[i];
  rot_ok = rot_n != 0;
  rot_ang = 0;
  rt_dir = 0;
  rot_base = (u16)i * m7w_rot_stride;
  img_on = m7w_skyimg[i];
  if (img_on)
  {
    /* No window: above the horizon we are in mode 1, so the plane is not
       drawn there at all and there is nothing to mask. */
    REG_W12SEL = 0;
    REG_TMW = 0;
    m7_sky_image(i);
  }
  else
  {
    REG_W12SEL = 0x02; /* window 1 applies to BG1, not inverted */
    REG_TMW = 0x01;    /* and it MASKS BG1 on the main screen */
  }
  player_draw_reset(); /* the hide loop above moved the hero's OAM */
  m7_persp_build();
  m7_world_track(); /* the camera is the hero, from the very first frame */
  m7_persp_place();
  m7_persp_hdma();

  screenfx_warp_reset();
  vig_reload();
  setScreenOn();
  m7_fade_in(dur);
  return 1;
}

void m7_apply(void)
{
  u8 r = m7_req;

  m7_req = 0;
  if (r == 1)
    m7_open();
  else if (r == 2 && m7_on)
  {
    m7_fade_out(m7_req_dur);
    setScreenOff();
    m7_close = 1; /* the loop goes on to the internal warp */
  }
}

u8 m7_take_close(void)
{
  u8 c = m7_close;

  m7_close = 0;
  return c;
}

void m7_reset(void)
{
  if (!m7_on)
    return;
  /* Back to the game's mode BEFORE scene_load: it reloads the scenery
     into a VRAM plan that only makes sense outside Mode 7. */
  setMode(BG_MODE1, 0x08); /* the engine's normal mode (main.c) */
  videoMode = M7_TM_GAME;
  REG_TM = M7_TM_GAME;
  if (m7_world)
  {
    REG_HDMAEN = 0; /* the perspective must not survive into mode 1 —
                       hdmafx reasserts its own mask at the next VBlank */
    rot_ok = 0;
    REG_W12SEL = 0; /* nor the sky window: a scene with no spotlight has
                       no window at all, which is what we go back to */
    REG_TMW = 0;
    if (sky_on)
    {
      REG_CGADSUB = 0; /* the colour math goes back to screenfx, which
                          reasserts its own on the next dirty frame */
      sky_on = 0;
    }
    if (img_on)
    {
      REG_TM = M7_TM_GAME; /* the mode-1 sky's layers go back to the
                              scene's own; scene_load rebuilds the rest */
      img_on = 0;
    }
  }
  m7_on = 0;
  m7_world = 0;
  m7_req = 0;
  rp_id = 0xFF;
  /* Vignettes shown during the screen are part of its staging. */
  vig_hide(0);
  vig_hide(1);
  vig_hide(2);
  vig_hide(3);
}

void m7_view(u8 horizon, u8 anchor)
{
  if (!m7_on || !m7_world)
    return; /* an image screen has no ground to tilt */
  m7_persp_set(horizon, anchor);
  m7_persp_build();
  /* The ROM tables were compiled for the map's own pitch, so a new pitch
     makes them wrong. Rotation stops here rather than shearing the
     plane; the scene's own angle comes back when it reloads. */
  rot_ok = 0;
  rot_ang = 0;
  rt_dir = 0;
  /* The rebuild runs in the MAIN LOOP, so the HDMA may read the tables
     while they are half rewritten: the change costs one torn frame. That
     is deliberate — building them in the VBlank is 224 divisions in a
     window that measures 37 lines, and a camera angle changes on a
     dramatic beat, not every frame. */
}

void m7_rotate(u8 angle)
{
  if (!m7_on || !m7_world || !rot_ok)
    return;
  rot_ang = angle & (rot_n - 1); /* a power of two, so a mask */
  rt_dir = 0;                    /* a snap cancels a turn in progress */
}

void m7_rotate_to(u8 angle, u8 frames)
{
  u8 fwd, back;

  if (!m7_on || !m7_world || !rot_ok)
    return;
  rt_target = angle & (rot_n - 1);
  if (rt_target == rot_ang)
  {
    rt_dir = 0;
    return;
  }
  /* THE SHORT WAY ROUND. Turning 350 degrees to face 10 is what a naive
     "count up to the target" does, and it looks like a mistake because
     it is one. */
  fwd = (u8)((rt_target - rot_ang) & (rot_n - 1));
  back = (u8)(rot_n - fwd);
  rt_dir = fwd <= back ? 1 : 2;
  /* `frames` is the WHOLE turn, so the author thinks in duration rather
     than in steps per frame. 0 means "as fast as the steps allow". */
  {
    u8 steps = fwd <= back ? fwd : back;
    rt_every = frames / steps;
    if (!rt_every)
      rt_every = 1;
  }
  rt_wait = rt_every;
}

u8 m7_rot_busy(void)
{
  return rt_dir != 0;
}

u8 m7_rot_ready(void)
{
  return rot_ok;
}

void m7_update(void)
{
  const u16 *t;

  if (rt_dir && m7_on && m7_world && rot_ok)
  {
    if (--rt_wait == 0)
    {
      rt_wait = rt_every;
      rot_ang = (u8)((rot_ang + (rt_dir == 1 ? 1 : rot_n - 1)) & (rot_n - 1));
      if (rot_ang == rt_target)
        rt_dir = 0;
    }
  }

  if (!m7_on || rp_id == 0xFF)
    return;
  t = m7_ramps[rp_id];
  rp_scale = t[rp_pos];
  rp_dirty = 1;
  rp_pos++;
  if (rp_pos >= m7_ramp_lens[rp_id])
  {
    if (rp_loop)
      rp_pos = 0;
    else
      rp_id = 0xFF; /* held on the last value — see m7_zoom */
  }
}

void m7_vblank(void)
{
  if (!m7_on)
    return;
  if (m7_world)
  {
    /* Four register writes and two channel setups: the whole cost of a
       moving perspective. A and D come from the tables, which never
       change while the map is up. */
    m7_persp_place();
    if (img_on)
      m7_sky_scroll();
    m7_persp_hdma();
    return;
  }
  if (!rp_dirty)
    return;
  rp_dirty = 0;
  m7_matrix(rp_scale);
}
