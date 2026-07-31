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

/* Fondu scripté : cacher (vers noir) / montrer (vers plein), dur =
   DURÉE en frames (1-255, rampe 8.8). Bloquants côté VM via
   screenfx_busy. fx (S18c) : 0 fondu, 1 instantané (dur ignoré),
   2 mosaïque, 3-5 balayage bas/haut/centre (rideau HDMA, mêmes codes
   que les warps). */
void screenfx_hide(u8 dur, u8 fx);
void screenfx_show(u8 dur, u8 fx);
u8 screenfx_busy(void);

/* Teinte : poser r/g/b (0-31) PUIS appliquer le mode — deux appels
   (parade au piège tcc des paramètres multiples, 3 u8 max prouvés).
   mode 0 = normale, 1 = éclaircir (addition), 2 = assombrir
   (soustraction). Touche le DÉCOR et le fond, pas les personnages
   (color math OBJ limité aux palettes 4-7 par le hardware). Persiste
   entre les scènes jusqu'au prochain TINT (modèle RM2003). */
void screenfx_tint_rgb(u8 r, u8 g, u8 b);
void screenfx_tint(u8 mode);

/* Teinte GRADUELLE (S12, jour/nuit) : poser la cible rgb PUIS lancer
   (mode, frames) — même parade tcc que tint_rgb/tint. Non bloquante
   (enchaîner avec WAIT pour attendre), persiste entre les scènes,
   frames 0 = immédiat. mode 0 : fond la teinte courante vers zéro.
   add <-> sub passe par zéro en deux phases (moitié/moitié). Une
   teinte immédiate (TINT) annule la graduelle en cours. */
void screenfx_tintg_rgb(u8 r, u8 g, u8 b);
void screenfx_tintg(u8 mode, u8 frames);

/* Dégradé de ciel (S15) : TEINTE VERTICALE — même circuit color math
   que la teinte, mais la couleur fixe ($2132) est réécrite ligne à
   ligne par le HDMA (canal 4, table statique bâtie par hdmafx_grad).
   screenfx ne détient que le MODE (source de vérité) : il pose
   CGWSEL/CGADSUB au VBlank et laisse COLDATA au HDMA. Un dégradé
   REMPLACE la teinte plate ; TINT/TINTG l'annule (même registre).
   mode 0 = off, 1 = addition, 2 = soustraction. */
void screenfx_skygrad(u8 mode);
u8 screenfx_skygrad_mode(void);

/* Spotlight (S16) : cercle de lumière autour du héros — le décor est
   assombri (soustraction dark,dark,dark) HORS de la fenêtre couleur
   W1, dont le cercle est tracé par le HDMA (hdmafx_spot). dark 0 =
   off, 1-31 = obscurité (31 = décor noir). REMPLACE teinte et
   dégradé ; TINT/TINTG/SKYGRAD le retire (même circuit). Les sprites
   et le texte restent visibles partout (même limite que la teinte). */
void screenfx_spot(u8 dark);
u8 screenfx_spot_active(void);

/* État du circuit pour hdmafx (canal COLDATA coupé quand le circuit
   est tenu par un mélange ou emprunté par un flash) */
u8 screenfx_cm_held(void);
u8 screenfx_flash_active(void);

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

/* Mélange picture/couche d'effet (S8/S9) : hold posé = screenfx ne
   touche plus le color math ($2130-$2132) — le mélange possède le
   circuit (teinte suspendue). EXCEPTION (S13) : un FLASH l'emprunte le
   temps de sa décroissance puis repose les registres mémorisés par
   screenfx_cm_hold_regs (à appeler AVANT cm_hold(1)) — l'éclair
   d'orage traverse les nuages mélangés. Relâcher le hold réaffirme la
   teinte persistante. */
void screenfx_cm_hold_regs(u8 ts, u8 wsel, u8 adsub);
void screenfx_cm_hold(u8 on);

/* Balayage (S18) : HDMA canal 2 → luminosité $2100 par bandes de
   scanlines — des bandes NOIRES qui grandissent. trans : 3 = vers le
   bas (le noir descend du haut), 4 = vers le haut (le noir monte du
   bas), 5 = vers le centre (deux bandes se rejoignent au milieu).
   black = total de lignes noires (0-224). À utiliser UNIQUEMENT dans
   les boucles bloquantes de transition (warp, écran composé), un appel
   par frame juste après WaitForVBlank : hdmafx (propriétaire de $420C
   en régime normal) ne tourne pas pendant ces boucles et réaffirme son
   masque au VBlank suivant la fin. */
void screenfx_wipe_step(u8 trans, u16 black);
void screenfx_wipe_off(void);
/* rideau actif (S18c) — hdmafx ajoute le canal 2 à son masque $420C */
u8 screenfx_wipe_active(void);

/* Un pas d'effet par frame (boucle principale, toujours). */
void screenfx_update(void);

/* Écritures registres ($2100, $2130-$2132) — VBlank uniquement. */
void screenfx_vblank(void);

#endif /* SCREENFX_H */
