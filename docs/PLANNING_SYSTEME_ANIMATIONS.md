# Animation system (A1) — design

A frame-by-frame animation editor, in the style of RPG Maker 2003's
"Battle Animation": the author composes a sequence of frames, choosing for
each one the image shown and its position, and drops sounds at precise
moments. Then triggers it from an event.

This document fixes the format, the runtime player and the split of work
BEFORE a line of code is written — the lesson of the previous projects
(database, UI): a format decided during implementation is paid for in
migrations.

## 1. What already exists and gets reused

The engine can ALREADY do all of it, but only by hand in an event script
(show, wait, move, play a sound) — unbearable to write, and each opcode
costs ~3,000 cycles in the VM (measured with the scanline counter, see
P1/P2/P3). What is missing is a compact FORMAT, a dedicated player, and
the editor.

Bricks reused as they are:

- **Vignettes (B5)** — 32×32 blocks in 4bpp (16 colours), OBJ chars
  384 + slot×4, OAM entries 96-97, frames transferred at VBlank. That is
  already a constant-speed animation player: the new system is its
  generalisation (a position and a sound per frame).
- **Sounds (B1)** — `audio_play_sfx(id)`, the project's BRR samples.
- **Direct OAM writes** — P3's recipe (four 16-bit words, no call to
  `oamSet`, invariant words cached): the animation player uses it, or four
  cells would cost a frame.

## 2. Why sprites and not a background image

An animation has to pass OVER the scenery and keep its colours.

- The UI layer is 2bpp and shares the font's palette: 4 colours, out of
  the question for an explosion or a sword strike.
- The scenery layers (BG1/BG2) carry the map: a cell cannot be laid there
  without destroying the scene's rendering.
- **Sprites** have their own palettes, independent of the scenery: 16
  colours per cell without stealing anything from the tileset. It is what
  Chrono Trigger does for its portraits and effects.

The accepted trade-off: the cells live in OBJ VRAM (16 KB), shared with
the 5 character appearances per scene.

## 3. Data format

### 3.1 The "animation" resource (project)

An entry in the project register, next to the vignettes — the cell sheet
IS a project vignette (an implementation decision: no new graphics path,
see §4):

```json
{
  "name": "coup_epee",
  "vignette": "coup",
  "loop": false,
  "frames": [
    { "cell": 0, "x": 0,  "y": 0,  "dur": 4 },
    { "cell": 1, "x": 4,  "y": -2, "dur": 4, "sfx": "epee" },
    { "cell": 2, "x": 8,  "y": -4, "dur": 6 }
  ]
}
```

- `vignette`: the sheet, a horizontal strip of 32x32 cells (<= 15 colours
  plus index 0 transparent). One animation = ONE sheet, hence ONE OBJ
  palette.
- `cell`: the index of the cell in the sheet.
- `x` / `y`: a SIGNED pixel offset from the anchor point (see §3.2). This
  is what produces the frame-by-frame movement.
- `dur`: the frame's duration in screen frames (1-255).
- `sfx`: a sound played ON ENTERING this frame (optional).

datagen validates everything at generation time, never at runtime: a
duplicate name, an unknown vignette (with the project's vignette list
quoted), missing or too many frames, a cell outside the sheet, a zero
duration, an offset outside −128..127, an unknown sound.

### 3.2 Anchoring

As in RM2003: `screen`, `hero`, or `event n`. The player adds the frame's
offset to the target's position, recomputed every frame — an animation
anchored on an NPC follows it as it moves.

The `screen` anchor point is the CENTRE of the screen: an offset of (0,0)
puts the 32x32 cell centred there. For `hero` and `event`, (0,0) puts the
cell's corner on the corner of the metasprite being followed. The same
rule in the editor and in the engine — that is what guarantees the
editor's canvas shows what the game will display.

### 3.3 Layers — several cells at once (A1-e)

An animation declares **1 to 4 layers** and therefore shows up to 4 cells
AT THE SAME TIME. The real cost, measured before the first line was
written:

- **palettes: zero.** Every cell of an animation comes from its sheet, so
  from the same OBJ palette. That is the scarcest resource (character sets
  take 0-4, the weather takes 7: TWO palettes are left), and layers do not
  touch it. The limit that follows: 2 DISTINCT sheets on screen at once.
- **OAM: no trouble.** Vignettes sit at entries 96-99; entries 50-95 are
  unused.
- **VRAM: 4 blocks** in the reserved band (chars 384-447). Rows 28-31
  would take three more (chars 448, 456, 460 — the one at 452 would land
  on the weather) if more were ever wanted.
- **VBlank: the real ceiling, at ONE cell per screen frame.** A cell is 4
  DMAs of 128 bytes (the 32x32 block spans 4 non-contiguous rows of the
  name grid). At two cells, the LAST TWO rows fall outside the window and
  VRAM IGNORES them: the bottom half of the second cell stays empty (seen
  on a VRAM dump, not deduced). Moving `vig_vblank` earlier in the
  sequence only gets 6 of the 8 through — it is a time ceiling, not an
  ordering one.

The consequence for the author, and it is a CHECKABLE RULE rather than a
vague limit: when K layers change cell on the same frame, they update over
K frames. datagen and the Animations window warn when a frame's duration
is shorter than that.

A cell index of **-1 shows nothing** on that frame. That is what gives the
flexibility of independent tracks (a layer that appears on frame 3 and
disappears on frame 6) with a SINGLE timeline in the editor — two parallel
timelines would have made the window unreadable.

Order: layer 1 is at the back, the following ones come in front.

### 3.4 Binary (data bank)

Six parallel tables indexed by animation (`anim_vig`, `anim_flags`,
`anim_layers`, `anim_nframes`, `anim_ofs`) plus the flattened track
`anim_track`. A frame carries **L records of 3 bytes** (one per layer)
then the duration and the sound:

```
L x [cell (0xFF = empty layer)][signed dx][signed dy]
    then [duration 1-255][sound, 0xFF = none]
```

The stride is therefore `3L + 2` — FIXED, computed once at start-up. With
one layer it is exactly the original format (5 bytes). The fixed stride is
a PERFORMANCE choice, not a compactness one: the player keeps the current
frame's offset and adds the stride, never multiplying and never decoding a
variable length. tcc-816 compiles every indexed access into a long
indirect read (~11 instructions, the lesson of P3). A 12-frame,
single-layer animation fits in 60 bytes.

## 4. Runtime player (`anim.c`)

A frame-by-frame animation is a VIGNETTE whose cell, position and sound
change every frame. So the player borrows a vignette slot and drives the
existing state:

```
anim_play(id, anchor, target)   anim_stop()   anim_busy()
anim_update()   (once per frame, BEFORE vig_update)
```

An animation with L layers borrows L vignette slots (4 in all). The whole
graphics path stays the vignettes': 32x32 OBJ chars, an OBJ palette, the
cell transferred at VBlank, the OAM shadow written. `vig_vblank()` already
does the work — there is no `anim_vblank`.

Vignette palettes are allocated PER SHEET and reference-counted: two slots
showing the same vignette share it. With no palette available, `anim_play`
plays NOTHING rather than play in another image's colours. With too few
slots, the animation that is FURTHEST ALONG gives its own up — cutting
something short shows less than never starting.

Per frame and per active animation: decrement the duration counter. ON A
FRAME CHANGE ONLY — read the 5 bytes, mark the cell for transfer, set the
position, play the sound. The rest of the time it is one test and one
decrement.

Slot ownership: the player sets a flag (`vig_own_anim`) that a scripted
`vig_show` clears. A scripted vignette therefore PREEMPTS the animation,
which sees it on its next frame and drops the slot without hiding
anything — the script keeps control of what it put on screen.

VBlank budget: a cell change is 4 DMAs of 128 bytes. The vignettes' "one
transfer per VBlank" rule applies unchanged; if two animations change cell
on the same frame, the second goes out on the next one.

## 5. Event command

"Play an animation": the animation, the target (screen / hero / this event
/ event n), and a **wait for the end** checkbox. Without the wait, the
script carries on and the animation lives its own life — essential for
animating during a dialogue.

Opcode `ANIMPLAY` (0x3B): `[anim][anchor][target][flags]`, target 0xFF =
"this event" (resolved at run time as for routes). The wait reuses the
VM's non-UI wait mechanism (`VM_WAIT_ANIM`), like waiting for a route or
for the camera. A LOOPING animation never blocks — otherwise the wait
would never end.

`ANIMSTOP` (0x3C) stops everything and puts the sprites away: the way out
of a loop started without a wait.

## 6. Editor

An "Animations" window (Tools), on the model of the screens editor:

- **Timeline** at the bottom: one column per frame, the duration as width,
  a dot on the frames that carry a sound. Add / duplicate / delete a
  frame, drag to reorder.
- **Canvas** in the middle: the current frame's cell laid over a reference
  of your choice (the centre of the screen, or the hero's silhouette),
  draggable with the mouse — that is what sets `x`/`y`. The canvas applies
  the engine's rule EXACTLY (§3.2): what you place here is what the game
  shows.
- **Inspector** on the right: cell (the sheet's grid), duration, sound.
- **Playback**: a play button that runs the animation in the canvas at the
  real speed (60 frames per second), sounds included.
- **Warnings**: what datagen would refuse at build time (a missing sheet,
  a cell outside the sheet, a vanished sound, a duplicate name) is said IN
  the window, while editing — the generation error is a net, not the first
  feedback. The "Check the project" window repeats them at project level,
  and flags commands pointing at a deleted animation.

## 7. Limits to state in the editor

- **32×32** cells, 16 colours, one sheet per animation.
- **4 simultaneous cells** in total, shared between the layers of the
  running animations and the vignettes shown by script.
- **2 DISTINCT sheets** on screen at the same time (2 free OBJ palettes).
  The layers of one animation only consume one.
- One cell transferred per screen frame: see the K-changes rule in §3.3.
  Aim for 6 to 10 frames per second, like the games of the era.

## 8. Breakdown

1. **A1-a** — ✅ format + datagen (validation, the binary track) + the
   runtime player + the `ANIMPLAY`/`ANIMSTOP` opcodes, and the
   `anim_play`/`anim_stop` event command on the datagen side. Testable
   from a hand-written project, with no editor — which is what validated
   the three anchors, the wait, the loop and the automatic put-away.
2. **A1-b** — ✅ the "Play an animation" form in the event editor
   (animation, target screen / hero / this event / event n, a "wait for
   the end" box) plus "Stop the animations".
3. **A1-c** — ✅ the Animations window (Tools): timeline, canvas,
   inspector, playback.
4. **A1-e** — ✅ layers (several simultaneous cells): the format, datagen,
   the player, and the editor (layer tabs, a "nothing" cell, dragging any
   cell). Absorbs the old A1-d — the vignettes had to go to 4 slots
   anyway.

Each step is deliverable and checkable on its own; the pixel regression
covers the engine at every stage.
