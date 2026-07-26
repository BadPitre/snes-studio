/*
 * vm.c — VM bytecode v0 (spec §2).
 *
 * Deux catégories d'opcodes : immédiats (exécutés en chaîne dans la frame,
 * budget 32/frame) et bloquants (MSG : rend la main à la boucle principale
 * jusqu'à la fermeture de la textbox). Le décodage lit le bloc scripts de
 * la scène via pointeur far (scene_ctx.scripts).
 */
#include <snes.h>
#include "formats.h"
#include "scene.h"
#include "textbox.h"
#include "vm.h"

#define VM_OPS_PER_FRAME 32

VmState vm;

/* Halt debug : opcode inconnu ou boucle infinie dans un script — bug de
   données, on fige pour le voir immédiatement (kit §5). */
static void vm_halt(void)
{
  while (1)
  {
  }
}

void vm_init(void)
{
  u8 i;

  vm.active = 0;
  vm.wait_mode = VM_WAIT_NONE;
  vm.pc = 0;
  for (i = 0; i < 64; i++)
  {
    vm.vars[i] = 0;
    vm.gvars[i] = 0;
  }
}

void vm_scene_reset(void)
{
  u8 i;

  vm.active = 0;
  vm.wait_mode = VM_WAIT_NONE;
  for (i = 0; i < 64; i++)
    vm.vars[i] = 0;
}

void vm_start(u16 offset)
{
  vm.active = 1;
  vm.wait_mode = VM_WAIT_NONE;
  vm.pc = offset;
}

u8 vm_active(void)
{
  return vm.active;
}

static u8 fetch8(void)
{
  return scene_ctx.scripts[vm.pc++];
}

static u16 fetch16(void)
{
  u16 v = fetch8();

  v |= (u16)fetch8() << 8;
  return v;
}

static void vm_step(void)
{
  u8 budget = VM_OPS_PER_FRAME;
  u8 op, var, val;
  u16 ofs;

  while (vm.active && vm.wait_mode == VM_WAIT_NONE)
  {
    if (budget == 0)
      vm_halt(); /* garde-fou anti boucle infinie */
    budget--;

    op = fetch8();
    switch (op)
    {
    case VM_OP_END:
      vm.active = 0;
      break;

    case VM_OP_MSG: /* bloquant */
      ofs = fetch16();
      textbox_open(ofs);
      vm.wait_mode = VM_WAIT_TEXTBOX;
      break;

    case VM_OP_SETVAR:
      var = fetch8();
      vm.vars[var & 63] = fetch8();
      break;

    case VM_OP_ADDVAR:
      var = fetch8();
      vm.vars[var & 63] += fetch8(); /* wrap 8-bit assumé (spec) */
      break;

    case VM_OP_JMP:
      vm.pc = fetch16();
      break;

    case VM_OP_JEQ:
      var = fetch8();
      val = fetch8();
      ofs = fetch16();
      if (vm.vars[var & 63] == val)
        vm.pc = ofs;
      break;

    case VM_OP_JNE:
      var = fetch8();
      val = fetch8();
      ofs = fetch16();
      if (vm.vars[var & 63] != val)
        vm.pc = ofs;
      break;

    case VM_OP_SETGVAR:
      var = fetch8();
      vm.gvars[var & 63] = fetch8();
      break;

    case VM_OP_JGEQ:
      var = fetch8();
      val = fetch8();
      ofs = fetch16();
      if (vm.vars[var & 63] >= val)
        vm.pc = ofs;
      break;

    default:
      vm_halt(); /* opcode inconnu : données corrompues */
    }
  }
}

void vm_update(void)
{
  if (vm.wait_mode == VM_WAIT_TEXTBOX)
  {
    if (padsDown(0) & KEY_A)
    {
      textbox_close();
      vm.wait_mode = VM_WAIT_NONE;
    }
    return; /* la VM reprend à la frame suivante */
  }
  vm_step();
}
