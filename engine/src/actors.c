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

/* Itinéraires (v0.12) — la route vit dans le bloc scripts de la scène,
   le slot ne garde qu'un curseur. 0xFFFF = pas de route. */
static u16 route_ofs[ACTOR_SLOTS];
static u8 route_pos[ACTOR_SLOTS];
static u8 route_len[ACTOR_SLOTS];
static u8 route_flags[ACTOR_SLOTS];
static u8 route_wait[ACTOR_SLOTS];

/* Attributs Move Route (v0.13) : vitesse 1-4 (0.5/1/2/4 px par frame),
   fréquence 1-8 (pause entre pas de route), direction figée, passe-
   muraille, graphisme changé (0xFF = celui de la page). */
static u8 actor_speed[ACTOR_SLOTS];
static u8 actor_freq[ACTOR_SLOTS];
static u8 actor_dirfix[ACTOR_SLOTS];
static u8 actor_mvdir[ACTOR_SLOTS]; /* direction du pas en cours (dirfix) */
static u8 actor_thru[ACTOR_SLOTS];
static u8 actor_gfx[ACTOR_SLOTS];
static u8 actor_prio[ACTOR_SLOTS]; /* ACTOR_PRIO_* (v0.14) */

/* ---- copie WRAM des champs ROM du chemin chaud (P3) ----
 * actors_update et actors_draw relisaient, par acteur ET par frame, le
 * type, l'apparence et le type de mouvement dans la table d'acteurs —
 * une structure en ROM, donc des accès far, les plus lents du 65816.
 * Ces champs sont CONSTANTS pour un slot (un slot = une page d'event) :
 * ils sont recopiés une fois au chargement de la scène.
 * actor_fbase évite en prime la multiplication par 12 (le 65816 n'en a
 * pas : tcc-816 appelle une routine) refaite à chaque frame pour placer
 * la frame du metasprite. */
static u8 actor_sprite[ACTOR_SLOTS]; /* sprite_id, 0xFF = invisible */
static u8 actor_kind[ACTOR_SLOTS];   /* actor_type */
static u8 actor_movet[ACTOR_SLOTS];  /* type de mouvement (flags) */
static u8 actor_fbase[ACTOR_SLOTS];  /* sprite_id * 12 : base de frame */
static u8 actor_shown[ACTOR_SLOTS];  /* OBJ actuellement visible ? */
/* Mots 1 et 3 de la paire d'entrées OAM (numéro de tile + attribut) : ils
   ne dépendent QUE de la frame affichée, de la palette et de la priorité.
   Les recalculer à chaque frame coûtait plus cher que tout le reste de la
   boucle réuni (mesuré : sans l'écriture OAM, dix PNJ tiennent les 60 fps).
   La clé de validité est la frame elle-même — pas besoin d'invalider à la
   main quand un PNJ tourne ou marche. */
static u8 actor_lastf[ACTOR_SLOTS];
static u8 actor_x9[ACTOR_SLOTS];   /* 9e bit de X posé dans la table 2 */
static u16 actor_w1[ACTOR_SLOTS];
static u16 actor_w3[ACTOR_SLOTS];

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

/* ---- tiles bloquantes précalculées (chemin chaud de la collision) ----
 * tile_blocked() du joueur interroge actor_at_tile ~10 fois par frame de
 * marche ; itérer les ActorDef à chaque appel coûtait la frame entière
 * sur une scène à pages (1 def PAR page : 7 defs = 60 → 30 fps, mesuré
 * au harnais via lag_frame_counter). La liste des PNJ bloquants (actifs,
 * priorité « comme le héros ») est reconstruite UNE fois par frame (fin
 * d'actors_update) et après chaque événement qui peut la changer
 * (resolve_pages, set_pos, swap_pos) ; actor_at_tile se réduit alors à
 * un rejet bounding box + un balayage de petits tableaux u8.
 * init EXPLICITE : tcc-816 ne remet pas le BSS à zéro. */
#define BLK_MAX (ACTOR_SLOTS + 8) /* + PNJ figés au-delà des slots */
static u8 blk_n = 0;
static u8 blk_ovf = 0; /* liste pleine : repli sur le parcours exact */
static u8 blk_tx[BLK_MAX];
static u8 blk_ty[BLK_MAX];
static u8 blk_id[BLK_MAX];
static u8 blk_x0 = 255, blk_x1 = 0, blk_y0 = 255, blk_y1 = 0;

static void actors_rebuild_blockers(void)
{
  u8 i, x, y;
  u8 k = 0;
  u8 n = scene_ctx.actor_count; /* far struct : lu UNE fois */

  blk_x0 = 255;
  blk_x1 = 0;
  blk_y0 = 255;
  blk_y1 = 0;
  blk_ovf = 0;
  for (i = 0; i < n; i++)
  {
    if (i < ACTOR_SLOTS)
    {
      if (!actor_active[i] || actor_prio[i] != ACTOR_PRIO_SAME)
        continue;
      if (actor_kind[i] != ACTOR_TYPE_NPC_STATIC)
        continue; /* copie WRAM (P3) : plus de lecture far ici */
      x = ACTOR_TX(i);
      y = ACTOR_TY(i);
    }
    else
    {
      /* au-delà des slots : PNJ figé à sa position d'édition */
      const ActorDef *a = &scene_ctx.actors[i];

      if (a->actor_type != ACTOR_TYPE_NPC_STATIC)
        continue;
      x = a->x;
      y = a->y;
    }
    if (k >= BLK_MAX)
    {
      blk_ovf = 1; /* pathologique — l'exactitude prime sur la vitesse */
      break;
    }
    blk_tx[k] = x;
    blk_ty[k] = y;
    blk_id[k] = i;
    k++;
    if (x < blk_x0)
      blk_x0 = x;
    if (x > blk_x1)
      blk_x1 = x;
    if (y < blk_y0)
      blk_y0 = y;
    if (y > blk_y1)
      blk_y1 = y;
  }
  blk_n = k;
}

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

/* Route custom d'une page (v0.14) : blob [flags][freq][len][pas...] à
   route_ofs dans le bloc scripts — appliquée quand la page devient
   active (type de mouvement « Route custom »). */
static void actors_apply_page_route(u8 i)
{
  const ActorDef *a = &scene_ctx.actors[i];
  u16 ofs;

  if (((a->flags & ACTOR_MOVE_MASK) >> ACTOR_MOVE_SHIFT) != ACTOR_MOVE_CUSTOM)
    return;
  ofs = a->route_ofs;
  if (ofs == 0xFFFF)
    return;
  actor_freq[i] = scene_ctx.scripts[ofs + 1];
  if (actor_freq[i] < 1 || actor_freq[i] > 8)
    actor_freq[i] = 3;
  actors_set_route(i, (u16)(ofs + 3), scene_ctx.scripts[ofs],
                   scene_ctx.scripts[ofs + 2]);
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
        actor_shown[i] = 0; /* l'OBJ est caché : actors_draw le sait */
        actor_lastf[i] = 0xFF; /* palette/priorité à recalculer */
        actor_x9[i] = 0xFF;
        route_ofs[i] = 0xFFFF; /* la page part, sa route aussi */
      }
      if (i == win && !actor_active[i])
      {
        actor_active[i] = 1;
        actors_apply_page_route(i); /* route custom de la page (v0.14) */
      }
      else
        actor_active[i] = (i == win);
    }
  }
  actors_rebuild_blockers(); /* les pages actives ont pu changer */
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
    route_ofs[i] = 0xFFFF;
    route_pos[i] = 0;
    route_len[i] = 0;
    route_flags[i] = 0;
    route_wait[i] = 0;
    actor_speed[i] = 1;  /* 0.5 px/frame — la vitesse v0.11 */
    actor_freq[i] = 3;   /* défaut RM2003 */
    actor_dirfix[i] = 0;
    actor_thru[i] = 0;
    actor_gfx[i] = 0xFF;
    actor_mvdir[i] = DIR_DOWN;
    actor_prio[i] = ACTOR_PRIO_SAME;
    actor_sprite[i] = 0xFF;
    actor_kind[i] = 0xFF;
    actor_movet[i] = ACTOR_MOVE_STATIC;
    actor_fbase[i] = 0;
    actor_shown[i] = 0;
    actor_lastf[i] = 0xFF;
    actor_x9[i] = 0xFF; /* invalide : force la première écriture */
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
      actor_prio[i] = a->prio_speed & 3;
      if ((a->prio_speed >> 4) >= 1 && (a->prio_speed >> 4) <= 4)
        actor_speed[i] = a->prio_speed >> 4;
      /* copie WRAM du chemin chaud (P3) : ces champs ne bougent plus */
      actor_sprite[i] = a->sprite_id;
      actor_kind[i] = a->actor_type;
      actor_movet[i] = (a->flags & ACTOR_MOVE_MASK) >> ACTOR_MOVE_SHIFT;
      actor_fbase[i] = (u8)(a->sprite_id * 12);
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
  /* Le resolve_pages ci-dessus a construit la liste des bloqueurs AVANT
     que cette boucle ne pose les positions et les priorités : elle est
     donc à refaire ici. Tant qu'actors_update la reconstruisait à chaque
     frame, l'erreur se corrigeait toute seule à la frame suivante. */
  actors_rebuild_blockers();
}

/* ---- écriture directe du couple d'OBJ d'un acteur (P3) ----
 * oamSet prend huit arguments : avec tcc-816, POSER ces arguments coûte
 * plus cher que le travail lui-même (~125 instructions par appel, deux
 * appels par acteur et par frame — mesuré au compteur de scanline).
 * Ici on écrit nous-mêmes les deux entrées de l'OAM ombre (que le NMI
 * transfère) en un seul appel.
 * Table 2 de l'OAM : 2 bits par objet, bit 0 = 9e bit de X (indispensable
 * pour un sprite qui déborde à gauche : X négatif), bit 1 = taille, qu'on
 * ne touche PAS (posée une fois par oamSetEx). Les deux OBJ d'un
 * metasprite sont consécutifs et partagent X, donc leurs deux bits
 * tombent dans le même octet — une seule lecture-modification-écriture.
 * Octet 3 : vhoopppN (priorité, palette, 9e bit du numéro de tile). */
static void actor_oam_pair(u16 id, u16 sx, u16 sy, u8 f, u8 op, u8 pal)
{
  u16 tile = OBJ_TOP_TILE(f);
  u16 attr = ((u16)pal << 1) | ((u16)op << 4);
  u8 *hi = &oamMemory[512 + (id >> 4)];
  /* Deux entrées OAM = quatre mots. Écrire en 16 bits évite huit
     écritures 8 bits ET les bascules sep/rep que tcc-816 insère autour
     de chaque opération sur un u8 (P3). L'OAM est en little-endian :
     mot 0 = X | Y<<8, mot 1 = tile bas | attribut<<8. */
  u16 *o = (u16 *)&oamMemory[id];
  u16 x8 = sx & 0xFF;
  u16 y8 = sy & 0xFF;

  o[0] = x8 | (y8 << 8);
  o[1] = (tile & 0xFF) | ((attr | (tile >> 8)) << 8);
  tile += 32; /* OBJ_BOTTOM_TILE : la rangée du dessous */
  o[2] = x8 | (((y8 + 16) & 0xFF) << 8);
  o[3] = (tile & 0xFF) | ((attr | (tile >> 8)) << 8);

  /* 9e bit de X : les deux OBJ partagent la même valeur */
  if (((id >> 2) & 3) == 0)
  {
    if (sx & 0x100)
      *hi |= 0x05;
    else
      *hi &= (u8)~0x05;
  }
  else
  {
    if (sx & 0x100)
      *hi |= 0x50;
    else
      *hi &= (u8)~0x50;
  }
}

void actors_draw(void)
{
  u8 i, ns;
  u16 ax, ay;
  /* invariants sortis de la boucle (P3) : scene_ctx et camera sont des
     structures — tcc-816 recalcule une adresse longue à CHAQUE lecture. */
  u8 n = scene_ctx.actor_count;
  u16 cx = camera.x;
  u16 cy = camera.y;
  u16 cx_max = cx + 256;
  u16 cy_max = cy + 224 + SPRITE_Y_OVERLAP;

  ns = (n > ACTOR_SLOTS) ? ACTOR_SLOTS : n;

  /* Boucle CHAUDE (P3) : les slots, entièrement en WRAM. Séparer les deux
     cas retire de chaque tour le test « i < ACTOR_SLOTS » (répété six
     fois) et l'avance du pointeur far sur la table ROM, qui ne sert plus
     ici. */
  for (i = 0; i < ns; i++)
  {
    u8 pal, d, f;

    if (!actor_active[i])
      continue; /* page inactive : OBJ déjà cachés par resolve_pages */
    pal = actor_sprite[i];
    if (pal == 0xFF)
      continue; /* invisible */
    ax = actor_px[i];
    ay = actor_py[i];

    /* Visible ? (metasprite 16x24 ancré 8 px au-dessus de la tile vs
       fenêtre caméra 256x224) */
    if (ax + 16 > cx && ax < cx_max && ay + 16 > cy && ay < cy_max)
    {
      u16 id = ACTOR_OAM_TOP(i);
      u16 *o = (u16 *)&oamMemory[id];
      u16 sx = ax - cx;
      u16 sy = (ay - cy - SPRITE_Y_OVERLAP) & 0xFF;
      u16 x8 = sx & 0xFF;

      d = actor_dirs[i];
      /* graphisme changé par la route (Change Graphic) ? */
      f = (actor_gfx[i] != 0xFF) ? (u8)(actor_gfx[i] * 12) : actor_fbase[i];
      f += (u8)(d + d + d); /* dir * 3, sans multiplication */
      /* anim de marche (même motif que le joueur : pas A, repos, pas B,
         repos) pendant un pas */
      if (actor_step[i])
        f += (actor_anim[i] & 1) ? (u8)(1 + (actor_anim[i] >> 1)) : 0;

      /* Écriture OAM INLINE (P3) : passer par une fonction coûtait, à
         cause du marshalling des arguments de tcc-816, plus que toute la
         boucle — dix PNJ passaient de 60 à 30 fps rien qu'avec l'appel. */
      if (f != actor_lastf[i])
      {
        u16 tile = OBJ_TOP_TILE(f);
        u16 attr = ((u16)pal << 1) |
                   ((u16)((actor_prio[i] == ACTOR_PRIO_ABOVE)
                              ? 3
                              : ACTOR_OBJ_PRIO)
                    << 4);

        actor_w1[i] = (tile & 0xFF) | ((attr | (tile >> 8)) << 8);
        tile += 32; /* OBJ_BOTTOM_TILE : la rangée du dessous */
        actor_w3[i] = (tile & 0xFF) | ((attr | (tile >> 8)) << 8);
        actor_lastf[i] = f;
      }
      o[0] = x8 | (sy << 8);
      o[1] = actor_w1[i];
      o[2] = x8 | (((sy + 16) & 0xFF) << 8);
      o[3] = actor_w3[i];
      /* 9e bit de X (sprite qui déborde à gauche) : les deux OBJ d'un
         metasprite sont consécutifs et partagent X, donc leurs deux bits
         tombent dans le même octet de la table 2. Un PNJ ne franchit ce
         bord que rarement : on ne touche la table qu'au changement. */
      x8 = (sx & 0x100) ? 1 : 0;
      if (x8 != actor_x9[i])
      {
        u8 *hi = &oamMemory[512 + (id >> 4)];

        actor_x9[i] = (u8)x8;
        if (((id >> 2) & 3) == 0)
        {
          if (x8)
            *hi |= 0x05;
          else
            *hi &= (u8)~0x05;
        }
        else
        {
          if (x8)
            *hi |= 0x50;
          else
            *hi &= (u8)~0x50;
        }
      }
      actor_shown[i] = 1;
    }
    else if (actor_shown[i])
    {
      /* l'OAM n'est touché qu'au moment où l'acteur SORT du champ :
         réécrire « caché » à chaque frame pour des PNJ que personne ne
         voit était l'essentiel du prix d'une scène peuplée (P3). */
      oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
      oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
      actor_shown[i] = 0;
      actor_x9[i] = 0xFF; /* oamSetVisible a repositionné l'OBJ : cache mort */
    }
  }

  /* Queue FROIDE : les PNJ au-delà des slots sont figés à leur position
     d'édition — tout vient de la ROM, il n'y a pas d'état runtime. */
  for (i = ACTOR_SLOTS; i < n; i++)
  {
    const ActorDef *a = &scene_ctx.actors[i];

    if (!ACTOR_VISIBLE(a))
      continue;
    ax = (u16)a->x << 4;
    ay = (u16)a->y << 4;
    if (ax + 16 > cx && ax < cx_max && ay + 16 > cy && ay < cy_max)
      actor_oam_pair(ACTOR_OAM_TOP(i), ax - cx, ay - cy - SPRITE_Y_OVERLAP,
                     ACTOR_FRAME(a, a->direction), ACTOR_OBJ_PRIO,
                     a->sprite_id);
    else
    {
      oamSetVisible(ACTOR_OAM_TOP(i), OBJ_HIDE);
      oamSetVisible(ACTOR_OAM_BOT(i), OBJ_HIDE);
    }
  }
}

static u8 mv_blocked(u8 i, u8 tx, u8 ty, u8 d)
{
  u8 j;

  if (tx >= scene_ctx.map_w || ty >= scene_ctx.map_h)
    return 1;
  if (actor_thru[i])
    return 0; /* passe-muraille (Through ON) : seul le bord de map bloque */
  if (COL_TYPE(scene_collision(tx, ty)) == COL_SOLID)
    return 1;
  /* côtés fermés (T1) : sortir de la tile courante par d, ou entrer
     dans la cible par le côté opposé (d ^ 1) */
  if (COL_SIDES(scene_collision(ACTOR_TX(i), ACTOR_TY(i))) & (u8)(1 << d))
    return 1;
  if (COL_SIDES(scene_collision(tx, ty)) & (u8)(1 << (d ^ 1)))
    return 1;
  /* la tile du héros — un event sous/au-dessus du héros passe (v0.14) */
  if (actor_prio[i] == ACTOR_PRIO_SAME &&
      tx == (u8)((player.x + 8) >> 4) && ty == (u8)((player.y + 8) >> 4))
    return 1;
  /* les autres acteurs actifs « comme le héros » */
  for (j = 0; j < scene_ctx.actor_count && j < ACTOR_SLOTS; j++)
  {
    if (j != i && actor_active[j] && actor_prio[j] == ACTOR_PRIO_SAME &&
        ACTOR_TX(j) == tx && ACTOR_TY(j) == ty)
      return 1;
  }
  return 0;
}

/* Delta d'une direction (dx, dy en tiles) */
static const s8 mv_dx[4] = {0, 0, -1, 1};
static const s8 mv_dy[4] = {1, -1, 0, 0};

/* Lance un itinéraire (opcode ROUTE, v0.12). ofs pointe les PAS dans le
   bloc scripts. Remplace la route en cours du slot s'il y en a une. */
void actors_set_route(u8 index, u16 ofs, u8 flags, u8 len)
{
  if (index >= ACTOR_SLOTS || index >= scene_ctx.actor_count || len == 0)
    return;
  actor_step[index] = 0; /* coupe le pas d'errance en cours */
  route_ofs[index] = ofs;
  route_pos[index] = 0;
  route_len[index] = len;
  route_flags[index] = flags;
  route_wait[index] = 0;
}

/* Place l'acteur sur une tile (opcode SETPOS, v0.15) — coupe le pas en
   cours pour ne pas laisser un déplacement à moitié fait. */
void actors_set_pos(u8 index, u8 tx, u8 ty)
{
  if (index >= ACTOR_SLOTS || index >= scene_ctx.actor_count)
    return;
  actor_px[index] = (u16)tx << 4;
  actor_py[index] = (u16)ty << 4;
  actor_step[index] = 0;
  actors_rebuild_blockers(); /* téléportation : la liste doit suivre */
}

/* Échange les positions de deux acteurs (opcode SWAPPOS, v0.15). */
void actors_swap_pos(u8 a, u8 b)
{
  u16 t;

  if (a >= ACTOR_SLOTS || b >= ACTOR_SLOTS || a >= scene_ctx.actor_count ||
      b >= scene_ctx.actor_count)
    return;
  t = actor_px[a];
  actor_px[a] = actor_px[b];
  actor_px[b] = t;
  t = actor_py[a];
  actor_py[a] = actor_py[b];
  actor_py[b] = t;
  actor_step[a] = 0;
  actor_step[b] = 0;
  actors_rebuild_blockers(); /* téléportation : la liste doit suivre */
}

/* Fréquence 1-8 du slot (posée par l'opcode ROUTE avant set_route) */
static u8 route_freq_pending;

void actors_route_freq(u8 freq)
{
  route_freq_pending = (freq >= 1 && freq <= 8) ? freq : 3;
}

void actors_route_bind_freq(u8 index)
{
  if (index < ACTOR_SLOTS)
    actor_freq[index] = route_freq_pending;
}

/* 1 si une route NON-repeat est encore en cours (WAITROUTE) — les routes
   répétées tournent pour toujours, on ne les attend pas. */
u8 actors_routes_busy(void)
{
  u8 i;

  for (i = 0; i < ACTOR_SLOTS; i++)
  {
    if (route_ofs[i] != 0xFFFF && !(route_flags[i] & ROUTE_FLAG_REPEAT))
      return 1;
  }
  return 0;
}

/* Se tourner vers le héros (pas FACEP + interactions) */
static u8 dir_toward_player(u8 i)
{
  u16 dx = player.x > actor_px[i] ? player.x - actor_px[i]
                                  : actor_px[i] - player.x;
  u16 dy = player.y > actor_py[i] ? player.y - actor_py[i]
                                  : actor_py[i] - player.y;

  if (dx > dy)
    return player.x > actor_px[i] ? DIR_RIGHT : DIR_LEFT;
  return player.y > actor_py[i] ? DIR_DOWN : DIR_UP;
}

/* Rotations 90 degres (indices DIR_DOWN=0 UP=1 LEFT=2 RIGHT=3) :
   horaire 0→2→1→3→0, anti-horaire l'inverse. */
static const u8 dir_cw[4] = {2, 3, 1, 0};
static const u8 dir_ccw[4] = {3, 2, 0, 1};

/* Avance la route du slot i d'un cran (un pas par appel au plus). */
static void route_tick(u8 i)
{
  u8 step, d, tx, ty, adv;

  if (actor_step[i])
    return; /* pas de marche en cours : on le laisse finir */
  if (route_wait[i])
  {
    route_wait[i]--;
    return;
  }
  if (route_pos[i] >= route_len[i])
  {
    if (route_flags[i] & ROUTE_FLAG_REPEAT)
      route_pos[i] = 0;
    else
    {
      route_ofs[i] = 0xFFFF; /* terminé */
      return;
    }
  }
  step = scene_ctx.scripts[route_ofs[i] + route_pos[i]];
  adv = 1;
  d = actor_dirs[i];

  if ((step & 0xF0) == ROUTE_STEP_WAITN)
  {
    route_wait[i] = (u8)((step & 0x0F) << 3);
    route_pos[i]++;
    return;
  }
  switch (step)
  {
  case ROUTE_STEP_MRAND:
    d = (u8)(mv_rand() & 3);
    goto marche;
  case ROUTE_STEP_MHERO:
    d = dir_toward_player(i);
    goto marche;
  case ROUTE_STEP_MFLEE:
    d = dir_toward_player(i) ^ 1;
    goto marche;
  case ROUTE_STEP_FWD:
    goto marche;
  case ROUTE_STEP_T90R:
    d = dir_cw[d];
    goto tourne;
  case ROUTE_STEP_T90L:
    d = dir_ccw[d];
    goto tourne;
  case ROUTE_STEP_T180:
    d = d ^ 1;
    goto tourne;
  case ROUTE_STEP_T90X:
    d = (mv_rand() & 1) ? dir_cw[d] : dir_ccw[d];
    goto tourne;
  case ROUTE_STEP_TRAND:
    d = (u8)(mv_rand() & 3);
    goto tourne;
  case ROUTE_STEP_FACEP:
    d = dir_toward_player(i);
    goto tourne;
  case ROUTE_STEP_TFLEE:
    d = dir_toward_player(i) ^ 1;
    goto tourne;
  case ROUTE_STEP_SPDUP:
    if (actor_speed[i] < 4)
      actor_speed[i]++;
    goto fini;
  case ROUTE_STEP_SPDDN:
    if (actor_speed[i] > 1)
      actor_speed[i]--;
    goto fini;
  case ROUTE_STEP_FRQUP:
    if (actor_freq[i] < 8)
      actor_freq[i]++;
    goto fini;
  case ROUTE_STEP_FRQDN:
    if (actor_freq[i] > 1)
      actor_freq[i]--;
    goto fini;
  case ROUTE_STEP_FIXON:
    actor_dirfix[i] = 1;
    goto fini;
  case ROUTE_STEP_FIXOFF:
    actor_dirfix[i] = 0;
    goto fini;
  case ROUTE_STEP_THRUON:
    actor_thru[i] = 1;
    goto fini;
  case ROUTE_STEP_THRUOFF:
    actor_thru[i] = 0;
    goto fini;
  case ROUTE_STEP_SWON:
  case ROUTE_STEP_SWOFF:
    vm_switch_set((u16)scene_ctx.scripts[route_ofs[i] + route_pos[i] + 1] |
                      ((u16)scene_ctx.scripts[route_ofs[i] + route_pos[i] + 2]
                       << 8),
                  step == ROUTE_STEP_SWON);
    adv = 3;
    goto fini;
  case ROUTE_STEP_GFX:
    actor_gfx[i] = scene_ctx.scripts[route_ofs[i] + route_pos[i] + 1];
    adv = 2;
    goto fini;
  default:
    if ((step & 0xF0) == ROUTE_STEP_TURN)
    {
      d = step & 3;
      goto tourne;
    }
    d = step & 3; /* 0x00-0x03 : marcher */
    goto marche;
  }

tourne:
  if (!actor_dirfix[i])
    actor_dirs[i] = d;
  goto fini;

marche:
  tx = (u8)(ACTOR_TX(i) + mv_dx[d]);
  ty = (u8)(ACTOR_TY(i) + mv_dy[d]);
  if (mv_blocked(i, tx, ty, d))
  {
    if (!actor_dirfix[i])
      actor_dirs[i] = d; /* on se tourne quand même (modèle RM2003) */
    if (route_flags[i] & ROUTE_FLAG_SKIP)
      route_pos[i] += adv; /* « ignorer si bloqué » : pas suivant */
    return; /* sinon : réessaie tant que c'est bloqué */
  }
  if (!actor_dirfix[i])
    actor_dirs[i] = d;
  actor_mvdir[i] = d; /* direction RÉELLE du déplacement (dirfix) */
  actor_step[i] = 16;
  route_pos[i] += adv;
  /* pause de fréquence APRÈS un pas de marche (1 = lent, 8 = enchaîné) */
  route_wait[i] = (u8)((8 - actor_freq[i]) << 2);
  return;

fini:
  route_pos[i] += adv;
}

/* Mouvement des PNJ (v0.11/v0.12) — appelé chaque frame par la boucle
   principale. Les ITINÉRAIRES avancent aussi pendant les scripts (c'est
   le moteur des cinématiques) ; l'errance (move_type) reste gelée
   pendant les scripts, et tout s'arrête dans le menu Système.
   Vitesse : 1 px une frame sur deux (moitié du héros). */
void actors_update(void)
{
  u8 i, d, tx, ty, mt;
  u8 frozen = vm_active();
  u8 moved = 0; /* un acteur a-t-il changé de position cette frame ? */
  u8 n = scene_ctx.actor_count; /* far struct : lu UNE fois (P3) */

  if (n > ACTOR_SLOTS)
    n = ACTOR_SLOTS;
  mv_phase ^= 1;

  for (i = 0; i < n; i++)
  {
    /* tout en WRAM (P3) : plus une seule lecture ROM par acteur et par
       frame — le type et le mouvement sont recopiés au chargement */
    if (!actor_active[i])
      continue;
    if (actor_kind[i] != ACTOR_TYPE_NPC_STATIC)
      continue;

    /* itinéraire prioritaire sur l'errance */
    if (route_ofs[i] != 0xFFFF)
      route_tick(i);

    mt = actor_movet[i];
    if (route_ofs[i] == 0xFFFF && (mt == ACTOR_MOVE_STATIC || frozen))
    {
      /* ni route ni errance : finir le pas en cours s'il y en a un */
      if (!actor_step[i])
        continue;
    }
    else if (route_ofs[i] == 0xFFFF && !actor_step[i])
    {
      /* errance (v0.11) : décision */
      if (actor_timer[i])
      {
        actor_timer[i]--;
        continue;
      }
      if (mt == ACTOR_MOVE_RANDOM)
      {
        d = (u8)(mv_rand() & 3);
        actor_timer[i] = (u8)(64 + (mv_rand() & 127));
      }
      else
      {
        d = actor_dirs[i];
        if (mt == ACTOR_MOVE_VERT && d != DIR_DOWN && d != DIR_UP)
          d = DIR_DOWN;
        if (mt == ACTOR_MOVE_HORIZ && d != DIR_LEFT && d != DIR_RIGHT)
          d = DIR_RIGHT;
        actor_timer[i] = 16;
      }
      tx = (u8)(ACTOR_TX(i) + mv_dx[d]);
      ty = (u8)(ACTOR_TY(i) + mv_dy[d]);
      if (mv_blocked(i, tx, ty, d))
      {
        if (mt != ACTOR_MOVE_RANDOM && !actor_dirfix[i])
          actor_dirs[i] = d ^ 1; /* demi-tour */
        continue;
      }
      if (!actor_dirfix[i])
        actor_dirs[i] = d;
      actor_mvdir[i] = d;
      actor_step[i] = 16;
    }

    if (actor_step[i])
    {
      /* pas en cours — vitesse 1-4 : 0.5 / 1 / 2 / 4 px par frame */
      u8 px = actor_speed[i] == 1 ? (mv_phase ? 1 : 0)
              : actor_speed[i] == 2 ? 1
              : actor_speed[i] == 3 ? 2 : 4;
      d = actor_mvdir[i];
      while (px && actor_step[i])
      {
        actor_px[i] += mv_dx[d];
        actor_py[i] += mv_dy[d];
        moved = 1;
        actor_step[i]--;
        px--;
        if ((actor_step[i] & 7) == 0)
          actor_anim[i] = (u8)((actor_anim[i] + 1) & 3);
      }
    }
  }

  /* PERF (P2) : la liste des bloqueurs ne dépend que des positions et des
     pages actives. Les téléportations (SETPOS/SWAPPOS) et les changements
     de page la reconstruisent déjà elles-mêmes ; il ne reste ici que le
     déplacement frame par frame. Une scène de PNJ immobiles la
     reconstruisait 60 fois par seconde pour rien — 10 % du temps de la
     frame, mesuré au compteur de scanline. */
  if (moved)
    actors_rebuild_blockers();
}

u8 actor_at_tile(u8 tx, u8 ty)
{
  u8 k;

  if (!blk_ovf)
  {
    /* cas courant : rejet bounding box puis balayage de la liste
       précalculée (voir actors_rebuild_blockers) */
    if (tx < blk_x0 || tx > blk_x1 || ty < blk_y0 || ty > blk_y1)
      return ACTOR_NONE;
    for (k = 0; k < blk_n; k++)
    {
      if (blk_tx[k] == tx && blk_ty[k] == ty)
        return blk_id[k];
    }
    return ACTOR_NONE;
  }

  /* repli exact (liste pleine) : parcours complet, position RUNTIME pour
     les slots — seuls les « comme le héros » bloquent et se parlent de
     face (priorité v0.14) */
  for (k = 0; k < scene_ctx.actor_count; k++)
  {
    if (k < ACTOR_SLOTS)
    {
      if (!actor_active[k] || actor_prio[k] != ACTOR_PRIO_SAME)
        continue;
      if (ACTOR_TX(k) != tx || ACTOR_TY(k) != ty)
        continue;
      if (actor_kind[k] != ACTOR_TYPE_NPC_STATIC)
        continue;
      return k;
    }
    else
    {
      const ActorDef *a = &scene_ctx.actors[k];

      if (a->actor_type == ACTOR_TYPE_NPC_STATIC && a->x == tx &&
          a->y == ty)
        return k;
    }
  }
  return ACTOR_NONE;
}

/* Event « sous le héros » (priorité below) sur cette tile — interaction
   en se tenant dessus, façon RM2003 (coffre au sol). */
u8 actor_standing_at(u8 tx, u8 ty)
{
  u8 i;
  const ActorDef *a = scene_ctx.actors;

  for (i = 0; i < scene_ctx.actor_count && i < ACTOR_SLOTS; i++, a++)
  {
    if (a->actor_type == ACTOR_TYPE_NPC_STATIC && actor_active[i] &&
        actor_prio[i] == ACTOR_PRIO_BELOW && ACTOR_TX(i) == tx &&
        ACTOR_TY(i) == ty)
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
  if (index < ACTOR_SLOTS && index < scene_ctx.actor_count &&
      !actor_dirfix[index])
    actor_dirs[index] = dir & 3; /* Direction Fix : orientation figée */
}

void actor_interact(u8 index)
{
  u16 ofs = scene_ctx.actors[index].script_offset;

  /* Réflexe RM2003 : le PNJ se tourne vers le héros (direction opposée —
     DOWN<->UP et LEFT<->RIGHT s'échangent par xor 1) */
  actor_face(index, player.dir ^ 1);

  if (ofs != SCRIPT_NONE)
  {
    vm_start(ofs);
    vm.script_actor = index; /* cible du ROUTE « cet event » (v0.12) */
  }
}
