# SNES Studio

A no-code SNES game maker, in the spirit of GB Studio and RPG Maker: you
build a game visually and export a standalone `.sfc` ROM that runs on an
emulator and on real hardware.

**One fixed engine plus a bytecode VM — a game is DATA, not code.**

If a gameplay value (a position, a name, a formula) shows up in engine
code, that is an architecture bug, not a shortcut.

---

## How the three bricks fit together

```
editor/    Tauri + React + TypeScript    you edit a project
    │      writes JSON, TOML and indexed PNGs
    ▼
tools/     Rust (datagen)                project files -> engine data
    │      emits engine/src/data/*.c and the binary banks
    ▼
engine/    C (PVSnesLib) + 65816 asm     a fixed engine that reads that data
    │
    ▼
        snesstudio.sfc
```

Everything flows one way. The engine knows nothing about any particular
game: it reads scene tables, a tilemap, a bytecode stream. `datagen` is a
pure translator — same project in, same bytes out.

Two reference projects live in the repo, and they are what the safety
nets run against:

| | |
|---|---|
| `demo/` | small, the subject of the pixel regression |
| `showcase/` | larger — database, composed screens, animations, UI widgets |

`docs/` holds the specs and design notes, and is the source of truth for
the data formats.

---

## Getting a ROM

You need [PVSnesLib](https://github.com/alekmaul/pvsneslib) installed and
`PVSNESLIB_HOME` set to a Unix-style path (including on Windows/MSYS2 —
e.g. `/c/snesdev/pvsneslib`), plus Rust/cargo to run `datagen`.

```bash
cd engine
make            # builds snesstudio.sfc from the data already generated
make data       # regenerates src/data/ from demo/ (runs datagen)
make clean      # when in doubt about stale artefacts
make cart       # a .smc padded and checksummed for a flashcart
```

`make` needs a POSIX shell, which on Windows means MSYS2. `snesbuild`
drives the same toolchain natively instead, and produces a byte-identical
ROM (that is what `tools/gate-snesbuild.sh` checks):

```bash
cargo run --release --manifest-path tools/Cargo.toml -p snesbuild -- \
  cart --engine engine
```

`engine/src/data/*.c` is **generated**. Editing it by hand is wasted work
— the next `make data` overwrites it. Edit the JSON/PNG sources under
`demo/` instead, or use the editor.

`datagen` can also be run directly:

```bash
cargo run --manifest-path tools/datagen/Cargo.toml -- demo engine
```

## Running the editor

```bash
cd editor
npm install
npm run dev       # browser, read-only on editor/public/project
npm run tauri dev # the real desktop app, reads and writes a project folder
```

In browser mode "Ouvrir un projet…" loads whatever `editor/public/project`
points at, so the UI can be worked on without Tauri.

### Packaging it

```bash
cd editor
npm run tauri:build
```

That produces the installers **for the machine you run it on**, under
`editor/src-tauri/target/release/bundle/` — Tauri does not cross-compile,
so a Windows `.msi`/`.exe` only comes out of Windows and a `.dmg` only out
of macOS. Per platform you get:

| Platform | Output |
|---|---|
| Windows | `.msi` (WiX) and a `.exe` setup (NSIS, French and English) |
| macOS | `.app` and `.dmg` |
| Linux | `.deb`, `.rpm` and an `.AppImage` |

Linux needs the WebKitGTK development packages first:

```bash
sudo apt-get install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
  patchelf libayatana-appindicator3-dev
```

For all three at once, push a version tag: `.github/workflows/release.yml`
builds the matrix on GitHub runners and attaches the installers to a draft
release. The Actions tab can also run it by hand, which builds the bundles
as artefacts without publishing anything.

**The installer is self-contained.** It carries `datagen` and `snesbuild`
as sidecars, the engine sources, and the PVSnesLib subset the build calls
(MIT, redistributed with its licence). Install it, create a project
anywhere on disk, press Build: **no Rust, no MSYS2, no checkout of this
repository.**

Where the engine comes from depends on where the project sits, and the
author never has to choose:

| The project is… | The engine is… |
|---|---|
| inside a checkout (`<project>/../engine` exists) | that folder, built in place — engine edits show up in the next build |
| anywhere else | the bundled copy, staged into `<project>/.build/engine` |

The second case exists because a bundle resource lives in a read-only
folder (Program Files, `/usr/lib`) while a build writes objects and the
ROM next to the sources. The ROM lands in `<project>/.build/engine/`.

---

## Before you push: four gates

Each one exists because something got through without it. They are cheap
to run and they are the reason a refactor here is safe.

```bash
./tools/regress.sh --build    # engine: pixel regression, 3 cases
./tools/gate-datagen.sh check # datagen: output identical byte for byte
./tools/gate-editor.sh        # editor: tsc + build + windows, forms, resources
./tools/gate-snesbuild.sh     # build driver: same ROM as make, byte for byte
```

- **`regress.sh`** runs the demo ROM in a libretro snes9x core for a fixed
  number of frames with a fixed key sequence, and compares the frame to a
  committed reference. It caught a tcc-816 bug where declaring a variable
  inside a `case` corrupted the HUD's row of hearts — invisible on review.
  The core is not in the repo; see `tools/regress/README.md`.
- **`gate-datagen.sh`** snapshots datagen's output, re-runs it and diffs.
  A translator that changes one byte has changed the game, even if it
  compiles. Take the snapshot *before* touching the code.
- **`gate-editor.sh`** type-checks, builds, then drives a real browser:
  it opens every Tools window, every event command's options form and
  every resource category. A broken render compiles fine — only opening
  the window catches it.
- **`gate-snesbuild.sh`** builds the ROM twice, once with `make` and once
  with `snesbuild`, and compares the `.sfc`, the `.smc` and the symbol
  file. `snesbuild` exists so the editor can build without MSYS2; a driver
  that is only *nearly* right would change the game silently and the pixel
  regression would blame the wrong commit.

Validation emulators: **Mesen2** for daily work, **bsnes accuracy** as the
tie-breaker. Rendering correctly in Mesen2 alone is not enough.

---

## Where to read next

Start with **`CONTRIBUTING.md`** — the language rule, the comment policy,
naming, and the gates above in more detail.

Then, depending on what you are touching:

| You are working on | Read |
|---|---|
| Engine code | **`docs/ENGINE_CONSTRAINTS.md` first** |
| Engine performance | `docs/PERF_MEASUREMENTS.md` |
| Data formats or the VM | `docs/SPEC_FORMATS.md` |
| datagen | `docs/TOOLS.md` |
| The editor | `docs/EDITOR.md` |
| The battle system | **open `combat_tour`** (Tools > Common events) — the battle IS a script; `docs/PLANNING_COMBAT_EN_EVENTS.md` explains why |

`ENGINE_CONSTRAINTS.md` is not optional reading for engine work. Most of
what it lists is *silent*: legal C, a green build, and wrong output —
a pointer cast that keeps 16 bits and sign-extends, a `.bss` that is
never zeroed, an array index that miscompiles. The document exists so
each of those is paid for once.
