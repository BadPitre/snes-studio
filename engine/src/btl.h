/*
 * btl.h — the battle screen (design doc PLANNING_SYSTEME_COMBAT.md).
 *
 * Milestone C1: the screen STANDS. The composed-screen machinery draws
 * the backdrop and poses the troop's monsters; the party's battlers
 * ride four OBJ cells uploaded through the vignette recipe; HP land in
 * reserved variables so the project's own widgets can display them.
 * B closes — the composed screen's internal warp restores the scene.
 *
 * The clock, the queues and the menus are C2. What C1 fixes for good
 * is the OWNERSHIP: the engine drives the screen, the data drives the
 * content, and the project's UI layer draws the windows.
 */
#ifndef BTL_H
#define BTL_H

#include <snes.h>

/* Reserved battle variables (C0 §6): the UI widgets bind to these.
   Per hero h (0-3): BTL_VAR_BASE + h*2 = current HP, +1 = max HP. */
#define BTL_VAR_BASE 240

/* A battle is up (any phase, opening and closing included). */
u8 btl_active(void);

/* The BATTLE opcode: opens the screen on a troop. Ignored when one is
   already up or the troop does not exist. */
void btl_request(u8 troop);

/* Main loop: drives the phases (pose, upload, wait, close). */
void btl_update(void);

/* VBlank: uploads the party's OBJ cells, under the budget (vbl_take).
   Call in the stage_active branch, AFTER vbl_open. */
void btl_vblank(void);

#endif /* BTL_H */
