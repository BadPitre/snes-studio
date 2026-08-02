/*
 * ui_overlay.h — the HUD's permanent windows (overlay §2 of
 * docs/SPEC_SYSTEME_UI.md). Inert when the layout has no overlay.
 */
#ifndef UI_OVERLAY_H
#define UI_OVERLAY_H

#include <snes.h>

/* Initial draw, after ui_screen_init — the buffer must exist first. */
void overlay_init(void);

/* Redraws the windows whose variable changed, every frame, into
   ui_map; ui_screen_vblank does the transfer. */
void overlay_update(void);

/* Unconditional redraw of every widget — called when the dialogue band
   has just been cleared, since it may share their rows. */
void overlay_refresh(void);

/* Visibility of a widget (a layout root) — the SHOWUI opcode. Widgets
   are HIDDEN by default, unless marked "visible at startup". */
void overlay_show(u8 widget, u8 on);

/* Cursor list, driven by the VM (the blocking LISTSEL opcode). `open`
   shows the widget with the cursor at the top and returns the item count;
   0 means the widget has no list primitive and the command is ignored. */
u8 overlay_list_open(u8 widget);
void overlay_list_cursor(u8 sel);
void overlay_list_close(u8 keep); /* releases the cursor; keep = 1 leaves
    the widget shown (multi-panel), 0 hides it again */

#endif /* UI_OVERLAY_H */
