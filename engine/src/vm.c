/*
 * vm.c — bytecode VM v0.
 *
 * Two categories of opcode: immediate ones (chained within the frame, a
 * budget of 32 per frame) and blocking ones (MSG: hands control back to
 * the main loop until the textbox closes). Decoding reads the scene's
 * script block through a far pointer (scene_ctx.scripts).
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "textbox.h"
#include "actors.h"
#include "player.h"
#include "camera.h"
#include "timer.h"
#include "screenfx.h"
#include "ui_overlay.h" /* SHOWUI: widget visibility (Ph. 12) */
#include "picture.h" /* SHOWPIC/HIDEPIC: full-screen pictures (S3) */
#include "weather.h" /* WEATHER: particle weather (S13) */
#include "btlprim.h" /* BTLPOSE/POPUP/CLOCK/TARGETSEL: the battle
                        primitives (V1) */
#include "hdmafx.h"  /* WAVE: screen ripple (S14) */
#include "audio.h"   /* PLAYSFX / PLAYBGM: sound and music (B1) */
#include "stage.h"   /* composed screen (B3) */
#include "vignette.h" /* animated vignettes (B5) */
#include "anim.h"  /* ANIMPLAY: frame-by-frame animations (A1) */
#include "m7.h"     /* M7OPEN/M7ZOOM/M7CLOSE: the Mode 7 screen (M7-A) */
#include "data/db_tables.h" /* Database register (DBREAD, v0.17) */
#include "save.h"
#include "vm.h"

#define VM_OPS_PER_FRAME 32

VmState vm;

/* The VM's randomness (VAROP op 6) — 16-bit xorshift, seeded explicitly
   (tcc statics) and stirred by the hero's position on every vm_start. */
static u16 vm_seed;

/* Debug halt: unknown opcode or an infinite loop in a script — a data
   bug, we freeze so it shows immediately. */
static void vm_halt(void)
{
  while (1)
  {
  }
}

void vm_init(void)
{
  u16 i;

  vm_seed = 0xBEEF; /* never 0 (xorshift) — EXPLICIT init (tcc) */

  vm.active = 0;
  vm.wait_mode = VM_WAIT_NONE;
  vm.pc = 0;
  vm.wait_timer = 0;
  vm.keyin_mask = 0;
  vm.keyin_dst = 0;
  vm.script_actor = 0xFF;
  vm.call_sp = 0;
  vm.frame_base = 0;
  vm.frame_sp = 0;
  vm.retval = 0;
  for (i = 0; i < VM_CALL_DEPTH; i++)
    vm.call_stack[i] = 0;
  for (i = 0; i < 64; i++)
  {
    vm.vars[i] = 0;
    vm.gvars[i] = 0;
    vm.switches[i] = 0;
  }
  for (i = 0; i < VM_VAR16_COUNT; i++)
    vm.vars16[i] = 0;
  vm_parallel_reset();
}

u8 vm_switch_get(u16 idx)
{
  if (idx >= VM_SWITCH_COUNT)
    return 0;
  return (vm.switches[idx >> 3] >> (idx & 7)) & 1;
}

void vm_switch_set(u16 idx, u8 on)
{
  u8 mask;

  if (idx >= VM_SWITCH_COUNT)
    return;
  mask = (u8)(1 << (idx & 7));
  if (on)
    vm.switches[idx >> 3] |= mask;
  else
    vm.switches[idx >> 3] &= (u8)~mask;
}

void vm_scene_reset(void)
{
  u8 i;

  vm.active = 0;
  vm.wait_mode = VM_WAIT_NONE;
  for (i = 0; i < 64; i++)
    vm.vars[i] = 0;
  vm_parallel_reset(); /* the parallel context pointed at the old block */
}

void vm_start(u16 offset)
{
  vm.active = 1;
  vm.wait_mode = VM_WAIT_NONE;
  vm.pc = offset;
  vm.script_actor = 0xFF; /* filled in afterwards by the caller (v0.12) */
  vm.call_sp = 0;         /* empty call stack (v0.16) */
  vm.frame_base = 0;      /* no function frame open (F1) */
  vm.frame_sp = 0;
  vm_seed ^= player.x ^ (player.y << 5) ^ 1; /* stirs the randomness */
}

/* Table of the AUTO/PARALLEL common events at the head of the script
   block (v0.16): [n] then n x [type u8: 0 autorun, 1 parallel][switch
   u16][offset u16] at offset 0. Returns the offset of the first common
   event of the requested type whose switch is ON, or SCRIPT_NONE. */
static u16 common_lookup(u8 kind)
{
  u8 n, i;
  u16 p, sw, ofs;

  n = scene_ctx.scripts[0];
  p = 1;
  for (i = 0; i < n; i++)
  {
    /* the type first: sw/ofs are only read for the entries of the right
       kind — this scan runs every frame (parallel process) and every
       read of the script block goes through a far pointer */
    if (scene_ctx.scripts[p] == kind)
    {
      sw = scene_ctx.scripts[p + 1] | ((u16)scene_ctx.scripts[p + 2] << 8);
      /* switch 0xFFFF = no condition (the box is unchecked): always
         active */
      if (sw == 0xFFFF || vm_switch_get(sw))
      {
        ofs = (u16)scene_ctx.scripts[p + 3] |
              ((u16)scene_ctx.scripts[p + 4] << 8);
        return ofs;
      }
    }
    p += 5;
  }
  return SCRIPT_NONE;
}

u16 vm_common_auto(void)
{
  return common_lookup(0);
}

/* Battle hook (C4): the CETAB's type-2 entries map a COMMON EVENT index
   (carried by the switch field) to the body's offset in THIS scene's
   block. SCRIPT_NONE when the scene compiled without it. */
u16 vm_common_hook(u8 ce)
{
  u8 n, i;
  u16 p, id;

  n = scene_ctx.scripts[0];
  p = 1;
  for (i = 0; i < n; i++)
  {
    if (scene_ctx.scripts[p] == 2)
    {
      id = scene_ctx.scripts[p + 1] | ((u16)scene_ctx.scripts[p + 2] << 8);
      if (id == ce)
        return (u16)scene_ctx.scripts[p + 3] |
               ((u16)scene_ctx.scripts[p + 4] << 8);
    }
    p += 5;
  }
  return SCRIPT_NONE;
}

/* --- PARALLEL context (v0.16) — a "Parallel process" common event runs
   in the background without freezing the player, restarted as long as
   its switch is ON. The variables and switches are SHARED with the main
   script; only the execution fields (pc, waits, stack) are swapped
   (swap-in/swap-out) around vm_step. MSG/CHOICE are forbidden there
   (datagen refuses them: no UI from the background). */
static u8 p_active;
static u16 p_pc;
static u8 p_wait_mode;
static u8 p_wait_timer;
static u8 p_script_actor;
static u8 p_call_sp;
static u16 p_call_stack[VM_CALL_DEPTH];
/* F1: the parallel context has its own frames. The variables are
   shared with the main script — that is the RM2003 model — but a
   function's parameters are not: they are execution data, just like
   the pc and the call stack. A parallel process that calls a function
   while a dialogue calls another one must not overwrite anything of
   its own. */
static u8 p_call_fb[VM_CALL_DEPTH];
static u16 p_frame[VM_FRAME_SLOTS];
static u8 p_frame_base;
static u8 p_frame_sp;
static u16 p_retval;

/* KEYIN (Ph. 12): code of the first key of the mask present in
   "pressed" — SNES-extended RM2003 codes (formats.h).
   PERF (P2): a non-blocking KEYIN in a "parallel" common event runs on
   EVERY frame. The loop version (12 iterations, one function call per
   iteration to convert the code into an SNES bit) cost ~15 screen lines
   on its own. Here it is a chain of tests on CONSTANTS: the compiler
   has no loop, no call and no variable shift left, and the "nothing
   pressed" case exits on the first test. The order of the codes is the
   spec's — the first code of the mask actually pressed wins, as
   before. */
static u8 keyin_scan(u16 mask, u16 pressed)
{
  if (!pressed)
    return 0;
  if ((mask & 0x0002) && (pressed & KEY_DOWN))
    return 1;
  if ((mask & 0x0004) && (pressed & KEY_LEFT))
    return 2;
  if ((mask & 0x0008) && (pressed & KEY_RIGHT))
    return 3;
  if ((mask & 0x0010) && (pressed & KEY_UP))
    return 4;
  if ((mask & 0x0020) && (pressed & KEY_A))
    return 5;
  if ((mask & 0x0040) && (pressed & KEY_B))
    return 6;
  if ((mask & 0x0080) && (pressed & KEY_Y))
    return 7;
  if ((mask & 0x0100) && (pressed & KEY_X))
    return 8;
  if ((mask & 0x0200) && (pressed & KEY_L))
    return 9;
  if ((mask & 0x0400) && (pressed & KEY_R))
    return 10;
  if ((mask & 0x0800) && (pressed & KEY_SELECT))
    return 11;
  if ((mask & 0x1000) && (pressed & KEY_START))
    return 12;
  return 0;
}

/* parallel context: mask/destination of the KEYIN in progress */
static u16 p_keyin_mask;
static u8 p_keyin_dst;

static void pvm_swap(void)
{
  u8 i, n, t8;
  u16 t16;

  t8 = vm.active;      vm.active = p_active;         p_active = t8;
  t16 = vm.pc;         vm.pc = p_pc;                 p_pc = t16;
  t8 = vm.wait_mode;   vm.wait_mode = p_wait_mode;   p_wait_mode = t8;
  t8 = vm.wait_timer;  vm.wait_timer = p_wait_timer; p_wait_timer = t8;
  t8 = vm.script_actor; vm.script_actor = p_script_actor; p_script_actor = t8;
  t8 = vm.call_sp;     vm.call_sp = p_call_sp;       p_call_sp = t8;
  t16 = vm.keyin_mask; vm.keyin_mask = p_keyin_mask;  p_keyin_mask = t16;
  t8 = vm.keyin_dst;   vm.keyin_dst = p_keyin_dst;    p_keyin_dst = t8;
  /* only the entries below sp are live (CALL writes before RET reads):
     swap only those — the common case, two empty stacks, copies nothing
     (two swaps per frame while a parallel process runs, and that budget
     counts) */
  n = vm.call_sp;
  if (p_call_sp > n)
    n = p_call_sp;
  for (i = 0; i < n; i++)
  {
    t16 = vm.call_stack[i];
    vm.call_stack[i] = p_call_stack[i];
    p_call_stack[i] = t16;
    t8 = vm.call_fb[i];
    vm.call_fb[i] = p_call_fb[i];
    p_call_fb[i] = t8;
  }
  /* Function frames (F1): same rule, only the LIVE slots are swapped.
     No call in progress on either side — by far the most frequent case
     — copies nothing at all. */
  t8 = vm.frame_base; vm.frame_base = p_frame_base; p_frame_base = t8;
  t16 = vm.retval; vm.retval = p_retval; p_retval = t16;
  n = vm.frame_sp;
  if (p_frame_sp > n)
    n = p_frame_sp;
  t8 = vm.frame_sp; vm.frame_sp = p_frame_sp; p_frame_sp = t8;
  for (i = 0; i < n; i++)
  {
    t16 = vm.frame[i];
    vm.frame[i] = p_frame[i];
    p_frame[i] = t16;
  }
}

void vm_parallel_reset(void)
{
  u8 i;

  p_active = 0;
  p_pc = 0;
  p_keyin_mask = 0;
  p_keyin_dst = 0;
  p_wait_mode = VM_WAIT_NONE;
  p_wait_timer = 0;
  p_script_actor = 0xFF;
  p_call_sp = 0;
  p_frame_base = 0;
  p_frame_sp = 0;
  p_retval = 0;
  for (i = 0; i < VM_CALL_DEPTH; i++)
  {
    p_call_stack[i] = 0;
    p_call_fb[i] = 0;
  }
}

u8 vm_active(void)
{
  return vm.active;
}

static u8 fetch8(void)
{
  return scene_ctx.scripts[vm.pc++];
}

static u16 fetch16(void)
{
  u16 v = fetch8();

  v |= (u16)fetch8() << 8;
  return v;
}

/* Variable byte -> slot: bit 7 = global variable */
static u8 var_get(u8 v)
{
  return (v & VM_VAR_GLOBAL) ? vm.gvars[v & 63] : vm.vars[v & 63];
}

static void var_set(u8 v, u8 val)
{
  if (v & VM_VAR_GLOBAL)
    vm.gvars[v & 63] = val;
  else
    vm.vars[v & 63] = val;
}

/* Options of the CHOICE in progress (copied from the stream at decode) */
static u16 choice_ids[4];

static u16 vm_rand(void)
{
  vm_seed ^= vm_seed << 7;
  vm_seed ^= vm_seed >> 9;
  vm_seed ^= vm_seed << 8;
  return vm_seed;
}

/* Source value of a VAROP (v0.13) */
static u16 varop_src(u8 src_type, u16 src)
{
  switch (src_type)
  {
  case VARSRC_VAR:
    return vm.vars16[src & 255];
  case VARSRC_HERO_X:
    return (u16)((player.x + 8) >> 4);
  case VARSRC_HERO_Y:
    return (u16)((player.y + 8) >> 4);
  case VARSRC_TIMER:
    return timer_secs();
  case VARSRC_SCENE:
    return scene_ctx.scene_id;
  case VARSRC_PARAM:
    /* parameter n of the current function. The mask is not decoration:
       outside a function frame_base is 0 and a stray "param" would read
       any slot at all — datagen refuses the case, and this mask
       guarantees that a damaged data block cannot read the neighbouring
       WRAM. */
    return vm.frame[(u8)(vm.frame_base + (u8)src) & (VM_FRAME_SLOTS - 1)];
  case VARSRC_RET:
    return vm.retval;
  default:
    return src;
  }
}

/* Call return, shared by RET and RETF: pops both the address AND the
   frame. A function ending on a plain RET (no value to give back)
   therefore still gives its slots back. Empty stack = the body was
   started directly, so it acts as END. */
/* A VAROP's operation, on its own: the same one serves a global
   variable and a function LOCAL (F2b), and nobody wants to maintain two
   copies of the division by zero. */
static u16 varop_apply(u16 cur, u8 op, u16 rhs)
{
  if (op == VAROP_SET)
    return rhs;
  if (op == VAROP_ADD)
    return (u16)(cur + rhs);
  if (op == VAROP_SUB)
    return (u16)(cur - rhs);
  if (op == VAROP_MUL)
    return (u16)(cur * rhs);
  if (op == VAROP_DIV)
    return rhs ? (u16)(cur / rhs) : 0;
  if (op == VAROP_MOD)
    return rhs ? (u16)(cur % rhs) : 0;
  /* random 0..rhs inclusive */
  return rhs == 0xFFFF ? vm_rand() : (u16)(vm_rand() % (rhs + 1));
}

static void vm_do_ret(void)
{
  if (vm.call_sp)
  {
    vm.call_sp--;
    vm.pc = vm.call_stack[vm.call_sp];
    vm.frame_sp = vm.frame_base;
    vm.frame_base = vm.call_fb[vm.call_sp];
  }
  else
    vm.active = 0;
}

static void vm_step(void)
{
  u8 budget = VM_OPS_PER_FRAME;
  u8 op, var, val;
  u16 ofs, idx16, val16;

  while (vm.active && vm.wait_mode == VM_WAIT_NONE)
  {
    if (budget == 0)
      return; /* budget spent: the VM hands back and resumes on the next
                 frame — a LOOP with no blocking command is legal
                 (v0.15), it runs 32 ops/frame like RM2003 */
    budget--;

    op = fetch8();
    switch (op)
    {
    case VM_OP_END:
      vm.active = 0;
      break;

    case VM_OP_MSG: /* blocking */
      ofs = fetch16();
      textbox_open(ofs);
      vm.wait_mode = VM_WAIT_TEXTBOX;
      break;

    case VM_OP_SETVAR:
      var = fetch8();
      var_set(var, fetch8());
      break;

    case VM_OP_ADDVAR:
      var = fetch8();
      var_set(var, var_get(var) + fetch8()); /* 8-bit wrap assumed (spec) */
      break;

    case VM_OP_JMP:
      vm.pc = fetch16();
      break;

    case VM_OP_JEQ:
      var = fetch8();
      val = fetch8();
      ofs = fetch16();
      if (var_get(var) == val)
        vm.pc = ofs;
      break;

    case VM_OP_JNE:
      var = fetch8();
      val = fetch8();
      ofs = fetch16();
      if (var_get(var) != val)
        vm.pc = ofs;
      break;

    case VM_OP_SETGVAR: /* historic alias of SETVAR g<n> */
      var = fetch8();
      vm.gvars[var & 63] = fetch8();
      break;

    case VM_OP_JGEQ:
      var = fetch8();
      val = fetch8();
      ofs = fetch16();
      if (var_get(var) >= val)
        vm.pc = ofs;
      break;

    case VM_OP_CHOICE: /* blocking: 2-4 options, index -> variable */
      vm.choice_var = fetch8();
      vm.choice_count = fetch8();
      for (val = 0; val < vm.choice_count; val++)
        choice_ids[val & 3] = fetch16();
      vm.choice_sel = 0;
      textbox_open_choices(choice_ids, vm.choice_count, 0);
      vm.wait_mode = VM_WAIT_CHOICE;
      break;

    case VM_OP_WARP: /* scripted teleport — the script block changes
                        scene: the script ends here */
      var = fetch8();   /* scene */
      val = fetch8();   /* x */
      idx16 = fetch8(); /* y */
      player_request_warp(var, val, (u8)idx16, fetch8());
      vm.active = 0;
      break;

    case VM_OP_FACE: /* turns actor n (a no-op if outside the scene) */
      var = fetch8();
      actor_face(var, fetch8());
      break;

    case VM_OP_SW: /* switch OFF/ON (v0.9) */
      idx16 = fetch16();
      vm_switch_set(idx16, fetch8());
      break;

    case VM_OP_JSW: /* jump if switch == expected */
      idx16 = fetch16();
      val = fetch8();
      ofs = fetch16();
      if (vm_switch_get(idx16) == val)
        vm.pc = ofs;
      break;

    case VM_OP_SET16: /* 16-bit variable = val */
      var = fetch8();
      vm.vars16[var] = fetch16();
      break;

    case VM_OP_ADD16: /* 16-bit variable += val (wrap, negatives in
                         two's complement) */
      var = fetch8();
      vm.vars16[var] += fetch16();
      break;

    case VM_OP_ROUTE: /* route (v0.12/v0.13) — NON blocking: the
                         route runs in the background (cutscenes) */
      var = fetch8(); /* actor, 0xFF = the script's event */
      val = fetch8(); /* flags */
      actors_route_freq(fetch8()); /* frequency 1-8 */
      idx16 = fetch8(); /* len (bytes) */
      if (var == 0xFF)
        var = vm.script_actor;
      actors_route_bind_freq(var);
      actors_set_route(var, vm.pc, val, (u8)idx16);
      vm.pc += idx16; /* the steps are inline: skip them */
      break;

    case VM_OP_WAITROUTE: /* blocking: end of every route */
      vm.wait_mode = VM_WAIT_ROUTE;
      break;

    case VM_OP_WAIT: /* blocking: n frames */
      vm.wait_timer = fetch8();
      vm.wait_mode = VM_WAIT_TIMER;
      break;

    case VM_OP_VAROP: /* advanced operations (v0.13) */
      var = fetch8();          /* destination variable */
      val = fetch8();          /* operation */
      idx16 = fetch8();        /* source type */
      val16 = varop_src((u8)idx16, fetch16());
      vm.vars16[var] = varop_apply(vm.vars16[var], val, val16);
      break;

    case VM_OP_SETLOC: /* LOCAL variable of the current function (F2b) */
      var = (u8)(vm.frame_base + fetch8()) & (VM_FRAME_SLOTS - 1);
      val = fetch8();   /* operation */
      idx16 = fetch8(); /* source type */
      val16 = varop_src((u8)idx16, fetch16());
      vm.frame[var] = varop_apply(vm.frame[var], val, val16);
      break;

    case VM_OP_TIMER: /* game timer (v0.13) */
      var = fetch8();
      val16 = fetch16();
      if (var == 0)
        timer_set(val16);
      else if (var == 1)
        timer_stop();
      else
        timer_display(var == 2);
      break;

    case VM_OP_CAMPAN: /* scripted camera pan — NON blocking */
      var = fetch8();
      val = fetch8();
      camera_pan_to(var, val, fetch8());
      break;

    case VM_OP_CAMRET: /* camera back to the hero */
      camera_return(fetch8());
      break;

    case VM_OP_WAITCAM: /* blocking: end of the pan */
      vm.wait_mode = VM_WAIT_CAM;
      break;

    case VM_OP_WARPV: /* teleport to variable coordinates (v0.15) —
                         recalling a memorised position: the script ends
                         here, like WARP */
      var = fetch8();   /* scene variable */
      val = fetch8();   /* x variable */
      idx16 = fetch8(); /* y variable */
      player_request_warp((u8)vm.vars16[var], (u8)vm.vars16[val],
                          (u8)vm.vars16[idx16 & 255], fetch8());
      vm.active = 0;
      break;

    case VM_OP_SETPOS: /* places an event on a tile (v0.15) */
      var = fetch8();   /* actor, 0xFF = the script's event */
      val = fetch8();   /* source: 0 constants, 1 variables */
      idx16 = fetch8(); /* x (or variable number) */
      ofs = fetch8();   /* y (or variable number) */
      if (var == 0xFF)
        var = vm.script_actor;
      if (val)
      {
        idx16 = vm.vars16[idx16 & 255];
        ofs = vm.vars16[ofs & 255];
      }
      actors_set_pos(var, (u8)idx16, (u8)ofs);
      break;

    case VM_OP_SWAPPOS: /* swaps the positions of two events (v0.15) */
      var = fetch8();
      val = fetch8();
      if (var == 0xFF)
        var = vm.script_actor;
      if (val == 0xFF)
        val = vm.script_actor;
      actors_swap_pos(var, val);
      break;

    case VM_OP_SCRHIDE: /* fade to black — blocking (v0.15) */
      var = fetch8(); /* speed */
      screenfx_hide(var, fetch8());
      vm.wait_mode = VM_WAIT_SCREEN;
      break;

    case VM_OP_SCRSHOW: /* fade in — blocking */
      var = fetch8(); /* speed */
      screenfx_show(var, fetch8());
      vm.wait_mode = VM_WAIT_SCREEN;
      break;

    case VM_OP_TINT: /* scenery tint (v0.15) — rgb THEN mode (tcc trap
                        tcc trap with multiple parameters: 3 u8 max) */
      var = fetch8();   /* mode */
      val = fetch8();   /* r */
      idx16 = fetch8(); /* g */
      screenfx_tint_rgb(val, (u8)idx16, fetch8());
      screenfx_tint(var);
      break;

    case VM_OP_WAVE: /* screen ripple (S14) — NON blocking */
      var = fetch8();
      hdmafx_wave(var, fetch8());
      break;

    case VM_OP_SKYGRAD: /* sky gradient (S15) — colours THEN mode
                           (tcc workaround: 3 u8 max per call) */
      var = fetch8();   /* mode */
      val = fetch8();   /* r top */
      idx16 = fetch8(); /* g top */
      hdmafx_grad_top(val, (u8)idx16, fetch8());
      val = fetch8();   /* r bottom */
      idx16 = fetch8(); /* g bottom */
      hdmafx_grad_bottom(val, (u8)idx16, fetch8());
      hdmafx_grad(var);
      break;

    case VM_OP_SPOTLIGHT: /* circle of light (S16) — NON blocking */
      var = fetch8();
      hdmafx_spot(var, fetch8());
      break;

    case VM_OP_STAGEOPEN: /* composed screen (B3) — deferred to the loop,
                             1 frame of pause (the SHOWPIC recipe) */
      var = fetch8();
      val = fetch8(); /* dur */
      stage_request_open(var, val, fetch8());
      vm.wait_mode = VM_WAIT_TIMER;
      vm.wait_timer = 1;
      break;

    case VM_OP_STAGEPOSE: /* lays an image — BLOCKING (spread transfer) */
      var = fetch8();   /* slot */
      val = fetch8();   /* pic */
      idx16 = fetch8(); /* tx */
      stage_pose(var, val, (u8)idx16, fetch8());
      vm.wait_mode = VM_WAIT_STAGE;
      break;

    case VM_OP_STAGECLEAR: /* removes the slot's image — BLOCKING (short) */
      stage_clear(fetch8());
      vm.wait_mode = VM_WAIT_STAGE;
      break;

    case VM_OP_STAGECLOSE: /* closes the screen (internal warp) — 1 frame */
      var = fetch8(); /* dur */
      stage_request_close(var, fetch8());
      vm.wait_mode = VM_WAIT_TIMER;
      vm.wait_timer = 1;
      break;

    case VM_OP_SLOTFX: /* palette effect on a slot (B4) — NON blocking */
      var = fetch8();
      val = fetch8();
      stage_slotfx(var, val, fetch8());
      break;

    case VM_OP_VIGSHOW: /* vignette (B5) — NON blocking. anchor through a
                           second call (tcc workaround: 3 u8 max) */
      var = fetch8();   /* slot */
      val = fetch8();   /* vig */
      idx16 = fetch8(); /* x */
      vig_show(var, val, (u8)idx16, fetch8());
      vig_anchor(var, fetch8());
      break;

    case VM_OP_VIGPLAY: /* animation of the vignette — NON blocking */
      var = fetch8();
      val = fetch8();
      vig_play(var, val, fetch8());
      break;

    case VM_OP_VIGHIDE:
      vig_hide(fetch8());
      break;

    case VM_OP_ANIMPLAY: /* frame-by-frame animation (A1) — blocking
                            only if bit 0 of the flags is set */
      var = fetch8();   /* animation */
      val = fetch8();   /* anchor */
      idx16 = fetch8(); /* target (actor), 0xFF = the script's event */
      if (val == ANIM_ANC_ACTOR && (u8)idx16 == 0xFF)
        idx16 = vm.script_actor;
      op = fetch8();  /* flags */
      ofs = fetch8(); /* screen-anchor aim point (V2) — the event
                         library lands skills ON their target */
      anim_screen_at((u8)ofs, fetch8());
      anim_play(var, val, (u8)idx16);
      if (op & 1)
        vm.wait_mode = VM_WAIT_ANIM; /* anim_busy ignores loops */
      break;

    case VM_OP_ANIMSTOP:
      anim_stop();
      break;

    case VM_OP_M7OPEN: /* Mode 7 screen (M7-A) — deferred to the loop,
                          1 frame of pause (the SHOWPIC/STAGEOPEN recipe).
                          WITHOUT the pause the next opcode runs before
                          m7_apply ever sees the request: M7ZOOM finds
                          m7_on still 0 and drops the ramp, and M7CLOSE
                          overwrites m7_req before the screen has opened. */
      var = fetch8();
      m7_request_open(var, fetch8());
      vm.wait_mode = VM_WAIT_TIMER;
      vm.wait_timer = 1;
      break;

    case VM_OP_M7ZOOM:
      var = fetch8();  /* ramp, 0xFF stops */
      val = fetch8();  /* flags */
      m7_zoom(var, val & M7_ZOOM_LOOP);
      if (val & 2)
        vm.wait_mode = VM_WAIT_M7; /* m7_busy ignores loops */
      break;

    case VM_OP_M7CLOSE: /* closes the screen (internal warp) — 1 frame */
      m7_request_close(fetch8());
      vm.wait_mode = VM_WAIT_TIMER;
      vm.wait_timer = 1;
      break;

    case VM_OP_M7VIEW: /* world map camera angle — immediate, no pause:
                          it rewrites tables, it does not queue a request */
      var = fetch8(); /* horizon */
      val = fetch8(); /* anchor */
      m7_view(var, val);
      break;

    case VM_OP_M7ROT: /* world map rotation — four pointer writes */
      m7_rotate(fetch8());
      break;

    case VM_OP_M7TURN: /* animated turn, optionally blocking */
      var = fetch8(); /* angle */
      val = fetch8(); /* frames */
      m7_rotate_to(var, val);
      if (fetch8() & 2)
        vm.wait_mode = VM_WAIT_M7T;
      break;


    case VM_OP_BTLPOSE: /* battler pose (V1) — BLOCKING on the upload */
      var = fetch8();   /* slot 0-3 */
      op = fetch8();    /* entry source: 0 constant, 1 variable */
      val = fetch8();   /* entry in the heroes table (or variable no) */
      if (op)
        val = (u8)vm.vars16[val];
      idx16 = fetch8(); /* x */
      op = fetch8();    /* y */
      btlprim_pose(var, val, (u8)idx16, op, fetch8());
      if (btlprim_busy())
        vm.wait_mode = VM_WAIT_BTLUP;
      break;

    case VM_OP_POPUP: /* digit popup (V1) — NON blocking */
      var = fetch8();    /* src: 0 constant, 1 variable */
      val16 = fetch16(); /* value (or variable number) */
      if (var)
        val16 = vm.vars16[val16 & 255];
      val = fetch8(); /* x */
      btlprim_popup(val16, val, fetch8());
      break;

    case VM_OP_CLOCK: /* gauge clock (V1) — NON blocking, persistent */
      var = fetch8(); /* base variable */
      btlprim_clock(var, fetch8());
      break;

    case VM_OP_TARGETSEL: /* target cursor (V1) — BLOCKING */
      var = fetch8(); /* destination variable */
      val = fetch8(); /* flags: bit 0 ally, bit 1 B cancels */
      op = btlprim_target_begin((u8)(val & 1));
      if (op == 0xFF)
      {
        vm.vars16[var] = 255; /* nothing to point at */
        break;
      }
      vm.choice_var = var;
      vm.list_flags = val;
      vm.wait_mode = VM_WAIT_TARGET;
      break;

    case VM_OP_LISTSEL: /* cursor menu (B6) — BLOCKING */
      var = fetch8();          /* widget (root of the layout) */
      vm.choice_var = fetch8(); /* destination variable */
      op = fetch8();            /* flags: bit 0 = B cancels */
      val = overlay_list_open(var);
      if (!val)
        break; /* no list on that widget: command ignored */
      vm.choice_count = val;
      vm.choice_sel = 0;
      vm.list_flags = op;
      vm.wait_mode = VM_WAIT_LIST;
      break;

    case VM_OP_PLAYSFX: /* play a sound (B1) — NON blocking */
      audio_play_sfx(fetch8());
      break;

    case VM_OP_PLAYBGM: /* change the music (B1) — NON blocking,
                           0xFF = silence; the scene's music comes back
                           at the next warp */
      audio_play_music(fetch8());
      break;

    case VM_OP_WEATHER: /* particle weather (S13) — NON blocking */
      var = fetch8();
      weather_set(var, fetch8());
      break;

    case VM_OP_TINTG: /* GRADUAL tint (S12) — rgb then (mode, dur),
                         same tcc workaround as TINT (3 u8 max per call) */
      var = fetch8();   /* mode */
      val = fetch8();   /* r */
      idx16 = fetch8(); /* g */
      screenfx_tintg_rgb(val, (u8)idx16, fetch8());
      screenfx_tintg(var, fetch8());
      break;

    case VM_OP_FLASH: /* decaying additive flash — NON blocking */
      val = fetch8();
      idx16 = fetch8();
      ofs = fetch8();
      screenfx_flash(val, (u8)idx16, (u8)ofs);
      screenfx_flash_start(fetch8());
      break;

    case VM_OP_SHAKE: /* horizontal shake — NON blocking */
      var = fetch8();
      val = fetch8();
      screenfx_shake(var, val, fetch8());
      break;

    case VM_OP_CALL: /* call of a common event body (v0.16) */
      ofs = fetch16();
      if (vm.call_sp >= VM_CALL_DEPTH)
      {
        vm_halt(); /* recursion too deep: a data bug */
        break;
      }
      vm.call_fb[vm.call_sp] = vm.frame_base;
      vm.call_stack[vm.call_sp++] = vm.pc;
      /* no arguments: the sub-script keeps the caller's frame, so an
         ordinary common event called FROM a function still sees that
         function's parameters. That is deliberate — it behaves like a
         block of commands inserted in place. */
      vm.pc = ofs;
      break;

    case VM_OP_RET: /* return from CALL — empty stack: end of script */
      vm_do_ret();
      break;

    case VM_OP_CALLF: /* FUNCTION call with arguments (F1) */
      ofs = fetch16();
      var = fetch8(); /* number of arguments */
      val = fetch8(); /* frame size: arguments + locals (F2b) */
      if (vm.call_sp >= VM_CALL_DEPTH ||
          (u16)vm.frame_sp + val > VM_FRAME_SLOTS)
      {
        /* Consume the operands anyway: leaving here with a pc in the
           middle of an instruction would make arguments execute as
           opcodes, and the crash would have nothing left to do with
           its cause. */
        for (idx16 = 0; idx16 < var; idx16++)
        {
          fetch8();
          fetch16();
        }
        vm_halt(); /* recursion too deep: a data bug */
        break;
      }
      /* The arguments are evaluated in the CALLER's frame — that is what
         allows passing a received parameter to another function — then
         they BECOME the callee's frame. */
      for (idx16 = 0; idx16 < var; idx16++)
      {
        val16 = fetch8(); /* type of the source */
        vm.frame[vm.frame_sp + idx16] = varop_src((u8)val16, fetch16());
      }
      /* The slots beyond the arguments are the LOCALS: zeroed. Without
         that they would pick up whatever a previous call had left at the
         same place — a bug that only shows once a second function comes
         through, so never during the test. */
      for (; idx16 < val; idx16++)
        vm.frame[vm.frame_sp + idx16] = 0;
      vm.call_fb[vm.call_sp] = vm.frame_base;
      vm.call_stack[vm.call_sp++] = vm.pc;
      vm.frame_base = vm.frame_sp;
      vm.frame_sp += val;
      vm.pc = ofs;
      break;

    case VM_OP_RETF: /* function return WITH a value (F1) */
      var = fetch8();
      vm.retval = varop_src(var, fetch16());
      vm_do_ret();
      break;

    case VM_OP_DBREAD: /* vars16[dst] = a database field (v0.17) */
      var = fetch8();   /* table (db_tables[] register) */
      val = fetch8();   /* entry source: 0 constant, 1 variable */
      idx16 = fetch8(); /* entry (or variable number) */
      if (val)
        idx16 = vm.vars16[idx16 & 255];
      ofs = fetch8();   /* field offset */
      val = fetch8();   /* size: 1 or 2 bytes */
      op = fetch8();    /* destination variable */
      if (var >= DB_TABLE_COUNT || idx16 >= db_table_counts[var])
        val16 = 0; /* dynamic entry outside the table: 0, never a wild
                      read (the constants are validated by datagen) */
      else
      {
        ofs += idx16 * db_table_sizes[var]; /* u16: 255 x 255 max */
        val16 = db_tables[var][ofs];
        if (val == 2)
          val16 |= (u16)db_tables[var][ofs + 1] << 8;
      }
      vm.vars16[op] = val16;
      break;

    case VM_OP_SHOWUI: /* visibility of a UI widget (Phase 12) */
      var = fetch8(); /* widget index (root of the layout) */
      op = fetch8();  /* 1 = show, 0 = hide */
      overlay_show(var, op);
      break;

    case VM_OP_KEYIN: /* Key Input Processing (RM2003, Phase 12) */
      op = fetch8();    /* 1 = wait for a press */
      val16 = fetch8(); /* mask of the allowed keys (lo) */
      val16 |= (u16)fetch8() << 8;
      var = fetch8();   /* destination variable */
      if (op)
      {
        vm.keyin_mask = val16;
        vm.keyin_dst = var;
        vm.wait_mode = VM_WAIT_KEY;
      }
      else
        vm.vars16[var] = keyin_scan(val16, padsCurrent(0));
      break;

    case VM_OP_DLGSTYLE: /* style of the next box (S1) */
      textbox_set_style(fetch8());
      break;

    case VM_OP_SRAM: /* SRAM (M2): the save primitive — the menus that
                        used to live in sysmenu.c are the project's
                        events now (PLANNING_MENU_EN_EVENTS.md) */
      op = fetch8();  /* 0 save, 1 load, 2 exists */
      var = fetch8(); /* slot */
      val = fetch8(); /* destination variable (exists) */
      if (op == 0)
        save_write(var);
      else if (op == 1)
      {
        if (save_read(var))
        {
          /* restore = a warp from the main loop: the script ends
             here, the warp invariant (cf. VM_OP_WARP) */
          save_request_load();
          vm.active = 0;
        }
        /* invalid slot: nothing changed, the script continues */
      }
      else
        vm.vars16[val] = save_exists(var);
      break;

    case VM_OP_SHOWPIC: /* picture (S3/S5/S7) — transition DEFERRED to the
                             main loop (the scripted warp model), the VM
                             pauses for one frame so the image comes
                             before what follows. The VARIABLES (flags
                             bits 0-1) are resolved HERE. */
      var = fetch8(); /* pic_id or variable index */
      val = fetch8(); /* screen x or variable index */
      idx16 = fetch8(); /* screen y or variable index */
      ofs = fetch8(); /* flags */
      if (ofs & 1)
        var = (u8)vm.vars16[var];
      if (ofs & 2)
      {
        val = (u8)vm.vars16[val];
        idx16 = (u8)vm.vars16[(u8)idx16];
      }
      picture_request(1, var, val, (u8)idx16, (u8)ofs, fetch8());
      vm.wait_mode = VM_WAIT_TIMER;
      vm.wait_timer = 1;
      break;

    case VM_OP_HIDEPIC:
      picture_request(0, 0, 0, 0, 0, fetch8());
      vm.wait_mode = VM_WAIT_TIMER;
      vm.wait_timer = 1;
      break;

    case VM_OP_MOVEPIC: /* slides the shown image (S7) — NON blocking:
                             state only, the scroll advances frame by
                             frame in picture_apply */
      val = fetch8(); /* x or variable index */
      idx16 = fetch8(); /* y or variable index */
      ofs = fetch8(); /* flags */
      if (ofs & 2)
      {
        val = (u8)vm.vars16[val];
        idx16 = (u8)vm.vars16[(u8)idx16];
      }
      picture_move(val, (u8)idx16, (u8)ofs, fetch8());
      break;

    case VM_OP_JCMP16: /* jump if the 16-bit comparison is true */
      /* Both sides are general sources (F2): a constant, a variable, the
         hero's position, a function parameter… The fetches are on
         separate lines — the evaluation order of a call's arguments is
         not guaranteed in C, and here it matters. */
      var = fetch8();  /* type of source A */
      idx16 = varop_src(var, fetch16());
      val = fetch8();  /* 0 ==, 1 !=, 2 >= */
      var = fetch8();  /* type of source B */
      val16 = varop_src(var, fetch16());
      ofs = fetch16();
      if ((val == 0 && idx16 == val16) || (val == 1 && idx16 != val16) ||
          (val == 2 && idx16 >= val16))
        vm.pc = ofs;
      break;

    default:
      vm_halt(); /* unknown opcode: corrupted data */
    }
  }
}

void vm_update(void)
{
  u16 down;

  if (vm.wait_mode == VM_WAIT_TEXTBOX)
  {
    textbox_tick(); /* typewriter (Phase 11, text_speed theme) */
    if (padsDown(0) & KEY_A)
    {
      if (textbox_waiting_key())
        textbox_resume(); /* \! wait point: resume (T2) */
      else if (textbox_busy())
        textbox_finish(); /* first A: reveal everything (up to a \!) */
      else
      {
        textbox_close();
        vm.wait_mode = VM_WAIT_NONE;
      }
    }
    else if (!textbox_busy() && textbox_autoclose())
    {
      /* \^ (T2): the message closes on its own once all is revealed */
      textbox_close();
      vm.wait_mode = VM_WAIT_NONE;
    }
    return; /* the VM resumes on the next frame */
  }
  if (vm.wait_mode == VM_WAIT_ROUTE)
  {
    if (!actors_routes_busy())
      vm.wait_mode = VM_WAIT_NONE;
    else
      return;
  }
  if (vm.wait_mode == VM_WAIT_CAM)
  {
    if (!camera_busy())
      vm.wait_mode = VM_WAIT_NONE;
    else
      return;
  }
  if (vm.wait_mode == VM_WAIT_SCREEN)
  {
    if (!screenfx_busy())
      vm.wait_mode = VM_WAIT_NONE;
    else
      return;
  }
  if (vm.wait_mode == VM_WAIT_STAGE)
  {
    if (!stage_busy())
      vm.wait_mode = VM_WAIT_NONE;
    else
      return;
  }
  if (vm.wait_mode == VM_WAIT_ANIM)
  {
    if (!anim_busy())
      vm.wait_mode = VM_WAIT_NONE;
    else
      return;
  }
  if (vm.wait_mode == VM_WAIT_M7)
  {
    if (!m7_busy())
      vm.wait_mode = VM_WAIT_NONE;
    else
      return;
  }
  if (vm.wait_mode == VM_WAIT_M7T)
  {
    if (!m7_rot_busy())
      vm.wait_mode = VM_WAIT_NONE;
    else
      return;
  }
  if (vm.wait_mode == VM_WAIT_TIMER)
  {
    if (vm.wait_timer)
    {
      vm.wait_timer--;
      return;
    }
    vm.wait_mode = VM_WAIT_NONE;
  }
  if (vm.wait_mode == VM_WAIT_KEY)
  {
    down = keyin_scan(vm.keyin_mask, padsDown(0));
    if (!down)
      return;
    vm.vars16[vm.keyin_dst] = down;
    vm.wait_mode = VM_WAIT_NONE;
  }
  if (vm.wait_mode == VM_WAIT_BTLUP)
  {
    if (!btlprim_busy())
      vm.wait_mode = VM_WAIT_NONE;
    else
      return;
  }
  if (vm.wait_mode == VM_WAIT_TARGET)
  {
    /* the target cursor (V1): the same pads vocabulary as the C3
       cursor — the feedback (pulse/blink) is btlprim's business */
    btlprim_target_tick();
    down = padsDown(0);
    if (down & (KEY_LEFT | KEY_UP))
      btlprim_target_step(0);
    else if (down & (KEY_RIGHT | KEY_DOWN))
      btlprim_target_step(1);
    else if (down & KEY_A)
    {
      vm.vars16[vm.choice_var] = btlprim_target_end();
      vm.wait_mode = VM_WAIT_NONE;
    }
    else if ((down & KEY_B) && (vm.list_flags & 2))
    {
      btlprim_target_end();
      vm.vars16[vm.choice_var] = 255;
      vm.wait_mode = VM_WAIT_NONE;
    }
    return;
  }
  if (vm.wait_mode == VM_WAIT_LIST)
  {
    /* cursor menu (B6): wrap around top/bottom — the reflex of SNES
       battle menus (4 options: down from Flee = Attack) */
    down = padsDown(0);
    if (down & KEY_UP)
    {
      vm.choice_sel = vm.choice_sel ? (u8)(vm.choice_sel - 1)
                                    : (u8)(vm.choice_count - 1);
      overlay_list_cursor(vm.choice_sel);
    }
    else if (down & KEY_DOWN)
    {
      vm.choice_sel = (u8)(vm.choice_sel + 1) >= vm.choice_count
                          ? 0 : (u8)(vm.choice_sel + 1);
      overlay_list_cursor(vm.choice_sel);
    }
    else if (down & KEY_A)
    {
      /* 16-bit variable (0-255), like KEYIN — the if_var circuit */
      vm.vars16[vm.choice_var] = vm.choice_sel;
      overlay_list_close((u8)(vm.list_flags & 2));
      vm.wait_mode = VM_WAIT_NONE;
    }
    else if ((down & KEY_B) && (vm.list_flags & 1))
    {
      vm.vars16[vm.choice_var] = 255;
      overlay_list_close((u8)(vm.list_flags & 2));
      vm.wait_mode = VM_WAIT_NONE;
    }
    else if ((down & (KEY_LEFT | KEY_RIGHT)) && (vm.list_flags & 4))
    {
      /* multi-panel: leaving sideways tells the script to activate the
         neighbouring list (254 = left, 253 = right) */
      vm.vars16[vm.choice_var] = (down & KEY_LEFT) ? 254 : 253;
      overlay_list_close((u8)(vm.list_flags & 2));
      vm.wait_mode = VM_WAIT_NONE;
    }
    return;
  }
  if (vm.wait_mode == VM_WAIT_CHOICE)
  {
    down = padsDown(0);
    if ((down & KEY_UP) && vm.choice_sel > 0)
    {
      vm.choice_sel--;
      textbox_choice_cursor(vm.choice_sel);
    }
    else if ((down & KEY_DOWN) && (u8)(vm.choice_sel + 1) < vm.choice_count)
    {
      vm.choice_sel++;
      textbox_choice_cursor(vm.choice_sel);
    }
    else if (down & KEY_A)
    {
      var_set(vm.choice_var, vm.choice_sel);
      textbox_close();
      vm.wait_mode = VM_WAIT_NONE;
    }
    return;
  }
  vm_step();
}

/* One step of the PARALLEL context (v0.16) — to be called every frame
   outside the System menu, whether the main script is active or not. It
   starts the first "parallel" common event whose switch is ON, handles
   its non-UI waits, then runs its opcodes by swap-in/swap-out. At the
   end of the script (END) it starts again as long as the switch is ON. */
void vm_parallel_update(void)
{
  u16 ofs;

  if (!p_active)
  {
    ofs = common_lookup(1);
    if (ofs == SCRIPT_NONE)
      return;
    p_active = 1;
    p_pc = ofs;
    p_wait_mode = VM_WAIT_NONE;
    p_wait_timer = 0;
    p_script_actor = 0xFF;
    p_call_sp = 0;
  }
  if (p_wait_mode == VM_WAIT_ROUTE)
  {
    if (actors_routes_busy())
      return;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_CAM)
  {
    if (camera_busy())
      return;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_SCREEN)
  {
    if (screenfx_busy())
      return;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_STAGE)
  {
    if (stage_busy())
      return;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_ANIM)
  {
    if (anim_busy())
      return;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_BTLUP)
  {
    if (btlprim_busy())
      return;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_M7T)
  {
    if (m7_rot_busy())
      return;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_M7)
  {
    if (m7_busy())
      return;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_TIMER)
  {
    if (p_wait_timer)
    {
      p_wait_timer--;
      return;
    }
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_KEY)
  {
    u8 code = keyin_scan(p_keyin_mask, padsDown(0));

    if (!code)
      return;
    vm.vars16[p_keyin_dst] = code;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode != VM_WAIT_NONE)
    return; /* TEXTBOX/CHOICE: impossible here (datagen refuses them) */
  pvm_swap();
  vm_step();
  pvm_swap();
}
