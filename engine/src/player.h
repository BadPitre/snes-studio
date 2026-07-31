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

/* Demande un warp par script (opcode WARP, spec §2 v0.6) — consommé par
   la boucle principale comme un warp de tile. trans (S18) : 0 fondu,
   1 instantané, 2 mosaïque. */
void player_request_warp(u8 dest_scene, u8 dest_x, u8 dest_y, u8 trans);

/* Direction d'arrivée du dernier warp consommé (v0.16) : 0 = conserver la
   direction du héros, 1-4 = DIR_* + 1 (WarpDef.flags bits 0-2). */
u8 player_take_warp_dir(void);

/* Transition du dernier warp consommé (S18) : 0 fondu, 1 instantané,
   2 mosaïque — consommée, comme la direction. */
u8 player_take_warp_trans(void);

#endif /* PLAYER_H */
