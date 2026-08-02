/*
 * rom_layout.h — the layout of the data ROM banks (spec §1).
 * An engine and pipeline choice, kept in step with tools/datagen.
 */
#ifndef ROM_LAYOUT_H
#define ROM_LAYOUT_H

/* $82 and $86 carry the TABLES (the Scene Table, the text header); the
   data itself may live in extra banks, whose numbers travel inside the
   far pointers datagen emits. The engine follows the pointers and holds
   no map of the banks. */
#define BANK_SCENES 0x82    /* Scene Table at $82:8000 */
#define BANK_TEXTS 0x86     /* text header (count + entries + pairs) */
#define BANK_BASE_ADDR 0x8000 /* LoROM: data banks start here */

/*
 * A tcc-816 far pointer, built byte by byte in its memory
 * representation: [addr lo][addr hi][bank][0]. NO 32-bit arithmetic —
 * tcc-816 miscompiles `(u32)bank << 16` when bank is a variable
 * (docs/ENGINE_CONSTRAINTS.md §1.4).
 */
static const u8 *make_far(u8 bank, u16 addr)
{
  const u8 *p;
  u8 *raw = (u8 *)&p;

  raw[0] = (u8)addr;
  raw[1] = (u8)(addr >> 8);
  raw[2] = bank;
  raw[3] = 0;
  return p;
}

#endif /* ROM_LAYOUT_H */
