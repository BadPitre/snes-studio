# CLAUDE.md — snes-studio

Working notes for an agent (or anyone) picking this repository up.
Read `CONTRIBUTING.md` first — conventions, gates and build live there.
This file only holds what is specific to working *on* the project rather
than *in* it.

## The project in one line

A no-code SNES game maker: the user builds a game visually and exports a
standalone `.sfc` ROM. **Fixed engine + bytecode VM — games are DATA, not
code.**

```
editor/   Tauri + React + TS   — the user's tool
tools/    Rust (datagen)       — project files -> C and binary banks
engine/   C + 65816 assembly   — reads that data, knows nothing about the game
demo/     reference project    — the pixel regression's subject
showcase/ larger project       — exercises database, screens, animations, UI
docs/     specs and design     — contractual, see below
```

## Non-negotiable rules

1. **No game data in engine code.** Positions, sizes, texts, IDs: all of
   it comes from the data banks. A gameplay value in the engine is an
   architecture bug.
2. **The spec is contractual.** Binary formats and VM opcodes are defined
   in `docs/SPEC_FORMATS.md`. If the code must diverge, update the spec
   **in the same commit** and say so explicitly.
3. **C only for the engine** — the 816-tcc compiler is C, not C++. 65816
   assembly is allowed on hot paths, and only where a measurement
   justifies it (see `docs/PERF_MEASUREMENTS.md`).
4. **Do not over-design.** Each structure covers the current need.

## Before writing engine code

`docs/ENGINE_CONSTRAINTS.md` — the platform and toolchain traps. Most of
them are silent: legal C, green build, wrong output. Skipping that page
is how the same bug gets found twice.

## Validation

The engine can be run headlessly: `tools/regress/harness.c` executes the
ROM in a libretro core for a fixed number of frames with a fixed input
sequence, and `WRAM_DUMP=` / `VRAM_DUMP=` dump memory at the last frame.
Cross a dump with `engine/snesstudio.sym` to read any engine variable at
the moment of a bug.

That covers *state*. It does not cover *judgement*: whether a fade looks
right, whether a menu is legible. For those, say what the code is
expected to produce and ask. Never claim a visual result works without
having seen it.

When a glitch is described, look first at: VBlank timing, palette/tile
format, bank overflow, uninitialised OAM.

## Interaction

- Bertrand is a professional developer (C++/UE5). Skip general
  programming explanations; do explain SNES/65816 specifics when they
  motivate a choice.
- Propose significant architecture decisions rather than taking them
  unilaterally.
- Flag any spec divergence or technical debt introduced, explicitly.
- Conversation is in French. Code, comments, docs and commits are in
  English (`CONTRIBUTING.md` §1).
