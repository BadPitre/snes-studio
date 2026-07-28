/*
 * ui_overlay.c — fenêtres PERMANENTES du HUD (Phase 11, contexte
 * « overlay » de docs/SPEC_SYSTEME_UI.md §2), en continu pendant le
 * gameplay. v1 : content type variable_display (libellé + valeur d'une
 * variable 16-bit).
 *
 * Les fenêtres viennent du layout uigen (ui_overlays.c généré) ; le
 * redessin ne part que quand une valeur change. Depuis M1 (Phase 12),
 * le module compose dans le tampon partagé ui_map (ui_screen.c) — le
 * transfert VRAM est centralisé au VBlank par ui_screen_vblank.
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
extern const char *const ui_ov_label[];

#define OV_ENTRY(c) ((u16)(c) | 0x3000) /* palette fonte + priorité */
#define OV_CHAR(a) ((u16)(a) - 31)
#define OV_SKIN_BASE 97

static u16 ov_last[UI_OV_COUNT]; /* dernière valeur dessinée par fenêtre */
static char ov_num[5];

static void ov_draw(u8 i)
{
  u8 x = ui_ov_x[i];
  u8 w = ui_ov_w[i];
  u8 h = ui_ov_h[i];
  u8 cx, cy, sy, d;
  u16 base, v;
  const char *l;

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
  /* contenu : libellé à gauche, valeur alignée à droite */
  base = (u16)(ui_ov_y[i] + 1) * 32;
  cx = x + 1;
  l = ui_ov_label[i];
  while (*l && cx < (u8)(x + w - 1))
    ui_map[base + cx++] = OV_ENTRY(OV_CHAR(*l++));
  v = ov_last[i];
  d = 0;
  do
  {
    ov_num[d++] = '0' + (v % 10);
    v /= 10;
  } while (v && d < 5);
  cx = (u8)(x + w - 1 - d);
  while (d)
    ui_map[base + cx++] = OV_ENTRY(OV_CHAR(ov_num[--d]));
  ui_mark(ui_ov_y[i], h);
}

void overlay_init(void)
{
  u8 i;

  /* ui_map est déjà nettoyé par ui_screen_init (appelé avant) */
  for (i = 0; i < UI_OV_COUNT; i++)
  {
    ov_last[i] = vm.vars16[ui_ov_var[i]];
    ov_draw(i);
  }
}

void overlay_update(void)
{
  u8 i;
  u16 v;

  for (i = 0; i < UI_OV_COUNT; i++)
  {
    v = vm.vars16[ui_ov_var[i]];
    if (v != ov_last[i])
    {
      ov_last[i] = v;
      ov_draw(i);
    }
  }
}

#else /* pas d'overlay dans le layout : module inerte */

void overlay_init(void)
{
}

void overlay_update(void)
{
}

#endif /* UI_OV_COUNT */
