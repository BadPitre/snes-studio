# The battle system, rebuilt on events (V0)

*Design doc, C0-style: the first argument someone has with this
document should be written INTO it, not around it.*

## 1. Why we are reopening a finished system

C0 → C6 shipped a complete, working ATB battle. And it drifted from
the project's founding sentence — **the engine owns generic
primitives, the game is data** — in exactly the way C0 §2 warned
against and then rationalised: `btl.c` became a GAME engine. The ATB
formula, the round-robin fairness, the damage formulas, the monster
AI, the poison cadence, the flee odds: all of it is C the author
cannot open, reorder, or replace from the editor. He can tune numbers
(database) and hang cutscenes at the joints (hooks), but the LOOP —
the thing that makes his battle system HIS — is ours, not his.

The author's request that triggered this doc: *"le système de combat
doit être quasiment entièrement fait avec le système d'events de SNES
Studio, pas avec du code."* RM2003 itself hides its loop; we can do
better than RM2003 here, because our event system already has what a
battle loop needs: parallel processes, functions with parameters and
return values (F1), 16-bit variables, loops, RAND, LISTSEL, stage and
animation commands, and a database read opcode.

## 2. The dividing line, redrawn

C0 §2 gave btl.c "the parts where per-frame timing and fairness live".
That line was too generous. The honest split:

**A primitive belongs to the ENGINE only if the VM cannot do it well:**
per-frame arithmetic served under the VBlank budget, pixel work, OBJ
management. Everything else — every DECISION — belongs to events.

**The engine keeps (as event commands, each generic and reusable):**

- `BTLPOSE` — pose the party's battlers: hero h's 32x32 cell at
  (x, y), the C1 upload recipe (chars 448+, OAM 104-107). Generic:
  any screen wanting the party on stage can use it (menus, cutscenes).
- `POPUP <value> <x> <y>` — the C4 damage digits, from a constant or
  a variable. Generic: shop prices, XP ticks, any number that should
  pop over the scene. (The digit sheet upload rides stage opening,
  as today.)
- `CLOCK <base_var> <n>` / `CLOCK STOP` — the only per-frame service:
  adds `speed_var[i]/4` to `gauge_var[i]` each frame, saturating at
  255, for n lanes of (gauge, speed) variable pairs. The gauges are
  ORDINARY VARIABLES: the event loop reads them, widgets draw them.
  Generic: cooking timers, racing minigames — anything that fills.
- `TARGETSEL <var> [ally]` — the C3 target cursor: walks the stage
  slots (or the party column) with the pulse/blink feedback, writes
  the pick (or 0xFF on cancel) into a variable. Generic: any "point
  at a thing on a composed screen" need.
- Already there and unchanged: STAGE (open/pose/slotfx/clear/close),
  LISTSEL, ANIMPLAY (+ screen aim), SHOWUI, DBREAD, RAND, KEYIN,
  the textbox, functions.

**Events own EVERYTHING else, shipped as an editable library:**

The battle loop itself — a common event `combat_tour` started by the
(kept, thin) `battle` command or by a plain screen script; the menu
handling; the built-in formulas as F1 FUNCTIONS (`degats_physiques`,
`degats_magiques`, `soin`) the author can rewrite line by line; the
monster turn (weighted rolls via RAND over database reads); poison as
variables and a function; items; flee (menu and L+R via KEYIN);
victory/defeat detection; rewards. C1-C6's behavior is the
SPECIFICATION this library must reproduce — the pixel tests are the
proof.

## 3. What survives of btl.c

A ~150-line `btl.c` serving four primitives (pose, popup, clock,
targetsel), plus the digit sheet plumbing. The ATB machine, the menu
state, the formulas, the AI, poison, flee, end detection: deleted,
reborn as the library. `data_battle.c` shrinks accordingly — heroes'
cells/pals stay (BTLPOSE needs them), the stat tables stay (DBREAD
reads heroes/monsters/skills like any table — heroes/skills likely
BECOME ordinary database tables, closing the odd fixed-format
heroes.toml/skills.toml carve-out; troops keep their editor window).

## 4. Risks, named before they bite

1. **VM throughput.** The loop runs at 32 ops/frame (RM2003's own
   budget); P1/P2 taught us the parallel path's real cost. The battle
   loop is NOT parallel — it owns the screen — and between two menu
   presses it idles on LISTSEL/TARGETSEL waits. The heavy per-frame
   work (gauges) is CLOCK's. Risk: acceptable, measured in V1.
2. **The 32-op budget vs. 8 gauges + AI rolls in one frame** — spread
   over frames by construction (the queue serves one actor at a time).
3. **Library versioning.** Once shipped INTO projects, the library is
   the author's — engine updates must not overwrite his edits. Same
   policy as prefabs: copied at project creation, never touched after.
4. **The C1-C6 features that resist events:** the ATB mirror, popups
   during hooks, the poison-on-act cadence — all become trivially
   his to change, which is the point; the pixel tests pin OUR default.

## 5. Milestones

- **V1 — the four primitives.** BTLPOSE/POPUP/CLOCK/TARGETSEL as
  event commands (datagen + VM + forms), btl.c untouched beside them.
  Proof: a toy screen script poses the party, pops a number, fills a
  gauge into a widget, points at a slot.
  *Shipped.* Module `btlprim.c`, opcodes 0x47-0x4A, wait modes 13-14;
  the toy screen is the showcase's `test_v1` (village, the Testeur
  event). First dividend: the scripted popup showed a stray 8/9 under
  every 0/1 — a DIGIT-SHEET cell overlap latent in btl.c since C4,
  fixed for both (glyphs 8-9 moved to the sheet's row 23, the engine
  raises those two digits 8 px).
- **V2 — the library, fighting.** `combat_tour` + functions reproduce
  C2-C3 (menu, attack, skills, MP, targeting, KO, issue, rewards) on
  the gobelins. btl.c's FIGHT machine deleted. The village duel plays
  the same to the eye.
- **V3 — the library, complete.** AI, hooks (plain calls now — the
  library IS a script), poison, items, flee (menu + L+R), Wait/Active
  as a library variable. btl.c reduced to §3's residue. C1-C6 pixel
  behavior reproduced; regression cases re-blessed once, deliberately.
- **V4 — authorable + shipped.** The library lands in new-project
  templates and the showcase; the Groupes/Équipe windows survive
  (they edit data the library reads); docs rewritten so the FIRST
  thing an author learns is "open combat_tour and read your battle".

*V0 ends here. V1 starts on the author's go.*
