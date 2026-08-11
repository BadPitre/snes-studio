/*
 * btlprim.h — the battle PRIMITIVES (design doc
 * PLANNING_COMBAT_EN_EVENTS.md §2): the four generic services the VM
 * cannot do well itself, each an event command. Everything that
 * DECIDES — the loop, the formulas, the AI — lives in the project's
 * events; this module only serves.
 *
 *  - BTLPOSE: a 32x32 battler cell on the composed screen, in one of
 *    4 slots (chars 448+, OAM 104-107). Which DATABASE entry a slot
 *    shows is an argument: the party is the script's data.
 *  - POPUP: a number in white 8x8 digits that rises and fades
 *    (the C4 damage popup, from a constant or a variable).
 *  - CLOCK: gauge lanes served every frame — vars16[base+2i] +=
 *    vars16[base+2i+1]/4, saturating at 255. The gauges are ORDINARY
 *    variables: scripts read them, widgets draw them.
 *  - TARGETSEL: a cursor over the stage's slots (or the posed party),
 *    with the C3 pulse/blink feedback, result into a variable.
 */
#ifndef BTLPRIM_H
#define BTLPRIM_H

#include <snes.h>

/* BTLPOSE: show (op 1) or hide (op 0) the battler of `entry` (a row of
   the database's `heroes` table) in `slot` (0-3), at pixel (x,y).
   Ignored without an open composed screen — the stage discipline.
   A slot showing a new entry queues the cell upload; btlprim_busy()
   covers it. */
void btlprim_pose(u8 slot, u8 entry, u8 x, u8 y, u8 op);

/* 1 while a queued battler upload has not landed (the VM waits). */
u8 btlprim_busy(void);

/* POPUP: v in digits at screen (x,y), risen then gone (48 frames).
   One at a time — the newer number replaces the older, the C4 rule. */
void btlprim_popup(u16 v, u8 x, u8 y);

/* CLOCK: serve n lanes of (gauge, speed) variable pairs from base;
   n = 0 stops the service. Runs anywhere, not only on a stage. */
void btlprim_clock(u8 base, u8 n);

/* TARGETSEL plumbing, driven by the VM's wait loop. begin returns the
   first candidate (0xFF: nothing to point at — the command answers 255
   without waiting). step walks (dir 0 = back, 1 = forward). end
   restores the candidate's feedback and returns the pick. */
u8 btlprim_target_begin(u8 ally);
void btlprim_target_step(u8 dir);
u8 btlprim_target_end(void);
void btlprim_target_tick(void); /* per-frame pulse/blink feedback */

/* Main loop: OAM upkeep, the clock, session reset when the stage
   closes. VBlank: spread battler-cell and digit-sheet uploads, in the
   stage_active branch after vbl_open (the btl_vblank discipline). */
void btlprim_update(void);
void btlprim_vblank(void);

#endif /* BTLPRIM_H */
