# Extracting resources FROM A ROM (X0)

*Design doc, C0-style. The author's request: "un outil dans l'éditeur
d'extraction et d'import de ressources depuis une ROM" — then, on scope:
"pouvoir récupérer des sprites, des fonts, les sfx et les musiques, tout
en donnant une ROM."*

## 1. The four asks, answered straight

| Ask | Verdict |
|---|---|
| **fonts** | **Yes, and it is the easy case.** ROM fonts are almost always raw 1bpp or 2bpp, and our font format is a 768×8 strip — literally 96 tiles in a row. Set width to 96, select one row, done. |
| **sprites** | **Yes when the game does not compress them.** Needs the 16×16 block arrangement (§4), otherwise every character shows up quartered. |
| **sfx** | **Yes, and it is the *most* reliable of all four** — better odds than graphics. BRR is self-describing, so samples can be found by scanning with almost no false positives (§6). |
| **musiques** | **No, not from a ROM, not generically.** §7 says exactly why and what replaces it. |

Two facts shape everything below.

**Graphics: most commercial SNES games compress them.** Nintendo's
LC_LZ1/2/3, Konami's and Square's in-house LZ variants, per-game RLE —
there is no standard, and a compressed block looks like noise to a tile
viewer. Every ripper ever written hits this wall. What stays raw in
practice: fonts, HUD and menu chrome, 1990-92 carts (often whole
tilesets), homebrew and prototypes, and anything the author exported
themselves — our own `snesstudio.sfc` reads back, which makes the tool
testable without a third-party file. §8 offers the one real way around
the wall.

**Audio: the opposite situation.** A BRR sample carries its own
structure, so finding samples in a ROM is a solved problem, not a guess.
Sound is the part of this tool that will work best. Music is the part
that will not work at all, and for a completely different reason: it is
not compressed, it is *interpreted* by a program.

**A note on what you extract.** The tool reads a file the author supplies
and never ships with one. Whether the result may end up in a released
game depends entirely on where that file came from; the tool does not
decide that, and does not pretend to.

## 2. What the tool is

A **tile viewer over a byte range** (the Tile Molester / YY-CHR lineage)
plus a **BRR sample scanner**, with one thing those tools do not have:
the extraction lands **directly in a project resource category**, already
validated.

Accepted inputs, all three treated as "a byte range to look into":

- **`.sfc` / `.smc`** — the ROM. The default case.
- **`.spc`** — a sound snapshot. Not a ROM, but the single best source
  for audio (§6), and trivial for the author to produce from any
  emulator.
- **a savestate** — the answer to the compression wall (§8).

The author's loop for graphics: open, scrub the offset until pixels
appear, fix the format, give it a palette, drag a rectangle, **"Envoyer
vers → Picture / IconSet / CharSet / Fonte / …"**. For audio: open, scan,
click a sample in the list to hear it, **"Envoyer vers → Son"**.

## 3. Where it plugs in — one seam, every category for free

`resources.ts` already owns the whole import flow: size validation
(`badSize`), filename slugging, duplicate refusal, the transparency
picker (S4), the register write, the status line. It is written once and
declined per resource. `runImport` only starts with a file picker:

```ts
export async function runImport(ctx: ResCtx, res: Resource): Promise<void> {
  const file = await res.pickImport();
  if (!file) return;
  const bytes = await readBinaryFile(file);
  …everything else…
}
```

So the ripper needs **one optional parameter**, and inherits the rest:

```ts
export async function runImport(
  ctx: ResCtx,
  res: Resource,
  src?: { name: string; bytes: Uint8Array }   // ← the whole seam
): Promise<void>
```

When `src` is given, the two first lines are skipped and nothing else
changes. The ripper produces a PNG (or a WAV) in memory, names it, and
hands it over. It gains, without writing a line of it: the windowskin
24×24 check, the icon-strip N×8 check, the font 768×8 check, the picture
≤16-colour path, the transparency picker, the WAV duplicate refusal, and
every French message the author already knows. It also means the ripper
never touches `project.json` — the resource layer stays the only writer,
the same separation the engine/data split rests on.

**CharSet** and **ChipSet**, which are not path registers (a charset is
an index into a sheet, a chipset drags a sidecar), keep their own
callbacks and get an equivalent entry point.

## 4. Graphics: the decode core

Pure TypeScript, in a new `editor/src/rom.ts`. No sidecar: a round-trip
to a Rust binary on every scroll tick would make the viewer unusable, and
the whole job is a few hundred lines of bit shuffling over a
`Uint8Array`. A 4 MB ROM lives in memory without ceremony, and only the
visible window (`rows × width × bytesPerTile`) is ever decoded.

**Copier header.** `size % 1024 === 512` → the first 512 bytes are an SMC
header and every offset shifts by it. Detected on load, shown, and
overridable.

**Formats.** SNES tiles are bitplanes, 8×8 pixels:

| Format | Bytes/tile | Layout |
|---|---|---|
| 1bpp | 8 | one byte per row — the usual font case |
| 2bpp | 16 | per row: plane0, plane1 |
| 4bpp | 32 | 16 bytes of planes 0/1 per row, then 16 of planes 2/3 |
| 8bpp | 64 | four such 16-byte groups |
| Mode 7 | 64 | linear, one byte per pixel — not bitplanar |

4bpp is the default: it is what the engine's own sprites, tilesets and
pictures are, so a 4bpp extraction is already the right shape.

**Arrangement.** Tiles run left-to-right, `width` per row. One extra
option is not optional given the author wants sprites: **16×16 blocks** —
SNES sprites are stored as 2×2 tile groups in sequence, and without that
toggle every character appears quartered and interleaved. It moves from a
nice-to-have to a **X2 requirement**.

**LoROM/HiROM is deliberately absent.** The tool addresses the *file*,
not the CPU bus; mapping only matters for following a pointer, which is
an X5 concern. The window still *displays* the LoROM and HiROM
`bank:address` equivalents of the current offset, because that is what a
documentation site or a RAM map will quote at the author.

## 5. Graphics: palettes

Raw tile data without the right palette is a readable shape in wrong
colours. Four sources, one panel:

1. **By offset.** 16 colours = 32 bytes, BGR555 little-endian (bits 0-4
   red, 5-9 green, 10-14 blue; 5→8 bits by `(v << 3) | (v >> 2)`). A
   nudge control walks by 2 bytes.
2. **Scan.** Heuristic sweep for plausible 32-byte blocks — distinct
   colours, bit 15 clear, not a run of `00`/`FF`. A list of candidates to
   click through, not an answer.
3. **From a project asset.** `loadAssetPalette(root, rel)` already reads
   the PLTE chunk of any PNG under `assets/` (added in U2). Extracting
   with a palette the project already uses is the case that matters most:
   the result costs no new CGRAM cluster.
4. **By hand**, with the U2 colour picker, and one swatch designated
   index 0 / transparent — which is what the S4 picker asks for on import
   anyway.

Greyscale is the default, so something is always visible while hunting.

## 6. Audio: the part that works best

**Why scanning works.** A BRR sample is a chain of 9-byte blocks: one
header byte (`range<<4 | filter<<2 | loop<<1 | end`) then 8 bytes holding
16 four-bit deltas. A valid chain has `range ≤ 12` in every header, `end`
clear in all but the last block, and `end` set exactly once, at the end.
Requiring ~16 consecutive valid blocks before reporting a hit leaves
almost no false positives. This is a structural property of the format,
not a heuristic over content — which is precisely why audio extraction
is more dependable here than graphics.

**Decoding.** Four filters over the previous two samples, plus a range
shift; the coefficients are the same four already written down in
`tools/datagen/src/sfx.rs` (`brr_predict`) — the editor implements the
inverse. Output is 16-bit mono PCM.

**Sample rate is not in the data.** BRR carries no rate: pitch comes from
the driver's per-voice register at play time. The tool assumes **32000 Hz**
(the DSP's output rate, the usual convention) and offers a rate slider so
the author can tune by ear while previewing through the existing
`AudioPreview` component.

**`.spc` input turns guessing into knowing.** An SPC file is a 64 KB ARAM
snapshot plus the DSP registers. Register `$5D` holds the sample
directory page, and that directory is an exact table — 4 bytes per entry,
start address and loop address. From an SPC the tool does not scan at
all: it *reads the list*, with correct boundaries and real loop points,
for every instrument that song uses. Any emulator dumps an SPC in one
keypress, so this is cheap for the author and a large quality jump.

**Then it is just a WAV.** `wav_to_mono_8k` in `sfx.rs` accepts 8/16/24/
32-bit, mono or stereo, any rate from 4000 to 96000 Hz, so a 32 kHz mono
WAV written by the tool imports with no special case at all.

**Two consequences to state plainly.** The engine's SFX budget is 8 kHz,
≤8 KB of BRR per sound (~1.8 s), 16 sounds, 24 KB total
(`docs/TOOLS.md`). So (a) only short samples fit, and (b) the chain is
BRR → PCM → **resample to 8 kHz** → BRR again: a ripped effect will sound
audibly duller than in the original game. That is the engine's existing
budget showing through, not a defect of the ripper — but the author
should hear it described before hearing it in the game.

## 7. Music: what I cannot do, and what replaces it

**SNES music is not data, it is a program plus data.** Each developer
wrote their own SPC700 driver — Nintendo's N-SPC, Rare's, Konami's,
Square's Akao, HAL's — and each invented its own sequence format. There
is no generic "song" to find. Worse, "extract the music from the ROM" is
usually a category error: an `.spc` is a snapshot of a *running*
emulator, not something sitting statically in the cart.

Our engine plays **IT modules** (snesmod). So a real feature would mean
`ROM → identify driver → locate song table → parse sequences → map
instruments → emit IT`, per driver family. VGMTrans proves it is
possible; VGMTrans is also twenty years of accumulated per-driver
parsers. Three options, priced honestly:

- **A — what X3 delivers: the instruments, not the songs.** The tool
  extracts the BRR samples, which are the hard part to recreate. The
  author re-sequences in OpenMPT using those samples and exports an
  `.it` that drops straight into the music register. This is the
  workflow homebrew authors actually use, it works today, and OpenMPT is
  a far better sequencer than anything I would build.
- **B — N-SPC only, on explicit request.** One driver family (Nintendo's,
  also licensed to many third parties), with a manual "song table offset"
  field. Large, uncertain hit rate, per-game friction. Real, but it is a
  project of its own — I would want you to ask for it by name.
- **C — generic ROM → IT.** Not deliverable. I will not put it in a
  stage plan.

So: **A is in the plan, B is available if you want it, C is off the
table.** "Give a ROM, get the music" is the one part of the request I
cannot honour.

## 8. The way around the compression wall

If the author can reach the screen they want *in an emulator*, the
graphics are already **decompressed in VRAM** and the palette is exactly
right in **CGRAM**. Ripping from that snapshot bypasses compression
entirely — it is the difference between "some games" and "any game, any
screen you can reach".

We are unusually well placed for this: `tools/regress/` already drives a
snes9x libretro core from a small C harness. Extending it to dump VRAM +
CGRAM at a chosen frame, and letting the ripper open that dump exactly
like a ROM, reuses machinery that exists and is already trusted.

Honest caveat before this is promised: libretro exposes VRAM through
`retro_get_memory_data(RETRO_MEMORY_VIDEO_RAM)`, but **CGRAM is not a
standard libretro memory region**, so getting the palette out needs
either a savestate parse or a small core-specific path. That check comes
first; the feature is staged as **X4** and is the one I would push for
after X1-X3, because it changes the tool's reach more than anything else
in this document.

## 9. Stages

| Stage | What it buys | Size |
|---|---|---|
| **X1 — voir** | `rom.ts` decode core, the modal, ROM load + header detection, 1/2/4/8bpp + Mode 7, width/offset/zoom/grid, palette by offset, greyscale default. Read-only. | the bulk |
| **X2 — prendre** | Rectangle selection, **16×16 blocks** (sprites), the four palette sources, transparent index, the `runImport` seam, "Envoyer vers" with per-category reasons, CharSet/ChipSet entry points. **Fonts and sprites are done at the end of X2.** | medium |
| **X3 — entendre** | BRR scanner, decoder, preview with a rate slider, `.spc` input reading the real sample directory, WAV out into the sound register. **SFX done. Music instruments done (§7 A).** | medium |
| **X4 — contourner** | VRAM + CGRAM dump from the snes9x harness, opened like a ROM. The compression wall, gone. | medium, one unknown to check first |
| **X5 — décompresser** *(optional)* | LC_LZ1/2/3 and common RLE as a filter before decoding, with a "try every filter here" probe. Largely superseded by X4. | open-ended |
| **B — N-SPC → IT** *(only if asked by name)* | §7 option B. | large |

**Bookmarks are not game data.** They belong to the tool, so they go in a
`rips.json` at the project root that datagen never reads — the same
reason the engine owns primitives and the project owns data.

## 10. Explicitly out of scope

- **Song sequences** (§7 C).
- **Writing back into the ROM.** This is a ripper, not a ROM hacking
  editor; nothing ever modifies the file it opened.
- **Full-screen reconstruction from tilemaps.** A natural X4 companion,
  not a promise.
- **Automatic identification.** No "this is a character sprite" guessing.
  The author's eye is the classifier.

## 11. Honest risks

1. **The compression wall** (§1), until X4 lands.
2. **Finding anything takes patience.** A 4 MB ROM at 16 tiles × 32 rows
   per screen is ~250 screens. Blank-run skipping is not a nicety.
3. **Scope creep toward a ROM hacking suite.** The line that holds: the
   output is *a PNG or a WAV handed to the existing import flow*.
   Anything not ending in that sentence is a different tool.
4. **8 kHz SFX** (§6): ripped sound will not match the author's memory of
   it.
5. **A palette cluster per extraction.** A ripper makes it easy to import
   ten images without noticing the CGRAM cost; the existing build
   diagnostics stay the guard.
