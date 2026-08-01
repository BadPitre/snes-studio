/*
 * anim.h — frame-by-frame animations, in the spirit of RPG Maker 2003's
 * Battle Animations: a sequence of frames where the author picks, for
 * each one, the CELLS shown, their POSITION and the SOUND played.
 *
 * The cell sheet is a project VIGNETTE: 32x32 OBJ chars, a dedicated
 * OBJ palette, VBlank transfer. No new graphics path — the player only
 * adds the frame track, and borrows vignette slots (4 in all, see
 * VIG_SLOTS).
 *
 * LAYERS: an animation declares 1 to 4 and therefore shows up to 4
 * cells AT ONCE. A layer costs a vignette slot but NO extra palette:
 * every cell of an animation comes from its sheet, hence from the same
 * OBJ palette — the scarcest resource here, with only two left.
 * A cell index of 0xFF means that layer shows nothing this frame,
 * which gives the flexibility of independent tracks with a single
 * timeline in the editor.
 *
 * Anchoring, as in RM2003: the screen, the hero, or a scene event. The
 * frame's offset is added to the target's position, RECOMPUTED every
 * frame — an animation posed on an NPC follows it as it walks.
 */
#ifndef ANIM_H
#define ANIM_H

#include <snes.h>
#include "vignette.h" /* the sheet IS a vignette: one slot per layer */

#define ANIM_SLOTS VIG_SLOTS   /* simultaneous animations (all single-layer) */
#define ANIM_LAYERS_MAX 4      /* layers per animation — a VRAM/OAM bound */
#define ANIM_CELL_NONE 0xFF    /* empty layer on this frame */

#define ANIM_ANC_SCREEN 0
#define ANIM_ANC_HERO 1
#define ANIM_ANC_ACTOR 2

/* Starts animation anim_id. anchor is one of ANIM_ANC_*, target the
   actor index for ANIM_ANC_ACTOR and ignored otherwise. Without enough
   free slots, the MOST ADVANCED running animation yields its place — a
   shortened animation shows less than one that never starts. Without an
   available palette (two distinct sheets already on screen), nothing is
   played rather than played in the wrong colours. */
void anim_play(u8 anim_id, u8 anchor, u8 target);

/* Stops every running animation and puts its sprites away. */
void anim_stop(void);

/* 1 while at least one NON-looping animation runs (VM_WAIT_ANIM).
   Looping animations never block a script — otherwise "wait for the
   end" would never end. */
u8 anim_busy(void);

/* One playback step — main loop, BEFORE vig_update(), which writes the
   shadow OAM from the state the player has just set. */
void anim_update(void);

#endif /* ANIM_H */
