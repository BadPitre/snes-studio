/*
 * anim.h — animations image par image (A1), façon « Battle Animation »
 * de RPG Maker 2003 : une suite de frames où l'auteur choisit à chaque
 * frame les CELLULES affichées, leur POSITION et le SON joué.
 *
 * La planche de cellules est une VIGNETTE du projet (B5) : chars OBJ
 * 32x32, palette OBJ dédiée, transfert au VBlank. Zéro nouveau chemin
 * graphique — le lecteur n'ajoute que la piste de frames, et emprunte
 * des slots de vignette (4 au total, cf. VIG_SLOTS).
 *
 * CALQUES (A1-e) : une animation en déclare 1 à 4 et affiche donc
 * jusqu'à 4 cellules EN MÊME TEMPS. Un calque coûte un slot de
 * vignette, mais AUCUNE palette de plus : toutes les cellules d'une
 * animation viennent de sa planche, donc de la même palette OBJ — la
 * ressource la plus rare du SNES ici (il n'en reste que deux).
 * Une cellule d'index 0xFF = ce calque n'affiche rien cette frame,
 * ce qui donne la souplesse de pistes indépendantes avec une seule
 * timeline dans l'éditeur.
 *
 * Ancrage (comme RM2003) : écran, héros, ou event de la scène. Le
 * décalage de la frame s'ajoute à la position de la cible RECALCULÉE
 * chaque frame — une animation posée sur un PNJ le suit s'il marche.
 */
#ifndef ANIM_H
#define ANIM_H

#include <snes.h>
#include "vignette.h" /* la planche EST une vignette : un slot par calque */

#define ANIM_SLOTS VIG_SLOTS   /* animations simultanées (toutes à 1 calque) */
#define ANIM_LAYERS_MAX 4      /* calques par animation — borne VRAM/OAM */
#define ANIM_CELL_NONE 0xFF    /* calque vide sur cette frame */

#define ANIM_ANC_SCREEN 0
#define ANIM_ANC_HERO 1
#define ANIM_ANC_ACTOR 2

/* Lance l'animation anim_id. anchor = ANIM_ANC_*, target = index de
   l'acteur pour ANIM_ANC_ACTOR (ignoré sinon). Sans assez de slots
   libres, la plus AVANCÉE des animations en cours cède sa place — une
   animation écourtée se voit moins qu'une animation qui ne part pas.
   Sans palette disponible (2 planches distinctes déjà à l'écran), rien
   n'est joué plutôt que joué aux mauvaises couleurs. */
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
