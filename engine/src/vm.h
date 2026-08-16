/*
 * vm.h — the bytecode VM (spec §2): NPC and dialogue interaction.
 */
#ifndef VM_H
#define VM_H

#include <snes.h>
#include "formats.h"

/* wait_mode — spec §2 */
#define VM_WAIT_NONE 0
#define VM_WAIT_KEY 1     /* KEYIN: waiting for an allowed key */
#define VM_WAIT_TEXTBOX 2 /* waiting for the textbox to close (A) */
#define VM_WAIT_CHOICE 3  /* CHOICE: cursor up/down, A confirms */
#define VM_WAIT_ROUTE 4   /* WAITROUTE: routes finished */
#define VM_WAIT_TIMER 5   /* WAIT: frame counter */
#define VM_WAIT_CAM 6     /* WAITCAM: camera pan finished */
#define VM_WAIT_SCREEN 7  /* SCRHIDE/SCRSHOW: fade finished */
#define VM_WAIT_STAGE 8   /* STAGEPOSE/CLEAR: transfer finished */
#define VM_WAIT_LIST 9    /* LISTSEL: cursor menu — A confirms,
                             B cancels when allowed, wraps top/bottom */
#define VM_WAIT_ANIM 10   /* ANIMPLAY "wait for the end": non-looping
                             frame-by-frame animations */
#define VM_WAIT_M7 11     /* M7ZOOM "wait for the end": a non-looping
                             Mode 7 zoom ramp */
#define VM_WAIT_M7T 12    /* M7TURN "wait for the end": a world map's
                             animated rotation */
/* 13 was VM_WAIT_BATTLE — freed in C4: BATTLE ends the script. */
#define VM_WAIT_TARGET 13 /* TARGETSEL: the target cursor (V1) */
#define VM_WAIT_BTLUP 14  /* BTLPOSE: a battler cell upload (V1) */
#define VM_WAIT_CHANIM 15 /* CHANIM "wait for the end": a looping
                             charset animation never blocks (the
                             ANIMPLAY rule — chanim_busy ignores it) */

/* VM state (WRAM) — spec §2. The C representation has no bank field:
   the scene's script block is already a far pointer (scene_ctx.scripts)
   and pc is an offset into it. */
typedef struct
{
  u8 active;    /* 0 = inactive */
  u8 wait_mode; /* VM_WAIT_* */
  u16 pc;       /* offset in the scene's script block */
  u8 vars[64];  /* scene variables (reset on scene load) */
  u8 gvars[64]; /* global variables (persist across scenes) */
  u8 switches[64];  /* 512 switches (bits), persistent */
  u16 vars16[256];  /* 256 16-bit variables, persistent */
  u8 wait_timer;   /* frames left on the WAIT */
  u8 script_actor; /* actor that started the script (0xFF none) — the
                      target of a ROUTE aimed at "this event" */
  u16 call_stack[8]; /* CALL return addresses */
  u8 call_sp;
  u8 list_widget; /* U3-b: the widget the open list belongs to, so its
      hooks can be found (0xFF = none) */
  u8 call_fb[8];   /* frame base saved per call */
  u16 frame[VM_FRAME_SLOTS]; /* parameters of the functions in progress */
  u8 frame_base;   /* first slot of the current function */
  u8 frame_sp;     /* top of the frame stack */
  u16 retval;      /* value returned by the last RETF */
  u16 keyin_mask;  /* KEYIN: allowed keys (bit 1<<code) */
  u8 keyin_dst;    /* KEYIN: destination variable of the key code */
  u8 choice_var;   /* destination variable of the CHOICE in progress */
  u8 choice_count; /* option count (2-4) — shared with LISTSEL */
  u8 choice_sel;   /* option under the cursor */
  u8 list_flags;   /* LISTSEL: bit 0 = B cancels (var = 255),
                      bit 1 = leave the widget shown on close,
                      bit 2 = Left/Right exit (var = 254/253) */
} VmState;

extern VmState vm;

/* Full init (boot): vars and gvars zeroed, VM inactive. */
void vm_init(void);

/* Scene change: vars reset (spec §2), gvars kept. */
void vm_scene_reset(void);

/* Starts a script: pc is an offset into the current scene's block. */
void vm_start(u16 offset);

/* 1 while a script has control (the player is frozen). */
u8 vm_active(void);

/* Switches (0-511) — exposed for saves and for conditional event
   pages. */
u8 vm_switch_get(u16 idx);
void vm_switch_set(u16 idx, u8 on);

/* AUTO common events: every scene's script block opens with the table
   [n] then n x [type u8][switch u16][offset u16]. Returns the offset of
   the first AUTORUN common event (type 0) whose switch is ON, or
   SCRIPT_NONE. Call it when the VM is free: the script restarts while
   the switch stays ON — RM2003's model, where turning the switch off is
   the script's job. */
u16 vm_common_auto(void);

/* Battle hook (C4): offset of common event `ce`'s body in the current
   scene's block (a type-2 CETAB entry), or SCRIPT_NONE. */
u16 vm_common_hook(u8 ce);

/* U3-b — runs a WIDGET HOOK to completion, right now. `ce` is the
   common event datagen synthesised from the command block written on
   the widget; 0xFF does nothing. A hook may not block (datagen refuses
   a blocking command in one), so it runs SYNCHRONOUSLY inside the
   caller — no third context to unwind on a scene change — and it never
   re-enters. The execution state of whoever was running is saved and
   put back. */
void vm_ui_hook(u8 ce);

/* PARALLEL common events (type 1): one step of the background context,
   every frame outside the System menu. Does not freeze the player, is
   restarted while its switch is ON, and forbids MSG/CHOICE (datagen). */
void vm_parallel_update(void);
void vm_parallel_reset(void);

/* Call every frame while the VM is active: routes inputs to the textbox
   when a blocking opcode is waiting, otherwise runs the immediate
   opcodes (guard rail: at most 32 per frame). */
void vm_update(void);

#endif /* VM_H */
