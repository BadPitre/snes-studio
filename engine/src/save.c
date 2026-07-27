/*
 * save.c — sauvegardes SRAM (spec §4 v0.7).
 *
 * SRAM LoROM : bank $70, 2 Ko (hdr.asm : SRAMSIZE $01, cartouche à
 * batterie). 4 slots de 128 octets :
 *   0-1   magie "SG"    2 version   3 scène   4 x   5 y   6 dir   7 rés.
 *   8-71  gvars[64]     72-125 réservé (0)    126-127 checksum (somme
 *   16-bit des octets 0-125, little-endian)
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "player.h"
#include "vm.h"
#include "rom_layout.h"
#include "save.h"

#define SAVE_MAGIC0 'S'
#define SAVE_MAGIC1 'G'
#define SAVE_VERSION 1
#define SLOT_SIZE 128

/* Base SRAM d'un slot (écriture : on caste le pointeur far en non-const) */
static u8 *slot_base(u8 slot)
{
  return (u8 *)make_far(0x70, (u16)slot << 7);
}

static u16 slot_checksum(const u8 *s)
{
  u16 sum = 0;
  u8 i;

  for (i = 0; i < 126; i++)
    sum += s[i];
  return sum;
}

u8 save_exists(u8 slot)
{
  const u8 *s = slot_base(slot);
  u16 sum;

  if (s[0] != SAVE_MAGIC0 || s[1] != SAVE_MAGIC1 || s[2] != SAVE_VERSION)
    return 0;
  sum = slot_checksum(s);
  return s[126] == (u8)sum && s[127] == (u8)(sum >> 8);
}

void save_write(u8 slot)
{
  u8 *s = slot_base(slot);
  u16 sum;
  u8 i;

  s[0] = SAVE_MAGIC0;
  s[1] = SAVE_MAGIC1;
  s[2] = SAVE_VERSION;
  s[3] = scene_ctx.scene_id;
  s[4] = (u8)(player.x >> 4);
  s[5] = (u8)(player.y >> 4);
  s[6] = player.dir;
  s[7] = 0;
  for (i = 0; i < 64; i++)
    s[8 + i] = vm.gvars[i];
  for (i = 72; i < 126; i++)
    s[i] = 0;
  sum = slot_checksum(s);
  s[126] = (u8)sum;
  s[127] = (u8)(sum >> 8);
}

SaveInfo save_info;

u8 save_read(u8 slot)
{
  const u8 *s = slot_base(slot);
  u8 i;

  if (!save_exists(slot))
    return 0;
  save_info.scene = s[3];
  save_info.x = s[4];
  save_info.y = s[5];
  save_info.dir = s[6];
  for (i = 0; i < 64; i++)
    vm.gvars[i] = s[8 + i];
  return 1;
}
