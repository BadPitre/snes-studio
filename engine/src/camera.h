/*
 * camera.h — caméra centrée joueur, clampée aux bords de map (spec §3).
 */
#ifndef CAMERA_H
#define CAMERA_H

#include <snes.h>

typedef struct
{
  u16 x, y; /* coin haut-gauche en pixels */
} Camera;

extern Camera camera;

/* Centre la caméra sur le joueur, clampée à [0, map*16 - écran] — ou
   exécute le pan scripté en cours (v0.13). */
void camera_update(void);

/* Caméra scriptée (v0.13, opcodes CAMPAN/CAMRET/WAITCAM) */
void camera_init(void);
void camera_pan_to(u8 tx, u8 ty, u8 speed);
void camera_return(u8 speed);
u8 camera_busy(void);

#endif /* CAMERA_H */
