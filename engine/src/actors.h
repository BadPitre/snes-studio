/*
 * actors.h — scene actors (NPCs): drawing and interaction.
 */
#ifndef ACTORS_H
#define ACTORS_H

#include <snes.h>

#define ACTOR_NONE 0xFF

/* Exact-frame override (CH3 — the charset animation player): while
   actor_fovr[i] != 0xFF the draw paths show THAT frame of the scene's
   OBJ sheet with THAT palette, walk state ignored. Writers must drop
   the frame cache (actor_lastf[i] = 0xFF): the same frame can wear
   another palette across transitions. charanim.c is the only writer. */
extern u8 actor_fovr[];
extern u8 actor_povr[];
extern u8 actor_lastf[];

/* Initialises the module state and the actors' OAM attributes. Call
   after player_init() — the sprite sheet must be loaded. Never rely on
   statics being zeroed (docs/ENGINE_CONSTRAINTS.md §1.2). */
void actors_init(void);

/* Recomputes each event's active page. Call whenever switches or
   variables may have changed (end of script, game load). */
void actors_resolve_pages(void);

/* Mobile NPCs: one movement tick. Call every frame outside scripts and
   menus — events freeze the world, as in RM2003. */
void actors_update(void);

/* Routes (the ROUTE opcode): starts or overwrites the slot's route.
   `ofs` is the offset of the STEPS in the script block. */
void actors_set_route(u8 index, u16 ofs, u8 flags, u8 len);

/* Frequency 1-8 of the next route: set it with actors_route_freq, THEN
   bind it with actors_route_bind_freq(index). Two single-argument calls
   — see docs/ENGINE_CONSTRAINTS.md §1.6. */
void actors_route_freq(u8 freq);
void actors_route_bind_freq(u8 index);

/* Scripted positions: place an actor on a tile (SETPOS), swap two
   actors (SWAPPOS). Both cut the walk step in progress. */
void actors_set_pos(u8 index, u8 tx, u8 ty);
void actors_swap_pos(u8 a, u8 b);

/* 1 while a non-repeating route is still running (WAITROUTE). */
u8 actors_routes_busy(void);

/* Writes the actors' metasprites into the shadow OAM, every frame.
   Off-screen actors are hidden. */
void actors_draw(void);

/* Same job on a Mode 7 WORLD MAP, where a sprite's screen position has
   to be projected through the pitch (and the rotation) rather than read
   off the camera. Costly enough that it only reaches a few actors per
   frame, round robin — see the comment on the definition. */
void actors_draw_m7(void);

/* Drops the "already showing" caches: opening a world map hides all 128
   OBJs behind the draw loop's back. */
void actors_draw_reset(void);

/* Index of the NPC (type npc, blocking) standing on tile (tx,ty), or
   ACTOR_NONE. Triggers (touch/auto) are invisible and walkable, so they
   do not count here. */
u8 actor_at_tile(u8 tx, u8 ty);

/* Index of the TOUCH trigger (type 0x02, with a script) on the tile, or
   ACTOR_NONE — its script fires when the hero steps on it. */
u8 actor_trigger_at(u8 tx, u8 ty);

/* Event "below the hero" on this tile (below priority) — interaction
   while standing on it. */
u8 actor_standing_at(u8 tx, u8 ty);

/* Script offset of the scene's AUTO trigger (type 0x03), or
   SCRIPT_NONE — run once when the scene loads. */
u16 actors_autorun(void);

/* Interaction (the A button, facing the actor): turns the NPC towards the
   hero, an RM2003 reflex, and runs its script on the VM if it has one. */
void actor_interact(u8 index);

/* Current facing of an actor (WRAM — FACE and turn-to-hero) */
void actor_face(u8 index, u8 dir);

/* PIXEL (world) position of an actor — the anchor of animations. */
u16 actor_pos_x(u8 index);
u16 actor_pos_y(u8 index);

#endif /* ACTORS_H */
