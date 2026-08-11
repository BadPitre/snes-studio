/*
 * anim.c — frame-by-frame animations. See anim.h.
 *
 * An animation is L LAYERS, each holding a vignette slot: the layer
 * carries its cell and position, the vignette carries the graphics path
 * (OBJ chars, palette, VBlank transfer). The L layers share the sheet's
 * palette — see vignette.h, that is what makes simultaneous cells
 * affordable.
 *
 * The track is FLATTENED with a FIXED stride: per frame, L records of
 * 3 bytes [cell][dx][dy], then [duration][sound]. The stride is 3L + 2,
 * computed ONCE at launch; the player adds it to the current offset,
 * never multiplying and never decoding a variable length. tcc-816
 * compiles every indexed access into a long indirect read of about 11
 * instructions, so a frame costs 3L + 2 reads and nothing else — and
 * only when the frame changes. The rest of the time the player just
 * decrements a counter. */
#include <snes.h>
#include "vignette.h"
#include "anim.h"
#include "audio.h"

/* generated registry (data_anims.c — always emitted) */
extern const u8 anim_count;
extern const u8 anim_vig[];
extern const u8 anim_flags[];
extern const u8 anim_layers[];
extern const u8 anim_nframes[];
extern const u16 anim_ofs[];
extern const u8 anim_track[];

/* SCREEN anchoring: (0,0) is a 32x32 cell centred on the 256x224
   screen. The frame's offset starts from there — the same rule as in
   the editor, whose canvas shows the whole screen. */
#define ANIM_SCR_X 112
#define ANIM_SCR_Y 96
/* The SCREEN anchor's base. Scripts always get the fixed centre (the
   ANIMPLAY opcode resets it); the battle aims it at a target before
   playing a skill's animation (C3). */
static u8 a_scr_x = ANIM_SCR_X;
static u8 a_scr_y = ANIM_SCR_Y;

void anim_screen_at(u8 x, u8 y)
{
  a_scr_x = x;
  a_scr_y = y;
}

/* vignette slot of layer l of animation s */
#define A_VS(s, l) a_vs[((s) << 2) + (l)]

static u8 a_id[ANIM_SLOTS]; /* 0xFF = free slot */
static u8 a_frame[ANIM_SLOTS];
static u8 a_n[ANIM_SLOTS];      /* frame count */
static u8 a_loop[ANIM_SLOTS];   /* looping animation: never blocks */
static u8 a_lay[ANIM_SLOTS];    /* layer count (1-4) */
static u8 a_stride[ANIM_SLOTS]; /* 3*layers + 2 */
static u8 a_timer[ANIM_SLOTS];
static u8 a_anc[ANIM_SLOTS];
static u16 a_base[ANIM_SLOTS]; /* offset of frame 0 in anim_track */
static u16 a_cur[ANIM_SLOTS];  /* offset of the CURRENT frame */
static u8 a_vs[ANIM_SLOTS * ANIM_LAYERS_MAX]; /* borrowed slots, 0xFF = none */
static u8 a_fresh = 0; /* bitmask: frame posed THIS screen frame — the
                          first tick does not consume it, whatever the
                          VM/player order */
static u8 a_init = 0;  /* statics set (explicit tcc init) */

static void anim_init_once(void)
{
  u8 s, l;

  if (a_init)
    return;
  a_init = 1;
  for (s = 0; s < ANIM_SLOTS; s++)
  {
    a_id[s] = 0xFF;
    for (l = 0; l < ANIM_LAYERS_MAX; l++)
      A_VS(s, l) = 0xFF;
  }
  a_fresh = 0;
}

/* Gives back an animation's vignette slots. hide = 0 when they were
   preempted by a scripted vig_show: the script has taken over what it
   shows, so we do not hide it from under its feet. */
static void anim_free(u8 s, u8 hide)
{
  u8 l, vs;

  for (l = 0; l < ANIM_LAYERS_MAX; l++)
  {
    vs = A_VS(s, l);
    if (vs == 0xFF)
      continue;
    if (hide && vig_is_anim(vs))
      vig_hide(vs);
    A_VS(s, l) = 0xFF;
  }
  a_id[s] = 0xFF;
  a_fresh &= (u8)~(1 << s);
}

/* Applies the current frame: cell and position of EACH layer, then
   duration and sound (once for the frame). */
static void anim_enter(u8 s)
{
  u16 o = a_cur[s];
  u8 nl = a_lay[s];
  u8 l, cell, vs;
  s8 dx, dy;
  u8 sfx;

  for (l = 0; l < nl; l++)
  {
    cell = anim_track[o];
    dx = (s8)anim_track[o + 1];
    dy = (s8)anim_track[o + 2];
    o += 3;
    vs = A_VS(s, l);
    if (vs == 0xFF)
      continue;
    if (cell == ANIM_CELL_NONE)
    {
      vig_set_visible(vs, 0); /* empty layer: the slot stays reserved */
      continue;
    }
    vig_set_visible(vs, 1);
    vig_set_frame(vs, cell);
    if (a_anc[s] == ANIM_ANC_SCREEN)
      vig_move(vs, (u8)(a_scr_x + dx), (u8)(a_scr_y + dy));
    else
      vig_move(vs, (u8)dx, (u8)dy); /* signed offsets around the target */
  }

  a_timer[s] = anim_track[o];
  sfx = anim_track[o + 1];
  if (sfx != 0xFF)
    audio_play_sfx(sfx);
  a_fresh |= (u8)(1 << s);
}

void anim_play(u8 anim_id, u8 anchor, u8 target)
{
  u8 s, best, i, l, nl, vig, vs;

  anim_init_once();
  if (anim_id >= anim_count)
    return;
  vig = anim_vig[anim_id];
  nl = anim_layers[anim_id];
  if (nl == 0 || nl > ANIM_LAYERS_MAX)
    nl = 1;

  /* Palette first: the two free OBJ palettes may already be taken by
     two OTHER sheets. Better to play nothing than to play in another
     image's colours. */
  if (!vig_pal_available(vig))
    return;

  /* one animation slot */
  s = 0xFF;
  for (i = 0; i < ANIM_SLOTS; i++)
    if (a_id[i] == 0xFF)
    {
      s = i;
      break;
    }
  if (s == 0xFF)
  {
    best = 0;
    for (i = 1; i < ANIM_SLOTS; i++)
      if (a_frame[i] > a_frame[best])
        best = i;
    anim_free(best, 1);
    s = best;
  }

  /* Enough vignette slots for every layer? We take them as we go; if
     any are missing, the MOST ADVANCED running animation gives its own
     up and we try once more. */
  for (i = 0; i < 2; i++)
  {
    for (l = 0; l < nl; l++)
    {
      vs = vig_free_slot();
      if (vs == 0xFF)
        break;
      A_VS(s, l) = vs;
      vig_show(vs, vig, 0, 0); /* reserves the slot AND the palette */
      vig_own_anim(vs);        /* AFTER vig_show, which resets ownership to 0 */
      if (anchor == ANIM_ANC_ACTOR)
        vig_anchor_actor(vs, target);
      else
        vig_anchor(vs, anchor ? VIG_ANC_HERO : VIG_ANC_SCREEN);
    }
    if (l == nl)
      break; /* every layer is posed */
    /* not enough room: give back what we took, free a victim */
    anim_free(s, 1);
    best = 0xFF;
    for (l = 0; l < ANIM_SLOTS; l++)
      if (a_id[l] != 0xFF && (best == 0xFF || a_frame[l] > a_frame[best]))
        best = l;
    if (best == 0xFF || i)
      return; /* nothing to sacrifice, or already tried: give up */
    anim_free(best, 1);
  }

  a_id[s] = anim_id;
  a_frame[s] = 0;
  a_n[s] = anim_nframes[anim_id];
  a_loop[s] = anim_flags[anim_id] & 1;
  a_lay[s] = nl;
  a_stride[s] = (u8)(nl + nl + nl + 2); /* 3L + 2, without multiplying */
  a_base[s] = anim_ofs[anim_id];
  a_cur[s] = a_base[s];
  a_anc[s] = anchor;

  anim_enter(s);
}

void anim_stop(void)
{
  u8 s;

  if (!a_init)
    return;
  for (s = 0; s < ANIM_SLOTS; s++)
    if (a_id[s] != 0xFF)
      anim_free(s, 1);
  a_fresh = 0;
}

u8 anim_busy(void)
{
  u8 s;

  if (!a_init)
    return 0;
  for (s = 0; s < ANIM_SLOTS; s++)
    if (a_id[s] != 0xFF && !a_loop[s])
      return 1;
  return 0;
}

/* 1 if EVERY still-allocated layer belongs to the player — a scripted
   vig_show on any one of them preempts the whole animation. */
static u8 anim_owns(u8 s)
{
  u8 l, vs;

  for (l = 0; l < ANIM_LAYERS_MAX; l++)
  {
    vs = A_VS(s, l);
    if (vs != 0xFF && !vig_is_anim(vs))
      return 0;
  }
  return 1;
}

void anim_update(void)
{
  u8 s;

  if (!a_init)
    return;
  for (s = 0; s < ANIM_SLOTS; s++)
  {
    if (a_id[s] == 0xFF)
      continue;
    if (!anim_owns(s))
    {
      anim_free(s, 0); /* preempted: let go without hiding anything */
      continue;
    }
    if (a_fresh & (1 << s))
    {
      a_fresh &= (u8)~(1 << s); /* frame just posed: it is entitled
                                   to its full duration */
      continue;
    }
    if (--a_timer[s])
      continue;

    a_frame[s]++;
    if (a_frame[s] >= a_n[s])
    {
      if (!a_loop[s])
      {
        anim_free(s, 1); /* the animation puts itself away, like vig_play 1 */
        continue;
      }
      a_frame[s] = 0;
      a_cur[s] = a_base[s];
    }
    else
      a_cur[s] += a_stride[s];
    anim_enter(s);
    a_fresh &= (u8)~(1 << s); /* frame change WITHIN the tick: the
                                 duration runs from the next frame */
  }
}
