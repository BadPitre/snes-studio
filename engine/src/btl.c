/*
 * btl.c — the battle opener (V2). C1-C6 grew a full ATB machine here;
 * PLANNING_COMBAT_EN_EVENTS.md moved the fight into the project's
 * event library, and what remains is the part a script cannot do for
 * itself: open the composed screen on a troop, pose its monsters from
 * troops.toml, publish the party's stats and the posed monsters'
 * database indexes in reserved variables, and start the troop's intro
 * common event — the library's entry point.
 *
 * No hook, or no library behind it: the fallback closes the screen at
 * once with the done switch raised, so a bare `battle` never
 * soft-locks a project.
 */
#include <snes.h>
#include "btl.h"
#include "stage.h"
#include "vm.h"

/* data_battle.c — always emitted, zeroed without battle data */
extern const u8 btl_hero_count;
extern const u16 btl_hero_maxhp[];
extern const u16 btl_hero_maxmp[];
extern const u8 btl_hero_speed[];
extern const u8 btl_hero_atk[];
extern const u8 btl_hero_def[];
extern const u8 btl_hero_mag[];
extern const u8 btl_hero_mdef[];
extern const u8 btl_troop_count;
extern const u8 btl_troop_back[];
extern const u8 btl_troop_n[];
extern const u8 btl_troop_pic[]; /* stride 4 per troop */
extern const u8 btl_troop_x[];
extern const u8 btl_troop_y[];
extern const u8 btl_troop_monid[]; /* database index, 0xFF = empty */
extern const u8 btl_troop_intro[]; /* hook common event, 0xFF = none */

static u8 bt_on = 0;
static u8 bt_phase = 0; /* 1 open, 2 pose, 3 hand over */
static u8 bt_troop = 0;
static u8 bt_slot = 0; /* next monster to pose */

u8 btl_active(void)
{
  return bt_on;
}

void btl_request(u8 troop)
{
  u8 h;
  u16 o;

  if (bt_on || troop >= btl_troop_count || btl_hero_count == 0)
    return;
  bt_on = 1;
  bt_phase = 1;
  bt_troop = troop;
  bt_slot = 0;
  /* The reserved variables: the library's working set. HP/MP start
     full — carrying wounds across battles is the library's decision
     to make, not this opener's. */
  for (h = 0; h < 4; h++)
  {
    u16 hp = h < btl_hero_count ? btl_hero_maxhp[h] : 0;

    vm.vars16[BTL_VAR_BASE + (h << 1)] = hp;
    vm.vars16[BTL_VAR_BASE + (h << 1) + 1] = hp;
    vm.vars16[BTL_VAR_MP + h] = h < btl_hero_count ? btl_hero_maxmp[h] : 0;
    vm.vars16[BTL_VAR_ATK + h] = h < btl_hero_count ? btl_hero_atk[h] : 0;
    vm.vars16[BTL_VAR_DEF + h] = h < btl_hero_count ? btl_hero_def[h] : 0;
    vm.vars16[BTL_VAR_MAG + h] = h < btl_hero_count ? btl_hero_mag[h] : 0;
    vm.vars16[BTL_VAR_MDEF + h] = h < btl_hero_count ? btl_hero_mdef[h] : 0;
    vm.vars16[BTL_VAR_SPD + h] = h < btl_hero_count ? btl_hero_speed[h] : 0;
  }
  vm.vars16[BTL_VAR_NHERO] = btl_hero_count;
  vm.vars16[BTL_VAR_ISSUE] = 0;
  vm.vars16[BTL_VAR_XP] = 0;
  vm.vars16[BTL_VAR_GOLD] = 0;
  vm.vars16[BTL_VAR_TROOP] = troop;
  o = (u16)troop << 2;
  for (h = 0; h < 4; h++)
  {
    u8 id = btl_troop_monid[o + h];

    vm.vars16[BTL_VAR_MONID + h] = id == 0xFF ? 0xFFFF : id;
  }
  stage_request_open(btl_troop_back[troop], 30, 2); /* mosaic — THE entry */
}

void btl_update(void)
{
  if (!bt_on)
    return;
  switch (bt_phase)
  {
  case 1: /* the composed screen is opening (fade + backdrop) */
    if (stage_active() && !stage_busy())
      bt_phase = 2;
    break;
  case 2: /* pose the troop, one monster per settled transfer */
    if (stage_busy())
      break;
    if (bt_slot < btl_troop_n[bt_troop])
    {
      u16 o = ((u16)bt_troop << 2) + bt_slot;

      stage_pose(bt_slot, btl_troop_pic[o], btl_troop_x[o], btl_troop_y[o]);
      bt_slot++;
      break;
    }
    bt_phase = 3;
    break;
  default: /* 3: hand the field to the event library */
    if (stage_busy())
      break;
    bt_on = 0;
    bt_phase = 0;
    if (btl_troop_intro[bt_troop] != 0xFF)
    {
      u16 ofs = vm_common_hook(btl_troop_intro[bt_troop]);

      if (ofs != SCRIPT_NONE)
      {
        /* BATTLE ended the calling script, so the VM is free: the
           intro common event IS the battle from here on. */
        vm_start(ofs);
        break;
      }
    }
    /* no library to hand over to: close honestly, never a soft-lock */
    vm_switch_set(BTL_SW_DONE, 1);
    stage_request_close(30, 2);
    break;
  }
}
