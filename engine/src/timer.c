/*
 * timer.c — timer de jeu affichable (v0.13, modèle RM2003).
 *
 * Un décompte en secondes, piloté par l'opcode TIMER (spec §2) : régler/
 * démarrer, arrêter, afficher/cacher. L'affichage « M:SS » vit sur BG3
 * (fonte de la textbox, déjà en VRAM), coin HAUT-DROIT — la textbox
 * n'occupe que le bas de la couche. Écriture VRAM au VBlank uniquement,
 * et seulement quand l'affichage change (dirty).
 */
#include <snes.h>
#include "formats.h"
#include "vram.h"
#include "timer.h"

/* Même encodage d'entrée BG3 que la textbox (textbox.c) : char 0 =
   transparent, la fonte commence au char 1 (glyphe = ascii - 31) */
#define T_ENTRY(c) ((u16)((c) - 31) | 0x3000)

/* Position de l'affichage : rangée 1, colonnes 26-30 (32 colonnes) */
#define T_ROW 1
#define T_COL 26
#define T_LEN 5

static u16 t_secs;    /* secondes restantes */
static u8 t_frames;   /* frames écoulées de la seconde en cours */
static u8 t_run;      /* 1 = décompte actif */
static u8 t_show;     /* 1 = affiché */
static u8 t_dirty;    /* l'affichage doit être réécrit au VBlank */
static u16 t_map[T_LEN]; /* entrées BG3 préparées hors VBlank */

void timer_init(void)
{
  t_secs = 0;
  t_frames = 0;
  t_run = 0;
  t_show = 0;
  t_dirty = 0;
}

/* API à paramètre UNIQUE : le couple (u8, u16) en paramètres était
   corrompu par tcc-816 (90 arrivait en ~556) — même famille de piège que
   les multi-pointeurs. Un seul argument par fonction = passage fiable. */
void timer_set(u16 secs)
{
  t_secs = secs;
  t_frames = 0;
  t_run = 1;
  t_dirty = 1;
}

void timer_stop(void)
{
  t_run = 0;
}

void timer_display(u8 on)
{
  t_show = on;
  t_dirty = 1;
}

u16 timer_secs(void)
{
  return t_secs;
}

/* Un tick par frame (60 Hz NTSC). S'arrête à zéro. */
void timer_tick(void)
{
  if (!t_run || t_secs == 0)
    return;
  t_frames++;
  if (t_frames >= 60)
  {
    t_frames = 0;
    t_secs--;
    if (t_secs == 0)
      t_run = 0;
    if (t_show)
      t_dirty = 1;
  }
}

/* Prépare puis transfère « M:SS » (ou l'efface) — VBlank uniquement */
void timer_vblank(void)
{
  u16 m, s;
  u8 i;

  if (!t_dirty)
    return;
  t_dirty = 0;

  if (t_show)
  {
    m = t_secs / 60;
    s = t_secs % 60;
    if (m > 99)
      m = 99;
    t_map[0] = T_ENTRY('0' + m / 10);
    t_map[1] = T_ENTRY('0' + m % 10);
    t_map[2] = T_ENTRY(':');
    t_map[3] = T_ENTRY('0' + s / 10);
    t_map[4] = T_ENTRY('0' + s % 10);
    if (m < 10)
      t_map[0] = T_ENTRY(' '); /* pas de zéro de tête sur les minutes */
  }
  else
  {
    for (i = 0; i < T_LEN; i++)
      t_map[i] = 0;
  }
  dmaCopyVram((u8 *)t_map, VRAM_BG3_MAP + T_ROW * 32 + T_COL, T_LEN * 2);
}
