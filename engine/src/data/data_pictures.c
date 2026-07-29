/*
 * FICHIER GENERE par tools/datagen — NE PAS EDITER A LA MAIN.
 * Source : demo/ (projet JSON/PNG). Regenerer : make data (ou cargo run).
 */
#include <snes.h>

extern const u8 pic0_chars[];
extern const u16 pic0_chars_size;
extern const u16 pic0_map[];
extern const u16 pic0_pal[];
extern const u8 pic1_chars[];
extern const u16 pic1_chars_size;
extern const u16 pic1_map[];
extern const u16 pic1_pal[];
extern const u8 pic2_chars[];
extern const u16 pic2_chars_size;
extern const u16 pic2_map[];
extern const u16 pic2_pal[];

const u8 pic_count = 3;

const u8 pic_wt[3] = { 32, 6, 12, };
const u8 pic_ht[3] = { 28, 6, 10, };

const u8 pic_flags[3] = { 0, 1, 1, };

const u8 *const pic_chars[3] = { pic0_chars, pic1_chars, pic2_chars, };

const u16 *const pic_chars_sizes[3] = { &pic0_chars_size, &pic1_chars_size, &pic2_chars_size, };

const u16 *const pic_maps[3] = { pic0_map, pic1_map, pic2_map, };

const u16 *const pic_pals[3] = { pic0_pal, pic1_pal, pic2_pal, };
