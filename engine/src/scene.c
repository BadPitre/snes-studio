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
#include "map.h"
#include "effectlayer.h"
#include "weather.h"

/* GFX sets (data_assets.c) — compilés PAR SCÈNE par datagen (v0.4 : seules
   les tiles utilisées par la scène sont en VRAM, palettes multiples bakées
   dans les entrées BG). Tables indexées par gfx_set_id (header octet 1).
   Tableaux de pointeurs : indexation fiable chez tcc (pattern scene_table),
   contrairement aux tableaux u16 nus (« FISHY length <> PTR_SIZE »). */
extern const u8 *const gfx_chars[];
extern const u16 *const gfx_chars_sizes[];
extern const u16 *const gfx_metas[];
extern const u8 *const gfx_prios[];
extern const u16 *const gfx_pals[];

SceneCtx scene_ctx;

/* Grilles décompressées en WRAM (v0.7) : les scènes voyagent en RLE dans
   la ROM (spec §1.6) et sont dépliées ici au chargement — budget 8192
   cellules par grille (validé par datagen).
   DÉFINIES EN ASSEMBLEUR (../wram7f.asm), en bank $7F : le .bss de tcc-816
   ne dispose que de $7E:2000-$7FFF ; au-delà il recouvre silencieusement
   l'OAM shadow de PVSnesLib. Voir spec §6 et wram7f.asm. */
#define MAP_BUF_CELLS 8192
extern u8 scn_lower[MAP_BUF_CELLS];
extern u8 scn_upper[MAP_BUF_CELLS];
extern u8 scn_col[MAP_BUF_CELLS];

/* RLE (spec §1.6) : paires [count 1-255][valeur] jusqu'à cells octets */
static void rle_decode(u8 *dst, const u8 *src, u16 cells)
{
  u16 i = 0;
  u8 n, v;

  while (i < cells)
  {
    n = *src++;
    v = *src++;
    while (n--)
      dst[i++] = v;
  }
}

/* Halt debug : on ne doit jamais arriver ici avec des données valides.
   Écran ROUGE plein : identifiable immédiatement au harnais. */
static void scene_halt(void)
{
  u16 red = 0x001F;

  setBrightness(15);
  dmaCopyCGram((u8 *)&red, 0, 2);
  while (1)
  {
  }
}

/* Lit un pointeur far 24-bit du format binaire (spec §1.2) */
static const u8 *read_far(const u8 *p)
{
  return make_far(p[0], (u16)p[1] | ((u16)p[2] << 8));
}

u8 scene_boot_id(void)
{
  const u8 *tbl = make_far(BANK_SCENES, BANK_BASE_ADDR);

  return tbl[2]; /* Scene Table v0.2 : boot_scene_id à l'offset 2 */
}

void scene_load(u8 scene_id)
{
  const u8 *tbl = make_far(BANK_SCENES, BANK_BASE_ADDR);
  u16 scene_count = (u16)tbl[0] | ((u16)tbl[1] << 8);
  const u8 *entry;
  const u8 *h;

  if (scene_id >= scene_count)
    scene_halt();

  /* Entrée de table : { bank (u8), addr (u16), reserved } — spec §1.1 */
  entry = tbl + 4 + ((u16)scene_id << 2);
  h = make_far(entry[0], (u16)entry[1] | ((u16)entry[2] << 8));

  /* Le champ scene_type est vérifié dès la v0, même avec un seul type */
  if (h[0] != SCENE_TYPE_TOP_DOWN)
    scene_halt();

  /* Scene Header (spec §1.2) → copie WRAM + pointeurs résolus */
  scene_ctx.scene_type = h[0];
  scene_ctx.map_w = h[2];
  scene_ctx.map_h = h[3];
  scene_ctx.actors = (const ActorDef *)read_far(h + 10);
  scene_ctx.scripts = read_far(h + 13);
  scene_ctx.actor_count = h[16];
  scene_ctx.player_start_x = h[17];
  scene_ctx.player_start_y = h[18];
  scene_ctx.tileset_id = h[1];
  scene_ctx.music_id = h[19];
  scene_ctx.warps = (const WarpDef *)read_far(h + 20);
  scene_ctx.warp_count = h[23];
  scene_ctx.sprite_set_id = h[27]; /* v0.5 : sprites compilés par scène */
  scene_ctx.scene_id = scene_id; /* sauvegardes (spec §4bis v0.7) */

  /* Grilles RLE → WRAM (spec §1.6 v0.7) : inf, collision, sup */
  {
    u16 cells = (u16)scene_ctx.map_w * scene_ctx.map_h;

    if (cells > MAP_BUF_CELLS)
      scene_halt(); /* datagen valide la limite : données corrompues */
    rle_decode(scn_lower, read_far(h + 4), cells);
    rle_decode(scn_col, read_far(h + 7), cells);
    rle_decode(scn_upper, read_far(h + 24), cells);
    scene_ctx.tilemap = scn_lower;
    scene_ctx.collision = scn_col;
    scene_ctx.tilemap_upper = scn_upper;
  }

  /* Tileset de la scène (chars + palette + table de metatiles) — écran
     éteint, donc transferts DMA sûrs (forced blank). Le remplissage du
     tilemap est fait par map_init() une fois la caméra positionnée.
     NB : ne jamais nommer un symbole « metatiles » — collision silencieuse
     avec un symbole interne de PVSnesLib (maps.asm). */
  /* CGRAM BG complète : 8 palettes de 16 couleurs (les entrées BG portent
     les bits de palette 10-12, bakés par datagen) */
  bgInitTileSet(0, (u8 *)gfx_chars[scene_ctx.tileset_id],
                (u8 *)gfx_pals[scene_ctx.tileset_id], 0,
                *gfx_chars_sizes[scene_ctx.tileset_id], 128 * 2,
                BG_16COLORS, VRAM_BG1_GFX);
  {
    /* Couleur de FOND (CGRAM 0) forcée NOIRE (S10) : les tiles BG ne
       dessinent jamais l'index 0 — seule une cellule VIDE (gomme sur
       la couche inf) la montre. Prévisible quel que soit le tileset. */
    u16 black = 0;

    dmaCopyCGram((u8 *)&black, 0, 2);
  }
  /* Deux couches (modèle RM2003) : BG1 = sup, BG2 = inf, charset partagé */
  bgSetMapPtr(0, VRAM_BG1_MAP, SC_64x64);
  bgSetGfxPtr(1, VRAM_BG1_GFX);
  bgSetMapPtr(1, VRAM_BG2_MAP, SC_64x64);
  map_set_metatiles(gfx_metas[scene_ctx.tileset_id],
                    gfx_prios[scene_ctx.tileset_id]);
  /* Couche d'effet (S9) : si la scène en a une, BG1 est rebasé sur le
     motif — la couche sup est ignorée */
  effect_load(scene_id);
  /* météo (S13) : chars + palette rechargés par player_init — sa
     oamInitGfxSet écrase les 128 couleurs OBJ, y compris la palette 7
     des particules ; l'appel doit donc venir APRÈS */
}

u8 scene_collision(u8 tx, u8 ty)
{
  return scene_ctx.collision[(u16)ty * scene_ctx.map_w + tx];
}
