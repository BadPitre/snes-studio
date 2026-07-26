/*
 * player.c — module top-down : inputs, mouvement, metasprite.
 *
 * Position de départ et dimensions de map : depuis les données de scène
 * (SceneCtx). Gfx joueur : depuis data_assets.c (données globales v0).
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "player.h"
#include "camera.h"
#include "vram.h"

/* Gfx joueur (data_assets.c) : 4 frames 16x16, une par direction DIR_* */
extern const u8 player_gfx[];
extern const u16 player_gfx_size;
extern const u16 player_pal[];

/* id OAM du joueur (id * 4 à cause de la structure OAM PVSnesLib) */
#define PLAYER_OAM_ID 0

/* Priorité OBJ 2 : au-dessus des tiles BG basse priorité en mode 1 */
#define PLAYER_OBJ_PRIO 2

Player player;

void player_init(void)
{
  player.x = (u16)scene_ctx.player_start_x << 4; /* tiles → pixels */
  player.y = (u16)scene_ctx.player_start_y << 4;
  player.dir = DIR_DOWN;
  player.moving = 0;
  player.anim_frame = 0;
  player.anim_timer = 0;

  /* Gfx + palette OBJ 0, sprites 16x16 par défaut */
  oamInitGfxSet((u8 *)player_gfx, player_gfx_size, (u8 *)player_pal, 16 * 2, 0,
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

  /* 4 directions exclusives, 1 px/frame (kit semaine 2) */
  if (pad & KEY_LEFT)
  {
    player.dir = DIR_LEFT;
    player.moving = 1;
    if (player.x > 0)
      player.x--;
  }
  else if (pad & KEY_RIGHT)
  {
    player.dir = DIR_RIGHT;
    player.moving = 1;
    if (player.x < max_x)
      player.x++;
  }
  else if (pad & KEY_UP)
  {
    player.dir = DIR_UP;
    player.moving = 1;
    if (player.y > 0)
      player.y--;
  }
  else if (pad & KEY_DOWN)
  {
    player.dir = DIR_DOWN;
    player.moving = 1;
    if (player.y < max_y)
      player.y++;
  }

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
