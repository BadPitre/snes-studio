/*
 * ui_screen.h — the SINGLE buffer of the UI layer (BG3).
 *
 * See docs/PLANNING_SYSTEME_MENUS.md. The UI modules (textbox,
 * ui_overlay, timer) draw into ui_map OUTSIDE the VBlank and declare
 * the rows they touched through ui_mark; one DMA of the dirty span
 * happens at VBlank. ui_map is THE truth of the BG3 map — nobody else
 * writes that VRAM area.
 */
#ifndef UI_SCREEN_H
#define UI_SCREEN_H

#include <snes.h>

#define UI_ROWS 28 /* 32x28 tile screen — the 32x32 BG3 map overflows by 4 */

extern u16 ui_map[32 * UI_ROWS];

/* Clears the buffer AND the whole VRAM map — screen off only. */
void ui_screen_init(void);

/* Declares rows [row, row+h) modified — after every write. */
void ui_mark(u8 row, u8 h);

/* Does the current dirty span touch [row, row+h)? For a module that
   wants to stay ABOVE the others (the debug panel): re-blit only when
   somebody repainted its rows this frame. */
u8 ui_dirty_overlap(u8 row, u8 h);

/* DMA of the dirty row span — VBlank only. */
void ui_screen_vblank(void);

#endif /* UI_SCREEN_H */
