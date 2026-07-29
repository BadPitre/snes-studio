/*
 * picture.h — pictures plein écran (S3, façon RM2003) : une image
 * indexée ≤ 16 couleurs affichée sur BG1 par la commande d'event
 * « Afficher une image » (opcode SHOWPIC), refermée par HIDEPIC.
 */
#ifndef PICTURE_H
#define PICTURE_H

#include <snes.h>

/* Affiche la picture id plein écran : BG2 et les sprites sont masqués,
   BG3 (dialogues, widgets) reste au-dessus — un message peut se jouer
   SUR l'image. Id hors bornes : ignoré. */
void picture_show(u8 id);

/* Referme l'image : recharge le tileset de la scène (chars + palettes)
   et redessine la fenêtre tilemap — positions et états des events
   INTACTS (rien d'autre n'est rechargé). */
void picture_hide(void);

/* Requête différée depuis la VM (SHOWPIC/HIDEPIC) : la transition est
   appliquée par la boucle principale via picture_apply() — même modèle
   que le warp scripté (player_take_warp). x/y : position ÉCRAN en
   pixels (S5, l'image est calée en haut-gauche de sa carte et placée
   par le scroll BG1), clampée aux dims réelles de l'image. flags (S7) :
   bit 2 = centrer (le moteur calcule avec les dims). dur = frames de
   CHAQUE fondu (0 = instantané). La VM résout les variables (bits 0-1
   de l'opcode) AVANT l'appel. */
void picture_request(u8 show, u8 id, u8 x, u8 y, u8 flags, u8 dur);
void picture_apply(void);

/* Glisse l'image affichée vers (x,y) en dur frames (0 = saut) — pose
   un état seulement (sûr depuis vm_update), le scroll avance frame par
   frame dans picture_apply : NON-bloquant, façon Move Picture RM2003.
   flags bit 2 = centrer. Sans image affichée : ignoré (S7). */
void picture_move(u8 x, u8 y, u8 flags, u8 dur);

/* Scroll BG1 de l'image (position S5) — appelé chaque VBlank par la
   boucle principale tant que picture_active(). */
void picture_vblank(void);

/* 1 tant qu'une image est affichée — la boucle principale gèle le
   streaming de la map et le scroll BG1 pendant ce temps. */
u8 picture_active(void);

/* Oubli sans restauration (warp pendant une image : scene_load va tout
   recharger de toute façon) — rétablit juste les couches TM. */
void picture_reset(void);

#endif /* PICTURE_H */
