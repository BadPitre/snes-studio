/*
 * scene.c — chargement data-driven d'une scène depuis le format binaire
 * (spec §1) : Scene Table à $82:8000, structures à pointeurs far 24-bit.
 *
 * Le moteur ne contient AUCUNE donnée de jeu : tout vient des banks de
 * données générées par tools/datagen. Format far 24-bit dans les
 * structures : [bank][addr lo][addr hi].
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "rom_layout.h"
#include "vram.h"

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

/* Lit un pointeur far 24-bit du format binaire (spec §1.2) */
static const u8 *read_far(const u8 *p)
{
  return FAR_PTR(p[0], (u16)p[1] | ((u16)p[2] << 8));
}

u8 scene_boot_id(void)
{
  const u8 *tbl = FAR_PTR(BANK_SCENES, BANK_BASE_ADDR);

  return tbl[2]; /* Scene Table v0.2 : boot_scene_id à l'offset 2 */
}

void scene_load(u8 scene_id)
{
  const u8 *tbl = FAR_PTR(BANK_SCENES, BANK_BASE_ADDR);
  u16 scene_count = (u16)tbl[0] | ((u16)tbl[1] << 8);
  const u8 *entry;
  const u8 *h;

  if (scene_id >= scene_count)
    scene_halt();

  /* Entrée de table : { bank (u8), addr (u16), reserved } — spec §1.1 */
  entry = tbl + 4 + ((u16)scene_id << 2);
  h = FAR_PTR(entry[0], (u16)entry[1] | ((u16)entry[2] << 8));

  /* Le champ scene_type est vérifié dès la v0, même avec un seul type */
  if (h[0] != SCENE_TYPE_TOP_DOWN)
    scene_halt();

  /* Scene Header (spec §1.2) → copie WRAM + pointeurs résolus */
  scene_ctx.scene_type = h[0];
  scene_ctx.map_w = h[2];
  scene_ctx.map_h = h[3];
  scene_ctx.tilemap = read_far(h + 4);
  scene_ctx.collision = read_far(h + 7);
  scene_ctx.actors = (const ActorDef *)read_far(h + 10);
  scene_ctx.scripts = read_far(h + 13);
  scene_ctx.actor_count = h[16];
  scene_ctx.player_start_x = h[17];
  scene_ctx.player_start_y = h[18];

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
