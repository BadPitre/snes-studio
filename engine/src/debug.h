/*
 * debug.h — the in-game debug panel (an editor Settings option).
 * Inert without the dbg_enabled flag (data_debug.c, emitted by datagen).
 */
#ifndef DEBUG_H
#define DEBUG_H

#include <snes.h>

/* Call once per main-loop iteration, outside the VBlank: measures FPS
   and lag, watches for Start+Select+R, draws the panel. */
void debug_update(void);

#endif /* DEBUG_H */
