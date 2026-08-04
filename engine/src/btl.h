/*
 * btl.h — the battle OPENER (PLANNING_COMBAT_EN_EVENTS.md, V2).
 *
 * The BATTLE command no longer runs the fight: it sets the table and
 * leaves. It opens the composed screen on the troop's backdrop, poses
 * the monsters, pours the party's stats and the troop's identity into
 * RESERVED VARIABLES, then starts the troop's intro common event —
 * which IS the battle: the project's event library (combat_tour) runs
 * the loop on the primitives (BTLPOSE/POPUP/CLOCK/TARGETSEL, LISTSEL,
 * DBREAD, functions). C1-C6's machine lived here; it now lives in the
 * project, where the author can read and rewrite it.
 */
#ifndef BTL_H
#define BTL_H

#include <snes.h>

/* Reserved battle variables — written by the opener, read (and owned
   from then on) by the event library. The UI widgets bind to these. */
#define BTL_VAR_BASE 240 /* +h*2 = hero h's current HP, +1 = max HP */
#define BTL_VAR_ISSUE 248 /* 1 victory / 2 defeat / 3 fled — LIBRARY-set */
#define BTL_VAR_XP 249    /* summed rewards — LIBRARY-set */
#define BTL_VAR_GOLD 250
#define BTL_VAR_MP 232 /* +h = hero h's current MP (starts at max) */
/* 236-239 were the engine's ATB mirror (C6). The library owns its
   gauges now (CLOCK on ordinary variables) — the block is free. */

/* Hero stats (V2): per hero h, from the Équipe window's data. */
#define BTL_VAR_ATK 208   /* +h */
#define BTL_VAR_DEF 212   /* +h */
#define BTL_VAR_MAG 216   /* +h */
#define BTL_VAR_MDEF 220  /* +h */
#define BTL_VAR_SPD 224   /* +h */
#define BTL_VAR_NHERO 231 /* party size (1-4) */

/* The troop on stage (V2): its id, and per slot i the posed monster's
   DATABASE index into the `monsters` table (65535 = empty slot) — the
   library DBREADs the stats itself (entry-from-variable). */
#define BTL_VAR_TROOP 251
#define BTL_VAR_MONID 252 /* +i, i = 0-3 */

/* Reserved switch, raised by the LIBRARY as the battle ends; the
   post-battle sequence is an AUTO page conditioned on it, which turns
   it back off — the RM2003 reflex, unchanged since C2. */
#define BTL_SW_DONE 500

/* The opener is busy (screen opening, monsters being posed). */
u8 btl_active(void);

/* The BATTLE opcode: opens the field on a troop. Ignored when one is
   already opening or the troop does not exist. */
void btl_request(u8 troop);

/* Main loop: open, pose, hand over to the intro common event. */
void btl_update(void);

#endif /* BTL_H */
