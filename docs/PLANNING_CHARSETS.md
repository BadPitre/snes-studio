# Charsets v2 — free-form import and charset animations

Design document for the charset chantier (2026-08). Nothing here is
implemented; each cran waits for its go.

## 0. The request

Two asks, verbatim in spirit:

1. The charset import through the Resource Manager should work **exactly
   like the sprite-animé import**: any PNG sheet, pick the transparent
   colour with the pipette, draw rectangles over the frames — instead of
   accepting only ready-made RM2003 sheets.
2. Charsets should have **manageable base animations** (movement, idle,
   etc.) and the author should be able to **create custom animations by
   picking, for each animation frame, a charset image to display**.

Ask 1 is editor plumbing. Ask 2 is a pivot on a core resource — the hero
and every NPC render through the charset path — so this document prices
the options before anything moves.

## 1. Where charsets stand today

The facts the design leans on, with anchors.

**Storage.** All charsets live in ONE strip, `assets/sprites.png`, 16x24
frames side by side. A block is 12 frames — 4 directions x 3 steps
(idle, step A, step B), frame = dir\*3 + step — 64 blocks max per
project, 5 per scene set (`tools/datagen/src/charset.rs`,
`formats.h` CHAR_BLOCK_FRAMES). In VRAM a frame is two stacked 16x16
OBJs = 256 bytes; a block is 3 KB; a full scene set 15 KB, laid out by
the generic allocator (PLANNING_VIDMAP.md).

**Import.** RM2003 sheets only: `App.tsx` importCharset (:646) rejects
anything that is not 288x256 or 72x128, then TransparencyPickModal →
CharsetImportModal (click the character in the fixed 4x2 grid, pick the
destination block) → `datagen import-charset`, which recomposes the 12
frames (row order up/right/down/left, column order left/idle/right,
24x32 cropped to 16x24 bottom-centre) and pastes them into the strip.

**The model to copy.** The sprite-animé import (RM-extract, task #141)
has ONE button: a PNG that is already a valid strip imports directly;
anything else opens `SpriteExtractModal` — pipette for the transparent
colour, rectangles drawn over the frames (clamped to the cell), each
pasted bottom-centred, live strip preview, then the ordinary import
flow. `buildStrip` (SpriteExtractModal.tsx:36) is the pure cut, kept
off the DOM.

**Animation.** The walk cycle is HARDWIRED: anim phase 0-3 displays
steps 0/A/0/B, advancing every 8 frames of movement — once for the hero
(player.c:391 and :433) and once for NPCs (actors.c actor_anim, same
arithmetic). Standing still snaps to the idle frame; there is no idle
animation of any kind. Everything downstream is insulated behind the
frame caches (pl_lastf, actor_lastf/actor_w1/w3): the hot loops —
actorsfast.asm included — consume a COMPUTED FRAME NUMBER and nothing
else. That insulation is the load-bearing fact of this design: making
the frame number data-driven touches the two steppers and NOTHING in
the draw path.

**Prior art.** PLANNING_FIGURES.md (F0, dormant) already designed
"named states" — first frame + count + speed + what happens at the end
(loop, hold, fall through to another state) — for characters on
COMPOSED screens. Ask 2 is the same idea pointed at the MAP. The A1
animation system (PLANNING_SYSTEME_ANIMATIONS.md) is the other
neighbour: frame-by-frame vignettes over slots, already scriptable —
it is what big one-off effects (sword arcs, explosions) should keep
using. F0's prohibitions hold here: the engine never sees a name
(datagen resolves), no state carries engine meaning, nothing triggers
implicitly.

## 2. Reading ask 2

"Picking, for each animation frame, a charset to display" can mean a
frame WITHIN the event's block, or any (charset, frame) pair in the
project. The design covers the second reading — an animation step names
a charset AND a frame — because it subsumes the first and matches how
the Apparence window already lets an event borrow any block. The
existing rule stands unchanged: a scene may only reference 5 blocks,
checked at build time, so a custom animation that strays outside the
scene's set is a build error naming the animation.

## 3. The crans

### CH1 — the import extractor (editor only)

**Revised after Bertrand's first test** (the first shape put the 12
labeled slots inside the import modal; he asked for the split below,
plus mirroring). The charset route becomes the sprite-animé route, in
TWO stages:

- ONE import behaviour: an RM2003 sheet (288x256 or 72x128) keeps
  today's fast path — grid pick, automatic slicing. Any OTHER png opens
  the extractor instead of being rejected.
- `CharsetExtractModal` ONLY PICKS THE FRAMES: pipette, zoom, ordered
  rectangles clamped to 16x24, each bottom-centred — buildStrip's
  gestures exactly. The result is the charset's frame POOL, saved to
  `assets/charsets/<name>.png` and registered per block in
  project.json (`charset_pools`, editor-only — datagen never reads
  it). The import also bakes a BLANK block so the block exists
  (spriteBlockCount reads the sprite sheet's width).
- **Tools > Charsets** is where the walk is LAID: each of the 12 cells
  (Bas/Haut/Gauche/Droite x Repos/Pas A/Pas B) picks a pool frame,
  optionally MIRRORED — one drawn side serves left AND right — with
  one-click "Droite = Gauche en miroir" fills, a walking preview
  (0/A/0/B per direction), and « Appliquer » baking the composed
  72x128 RM2003 sheet through the EXISTING `datagen import-charset`.
  The layout is re-editable forever without re-extracting; this window
  is CH3's future home (custom animations live where the walk lives).

Zero datagen change, zero engine change, zero ROM risk. The 15 colours
+ transparency rule applies as on every sheet (checked at build, like
every import). Cost: two modals and their wiring — one session.

### CH2 — base animations per charset (walk and idle)

The charsets register in project.json grows from a list of names to a
list of small objects (name + parameters; datagen defaults absent
fields, old projects load unchanged):

- **walk speed**: frames per step, today's hardwired 8 becomes the
  default of a 1..32 field;
- **idle**: `fixed` (today's behaviour, the default) or `step`
  (RM2003's "stepping animation": keep playing 0/A/0/B while standing
  — a torch bearer, a bird) — or a named custom animation once CH3
  exists.

Datagen bakes one byte per sprite SLOT into the scene header (bytes
28-32, spec §1.2: bits 0-6 the step length, bit 7 the stepping idle),
unpacked at scene load (scn_aspd/scn_aidle). The engine's two steppers
read them instead of their constants; the computed frame keeps feeding
the caches. The editor surfaces the two fields in Tools > Charsets.

**As built**: the hero counts display frames; an NPC counts PIXELS
walked (a per-slot countdown replacing the hardwired `(step & 7) == 0`
— byte-identical at the default 8, proven by the pixel regression on
wandering NPCs), so its anim pace scales with its move speed. The NPC
stepping idle needed ONE concession from actorsfast.asm: its "show the
walk step" gate reads `actor_step || actor_show_step`, the new byte
maintained by a C loop that runs only when the scene HAS a stepping
idle (scn_has_idle — a scene without one pays nothing, the P1-P3
plain stays untouched). Verified: hero stepping in place on screen at
speed 4 (the 2-px toggle IS the demo art's full pose difference, its
step frames differ by 2 px), NPC anim advancing through WRAM dumps at
speed 6 while actor_step stays 0, both regression gates green with
defaults.

### CH3 — custom charset animations, authored and scripted

The FIGURES idea landed on the map. A project owns a register of named
CHARSET ANIMATIONS; an animation is a list of steps
`{charset, frame, duration}` (duration in display frames, 1..255) plus
an END behaviour: `loop`, `hold` (freeze on the last step until told
otherwise), or `normal` (fall back to walk/idle).

- **Editor**: an authoring window in the RM2003 mould — step list,
  frame picker as in the Apparence grid (any charset of the project),
  duration per step, live playback on a small canvas.
- **Datagen**: resolves names → (scene slot, frame) after the
  scene-set remap and emits the tables; an animation referencing a
  block outside the scene's 5 is a build error naming both.
- **VM**: « Jouer une animation de charset » (target: hero or an
  event; wait: yes/no) and « Arrêter l'animation de charset ». Two
  opcodes. No automatic triggers — a script says play, or nothing
  plays (F0's prohibition).
- **Engine**: a small per-actor override player: while an animation
  runs it owns the displayed frame (the walk stepper is suspended for
  that actor), counts durations, applies the end behaviour. It writes
  the same frame number into the same caches — the draw path,
  actorsfast.asm included, stays untouched. Movement during an
  animation: allowed, the override simply wins over the walk frames
  (RM2003's step-animation-off behaviour); a moving actor whose
  animation ends falls back into the walk cycle mid-stride.

Under the 12-frame ceiling this cran needs NO VRAM change: every frame
an animation can show is already in the scene set. That is the honest
limit to state up front: custom animations REARRANGE existing frames
(bows, spins, waves using the 12 poses — and cross-charset steps for
transformations); they do not add new poses. New poses are CH4 — or a
vignette, which is what the A1 system is for.

Cost: the big cran. Engine medium (the override player + suspension
points in both steppers), datagen medium (register, resolution,
tables), editor the largest piece (a new window). Two to three
sessions, cut testable: 3a runtime + opcode on a hand-written table,
3b the window.

**As built**: the tables live in each scene's SCRIPT BLOCK (the
CHANIM opcode carries a block-relative offset the assembler patches
once the tables are appended) — no scene-header change. The engine
side is an OVERRIDE PAIR: charanim.c writes the exact frame AND its
palette (`actor_fovr`/`actor_povr`, `player_frame_ovr`), the draw
paths check it first — one three-instruction gate in actorsfast.asm,
the caches invalidated on every transition because the same frame can
wear another palette. A step's blocks join the scene's sprite set the
way Change Graphic's do, so a played animation always finds its slots.
The workshop lives in Tools > Charsets under the walk section; the
two commands sit in the picker's Animations category. Verified on a
hand-written project: a 3-step looping animation on the hero,
period-exact on screen (36 frames), the cross-charset step showing
the villageois' tiles AND palette, every pixel diff matched to the
art (10 px between hero frames 7 and 1 in the art = 10 px on screen).

### CH4 — free block geometry: N walk steps, extra poses (ORDERED)

Bertrand asked for both halves at once: walk cycles no longer capped
at 3 step frames per direction (modern sheets walk on 4, 6, 8), and
frames beyond the walk for new poses — which folds the old "extended
blocks" idea into one format pivot: **a block stops being 12 fixed
frames**. Per charset: `steps` (frames per direction, 1-8, default 3)
and `extra` (poses after the walk), block size = 4*steps + extra.

What the constant 12 holds up today, all of which becomes per-block
data resolved by datagen: CHAR_BLOCK_FRAMES / ACTOR_FRAME / the \*12s
(actor_fbase, eventFrame in editor types.ts AND datagen events.rs),
gfx.rs to_obj_sheet and the vidmap byte budget (5 blocks/scene becomes
a VRAM budget), the 0/A/0/B steppers (a data-driven cycle table per
slot: N=3 keeps the RM2003 ping-pong, N>3 runs 0..N-1), the RM2003
import/export bridges, the extractor's 12-slot grid (rows become
`steps`+extra columns), the Apparence picker, the frame dropdowns of
CH3/CH5. The scene header's per-slot tables gain a base+size pair.

Cut: CH4a format + datagen + engine steppers (RM2003 projects
byte-identical at steps=3/extra=0 — the pixel regression is the
gate); CH4b editor (Charsets window, extractor, pickers). Priced two
to three sessions; the walk cadence stays scn_aspd, unchanged.

### CH5 — the charset the player controls (SHIPPED)

« Changer le charset du héros » (picker, Déplacements): the hero wears
any project charset from the command on. The block PERSISTS in WRAM
across warps; each scene load re-resolves it through the header's new
`slot_block` table (spec §1.2, 38 bytes) — a scene whose set does not
carry the block falls back to the authored hero, and the block joins
the sprite set of every scene where the command runs (the Change
Graphic rule). Walk cadence and stepping idle follow the WORN charset
(scn_aspd[pl_slot]). Not in SRAM saves: loading a save wears block 0.
Verified end-to-end: switch on screen (the villageois' 46 px on the
hero), persistence + re-resolution through a warp to a scene where the
block sits on ANOTHER slot, and the fallback in a block-less scene.

## 4. Recommended order

CH1 → CH2 → CH3a → CH3b (all shipped), then CH5 (shipped), then CH4 —
ordered by Bertrand once the 3-step walk ceiling and the 12-frame
block both proved too tight for his sheets.

## 5. What does not change

- Storage: `assets/sprites.png` stays the single strip; per-file
  charset resources are a separate chantier (R2's shape, not this one).
- The engine keeps no names and no implicit behaviour: datagen
  resolves, scripts trigger.
- The A1 animation system keeps the big one-off effects; charset
  animations are for what a character IS DOING, in its own 16x24 body.
