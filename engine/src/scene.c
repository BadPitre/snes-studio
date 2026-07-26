/*
 * scene.c — chargement data-driven d'une scène.
 *
 * Le moteur ne contient AUCUNE donnée de jeu : tout vient de la Scene Table
 * (data_scenes.c) et des assets globaux (data_assets.c), accédés via pointeurs
 * far. Seul le layout VRAM ci-dessous est un choix du moteur
 * (docs/SPEC_FORMATS.md §4).
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "vram.h"

/* Scene Table (data_scenes.c) */
extern const SceneDef *const scene_table[];
extern const u16 scene_count;

/* Assets globaux v0 (data_assets.c) — un seul tileset pour toutes les scènes */
extern const u8 tileset[];
extern const u16 tileset_size;
extern const u16 tileset_pal[];

SceneCtx scene_ctx;

/* Halt debug : on ne doit jamais arriver ici avec des données valides. */
static void scene_halt(void)
{
  while (1)
  {
  }
}

void scene_load(u8 scene_id)
{
  const SceneDef *def;

  if (scene_id >= scene_count)
    scene_halt();

  def = scene_table[scene_id];

  /* Le champ scene_type est vérifié dès la v0, même avec un seul type */
  if (def->scene_type != SCENE_TYPE_TOP_DOWN)
    scene_halt();

  scene_ctx.scene_type = def->scene_type;
  scene_ctx.map_w = def->map_w;
  scene_ctx.map_h = def->map_h;
  scene_ctx.actor_count = def->actor_count;
  scene_ctx.tilemap = def->tilemap;
  scene_ctx.collision = def->collision;
  scene_ctx.actors = def->actors;
  scene_ctx.scripts = def->scripts;
  scene_ctx.player_start_x = def->player_start_x;
  scene_ctx.player_start_y = def->player_start_y;

  /* Tileset + palette (16 couleurs, entrée 0) — écran éteint, donc
     transferts DMA sûrs (forced blank). Le remplissage du tilemap est fait
     par map_init() une fois la caméra positionnée. */
  bgInitTileSet(0, (u8 *)tileset, (u8 *)tileset_pal, 0, tileset_size, 16 * 2,
                BG_16COLORS, VRAM_BG1_GFX);
  bgSetMapPtr(0, VRAM_BG1_MAP, SC_64x64);
}

u8 scene_collision(u8 tx, u8 ty)
{
  return scene_ctx.collision[(u16)ty * scene_ctx.map_w + tx];
}
