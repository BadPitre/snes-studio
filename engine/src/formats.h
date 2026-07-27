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

/* Feuille OBJ 16x24 (Phase 6, modèle charset RM2003) : une frame = 2 OBJs
   16x16 empilés, un groupe de 8 frames = 4 rangées de 16 chars (rangées
   0-1 : moitiés hautes, 2-3 : moitiés basses — les 8 dernières lignes
   restent vides). Tile de l'OBJ haut de la frame f, puis OBJ bas = +32. */
#define OBJ_TOP_TILE(f) ((u16)(((f) & 0xF8) << 3) | (u16)(((f) & 7) << 1))
#define OBJ_BOTTOM_TILE(f) (OBJ_TOP_TILE(f) + 32)

/* Bloc de personnage RM2003 : 12 frames = 4 directions x 3 pas (repos,
   pas A, pas B). sprite_id d'un acteur = SLOT de bloc dans le sprite set
   de la scène (v0.5, remappé par datagen) ; le slot s utilise la palette
   OBJ s, le joueur est toujours le slot 0. Frame de repos : slot*12 +
   dir*3. */
#define CHAR_BLOCK_FRAMES 12

/* Le metasprite 16x24 est ancré sur sa tile : l'OBJ haut dépasse de 8 px
   au-dessus (la tête chevauche la tile du dessus, façon RM2003). */
#define SPRITE_Y_OVERLAP 8

/* Couche collision — spec §1.4 v0.2 */
#define COL_FREE 0x00
#define COL_SOLID 0x01
#define COL_WARP 0x02

/* Directions (acteurs et joueur) */
#define DIR_DOWN  0
#define DIR_UP    1
#define DIR_LEFT  2
#define DIR_RIGHT 3

/* Opcodes VM v0 — spec §2, table contractuelle : ne rien ajouter sans
   demande explicite */
#define VM_OP_END     0x00
#define VM_OP_MSG     0x01 /* text_id (u16) — bloquant */
#define VM_OP_SETVAR  0x02 /* var (u8), val (u8) */
#define VM_OP_ADDVAR  0x03 /* var (u8), val (u8) */
#define VM_OP_JMP     0x04 /* offset (u16) */
#define VM_OP_JEQ     0x05 /* var, val, offset */
#define VM_OP_JNE     0x06 /* var, val, offset */
#define VM_OP_SETGVAR 0x07 /* var (u8), val (u8) */
#define VM_OP_JGEQ    0x08 /* var, val, offset */

/* Entrée acteur — spec §1.3. Layout C = layout binaire (8 octets, tcc-816
   ne pad pas) : le moteur caste directement le bloc acteurs des données. */
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

/* Entrée warp — spec §1.5. Layout C = layout binaire (8 octets). */
typedef struct
{
  u8 x; /* tile déclencheuse */
  u8 y;
  u8 dest_scene; /* index dans la Scene Table */
  u8 dest_x;     /* arrivée du joueur, en tiles */
  u8 dest_y;
  u8 flags;
  u8 reserved0;
  u8 reserved1;
} WarpDef;

/* Le Scene Header (spec §1.2) est lu champ par champ depuis le binaire
   (pointeurs far 24-bit sans équivalent C) — voir scene.c. */

#endif /* FORMATS_H */
