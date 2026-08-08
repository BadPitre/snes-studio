# Posed characters that animate: FIGURES (F0)

*Design doc, C0-style. The author's request: "j'aimerais que mes
personnages puissent avoir des animations de idle, attaque, damage,
etc… mais ça doit être le plus générique possible, le système ne doit
pas être uniquement pour les JRPG."*

## 1. The trap to avoid

The engine already has FOUR ways to put a moving image on screen. A
fifth would be the real cost of this feature, so it has to be named
before anything else:

| path | what it is | where | budget |
|---|---|---|---|
| map events | a charset block, walk cycles, driven by the actor system | map only | scene charsets, OBJ palettes 0-4 |
| vignettes | 32x32 sprite, frames played from a strip, 4 slots | map + stage | chars 384-447, OAM 96-99, OBJ palettes 5-6, **2 distinct sheets on screen** |
| animations | a timeline of cells/positions/sounds over a vignette sheet, up to 4 layers | map + stage | borrows the vignette slots |
| posed battlers | ONE fixed 32x32 cell per slot, 4 slots | stage only | chars 448-511, OAM 104-107, OBJ palettes 0-3 |

The request is about the fourth. It is the only one that shows a
CHARACTER as itself rather than an effect over something else, and it
is the only one that cannot animate.

**So this is not a new system: it is the fourth path growing frames.**
It borrows the vignette's proven recipe — only the current frame lives
in VRAM, a frame change is one 512-byte DMA — and keeps its own char
region and palettes, which is what lets four DIFFERENT characters share
the screen (vignettes cap at two distinct sheets).

## 2. What it must not be called

Everything about the current path says "battle": `btl_pose`, "Poser un
combattant", cells composed from a `heroes` table. G1/G2 removed the
word "combat" from the Tools menu; this milestone must not put it back
under another name.

The generic object is **a character posed on a composed screen, showing
one of several named states**. Nothing in that sentence is a JRPG. The
same thing is:

- a visual-novel character whose states are expressions (neutral,
  surprised, angry) — states of a single frame each;
- a boss breathing on a title screen, an idle loop and nothing else;
- a shopkeeper who nods when you buy;
- a fighting-game character with stance / strike / recoil;
- and yes, a JRPG battler with idle / attack / damage.

Working name: **figure** (« figure », French user-facing). A composed
screen already holds picture SLOTS the author poses visually; it will
also hold FIGURES, which are the same idea with states. Better names
welcome — this one is not load-bearing.

## 3. The design

### 3.1 Where the frames come from — the sprite sheet FIRST

The author asked whether the sprites already in the project could serve.
They can, and that is the better default.

A charset block is **12 frames of 16x24**, laid out as
`block*12 + direction*3 + step`: for each of the four directions, a
standing frame and two walking ones. Every character on a map already
has one, and today's posed battler is nothing but frame `block*12 + 6`
of it — the left-facing standing frame, centred in a 32x32 cell.

So a figure declares its source, and there are two:

- **A charset block** — the sprites already in the project. No new art,
  no new import, and the twelve frames are already sorted into something
  usable: standing and walking, per direction. This is the whole answer
  for a shopkeeper who turns around, a character who walks onto a
  composed screen, a visual-novel speaker who faces left or right.
- **A figure strip** — 32x32 frames, the vignette format and the
  vignette importer. For a character that needs to be BIGGER than 16x24,
  or that needs poses a walk sheet cannot contain.

A third possibility sits between them and costs nothing to allow:
**further blocks of the same sprite sheet**. Nothing stops an author from
using block 3 as "Arven's combat poses" — twelve more 16x24 frames,
attack and recoil and whatever else — and declaring states that span
them. The sheet is already a flat strip of frames; blocks are only a
counting convention.

The engine does not care which source: it uploads one 32x32 cell either
way, a 16x24 frame being centred exactly as the battler is today.

**What the sprite sheet cannot give.** A walk sheet has no attack frame
and no recoil frame. Those images have to be drawn somewhere; the only
question this design answers is WHERE they may live (extra blocks, or a
strip) — not whether they can be conjured. And two walking frames make a
STEP, not a breath: a character who breathes in place is art the author
draws, not a state the engine invents. Reusing the sprites buys the
directions and the walk for free, and nothing more.

### 3.2 States

**States are declared per figure**, each with:

- a name (the author's word: `idle`, `attaque`, `touche`, `sourire`…),
- the first frame and the frame count, counted in the SOURCE (a charset
  block's twelve, or the strip's), so a state can span blocks,
- a speed in frames per image,
- what follows: loop itself, hold the last image, or **fall through to
  another state by name**.

That last field is what makes attack and damage trivial to script:
`attaque` declares `next = "idle"`, so playing it once returns to the
idle loop on its own. Without it, every author writes the same
wait-then-revert three times per character.

**The engine knows no state NAMES.** datagen resolves a name to an
index at build time, exactly as it does for widgets, screens, animations
and database rows. The engine plays state number N of figure number M.

**Two commands**, both generic:

- *Poser une figure* — slot (0-3), which figure, x, y, show/hide. This
  is today's "Poser un combattant", renamed and widened: the figure can
  be named directly OR come from a database column (which is what makes
  a party data-driven, as G1 made it).
- *Jouer un état* — slot, state name, and an optional "wait for the end"
  for one-shot states. Non-blocking otherwise, so a script can start an
  attack pose and get on with the damage numbers.

`btl_pose` keeps working: a figure with no declared state is a single
frozen image, which is exactly today's behaviour.

**Where states are authored.** A small *Figures* window: import the
strip, see the frames, name the states by dragging ranges, set speed and
`next`, and play the state in the editor. The Animations window already
does the timeline job for effects; this one is deliberately simpler
because a state is a range, not a timeline.

## 4. The honest costs

0. **A charset-sourced figure costs no new art and no new resource** —
   but it also cannot show a pose nobody drew. The cheap path and the
   expressive path are different paths, and the doc does not pretend
   otherwise.
1. **DMA is the real limit.** A frame change is 512 bytes in one VBlank.
   Four figures animating at 8 frames per image is about 4 changes per
   second each — comfortable. Four figures at 2 frames per image is
   2 KB per frame, which the VBlank budget arbiter (P5) will start
   refusing. Figures must take from that budget like everyone else, and
   a refused frame simply lands one frame late. **Fast animation on four
   characters at once will visibly slow down**, and no amount of design
   avoids it on this hardware.
2. **32x32 in this milestone.** Bigger figures are possible — 64x64 is
   four times the chars — but the char region holds four 32x32 figures
   OR one 64x64. That trade (size against count) deserves its own
   decision later, not a rushed one now.
3. **Composed screens only.** OBJ palettes 0-3 are free on a stage
   because there is no map loaded. On the map, animated characters are
   events with charsets, which already works. Extending figures to the
   map means fighting for palettes and is not part of this.
4. **ROM.** 512 bytes per frame. A character with idle(2) + attack(3) +
   damage(1) is 3 KB; four of them 12 KB. The ROM is 78% empty.
5. **Two figures sharing a sheet share a palette** — the vignette rule,
   kept. Four figures with four different sheets take the four palettes,
   which is the ceiling.

## 5. What the showcase will show

Arven and Nadia get an idle that breathes, an attack pose while their
blow lands, and a recoil when they are hit — replacing today's motionless
cells and the blink the library cannot do. The same figures, posed by a
screen script with no battle anywhere, will also stand in a non-combat
scene to prove the system is not a battle system.

## 6. Milestones

- **F1 — the runtime, on the sprites already there.** A figure sourced
  on a CHARSET BLOCK with named states, the frame player on the four
  slots, both commands, the VBlank budget wired. Nothing new to import:
  the showcase's heroes animate from the sheet they already use on the
  map, verified in the emulator. This is the cheapest thing that proves
  the whole design.
- **F1b — the figure strip.** The 32x32 source, for poses and sizes a
  charset cannot hold. Same states, same commands, another source.
- **F2 — the editor.** Figures window (import, frames, named states,
  speed, `next`, preview), the two command forms, the database column
  type so a party stays data-driven.
- **F3 — the sweep.** The showcase's party animates; the starter kit
  ships one figure so a new project sees the mechanism; `btl_pose` and
  the word "combattant" retire behind the generic vocabulary; docs.

*F0 ends here. F1 starts on the author's go.*
