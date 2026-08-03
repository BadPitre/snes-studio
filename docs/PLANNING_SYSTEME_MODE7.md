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

### 5.1 The tileset of a world map — the PROJECT's tilesets

**A world map uses the project's ordinary tilesets.** It names one the way
any scene does, and datagen compiles its Mode 7 form. There is no Mode 7
tileset resource and no new category in the Resource Manager: one
library, painted with one window.

This CORRECTS the first answer in this document, which said a Mode 7
tileset had to be a resource of its own so that an author would not paint
with a sheet used elsewhere and lose its flips and palettes. That worry
was right; the conclusion was not. The losses are real, but they are
losses in the RENDERING of a map the author deliberately made a world
map — the editor can say so plainly — and they do not justify a second
tileset library to keep in step with the first.

What made the correction possible is a fact about the existing format
rather than an opinion: a project chipset is already a grid of 16x16
metatiles carrying up to 256 colours, and the engine already loads the
full BG CGRAM, colours 0-127, per scene (`SPEC_FORMATS.md` §0.3). That is
EXACTLY the half of CGRAM Mode 7 needs (§3.4). The Mode 7 image had to
become its own asset because a picture is 4bpp and capped at 16 colours;
a tileset has no such cap, so the same reasoning does not carry over.

What the plane cannot carry, and the editor must say when a scene is
turned into a world map:

| Lost | Why |
| --- | --- |
| Flips | No flip bit in a one-byte map entry — a mirrored tile becomes a distinct pattern and costs budget |
| The 8 palettes of 15 | One global palette; datagen merges into 127 colours plus the reserved black |
| The star (upper layer) | One plane, so no priority bit |
| Half the patterns | 256 rather than 512 chars |

Compilation is the metatile path of any chipset: each 16x16 block is cut
into its four 8x8 quadrants and the quadrants are deduplicated globally,
so a flat block costs ONE pattern and not four — reuse pays here as it
does everywhere else in Mode 7. Over 255 patterns the tileset is REFUSED
rather than auto-fitted, unlike an image (§8.3): shrinking a picture
loses detail an author can live with, shrinking a tileset would break
every map already painted with it.

**AUTOTILES work, and they are why the unit of conversion is the MAP and
not the chipset.** An id `1000+k` is not a block in the sheet: it is a
block COMPUTED from its neighbours, so it has no pixels to convert and
the plane has nowhere to compute it at run time. The first version
converted the chipset and refused every map painted with an autotile —
`bloc 1001 : le tileset n'en a que 11`, which is true and useless.

What it does instead is compose, per map, the 16x16 blocks the author
actually painted, autotile variants resolved through the same
`key_of_cell` / `tile_quarters` pair the ordinary scene path uses. A
world map and a classic scene painted identically therefore produce the
same picture, which is the whole promise of "keep the tileset system".

Two consequences worth stating:

- **The budget is spent on what is on screen.** Converting the chipset
  paid for its unused corners; converting the map does not. A 64x64 map
  using two autotiles measured 24 distinct blocks and 50 patterns of the
  256 available, against 35 for the bare chipset with nothing painted.
- **An autotile costs one block PER VARIANT.** A lake's interior, its
  four edges and its corners are different blocks. That is the honest
  price of computing borders ahead of time, and it is why the budget is
  reported per map at build time rather than per tileset. `datagen
  m7-tileset` remains an upper bound on the sheet alone — it cannot see
  the variants, because they depend on the painting.

Passability comes from the tileset's existing sidecar. It needs no
metatile indirection here, so it flattens to one byte per pattern.

**Measured on the repository's real tilesets** (`datagen m7-tileset`):

| Tileset | Blocks | Patterns of 256 |
| --- | --- | --- |
| `tileset.png` | 11 | 35 |
| `tileset_automne.png` | 6 | 21 |
| `chemin_auto.png` | 12 | 21 |
| `eau_auto.png` | 12 | 17 |
| `bourg.png` (a full RM2003 chipset) | 288 | **808 — refused** |

So the budget is comfortable for a tileset made FOR a world map, and out
of reach for a complete town chipset. That is the right shape: nobody
paints an overworld with a 288-block interior sheet, and the author who
tries gets a sentence saying how far over they are rather than a broken
map. The `m7-tileset` subcommand exists so the editor can say it while
they choose, not at build time (§8.2).

### 5.2 The Mode 7 image (M7-A)

A Mode 7 image is its **own asset**, living in `assets/mode7/`, and
`mode7.images` names PNG paths exactly as `pictures` and `vignettes` do.

That corrects this document's first answer, which was "not a new
resource, the author picks an ordinary picture". Implementing it showed
why that cannot work: a project **picture is a 4bpp resource, validated
at 16 colours**. Sourcing a Mode 7 image from one caps it at 16 and
throws away the exact thing 8bpp is for. The two are genuinely different
assets and pretending otherwise costs the feature its point.

Nothing is lost for the author: pointing at an ordinary picture's PNG
still works — it is just a path — and the editor still shows one "pick an
image" control (§8.3). The distinction lives in the resource kind, which
the R2 model makes cheap, not in what the author has to think about.

datagen then produces the Mode 7 form: quantise to 128 colours (median
cut, deterministic), deduplicate into patterns, and if it still does not
fit in 256, downscale in eighths until it does.

**Auto-fit, never an error.** Measured on real images: a 256x224 title
screen fits UNTOUCHED at 134 patterns, because a title screen reuses
tiles heavily; a 256x224 image of fine detail comes back at 128x112 with
224 patterns and 123 colours — the "quarter of the screen, shown at 2x"
of §1, arrived at by measurement rather than by arithmetic. The result is
previewed (§8.3); the author never reads the word "tile".

Fidelity, checked by rebuilding the image from the emitted C: on an image
that is not downscaled the error is at most **one 5-bit step (7/255) on
every pixel** and no more — the unavoidable 8-to-5-bit quantisation, and
nothing structural on top of it.

### 5.3 The zoom ramp

The author gives a start percentage, an end percentage, a duration and a
curve, ON THE COMMAND — there is no ramp resource to manage. datagen
walks every JSON file of the project, collects the DISTINCT zooms and
compiles one table each, so a zoom used on ten commands costs one table.

That walk is recursive over the raw JSON rather than a tour of the typed
structures: commands nest inside `then`, `else` and `do`, and a
hand-written list of the places to look would rot at the first new
container. One caveat recorded in the code: this crate's serde_json has
no `preserve_order`, so object keys are visited ALPHABETICALLY — inside
an `if_var`, `else` before `then`. Surprising, but reproducible, which is
the only property the ramp indices need.

The tables are 8.8 values fed straight to `setMode7Scale`.

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

Three numbers: where the plane is centred, how much it is scaled, and how
much it is turned. They go out as eight register writes per VBlank —
`M7A`-`M7D` from a table, `M7X`/`M7Y` and `M7HOFS`/`M7VOFS` from the
camera — and that is the entire per-frame cost of the plane itself.

Following the hero is a SUBTRACTION in plane space, not a transform:
`M7X`/`M7Y` take the hero's plane position and `HOFS`/`VOFS` bring that
point to the middle of the screen, exactly as `m7_place()` already does
for a still image. Nothing is multiplied to move the camera; the matrix
does the work.

**Rotation is deferred.** Scale alone needs `A = D = 1/zoom` with
`B = C = 0`, which the compiled ramps already provide (§5.3). Turning
the plane needs `A = cos/zoom`, `B = -sin/zoom`, `C = sin/zoom`,
`D = cos/zoom` — four table lookups instead of one, and a sine table.
That is cheap to add LATER and expensive to design around now, so B2
ships scale-only and rotation becomes its own step. The register writes
are identical either way; only where the four values come from changes.

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

**Measured by the spike** (§10, and `PERF_MEASUREMENTS.md` §6): sixteen
sprites at four multiplies each, written in C, cost **~41 screen lines**
against a VBlank window of 37. The C path does not merely strain the
budget, it OVERRUNS it.

**What actually shipped went the other way, and the premise was the
thing to attack.** The reasoning above binds only if the transform uses
the PPU multiplier. §7.2h does the arithmetic in software instead, so it
touches nothing the PPU reads and runs in the MAIN LOOP, where the budget
is a whole frame instead of 37 lines. Each multiply and divide costs far
more, but the window is three times bigger, and three NPCs a frame fit in
it — measured, not extrapolated. The assembly loop was never written and
the 15-line estimate below is still an estimate; it is simply no longer
the precondition for M7-B to exist.

**The plan for B2, in the order it should be built.** Each step ends in a
number, because this is the one part of the system where a wrong guess
costs a rewrite rather than a tweak.

1. **Open the plane.** ✅ `m7_world_open(scene)` expands the metatile map
   through the quadrant table and displays it, from the boot scene and on
   a warp INTO a world map. Verified on a 64x64 map painted with the
   demo's own tileset: water, grass, sand and trees, stable across
   frames, with the hero's sprite on it.

   Two things came out of it. The sprite needs NO transform at scale 1:1
   with no rotation — `player_draw` writes the OAM shadow as it always
   does and the position is simply right — so step 3 below starts from
   something that already works rather than from nothing. And the
   "black screen" reported one session earlier was **a stale build**, not
   the code: the same source, rebuilt clean, came up correct on the first
   try. The lesson is the one this project already learned once (the
   ghost hearts of the dialogue bug, task 85): when an engine change
   produces nothing at all, re-run `snesbuild clean` before believing the
   symptom.

2. **Pitch the plane and move the camera.** ✅ The camera follows the
   hero and the plane is drawn in PERSPECTIVE — see §7.2b, which turned
   out to be the whole point of the exercise.
3. **One sprite, transformed in C.** The hero alone. Measure it with the
   V-counter. One sprite is ~2.5 lines by the spike's figure, so this
   MUST fit — and if it does not, the assumption behind the whole design
   is wrong and B2 stops here rather than after the assembly is written.
4. **The assembly loop.** Only now, with a working reference to compare
   against pixel for pixel. Measure again. The gate is §10.4's number:
   the loop plus everything else the VBlank already owes must stay under
   37 lines, with the P5 arbiter measuring it rather than a guess.
5. **Collision and warps**, which are data and cost nothing per frame.

**Where the maths goes.** The multiplier's operands ARE `M7A`/`M7B`, so
the transform can only run while the PPU is not reading them — inside the
VBlank, with the matrix rewritten before rendering resumes (§10.3, proved
by the spike). That puts the loop in the same window as every DMA the
engine already does, which is why step 4 measures the WHOLE window and
not just the loop.

**The fallback if step 4 does not fit**, decided now so it is not decided
under pressure: cap the number of transformed sprites per frame and
round-robin the rest, exactly as the vignettes already cap themselves to
one cell transfer per VBlank (`PLANNING_SYSTEME_ANIMATIONS` §3.3). A
world map with eight moving things that all update every frame is not
worth a system that cannot ship; eight that update over two frames is.
The rule must be CHECKABLE and stated to the author, not silent.

### 7.2b The pitch — without it, none of this is visible

The first world map that displayed correctly was reported back as "it
looks exactly like a classic scene". That report was right, and it is the
most useful thing anyone said about this system.

**A Mode 7 plane with the identity matrix IS a flat top-down map.** The
hardware is in mode 7, the VRAM is interleaved, the tilemap is 128x128 —
and the picture is indistinguishable from the same scene rendered on BG2
in mode 1. Put the two captures side by side and only the tile alignment
differs. Everything §5 to §7.2 builds is a PREREQUISITE for the effect;
none of it is the effect. What makes a plane read as Mode 7 is the
PITCH: the floor laid under the camera, converging to a horizon.

**How it is done.** The PPU computes, per screen pixel:

```
px = A*(x + HOFS - X0) + B*(y + VOFS - Y0) + X0
py = C*(x + HOFS - X0) + D*(y + VOFS - Y0) + Y0
```

Choosing `HOFS = X0 - 128` and `VOFS = Y0 - HORIZON` turns the two
parenthesised terms into `(x - 128)` and `d = y - HORIZON`, the line's
distance below the horizon. With `B = C = 0` — no rotation, north stays
up, which is what a world map wants — that leaves:

```
px = A(y)*(x - 128) + X0        A(d) = dA/d
py = D(y)*d + Y0                D(d) = -(dA/d)^2
```

`dA` is the distance from the horizon to the ANCHOR line, the one row
drawn 1:1 and where the hero stands. `D` is NEGATIVE so that far away is
UP the map rather than down it.

The property that makes this cheap: **A and D depend only on the horizon
and the anchor, never on the camera.** The two tables are built once when
the map opens (224 divisions, screen off) and the camera then moves
through `X0`/`Y0` alone — four register writes per frame, no arithmetic
at all. Contrast with the sprite loop of §7.2, which is per-frame maths
and is why that step is still open.

A and D are per-scanline values, which is what HDMA is for: channels 6
and 5 in mode `$02`, one register written twice (`M7A` and `M7D` are
double-write). Channels 3-6 belong to `hdmafx`, but its three effects are
map ambience and the Mode 7 VBlank branch suspends them — so the branch
must call `hdmafx_suspend()` BEFORE `m7_vblank()`, or the suspend wipes
the mask the perspective just wrote.

**The sky needs a window, not a bigger number.** Above the horizon the
plane must not be sampled at all. Pushing `A` to a large value sends most
columns outside the 128x128 area, where `M7SEL`'s "repeat character 0"
gives a clean sky — but the columns NEAR `x = 128` are multiplied by
almost nothing and stay inside it. The result is a rectangle of map
floating in the sky, and no finite `A` removes it. The fix is to mask BG1
above the horizon with window 1 (`W12SEL = $02`, `TMW = $01`), the window
bounds coming from a third HDMA channel in REPEAT mode — two constant
bands, ten bytes for the whole screen. The sky is then CGRAM 0, which is
also where a sky colour or gradient would go.

**One bug this uncovered, worth keeping.** `player_draw` caches what it
last wrote to OAM, including the hero's 9th X bit. Opening the plane hides
all 128 sprites, and `oamSetVisible(OBJ_HIDE)` parks them at x = 511 by
SETTING that bit. The cache still said "not set", so the next draw skipped
the write that would have cleared it: the hero was drawn, correctly, off
screen. `player_draw_reset()` now drops the caches, and the rule is
general — anything writing those OAM entries from outside must say so.

### 7.2c The camera ANGLE — two numbers, and why they are data

A Mode 7 camera is described completely by two screen lines: the one the
ground vanishes into (HORIZON) and the one drawn 1:1, where the hero
stands (ANCHOR). Their DIFFERENCE is the whole tilt — 176 lines apart is
almost a top-down map, 56 is an F-Zero floor. Nothing else about the view
is adjustable, and nothing else needs to be.

They were `#define`s. They are now:

- **Scene data.** `m7_horizon` / `m7_anchor` on a `worldmap` scene, absent
  meaning the default 56 / 176. datagen writes them into `m7w_horizon[]`
  and `m7w_anchor[]`, and the engine reads them when the plane opens.
- **Reachable from a script**, opcode `M7VIEW`, event command `m7_view`.

The editor and datagen both offer NAMED presets — plongeante, standard,
rasante, tres_rasante — with the two raw lines behind a "custom" entry.
"Horizon 88, anchor 168" describes nothing to an author; "rasante" does.
The engine still takes lines, so the names cost nothing at run time and
the numbers are never out of reach.

**Validation splits by who can still fix it.** datagen REFUSES a bad
angle: the author wrote it in a file and can correct it. The engine
CLAMPS: a script can reach `m7_view` through a variable, and a world map
that stops rendering because a number was silly is worse than one drawn
at the nearest sane angle. The floor is 16 lines of gap, which is where
`D = (dA/d)^2` leaves its 8.8 register — below it the whole screen is
sky.

**The change is instant and costs one torn frame.** The tables are
rebuilt in the main loop, so the HDMA may read them half-rewritten.
Building them inside the VBlank is 224 divisions in a 37-line window, and
a camera angle changes on a dramatic beat, not every frame. A SMOOTH
transition between two angles would mean rebuilding every frame, which is
why it is not offered rather than offered badly.

### 7.2d Rotation — 16 steps, compiled, in ROM

Turning the view around the hero needs `B` and `C` as well as `A` and
`D`. At rotation `t`:

```
A = s*cos(t)       B = s^2*sin(t)
C = s*sin(t)       D = -s^2*cos(t)
```

Four per-scanline coefficients — but **two HDMA channels**, not four.
`M7A`/`M7B` are ADJACENT registers (`$211B`/`$211C`), `M7C`/`M7D`
likewise, and transfer mode 3 writes two adjacent registers twice each
per line: exactly the shape a pair of double-write registers wants. One
channel carries A+B, one carries C+D, and with the sky's that makes
three of the five a world map has free (0 is the general DMA's, 2 the
scripted wipe's, 7 the NMI's OAM). The two channels left over are what
the dialogue band (§7.2i) and the sky gradient live on.

**This replaced a four-channel version, and the history is worth a
paragraph.** The first rotation spent one channel per coefficient in
order to HALVE its ROM: `sin(t) = cos(t - 90)` lets one family of tables
serve two coefficients a quarter turn apart — but only if each register
has its own channel, since the pairing fixes which two values share a
line. Four coefficient channels plus the sky mask is five: every free
channel spent, and a dialogue on a turning map was impossible — an
author hit exactly that, a box that opened, froze the hero and never
drew. The quarter-turn identity was a false economy: it saved ~14 KB of
ROM per map on a cartridge standing three-quarters empty, and the thing
it spent was the scarcest resource the console has.

**Why they cannot be built at run time.** 224 lines x 4 values is ~900
multiplications for one angle change. §7.2 measured SIXTY-FOUR
multiplications in C at ~41 screen lines against a 37-line VBlank. Not a
matter of optimising: a factor of fourteen over a budget already
overrun. So the tables are **compiled by datagen** and live in ROM, the
same answer the zoom ramps got in §6 for the same reason.

**The format.** Per angle `k`, TWO paired tables:

```
ab[k]: per line  A = s*cos, B = s^2*sin     -> channel 6, M7A+M7B
cd[k]: per line  C = s*sin, D = -s^2*cos    -> channel 5, M7C+M7D
```

Four bytes a line, two blocks of 112 — 899 bytes a table, 32 tables =
**28 KB per map at 16 steps**. Turning the view is TWO POINTER WRITES
per frame. Opt-in per scene (`m7_rotate`), so a map that never turns
pays nothing. 16 rather than 15 or 20 only because a power of two lets
the engine wrap the angle with a mask instead of a modulo.

**The tables stay in ROM and are never copied.** HDMA reads its source
from any bank, but a DMA needs the source's BANK and C cannot give it —
tcc-816 passes a four-byte pointer, `(u32)p` keeps the low 16 bits and
sign extends (`ENGINE_CONSTRAINTS` §1.3). `m7_arm` in
`engine/src/vramfast.asm` reads the four bytes off the stack, exactly as
`vj_set` does. That is the whole reason there is no 28 KB WRAM buffer
and no load-time copy. Each table is emitted as its OWN array so the
linker keeps it inside one bank: HDMA does not carry the bank across a
boundary, it wraps within it.

**The camera centre turns too.** The rotation centre is the hero pushed
`dA` units behind the camera, and "behind" turns with the camera — hence
`(-dA*sin, +dA*cos)` per angle, a 16-entry table, rather than the flat
case's `(0, +dA)`. Without it the hero drifts off the anchor line as the
view turns.

**Smooth turning, and what it costs.** Two different things hide behind
"smooth", and only one of them costs anything.

- **The MOTION is free.** `m7_rotate_to(angle, frames)` walks the steps
  itself, the short way round — turning 350 degrees to face 10 is what a
  naive count-up does, and it looks like a mistake because it is one.
  Changing angle is four pointer writes, so this is a counter and a
  comparison, and it is what actually makes a turn read as smooth.
  Opcode `M7TURN`, and it can block the script like the zoom ramp.
- **The RESOLUTION costs ROM**, and it is a PER-MAP choice — 16, 32 or 64
  steps. Per-frame recomputation is not an option and can be shown so:
  one angle change is 224 lines x 4 coefficients = ~900 multiplications,
  against a spike that measured SIXTY-FOUR of them at ~41 screen lines in
  a smaller window. Fourteen times over, and P4's measured 2.7x
  C-to-assembly ratio still leaves a factor of five.

| Steps | Angle | ROM per map |
| --- | --- | --- |
| 16 | 22.5 deg | 28 KB |
| 32 | 11.25 deg | 56 KB |
| 64 | 5.6 deg | 112 KB |

64 is the sweet spot: at one step a frame a full turn takes about a
second and 5.6 degrees no longer reads as a jump. And the budget is now
a measured number rather than a worry — `snesbuild` prints ROM occupancy
from wlalink's own per-bank report, and the world map test project sits
at **274 KB of 1024 with 23 empty banks**. The .sfc's SIZE says nothing:
it is padded to the size declared in the header.

**One thing 64 steps broke, worth keeping.** tcc-816 puts a file's arrays
in ONE section and WLA places a section wholly inside ONE bank, so 128
paired tables in one generated file would be a 115 KB section against a
32 KB bank —
`No room for section ".rodata"`. datagen now splits them sixteen tables
to a file. The rule generalises: a generated file must stay well under a
bank, however small its individual arrays are.

**Two limits, stated rather than hidden.**

- **`m7_view` kills the rotation.** The tables were compiled for the
  map's own pitch; a new pitch makes them wrong. The engine clears the
  rotation and snaps back to angle 0 rather than shearing the plane. The
  scene's angle comes back when it reloads.
- **North stops being up.** Movement and collision stay world-absolute
  while the view turns, so pressing up walks north whatever the screen
  shows. Making input follow the view is a design decision about the
  GAME, not about Mode 7, and it is not made here.

### 7.2e The sky — colour, then gradient

Above the horizon BG1 is windowed off, so what shows there is the
BACKDROP, CGRAM 0. Two products fall out of that, and they cost very
different things.

**A flat sky is one CGRAM write.** No HDMA channel, so it works under
rotation, which uses all five. Worth knowing: the backdrop is ALSO what
shows beyond the painted map's edges, so the sky colour is the
out-of-map colour too — which reads well as water or haze, and is
consistent with the horizon by construction.

**A gradient is colour math on the BACKDROP ALONE** — `CGADSUB = $20`,
no BG1 bit — with the fixed colour rewritten per scanline by HDMA on
`COLDATA`. screenfx's own gradient (S15) uses `$23`, which INCLUDES BG1:
on a world map that would tint the whole plane rather than the sky. So
this is a circuit of its own in `m7.c`, not a flag in screenfx — the
module already owns the window registers for the same reason. CGRAM 0
stays black under a gradient, so backdrop + fixed = fixed and the sky is
exactly the colour asked for.

`COLDATA` takes one component per write (bits 7-5 select B/G/R), so the
table uses HDMA mode `$02` — one register written twice — for two
components a line, rotating through R/G/B. Over the ~70 lines of sky that
is far more than the 31 steps a channel can need, and a component one
line stale is invisible.

**The gradient and rotation exclude each other**, and datagen refuses the
pair rather than dropping one silently: both want a channel and rotation
takes the last one. A flat sky remains available either way.

**One bug worth keeping.** The colour-math registers are set at open AND
REASSERTED EVERY FRAME. `screenfx_vblank` runs first in the Mode 7 branch
and rewrites `CGADSUB` whenever its own state is dirty, so the open-time
value survived exactly one frame and the sky came back black. Anything
this module asserts over screenfx's registers has to be asserted per
frame, not once.

### 7.2f An IMAGE sky — the mode switch spike

A picture above the horizon needs a second background layer, and Mode 7
has none. The way period games did it (Super Mario Kart, Contra III) is
to **switch the video mode mid-frame**: mode 1 above the horizon, mode 7
below, through an HDMA on `$2105`.

**A throwaway spike proved it holds in this engine.** Mode 1 with a test
tilemap on BG2 renders in the top band, the Mode 7 plane below is
untouched, and the transition line is clean. What the spike settled:

- The HDMA on `$2105` holds the switch. That was the whole unknown.
- **The channel count does not move.** The BGMODE channel REPLACES the
  sky window's: above the horizon we are no longer in mode 7, so the
  plane cannot leak there and there is nothing to mask. Five channels
  with rotation, as before.
- **BG1 must be silenced, and transparency is cheaper than a channel.**
  In mode 1 BG1 draws too, and its scroll registers `$210D`/`$210E` ARE
  `M7HOFS`/`M7VOFS` — rewritten every frame with plane coordinates, so
  BG1 would show a wildly shifted copy. Pointing its mode-1 tilemap at a
  ZEROED region makes it render char 0 everywhere, i.e. nothing. An HDMA
  on `TM` would also work and would cost the channel we do not have.
- **VRAM is free where it is needed.** `$6000-$7FFF` (16 KB) holds the
  BG2 map and the picture map, both meaningless while Mode 7 is up: sky
  chars at `$6000`, sky tilemap at `$7000`, BG1's blank map at `$7800`.
- **BG2's scroll registers are free** in Mode 7 (`$210F`/`$2110`), so the
  sky can pan with the camera — a parallax horizon comes for free.

**The one cost the spike surfaced.** Mode 1's BG2 is 4bpp and indexes
CGRAM 0-127 — exactly the half the Mode 7 plane uses (§3.4). A sky image
therefore takes 16 of the plane's colours, not colours of its own. The
trade is: reserve palette 7 (CGRAM 112-127) for the sky and cap the
plane at 112 colours when a map has one. Measured for scale: the test
world map uses 14 colours in total, so 112 is not a real constraint —
but it IS a format change to the plane converter, and it only applies to
maps that ask for an image sky.

An image sky and a gradient sky are mutually exclusive by construction:
the gradient colours the BACKDROP, and BG2 covers it. datagen refuses the
pair.

**Built, and what it looks like in the data.** The sky is an ordinary
16-colour PNG, at most 256x128 — the same constraints a project PICTURE
already has, so it needs no resource category of its own and the editor
picks from the pictures list. datagen compiles it to 4bpp chars for
`$6000`, a 32x32 tilemap for `$7000`, and SPLICES its sixteen colours
into the plane's palette at 112-127, so the engine still uploads ONE
CGRAM block. 256 wide is not a maximum but the natural width: BG2's map
is 32 tiles and wraps, so the picture loops seamlessly as the camera
turns.

`m7_sky_scroll` pans it a quarter of the camera's travel for distance,
plus one screen width over a whole turn — which is exactly right for a
looping 256-wide panorama — and puts its BOTTOM on the horizon.

**Colour 0 is transparent, and that is the point.** A cloud layer drawn
on index 0 lets the flat sky colour (CGRAM 0) show behind it, so the two
products compose instead of competing.

**The bug the first run produced: a striped sky.** `to_m7_sky` must
reserve CHAR 0 BLANK. BG1 is silenced by pointing its tilemap at a zeroed
region, which renders char 0 everywhere — and if char 0 is the picture's
top-left tile, BG1 papers the sky with it, scrolled by M7HOFS/M7VOFS.
Same reservation, and the same reason, as pattern 0 of the plane (§5.1).

### 7.2g An upper layer through EXTBG — the spike says STOP

**Question.** Can a world map have the scene's upper layer, the tiles
that pass IN FRONT of the hero?

**The hardware answer is yes, and it fits unusually well.** Mode 7 EXTBG
(`SETINI $2133` bit 6) renders the SAME plane twice: pixels whose bit 7
is set go to BG2 at high priority, the rest to BG1. The colour index
drops to seven bits — 0-127, which is ALREADY our rule (§3.4), so the
feature costs no colours at all. datagen would composite each (lower,
upper) pair into one block, bit 7 set on the pixels that came from the
upper tile, and the plane would carry both. The block compositor written
for autotiles (§5.1) is the same machinery.

**But it cannot be verified with the tooling this project has.** Three
builds — bit 7 on NO pixel, on HALF of each pattern, on EVERY pixel —
produce three different VRAM contents and **the same image, byte for
byte** (identical MD5). The hero is never occluded. Colours are also
unchanged, so the emulator does mask the index to seven bits: it knows
about EXTBG and simply does not apply the priority.

The emulator is snes9x libretro, the only core in the repository, and
there is no second one to cross-check against.

**So this is not built.** Not because the SNES cannot do it — it can —
but because shipping it would mean shipping a rendering path nobody can
look at, in a system where NOTHING has yet run on hardware (§12). A
feature that is invisible to every gate is a feature that breaks
silently. If a core that implements EXTBG priority (or real hardware)
becomes available, the design above is ready and the work is small.

**What IS verifiable today, and does the same job.** The OBJ region is
untouched in Mode 7 (§3.1), and the engine already turns a TILE into a
sprite block: "tile appearance" for events (T4). A tree top in front of
the hero is an event with a tile appearance, and it works on the plane
right now. It costs sprite budget rather than pattern budget, and it is
placed per event rather than painted — which suits landmarks, not
forests.

**Two spikes, two outcomes.** §7.2f proved a technique and it shipped;
this one refuted the ability to VERIFY a technique, and it did not. That
is what the spikes are for, and the negative one is worth as much as the
positive.

### 7.2h The NPCs — the inverse projection, and the cap it forced

Until this step a world map showed the hero and nothing else. Every other
sprite stayed hidden, because "position minus camera" is simply wrong on
a pitched plane: the ground is a perspective, so an NPC two tiles north
of the hero belongs HIGHER on the screen and NEARER the middle, not 32
pixels up.

**The maths.** The PPU goes screen -> plane. With `u = x - 128` and
`d = y - horizon`, the transform §7.2b sets up is

```
px - X0 = m*cos + n*sin        m = dA*u/d
py - Y0 = m*sin - n*cos        n = dA^2/d
```

and §7.2d puts the rotation centre at `(X0, Y0) = camera + (-dA*sin, +dA*cos)`.
Substituting the centre and inverting the rotation gives the other
direction, which is what a sprite needs — for `(ux, uy)` = the NPC minus
the camera:

```
L  = ux*cos + uy*sin
D0 = ux*sin - uy*cos + dA          D0 <= 0: behind the camera, cull
d  = dA^2 / D0                     y = horizon + d
u  = L*dA / D0                     x = 128 + u
```

Two divisions and four multiplications per NPC, all in 16 bits. They stay
there because `(ux, uy)` is shifted down by the SAME amount on both axes
(so the rotation stays a rotation) and because the second division is
split into a near case and a far one. `m7_project` in `m7.c`; the cosines
and sines come compiled in 8.8 alongside the rotation tables, since the
per-scanline tables go the other way and cannot serve.

Five checks pinned the sign conventions, read out of WRAM in the emulator
rather than judged from a screenshot:

| case | expected | measured |
|---|---|---|
| NPC on the hero's tile, rotation step 3 | (128, anchor) | (128, 176) |
| NPC 4 tiles east, step 0 | 64 px right, on the anchor | (192, 176) |
| NPC 4 tiles east, step 4 (90°) | straight ahead, far | (128, 134) |
| NPC 4 tiles east, step 8 (180°) | mirrored | (64, 176) |
| NPC 4 tiles east, step 12 (270°) | behind the camera: culled | culled |

**The cost, and the cap §7.2 promised.** Measured with the V counter on a
world map carrying 24 NPCs all visible around the hero — the worst case —
sweeping the per-frame budget:

| NPCs projected per frame | loop turns in 900 frames | cost |
|---|---|---|
| 0 | 498 (60 fps) | 2 lines |
| 1 | 498 (60 fps) | 34 lines |
| **3** | **498 (60 fps)** | **98 lines** |
| 4 | 272 (30 fps) | 131 lines |
| 5 | 249 (30 fps) | 162 lines |
| 6 | 249 (30 fps) | 194 lines |

**~32 screen lines per projected NPC**, and the frame holds three. With
the projection stubbed out the same loop costs ~13 lines per NPC, so ~19
of the 32 are the arithmetic itself: the two divisions are the price, and
only assembly would move them.

So `actors_draw_m7` takes the fallback §7.2 decided in advance: three
NPCs per frame, round robin over the rest, and the OAM of the ones not
reached is left untouched so nothing flickers. An INACTIVE slot costs a
byte read and does NOT spend budget, so the cap only bites when a crowd
is really on screen; a character then lags by up to `ceil(live/3)` frames,
which at half a pixel per frame is a few pixels of stagger in the
distance.

**Two limits stated rather than hidden**, both structural:

- **No scaling.** The SNES cannot scale a sprite. A distant NPC is a
  full-size character standing on the horizon. Mode 7 games solved this
  with several hand-drawn sizes of the same sprite — that is art, not
  code, and it belongs to a later step if the author wants it.
- **No depth order.** OBJ priority is the OAM index; reordering the OAM
  every frame costs more than the projection. A far NPC can be drawn over
  a near one.

### 7.2i The dialogue band — a textbox on a plane

Mode 7 has one layer and no BG3, so a textbox had nowhere to be drawn.
The way out is the one §7.2f already proved for the sky: leave Mode 7 for
the lines the box occupies. An HDMA on `$2105` puts the screen in mode 1
from the top of the dialogue band down, and BG3 draws the box there
exactly as it does on an ordinary scene.

Three things had to move, and none of them cost a byte per frame:

- **BG3 relocates.** Its map, its chars and its scrolls are all free in
  Mode 7 — nothing touches them. The plane owns `$0000-$3FFF`, so the
  font goes to `$7000` and the UI map to `$7C00`. `$7000` is the only
  free 4K-WORD boundary above the OBJ region (BG34NBA is a nibble),
  which is what pushed the sky tilemap onto `$7400`.
- **CGRAM 16-19** — BG3 palette 4, the font's — is reloaded after the
  plane's palette, which had just written over it. Three colours, against
  the sixteen an image sky costs.
- **Mode 1 is `0x09`, not `0x01`**: bit 3 is BG3's high priority, the
  value an ordinary scene uses. That is what puts the box above the
  sprites, so a dialogue layers here the way it does everywhere.

**The channel is the whole constraint — and it is why the rotation was
re-plumbed.** Channel 3 carries the sky (the window that masks the plane
above the horizon, or the sky picture's own BGMODE table); the band
needs a BGMODE table of its own, and it lives on channel 1 — on every
kind of map:

| map | channels | dialogue |
|---|---|---|
| does not turn | 6, 5 = A and D flat; 3 = sky; 4 = gradient | **works, band on 1** |
| turns | 6 = A+B, 5 = C+D (mode 3, §7.2d); 3 = sky | **works, band on 1** |

The second line existed as "refused" for exactly one release. The
four-channel rotation spent every free channel and a dialogue on a
turning map could not be drawn at all — an author hit it as "the box
opens, freezes the hero, and shows nothing". Pairing the rotation onto
two mode-3 channels (§7.2d) freed channel 1 everywhere, and the band no
longer has a special case. Verified in the emulator: the paired tables
render byte-identical to the four-channel ones (same MD5 at a
67.5-degree angle), and the box opens and closes cleanly on a turning
map with the sky mask intact.

**Two things measured the hard way**, both worth writing down so the next
attempt does not repeat them:

- A THREE-band table — mode 1 for the sky, mode 7 for the plane, mode 1
  for the dialogue — does not work. The band appears (the backdrop shows)
  but BG3 stops drawing in it. Reproducible with a correct table in RAM
  and the channel armed; unexplained. It is why the sky picture stands
  down while a box is open: everything above the band stays in Mode 7.
- **Closing the band needs an explicit `REG_BGMODE = 0x07`.** When the
  HDMA stops writing `$2105` the register KEEPS the last value it was
  given — mode 1 — and the plane never comes back: the whole screen stays
  the sky colour with the sprites on it. One register write a frame.

**A pre-existing bug the work surfaced.** The 2bpp font at `$1000` is
destroyed by ANY Mode 7 screen (the plane's `dmaFillVram16` covers it)
and was never reloaded, so a dialogue after closing a Mode 7 screen drew
garbage. `do_warp` now puts BG3 back where an ordinary scene expects it.

### 7.3 Events

Events are NOT lost on a world map — dialogue included, since §7.2i.

| Works | Falls away |
| --- | --- |
| Placement, pages, conditions (switches / variables) | HUD widgets, the cursor list |
| Movement routes | TILE appearance (T4) — no upper layer, no priority bit |
| Touch, Auto and Parallel triggers, and the Action trigger with its dialogue (§7.2i) | |
| Warps, switches, variables, sounds, music | |
| Screen effects, transitions, the zoom itself | |
| The event's sprite (the OBJ region is outside the Mode 7 area) | |

A "town entrance" event with a Touch trigger that warps works perfectly.
That is the whole vocabulary of a world map, and it is why B is viable
where "an ordinary scene in Mode 7" is not.

### 7.4 Collision

From a 256-byte per-map passability table (`m7w{i}_pass`), indexed by
COMPOSED block id: datagen swaps the world map's lower grid to composed
ids in `scenes.bin` (the same ids the plane's `map` uses), and
`scene_collision` reads `pass[tilemap[o]]` instead of the per-scene
collision grid. One table lookup, no metatile indirection — and it is
what lets a STREAMED map (§7.5) collide at full size while the plane
only holds a window: collision reads WRAM, never VRAM.

### 7.5 Big world maps — streaming the plane

The plane is 128x128 tiles and that is a hardware fact (§3.1); 64x64
blocks was therefore the map's ceiling. This section is how a map grows
to **128x128 blocks (2048x2048 px)** without touching that fact: the
plane holds a 64x64-block WINDOW centred on the hero, and the window
follows him.

**WRAM.** `scn_lower` and `scn_upper` are adjacent in `wram7f.asm`, and
a world map has no upper layer — so its one grid may spend BOTH buffers:
16384 cells, side capped at 128. The editor and datagen enforce the same
two numbers. The grid holds composed block ids (§7.4), so collision and
warps work over the whole map from WRAM alone.

**Placement is modulo, and the plane must WRAP.** World block (bx, by)
lives in plane cell (bx & 63, by & 63): no translation anywhere, the
hero's world coordinates go straight into X0/Y0 and the PPU's own
mod-1024 sampling does the rest. That requires `M7SEL = 0` (wrap) — on a
small map the register says "tile 0 outside the plane" so the sky shows
past the edges, but on a streamed map the hero spends most of his time
past 1024 px in world coordinates, and with that setting THE ENTIRE
GROUND rendered as sky. (Symptom worth remembering: plane provably
correct in a VRAM dump, screen almost all backdrop.) Outside the MAP the
window's cells hold tile 0, so the sky still shows past the edges,
exactly like a small map — and the streaming strips must write tile 0
there too, NOT meta block 0: block 0 is the eraser's black.

**Streaming.** Crossing a block boundary queues ONE incoming line of
blocks per axis: 64 far reads into two 128-byte strips in the main loop
(rows = quadrants 0+1 and 2+3; columns = 0+2 and 1+3), flushed next
VBlank as two DMAs each — rows with VMAIN $00, columns with VMAIN $02
(increment by 128 words, one write per plane row). The window trails the
hero one block per axis per frame; at 2 px/frame he cannot outrun it,
and a strip not yet flushed just delays the next crossing's build by a
frame. Cost: ~256 bytes of VBlank DMA on a crossing frame, nothing
otherwise.

**The sky pays for it.** The horizon must never see past the window's
edge, or the seam being rewritten would show. The line d below the
horizon samples dA²/d ahead and 128·(dA/d) to each side; rotated, the
far corner sits at (dA/d)·√(128²+dA²) from the camera, which must stay
inside the window's 512-px half minus a 16-px slack for the edge:

    cut = ceil(dA * isqrt(16384 + dA²) / 496)   (m7_persp_set)

`pv_sky` moves down to `horizon + cut + 1` — about 335 px of view at the
default tilt instead of ~900. The formula is rotation-safe, so the same
map may turn or not with no second case. (It also forced the sky
window's HDMA table to clamp its second block: with a deep sky there are
fewer than 127 ground lines, and the old fixed `224 - sky - 127`
underflowed.) The Mode 7 preview mirrors the same integer cut, so the
author sees the real view distance while painting.

**Warps.** A classic scene marks warp cells in the collision grid; a
world map has none, so `check_warp` scans the scene's warp LIST directly
there. The list is short (a handful of town entrances) and the scan only
runs on world maps.

Everything else — the dialogue band, rotation (paired channels), the
NPC projection, the gradient exclusion — is untouched: streaming is
invisible to every other subsystem because the window is invisible to
world coordinates.

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
- the size is bounded to 128x128 and 16384 cells (streamed past 64x64,
  §7.5 — the creation modal and the preview both say what that costs);
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

**Built: `M7PreviewModal.tsx`**, reachable from the Scene tab of a world
map. It runs the PPU's own transform line by line — the same `A`, `B`,
`C`, `D` from the same horizon, anchor and rotation step the scene
carries — over the map painted flat on an offscreen canvas, and it puts
the NPCs through `m7_project`'s inverse of it. Horizon, anchor and
rotation step are sliders, the camera is a drag on the image, and an
angle tried here can be pushed back onto the scene with one button.

**How faithful, measured rather than asserted.** The demo's `monde` was
built into a ROM booting straight onto the plane, run 900 frames in the
emulator, and compared with the preview at the same camera. Quantising
both to the SNES's 15 bits — which is the only difference the preview
cannot avoid, since it samples a 24-bit PNG — **91.1 % of the 57 344
pixels are identical**. The remainder is the grass's dithered detail and
the sprite bodies; the island's silhouette, the road, the horizon line
and the three characters all land on the same pixels.

Three differences are deliberate and stated in the window itself:

- Sprites do NOT shrink with distance, because the SNES cannot scale one.
- The preview projects EVERY event; the engine does three per frame and
  rotates the rest (§7.2h).
- An ERASED cell inside the map is black (datagen compiles the eraser to
  a black block, S10) while the area PAST the map is the sky colour (the
  plane holds character 0 there, which is CGRAM 0). Two different blanks,
  and the preview keeps them apart because the game does — getting this
  backwards was the one real bug the emulator comparison caught.

The smoke gate opens the window on the demo's world map and fails if its
canvas comes back nearly black, which is what a broken projection looks
like from the outside.

## 9. Opcodes

Free from **0x40** onwards (`SETLOC` at `0x3F` is the last one used,
`tools/datagen/src/script.rs`).

| Opcode | Arguments | Role |
| --- | --- | --- |
| `M7OPEN` | `img u8, dur u8` | Opens the Mode 7 screen under a fade |
| `M7ZOOM` | `ramp u8, flags u8` | Plays a ramp; flags bit 0 = loop, bit 1 = wait |
| `M7CLOSE` | `dur u8` | Closes it — internal warp back to the scene |
| `M7VIEW` | `horizon u8, anchor u8` | World map CAMERA ANGLE (§7.2c) |
| `M7ROT` | `step u8` | World map rotation, SNAPS to a step (§7.2d) |
| `M7TURN` | `step u8, frames u8, flags u8` | TURNS to a step, short way round; bit 1 waits |

The SKY (§7.2e) has no opcode: it is scene data only, because it belongs
to the place rather than to a moment. A script that wants a sunset uses
the ordinary screen tint.

`M7ZOOM` is INERT on a world map, and cannot be otherwise: the
perspective rewrites `M7A`/`M7D` every scanline through HDMA, so a matrix
scale never reaches the screen. A world map's zoom is its CAMERA ANGLE
(§7.2c) — closing the gap between horizon and anchor tightens the view —
and the engine, the opcode table and the editor's form all say so rather
than letting the command fail silently.

The wait reuses the VM's non-UI wait mechanism, as `VM_WAIT_STAGE` does.
A looping ramp never blocks, for the same reason a looping animation does
not. `M7VIEW` waits for nothing: it rewrites tables rather than queueing
a request, so it is the one Mode 7 opcode with no VM pause.

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
2. **M7-A1** — ✅ datagen: the Mode 7 image conversion (§5.2) and the ramp
   compiler (§5.3), with unit tests. Nothing is emitted unless the project
   declares Mode 7 content, so `gate-datagen.sh` stays byte-identical on
   demo and showcase — the registry becomes unconditional in M7-A2, when
   the engine actually needs to link against it.
3. **M7-A2** — ✅ the `m7.c` module (§6) and the three opcodes (§9), plus
   the composite "Zoom cinematique" command (§8.4) on the datagen side.
   The full cycle runs on the emulator from a real game project: the
   screen opens, the ramp scales the image from a quarter of the screen
   to all of it, the screen closes and the map comes back. Two bugs found
   on the way are recorded in §11b — both are conventions of this engine
   that no amount of reading the hardware would have surfaced.
4. **M7-A3** — ✅ the editor. The "Zoom cinematique" command with four
   presets and the zoom stated in percentages and seconds; the "Image
   zoomable" resource category with the full import/export/rename/delete
   flow; and the before/after preview, which shows the REAL converted
   image next to the source plus the fitted size. The rule of §8.1 holds:
   the words "Mode 7" appear nowhere in the editor.

   The preview calls `datagen m7-preview <in.png> <out.png>` through the
   sidecar rather than converting in TypeScript (§8.5). That costs one
   subprocess per selection and is worth it: a second implementation
   would drift from the build and start lying about what the game shows,
   which is the one failure this feature cannot afford. It fails silently
   when there is no sidecar — browser mode has none, and the panel must
   still open.

   `demo/assets/mode7/titre_plaine.png` is the worked example, and it
   makes the §1 table concrete once more: a title card of broad flat
   areas fits UNTOUCHED at 92 patterns and 30 colours. It also gives the
   editor gate a real entry to walk instead of an empty category.

5. **M7-B1** — ✅ the world map's tileset compilation (§5.1) and the
   `worldmap` scene type in datagen (§5.4).

   A world map is an ORDINARY SCENE carrying `kind: "worldmap"`: the same
   tileset library, the same painting, the same events and warps. Only
   the rendering changes, so it keeps its place in every table datagen
   already builds, and the Mode 7 pass only adds the plane's data.

   It is compiled by the ordinary path as well, which costs one gfx set
   it will never display. That is deliberate: skipping it would
   desynchronise `set_ids` from `scenes`, and every table downstream is
   indexed by scene position. A world map uses few metatiles, so the
   waste is small and the alignment is free.

   The plane map is stored in METATILES — at most 64x64, so 4 KB — and
   the engine expands it through the quadrant table at open. Storing the
   expanded 128x128 plane would be 16 KB per map for nothing, and the
   expansion happens once, under force blank, where there is time.

   One format decision was taken and is worth recording. A Mode 7 tileset
   is authored as a grid of **16x16 metatiles**, exactly like an ordinary
   chipset, and datagen expands each block into its four 8x8 quadrants.
   That is what keeps the promise of §8.2 — the author paints a world map
   with the same canvas and the same gestures — and it is why the plane
   is bounded to 64x64 metatiles rather than 128x128 raw tiles.

   The dedup happens at the QUADRANT level, so a flat block costs one
   pattern and not four: reuse is what pays here, not size. A tileset
   over the 255-pattern budget is REFUSED rather than auto-fitted, unlike
   an image (§8.3) — shrinking an image loses detail the author can live
   with, shrinking a tileset would break every map painted with it.
6. **M7-B2** — the camera and the second sprite loop (§7.1, §7.2), built
   in the five measured steps of §7.2 and in that order. Rotation is
   deliberately NOT in scope: scale alone uses the ramps that already
   exist, and turning the plane adds a sine table that is cheap later and
   expensive to design around now. The fallback if the assembly loop does
   not fit is decided in §7.2 rather than under pressure.
7. **M7-B3** — the editor: the scene type at creation and the restricted
   tools (§8.2).

Each step is deliverable on its own. A is worth having without B; B is
not worth starting before A has run on hardware.

## 11b. The two bugs the close cost, and why they matter

Both were found by running the ROM, and both are ENGINE CONVENTIONS
rather than hardware facts — which is exactly the class of thing a spike
cannot teach you, because a spike has no engine around it.

**1. A deferred opcode must pause the VM for one frame.** `M7OPEN` only
records a request; the main loop applies it at the end of the iteration.
Without a pause the VM runs straight on: `M7ZOOM` finds `m7_on` still 0
and silently drops the ramp, and `M7CLOSE` overwrites `m7_req` before the
screen has ever opened. Every other deferred opcode in the engine already
does this — `SHOWPIC`, `STAGEOPEN`, `STAGECLOSE` all set
`VM_WAIT_TIMER` with `wait_timer = 1`. M7OPEN and M7CLOSE now do too.

**2. The internal warp must be told the screen is ALREADY black.**
`m7_apply` fades to black and forces blank before handing over, so the
warp's own fade-out has nothing to do — but `warp_close(0)` calls
`setFadeEffect(FADE_OUT)`, which turns the screen back ON to fade it out.
For one frame that displays the Mode 7 VRAM read as mode-1 tilemaps:
garbage, plainly visible on a captured frame. Passing `tr_out = 1`
(instant) fixes it. The composed screen never hits this because it never
leaves mode 1, so its stale VRAM still forms a coherent picture.

The debugging that got there is worth keeping as method. The decisive
step was not inspection but a CONTROL: driving the same two-page auto
event with the proven `stage` command instead of `m7`. It rendered
correctly, which proved the test harness was sound and moved the search
into the engine. Before that, a bisect had already shown the fault was
not in `m7_open` at all — with the entire PPU setup skipped, the close
still ended black — which is what pointed at the opcode sequence rather
than at Mode 7.

One caveat that is not a bug: an `auto` event whose script closes a Mode 7
screen re-fires after the internal warp, because the warp reloads the
scene and re-runs its triggers. That is the documented behaviour of the
composed screen too. Guard it with a switch and a second page, as any
real project would.

## 11c. Two ways a world map came out looking classic

Both were reported from the editor, and both come from the same place:
the scene TYPE never survived the trip to the engine.

**1. `kind` was dropped by the save.** `editor/src/io.ts` writes the scene
JSON field by field, by hand, so a new optional field is invisible to the
type checker and simply never reaches disk. The file carries a comment
three lines above the scene block warning about exactly this — the S9
effect layer shipped broken the same way. A scene saved without `kind`
compiles as an ordinary map, `m7w_count` stays 0, `m7_world_open` returns
0 and the engine renders it in mode 1: identical to a classic scene, no
error anywhere. **A field added to `Scene` is not added until it is in the
serialiser.**

**2. The upper-layer validation asked the wrong question.** It refused a
world map when `scene.upper` EXISTED. But the editor always writes an
upper layer, filled with `EMPTY` — so once `kind` did survive the save,
every world map the editor could produce was refused by datagen. The
check now asks whether anything is PAINTED on it (any tile != `EMPTY`).
The two states an editor can be in — "the array is absent" and "the array
is there and blank" — are not the same question, and a validation written
against the format rather than against the tool tests the wrong one.

## 12. Gates

- `gate-datagen.sh` stays green at EVERY step: adding a resource kind
  must not move a byte of the existing projects' output.
- `regress.sh` gains a Mode 7 case once M7-A2 lands — open, zoom, close,
  pixel comparison.
- `gate-editor.sh` covers the new command form (`smoke:commands`) and,
  for B, the new scene type (`smoke`).
- The V-counter profiler (S6) is the instrument for §10.4; the S6 debug
  panel gains the Mode 7 budget line.
