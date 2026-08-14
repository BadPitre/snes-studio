/*
 * vignette.h — animated vignettes: small SPRITE images played from
 * strips of square frames — emotes above heads ("!", "?"), held items,
 * sparkles, and the ATTACK ANIMATIONS over the monsters of a composed
 * screen. The CELL SIZE is a property of the sheet since O-C: 16x16,
 * 32x32 or 64x64 (the strip PNG's height).
 *
 * 8 simultaneous slots (H1); char and OAM bases come from the
 * generated video map (data/vidmap.h). Slots 4-7 are free everywhere
 * in OAM terms (actors end at 49), but their CHARS are shared ground,
 * documented like the other collisions: in a SCENE, the weather's
 * drops live in their band (rain or snow corrupts slots 4-7); on a
 * COMPOSED SCREEN, btl_pose (V1) draws its static battlers there — a
 * battle poses its party with vignettes OR btl_pose, never both at
 * once. Only the CURRENT frame lives in VRAM: a frame change is
 * cell^2/2 bytes of DMA (128/512/2048).
 *
 * A 16x16 or 32x32 vignette is ONE OAM entry (OBJ_SMALL/OBJ_LARGE —
 * the two sizes OBJSEL enables; player.c). A 64x64 cell is FOUR
 * 32x32 OBJs: it only lives in slot 0 or 2, and while shown it
 * FREEZES slots {s+1, s+4, s+5}, whose char blocks and OAM entries
 * display the other three quadrants (vignette.c, v_shadow).
 *
 * OBJ palettes are the SCARCE resource — in a SCENE: character sets
 * take 0-4 and the weather takes 7, leaving TWO (5 and 6). On a
 * COMPOSED SCREEN only the popup digits' palette (4, btlprim.c) is
 * spoken for, so SEVEN are in the pool. Palettes are allocated PER
 * SHEET and not per slot: several slots showing the SAME vignette
 * share one. That is what makes animation layers free in palette
 * terms. The limit that remains: 2 DISTINCT sheets at once in a
 * scene (7 on a composed screen); beyond it vig_show is ignored and
 * anim_play refuses.
 *
 * Anchoring: the screen (fixed), the hero (follows the player, for
 * emotes), or an ACTOR (follows an event — how animations anchor).
 * Vignettes persist across scenes and work on the map AND on a composed
 * screen; during a full-screen picture, which borrows the whole OBJ
 * region, they are suspended and come back when it closes.
 *
 * The animation player (anim.c) BORROWS these slots: a frame-by-frame
 * animation is a vignette whose cell, position and sound change every
 * frame. It sets its ownership flag (vig_own_anim); a scripted vig_show
 * clears it, which tells the player its slot has been preempted.
 */
#ifndef VIGNETTE_H
#define VIGNETTE_H

#include <snes.h>

#define VIG_SLOTS 8
#define VIG_PALS 8 /* OBJ palette TABLE size; the allowed POOL depends on
                      context — 5-6 in a scene, all 8 on a composed
                      screen (see pal_allowed in vignette.c) */

#define VIG_ANC_SCREEN 0
#define VIG_ANC_HERO 1
#define VIG_ANC_ACTOR 2

/* Shows vignette vig_id in the slot, frame 0, without animation.
   anchor: 0 is a screen position (x,y), 1 sticks it to the hero, where
   x,y are SIGNED offsets around his head. */
void vig_show(u8 slot, u8 vig_id, u8 x, u8 y);
void vig_anchor(u8 slot, u8 anchor);

/* Anchoring on a scene actor (VIG_ANC_ACTOR plus a target). */
void vig_anchor_actor(u8 slot, u8 index);

/* Frame-by-frame control, for the animation player: the sheet's current
   cell, and the position or offset. Neither touches the internal
   animation mode (vig_play), which stays stopped. */
void vig_set_frame(u8 slot, u8 frame);
void vig_move(u8 slot, u8 x, u8 y);

/* Hides the slot's sprite WITHOUT freeing it: an animation layer that
   shows nothing this frame keeps its place (VRAM block and palette),
   otherwise another would take it between two frames. */
void vig_set_visible(u8 slot, u8 on);

/* A free slot for automatic use — the HIGHEST unoccupied one, leaving
   the low slots to scripted vig_show. 0xFF if none. */
u8 vig_free_slot(void);

/* 1 if a palette can still take this sheet: it already holds it, or one
   of the two is unused. The animation player asks BEFORE reserving its
   slots, so it never leaves an animation half posed. */
u8 vig_pal_available(u8 vig_id);

/* Slot ownership: set by the animation player, cleared by any scripted
   vig_show (preemption) and by vig_hide. */
void vig_own_anim(u8 slot);
u8 vig_is_anim(u8 slot);

/* Starts the animation: mode 0 stops (freezing the current frame), 1
   plays once AND THEN HIDES the vignette (a sword swing), 2 loops.
   speed is the display frames per image of the sheet. */
void vig_play(u8 slot, u8 mode, u8 speed);

void vig_hide(u8 slot);

/* Reloads the frames and palettes of the active slots — after anything
   that overwrites the OBJ region or the OBJ CGRAM (picture_hide,
   opening a composed screen, player_init, a warp). */
void vig_reload(void);

/* One animation step, the shadow OAM write, and the descriptor
   publication toward the dispatcher (main loop) — the cell rows fire
   from vblnmi.c's two lanes since V-NMI. */
void vig_update(void);
/* CGRAM transfers of the palettes marked dirty — VBlank tail. */
void vig_vblank(void);

#endif /* VIGNETTE_H */
