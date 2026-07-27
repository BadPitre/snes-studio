/*
 * scene.h — chargement de scène et contexte WRAM de la scène courante.
 * Réf : docs/SPEC_FORMATS.md §3.
 */
#ifndef SCENE_H
#define SCENE_H

#include <snes.h>
#include "formats.h"

/* Copie WRAM du header + pointeurs résolus (spec §3) */
typedef struct
{
  u8 scene_type;
  u8 map_w, map_h;
  u8 actor_count;
  const u8 *tilemap;       /* couche inférieure (BG2) */
  const u8 *tilemap_upper; /* couche supérieure (BG1) — spec §1.2 v0.3 */
  const u8 *collision;
  const ActorDef *actors;
  const u8 *scripts;
  const WarpDef *warps;
  u8 warp_count;
  u8 music_id;   /* index soundbank, MUSIC_NONE = silence */
  u8 tileset_id; /* gfx_set_id : index dans les tables gfx_* (data_assets.c,
                    gfx compilés par scène — v0.4) */
  u8 sprite_set_id; /* index dans les tables sprite_* (sprites compilés par
                       scène — v0.5, header octet 27) */
  u8 scene_id; /* index dans la Scene Table (sauvegardes, spec §4 v0.7) */
  u8 player_start_x, player_start_y;
} SceneCtx;

extern SceneCtx scene_ctx;

/* Scène de boot — lue dans la Scene Table binaire (donnée, pas moteur) */
u8 scene_boot_id(void);

/*
 * Charge la scène scene_id depuis la Scene Table : copie le header en WRAM,
 * charge tileset + palette en VRAM/CGRAM et construit + transfère le tilemap BG1.
 * À appeler écran éteint (forced blank), avant setScreenOn().
 */
void scene_load(u8 scene_id);

/* Couche collision (spec §1.4) : 0 = traversable, sinon solide. */
u8 scene_collision(u8 tx, u8 ty);

#endif /* SCENE_H */
