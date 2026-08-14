# Animated characters on composed screens (H0)

*Design doc, C0-style. The author showed the Kefka fight from Final
Fantasy VI — the party standing on the right, animated through the
battle — and then set the constraint that matters: the system must be
GENERIC, not built for a JRPG, and above all not automatically tied to
a battler database. That constraint is the project's founding rule
stated back at the engine: the engine owns primitives, the game is
data and events. So this plan ships PRIMITIVES; Final Fantasy is the
worked example that proves them, living entirely in the author's
event library.*

## 1. What is being asked

Final Fantasy's side view, on our composed-screen battles:

- each party member VISIBLE on the battle screen, standing at their
  position, idling (breathing / ready stance);
- an **attack** animation when they act (step forward, swing, step
  back);
- a **hurt** flinch when they take damage;
- a **KO** pose when they fall, held until revived;
- a **victory** pose when the battle is won.

## 2. The finding: almost everything already exists, and the budgets fit

Measured in the tree, not assumed:

- **The display system exists.** Vignettes (B5) are 32x32 animated OBJ
  sprites that work on composed screens, driven frame by frame — and in
  position — by the animation player (A1), with layers. Combat already
  uses them for attack effects on targets.
- **The sprites fit.** FF6's own battlers are 16x24 pixels. A 32x32
  vignette cell holds one with room for a weapon swing.
- **The chip has room where it matters.** On a composed screen:
  - OAM entries 50-95 are free (player 0-1, actors 2-49 — hidden on a
    stage anyway; vignettes 96-99; weather 100-123, and weather does
    not run on a stage);
  - OBJ chars 448-511 are free (sprite sets end below 384, vignettes
    hold 384-447, the weather chars at 484+ are unused on a stage).
    That window is exactly **four more 32x32 slots**.
- **The beats exist.** The combat library (V2-V4) is plain events with
  the moments already isolated as functions: damage application (with
  its popup and flash), heal, KO ("le heros disparait" — today,
  invisibly), victory/defeat. Playing a battler animation at each beat
  is inserting calls at spots the library already names.
- **The one real conflict**: battle effect animations already consume
  the 4 vignette slots. Four standing heroes would starve them — which
  is why the slot count must grow, and why that is the only engine
  change in this plan.

## 3. The design, in three pieces

### H1 — engine: 8 vignette slots (the only engine change)

`VIG_SLOTS` 4 → 8. Slots 4-7 take OBJ chars 448-511 and OAM 50-53.
On a composed screen they are first-class. In a SCENE they collide
with nothing in OAM, but their chars sit where the weather's live
(484+): documented as "slots 4-7 are for composed screens; in a scene
with weather they corrupt rain/snow chars" — same honesty as the
existing "background above 384 chars collides with vignettes" note.
Editor forms widen their slot dropdowns; the S6 debug panel keeps
telling the truth (one slot's frame swap per VBlank — eight animating
slots wave their updates across eight frames, invisible at idle
speeds).

### H2a — engine primitive: vignettes and animations BY VARIABLE

The one genuinely missing primitive. VIGSHOW, VIGPLAY and ANIMPLAY
take only immediate operands today, while pictures already have
"image par variable" (S7). Without indirection, a script cannot say
"play the animation of WHOEVER is in v91" — it needs one branch per
character, which is exactly the hardcoding the author refused.

So: the vignette and animation commands gain the same variable form
pictures have. Which variable holds what is ENTIRELY the author's
business — a database read, a constant, the result of a menu. The
engine learns indirection, not battlers. This is what makes the same
primitive serve a JRPG's party, a visual-novel cast, board pieces, a
cutscene — anything that stands on a screen and moves.

### H2b — the worked example: Final Fantasy in the author's library

ZERO schema, ZERO engine knowledge. The starter combat library (which
already belongs to the author once scaffolded) demonstrates the
choreography at its existing beats using plain commands + variables:
battle open lays idle loops at two position constants, attack plays
the actor's animation before the damage function, damage plays hurt
on the victim, KO holds a pose instead of hiding a number, victory
loops before the rewards. Where the battler ids come from is the
example's own choice, visible and editable like every other line of
the library — an author who wants them in their database adds a
column to their OWN table (tables are theirs to edit); an author
making something else ignores the example entirely.

Existing projects get the recipe in the doc (which calls to insert
where); the showcase carries the reference implementation.

### H3 — the Écrans window: vignettes placed with the mouse

The author's ask, and the natural completion of the composition tab:
vignettes join laid images as first-class citizens of a screen's
COMPOSITION. "＋ Ajouter une vignette" next to "＋ Ajouter une image";
each carries a name, its slot, the vignette (or animation) to play,
the mode (loop / once / stopped) and coordinates; on the canvas they
drag with the same 8-px snapping, previewed with their first frame.

No engine change and no new format concept: exactly like the rest of
the composition, datagen UNROLLS placed vignettes into ordinary
"Afficher une vignette" / "Jouer une animation" commands at the head
of the screen's automatic script — the same sugar "Aller à l'écran"
already is. The event route stays fully available for everything
dynamic (the FF example uses it); the composition route covers the
static cast — a shopkeeper behind the counter, a portrait that
breathes, the party idling before the script takes over.

### H4 — editor comfort: authoring a battler without pixel surgery

A **« Créer une vignette depuis un charset »** helper: pick a
character block, the tool lays its 16x24 frames into 32x32 vignette
cells (centered, feet on a common baseline) and registers the sheet.
An author's field charset becomes a passable idle/walk battler in one
click; dedicated attack frames stay hand-drawn in the vignette sheet,
where they belong.

## 4. What this deliberately does NOT do

- **No party growth.** The combat system is built for a party of two
  (Équipe: two places, per-hero gauges 1-2). This plan animates the
  party that exists. Four heroes on screen like the FF6 shot means a
  four-hero party first — menus, ATB variables, balance: its own
  project, to be priced separately if wanted. The battler system
  itself is ready for it (slots 4-7 hold four).
- **No battler entity in the engine, no database coupling.** Poses
  are animations, beats are library calls, identities are variables.
  The engine learns indirection and nothing else — same philosophy as
  the combat itself (V2): the game is data.
- **Big bosses stay laid images.** A Kefka-sized battler is BG1
  territory (the monsters' existing system, SLOTFX for flashes), not
  a 32x32 sprite.

## 5. Cost, priced

| Piece | Where | Size |
|---|---|---|
| H1 — 8 vignette slots | vignette.c/h, VM range checks, editor slot dropdowns, SPEC_FORMATS §OAM/chars, S6 note | ~60 lines, half a day with the verification |
| H2a — vignette/animation by variable | vm.c (mirror pic_var, S7), datagen event forms, editor command forms | ~80 lines across the three, half a day |
| H2b — the FF example in the library | combatlib.ts (starter), showcase (reference), PLANNING_COMBAT recipe update — no schema change anywhere | the bulk: a day of event-writing and testing in the showcase |
| H3 — vignettes in the Écrans composition | ScreensModal (list + canvas drag + first-frame preview), datagen's screen unroll (emit VIGSHOW/ANIMPLAY at the automatic script's head) | ~a day |
| H4 — charset → vignette helper | editor (one modal or a button in the vignette import), datagen untouched (vignettes are PNG sheets) | half a day |

## 6. Verification plan

- H1: the pixel regression must not move (scenes untouched); a stage
  test in the showcase shows 8 vignettes at once; the S6 panel's
  budgets stay honest.
- H2: the showcase battle, played through the harness with a scripted
  pad, screenshotted at fixed frames: heroes visible idling, attack
  pose at the attack frame, hurt on damage, KO held, victory loop at
  the end. The AUDIO_DUMP route already proves battles run to
  completion headless.
- H3: a screen with two placed vignettes in the showcase — the editor
  preview and the harness screenshot agree on their positions; closing
  the screen still hides every slot.
- H4: import a demo charset, check the sheet's geometry
  pixel-for-pixel.

## 7. Refused alternatives

- **Heroes as laid images** (BG1 slots, poses swapped by re-laying):
  FF1-static, competes with monsters for the 5 slots and the 511-char
  budget, and "animation" would be a slideshow. Rejected.
- **A real actor layer on composed screens** (routes, pages,
  collision): re-inventing scenes inside screens. The stage is a
  mise en scène; everything dynamic on it is already vignettes.
