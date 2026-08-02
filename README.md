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

**What the installer contains:** the editor, and only the editor. Opening,
editing and saving a project works out of the box; *building a ROM* still
shells out to `make` and `datagen`, so it needs a checkout of this
repository (the editor derives it from the parent folder of the open
project), plus PVSnesLib and Rust as above.

---

## Before you push: three gates

Each one exists because something got through without it. They are cheap
to run and they are the reason a refactor here is safe.

```bash
./tools/regress.sh --build    # engine: pixel regression, 3 cases
./tools/gate-datagen.sh check # datagen: output identical byte for byte
./tools/gate-editor.sh        # editor: tsc + build + 11 windows + 56 command forms
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
  it opens every Tools window and every event command's options form. A
  broken render compiles fine — only opening the window catches it.

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

`ENGINE_CONSTRAINTS.md` is not optional reading for engine work. Most of
what it lists is *silent*: legal C, a green build, and wrong output —
a pointer cast that keeps 16 bits and sign-extends, a `.bss` that is
never zeroed, an array index that miscompiles. The document exists so
each of those is paid for once.
