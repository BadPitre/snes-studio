/*
 * save.h — SRAM saves (spec §4bis v2): 4 slots of 2048 bytes, each with
 * a magic, a version and a checksum. A save is the game state: current
 * scene, hero position and facing, gvars, switches and 16-bit
 * variables.
 */
#ifndef SAVE_H
#define SAVE_H

#include <snes.h>

#define SAVE_SLOTS 4

/* 1 if the slot holds a valid save (magic, version, checksum). */
u8 save_exists(u8 slot);

/* Writes the current game state into the slot. */
void save_write(u8 slot);

/* Result of the last save_read. No multiple pointer parameters — tcc-816
   is fragile on that pattern (ENGINE_CONSTRAINTS.md §1.7): a global struct. */
typedef struct
{
  u8 scene, x, y, dir;
} SaveInfo;

extern SaveInfo save_info;

/* Reads the slot: applies the gvars and fills save_info. Returns 0,
   having changed nothing, if the slot is invalid. */
u8 save_read(u8 slot);

/* M2 — the SRAM event command's load path: the opcode reads the slot
   and requests the restore; the MAIN LOOP performs the warp (the
   do_warp discipline). take returns 1 exactly once per request. */
void save_request_load(void);
u8 save_take_load(void);

#endif /* SAVE_H */
