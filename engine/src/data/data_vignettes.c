/*
 * FICHIER GENERE par tools/datagen — NE PAS EDITER A LA MAIN.
 * Source : demo/ (projet JSON/PNG). Regenerer : make data (ou cargo run).
 */
#include <snes.h>

extern const u8 vig0_chars[];
extern const u16 vig0_pal[];
extern const u8 vig1_chars[];
extern const u16 vig1_pal[];

const u8 vig_count = 2;

const u8 vig_frames[2] = { 2, 4, };

const u8 *const vig_chars[2] = { vig0_chars, vig1_chars, };

const u16 *const vig_pals[2] = { vig0_pal, vig1_pal, };
