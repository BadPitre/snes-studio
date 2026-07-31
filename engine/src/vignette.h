/*
 * vignette.h — vignettes animées (B5) : petites images en SPRITES,
 * jouées par planches de frames 32x32 — émoticônes au-dessus des
 * têtes (« ! », « ? »), objets brandis, scintillements, et les
 * ANIMATIONS D'ATTAQUE par-dessus les monstres de l'écran composé.
 *
 * 2 slots simultanés (palettes OBJ 5 et 6 réservées — les sprite sets
 * de scène plafonnent aux palettes 0-4, la météo est en 7). Seule la
 * frame COURANTE vit en VRAM (chars 384-447, sous les sets de scène) :
 * un changement de frame = 512 octets de DMA. Une vignette = UNE
 * entrée OAM 32x32 (OBJ_LARGE), entrées 96-97 réservées.
 *
 * Ancrage : écran (fixe), héros (suit le joueur — émoticônes) ou
 * ACTEUR (suit un event — ancrage des animations A1).
 * Les vignettes persistent entre les scènes et fonctionnent sur la
 * map ET sur l'écran composé ; pendant une picture plein écran (qui
 * emprunte toute la région OBJ) elles sont suspendues et reviennent
 * à la fermeture.
 *
 * Le lecteur d'animations (anim.c, A1) EMPRUNTE ces slots : une
 * animation image par image, c'est une vignette dont la cellule, la
 * position et le son changent à chaque frame. Il pose son drapeau de
 * propriété (vig_own_anim) ; un vig_show scripté le retire, ce qui
 * signale au lecteur que son slot a été préempté.
 */
#ifndef VIGNETTE_H
#define VIGNETTE_H

#include <snes.h>

#define VIG_SLOTS 2

#define VIG_ANC_SCREEN 0
#define VIG_ANC_HERO 1
#define VIG_ANC_ACTOR 2

/* Affiche la vignette vig_id dans le slot, frame 0, sans animation.
   anchor : 0 = position écran (x,y), 1 = accrochée au héros (x,y =
   offsets SIGNÉS autour de sa tête). */
void vig_show(u8 slot, u8 vig_id, u8 x, u8 y);
void vig_anchor(u8 slot, u8 anchor);

/* Ancrage sur un acteur de la scène (VIG_ANC_ACTOR + cible). */
void vig_anchor_actor(u8 slot, u8 index);

/* Pilotage frame par frame (lecteur d'animations) : cellule courante de
   la planche, et position/offset. Ne touchent pas au mode d'animation
   interne (vig_play), qui reste à l'arrêt. */
void vig_set_frame(u8 slot, u8 frame);
void vig_move(u8 slot, u8 x, u8 y);

/* Slot libre pour un usage automatique — le PLUS HAUT non occupé, pour
   laisser les slots bas aux vig_show scriptés. 0xFF si aucun. */
u8 vig_free_slot(void);

/* Propriété du slot : posée par le lecteur d'animations, retirée par
   tout vig_show scripté (préemption) et par vig_hide. */
void vig_own_anim(u8 slot);
u8 vig_is_anim(u8 slot);

/* Lance l'animation : mode 0 = stop (fige la frame courante), 1 = une
   fois PUIS CACHE la vignette (coup d'épée), 2 = boucle. speed =
   frames d'affichage par image de la planche. */
void vig_play(u8 slot, u8 mode, u8 speed);

void vig_hide(u8 slot);

/* Recharge frames + palettes des slots actifs — après tout ce qui
   écrase la région OBJ ou la CGRAM OBJ (picture_hide, ouverture d'un
   écran composé, player_init/warp). */
void vig_reload(void);

/* Un pas d'animation + écriture du shadow OAM (boucle principale). */
void vig_update(void);
/* Transferts VRAM/CGRAM des frames marquées sales — VBlank. */
void vig_vblank(void);

#endif /* VIGNETTE_H */
