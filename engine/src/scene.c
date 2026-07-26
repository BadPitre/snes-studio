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

/* Scene Table (data_scenes.c) */
extern const SceneDef *const scene_table[];
extern const u16 scene_count;

/* Assets globaux v0 (data_assets.c) — un seul tileset pour toutes les scènes */
extern const u8 tileset[];
extern const u16 tileset_size;
extern const u16 tileset_pal[];

/* Layout VRAM (adresses en words) — spec §4 */
#define VRAM_BG1_MAP 0x0000 /* tilemap SC_64x64 : 4 écrans 32x32, 8 Ko */
#define VRAM_BG1_GFX 0x2000 /* characters 4bpp */

SceneCtx scene_ctx;

/*
 * Shadow WRAM du tilemap BG1, layout SNES SC_64x64 : 4 écrans consécutifs de
 * 32x32 mots (0=haut-gauche, 1=haut-droit, 2=bas-gauche, 3=bas-droit).
 * 4096 mots = 8 Ko, transféré en une fois écran éteint (hors budget frame).
 */
static u16 bg_map_buffer[4096];

/* Halt debug : on ne doit jamais arriver ici avec des données valides. */
static void scene_halt(void)
{
  while (1)
  {
  }
}

/*
 * Construit le tilemap BG 64x64 chars depuis les indices metatiles 16x16.
 * Convention v0 (spec §0.4) : valeur du tilemap = index du char 8x8, affiché
 * répété 2x2. Entrée BG : char brut (palette 0, pas de flip, priorité 0).
 */
static void scene_build_bg_map(void)
{
  const u8 *tm = scene_ctx.tilemap;
  u16 mx, my, bx, by, entry, screen, ofs;

  for (my = 0; my < scene_ctx.map_h; my++)
  {
    for (mx = 0; mx < scene_ctx.map_w; mx++)
    {
      entry = *tm++;
      /* 4 entrées BG (2x2 chars) pour couvrir le metatile */
      for (by = my << 1; by <= (my << 1) + 1; by++)
      {
        for (bx = mx << 1; bx <= (mx << 1) + 1; bx++)
        {
          /* Adressage SC_64x64 : écran de 0x400 mots + position 32x32 */
          screen = (bx >> 5) + ((by >> 5) << 1);
          ofs = (screen << 10) + ((by & 31) << 5) + (bx & 31);
          bg_map_buffer[ofs] = entry;
        }
      }
    }
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

  /* Tileset + palette (16 couleurs, entrée 0) puis tilemap — écran éteint,
     donc transferts DMA sûrs (forced blank) */
  bgInitTileSet(0, (u8 *)tileset, (u8 *)tileset_pal, 0, tileset_size, 16 * 2,
                BG_16COLORS, VRAM_BG1_GFX);
  bgSetMapPtr(0, VRAM_BG1_MAP, SC_64x64);

  scene_build_bg_map();
  dmaCopyVram((u8 *)bg_map_buffer, VRAM_BG1_MAP, 4096 * 2);
}
