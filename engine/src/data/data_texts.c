/*
 * data_texts.c — DONNÉES (bank logique textes, kit §3 : $86).
 * Format : table indexée par text_id, chaînes ASCII terminées par 0x00
 * — docs/SPEC_FORMATS.md §2 (« Textes »).
 *
 * Séparé des scènes pour faciliter la localisation future. Encodage v0 :
 * ASCII simple, pas d'accents (fonte définitive en v1).
 */
#include <snes.h>

/* text_id 0 — premier dialogue du PNJ compteur (script canonique, kit §5) */
static const char txt_bonjour[] = "Bonjour ! Je suis le premier PNJ de ce moteur.";

/* text_id 1 — dialogue après plusieurs interactions */
static const char txt_encore[] = "Encore toi ? On s'est deja parle plusieurs fois !";

const char *const text_table[] = {
  txt_bonjour, /* 0 */
  txt_encore,  /* 1 */
};

const u16 text_count = 2;
