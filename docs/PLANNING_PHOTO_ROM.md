# One-click dumping: the ROM photo booth (X6)

*Design doc, C0-style — since built; §5 records how the route changed
on contact with the repo's own rules. The author opened Secret of Mana
in the tile viewer, saw noise, and asked the right question: "comment
faire pour que ce soit beaucoup plus simple pour un utilisateur de
dumper les infos d'une ROM ?"*

## 1. The finding that motivates this

The tile viewer is correct — verified, not assumed. Searching our own
ROM for the exact bytes datagen emitted into `data_font.c` gives an
offset whose content is known ($1BDE7), and `rom.ts` decodes the
engine's alphabet there pixel-perfect. What Secret of Mana shows is the
correct reading of its bytes: Square compressed essentially all its
graphics, and raw tiles simply are not in the cart.

The general lesson is the same one that unlocked music (X5): **do not
read the cartridge, read the machine's memory after the game has done
the work.** A running SNES holds, in the clear, everything the ripper
wants:

| Memory | Size | What it holds | Ripper use |
|---|---|---|---|
| VRAM | 64 KB | every tile the PPU can draw, decompressed | the Graphismes tab, on any game |
| CGRAM | 512 B | the 256 real colours (BGR555) | palettes — the piece the tab lacks today |
| OAM | 544 B | which sprite tiles are on screen, at what size | grouping sprite tiles automatically |
| ARAM+DSP | 64 KB + 128 B | the song and its instruments | already served by `.spc` files |

Measured on our own demo: a 64 KB VRAM dump read back through `rom.ts`
shows the hero sprites, the font, the dialogue frame and the HUD hearts,
cleanly. The route works; only the *dumping* is unfriendly today — it
requires a debugger-grade emulator and four manual exports.

## 2. What already exists in the toolbox

This is why the feature is cheap. All verified in the tree today:

- **`tools/regress/harness`** runs any ROM headless in the snes9x
  libretro core for N frames with a scripted pad
  (`"210-290:R,300:S"`), and already dumps VRAM (`VRAM_DUMP`) and WRAM.
- **We build `snes9x_libretro.so` from source** for the regression kit,
  so the core is patchable. Two facts inside it:
  - CGRAM and OAM live in the PPU state (`PPU.CGDATA`,
    `PPU.OAMData`) — exposing them costs an env-var and a `fwrite`,
    ~20 lines in our own build.
  - **snes9x contains a real `.spc` dumper**: `S9xDumpSPCSnapshot()`
    arms a callback that fires at the next KEY ON — a *clean* snapshot,
    the same quality as the desktop emulator's "Save SPC" — and
    `S9xSPCDump(filename)` writes the standard file.
- **The editor already ships sidecars** (datagen, snesbuild): adding
  `harness` + core to the bundle follows a paved road (E2b).
- The extraction window already accepts arbitrary `.bin` byte ranges,
  and the audio panel already eats `.spc`.

## 3. The design: « 📸 Photographier la ROM »

One button in the extraction window when the opened file is a ROM.

**The author picks the moment with two fields, not a controller:**

- *Attendre* — seconds to run (default 15: past the logos, into the
  title or attract mode, music playing).
- *Appuyer sur Start* — optional checkbox "appuyer sur Start à
  mi-parcours" for games whose title waits for it (attract modes and
  first screens hold most of what a ripper wants: logo art, font,
  main theme).

Behind the button: the harness runs the ROM at full speed —
**headless emulation is far faster than real time**, tens of seconds of
game cost a few seconds of wall clock — and drops four files in a temp
directory: `vram.bin`, `cgram.bin`, `oam.bin`, `photo.spc` (armed early;
written at the first key-on after the wait, i.e. whatever music is
playing). A fifth artefact, the framebuffer PNG, is shown as a
"voilà où en était le jeu" thumbnail so a wrong moment is obvious
before any ripping starts.

**Then the window opens the photo like it opens anything else**, with
three differences the files make possible:

1. The Graphismes tab shows VRAM with the **real palettes**: CGRAM is
   read into 16 selectable rows of 16 (or 8 rows of 32 in 256-colour
   terms), replacing the grey default. The palette hunt — the worst part
   of the current UX — disappears.
2. OAM tells which tiles were live sprites; a "sprites à l'écran"
   shortcut jumps the view to the sprite base and pre-checks
   blocs 16×16.
3. The Sons tab gets `photo.spc` — same panel as "Extraire une
   musique", no external emulator ever involved.

**Recipe left for the author:** none. Open ROM → 📸 → tiles in colour
and the title music, on any game, including fully compressed ones.

## 4. What this replaces, and what it does not

- The manual recipe (Mesen-S → Memory Tools → export VRAM/CGRAM →
  reopen the .bin, greyscale only) is replaced for the common case.
- **Savestate-grade moments are NOT replaced.** A photo reaches what a
  timer and a Start press can reach: title, attract, first screen. The
  boss of dungeon 3 requires a human playing. For that, the window will
  still accept raw `.bin`/`.spc` files from any emulator's tools — the
  expert path stays open. Parsing desktop emulators' savestates
  (Snes9x `.state`, Mesen `.mss`, bsnes `.bst`) was considered and
  refused: three formats, all version-dependent, none documented as
  stable — a maintenance treadmill for a corner the raw-dump path
  already serves.
- **An embedded playable emulator** (play inside the editor, press 📸
  live) was considered and refused for now: it means audio/video/input
  plumbing through Tauri, weeks of work, for the same four files. If
  the photo booth proves insufficient, that is the upgrade path and
  the plumbing (harness → files → window) is identical.

## 5. Cost, priced — and how the build route changed on contact

**Shipped**, with one deviation from the plan above, forced by the
repo's own rules. The regress README promises a **stock core** ("get it
from RetroArch") and deliberately does not vendor snes9x — its licence
is non-commercial — so patching the core was off the table for anything
shipped. The stock libretro API turns out to carry everything anyway:

| Piece | Where | What it does |
|---|---|---|
| `snesphoto` (Rust sidecar, libloading) | `tools/snesphoto/` | runs the ROM headless in the stock core, writes `photo.state` (retro_serialize) + `photo.ppm`. Rust rather than the C harness so it builds wherever cargo builds — Windows included. ~750x real time measured. |
| `s9xstate.ts` (pure TS) | `editor/src/` | mines the savestate: VRA block → VRAM, PPU block → CGRAM + OAM + OBJ/BG bases (offsets from snes9x's SnapPPU × SPPU, versions 7-12), SND block → APU state → a standard `.spc`, its write-only cells ($F1, $FA-$FC, $FD-$FF) rebuilt from the SMP registers. |
| The 📸 form, palettes, jumps, thumbnail | `RomRipModal.tsx`, `build.ts` | two controls, one button; the core found in `tools/regress/` or RetroArch's install dirs. |

The regression harness (`harness.c`) is untouched: it is the regression
kit's tool, and stays C-and-cc as `regress.sh` expects.

**A hardware bug this flushed out of `spc700.ts`**: $F4-$F7 are two
registers each on the chip (write → OUT latch, read → IN latch). Our
emulator conflated them; snesmod's main loop writes $80 to $F4 then
polls $F4 for the S-CPU's answer, so a resumed photo of a snesmod game
read back its own $80 and waited forever — pure silence, measured as
0 note-ons against level 3777 on the real core. With the latches
separated, the same snapshot resumes to 337 note-ons in 10 s, and the
FF5 transcriptions are unchanged to the note (808/739).

## 6. Verification plan

Same discipline as X5: measure, don't trust.

1. Photo of **our own demo** → the VRAM tab must show the hero, font
   and hearts in their true colours (CGRAM known from the project's own
   palettes), and `photo.spc` must transcribe to a module whose note
   count matches the direct transcription of the same track.
2. Photo of a **commercial compressed game** (the author has one) → the
   Graphismes tab must show recognisable art where the cart view showed
   noise. That single before/after is the feature's acceptance test.
