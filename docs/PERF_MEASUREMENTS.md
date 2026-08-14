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
| vignette cell | 12 (modelled) → **15 (measured, A10)** | unchanged |
| **block peak** | **32** | **22** |
| latest end | 259/262 | 252/262 |
| overrunning frames | 8/497 | **0/497** |

### 4b. The two numbers A10 owed (measured)

The line above and the register block were both carried as debts. Both
are now measured on the demo's 48×40 `plaine` (which really does stream),
with a probe placed between each call of the block. The probe is the
assembly one (`vbudgetfast.asm`), and a **null segment — two probes back
to back — measures 0.00 lines over 400 frames**, so the instrument does
not disturb what it measures. Each figure carries ±1 line of quantisation
(the counter reads whole lines and these segments are 1 to 5 lines), so
the same code read twice gives 1 or 3; the sums are stable.

| segment | mean | peak |
|---|---|---|
| null segment (the probe itself) | **0.00** | 0 |
| `screenfx_vblank` | 1–3 | 4 |
| `bgSetScroll` ×2 | **4–5** | 5 |
| `hdmafx_vblank` | 3 | 3 |
| **the "register block"** | **9–10** | |
| `vbl_open` (the arbiter itself) | 3 | 3 |
| `map_vblank` + `ui_screen_vblank` | 2–3 | 3 |
| `tileanim_vblank` | 1–2 | 6 |
| ONE vignette cell (4 calls, 512 B) | **14.3** | **15** |

Two things fall out.

**The register block is the two scrolls.** `bgSetScroll` costs ~2 to 2.5
lines A CALL, for four register writes — the largest single item in a
block that does almost nothing. Same diagnosis as §3 and §5: it is the
caller pushing three arguments under tcc-816, not the work. It is no
longer unexplained; it is merely not yet fixed, and the fix is the same
one P6 applied to the transfers (write the registers directly).

**`VBL_COST_VIG` was under-declared by a fifth**: 12 announced, 14.3
average and 15 at the peak. Corrected to 15 in `vbudget.h`. Measuring it
needed a project built for the purpose — a looping animation with one
frame per cell, so a cell moves EVERY frame — because §4's own lesson
applies: no project in the repo animates a vignette, so no measurement
here had ever exercised the thing being measured.

A third fact, free with the setup: with three vignette slots animating at
one frame per cell, `vig_vblank` alone wants ~43 lines and the whole
block ~78 against a window of ~37. The arbiter does its job (it refuses
what does not fit and the cell comes back next frame), but a project that
animates four vignette layers at full speed is asking for two frames of
work per frame, and it will run at 30 fps. That is a data limit worth
telling an author about, not an engine bug.

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

## 6. Mode 7 sprite transform (M7-0 spike)

On a Mode 7 plane a sprite's screen position is no longer a subtraction:
the plane rotates and scales under it, so the matrix has to be applied
per sprite. The SNES's signed 16x8 multiplier is available for that — but
its operands ARE `M7A`/`M7B`, the scale matrix the PPU reads while
rendering, so the maths can only run inside the VBlank.

Sixteen sprites, four multiplies each (the full matrix, rotation
included), written in C, measured at frame 210 of the spike ROM:

| | Lines |
|---|---|
| Raw delta, 232 → 15 (mod 262) | 45 |
| Less the two C-written V-counter reads (§1) | ~41 |
| **VBlank window available** | **37** |

The C loop **overruns the VBlank**. That was the finding, and for a loop
that uses the PPU multiplier it still holds.

### 6b. What the shipped loop actually does — and why the VBlank was the wrong window

The spike's premise was that the transform MUST run inside the VBlank,
because the multiplier's operands are `M7A`/`M7B`. That premise only
binds if you use the PPU multiplier. `m7_project` (A3) does the
arithmetic in software instead — tcc-816's own multiply and divide — so
it touches nothing the PPU reads, and it runs in the MAIN LOOP where the
budget is a whole frame rather than 37 lines.

Measured on a world map with 24 NPCs all on screen, sweeping how many are
projected per frame:

| projected per frame | loop turns in 900 frames | cost |
|---|---|---|
| 0 | 498 (60 fps) | 2 lines |
| 1 | 498 (60 fps) | 34 lines |
| **3** | **498 (60 fps)** | **98 lines** |
| 4 | 272 (30 fps) | 131 lines |
| 6 | 249 (30 fps) | 194 lines |

**~32 screen lines per NPC**, of which ~19 are the arithmetic (the same
loop with the projection stubbed out costs ~13 lines per NPC) — the two
divisions. Software arithmetic is far more expensive per operation than
the PPU multiplier would be, but it buys a window three times larger, and
three NPCs a frame is what fits there.

So the debt §7 carried — "the assembly figure is an extrapolation" — is
settled by not needing the figure: the shipped loop is C, outside the
VBlank, and its cost is measured rather than extrapolated. An assembly
version would still be worth roughly 2.7× if a world map ever needs more
than three moving characters at once.

Design consequences are in `PLANNING_SYSTEME_MODE7.md` §7.2 and §7.2h.

---

## 7. What is still not measured

Stated so nobody mistakes silence for zero:

- `stage_vblank` and the NMI handler are **not metered** by the arbiter.
  They run before the budget opens.
- `vbl_open` itself costs 3 lines (§4b) and is not charged to anyone.
- The Mode 7 sprite transform **in assembly**. The shipped loop is C and
  measured (§6b); the assembly version was never written, and the 2.7×
  it would probably be worth is still §5's ratio, not a measurement.
- Nothing in §6 has run on hardware — emulator (snes9x libretro) only.

Settled since this list was written: `VBL_COST_VIG` (§4b, measured at 15
and corrected) and the register block (§4b — it is the two `bgSetScroll`
calls, ~2.5 lines each, caller-side argument pushing).

---

## 8. V-NMI dispatcher sessions (V1, V2)

Hooks: `vn_v_last` / `vn_v_max` in `vblnmi.c` — the beam right after
the ISR lane's last fire (a `vbl_probe` at the end of `vbl_nmi`), and
the highest such reading since boot. Both readable from a savestate or
a WRAM dump through the `.sym`. All numbers below are snes9x libretro,
NTSC timing (VBlank lines ~225-261, `VBL_LAST` guard at 256).

### V1 (vignette on the dispatcher)

Scratch scene, one 16x16 vignette looping at speed 5 plus one 64x64
(8 rows of cost 6 — always split across NMIs by the cap of 16):
`vn_v_last = 246` at frame 240, screen on, fires every few frames all
run long. Entry ~227 plus a capped fire session lands the beam where
the design's arithmetic said it would. The 64x64 cell was delivered
byte-exact — the descriptor resume across 3+ NMIs works under load.

### V2 (btlprim on the dispatcher)

Derived gobelin battle, one commanded attack (A at the menu, A on the
target), 2400 frames: battler cells, the attack's vignette animation
and the digit sheet (3 x 512 B, cost 10 each) all land byte-exact
(`btl_digit_cells` compared against VRAM whole). The tail's palettes
follow and `dig_up`/`bp_have` gate display, so colours still never
trail pixels on screen.

`vn_v_max = 258` — recorded during the battle OPENING (already at 258
by frame 600, before any input; the demo map route never fires the
ISR at all and reads 0). The opening lays the stage behind a wipe:
fires there run with the screen dark, where the beam guard is
meaningless and past-`VBL_LAST` readings are expected. 258 < 261
either way — nothing was ever cut, and every delivery this session
checks byte-exact.

### Open for the next session (V3)

- `vn_v_last` stuck at 258 through the whole battle suggests the
  mid-battle fires either also end there (entry later than the ~227
  assumption on loaded frames?) or mostly drain through the TAIL lane
  (published after the frame's NMI already ran). Distinguishing needs
  an entry-line hook (`vbl_probe` at `vbl_nmi` entry into a `vn_v_in`)
  — one more u16, worth adding WITH the V3 work, not blind.
- The ISR cap (16 declared) has never been observed to push a
  screen-on fire past 250; the 2x margin to hardware VBlank end only
  matters if entry drifts. Same hook answers it.

### V3 (vramjob bursts on the dispatcher)

The map column/row bursts and the animated-tile step publish burst
descriptors (the vj_* globals became the dispatcher's scratch), and
the ISR gained the entry hook §8 asked for (`vn_v_in`).

Demo walk, 80 frames of continuous col+row streaming:

- `vn_v_in = 229` — the ISR enters at ~line 229 on scene frames: the
  design's ~227 assumption holds (+2 lines of NMI prologue).
- `vn_v_last = 242`, `vn_v_max = 243` — a full map column burst
  (declared 14) runs 229→242 = 13 real lines. The declared scale is
  honest, and the beam never came within 13 lines of `VBL_LAST` all
  walk long. The battle case's 258 (§8) is therefore the forced-blank
  opening, not a late entry — V4's session should still instrument
  the stage branch to close the question on that branch's frames.

Cost of the wider table: the ISR walks 5 slots and probes at entry
every NMI. On the demo's saturated dialogue frames that flipped ONE
lag frame over the 460-frame pixel-regression run — measured exactly
(the V3 run at frame N+1 is byte-identical to the old references at
frame N, both cases), so the references were re-blessed one frame
later with the content unchanged. The same boundary will keep
flipping on any future change of these frames' cost; content
byte-identity is the test that matters.

### The choreography lag session (V-NMI follow-up)

Bertrand's report — gauges jumping, the damage popup rising in
stutters — measured with the popup itself as the clock: pop_t ticks
once per main-loop iteration, so the 48-tick popup lifetime in
emulated VBlanks gives VBlanks-per-iteration on identical logical
content across builds. Derived gobelin battle, first attack:

    main        ~78 VBlanks   1.73 VBl/iter
    V-NMI V1    ~78           1.73   (parity)
    V-NMI V2    ~95           2.0    (+20% — Bertrand's regression)
    tip + fix   ~82           1.74   (parity recovered)

Two lessons. First: the battle choreography was NEVER 60 fps — 1.73
means most iterations already take two VBlanks on main; the fluid
battle is a future chantier (the anim/VM/widget main-loop cost, not
the transfer pipeline). Second: those iterations sit ON the
whole-VBlank boundary, so ~600 idle cycles of V2 bookkeeping
(bp_prep's walk, the ISR's unconditional entry probe) flipped most
of them from just-under to just-over — the d340 lesson again, in
battle. The cure that recovered parity: IDLE FAST PATHS — bp_prep,
btlprim_vblank, the vignette producer and the ISR walk all exit on
a couple of compares when nothing is queued, in flight or wanted;
the entry probe became lazy (paid only when a fire happens). The
boundary sensitivity itself remains until the choreography frames
get genuinely cheaper.
