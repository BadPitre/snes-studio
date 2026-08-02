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

**Measured by the spike** (§10, and `PERF_MEASUREMENTS.md` §7): sixteen
sprites at four multiplies each, written in C, cost **~41 screen lines**
against a VBlank window of 37. The C path does not merely strain the
budget, it OVERRUNS it. Writing this loop in assembly is therefore not an
optimisation to consider later, it is the condition for M7-B to exist at
all. Extrapolating P4's 2.7x C-to-assembly ratio puts it near 15 lines,
which would fit — but that is an extrapolation, and the assembly figure
has not been measured.

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
| `M7VIEW` | `horizon u8, anchor u8` | World map CAMERA ANGLE (§7.2c) |

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
