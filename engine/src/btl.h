/*
 * btl.h — the battle screen (design doc PLANNING_SYSTEME_COMBAT.md).
 *
 * C1: the screen stands. C2: it fights — the ATB clock, the command
 * menu (the project's own cursor-list widget), the built-in attack,
 * KO, victory/defeat and rewards. The engine owns the clock and the
 * queues; the database owns the numbers; the project's UI layer draws
 * every window.
 */
#ifndef BTL_H
#define BTL_H

#include <snes.h>

/* Reserved battle variables (C0 §6): the UI widgets bind to these.
   Per hero h (0-3): BTL_VAR_BASE + h*2 = current HP, +1 = max HP.
   After the battle: ISSUE = 1 victory / 2 defeat, XP and GOLD carry
   the summed rewards — the post-battle event branches and spends them. */
#define BTL_VAR_BASE 240
#define BTL_VAR_ISSUE 248
#define BTL_VAR_XP 249
#define BTL_VAR_GOLD 250

/* Reserved switch, raised as the battle closes. A scene change ENDS the
   running script (the engine's warp invariant — even scripted warps),
   so the commands after `battle` in the calling event never run. The
   post-battle sequence is therefore an AUTO event page conditioned on
   this switch, which turns it back off — the RM2003 reflex. */
#define BTL_SW_DONE 500

/* A battle is up (any phase, opening and closing included). */
u8 btl_active(void);

/* The BATTLE opcode: opens the screen on a troop. Ignored when one is
   already up or the troop does not exist. */
void btl_request(u8 troop);

/* Main loop: drives the phases (pose, upload, the fight, close). */
void btl_update(void);

/* VBlank: uploads the party's OBJ cells, under the budget (vbl_take).
   Call in the stage_active branch, AFTER vbl_open. */
void btl_vblank(void);

#endif /* BTL_H */
