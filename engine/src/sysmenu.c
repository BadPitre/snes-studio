/*
 * sysmenu.c — the System menu (START): save and load, RM2003 style.
 *
 * UI: the textbox and its choice cursor (textbox_choices_raw). The
 * labels are ENGINE VOCABULARY (constants, like RM2003's built-in menu
 * — spec §5), not game data.
 */
#include <snes.h>
#include "formats.h"
#include "textbox.h"
#include "save.h"
#include "sysmenu.h"

#define SM_OFF 0
#define SM_MAIN 1  /* Save / Load / Close */
#define SM_SAVE 2  /* slot choice (writing) */
#define SM_LOAD 3  /* slot choice (reading) */
#define SM_DONE 4  /* confirmation message, A closes */

static u8 sm_state;
static u8 sm_sel;
static u8 sm_load_pending; /* the destination stays in save_info */

static const char *const sm_main[3] = {"Sauvegarder", "Charger", "Fermer"};

/* Slot labels rebuilt on opening ("Slot 1: empty" / "OK") */
static char sm_slots[SAVE_SLOTS][16];
static const char *sm_slot_ptrs[SAVE_SLOTS];

static void sm_build_slots(void)
{
  u8 i, j;
  static const char base[] = "Slot   : ";

  for (i = 0; i < SAVE_SLOTS; i++)
  {
    for (j = 0; base[j]; j++)
      sm_slots[i][j] = base[j];
    sm_slots[i][5] = (char)('1' + i);
    if (save_exists(i))
    {
      sm_slots[i][9] = 'O';
      sm_slots[i][10] = 'K';
      sm_slots[i][11] = 0;
    }
    else
    {
      sm_slots[i][9] = 'v';
      sm_slots[i][10] = 'i';
      sm_slots[i][11] = 'd';
      sm_slots[i][12] = 'e';
      sm_slots[i][13] = 0;
    }
    sm_slot_ptrs[i] = sm_slots[i];
  }
}

void sysmenu_init(void)
{
  sm_state = SM_OFF;
  sm_sel = 0;
  sm_load_pending = 0;
}

u8 sysmenu_active(void)
{
  return sm_state != SM_OFF;
}

void sysmenu_open(void)
{
  sm_state = SM_MAIN;
  sm_sel = 0;
  sm_load_pending = 0;
  textbox_choices_raw(sm_main, 3, 0);
}

u8 sysmenu_take_load(void)
{
  if (!sm_load_pending)
    return 0;
  sm_load_pending = 0;
  return 1;
}

static void sm_close(void)
{
  sm_state = SM_OFF;
  textbox_close();
}

void sysmenu_update(void)
{
  u16 down = padsDown(0);
  u8 count;

  if (sm_state == SM_DONE)
  {
    if (down & (KEY_A | KEY_B))
      sm_close();
    return;
  }

  count = (sm_state == SM_MAIN) ? 3 : SAVE_SLOTS;

  if ((down & KEY_UP) && sm_sel > 0)
  {
    sm_sel--;
    textbox_choice_cursor(sm_sel);
    return;
  }
  if ((down & KEY_DOWN) && (u8)(sm_sel + 1) < count)
  {
    sm_sel++;
    textbox_choice_cursor(sm_sel);
    return;
  }
  if (down & KEY_B) /* back / close */
  {
    if (sm_state == SM_MAIN)
      sm_close();
    else
    {
      sm_state = SM_MAIN;
      sm_sel = 0;
      textbox_choices_raw(sm_main, 3, 0);
    }
    return;
  }
  if (!(down & KEY_A))
    return;

  if (sm_state == SM_MAIN)
  {
    if (sm_sel == 0 || sm_sel == 1)
    {
      sm_state = (sm_sel == 0) ? SM_SAVE : SM_LOAD;
      sm_sel = 0;
      sm_build_slots();
      textbox_choices_raw(sm_slot_ptrs, SAVE_SLOTS, 0);
    }
    else
      sm_close();
    return;
  }

  if (sm_state == SM_SAVE)
  {
    save_write(sm_sel);
    sm_state = SM_DONE;
    /* immediate read back: catches missing or failing SRAM */
    if (save_exists(sm_sel))
      textbox_open_raw("Partie sauvegardee !");
    else
      textbox_open_raw("Erreur : SRAM indisponible ?");
    return;
  }

  /* SM_LOAD */
  if (save_read(sm_sel))
  {
    sm_load_pending = 1;
    sm_close();
  }
  else
  {
    sm_state = SM_DONE;
    textbox_open_raw("Ce slot est vide.");
  }
}
