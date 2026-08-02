/*
 * camera.c — the top-down camera.
 * Clamp BEFORE any camera-dependent computation: map edges bite.
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "player.h"
#include "camera.h"

/* SNES screen dimensions (hardware constants, not game data) */
#define SCREEN_W 256
#define SCREEN_H 224

Camera camera;

/* Scripted camera: 0 follows the player, 1 pans to the target, 2 holds
   on the target. The return pan (CAMRET) goes back to mode 0 on
   arrival. */
static u8 cam_mode;
static u8 cam_returning;
static u16 cam_tx, cam_ty; /* target in pixels (top-left corner) */
static u8 cam_speed;

/* "Follow the player" position, clamped to the map edges. The result
   goes into cam_fx/cam_fy: NO multiple pointer parameters, see
   docs/ENGINE_CONSTRAINTS.md §1.7 — save_read paid for that one. */
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

/* Advances v towards the target by at most speed px; returns the new value */
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

/* Scripted pan to tile (tx,ty), centred on screen (the CAMPAN opcode) */
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

/* Return pan to the player, then following resumes (the CAMRET opcode) */
void camera_return(u8 speed)
{
  cam_speed = speed ? speed : 1;
  cam_mode = 1;
  cam_returning = 1;
}

/* 1 while a pan is in progress (the WAITCAM opcode) */
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
    return; /* held on the last pan's target */

  /* pan in progress — the return target keeps following the player */
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
