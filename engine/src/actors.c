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

/* PNJ mobiles (v0.11) — état runtime par slot. La position ROM (tile)
   n'est que le point de départ : la position vraie vit ici, en pixels. */
static u16 actor_px[ACTOR_SLOTS];
static u16 actor_py[ACTOR_SLOTS];
static u8 actor_step[ACTOR_SLOTS];  /* pixels restants du pas en cours */
static u8 actor_anim[ACTOR_SLOTS];  /* frame de marche 0-3 (comme joueur) */
static u8 actor_timer[ACTOR_SLOTS]; /* frames avant la prochaine décision */
static u16 mv_seed;                 /* xorshift 16-bit (aléatoire) */
static u8 mv_phase;                 /* vitesse PNJ : 1 px 1 frame sur 2 */

static u16 mv_rand(void)
{
  mv_seed ^= mv_seed << 7;
  mv_seed ^= mv_seed >> 9;
  mv_seed ^= mv_seed << 8;
  return mv_seed;
}

/* Tile runtime d'un slot (centre du corps, comme le joueur) */
#define ACTOR_TX(i) ((u8)((actor_px[i] + 8) >> 4))
#define ACTOR_TY(i) ((u8)((actor_py[i] + 8) >> 4))

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
    actor_px[i] = 0;
    actor_py[i] = 0;
    actor_step[i] = 0;
    actor_anim[i] = 0;
    actor_timer[i] = (u8)(20 + i * 13); /* décale les décisions */
  }
  mv_seed = 0xACE1; /* jamais 0 (xorshift) — init EXPLICITE (tcc) */
  mv_phase = 0;
  actors_resolve_pages();

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    if (i < ACTOR_SLOTS)
    {
      actor_dirs[i] = a->direction;
      actor_px[i] = (u16)a->x << 4;
      actor_py[i] = (u16)a->y << 4;
    }
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
    if (i < ACTOR_SLOTS)
    {
      ax = actor_px[i];
      ay = actor_py[i];
    }
    else
    {
      ax = (u16)a->x << 4;
      ay = (u16)a->y << 4;
    }

    /* Visible ? (metasprite 16x24 ancré 8 px au-dessus de la tile vs
       fenêtre caméra 256x224) */
    if (ax + 16 > camera.x && ax < camera.x + 256 &&
        ay + 16 > camera.y && ay < camera.y + 224 + SPRITE_Y_OVERLAP)
    {
      u8 d = (i < ACTOR_SLOTS) ? actor_dirs[i] : a->direction;
      u8 f = ACTOR_FRAME(a, d);

      /* anim de marche (même motif que le joueur : pas A, repos, pas B,
         repos) pendant un pas */
      if (i < ACTOR_SLOTS && actor_step[i])
        f += (actor_anim[i] & 1) ? (u8)(1 + (actor_anim[i] >> 1)) : 0;

      /* oamSet gère le 9e bit de X (positions négatives au bord gauche) */
      oamSet(ACTOR_OAM_TOP(i), ax - camera.x,
             ay - camera.y - SPRITE_Y_OVERLAP, ACTOR_OBJ_PRIO, 0, 0,
             OBJ_TOP_TILE(f), a->sprite_id);
      oamSet(ACTOR_OAM_BOT(i), ax - camera.x,
             ay - camera.y + 16 - SPRITE_Y_OVERLAP, ACTOR_OBJ_PRIO, 0, 0,
             OBJ_BOTTOM_TILE(f), a->sprite_id);
    }
    else
    {
      oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
      oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
    }
  }
}

/* Un pas d'1 tile vers (tx,ty) est-il permis pour le slot i ? */
static u8 mv_blocked(u8 i, u8 tx, u8 ty)
{
  u8 j;

  if (tx >= scene_ctx.map_w || ty >= scene_ctx.map_h)
    return 1;
  if (scene_collision(tx, ty) == COL_SOLID)
    return 1;
  /* la tile du héros (boîte 16x16 : sa tile centrale suffit ici) */
  if (tx == (u8)((player.x + 8) >> 4) && ty == (u8)((player.y + 8) >> 4))
    return 1;
  /* les autres acteurs actifs (tile runtime, cible de pas comprise) */
  for (j = 0; j < scene_ctx.actor_count && j < ACTOR_SLOTS; j++)
  {
    if (j != i && actor_active[j] && ACTOR_TX(j) == tx && ACTOR_TY(j) == ty)
      return 1;
  }
  return 0;
}

/* Delta d'une direction (dx, dy en tiles) */
static const s8 mv_dx[4] = {0, 0, -1, 1};
static const s8 mv_dy[4] = {1, -1, 0, 0};

/* Mouvement des PNJ (v0.11) — appelé chaque frame par la boucle
   principale SAUF pendant un script ou le menu Système (gel RM2003).
   Vitesse : 1 px une frame sur deux (moitié du héros). */
void actors_update(void)
{
  u8 i, d, tx, ty, mt;
  const ActorDef *a = scene_ctx.actors;

  mv_phase ^= 1;
  if (!mv_phase)
    return;

  for (i = 0; i < scene_ctx.actor_count && i < ACTOR_SLOTS; i++, a++)
  {
    mt = (a->flags & ACTOR_MOVE_MASK) >> ACTOR_MOVE_SHIFT;
    if (mt == ACTOR_MOVE_STATIC || !actor_active[i] ||
        a->actor_type != ACTOR_TYPE_NPC_STATIC)
      continue;

    if (actor_step[i])
    {
      /* pas en cours : avancer d'1 px */
      d = actor_dirs[i];
      actor_px[i] += mv_dx[d];
      actor_py[i] += mv_dy[d];
      actor_step[i]--;
      if ((actor_step[i] & 7) == 0)
        actor_anim[i] = (u8)((actor_anim[i] + 1) & 3);
      continue;
    }

    if (actor_timer[i])
    {
      actor_timer[i]--;
      continue;
    }

    /* décision : direction du prochain pas */
    if (mt == ACTOR_MOVE_RANDOM)
    {
      d = (u8)(mv_rand() & 3);
      actor_timer[i] = (u8)(32 + (mv_rand() & 63));
    }
    else
    {
      /* va-et-vient : continuer, demi-tour si bloqué */
      d = actor_dirs[i];
      if (mt == ACTOR_MOVE_VERT && d != DIR_DOWN && d != DIR_UP)
        d = DIR_DOWN;
      if (mt == ACTOR_MOVE_HORIZ && d != DIR_LEFT && d != DIR_RIGHT)
        d = DIR_RIGHT;
      actor_timer[i] = 8;
    }
    tx = (u8)(ACTOR_TX(i) + mv_dx[d]);
    ty = (u8)(ACTOR_TY(i) + mv_dy[d]);
    if (mv_blocked(i, tx, ty))
    {
      if (mt != ACTOR_MOVE_RANDOM)
        actor_dirs[i] = d ^ 1; /* demi-tour (DOWN<->UP, LEFT<->RIGHT) */
      continue;
    }
    actor_dirs[i] = d;
    actor_step[i] = 16;
  }
}

u8 actor_at_tile(u8 tx, u8 ty)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < scene_ctx.actor_count; i++, a++)
  {
    if (a->actor_type != ACTOR_TYPE_NPC_STATIC)
      continue;
    if (i < ACTOR_SLOTS)
    {
      /* position RUNTIME (PNJ mobiles, v0.11) */
      if (actor_active[i] && ACTOR_TX(i) == tx && ACTOR_TY(i) == ty)
        return i;
    }
    else if (a->x == tx && a->y == ty)
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
