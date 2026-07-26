/*
 * textbox.h — fenêtre de dialogue sur BG3 (mode 1, 2bpp, priorité haute).
 */
#ifndef TEXTBOX_H
#define TEXTBOX_H

#include <snes.h>

/* Charge la fonte + palette, initialise la map BG3 (vide/transparente).
   À appeler écran éteint. */
void textbox_init(void);

/* Prépare la boîte avec le texte text_id (table de data_texts.c),
   avec retour à la ligne par mot. Affichée au prochain VBlank. */
void textbox_open(u16 text_id);

/* Efface la boîte (map redevient transparente au prochain VBlank). */
void textbox_close(void);

/* Transfère la map BG3 si modifiée. À appeler pendant le VBlank. */
void textbox_vblank(void);

#endif /* TEXTBOX_H */
