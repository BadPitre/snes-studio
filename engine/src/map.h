/*
 * map.h — fenêtre VRAM + streaming du tilemap BG1.
 *
 * La VRAM ne contient qu'une fenêtre de 32x32 metatiles (= tilemap SC_64x64
 * complet) sur une map qui peut aller jusqu'à 255x255. La fenêtre suit la
 * caméra ; les colonnes/lignes entrantes sont préparées pendant la frame
 * active et transférées par DMA au VBlank.
 *
 * Contrainte v0 : map_w et map_h >= 32 (taille de la fenêtre).
 */
#ifndef MAP_H
#define MAP_H

#include <snes.h>

/* Remplit toute la fenêtre depuis la position caméra courante et la
   transfère (8 Ko). À appeler écran éteint, après camera_update(). */
void map_init(void);

/* Fait suivre la fenêtre à la caméra : prépare en WRAM la colonne et/ou la
   ligne entrante (max 1 de chaque par frame). À appeler pendant la frame
   active, après camera_update(). */
void map_update(void);

/* Transfère les colonnes/lignes en attente. À appeler juste après
   WaitForVBlank(). Budget max : 512 octets par frame. */
void map_vblank(void);

#endif /* MAP_H */
