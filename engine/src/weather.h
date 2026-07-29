/*
 * weather.h — météo en particules (S13) : pluie / neige en sprites,
 * commande d'event WEATHER. Persiste entre les scènes (modèle RM2003).
 */
#ifndef WEATHER_H
#define WEATHER_H

#include <snes.h>

/* Charge les chars des particules (fin de la région OBJ) + la palette
   OBJ 7 — appelé par scene_load ÉCRAN ÉTEINT, et par picture_hide
   (la picture emprunte la région OBJ). */
void weather_load(void);

/* Commande WEATHER : type 0 = aucune, 1 = pluie, 2 = neige ;
   pow 1-3 = intensité (8/16/24 particules). État global persistant. */
void weather_set(u8 type, u8 pow);

/* Un pas de simulation par frame (boucle principale, toujours). */
void weather_update(void);

/* Écrit les sprites des particules dans l'OAM shadow (après
   actors_draw) — entrées hautes réservées, jamais utilisées ailleurs. */
void weather_draw(void);

#endif /* WEATHER_H */
