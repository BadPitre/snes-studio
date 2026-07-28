/*
 * ui_overlay.h — fenêtres permanentes du HUD (Phase 11, overlay §2 de
 * docs/SPEC_SYSTEME_UI.md). Inerte si le layout n'a pas d'overlay.
 */
#ifndef UI_OVERLAY_H
#define UI_OVERLAY_H

#include <snes.h>

/* Dessin initial (après textbox_init — la map BG3 doit être posée). */
void overlay_init(void);

/* Redessine les fenêtres dont la variable a changé (chaque frame). */
void overlay_update(void);

/* Transfert VRAM si modifié — VBlank uniquement. */
void overlay_vblank(void);

#endif /* UI_OVERLAY_H */
