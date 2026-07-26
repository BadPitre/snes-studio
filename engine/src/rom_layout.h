/*
 * rom_layout.h — layout des banks ROM de données (kit §3, spec §1).
 * Choix du moteur/pipeline, tenu en phase avec tools/datagen (binbank.rs).
 */
#ifndef ROM_LAYOUT_H
#define ROM_LAYOUT_H

#define BANK_SCENES 0x82    /* Scene Table à $82:8000 + données de scènes */
#define BANK_TEXTS 0x86     /* table d'offsets + chaînes terminées par 0 */
#define BANK_BASE_ADDR 0x8000 /* LoROM : les banks de données commencent là */

/* Pointeur far tcc-816 depuis bank + adresse 16-bit */
#define FAR_PTR(bank, addr) ((const u8 *)(((u32)(bank) << 16) | (u16)(addr)))

#endif /* ROM_LAYOUT_H */
