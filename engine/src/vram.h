/*
 * vram.h — layout VRAM du moteur (docs/SPEC_FORMATS.md §4).
 * Choix du moteur, pas des données. Adresses en words.
 */
#ifndef VRAM_H
#define VRAM_H

#define VRAM_BG1_MAP 0x0000 /* tilemap BG1 SC_64x64 (couche SUP) : 8 Ko */
#define VRAM_BG3_GFX 0x1000 /* characters BG3 2bpp (fonte textbox, pas 4K) */
#define VRAM_BG3_MAP 0x1800 /* tilemap BG3 SC_32x32 (textbox) */
#define VRAM_BG1_GFX 0x2000 /* characters BG1+BG2 (tileset 4bpp partagé) */
#define VRAM_OBJ_GFX 0x4000 /* characters OBJ (sprites 4bpp, pas de 8K words) */
#define VRAM_BG2_MAP 0x6000 /* tilemap BG2 SC_64x64 (couche INF) : 8 Ko */

#endif /* VRAM_H */
