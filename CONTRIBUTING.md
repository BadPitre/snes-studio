# Contributing to SNES Studio

SNES Studio is a no-code SNES game maker. Three bricks, one direction of
travel:

```
editor/   Tauri + React + TypeScript   the user edits a project
tools/    Rust (datagen)               project files -> C and binary data
engine/   C (PVSnesLib) + 65816 asm    a fixed engine that reads that data
```

**The engine gets generic primitives. The game is data.** If a gameplay
value — a position, a name, a formula — appears in engine code, that is
an architecture bug, not a shortcut.

---

## 1. Language

| What | Language |
|---|---|
| Identifiers, comments, internal error text | **English** |
| Documentation in `docs/`, commit messages | **English** |
| Strings the user reads — editor UI, datagen diagnostics shown in the editor | **French** |

The tool is French-facing. Product text stays French; everything a
developer reads is English. Data formats (JSON keys, TOML keys, command
names) are already English and must stay that way — renaming one breaks
every existing project.

---

## 2. Comments

The rule is one line long:

> **Keep the *why*. Delete the *what*.**

A comment that restates the code is noise, and it rots. A comment that
explains a decision is the only place that decision exists.

**Delete:**

```c
/* increment the counter */
i++;
```

**Keep** — four kinds, and only these:

1. **A measurement.** "8 DMA calls, 22 lines, 3 of them actual transfer."
   Numbers nobody will re-derive.
2. **A platform trap.** Anything from `docs/ENGINE_CONSTRAINTS.md`, at the
   point where the code looks wrong without it.
3. **A rejected alternative.** The obvious approach that was tried and
   failed, so the next person does not retry it. This is the single most
   valuable kind and the easiest to lose.
4. **A non-obvious invariant.** "BG1 transfers come last in the plan so
   the effect layer can stop at four."

**Long narratives go to `docs/`,** with a one-line pointer from the code:

```c
/* Batched VRAM transfers — see docs/PERF_MEASUREMENTS.md §3 for why
   the call count is what costs. */
```

A file header says what the module is responsible for and what it
deliberately does not do. Two to eight lines. Not a changelog.

---

## 3. Naming

- C: `snake_case`, prefixed by module — `map_vblank`, `vbl_take`,
  `ta_plan`. A `static` becomes `tccs_{file}_{name}` in the symbol table;
  keep that in mind when reading a WRAM dump.
- Rust: standard style.
- TypeScript: `camelCase` for values, `PascalCase` for types and
  components.
- Assembly: `snake_case` labels, module-prefixed, locals as `_mod_loop`.

Prefer the domain word over the abbreviation, except where the domain
word *is* the abbreviation (`vram`, `oam`, `dma`, `bg`, `obj`).

---

## 4. Before you push: the three gates

None of this is caught by reading the diff. Run the gate that matches
what you touched.

```bash
# engine — pixel regression on the demo project
./tools/regress.sh --build

# datagen — output must be identical byte for byte
./tools/gate-datagen.sh snapshot     # before touching anything
./tools/gate-datagen.sh check        # after

# editor — types, bundle, and all eleven windows open
./tools/gate-editor.sh               # --fast skips the browser test
```

The pixel regression is the one that has actually found bugs: a tcc-816
miscompile that corrupted the HUD, and stale build intermediates that
drew widgets from a previous project's tables. Both looked like "a few
pixels different". Never `--bless` a reference without opening the
produced image.

---

## 5. Build

Requires [PVSnesLib](https://github.com/alekmaul/pvsneslib) with
`PVSNESLIB_HOME` set to a Unix-style path (including under MSYS2).

```bash
cd engine
make            # produces snesstudio.sfc
make data       # regenerates src/data/ from demo/ (needs Rust)
make clean      # when in doubt about artefacts
```

`engine/src/data/*.c` is **generated**. Editing it by hand is
overwritten; edit the project sources in `demo/` instead.

Validation emulators: **Mesen2** for daily work, **bsnes accuracy mode**
as the judge. Rendering correctly in Mesen2 alone is not proof.

---

## 6. Two habits that carry this codebase

**Measure, do not reason.** When a symptom makes no sense, dump WRAM or
VRAM and recompute the expected value. Every performance claim in
`docs/PERF_MEASUREMENTS.md` exists because reasoning about the SNES gets
the answer wrong often enough to be useless.

**Distrust a design that "should" be better.** The first VBlank arbiter
was obviously an improvement and measured worse than no arbiter at all.
A/B it with identical instrumentation before believing it.

---

## 7. Where to read next

- `docs/ENGINE_CONSTRAINTS.md` — platform and toolchain traps. **Read
  this before writing engine code.** Most of them are silent.
- `docs/PERF_MEASUREMENTS.md` — the performance record and how it was
  taken.
- `docs/SPEC_FORMATS.md` — contractual data and VM formats. If code
  diverges, update the spec **in the same commit**.
- `docs/TOOLS.md` — the datagen pipeline.
- `docs/EDITOR.md` — editor architecture.
