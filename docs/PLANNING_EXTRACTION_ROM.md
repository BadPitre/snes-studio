# Extracting resources FROM A ROM (X0)

*Design doc, C0-style. The author's request: "j'aimerais bien que nous
travaillions sur un outil dans l'éditeur d'extraction et d'import de
ressources depuis une ROM."*

## 1. The one fact that decides whether this tool is good or disappointing

**Most commercial SNES games compress their graphics.** Nintendo's
LC_LZ1/2/3, Konami's and Square's in-house LZ variants, per-game RLE —
there is no standard, and a compressed block looks like noise to a tile
viewer. Every ripper ever written hits this wall.

What is *not* compressed, in practice, and therefore what this tool will
actually find:

- **fonts** — almost always raw 1bpp or 2bpp, and almost always easy to
  spot;
- **early-generation and low-budget games** — 1990-92 carts often store
  whole tilesets raw;
- **HUD and menu chrome** — frames, cursors, icons, gauge parts;
- **homebrew and unfinished/prototype dumps** — usually raw throughout;
- **anything the author exported themselves** (our own ROMs included —
  the tool can read `snesstudio.sfc` back, which makes it testable
  without a third-party file).

That is a real and useful slice, and it is the honest promise. A tool
that says "here is every sprite in Chrono Trigger" would be a lie.
Decompression is addressed in X4, as an optional, per-format add-on —
never as a premise.

**A note on what you extract.** The tool reads a file the author supplies
and never ships with one. Whether the result may end up in a released
game depends entirely on where that file came from; the tool does not
decide that, and does not pretend to.

## 2. What the tool is

A **tile viewer over a byte range**, exactly in the lineage of Tile
Molester / YY-CHR, plus one thing those tools do not have: the extraction
lands **directly in a project resource category**, already validated.

The author's loop is:

1. open a ROM (never copied into the project — it is a source, not a
   resource);
2. scrub through it with an offset slider until pixels appear;
3. fix the format (bpp, width, ±1 byte alignment);
4. give it a palette;
5. drag a rectangle around what they want;
6. **"Envoyer vers → Picture / IconSet / CharSet / …"** and it is in the
   project.

Steps 1-4 are the tool. Step 6 is *not*, and that is the architectural
point of the next section.

## 3. Where it plugs in — one seam, eight categories for free

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
changes. The ripper produces a PNG in memory, names it, and hands it
over. It gains, without writing a line of it: the windowskin 24×24 check,
the icon-strip N×8 check, the picture ≤16-colour path, the transparency
picker, the duplicate rules, and every French message the author already
knows. It also means the ripper never touches `project.json` — the
resource layer stays the only writer, which is the same separation the
engine/data split rests on.

The two non-register categories, **CharSet** and **ChipSet**, keep their
own callbacks (a charset is an index into a sheet, a chipset drags a
sidecar) and get an equivalent entry point.

## 4. The decode core

Pure TypeScript, in a new `editor/src/rom.ts`. No sidecar: a round-trip
to a Rust binary on every scroll tick would make the viewer unusable,
and the whole job is a few hundred lines of bit shuffling over a
`Uint8Array`. A 4 MB ROM lives in memory without ceremony, and only the
visible window (`rows × width × bytesPerTile`) is ever decoded — a few
hundred kilobytes at worst, well inside one frame.

**Copier header.** `size % 1024 === 512` → the first 512 bytes are an
SMC header and every offset shifts by it. Detected on load, shown, and
overridable (a corrupt dump can lie).

**Formats.** SNES tiles are bitplanes, 8×8 pixels:

| Format | Bytes/tile | Layout |
|---|---|---|
| 1bpp | 8 | one byte per row |
| 2bpp | 16 | per row: plane0, plane1 |
| 4bpp | 32 | 16 bytes of planes 0/1 per row, then 16 of planes 2/3 |
| 8bpp | 64 | four such 16-byte groups (planes 0/1, 2/3, 4/5, 6/7) |
| Mode 7 | 64 | linear, one byte per pixel — not bitplanar |

4bpp is the default: it is what the engine's own sprites, tilesets and
pictures are, so a 4bpp extraction is already the right shape.

**LoROM/HiROM is deliberately absent.** The tool addresses the *file*,
not the CPU bus. Mapping only matters for following a pointer, which is
an X4 concern; for scanning, a file offset is the honest coordinate. The
window still *displays* the LoROM and HiROM bank:address equivalents of
the current offset, because that is what a documentation site or a RAM
map will quote at the author.

**Arrangement.** Tiles are laid out left-to-right, `width` tiles per row.
One extra option is not optional in practice: **16×16 blocks** — SNES
sprites are stored as 2×2 tile groups in sequence, and without that
toggle every character in the ROM shows up quartered and interleaved.

## 5. Palettes — the other half of the problem

Raw tile data without the right palette is a readable shape in wrong
colours. Four ways to get one, all in the same panel:

1. **By offset.** 16 colours = 32 bytes, BGR555 little-endian (bits 0-4
   red, 5-9 green, 10-14 blue; 5→8 bits by `(v << 3) | (v >> 2)`). A
   nudge control walks the offset by 2 bytes, because palettes in ROM are
   rarely where you first guess.
2. **Scan.** Heuristic sweep for plausible 32-byte palette blocks —
   distinct colours, bit 15 clear, not a run of `00`/`FF`. Presented as a
   list of candidates to click through, not as an answer.
3. **From a project asset.** `loadAssetPalette(root, rel)` already reads
   the PLTE chunk of any PNG in `assets/` (added in U2). Extracting with
   the palette the game already uses is the case that matters most:
   the result drops into the project without a new palette cluster.
4. **By hand.** The 16 swatches are editable with the colour picker U2
   added, and one of them is designated index 0 / transparent — which is
   exactly what the S4 picker will ask for on import anyway.

Greyscale is the default so that *something* is always visible while
hunting.

## 6. The window

`Tools → Extraire d'une ROM`, one modal, three columns — the same shape
as the resource manager, so it reads as a sibling rather than a guest.

```
┌ ROM: sm.sfc  (header SMC détecté, 512 o)  [Ouvrir…]  LoROM $C2:8000 ┐
│                                                                     │
│ ┌ Format ──────┐ ┌──── vue ─────────────────┐ ┌ Palette ──────────┐ │
│ │ bpp  [4bpp▾] │ │                          │ │ offset $0E:1234   │ │
│ │ largeur  16  │ │      (les tuiles)        │ │ ◀ ▶  [Scanner]    │ │
│ │ blocs 16×16□ │ │                          │ │ [Depuis un asset] │ │
│ │ offset       │ │      sélection ▭         │ │ ▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪  │ │
│ │  $0C:8000    │ │                          │ │ transparent: 0    │ │
│ │ ◀◀ ◀ ▶ ▶▶ ±1 │ │                          │ └───────────────────┘ │
│ │ zoom  [×3 ▾] │ │                          │ ┌ Sélection ────────┐ │
│ │ grille  ☑    │ └──────────────────────────┘ │ 4×4 tuiles, 32×32 │ │
│ └──────────────┘                              │ [Envoyer vers ▾]  │ │
│                                               │ → Picture         │ │
│                                               └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

The **"Envoyer vers"** dropdown lists the categories the current
selection can legally feed, and greys out the others *with the reason* —
"Windowskin : demande 24×24, la sélection fait 32×32". The author learns
the constraint before the import refuses them, instead of after.

Rendering is an offscreen canvas at 1× scaled with
`imageSmoothingEnabled = false`. The PNG handed to `runImport` comes from
`canvas.toBlob("image/png")`; datagen already quantises truecolour PNGs,
and by construction the extraction holds at most 16 distinct colours, so
no indexed-PNG encoder is needed on our side.

## 7. Stages

| Stage | What it buys | Rough size |
|---|---|---|
| **X1 — voir** | `rom.ts` decode core, the modal, ROM load + header detection, 1/2/4/8bpp + Mode 7, width/offset/zoom/grid, palette by offset, greyscale default. Read-only: nothing enters the project yet. | the bulk of the work |
| **X2 — prendre** | Rectangle selection, the four palette sources, transparent index, the `runImport(ctx, res, src)` seam, "Envoyer vers" with per-category reasons, CharSet/ChipSet entry points. | medium |
| **X3 — trouver** | Navigation: jump-to-offset, skip runs of `00`/`FF` (a ROM is mostly not graphics — this is what makes scanning bearable), 16×16 block arrangement, palette auto-scan, per-ROM bookmarks. | medium |
| **X4 — décompresser** *(optional, only on request)* | Known decompressors (LC_LZ1/2/3, common RLE) as a filter applied before decoding, with a "try every filter at this offset" probe. | open-ended |

**Bookmarks are not game data.** They belong to the tool, not to the
game, so they go in a `rips.json` at the project root that datagen never
reads — the same reason the engine owns primitives and the project owns
data.

X1 alone is already worth having: it turns "is there anything usable in
this file?" from an unanswerable question into ten minutes of scrolling.

## 8. Explicitly out of scope

- **Audio.** BRR samples can be spotted by their 9-byte block structure,
  but locating a game's sample directory is per-game work, and turning an
  SPC engine's sequence data into an `.it` module is not a tool, it is a
  research project. Sounds and music stay manual imports.
- **Writing back into the ROM.** This is a ripper, not a ROM hacking
  editor. Nothing the tool does ever modifies the file it opened.
- **Full-screen reconstruction from tilemaps.** Reading a 2-bytes-per-
  entry tilemap and compositing a whole background is a natural X3
  stretch, not a promise.
- **Automatic identification.** No "this is a character sprite" guessing.
  The author's eye is the classifier.

## 9. Honest risks

1. **The compression wall** (§1). Mitigated by naming it up front rather
   than discovering it in use.
2. **Finding anything at all takes patience.** A 4 MB ROM at 16 tiles ×
   32 rows per screen is roughly 250 screens. X3's blank-skipping is not
   a nicety; without it the tool is tiring.
3. **Scope creep toward a ROM hacking suite.** The line that holds: the
   tool's output is *a PNG handed to the existing import flow*. Anything
   that does not end in that sentence belongs to a different tool.
4. **A palette cluster per extraction.** An imported picture with a
   16-colour palette of its own competes for the CGRAM budget like any
   other. Nothing new, but a ripper makes it easy to import ten images
   without noticing — the existing build diagnostics remain the guard.
