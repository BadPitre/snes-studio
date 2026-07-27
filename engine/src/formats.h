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

/* actor_type — spec §1.3 v0.6 : déclencheurs façon RM2003 */
#define ACTOR_TYPE_NPC_STATIC 0x01 /* PNJ visible, parle avec A */
#define ACTOR_TYPE_TRIGGER 0x02    /* invisible : script au contact (marcher) */
#define ACTOR_TYPE_AUTO 0x03       /* invisible : script au chargement de scène */

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
#define VM_OP_CHOICE  0x09 /* var, count (2-4), count x text_id (u16) —
                              bloquant : curseur haut/bas + A, index -> var */
#define VM_OP_WARP    0x0A /* scene (u8), x (u8), y (u8) — téléporte le
                              héros et TERMINE le script (le bloc scripts
                              change de scène) */
#define VM_OP_FACE    0x0B /* acteur (u8), dir (u8) — tourne l'acteur */

/* v0.9 (A2-P4) : switches + variables 16-bit, façon RM2003 */
#define VM_OP_SW      0x0C /* idx (u16), val (u8 0/1) — switch OFF/ON */
#define VM_OP_JSW     0x0D /* idx (u16), attendu (u8), offset (u16) —
                              saute si switch == attendu */
#define VM_OP_SET16   0x0E /* var (u8), val (u16) — variable 16-bit */
#define VM_OP_ADD16   0x0F /* var (u8), val (u16, addition avec wrap —
                              une valeur negative s'encode en
                              complement a deux) */
#define VM_OP_JCMP16  0x10 /* var (u8), op (u8 : 0 ==, 1 !=, 2 >=),
                              val (u16), offset (u16) */

/* v0.12 (Move Route) : itinéraires de PNJ + attentes bloquantes */
#define VM_OP_ROUTE     0x11 /* acteur (u8, 0xFF = event du script), flags
                                (u8 : bit0 repeat, bit1 skip si bloque),
                                len (u8), puis len PAS INLINE — la route
                                vit dans le bloc scripts, l'acteur pointe
                                dessus. Non bloquant (cinematiques). */
#define VM_OP_WAITROUTE 0x12 /* bloquant : attend la fin de toutes les
                                routes non-repeat */
#define VM_OP_WAIT      0x13 /* frames (u8) — pause bloquante */

/* Pas d'itinéraire (spec §2 v0.13 — dialogue Move Route complet).
   1 octet par pas, sauf 0x50-0x52 qui portent un paramètre. */
#define ROUTE_STEP_MOVE   0x00 /* 0x00-0x03 : marcher down/up/left/right */
#define ROUTE_STEP_MRAND  0x04 /* marcher dans une direction au hasard */
#define ROUTE_STEP_MHERO  0x05 /* marcher vers le heros */
#define ROUTE_STEP_MFLEE  0x06 /* fuir le heros */
#define ROUTE_STEP_FWD    0x07 /* un pas dans la direction courante */
#define ROUTE_STEP_TURN   0x10 /* 0x10-0x13 : se tourner (sans bouger) */
#define ROUTE_STEP_T90R   0x14 /* tourner 90 degres a droite */
#define ROUTE_STEP_T90L   0x15 /* tourner 90 degres a gauche */
#define ROUTE_STEP_T180   0x16 /* demi-tour */
#define ROUTE_STEP_T90X   0x17 /* 90 degres gauche OU droite (hasard) */
#define ROUTE_STEP_TRAND  0x18 /* direction au hasard */
#define ROUTE_STEP_FACEP  0x19 /* se tourner vers le heros */
#define ROUTE_STEP_TFLEE  0x1A /* tourner dos au heros */
#define ROUTE_STEP_SPDUP  0x20 /* vitesse + (1-4) */
#define ROUTE_STEP_SPDDN  0x21 /* vitesse - */
#define ROUTE_STEP_FRQUP  0x22 /* frequence + (1-8) */
#define ROUTE_STEP_FRQDN  0x23 /* frequence - */
#define ROUTE_STEP_FIXON  0x28 /* direction fix ON (fige l'orientation) */
#define ROUTE_STEP_FIXOFF 0x29
#define ROUTE_STEP_THRUON 0x2A /* through ON (traverse tout) */
#define ROUTE_STEP_THRUOFF 0x2B
#define ROUTE_STEP_WAITN  0x40 /* 0x40|n : attendre n*8 frames (n 1-15) */
#define ROUTE_STEP_SWON   0x50 /* + u16 : switch ON */
#define ROUTE_STEP_SWOFF  0x51 /* + u16 : switch OFF */
#define ROUTE_STEP_GFX    0x52 /* + u8 : changer le graphisme (slot local) */
#define ROUTE_FLAG_REPEAT 0x01
#define ROUTE_FLAG_SKIP   0x02

/* v0.13 : opérations avancées, timer, caméra scriptée */
#define VM_OP_VAROP   0x14 /* dst (u8), op (u8), src_type (u8), src (u16) —
                              vars16[dst] = vars16[dst] OP valeur(src).
                              op : 0 =, 1 +, 2 -, 3 *, 4 /, 5 mod,
                              6 aleatoire 0..valeur (inclus).
                              src_type : 0 constante, 1 variable[src],
                              2 X heros (tiles), 3 Y heros (tiles),
                              4 timer (secondes restantes).
                              division/mod par zero -> 0. */
#define VM_OP_TIMER   0x15 /* op (u8) : 0 regler+demarrer (val = secondes),
                              1 stop, 2 afficher, 3 cacher ; val (u16) */
#define VM_OP_CAMPAN  0x16 /* tx (u8), ty (u8), vitesse (u8 px/frame) —
                              pan de la camera vers la tile (centree),
                              NON bloquant */
#define VM_OP_CAMRET  0x17 /* vitesse (u8) — pan de retour vers le heros
                              puis reprise du suivi */
#define VM_OP_WAITCAM 0x18 /* bloquant : attend la fin du pan */

/* v0.15 : positions scriptées (mémoriser/rappeler façon RM2003) */
#define VM_OP_WARPV   0x19 /* vs (u8), vx (u8), vy (u8) — téléporte le
                              héros à la scène vars16[vs], tile
                              (vars16[vx], vars16[vy]) et TERMINE le
                              script (comme WARP). Rappel d'une position
                              mémorisée par VAROP scene/hx/hy. */
#define VM_OP_SETPOS  0x1A /* acteur (u8, 0xFF = event du script),
                              src (u8 : 0 constantes, 1 variables),
                              x (u8), y (u8) — place l'event sur la tile
                              (x,y), ou (vars16[x], vars16[y]) si src=1 */
#define VM_OP_SWAPPOS 0x1B /* a (u8), b (u8, 0xFF = event du script) —
                              échange les positions de deux events */

#define VAROP_SET 0
#define VAROP_ADD 1
#define VAROP_SUB 2
#define VAROP_MUL 3
#define VAROP_DIV 4
#define VAROP_MOD 5
#define VAROP_RAND 6
#define VARSRC_CONST 0
#define VARSRC_VAR 1
#define VARSRC_HERO_X 2
#define VARSRC_HERO_Y 3
#define VARSRC_TIMER 4
#define VARSRC_SCENE 5 /* v0.15 : index de la scène courante */

/* Budgets v0.9 : 512 switches (64 octets de bits), 256 variables 16-bit.
   Persistants entre scènes, sauvegardés en SRAM (spec §4bis v2). */
#define VM_SWITCH_COUNT 512
#define VM_VAR16_COUNT  256

/* Octet variable des opcodes 8-bit : bit 7 = variable GLOBALE (gvar,
   persiste entre les scènes), bits 0-5 = numéro (spec §2 v0.6) */
#define VM_VAR_GLOBAL 0x80

/* Entrée acteur — spec §1.3. Layout C = layout binaire (8 octets, tcc-816
   ne pad pas) : le moteur caste directement le bloc acteurs des données. */
typedef struct
{
  u8 actor_type;    /* ACTOR_TYPE_* */
  u8 x;             /* en tiles 16x16 */
  u8 y;
  u8 sprite_id;     /* slot de bloc de personnage ; 0xFF = invisible */
  u16 script_offset; /* offset dans le bloc scripts, SCRIPT_NONE = aucun */
  u8 direction;     /* DIR_* */
  u8 flags;         /* v0.10 : bit 7 = CONTINUATION (page du même event que
                       l'entrée précédente), bits 0-2 = type de condition,
                       bits 3-5 = type de mouvement (v0.14 : 3 bits) */
  u16 cond_idx;     /* switch (0-511) ou variable 16-bit (0-255) */
  u16 cond_val;     /* valeur comparée (var >= val) */
  u8 prio_speed;    /* v0.14 : bits 0-1 = priorité (0 sous le héros,
                       1 comme le héros, 2 au-dessus), bits 4-7 =
                       vitesse 1-4 (0 = défaut 1) */
  u8 reserved;
  u16 route_ofs;    /* v0.14 : route custom — offset du blob
                       [flags][freq][len][pas...] dans le bloc scripts,
                       0xFFFF = aucune */
} ActorDef;

/* Pages d'events conditionnelles (v0.10, modèle RM2003) : un event =
   entrées acteur consécutives (flag CONTINUATION sur les pages 2+), la
   DERNIÈRE page dont la condition passe est active, les autres inertes. */
#define ACTOR_FLAG_CONT 0x80
#define ACTOR_COND_MASK 0x07
/* v0.11 : bits 3-4 des flags = type de mouvement du PNJ (RM2003) */
#define ACTOR_MOVE_SHIFT 3
#define ACTOR_MOVE_MASK 0x38 /* v0.14 : 3 bits (route custom) */
#define ACTOR_MOVE_STATIC 0
#define ACTOR_MOVE_RANDOM 1
#define ACTOR_MOVE_VERT 2   /* va-et-vient haut-bas */
#define ACTOR_MOVE_HORIZ 3  /* va-et-vient gauche-droite */
#define ACTOR_MOVE_CUSTOM 4 /* route custom (blob route_ofs, v0.14) */

/* Priorité d'un event (v0.14, byte prio_speed bits 0-1) — modèle RM2003 */
#define ACTOR_PRIO_BELOW 0 /* sous le héros : traversable, interaction en
                              se tenant dessus (coffre au sol) */
#define ACTOR_PRIO_SAME 1  /* comme le héros : bloque et parle de face */
#define ACTOR_PRIO_ABOVE 2 /* au-dessus : traversable, dessiné par-dessus */
#define ACTOR_COND_NONE 0x00
#define ACTOR_COND_SW_ON 0x01  /* switch cond_idx == ON */
#define ACTOR_COND_SW_OFF 0x02 /* switch cond_idx == OFF */
#define ACTOR_COND_VAR_GEQ 0x03 /* vars16[cond_idx] >= cond_val */

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
