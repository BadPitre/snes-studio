/*
 * effectlayer.h — couche d'effet par scène (S9) : motif dérivant
 * (nuages, brume…) porté par BG1 à la place de la couche sup, avec
 * mélange color math optionnel. Données : data_effects.c (datagen).
 */
#ifndef EFFECTLAYER_H
#define EFFECTLAYER_H

#include <snes.h>

/* Charge (ou coupe) la couche d'effet de la scène — appelé par
   scene_load, ÉCRAN ÉTEINT (DMA chars/carte/palette + registres). */
void effect_load(u8 scene_id);

/* 1 si la scène courante a une couche d'effet : map.c ne streame plus
   BG1, la boucle principale route le scroll BG1 vers effect_vblank. */
u8 effect_active(void);

/* Re-pose registres BG1 + color math + palette 7 après une picture
   (picture_hide) — les données VRAM du motif n'ont pas bougé. */
void effect_restore(void);

/* Un pas de dérive par frame (boucle principale, toujours). */
void effect_update(void);

/* Scroll BG1 = dérive du motif — VBlank uniquement. */
void effect_vblank(void);

/* Scroll X courant du motif (dérive + suivi caméra) — base de
   l'ondulation HDMA (S14) quand une couche d'effet est active. */
u16 effect_hofs(void);

#endif /* EFFECTLAYER_H */
