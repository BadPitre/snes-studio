/*
 * btl.c — the battle screen, milestone C1 (the screen stands).
 *
 * Everything visible is an EXISTING primitive driven from here:
 *
 *  - backdrop + monsters: the composed screen (stage.c) — btl calls
 *    stage_request_open and stage_pose exactly as the VM opcodes do,
 *    so transfers stay spread out and the close is the proven internal
 *    warp;
 *  - party battlers: four 32x32 OBJ cells (chars 448-511, the last
 *    column group after the vignettes' 384-447), uploaded at VBlank
 *    with the vignette recipe — 4 DMAs of 128 bytes per cell, under
 *    the budget; OBJ palettes 0-3, free while the scene's sprites are
 *    hidden, and rebuilt by the closing warp like everything else;
 *  - HP: written into the reserved variables (btl.h) so the project's
 *    OWN widgets display them — the engine draws no window here.
 *
 * OAM entries 104-107: vignettes hold 96-99, and the scene's draw
 * calls are frozen while a composed screen is up.
 */
#include <snes.h>
#include "btl.h"
#include "stage.h"
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
extern const u8 btl_troop_count;
extern const u8 btl_troop_back[];
extern const u8 btl_troop_n[];
extern const u8 btl_troop_pic[]; /* stride 4 per troop */
extern const u8 btl_troop_x[];
extern const u8 btl_troop_y[];

#define BT_CHAR(h) (448 + (h) * 4) /* the hero's 32x32 OBJ block */
#define BT_OAM(h) ((u16)(104 + (h)) << 2)

/* Party column, right side (C0 §4): x fixed, one row of 32 px a hero. */
#define BT_X 200
#define BT_Y0 40 /* the party column clears the PV windows: BG3's
   high-priority tiles (the mode-1 textbox bit) pass IN FRONT of every
   sprite, so a battler under a window would lose its feet */

static u8 bt_on = 0;
static u8 bt_phase = 0; /* 1 open, 2 pose, 3 upload, 4 idle, 5 close */
static u8 bt_troop = 0;
static u8 bt_slot = 0; /* next monster to pose */
static u8 bt_up = 0;   /* cells uploaded (btl_vblank advances) */
static u8 bt_row = 0;  /* next 128-byte step of the current cell (0-4:
                          four char rows, then the palette) */

u8 btl_active(void)
{
  return bt_on;
}

void btl_request(u8 troop)
{
  u8 h;

  if (bt_on || troop >= btl_troop_count || btl_hero_count == 0)
    return;
  bt_on = 1;
  bt_phase = 1;
  bt_troop = troop;
  bt_slot = 0;
  bt_up = 0;
  bt_row = 0;
  /* the party's HP, for the project's widgets — C1 shows everyone at
     full health (the clock and the wounds are C2) */
  for (h = 0; h < btl_hero_count; h++)
  {
    vm.vars16[BTL_VAR_BASE + (h << 1)] = btl_hero_maxhp[h];
    vm.vars16[BTL_VAR_BASE + (h << 1) + 1] = btl_hero_maxhp[h];
  }
  stage_request_open(btl_troop_back[troop], 30, 2); /* mosaic — THE entry */
}

/* Places (and keeps) the party's OAM entries. Reasserted every idle
   frame, the vignette discipline: cheap, and immune to anything that
   sweeps the OAM. */
static void bt_oam(void)
{
  u8 h;
  u8 *om;

  for (h = 0; h < btl_hero_count; h++)
  {
    om = oamMemory + BT_OAM(h);
    om[0] = BT_X;
    om[1] = (u8)(BT_Y0 + ((u16)h << 5));
    om[2] = (u8)(BT_CHAR(h) - 256); /* 9th char bit rides attr bit 0 */
    om[3] = (u8)(0x30 | (h << 1) | 1); /* prio 3, OBJ palette h */
    oamSetEx(BT_OAM(h), OBJ_LARGE, OBJ_SHOW);
  }
}

void btl_update(void)
{
  u8 h;

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
    {
      bt_oam();
      bt_phase = 4;
    }
    break;
  case 4: /* C1: stand and be looked at — B leaves */
    bt_oam();
    if (padsCurrent(0) & KEY_B)
    {
      for (h = 0; h < btl_hero_count; h++)
        oamSetVisible(BT_OAM(h), OBJ_HIDE);
      stage_request_close(30, 2);
      bt_phase = 5;
    }
    break;
  default: /* 5: the internal warp restores the scene, then we are done */
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
  /* ONE 128-byte transfer per frame — a burst of four lost or shifted
     its tail when it straddled the end of the window (rows landed one
     name row off, the last one vanished; seen on VRAM dumps). Small
     single steps land whole wherever the window ends, and the whole
     party still fits inside the opening fade with room to spare. */
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
    /* MEASURED, unexplained (C1, must be revisited in C2): a transfer
       issued HERE lands exactly +256 words past its address — the
       probe above shows the computed base is right, sg_open's writes
       to the same region land right, and the bias survives burst vs
       single-step. Compensate by the measured amount. */
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
