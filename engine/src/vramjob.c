/*
 * vramjob.c — the VRAM transfer queue. See vramjob.h for why it exists
 * and vramfast.asm for how it is drained.
 */
#include <snes.h>
#include "vramjob.h"

/* The four arrays are deliberately left uninitialised: tcc-816 does not
   clear .bss, but no slot is ever read before vj_set has written it. The
   scalars below DO need an explicit zero — vram_burst reads vj_n on the
   very first frame. */
u16 vj_src[VJ_MAX];
u16 vj_bank[VJ_MAX];
u16 vj_dst[VJ_MAX];
u16 vj_len[VJ_MAX];
u16 vj_first = 0;
u16 vj_n = 0;
u16 vj_vmain = VJ_INC1;
u16 vj_ctrl = VJ_CTRL_VRAM;

/* vj_set() lives in vramfast.asm because a DMA needs its source BANK
   and C cannot give it: `(u32)p` keeps only the low 16 bits and sign
   extends. See docs/ENGINE_CONSTRAINTS.md §1.3 — it cost us a screen
   full of black tiles. */
