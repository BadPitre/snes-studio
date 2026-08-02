/*
 * weather.h — particle weather: rain and snow as sprites, driven by the
 * WEATHER event command. Persists across scenes, as in RM2003.
 */
#ifndef WEATHER_H
#define WEATHER_H

#include <snes.h>

/* Loads the particle chars (end of the OBJ region) and OBJ palette 7.
   Called by scene_load with the SCREEN OFF, and by picture_hide — a
   picture borrows the OBJ region. */
void weather_load(void);

/* WEATHER command: type 0 none, 1 rain, 2 snow; pow 1-3 is the
   intensity (8/16/24 particles). The state is global and persistent. */
void weather_set(u8 type, u8 pow);

/* Simulation and sprites in ONE pass, after actors_draw: writes the
   particles into the shadow OAM, high entries reserved. Merged on
   purpose — two indexed loops blew the frame budget once added to the
   S14 ripple (seen on the debug panel). */
void weather_draw(void);

#endif /* WEATHER_H */
