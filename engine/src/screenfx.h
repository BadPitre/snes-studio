/*
 * screenfx.h — effets d'écran scriptés (v0.15) : fondu (cacher/montrer
 * l'écran), teinte, flash, secousse. Opcodes SCRHIDE/SCRSHOW/TINT/FLASH/
 * SHAKE (spec §2).
 */
#ifndef SCREENFX_H
#define SCREENFX_H

#include <snes.h>

/* Init explicite (boot) — jamais compter sur le zero-init des statics. */
void screenfx_init(void);

/* Après un warp : le fondu du warp laisse l'écran allumé — resynchronise
   le fondu scripté et coupe flash/secousse. La TEINTE persiste entre les
   scènes (modèle RM2003). */
void screenfx_warp_reset(void);

/* Fondu scripté : cacher (vers noir) / montrer (vers 15), speed = pas de
   luminosité par frame (1-15). Bloquants côté VM via screenfx_busy. */
void screenfx_hide(u8 speed);
void screenfx_show(u8 speed);
u8 screenfx_busy(void);

/* Teinte : poser r/g/b (0-31) PUIS appliquer le mode — deux appels
   (parade au piège tcc des paramètres multiples, 3 u8 max prouvés).
   mode 0 = normale, 1 = éclaircir (addition), 2 = assombrir
   (soustraction). Touche le DÉCOR et le fond, pas les personnages
   (color math OBJ limité aux palettes 4-7 par le hardware). Persiste
   entre les scènes jusqu'au prochain TINT (modèle RM2003). */
void screenfx_tint_rgb(u8 r, u8 g, u8 b);
void screenfx_tint(u8 mode);

/* Flash : addition (r,g,b) qui décroît sur `frames` frames, puis la
   teinte courante est restaurée. Non bloquant (enchaîner avec WAIT). */
void screenfx_flash(u8 r, u8 g, u8 b);
void screenfx_flash_start(u8 frames);

/* Secousse : offset horizontal ±power (px), alternance toutes `speed`
   frames, pendant `frames` frames. power 0 = stop. Non bloquant. */
void screenfx_shake(u8 power, u8 speed, u8 frames);

/* Offset de scroll horizontal de la frame (0 hors secousse) — ajouté au
   scroll BG1/BG2 par la boucle principale. */
u16 screenfx_shake_x(void);

/* Mélange picture (S8) : hold posé = screenfx ne touche plus le color
   math ($2130-$2132) — l'image possède le circuit (teinte et flash
   suspendus). Relâcher réaffirme la teinte persistante. */
void screenfx_cm_hold(u8 on);

/* Un pas d'effet par frame (boucle principale, toujours). */
void screenfx_update(void);

/* Écritures registres ($2100, $2130-$2132) — VBlank uniquement. */
void screenfx_vblank(void);

#endif /* SCREENFX_H */
