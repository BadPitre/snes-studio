/*
 * sysmenu.h — menu Système (touche START) : sauvegarder / charger, façon
 * RM2003. Réutilise la textbox (choix avec curseur).
 */
#ifndef SYSMENU_H
#define SYSMENU_H

#include <snes.h>

/* Init explicite (au boot) — ne jamais compter sur une mise à zéro
   implicite des statiques avec cette toolchain. */
void sysmenu_init(void);

/* 1 si le menu est ouvert (le joueur est gelé). */
u8 sysmenu_active(void);

/* Ouvre le menu principal (Sauvegarder / Charger / Fermer). */
void sysmenu_open(void);

/* À appeler chaque frame quand le menu est actif : navigation + actions. */
void sysmenu_update(void);

/* Un chargement a été validé ? Renvoie 1 (une seule fois) — la destination
   est dans save_info (save.h), les gvars sont déjà appliquées ; la boucle
   principale fait le warp puis pose la direction. Pas de paramètres
   pointeurs : tcc-816 est fragile sur ce pattern. */
u8 sysmenu_take_load(void);

#endif /* SYSMENU_H */
