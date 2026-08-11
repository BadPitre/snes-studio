/*
 * stage.h — the COMPOSED SCREEN: a full-screen background plus posed
 * images.
 *
 * A composed screen replaces the scene's view with a background — an
 * opaque picture on BG2 — on which the author POSES up to 5
 * transparent images on BG1, each with ITS OWN palette. That is the
 * FF-style battle screen (background plus monsters), but generic: a
 * game board, a world map, a visual novel. Dialogues, choices and
 * widgets (BG3) keep working on top; the scene's sprites (hero, NPCs)
 * are hidden for the duration, and vignettes provide the free sprites.
 *
 * Closing the screen is an INTERNAL WARP to the current scene, reusing
 * the proven do_warp recipe: scenery, sprites, palettes, ambience and
 * music all come back at once. Moved NPCs return to their pages, just
 * as after a warp — documented behaviour.
 */
#ifndef STAGE_H
#define STAGE_H

#include <snes.h>

#define STAGE_SLOTS 5

/* The composed screen is up (the loop's *_draw calls are frozen). */
u8 stage_active(void);

/* A pose or clear transfer is in progress (the VM waits on it). */
u8 stage_busy(void);

/* The slot holds a posed image (TARGETSEL walks the occupied ones). */
u8 stage_slot_used(u8 slot);

/* VM commands, deferred and spread out — never a large DMA outside the
   VBlank. trans: 0 fade, 1 instant, 2 mosaic. */
void stage_request_open(u8 backdrop_pic, u8 fade_dur, u8 trans); /* 0xFF = black */
void stage_request_close(u8 fade_dur, u8 trans);
/* Transition of the last close, for the internal warp (do_warp) */
u8 stage_close_trans(void);
void stage_pose(u8 slot, u8 pic, u8 tx, u8 ty); /* position in TILES */
void stage_clear(u8 slot);

/* PALETTE effect on a posed image — NON-blocking. fx 0 restores, 1 is a
   white flash (dur frames), 2 fades to black (death; dur frames, half
   tints), 3 darkens one notch and persists. Only THAT slot is touched:
   one palette per slot. */
void stage_slotfx(u8 slot, u8 fx, u8 dur);

/* Opening and closing from the MAIN LOOP (the picture recipe) */
void stage_apply(void);
/* Close requested: the loop runs the internal warp (do_warp) */
u8 stage_take_close(void);
/* Reset without restoring (a real warp during the screen) — the
   picture_reset recipe: scene_load reloads everything behind it */
void stage_reset(void);

/* One step of the spread-out transfers (main loop) plus VBlank writes */
void stage_update(void);
void stage_vblank(void);

#endif /* STAGE_H */
