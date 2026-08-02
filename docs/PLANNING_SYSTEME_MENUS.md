# MENUS & WIDGETS — build plan (Phase 12)

A CONTRACTUAL design document (same status as
`PLANNING_SYSTEME_DATABASE.md`): any implementation that diverges from it
updates it in the SAME commit. References: `SPEC_SYSTEME_UI.md` (§2
overlay, §5 scene stack), `SPEC_FORMATS.md` §2/§4.

What the user asked for, from agreed visual references:

- **A Zelda ALttP style HUD**: life hearts, a vertical magic gauge, icon
  counters (rupees/bombs/arrows), placed FREELY on screen — not just in
  the top band.
- **An FF4 style menu**: a full screen over the paused game, several
  windows (commands, party, time, gold), a cursor, stacked sub-screens
  (Item/Magic/Status…), B pops.

Everything is DATA: TOML layouts compiled by uigen, contents bound to
variables and to the database. No game content hard-coded in the engine.

---

## M1 — a unified UI screen buffer (engine prerequisite)

**The problem**: BG3 had three disjoint writers — the textbox (the
dialogue band, its own shadow), ui_overlay (rows 0-3, its own shadow) and
the timer (row 1, writing VRAM directly). Each transferred ITS OWN area:
an overlay outside the 0-3 band, or a widget on the side, would overwrite
or be overwritten by the dialogue; an overlay redraw already erased the
timer (a latent conflict).

**The fix**: the `ui_screen.c` module — ONE WRAM buffer `ui_map[32*28]`
(1792 bytes, `.bss` in $7E, under the checkwram ceiling) that is THE truth
of the BG3 layer. Every UI module draws into it (outside VBlank) and
declares the rows it touched through `ui_mark(row, h)`; at VBlank, ONE DMA
of the dirty row span (`ui_screen_vblank`). `ui_screen_init` clears the
whole map with the screen off (rows 28-31 of the 32x32 map included).

Consequences:

- textbox/ui_overlay/timer lose their shadows and their own `*_vblank()`;
  the cell macros become ABSOLUTE (no more `UI_SHADOW_ROW` in the
  addressing — it survives only as the area to clear when the dialogue
  closes).
- the timer is composed into the buffer like everything else: no more
  overlay/timer conflict. (Accepted case: a dialogue window covering the
  timer's row erases it until the next tick.)
- VBlank cost: a contiguous dirty span, 64 bytes per row — a typical
  dialogue is 512 bytes (as before), the full-screen worst case 1792
  bytes (rare, within budget).

**Validation**: boot 200 frames pixel-identical; the demo dialogue
sequence (typewriter, `\v[n]`) and the uitest project (HUD + parallel +
floating window) compared FRAME BY FRAME between the before and after
ROMs — no difference expected, this is a pure refactor.

## W1 — Zelda style HUD widgets (content types v2)

An extension of the overlay context (uigen `[[overlay]]`): new `content`
kinds, FREE placement (thanks to M1) and an optional frame.

- **Free placement**: `pos` anywhere in the 32x28 screen (no more rows 0-3
  restriction). Still forbidden: overlapping the layout's message or
  choice window (a uigen error, and an editor one). `UI_SHADOW_*` still
  describes the message/choice union; overlays outside that band are no
  longer constrained by it.
- **`frame = false`** (default true): no 9-slice frame and no background —
  the widget sits on the game like Zelda's hearts (transparent chars
  around it). Minimum sizes drop to 1x1.
- **New `content` kinds**:
  - `variable_display` (existing): a label plus a value.
  - `gauge`: a fill bar bound to `var`, `max` (a constant or a second
    variable), `dir = "h"|"v"` — with dedicated gauge chars (full, half,
    empty) in the icon sheet.
  - `icon_row`: N repeated icons (hearts) — `var` is the current value,
    `max` the maximum, 2 units per icon (full/half/empty, RM rounding).
  - `icon_value`: an icon plus an aligned counter (rupees "072", optional
    leading zeros through `pad`).
- **UI icon sheet**: an `8xN` PNG (8x8 chars, the font's palette, 4
  colours) imported through the **resource manager** (IconSet category),
  appended by datagen after the windowskin (BG3 chars 106+). Widgets
  reference an icon by index. Budget: BG3 VRAM tolerates >= 64 icons —
  dbgen validates it.
- Redraw: as today, only when `vars16[var]` changes; composes into
  `ui_map` plus `ui_mark`.
- Editor: the UI / Theme window gains the new types (a form per type and a
  faithful preview, with the real icons).

## M2 — declarative menu screens

- `ui/menus/*.toml` (uigen): a SCREEN is windows with static contents
  (text), bindings (`\v[n]`, the timer, database fields through the DBREAD
  machinery) and W1 widgets.
- Opening: the "Open the menu" event command, plus a project option
  "button X opens menu `<id>`". The game is PAUSED underneath (the sysmenu
  model); the HUD overlay is hidden during a full-screen menu.
- The current System menu (START: save/load) stays as it is and will be
  absorbed later (M4+).

## M3 — lists, cursor, stack

- A `list` window: vertical entries, a cursor (font chars or an icon), A
  triggers the entry's ACTION — `open <screen>` (pushes) or
  `common_event <n>`; B pops, and an empty stack returns to the game.
  A stack of 4 screens (static), following spec §5.
- This is the step that makes the FF4 menu possible: the root screen is a
  list window (Item/Magic/…) plus a party window (database bindings) plus
  time and gold windows.

## M4 — FF4 comfort

- Portraits and images inside a window (dedicated 4bpp tiles — a VRAM
  study is still needed, probably a per-screen budget).
- Lists POPULATED from a database table (an inventory = the items table
  plus quantities in variables), with pagination.
- HP gauges in the records, the spec's `hp_bar`.

## The order taken, and where it stands

| Step | Content | State |
|------|---------|-------|
| M1 | the unified ui_screen buffer | done |
| W1 | Zelda widgets (gauge/icon_row/icon_value, frame, IconSet, free placement) | done — detail in SPEC_SYSTEME_UI.md (appendix) |
| D1 | canvas designer (window/vbox/hbox/label/value/image tree, flattener, palette/tree/inspector) | done — an explicit request (the UMG / Chrono Trigger model), detail in SPEC_SYSTEME_UI.md |
| M2 | declarative screens and opening them | to do |
| M3 | lists + cursor + stack (the designer's list object becomes navigable) | to do |
| M4 | portraits, database lists, hp_bar | to do |

Where W1 diverged from the plan above: `icon_row` is horizontal only (a
vertical `gauge` covers the column case); half units follow a "2 units per
tile, truncate" rule rather than RM rounding; the timer is refreshed like
the widgets after the dialogue band is cleared; and the IconSet also has
PNG EXPORT (a user request).
