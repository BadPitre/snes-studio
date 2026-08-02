# Performance measurements

The engine's performance record. Every number here was measured on the
emulator with the scanline counter; nothing is estimated unless it says
so. Keep it that way — the one entry that was *not* measured on a scene
that exercised it turned out to be wrong by a factor of two (§4).

---

## 1. Method

The PPU latches the current scanline on demand:

| Register | Use |
|---|---|
| `$2137` | latch H and V |
| `$213F` | reset the high/low toggle |
| `$213D` | OPVCT, low byte then high byte (bit 0 only — 261 max) |

Deltas are taken modulo **262**.

Three rules, each learned the hard way:

- **Take a windowed mean, never a max over all frames.** One warm-up
  frame or one scene load poisons a max forever.
- **A V-counter read written in C costs ~2 screen lines** — 7 % of the
  window. Probes that measure a 30-line budget must be in assembly, or
  they change what they measure. The first VBlank arbiter placed two C
  reads per frame and came out *worse* than no arbiter at all: 34 lines
  peak against 29, and five overrunning frames out of 128 where there had
  been none.
- **Always A/B with identical instrumentation.** Absolute numbers from an
  instrumented build are inflated; only the difference is meaningful.

Tooling: `tools/regress/harness.c` runs the ROM headless for a fixed
number of frames with a fixed input sequence, and `WRAM_DUMP=` dumps
memory at the last frame. Cross it with `engine/snesstudio.sym`.

---

## 2. The VBlank window

| | |
|---|---|
| VBlank starts | line 225 |
| Block entry, measured | line **230** — deterministic |
| Usable window | **30 lines** |

The five missing lines are PVSnesLib's NMI handler: OAM DMA and
controller reads. Budget against 30, not 38.

---

## 3. DMA cost

| | |
|---|---|
| One `dmaCopyVram` call, empty | **~1.5 lines** |
| Throughput | **~171 bytes/line** |

A 32-byte transfer pays six times more setup than payload. **It is the
number of calls that costs, not the volume** — a byte budget would
measure the wrong thing.

And the cost is not in PVSnesLib's routine (about thirty instructions):
it is on the **caller** side, where tcc-816 pushes five arguments one at
a time. Same diagnosis as the actor loop in §5.

---

## 4. Per-consumer cost of the VBlank block

Measured on a 48×40 map that streams on both axes, 497 frames retained
after warm-up.

| Consumer | Before P6 | After P6 |
|---|---|---|
| registers (scroll / tint / HDMA) | 7 | 7 |
| map column (8 transfers, 512 B) | **22** | **12** |
| animated-tile step (4 transfers, 128 B) | **18** | **5** |
| `ui_screen` | 1 … 16 depending on dirty rows | unchanged |
| vignette cell | 12 (modelled, not measured) | unchanged |
| **block peak** | **32** | **22** |
| latest end | 259/262 | 252/262 |
| overrunning frames | 8/497 | **0/497** |

### The error worth remembering

P5 declared a map half at **10 lines**. It costs **22**. The cause is
instructive: the showcase's `plaine` is 22×16 metatiles, it fits entirely
inside the 32×32 window and **never streams a single column**. P5 had
measured map streaming on a scene that did not trigger it.

The lesson is not "be careful". It is: *before trusting a number, check
that the scene you measured actually exercises the thing you measured.*

---

## 5. Actor draw loop (P4)

Cost of `actors_draw()` alone, windowed mean over 128 frames after
warm-up:

| Visible NPCs | 8 | 16 | 24 |
|---|---|---|---|
| C (tcc-816) | 86 | 166 | 245 |
| assembly, long addressing | 28 | 51 | 95 |
| assembly, direct page | 26 | 47 | 90 |

Screen lines. 2.7× faster than the C.

Two honest notes:

- Direct page buys only **5–7 %** of that. It had been announced as *the*
  missing factor; that was wrong. Almost all the gain comes from removing
  the `sep`/`rep` pairs and the long-address recomputation per array
  access.
- At 16 and 24 NPCs the C version only completes 370 loops out of 900
  frames — it runs at 30 Hz. The two versions are not simulating the same
  thing at that point; only the cost of `actors_draw()` compares, not the
  rendering.

---

## 6. What is still not measured

Stated so nobody mistakes silence for zero:

- `VBL_COST_VIG` (12) is **modelled** from 4 calls + 512 bytes. No
  project in the repo has a vignette animation running during a
  measurement.
- `stage_vblank` and the NMI handler are **not metered** by the arbiter.
  They run before the budget opens.
- The register block costs 7 lines for a handful of register writes. Not
  investigated; it is the largest unexplained item left in the window.
