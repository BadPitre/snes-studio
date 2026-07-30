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

/* Redessin inconditionnel de tous les widgets — appelé quand la bande
   du dialogue vient d'être effacée (elle peut partager leurs rangées). */
void overlay_refresh(void);

/* Visibilité d'un widget (racine du layout) — opcode SHOWUI (Ph. 12).
   Les widgets sont CACHÉS par défaut (sauf « Visible au démarrage »). */
void overlay_show(u8 widget, u8 on);

/* Liste à curseur (B6) — pilotée par la VM (opcode LISTSEL, bloquant).
   open : affiche le widget, curseur en haut, renvoie le nombre d'items
   (0 = le widget n'a pas de primitive liste : la commande est ignorée). */
u8 overlay_list_open(u8 widget);
void overlay_list_cursor(u8 sel);
void overlay_list_close(void); /* cache le widget et libère le curseur */

#endif /* UI_OVERLAY_H */
