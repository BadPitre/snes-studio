# Widgets that react: SCRIPT ON A WIDGET (U3)

*Design doc, C0-style. The author's request: "ça serait bien de pouvoir
ajouter du script d'event à un widget UI. Par exemple j'ai une image avec
un fill dont je voudrais pouvoir mettre à jour la valeur, ou bien
l'image. Idem pour une liste : savoir quel élément a été sélectionné. Il
faudrait pouvoir écouter le widget."*

## 1. What already works — so nothing is paid for twice

Three quarters of the request is shipped. Naming that first is the only
way to see what the remaining quarter really costs.

| The ask | Today |
|---|---|
| change a FILL's value from a script | **Done.** Tick "Piloté par une variable en jeu" (U2), then any `var` command moves it. `overlay_update` notices the variable changed and redraws. |
| know which row of a list was chosen | **Done.** "Choix dans une liste" writes the row — or the chosen DATABASE ENTRY's number for a sourced list — into a variable. |
| show or hide a widget | **Done.** "Afficher un widget UI" (SHOWUI). |
| react when something changes | **Possible.** A common event with the *Parallel process* trigger watching a variable. It works; it is a polling loop, and it lives far from the widget. |

The engine's existing idiom is **observation, not assignment**: a widget
WATCHES a variable, a script WRITES the variable. One direction, no
coupling, and it is why the gauge worked on the day it shipped.

## 2. What is genuinely missing

1. **Which IMAGE a widget shows.** The primitive's base character is
   computed by the VRAM plan and emitted as `const` in ROM
   (`ui_ov_icon[]`). Nothing at runtime can change it.
2. **A list that is not MODAL.** `LISTSEL` sets `vm.wait_mode =
   VM_WAIT_LIST` in the MAIN context: the calling script parks there
   until A or B. A menu cannot stay live while the game runs.
3. **A script that belongs to the widget.** The reaction always lives
   somewhere else — in the caller, or in a polling parallel event.
   Nothing lets a widget say "when my cursor moves, run this".

Point 3 is the request's real content. Points 1 and 2 are what make it
worth having.

## 3. The design

### 3.1 Properties stay BOUND, they are not assigned

The tempting move is a command: *Modifier un widget → propriété →
valeur*. It is the wrong one here, for a reason that is structural
rather than aesthetic: **the primitive tables are `const` in ROM.** An
imperative setter needs a WRAM shadow for every property it can touch —
four more arrays for a position and a size, one per prim. A BINDING
needs one byte, and for the values already tracked (`ov_last`) it needs
zero.

So: **which image is shown becomes a `pic_var`** — the widget draws
picture number N of a short declared list, N read from a variable. The
script writes the variable, as it already does for the fill. Same
gesture, same mental model, one new field.

This is not a new invention either: `pic_show` has had "image by
variable" since S7, on the BG1 layer.

**The cost, plainly:** every candidate image is resident in BG3 VRAM at
once, out of the layer's 256 characters (font 97, plus 9 per windowskin,
2 per icon, 96 per extra font). Four frames of a 2x2 image cost 16
characters — comfortable. Four frames of an 8x8 image cost 256 — the
budget error will say so, at compile time, with the arithmetic.

### 3.2 A hook is a call to a FUNCTION that already exists

The second temptation is to invent a place to write widget scripts. The
project already has two, and one of them fits exactly: **user functions**
(F1/F2b) take parameters, return a value, have local variables, and get
their own window (F1-c). A composed SCREEN already carries named scripts
(B6bis), which is the precedent for "a data object owning script".

So a widget's hook is not a new kind of script. It is a **dropdown in
the inspector: "appeler la fonction X"**, and the engine calls that
function with the row number as its parameter. No new authoring surface,
no new bytecode host, and the existing CALLF/RETF frame machinery is
already tested.

Hooks, kept deliberately few and free of meaning:

| Hook | Fires | Parameter |
|---|---|---|
| `on_show` / `on_hide` | SHOWUI on this widget | — |
| `on_move` | the cursor changed row (lists) | the row |
| `on_confirm` | A pressed (lists) | the row |
| `on_cancel` | B pressed (lists) | — |

`on_confirm` overlaps what "Choix dans une liste" already returns. That
is fine: the point is that with hooks a list works **without** the
blocking command, which is §3.3.

### 3.3 The open question: where does a hook RUN?

This is the decision the doc exists to take, and it is the only genuinely
hard part.

The VM has two contexts: the main one, and one parallel slot already
owned by parallel common events (`vm_parallel_update`, `common_lookup(1)`).
A hook needs somewhere to execute.

**Option A — in the main context, around the existing wait.** While a
modal list is up, the main context is parked in `VM_WAIT_LIST` and
executes nothing. A hook can borrow it: save the wait, CALLF, restore on
RETF. Cheap — a handful of lines, no new WRAM, no new concept. Buys
`on_move` / `on_confirm` / `on_cancel` on the list as it exists today.
Buys nothing for a non-modal list, because there is no wait to borrow.

**Option B — a third, UI-only context.** Its own pc, wait mode and call
stack (~16 bytes plus the frame stack). Hooks run there whatever the main
context is doing, which is what a non-modal list needs, and what
`on_show` / `on_hide` need in order to fire from anywhere. The real cost
is not the WRAM: it is that a third context is a third thing that can be
mid-script when a scene unloads, when a warp fires, when a save happens.
Every one of those paths has to know about it.

**Recommendation: A first, then B.** Option A answers the request as
written ("savoir quel élément a été sélectionné", reacting to it) at
almost no risk, and shipping it teaches us what authors actually attach
to a hook before the expensive context exists.

### 3.4 The rule that keeps it from rotting: a hook may not BLOCK

No message, no wait, no second list, no warp inside a hook. Not a
convention — a **compile-time check**: datagen already walks a function's
body, and it refuses one that contains a blocking command when that
function is used as a hook. The error names the command and the widget.

Without it, the first author who opens a dialogue from `on_move` gets a
menu that eats its own input, and the bug looks like an engine bug.

### 3.5 The four prohibitions

1. **No widget knows what it means.** A hook says "row 3 confirmed",
   never "the player chose Attack". The library decides.
2. **No hook the engine invents.** No `on_hp_low`, no `on_empty`. The
   engine fires what the player did, never what a number did.
3. **No widget-to-widget wiring in the data.** A hook is a function
   call; composition lives in events, where the author can read it.
4. **No property the engine assigns behind the author's back.** A bound
   property is watched, never written by the widget.

The test is the one G1/G2 and F0 already passed: grep the module for
game words. If it names a menu, an item or a hero, it failed.

## 4. The honest costs

1. **VRAM is the ceiling for `pic_var`**, not ROM. All the candidates
   live in BG3 at once, and BG3 has 256 characters for everything —
   font, skins, icons, widget images. A four-state image is fine; a
   four-state illustration is not, and datagen will refuse it with the
   arithmetic rather than silently overflow.
2. **`on_move` fires on every cursor step**, which is up to once a frame
   while a direction is held. A heavy hook body makes the menu feel
   sticky. The hook runs at most once per frame and never re-enters.
3. **Option B multiplies the states a scene change has to unwind.** Warp,
   save, composed screen, Mode 7 — each already has to reason about the
   main and parallel contexts. A third one is a third row in that table,
   and the bugs it produces are the hard kind (a hook half-run across a
   scene load).
4. **A non-modal list raises a question this doc does not answer: who
   owns the pad?** Today `VM_WAIT_LIST` reads it in the main VM because
   nothing else is running. A list that lives while the hero walks needs
   a stated owner for A and B, or the player will confirm a menu entry
   and talk to an NPC in the same press. That belongs to U3-c, with its
   own decision.

## 5. What the showcase will show

The inventory menu stops being a blocking call in the middle of a script:
the list stays up, `on_move` refreshes a description label beside it
(a real Final Fantasy reflex, impossible today), `on_confirm` uses the
item. Not one line of it names an item — the hook hands over a row, the
library reads the database.

## 6. Milestones

- **U3-a — the image by variable.** `pic_var` on the image widget: a
  short list of candidate pictures, the shown one from a variable, the
  VRAM budget checked at compile time. No hooks, no new context, and it
  answers the first half of the request literally.
- **U3-b — hooks on the modal list (option A).** `on_move`,
  `on_confirm`, `on_cancel` as a function call with the row as its
  parameter, borrowing the main context's wait. The datagen check that a
  hook does not block. The inspector's three dropdowns.
- **U3-c — the UI context (option B) and the LIVE list.** A widget that
  navigates while the game runs, `on_show` / `on_hide`, and the answer to
  "who owns the pad". This is the milestone that deserves its own doc
  section before it is written.

*U3 ends here. U3-a starts on the author's go.*
