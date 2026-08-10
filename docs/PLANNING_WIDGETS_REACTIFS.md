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

## 3. The design — Unreal's gesture, this engine's mechanism

The author's second directive: *"il faudrait que la philosophie de script
se rapproche d'Unreal ou de Unity dans la façon dont on se branche à un
widget, tout en restant dans le système de script d'event."*

That is the right frame, and it splits cleanly. Unreal's UMG binds to a
widget in exactly two ways, and this engine already has an honest
counterpart for each — but only one of them can be copied literally.

| UMG / uGUI | Here | Why not literal |
|---|---|---|
| A property's **Bind** dropdown → a function evaluated EVERY FRAME | The property is bound to a **VARIABLE**; the engine compares it each frame and redraws when it moves | A script per property per frame is out of reach at 3.58 MHz. The compare is what `overlay_update` already does — one u16 compare per primitive, and only a change costs a redraw. |
| **Events** panel: `OnClicked` `+` drops a node into the widget's graph | An **event-command block embedded in the widget**, edited in the ordinary event editor | Nothing. This one ports straight across — a composed SCREEN already carries named scripts (B6bis), and `CommandListEditor` is already an exported, reusable component. |
| The event node's **pins** (which item, which value) | A field on the hook: *"écrire la ligne dans la variable X"*, which the block then reads | Script blocks have no parameters. And "Choix dans une liste" already answers into a variable the author picks, so this is the existing idiom rather than a new one. |
| Unity's **list of persistent listeners**, several per event | ONE block per hook; sequencing lives inside it | Several listeners with no visible order is precisely what becomes unreadable in a Unity project. A block you can read top to bottom is worth more than fan-out. |

### 3.1 Binding a property: the gesture moves to the property itself

The mechanism does not change — a widget WATCHES a variable, a script
writes it, one direction, no coupling. What changes is where the author
meets it. Today "piloté par une variable en jeu" is a checkbox some way
down the inspector; it IS a bind toggle, just not named or placed like
one.

So every bindable property grows the same affordance, right next to the
field: a **⛓ button** that turns a fixed value into "suit la variable
[…]", with the variable picker the rest of the editor already uses.
Bindable in U3:

- **Remplissage** (already bindable — it only gets the new affordance)
- **Image affichée**: a short declared list of candidate pictures, the
  shown one from a variable. New; see §3.2.
- **Visible**: SHOWUI already does this imperatively; a binding makes it
  declarative, which is what a HUD wants.

The reason a setter command ("Modifier un widget → propriété → valeur")
is still refused, and it is structural rather than aesthetic: **the
primitive tables are `const` in ROM.** An imperative setter needs a WRAM
shadow for every property it can touch. A binding needs one byte — and
for values already tracked in `ov_last`, none.

### 3.2 The image by variable

The widget draws picture number N of a short declared list, N read from a
variable. Not a new invention: `pic_show` has had "image by variable"
since S7, on the BG1 layer.

**The cost, plainly:** every candidate is resident in BG3 VRAM at once,
out of the layer's 256 characters (font 97, plus 9 per windowskin, 2 per
icon, 96 per extra font). Four frames of a 2x2 image cost 16 characters —
comfortable. Four frames of an 8x8 image cost 256 — and the budget error
will say so at compile time, with the arithmetic.

### 3.3 Hooks: the script lives ON the widget

Not a dropdown pointing at a global function — the point of Unreal's `+`
is that the reaction is written where the widget is, and stays visible
next to it. So the inspector grows an **Événements** section:

```
Événements
  ▸ Au déplacement du curseur   ligne -> var [12]   [+ / ✎ 3 cmd]
  ▸ À la validation (A)         ligne -> var [12]   [✎ 5 cmd]
  ▸ À l'annulation (B)          —                   [+]
  ▸ À l'affichage / au masquage —                   [+] [+]
```

`+` opens the ordinary event-command editor on that block — the same
`CommandListEditor` the Écrans window embeds. datagen compiles each block
into a script label exactly as `screens.rs` unrolls a screen's named
scripts. **No new bytecode host, no new authoring surface, no function
indirection.**

Hooks, kept deliberately few and free of meaning:

| Hook | Fires | Hands over |
|---|---|---|
| `on_show` / `on_hide` | SHOWUI on this widget | — |
| `on_move` | the cursor changed row (lists) | the row, in the chosen variable |
| `on_confirm` | A pressed (lists) | the row, in the chosen variable |
| `on_cancel` | B pressed (lists) | — |

For a list sourced on a database table, the variable receives the chosen
**entry's number**, as "Choix dans une liste" already does — so the block
can go straight to "Lire la database" without knowing what a row is.

`on_confirm` overlaps what the blocking command already returns. That is
fine: the point is that with hooks a list works **without** it, which is
§3.4.

### 3.4 The open question: where does a hook RUN?

This is the decision the doc exists to take, and it is the only genuinely
hard part. It is unchanged by the authoring model above.

The VM has two contexts: the main one, and one parallel slot already
owned by parallel common events (`vm_parallel_update`, `common_lookup(1)`).
A hook needs somewhere to execute.

**Option A — in the main context, around the existing wait.** While a
modal list is up, the main context is parked in `VM_WAIT_LIST` and
executes nothing. A hook can borrow it: save the wait, run the block,
restore when it returns. Cheap — no new WRAM, no new concept. Buys
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
written at almost no risk, and shipping it teaches us what authors
actually attach to a hook before the expensive context exists.

### 3.5 The rule that keeps it from rotting: a hook may not BLOCK

No message, no wait, no second list, no warp inside a hook. Not a
convention — a **compile-time check**: datagen already walks a command
list, and it refuses one used as a hook that contains a blocking
command. The error names the command and the widget.

Without it, the first author who opens a dialogue from `on_move` gets a
menu that eats its own input, and the bug looks like an engine bug.

### 3.6 The four prohibitions

1. **No widget knows what it means.** A hook says "row 3 confirmed",
   never "the player chose Attack". The library decides.
2. **No hook the engine invents.** No `on_hp_low`, no `on_empty`. The
   engine fires what the player did, never what a number did.
3. **No widget-to-widget wiring in the data.** A hook is a command
   list; composition lives in events, where the author can read it.
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

- **U3-a — binding, with Unreal's gesture.** The ⛓ affordance next to
  every bindable property (remplissage, visible), and the new one:
  **image by variable**, with the BG3 budget checked at compile time. No
  hooks, no new context — and it answers the first half of the request
  literally.
- **U3-b — hooks on the modal list (option A).** An **Événements**
  section in the inspector, each hook an embedded command block edited
  with the existing `CommandListEditor` and compiled the way `screens.rs`
  compiles a screen's scripts; the "ligne -> variable" field; the datagen
  check that a hook does not block. The reaction is written on the
  widget, which is the whole point.
- **U3-c — the UI context (option B) and the LIVE list.** A widget that
  navigates while the game runs, `on_show` / `on_hide`, and the answer to
  "who owns the pad". This is the milestone that deserves its own doc
  section before it is written.

*U3-a and U3-b are SHIPPED — see the "Implementation status" section of
`SPEC_SYSTEME_UI.md`. U3-c (the UI context and the live list) starts on
the author's go, and its "who owns the pad" question wants an answer
before a line is written.*
