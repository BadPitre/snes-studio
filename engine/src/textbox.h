/*
 * textbox.h — the dialogue window on BG3 (mode 1, 2bpp, high priority).
 */
#ifndef TEXTBOX_H
#define TEXTBOX_H

#include <snes.h>

/* Loads the font and palette and points the BG3 map at it. Call with
   the screen off; ui_screen_init clears the map. */
void textbox_init(void);

/* Reloads the font palette (CGRAM 16-19, slots reserved by spec §4).
   Call after every scene_load: the scene's CGRAM load overwrites those
   slots. */
void textbox_load_pal(void);

/* Moves BG3's chars and map and re-uploads the font — screen off only.
   A Mode 7 screen wipes the low half of VRAM, font included, so coming
   back from one has to redo it; and a WORLD MAP keeps the UI on BG3 at
   another address for as long as the plane is up (vram.h). */
void textbox_gfx_at(u16 gfx, u16 map);

/* Prepares the box with text text_id (the data_texts.c table), wrapping
   on word boundaries. Shown at the next VBlank. */
void textbox_open(u16 text_id);

/* "C string" variants, for the engine's own vocabulary (System menu) */
void textbox_open_raw(const char *s);
void textbox_choices_raw(const char *const *options, u8 count, u8 sel);

/* CHOICE (spec §2): shows 2-4 options, one per line, with the '>'
   cursor on option `sel`. */
void textbox_open_choices(const u16 *text_ids, u8 count, u8 sel);

/* Moves the cursor of the CHOICE in progress. */
void textbox_choice_cursor(u8 sel);

/* Current dialogue style (the DLGSTYLE opcode): window, windowskin and
   font of style n (0 default; out of range means 0). */
void textbox_set_style(u8 n);

/* Typewriter (UI_TEXT_SPEED > 0): one reveal step per frame, called
   while the VM waits on TEXTBOX. Returns 1 while the reveal is still
   running. Revealing everything at once (the A button) stops on a \! 
   wait point: those are the author's, deliberately. */
void textbox_tick(void);
u8 textbox_busy(void);
void textbox_finish(void);

/* Special codes (spec §2): a \! wait point in progress — pressing A
   must RESUME the reveal, not close the box — resumption after it, and
   automatic closing on \^, where the VM closes without waiting. */
u8 textbox_waiting_key(void);
void textbox_resume(void);
u8 textbox_autoclose(void);

/* Clears the box: the dialogue band goes transparent again at the next
   VBlank, through ui_screen_vblank. */
void textbox_close(void);

#endif /* TEXTBOX_H */
