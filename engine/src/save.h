/*
 * save.h — sauvegardes SRAM (spec §4 v0.7) : 4 slots de 128 octets,
 * magie + version + checksum. Une sauvegarde = l'état du jeu : scène
 * courante, position/direction du héros, variables globales.
 */
#ifndef SAVE_H
#define SAVE_H

#include <snes.h>

#define SAVE_SLOTS 4

/* 1 si le slot contient une sauvegarde valide (magie, version, checksum). */
u8 save_exists(u8 slot);

/* Écrit l'état courant du jeu dans le slot. */
void save_write(u8 slot);

/* Résultat du dernier save_read (pas de paramètres pointeurs multiples :
   tcc-816 est fragile sur ce pattern — struct globale à la place). */
typedef struct
{
  u8 scene, x, y, dir;
} SaveInfo;

extern SaveInfo save_info;

/* Lit le slot : applique les gvars et remplit save_info.
   Renvoie 0 (rien modifié) si le slot est invalide. */
u8 save_read(u8 slot);

#endif /* SAVE_H */
