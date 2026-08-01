/*
 * vramjob.c — la file de transferts VRAM (P6). Voir vramjob.h pour les
 * mesures qui justifient le module, et vramfast.asm pour le vidage.
 */
#include <snes.h>
#include "vramjob.h"

/* init explicite : tcc-816 ne remet pas le BSS a zero */
u16 vj_src[VJ_MAX];
u16 vj_bank[VJ_MAX];
u16 vj_dst[VJ_MAX];
u16 vj_len[VJ_MAX];
u16 vj_first = 0;
u16 vj_n = 0;
u16 vj_vmain = VJ_INC1;
u16 vj_ctrl = VJ_CTRL_VRAM;

/* vj_set() est en ASSEMBLEUR (vramfast.asm), et ce n'est pas un caprice.
   Un DMA a besoin de la BANQUE de sa source. En C, il n'y a aucun moyen
   de l'obtenir : tcc-816 passe bien un pointeur sur 4 octets (banque
   comprise) quand on le donne a une fonction, mais `(u32)p` ne garde
   que les 16 bits bas et ETEND LE SIGNE. Mesure a l'appui — la table
   sortait des banques $00 pour un tampon WRAM et $FF pour un charset
   ROM, sur des adresses respectivement positive et negative en 16 bits
   signes. Les tiles animees s'affichaient en noir.

   L'assembleur lit les quatre octets du pointeur la ou l'appelant les a
   poses, exactement comme dmaCopyVram de PVSnesLib. */
