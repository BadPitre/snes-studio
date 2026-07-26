/*
 * player.h — module top-down : joueur (spec §3).
 */
#ifndef PLAYER_H
#define PLAYER_H

#include <snes.h>

typedef struct
{
  u16 x, y;      /* position en pixels (coin haut-gauche du metasprite) */
  u8 dir;        /* DIR_* */
  u8 moving;
  u8 anim_frame;
  u8 anim_timer;
} Player;

extern Player player;

/* Init depuis les données de scène (position de départ du Scene Header) +
   chargement du gfx joueur en VRAM. À appeler après scene_load(). */
void player_init(void);

/* Lecture du pad + mouvement 4 directions (1 px/frame, clamp aux bords de map).
   La collision arrive en semaine 3. */
void player_update(void);

/* Écrit le metasprite dans le shadow OAM (coordonnées écran via la caméra).
   Le transfert OAM part automatiquement au VBlank (NMI PVSnesLib). */
void player_draw(void);

/* Place le joueur sur une tile (utilisé à l'arrivée d'un warp) sans
   redéclencher le warp de la tile d'arrivée. */
void player_set_pos(u8 tx, u8 ty);

/* Warp demandé cette frame ? Renvoie 1 et remplit la destination (une
   seule fois — l'appel consomme la demande). */
u8 player_take_warp(u8 *dest_scene, u8 *dest_x, u8 *dest_y);

#endif /* PLAYER_H */
