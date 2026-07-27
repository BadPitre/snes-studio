/*
 * actors.c — acteurs de scène (PNJ statiques v0).
 *
 * Tout vient de la table d'acteurs de la scène (spec §1.3) : position en
 * tiles, sprite_id (SLOT de bloc de personnage dans le sprite set de la
 * scène — datagen remappe les blocs projet vers les slots locaux, v0.5),
 * direction. Frame affichée = slot*12 + dir*3 (repos), palette OBJ =
 * slot. Metasprite 16x24 = 2 OBJs 16x16 empilés.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "camera.h"
#include "actors.h"
#include "vm.h"

/* OAM : joueur = ids 0 et 4 ; acteur i = ids (2+2i)*4 (haut) et (3+2i)*4
   (bas) — structure OAM PVSnesLib, id = index d'objet * 4 */
#define ACTOR_OAM_TOP(i) ((((u16)(i) << 1) + 2) << 2)
#define ACTOR_OAM_BOT(i) ((((u16)(i) << 1) + 3) << 2)
#define ACTOR_OBJ_PRIO 2

/* frame de repos d'un acteur : bloc*12 + dir*3 (pas d'anim v0) */
#define ACTOR_FRAME(a) ((u8)((a)->sprite_id * 12 + (a)->direction * 3))

/* Slots OAM réservés aux acteurs (1..ACTOR_SLOTS) — les slots au-delà du
   nombre d'acteurs de la scène sont cachés (résidus d'une scène plus
   peuplée après un warp) */
#define ACTOR_SLOTS 24

void actors_init(void)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < ACTOR_SLOTS; i++)
  {
    oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
    oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
  }

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    oamSet(ACTOR_OAM_TOP(i), 0, 240, ACTOR_OBJ_PRIO, 0, 0,
           OBJ_TOP_TILE(ACTOR_FRAME(a)), a->sprite_id);
    oamSet(ACTOR_OAM_BOT(i), 0, 240, ACTOR_OBJ_PRIO, 0, 0,
           OBJ_BOTTOM_TILE(ACTOR_FRAME(a)), a->sprite_id);
    /* oamSetEx UNE SEULE FOIS ici : il réécrit la paire de bits de la table
       OAM 2 (taille + 9e bit de X). L'appeler après oamSet à chaque frame
       écraserait le 9e bit de X posé par oamSet, et un sprite partiellement
       hors écran à gauche (X négatif) réapparaîtrait à droite. */
    oamSetEx(ACTOR_OAM_TOP(i), OBJ_SMALL, OBJ_SHOW);
    oamSetEx(ACTOR_OAM_BOT(i), OBJ_SMALL, OBJ_SHOW);
    oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
    oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
  }
}

void actors_draw(void)
{
  u8 i;
  u16 ax, ay;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    ax = (u16)a->x << 4;
    ay = (u16)a->y << 4;

    /* Visible ? (metasprite 16x24 ancré 8 px au-dessus de la tile vs
       fenêtre caméra 256x224) */
    if (ax + 16 > camera.x && ax < camera.x + 256 &&
        ay + 16 > camera.y && ay < camera.y + 224 + SPRITE_Y_OVERLAP)
    {
      /* oamSet gère le 9e bit de X (positions négatives au bord gauche) */
      oamSet(ACTOR_OAM_TOP(i), ax - camera.x,
             ay - camera.y - SPRITE_Y_OVERLAP, ACTOR_OBJ_PRIO, 0, 0,
             OBJ_TOP_TILE(ACTOR_FRAME(a)), a->sprite_id);
      oamSet(ACTOR_OAM_BOT(i), ax - camera.x,
             ay - camera.y + 16 - SPRITE_Y_OVERLAP, ACTOR_OBJ_PRIO, 0, 0,
             OBJ_BOTTOM_TILE(ACTOR_FRAME(a)), a->sprite_id);
    }
    else
    {
      oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
      oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
    }
  }
}

u8 actor_at_tile(u8 tx, u8 ty)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    if (a->x == tx && a->y == ty)
      return i;
  }
  return ACTOR_NONE;
}

void actor_interact(u8 index)
{
  u16 ofs = scene_ctx.actors[index].script_offset;

  if (ofs != SCRIPT_NONE)
    vm_start(ofs);
}
