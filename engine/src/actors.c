/*
 * actors.c — acteurs de scène (PNJ statiques v0).
 *
 * Tout vient de la table d'acteurs de la scène (spec §1.3) : position en
 * tiles, sprite_id (frame de base dans la feuille OBJ globale), direction.
 * Convention metasprite v0 : frame affichée = sprite_id + direction.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "camera.h"
#include "actors.h"
#include "vm.h"

/* OAM : joueur = id 0 ; acteur i = (1+i)*4 (structure OAM PVSnesLib) */
#define ACTOR_OAM_ID(i) (((u16)(i) + 1) << 2)
#define ACTOR_OBJ_PRIO 2

/* Slots OAM réservés aux acteurs (1..ACTOR_SLOTS) — les slots au-delà du
   nombre d'acteurs de la scène sont cachés (résidus d'une scène plus
   peuplée après un warp) */
#define ACTOR_SLOTS 24

void actors_init(void)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < ACTOR_SLOTS; i++)
    oamSetVisible(ACTOR_OAM_ID(i), OBJ_HIDE);

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    oamSet(ACTOR_OAM_ID(i), 0, 240, ACTOR_OBJ_PRIO, 0, 0,
           OBJ_FRAME_TILE(a->sprite_id + a->direction), 0);
    /* oamSetEx UNE SEULE FOIS ici : il réécrit la paire de bits de la table
       OAM 2 (taille + 9e bit de X). L'appeler après oamSet à chaque frame
       écraserait le 9e bit de X posé par oamSet, et un sprite partiellement
       hors écran à gauche (X négatif) réapparaîtrait à droite. */
    oamSetEx(ACTOR_OAM_ID(i), OBJ_SMALL, OBJ_SHOW);
    oamSetVisible(ACTOR_OAM_ID(i), OBJ_HIDE);
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

    /* Visible ? (sprite 16x16 vs fenêtre caméra 256x224) */
    if (ax + 16 > camera.x && ax < camera.x + 256 &&
        ay + 16 > camera.y && ay < camera.y + 224)
    {
      /* oamSet gère le 9e bit de X (positions négatives au bord gauche) */
      oamSet(ACTOR_OAM_ID(i), ax - camera.x, ay - camera.y, ACTOR_OBJ_PRIO,
             0, 0, OBJ_FRAME_TILE(a->sprite_id + a->direction), 0);
    }
    else
    {
      oamSetVisible(ACTOR_OAM_ID(i), OBJ_HIDE);
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
