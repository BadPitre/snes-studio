/*
 * player.c — module top-down : inputs, mouvement + collision, metasprite,
 * interaction.
 *
 * Position de départ et dimensions de map : depuis les données de scène
 * (SceneCtx). Gfx : feuille de sprites globale (data_assets.c, frames 0-3).
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "player.h"
#include "camera.h"
#include "actors.h"
#include "vram.h"

/* Feuille de sprites globale (data_assets.c) : frames 16x16 directionnelles,
   joueur = frames 0-3 */
extern const u8 sprite_gfx[];
extern const u16 sprite_gfx_size;
extern const u16 sprite_pal[];

/* id OAM du joueur (id * 4 à cause de la structure OAM PVSnesLib) */
#define PLAYER_OAM_ID 0

/* Priorité OBJ 2 : au-dessus des tiles BG basse priorité en mode 1 */
#define PLAYER_OBJ_PRIO 2

Player player;

/* Tile bloquante : couche collision OU acteur (les PNJ sont solides) */
static u8 tile_blocked(u8 tx, u8 ty)
{
  if (scene_collision(tx, ty))
    return 1;
  return actor_at_tile(tx, ty) != ACTOR_NONE;
}

/* AABB 16x16 : la position cible (px,py) chevauche-t-elle du solide ?
   Un pas fait 1 px, la boîte couvre au plus 2 tiles par axe (4 coins). */
static u8 blocked(u16 px, u16 py)
{
  u8 tx1 = px >> 4, ty1 = py >> 4;
  u8 tx2 = (px + 15) >> 4, ty2 = (py + 15) >> 4;

  if (tile_blocked(tx1, ty1) || tile_blocked(tx2, ty1) ||
      tile_blocked(tx1, ty2) || tile_blocked(tx2, ty2))
    return 1;
  return 0;
}

/* Glissement anti-coin : si un mouvement horizontal est bloqué par UN seul
   des deux tiles de la colonne cible tx, on se recale verticalement d'1 px
   vers la rangée libre au lieu de rester coincé. */
static void slide_v(u8 tx)
{
  u8 ty1 = player.y >> 4;
  u8 ty2 = (player.y + 15) >> 4;

  if (ty1 == ty2)
    return;
  if (tile_blocked(tx, ty1) && !tile_blocked(tx, ty2))
  {
    if (!blocked(player.x, player.y + 1))
      player.y++;
  }
  else if (!tile_blocked(tx, ty1) && tile_blocked(tx, ty2))
  {
    if (!blocked(player.x, player.y - 1))
      player.y--;
  }
}

/* Symétrique pour un mouvement vertical bloqué : recalage horizontal. */
static void slide_h(u8 ty)
{
  u8 tx1 = player.x >> 4;
  u8 tx2 = (player.x + 15) >> 4;

  if (tx1 == tx2)
    return;
  if (tile_blocked(tx1, ty) && !tile_blocked(tx2, ty))
  {
    if (!blocked(player.x + 1, player.y))
      player.x++;
  }
  else if (!tile_blocked(tx1, ty) && tile_blocked(tx2, ty))
  {
    if (!blocked(player.x - 1, player.y))
      player.x--;
  }
}

/* Bouton A : interaction avec l'acteur sur la tile face au joueur */
static void player_try_interact(void)
{
  u8 tx = (player.x + 8) >> 4;
  u8 ty = (player.y + 8) >> 4;
  u8 i;

  if (player.dir == DIR_LEFT)
  {
    if (tx == 0)
      return;
    tx--;
  }
  else if (player.dir == DIR_RIGHT)
    tx++;
  else if (player.dir == DIR_UP)
  {
    if (ty == 0)
      return;
    ty--;
  }
  else
    ty++;

  i = actor_at_tile(tx, ty);
  if (i != ACTOR_NONE)
    actor_interact(i);
}

void player_init(void)
{
  player.x = (u16)scene_ctx.player_start_x << 4; /* tiles → pixels */
  player.y = (u16)scene_ctx.player_start_y << 4;
  player.dir = DIR_DOWN;
  player.moving = 0;
  player.anim_frame = 0;
  player.anim_timer = 0;

  /* Feuille de sprites + palette OBJ 0, sprites 16x16 par défaut */
  oamInitGfxSet((u8 *)sprite_gfx, sprite_gfx_size, (u8 *)sprite_pal, 16 * 2, 0,
                VRAM_OBJ_GFX, OBJ_SIZE16_L32);

  oamSet(PLAYER_OAM_ID, player.x, player.y, PLAYER_OBJ_PRIO, 0, 0, 0, 0);
  oamSetEx(PLAYER_OAM_ID, OBJ_SMALL, OBJ_SHOW);
}

void player_update(void)
{
  u16 pad = padsCurrent(0);
  u16 max_x = (((u16)scene_ctx.map_w << 4)) - 16;
  u16 max_y = (((u16)scene_ctx.map_h << 4)) - 16;

  player.moving = 0;

  /* 4 directions exclusives, 1 px/frame, collision AABB + glissement */
  if (pad & KEY_LEFT)
  {
    player.dir = DIR_LEFT;
    player.moving = 1;
    if (player.x > 0)
    {
      if (!blocked(player.x - 1, player.y))
        player.x--;
      else
        slide_v((player.x - 1) >> 4);
    }
  }
  else if (pad & KEY_RIGHT)
  {
    player.dir = DIR_RIGHT;
    player.moving = 1;
    if (player.x < max_x)
    {
      if (!blocked(player.x + 1, player.y))
        player.x++;
      else
        slide_v((player.x + 16) >> 4);
    }
  }
  else if (pad & KEY_UP)
  {
    player.dir = DIR_UP;
    player.moving = 1;
    if (player.y > 0)
    {
      if (!blocked(player.x, player.y - 1))
        player.y--;
      else
        slide_h((player.y - 1) >> 4);
    }
  }
  else if (pad & KEY_DOWN)
  {
    player.dir = DIR_DOWN;
    player.moving = 1;
    if (player.y < max_y)
    {
      if (!blocked(player.x, player.y + 1))
        player.y++;
      else
        slide_h((player.y + 16) >> 4);
    }
  }

  if (padsDown(0) & KEY_A)
    player_try_interact();

  /* Pseudo-anim de marche : bascule anim_frame toutes les 8 frames de
     mouvement, utilisée comme flip horizontal en haut/bas (frames dédiées
     de marche quand les assets seront générés, Phase 2) */
  if (player.moving)
  {
    player.anim_timer++;
    if (player.anim_timer >= 8)
    {
      player.anim_timer = 0;
      player.anim_frame ^= 1;
    }
  }
  else
  {
    player.anim_timer = 0;
    player.anim_frame = 0;
  }
}

void player_draw(void)
{
  u16 sx = player.x - camera.x;
  u16 sy = player.y - camera.y;
  u8 hflip = 0;

  if (player.anim_frame && (player.dir == DIR_DOWN || player.dir == DIR_UP))
    hflip = 1;

  /* frame par direction : tiles {2d, 2d+1, 2d+16, 2d+17} → gfxoffset = dir*2 */
  oamSet(PLAYER_OAM_ID, sx, sy, PLAYER_OBJ_PRIO, hflip, 0,
         (u16)player.dir << 1, 0);
}
