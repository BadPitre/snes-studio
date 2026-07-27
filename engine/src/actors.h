/*
 * actors.h — acteurs de scène (PNJ statiques v0) : affichage + interaction.
 */
#ifndef ACTORS_H
#define ACTORS_H

#include <snes.h>

#define ACTOR_NONE 0xFF

/* Init de l'état du module + attributs OAM des acteurs. À appeler après
   player_init() (la feuille de sprites doit être chargée). Ne jamais
   compter sur une mise à zéro implicite des statiques avec cette toolchain. */
void actors_init(void);

/* Recalcule la page active de chaque event (v0.10) — à appeler quand les
   switches/variables ont pu changer (fin de script, chargement de partie). */
void actors_resolve_pages(void);

/* PNJ mobiles (v0.11) : un tick de mouvement — à appeler chaque frame
   hors script/menu (les events gèlent le monde, comme RM2003). */
void actors_update(void);

/* Itinéraires (v0.12, opcode ROUTE) : lance/écrase la route du slot —
   ofs = offset des PAS dans le bloc scripts. */
void actors_set_route(u8 index, u16 ofs, u8 flags, u8 len);

/* Fréquence 1-8 de la prochaine route (opcode ROUTE) : à poser via
   actors_route_freq PUIS lier avec actors_route_bind_freq(index) —
   deux appels à un argument (piège tcc des paramètres multiples). */
void actors_route_freq(u8 freq);
void actors_route_bind_freq(u8 index);

/* 1 si une route non-repeat court encore (opcode WAITROUTE). */
u8 actors_routes_busy(void);

/* Écrit les metasprites des acteurs dans le shadow OAM (chaque frame).
   Les acteurs hors écran sont cachés. */
void actors_draw(void);

/* Index du PNJ (type npc, bloquant) occupant la tile (tx,ty), ou
   ACTOR_NONE. Les déclencheurs (contact/auto) sont invisibles et
   traversables : ils ne comptent pas ici. */
u8 actor_at_tile(u8 tx, u8 ty);

/* Index du déclencheur de CONTACT (type 0x02, avec script) sur la tile,
   ou ACTOR_NONE — le script part quand le héros marche dessus. */
u8 actor_trigger_at(u8 tx, u8 ty);

/* Event « sous le héros » sur cette tile (priorité below, v0.14) —
   interaction en se tenant dessus. */
u8 actor_standing_at(u8 tx, u8 ty);

/* Offset du script du déclencheur AUTO de la scène (type 0x03), ou
   SCRIPT_NONE — lancé une fois au chargement de la scène. */
u16 actors_autorun(void);

/* Interaction (bouton A face à l'acteur) : tourne le PNJ vers le héros
   (réflexe RM2003) et lance son script sur la VM, s'il en a un. */
void actor_interact(u8 index);

/* Direction courante d'un acteur (WRAM — FACE et face-au-héros) */
void actor_face(u8 index, u8 dir);

#endif /* ACTORS_H */
