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

/* Palette BG (data_assets.c) — pour restaurer la couleur du jalon S3 */
extern const u16 tileset_pal[];

/* OAM : joueur = id 0 ; acteur i = (1+i)*4 (structure OAM PVSnesLib) */
#define ACTOR_OAM_ID(i) (((u16)(i) + 1) << 2)
#define ACTOR_OBJ_PRIO 2

/*
 * Jalon semaine 3 : l'interaction bascule la couleur 2 de la palette BG
 * (le vert clair de l'herbe) vers un rouge de debug — preuve visible que le
 * hook acteur → réaction fonctionne. Remplacé par vmStart() en semaine 4.
 * L'écriture CGRAM est différée au VBlank (actors_vblank).
 */
#define DEBUG_HOOK_COLOR 0x001C /* rouge (BGR555) */
static u8 hook_pending;
static u8 hook_state;

void actors_init(void)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  /* Init explicite : la mise à zéro des statiques par le crt0 n'est pas
     fiable sur cette toolchain (sections .bss dupliquées par fichier) —
     c'était la cause de l'herbe rouge dès le boot. */
  hook_pending = 0;
  hook_state = 0;

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    oamSet(ACTOR_OAM_ID(i), 0, 240, ACTOR_OBJ_PRIO, 0, 0,
           ((u16)a->sprite_id + a->direction) << 1, 0);
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
             0, 0, ((u16)a->sprite_id + a->direction) << 1, 0);
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
  /* Semaine 4 : vmStart(scene_ctx.actors[index].script_offset) */
  (void)index;
  hook_state ^= 1;
  hook_pending = 1;
}

void actors_vblank(void)
{
  if (hook_pending)
  {
    hook_pending = 0;
    if (hook_state)
    {
      setPaletteColor(2, DEBUG_HOOK_COLOR);
    }
    else
    {
      setPaletteColor(2, tileset_pal[2]);
    }
  }
}
