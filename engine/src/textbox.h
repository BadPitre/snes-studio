/*
 * textbox.h — fenêtre de dialogue sur BG3 (mode 1, 2bpp, priorité haute).
 */
#ifndef TEXTBOX_H
#define TEXTBOX_H

#include <snes.h>

/* Charge la fonte + palette, initialise la map BG3 (vide/transparente).
   À appeler écran éteint. */
void textbox_init(void);

/* Recharge la palette de la fonte (CGRAM 16-19, slots réservés spec §4) —
   à appeler après chaque scene_load : le chargement CGRAM de la scène
   écrase ces slots. */
void textbox_load_pal(void);

/* Prépare la boîte avec le texte text_id (table de data_texts.c),
   avec retour à la ligne par mot. Affichée au prochain VBlank. */
void textbox_open(u16 text_id);

/* Variantes « chaîne C » pour le vocabulaire moteur (menu Système) */
void textbox_open_raw(const char *s);
void textbox_choices_raw(const char *const *options, u8 count, u8 sel);

/* CHOICE (spec §2 v0.6) : affiche 2-4 options (une par ligne) avec le
   curseur '>' sur l'option sel. */
void textbox_open_choices(const u16 *text_ids, u8 count, u8 sel);

/* Déplace le curseur du CHOICE en cours. */
void textbox_choice_cursor(u8 sel);

/* Efface la boîte (map redevient transparente au prochain VBlank). */
void textbox_close(void);

/* Transfère la map BG3 si modifiée. À appeler pendant le VBlank. */
void textbox_vblank(void);

#endif /* TEXTBOX_H */
