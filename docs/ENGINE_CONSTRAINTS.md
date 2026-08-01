# Platform and toolchain constraints

Everything on this page cost us a bug. Each entry states the rule, then
the symptom that revealed it — because a rule without its symptom gets
quietly dropped the first time someone finds it inconvenient.

Read this before writing engine code. Most of these are silent: the C is
legal, the build is green, and the output is wrong.

---

## 1. tcc-816 code generation

The engine is compiled by `816-tcc`, a small C compiler. It is correct
often enough to be trusted and wrong often enough to be dangerous.

### 1.1 Declaring a variable inside a `case` block corrupts the output

```c
switch (op) {
  case OP_FOO: {
    u8 st = fetch8();   /* NO */
    ...
  }
}
```

Perfectly legal C. The generated code is wrong. This is the bug that
produced the *phantom hearts*: a row of HUD hearts drawn from garbage,
with no diff in the source that could explain it. Declare every local at
the top of the function and reuse temporaries.

Caught by the pixel regression, not by review.

### 1.2 `.bss` is not zeroed

A global or static without an initializer keeps whatever the RAM held —
in practice the `0x55` fill pattern. Every module state variable needs an
explicit `= 0`.

```c
static u8 ta_n = 0;   /* explicit init: tcc-816 does not clear .bss */
```

### 1.3 `(u32)pointer` keeps 16 bits and sign-extends

The bank is not recoverable from a pointer in C. tcc-816 does pass a full
4-byte pointer when you hand one to a function, but a cast to `u32` keeps
only the low 16 bits and sign-extends them.

Measured: a WRAM buffer at `$7E:400E` came out as bank `$00`, a ROM
charset at `$8x:AF7B` as bank `$FF` — respectively positive and negative
as signed 16-bit. The animated tiles rendered black.

If you need a source bank for a DMA, read the four pointer bytes off the
stack in assembly, the way `dmaCopyVram` does. See `engine/src/vramfast.asm`.

### 1.4 `(u32)bank << 16` miscompiles when `bank` is a variable

Build far pointers byte by byte in their memory representation
(`[addr lo][addr hi][bank][0]`). See `make_far()` in `rom_layout.h`.

### 1.5 Indexing a far array symbol directly miscompiles

Symptom: `FISHY length <> PTR_SIZE` from the assembler, or silent
garbage. Indexing a pointer *received as a function argument* is
reliable, so pass the table in:

```c
void map_set_metatiles(const u16 *table, const u8 *prio);
```

### 1.6 A `(u8, u16)` parameter pair gets corrupted

`timer_set(u8 kind, u16 secs)` received `90` as `~556`. Same family as
the multi-pointer problem. Use a single argument, or make every parameter
`u16`.

### 1.7 Several pointer parameters are fragile

`sysmenu.h` and `save.h` both note it. Prefer a module-global struct over
passing three pointers.

### 1.8 A `(void)`-cast volatile read is dropped

The read never happens. If you need the side effect of reading a
register, assign it to a real variable.

### 1.9 What is merely expensive, not wrong

These do not break the build, they eat the frame. They are the reason
`actorsfast.asm`, `vbudgetfast.asm` and `vramfast.asm` exist.

| Construct | Cost |
|---|---|
| any 8-bit operation | a `sep`/`rep` pair around it |
| one array element access | a long indirect, ~11 instructions |
| `switch` | a linear if-else chain, not a jump table |
| each function argument | pushed one at a time from the software stack |
| multiplication | a library call — the 65816 has no multiply |

`oamSet` takes eight arguments: *placing* them costs more than the work
it does. `dmaCopyVram` costs ~1.5 screen lines per call at zero payload,
essentially all of it on the caller side.

### 1.10 Symbol names

A `static` becomes `tccs_{file}_{name}`; a non-static keeps its plain
name. Matters when reading `engine/snesstudio.sym` against a WRAM dump.

---

## 2. 65816 assembly

Each of these was learned from a wrong instruction that assembled fine.

- **`long,Y` does not exist.** Only `long,X` is encoded. Index every long
  access with X; if you need a second index, keep the loop counter in Y
  (Y addresses nothing) and exit on `dey / bne`.
- **`LDY`, `LDX`, `CPX`, `STZ` have no long addressing mode.** Load
  through A, or use absolute addressing with a known bank register.
- **Direct page always targets bank `$00`,** whatever the data bank
  register holds. Assembly scratch variables must live in bank 0 — a
  block placed in `$7E` and addressed through D writes into the PPU
  registers instead. The pixel regression caught this as three wrong
  frames before it became another ghost.
- **Relative branches reach ±128 bytes.** Long loops need a `jmp`.
- **A 16-bit store into a byte array clobbers the neighbour.** Byte
  arrays may be *read* 16-bit with an `and #$00FF` (the next byte is
  ignored), but must be *written* under `sep #$20`.
- **`sep #$20` only touches the M bit.** The index size is unaffected, so
  `phx`/`plx` stay consistent across it.

---

## 3. SNES hardware

- **VRAM, CGRAM and OAM accept writes only during VBlank.** A write
  outside the window works in some emulators and fails silently on real
  hardware.
- **The usable VBlank window is 30 lines, not 38.** VBlank starts at line
  225; PVSnesLib's NMI handler (OAM DMA, controllers) eats through line
  230. See `PERF_MEASUREMENTS.md`.
- **32 sprites and 34 8×8 tiles per scanline.** A hidden sprite must be
  parked off-screen, never left at `(0,0)` — a pile of zeroed OAM entries
  at the origin saturates the per-line limit and makes the hero disappear.
- **`.bss` must stay below `$7E:8000`.** tcc-816's `.bss` and PVSnesLib's
  variables (including `oamMemory`) share bank `$7E` through two WLA
  slots allocated *independently*: past `$7E:8000` the `.bss` overwrites
  the OAM shadow **with no link error**. That is where the phantom
  sprites at `(0,0)` came from. Buffers over ~1 KB go to bank `$7F`
  (`engine/wram7f.asm`); `make` refuses to produce the ROM if a `.bss`
  symbol crosses the line.
- **A WLA ROM section is unsplittable and a LoROM bank holds 32 KB.** The
  `.rodata` of one C file is one section — a large generated data file
  fails the link with *No room for section .rodata*. datagen therefore
  emits one C file per asset set; any new bulk generated data must follow
  that model.
- **16-bit pointers do not leave their bank.** Data in banks `$82`+ is
  reached through far pointers, always.

---

## 4. Build traps

- **Stale `.asm` intermediates are picked up as sources.** PVSnesLib's
  rules glob `*.asm`; our `.c` files compile *through* `.asm`. An
  interrupted build leaves one behind, the next build links the object
  twice, and the ROM keeps data from a previous project — widgets drawn
  from a table that no longer exists. `engine/Makefile` purges them at
  read time; do not remove that.
- **`.gitignore` swallows hand-written assembly.** `engine/src/*.asm` is
  ignored because those are normally intermediates. Every hand-written
  `.asm` needs its own negation rule. Check with `git status` after
  adding one — this has been forgotten twice.

---

## 5. How these get found

Not by review. By running the ROM and comparing bytes.

- `tools/regress.sh` — pixel regression on the demo project. It caught
  §1.1 and the build ghosts of §4.
- `WRAM_DUMP=` / `VRAM_DUMP=` on the harness — dump memory at the last
  frame and cross it with `engine/snesstudio.sym` to read any engine
  variable at the moment of the bug. That is how §1.3 was pinned down.

When a symptom makes no sense, dump the memory and recompute the expected
value. Do not reason about it.
