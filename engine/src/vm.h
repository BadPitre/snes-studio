/*
 * vm.h — VM bytecode v0 (spec §2) : 8 opcodes, interactions PNJ/dialogue.
 */
#ifndef VM_H
#define VM_H

#include <snes.h>

/* wait_mode — spec §2 */
#define VM_WAIT_NONE 0
#define VM_WAIT_KEY 1     /* réservé (non utilisé v0) */
#define VM_WAIT_TEXTBOX 2 /* attend la fermeture de la textbox (touche A) */

/* État de la VM (WRAM) — spec §2. Représentation C : pas de champ bank,
   le bloc scripts de la scène est déjà un pointeur far (scene_ctx.scripts),
   pc est l'offset dans ce bloc. */
typedef struct
{
  u8 active;    /* 0 = inactive */
  u8 wait_mode; /* VM_WAIT_* */
  u16 pc;       /* offset dans le bloc scripts de la scène */
  u8 vars[64];  /* variables de scène (reset au chargement de scène) */
  u8 gvars[64]; /* variables globales (persistent entre scènes) */
} VmState;

extern VmState vm;

/* Init complète (boot) : vars + gvars à zéro, VM inactive. */
void vm_init(void);

/* Lance un script : pc = offset dans le bloc scripts de la scène courante. */
void vm_start(u16 offset);

/* 1 si un script a le contrôle (le joueur est gelé). */
u8 vm_active(void);

/* À appeler chaque frame quand la VM est active : route les inputs vers la
   textbox si un opcode bloquant attend, sinon exécute les opcodes immédiats
   (garde-fou : max 32 par frame). */
void vm_update(void);

#endif /* VM_H */
