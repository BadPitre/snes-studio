/*
 * timer.c — timer de jeu affichable (v0.13, modèle RM2003).
 *
 * Un décompte en secondes, piloté par l'opcode TIMER (spec §2) : régler/
 * démarrer, arrêter, afficher/cacher. L'affichage « M:SS » vit sur BG3
 * (fonte de la textbox, déjà en VRAM), coin HAUT-DROIT. Depuis M1
 * (Phase 12), il est composé dans le tampon partagé ui_map dès que
 * l'état change (hors VBlank) — transfert centralisé ui_screen_vblank.
 * Cas assumé (doc M1) : une fenêtre de dialogue qui recouvre sa rangée
 * l'efface jusqu'au tick suivant.
 */
#include <snes.h>
#include "formats.h"
#include "timer.h"
#include "ui_screen.h"

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

/* Compose « M:SS » (ou l'efface) dans ui_map — hors VBlank */
static void t_render(void)
{
  u16 m, s, base;
  u8 i;

  base = (u16)T_ROW * 32 + T_COL;
  if (t_show)
  {
    m = t_secs / 60;
    s = t_secs % 60;
    if (m > 99)
      m = 99;
    /* pas de zéro de tête sur les minutes — espace OPAQUE (fond fonte),
       comme avant M1 : le rendu doit rester pixel-identique */
    ui_map[base + 0] = m < 10 ? T_ENTRY(' ') : T_ENTRY('0' + m / 10);
    ui_map[base + 1] = T_ENTRY('0' + m % 10);
    ui_map[base + 2] = T_ENTRY(':');
    ui_map[base + 3] = T_ENTRY('0' + s / 10);
    ui_map[base + 4] = T_ENTRY('0' + s % 10);
  }
  else
  {
    for (i = 0; i < T_LEN; i++)
      ui_map[base + i] = 0;
  }
  ui_mark(T_ROW, 1);
}

void timer_init(void)
{
  t_secs = 0;
  t_frames = 0;
  t_run = 0;
  t_show = 0;
}

/* API à paramètre UNIQUE : le couple (u8, u16) en paramètres était
   corrompu par tcc-816 (90 arrivait en ~556) — même famille de piège que
   les multi-pointeurs. Un seul argument par fonction = passage fiable. */
void timer_set(u16 secs)
{
  t_secs = secs;
  t_frames = 0;
  t_run = 1;
  t_render();
}

void timer_stop(void)
{
  t_run = 0;
}

void timer_display(u8 on)
{
  t_show = on;
  t_render();
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
      t_render();
  }
}
