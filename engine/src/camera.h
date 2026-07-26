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

/* Centre la caméra sur le joueur, clampée à [0, map*16 - écran]. */
void camera_update(void);

#endif /* CAMERA_H */
