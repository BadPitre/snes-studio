/*
 * FICHIER GENERE par tools/datagen — NE PAS EDITER A LA MAIN.
 * Source : demo/ (projet JSON/PNG). Regenerer : make data (ou cargo run).
 */
#include <snes.h>

static const char txt_bonjour[] = "Bonjour ! Je suis le premier PNJ de ce moteur.";
static const char txt_encore[] = "Encore toi ? On s'est deja parle plusieurs fois !";
static const char txt_belle_journee[] = "Belle journee pour se promener, n'est-ce pas ?";
static const char txt_scene1[] = "Ici c'est la scene 1 : meme moteur, autres donnees !";

const char *const text_table[] = {
  txt_bonjour, /* 0 */
  txt_encore, /* 1 */
  txt_belle_journee, /* 2 */
  txt_scene1, /* 3 */
};

const u16 text_count = 4;
