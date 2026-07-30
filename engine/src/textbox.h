/*
 * textbox.h — fenêtre de dialogue sur BG3 (mode 1, 2bpp, priorité haute).
 */
#ifndef TEXTBOX_H
#define TEXTBOX_H

#include <snes.h>

/* Charge la fonte + palette et pointe la map BG3. À appeler écran
   éteint (le nettoyage de la map est fait par ui_screen_init — M1). */
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

/* Style de dialogue courant (S1, opcode DLGSTYLE) : fenêtre, windowskin
   et fonte du style n (0 = défaut, hors bornes = 0). */
void textbox_set_style(u8 n);

/* Machine à écrire (Phase 11, thème UI_TEXT_SPEED > 0) : un pas de
   révélation par frame (appelé pendant l'attente TEXTBOX de la VM),
   1 si la révélation court encore, tout révéler d'un coup (touche A —
   s'arrête sur un point d'attente \! : ils sont voulus par l'auteur). */
void textbox_tick(void);
u8 textbox_busy(void);
void textbox_finish(void);

/* Codes spéciaux (T2, spec §2) : point d'attente \! en cours (l'appui
   sur A doit REPRENDRE la révélation, pas fermer), reprise après \!,
   et fermeture automatique \^ (la VM ferme sans attendre d'appui). */
u8 textbox_waiting_key(void);
void textbox_resume(void);
u8 textbox_autoclose(void);

/* Efface la boîte (la bande du dialogue redevient transparente au
   prochain VBlank — transfert centralisé par ui_screen_vblank). */
void textbox_close(void);

#endif /* TEXTBOX_H */
