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
#define VBL_COST_VIG_ROW 4 /* ONE row of a vignette cell: 1 call +
                            128 B. Derived from the A10 measurement of
                            the whole cell (4 calls + 512 B = 14.3
                            lines average, 15 peak — PERF_MEASUREMENTS
                            §4): a quarter of it, rounded up. The cell
                            stopped being the transfer atom on H1's
                            battle screens: after the NMI, the stage
                            registers and the battle UI, the window
                            holds 6-11 real lines — a 15-line atom
                            never fits and the slot starves (measured
                            with the V counter: vig entered at line
                            250 with 9 declared left, every frame).
                            Rows fit; a cell completes over 1-4
                            VBlanks. Vignettes still do not move to
                            bursts — the row that passes is chosen
                            INSIDE the VBlank. */
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

/* The raw guard rail, for a consumer whose transfer is silently
   DROPPED outside the window (VRAM, CGRAM): vbl_probe() latches the
   current scan line into vbl_v (vbudgetfast.asm — free, unlike a C
   read). Take from the budget FIRST (the ledger keeps the sharing
   fair), then probe and refuse the transfer if the beam is past
   VBL_LAST minus its cost: the ledger can drift optimistic, the beam
   cannot (measured: it granted a cell at line 253 on battle frames —
   vignette.c tells that story). */
extern u16 vbl_v;
void vbl_probe(void);

/* 0 or 1: which of the two optional consumers goes first this frame. In
   a fixed chain the last one is the systematic sacrifice. */
u8 vbl_turn(void);

#endif /* VBUDGET_H */
