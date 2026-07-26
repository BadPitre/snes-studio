/*
 * vram.h — layout VRAM du moteur (docs/SPEC_FORMATS.md §4).
 * Choix du moteur, pas des données. Adresses en words.
 */
#ifndef VRAM_H
#define VRAM_H

#define VRAM_BG1_MAP 0x0000 /* tilemap BG1 SC_64x64 : 4 écrans 32x32, 8 Ko */
#define VRAM_BG1_GFX 0x2000 /* characters BG1 (tileset 4bpp) */
#define VRAM_OBJ_GFX 0x4000 /* characters OBJ (sprites 4bpp, pas de 8K words) */

#endif /* VRAM_H */
