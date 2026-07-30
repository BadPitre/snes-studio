/*
 * debug.c — panneau de debug en jeu (S6).
 *
 * Compilé dans toutes les ROMs mais INERTE sans le drapeau dbg_enabled
 * (data_debug.c, émis par datagen — « --debug » vient du bouton Jouer
 * de l'éditeur, jamais du build cartouche). Start+Select+R bascule un
 * panneau de 2 rangées en haut de la couche UI (BG3, au-dessus de
 * tout — dialogues, images, HUD) :
 *
 *   FPS 60  LAG 00000
 *   SCN 02163/32768  TXT 00541/32768
 *
 * FPS : itérations de la boucle principale ramenées à 60 VBlanks
 * (fenêtre de mesure ~1 s). LAG : frames d'affichage manquées depuis
 * le boot — les transitions BLOQUANTES (fondus de warp/picture, 16
 * frames chacune) comptent dedans : le voir grimper pendant un warp
 * est normal, le voir grimper en marchant ne l'est pas. SCN/TXT :
 * octets réellement occupés dans les banks scènes/textes (32 Ko
 * chacune), mesurés par datagen à la génération des données.
 *
 * PERF — leçon payée cher : la boucle de jeu peut être à quelques
 * milliers de cycles du débordement, et un panneau qui redessine à
 * chaque frame DEVIENT le lag qu'il affiche (rétroaction : lag ->
 * redessin -> frame ratée -> lag). D'où : AUCUNE division dans ce
 * module (le 65816 n'en a pas, celles de tcc-816 coûtent des milliers
 * de cycles), compteur LAG tenu chiffre à chiffre (retenue), et
 * réécriture limitée aux cellules qui changent — le re-blit complet ne
 * part que si un module UI a repeint nos rangées (ui_dirty_overlap).
 */
#include <snes.h>
#include "debug.h"
#include "ui_screen.h"
#include "ui_overlay.h"

/* data_debug.c (toujours émis par datagen) — la rangée SCN/TXT arrive
   PRÉ-FORMATÉE (multi-bank M1 : totaux trop grands pour un u16, et pas
   de division ici) */
extern const u8 dbg_enabled;
extern const char dbg_banks_txt[];

extern u16 snes_vblank_count; /* compteur NMI PVSnesLib */

#define DBG_COMBO (KEY_START | KEY_SELECT | KEY_R)
/* même entrée que l'overlay : fonte du projet (base 1), palette fonte
   + priorité */
#define DBG_ENTRY(a) (((u16)(a)-31) | 0x3000)
#define DBG_FPS_COL 4 /* colonnes des valeurs vivantes (rangée 0) */
#define DBG_LAG_COL 12

static u8 dbg_on = 0;
static u8 dbg_held = 0;    /* anti-répétition du combo */
static u8 dbg_started = 0; /* première mesure : cale dbg_last_vbl */
static u16 dbg_last_vbl = 0;
static u16 dbg_iters = 0; /* itérations dans la fenêtre de mesure */
static u16 dbg_win = 0;   /* VBlanks écoulés dans la fenêtre */

/* Chiffres en attente d'affichage : pousser vers ui_map depuis la frame
   qui vient de rater re-fait rater la suivante (rétroaction mesurée au
   harnais : 4 -> 51 frames ratées sur 1200 en marchant, panneau ouvert).
   On pousse donc sur une frame SAINE (d <= 1), au plus une fois toutes
   les 16 frames — repli périodique si le jeu rate en continu. */
static u8 dbg_lag_dirty = 0;
static u8 dbg_fps_dirty = 0;
static u16 dbg_last_push = 0;

/* lignes cachées (ASCII, 0 = cellule transparente) — la vérité du
   panneau ; LAG n'existe QUE comme chiffres (jamais convertie) */
static u8 dbg_l0[32];
static u8 dbg_l1[32];

/* v décimal cadré à droite (zéros de tête) par SOUSTRACTIONS — pas de
   division. Params u16 (couple (u8,u16) corrompu par tcc-816). */
/* puissance de 10 sans table (les tableaux u16 sont fragiles en
   tcc-816 — pièges toolchain, cf formats.h) */
static u16 dbg_pow10(u16 i)
{
  if (i == 4)
    return 10000;
  if (i == 3)
    return 1000;
  if (i == 2)
    return 100;
  if (i == 1)
    return 10;
  return 1;
}

static void dbg_setnum(u8 *dst, u16 col, u16 v, u16 digits)
{
  u16 i = digits;

  while (i)
  {
    u16 p, n;

    i--;
    p = dbg_pow10(i);
    n = 0;
    while (v >= p)
    {
      v -= p;
      n++;
    }
    dst[col] = (u8)('0' + n);
    col++;
  }
}

static void dbg_set(u8 *dst, u16 col, const char *s)
{
  while (*s)
  {
    dst[col] = (u8)*s;
    col++;
    s++;
  }
}

/* recopie une plage de la ligne cachée `src` (rangée row) dans ui_map */
static void dbg_cells(const u8 *src, u16 row, u16 col, u16 n)
{
  u16 base = row * 32;

  while (n)
  {
    u16 c = src[col];

    ui_map[base + col] = c ? DBG_ENTRY(c) : 0;
    col++;
    n--;
  }
  ui_mark((u8)row, 1);
}

/* LAG affiché += n, chiffre à chiffre (retenue) — ~rien en cycles */
static void dbg_lag_add(u16 n)
{
  while (n)
  {
    u16 i = DBG_LAG_COL + 4;

    n--;
    while (i >= DBG_LAG_COL)
    {
      if (dbg_l0[i] < '9')
      {
        dbg_l0[i]++;
        break;
      }
      dbg_l0[i] = '0'; /* retenue */
      i--;
    }
  }
}

static void dbg_blit(void)
{
  dbg_cells(dbg_l0, 0, 0, 32);
  dbg_cells(dbg_l1, 1, 0, 32);
}

/* re-blit ÉTALÉ : 16 cellules par frame (4 frames pour le panneau) —
   un re-blit complet en une frame suffit à faire déborder une boucle
   de jeu déjà pleine, et il part une fois par seconde dès qu'un widget
   HUD vivant partage les rangées */
static u8 dbg_stage = 0; /* quarts restants (4..1), 0 = rien */

static void dbg_blit_chunk(void)
{
  u16 q = 4 - dbg_stage; /* 0..3 : moitiés de rangée 0 puis rangée 1 */

  if (q < 2)
    dbg_cells(dbg_l0, 0, q << 4, 16);
  else
    dbg_cells(dbg_l1, 1, (q - 2) << 4, 16);
  dbg_stage--;
}

static void dbg_build(void)
{
  u16 i;

  for (i = 0; i < 32; i++)
  {
    dbg_l0[i] = 0;
    dbg_l1[i] = 0;
  }
  dbg_set(dbg_l0, 0, "FPS ");
  dbg_setnum(dbg_l0, DBG_FPS_COL, 60, 2);
  dbg_set(dbg_l0, 8, "LAG 00000");
  dbg_set(dbg_l1, 0, dbg_banks_txt); /* pré-formatée par datagen (M1) */
}

/* Fermeture : rangées rendues transparentes, puis redessin du HUD (ses
   widgets peuvent partager ces rangées — même recette que la textbox) */
static void dbg_clear(void)
{
  u16 i;

  for (i = 0; i < 64; i++)
    ui_map[i] = 0;
  ui_mark(0, 2);
  overlay_refresh();
}

void debug_update(void)
{
  u16 pad, now, d;

  if (!dbg_enabled)
    return;
  /* Panneau CACHÉ : seul le combo est surveillé — zéro comptage. Le
     bouton Jouer de l'éditeur active toujours --debug, et même quelques
     dizaines de cycles par frame se paient quand la boucle frôle le
     budget (mesuré au harnais : ~20 frames ratées de plus sur 1200 en
     marchant, panneau fermé). La mesure FPS se re-ancre à l'ouverture. */
  pad = padsCurrent(0);
  if ((pad & DBG_COMBO) == DBG_COMBO)
  {
    if (!dbg_held)
    {
      dbg_held = 1;
      if (dbg_on)
      {
        dbg_on = 0;
        dbg_clear();
      }
      else
      {
        dbg_on = 1;
        dbg_build();
        dbg_blit();
        dbg_lag_dirty = 0;
        dbg_fps_dirty = 0;
        dbg_started = 0; /* re-ancrage : pas de faux lag accumulé */
        dbg_iters = 0;
        dbg_win = 0;
      }
    }
  }
  else
    dbg_held = 0;
  if (!dbg_on)
    return;

  now = snes_vblank_count;
  if (!dbg_started)
  {
    dbg_started = 1;
    dbg_last_vbl = now;
    dbg_last_push = now;
  }
  d = now - dbg_last_vbl;
  dbg_last_vbl = now;
  dbg_iters++;
  dbg_win += d;
  if (d > 1)
  {
    dbg_lag_add(d - 1); /* la boucle a raté (d-1) VBlanks */
    dbg_lag_dirty = 1;
  }
  if (dbg_win >= 60)
  {
    /* FPS ~= itérations de la fenêtre (60-63 VBlanks) — approximation
       SANS division, 2 chiffres */
    u16 f = dbg_iters;

    if (f > 60)
      f = 60;
    dbg_setnum(dbg_l0, DBG_FPS_COL, f, 2);
    dbg_fps_dirty = 1;
    dbg_iters = 0;
    dbg_win = 0;
  }
  {
    if (ui_dirty_overlap(0, 2))
      dbg_stage = 4; /* le HUD a repeint sous le panneau : re-blit étalé */
    if (dbg_stage)
      dbg_blit_chunk();
    else if ((dbg_lag_dirty || dbg_fps_dirty) && d <= 1 &&
             (u16)(now - dbg_last_push) >= 16)
    {
      /* pousser SEULEMENT les chiffres qui ont bougé (≤ 5 cellules),
         sur une frame saine, au plus toutes les 16 frames (voir plus
         haut : la poussée immédiate entretenait le lag qu'elle affiche) */
      if (dbg_fps_dirty)
        dbg_cells(dbg_l0, 0, DBG_FPS_COL, 2);
      if (dbg_lag_dirty)
        dbg_cells(dbg_l0, 0, DBG_LAG_COL, 5);
      dbg_fps_dirty = 0;
      dbg_lag_dirty = 0;
      dbg_last_push = now;
    }
  }
}
