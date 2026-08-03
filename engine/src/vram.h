/*
 * vram.h — the engine's VRAM layout (docs/SPEC_FORMATS.md §4).
 * An engine choice, not a data one. Addresses are in words.
 */
#ifndef VRAM_H
#define VRAM_H

#define VRAM_BG1_MAP 0x0000 /* BG1 tilemap SC_64x64 (UPPER layer): 8 KB */
#define VRAM_BG3_GFX 0x1000 /* BG3 chars, 2bpp (textbox font; not 4K) */
#define VRAM_BG3_MAP 0x1800 /* BG3 tilemap SC_32x32 (textbox) */
#define VRAM_BG1_GFX 0x2000 /* BG1+BG2 chars (the shared 4bpp tileset) */
#define VRAM_OBJ_GFX 0x4000 /* OBJ chars (4bpp sprites; not an 8K-word step) */
#define VRAM_BG2_MAP 0x6000 /* BG2 tilemap SC_64x64 (LOWER layer): 8 KB */
#define VRAM_PIC_MAP 0x7000 /* 32x32 picture tilemap — region
                               free after the BG2 map ($7000-$8000) */
/* Effect layer: in scenes that use one, the BG1 map region is
   REPURPOSED — BG1 carries the pattern instead of the upper layer. The
   pattern's chars sit at $0000-$1000 (at most 256, checked by datagen)
   and its 32x32 map lives in the gap at $1C00-$2000, after the BG3 map
   (the font holds $1000-$1800, the textbox map $1800-$1C00). */
#define VRAM_EFF_GFX 0x0000
#define VRAM_EFF_MAP 0x1C00

/* WORLD MAP (Mode 7). The plane owns $0000-$3FFF whole, so the UI layer
   moves above the OBJ region, where the sky picture already lives.
   BG3's chars must sit on a 4K-WORD boundary (BG34NBA is a nibble) and
   only $7000 is free up there — which is what pushes the sky tilemap
   onto $7400.
     $6000 sky chars   $7000 BG3 chars (font)   $7400 sky tilemap
     $7800 BG1's blank map   $7C00 BG3 tilemap (the UI screen) */
#define VRAM_M7_UI_GFX 0x7000
#define VRAM_M7_UI_MAP 0x7C00

#endif /* VRAM_H */
