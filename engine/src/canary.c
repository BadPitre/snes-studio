/*
 * canary.c — the tcc-816 codegen canaries (K9). See canary.h; the
 * patterns and their war stories live in docs/ENGINE_CONSTRAINTS.md §1.
 *
 * Rules of the aviary:
 *  - every input comes from a volatile static, so neither 816-tcc nor
 *    816-opt can fold a canary into its answer at compile time;
 *  - every canary reduces to ONE byte whose healthy value is written
 *    in tools/savestate/check.mjs next to the pitfall it guards;
 *  - the code deliberately KEEPS the shapes the constraints page bans
 *    (that is the point) — do not "fix" a canary to follow the rules
 *    it is testing.
 */
#include <snes.h>
#include "canary.h"

u8 cn_res[CANARY_COUNT] = { 0, 0, 0, 0, 0, 0 };
u8 cn_done = 0;

/* Fold-proof inputs. Volatile: a plain static initialised to a
   constant is honest prey for a smarter 816-opt someday. */
static volatile u8 cn_two = 2;
static volatile u8 cn_zero = 0;
static volatile u8 cn_a = 0xAA;
static volatile u8 cn_b = 0xCC;

/* Pitfall 1.6 — a (u8, u16) parameter pair got corrupted on the
   software stack (timer_set received 90 as ~556). */
static u8 cn_p8 = 0;
static u16 cn_p16 = 0;

/* Pitfall 1.2's positive half: .data must be loaded (file scope — a
   block-local static would test a second, unrelated shape). */
static u8 cn_tab[4] = { 3, 5, 7, 11 };
static void cn_pair(u8 kind, u16 secs)
{
  cn_p8 = kind;
  cn_p16 = secs;
}

void canary_run(void)
{
  u8 v, s, n;
  u16 w;

  /* 0 — VARIABLE shifts (compiled into loops: slow but must stay
     CORRECT; the fast paths use tables instead — vig_bit, sg_bit). */
  v = 0;
  for (s = 0; s < 8; s++)
    v |= (u8)(1 << s); /* 0xFF */
  v ^= (u8)(0xF0 >> cn_two); /* ^ 0x3C */
  cn_res[0] = v; /* healthy: 0xC3 */

  /* 1 — variable shifts chained with || (the bp_oam ghost battlers:
     the natural !((a>>h)&1) || !((b>>h)&1) took the wrong branch with
     both masks at zero — btlprim.c tells the story). Counts the h
     where either mask bit is clear: correct C says 6 (both bits set
     only at h = 3 and 7). The CURRENT tcc-816 says 2 — this canary
     took the live miscompilation on its FIRST flight, which is why
     the pinned value is the BUG's: it detects the compiler CHANGING,
     in either direction. If this ever reads 6, the bug is fixed and
     every nested-if workaround (ENGINE_CONSTRAINTS §1.11) can be
     re-audited; any other value is a new break. */
  n = 0;
  for (s = 0; s < 8; s++)
    if (!((cn_a >> s) & 1) || !((cn_b >> s) & 1))
      n++;
  cn_res[1] = n; /* pinned: 2 (the known miscompilation; correct C: 6) */

  /* 2 — a variable DECLARED inside a case block (the phantom-hearts
     bug, pitfall 1.1). The one place in the engine allowed to keep
     this shape. */
  switch (cn_two)
  {
  case 2:
  {
    u8 st = (u8)(cn_a + 1);
    v = st;
    break;
  }
  default:
    v = 0xEE;
    break;
  }
  cn_res[2] = v; /* healthy: 0xAB */

  /* 3 — a ?: inside a compound shift expression (the macro form of
     the vignette bases lost its final << 4 and sent every slot 4-7
     cell to chars 28-31 — vignette.c, the reason those bases are
     tables). */
  w = (u16)(((cn_two ? 24 : 28) + cn_zero) << 4);
  cn_res[3] = (u8)(w >> 2); /* healthy: 96 (384 >> 2) */

  /* 4 — the (u8, u16) parameter pair of pitfall 1.6. */
  cn_pair((u8)(cn_two + 1), 900);
  cn_res[4] = (u8)(cn_p8 + (cn_p16 >> 8)); /* healthy: 3 + 3 = 6 */

  /* 5 — initialised statics actually LOADED (the positive half of
     pitfall 1.2: .bss is garbage, .data must not be), read back
     through a VARIABLE index on top. */
  cn_res[5] = (u8)(cn_tab[0] + cn_tab[1] + cn_tab[3]
                   + cn_tab[cn_two]); /* healthy: 3+5+11+7 = 26 */

  cn_done = CANARY_MAGIC;
}
