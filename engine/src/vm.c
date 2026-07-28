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
#include "screenfx.h"
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
  vm.call_sp = 0;
  for (i = 0; i < VM_CALL_DEPTH; i++)
    vm.call_stack[i] = 0;
  for (i = 0; i < 64; i++)
  {
    vm.vars[i] = 0;
    vm.gvars[i] = 0;
    vm.switches[i] = 0;
  }
  for (i = 0; i < VM_VAR16_COUNT; i++)
    vm.vars16[i] = 0;
  vm_parallel_reset();
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
  vm_parallel_reset(); /* le contexte parallèle pointait l'ancien bloc */
}

void vm_start(u16 offset)
{
  vm.active = 1;
  vm.wait_mode = VM_WAIT_NONE;
  vm.pc = offset;
  vm.script_actor = 0xFF; /* renseigné après coup par l'appelant (v0.12) */
  vm.call_sp = 0;         /* pile d'appels vide (v0.16) */
  vm_seed ^= player.x ^ (player.y << 5) ^ 1; /* brasse l'aléatoire */
}

/* Table des common events AUTO/PARALLEL en tête du bloc scripts (spec §2
   v0.16) : [n] puis n x [type u8 : 0 autorun, 1 parallel][switch u16]
   [offset u16] à l'offset 0. Renvoie l'offset du premier common event du
   type demandé dont le switch est ON, ou SCRIPT_NONE. */
static u16 common_lookup(u8 kind)
{
  u8 n, i;
  u16 p, sw, ofs;

  n = scene_ctx.scripts[0];
  p = 1;
  for (i = 0; i < n; i++)
  {
    sw = scene_ctx.scripts[p + 1] | ((u16)scene_ctx.scripts[p + 2] << 8);
    ofs = (u16)scene_ctx.scripts[p + 3] |
          ((u16)scene_ctx.scripts[p + 4] << 8);
    if (scene_ctx.scripts[p] == kind && vm_switch_get(sw))
      return ofs;
    p += 5;
  }
  return SCRIPT_NONE;
}

u16 vm_common_auto(void)
{
  return common_lookup(0);
}

/* --- Contexte PARALLÈLE (v0.16) — un common event « Parallel process »
   tourne en tâche de fond sans geler le joueur, relancé tant que son
   switch est ON. Les variables/switches sont PARTAGÉS avec le script
   principal ; seuls les champs d'exécution (pc, attentes, pile) sont
   échangés (swap-in/swap-out) autour de vm_step. MSG/CHOICE y sont
   interdits (datagen les refuse : pas d'UI depuis le fond). */
static u8 p_active;
static u16 p_pc;
static u8 p_wait_mode;
static u8 p_wait_timer;
static u8 p_script_actor;
static u8 p_call_sp;
static u16 p_call_stack[VM_CALL_DEPTH];

static void pvm_swap(void)
{
  u8 i, t8;
  u16 t16;

  t8 = vm.active;      vm.active = p_active;         p_active = t8;
  t16 = vm.pc;         vm.pc = p_pc;                 p_pc = t16;
  t8 = vm.wait_mode;   vm.wait_mode = p_wait_mode;   p_wait_mode = t8;
  t8 = vm.wait_timer;  vm.wait_timer = p_wait_timer; p_wait_timer = t8;
  t8 = vm.script_actor; vm.script_actor = p_script_actor; p_script_actor = t8;
  t8 = vm.call_sp;     vm.call_sp = p_call_sp;       p_call_sp = t8;
  for (i = 0; i < VM_CALL_DEPTH; i++)
  {
    t16 = vm.call_stack[i];
    vm.call_stack[i] = p_call_stack[i];
    p_call_stack[i] = t16;
  }
}

void vm_parallel_reset(void)
{
  u8 i;

  p_active = 0;
  p_pc = 0;
  p_wait_mode = VM_WAIT_NONE;
  p_wait_timer = 0;
  p_script_actor = 0xFF;
  p_call_sp = 0;
  for (i = 0; i < VM_CALL_DEPTH; i++)
    p_call_stack[i] = 0;
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
  case VARSRC_SCENE:
    return scene_ctx.scene_id;
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

    case VM_OP_WARPV: /* téléport aux coordonnées de variables (v0.15) —
                         rappel d'une position mémorisée : le script se
                         termine ici, comme WARP */
      var = fetch8();   /* variable scène */
      val = fetch8();   /* variable x */
      idx16 = fetch8(); /* variable y */
      player_request_warp((u8)vm.vars16[var], (u8)vm.vars16[val],
                          (u8)vm.vars16[idx16 & 255]);
      vm.active = 0;
      break;

    case VM_OP_SETPOS: /* place un event sur une tile (v0.15) */
      var = fetch8();   /* acteur, 0xFF = event du script */
      val = fetch8();   /* source : 0 constantes, 1 variables */
      idx16 = fetch8(); /* x (ou n° de variable) */
      ofs = fetch8();   /* y (ou n° de variable) */
      if (var == 0xFF)
        var = vm.script_actor;
      if (val)
      {
        idx16 = vm.vars16[idx16 & 255];
        ofs = vm.vars16[ofs & 255];
      }
      actors_set_pos(var, (u8)idx16, (u8)ofs);
      break;

    case VM_OP_SWAPPOS: /* échange les positions de deux events (v0.15) */
      var = fetch8();
      val = fetch8();
      if (var == 0xFF)
        var = vm.script_actor;
      if (val == 0xFF)
        val = vm.script_actor;
      actors_swap_pos(var, val);
      break;

    case VM_OP_SCRHIDE: /* fondu vers le noir — bloquant (v0.15) */
      screenfx_hide(fetch8());
      vm.wait_mode = VM_WAIT_SCREEN;
      break;

    case VM_OP_SCRSHOW: /* fondu entrant — bloquant */
      screenfx_show(fetch8());
      vm.wait_mode = VM_WAIT_SCREEN;
      break;

    case VM_OP_TINT: /* teinte du décor (v0.15) — rgb PUIS mode (piège
                        tcc des paramètres multiples : 3 u8 max) */
      var = fetch8();   /* mode */
      val = fetch8();   /* r */
      idx16 = fetch8(); /* g */
      screenfx_tint_rgb(val, (u8)idx16, fetch8());
      screenfx_tint(var);
      break;

    case VM_OP_FLASH: /* flash additif décroissant — NON bloquant */
      val = fetch8();
      idx16 = fetch8();
      ofs = fetch8();
      screenfx_flash(val, (u8)idx16, (u8)ofs);
      screenfx_flash_start(fetch8());
      break;

    case VM_OP_SHAKE: /* secousse horizontale — NON bloquant */
      var = fetch8();
      val = fetch8();
      screenfx_shake(var, val, fetch8());
      break;

    case VM_OP_CALL: /* appel d'un corps de common event (v0.16) */
      ofs = fetch16();
      if (vm.call_sp >= VM_CALL_DEPTH)
        vm_halt(); /* récursion trop profonde : bug de données */
      vm.call_stack[vm.call_sp++] = vm.pc;
      vm.pc = ofs;
      break;

    case VM_OP_RET: /* retour de CALL — pile vide : fin de script */
      if (vm.call_sp)
        vm.pc = vm.call_stack[--vm.call_sp];
      else
        vm.active = 0;
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
  if (vm.wait_mode == VM_WAIT_SCREEN)
  {
    if (!screenfx_busy())
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

/* Un pas du contexte PARALLÈLE (v0.16) — à appeler chaque frame hors
   menu Système, que le script principal soit actif ou non. Lance le
   premier common event « parallel » dont le switch est ON, gère ses
   attentes non-UI, puis exécute ses opcodes par swap-in/swap-out. À la
   fin du script (END), il repart du début tant que le switch reste ON. */
void vm_parallel_update(void)
{
  u16 ofs;

  if (!p_active)
  {
    ofs = common_lookup(1);
    if (ofs == SCRIPT_NONE)
      return;
    p_active = 1;
    p_pc = ofs;
    p_wait_mode = VM_WAIT_NONE;
    p_wait_timer = 0;
    p_script_actor = 0xFF;
    p_call_sp = 0;
  }
  if (p_wait_mode == VM_WAIT_ROUTE)
  {
    if (actors_routes_busy())
      return;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_CAM)
  {
    if (camera_busy())
      return;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_SCREEN)
  {
    if (screenfx_busy())
      return;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_TIMER)
  {
    if (p_wait_timer)
    {
      p_wait_timer--;
      return;
    }
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode != VM_WAIT_NONE)
    return; /* TEXTBOX/CHOICE : impossibles ici (datagen les refuse) */
  pvm_swap();
  vm_step();
  pvm_swap();
}
