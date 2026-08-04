/*
 * btl.c — the battle screen. C1: the screen stands. C2: it fights.
 *
 * Everything visible is an EXISTING primitive driven from here:
 *
 *  - backdrop + monsters: the composed screen (stage.c) — btl calls
 *    stage_request_open / stage_pose / stage_slotfx / stage_clear
 *    exactly as the VM opcodes do;
 *  - party battlers: four 32x32 OBJ cells (chars 448-511, after the
 *    vignettes' 384-447), one 128-byte row per VBlank under the budget;
 *  - the command menu: the PROJECT's own cursor-list widget (resolved
 *    by datagen), driven with the same pads vocabulary as LISTSEL;
 *  - HP: reserved variables (btl.h) — the project's widgets draw the
 *    windows, the engine draws none.
 *
 * THE CLOCK (C0 §5): every combatant fills an ATB gauge by speed/4 a
 * frame; full enters the round-robin ready scan. WAIT mode: the clock
 * only ticks in the TICK sub-state — a menu or a resolving action
 * freezes it, FF6's kinder default. One action resolves at a time.
 *
 * C2 damage is the built-in physical formula: atk*2 - def, floor 1.
 * Author formulas (F1 functions per skill) arrive in C3.
 */
#include <snes.h>
#include "btl.h"
#include "stage.h"
#include "ui_overlay.h"
#include "vbudget.h"
#include "vm.h"
#include "vram.h"

/* data_battle.c — always emitted, zeroed without battle data */
extern const u8 btl_hero_count;
extern const u8 *const btl_hero_cells[];
extern const u16 btl_hero_pals[]; /* 4 x 16 colours, flat */
extern const u16 btl_hero_maxhp[];
extern const u16 btl_hero_maxmp[];
extern const u8 btl_hero_speed[];
extern const u8 btl_hero_atk[];
extern const u8 btl_hero_def[];
extern const u8 btl_troop_count;
extern const u8 btl_troop_back[];
extern const u8 btl_troop_n[];
extern const u8 btl_troop_pic[]; /* stride 4 per troop */
extern const u8 btl_troop_x[];
extern const u8 btl_troop_y[];
extern const u16 btl_mon_hp[]; /* per troop slot, stride 4 */
extern const u8 btl_mon_atk[];
extern const u8 btl_mon_def[];
extern const u8 btl_mon_spd[];
extern const u16 btl_mon_xp[];
extern const u16 btl_mon_gold[];
extern const u8 btl_menu_widget; /* 0xFF: no menu, attack unprompted */

#define BT_CHAR(h) (448 + (h) * 4) /* the hero's 32x32 OBJ block */
#define BT_OAM(h) ((u16)(104 + (h)) << 2)

/* Party column, right side (C0 §4): x fixed, one row of 32 px a hero.
   High enough to clear the PV windows: BG3's high-priority tiles (the
   mode-1 textbox bit) pass IN FRONT of every sprite. */
#define BT_X 200
#define BT_Y0 40

static u8 bt_on = 0;
static u8 bt_phase = 0; /* 1 open, 2 pose, 3 upload, 4 FIGHT, 5 close */
static u8 bt_troop = 0;
static u8 bt_slot = 0; /* next monster to pose */
static u8 bt_up = 0;   /* cells uploaded (btl_vblank advances) */
static u8 bt_row = 0;  /* next 128-byte step of the current cell */

/* ---- the fight (C2) ---- */
#define BT_TICK 0
#define BT_MENU 1
#define BT_ACT 2
#define BT_CLEAR 3
#define BT_END 4
static u8 bt_sub = 0;
static u16 bh_hp[4];  /* heroes — mirrored into the reserved vars */
static u16 bm_hp[4];  /* the troop's monsters */
static u8 bt_atb[8];  /* 0-3 heroes, 4-7 monsters; 255 = ready */
static u8 bt_spd[8];
static u8 bt_scan = 0;  /* round-robin start of the ready scan */
static u8 bt_actor = 0; /* whose menu is open */
static u8 bt_sel = 0;   /* menu cursor */
static u8 bt_timer = 0;
static u8 bt_dead = 0xFF; /* monster slot fading out, to clear */
static u8 bt_flip = 0;    /* alternates the monsters' targets */

u8 btl_active(void)
{
  return bt_on;
}

static u8 bt_mon_alive(u8 k) /* k = 0-3, troop slot */
{
  return k < btl_troop_n[bt_troop] && bm_hp[k] != 0;
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
  bt_up = 0;
  bt_row = 0;
  bt_sub = BT_TICK;
  bt_scan = 0;
  bt_timer = 0;
  bt_dead = 0xFF;
  bt_flip = 0;
  o = (u16)troop << 2;
  for (h = 0; h < 4; h++)
  {
    bh_hp[h] = h < btl_hero_count ? btl_hero_maxhp[h] : 0;
    bm_hp[h] = btl_mon_hp[o + h];
    bt_atb[h] = 0;
    bt_atb[h + 4] = 0;
    bt_spd[h] = h < btl_hero_count ? btl_hero_speed[h] : 0;
    bt_spd[h + 4] = btl_mon_spd[o + h];
    vm.vars16[BTL_VAR_BASE + (h << 1)] = bh_hp[h];
    vm.vars16[BTL_VAR_BASE + (h << 1) + 1] = bh_hp[h];
  }
  vm.vars16[BTL_VAR_ISSUE] = 0;
  vm.vars16[BTL_VAR_XP] = 0;
  vm.vars16[BTL_VAR_GOLD] = 0;
  stage_request_open(btl_troop_back[troop], 30, 2); /* mosaic — THE entry */
}

/* Places (and keeps) the party's OAM entries. Reasserted every fight
   frame, the vignette discipline. A KO'd hero disappears — C3 will owe
   him a proper pose. */
static void bt_oam(void)
{
  u8 h;
  u8 *om;

  for (h = 0; h < btl_hero_count; h++)
  {
    if (bh_hp[h] == 0)
    {
      oamSetVisible(BT_OAM(h), OBJ_HIDE);
      continue;
    }
    om = oamMemory + BT_OAM(h);
    om[0] = BT_X;
    om[1] = (u8)(BT_Y0 + ((u16)h << 5));
    om[2] = (u8)(BT_CHAR(h) - 256); /* 9th char bit rides attr bit 0 */
    om[3] = (u8)(0x30 | (h << 1) | 1); /* prio 3, OBJ palette h */
    oamSetEx(BT_OAM(h), OBJ_LARGE, OBJ_SHOW);
  }
}

/* One attack, the whole of C2's action vocabulary. Built-in physical
   formula: atk*2 - def, floor 1 — author formulas are C3. */
static void bt_attack(u8 actor)
{
  u16 dmg, o;
  u8 k, t;

  o = (u16)bt_troop << 2;
  if (actor < 4)
  {
    /* hero -> first monster still standing (the cursor is C3) */
    for (t = 0; t < 4; t++)
      if (bt_mon_alive(t))
        break;
    if (t == 4)
      return;
    dmg = (u16)btl_hero_atk[actor] << 1;
    k = btl_mon_def[o + t];
    dmg = dmg > k ? (u16)(dmg - k) : 1;
    bm_hp[t] = bm_hp[t] > dmg ? (u16)(bm_hp[t] - dmg) : 0;
    if (bm_hp[t])
      stage_slotfx(t, 1, 12); /* white flash: the B4 hit */
    else
    {
      stage_slotfx(t, 2, 24); /* fade to black: the B4 death */
      bt_dead = t;
    }
  }
  else
  {
    /* monster -> a living hero, alternating so both take hits */
    t = 0xFF;
    for (k = 0; k < btl_hero_count; k++)
    {
      u8 c = (u8)((k + bt_flip) % btl_hero_count);

      if (bh_hp[c])
      {
        t = c;
        break;
      }
    }
    bt_flip++;
    if (t == 0xFF)
      return;
    dmg = (u16)btl_mon_atk[o + actor - 4] << 1;
    k = btl_hero_def[t];
    dmg = dmg > k ? (u16)(dmg - k) : 1;
    bh_hp[t] = bh_hp[t] > dmg ? (u16)(bh_hp[t] - dmg) : 0;
    vm.vars16[BTL_VAR_BASE + ((u16)t << 1)] = bh_hp[t];
  }
  bt_atb[actor] = 0;
  bt_timer = 24; /* let the flash read before the next turn */
  bt_sub = BT_ACT;
}

/* Victory / defeat check, after each resolved action. */
static void bt_check_end(void)
{
  u8 k, any;
  u16 o;

  any = 0;
  for (k = 0; k < 4; k++)
    if (bt_mon_alive(k))
      any = 1;
  if (!any)
  {
    o = (u16)bt_troop << 2;
    vm.vars16[BTL_VAR_ISSUE] = 1;
    for (k = 0; k < btl_troop_n[bt_troop]; k++)
    {
      vm.vars16[BTL_VAR_XP] += btl_mon_xp[o + k];
      vm.vars16[BTL_VAR_GOLD] += btl_mon_gold[o + k];
    }
    bt_timer = 30;
    bt_sub = BT_END;
    return;
  }
  any = 0;
  for (k = 0; k < btl_hero_count; k++)
    if (bh_hp[k])
      any = 1;
  if (!any)
  {
    vm.vars16[BTL_VAR_ISSUE] = 2;
    bt_timer = 30;
    bt_sub = BT_END;
    return;
  }
  bt_sub = BT_TICK;
}

/* The clock and the queues — TICK is the only sub-state where time
   passes (Wait mode). Ready combatants are served round-robin so a
   fast pair cannot starve the slow ones. */
static void bt_fight(void)
{
  u8 i, k, ready;
  u16 down;

  bt_oam();
  switch (bt_sub)
  {
  case BT_TICK:
    if (bt_dead != 0xFF)
    {
      /* a monster finished fading: free its slot (deferred transfer) */
      if (stage_busy())
        break;
      stage_clear(bt_dead);
      bt_dead = 0xFF;
      bt_sub = BT_CLEAR;
      break;
    }
    ready = 0xFF;
    for (i = 0; i < 8; i++)
    {
      k = (u8)((bt_scan + i) & 7);
      if (bt_atb[k] != 255)
        continue;
      if (k < 4 ? (k < btl_hero_count && bh_hp[k] != 0) : bt_mon_alive((u8)(k - 4)))
      {
        ready = k;
        break;
      }
    }
    if (ready == 0xFF)
    {
      for (k = 0; k < 8; k++)
      {
        u8 ok = k < 4 ? (k < btl_hero_count && bh_hp[k] != 0)
                      : bt_mon_alive((u8)(k - 4));

        if (!ok)
          continue;
        i = (u8)(bt_spd[k] >> 2);
        bt_atb[k] = bt_atb[k] > (u8)(255 - i) ? 255 : (u8)(bt_atb[k] + i);
      }
      break;
    }
    bt_scan = (u8)(ready + 1);
    if (ready < 4 && btl_menu_widget != 0xFF &&
        overlay_list_open(btl_menu_widget))
    {
      bt_actor = ready;
      bt_sel = 0;
      overlay_list_cursor(0);
      bt_sub = BT_MENU;
      break;
    }
    bt_attack(ready); /* monsters, and heroes of a menu-less project */
    break;

  case BT_MENU: /* the LISTSEL vocabulary, driven from here */
    down = padsDown(0);
    if (down & KEY_UP)
    {
      if (bt_sel)
      {
        bt_sel--;
        overlay_list_cursor(bt_sel);
      }
    }
    else if (down & KEY_DOWN)
    {
      if (bt_sel < 2)
      {
        bt_sel++;
        overlay_list_cursor(bt_sel);
      }
    }
    else if (down & KEY_A)
    {
      /* C2 implements Attaque (entry 0) alone; the other entries are
         C3's and stay inert rather than lying */
      if (bt_sel == 0)
      {
        overlay_list_close(0);
        bt_attack(bt_actor);
      }
    }
    break;

  case BT_ACT:
    if (bt_timer)
    {
      bt_timer--;
      break;
    }
    if (bt_dead != 0xFF)
    {
      bt_sub = BT_TICK; /* let TICK run the deferred slot clear first */
      break;
    }
    bt_check_end();
    break;

  case BT_CLEAR:
    if (!stage_busy())
      bt_check_end();
    break;

  default: /* BT_END: a beat to read the field, then the curtain */
    if (bt_timer)
    {
      bt_timer--;
      break;
    }
    for (k = 0; k < btl_hero_count; k++)
      oamSetVisible(BT_OAM(k), OBJ_HIDE);
    vm_switch_set(BTL_SW_DONE, 1); /* the post-battle AUTO page's cue */
    stage_request_close(30, 2);
    bt_phase = 5;
    break;
  }
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
    bt_phase = 3; /* btl_vblank now feeds the party's cells */
    break;
  case 3:
    if (bt_up >= btl_hero_count)
      bt_phase = 4;
    break;
  case 4:
    bt_fight();
    break;
  default: /* 5: the internal warp restores the scene, then done */
    if (!stage_active())
    {
      bt_on = 0;
      bt_phase = 0;
    }
    break;
  }
}

void btl_vblank(void)
{
  const u8 *src;
  u16 base, ofs;

  if (!bt_on || bt_phase != 3 || bt_up >= btl_hero_count)
    return;
  /* ONE 128-byte transfer per frame: a burst straddling the end of the
     window lost its tail (VRAM dumps). The party fits inside the
     opening fade with room to spare. */
  if (!vbl_take(6))
    return;
  if (bt_row < 4)
  {
    src = btl_hero_cells[bt_up];
    ofs = bt_row;
    ofs <<= 7;
    src += ofs; /* the cell's 128-byte row */
    base = BT_CHAR(bt_up);
    base <<= 4;
    base += VRAM_OBJ_GFX;
    ofs = bt_row;
    ofs <<= 8;
    base += ofs; /* one name row = 16 chars = 256 words */
    /* MEASURED, unexplained (C1, revisit): a transfer issued HERE lands
       exactly +256 words past its address — the computed base was
       proven right by a WRAM probe, and sg_open's writes to the same
       region land right. Compensate by the measured amount. */
    base -= 256;
    dmaCopyVram((u8 *)src, base, 128);
    bt_row++;
    return;
  }
  ofs = bt_up;
  ofs <<= 4;
  dmaCopyCGram((u8 *)(btl_hero_pals + ofs), (u16)(128 + ofs), 32);
  bt_row = 0;
  bt_up++;
}
