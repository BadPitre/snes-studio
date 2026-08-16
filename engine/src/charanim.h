/*
 * charanim.h — CUSTOM CHARSET ANIMATIONS (CH3): a named sequence of
 * charset frames played on the hero or on a scene actor, in the
 * character's own 16x24 body — a bow, a wave, a spin, a transformation
 * (a step may show ANOTHER charset of the scene's set). Big one-off
 * effects stay with the A1 vignette animations (anim.c).
 *
 * The engine knows no names: datagen resolves each animation used by a
 * scene into a table appended to the SCRIPT BLOCK (the CHANIM opcode
 * carries its block-relative offset), steps already flattened to
 * (frame in the scene's OBJ sheet, OBJ palette, duration):
 *
 *   [0] step count   [1] end (0 back to walk, 1 loop, 2 hold)
 *   [2 + 3k] frame   [3 + 3k] palette   [4 + 3k] duration (frames)
 *
 * While an animation runs it OWNS the target's displayed frame through
 * the override pair (actor_fovr/actor_povr, player_frame_ovr): the walk
 * steppers keep running underneath but the draw paths show the override
 * — movement during an animation is legal, and a `normal` end falls
 * back into the walk mid-stride. The overrides carry their PALETTE
 * because a cross-charset step must wear its own block's colours (the
 * OAM attribute normally hardwires the actor's slot).
 *
 * Everything clears at scene load (actors_init) — like the walk state,
 * an animation does not survive a warp.
 */
#ifndef CHARANIM_H
#define CHARANIM_H

#include <snes.h>

/* Targets: scene actor slots 0-23, and the hero. */
#define CA_HERO 24

/* Starts (or restarts) the table at script-block offset `ofs` on the
   target; applies its first step immediately. */
void chanim_play(u8 target, u16 ofs);

/* Ends the target's animation and gives the frame back to the walk. */
void chanim_stop(u8 target);

/* Clears every animation and override — scene load (actors_init). */
void chanim_init(void);

/* 1 while an animation that CAN end is still running: `normal` until
   it clears, `hold` until its last step completes. A looping animation
   never blocks (the ANIMPLAY rule), or VM_WAIT_CHANIM would never
   finish. */
u8 chanim_busy(void);

/* One tick per display frame — main loop, scene branch. */
void chanim_update(void);

#endif /* CHARANIM_H */
