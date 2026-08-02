/*
 * vbudget.h — arbitrating the VBlank window.
 *
 * The window is 30 usable lines, and the block used to fill them by
 * chance rather than by design. This module keeps a remainder, in lines:
 * ONE read of the V counter per frame, placed after the work that is not
 * accounted for, and pure subtraction after that.
 *
 * The measurements behind every number here — window size, per-consumer
 * costs, why a C-written counter read is too expensive to use — are in
 * docs/PERF_MEASUREMENTS.md. Two things worth knowing at the call site:
 *
 *  - The read goes through vbudgetfast.asm. The same read in C costs
 *    ~2 lines, 7 % of the window. The first version of this module did
 *    exactly that and came out WORSE than no arbiter at all.
 *  - A version without any counter read was tried too: free, but blind
 *    to anything undeclared, and it overran as often as no arbiter under
 *    six unaccounted transfers. The read was needed; it had to be free.
 *
 * REGISTER writes (scroll, brightness, tint, HDMA) do not go through
 * here and happen FIRST. They are mandatory — an unwritten scroll makes
 * the screen jump a tile — and must never be the victim of a short
 * window.
 */
#ifndef VBUDGET_H
#define VBUDGET_H

#include <snes.h>

/* Last line on which a transfer may still finish. Display resumes at 0;
   the margin covers the imprecision of the declared costs, which are
   rounded peaks and not per-frame measurements. */
#define VBL_LAST 256

/* Declared costs, in screen lines: the measured PEAK, never the average.
   A consumer that declares its average overruns on its bad frames.

   A BURST of grouped transfers (vramjob.h): a fixed setup for the batch,
   a small one per transfer, plus the throughput. */
#define VBL_COST_BURST(n, bytes) ((u8)(2 + (n) + ((bytes) >> 7)))
#define VBL_COST_MAPHALF(n) VBL_COST_BURST(n, (u16)(n) << 6)
#define VBL_COST_VIG 15 /* MEASURED (A10): one cell, 4 calls + 512 B,
                            costs 14.3 lines on average and 15 at the
                            peak — the model said 12 and under-declared
                            by a fifth. Measured on a project built for
                            it (a looping animation, one frame per cell)
                            since none in the repo animates a vignette;
                            see PERF_MEASUREMENTS.md §4.
                            Vignettes did not move to bursts — the slot
                            that passes is chosen INSIDE the VBlank. */
#define VBL_COST_UI(rows) ((u8)(2 + ((rows) >> 1))) /* 1 call + rows*64 B */
/* How many UI rows fit in `lines` lines — the inverse. */
#define VBL_UI_ROWS(lines) ((u8)((lines) <= 2 ? 0 : ((lines) - 2) << 1))

/* Opens the budget: reads the counter, anchors the remainder, rotates
   the priority of the optional consumers. Place it AFTER the branch's
   unaccounted work (register writes, composed-screen posing) and BEFORE
   the first negotiable transfer — once per frame, since the read is not
   quite free even in assembly. */
void vbl_open(void);

/* Reserves `lines` lines. 0 means no room: give up, leave the data
   dirty, it will come back next frame. */
u8 vbl_take(u8 lines);

/* What is left, without reserving anything — for a consumer that SPLITS
   itself instead of giving up (the UI layer). */
u8 vbl_left(void);

/* 0 or 1: which of the two optional consumers goes first this frame. In
   a fixed chain the last one is the systematic sacrifice. */
u8 vbl_turn(void);

#endif /* VBUDGET_H */
