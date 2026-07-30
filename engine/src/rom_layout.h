/*
 * rom_layout.h — layout des banks ROM de données (kit §3, spec §1).
 * Choix du moteur/pipeline, tenu en phase avec tools/datagen (binbank.rs).
 */
#ifndef ROM_LAYOUT_H
#define ROM_LAYOUT_H

/* Multi-bank (M1) : $82 et $86 portent les TABLES (Scene Table,
   en-tête textes) — les données elles-mêmes peuvent vivre dans des
   banks supplémentaires, leurs numéros voyagent dans les pointeurs far
   émis par datagen. Le moteur suit les pointeurs, sans carte des banks. */
#define BANK_SCENES 0x82    /* Scene Table à $82:8000 */
#define BANK_TEXTS 0x86     /* en-tête textes (count + entrées + paires) */
#define BANK_BASE_ADDR 0x8000 /* LoROM : les banks de données commencent là */

/*
 * Pointeur far tcc-816 construit octet par octet dans sa représentation
 * mémoire : [addr lo][addr hi][bank][0]. PAS d'arithmétique 32-bit :
 * tcc-816 compile mal `(u32)bank << 16` quand bank est une variable
 * (pointeur corrompu, vérifié au harnais d'émulation — Phase 2b).
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
