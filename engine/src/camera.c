/*
 * camera.c — caméra top-down.
 * Clamp AVANT tout calcul dépendant de la caméra (piège kit §8 : bords de map).
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "player.h"
#include "camera.h"

/* Dimensions écran SNES (constantes hardware, pas des données de jeu) */
#define SCREEN_W 256
#define SCREEN_H 224

Camera camera;

void camera_update(void)
{
  u16 max_x, max_y;

  /* Cible : joueur (16x16) centré → caméra = joueur - (écran - perso)/2 */
  if (player.x > (SCREEN_W - 16) / 2)
    camera.x = player.x - (SCREEN_W - 16) / 2;
  else
    camera.x = 0;

  if (player.y > (SCREEN_H - 16) / 2)
    camera.y = player.y - (SCREEN_H - 16) / 2;
  else
    camera.y = 0;

  /* Clamp aux bords de map (map en tiles 16x16 → pixels) */
  max_x = ((u16)scene_ctx.map_w << 4) - SCREEN_W;
  max_y = ((u16)scene_ctx.map_h << 4) - SCREEN_H;
  if (camera.x > max_x)
    camera.x = max_x;
  if (camera.y > max_y)
    camera.y = max_y;
}
