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
  const u8 *tilemap;
  const u8 *collision;
  const ActorDef *actors;
  const u8 *scripts;
  u8 player_start_x, player_start_y;
} SceneCtx;

extern SceneCtx scene_ctx;

/*
 * Charge la scène scene_id depuis la Scene Table : copie le header en WRAM,
 * charge tileset + palette en VRAM/CGRAM et construit + transfère le tilemap BG1.
 * À appeler écran éteint (forced blank), avant setScreenOn().
 */
void scene_load(u8 scene_id);

#endif /* SCENE_H */
