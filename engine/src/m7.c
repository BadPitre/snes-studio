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
#include "actors.h"
#include "camera.h"
#include "textbox.h"
#include "ui_screen.h"
#include "vram.h"
#include "vblnmi.h"

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
/* GIANT maps (> 16384 blocks): the map travels in 64-row SLICES, each
   row padded to 256 bytes so a block read is two shifts and no multiply
   — a 65 KB array cannot live in one 32 KB LoROM bank (§7.5). NULL for
   maps small enough to stay one linear array. */
extern const u8 *const *const m7w_slicess[];
extern const u8 *const m7w_passes[]; /* collision byte per block (§7.5) */
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
extern const u8 *const m7w_rotab[]; /* per angle: A+B paired, mode 3 */
extern const u8 *const m7w_rotcd[]; /* per angle: C+D paired */
extern const u16 m7w_rotox[];
extern const u16 m7w_rotoy[];
extern const u16 m7w_rotcos[]; /* cos, sin in 8.8 — the INVERSE projection */
extern const u16 m7w_rotsin[];
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
/* A WORLD MAP also enables BG3, which carries the UI layer in the mode-1
   bands. Mode 7 ignores the bit — it has no BG3 — so one static value
   serves both halves of the screen and no HDMA on TM is needed. */
#define M7_TM_WORLD 0x15
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
/* dA squared: the numerator of the inverse projection, recomputed with
   the pitch rather than once per NPC per frame. Fits 16 bits because the
   pitch clamps dA to 216. */
static u16 pv_da2 = (u16)(M7P_ANCHOR_DEF - M7P_HORIZON_DEF)
                    * (M7P_ANCHOR_DEF - M7P_HORIZON_DEF);
/* First line the plane is allowed to show. Above it the sampled point is
   still INSIDE the plane for the few screen columns near x = 128 — the
   near-horizon lines compress so hard that no finite A pushes them all
   out — and a floating rectangle of map hangs in the sky. Windowing BG1
   off up there settles it for good, and the sky becomes CGRAM 0. */
static u8 pv_sky = M7P_HORIZON_DEF + (M7P_ANCHOR_DEF - M7P_HORIZON_DEF) / 8 + 1;

/* channels 3, 5 and 6 (7 belongs to the NMI's OAM DMA — see hdmafx.c) */
#define DMAP1 (*(vuint8 *)0x4310)
#define BBAD1 (*(vuint8 *)0x4311)
#define A1T1L (*(vuint8 *)0x4312)
#define A1T1H (*(vuint8 *)0x4313)
#define A1B1 (*(vuint8 *)0x4314)
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

/* ---- STREAMING (big world maps, §7.5) -------------------------------
 * The plane is 64x64 blocks and nothing changes that; a BIGGER map keeps
 * its full grid in WRAM and the plane holds a 64x64 WINDOW of it,
 * centred on the hero. The plane WRAPS, so block (bx, by) always lives
 * in plane cell (bx & 63, by & 63): world pixel coordinates keep working
 * unchanged, and moving the window is rewriting only the EDGE that comes
 * into range — one block line, two DMA strips of 128 bytes.
 * st_bx/st_by are the window's centre, in world blocks; they trail the
 * hero one block at a time (he moves 2 px a frame, a block is 16). */
static u8 m7_stream = 0;
static u8 st_bx, st_by;
static u8 st_w, st_h;          /* the open map, cached for the strips */
static const u8 *st_map;       /* linear map, NULL on a giant one */
static const u8 *const *st_slices; /* 64-row slices, giant maps only */
static const u8 *st_meta;
static u8 st_pend = 0;         /* bit 0: row strip ready, bit 1: column */
static u16 st_row_addr, st_col_addr;
static u8 st_rowa[128], st_rowb[128]; /* two tile rows of a block row */
static u8 st_cola[128], st_colb[128]; /* two tile columns */

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
#define M7_SKY_MAP 0x7400 /* sky tilemap. NOT $7000 any more: BG3's chars
                             must sit on a 4K-word boundary (BG34NBA is a
                             nibble) and $7000 is the only free one, so
                             the UI layer has first claim on it — see
                             vram.h and m7_ui_open. */
#define M7_SKY_NUL 0x7800 /* BG1's blank mode-1 map */
static u8 img_on = 0;
static u8 img_h = 0;
/* BGMODE table. Three bands at most — mode 1 above the horizon, mode 7
   on the plane, mode 1 again under a dialogue — and a block caps at 127
   lines, so six blocks of two bytes plus the terminator. */
static u8 md_tab[14];
/* The SKY's own BGMODE table, when the sky is a picture: mode 1 to the
   horizon, mode 7 below. Channel 3, in place of the window (§7.2f). */
static u8 sky_md[8];
/* First line of the lower mode-1 band; 0 = no dialogue is up. */
static u8 ui_top = 0;

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
  img_h = m7w_skyh[i];
  dmaCopyVram((u8 *)m7w_skych[i], M7_SKY_CH, *m7w_skych_sizes[i]);
  dmaCopyVram((u8 *)m7w_skymaps[i], M7_SKY_MAP, 2048);
  REG_BG2SC = (u8)(M7_SKY_MAP >> 8);
  videoMode = M7_TM_WORLD | 0x02;
  REG_TM = M7_TM_WORLD | 0x02; /* + BG2, which carries the sky */

  sky_md[0] = pv_sky;
  sky_md[1] = 0x09;
  sky_md[2] = 127;
  sky_md[3] = 0x07;
  sky_md[4] = (u8)(224 - pv_sky - 127);
  sky_md[5] = 0x07;
  sky_md[6] = 0;
}

/* Puts the mode-1 half of a world map in place — once, screen off.
 * Needed with OR WITHOUT a sky image now, because a dialogue lands in
 * mode 1 too:
 *  - BG1 is SILENCED. In mode 1 it draws, and its scroll registers ARE
 *    M7HOFS/M7VOFS, rewritten every frame with plane coordinates: it
 *    would show a wildly shifted copy of something. A tilemap pointed at
 *    a zeroed region renders char 0 everywhere, i.e. nothing, and that
 *    costs no HDMA channel where a TM table would (§7.2f).
 *  - BG3 carries the UI layer, moved above the OBJ region because the
 *    plane owns the whole low half of VRAM. Its map, its chars and its
 *    scrolls are all free in Mode 7, which is why the textbox needs no
 *    Mode 7 case of its own beyond this relocation. */
static void m7_ui_open(void)
{
  u16 zero = 0;

  dmaFillVram16(&zero, M7_SKY_NUL, 2048); /* BG1 draws char 0 = nothing */
  REG_BG1SC = (u8)(M7_SKY_NUL >> 8);      /* 32x32 */
  REG_BG12NBA = 0x66;                     /* BG1 and BG2 chars at $6000 */
  textbox_gfx_at(VRAM_M7_UI_GFX, VRAM_M7_UI_MAP);
  ui_screen_rebase(VRAM_M7_UI_MAP);
  ui_top = 0;
  videoMode = M7_TM_WORLD;
  REG_TM = M7_TM_WORLD;
}

/* One HDMA block, split as often as the 127-line cap demands. Non-repeat
   mode: the header is a line count and the ONE byte after it applies to
   every one of them. */
static u8 md_emit(u8 i, u8 lines, u8 mode)
{
  u8 n;

  while (lines)
  {
    n = lines > 127 ? 127 : lines;
    md_tab[i++] = n;
    md_tab[i++] = mode;
    lines = (u8)(lines - n);
  }
  return i;
}

/* THE BAND TABLE — what makes a dialogue possible on a plane.
 *
 * Mode 7 has one layer and no BG3, so a textbox has nowhere to be drawn.
 * The way out is the one §7.2f already proved for the sky: SWITCH THE
 * VIDEO MODE mid-frame. Above the horizon, and again under the dialogue,
 * we are in mode 1 — where BG3 exists and carries the UI layer exactly
 * as it does on an ordinary scene. Between the two we are in Mode 7 and
 * the plane draws.
 *
 * Mode 1 is 0x09, not 0x01: bit 3 is BG3's high priority, the value
 * main.c sets for an ordinary scene. That is what puts the textbox above
 * the sprites, so a dialogue layers here the way it does everywhere.
 *
 * The channel is free because this table REPLACES the sky window's:
 * above the horizon we are no longer in Mode 7, so the plane cannot leak
 * there and there is nothing to mask. Five channels with rotation, as
 * before, dialogue or no dialogue.
 *
 * What it COSTS is honest and visible: the mode-1 band does not draw the
 * plane. Under the dialogue the ground gives way to the backdrop. With
 * the default layout the box is 32 tiles wide and covers the band whole;
 * a narrower dialogue style would show sky either side of it. */
static void m7_mode_build(void)
{
  u8 i = 0;
  u8 bot = ui_top ? ui_top : 224;

  if (bot < pv_sky)
    bot = pv_sky; /* a band cannot eat into the sky */
  /* TWO bands, and only two. A three-band table — mode 1 for the sky,
     mode 7 for the plane, mode 1 for the dialogue — is what the sky
     picture would want, and it does NOT work: the band appears but BG3
     stops drawing in it. Measured, reproducible, unexplained; the note
     is in the design doc so the next person does not spend the evening
     on it again. Everything above the band therefore stays in Mode 7,
     and the sky picture stands down for as long as the box is open. */
  i = md_emit(i, bot, 0x07);
  i = md_emit(i, (u8)(224 - bot), 0x09);
  md_tab[i] = 0;
}

void m7_ui_band(u8 top)
{
  if (m7_on && m7_world)
    ui_top = top;
}

/* THE CHANNEL MAP while a world map is up. 0 is the general DMA's, 2 the
 * scripted wipe's, 7 the NMI's OAM; of the five left:
 *   6, 5  the perspective — A and D flat, A+B and C+D paired (mode 3)
 *         when the map turns
 *   3     the SKY: the window that masks the plane above the horizon,
 *         or the sky picture's own BGMODE table
 *   4     the sky gradient's COLDATA, when the map has one
 *   1     the DIALOGUE BAND's BGMODE table, on every kind of map —
 *         pairing the rotation is what freed it (§7.2i)
 * m7_mode1 answers "is the sky band mode 1", i.e. does channel 3 carry
 * a BGMODE table instead of the window. */
static u8 m7_mode1(void)
{
  return img_on;
}

/* The band on channel 1 — free whenever the map does not turn. */
static void m7_arm1(void)
{
  u16 a = (u16)(u8 *)md_tab;

  DMAP1 = 0x00; /* one byte per entry */
  BBAD1 = 0x05; /* $2105 BGMODE */
  A1T1L = (u8)a;
  A1T1H = (u8)(a >> 8);
  A1B1 = 0x7E;
}

/* Channel 3, armed BY HAND and not through m7_arm.
 *
 * m7_arm exists to read a pointer's BANK off the stack, which is what
 * lets the rotation tables be read straight out of ROM. Both tables here
 * are WRAM statics instead, and a .bss array does not reach that helper
 * with a usable bank — the rotation path used to arm this channel that
 * way and the mode switch silently never happened. Bank $7E, written
 * flat, is both correct and shorter. */
static void m7_arm3(void)
{
  u16 a;

  if (m7_mode1())
  {
    DMAP3 = 0x00; /* one byte per entry */
    BBAD3 = 0x05; /* $2105 BGMODE */
    a = (u16)(u8 *)sky_md;
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
}

static void m7_mask_regs(void)
{
  if (ui_top)
    m7_mode_build();
  if (m7_mode1())
  {
    /* No window: above the horizon we are not in Mode 7 at all, so the
       plane cannot leak there and there is nothing to mask. */
    REG_W12SEL = 0;
    REG_TMW = 0;
  }
  else
  {
    REG_W12SEL = 0x02; /* window 1 applies to BG1, not inverted */
    REG_TMW = 0x01;    /* and it MASKS BG1 on the main screen */
  }
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
/* Integer square root, 16-bit — one caller, m7_persp_set, and only on a
   camera-angle change. */
static u8 m7_isqrt(u16 v)
{
  u16 r = 0, b = 0x4000, t;

  while (b)
  {
    t = r + b;
    r >>= 1;
    if (v >= t)
    {
      v -= t;
      r += b;
    }
    b >>= 2;
  }
  return (u8)r;
}

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
  pv_da2 = (u16)pv_da * pv_da;
  pv_sky = horizon + pv_da / 8 + 1;
  /* STREAMED map: the horizon must not see past the window. The line d
     below the horizon samples dA^2/d ahead and 128*dA/d to each side —
     rotated, the far corner sits at (dA/d)*sqrt(128^2+dA^2) from the
     camera, and that has to stay inside the window's 512-pixel half,
     minus a 16-pixel slack for the edge being rewritten. So the sky is
     CUT where the corner would leave the window: view distance trades
     for world size, roughly 335 pixels of view at the default tilt
     instead of 900. The formula is rotation-safe so the same map may
     turn or not without a second case. */
  if (m7_stream)
  {
    u16 n = (u16)m7_isqrt((u16)(16384 + pv_da2));
    u8 cut = (u8)(((u16)pv_da * n + 495) / 496);

    if (cut > pv_da / 8)
      pv_sky = horizon + cut + 1;
  }
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
  /* Below: an EMPTY window (left > right), in one or two blocks — a
     block caps at 127 lines, and a deep sky (streamed maps cut it low)
     can leave fewer than 127 lines of ground, where the old fixed 127
     would underflow the second count. A zero count IS the terminator. */
  d = 224 - pv_sky;
  pw_tab[3] = d > 127 ? 127 : (u8)d;
  pw_tab[4] = 0x01;
  pw_tab[5] = 0x00;
  pw_tab[6] = d > 127 ? (u8)(d - 127) : 0;
  pw_tab[7] = 0x01;
  pw_tab[8] = 0x00;
  pw_tab[9] = 0;
}

/* Arms the sky gradient's COLDATA channel (4) and returns its enable
   bit — 0 when the map has no gradient. Shared by BOTH branches of
   m7_persp_hdma: channel 4 is free under rotation since the pairing
   (§7.2d), and the first version of the rotation branch simply returned
   before this block — which is why the gradient/rotation exclusion
   looked like a hardware fact when it was a control-flow one. */
static u8 m7_arm_sky(void)
{
  u16 a;

  if (!sky_on)
    return 0;
  DMAP4 = 0x02; /* ONE register, written twice: two colour components a
                   line — COLDATA takes one component per write */
  BBAD4 = 0x32; /* COLDATA */
  a = (u16)(u8 *)sk_tab;
  A1T4L = (u8)a;
  A1T4H = (u8)(a >> 8);
  A1B4 = 0x7E;
  /* REASSERTED EVERY FRAME, not just at open: screenfx_vblank runs
     first in this branch and rewrites CGADSUB whenever its own state
     is dirty — the open-time value survived exactly one frame, and the
     sky came back black. */
  REG_CGWSEL = 0x00;
  REG_CGADSUB = 0x20; /* addition on the BACKDROP ALONE */
  return 0x10;
}

/* Arms the two channels. Redone on every VBlank, like hdmafx's — a
   general DMA can have reused the channel between two frames. */
static void m7_persp_hdma(void)
{
  u16 a;
  u8 m;

  m7_mask_regs();
  if (rot_ok)
  {
    /* ROTATION: two PAIRED channels, not four single ones. M7A and M7B
       are adjacent registers ($211B/$211C), M7C and M7D likewise — and
       transfer mode 3 writes two adjacent registers twice each per line,
       which is exactly the shape a pair of double-write registers wants.
       So ONE channel carries A+B and ONE carries C+D.

       The first version spent a channel per coefficient — four — by
       halving its ROM with a quarter-turn identity (C is A ninety
       degrees back), which forces one register per channel. That saving
       cost the dialogue: with 6, 1, 5 and 4 taken and 3 on the sky, no
       channel was left for the band and a textbox on a turning map
       could not exist. Paired tables double the ROM (~28 KB per map at
       16 steps) and give BOTH channels back — the band keeps channel 1
       here exactly as on a map that never turns. */
    m7_arm(6, 0x1B03, m7w_rotab[rot_base + rot_ang]); /* M7A + M7B */
    m7_arm(5, 0x1D03, m7w_rotcd[rot_base + rot_ang]); /* M7C + M7D */
    m7_arm3();
    m = screenfx_wipe_active() ? 0x6C : 0x68;
    if (ui_top)
    {
      m7_arm1();
      m |= 0x02;
    }
    else if (!img_on)
      REG_BGMODE = 0x07; /* band closed: same restore as below */
    m |= m7_arm_sky();
    REG_HDMAEN = m;
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
  m7_arm3();
  /* This module writes $420C only while the plane is up, and the Mode 7
     VBlank branch has already let hdmafx stand down. The scripted wipe
     (S18c) keeps its channel: a scr_hide must still curtain a world
     map. */
  m = screenfx_wipe_active() ? 0x6C : 0x68;
  if (ui_top)
  {
    m7_arm1(); /* the map does not turn: channel 1 is free */
    m |= 0x02;
  }
  else if (!img_on)
  {
    /* The band has just closed. The HDMA stops writing $2105 and the
       register KEEPS the last value it was given — mode 1 — so without
       this the plane never comes back and the whole screen stays the
       sky colour. Cost: one register write a frame. */
    REG_BGMODE = 0x07;
  }
  m |= m7_arm_sky();
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

/* The per-block collision table of the scene's world map, NULL when the
   scene is not one. scene_load asks BEFORE decoding its grids — a world
   map ships none: its block map lives in ROM and m7_world_block reads it
   there, which is what frees the map from the WRAM budget (§7.5).
   Also BINDS the map here, so collision works from the first query. */
const u8 *m7_world_pass(u8 scene_id)
{
  u8 i;

  for (i = 0; i < m7w_count; i++)
    if (m7w_scene[i] == scene_id)
    {
      st_w = m7w_w[i];
      st_h = m7w_h[i];
      st_map = m7w_maps[i];
      st_slices = m7w_slicess[i];
      st_meta = m7w_metas[i];
      return m7w_passes[i];
    }
  return 0;
}

/* ONE block of the bound world map, read from ROM. The giant format's
   256-byte row pitch turns the read into two shifts; the linear format
   keeps its multiply (once per call, not per frame). Hot path: the
   collision of the hero and of every moving NPC comes through here. */
u8 m7_world_block(u8 bx, u8 by)
{
  if (st_slices)
    return st_slices[by >> 6][((u16)(by & 63) << 8) | bx];
  return st_map[(u16)by * st_w + bx];
}

/* On a world map the camera IS the hero: he stands on the anchor line
   and the plane slides underneath. Placing the ORDINARY camera so that
   player_draw's `player.x - camera.x` lands on the anchor means the draw
   loop needs no Mode 7 case at all — the hero, his charset, his walking
   frames and his direction all keep working unchanged. */
/* Builds the two 128-byte tile strips of ONE incoming block line and
   remembers where they go. Main-loop work: 64 far reads and a few adds
   per strip — the DMA itself happens in m7_vblank, where VRAM is
   writable. `vert` = a COLUMN of blocks (the hero crossed in X).
   `line` and the world coordinates below are u16 ON PURPOSE: on a
   255-wide map the window's far edge reaches world block 285, and a u8
   would wrap it onto block 29 — showing the west coast on the east
   horizon. In u16, past-the-edge (and below-zero, by underflow) simply
   fails the bounds test and paints sky. */
static void m7_stream_build(u8 vert, u16 line)
{
  u8 k;

  if (vert)
  {
    for (k = 0; k < 64; k++)
    {
      u16 wby = (u16)st_by + k - 32;
      u8 p = (u8)(((u8)wby & 63) << 1);

      /* Outside the map: TILE 0 (transparent, the sky shows through),
         not block 0 — block 0 is the eraser's black. The initial window
         expansion does the same, so the edge looks alike either way. */
      if (line < st_w && wby < st_h)
      {
        u16 b = (u16)m7_world_block((u8)line, (u8)wby) << 2;

        st_cola[p] = st_meta[b];
        st_cola[p + 1] = st_meta[b + 2];
        st_colb[p] = st_meta[b + 1];
        st_colb[p + 1] = st_meta[b + 3];
      }
      else
      {
        st_cola[p] = 0;
        st_cola[p + 1] = 0;
        st_colb[p] = 0;
        st_colb[p + 1] = 0;
      }
    }
    st_col_addr = (u16)(line & 63) << 1;
    st_pend |= 2;
  }
  else
  {
    for (k = 0; k < 64; k++)
    {
      u16 wbx = (u16)st_bx + k - 32;
      u8 p = (u8)(((u8)wbx & 63) << 1);

      if (line < st_h && wbx < st_w)
      {
        u16 b = (u16)m7_world_block((u8)wbx, (u8)line) << 2;

        st_rowa[p] = st_meta[b];
        st_rowa[p + 1] = st_meta[b + 1];
        st_rowb[p] = st_meta[b + 2];
        st_rowb[p + 1] = st_meta[b + 3];
      }
      else
      {
        st_rowa[p] = 0;
        st_rowa[p + 1] = 0;
        st_rowb[p] = 0;
        st_rowb[p + 1] = 0;
      }
    }
    st_row_addr = (u16)((line & 63) << 1) * M7_PLANE;
    st_pend |= 1;
  }
}

void m7_world_track(void)
{
  u8 hb;

  if (!m7_on || !m7_world)
    return;
  m7_cx = player.x + 8; /* the hero's centre, in plane pixels */
  m7_cy = player.y + 8;
  camera.x = player.x - 120;
  camera.y = player.y - (u16)(pv_anchor - 16);
  if (!m7_stream)
    return;

  /* The window trails the hero ONE BLOCK a frame and per axis — he walks
     2 px a frame and a block is 16, so he cannot outrun it. A strip not
     yet flushed by the VBlank blocks the next one on the same axis: the
     buffers are single, and the slack is what the sky cut bought. */
  hb = (u8)((player.x + 8) >> 4);
  if (hb != st_bx && !(st_pend & 2))
  {
    if ((u8)(hb - st_bx) < 128)
    {
      st_bx++;
      m7_stream_build(1, (u16)st_bx + 31); /* new east edge */
    }
    else
    {
      st_bx--;
      m7_stream_build(1, (u16)st_bx - 32); /* new west edge */
    }
  }
  hb = (u8)((player.y + 8) >> 4);
  if (hb != st_by && !(st_pend & 1))
  {
    if ((u8)(hb - st_by) < 128)
    {
      st_by++;
      m7_stream_build(0, (u16)st_by + 31);
    }
    else
    {
      st_by--;
      m7_stream_build(0, (u16)st_by - 32);
    }
  }
}

/* ---- INVERSE PROJECTION: a plane position -> a screen position -------
 *
 * The hero needs none of this (the camera is placed under him so he
 * lands on the anchor), but every OTHER sprite does: an NPC standing at
 * plane (px, py) has to be drawn where the PPU is currently sampling
 * that point. The PPU goes the other way — screen to plane — so this
 * inverts it.
 *
 * With u = x - 128 the screen column and d = y - horizon the screen line
 * below the horizon, the forward transform this module sets up is
 *     px - X0 = m*cos + n*sin
 *     py - Y0 = m*sin - n*cos       with m = dA*u/d and n = dA^2/d
 * and the rotation centre is (X0, Y0) = camera + (-dA*sin, +dA*cos).
 * Substituting the centre and inverting the rotation gives, for
 * (ux, uy) = the NPC minus the camera:
 *     L  = ux*cos + uy*sin
 *     D0 = ux*sin - uy*cos + dA          (<= 0: behind the camera)
 *     d  = dA^2 / D0                     -> y = horizon + d
 *     u  = L*dA / D0                     -> x = 128 + u
 * Two divisions and four multiplications per NPC, all in 16 bits.
 *
 * The result lands in m7_pjx / m7_pjy rather than through pointers:
 * under tcc-816 an out-parameter costs more than the arithmetic.
 * Returns 0 when the point is not on screen at all. */
u16 m7_pjx;
u16 m7_pjy;

/* Beyond this many plane pixels from the camera an NPC is a speck one
   scanline tall — culling there also keeps the shift below to two
   steps, which is what keeps the products inside 16 bits. */
#define M7_PJ_FAR 511

u8 m7_project(u16 px, u16 py)
{
  u16 aux, auy, co, si, t, acc, al, d0, d, prod;
  u8 nx, ny, cn, sn, sh, nl;

  if (!m7_on || !m7_world)
    return 0;

  /* (ux, uy) = the point minus the camera, as magnitude plus sign: the
     products below stay unsigned, and tcc-816 never has to shift a
     negative number right (implementation-defined, and it does get it
     wrong on 8-bit intermediates). */
  nx = 0;
  ny = 0;
  if (px >= m7_cx)
    aux = px - m7_cx;
  else
  {
    aux = m7_cx - px;
    nx = 1;
  }
  if (py >= m7_cy)
    auy = py - m7_cy;
  else
  {
    auy = m7_cy - py;
    ny = 1;
  }
  if (aux > M7_PJ_FAR || auy > M7_PJ_FAR)
    return 0;

  /* One shift for both axes, so the rotation stays a rotation. At most
     two steps: 511 >> 2 = 127, and 127 * 256 fits. The lost bits are
     4 plane pixels at 32 tiles out — under one screen pixel there. */
  sh = 0;
  t = aux > auy ? aux : auy;
  while (t > 127)
  {
    t >>= 1;
    sh++;
  }
  aux >>= sh;
  auy >>= sh;

  if (rot_ok)
  {
    t = m7w_rotcos[rot_base + rot_ang];
    cn = (t & 0x8000) != 0;
    co = cn ? (u16)(0 - t) : t;
    t = m7w_rotsin[rot_base + rot_ang];
    sn = (t & 0x8000) != 0;
    si = sn ? (u16)(0 - t) : t;
  }
  else
  {
    co = 256; /* 1.0 in 8.8 */
    cn = 0;
    si = 0;
    sn = 0;
  }

  /* L = ux*cos + uy*sin, accumulated in two's complement. */
  acc = 0;
  t = (u16)((aux * co) >> 8);
  acc = (nx ^ cn) ? (u16)(acc - t) : (u16)(acc + t);
  t = (u16)((auy * si) >> 8);
  acc = (ny ^ sn) ? (u16)(acc - t) : (u16)(acc + t);
  acc = (u16)(acc << sh);
  nl = (acc & 0x8000) != 0;
  al = nl ? (u16)(0 - acc) : acc;

  /* D0 = ux*sin - uy*cos + dA. Zero or negative means the point is at or
     behind the camera plane: there is no screen line for it. */
  acc = 0;
  t = (u16)((aux * si) >> 8);
  acc = (nx ^ sn) ? (u16)(acc - t) : (u16)(acc + t);
  t = (u16)((auy * co) >> 8);
  acc = (ny ^ cn) ? (u16)(acc + t) : (u16)(acc - t); /* MINUS uy*cos */
  acc = (u16)((u16)(acc << sh) + pv_da);
  if (acc == 0 || (acc & 0x8000))
    return 0;
  d0 = acc;

  /* The screen line. d < 2 is the horizon itself — a sprite there is a
     speck standing in the sky; past the bottom it is off screen. */
  d = pv_da2 / d0;
  if (d < 2 || d > (u16)(232 - pv_horizon))
    return 0;
  m7_pjy = (u16)pv_horizon + d;

  /* The screen column: u = L*dA/D0. Split so the product always fits in
     16 bits — near the camera |L| is small, far from it D0 is large.
     The third case (a large L with a tiny D0) is off screen by
     construction: |L| > 128 and D0 < 8 give u > 256. */
  if (al <= 128)
    prod = (u16)(al * pv_da) / d0;
  else if (d0 >= 8)
    prod = (u16)((al >> 3) * pv_da) / (u16)(d0 >> 3);
  else
    return 0;
  /* 135 and not 128: a sprite half off the side is still worth drawing,
     but past that the 9-bit OAM X wraps to the OTHER edge and the NPC
     teleports across the screen. */
  if (prod > 135)
    return 0;
  m7_pjx = nl ? (u16)(128 - prod) : (u16)(128 + prod);
  return 1;
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
  vn_cancel_scene(); /* same rule as the world map below (V-NMI V3) */
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
  vn_cancel_scene(); /* the plane owns VRAM now: no stale map burst or
      tile step from the scene left behind (V-NMI V3) */
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
  /* CGRAM 16-19 belongs to the textbox font (spec §4) and the plane's
     palette has just written over it. Put it back — a dialogue on a
     world map draws in BG3 palette 4 like everywhere else, and datagen
     keeps those three colours out of the plane so nothing is lost. */
  textbox_load_pal();

  /* Expand blocks to tiles: each 16x16 block is two tiles wide and two
     tall, so a block row produces TWO plane rows — the top one from
     quadrants 0 and 1, the bottom from 2 and 3. */
  w = m7w_w[i];
  h = m7w_h[i];
  meta = m7w_metas[i];
  map = m7w_maps[i];
  st_w = w;
  st_h = h;
  st_map = map;               /* NULL on a giant map — m7_world_block */
  st_slices = m7w_slicess[i]; /* then reads the 64-row slices instead */
  st_meta = meta;
  st_pend = 0;
  m7_stream = (u8)(w > 64 || h > 64);
  if (!m7_stream)
  {
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
  }
  else
  {
    /* BIG map (§7.5): the plane holds a 64x64-block WINDOW centred on
       the hero. Block (bx, by) lives in plane cell (bx & 63, by & 63) —
       the plane wraps, so world coordinates need no translation, here
       or anywhere else. Outside the map: tile 0, and CGRAM 0 (the sky
       colour) shows past the edges as on a small map. World coordinates
       in u16, like the strips: a u8 would wrap the window's far edge
       back onto the map on a 255-wide world. */
    u8 r, c;

    st_bx = (u8)((player.x + 8) >> 4);
    st_by = (u8)((player.y + 8) >> 4);
    for (r = 0; r < 64; r++)
    {
      u16 wby = (u16)st_by + r - 32; /* below zero: underflow, > h, blank */
      u8 prow = (u8)((u8)wby & 63);

      for (half = 0; half < 2; half++)
      {
        for (bx = 0; bx < M7_PLANE; bx++)
          wrow[bx] = 0;
        if (wby < h)
          for (c = 0; c < 64; c++)
          {
            u16 wbx = (u16)st_bx + c - 32;
            u8 pcol;
            u16 b;

            if (wbx >= w)
              continue;
            pcol = (u8)((u8)wbx & 63);
            b = (u16)m7_world_block((u8)wbx, (u8)wby) << 2;
            wrow[pcol << 1] = meta[b + (half << 1)];
            wrow[(pcol << 1) + 1] = meta[b + (half << 1) + 1];
          }
        dmaCopyVram7(wrow, (u16)(((u16)prow << 1) + half) * M7_PLANE,
                     M7_PLANE, 0x00, 0x1800);
      }
    }
  }

  /* Small map: outside the 128x128 tile area show tile 0, so past the
     edges is sky. STREAMED map: the plane must WRAP — the window is
     placed modulo 64 blocks and the camera rides world coordinates, so
     "outside the plane" is where the hero lives most of the time. The
     map's own edges are blank blocks in the window instead. */
  REG_M7SEL = m7_stream ? 0x00 : M7_OUTTILE;
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
  m7_ui_open(); /* BG1 silenced, BG3 relocated: needed for a dialogue
                   whether or not this map has a sky picture */
  if (img_on)
    m7_sky_image(i);
  player_draw_reset(); /* the hide loop above moved the hero's OAM */
  actors_draw_reset(); /* and every NPC's */
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
    /* Streaming (§7.5): the strips built in the main loop go out here,
       where VRAM is writable. Worst case one row AND one column a
       frame: four DMAs, 512 bytes — about nine lines, and vbl_open
       reads the counter after us so the arbiter sees them naturally. */
    if (st_pend & 1)
    {
      dmaCopyVram7(st_rowa, st_row_addr, 128, 0x00, 0x1800);
      dmaCopyVram7(st_rowb, (u16)(st_row_addr + M7_PLANE), 128, 0x00, 0x1800);
    }
    if (st_pend & 2)
    {
      dmaCopyVram7(st_cola, st_col_addr, 128, 0x02, 0x1800);
      dmaCopyVram7(st_colb, (u16)(st_col_addr + 1), 128, 0x02, 0x1800);
    }
    st_pend = 0;
    return;
  }
  if (!rp_dirty)
    return;
  rp_dirty = 0;
  m7_matrix(rp_scale);
}
