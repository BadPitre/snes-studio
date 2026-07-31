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
#include "ui_overlay.h" /* SHOWUI : visibilité des widgets (Ph. 12) */
#include "picture.h" /* SHOWPIC/HIDEPIC : pictures plein écran (S3) */
#include "weather.h" /* WEATHER : météo en particules (S13) */
#include "hdmafx.h"  /* WAVE : ondulation de l'écran (S14) */
#include "audio.h"   /* PLAYSFX / PLAYBGM : sons et musique (B1) */
#include "stage.h"   /* écran composé (B3) */
#include "vignette.h" /* vignettes animées (B5) */
#include "anim.h"     /* ANIMPLAY : animations image par image (A1) */
#include "data/db_tables.h" /* registre de la Database (DBREAD, v0.17) */
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
  vm.keyin_mask = 0;
  vm.keyin_dst = 0;
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
    /* type d'abord : sw/ofs ne sont lus que pour les entrées du bon
       kind — ce scan tourne chaque frame (parallel process) et chaque
       lecture du bloc scripts passe par un pointeur far */
    if (scene_ctx.scripts[p] == kind)
    {
      sw = scene_ctx.scripts[p + 1] | ((u16)scene_ctx.scripts[p + 2] << 8);
      /* switch 0xFFFF = pas de condition (case décochée) : toujours
         actif */
      if (sw == 0xFFFF || vm_switch_get(sw))
      {
        ofs = (u16)scene_ctx.scripts[p + 3] |
              ((u16)scene_ctx.scripts[p + 4] << 8);
        return ofs;
      }
    }
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

/* KEYIN (Ph. 12) : code de la première touche du masque présente dans
   « pressed » — codes RM2003 étendus SNES (formats.h).
   PERF (P2) : un KEYIN non bloquant dans un common event « parallel »
   s'exécute à CHAQUE frame. La version en boucle (12 tours, un appel de
   fonction par tour pour convertir le code en bit SNES) coûtait à elle
   seule ~15 lignes d'écran. Ici, chaîne de tests sur CONSTANTES : le
   compilateur n'a plus ni boucle, ni appel, ni décalage variable, et le
   cas « rien d'enfoncé » sort au premier test. L'ordre des codes est
   celui de la spec — le premier code du masque effectivement enfoncé
   gagne, comme avant. */
static u8 keyin_scan(u16 mask, u16 pressed)
{
  if (!pressed)
    return 0;
  if ((mask & 0x0002) && (pressed & KEY_DOWN))
    return 1;
  if ((mask & 0x0004) && (pressed & KEY_LEFT))
    return 2;
  if ((mask & 0x0008) && (pressed & KEY_RIGHT))
    return 3;
  if ((mask & 0x0010) && (pressed & KEY_UP))
    return 4;
  if ((mask & 0x0020) && (pressed & KEY_A))
    return 5;
  if ((mask & 0x0040) && (pressed & KEY_B))
    return 6;
  if ((mask & 0x0080) && (pressed & KEY_Y))
    return 7;
  if ((mask & 0x0100) && (pressed & KEY_X))
    return 8;
  if ((mask & 0x0200) && (pressed & KEY_L))
    return 9;
  if ((mask & 0x0400) && (pressed & KEY_R))
    return 10;
  if ((mask & 0x0800) && (pressed & KEY_SELECT))
    return 11;
  if ((mask & 0x1000) && (pressed & KEY_START))
    return 12;
  return 0;
}

/* contexte parallèle : masque/destination du KEYIN en cours */
static u16 p_keyin_mask;
static u8 p_keyin_dst;

static void pvm_swap(void)
{
  u8 i, n, t8;
  u16 t16;

  t8 = vm.active;      vm.active = p_active;         p_active = t8;
  t16 = vm.pc;         vm.pc = p_pc;                 p_pc = t16;
  t8 = vm.wait_mode;   vm.wait_mode = p_wait_mode;   p_wait_mode = t8;
  t8 = vm.wait_timer;  vm.wait_timer = p_wait_timer; p_wait_timer = t8;
  t8 = vm.script_actor; vm.script_actor = p_script_actor; p_script_actor = t8;
  t8 = vm.call_sp;     vm.call_sp = p_call_sp;       p_call_sp = t8;
  t16 = vm.keyin_mask; vm.keyin_mask = p_keyin_mask;  p_keyin_mask = t16;
  t8 = vm.keyin_dst;   vm.keyin_dst = p_keyin_dst;    p_keyin_dst = t8;
  /* seules les entrées < sp sont vivantes (CALL écrit avant que RET ne
     lise) : n'échanger que celles-là — le cas courant, deux piles
     vides, ne copie rien (deux swaps par frame quand un parallel
     process tourne, ce budget compte) */
  n = vm.call_sp;
  if (p_call_sp > n)
    n = p_call_sp;
  for (i = 0; i < n; i++)
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
  p_keyin_mask = 0;
  p_keyin_dst = 0;
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
      var = fetch8();   /* scene */
      val = fetch8();   /* x */
      idx16 = fetch8(); /* y */
      player_request_warp(var, val, (u8)idx16, fetch8());
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
                          (u8)vm.vars16[idx16 & 255], fetch8());
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
      var = fetch8(); /* vitesse */
      screenfx_hide(var, fetch8());
      vm.wait_mode = VM_WAIT_SCREEN;
      break;

    case VM_OP_SCRSHOW: /* fondu entrant — bloquant */
      var = fetch8(); /* vitesse */
      screenfx_show(var, fetch8());
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

    case VM_OP_WAVE: /* ondulation de l'écran (S14) — NON bloquant */
      var = fetch8();
      hdmafx_wave(var, fetch8());
      break;

    case VM_OP_SKYGRAD: /* dégradé de ciel (S15) — couleurs PUIS mode
                           (parade tcc : 3 u8 max par appel) */
      var = fetch8();   /* mode */
      val = fetch8();   /* r haut */
      idx16 = fetch8(); /* g haut */
      hdmafx_grad_top(val, (u8)idx16, fetch8());
      val = fetch8();   /* r bas */
      idx16 = fetch8(); /* g bas */
      hdmafx_grad_bottom(val, (u8)idx16, fetch8());
      hdmafx_grad(var);
      break;

    case VM_OP_SPOTLIGHT: /* cercle de lumière (S16) — NON bloquant */
      var = fetch8();
      hdmafx_spot(var, fetch8());
      break;

    case VM_OP_STAGEOPEN: /* écran composé (B3) — différé à la boucle,
                             1 frame de pause (recette SHOWPIC) */
      var = fetch8();
      val = fetch8(); /* dur */
      stage_request_open(var, val, fetch8());
      vm.wait_mode = VM_WAIT_TIMER;
      vm.wait_timer = 1;
      break;

    case VM_OP_STAGEPOSE: /* pose une image — BLOQUANT (transfert étalé) */
      var = fetch8();   /* slot */
      val = fetch8();   /* pic */
      idx16 = fetch8(); /* tx */
      stage_pose(var, val, (u8)idx16, fetch8());
      vm.wait_mode = VM_WAIT_STAGE;
      break;

    case VM_OP_STAGECLEAR: /* retire l'image du slot — BLOQUANT (court) */
      stage_clear(fetch8());
      vm.wait_mode = VM_WAIT_STAGE;
      break;

    case VM_OP_STAGECLOSE: /* ferme l'écran (warp interne) — 1 frame */
      var = fetch8(); /* dur */
      stage_request_close(var, fetch8());
      vm.wait_mode = VM_WAIT_TIMER;
      vm.wait_timer = 1;
      break;

    case VM_OP_SLOTFX: /* effet de palette d'un slot (B4) — NON bloquant */
      var = fetch8();
      val = fetch8();
      stage_slotfx(var, val, fetch8());
      break;

    case VM_OP_VIGSHOW: /* vignette (B5) — NON bloquant. anchor via un
                           second appel (parade tcc : 3 u8 max) */
      var = fetch8();   /* slot */
      val = fetch8();   /* vig */
      idx16 = fetch8(); /* x */
      vig_show(var, val, (u8)idx16, fetch8());
      vig_anchor(var, fetch8());
      break;

    case VM_OP_VIGPLAY: /* animation de la vignette — NON bloquant */
      var = fetch8();
      val = fetch8();
      vig_play(var, val, fetch8());
      break;

    case VM_OP_VIGHIDE:
      vig_hide(fetch8());
      break;

    case VM_OP_ANIMPLAY: /* animation image par image (A1) — bloquante
                            seulement si le bit 0 des flags est levé */
      var = fetch8();   /* animation */
      val = fetch8();   /* ancrage */
      idx16 = fetch8(); /* cible (acteur), 0xFF = event du script */
      if (val == ANIM_ANC_ACTOR && (u8)idx16 == 0xFF)
        idx16 = vm.script_actor;
      anim_play(var, val, (u8)idx16);
      if (fetch8() & 1)
        vm.wait_mode = VM_WAIT_ANIM; /* anim_busy ignore les boucles */
      break;

    case VM_OP_ANIMSTOP:
      anim_stop();
      break;

    case VM_OP_LISTSEL: /* menu à curseur (B6) — BLOQUANT */
      var = fetch8();          /* widget (racine du layout) */
      vm.choice_var = fetch8(); /* variable destination */
      op = fetch8();            /* flags : bit 0 = B annule */
      val = overlay_list_open(var);
      if (!val)
        break; /* pas de liste sur ce widget : commande ignorée */
      vm.choice_count = val;
      vm.choice_sel = 0;
      vm.list_flags = op;
      vm.wait_mode = VM_WAIT_LIST;
      break;

    case VM_OP_PLAYSFX: /* jouer un son (B1) — NON bloquant */
      audio_play_sfx(fetch8());
      break;

    case VM_OP_PLAYBGM: /* changer la musique (B1) — NON bloquant,
                           0xFF = silence ; la musique de la scène
                           reprend au prochain warp */
      audio_play_music(fetch8());
      break;

    case VM_OP_WEATHER: /* météo en particules (S13) — NON bloquant */
      var = fetch8();
      weather_set(var, fetch8());
      break;

    case VM_OP_TINTG: /* teinte GRADUELLE (S12) — rgb puis (mode, dur),
                         même parade tcc que TINT (3 u8 max par appel) */
      var = fetch8();   /* mode */
      val = fetch8();   /* r */
      idx16 = fetch8(); /* g */
      screenfx_tintg_rgb(val, (u8)idx16, fetch8());
      screenfx_tintg(var, fetch8());
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

    case VM_OP_DBREAD: /* vars16[dst] = champ de la database (v0.17) */
      var = fetch8();   /* table (registre db_tables[]) */
      val = fetch8();   /* source d'entrée : 0 constante, 1 variable */
      idx16 = fetch8(); /* entrée (ou n° de variable) */
      if (val)
        idx16 = vm.vars16[idx16 & 255];
      ofs = fetch8();   /* offset du champ */
      val = fetch8();   /* taille : 1 ou 2 octets */
      op = fetch8();    /* variable destination */
      if (var >= DB_TABLE_COUNT || idx16 >= db_table_counts[var])
        val16 = 0; /* entrée dynamique hors table : 0, jamais de lecture
                      sauvage (les constantes sont validées par datagen) */
      else
      {
        ofs += idx16 * db_table_sizes[var]; /* u16 : 255 x 255 max */
        val16 = db_tables[var][ofs];
        if (val == 2)
          val16 |= (u16)db_tables[var][ofs + 1] << 8;
      }
      vm.vars16[op] = val16;
      break;

    case VM_OP_SHOWUI: /* visibilité d'un widget UI (Phase 12) */
      var = fetch8(); /* index du widget (racine du layout) */
      op = fetch8();  /* 1 = afficher, 0 = cacher */
      overlay_show(var, op);
      break;

    case VM_OP_KEYIN: /* Key Input Processing (RM2003, Phase 12) */
      op = fetch8();    /* 1 = attendre un appui */
      val16 = fetch8(); /* masque des touches autorisées (lo) */
      val16 |= (u16)fetch8() << 8;
      var = fetch8();   /* variable destination */
      if (op)
      {
        vm.keyin_mask = val16;
        vm.keyin_dst = var;
        vm.wait_mode = VM_WAIT_KEY;
      }
      else
        vm.vars16[var] = keyin_scan(val16, padsCurrent(0));
      break;

    case VM_OP_DLGSTYLE: /* style de la prochaine boîte (S1) */
      textbox_set_style(fetch8());
      break;

    case VM_OP_SYSMENU: /* menu Système (sauvegarde) — Phase 12 : le
                           mapping START en dur est retiré, l'auteur
                           ouvre le menu par cette commande */
      sysmenu_open();
      break;

    case VM_OP_SHOWPIC: /* picture (S3/S5/S7) — transition DIFFÉRÉE à la
                             boucle principale (modèle du warp scripté),
                             la VM marque une pause d'une frame pour que
                             l'image précède la suite. Les VARIABLES
                             (flags bits 0-1) sont résolues ICI. */
      var = fetch8(); /* pic_id ou index de variable */
      val = fetch8(); /* x écran ou index de variable */
      idx16 = fetch8(); /* y écran ou index de variable */
      ofs = fetch8(); /* flags */
      if (ofs & 1)
        var = (u8)vm.vars16[var];
      if (ofs & 2)
      {
        val = (u8)vm.vars16[val];
        idx16 = (u8)vm.vars16[(u8)idx16];
      }
      picture_request(1, var, val, (u8)idx16, (u8)ofs, fetch8());
      vm.wait_mode = VM_WAIT_TIMER;
      vm.wait_timer = 1;
      break;

    case VM_OP_HIDEPIC:
      picture_request(0, 0, 0, 0, 0, fetch8());
      vm.wait_mode = VM_WAIT_TIMER;
      vm.wait_timer = 1;
      break;

    case VM_OP_MOVEPIC: /* glisse l'image affichée (S7) — NON-bloquant :
                             état seulement, le scroll avance frame par
                             frame dans picture_apply */
      val = fetch8(); /* x ou index de variable */
      idx16 = fetch8(); /* y ou index de variable */
      ofs = fetch8(); /* flags */
      if (ofs & 2)
      {
        val = (u8)vm.vars16[val];
        idx16 = (u8)vm.vars16[(u8)idx16];
      }
      picture_move(val, (u8)idx16, (u8)ofs, fetch8());
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
    textbox_tick(); /* machine à écrire (Phase 11, thème text_speed) */
    if (padsDown(0) & KEY_A)
    {
      if (textbox_waiting_key())
        textbox_resume(); /* point d'attente \! : reprendre (T2) */
      else if (textbox_busy())
        textbox_finish(); /* premier A : tout révéler (jusqu'à un \!) */
      else
      {
        textbox_close();
        vm.wait_mode = VM_WAIT_NONE;
      }
    }
    else if (!textbox_busy() && textbox_autoclose())
    {
      /* \^ (T2) : le message se ferme seul une fois tout révélé */
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
  if (vm.wait_mode == VM_WAIT_STAGE)
  {
    if (!stage_busy())
      vm.wait_mode = VM_WAIT_NONE;
    else
      return;
  }
  if (vm.wait_mode == VM_WAIT_ANIM)
  {
    if (!anim_busy())
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
  if (vm.wait_mode == VM_WAIT_KEY)
  {
    down = keyin_scan(vm.keyin_mask, padsDown(0));
    if (!down)
      return;
    vm.vars16[vm.keyin_dst] = down;
    vm.wait_mode = VM_WAIT_NONE;
  }
  if (vm.wait_mode == VM_WAIT_LIST)
  {
    /* menu à curseur (B6) : bouclage haut/bas — le réflexe des menus
       de combat SNES (4 options : bas depuis Fuite = Attaque) */
    down = padsDown(0);
    if (down & KEY_UP)
    {
      vm.choice_sel = vm.choice_sel ? (u8)(vm.choice_sel - 1)
                                    : (u8)(vm.choice_count - 1);
      overlay_list_cursor(vm.choice_sel);
    }
    else if (down & KEY_DOWN)
    {
      vm.choice_sel = (u8)(vm.choice_sel + 1) >= vm.choice_count
                          ? 0 : (u8)(vm.choice_sel + 1);
      overlay_list_cursor(vm.choice_sel);
    }
    else if (down & KEY_A)
    {
      /* variable 16-bit (0-255), comme KEYIN — le circuit if_var */
      vm.vars16[vm.choice_var] = vm.choice_sel;
      overlay_list_close((u8)(vm.list_flags & 2));
      vm.wait_mode = VM_WAIT_NONE;
    }
    else if ((down & KEY_B) && (vm.list_flags & 1))
    {
      vm.vars16[vm.choice_var] = 255;
      overlay_list_close((u8)(vm.list_flags & 2));
      vm.wait_mode = VM_WAIT_NONE;
    }
    else if ((down & (KEY_LEFT | KEY_RIGHT)) && (vm.list_flags & 4))
    {
      /* multi-panneaux : la sortie latérale dit au script d'activer la
         liste voisine (254 = sorti à gauche, 253 = à droite) */
      vm.vars16[vm.choice_var] = (down & KEY_LEFT) ? 254 : 253;
      overlay_list_close((u8)(vm.list_flags & 2));
      vm.wait_mode = VM_WAIT_NONE;
    }
    return;
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
  if (p_wait_mode == VM_WAIT_STAGE)
  {
    if (stage_busy())
      return;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode == VM_WAIT_ANIM)
  {
    if (anim_busy())
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
  if (p_wait_mode == VM_WAIT_KEY)
  {
    u8 code = keyin_scan(p_keyin_mask, padsDown(0));

    if (!code)
      return;
    vm.vars16[p_keyin_dst] = code;
    p_wait_mode = VM_WAIT_NONE;
  }
  if (p_wait_mode != VM_WAIT_NONE)
    return; /* TEXTBOX/CHOICE : impossibles ici (datagen les refuse) */
  pvm_swap();
  vm_step();
  pvm_swap();
}
