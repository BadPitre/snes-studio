/*
 * vblnmi.c — the unified VBlank transfer dispatcher (V-NMI, V1).
 * Contract and rationale in vblnmi.h; the model's war stories in
 * docs/PLANNING_VBLANK_UNIFIE.md and vignette.c's H-bugfix comments.
 *
 * The walk is C for V1: the descriptor loads cost a handful of long
 * indirects per live entry, affordable where the ISR fires (~line
 * 227, the whole window ahead). The assembly walk (an extended
 * vram_burst) is planned with V3's per-entry vmain/ctrl — IF the
 * V-counter session says the C overhead matters. Measure, then move.
 */
#include <snes.h>
#include "vblnmi.h"
#include "vbudget.h"
#include "vramjob.h"

u8 vbl_fire_ok = 0;

/* The descriptor table. Parallel arrays, not a struct array: tcc-816
   indexes flat arrays far better than struct members (one long
   indirect per field either way, but no multiply on the index). All
   explicitly initialised — .bss is garbage (ENGINE_CONSTRAINTS 1.2).
   For a BURST descriptor (vn_kind 1) the fields are repurposed:
   vn_dst = vj_first, vn_len = vj_n, vn_stride = the $2115 mode. */
static const u8 *vn_src[VN_SLOTS];
static u16 vn_dst[VN_SLOTS] = { 0, 0, 0, 0, 0, 0 };
static u16 vn_len[VN_SLOTS] = { 0, 0, 0, 0, 0, 0 };
static u16 vn_stride[VN_SLOTS] = { 0, 0, 0, 0, 0, 0 };
static u8 vn_kind[VN_SLOTS] = { 0, 0, 0, 0, 0, 0 };
static u8 vn_count[VN_SLOTS] = { 0, 0, 0, 0, 0, 0 };
static u8 vn_cost[VN_SLOTS] = { 0, 0, 0, 0, 0, 0 };
static u8 vn_snap[VN_SLOTS] = { 0, 0, 0, 0, 0, 0 }; /* seq at publish */
static u8 vn_token[VN_SLOTS] = { 0, 0, 0, 0, 0, 0 };
static u8 vn_live[VN_SLOTS] = { 0, 0, 0, 0, 0, 0 }; /* producer seqs */

/* Where the beam stood after the ISR's last fire, and the highest it
   ever stood — the measurement hooks of the V-counter sessions (read
   from a savestate via the .sym), and tomorrow a debug-menu line.
   Caveat when reading them: a fire on a FORCED-BLANK frame (a wipe,
   a stage opening) legitimately lands past VBL_LAST — with the
   screen off the beam does not matter, but the max remembers it. */
u16 vn_v_in = 0;
u16 vn_v_last = 0;
u16 vn_v_max = 0;

void vn_publish(u8 i, const u8 *src, u16 dst, u16 len, u8 count,
                u16 stride, u8 cost)
{
  vn_token[i] = 0; /* close the gate while the fields move */
  vn_kind[i] = 0;
  vn_src[i] = src;
  vn_dst[i] = dst;
  vn_len[i] = len;
  vn_stride[i] = stride;
  vn_count[i] = count;
  vn_cost[i] = cost;
  vn_snap[i] = vn_live[i];
  vn_token[i] = 1; /* publication gate: LAST write */
}

void vn_publish_burst(u8 i, u16 first, u16 n, u16 vmain, u8 cost)
{
  vn_token[i] = 0;
  vn_kind[i] = 1;
  vn_dst[i] = first;
  vn_len[i] = n;
  vn_stride[i] = vmain;
  vn_count[i] = 1; /* atomic: the batch shape IS the saving */
  vn_cost[i] = cost;
  vn_snap[i] = vn_live[i];
  vn_token[i] = 1;
}

u8 vn_busy(u8 i) { return vn_token[i]; }
u8 vn_seq(u8 i) { return vn_live[i]; }

void vn_bump(u8 i)
{
  vn_live[i]++;
}

void vn_cancel(u8 i)
{
  vn_token[i] = 0;
}

/* The scene lanes die with the scene's display: called by every
   takeover that does not go through scene_load (stage open, picture
   show, world map) — vblnmi.h tells the corruption story. */
void vn_cancel_scene(void)
{
  vn_token[VN_MAPC] = 0;
  vn_token[VN_MAPR] = 0;
  vn_token[VN_TA] = 0;
}

/* Fires up to `budget` declared lines from slot i's descriptor,
   advancing it in place; clears the token when the count is done.
   Returns the lines spent. Shared by both lanes — the beam guard is
   the CALLER's business (cap for the ISR, take+probe for the tail). */
static u8 vn_fire(u8 i, u8 budget)
{
  u8 spent = 0;

  while (vn_count[i] && vn_cost[i] <= (u8)(budget - spent))
  {
    if (vn_kind[i])
    {
      /* vramjob burst: the vj_* globals are the dispatcher's SCRATCH
         since V3 — both lanes run with the other one excluded (the
         ISR by vbl_fire_ok, the tail by running after the NMI), so
         the singleton stopped being contended the day its two
         writers became one. */
      vj_first = vn_dst[i];
      vj_n = vn_len[i];
      vj_vmain = vn_stride[i];
      vj_ctrl = VJ_CTRL_VRAM;
      vram_burst();
      vn_count[i] = 0;
    }
    else
    {
      dmaCopyVram((u8 *)vn_src[i], vn_dst[i], vn_len[i]);
      vn_src[i] += vn_len[i];
      vn_dst[i] += vn_stride[i];
      vn_count[i]--;
    }
    spent += vn_cost[i];
  }
  if (vn_count[i] == 0)
    vn_token[i] = 0; /* consumed: the producer sees completion */
  return spent;
}

/* The ISR lane. Beam at ~line 227; no budget, no probe — the cap
   bounds the cost and vbl_open charges the ledger after us. */
void vbl_nmi(void)
{
  u8 i, left, fired;

  if (!vbl_fire_ok)
    return; /* tail or loader running: their DMAs own channel 0 */
  left = VN_ISR_CAP;
  fired = 0;
  for (i = 0; i < VN_SLOTS; i++)
  {
    if (!vn_token[i])
      continue;
    if (vn_snap[i] != vn_live[i])
    {
      vn_token[i] = 0; /* stale: the producer mutated underneath */
      continue;
    }
    if (!fired)
    {
      /* entry line, probed LAZILY: an idle NMI (most of them) pays
         the token walk and nothing else — the same boundary-flip
         arithmetic as bp_prep's fast path (PERF §8). */
      vbl_probe();
      vn_v_in = vbl_v;
    }
    left -= vn_fire(i, left);
    fired = 1;
    if (left < 3) /* below the cheapest row cost: done for this NMI */
      break;
  }
  if (fired)
  {
    vbl_probe();
    vn_v_last = vbl_v; /* nobody reads vbl_v while vbl_fire_ok is 1 */
    if (vbl_v > vn_v_max)
      vn_v_max = vbl_v;
  }
}

/* The tail lane: same table, under the arbiter — vbl_take keeps the
   sharing fair, the probe rejects what a drifted ledger would grant
   past the window (the beam does not drift). */
void vbl_nmi_tail(void)
{
  u8 i;

  for (i = 0; i < VN_SLOTS; i++)
  {
    if (!vn_token[i])
      continue;
    if (vn_snap[i] != vn_live[i])
    {
      vn_token[i] = 0;
      continue;
    }
    while (vn_count[i])
    {
      if (!vbl_take(vn_cost[i]))
        return; /* no room: the descriptor resumes next frame */
      vbl_probe();
      if (vbl_v >= VBL_LAST - vn_cost[i])
        return; /* the beam is past what the ledger believes */
      vn_fire(i, vn_cost[i]); /* exactly one sub-transfer */
    }
  }
}
