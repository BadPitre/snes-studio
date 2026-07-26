/*
 * formats.h — représentation C v0 des formats de données.
 * Réf : docs/SPEC_FORMATS.md (§0 pour les écarts POC vs format binaire cible).
 *
 * IMPORTANT : ces structs sont la représentation POC (pointeurs C far 32-bit
 * résolus au link). Le format binaire byte-exact (far 24-bit, Scene Table à
 * adresse fixe) sera émis par les outils Rust en Phase 2.
 */
#ifndef FORMATS_H
#define FORMATS_H

#include <snes.h>

/* scene_type — seule valeur v0, mais le champ existe partout (règle projet) */
#define SCENE_TYPE_TOP_DOWN 0x01

/* actor_type */
#define ACTOR_TYPE_NPC_STATIC 0x01

/* script_offset d'un acteur sans script */
#define SCRIPT_NONE 0xFFFF

/* Directions (acteurs et joueur) */
#define DIR_DOWN  0
#define DIR_UP    1
#define DIR_LEFT  2
#define DIR_RIGHT 3

/* Entrée acteur — spec §1.3 */
typedef struct
{
  u8 actor_type;    /* ACTOR_TYPE_* */
  u8 x;             /* en tiles 16x16 */
  u8 y;
  u8 sprite_id;     /* index dans la table de metasprites */
  u16 script_offset; /* offset dans le bloc scripts, SCRIPT_NONE = aucun */
  u8 direction;     /* DIR_* */
  u8 reserved;
} ActorDef;

/* Scene Header — spec §1.2 (représentation C v0) */
typedef struct
{
  u8 scene_type; /* SCENE_TYPE_* — champ obligatoire dès la v0 */
  u8 flags;      /* réservé (0) */
  u8 map_w;      /* en tiles 16x16 */
  u8 map_h;
  const u8 *tilemap;        /* map_w*map_h indices de tiles (1 u8 par tile) */
  const u8 *collision;      /* map_w*map_h octets : 0=libre, 1=solide */
  const ActorDef *actors;   /* actor_count entrées */
  const u8 *scripts;        /* bloc bytecode VM de la scène */
  u8 actor_count;
  u8 player_start_x; /* en tiles */
  u8 player_start_y;
  u8 reserved;
} SceneDef;

#endif /* FORMATS_H */
