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
#include "anim.h"
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
extern const u8 btl_hero_mag[];
extern const u8 btl_mon_mdef[];
extern const u8 btl_act_n; /* menu entries with a meaning (C3) */
extern const u8 btl_act_kind[]; /* 0 attack, 1 skill, 2 flee, 3 inert */
extern const u8 btl_act_arg[];
extern const u8 btl_skill_mp[];
extern const u8 btl_skill_pow[];
extern const u8 btl_skill_tgt[]; /* 0 one enemy, 1 one ally */
extern const u8 btl_skill_anim[]; /* project animation, 0xFF none */
extern const u8 btl_hero_mdef[];
extern const u8 btl_mon_mag[]; /* stride 4 */
extern const u8 btl_mon_ai_start[]; /* segment of the ai pools, stride 4 */
extern const u8 btl_mon_ai_n[]; /* 0: the C2 plain attack */
extern const u8 btl_ai_kind[]; /* 0 attack, 1 skill */
extern const u8 btl_ai_arg[];
extern const u8 btl_ai_w[]; /* weights, 1-255 */
extern const u8 btl_troop_intro[]; /* hook common event, 0xFF none */
extern const u8 btl_troop_lowhp[];
extern const u8 btl_digit_cells[]; /* 32 chars: 0-9 on the even ones */
extern const u16 btl_digit_pal[]; /* white + shadow, OBJ palette 4 */

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
#define BT_TARGET 5
#define BT_ANIM 6
#define BT_HOOK 7
/* Damage popups (C4): digits 0-9 on EVEN chars so each is a 16x16
   small OBJ with three transparent chars — 0-7 on name row 21 (chars
   336+), 8-9 on row 22, row 23 blank under them, right below the
   vignettes' 384. OAM 100-103 sits in the gap between the vignettes
   (96-99) and the party (104-107). */
#define BT_DIGCHAR 336
#define BT_POPOAM(i) ((u16)(100 + (i)) << 2)
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
static u16 bh_mp[4];      /* mirrored into BTL_VAR_MP + h */
static u8 bt_pk = 0;      /* pending action kind (menu choice) */
static u8 bt_pa = 0;      /* pending action arg (skill index) */
static u8 bt_cur = 0;     /* target cursor (troop slot or hero) */
static u8 bt_curally = 0; /* cursor walks the party, not the troop */
static u8 bt_blink = 0;   /* cursor blink clock */
static u16 bt_rng = 0x2b17; /* flee roll — stirred every fight frame */
static u8 bt_lowhp = 0;   /* the low_hp hook fired (once a battle) */
static u8 pop_t = 0;      /* popup frames left (0: hidden) */
static u8 pop_n = 0;      /* digit count */
static u8 pop_d[4];       /* digit values, units first */
static u8 pop_x, pop_y;

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
  bt_lowhp = 0;
  pop_t = 0;
  o = (u16)troop << 2;
  for (h = 0; h < 4; h++)
  {
    bh_hp[h] = h < btl_hero_count ? btl_hero_maxhp[h] : 0;
    bm_hp[h] = btl_mon_hp[o + h];
    bt_atb[h] = 0;
    bt_atb[h + 4] = 0;
    bt_spd[h] = h < btl_hero_count ? btl_hero_speed[h] : 0;
    bt_spd[h + 4] = btl_mon_spd[o + h];
    bh_mp[h] = h < btl_hero_count ? btl_hero_maxmp[h] : 0;
    vm.vars16[BTL_VAR_BASE + (h << 1)] = bh_hp[h];
    vm.vars16[BTL_VAR_BASE + (h << 1) + 1] = bh_hp[h];
    vm.vars16[BTL_VAR_MP + h] = bh_mp[h];
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
    if (bh_hp[h] == 0 ||
        (bt_sub == BT_TARGET && bt_curally && h == bt_cur &&
         (bt_blink & 8)))
    {
      oamSetVisible(BT_OAM(h), OBJ_HIDE); /* KO, or the cursor's blink */
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

/* Arms the damage popup (C4): the value in white 8x8 digits, OBJ
   entries 100-103, risen a few pixels then gone. One at a time — the
   ready queue serialises actions anyway. */
static void bt_popup(u16 v, u8 x, u8 y)
{
  pop_n = 0;
  if (v > 9999)
    v = 9999;
  do
  {
    pop_d[pop_n++] = (u8)(v % 10);
    v /= 10;
  } while (v && pop_n < 4);
  pop_x = x;
  pop_y = y;
  pop_t = 48;
}

/* The popup's OAM, reasserted every fight frame like the party's. */
static void bt_pop_oam(void)
{
  u8 i, y;
  u8 *om;

  y = (u8)(pop_y - ((u8)(48 - pop_t) >> 2)); /* rises 12 px, then holds */
  for (i = 0; i < 4; i++)
  {
    if (!pop_t || i >= pop_n)
    {
      oamSetVisible(BT_POPOAM(i), OBJ_HIDE);
      continue;
    }
    om = oamMemory + BT_POPOAM(i);
    /* units digit (pop_d[0]) rightmost */
    om[0] = (u8)(pop_x + (((u16)(pop_n - 1 - i)) << 3));
    om[1] = y;
    om[2] = (u8)(pop_d[i] < 8
                     ? BT_DIGCHAR - 256 + (pop_d[i] << 1)
                     : BT_DIGCHAR - 256 + ((pop_d[i] - 8) << 1) + 16);
    om[3] = 0x39; /* prio 3, OBJ palette 4, char bit 8 */
    oamSetEx(BT_POPOAM(i), OBJ_SMALL, OBJ_SHOW);
  }
  if (pop_t)
    pop_t--;
}

/* Popup anchors: over a troop slot, or on a hero's row. */
static void bt_pop_mon(u16 v, u8 t)
{
  u16 o = ((u16)bt_troop << 2) + t;

  bt_popup(v, (u8)(((u16)btl_troop_x[o] << 3) + 16),
           (u8)(((u16)btl_troop_y[o] << 3) + 8));
}

static void bt_pop_hero(u16 v, u8 h)
{
  bt_popup(v, BT_X - 4, (u8)(BT_Y0 + ((u16)h << 5) + 8));
}

/* Damage on a troop slot, with the B4 feedback. */
static void bt_hit_mon(u8 t, u16 dmg)
{
  bm_hp[t] = bm_hp[t] > dmg ? (u16)(bm_hp[t] - dmg) : 0;
  bt_pop_mon(dmg, t);
  if (bm_hp[t])
    stage_slotfx(t, 1, 12); /* white flash: the B4 hit */
  else
  {
    stage_slotfx(t, 2, 24); /* fade to black: the B4 death */
    bt_dead = t;
  }
}

/* Resolves the hero's CHOSEN action on the CHOSEN target (C3): plain
   attack, or a skill — built-in magical formula power + mag*2 - mdef,
   heal power + mag on an ally. The skill's animation plays first when
   it has one; the damage lands when it ends (BT_ANIM). */
static void bt_hero_act(void)
{
  u16 dmg, o;
  u8 k;

  o = (u16)bt_troop << 2;
  if (bt_pk == 0) /* attack */
  {
    dmg = (u16)btl_hero_atk[bt_actor] << 1;
    k = btl_mon_def[o + bt_cur];
    dmg = dmg > k ? (u16)(dmg - k) : 1;
    bt_hit_mon(bt_cur, dmg);
    bt_atb[bt_actor] = 0;
    bt_timer = 24;
    bt_sub = BT_ACT;
    return;
  }
  /* skill: spend the MP now — the caster committed */
  bh_mp[bt_actor] = bh_mp[bt_actor] > btl_skill_mp[bt_pa]
                        ? (u16)(bh_mp[bt_actor] - btl_skill_mp[bt_pa]) : 0;
  vm.vars16[BTL_VAR_MP + bt_actor] = bh_mp[bt_actor];
  if (btl_skill_anim[bt_pa] != 0xFF)
  {
    /* aim the animation at the target, then wait for it (BT_ANIM) */
    if (bt_curally)
      anim_screen_at(BT_X + 16, (u8)(BT_Y0 + ((u16)bt_cur << 5) + 16));
    else
    {
      o = ((u16)bt_troop << 2) + bt_cur;
      anim_screen_at((u8)(((u16)btl_troop_x[o] << 3) + 24),
                     (u8)(((u16)btl_troop_y[o] << 3) + 24));
    }
    anim_play(btl_skill_anim[bt_pa], ANIM_ANC_SCREEN, 0);
    bt_sub = BT_ANIM;
    return;
  }
  bt_sub = BT_ANIM; /* no animation: fall through the same apply path */
}

/* The skill's effect, once its animation is done. The caster may be a
   MONSTER since C4 (bt_actor 4-7): same built-in formulas, the mirror
   way — btl_mon_mag against btl_hero_mdef, heal capped by the ROM hp. */
static void bt_skill_apply(void)
{
  u16 v, o;
  u8 k;

  if (bt_actor >= 4)
  {
    o = (u16)bt_troop << 2;
    v = (u16)btl_skill_pow[bt_pa];
    k = btl_mon_mag[o + bt_actor - 4];
    if (bt_curally)
    {
      /* offensive, on a hero */
      v += (u16)k << 1;
      k = btl_hero_mdef[bt_cur];
      v = v > k ? (u16)(v - k) : 1;
      bh_hp[bt_cur] = bh_hp[bt_cur] > v ? (u16)(bh_hp[bt_cur] - v) : 0;
      vm.vars16[BTL_VAR_BASE + ((u16)bt_cur << 1)] = bh_hp[bt_cur];
      bt_pop_hero(v, bt_cur);
    }
    else
    {
      /* heal, on a wounded monster */
      v += k;
      bm_hp[bt_cur] = (u16)(bm_hp[bt_cur] + v);
      if (bm_hp[bt_cur] > btl_mon_hp[o + bt_cur])
        bm_hp[bt_cur] = btl_mon_hp[o + bt_cur];
      stage_slotfx(bt_cur, 1, 8); /* a short flash reads as the mend */
      bt_pop_mon(v, bt_cur);
    }
    bt_atb[bt_actor] = 0;
    bt_timer = 30;
    bt_sub = BT_ACT;
    return;
  }
  if (bt_curally)
  {
    v = (u16)btl_skill_pow[bt_pa] + btl_hero_mag[bt_actor];
    bh_hp[bt_cur] = (u16)(bh_hp[bt_cur] + v);
    if (bh_hp[bt_cur] > btl_hero_maxhp[bt_cur])
      bh_hp[bt_cur] = btl_hero_maxhp[bt_cur];
    vm.vars16[BTL_VAR_BASE + ((u16)bt_cur << 1)] = bh_hp[bt_cur];
    bt_pop_hero(v, bt_cur);
  }
  else
  {
    o = (u16)bt_troop << 2;
    v = (u16)btl_skill_pow[bt_pa] + ((u16)btl_hero_mag[bt_actor] << 1);
    k = btl_mon_mdef[o + bt_cur];
    v = v > k ? (u16)(v - k) : 1;
    bt_hit_mon(bt_cur, v);
  }
  bt_atb[bt_actor] = 0;
  bt_timer = 24;
  bt_sub = BT_ACT;
}

/* A monster's turn — C2's built-in attack, unchanged. */
static void bt_attack(u8 actor)
{
  u16 dmg, o;
  u8 k, t;

  o = (u16)bt_troop << 2;
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
    bt_pop_hero(dmg, t);
  }
  bt_atb[actor] = 0;
  bt_timer = 24; /* let the flash read before the next turn */
  bt_sub = BT_ACT;
}

/* A monster CASTS (C4): the mirrored target pick, then the same
   animation-then-apply path as the heroes' skills (BT_ANIM). Note the
   bt_curally flag keeps its SCREEN meaning — 1 aims the hero column,
   0 aims a troop slot — whoever the caster is. */
static void bt_mon_skill(u8 actor, u8 sk)
{
  u8 k, t;
  u16 o;

  bt_actor = actor;
  bt_pa = sk;
  if (btl_skill_tgt[sk] == 0)
  {
    /* enemy: a living hero, alternating like the plain attack */
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
    bt_cur = t;
    bt_curally = 1;
  }
  else
  {
    /* ally: the first WOUNDED living monster — a heal wasted on full
       health falls back to the plain attack */
    o = (u16)bt_troop << 2;
    t = 0xFF;
    for (k = 0; k < btl_troop_n[bt_troop]; k++)
      if (bm_hp[k] && bm_hp[k] < btl_mon_hp[o + k])
      {
        t = k;
        break;
      }
    if (t == 0xFF)
    {
      bt_attack(actor);
      return;
    }
    bt_cur = t;
    bt_curally = 0;
  }
  if (btl_skill_anim[sk] != 0xFF)
  {
    if (bt_curally)
      anim_screen_at(BT_X + 16, (u8)(BT_Y0 + ((u16)bt_cur << 5) + 16));
    else
    {
      o = ((u16)bt_troop << 2) + bt_cur;
      anim_screen_at((u8)(((u16)btl_troop_x[o] << 3) + 24),
                     (u8)(((u16)btl_troop_y[o] << 3) + 24));
    }
    anim_play(btl_skill_anim[sk], ANIM_ANC_SCREEN, 0);
  }
  bt_sub = BT_ANIM;
}

/* A monster's turn (C4): its WEIGHTED action list from the database —
   roll once, walk the weights. An empty list is the C2 plain attack. */
static void bt_monster_act(u8 actor)
{
  u16 o, sum, r;
  u8 i, n, s;

  o = ((u16)bt_troop << 2) + (actor - 4);
  n = btl_mon_ai_n[o];
  if (n)
  {
    s = btl_mon_ai_start[o];
    sum = 0;
    for (i = 0; i < n; i++)
      sum += btl_ai_w[s + i];
    r = bt_rng % sum;
    for (i = 0; i < n; i++)
    {
      u8 w = btl_ai_w[s + i];

      if (r < w)
        break;
      r -= w;
    }
    if (btl_ai_kind[s + i] == 1)
    {
      bt_mon_skill(actor, btl_ai_arg[s + i]);
      return;
    }
  }
  bt_attack(actor);
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
  /* low_hp hook (C4), once a battle: a living monster under HALF its
     hp starts the troop's common event — the ATB waits (BT_HOOK). */
  if (!bt_lowhp && btl_troop_lowhp[bt_troop] != 0xFF)
  {
    o = (u16)bt_troop << 2;
    for (k = 0; k < btl_troop_n[bt_troop]; k++)
      if (bm_hp[k] && bm_hp[k] < (u16)(btl_mon_hp[o + k] >> 1))
      {
        u16 ofs = vm_common_hook(btl_troop_lowhp[bt_troop]);

        bt_lowhp = 1;
        if (ofs != SCRIPT_NONE)
        {
          vm_start(ofs);
          bt_sub = BT_HOOK;
          return;
        }
        break;
      }
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
  bt_pop_oam(); /* the damage popup lives across sub-states (C4) */
  bt_rng = (u16)(bt_rng * 25173 + 13849); /* the flee roll's clock */
  switch (bt_sub)
  {
  case BT_HOOK: /* a troop hook runs on the freed VM; the clock waits */
    if (!vm_active())
      bt_sub = BT_TICK;
    break;

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
    if (ready < 4)
    {
      bt_actor = ready;
      if (btl_menu_widget != 0xFF && overlay_list_open(btl_menu_widget))
      {
        bt_sel = 0;
        overlay_list_cursor(0);
        bt_sub = BT_MENU;
        break;
      }
      /* menu-less project: plain attack on the first standing monster */
      bt_pk = 0;
      bt_curally = 0;
      for (bt_cur = 0; bt_cur < 3 && !bt_mon_alive(bt_cur); bt_cur++)
      {
      }
      bt_hero_act();
      break;
    }
    bt_monster_act(ready); /* a monster's turn: its AI list (C4) */
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
      if ((u8)(bt_sel + 1) < btl_act_n)
      {
        bt_sel++;
        overlay_list_cursor(bt_sel);
      }
    }
    else if (down & KEY_A)
    {
      u8 kind = bt_sel < btl_act_n ? btl_act_kind[bt_sel] : 3;

      if (kind == 0 || kind == 1)
      {
        if (kind == 1)
        {
          bt_pa = btl_act_arg[bt_sel];
          if (bh_mp[bt_actor] < btl_skill_mp[bt_pa])
            break; /* cannot pay: the menu stays open */
        }
        bt_pk = kind;
        overlay_list_close(0);
        /* the TARGET cursor: allies for a heal, the troop otherwise */
        bt_curally = (u8)(kind == 1 && btl_skill_tgt[bt_pa] == 1);
        if (bt_curally)
        {
          for (bt_cur = 0; bt_cur < btl_hero_count && !bh_hp[bt_cur];
               bt_cur++)
          {
          }
        }
        else
          for (bt_cur = 0; bt_cur < 3 && !bt_mon_alive(bt_cur); bt_cur++)
          {
          }
        bt_blink = 0;
        bt_sub = BT_TARGET;
      }
      else if (kind == 2) /* Fuir — a coin flip, FF's honest odds */
      {
        overlay_list_close(0);
        if (bt_rng & 1)
        {
          vm.vars16[BTL_VAR_ISSUE] = 3; /* fled: no rewards */
          bt_timer = 20;
          bt_sub = BT_END;
        }
        else
        {
          bt_atb[bt_actor] = 0; /* the failed try costs the turn */
          bt_timer = 20;
          bt_sub = BT_ACT;
        }
      }
      /* kind 3: inert (C5's items) — the menu stays open */
    }
    break;

  case BT_TARGET: /* pick a target — blink marks the candidate */
    bt_blink++;
    if (!bt_curally && (bt_blink & 15) == 0)
      stage_slotfx(bt_cur, 1, 4); /* a short pulse on the candidate */
    down = padsDown(0);
    if (down & (KEY_LEFT | KEY_UP))
    {
      for (i = 0; i < 4; i++)
      {
        k = (u8)((bt_cur + 3 - i) & 3); /* walk backwards */
        if (bt_curally ? (k < btl_hero_count && bh_hp[k] != 0)
                       : bt_mon_alive(k))
        {
          bt_cur = k;
          break;
        }
      }
    }
    else if (down & (KEY_RIGHT | KEY_DOWN))
    {
      for (i = 0; i < 4; i++)
      {
        k = (u8)((bt_cur + 1 + i) & 3);
        if (bt_curally ? (k < btl_hero_count && bh_hp[k] != 0)
                       : bt_mon_alive(k))
        {
          bt_cur = k;
          break;
        }
      }
    }
    else if (down & KEY_A)
    {
      if (!bt_curally)
        stage_slotfx(bt_cur, 0, 0); /* palette back before the hit */
      bt_hero_act();
    }
    else if (down & KEY_B) /* back to the command menu */
    {
      if (!bt_curally)
        stage_slotfx(bt_cur, 0, 0);
      if (overlay_list_open(btl_menu_widget))
      {
        overlay_list_cursor(bt_sel);
        bt_sub = BT_MENU;
      }
      else
        bt_sub = BT_TICK;
    }
    break;

  case BT_ANIM: /* the skill's animation runs; the effect lands after */
    if (!anim_busy())
      bt_skill_apply();
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
    pop_t = 0;
    for (k = 0; k < 4; k++)
      oamSetVisible(BT_POPOAM(k), OBJ_HIDE);
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
    if (bt_up >= btl_hero_count && bt_row >= 2)
    {
      bt_phase = 4;
      /* intro hook (C4): the troop's common event opens the fight —
         boss dialogue, a slotfx, anything the ordinary editor writes.
         BATTLE ended the calling script, so the VM is free for it. */
      if (btl_troop_intro[bt_troop] != 0xFF)
      {
        u16 ofs = vm_common_hook(btl_troop_intro[bt_troop]);

        if (ofs != SCRIPT_NONE)
        {
          vm_start(ofs);
          bt_sub = BT_HOOK;
        }
      }
    }
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

  if (!bt_on || bt_phase != 3)
    return;
  if (bt_up >= btl_hero_count)
  {
    /* after the party: the popup digits (C4) — one 1 KB sheet on name
       rows 22-23, then their palette (OBJ 4). bt_row is the step. */
    if (bt_row == 0)
    {
      if (!vbl_take(11))
        return;
      dmaCopyVram((u8 *)btl_digit_cells,
                  (u16)(VRAM_OBJ_GFX + ((u16)BT_DIGCHAR << 4)), 1536);
      bt_row = 1;
      return;
    }
    if (bt_row == 1)
    {
      if (!vbl_take(2))
        return;
      dmaCopyCGram((u8 *)btl_digit_pal, 192, 32); /* OBJ palette 4 */
      bt_row = 2;
    }
    return;
  }
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
    /* C1's "+256-word bias" was a misread dump, elucidated in C4: the
       cell's top char row is TRANSPARENT (a 16x24 battler centred at
       y+4), so a correct upload leaves chars n..n+3 blank and fills
       n+17 up — which looks exactly like a +16-char shift when the
       real bug (the 4-transfer burst losing its tail) truncated the
       cells. One row per frame was the whole fix; the compensation
       only slid the art 8 px up inside its 32x32 frame. */
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
