/*
 * FICHIER GENERE par tools/datagen — NE PAS EDITER A LA MAIN.
 * Source : demo/ (projet JSON/PNG). Regenerer : make data (ou cargo run).
 */
#include <snes.h>

const u8 anim_count = 0;

/* vignette servant de planche de cellules, par animation */
const u8 anim_vig[] = {
  0x00,
};

/* bit 0 = boucle */
const u8 anim_flags[] = {
  0x00,
};

/* nombre de frames */
const u8 anim_nframes[] = {
  0x00,
};

/* offset de la premiere frame dans anim_track */
const u16 anim_ofs[1] = {
  0x0000,
};

/* piste aplatie : 5 octets par frame
   [cellule][dx signe][dy signe][duree][son, 0xFF = aucun] */
const u8 anim_track[] = {
  0x00,
};
