/*
 * ui_screen.c — tampon unique de la couche UI (BG3, Phase 12 cran M1).
 *
 * Avant M1, BG3 avait trois écrivains à shadows disjoints (textbox,
 * ui_overlay, timer) qui pouvaient s'écraser mutuellement et figeaient
 * les fenêtres permanentes dans la bande du haut. Ici : un tampon WRAM
 * de tout l'écran, chacun y compose sa zone, et le VBlank transfère le
 * span contigu des rangées sales (64 octets par rangée).
 */
#include <snes.h>
#include "vram.h"
#include "ui_screen.h"

u16 ui_map[32 * UI_ROWS];
static u8 ui_lo, ui_hi; /* span sale — lo > hi = rien à transférer */

void ui_screen_init(void)
{
  u16 i;

  for (i = 0; i < 32 * UI_ROWS; i++) /* init EXPLICITE (statics tcc) */
    ui_map[i] = 0;
  ui_lo = 255;
  ui_hi = 0;
  /* Map VRAM entière transparente : les 28 rangées du tampon, puis les
     4 rangées hors écran de la map 32x32 (recopie du début — zéros) */
  dmaCopyVram((u8 *)ui_map, VRAM_BG3_MAP, 32 * UI_ROWS * 2);
  dmaCopyVram((u8 *)ui_map, VRAM_BG3_MAP + 32 * UI_ROWS, 32 * 4 * 2);
}

void ui_mark(u8 row, u8 h)
{
  u8 hi = (u8)(row + h - 1);

  if (ui_lo > ui_hi)
  {
    ui_lo = row;
    ui_hi = hi;
    return;
  }
  if (row < ui_lo)
    ui_lo = row;
  if (hi > ui_hi)
    ui_hi = hi;
}

void ui_screen_vblank(void)
{
  u16 ofs;

  if (ui_lo > ui_hi)
    return;
  ofs = (u16)ui_lo << 5; /* 32 entrées par rangée */
  dmaCopyVram((u8 *)ui_map + (ofs << 1), VRAM_BG3_MAP + ofs,
              (u16)(ui_hi - ui_lo + 1) << 6);
  ui_lo = 255;
  ui_hi = 0;
}
