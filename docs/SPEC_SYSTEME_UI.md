# SNES STUDIO — UI System specification

**Goal:** let creators fully customise their game's interface (dialogues,
HUD, menus) — from Dragon Quest to Final Fantasy — without coding, through
**declarative layouts**: UI screens are data, not code.
**Design references:** RPG Maker windowskins (the dressing), FF6/DQ/Chrono
Trigger menus (layout variety), Earthbound/Undertale (scripted menu
scenes).
**Builds on:** the database system (`PLANNING_SYSTEME_DATABASE.md`) for
the themes, and the scene format plus the VM (`KIT_PHASE1_POC_MOTEUR.md`)
for full-screen menus.

---

## 1. SNES technical foundations

- **The UI display channel:** BG3 in mode 1 (2bpp = 4 colours per palette,
  8 palettes). Cheap in VRAM, with display priority above the game BGs.
- **Windows:** built from tiles through a **9-slice windowskin** (4
  corners, 4 edges, 1 fill, 8x8 tiles) — frames of arbitrary size from 9
  tiles. A translucent background is possible through color math (as in
  FF6).
- **Text:** an 8x8 font (1 tile = 1 character), fixed width in v1. The
  glyph set is the creator's (an imported PNG): ASCII plus French accents
  at minimum.
- **Cursors and ornaments:** sprites (DQ's hand, FF's arrow) — animatable,
  independent of the tile grid.
- **Positions and sizes: ALWAYS in tiles** (units of 8 px). Alignment is
  guaranteed by construction, and budgets are checkable at compile time.

---

## 2. The three display contexts

One layout format, three ways of existing:

| Context | Description | Examples | Mechanism |
|---------|-------------|----------|-----------|
| **overlay** | Permanent windows during gameplay | HP bar, gold, a quest counter, a compass | Drawn on BG3 continuously; a limited area (at most 4 tile rows, top or bottom) validated at compile time |
| **popup** | Temporary windows over the game, world paused or not | The dialogue textbox, the choice menu, the name of an item received | Opened and closed by the VM or the engine; they temporarily cover the overlay |
| **screen** | Full screens, a complete change of graphics context | Main menu, inventory, status, battle screen, shops | A **MENU type scene** through the scene stack (see §5) |

---

## 3. Declarative layout format

One TOML file per screen or set, compiled to binary by `uigen` (a Rust
tool, Phase 2/4).

```toml
# ui/menu_main_dq.toml — a Dragon Quest style example
[screen]
id = "menu_main"
context = "screen"
theme = "THEME_DEFAULT"          # a ref into the UITheme table (database)

[[window]]
id = "commands"
pos = [1, 1]                     # in tiles [x, y]
size = [8, 12]                   # in tiles [w, h]
content = "command_list"
items = ["items", "magic", "equip", "status", "save"]  # engine command IDs
columns = 1

[[window]]
id = "gold"
pos = [22, 1]
size = [8, 3]
content = "gold_display"

[navigation]
initial_focus = "commands"
# v2: a navigation graph between windows (confirm/cancel → which window)
```

**Format rules:**
- Positions and sizes in tiles only; the compiler rejects forbidden
  overlaps and anything running off screen.
- `content` must be in the catalogue (§4); the parameters accepted depend
  on the type.
- A layout references a theme; the theme is interchangeable without
  touching the layout (changing the dressing is not changing the
  structure).
- Budgets validated at compile time: the layout's total tiles, the number
  of simultaneous windows (max 8 per screen in v1), text depth.

---

## 4. Catalogue of content types

The engine knows how to draw each type in a window of arbitrary size. That
is THE extension point of the system: each version enriches the catalogue.

### v1 (Phase 4)
| Type | Description | Parameters |
|------|-------------|------------|
| `text` | Static text, or a text_id | text_id, alignment |
| `message` | The textbox's contents (typewriter, advance) | speed (through the theme) |
| `choice_list` | A choice list driven by the VM | columns |
| `gold_display` | The player's gold with a configurable suffix | — |
| `variable_display` | A variable's value plus a label (custom quest counters) | var_id, label text_id |
| `hp_bar` | A life gauge in tiles (full/partial/empty) | actor_ref, style (gauge or numbers) |

### v2 (with the full RPG systems)
| Type | Description |
|------|-------------|
| `command_list` | Menu commands (branch to the engine screens) |
| `party_list` | The heroes: name, portrait, HP/MP, states |
| `item_grid` | A paginated inventory, quantities, a 2D cursor |
| `stat_block` | A hero's stat block (reads the Stats database) |
| `portrait` | An actor's portrait (budgeted VRAM streaming) |
| `icon_row` | A row of icons (states, key items) |
| `timer_display` | The game timer |

### v3+ (if the community asks)
- Scriptable content types: a window whose contents are drawn by a VM
  script (tile/text drawing opcodes) — the escape valve for needs the
  catalogue does not cover.

---

## 5. Full-screen menus: the scene stack

**The principle:** a full-screen menu is a **scene** (`scene_type = MENU`)
— "teleporting to the menu" is a real change of graphics context, as on
the hardware of the era (FF6 genuinely unloads the world's tiles to load
the menu's).

**Push/pop mechanism:**
```
[Game scene active]
   │  the menu opens (an event, the START key)
   ▼
scene_push(SCENE_MENU_MAIN)
   ├─ the game scene's WRAM context is saved (map, position, actors)
   ├─ fade out (~2-3 frames), VRAM unloaded and reloaded
   └─ the MENU scene runs (layouts + VM)
   │  closing (cancel, a "back" command)
   ▼
scene_pop()
   ├─ the context is restored, the world's tiles reloaded
   └─ fade in — the player resumes exactly where they were
```

- **Stack depth: 2 in v1** (game → menu). Extensible to 3 if the need is
  proven (game → menu → a full sub-screen).
- Popups and overlays do NOT go through the stack (no VRAM context
  change).
- **Creative menu-scenes:** a menu scene can also be a TOP_DOWN scene with
  a `pause_world` flag — a menu that is a room where the character walks
  between objects (Earthbound/Undertale style). Two existing bricks, no
  new system.

---

## 6. The theme (dressing) — the `UITheme` database table

A schema in the database system (a table like any other):

```
UITheme {
  windowskin: asset_ref      # a 24x24 PNG → 9-slice
  font: asset_ref            # a PNG of 8x8 glyphs
  text_color: u8             # a palette index
  text_speed: u8             # frames per character (0 = instant)
  window_opacity: u8         # through color math (0/25/50/100%)
  cursor_sprite: asset_ref
  cursor_anim_speed: u8
  sfx_cursor: ref:sounds     # v2, system sounds
  sfx_confirm: ref:sounds
  sfx_cancel: ref:sounds
}
```

- Several themes per game are possible; switching is done by an event (the
  VM opcode `SET_THEME`).
- The theme is orthogonal to the layouts: same screens, different
  dressing.

---

## 7. On the editor side

| Phase | Deliverable |
|-------|-------------|
| **P3** | Nothing (the engine's hard-coded textbox) |
| **P4** | A **UI/Theme** tab: windowskin and font import with validation, a theme form (generated from the schema), a **live preview** (a canvas simulating the textbox plus choices with the theme, faithful tile rendering) |
| **v2** | A **grid layout designer**: drag windows onto the tile grid, pick the content type from a list, parameters in a panel, live preview. Plus **shipped presets**: "Dragon Quest", "Final Fantasy", "Minimal" |
| **v3+** | A navigation editor (the focus/confirm/cancel graph), scriptable content types |

**Editor principles:** the designer is *constrained by the grid* (no
free pixel placement — that is a feature, not a limit: an invalid layout
cannot be created). The validation is `uigen`'s, exposed live. The presets
are plain TOML files — the community will be able to share them.

---

## 8. Planning impact (precision, not lengthening)

- **Phase 1:** a hard-coded textbox — NO change to the kit.
- **Phase 2:** reserve `uigen`'s place in tools/ (a skeleton, no
  implementation).
- **Phase 4:** the system is born — windowskin, theme, `uigen` v1, the
  textbox and the choice_list move to the layout format, a minimal overlay
  context (hp_bar/gold optional). ~2-3 weeks folded into the phase.
- **v2:** the full catalogue + the MENU scene stack + the grid designer,
  at the pace of the RPG systems (inventory → item_grid, combat → battle
  screens, and so on).

---

## 9. Design rules

1. **Structure ≠ dressing ≠ content.** Layout (structure), theme
   (dressing) and database/VM (content) are three independent,
   recombinable axes.
2. **Everything in tiles.** No pixel position in the layouts — the grid is
   the contract with the hardware.
3. **The compiler refuses the invalid.** VRAM, window and area budgets are
   checked by uigen, never discovered in game.
4. **The catalogue grows, the format does not change.** Adding a content
   type = engine code plus a catalogue entry; existing layouts stay valid.
5. **Presets first.** Every new power ships with careful presets — 80 % of
   creators start from one, and the presets are the showcase of what the
   tool can do.

---

## Implementation status (Phase 11)

- **Shipped (step A)**: the 9-slice windowskin (24x24, the font's palette,
  BG3 chars 97-105), theme v1 in `project.json "ui"` (windowskin,
  text_speed), the typewriter (A reveals, then closes).
- **Shipped (step B)**: `ui/layout.toml` (uigen, datagen's `ui.rs` module)
  — movable `message`/`choice` windows, the **overlay** context (the top 4
  rows, 8 windows max, `variable_display`), compile-time validation
  (bounds, area, overlaps), and the `ui_overlay.c` engine side.
- **Shipped (step C)**: the editor's "UI / Thème" window (Tools >) — the
  windowskin chosen among the resources (the validated 24x24 import lives
  in the resource manager, WindowSkin category; the `windowskins` register
  of project.json), text speed, the full layout (message/choice/overlays)
  under the SAME rules as uigen (OK blocked on an error, §9.3) and a
  256x224 preview faithful to the tiles (the project's real font and
  skin). Writes `ui/layout.toml` plus `project.json "ui"`. See
  `EDITOR.md`.
- **Shipped (Phase 12 M1)**: the unified UI screen buffer `ui_screen.c` —
  ui_map[32*28] is THE truth of BG3, textbox/overlay/timer compose into it
  outside VBlank (ui_mark), and a single DMA of the dirty span goes out at
  VBlank. A prerequisite for free widget placement and for MENU screens.
  See `PLANNING_SYSTEME_MENUS.md` (the contractual Phase 12 plan).
- **Shipped (Phase 12 W1) — Zelda style HUD widgets.** The layout's
  `[[overlay]]` context becomes a widget system:
  - **FREE placement** on the 32x28 screen (v1's "rows 0-3" area is
    abolished). Forbidden: overlapping another overlay, or the
    message/choice windows (the dialogues would overwrite it — uigen and
    the editor refuse it). The dialogue band redraws the widgets it
    borders on each opening (`overlay_refresh`, likewise the timer).
  - `content`: `variable_display` (v1), `gauge` (a full/half/empty bar,
    `dir = "h"|"v"` — the vertical one filled from the BOTTOM up, ALttP),
    `icon_row` (repeated icons, hearts style), `icon_value` (an icon plus
    a counter, `pad` = leading zeros 0-5).
  - `frame = true|false`: a 9-slice frame/box, or a BARE widget laid over
    the game (default: true for variable_display, false for the widgets).
    Minimums: framed 3x3 (4x3 for vardisp), bare 1x1 (2x1 for icon_value,
    3x1 for vardisp).
  - `var` = the measured variable; `max = n` constant OR `max_var = n`
    (gauges and hearts, 2 units per tile, clamped to the max); `icon = n`
    in the **icon sheet**: `project.json "ui" { "icons": png }`, an Nx8
    strip (<= 64), the font's palette, chars `UI_ICON_BASE`+ (after the
    windowskin) — gauge/icon_row consume n, n+1, n+2 = full, half, empty.
  - Engine: `ui_ov_type/frame/icon/dir/pad/maxvar/maxlo+maxhi` (the u16
    split — no bare u16), redrawn when var OR max_var changes.
  - Editor: the **IconSet** category in the resource manager (a validated
    Nx8 strip import, PNG EXPORT, rename, deletion blocked while the sheet
    is active ★, a preview with the index under each icon), the sheet
    selected in UI / Thème, per-type widget forms and a faithful preview
    (real icons, a gauge filled to 58 %).
- **Shipped (Phase 12 D1) — the canvas designer (the UMG model).**
  `ui/layout.toml` moves to a `[[node]]` TREE format (W1's flat
  `[[overlay]]` entries are still accepted — a transparent migration):
  - containers: `window` (a 9-slice frame, explicit size, margin=[1,1],
    stacks its children vertically), `vbox` (vertical stacking, gap),
    `hbox` (horizontal layout, gap);
  - leaves: `label` (static text), `value` (a variable, width 1-5,
    right-aligned), `image` (a run of icons), plus the W1 widgets
    (`gauge`/`icon_row`/`icon_value`/`variable_display`), plus `list`
    (B6: a cursor menu — `items = ["Attaque", …]`, 2-16 ASCII items,
    frame true by default, AUTO size: 1 cursor column plus the longest
    item; driven by the LISTSEL opcode, see SPEC_FORMATS §2);
  - `parent = "id"` attaches to a container, a root carries `pos`;
  - uigen FLATTENS the tree into primitives positioned in tiles (engine
    types 4 panel / 5 label / 6 image — STATIC, 7 list (B6), plus 0-3 from
    W1, capped at 32 primitives, with a `ui_ov_bg` table: the empty cells
    of a widget laid inside a window take the frame's background instead
    of punching through to the game). No containers at runtime.
  - Icons on a panel: datagen automatically generates a "panel background"
    VARIANT of each icon (transparent pixels → colour 1, chars
    UI_ICON_BASE + UI_ICON_COUNT + n) — the engine uses it when the icon
    lives inside a window (ui_ov_bg), so the icon shows the frame behind
    it and not the game. VRAM budget: 106 + 2×64 chars max <= 256.
  - `value`: `align = "left"` sticks the value to the preceding text
    (through the dir flag, unused by type 0) — by default it is
    right-aligned within its width. The `gap` step stays 1 tile = 8 px
    (the BG3 hardware grid; no half-tile without a variable-width font).
  - NAMED widgets in the editor: each root is a widget; the designer's
    "Widgets" list offers ✧ Nouveau widget (laid on a FREE spot of the
    canvas, with the designer opened on it), scoped editing (the structure
    limited to the widget, the others dimmed on the canvas — clicking
    another widget switches to it), and ⛶ Tout l'écran to unscope.
  - Editor: the UI / Thème window becomes the **designer** — an object
    palette, a tree (selection, ↑↓, cascading deletion), an interactive
    canvas (click = select the deepest node, drag = move the root, corner
    handle = resize, tile snap), a per-type inspector (variable and icon
    pickers), live errors mirroring uigen (uilayout.ts), OK blocked when
    invalid. The round trip is proven: the TOML the editor writes gives
    uigen back the same primitives.
- **Shipped (Phase 12, scripted visibility)**: widgets are HIDDEN by
  default (`visible = true` on a root means visible at boot; W1's
  `[[overlay]]` entries stay visible — compatibility). VM opcode 0x24
  `SHOWUI [widget][on]` plus the "Afficher/cacher un widget UI" event
  command (the name resolved to the root index at compile time). Engine:
  runtime visibility per widget (`ui_ov_widget` per primitive,
  `ui_widget_vis` initially, `overlay_show` draws or erases, update and
  refresh respect the state, values tracked even while hidden). Editor:
  the window becomes "UI" in TWO PAGES — the widget list (👁 visible at
  boot, Éditer…, 🗑, ✧ Nouveau) then the designer scoped on the chosen
  widget (← Widgets to go back, "Vue d'ensemble" for the whole screen).
- **Shipped (Phase 12, S1 — dialogue styles)**: several NAMED DIALOGUE
  BOXES, on top of the default box (always there).
  - Layout: `[[dialog_style]]` blocks in `ui/layout.toml` (max 3 beyond
    the default) — a unique ASCII `id`, `windowskin` (default: the
    theme's), `font` (a 768x8 PNG, default: `assets.font`), `message` /
    `choice` (windows of its own, min 8x3; choice inherits the style's
    message, message inherits `[message]`). Overlays must not overlap ANY
    window of ANY style (their union is the UI_SHADOW band).
  - Datagen: a deduplicated BG3 VRAM plan — font 0 (97 chars, base 1),
    skins at 9 chars each, icons 2×N, then the EXTRA fonts at 96 chars
    (based on ' ') after the icons; the 256-char budget is checked with a
    detailed error. v1: every font and skin shares font 0's PALETTE (CGRAM
    16-19). The `ui_styles.c` tables
    (`ui_st_mx/my/mw/mh/cx/cy/cw/ch/font/skin`, row 0 = the default) plus
    `UI_STYLE_COUNT` in ui_cfg.h — ALWAYS generated.
  - VM: opcode 0x27 `DLGSTYLE [n]` arms the style of the NEXT box; emitted
    before each msg/choice ONLY when the project has styles (otherwise the
    bytecode is byte-identical). A `style` field on the msg/choice
    commands (absent = the default) — the name resolved at compile time,
    with an error listing the known styles.
  - Engine: a textbox with RUNTIME geometry, font and skin
    (`textbox_set_style`, copying the tables; `TB_CHAR` = the style's font
    base). MIND THE LAG FRAME: the skin test is hoisted OUT of the loops
    in `tb_box_at` — opening a message grazes a frame's budget, so tread
    carefully on that hot path.
  - Editor: Tools > UI > Dialogues et choix is a "Boîtes de dialogue" list
    ((défaut) ★ plus the styles: ✧ Nouveau, ✎ rename, 🗑); per style: the
    windowskin, the font, its own windows; a preview with the selected
    style's skin AND font. The Message/Choice forms gain a "Boîte de
    dialogue" select. The FontSet resource (a 768x8 import, PNG EXPORT,
    rename — the styles follow — and deletion blocked when it is the
    project font ★ or used by a style).
- **Shipped (Phase 12, S2 — a font per widget)**: `font` on a widget's
  ROOT (a `[[node]]` with no parent — a uigen error on a child): all the
  widget's text (labels, values, counters) is drawn with that font.
  Datagen: widget fonts join the same deduplicated VRAM plan as the
  styles' (a shared font costs its 96 chars once); a `ui_ov_font[]` table
  per PRIMITIVE (the base of the ' ' glyph, 1 = the project font) in
  ui_overlays.c — ALWAYS emitted. Engine: `OV_FCHAR` = `ui_ov_font[i] +
  ascii - 32` in ov_draw (types 0/3/5, digits included) — equivalent to
  the old `OV_CHAR` when the table holds 1, so rendering is unchanged for
  projects with no widget font. Editor: a "Fonte du widget" select in the
  inspector (roots only), a canvas preview using each widget's font;
  renaming and deleting a FontSet account for widgets as well as styles.
- **Shipped (U1) — the designer moves closer to Unity.** Eight changes,
  asked for together because they hold each other up:
  1. **Widgets MAY OVERLAP.** The rule "two widgets may not overlap" was
     never a design choice: it was the shape of a bug. The UI layer is a
     single shared tilemap, and a primitive used to paint (or erase) its
     rect on its own, so whoever shared that rect got a hole punched
     through it. `ui_overlay.c` now repaints by RECT: `ov_repaint` clears
     an area and replays, in emission order — which IS the z-order —
     every visible primitive that meets it, growing the rect until it is
     closed under that. `ov_draw` takes that path as soon as anything
     overlaps and keeps the cheap direct paint otherwise, so the common
     case costs nothing. The later widget wins. **A widget still may not
     overlap a dialogue window**: the textbox writes into the same
     tilemap and is not a primitive, so no repaint can bring the widget
     back — that check stays an error in uigen and in the designer.
  2. **Anchors, Unity style.** A root carries `anchor` (t/m/b then
     l/c/r, default `"tl"`) and its `pos` is an OFFSET from that point;
     the same corner of the widget is pinned to it, so a `"br"` widget
     keeps its bottom-right corner put as it grows. The inspector shows
     the 3x3 grid next to x/y, and switching anchor keeps the widget
     where it is by recomputing the offset.
  3. **Keyboard in the tree**: Ctrl+C / Ctrl+X / Ctrl+V (a subtree, with
     fresh ids that keep pointing at each other), Suppr, Ctrl+Z, Ctrl+Y
     — as on the map's event layer. A drag is ONE undo step.
  4. **The image widget gains Unity's types**: `mode = "normal"`
     (default), `"sliced"` (a 3x3 picture stretched over `size` — the
     windowskin recipe opened to any image, prim 9) and `"fill"` (the
     image revealed in proportion to `var`/`max`, `dir = "v"` filling
     upwards, prim 10). A fill has TWO units per tile: datagen lays a
     CUT copy of the picture right after the whole one (`gfx.rs`, half
     the pixels of each tile blanked) and the engine picks between them.
     The unfilled part keeps the background — put the "empty" artwork
     BEHIND, which point 1 has just made legal. On the ICON sheet, fill
     is the classic three-icon bar (full, half, empty) — prim 1, the old
     gauge, reused as is.
  5. **Deleting a widget's root** no longer drops the designer into the
     whole-screen view, which showed every OTHER widget and read as a
     bug: it goes back to the widget list.
  6. **Five components leave the palette**: Valeur, Jauge, Cœurs, Icône +
     compteur, Libellé + valeur. Each was a specific answer to something
     the generic parts now do — a **label may interpolate variables**
     (`\v[n]`, `\v[n,w]` right-aligned on w columns, `\v[n,0w]`
     zero-padded; at most TWO per label, which is what the engine
     watches — beyond that, split across an hbox) and an **image in fill
     mode** is the gauge and the hearts. The five types are still read,
     drawn and compiled, so no existing project breaks; they simply
     cannot be created any more. Encoding: datagen turns each escape
     into the three bytes `0x01`, variable + 1, format (prim 11), and
     emits labels as C strings with OCTAL escapes — `\x` in C is greedy
     and would swallow the next letter. In TOML, write `"PV \\v[10,3]"`
     or `'PV \v[10,3]'`: `\v` is not a legal escape in a basic string.
  7. **`window` is renamed `canvas`** — read under both names, migrated
     on load by the editor.
  8. **A canvas has NO frame by default.** It is a placement box that
     draws nothing; `frame = true` dresses it with the windowskin. A
     bare canvas also gives its children no background and starts its
     margin at zero. The old `window` keeps framing by default, so
     nothing changes look.
- **Shipped (U2) — the five follow-ups to U1.**
  1. **A widget may also overlap a DIALOGUE window.** U1 kept that as an
     error because the textbox is not a primitive and no repaint can
     bring a widget back from under it. True, but it blocked layouts for
     nothing: the answer is simply to say who wins. `ui_band_up` (set by
     `tb_box_at`, cleared by `textbox_close`, both BEFORE the band is
     cleared) marks the dialogue's rows as the box's; while it is up,
     ui_overlay paints, clears and repaints nothing that touches them,
     and `overlay_refresh` blanks the rows a straddling widget owns
     OUTSIDE the band too — a canvas showing only the one row poking
     above the box reads as a bug, not a feature. The whole widget comes
     back the moment the message closes. The designer says so as a NOTE,
     not an error: OK is no longer blocked.
  2. **An image is a SOLID COLOUR by default** (`color = 0-3`), with a
     picker limited to the four colours the UI layer actually has — the
     font's, read from its PNG palette in palette order, which is the
     order the compiler indexes them by. Colour 0 is transparency.
     datagen registers each used colour as a one-character "picture", so
     it rides the same VRAM plan; the cost is one char per colour.
  3. **The image source is picked directly**: Couleur unie / Image du
     projet / Icônes de la planche, the project's pictures one click
     away instead of behind an icon-sheet default.
  4. **A fill needs no variable.** `fill = 0.0 … 1.0` sets the amount
     once, in the inspector, on a slider; ticking "piloté par une
     variable" switches to the old var/max contract. datagen bakes the
     constant into the primitive's `pad` field as 1 + a percentage, and
     the engine reads `pad != 0` as "constant, out of 100" — so a
     hand-set fill costs no variable, and `overlay_update` skips it.
  5. **Size and anchor on EVERY object**, not just the canvas. An
     explicit `size` overrides the one the content computes (with an
     "auto" button to give it back where the compiler does not insist on
     one), and a canvas child that carries `pos` is placed FREELY inside
     its parent, anchored to the parent's inside exactly as a root is to
     the screen. A child with no `pos` keeps stacking, so nothing
     changes for existing layouts; a vbox/hbox always stacks — that is
     what they are for.
- **Shipped (U3-a) — binding a property, with Unreal's gesture.** See
  `PLANNING_WIDGETS_REACTIFS.md` for the whole design. UMG binds a
  property to a function evaluated every frame; that is out of reach at
  3.58 MHz, so a property binds to a **VARIABLE** and the engine compares
  it — which is what `overlay_update` already did for a value. What
  changes is where the author meets it: a **⛓ button next to the field**
  turns a fixed value into "suit la variable […]".
  - **Remplissage** was already bindable; it only gets the affordance.
  - **Image affichée** is new: `pics = [...]` plus `pic_var`. The
    candidates must all be the same size in tiles, they live in BG3 VRAM
    at once and CONTIGUOUSLY — datagen pushes them as a block under a
    synthetic key so a picture used elsewhere never breaks the run — and
    the engine reads `base + N * stride` (`ui_ov_picvar/picn/picstr`,
    with `ov_lastpic` as the redraw shadow). Out of range clamps rather
    than reading whatever sits next in VRAM.
  - **Visible** gains `vis_var` on a root: the widget follows the
    variable, on or off, checked once per frame in `overlay_update`
    against `ui_widget_visvar[]`. SHOWUI still works; this is its
    declarative twin.
  An imperative setter ("Modifier un widget → propriété → valeur") stays
  refused for a structural reason: the primitive tables are `const` in
  ROM, so a setter needs a WRAM shadow per property, where a binding
  needs one byte.
- **Shipped (U3-b) — the script written ON the widget.** The point of
  Unreal's `+` is that the reaction lives where the widget is, so a hook
  is NOT a dropdown pointing at a global function: it is an ordinary
  event command block, edited with the same `CommandListEditor` the
  Écrans window uses, stored in **`ui/hooks.json`** keyed by widget id.
  - Five hooks: `on_show` / `on_hide` on any widget, `on_move` /
    `on_confirm` / `on_cancel` on a list. Each hands the row over in the
    variable the author names (`row_var`) — the chosen **entry number**
    for a list sourced on a table, as "Choix dans une liste" does.
  - **No new bytecode host.** datagen turns each block into a synthetic
    COMMON EVENT, so compilation, banking, text extraction and CALL all
    apply unchanged; the engine reaches the body through the CETAB's
    `b` entries, the lookup `vm_common_hook` already provided. Per
    widget, `ui_hook_move/confirm/cancel/show/hide` hold the common
    event's index (0xFF none) and `ui_hook_rowvar` the variable.
  - **A hook may not BLOCK** — no message, wait, choice, list or warp.
    That is a compile-time refusal naming the widget, not a convention,
    because it is what lets `vm_ui_hook` run the block SYNCHRONOUSLY:
    the caller's execution state is saved and put back, there is no
    third VM context for a scene change to unwind, and the menu cannot
    eat its own input. A guard bounds a loop left without an exit, and
    a hook never re-enters.
  - **(U3-d)** A hook belongs to a **COMPONENT**, not only to the
    widget's root: `ui/hooks.json` is keyed by NODE id and the tables are
    indexed by PRIMITIVE, which is what a real menu needs — a list is
    usually a child inside a canvas, so the canvas carries `on_show` and
    the list carries `on_move` / `on_confirm` / `on_cancel`. Each
    primitive carries the node it came from (`Prim::node`), the list
    hooks are found through the OPEN list's primitive
    (`overlay_list_prim`), and SHOWUI offers every component of the
    widget its `on_show` / `on_hide`. A vbox or an hbox draws nothing, so
    it has no primitive to hang a hook on, and the inspector says so by
    not offering the section.
  - Still open, and deliberately out of U3-b: a NON-modal list (`LISTSEL`
    still parks the main context in `VM_WAIT_LIST`) and the question of
    who owns the pad while one is live. That is U3-c.
- **To come** (the detailed plan is in `PLANNING_SYSTEME_MENUS.md`):
  declarative menu screens M2, lists + cursor + stack M3 (the FF4 menu —
  the list object will become NAVIGABLE, the designer already lays it
  down), portraits / database lists / hp_bar M4, several themes in a
  database table plus SET_THEME.
