/*
 * map.h — fenêtre VRAM + streaming des tilemaps des deux couches.
 *
 * Depuis la Phase 5c le décor a deux couches (modèle RPG Maker 2003) :
 * BG2 = couche inférieure (sol), BG1 = couche supérieure (objets). En
 * mode 1, BG1 prio 0 passe devant BG2 mais derrière les sprites prio 2 ;
 * une tile ☆ (table de priorités du tileset) reçoit le bit de priorité
 * BG et passe DEVANT le héros.
 *
 * La VRAM ne contient qu'une fenêtre de 32x32 metatiles (= tilemap SC_64x64
 * complet) par couche, sur une map qui peut aller jusqu'à 255x255. La
 * fenêtre suit la caméra ; les colonnes/lignes entrantes sont préparées
 * pendant la frame active et transférées par DMA au VBlank.
 *
 * Contrainte : map_w et map_h >= 20x15 (un écran). Une map plus petite
 * que la fenêtre 32x32 y tient entièrement (pas de streaming sur cet axe).
 */
#ifndef MAP_H
#define MAP_H

#include <snes.h>

/* Table de metatiles courante (4 entrées BG u16 par tile 16x16) et table
   de priorités (1 octet par metatile, 1 = ☆ — couche sup uniquement).
   Passées par appel de fonction : l'accès indexé direct à un symbole de
   tableau far est miscompilé par tcc-816 (« FISHY length <> PTR_SIZE »),
   l'indexation d'un pointeur reçu en argument est fiable. */
void map_set_metatiles(const u16 *table, const u8 *prio);

/* Remplit toute la fenêtre des deux couches depuis la position caméra
   courante et la transfère (2 x 8 Ko). À appeler écran éteint, après
   camera_update(). */
void map_init(void);

/* Fait suivre la fenêtre à la caméra : prépare en WRAM la colonne et/ou la
   ligne entrante des deux couches (max 1 de chaque par frame). À appeler
   pendant la frame active, après camera_update(). */
void map_update(void);

/* Transfère les colonnes/lignes en attente. À appeler juste après
   WaitForVBlank(). Budget max : 1 Ko par frame (2 couches). */
void map_vblank(void);

#endif /* MAP_H */
