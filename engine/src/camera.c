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

/* Caméra scriptée (v0.13) : 0 = suit le joueur, 1 = pan vers la cible,
   2 = tenue sur la cible. Le pan de retour (CAMRET) repasse en mode 0
   à l'arrivée. */
static u8 cam_mode;
static u8 cam_returning;
static u16 cam_tx, cam_ty; /* cible en pixels (coin haut-gauche) */
static u8 cam_speed;

/* Position « suivi joueur » clampée aux bords de map. Résultat dans
   cam_fx/cam_fy : PAS de paramètres multi-pointeurs (piège tcc-816
   documenté — save_read l'a payé avant nous). */
static u16 cam_fx, cam_fy;

static void cam_follow_target(void)
{
  u16 max_x, max_y;
  u16 x = 0, y = 0;

  if (player.x > (SCREEN_W - 16) / 2)
    x = player.x - (SCREEN_W - 16) / 2;
  if (player.y > (SCREEN_H - 16) / 2)
    y = player.y - (SCREEN_H - 16) / 2;
  max_x = ((u16)scene_ctx.map_w << 4) - SCREEN_W;
  max_y = ((u16)scene_ctx.map_h << 4) - SCREEN_H;
  if (x > max_x)
    x = max_x;
  if (y > max_y)
    y = max_y;
  cam_fx = x;
  cam_fy = y;
}

/* Avance v vers cible d'au plus speed px — renvoie la nouvelle valeur */
static u16 cam_step(u16 v, u16 target, u8 speed)
{
  if (v < target)
    return (u16)(target - v) > speed ? v + speed : target;
  if (v > target)
    return (u16)(v - target) > speed ? v - speed : target;
  return v;
}

void camera_init(void)
{
  cam_fx = 0;
  cam_fy = 0;
  cam_mode = 0;
  cam_returning = 0;
  cam_tx = 0;
  cam_ty = 0;
  cam_speed = 2;
}

/* Pan scripté vers la tile (tx,ty), centrée à l'écran (opcode CAMPAN) */
void camera_pan_to(u8 tx, u8 ty, u8 speed)
{
  u16 max_x, max_y;
  u16 x = 0, y = 0;
  u16 px = (u16)tx << 4, py = (u16)ty << 4;

  if (px > (SCREEN_W - 16) / 2)
    x = px - (SCREEN_W - 16) / 2;
  if (py > (SCREEN_H - 16) / 2)
    y = py - (SCREEN_H - 16) / 2;
  max_x = ((u16)scene_ctx.map_w << 4) - SCREEN_W;
  max_y = ((u16)scene_ctx.map_h << 4) - SCREEN_H;
  if (x > max_x)
    x = max_x;
  if (y > max_y)
    y = max_y;
  cam_tx = x;
  cam_ty = y;
  cam_speed = speed ? speed : 1;
  cam_mode = 1;
  cam_returning = 0;
}

/* Pan de retour vers le joueur puis reprise du suivi (opcode CAMRET) */
void camera_return(u8 speed)
{
  cam_speed = speed ? speed : 1;
  cam_mode = 1;
  cam_returning = 1;
}

/* 1 tant qu'un pan est en cours (opcode WAITCAM) */
u8 camera_busy(void)
{
  return cam_mode == 1;
}

void camera_update(void)
{
  u16 fx, fy;

  if (cam_mode == 0)
  {
    cam_follow_target();
    camera.x = cam_fx;
    camera.y = cam_fy;
    return;
  }
  if (cam_mode == 2)
    return; /* tenue sur la cible du dernier pan */

  /* pan en cours — la cible du retour suit le joueur en continu */
  if (cam_returning)
  {
    cam_follow_target();
    cam_tx = cam_fx;
    cam_ty = cam_fy;
  }
  camera.x = cam_step(camera.x, cam_tx, cam_speed);
  camera.y = cam_step(camera.y, cam_ty, cam_speed);
  if (camera.x == cam_tx && camera.y == cam_ty)
    cam_mode = cam_returning ? 0 : 2;
}
