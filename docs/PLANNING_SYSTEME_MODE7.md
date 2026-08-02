# Mode 7 system (M7) — design

Hardware scaling and rotation: a cinematic zoom for an intro or a title
screen, and later a world map you fly over — the FF6 airship, Chrono
Trigger's overworld.

This document fixes the formats, the runtime module and the split of work
BEFORE a line of code is written, for the same reason as the animation
and database systems: a format decided during implementation is paid for
in migrations. It also records what is NOT yet proven, so that the first
stage is a throwaway spike rather than a half-written module.

## 1. What Mode 7 actually is

Mode 7 has no "image mode". The hardware knows exactly one thing: a
**tilemap of 128x128 tiles of 8x8, in 8bpp, with an affine transform
applied to it**. Everything else follows from that.

So an "image" displayed in Mode 7 is the DEGENERATE case: a tilemap in
which every tile pattern is used once. That is why the 256-pattern limit
feels brutal for an illustration and generous for a map — it is a limit
on VOCABULARY, not on surface.

| Content | Reuse | What 256 patterns cover |
| --- | --- | --- |
| An illustration, a logo, a portrait | almost none | ~128x112 px — a quarter of the screen, shown at 2x |
| A map painted from a tileset | massive | the whole plane, 128x128 tiles = 1024x1024 px |

Both cases are worth having, and they are the two products of §4.

## 2. What already exists and gets reused

The engine has never run in Mode 7 — this is a genuinely new graphics
path. But the two hard parts of putting a full-screen mode up and taking
it down again are already solved and proven:

- **The internal warp (B3).** `stage_close` returns to the current scene
  by reusing the `do_warp` recipe: scenery, sprites, palettes, ambience
  and music all come back at once (`engine/src/stage.h`). `m7.c` takes
  this mechanism as it is. It is the risky part, and it is written.
- **The deferred-request model.** `stage_request_open` / `stage_apply`,
  the main loop applying the transition under a fade, one frame of VM
  pause. Same shape here.
- **The spread transfer.** Chars sent in bounded chunks per VBlank rather
  than one large DMA (`SG_CHUNK`, 1 KB). Mode 7 needs 32 KB, so it opens
  under force-blank instead — but the budget discipline is the same.
- **The VBlank arbitration (P5).** `vbudget.c` already arbitrates a
  global quota. The world map's sprite transform (§7.2) lands squarely
  in it.
- **PVSnesLib's helpers.** `setMode7`, `setMode7Scale(u16, u16)`,
  `setMode7Rot`, plus `REG_M7A`-`REG_M7Y` (`include/snes/video.h`).
  `setMode7Scale` writes raw 8.8 values into `M7A`/`M7D` with NO division
  (`source/videos.asm`) — the zoom ramp of §5.3 feeds it directly.

## 3. The hard constraints

All of these are hardware, none of them are negotiable. They are listed
here so that the editor can absorb them (§8) rather than surface them.

### 3.1 VRAM

In Mode 7 the tilemap occupies the **low** bytes and the character data
the **high** bytes of the same words, across `$0000-$3FFF`: 16 KB of map
plus 16 KB of chars, interleaved. Writing them therefore takes two passes
with two different `VMAIN` increment settings.

The consequence that makes the whole system possible: **the OBJ region at
`$4000` is untouched**. Sprites work in Mode 7 — the hero, the events,
the vignettes and the animation player all keep running.

### 3.2 The map entry is ONE byte

A Mode 7 map entry is a tile index and nothing else. Compared with a
normal scene, this loses:

| Lost | Consequence |
| --- | --- |
| The flip bits | A mirrored tile is a distinct pattern, and costs budget |
| The palette bits | One global 256-colour palette instead of 8 of 15 |
| The priority bit | No upper layer, the tileset's star has no meaning |
| The second BG | The scene's lower and upper layers merge into one plane |
| Free dimensions | 128x128 tiles fixed (= 64x64 metatiles), not 255x255 |

The VRAM cost is unchanged: 256 tiles at 8bpp is 16 KB, exactly what 512
chars at 4bpp cost today. The trade is half the patterns for twice the
colours.

### 3.3 There is no BG3

The textbox and the HUD live on BG3 (`VRAM_BG3_GFX` at `$1000`,
`VRAM_BG3_MAP` at `$1800`). **BG3 does not exist in Mode 7.**

This is the constraint that shapes the whole design. It means a Mode 7
scene cannot be an ordinary scene rendered differently: talking to an NPC
is impossible there. What survives is everything that is not dialogue —
see §7.3.

Rendering text as sprites would lift it, but that is a whole text engine
on an OBJ region that is already crowded (character sets 0-4, vignettes
384-447, weather at 484+). Out of scope, and stated as such in the editor.

### 3.4 CGRAM is shared with the sprites

8bpp indexes CGRAM 0-255 directly, and OBJ palettes are CGRAM 128-255.

**Rule: a Mode 7 tileset or image uses colours 0-127 only.** That leaves
128-255 to the sprites, which is what keeps the hero, the events and the
animations usable over the plane. 128 colours is still eight times what a
normal scene's tileset gets per palette.

### 3.5 Sprites do not scale

When the plane zooms, sprites keep their size. Zoomed in, the hero looks
tiny on a huge landscape; zoomed out, gigantic.

The games of the era simply live with it — FF6's airship does not change
size as the overworld tilts. The design consequence: keep the in-game
zoom range modest, and reserve spectacular zooms for moments with no
sprite on screen. The editor says so in the form.

## 4. Two products, not one

The constraints split the feature cleanly in two. Confusing them is the
main design risk.

**M7-A — the cinematic screen.** A still visual, image or map, that zooms.
Non-interactive: no hero, no walking, no dialogue. An intro, a title
screen, an entry into battle. Self-contained, and it breaks in `m7.c`
without touching a single sprite.

**M7-B — the world map scene.** A Mode 7 plane you MOVE on: the hero as a
sprite, a camera that follows, zoom and rotation, collision, events that
warp to ordinary scenes. A complete gameplay system, comparable in volume
to everything around `map.c` and `player.c`.

A-then-B is not a preference, it is a dependency: A proves the hardware
path and the toolchain at the cost of one throwaway file, and B is only
worth designing in detail once a Mode 7 frame has been seen on screen.

Note where each one belongs in the author's vocabulary: **A is a SCREEN**
(the project already has them — `ScreensModal.tsx`, `showcase/screens/`,
the "go to screen" command), and **B is a SCENE TYPE**. A is not a scene,
and B is not an option ticked on an existing scene — see §8.2.

## 5. Data formats

### 5.1 The Mode 7 tileset (a resource)

A Mode 7 tileset is a resource of its OWN, never a reinterpreted chipset.
Otherwise the author paints with a tileset used elsewhere and discovers
that the flips and the per-tile palettes are gone.

- at most **256 unique 8x8 patterns** after deduplication;
- at most **128 colours**, mapped to CGRAM 0-127 (§3.4);
- no star, no directional passability bits per corner: passability is a
  flat table of 256 bytes indexed by tile — simpler than the metatile
  model because there are no metatiles.

datagen validates at generation time and never at runtime: the pattern
count, the colour count, a duplicate name, a tile referenced by a map but
absent from the tileset.

### 5.2 The Mode 7 image (M7-A)

Not a new resource: the author picks an ordinary **picture**. datagen
produces the Mode 7 form of it on demand — quantise to 128 colours,
deduplicate into patterns, and if it still does not fit in 256, downscale
until it does.

**Auto-fit, never an error.** The count is computed in the editor at
selection time and the RESULT is previewed (§8.3). The author never reads
the word "tile".

### 5.3 The zoom ramp

The author gives a start percentage, an end percentage, a duration and a
curve. datagen compiles that into a table of 8.8 values fed straight to
`setMode7Scale`.

```
m7_ramp<i>[]  : u16 x N, one 8.8 scale factor per frame
m7_ramp_len[] : u8 x N
```

Compiling the ramp OFFLINE is what keeps the runtime free of the
reciprocal: the scale register wants 1/zoom, and a division per frame is
exactly what P4/P5/P6 spent their effort removing. The engine reads the
next cell and writes two registers.

Four presets ship with it — slow zoom in, impact, zoom out, pulse —
alongside the free fields.

### 5.4 The world map scene (M7-B)

An optional `kind` on the scene, absent by default:

```json
{
  "name": "monde",
  "kind": "worldmap",
  "m7_tileset": "monde_m7",
  "tilemap": [ /* 128 x 128, tile indices */ ],
  "player_start": [64, 64],
  "events": [ /* ... */ ],
  "warps": [ /* ... */ ]
}
```

`kind` absent means an ordinary scene and MUST produce byte-identical
output for every existing project — that is what `gate-datagen.sh` checks
at each step.

## 6. Runtime module (`m7.c`)

Modelled on `stage.c`, and deliberately tiny:

```
m7_request_open(img, dur)   force-blank, fade, switch to Mode 7
m7_zoom(ramp, loop)         play a compiled ramp
m7_request_close(dur)       -> internal warp, back to the scene
m7_active()  m7_busy()
m7_update()  m7_vblank()
```

The hook points already exist in `engine/src/main.c`: a **third branch**
alongside `picture_active()` and `stage_active()` (lines 271-341). The
close goes through the internal warp of §2, so nothing new is invented
for the way back.

Opening is under force-blank: 32 KB is far past any VBlank budget, and
there is nothing to show during the fade anyway.

`M7B`/`M7C` are zeroed at open — `setMode7Scale` does not touch them, and
leaving them stale produces a shear.

## 7. The world map (M7-B)

### 7.1 The camera

Position, zoom and rotation of the plane, written as `M7A`-`M7D`,
`M7X`/`M7Y` at VBlank. Following the hero is a subtraction in world
space; the transform is applied once, to the camera, not per tile.

### 7.2 The sprite loop — the real cost of this system

On an ordinary scene, an event's screen position is a subtraction:
`screen = world - camera`. That path is hand-written in assembly
(`engine/src/actorsfast.asm`, the P4 work).

On a Mode 7 plane, the plane rotates and scales under the sprite, so the
matrix has to be applied per event:
`x_screen = A*(x-cx) + B*(y-cy) + ...`. Multiplications, in a per-frame
path — precisely what P4, P5 and P6 removed.

Two consequences:

1. **A second sprite loop is needed.** The current fast path cannot do
   this. A world map scene needs its own.
2. **The hardware multiplier shares its registers with the matrix.**
   `M7A`/`M7B` (`$211B`/`$211C`) double as the operands of the SNES's
   signed 16x8 multiplier, the product appearing in `$2134-$2136`. Using
   it CLOBBERS the scale matrix, which the PPU reads while rendering. So
   the position maths has to run **during VBlank**, with the matrix
   rewritten before rendering resumes.

That puts the pressure on the engine's tightest resource, the one that
already has an arbitration system (`vbudget.c`, P5). The performance risk
of this system is here — not in the zoom, which is eight register writes.

**Measured by the spike** (§10, and `PERF_MEASUREMENTS.md` §7): sixteen
sprites at four multiplies each, written in C, cost **~41 screen lines**
against a VBlank window of 37. The C path does not merely strain the
budget, it OVERRUNS it. Writing this loop in assembly is therefore not an
optimisation to consider later, it is the condition for M7-B to exist at
all. Extrapolating P4's 2.7x C-to-assembly ratio puts it near 15 lines,
which would fit — but that is an extrapolation, and the assembly figure
has not been measured.

### 7.3 Events

Events are NOT lost on a world map. What is lost is dialogue.

| Works | Falls away |
| --- | --- |
| Placement, pages, conditions (switches / variables) | Message and Choice (no BG3) |
| Movement routes | HUD widgets, the cursor list |
| Touch, Auto and Parallel triggers | The Action trigger — it would open a textbox |
| Warps, switches, variables, sounds, music | TILE appearance (T4) — no upper layer, no priority bit |
| Screen effects, transitions, the zoom itself | |
| The event's sprite (the OBJ region is outside the Mode 7 area) | |

A "town entrance" event with a Touch trigger that warps works perfectly.
That is the whole vocabulary of a world map, and it is why B is viable
where "an ordinary scene in Mode 7" is not.

### 7.4 Collision

From the tileset's 256-byte passability table (§5.1), read per 8x8 tile.
No metatiles, so no indirection.

## 8. Editor

The system is only worth building if it stays usable by an author who has
never heard of Mode 7. Five rules, in decreasing order of importance.

### 8.1 The words "Mode 7" never appear

It is an implementation detail: it belongs to the engine and to `docs/`.
In the editor the command is **"Zoom cinématique"** and the scene type is
**"Carte du monde"**. The engine module is `m7.c`. The two vocabularies
never meet — exactly as "écran composé" and `STAGE` do today.

### 8.2 The scene type is chosen at CREATION, not ticked afterwards

Mode 7 is not a rendering option: it changes what a scene may contain
(§3.2, §3.3). A checkbox on a finished scene would silently strip the
upper layer, the flips and the palettes.

So: a type in `NewSceneModal.tsx` — "Scène classique" or "Carte du
monde". From then on the editor adapts, removing what is unavailable
rather than letting the author find out the hard way:

- the upper-layer tab disappears;
- the tile palette is restricted to the scene's Mode 7 tileset;
- the size is bounded to 64x64;
- the command picker hides Message, Choice and the HUD widgets;
- `DiagnosticsModal.tsx` catches in plain words anything that slips past.

The author still paints with the same `MapCanvas.tsx` and the same
gestures. That is the point.

Converting an existing scene stays possible, but as a CONVERSION with a
preview of what will be lost — never as a switch.

### 8.3 Auto-fit, shown, never an error

When the author picks a picture for a cinematic zoom, the editor converts
it there and then and shows the before/after:

> *"Cette image sera simplifiée pour le zoom : 128x112, 96 couleurs."*

The project already has this gesture in `TransparencyPickModal.tsx` — a
technical decision turned into a visible choice at import. An "advanced
options" disclosure gives control to whoever wants it; by default it just
works.

### 8.4 One command, not three

The engine keeps three primitives (§9) because that is the engine's job.
The editor exposes ONE command that chains them: image, from % to %,
duration, curve, "wait for the end". One line in the event list, and no
way to leave the screen open by mistake.

The advanced form exposing the three primitives comes later, if ever.

### 8.5 The preview shows the REAL result

Not a CSS approximation: the same conversion datagen applies, hence the
real colours and the real chunky pixels. An author who tunes a zoom on a
crisp image and gets something else in game is the worst outcome of the
whole system.

The infrastructure is there — `AnimationsModal.tsx` already does canvas,
timeline and playback, `UiThemeModal.tsx` already does faithful live
preview. The conversion is written ONCE, in datagen, and the editor calls
it; two implementations would drift and the preview would start lying.

## 9. Opcodes

Free from **0x40** onwards (`SETLOC` at `0x3F` is the last one used,
`tools/datagen/src/script.rs`).

| Opcode | Arguments | Role |
| --- | --- | --- |
| `M7OPEN` | `img u8, dur u8` | Opens the Mode 7 screen under a fade |
| `M7ZOOM` | `ramp u8, flags u8` | Plays a ramp; flags bit 0 = loop, bit 1 = wait |
| `M7CLOSE` | `dur u8` | Closes it — internal warp back to the scene |

The wait reuses the VM's non-UI wait mechanism, as `VM_WAIT_STAGE` does.
A looping ramp never blocks, for the same reason a looping animation does
not.

## 10. What the spike proved

Four unknowns, all at toolchain or hardware level, none of them at design
level. **M7-0 has run**: a throwaway ROM, 128x128 image cut into 256
distinct tiles (the full hardware budget), driven through the snes9x
libretro core by `tools/regress/harness.c`, with VRAM and WRAM dumped and
compared against the bytes the generator produced.

1. **The interleaved VRAM write — WORKS, and PVSnesLib already has the
   helper.** `dmaCopyVram7(src, addr, size, vrammodeinc, dmacontrol)`
   exists for exactly this: `dmacontrol` is `(BBAD << 8) | DMAP`, so
   `$1900` writes the high bytes through `$2119` and `$1800` the low
   bytes through `$2118`, with `vrammodeinc` going to `VMAIN`. The VRAM
   dump came back byte-identical to the source on all three transfers —
   16 KB of map, 16 KB of chars, and an isolated 64-byte control write
   into a region Mode 7 does not use. No hand-written DMA needed.
2. **`setMode7Scale(u16, u16)` through tcc-816 — WORKS.** The spike drives
   the same 2x scale twice, once by writing `M7A`/`M7D` by hand and once
   through the library, and captures both frames. They are byte-identical
   PPMs. The `(u16, u16)` pair survives; note this is NOT the `(u8, u16)`
   shape that is known to break.
3. **The multiplier / matrix conflict — SURVIVABLE.** Using `M7A`/`M7B`
   as the signed 16x8 multiplier returned the right product (300 x 7 =
   2100, read back from `$2134-$2136` through a WRAM dump), and the frame
   captured after the matrix was rewritten in the same VBlank is
   byte-identical to a clean one. Clobbering and restoring inside the
   VBlank leaves no trace.
4. **The per-sprite cost — MEASURED, and it is the real constraint.**
   Sixteen sprites at four multiplies each, in C: **~41 screen lines**
   (45 measured, less the ~4 lines the two C-written V-counter reads cost
   by `PERF_MEASUREMENTS.md` §1) against a 37-line VBlank. It overruns.
   See §7.2.

Two things worth keeping from the run. `B` and `C` must be zeroed
explicitly at open — `setMode7Scale` does not touch them and a stale
value shears the plane. And putting the rotation centre on the image
(`M7X`/`M7Y` = 64,64) with the scroll placing it at the centre of the
screen (`HOFS` = -64, `VOFS` = -48) is what makes the zoom happen AROUND
the picture instead of dragging it off the top-left corner.

Everything here was checked on the emulator. Nothing has run on hardware.

## 11. Breakdown

1. **M7-0 — the spike.** ✅ A throwaway ROM outside the project: one
   image, Mode 7, a zoom. Answered all four unknowns of §10, including
   the cost measurement that was meant to wait. Deleted afterwards — the
   findings are §10, the code was worth nothing once read.
2. **M7-A1** — datagen: the Mode 7 image conversion (§5.2) and the ramp
   compiler (§5.3). Byte-identical output on existing projects.
3. **M7-A2** — the `m7.c` module (§6) and the three opcodes (§9).
   Testable from a hand-written project, with no editor — the way A1-a
   validated the animation player.
4. **M7-A3** — the editor: the "Zoom cinématique" command, the presets,
   the auto-fit preview (§8.3-8.5).
5. **M7-B1** — the Mode 7 tileset resource (§5.1) and the `worldmap`
   scene type in datagen (§5.4).
6. **M7-B2** — the camera and the second sprite loop (§7.1, §7.2). The
   measurement of §10.4 gates the scope here.
7. **M7-B3** — the editor: the scene type at creation and the restricted
   tools (§8.2).

Each step is deliverable on its own. A is worth having without B; B is
not worth starting before A has run on hardware.

## 12. Gates

- `gate-datagen.sh` stays green at EVERY step: adding a resource kind
  must not move a byte of the existing projects' output.
- `regress.sh` gains a Mode 7 case once M7-A2 lands — open, zoom, close,
  pixel comparison.
- `gate-editor.sh` covers the new command form (`smoke:commands`) and,
  for B, the new scene type (`smoke`).
- The V-counter profiler (S6) is the instrument for §10.4; the S6 debug
  panel gains the Mode 7 budget line.
