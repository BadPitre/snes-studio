/*
 * tileanim.h — tiles de décor ANIMÉES (T1, modèle eau RM2003).
 * Séquences par tileset (sidecar assets/<stem>.json, « anims »),
 * résolues par datagen en chars du gfx set de chaque scène
 * (data_tileanim.c) : à chaque pas, les 4 chars 8x8 de la tile de
 * base reçoivent les pixels de la frame courante (4 DMA de 32 octets,
 * une séquence par VBlank).
 */
#ifndef TILEANIM_H
#define TILEANIM_H

#include <snes.h>

/* Charge les séquences de la scène (à la fin de scene_load). */
void tileanim_init(u8 scene_id);

/* Compteurs + choix de la frame (boucle principale, hors stage/picture). */
void tileanim_update(void);

/* Pousse le pas en attente (VBlank, chemin normal uniquement — l'écran
   composé réutilise la région de chars du tileset). */
void tileanim_vblank(void);

#endif /* TILEANIM_H */
