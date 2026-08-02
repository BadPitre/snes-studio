/*
 * vbudget.c — the VBlank window arbiter. See vbudget.h for the design
 * and vbudgetfast.asm for why the counter read is not written here.
 */
#include <snes.h>
#include "vbudget.h"

static u8 vbl_rem; /* lines left, kept by subtraction */
static u8 vbl_rot; /* rotates from one frame to the next */

u16 vbl_v;             /* current line, written by vbudgetfast.asm */
extern void vbl_probe(void);

/* What the probe says is left. Below 200 the counter has wrapped:
   display has resumed and VRAM silently ignores what we send it, so we
   never report room there. */
static u8 vbl_read(void)
{
  vbl_probe();
  if (vbl_v < 200 || vbl_v >= VBL_LAST)
    return 0;
  return (u8)(VBL_LAST - vbl_v);
}

void vbl_open(void)
{
  vbl_rem = vbl_read();
  vbl_rot++;
}


u8 vbl_take(u8 lines)
{
  if (vbl_rem < lines)
    return 0;
  vbl_rem -= lines;
  return 1;
}

u8 vbl_left(void)
{
  return vbl_rem;
}

u8 vbl_turn(void)
{
  return (u8)(vbl_rot & 1);
}
