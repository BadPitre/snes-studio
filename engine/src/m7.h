/*
 * m7.h — the MODE 7 SCREEN (M7-A): a full-screen image the hardware
 * scales, for an intro, a title screen or an entry into battle.
 *
 * Mode 7 is not an effect that can be applied to an existing view: it
 * takes over the whole low half of VRAM (the tilemap in the LOW bytes of
 * $0000-$3FFF, the characters in the HIGH bytes) and it has ONE layer.
 * BG2 and BG3 do not exist there — so no dialogue, no HUD, no scenery
 * underneath. Hence a screen of its own rather than an option.
 *
 * The OBJ region at $4000 is untouched, so the sprites keep working:
 * vignettes and animations play over the plane exactly as they do over
 * a composed screen.
 *
 * Closing is an INTERNAL WARP to the current scene, the same recipe
 * stage.c uses (see stage.h): scenery, sprites, palettes, ambience and
 * music all come back at once.
 *
 * Design and measurements: docs/PLANNING_SYSTEME_MODE7.md.
 */
#ifndef M7_H
#define M7_H

#include <snes.h>

/* The Mode 7 screen is up (the loop's *_draw calls are frozen). */
u8 m7_active(void);

/* A non-looping zoom ramp is playing — the VM waits on it. */
u8 m7_busy(void);

/* VM commands. Opening and closing happen from the MAIN LOOP under
   force blank: 32 KB is far past any VBlank budget, and there is
   nothing to show during the fade anyway. */
void m7_request_open(u8 img, u8 dur);
void m7_request_close(u8 dur);

/* WORLD MAP (M7-B, step 1 of the plan in the design doc §7.2): opens the
   plane of a `worldmap` scene. The map is stored in 16x16 BLOCKS and
   expanded here through the tileset's quadrant table — storing the
   128x128 plane would be 16 KB per map for nothing. Returns 0 when the
   scene is not a world map, so the caller can just ask. */
u8 m7_world_open(u8 scene_id, u8 dur);

/* A world map is up — as opposed to the flat image screen. The two are
   NOT interchangeable: a world map is PITCHED (perspective HDMA) and
   keeps the hero drawn; an image is flat, zoomable, and has no hero. */
u8 m7_world_active(void);

/* Puts the ordinary camera under the hero, so player_draw lands him on
   the anchor line with no Mode 7 case of its own. Called from the main
   loop AFTER camera_update, which would otherwise clamp it against the
   mode-1 map. */
void m7_world_track(void);

/* CAMERA ANGLE of the world map, in the only two numbers that describe
   it: the screen line the ground vanishes into, and the one drawn 1:1
   where the hero stands. Their difference is the tilt — a large gap is a
   gentle, almost top-down view, a small one a low raking one. The scene
   carries its own; this changes it mid-game (opcode M7VIEW). Inert on an
   image screen, which has no ground to tilt. */
void m7_view(u8 horizon, u8 anchor);

/* ROTATION of the world map, 16 steps of 22.5 degrees around the hero.
   Costs nothing per frame: the four per-scanline coefficients are
   compiled by datagen as two PAIRED tables (A+B, C+D — adjacent
   registers, HDMA mode 3) and read straight from ROM, so turning the
   view is two pointer writes and only two channels — which is what
   leaves one for the dialogue band on a turning map. Inert when the
   scene did not ask for rotation (opt-in, ~28 KB of ROM per map at 16
   steps) and after m7_view, whose new pitch makes the compiled tables
   wrong. */
void m7_rotate(u8 angle);

/* TURNS to an angle over `frames`, walking the steps itself and taking
   the SHORT way round. This is what makes a rotation read as smooth: the
   step count buys resolution, this buys motion, and neither costs
   anything per frame. frames = 0 turns as fast as the steps allow.
   A plain m7_rotate cancels a turn in progress. */
void m7_rotate_to(u8 angle, u8 frames);

/* A turn is under way — the VM waits on it. */
u8 m7_rot_busy(void);

/* The open map carries rotation tables and they are still valid. */
u8 m7_rot_ready(void);

/* THE DIALOGUE BAND. Mode 7 has one layer and no BG3, so a textbox has
   nowhere to be drawn — the way out is to leave Mode 7 for the lines it
   occupies. `top` is the first screen line of that mode-1 band; 0 closes
   it. Called by textbox.c at every open and close, inert off a world
   map; works on every world map, turning or not, since the paired
   rotation freed a channel. The cost is stated rather than hidden: the
   plane is not drawn in the band, so under the box the ground gives way
   to the backdrop. */
void m7_ui_band(u8 top);

/* INVERSE PROJECTION — where on screen the plane point (px, py) is being
   drawn right now, pitch and rotation included. This is what an NPC
   needs and the hero does not: the camera is placed under the hero, so
   he always lands on the anchor. Returns 0 when the point is behind the
   camera or off screen; on 1 the CENTRE of the sprite is in m7_pjx and
   m7_pjy — globals rather than out-parameters, which under tcc-816 would
   cost more than the arithmetic itself.
   Two divisions and four multiplications: see actors_draw_m7 for why
   only a few NPCs get one per frame. */
u8 m7_project(u16 px, u16 py);
extern u16 m7_pjx;
extern u16 m7_pjy;

/* Plays a compiled zoom ramp (datagen turns "from 100% to 150% in 90
   frames" into one 8.8 value per frame). flags bit 0 = loop. A looping
   ramp NEVER blocks a script — as with animations, waiting on it would
   never end. Ramp 0xFF stops the current one where it stands. */
void m7_zoom(u8 ramp, u8 flags);
#define M7_ZOOM_LOOP 0x01
#define M7_ZOOM_STOP 0xFF

/* Opening and closing from the main loop (the picture/stage recipe). */
void m7_apply(void);
/* Close requested: the loop runs the internal warp (do_warp). */
u8 m7_take_close(void);
/* Reset without restoring (a real warp during the screen) — scene_load
   reloads everything behind it. */
void m7_reset(void);

/* One ramp step (main loop) plus the matrix write (VBlank). */
void m7_update(void);
void m7_vblank(void);

#endif /* M7_H */
