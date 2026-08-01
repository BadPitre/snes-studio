/*
 * vbudget.c — arbitrage de la fenêtre VBlank (P5). Voir vbudget.h pour
 * les mesures qui justifient ce module, et vbudgetfast.asm pour la
 * raison pour laquelle la lecture du compteur n'est pas écrite ici.
 */
#include <snes.h>
#include "vbudget.h"

static u8 vbl_rem; /* lignes restantes, tenu par soustraction */
static u8 vbl_rot; /* tourne d'une frame à l'autre */

u16 vbl_v;             /* ligne courante — écrite par vbudgetfast.asm */
extern void vbl_probe(void);

/* Ce que la sonde dit qu'il reste. Sous 200, le compteur a rebouclé :
   l'affichage a repris et la VRAM ignore en silence ce qu'on lui
   envoie — on ne renvoie jamais « il reste de la place » là. */
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
