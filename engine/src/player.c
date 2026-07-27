/*
 * player.c — module top-down : inputs, mouvement + collision, metasprite,
 * interaction.
 *
 * Position de départ et dimensions de map : depuis les données de scène
 * (SceneCtx). Gfx : feuille de sprites globale (data_assets.c), frames
 * 16x24 en blocs de personnage RM2003 — joueur = bloc 0.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "player.h"
#include "camera.h"
#include "actors.h"
#include "vm.h"
#include "vram.h"

/* Sprite sets (data_assets.c) — compilés PAR SCÈNE par datagen (v0.5) :
   frames 16x24 en blocs de personnage de 12 (modèle RM2003), seuls les
   blocs utilisés par la scène sont chargés (slot local s → palette OBJ s,
   joueur = slot 0). Tables indexées par sprite_set_id (header octet 27) —
   tableaux de pointeurs : indexation fiable chez tcc (pattern scene_table). */
extern const u8 *const sprite_chars[];
extern const u16 *const sprite_chars_sizes[];
extern const u16 *const sprite_pals[];

/* ids OAM du joueur : 2 OBJs 16x16 empilés (id * 4, structure PVSnesLib) */
#define PLAYER_OAM_TOP 0
#define PLAYER_OAM_BOT 4

/* Priorité OBJ 2 : au-dessus des tiles BG basse priorité en mode 1 */
#define PLAYER_OBJ_PRIO 2

Player player;

/* Tile bloquante : couche collision solide OU acteur (PNJ solides).
   Les tiles de warp (COL_WARP) sont traversables. */
static u8 tile_blocked(u8 tx, u8 ty)
{
  if (scene_collision(tx, ty) == COL_SOLID)
    return 1;
  return actor_at_tile(tx, ty) != ACTOR_NONE;
}

/* Détection de warp : déclenche quand la tile CENTRALE du joueur change
   et arrive sur une tile COL_WARP (pas de re-déclenchement sur place).
   Même logique pour les déclencheurs de CONTACT (acteurs invisibles,
   spec §1.3 v0.6) : leur script part quand on marche sur leur tile. */
static u8 prev_ctx, prev_cty;
static u8 warp_pending;
static u8 warp_dest_scene, warp_dest_x, warp_dest_y;

static void check_warp(void)
{
  u8 ctx = (u8)((player.x + 8) >> 4);
  u8 cty = (u8)((player.y + 8) >> 4);
  u8 i;
  const WarpDef *w;

  if (ctx == prev_ctx && cty == prev_cty)
    return;
  prev_ctx = ctx;
  prev_cty = cty;

  if (scene_collision(ctx, cty) == COL_WARP)
  {
    w = scene_ctx.warps;
    for (i = 0; i < scene_ctx.warp_count; i++, w++)
    {
      if (w->x == ctx && w->y == cty)
      {
        warp_pending = 1;
        warp_dest_scene = w->dest_scene;
        warp_dest_x = w->dest_x;
        warp_dest_y = w->dest_y;
        return;
      }
    }
  }

  /* Déclencheur de contact ? (le script gèle le joueur dès cette frame) */
  i = actor_trigger_at(ctx, cty);
  if (i != ACTOR_NONE)
  {
    vm_start(scene_ctx.actors[i].script_offset);
    vm.script_actor = i; /* cible du ROUTE « cet event » (v0.12) */
  }
}

/* Warp scripté (opcode WARP, spec §2 v0.6) — même chemin que les tiles de
   warp : consommé par la boucle principale via player_take_warp(). */
void player_request_warp(u8 dest_scene, u8 dest_x, u8 dest_y)
{
  warp_pending = 1;
  warp_dest_scene = dest_scene;
  warp_dest_x = dest_x;
  warp_dest_y = dest_y;
}

void player_set_pos(u8 tx, u8 ty)
{
  player.x = (u16)tx << 4;
  player.y = (u16)ty << 4;
  prev_ctx = tx;
  prev_cty = ty;
  warp_pending = 0;
}

u8 player_take_warp(u8 *dest_scene, u8 *dest_x, u8 *dest_y)
{
  if (!warp_pending)
    return 0;
  warp_pending = 0;
  *dest_scene = warp_dest_scene;
  *dest_x = warp_dest_x;
  *dest_y = warp_dest_y;
  return 1;
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
   des deux tiles de la colonne cible tx, ET que le chevauchement dans la
   rangée bloquante est <= 8 px (demi-tile), on se recale verticalement
   d'1 px vers la rangée libre. Au-delà d'un demi-tile, le joueur "vise"
   cette rangée : on bloque franchement (sinon il glisserait autour des PNJ
   et ne pourrait jamais leur faire face en approche décalée — trouvé au
   harnais d'émulation). */
static void slide_v(u8 tx)
{
  u8 ty1 = player.y >> 4;
  u8 ty2 = (player.y + 15) >> 4;
  u8 ov = player.y & 15; /* chevauchement dans la rangée basse */

  if (ty1 == ty2)
    return;
  if (tile_blocked(tx, ty1) && !tile_blocked(tx, ty2))
  {
    /* rangée haute bloque : chevauchement haut = 16 - ov */
    if (16 - ov <= 8 && !blocked(player.x, player.y + 1))
      player.y++;
  }
  else if (!tile_blocked(tx, ty1) && tile_blocked(tx, ty2))
  {
    if (ov <= 8 && !blocked(player.x, player.y - 1))
      player.y--;
  }
}

/* Symétrique pour un mouvement vertical bloqué : recalage horizontal. */
static void slide_h(u8 ty)
{
  u8 tx1 = player.x >> 4;
  u8 tx2 = (player.x + 15) >> 4;
  u8 ov = player.x & 15;

  if (tx1 == tx2)
    return;
  if (tile_blocked(tx1, ty) && !tile_blocked(tx2, ty))
  {
    if (16 - ov <= 8 && !blocked(player.x + 1, player.y))
      player.x++;
  }
  else if (!tile_blocked(tx1, ty) && tile_blocked(tx2, ty))
  {
    if (ov <= 8 && !blocked(player.x - 1, player.y))
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
  if (i == ACTOR_NONE)
  {
    /* rien en face : un event « sous le héros » sous nos pieds ?
       (coffre au sol, priorité below — v0.14) */
    i = actor_standing_at((u8)((player.x + 8) >> 4),
                          (u8)((player.y + 8) >> 4));
  }
  if (i != ACTOR_NONE)
    actor_interact(i);
}

void player_init(void)
{
  player_set_pos(scene_ctx.player_start_x, scene_ctx.player_start_y);
  player.dir = DIR_DOWN;
  player.moving = 0;
  player.anim_frame = 0;
  player.anim_timer = 0;

  /* Sprite set de la scène + CGRAM OBJ complète (une palette par slot de
     bloc), sprites 16x16 par défaut (2 OBJs empilés par frame). Appelé
     écran éteint (boot et warps) : transferts sûrs. */
  oamInitGfxSet((u8 *)sprite_chars[scene_ctx.sprite_set_id],
                *sprite_chars_sizes[scene_ctx.sprite_set_id],
                (u8 *)sprite_pals[scene_ctx.sprite_set_id], 128 * 2,
                0, VRAM_OBJ_GFX, OBJ_SIZE16_L32);

  oamSet(PLAYER_OAM_TOP, player.x, player.y, PLAYER_OBJ_PRIO, 0, 0, 0, 0);
  oamSet(PLAYER_OAM_BOT, player.x, player.y, PLAYER_OBJ_PRIO, 0, 0, 0, 0);
  oamSetEx(PLAYER_OAM_TOP, OBJ_SMALL, OBJ_SHOW);
  oamSetEx(PLAYER_OAM_BOT, OBJ_SMALL, OBJ_SHOW);
}

void player_update(void)
{
  u16 pad = padsCurrent(0);
  u16 max_x = (((u16)scene_ctx.map_w << 4)) - 16;
  u16 max_y = (((u16)scene_ctx.map_h << 4)) - 16;

  /* Garde anti-parasites : gauche+droite ou haut+bas simultanés = lecture
     pad invalide (open bus, manette débranchée) — frame ignorée */
  if ((pad & (KEY_LEFT | KEY_RIGHT)) == (KEY_LEFT | KEY_RIGHT) ||
      (pad & (KEY_UP | KEY_DOWN)) == (KEY_UP | KEY_DOWN))
    pad = 0;

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

  check_warp();

  if (padsDown(0) & KEY_A)
    player_try_interact();

  /* Cycle de marche RM2003 : anim_frame 0-3 → repos, pas A, repos, pas B
     (avance toutes les 8 frames de mouvement) */
  if (player.moving)
  {
    player.anim_timer++;
    if (player.anim_timer >= 8)
    {
      player.anim_timer = 0;
      player.anim_frame = (player.anim_frame + 1) & 3;
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
  /* phase du cycle 0-3 → pas affiché : 0, A, 0, B (pas d'indexation de
     tableau : tcc-816 est fragile sur les symboles tableau) */
  u8 add = (player.anim_frame & 1) ? (u8)(1 + (player.anim_frame >> 1)) : 0;
  /* joueur = bloc 0 : frame = dir*3 + pas, palette OBJ 0 */
  u8 f = (u8)(player.dir * 3 + add);

  /* 2 OBJs empilés, ancrés 8 px au-dessus de la tile (tête façon RM2003) —
     un y négatif enroule au-delà de 224 : les lignes hautes disparaissent,
     les basses reviennent en haut d'écran = clipping correct au bord */
  oamSet(PLAYER_OAM_TOP, sx, sy - SPRITE_Y_OVERLAP, PLAYER_OBJ_PRIO, 0, 0,
         OBJ_TOP_TILE(f), 0);
  oamSet(PLAYER_OAM_BOT, sx, sy + 16 - SPRITE_Y_OVERLAP, PLAYER_OBJ_PRIO, 0, 0,
         OBJ_BOTTOM_TILE(f), 0);
}
