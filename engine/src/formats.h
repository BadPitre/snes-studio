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

/* Feuille OBJ multi-rangées : la frame 16x16 f occupe les tiles
   {base, base+1, base+16, base+17} avec base = (f/8)*32 + (f%8)*2 */
#define OBJ_FRAME_TILE(f) ((u16)(((f) & 0xF8) << 2) | (u16)(((f) & 7) << 1))

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
