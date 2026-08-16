/*
 * actors.c — scene actors (NPCs).
 *
 * Everything comes from the scene's actor table: position in tiles,
 * sprite_id (the SLOT of a character block in the scene's sprite set —
 * datagen remaps the project's blocks onto local slots), direction. The
 * displayed frame is slot*12 + dir*3 (idle), the OBJ palette is the
 * slot. A 16x24 metasprite is 2 stacked 16x16 OBJs.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "camera.h"
#include "actors.h"
#include "player.h"
#include "vm.h"
#include "m7.h"

/* OAM: the player takes ids 0 and 4; actor i takes ids (2+2i)*4 (top)
   and (3+2i)*4 (bottom) — PVSnesLib OAM structure, id = object * 4 */
#define ACTOR_OAM_TOP(i) ((((u16)(i) << 1) + 2) << 2)
#define ACTOR_OAM_BOT(i) ((((u16)(i) << 1) + 3) << 2)
#define ACTOR_OBJ_PRIO 2

/* Idle frame of an actor: block*12 + dir*3. The direction lives in WRAM
   (FACE, turning towards the hero) — the ROM value is only the initial
   state. */
#define ACTOR_FRAME(a, d) ((u8)((a)->sprite_id * 12 + (d) * 3))

/* OAM slots reserved for actors (1..ACTOR_SLOTS) — the slots beyond the
   scene's actor count are hidden (leftovers from a more populated scene
   after a warp) */
#define ACTOR_SLOTS 24

/* Runtime directions (WRAM) — FACE and "turn towards the hero" */
u8 actor_dirs[ACTOR_SLOTS];

/* Active pages (v0.10): 1 = this entry is its event's active page.
   Recomputed on load and after every script (the switches may have
   changed) — see actors_resolve_pages(). */
u8 actor_active[ACTOR_SLOTS];

/* Moving NPCs (v0.11) — runtime state per slot. The ROM position (a
   tile) is only the starting point: the true position lives here, in px. */
u16 actor_px[ACTOR_SLOTS];
u16 actor_py[ACTOR_SLOTS];
u8 actor_step[ACTOR_SLOTS];  /* pixels left in the current step */
u8 actor_anim[ACTOR_SLOTS];  /* walk frame 0-3 (like the player) */
/* CH2 — the draw gates (actorsfast.asm, actor_frame_m7) show the walk
   step when actor_step != 0 OR this byte says so: it is 1 only for a
   STEPPING-IDLE charset (scn_aidle), so a scene without any costs
   nothing. Non-static: the assembly reads it. */
u8 actor_show_step[ACTOR_SLOTS];
/* countdown to the next anim phase: pixels while walking, display
   frames while standing on a stepping idle — scn_aspd either way */
static u8 actor_stepct[ACTOR_SLOTS];
static u8 actor_timer[ACTOR_SLOTS]; /* frames before the next decision */
static u16 mv_seed;                 /* 16-bit xorshift (randomness) */
static u8 mv_phase;                 /* NPC speed: 1 px every other frame */

/* Routes (v0.12) — the route lives in the scene's script block, the slot
   only keeps a cursor. 0xFFFF = no route. */
static u16 route_ofs[ACTOR_SLOTS];
static u8 route_pos[ACTOR_SLOTS];
static u8 route_len[ACTOR_SLOTS];
static u8 route_flags[ACTOR_SLOTS];
static u8 route_wait[ACTOR_SLOTS];

/* Move Route attributes (v0.13): speed 1-4 (0.5/1/2/4 px per frame),
   frequency 1-8 (pause between route steps), fixed direction,
   through-walls, changed graphic (0xFF = the page's). */
static u8 actor_speed[ACTOR_SLOTS];
static u8 actor_freq[ACTOR_SLOTS];
static u8 actor_dirfix[ACTOR_SLOTS];
static u8 actor_mvdir[ACTOR_SLOTS]; /* direction of the current step (dirfix) */
static u8 actor_thru[ACTOR_SLOTS];
u8 actor_gfx[ACTOR_SLOTS];
u8 actor_prio[ACTOR_SLOTS]; /* ACTOR_PRIO_* (v0.14) */

/* ---- WRAM copy of the hot path's ROM fields (P3) ----
 * actors_update and actors_draw used to re-read the type, the
 * appearance and the movement type from the actor table for every actor
 * on every frame — a structure in ROM, so far accesses, the slowest
 * ones on the 65816. Those fields are CONSTANT for a slot (a slot is
 * one event page): they are copied once when the scene loads.
 * actor_fbase also avoids the multiplication by 12 (the 65816 has none:
 * tcc-816 calls a routine) that was redone every frame to place the
 * metasprite's frame. */
u8 actor_sprite[ACTOR_SLOTS]; /* sprite_id, 0xFF = invisible */
static u8 actor_kind[ACTOR_SLOTS];   /* actor_type */
static u8 actor_movet[ACTOR_SLOTS];  /* movement type (flags) */
u8 actor_fbase[ACTOR_SLOTS];  /* sprite_id * 12: frame base */
u8 actor_shown[ACTOR_SLOTS];  /* OBJ currently visible? */
/* Words 1 and 3 of the OAM entry pair (tile number + attribute): they
   depend ONLY on the displayed frame, the palette and the priority.
   Recomputing them every frame cost more than all the rest of the loop
   put together (measured: without the OAM write, ten NPCs hold 60 fps).
   The validity key is the frame itself — no need to invalidate by hand
   when an NPC turns or walks. */
u8 actor_lastf[ACTOR_SLOTS];
u8 actor_x9[ACTOR_SLOTS];   /* 9th bit of X set in table 2 */
u16 actor_w1[ACTOR_SLOTS];
u16 actor_w3[ACTOR_SLOTS];

static u16 mv_rand(void)
{
  mv_seed ^= mv_seed << 7;
  mv_seed ^= mv_seed >> 9;
  mv_seed ^= mv_seed << 8;
  return mv_seed;
}

/* Runtime tile of a slot (centre of the body, like the player) */
#define ACTOR_TX(i) ((u8)((actor_px[i] + 8) >> 4))
#define ACTOR_TY(i) ((u8)((actor_py[i] + 8) >> 4))

/* ---- precomputed blocking tiles (collision hot path) ----
 * The player's tile_blocked() queries actor_at_tile ~10 times per frame
 * while walking; iterating the ActorDefs on every call cost the whole
 * frame on a scene with pages (1 def PER page: 7 defs = 60 -> 30 fps,
 * measured on the harness through lag_frame_counter). The list of
 * blocking NPCs (active, priority "like the hero") is rebuilt ONCE per
 * frame (at the end of actors_update) and after every event that can
 * change it (resolve_pages, set_pos, swap_pos); actor_at_tile then comes
 * down to a bounding-box rejection plus a scan of small u8 arrays.
 * EXPLICIT init: tcc-816 does not clear the BSS. */
#define BLK_MAX (ACTOR_SLOTS + 8) /* + NPCs frozen beyond the slots */
static u8 blk_n = 0;
static u8 blk_ovf = 0; /* list full: fall back to the exact walk */
static u8 blk_tx[BLK_MAX];
static u8 blk_ty[BLK_MAX];
static u8 blk_id[BLK_MAX];
static u8 blk_x0 = 255, blk_x1 = 0, blk_y0 = 255, blk_y1 = 0;

static void actors_rebuild_blockers(void)
{
  u8 i, x, y;
  u8 k = 0;
  u8 n = scene_ctx.actor_count; /* far struct: read ONCE */

  blk_x0 = 255;
  blk_x1 = 0;
  blk_y0 = 255;
  blk_y1 = 0;
  blk_ovf = 0;
  for (i = 0; i < n; i++)
  {
    if (i < ACTOR_SLOTS)
    {
      if (!actor_active[i] || actor_prio[i] != ACTOR_PRIO_SAME)
        continue;
      if (actor_kind[i] != ACTOR_TYPE_NPC_STATIC)
        continue; /* WRAM copy (P3): no far read here */
      x = ACTOR_TX(i);
      y = ACTOR_TY(i);
    }
    else
    {
      /* beyond the slots: the NPC is frozen at its editing position */
      const ActorDef *a = &scene_ctx.actors[i];

      if (a->actor_type != ACTOR_TYPE_NPC_STATIC)
        continue;
      x = a->x;
      y = a->y;
    }
    if (k >= BLK_MAX)
    {
      blk_ovf = 1; /* pathological — correctness over speed */
      break;
    }
    blk_tx[k] = x;
    blk_ty[k] = y;
    blk_id[k] = i;
    k++;
    if (x < blk_x0)
      blk_x0 = x;
    if (x > blk_x1)
      blk_x1 = x;
    if (y < blk_y0)
      blk_y0 = y;
    if (y > blk_y1)
      blk_y1 = y;
  }
  blk_n = k;
}

/* Does this page's condition pass? */
static u8 page_cond_ok(const ActorDef *a)
{
  switch (a->flags & ACTOR_COND_MASK)
  {
  case ACTOR_COND_SW_ON:
    return vm_switch_get(a->cond_idx);
  case ACTOR_COND_SW_OFF:
    return !vm_switch_get(a->cond_idx);
  case ACTOR_COND_VAR_GEQ:
    return vm.vars16[a->cond_idx & 255] >= a->cond_val;
  default:
    return 1;
  }
}

/* A page's custom route (v0.14): a [flags][freq][len][steps...] blob at
   route_ofs in the script block — applied when the page becomes active
   (movement type "Custom route"). */
static void actors_apply_page_route(u8 i)
{
  const ActorDef *a = &scene_ctx.actors[i];
  u16 ofs;

  if (((a->flags & ACTOR_MOVE_MASK) >> ACTOR_MOVE_SHIFT) != ACTOR_MOVE_CUSTOM)
    return;
  ofs = a->route_ofs;
  if (ofs == 0xFFFF)
    return;
  actor_freq[i] = scene_ctx.scripts[ofs + 1];
  if (actor_freq[i] < 1 || actor_freq[i] > 8)
    actor_freq[i] = 3;
  actors_set_route(i, (u16)(ofs + 3), scene_ctx.scripts[ofs],
                   scene_ctx.scripts[ofs + 2]);
}

/* Within a GROUP of pages (consecutive entries linked by CONTINUATION),
   the LAST page whose condition passes is the active one — the RM2003
   model (the highest-numbered page wins). The OBJs of deactivated pages
   are hidden here (actors_draw only touches active pages). */
void actors_resolve_pages(void)
{
  u8 i, j, start, win;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < scene_ctx.actor_count && i < ACTOR_SLOTS; i = j)
  {
    start = i;
    win = 255;
    for (j = start;
         j < scene_ctx.actor_count && j < ACTOR_SLOTS &&
         (j == start || (a[j].flags & ACTOR_FLAG_CONT));
         j++)
    {
      if (page_cond_ok(&a[j]))
        win = j;
    }
    for (i = start; i < j; i++)
    {
      if (actor_active[i] && i != win)
      {
        oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
        oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
        actor_shown[i] = 0; /* the OBJ is hidden: actors_draw knows */
        actor_lastf[i] = 0xFF; /* palette/priority to recompute */
        actor_x9[i] = 0xFF;
        route_ofs[i] = 0xFFFF; /* the page goes, so does its route */
      }
      if (i == win && !actor_active[i])
      {
        actor_active[i] = 1;
        actors_apply_page_route(i); /* custom route of the page (v0.14) */
      }
      else
        actor_active[i] = (i == win);
    }
  }
  actors_rebuild_blockers(); /* the active pages may have changed */
}

/* Appearance: sprite_id 0xFF = invisible. A contact/autorun event CAN
   have an appearance (a visible chest…) — it stays walkable, "under the
   hero" as in RM2003. */
#define ACTOR_VISIBLE(a) ((a)->sprite_id != 0xFF)

void actors_init(void)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  /* Seed of the NPC wandering. The .bss is NOT cleared by this
     toolchain: without this line mv_seed started on whatever was lying
     around in WRAM. Deterministic for a given binary — so invisible —
     but it CHANGES as soon as the memory layout moves, so an unrelated
     code change altered how the NPCs strolled. Two versions of a
     populated scene became incomparable: that cost me a false diagnosis
     during P4. A non-zero constant is enough (xorshift stays stuck on
     zero). */
  mv_seed = 0x2A69;

  for (i = 0; i < ACTOR_SLOTS; i++)
  {
    oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
    oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
    actor_dirs[i] = DIR_DOWN;
    actor_active[i] = 0;
    actor_px[i] = 0;
    actor_py[i] = 0;
    actor_step[i] = 0;
    actor_anim[i] = 0;
    actor_show_step[i] = 0;
    actor_stepct[i] = 8;
    actor_timer[i] = (u8)(20 + i * 13); /* staggers the decisions */
    route_ofs[i] = 0xFFFF;
    route_pos[i] = 0;
    route_len[i] = 0;
    route_flags[i] = 0;
    route_wait[i] = 0;
    actor_speed[i] = 1;  /* 0.5 px/frame — the v0.11 speed */
    actor_freq[i] = 3;   /* RM2003 default */
    actor_dirfix[i] = 0;
    actor_thru[i] = 0;
    actor_gfx[i] = 0xFF;
    actor_mvdir[i] = DIR_DOWN;
    actor_prio[i] = ACTOR_PRIO_SAME;
    actor_sprite[i] = 0xFF;
    actor_kind[i] = 0xFF;
    actor_movet[i] = ACTOR_MOVE_STATIC;
    actor_fbase[i] = 0;
    actor_shown[i] = 0;
    actor_lastf[i] = 0xFF;
    actor_x9[i] = 0xFF; /* invalid: forces the first write */
  }
  mv_seed = 0xACE1; /* never 0 (xorshift) — EXPLICIT init (tcc) */
  mv_phase = 0;
  actors_resolve_pages();

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    if (i < ACTOR_SLOTS)
    {
      actor_dirs[i] = a->direction;
      actor_px[i] = (u16)a->x << 4;
      actor_py[i] = (u16)a->y << 4;
      actor_prio[i] = a->prio_speed & 3;
      if ((a->prio_speed >> 4) >= 1 && (a->prio_speed >> 4) <= 4)
        actor_speed[i] = a->prio_speed >> 4;
      /* WRAM copy of the hot path (P3): these fields no longer move */
      actor_sprite[i] = a->sprite_id;
      actor_kind[i] = a->actor_type;
      actor_movet[i] = (a->flags & ACTOR_MOVE_MASK) >> ACTOR_MOVE_SHIFT;
      actor_fbase[i] = (u8)(a->sprite_id * 12);
    }
    if (!ACTOR_VISIBLE(a))
      continue;
    oamSet(ACTOR_OAM_TOP(i), 0, 240, ACTOR_OBJ_PRIO, 0, 0,
           OBJ_TOP_TILE(ACTOR_FRAME(a, a->direction)), a->sprite_id);
    oamSet(ACTOR_OAM_BOT(i), 0, 240, ACTOR_OBJ_PRIO, 0, 0,
           OBJ_BOTTOM_TILE(ACTOR_FRAME(a, a->direction)), a->sprite_id);
    /* oamSetEx ONLY ONCE here: it rewrites the pair of bits in OAM table
       2 (size + 9th bit of X). Calling it after oamSet on every frame
       would clobber the 9th bit of X that oamSet set, and a sprite partly
       off screen on the left (negative X) would reappear on the right. */
    oamSetEx(ACTOR_OAM_TOP(i), OBJ_SMALL, OBJ_SHOW);
    oamSetEx(ACTOR_OAM_BOT(i), OBJ_SMALL, OBJ_SHOW);
    oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
    oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
  }
  /* The resolve_pages above built the blocker list BEFORE this loop laid
     down the positions and priorities: it therefore has to be redone
     here. As long as actors_update rebuilt it every frame, the mistake
     corrected itself on the following frame. */
  actors_rebuild_blockers();
}

/* ---- interface with the assembly loop (actorsfast.asm, P4) ----
   The hot loop lives in 65816: at 24 visible NPCs it cost 244 screen
   lines out of 262, that is the whole frame (measured with the V
   counter). Hiding stays HERE: it only happens on the TRANSITION off
   screen, so never in steady state, and it goes through oamSetVisible. */
u8 actors_hot_n;                     /* slots to process */
u8 actors_hide_n;                    /* actors that left the field */
u8 actors_hide_list[ACTOR_SLOTS];
extern void actors_draw_hot(void);

/* The arrays above have lost their `static`: the hot loop is written in
   65816 (actorsfast.asm, P4) and tcc-816 prefixes static symbols with
   the file name — the assembly could not name them. They stay strictly
   internal to the module. */

/* ---- writing an actor's OBJ pair directly (P3) ----
 * oamSet takes eight arguments: under tcc-816, LAYING those arguments
 * costs more than the work itself (~125 instructions per call, two calls
 * per actor per frame — measured with the scanline counter). Here we
 * write the two entries of the shadow OAM ourselves (the NMI transfers
 * it) in a single call.
 * OAM table 2: 2 bits per object, bit 0 = the 9th bit of X (essential
 * for a sprite hanging off the left: negative X), bit 1 = size, which we
 * do NOT touch (set once by oamSetEx). The two OBJs of a metasprite are
 * consecutive and share X, so their two bits fall in the same byte — a
 * single read-modify-write.
 * Byte 3: vhoopppN (priority, palette, 9th bit of the tile number). */
static void actor_oam_pair(u16 id, u16 sx, u16 sy, u8 f, u8 op, u8 pal)
{
  u16 tile = OBJ_TOP_TILE(f);
  u16 attr = ((u16)pal << 1) | ((u16)op << 4);
  u8 *hi = &oamMemory[512 + (id >> 4)];
  /* Two OAM entries = four words. Writing in 16 bits avoids eight 8-bit
     writes AND the sep/rep switches that tcc-816 inserts around every
     operation on a u8 (P3). The OAM is little-endian: word 0 = X | Y<<8,
     word 1 = tile low | attribute<<8. */
  u16 *o = (u16 *)&oamMemory[id];
  u16 x8 = sx & 0xFF;
  u16 y8 = sy & 0xFF;

  o[0] = x8 | (y8 << 8);
  o[1] = (tile & 0xFF) | ((attr | (tile >> 8)) << 8);
  tile += 32; /* OBJ_BOTTOM_TILE: the row below */
  o[2] = x8 | (((y8 + 16) & 0xFF) << 8);
  o[3] = (tile & 0xFF) | ((attr | (tile >> 8)) << 8);

  /* 9th bit of X: the two OBJs share the same value */
  if (((id >> 2) & 3) == 0)
  {
    if (sx & 0x100)
      *hi |= 0x05;
    else
      *hi &= (u8)~0x05;
  }
  else
  {
    if (sx & 0x100)
      *hi |= 0x50;
    else
      *hi &= (u8)~0x50;
  }
}

void actors_draw(void)
{
  u8 i, ns;
  u16 ax, ay;
  /* invariants hoisted out of the loop (P3): scene_ctx and camera are
     structures — tcc-816 recomputes a long address on EVERY read. */
  u8 n = scene_ctx.actor_count;
  u16 cx = camera.x;
  u16 cy = camera.y;
  u16 cx_max = cx + 256;
  u16 cy_max = cy + 224 + SPRITE_Y_OVERLAP;

  ns = (n > ACTOR_SLOTS) ? ACTOR_SLOTS : n;

  /* HOT loop: in assembly (P4) — see actorsfast.asm for the detail of
     the measurement that justified it. */
  actors_hot_n = ns;
  /* CLEARED HERE, not in the assembly: its early exit (no slot to
     process) jumped over its own reset, and on the very first call
     actors_hide_n held the uninitialised .bss pattern (0x55 = 85). The
     loop below then walked 85 entries of a list that holds 24, and wrote
     actor_shown/actor_x9 AT INDICES OUT OF THE ARRAYS — engine memory
     corrupted in silence. */
  actors_hide_n = 0;
  actors_draw_hot();
  if (actors_hide_n > ACTOR_SLOTS)
    actors_hide_n = ACTOR_SLOTS; /* guard: never outside the array */
  for (i = 0; i < actors_hide_n; i++)
  {
    u8 k = actors_hide_list[i];

    /* the OAM is only touched at the moment the actor LEAVES the field:
       rewriting "hidden" every frame for NPCs nobody can see was most of
       the price of a populated scene (P3). */
    oamSetVisible(ACTOR_OAM_TOP(k), OBJ_HIDE);
    oamSetVisible(ACTOR_OAM_BOT(k), OBJ_HIDE);
    actor_shown[k] = 0;
    actor_x9[k] = 0xFF; /* oamSetVisible moved the OBJ: cache dead */
  }

  /* COLD tail: the NPCs beyond the slots are frozen at their editing
     position — everything comes from ROM, there is no runtime state. */
  for (i = ACTOR_SLOTS; i < n; i++)
  {
    const ActorDef *a = &scene_ctx.actors[i];

    if (!ACTOR_VISIBLE(a))
      continue;
    ax = (u16)a->x << 4;
    ay = (u16)a->y << 4;
    if (ax + 16 > cx && ax < cx_max && ay + 16 > cy && ay < cy_max)
      actor_oam_pair(ACTOR_OAM_TOP(i), ax - cx, ay - cy - SPRITE_Y_OVERLAP,
                     ACTOR_FRAME(a, a->direction), ACTOR_OBJ_PRIO,
                     a->sprite_id);
    else
    {
      oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
      oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
    }
  }
}

/* ---- WORLD MAP (Mode 7): the same actors, projected -----------------
 *
 * On a pitched plane a sprite's screen position is not "its position
 * minus the camera" any more: the ground is a perspective, so an NPC
 * standing two tiles north of the hero is drawn HIGHER AND NARROWER in.
 * m7_project inverts the PPU's transform to say where — two divisions
 * and four multiplications per NPC.
 *
 * That is why this loop has a BUDGET. The whole point of P4 was that the
 * ordinary draw loop had to leave C to fit the frame; this one does
 * strictly more work per actor, so running it over 24 slots cannot fit
 * either. Instead it projects M7_ACT_BUDGET actors per frame and takes
 * the next ones on the frame after, round robin. The OAM entries of the
 * actors NOT reached this frame are left exactly as they were, so
 * nothing flickers: they simply hold still a moment longer.
 *
 * WHERE THE NUMBER COMES FROM (V counter, 24 NPCs all on screen around
 * the hero, world map of the test project, budget swept 0..24):
 *      budget  0 : 498 loop turns in 900 frames,   2 lines
 *      budget  1 : 498 turns,                     34 lines
 *      budget  3 : 498 turns,                     98 lines   <- the edge
 *      budget  4 : 272 turns,                    131 lines
 *      budget  5 : 249 turns,                    162 lines
 *      budget  6 : 249 turns,                    194 lines
 * 498 turns is 60 fps; 249 is 30. So one projected NPC costs ~32 screen
 * lines and the frame has room for three. Splitting it further (the
 * projection stubbed out) gives ~19 lines of arithmetic and ~13 of OAM
 * write per NPC: the two divisions are the price, and an assembly
 * rewrite is the only thing that would move it.
 *
 * An INACTIVE slot costs nothing and does not spend budget, so a map
 * with 24 slots but four live NPCs refreshes all four every frame; the
 * cap only bites when a crowd is actually on screen, and then an NPC
 * lags by up to ceil(live / 3) frames — at half a pixel per frame, a few
 * pixels of stagger on a distant character.
 *
 * Two limits worth stating rather than hiding:
 *  - NO SCALING. The SNES cannot scale a sprite, so a distant NPC is a
 *    full-size character standing on the horizon. Mode 7 games solved
 *    this with several sizes of the same sprite; that is art, not code.
 *  - NO DEPTH ORDER. OBJ priority is the OAM index, and reordering the
 *    OAM per frame costs more than the projection itself, so a far NPC
 *    can be drawn over a near one. */
#define M7_ACT_BUDGET 3
static u8 m7_act_cur; /* round-robin cursor over the slots */

/* Frame of a slot, the same rule as the assembly hot loop: the page's
   base (or a Change Graphic override), plus direction, plus the walk
   step on the odd anim phases. */
static u8 actor_frame_m7(u8 i)
{
  u8 g = actor_gfx[i];
  u8 f = (g == 0xFF) ? actor_fbase[i] : (u8)(g * 12);

  f = (u8)(f + actor_dirs[i] * 3);
  if ((actor_step[i] || actor_show_step[i]) && (actor_anim[i] & 1))
    f = (u8)(f + (actor_anim[i] >> 1) + 1);
  return f;
}

static void actor_m7_hide(u8 i)
{
  if (!actor_shown[i])
    return;
  oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
  oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
  actor_shown[i] = 0;
  actor_x9[i] = 0xFF;
}

/* Opening a world map hid all 128 OBJs: the caches that say "this actor
   is already showing frame F at this side of the screen" are lies from
   that moment on. Same reason as player_draw_reset. */
void actors_draw_reset(void)
{
  u8 i;

  for (i = 0; i < ACTOR_SLOTS; i++)
  {
    actor_shown[i] = 0;
    actor_lastf[i] = 0xFF;
    actor_x9[i] = 0xFF;
  }
  m7_act_cur = 0;
}

void actors_draw_m7(void)
{
  u8 n = scene_ctx.actor_count;
  u8 ns = (n > ACTOR_SLOTS) ? ACTOR_SLOTS : n;
  u8 seen, i, b;

  if (!ns)
    return;
  b = M7_ACT_BUDGET;
  /* `seen` bounds the SCAN, `b` the WORK: skipping a dead slot costs a
     byte read, so it does not eat the budget, but the loop still stops
     after one lap whatever happens. */
  for (seen = 0; b && seen < ns; seen++)
  {
    if (m7_act_cur >= ns)
      m7_act_cur = 0;
    i = m7_act_cur;
    m7_act_cur++;

    if (!actor_active[i] || actor_sprite[i] == 0xFF)
    {
      actor_m7_hide(i);
      continue;
    }
    b--;
    /* the CENTRE of the body, which is what lands on the anchor line —
       the same point m7_world_track feeds for the hero */
    if (!m7_project(actor_px[i] + 8, actor_py[i] + 8))
    {
      actor_m7_hide(i);
      continue;
    }
    actor_oam_pair(ACTOR_OAM_TOP(i), (u16)(m7_pjx - 8), (u16)(m7_pjy - 16),
                   actor_frame_m7(i), ACTOR_OBJ_PRIO, actor_sprite[i]);
    actor_shown[i] = 1;
    /* the pair writes both caches' inputs itself, so both are stale for
       the assembly loop that takes over when the map closes */
    actor_lastf[i] = 0xFF;
    actor_x9[i] = 0xFF;
  }
}

static u8 mv_blocked(u8 i, u8 tx, u8 ty, u8 d)
{
  u8 j;

  if (tx >= scene_ctx.map_w || ty >= scene_ctx.map_h)
    return 1;
  if (actor_thru[i])
    return 0; /* through-walls (Through ON): only the map edge blocks */
  if (COL_TYPE(scene_collision(tx, ty)) == COL_SOLID)
    return 1;
  /* closed sides (T1): leaving the current tile through d, or entering
     the target through the opposite side (d ^ 1) */
  if (COL_SIDES(scene_collision(ACTOR_TX(i), ACTOR_TY(i))) & (u8)(1 << d))
    return 1;
  if (COL_SIDES(scene_collision(tx, ty)) & (u8)(1 << (d ^ 1)))
    return 1;
  /* the hero's tile — an event under/above the hero lets you through */
  if (actor_prio[i] == ACTOR_PRIO_SAME &&
      tx == (u8)((player.x + 8) >> 4) && ty == (u8)((player.y + 8) >> 4))
    return 1;
  /* the other active actors that are "like the hero" */
  for (j = 0; j < scene_ctx.actor_count && j < ACTOR_SLOTS; j++)
  {
    if (j != i && actor_active[j] && actor_prio[j] == ACTOR_PRIO_SAME &&
        ACTOR_TX(j) == tx && ACTOR_TY(j) == ty)
      return 1;
  }
  return 0;
}

/* Delta of a direction (dx, dy in tiles) */
static const s8 mv_dx[4] = {0, 0, -1, 1};
static const s8 mv_dy[4] = {1, -1, 0, 0};

/* Starts a route (ROUTE opcode, v0.12). ofs points at the STEPS in the
   script block. Replaces the slot's current route if it has one. */
void actors_set_route(u8 index, u16 ofs, u8 flags, u8 len)
{
  if (index >= ACTOR_SLOTS || index >= scene_ctx.actor_count || len == 0)
    return;
  actor_step[index] = 0; /* cuts the wandering step in progress */
  route_ofs[index] = ofs;
  route_pos[index] = 0;
  route_len[index] = len;
  route_flags[index] = flags;
  route_wait[index] = 0;
}

/* Places the actor on a tile (SETPOS opcode) — cuts the step in progress
   so as not to leave a move half done. */
void actors_set_pos(u8 index, u8 tx, u8 ty)
{
  if (index >= ACTOR_SLOTS || index >= scene_ctx.actor_count)
    return;
  actor_px[index] = (u16)tx << 4;
  actor_py[index] = (u16)ty << 4;
  actor_step[index] = 0;
  actors_rebuild_blockers(); /* teleport: the list must follow */
}

/* Swaps the positions of two actors (SWAPPOS opcode). */
void actors_swap_pos(u8 a, u8 b)
{
  u16 t;

  if (a >= ACTOR_SLOTS || b >= ACTOR_SLOTS || a >= scene_ctx.actor_count ||
      b >= scene_ctx.actor_count)
    return;
  t = actor_px[a];
  actor_px[a] = actor_px[b];
  actor_px[b] = t;
  t = actor_py[a];
  actor_py[a] = actor_py[b];
  actor_py[b] = t;
  actor_step[a] = 0;
  actor_step[b] = 0;
  actors_rebuild_blockers(); /* teleport: the list must follow */
}

/* Frequency 1-8 of the slot (set by the ROUTE opcode before set_route) */
static u8 route_freq_pending;

void actors_route_freq(u8 freq)
{
  route_freq_pending = (freq >= 1 && freq <= 8) ? freq : 3;
}

void actors_route_bind_freq(u8 index)
{
  if (index < ACTOR_SLOTS)
    actor_freq[index] = route_freq_pending;
}

/* 1 if a NON-repeating route is still running (WAITROUTE) — repeating
   routes run forever, we do not wait for them. */
u8 actors_routes_busy(void)
{
  u8 i;

  for (i = 0; i < ACTOR_SLOTS; i++)
  {
    if (route_ofs[i] != 0xFFFF && !(route_flags[i] & ROUTE_FLAG_REPEAT))
      return 1;
  }
  return 0;
}

/* Turn towards the hero (FACEP step and interactions) */
static u8 dir_toward_player(u8 i)
{
  u16 dx = player.x > actor_px[i] ? player.x - actor_px[i]
                                  : actor_px[i] - player.x;
  u16 dy = player.y > actor_py[i] ? player.y - actor_py[i]
                                  : actor_py[i] - player.y;

  if (dx > dy)
    return player.x > actor_px[i] ? DIR_RIGHT : DIR_LEFT;
  return player.y > actor_py[i] ? DIR_DOWN : DIR_UP;
}

/* 90 degree rotations (indices DIR_DOWN=0 UP=1 LEFT=2 RIGHT=3):
   clockwise 0->2->1->3->0, anticlockwise the other way. */
static const u8 dir_cw[4] = {2, 3, 1, 0};
static const u8 dir_ccw[4] = {3, 2, 0, 1};

/* Advances the slot's route by one notch (at most one step per call). */
static void route_tick(u8 i)
{
  u8 step, d, tx, ty, adv;

  if (actor_step[i])
    return; /* a walking step is running: let it finish */
  if (route_wait[i])
  {
    route_wait[i]--;
    return;
  }
  if (route_pos[i] >= route_len[i])
  {
    if (route_flags[i] & ROUTE_FLAG_REPEAT)
      route_pos[i] = 0;
    else
    {
      route_ofs[i] = 0xFFFF; /* done */
      return;
    }
  }
  step = scene_ctx.scripts[route_ofs[i] + route_pos[i]];
  adv = 1;
  d = actor_dirs[i];

  if ((step & 0xF0) == ROUTE_STEP_WAITN)
  {
    route_wait[i] = (u8)((step & 0x0F) << 3);
    route_pos[i]++;
    return;
  }
  switch (step)
  {
  case ROUTE_STEP_MRAND:
    d = (u8)(mv_rand() & 3);
    goto marche;
  case ROUTE_STEP_MHERO:
    d = dir_toward_player(i);
    goto marche;
  case ROUTE_STEP_MFLEE:
    d = dir_toward_player(i) ^ 1;
    goto marche;
  case ROUTE_STEP_FWD:
    goto marche;
  case ROUTE_STEP_T90R:
    d = dir_cw[d];
    goto tourne;
  case ROUTE_STEP_T90L:
    d = dir_ccw[d];
    goto tourne;
  case ROUTE_STEP_T180:
    d = d ^ 1;
    goto tourne;
  case ROUTE_STEP_T90X:
    d = (mv_rand() & 1) ? dir_cw[d] : dir_ccw[d];
    goto tourne;
  case ROUTE_STEP_TRAND:
    d = (u8)(mv_rand() & 3);
    goto tourne;
  case ROUTE_STEP_FACEP:
    d = dir_toward_player(i);
    goto tourne;
  case ROUTE_STEP_TFLEE:
    d = dir_toward_player(i) ^ 1;
    goto tourne;
  case ROUTE_STEP_SPDUP:
    if (actor_speed[i] < 4)
      actor_speed[i]++;
    goto fini;
  case ROUTE_STEP_SPDDN:
    if (actor_speed[i] > 1)
      actor_speed[i]--;
    goto fini;
  case ROUTE_STEP_FRQUP:
    if (actor_freq[i] < 8)
      actor_freq[i]++;
    goto fini;
  case ROUTE_STEP_FRQDN:
    if (actor_freq[i] > 1)
      actor_freq[i]--;
    goto fini;
  case ROUTE_STEP_FIXON:
    actor_dirfix[i] = 1;
    goto fini;
  case ROUTE_STEP_FIXOFF:
    actor_dirfix[i] = 0;
    goto fini;
  case ROUTE_STEP_THRUON:
    actor_thru[i] = 1;
    goto fini;
  case ROUTE_STEP_THRUOFF:
    actor_thru[i] = 0;
    goto fini;
  case ROUTE_STEP_SWON:
  case ROUTE_STEP_SWOFF:
    vm_switch_set((u16)scene_ctx.scripts[route_ofs[i] + route_pos[i] + 1] |
                      ((u16)scene_ctx.scripts[route_ofs[i] + route_pos[i] + 2]
                       << 8),
                  step == ROUTE_STEP_SWON);
    adv = 3;
    goto fini;
  case ROUTE_STEP_GFX:
    actor_gfx[i] = scene_ctx.scripts[route_ofs[i] + route_pos[i] + 1];
    adv = 2;
    goto fini;
  default:
    if ((step & 0xF0) == ROUTE_STEP_TURN)
    {
      d = step & 3;
      goto tourne;
    }
    d = step & 3; /* 0x00-0x03: walk */
    goto marche;
  }

tourne:
  if (!actor_dirfix[i])
    actor_dirs[i] = d;
  goto fini;

marche:
  tx = (u8)(ACTOR_TX(i) + mv_dx[d]);
  ty = (u8)(ACTOR_TY(i) + mv_dy[d]);
  if (mv_blocked(i, tx, ty, d))
  {
    if (!actor_dirfix[i])
      actor_dirs[i] = d; /* we turn anyway (RM2003 model) */
    if (route_flags[i] & ROUTE_FLAG_SKIP)
      route_pos[i] += adv; /* "ignore if blocked": next step */
    return; /* otherwise: retry while it is blocked */
  }
  if (!actor_dirfix[i])
    actor_dirs[i] = d;
  actor_mvdir[i] = d; /* REAL direction of the move (dirfix) */
  actor_step[i] = 16;
  route_pos[i] += adv;
  /* frequency pause AFTER a walking step (1 = slow, 8 = back to back) */
  route_wait[i] = (u8)((8 - actor_freq[i]) << 2);
  return;

fini:
  route_pos[i] += adv;
}

/* NPC movement (v0.11/v0.12) — called every frame by the main loop.
   ROUTES also advance during scripts (they are the cutscene engine);
   wandering (move_type) stays frozen during scripts, and everything
   stops in the System menu.
   Speed: 1 px every other frame (half the hero's). */
void actors_update(void)
{
  u8 i, d, tx, ty, mt;
  u8 frozen = vm_active();
  u8 moved = 0; /* has an actor changed position this frame? */
  u8 n = scene_ctx.actor_count; /* far struct: read ONCE (P3) */

  if (n > ACTOR_SLOTS)
    n = ACTOR_SLOTS;
  mv_phase ^= 1;

  for (i = 0; i < n; i++)
  {
    /* everything in WRAM (P3): not a single ROM read per actor per frame
       any more — the type and the movement are copied at load time */
    if (!actor_active[i])
      continue;
    if (actor_kind[i] != ACTOR_TYPE_NPC_STATIC)
      continue;

    /* a route takes priority over wandering */
    if (route_ofs[i] != 0xFFFF)
      route_tick(i);

    mt = actor_movet[i];
    if (route_ofs[i] == 0xFFFF && (mt == ACTOR_MOVE_STATIC || frozen))
    {
      /* neither route nor wandering: finish the current step if any */
      if (!actor_step[i])
        continue;
    }
    else if (route_ofs[i] == 0xFFFF && !actor_step[i])
    {
      /* wandering (v0.11): the decision */
      if (actor_timer[i])
      {
        actor_timer[i]--;
        continue;
      }
      if (mt == ACTOR_MOVE_RANDOM)
      {
        d = (u8)(mv_rand() & 3);
        actor_timer[i] = (u8)(64 + (mv_rand() & 127));
      }
      else
      {
        d = actor_dirs[i];
        if (mt == ACTOR_MOVE_VERT && d != DIR_DOWN && d != DIR_UP)
          d = DIR_DOWN;
        if (mt == ACTOR_MOVE_HORIZ && d != DIR_LEFT && d != DIR_RIGHT)
          d = DIR_RIGHT;
        actor_timer[i] = 16;
      }
      tx = (u8)(ACTOR_TX(i) + mv_dx[d]);
      ty = (u8)(ACTOR_TY(i) + mv_dy[d]);
      if (mv_blocked(i, tx, ty, d))
      {
        if (mt != ACTOR_MOVE_RANDOM && !actor_dirfix[i])
          actor_dirs[i] = d ^ 1; /* about turn */
        continue;
      }
      if (!actor_dirfix[i])
        actor_dirs[i] = d;
      actor_mvdir[i] = d;
      actor_step[i] = 16;
    }

    if (actor_step[i])
    {
      /* step in progress — speed 1-4: 0.5 / 1 / 2 / 4 px per frame */
      u8 px = actor_speed[i] == 1 ? (mv_phase ? 1 : 0)
              : actor_speed[i] == 2 ? 1
              : actor_speed[i] == 3 ? 2 : 4;
      /* anim phase every scn_aspd pixels walked (CH2) — the countdown
         replaces the hardwired (step & 7) == 0, byte-identical at the
         default 8. The DISPLAYED charset owns the cadence: a Change
         Graphic walks at its own charset's pace. */
      u8 slot = actor_gfx[i] != 0xFF ? actor_gfx[i] : actor_sprite[i];
      u8 spd = slot < 5 ? scn_aspd[slot] : 8;

      d = actor_mvdir[i];
      while (px && actor_step[i])
      {
        actor_px[i] += mv_dx[d];
        actor_py[i] += mv_dy[d];
        moved = 1;
        actor_step[i]--;
        px--;
        if (actor_stepct[i] > 1)
          actor_stepct[i]--;
        else
        {
          actor_stepct[i] = spd;
          actor_anim[i] = (u8)((actor_anim[i] + 1) & 3);
        }
      }
    }
  }

  /* Stepping idles (CH2): a charset with scn_aidle walks in place
     while standing — actor_show_step opens the draw gate and the
     countdown ticks in display frames. The whole walk is skipped when
     the scene has no such charset (the plain's 60 fps, P1-P3). */
  if (scn_has_idle)
  {
    for (i = 0; i < n; i++)
    {
      u8 slot;

      if (!actor_active[i] || actor_sprite[i] == 0xFF)
        continue;
      slot = actor_gfx[i] != 0xFF ? actor_gfx[i] : actor_sprite[i];
      if (slot > 4 || !scn_aidle[slot])
      {
        actor_show_step[i] = 0;
        continue;
      }
      actor_show_step[i] = 1;
      if (actor_step[i])
        continue; /* walking: the pixel countdown owns the anim */
      if (actor_stepct[i] > 1)
        actor_stepct[i]--;
      else
      {
        actor_stepct[i] = scn_aspd[slot];
        actor_anim[i] = (u8)((actor_anim[i] + 1) & 3);
      }
    }
  }

  /* PERF (P2): the blocker list only depends on the positions and the
     active pages. Teleports (SETPOS/SWAPPOS) and page changes already
     rebuild it themselves; all that is left here is frame-by-frame
     movement. A scene of motionless NPCs rebuilt it 60 times a second
     for nothing — 10 % of the frame's time, measured with the scanline
     counter. */
  if (moved)
    actors_rebuild_blockers();
}

u8 actor_at_tile(u8 tx, u8 ty)
{
  u8 k;

  if (!blk_ovf)
  {
    /* common case: bounding-box rejection then a scan of the precomputed
       list (see actors_rebuild_blockers) */
    if (tx < blk_x0 || tx > blk_x1 || ty < blk_y0 || ty > blk_y1)
      return ACTOR_NONE;
    for (k = 0; k < blk_n; k++)
    {
      if (blk_tx[k] == tx && blk_ty[k] == ty)
        return blk_id[k];
    }
    return ACTOR_NONE;
  }

  /* exact fallback (list full): full walk, RUNTIME position for the
     slots — only the "like the hero" ones block and can be talked to
     face on (priority, v0.14) */
  for (k = 0; k < scene_ctx.actor_count; k++)
  {
    if (k < ACTOR_SLOTS)
    {
      if (!actor_active[k] || actor_prio[k] != ACTOR_PRIO_SAME)
        continue;
      if (ACTOR_TX(k) != tx || ACTOR_TY(k) != ty)
        continue;
      if (actor_kind[k] != ACTOR_TYPE_NPC_STATIC)
        continue;
      return k;
    }
    else
    {
      const ActorDef *a = &scene_ctx.actors[k];

      if (a->actor_type == ACTOR_TYPE_NPC_STATIC && a->x == tx &&
          a->y == ty)
        return k;
    }
  }
  return ACTOR_NONE;
}

/* An event "under the hero" (below priority) on this tile — interaction
   while standing on it, RM2003 style (a chest on the ground). */
u8 actor_standing_at(u8 tx, u8 ty)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < scene_ctx.actor_count && i < ACTOR_SLOTS; i++, a++)
  {
    if (a->actor_type == ACTOR_TYPE_NPC_STATIC && actor_active[i] &&
        actor_prio[i] == ACTOR_PRIO_BELOW && ACTOR_TX(i) == tx &&
        ACTOR_TY(i) == ty)
      return i;
  }
  return ACTOR_NONE;
}

u8 actor_trigger_at(u8 tx, u8 ty)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    if (a->actor_type == ACTOR_TYPE_TRIGGER && a->x == tx && a->y == ty &&
        a->script_offset != SCRIPT_NONE &&
        (i >= ACTOR_SLOTS || actor_active[i]))
      return i;
  }
  return ACTOR_NONE;
}

u16 actors_autorun(void)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    if (a->actor_type == ACTOR_TYPE_AUTO && a->script_offset != SCRIPT_NONE &&
        (i >= ACTOR_SLOTS || actor_active[i]))
      return a->script_offset;
  }
  return SCRIPT_NONE;
}

void actor_face(u8 index, u8 dir)
{
  if (index < ACTOR_SLOTS && index < scene_ctx.actor_count &&
      !actor_dirfix[index])
    actor_dirs[index] = dir & 3; /* Direction Fix: orientation frozen */
}

void actor_interact(u8 index)
{
  u16 ofs = scene_ctx.actors[index].script_offset;

  /* RM2003 reflex: the NPC turns towards the hero (the opposite
     direction — DOWN<->UP and LEFT<->RIGHT swap through xor 1) */
  actor_face(index, player.dir ^ 1);

  if (ofs != SCRIPT_NONE)
  {
    vm_start(ofs);
    vm.script_actor = index; /* target of the "this event" ROUTE (v0.12) */
  }
}

/* PIXEL position (world) of an actor — the anchor for animations (A1):
   an animation pinned to an event follows it when it walks. */
u16 actor_pos_x(u8 index)
{
  return (index < ACTOR_SLOTS) ? actor_px[index] : 0;
}

u16 actor_pos_y(u8 index)
{
  return (index < ACTOR_SLOTS) ? actor_py[index] : 0;
}
