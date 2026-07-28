/*
 * ui_overlay.c — fenêtres et WIDGETS permanents du HUD (Phase 11 §2 +
 * Phase 12 W1, docs/PLANNING_SYSTEME_MENUS.md) : placement libre sur
 * l'écran, en continu pendant le gameplay.
 *
 * Content types (ui_ov_type — PRIMITIVES aplaties par uigen depuis
 * l'arbre du designer D1, les conteneurs vbox/hbox n'existent qu'à la
 * compilation) :
 *   0 variable_display — libellé + valeur (fenêtre par défaut)
 *   1 gauge            — barre pleine/demie/vide, horizontale ou
 *                        verticale (remplie de BAS en haut, ALttP)
 *   2 icon_row         — icônes répétées façon cœurs Zelda
 *   3 icon_value       — icône + compteur (zéros de tête optionnels)
 *   4 panel            — cadre seul (fenêtre du designer) — STATIQUE
 *   5 label            — texte fixe (ui_ov_label) — STATIQUE
 *   6 image            — suite d'icônes de la planche — STATIQUE
 * ui_ov_frame : cadre 9-slice/boîte, ou widget nu sur le jeu.
 * Icônes : chars UI_ICON_BASE+n (planche ui.icons, après le windowskin) ;
 * gauge/icon_row : icon, icon+1, icon+2 = pleine, demie, vide.
 *
 * Les tables viennent du layout uigen (ui_overlays.c généré) ; le
 * redessin ne part que quand var (ou max_var) change. Compose dans le
 * tampon partagé ui_map (M1) — transfert centralisé ui_screen_vblank.
 */
#include <snes.h>
#include "vm.h"
#include "ui_overlay.h"
#include "ui_screen.h"
#include "data/ui_cfg.h"

#if UI_OV_COUNT

extern const u8 ui_ov_x[];
extern const u8 ui_ov_y[];
extern const u8 ui_ov_w[];
extern const u8 ui_ov_h[];
extern const u8 ui_ov_var[];
extern const u8 ui_ov_type[];
extern const u8 ui_ov_frame[];
extern const u8 ui_ov_icon[];
extern const u8 ui_ov_dir[];
extern const u8 ui_ov_pad[];
extern const u8 ui_ov_bg[]; /* 1 = dans une window (fond du cadre) */
extern const u8 ui_ov_maxvar[]; /* 0xFF = max constant (maxlo/maxhi) */
extern const u8 ui_ov_maxlo[];
extern const u8 ui_ov_maxhi[];
extern const char *const ui_ov_label[];

#define OV_ENTRY(c) ((u16)(c) | 0x3000) /* palette fonte + priorité */
#define OV_CHAR(a) ((u16)(a) - 31)
#define OV_SKIN_BASE 97
/* fond des cellules vides d'un widget posé DANS une window (D1) :
   centre du 9-slice — un 0 percerait le panneau jusqu'au jeu */
#if UI_HAS_SKIN
#define OV_BG_ENTRY OV_ENTRY(OV_SKIN_BASE + 4)
#else
#define OV_BG_ENTRY OV_ENTRY(OV_CHAR(' '))
#endif

static u16 ov_last[UI_OV_COUNT];  /* dernière valeur dessinée */
static u16 ov_lastm[UI_OV_COUNT]; /* dernier maximum (max_var) */
static char ov_num[5];

/* maximum courant d'un widget : constante compilée ou variable */
static u16 ov_max(u8 i)
{
  if (ui_ov_maxvar[i] != 0xFF)
    return vm.vars16[ui_ov_maxvar[i]];
  return (u16)ui_ov_maxlo[i] | ((u16)ui_ov_maxhi[i] << 8);
}

static void ov_draw(u8 i)
{
  u8 x = ui_ov_x[i];
  u8 w = ui_ov_w[i];
  u8 h = ui_ov_h[i];
  u8 f = ui_ov_frame[i];
  u8 cx, cy, sy, d, cells, k, fill;
  u16 base, v, units;
  const char *l;

  if (f)
  {
    /* cadre de la fenêtre (9-slice ou boîte pleine, comme la textbox) */
    for (cy = 0; cy < h; cy++)
    {
      base = (u16)(ui_ov_y[i] + cy) * 32 + x;
      sy = cy == 0 ? 0 : (cy == (u8)(h - 1) ? 2 : 1);
      for (cx = 0; cx < w; cx++)
      {
#if UI_HAS_SKIN
        ui_map[base + cx] = OV_ENTRY(
            OV_SKIN_BASE + sy * 3 + (cx == 0 ? 0 : (cx == (u8)(w - 1) ? 2 : 1)));
#else
        ui_map[base + cx] = OV_ENTRY(OV_CHAR(' '));
#endif
      }
    }
  }
  else
  {
    /* widget nu : la zone repasse au fond (transparent, ou fond de
       cadre si le widget vit dans une window du designer) */
    u16 bgent = ui_ov_bg[i] ? OV_BG_ENTRY : 0;

    for (cy = 0; cy < h; cy++)
    {
      base = (u16)(ui_ov_y[i] + cy) * 32 + x;
      for (cx = 0; cx < w; cx++)
        ui_map[base + cx] = bgent;
    }
  }

  /* zone de contenu : tout le rect, inset de 1 si cadre */
  x = (u8)(x + f);
  w = (u8)(w - (f << 1));
  h = (u8)(h - (f << 1));
  base = (u16)(ui_ov_y[i] + f) * 32; /* rangée du HAUT du contenu */
  v = ov_last[i];

  switch (ui_ov_type[i])
  {
  case 1: /* gauge — pleine/demie/vide, 2 unités par tile */
  case 2: /* icon_row (cœurs) : même remplissage, toujours horizontal */
    cells = ui_ov_dir[i] ? h : w;
    units = (u16)cells << 1;
    {
      u16 m = ov_lastm[i];

      if (m == 0 || v == 0)
        fill = 0;
      else if (v >= m)
        fill = (u8)units;
      else
        fill = (u8)(((u32)v * units) / m);
    }
    for (k = 0; k < cells; k++)
    {
      /* 2=pleine 1=demie 0=vide -> chars icon+0 / +1 / +2 */
      d = fill > (u8)(k << 1) ? (u8)(fill - (k << 1)) : 0;
      if (d > 2)
        d = 2;
      if (ui_ov_dir[i]) /* verticale : remplie de BAS en haut (ALttP) */
        ui_map[base + (u16)(h - 1 - k) * 32 + x] =
            OV_ENTRY(UI_ICON_BASE + ui_ov_icon[i] + 2 - d);
      else
        ui_map[base + x + k] = OV_ENTRY(UI_ICON_BASE + ui_ov_icon[i] + 2 - d);
    }
    break;

  case 4: /* panel : cadre seul (déjà dessiné ci-dessus) */
    break;

  case 5: /* label : texte statique */
    cx = x;
    l = ui_ov_label[i];
    while (*l && cx < (u8)(x + w))
      ui_map[base + cx++] = OV_ENTRY(OV_CHAR(*l++));
    break;

  case 6: /* image : icônes consécutives de la planche */
    for (k = 0; k < w; k++)
      ui_map[base + x + k] = OV_ENTRY(UI_ICON_BASE + ui_ov_icon[i] + k);
    break;

  case 3: /* icon_value : icône + compteur aligné à droite, zéros pad */
    ui_map[base + x] = OV_ENTRY(UI_ICON_BASE + ui_ov_icon[i]);
    d = 0;
    do
    {
      ov_num[d++] = '0' + (v % 10);
      v /= 10;
    } while (v && d < 5);
    while (d < ui_ov_pad[i] && d < 5)
      ov_num[d++] = '0';
    if (d > (u8)(w - 1)) /* jamais hors du widget (l'icône est gardée) */
      d = (u8)(w - 1);
    cx = (u8)(x + w - d);
    while (d)
      ui_map[base + cx++] = OV_ENTRY(OV_CHAR(ov_num[--d]));
    break;

  default: /* variable_display : libellé à gauche, valeur à droite */
    cx = x;
    l = ui_ov_label[i];
    while (*l && cx < (u8)(x + w - 1))
      ui_map[base + cx++] = OV_ENTRY(OV_CHAR(*l++));
    d = 0;
    do
    {
      ov_num[d++] = '0' + (v % 10);
      v /= 10;
    } while (v && d < 5);
    if (d > w) /* fenêtre étroite : la valeur peut couvrir le libellé,
                  jamais déborder du widget */
      d = w;
    cx = (u8)(x + w - d);
    while (d)
      ui_map[base + cx++] = OV_ENTRY(OV_CHAR(ov_num[--d]));
    break;
  }
  ui_mark(ui_ov_y[i], ui_ov_h[i]);
}

void overlay_init(void)
{
  u8 i;

  /* ui_map est déjà nettoyé par ui_screen_init (appelé avant) */
  for (i = 0; i < UI_OV_COUNT; i++)
  {
    ov_last[i] = vm.vars16[ui_ov_var[i]];
    ov_lastm[i] = ov_max(i);
    ov_draw(i);
  }
}

void overlay_update(void)
{
  u8 i;
  u16 v, m;

  for (i = 0; i < UI_OV_COUNT; i++)
  {
    if (ui_ov_type[i] >= 4)
      continue; /* panel/label/image : statiques (refresh seulement) */
    v = vm.vars16[ui_ov_var[i]];
    m = ov_max(i);
    if (v != ov_last[i] || m != ov_lastm[i])
    {
      ov_last[i] = v;
      ov_lastm[i] = m;
      ov_draw(i);
    }
  }
}

void overlay_refresh(void)
{
  u8 i;

  /* redessin inconditionnel : après l'effacement de la bande du
     dialogue (tb_clear_band), les widgets qui partagent ses rangées
     doivent réapparaître */
  for (i = 0; i < UI_OV_COUNT; i++)
    ov_draw(i);
}

#else /* pas d'overlay dans le layout : module inerte */

void overlay_init(void)
{
}

void overlay_update(void)
{
}

void overlay_refresh(void)
{
}

#endif /* UI_OV_COUNT */
