/*
 * ui_overlay.h — fenêtres permanentes du HUD (Phase 11, overlay §2 de
 * docs/SPEC_SYSTEME_UI.md). Inerte si le layout n'a pas d'overlay.
 */
#ifndef UI_OVERLAY_H
#define UI_OVERLAY_H

#include <snes.h>

/* Dessin initial (après ui_screen_init — le tampon doit être posé). */
void overlay_init(void);

/* Redessine les fenêtres dont la variable a changé (chaque frame) —
   dans ui_map, transfert centralisé par ui_screen_vblank (M1). */
void overlay_update(void);

#endif /* UI_OVERLAY_H */
