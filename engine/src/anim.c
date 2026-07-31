/*
 * anim.c — animations image par image (A1). Voir anim.h.
 *
 * Une animation = L CALQUES, chacun tenant un slot de vignette : le
 * calque porte sa cellule et sa position, la vignette porte le chemin
 * graphique (chars OBJ, palette, transfert VBlank). Les L calques
 * partagent la palette de la planche — voir vignette.h, c'est ce qui
 * rend les cellules simultanées abordables.
 *
 * La piste est APLATIE et de pas FIXE : par frame, L enregistrements de
 * 3 octets [cellule][dx][dy], puis [durée][son]. Le pas vaut donc
 * 3L + 2 et se calcule UNE fois au lancement ; le lecteur l'ajoute à
 * l'offset courant, sans jamais multiplier ni décoder une longueur
 * variable. tcc-816 compile chaque accès indexé en une lecture
 * indirecte longue (~11 instructions, cf. P3) : une frame coûte ici
 * 3L + 2 lectures et rien d'autre, et SEULEMENT au changement de
 * frame — le reste du temps le lecteur décrémente un compteur.
 */
#include <snes.h>
#include "vignette.h"
#include "anim.h"
#include "audio.h"

/* registre généré (data_anims.c — toujours émis) */
extern const u8 anim_count;
extern const u8 anim_vig[];
extern const u8 anim_flags[];
extern const u8 anim_layers[];
extern const u8 anim_nframes[];
extern const u16 anim_ofs[];
extern const u8 anim_track[];

/* Ancrage ÉCRAN : (0,0) = cellule 32x32 centrée sur l'écran 256x224.
   Le décalage de la frame part de là — même règle dans l'éditeur, dont
   le canevas montre l'écran entier. */
#define ANIM_SCR_X 112
#define ANIM_SCR_Y 96

/* slot de vignette du calque l de l'animation s */
#define A_VS(s, l) a_vs[((s) << 2) + (l)]

static u8 a_id[ANIM_SLOTS]; /* 0xFF = slot libre */
static u8 a_frame[ANIM_SLOTS];
static u8 a_n[ANIM_SLOTS];      /* nombre de frames */
static u8 a_loop[ANIM_SLOTS];   /* animation en boucle : ne bloque jamais */
static u8 a_lay[ANIM_SLOTS];    /* nombre de calques (1-4) */
static u8 a_stride[ANIM_SLOTS]; /* 3*calques + 2 */
static u8 a_timer[ANIM_SLOTS];
static u8 a_anc[ANIM_SLOTS];
static u16 a_base[ANIM_SLOTS]; /* offset de la frame 0 dans anim_track */
static u16 a_cur[ANIM_SLOTS];  /* offset de la frame COURANTE */
static u8 a_vs[ANIM_SLOTS * ANIM_LAYERS_MAX]; /* slots empruntés, 0xFF = aucun */
static u8 a_fresh = 0; /* bitmask : frame posée CETTE frame écran — le
                          premier tick ne la consomme pas, quel que soit
                          l'ordre VM / lecteur */
static u8 a_init = 0;  /* statics posés (init explicite tcc) */

static void anim_init_once(void)
{
  u8 s, l;

  if (a_init)
    return;
  a_init = 1;
  for (s = 0; s < ANIM_SLOTS; s++)
  {
    a_id[s] = 0xFF;
    for (l = 0; l < ANIM_LAYERS_MAX; l++)
      A_VS(s, l) = 0xFF;
  }
  a_fresh = 0;
}

/* Rend les slots de vignette d'une animation. hide = 0 quand ils ont été
   préemptés par un vig_show scripté : le script a repris la main sur ce
   qu'il affiche, on ne le cache pas sous ses pieds. */
static void anim_free(u8 s, u8 hide)
{
  u8 l, vs;

  for (l = 0; l < ANIM_LAYERS_MAX; l++)
  {
    vs = A_VS(s, l);
    if (vs == 0xFF)
      continue;
    if (hide && vig_is_anim(vs))
      vig_hide(vs);
    A_VS(s, l) = 0xFF;
  }
  a_id[s] = 0xFF;
  a_fresh &= (u8)~(1 << s);
}

/* Applique la frame courante : cellule et position de CHAQUE calque,
   puis durée et son (une seule fois pour la frame). */
static void anim_enter(u8 s)
{
  u16 o = a_cur[s];
  u8 nl = a_lay[s];
  u8 l, cell, vs;
  s8 dx, dy;
  u8 sfx;

  for (l = 0; l < nl; l++)
  {
    cell = anim_track[o];
    dx = (s8)anim_track[o + 1];
    dy = (s8)anim_track[o + 2];
    o += 3;
    vs = A_VS(s, l);
    if (vs == 0xFF)
      continue;
    if (cell == ANIM_CELL_NONE)
    {
      vig_set_visible(vs, 0); /* calque vide : le slot reste réservé */
      continue;
    }
    vig_set_visible(vs, 1);
    vig_set_frame(vs, cell);
    if (a_anc[s] == ANIM_ANC_SCREEN)
      vig_move(vs, (u8)(ANIM_SCR_X + dx), (u8)(ANIM_SCR_Y + dy));
    else
      vig_move(vs, (u8)dx, (u8)dy); /* offsets signés autour de la cible */
  }

  a_timer[s] = anim_track[o];
  sfx = anim_track[o + 1];
  if (sfx != 0xFF)
    audio_play_sfx(sfx);
  a_fresh |= (u8)(1 << s);
}

void anim_play(u8 anim_id, u8 anchor, u8 target)
{
  u8 s, best, i, l, nl, vig, vs;

  anim_init_once();
  if (anim_id >= anim_count)
    return;
  vig = anim_vig[anim_id];
  nl = anim_layers[anim_id];
  if (nl == 0 || nl > ANIM_LAYERS_MAX)
    nl = 1;

  /* Palette d'abord : les deux palettes OBJ libres peuvent déjà être
     prises par deux AUTRES planches. Mieux vaut ne rien jouer que de
     jouer aux couleurs d'une autre image. */
  if (!vig_pal_available(vig))
    return;

  /* un emplacement d'animation */
  s = 0xFF;
  for (i = 0; i < ANIM_SLOTS; i++)
    if (a_id[i] == 0xFF)
    {
      s = i;
      break;
    }
  if (s == 0xFF)
  {
    best = 0;
    for (i = 1; i < ANIM_SLOTS; i++)
      if (a_frame[i] > a_frame[best])
        best = i;
    anim_free(best, 1);
    s = best;
  }

  /* assez de slots de vignette pour tous les calques ? On les prend au
     fur et à mesure ; s'il en manque, la plus AVANCÉE des animations en
     cours cède les siens et on repasse une fois. */
  for (i = 0; i < 2; i++)
  {
    for (l = 0; l < nl; l++)
    {
      vs = vig_free_slot();
      if (vs == 0xFF)
        break;
      A_VS(s, l) = vs;
      vig_show(vs, vig, 0, 0); /* réserve le slot ET la palette */
      vig_own_anim(vs);        /* APRÈS vig_show, qui remet la propriété à 0 */
      if (anchor == ANIM_ANC_ACTOR)
        vig_anchor_actor(vs, target);
      else
        vig_anchor(vs, anchor ? VIG_ANC_HERO : VIG_ANC_SCREEN);
    }
    if (l == nl)
      break; /* tous les calques sont posés */
    /* place insuffisante : rendre ce qu'on a pris, libérer une victime */
    anim_free(s, 1);
    best = 0xFF;
    for (l = 0; l < ANIM_SLOTS; l++)
      if (a_id[l] != 0xFF && (best == 0xFF || a_frame[l] > a_frame[best]))
        best = l;
    if (best == 0xFF || i)
      return; /* rien à sacrifier, ou déjà essayé : on renonce */
    anim_free(best, 1);
  }

  a_id[s] = anim_id;
  a_frame[s] = 0;
  a_n[s] = anim_nframes[anim_id];
  a_loop[s] = anim_flags[anim_id] & 1;
  a_lay[s] = nl;
  a_stride[s] = (u8)(nl + nl + nl + 2); /* 3L + 2, sans multiplication */
  a_base[s] = anim_ofs[anim_id];
  a_cur[s] = a_base[s];
  a_anc[s] = anchor;

  anim_enter(s);
}

void anim_stop(void)
{
  u8 s;

  if (!a_init)
    return;
  for (s = 0; s < ANIM_SLOTS; s++)
    if (a_id[s] != 0xFF)
      anim_free(s, 1);
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

/* 1 si TOUS les calques encore alloués appartiennent au lecteur — un
   vig_show scripté sur l'un d'eux préempte l'animation entière. */
static u8 anim_owns(u8 s)
{
  u8 l, vs;

  for (l = 0; l < ANIM_LAYERS_MAX; l++)
  {
    vs = A_VS(s, l);
    if (vs != 0xFF && !vig_is_anim(vs))
      return 0;
  }
  return 1;
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
    if (!anim_owns(s))
    {
      anim_free(s, 0); /* préempté : on lâche sans rien cacher */
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
        anim_free(s, 1); /* l'animation se range seule, comme vig_play 1 */
        continue;
      }
      a_frame[s] = 0;
      a_cur[s] = a_base[s];
    }
    else
      a_cur[s] += a_stride[s];
    anim_enter(s);
    a_fresh &= (u8)~(1 << s); /* changement de frame DANS le tick : la
                                 durée court dès la frame suivante */
  }
}
