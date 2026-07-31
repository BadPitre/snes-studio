/*
 * anim.h — animations image par image (A1), façon « Battle Animation »
 * de RPG Maker 2003 : une suite de frames où l'auteur choisit à chaque
 * frame la CELLULE affichée, sa POSITION et le SON joué.
 *
 * La planche de cellules est une VIGNETTE du projet (B5) : chars OBJ
 * 32x32, palette OBJ dédiée, transfert au VBlank. Zéro nouveau chemin
 * graphique — le lecteur n'ajoute que la piste de frames, et emprunte
 * un slot de vignette (2 aujourd'hui, cf. VIG_SLOTS).
 *
 * Ancrage (comme RM2003) : écran, héros, ou event de la scène. Le
 * décalage de la frame s'ajoute à la position de la cible RECALCULÉE
 * chaque frame — une animation posée sur un PNJ le suit s'il marche.
 */
#ifndef ANIM_H
#define ANIM_H

#include <snes.h>
#include "vignette.h" /* la planche EST une vignette : un slot chacun */

#define ANIM_SLOTS VIG_SLOTS

#define ANIM_ANC_SCREEN 0
#define ANIM_ANC_HERO 1
#define ANIM_ANC_ACTOR 2

/* Lance l'animation anim_id sur un slot libre. anchor = ANIM_ANC_*,
   target = index de l'acteur pour ANIM_ANC_ACTOR (ignoré sinon).
   Aucun slot libre : la plus ancienne animation cède sa place — une
   animation ratée est pire qu'une animation écourtée. */
void anim_play(u8 anim_id, u8 anchor, u8 target);

/* Arrête toutes les animations en cours et range leurs sprites. */
void anim_stop(void);

/* 1 tant qu'au moins une animation NON bouclée tourne (VM_WAIT_ANIM).
   Les animations en boucle ne bloquent jamais un script : sinon
   « attendre la fin » ne se terminerait pas. */
u8 anim_busy(void);

/* Un pas de lecture — boucle principale, AVANT vig_update() (qui écrit
   le shadow OAM à partir de l'état que le lecteur vient de poser). */
void anim_update(void);

#endif /* ANIM_H */
