/*
 * camera.h — player-centred camera, clamped to the map edges (spec §3).
 */
#ifndef CAMERA_H
#define CAMERA_H

#include <snes.h>

typedef struct
{
  u16 x, y; /* top-left corner, in pixels */
} Camera;

extern Camera camera;

/* Centres the camera on the player, clamped to [0, map*16 - screen] —
   or runs the scripted pan in progress. */
void camera_update(void);

/* Scripted camera (CAMPAN/CAMRET/WAITCAM opcodes) */
void camera_init(void);
void camera_pan_to(u8 tx, u8 ty, u8 speed);
void camera_return(u8 speed);
u8 camera_busy(void);

#endif /* CAMERA_H */
