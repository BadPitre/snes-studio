# Unifying the VBlank transfer pipeline (V-NMI)

## Why

The vignette pipeline was rebuilt during H-bugfix around three ideas —
prepare in the main loop, fire from the NMI ISR, keep a budgeted tail
fallback — and every measured failure mode disappeared: starvation on
loaded battle frames, rows dropped past the window, colours arriving
after pixels. But the fix is point-local. The other consumers still
run the pre-H1 shapes, and the inventory (August 2026) reads like a
list of the same accident waiting elsewhere:

- `stage_vblank` is NEVER metered: it runs before `vbl_open` and can
  push ~20 lines (1 KB image chunk + composed chars + map rows + WRAM
  shadow loops) on a 30-line window before anyone else is served.
- `m7`'s plane streaming (512 B) is equally uncounted — accepted with
  a comment, not a guard.
- `btlprim` declares budgets but never probes: a drifted ledger drops
  its transfers silently — the exact failure vignette.c documents for
  itself. Its digit sheet is a 1536-byte ATOM, the largest in the
  engine (~11 lines in one bite).
- `ui_screen` splits itself (good) but has no beam guard at all, and
  on a stage its ordering against vignettes had to be hand-tuned once
  already (H-bugfix moved vig ahead of ui).
- the WRAM shadow bookkeeping of stage's erase/map phases runs INSIDE
  the window — loop-heavy tcc-816 code exactly where lines are gold.

The vignette answer generalises because its three integrity rules do
not mention vignettes: a publication token written last, a staleness
check before firing, and a fire-permission flag owned by the main
loop. This chantier makes those rules the engine's transfer contract.

## The target

### One NMI dispatcher, data not callbacks

`nmiSet` has a single slot; `vig_nmi` occupies it today. A new
`vblnmi.c` owns it instead, and consumers stop owning callbacks: they
PUBLISH transfer descriptors into a small fixed table —

    src/bank, dst, len         the DMA
    vmain, ctrl                $2115 / $4300-01 (VRAM, CGRAM, m7 gate)
    cost                       declared lines, reused by the tail
    seq                        the producer's staleness counter
    token                      publication gate, written LAST; 0 = empty

No per-consumer function pointers: an indirect tcc-816 call plus its
argument pushes is the ~1.5 lines/call the whole P6 campaign was about
removing. The ISR walks the table in assembly — an extended
`vram_burst` taking per-entry `vmain`/`ctrl`, which is also the
generalisation `vramjob`'s parameter singleton already needs (its
`vj_vmain/vj_ctrl/vj_n` globals are why a map burst and a tileanim
burst cannot be prepared at the same time today).

### The three integrity rules, verbatim from vignette.c

1. `vbl_fire_ok` (renamed `vig_fire_ok`, same two write sites in
   main.c) gates the WHOLE dispatch: the ISR fires only inside the
   frame's DMA-free stretch — a DMA started mid-`dmaCopy`-setup
   corrupts both transfers (channel 0 is shared).
2. Each entry's `token` is written last by its producer and consumed
   either way by the ISR; a half-written descriptor is never fired.
3. Each entry carries the producer's `seq`, bumped on any mutation of
   the underlying state; the ISR drops stale entries silently and the
   next prep republishes.

### Bound the ISR, do not budget it

The ISR fires at ~line 227 — before the tail, and up to ~23 lines
earlier on a loaded frame. It takes NO budget and NEVER probes; its
cost is bounded instead: a hard cap of ~14-16 declared lines per NMI
(the current `n = 4` vignette rows generalised to a summed-cost cap).
`vbl_open` reads the V counter AFTER the ISR ran, so the tail's ledger
sees what the ISR spent naturally — the property m7's streaming
already relies on.

### Every consumer keeps its tail path

The ISR is a fast lane, not a replacement. Whatever the cap leaves
over is still dirty when the tail runs `vbl_take` + `vbl_probe` —
vignette's current shape (`vig_nmi` and `vig_vblank` consume the same
descriptors), which is what makes each conversion additive instead of
a rewrite. Consumers converted to the dispatcher gain the probe their
tail was missing (btlprim), and the tail keeps the roles the ISR
cannot take: registers, HDMA arming, the UI's window-driven splitter.

### Priority: fixed prefix, rotating suffix

Table order is priority. Fixed prefix for what must not starve (stage
laying, battler cells, map bursts); the `vbl_turn` rotation
generalises to a rotor over the optional band (tileanim, extra vig
rows, ui chunks). The stage lesson stays encoded as FIXED order — vig
genuinely outranks ui there, that was measured, not arbitrary.

### Two hazards new relative to vignette

- WRAM sources (`ui_map`, map strips, `up_buf`, `cp_buf`): vignette
  never hit this because `pr_src` is ROM. On a LAG frame the NMI
  callback still runs (the OAM DMA is skipped, not the callback) while
  a main-loop writer may be mid-buffer. Rule: the token is published
  only when the buffer is complete, and cleared at the first byte of
  any rewrite (`ui_mark` becomes the clearing site for the UI).
- CGRAM before VRAM: pixels must never beat colours (the H-bugfix
  palette gate). Any consumer with separate char and palette
  descriptors keeps its `bp_have`/`dig_up`-style guard.

## What stays in the tail, deliberately

Registers and HDMA arming: screenfx, effect/picture scrolls, stage's
two `bgSetScroll`, hdmafx, m7's matrix/perspective and its `$420C`
composition (ordered after `hdmafx_suspend` — ownership rules
unchanged). Screen-off one-shots (warp loaders, m7 open, picture
show/hide) are untouched: they run with `vbl_fire_ok == 0` exactly as
today. Channel 7 stays PVSnesLib's (OAM DMA); channels 1-6 keep their
HDMA owners.

## The crans

Each cran lands alone, behind the full verification loop: pixel
regression 3/3, savestate gate (battle + boot + canaries), and a
V-counter measurement session recorded in PERF_MEASUREMENTS.md —
the numbers, not the feeling, decide whether a cran regressed.

- **V1 — the dispatcher.** `vblnmi.c/h` + the extended burst in
  `vramfast.asm`; vignette converted to publish descriptors instead
  of owning the slot. No behaviour change expected: the same rows
  fire at the same time. Proves the frame under the existing gates.
- **V2 — btlprim.** Cell rows and palettes published (prep already
  lives in `btlprim_update`); the 1536-byte digit sheet split into
  three 512-byte descriptors with a cursor (the vig cell→row lesson).
  Battler cells stop being the last-served consumer of the most
  loaded branch; the tail gains the missing probe. The savestate
  battle case is the direct witness.
- **V3 — vramjob per-slice parameters.** `vj_vmain/vj_ctrl/vj_n`
  become per-slice; map bursts and tileanim publish (their plans are
  already built outside — the pending flags are already tokens).
  Unblocks V6.
- **V4 — stage.** The WRAM shadow bookkeeping of erase/map phases
  moves into `stage_update`; chars/palette/map phases publish with
  the composed-chars-before-map-rows ordering kept INSIDE one batch
  (never split across NMIs). `stage_vblank` shrinks to registers +
  fire, and the stage branch finally runs metered.
- **V5 — ui_screen.** A fixed-chunk ISR lane (4 rows = 256 B) with
  the WRAM publication discipline (`ui_mark` clears the token); the
  window-driven splitter stays as the tail path — a text row landing
  one frame late is invisible, so this consumer wants both lanes.
- **V6 — m7 plane streaming.** The four strips publish through the
  generalised burst (`dmap`/`bbad` per entry); the last unmetered
  transfer path disappears.

V1+V2 are the value; V3-V6 spread the contract. Stopping after any
cran leaves the engine consistent — no cran depends on a later one
except V6 on V3.

## Risks

- Channel-0 reentrancy is THE risk; it is contained by the same
  `vbl_fire_ok` discipline already proven by a full battler campaign,
  and the flag's write sites do not move.
- The ISR cap trades latency for determinism: a very loaded frame
  completes big payloads over 2-3 VBlanks — the accepted behaviour
  everywhere since H-bugfix (invisible at animation speeds).
- tcc-816 in the ISR stays minimal: the walk-and-fire loop is
  assembly; C only publishes. The canaries (K9) guard the patterns
  the descriptors' producers use.
- Measurement is part of every cran: the arbiter's own history says
  optimistic accounting WORSE than none is a real outcome — each cran
  re-runs the V-counter session before landing.
