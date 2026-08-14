/*
 * vramjob.h — VRAM transfers in BATCHES.
 *
 * A dmaCopyVram call costs ~1.5 screen lines empty, against ~171 bytes
 * per line of throughput: it is the NUMBER of calls that costs, not the
 * volume. And the cost is not in the PVSnesLib routine but on the
 * CALLER side, where tcc-816 pushes five arguments one at a time — the
 * same diagnosis as the actor loop in actorsfast.asm.
 *
 * The measurements, before and after, are in docs/PERF_MEASUREMENTS.md.
 * The short version: a map column went from 22 lines to 12, an animated
 * tile step from 18 to 5, and the block peak from 32 lines to 22 on a
 * 30-line window.
 *
 * This module holds a queue of transfers, filled OUTSIDE the VBlank
 * window and drained by a SINGLE call (vram_burst, in assembly). The
 * registers that are constant across the batch — DMA mode, the $2118
 * gate, the $2115 increment — are written once; per transfer only the
 * source, size, VRAM address and the go bit remain.
 *
 * Each consumer owns a fixed SLICE of the queue: it fills it whenever it
 * likes, in its *_update, and PUBLISHES a burst descriptor to the
 * dispatcher (vblnmi.h, V-NMI V3) that fires it from the NMI ISR or
 * the VBlank tail. The batch parameters below (vj_first/vj_n/vj_vmain/
 * vj_ctrl) became the DISPATCHER'S SCRATCH: it is the only writer,
 * setting them from the descriptor just before vram_burst.
 *
 * WHAT DID NOT MOVE HERE
 * Vignettes keep dmaCopyVram: their four transfers depend on the slot
 * chosen INSIDE the VBlank — the arbiter decides who passes — so filling
 * the queue there would cost what it saves. The UI layer has a single
 * call: nothing to batch.
 */
#ifndef VRAMJOB_H
#define VRAMJOB_H

#include <snes.h>

/* $2115: VRAM address increment after the high byte. +1 word for a run
   of words, +32 words for a tilemap column. */
#define VJ_INC1 0x80
#define VJ_INC32 0x81

/* $4300/$4301: mode 1 (two registers) into the $2118 gate. */
#define VJ_CTRL_VRAM 0x1801

/* Queue slices. A map column and a map row can land on the SAME frame
   (diagonal movement, camera pan), so each has its own. */
#define VJ_MAP_COL 0   /* 8: 2 layers x 2 char columns x 2 segments */
#define VJ_MAP_ROW 8   /* 8: the same, in rows */
#define VJ_TILEANIM 16 /* 4 chars, merged into 1 to 4 transfers */
#define VJ_STAGE 20    /* 6: up to 4 composed chars + 2 map rows of a
                          laying batch (stage.c, V-NMI V4) — the chars
                          MUST precede the rows that reference them,
                          which is why the batch is one atomic burst */
#define VJ_MAX 26

/* The queue. u16 throughout, the bank included: tcc-816 wraps every
   8-bit operation in a sep/rep pair, and the assembly reads the low
   byte anyway. One byte wasted per transfer, no sep/rep. */
extern u16 vj_src[VJ_MAX];  /* low address of the source */
extern u16 vj_bank[VJ_MAX]; /* source bank (low byte) */
extern u16 vj_dst[VJ_MAX];  /* VRAM address, in WORDS */
extern u16 vj_len[VJ_MAX];  /* bytes */

/* Parameters of the batch to fire, set just before vram_burst() —
   by the DISPATCHER only since V-NMI V3 (vblnmi.c's burst kind). */
extern u16 vj_first; /* first transfer of the slice */
extern u16 vj_n;     /* how many to chain (0 does nothing) */
extern u16 vj_vmain; /* VJ_INC1 or VJ_INC32, shared by the batch */
extern u16 vj_ctrl;  /* VJ_CTRL_VRAM, shared by the batch */

/* Queues one transfer. Call it OUTSIDE the VBlank window — that is the
   whole point of the module. `dst` is a VRAM address in WORDS. */
void vj_set(u16 i, const u8 *src, u16 dst, u16 len);

/* Chains vj_n transfers starting at vj_first (vramfast.asm). */
void vram_burst(void);

#endif /* VRAMJOB_H */
