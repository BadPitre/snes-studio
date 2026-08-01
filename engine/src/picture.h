/*
 * picture.h — full-screen pictures, RM2003 style: an indexed image of
 * at most 16 colours shown on BG1 by the "show a picture" event
 * command (SHOWPIC), closed again by HIDEPIC.
 */
#ifndef PICTURE_H
#define PICTURE_H

#include <snes.h>

/* Shows picture `id` full screen: BG2 and the sprites are hidden, BG3
   (dialogues, widgets) stays on top — a message can play OVER the
   image. An out-of-range id is ignored. */
void picture_show(u8 id);

/* Closes the image: reloads the scene's tileset (chars and palettes)
   and redraws the tilemap window. Event positions and states are
   UNTOUCHED — nothing else is reloaded. */
void picture_hide(void);

/* Deferred request from the VM (SHOWPIC/HIDEPIC): the transition is
   applied by the main loop through picture_apply(), the same model as
   the scripted warp (player_take_warp). x/y are a SCREEN position in
   pixels — the image sits at the top-left of its map and is placed by
   the BG1 scroll — clamped to the image's real dimensions. flags bit 2
   centres it, letting the engine do the arithmetic. dur is the frame
   count of EACH fade (0 instant). The VM resolves the variables (bits
   0-1 of the opcode) BEFORE the call. */
void picture_request(u8 show, u8 id, u8 x, u8 y, u8 flags, u8 dur);
void picture_apply(void);

/* Slides the displayed image towards (x,y) over `dur` frames (0 jumps).
   It only records a state, so it is safe from vm_update; the scroll
   advances frame by frame in picture_apply. NON-blocking, like RM2003's
   Move Picture. flags bit 2 centres it. Ignored with no image shown. */
void picture_move(u8 x, u8 y, u8 flags, u8 dur);

/* BG1 scroll of the image — called every VBlank by the main loop while
   picture_active(). */
void picture_vblank(void);

/* 1 while an image is displayed: the main loop freezes map streaming
   and the BG1 scroll for the duration. */
u8 picture_active(void);

/* Forgets without restoring (a warp during an image: scene_load will
   reload everything anyway) — it only puts the TM layers back. */
void picture_reset(void);

#endif /* PICTURE_H */
