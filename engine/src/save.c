/*
 * save.c — SRAM saves (spec §4bis v2).
 *
 * LoROM SRAM: bank $70, 8 KB (hdr.asm sets SRAMSIZE $03, a battery
 * cartridge). Four slots of 2048 bytes:
 *   0-1   magic "SG"   2 version=2   3 scene   4 x   5 y   6 dir  7 rsv
 *   8-71    gvars[64]
 *   72-135  switches (512 bits)
 *   136-647 16-bit variables [256], little-endian
 *   648-649 checksum (16-bit sum of bytes 0-647, little-endian)
 *   650+    reserved, not covered by the checksum
 * v1 saves (2 KB, 128-byte slots) are not migrated: magic and version
 * sit at the same offset for slot 0, but a version other than 2 makes
 * the slot read as empty.
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
#define SAVE_VERSION 2
#define SAVE_DATA_END 648 /* bytes covered by the checksum */

/* SRAM base of a slot (for writing, the far pointer is cast non-const) */
static u8 *slot_base(u8 slot)
{
  return (u8 *)make_far(0x70, (u16)slot << 11);
}

static u16 slot_checksum(const u8 *s)
{
  u16 sum = 0;
  u16 i;

  for (i = 0; i < SAVE_DATA_END; i++)
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
  return s[SAVE_DATA_END] == (u8)sum && s[SAVE_DATA_END + 1] == (u8)(sum >> 8);
}

void save_write(u8 slot)
{
  u8 *s = slot_base(slot);
  u16 sum, i;

  s[0] = SAVE_MAGIC0;
  s[1] = SAVE_MAGIC1;
  s[2] = SAVE_VERSION;
  s[3] = scene_ctx.scene_id;
  s[4] = (u8)(player.x >> 4);
  s[5] = (u8)(player.y >> 4);
  s[6] = player.dir;
  s[7] = 0;
  for (i = 0; i < 64; i++)
  {
    s[8 + i] = vm.gvars[i];
    s[72 + i] = vm.switches[i];
  }
  for (i = 0; i < VM_VAR16_COUNT; i++)
  {
    s[136 + (i << 1)] = (u8)vm.vars16[i];
    s[137 + (i << 1)] = (u8)(vm.vars16[i] >> 8);
  }
  sum = slot_checksum(s);
  s[SAVE_DATA_END] = (u8)sum;
  s[SAVE_DATA_END + 1] = (u8)(sum >> 8);
}

SaveInfo save_info;

u8 save_read(u8 slot)
{
  const u8 *s = slot_base(slot);
  u16 i;

  if (!save_exists(slot))
    return 0;
  save_info.scene = s[3];
  save_info.x = s[4];
  save_info.y = s[5];
  save_info.dir = s[6];
  for (i = 0; i < 64; i++)
  {
    vm.gvars[i] = s[8 + i];
    vm.switches[i] = s[72 + i];
  }
  for (i = 0; i < VM_VAR16_COUNT; i++)
    vm.vars16[i] = (u16)s[136 + (i << 1)] | ((u16)s[137 + (i << 1)] << 8);
  return 1;
}
