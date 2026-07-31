/*
 * anim.c — animations image par image (A1). Voir anim.h.
 *
 * L'état est indexé PAR SLOT DE VIGNETTE : une animation = une cellule
 * à l'écran = un slot. Pas de table d'indirection, pas d'allocation —
 * ANIM_SLOTS vaut VIG_SLOTS par construction.
 *
 * La piste est APLATIE et de pas FIXE (5 octets par frame) : le lecteur
 * garde l'offset de la frame courante et lui ajoute 5, sans jamais
 * multiplier ni indexer une structure. tcc-816 compile chaque accès
 * indexé en une lecture indirecte longue (~11 instructions, cf. P3) :
 * une frame coûte ici 5 lectures et rien d'autre, et SEULEMENT au
 * changement de frame — le reste du temps le lecteur décrémente un
 * compteur.
 */
#include <snes.h>
#include "vignette.h"
#include "anim.h"
#include "audio.h"

/* registre généré (data_anims.c — toujours émis) */
extern const u8 anim_count;
extern const u8 anim_vig[];
extern const u8 anim_flags[];
extern const u8 anim_nframes[];
extern const u16 anim_ofs[];
extern const u8 anim_track[];

/* Ancrage ÉCRAN : (0,0) = cellule 32x32 centrée sur l'écran 256x224.
   Le décalage de la frame part de là — même règle dans l'éditeur, dont
   le canevas montre l'écran entier. */
#define ANIM_SCR_X 112
#define ANIM_SCR_Y 96

static u8 a_id[ANIM_SLOTS]; /* 0xFF = slot libre */
static u8 a_frame[ANIM_SLOTS];
static u8 a_n[ANIM_SLOTS];    /* nombre de frames */
static u8 a_loop[ANIM_SLOTS]; /* animation en boucle : ne bloque jamais */
static u8 a_timer[ANIM_SLOTS];
static u8 a_anc[ANIM_SLOTS];
static u16 a_base[ANIM_SLOTS]; /* offset de la frame 0 dans anim_track */
static u16 a_cur[ANIM_SLOTS];  /* offset de la frame COURANTE */
static u8 a_fresh = 0;         /* bitmask : frame posée CETTE frame écran —
                                  le premier tick ne la consomme pas, quel
                                  que soit l'ordre VM / lecteur */
static u8 a_init = 0;          /* statics posés (init explicite tcc) */

static void anim_init_once(void)
{
  u8 s;

  if (a_init)
    return;
  a_init = 1;
  for (s = 0; s < ANIM_SLOTS; s++)
    a_id[s] = 0xFF;
  a_fresh = 0;
}

/* Applique la frame courante du slot : cellule, position, son. */
static void anim_enter(u8 s)
{
  u16 o = a_cur[s];
  u8 cell = anim_track[o];
  s8 dx = (s8)anim_track[o + 1];
  s8 dy = (s8)anim_track[o + 2];
  u8 sfx;

  a_timer[s] = anim_track[o + 3];
  sfx = anim_track[o + 4];

  vig_set_frame(s, cell);
  if (a_anc[s] == ANIM_ANC_SCREEN)
    vig_move(s, (u8)(ANIM_SCR_X + dx), (u8)(ANIM_SCR_Y + dy));
  else
    vig_move(s, (u8)dx, (u8)dy); /* offsets signés autour de la cible */
  if (sfx != 0xFF)
    audio_play_sfx(sfx);
  a_fresh |= (u8)(1 << s);
}

void anim_play(u8 anim_id, u8 anchor, u8 target)
{
  u8 s, best, i;

  anim_init_once();
  if (anim_id >= anim_count)
    return;

  s = vig_free_slot();
  if (s == 0xFF)
  {
    /* Tous les slots pris : céder celui de l'animation la PLUS AVANCÉE
       (la plus proche de sa fin). Une animation écourtée d'une frame se
       voit moins qu'une animation qui ne part pas. Aucune animation en
       cours : on préempte la vignette scriptée du slot haut. */
    best = 0xFF;
    for (i = 0; i < ANIM_SLOTS; i++)
      if (a_id[i] != 0xFF && vig_is_anim(i))
        if (best == 0xFF || a_frame[i] > a_frame[best])
          best = i;
    s = (best == 0xFF) ? (ANIM_SLOTS - 1) : best;
  }

  a_id[s] = anim_id;
  a_frame[s] = 0;
  a_n[s] = anim_nframes[anim_id];
  a_loop[s] = anim_flags[anim_id] & 1;
  a_base[s] = anim_ofs[anim_id];
  a_cur[s] = a_base[s];
  a_anc[s] = anchor;

  /* la planche : une vignette du projet, avec tout son pipeline (chars
     OBJ, palette, transfert VBlank) */
  vig_show(s, anim_vig[anim_id], 0, 0);
  vig_own_anim(s); /* APRÈS vig_show, qui remet la propriété à zéro */
  if (anchor == ANIM_ANC_ACTOR)
    vig_anchor_actor(s, target);
  else
    vig_anchor(s, anchor ? VIG_ANC_HERO : VIG_ANC_SCREEN);

  anim_enter(s);
}

void anim_stop(void)
{
  u8 s;

  if (!a_init)
    return;
  for (s = 0; s < ANIM_SLOTS; s++)
    if (a_id[s] != 0xFF)
    {
      a_id[s] = 0xFF;
      if (vig_is_anim(s))
        vig_hide(s);
    }
  a_fresh = 0;
}

u8 anim_busy(void)
{
  u8 s;

  if (!a_init)
    return 0;
  for (s = 0; s < ANIM_SLOTS; s++)
    if (a_id[s] != 0xFF && !a_loop[s])
      return 1;
  return 0;
}

void anim_update(void)
{
  u8 s;

  if (!a_init)
    return;
  for (s = 0; s < ANIM_SLOTS; s++)
  {
    if (a_id[s] == 0xFF)
      continue;
    if (!vig_is_anim(s))
    {
      /* préempté par un vig_show scripté : on lâche le slot sans rien
         cacher — la vignette du script a pris la place */
      a_id[s] = 0xFF;
      continue;
    }
    if (a_fresh & (1 << s))
    {
      a_fresh &= (u8)~(1 << s); /* frame posée à l'instant : elle a droit
                                   à sa durée pleine */
      continue;
    }
    if (--a_timer[s])
      continue;

    a_frame[s]++;
    if (a_frame[s] >= a_n[s])
    {
      if (!a_loop[s])
      {
        a_id[s] = 0xFF;
        vig_hide(s); /* l'animation se range seule, comme vig_play mode 1 */
        continue;
      }
      a_frame[s] = 0;
      a_cur[s] = a_base[s];
    }
    else
      a_cur[s] += 5;
    anim_enter(s);
    a_fresh &= (u8)~(1 << s); /* changement de frame DANS le tick : la
                                 durée court dès la frame suivante */
  }
}
