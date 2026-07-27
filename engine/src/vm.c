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
#include "actors.h"
#include "player.h"
#include "camera.h"
#include "timer.h"
#include "vm.h"

#define VM_OPS_PER_FRAME 32

VmState vm;

/* Aléatoire de la VM (VAROP op 6) — xorshift 16-bit, semé explicitement
   (statics tcc) et brassé par la position du héros à chaque vm_start. */
static u16 vm_seed;

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
  u16 i;

  vm_seed = 0xBEEF; /* jamais 0 (xorshift) — init EXPLICITE (tcc) */

  vm.active = 0;
  vm.wait_mode = VM_WAIT_NONE;
  vm.pc = 0;
  vm.wait_timer = 0;
  vm.script_actor = 0xFF;
  for (i = 0; i < 64; i++)
  {
    vm.vars[i] = 0;
    vm.gvars[i] = 0;
    vm.switches[i] = 0;
  }
  for (i = 0; i < VM_VAR16_COUNT; i++)
    vm.vars16[i] = 0;
}

u8 vm_switch_get(u16 idx)
{
  if (idx >= VM_SWITCH_COUNT)
    return 0;
  return (vm.switches[idx >> 3] >> (idx & 7)) & 1;
}

void vm_switch_set(u16 idx, u8 on)
{
  u8 mask;

  if (idx >= VM_SWITCH_COUNT)
    return;
  mask = (u8)(1 << (idx & 7));
  if (on)
    vm.switches[idx >> 3] |= mask;
  else
    vm.switches[idx >> 3] &= (u8)~mask;
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
  vm.script_actor = 0xFF; /* renseigné après coup par l'appelant (v0.12) */
  vm_seed ^= player.x ^ (player.y << 5) ^ 1; /* brasse l'aléatoire */
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

/* Octet variable → slot : bit 7 = variable globale (spec §2 v0.6) */
static u8 var_get(u8 v)
{
  return (v & VM_VAR_GLOBAL) ? vm.gvars[v & 63] : vm.vars[v & 63];
}

static void var_set(u8 v, u8 val)
{
  if (v & VM_VAR_GLOBAL)
    vm.gvars[v & 63] = val;
  else
    vm.vars[v & 63] = val;
}

/* Options du CHOICE en cours (copiées du flux au décodage) */
static u16 choice_ids[4];

static u16 vm_rand(void)
{
  vm_seed ^= vm_seed << 7;
  vm_seed ^= vm_seed >> 9;
  vm_seed ^= vm_seed << 8;
  return vm_seed;
}

/* Valeur source d'un VAROP (spec §2 v0.13) */
static u16 varop_src(u8 src_type, u16 src)
{
  switch (src_type)
  {
  case VARSRC_VAR:
    return vm.vars16[src & 255];
  case VARSRC_HERO_X:
    return (u16)((player.x + 8) >> 4);
  case VARSRC_HERO_Y:
    return (u16)((player.y + 8) >> 4);
  case VARSRC_TIMER:
    return timer_secs();
  default:
    return src;
  }
}

static void vm_step(void)
{
  u8 budget = VM_OPS_PER_FRAME;
  u8 op, var, val;
  u16 ofs, idx16, val16;

  while (vm.active && vm.wait_mode == VM_WAIT_NONE)
  {
    if (budget == 0)
      return; /* budget épuisé : la VM rend la main et reprend à la frame
                 suivante — une boucle LOOP sans commande bloquante est
                 légale (v0.15), elle tourne 32 ops/frame comme RM2003 */
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
      var_set(var, fetch8());
      break;

    case VM_OP_ADDVAR:
      var = fetch8();
      var_set(var, var_get(var) + fetch8()); /* wrap 8-bit assumé (spec) */
      break;

    case VM_OP_JMP:
      vm.pc = fetch16();
      break;

    case VM_OP_JEQ:
      var = fetch8();
      val = fetch8();
      ofs = fetch16();
      if (var_get(var) == val)
        vm.pc = ofs;
      break;

    case VM_OP_JNE:
      var = fetch8();
      val = fetch8();
      ofs = fetch16();
      if (var_get(var) != val)
        vm.pc = ofs;
      break;

    case VM_OP_SETGVAR: /* alias historique de SETVAR g<n> */
      var = fetch8();
      vm.gvars[var & 63] = fetch8();
      break;

    case VM_OP_JGEQ:
      var = fetch8();
      val = fetch8();
      ofs = fetch16();
      if (var_get(var) >= val)
        vm.pc = ofs;
      break;

    case VM_OP_CHOICE: /* bloquant : 2-4 options, index -> variable */
      vm.choice_var = fetch8();
      vm.choice_count = fetch8();
      for (val = 0; val < vm.choice_count; val++)
        choice_ids[val & 3] = fetch16();
      vm.choice_sel = 0;
      textbox_open_choices(choice_ids, vm.choice_count, 0);
      vm.wait_mode = VM_WAIT_CHOICE;
      break;

    case VM_OP_WARP: /* téléport scripté — le bloc scripts change de
                        scène : le script se termine ici */
      var = fetch8(); /* scene */
      val = fetch8(); /* x */
      player_request_warp(var, val, fetch8());
      vm.active = 0;
      break;

    case VM_OP_FACE: /* tourne l'acteur n (invisible si hors scene) */
      var = fetch8();
      actor_face(var, fetch8());
      break;

    case VM_OP_SW: /* switch OFF/ON (v0.9) */
      idx16 = fetch16();
      vm_switch_set(idx16, fetch8());
      break;

    case VM_OP_JSW: /* saute si switch == attendu */
      idx16 = fetch16();
      val = fetch8();
      ofs = fetch16();
      if (vm_switch_get(idx16) == val)
        vm.pc = ofs;
      break;

    case VM_OP_SET16: /* variable 16-bit = val */
      var = fetch8();
      vm.vars16[var] = fetch16();
      break;

    case VM_OP_ADD16: /* variable 16-bit += val (wrap, negatifs en
                         complement a deux) */
      var = fetch8();
      vm.vars16[var] += fetch16();
      break;

    case VM_OP_ROUTE: /* itinéraire (v0.12/v0.13) — NON bloquant : la
                         route part en tâche de fond (cinématiques) */
      var = fetch8(); /* acteur, 0xFF = event du script */
      val = fetch8(); /* flags */
      actors_route_freq(fetch8()); /* fréquence 1-8 */
      idx16 = fetch8(); /* len (octets) */
      if (var == 0xFF)
        var = vm.script_actor;
      actors_route_bind_freq(var);
      actors_set_route(var, vm.pc, val, (u8)idx16);
      vm.pc += idx16; /* les pas sont inline : les sauter */
      break;

    case VM_OP_WAITROUTE: /* bloquant : fin de toutes les routes */
      vm.wait_mode = VM_WAIT_ROUTE;
      break;

    case VM_OP_WAIT: /* bloquant : n frames */
      vm.wait_timer = fetch8();
      vm.wait_mode = VM_WAIT_TIMER;
      break;

    case VM_OP_VAROP: /* opérations avancées (v0.13) */
      var = fetch8();          /* variable destination */
      val = fetch8();          /* opération */
      idx16 = fetch8();        /* type de source */
      val16 = varop_src((u8)idx16, fetch16());
      switch (val)
      {
      case VAROP_SET:
        vm.vars16[var] = val16;
        break;
      case VAROP_ADD:
        vm.vars16[var] += val16;
        break;
      case VAROP_SUB:
        vm.vars16[var] -= val16;
        break;
      case VAROP_MUL:
        vm.vars16[var] *= val16;
        break;
      case VAROP_DIV:
        vm.vars16[var] = val16 ? vm.vars16[var] / val16 : 0;
        break;
      case VAROP_MOD:
        vm.vars16[var] = val16 ? vm.vars16[var] % val16 : 0;
        break;
      default: /* aléatoire 0..val16 inclus */
        vm.vars16[var] = val16 == 0xFFFF ? vm_rand()
                                         : vm_rand() % (val16 + 1);
        break;
      }
      break;

    case VM_OP_TIMER: /* timer de jeu (v0.13) */
      var = fetch8();
      val16 = fetch16();
      if (var == 0)
        timer_set(val16);
      else if (var == 1)
        timer_stop();
      else
        timer_display(var == 2);
      break;

    case VM_OP_CAMPAN: /* pan caméra scripté — NON bloquant */
      var = fetch8();
      val = fetch8();
      camera_pan_to(var, val, fetch8());
      break;

    case VM_OP_CAMRET: /* retour caméra vers le héros */
      camera_return(fetch8());
      break;

    case VM_OP_WAITCAM: /* bloquant : fin du pan */
      vm.wait_mode = VM_WAIT_CAM;
      break;

    case VM_OP_JCMP16: /* saute si la comparaison 16-bit est vraie */
      var = fetch8();
      val = fetch8(); /* 0 ==, 1 !=, 2 >= */
      val16 = fetch16();
      ofs = fetch16();
      idx16 = vm.vars16[var];
      if ((val == 0 && idx16 == val16) || (val == 1 && idx16 != val16) ||
          (val == 2 && idx16 >= val16))
        vm.pc = ofs;
      break;

    default:
      vm_halt(); /* opcode inconnu : données corrompues */
    }
  }
}

void vm_update(void)
{
  u16 down;

  if (vm.wait_mode == VM_WAIT_TEXTBOX)
  {
    if (padsDown(0) & KEY_A)
    {
      textbox_close();
      vm.wait_mode = VM_WAIT_NONE;
    }
    return; /* la VM reprend à la frame suivante */
  }
  if (vm.wait_mode == VM_WAIT_ROUTE)
  {
    if (!actors_routes_busy())
      vm.wait_mode = VM_WAIT_NONE;
    else
      return;
  }
  if (vm.wait_mode == VM_WAIT_CAM)
  {
    if (!camera_busy())
      vm.wait_mode = VM_WAIT_NONE;
    else
      return;
  }
  if (vm.wait_mode == VM_WAIT_TIMER)
  {
    if (vm.wait_timer)
    {
      vm.wait_timer--;
      return;
    }
    vm.wait_mode = VM_WAIT_NONE;
  }
  if (vm.wait_mode == VM_WAIT_CHOICE)
  {
    down = padsDown(0);
    if ((down & KEY_UP) && vm.choice_sel > 0)
    {
      vm.choice_sel--;
      textbox_choice_cursor(vm.choice_sel);
    }
    else if ((down & KEY_DOWN) && (u8)(vm.choice_sel + 1) < vm.choice_count)
    {
      vm.choice_sel++;
      textbox_choice_cursor(vm.choice_sel);
    }
    else if (down & KEY_A)
    {
      var_set(vm.choice_var, vm.choice_sel);
      textbox_close();
      vm.wait_mode = VM_WAIT_NONE;
    }
    return;
  }
  vm_step();
}
