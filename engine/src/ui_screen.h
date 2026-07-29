/*
 * ui_screen.h — tampon UNIQUE de la couche UI (BG3, Phase 12 cran M1).
 *
 * Réf docs/PLANNING_SYSTEME_MENUS.md : les modules UI (textbox,
 * ui_overlay, timer) dessinent dans ui_map HORS VBlank et déclarent
 * leurs rangées touchées via ui_mark ; un seul DMA du span sale au
 * VBlank. ui_map est LA vérité de la map BG3 — personne d'autre
 * n'écrit cette zone VRAM.
 */
#ifndef UI_SCREEN_H
#define UI_SCREEN_H

#include <snes.h>

#define UI_ROWS 28 /* écran 32x28 tiles — la map BG3 32x32 déborde de 4 */

extern u16 ui_map[32 * UI_ROWS];

/* Nettoie le tampon ET la map VRAM entière — écran éteint uniquement. */
void ui_screen_init(void);

/* Déclare les rangées [row, row+h) modifiées — après chaque écriture. */
void ui_mark(u8 row, u8 h);

/* Le span sale courant touche-t-il [row, row+h) ? Pour un module qui
   veut rester AU-DESSUS des autres (panneau de debug S6) : re-blitter
   seulement quand quelqu'un a repeint ses rangées cette frame. */
u8 ui_dirty_overlap(u8 row, u8 h);

/* DMA du span de rangées sales — VBlank uniquement. */
void ui_screen_vblank(void);

#endif /* UI_SCREEN_H */
