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
#include "player.h"
#include "vm.h"

/* OAM : joueur = ids 0 et 4 ; acteur i = ids (2+2i)*4 (haut) et (3+2i)*4
   (bas) — structure OAM PVSnesLib, id = index d'objet * 4 */
#define ACTOR_OAM_TOP(i) ((((u16)(i) << 1) + 2) << 2)
#define ACTOR_OAM_BOT(i) ((((u16)(i) << 1) + 3) << 2)
#define ACTOR_OBJ_PRIO 2

/* frame de repos d'un acteur : bloc*12 + dir*3 (pas d'anim v0). La
   direction vit en WRAM (FACE, se tourner vers le héros) — la valeur ROM
   n'est que l'état initial. */
#define ACTOR_FRAME(a, d) ((u8)((a)->sprite_id * 12 + (d) * 3))

/* Slots OAM réservés aux acteurs (1..ACTOR_SLOTS) — les slots au-delà du
   nombre d'acteurs de la scène sont cachés (résidus d'une scène plus
   peuplée après un warp) */
#define ACTOR_SLOTS 24

/* Directions runtime (WRAM) — FACE et « se tourner vers le héros » */
static u8 actor_dirs[ACTOR_SLOTS];

/* Pages actives (v0.10) : 1 = cette entrée est la page active de son
   event. Recalculé au chargement et après chaque script (les switches
   ont pu changer) — voir actors_resolve_pages(). */
static u8 actor_active[ACTOR_SLOTS];

/* La condition de cette page passe-t-elle ? (spec §1.3 v0.10) */
static u8 page_cond_ok(const ActorDef *a)
{
  switch (a->flags & ACTOR_COND_MASK)
  {
  case ACTOR_COND_SW_ON:
    return vm_switch_get(a->cond_idx);
  case ACTOR_COND_SW_OFF:
    return !vm_switch_get(a->cond_idx);
  case ACTOR_COND_VAR_GEQ:
    return vm.vars16[a->cond_idx & 255] >= a->cond_val;
  default:
    return 1;
  }
}

/* Par GROUPE de pages (entrées consécutives liées par CONTINUATION), la
   DERNIÈRE page dont la condition passe est active — modèle RM2003 (la
   page de plus haut numéro l'emporte). Les OBJ des pages désactivées
   sont cachés ici (actors_draw ne touche plus qu'aux pages actives). */
void actors_resolve_pages(void)
{
  u8 i, j, start, win;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < scene_ctx.actor_count && i < ACTOR_SLOTS; i = j)
  {
    start = i;
    win = 255;
    for (j = start;
         j < scene_ctx.actor_count && j < ACTOR_SLOTS &&
         (j == start || (a[j].flags & ACTOR_FLAG_CONT));
         j++)
    {
      if (page_cond_ok(&a[j]))
        win = j;
    }
    for (i = start; i < j; i++)
    {
      if (actor_active[i] && i != win)
      {
        oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
        oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
      }
      actor_active[i] = (i == win);
    }
  }
}

/* Apparence : sprite_id 0xFF = invisible (spec §1.3 v0.8). Un event de
   contact/auto PEUT avoir une apparence (coffre visible…) — il reste
   traversable, « sous le héros » comme dans RM2003. */
#define ACTOR_VISIBLE(a) ((a)->sprite_id != 0xFF)

void actors_init(void)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < ACTOR_SLOTS; i++)
  {
    oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
    oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
    actor_dirs[i] = DIR_DOWN;
    actor_active[i] = 0;
  }
  actors_resolve_pages();

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    if (i < ACTOR_SLOTS)
      actor_dirs[i] = a->direction;
    if (!ACTOR_VISIBLE(a))
      continue;
    oamSet(ACTOR_OAM_TOP(i), 0, 240, ACTOR_OBJ_PRIO, 0, 0,
           OBJ_TOP_TILE(ACTOR_FRAME(a, a->direction)), a->sprite_id);
    oamSet(ACTOR_OAM_BOT(i), 0, 240, ACTOR_OBJ_PRIO, 0, 0,
           OBJ_BOTTOM_TILE(ACTOR_FRAME(a, a->direction)), a->sprite_id);
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
    if (!ACTOR_VISIBLE(a))
      continue;
    if (i < ACTOR_SLOTS && !actor_active[i])
      continue; /* page inactive : OBJ déjà cachés par resolve_pages */
    ax = (u16)a->x << 4;
    ay = (u16)a->y << 4;

    /* Visible ? (metasprite 16x24 ancré 8 px au-dessus de la tile vs
       fenêtre caméra 256x224) */
    if (ax + 16 > camera.x && ax < camera.x + 256 &&
        ay + 16 > camera.y && ay < camera.y + 224 + SPRITE_Y_OVERLAP)
    {
      u8 d = (i < ACTOR_SLOTS) ? actor_dirs[i] : a->direction;

      /* oamSet gère le 9e bit de X (positions négatives au bord gauche) */
      oamSet(ACTOR_OAM_TOP(i), ax - camera.x,
             ay - camera.y - SPRITE_Y_OVERLAP, ACTOR_OBJ_PRIO, 0, 0,
             OBJ_TOP_TILE(ACTOR_FRAME(a, d)), a->sprite_id);
      oamSet(ACTOR_OAM_BOT(i), ax - camera.x,
             ay - camera.y + 16 - SPRITE_Y_OVERLAP, ACTOR_OBJ_PRIO, 0, 0,
             OBJ_BOTTOM_TILE(ACTOR_FRAME(a, d)), a->sprite_id);
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
    if (a->actor_type == ACTOR_TYPE_NPC_STATIC && a->x == tx && a->y == ty &&
        (i >= ACTOR_SLOTS || actor_active[i]))
      return i;
  }
  return ACTOR_NONE;
}

u8 actor_trigger_at(u8 tx, u8 ty)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    if (a->actor_type == ACTOR_TYPE_TRIGGER && a->x == tx && a->y == ty &&
        a->script_offset != SCRIPT_NONE &&
        (i >= ACTOR_SLOTS || actor_active[i]))
      return i;
  }
  return ACTOR_NONE;
}

u16 actors_autorun(void)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    if (a->actor_type == ACTOR_TYPE_AUTO && a->script_offset != SCRIPT_NONE &&
        (i >= ACTOR_SLOTS || actor_active[i]))
      return a->script_offset;
  }
  return SCRIPT_NONE;
}

void actor_face(u8 index, u8 dir)
{
  if (index < ACTOR_SLOTS && index < scene_ctx.actor_count)
    actor_dirs[index] = dir & 3;
}

void actor_interact(u8 index)
{
  u16 ofs = scene_ctx.actors[index].script_offset;

  /* Réflexe RM2003 : le PNJ se tourne vers le héros (direction opposée —
     DOWN<->UP et LEFT<->RIGHT s'échangent par xor 1) */
  actor_face(index, player.dir ^ 1);

  if (ofs != SCRIPT_NONE)
    vm_start(ofs);
}
