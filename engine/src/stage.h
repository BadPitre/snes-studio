/*
 * stage.h — ÉCRAN COMPOSÉ (B3) : fond plein écran + images posées.
 *
 * Un « écran composé » remplace la vue de la scène par un fond (une
 * picture opaque sur BG2) sur lequel l'auteur POSE jusqu'à 5 images à
 * transparence (pictures) sur BG1, chacune avec SA palette — l'écran
 * de combat façon FF (fond + monstres), mais générique : plateau de
 * jeu, carte du monde, visual novel. Les dialogues, choix et widgets
 * (BG3) continuent de fonctionner par-dessus ; les sprites de la
 * scène (héros, PNJ) sont cachés le temps de l'écran (les vignettes
 * B5 fourniront les sprites libres).
 *
 * Fermer l'écran = WARP INTERNE vers la scène courante (recette
 * do_warp éprouvée) : décor, sprites, palettes, ambiances et musique
 * de la scène reviennent d'un bloc. Les positions des PNJ déplacés
 * reviennent à leurs pages (comme après un warp — documenté).
 */
#ifndef STAGE_H
#define STAGE_H

#include <snes.h>

#define STAGE_SLOTS 5

/* L'écran composé est affiché (les *_draw de la boucle sont gelés). */
u8 stage_active(void);

/* Un transfert de pose/retrait est en cours (la VM attend dessus). */
u8 stage_busy(void);

/* Commandes VM (différées/étalées — jamais de gros DMA hors VBlank).
   trans (S18) : 0 fondu, 1 instantané, 2 mosaïque. */
void stage_request_open(u8 backdrop_pic, u8 fade_dur, u8 trans); /* 0xFF = noir */
void stage_request_close(u8 fade_dur, u8 trans);
/* Transition de la dernière fermeture — pour le warp interne (do_warp) */
u8 stage_close_trans(void);
void stage_pose(u8 slot, u8 pic, u8 tx, u8 ty); /* position en TILES */
void stage_clear(u8 slot);

/* Effet de PALETTE sur une image posée (B4) — NON bloquant :
   fx 0 = restaurer, 1 = flash blanc (dur frames), 2 = fondu vers noir
   (mort, dur frames, demi-teintes), 3 = assombrir d'un cran
   (persistant). Seul CE slot est touché (une palette par slot). */
void stage_slotfx(u8 slot, u8 fx, u8 dur);

/* Ouverture/fermeture depuis la BOUCLE PRINCIPALE (recette picture) */
void stage_apply(void);
/* Fermeture demandée : la boucle exécute le warp interne (do_warp) */
u8 stage_take_close(void);
/* Reset sans restauration (un vrai warp pendant l'écran) — recette
   picture_reset : scene_load recharge tout derrière */
void stage_reset(void);

/* Un pas des transferts étalés (boucle principale) + écritures VBlank */
void stage_update(void);
void stage_vblank(void);

#endif /* STAGE_H */
