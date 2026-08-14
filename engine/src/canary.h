/*
 * canary.h — the tcc-816 codegen canaries (K9).
 *
 * Every entry of docs/ENGINE_CONSTRAINTS.md §1 cost this project a
 * bug that compiled green and shipped wrong. Each canary replays one
 * of those patterns with inputs the compiler cannot fold away, at
 * boot, in the REAL pipeline (same 816-tcc flags, same 816-opt pass,
 * same linker) — and parks a result byte in WRAM where the savestate
 * gate reads it (tools/gate-savestate.sh, case boot). A compiler
 * update or a re-imported pattern that regresses turns the CI red
 * instead of opening a new savestate hunt.
 */
#ifndef CANARY_H
#define CANARY_H

#include <snes.h>

#define CANARY_COUNT 6
#define CANARY_MAGIC 0xC4

/* Runs every canary once and fills cn_res/cn_done (boot, before the
   main loop — a few hundred cycles, once). */
void canary_run(void);

/* Result per canary: the EXPECTED byte if the codegen is healthy —
   the gate compares against tools/savestate/check.mjs's table, which
   documents each value. cn_done = CANARY_MAGIC once the run ended. */
extern u8 cn_res[CANARY_COUNT];
extern u8 cn_done;

#endif /* CANARY_H */
