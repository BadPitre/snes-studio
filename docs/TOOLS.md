# TOOLS — the asset pipeline (Phase 2)

**Status:** Phase 2b. `datagen` turns a source project (JSON + indexed
PNGs) into engine data. **The source of truth is the project folder
(`demo/`) — everything below is GENERATED:**

- `engine/src/data/scenes.bin` — bank $82: the Scene Table at $82:8000
  plus the scenes, the byte-exact binary format of spec §1 (24-bit far)
- `engine/src/data/texts.bin` — bank $86: an offset table plus the strings
- `engine/databanks.asm` — pins the blobs into their banks
- `engine/src/data/data_gfx{i}.c` / `data_sprites{i}.c` — ONE FILE PER
  SET: a .c's `.rodata` is an unsplittable WLA section (32 KB max, one
  LoROM bank); by splitting per set, wlalink spreads the assets over the
  free banks and the total is no longer capped at 32 KB. datagen purges
  the files of a previous generation before writing.
- `engine/src/data/data_assets.c` — only the pointer tables
  (`gfx_chars[]`, `sprite_chars[]`…) indexed by set_id, resolved at link
  time (24-bit far pointers; each set's bank does not matter)
- `engine/src/data/data_font.c` — the textbox font

## Usage

```bash
# from the root
cargo run --release --manifest-path tools/Cargo.toml -p datagen -- demo engine

# or from engine/
make data
```

**`--debug` (S6)**: burns the debug-menu flag into
`engine/src/data/data_debug.c` (ALWAYS emitted: `dbg_enabled` plus
`dbg_scn_used`/`dbg_txt_used`/`dbg_bank_cap`, the bytes actually used in
the scene and text banks — the engine includes `debug.c` unconditionally,
inert without the flag). In game, **Start+Select+R** toggles the panel
(FPS, LAG, budgets). The flag comes from the "Menu de debug" box in the
editor's settings (test ROMs only) — the cartridge build never passes it.
The trap is documented in debug.c: the panel does NO division and only
rewrites the cells that change (a re-blit spread over 4 frames), or it
becomes the very lag it measures on an already full game loop.

### Cartridge build (flashcart)

```bash
cd engine && make cart   # -> engine/snesstudio.smc
```

`tools/mkcart.sh` turns the build's `.sfc` (256 KB, refused by flashcarts
like the Super UFO Pro 8: "File type error") into a cartridge-ready
`.smc`: the contents are **mirrored** up to 512 KB minimum (like a real
cartridge's address decoding), and the size byte `$7FD7` and the checksum
`$7FDC-$7FDF` are recomputed. Validated on a Super UFO Pro 8 plus a
console. Also reachable from the editor: Game > "Build cartouche (.smc)".

## Layout of a source project

```
demo/
  project.json          # name, boot_scene, scenes, assets, musics, tilesets
  texts.json            # [{name, text}] — the order gives the text_ids
  scenes/<name>.json    # one scene per file
  assets/                 # one folder per resource type — `datagen tidy`
    tilesets/             #   a grid of 16x16 tiles, 16-colour indexed PNG,
                          #   plus <tileset>.json (autotiles, passability)
                          #   and the autotile strips
    charsets/sprites.png  #   a strip of 16x24 frames in character blocks of
                          #   12 (64 per project, 5 per scene)
    fonts/font.png        #   96 8x8 glyphs (ASCII 32-127), a 768x8 strip
    pictures/  iconsets/  windowskins/
    sounds/    music/     vignettes/
```

**Indexed or truecolor PNGs**: in an indexed PNG, each pixel's palette
index IS the SNES colour index (a lossless round trip, index 0 =
transparent). Non-indexed PNGs (RGB/RGBA — re-saved chipsets, image editor
exports) are **indexed automatically**: colours rounded to SNES precision
(5 bits per channel), alpha < 128 = transparent, at most 255 opaque
colours per image. The palette is converted to BGR555 by truncating to 5
bits.

## Scene format (`scenes/<name>.json`)

```json
{
  "name": "plaine",
  "width": 48, "height": 40,            // in 16x16 tiles, min 20x15 (spec)
  "player_start": [3, 3],               // in tiles
  "tileset": "tileset_automne",         // a tileset stem (optional, Phase 5b)
  "tilemap": [[...], ...],              // the LOWER layer: logical ids
  "upper":   [[...], ...],              // the UPPER layer: -1 = empty
  "actors": [
    {"type": "npc", "x": 8, "y": 4, "sprite": 4,
     "dir": "left", "entry": "compteur"},  // entry: a script label (optional)
    {"type": "trigger", "x": 12, "y": 10, "entry": "panneau"}, // on contact
    {"type": "auto", "x": 0, "y": 0, "entry": "intro"}  // when the scene loads
  ],
  "warps": [                               // optional (Phase 4)
    {"x": 12, "y": 1, "to": "clairiere", "tx": 16, "ty": 2}
  ],
  "script": [ "...assembly lines..." ]
}
```

**Logical tile ids**: `0..N-1` = a tile of the PNG grid (row by row),
`1000+k` = autotile k from the sidecar, `-1` = empty (upper layer only).
**There is no longer an author-written collision layer** (Phase 5c):
collision is derived from the tileset's passability — the `collision`
field of older files is ignored.

**Warps**: stepping on the tile (x,y) teleports the player to scene `to`
at (tx,ty). The tile must be walkable (derived passability) — datagen puts
the value 0x02 there (spec §1.4) and validates the target.

**Music (Phase 4b)**: `project.json` lists the Impulse Tracker modules in
`"musics"` (the order gives the music_ids); each scene may declare
`"music": "<stem>"` (absent = silence). datagen copies the .it files to
`engine/src/data/music/NN_stem.it`; the engine Makefile converts them into
a soundbank (smconv) pinned to bank $87. The demo's music (pollen8) comes
from the PVSnesLib examples — a placeholder to replace.

`dir`: `down` / `up` / `left` / `right`. `sprite`: the index of the
**character block** in the project's sprite sheet (12 frames per block,
the RM2003 model). In binary, datagen remaps it to the local slot of the
scene's sprite set (5 blocks max per scene, spec §5).

**Actor types (v0.6, RM2003 triggers)**: `npc` = an NPC that talks with A
(and turns towards the hero); `trigger` = walkable, its script starts when
the hero **steps on its tile** (Player Touch); `auto` = its script starts
**when the scene loads** (Autorun — at boot or on arriving through a
warp). `trigger`/`auto` require an `entry`.

Since v0.8, **the appearance is independent of the trigger**: a contact or
auto actor may carry a `sprite` (a chest, a sign, an NPC who accosts the
hero) and stays walkable; `sprite: -1` makes it invisible (compiled to
`sprite_id = 0xFF`, spec §1.3).

## Events (the Event Editor — A2)

**`events`** is the modern form of actors (the editor's Event Editor
produces them): datagen compiles them into actors plus VM bytecode, and
their INLINE texts automatically join the text bank (deduplicated). The
binary format does not change.

```json
"events": [
  {"name": "Fleuriste", "x": 23, "y": 14,
   "trigger": "action",              // action (A) | touch (contact) | auto
   "sprite": 1, "dir": "down",       // appearance: a block; -1 = invisible
   "commands": [
     {"c": "msg", "text": "Bonjour !"},
     {"c": "choice", "options": [       // 2-4 options, "do" branches
        {"text": "Oui", "do": [ {"c": "set", "var": "g1", "value": 1} ]},
        {"text": "Non", "do": []} ]},
     {"c": "add", "var": "v0", "value": 1},
     {"c": "if", "var": "g1", "op": "==", "value": 1,
      "then": [ ... ], "else": [ ... ]},   // op: == != >=
     {"c": "warp", "to": "bourg", "x": 16, "y": 28},
     {"c": "face", "event": 0, "dir": "down"},
     {"c": "switch", "n": 12, "on": true},          // v0.9: 512 switches
     {"c": "var", "n": 3, "op": "+", "value": -2},  // 256 16-bit variables
     {"c": "if_sw", "n": 12, "on": true, "then": [], "else": []},
     {"c": "if_var", "n": 3, "op": ">=", "value": 10, "then": [], "else": []}
   ]}
]
```

The appearance is free whatever the trigger (v0.8): `sprite >= 0` shows
the character, `-1` makes the event invisible. Only an "action key" event
**requires** an appearance — with no sprite the hero would have nothing to
address. `entry` (a label in the scene's assembly script) is still
possible for events without `commands` — the two worlds coexist. The
working variable of a `choice` without a `"var"` is **v63** (reserved by
convention).

**Moving NPCs (v0.11)**: `"move"` on an event or a page — `"static"`
(default), `"random"`, `"vertical"`, `"horizontal"`. Reserved for "action
key" triggers; the NPC moves one tile at a time at half the hero's speed,
never stepping on him or on another event, and freezes during dialogues.

**Move Route (v0.12)**: `{"c":"route","event":-1,"repeat":false,
"skip":false,"steps":[{"s":"right"},{"s":"wait","n":4},{"s":"face"}]}` —
`event`: -1 = this event, otherwise an ENTRY number (pages count); steps:
`down/up/left/right`, `tdown/tup/tleft/tright` (turn), `fwd`, `face`,
`{"s":"wait","n":1-15}` (n×8 frames), and in v0.13: `mrand/mhero/mflee`
(walk at random / towards / away from the hero), `t90r/t90l/t180/t90x/
trand/tflee` (rotations), `spd+/spd-` (speed 1-4), `frq+/frq-` (frequency
1-8), `fixon/fixoff` (fixed direction), `thruon/thruoff` (through walls),
`{"s":"swon"|"swoff","n":0-511}` (a switch inside the route),
`{"s":"gfx","block":b}` (change the graphic — the block counts towards the
scene's 5 charsets). The route accepts `"freq":1-8` (default 3). The route
runs in the background; `{"c":"wait_route"}` blocks until the
non-repeating routes end, and `{"c":"wait","frames":n}` pauses. Assembly:
`ROUTE <actor|self> <r> <s> <steps…>`, `WAITROUTE`, `WAIT <frames>`.

**v0.13**: `{"c":"var"}` gains the full arithmetic (`op`: `=`, `+`, `-`,
`*`, `/`, `%`, `rand`) and several sources (`from`: `const` (default),
`var` (value = the source variable number), `hero_x`, `hero_y`, `timer`);
`{"c":"timer","op":"start|stop|show|hide","secs":n}` (an "M:SS" display in
the top-right corner); `{"c":"campan","x","y","speed":1-8}`
(non-blocking), `{"c":"cam_return","speed"}`, `{"c":"wait_cam"}`.
Assembly: `VAROP <dst> <op> <const|var|hx|hy|timer> <src>`, `TIMER <op>
<val>`, `CAMPAN`, `CAMRET`, `WAITCAM`.

**v0.15 (positions)**: `{"c":"hero_loc","vs":n,"vx":n,"vy":n}` remembers
the hero's position (scene/X/Y) in three 16-bit variables — compiled into
three `VAROP`s (the new `scene` source); `{"c":"warp_var","vs","vx","vy"}`
recalls it (a teleport, which ends the script — assembly `WARPV`);
`{"c":"setpos","event":-1|n,"from":"const"|"vars","x","y"}` places an
event at (x,y) or at (`vars16[x]`, `vars16[y]`) — assembly `SETPOS
<actor|self> <c|v> <x> <y>`; `{"c":"swappos","a":-1|n,"b":-1|n}` swaps two
events — assembly `SWAPPOS <a|self> <b|self>`. `-1`/`self` means this
event (resolved to an entry index by datagen, as for route).

**uigen v1 layouts (Phase 11, docs/SPEC_SYSTEME_UI.md §3)**:
`ui/layout.toml` — positions and sizes IN TILES (a 32x28 screen).
`[message]` and `[choice]` move and resize the dialogue and choice windows
(`pos = [x, y]`, `size = [w, h]`, minimum 8x3 — absent = the historic full
width box at the bottom). `[[overlay]]` declares PERMANENT windows (the
HUD) in the top 4 rows (8 max, no overlapping, v1 content:
`variable_display` with `var` plus an ASCII `label`) — redrawn as soon as
the variable changes, even during dialogues. uigen refuses the invalid at
compile time (bounds, area, overlaps) and emits the ui_cfg.h defines plus
ui_overlays.c.

**UI theme v1 (Phase 11, docs/SPEC_SYSTEME_UI.md)**: `project.json`
accepts `"ui": {"windowskin": "assets/….png", "text_speed": n}`. The
windowskin is a **24x24** PNG (9-slice: 3x3 tiles of 8x8, indices 0-3 =
transparent/fill/edge/accent — the FONT's palette) converted by datagen
into 9 BG3 chars after the font; the textbox and the choices are drawn
with that frame (absent = the historic solid box). `text_speed` = the
typewriter's frames per character (0 = instant, the default); in game, A
reveals everything then closes. datagen emits `ui_cfg.h` (UI_HAS_SKIN,
UI_TEXT_SPEED).

**\v[n] in texts (v0.17)**: `{"c":"msg"}` (and the choice options) accept
`\v[n]` — the value of the 16-bit variable n (0-254) is inserted in
decimal when the text is displayed (spec §2). Example: `"Tu as \v[12]
pieces d'or."`.

**Special text codes (T2, spec §2)**: inside a message, `\s[n]` changes
the speed (n frames per character, 0 = instant until the end), `\.` is a
short pause, `\|` a long one, `\!` waits for A, `\^` closes the message
without a press, `\>`…`\<` is a block shown at once, and `\\` is a literal
backslash. An unknown code is a build error.

**Message by reference (T2)**: `{"c":"msg","text_ref":"name"}` shows the
"name" entry of the `texts.json` catalogue (Tools > Textes) — shared
between several commands, editable in the catalogue without touching the
events. `text_ref` wins over `text`; an unknown name is an error.

**Scene panorama (S17)**: a scene's "Couche d'effet" tab offers a plane
position — "Surimpression" (clouds above, the S9 behaviour) or "Panorama"
(an image BEHIND the map, RPG Maker style). The panorama shows where the
lower layer is ERASED (the eraser tool). The "Répéter" box: a looping
image that can scroll (drift plus parallax), or a single fixed image. The
image is chosen in the resource manager and must be imported "with
transparency" (it uses the effect plane's dedicated palette). Like the
effect layer, a scene with a panorama loses its upper scenery layer.

**Multi-bank (M1)**: the scenes and the texts are no longer limited to
32 KB each — datagen spreads them over extra banks (`scenes.bin`,
`scenes1.bin`, …; likewise `texts.bin`), allocates the bank numbers in the
tables' far pointers and prints the totals (`banks scenes : N/M octets (B
bank(s))`). A scene stays atomic (<= 32 KB). A 1 MB ROM (32 banks,
`engine/hdr.asm`). The SCN/TXT row of the debug menu is pre-formatted by
datagen (data_debug.c).

**Database (Phase 10)**: datagen embeds "dbgen" (the `db.rs` module) —
`schemas/*.toml` + `data/*.toml` → `db_<table>.c` (byte-packed tables) +
`db_index.c` (the register for the DBREAD opcode, always emitted — empty
without schemas) + `db_tables.h` (the `TABLE_ID` constants, sizes,
offsets). Format and rules: `docs/PLANNING_SYSTEME_DATABASE.md`
(contractual). The `schemas/_index.json` file is a manifest the editor
maintains for its browser mode — ignored by dbgen (the folder is
authoritative).

**T2 (tileset entries)**: `project.tileset_defs` =
`[{"name": "…", "file": "assets/tilesets/xxx.png"}]` — the NAMED tilesets of the
Tools > Tilesets window (an empty file means the entry is not assigned
yet). Purely an editor concern: datagen ignores it, and the scenes still
reference the file by stem. Existing projects are migrated on opening (one
entry per file, the name being the stem).

**T1 (tilesets — the <tileset>.json sidecar beside its PNG)**: besides
`solid`/`above`/`autotiles`, two keys:
`"dirs": {"<id>": mask}` — the CLOSED sides of a grid tile (bits: 1 down,
2 up, 4 left, 8 right) → the high nibble of the collision (directional
passage, counters and ledges);
`"anims": [{"tiles": [base, f1, f2…], "mode": "123"|"1232", "speed": n}]`
— an animated tile, RM2003 water style: 2-4 GRID tiles in the same
colours, the base being the one laid on the maps; datagen compiles
data_tileanim.c (see SPEC_FORMATS §1.4 bis) and refuses chars shared
outside the sequence or diverging palettes. Edited in Tools > Tilesets…

**B7 (resource fields)**: the schemas accept `type = "picture"`,
`"sound"` and `"music"` — the TOML value is the NAME (stem) of a project
resource, dbgen resolves it to its list index (the same one the
SHOWPIC/PLAYSFX/PLAYBGM opcodes use) and refuses the build if the name no
longer exists; `optional = true` → 0xFF = none. No more magic numbers: a
monster's record points at its battle image, its cry and its theme by
name.

**v0.17 (reading the database from events)**:
`{"c":"db_read","table":"stats","from":"const"|"var","entry":"slime"|
<variable number>,"field":"attack","dst":n}` — `vars16[dst]` = the
record's field; `from:"var"` reads the record number from a variable
(outside the table → 0). events.rs resolves the symbolic table, entry and
field into the assembly `DBREAD <table> <src> <entry> <ofs> <size> <dst>`
(spec §2). flags8: the byte of bits; ref: the index of the target record.

**Phase 12 (UI widget visibility)**:
`{"c":"ui_show","widget":"<a layout root id>","on":true|false}` — shows or
hides a designer WIDGET (ui/layout.toml). Widgets are HIDDEN at start-up
(unless `visible = true` on the root); events.rs resolves the name to its
root index (`SHOWUI <widget> <0|1>`, opcode 0x24). An unknown name is a
compilation error listing the project's widgets.

**B6 (cursor menu)**: a `[[node]]` with `type = "list"` in ui/layout.toml
(`items = ["Attaque", "Magie", …]` — 2-16 ASCII items, `frame` true by
default, AUTO size: 1 cursor column plus the longest item, one row per
item). The command
`{"c":"list_select","widget":"<id>","var":n,"cancel":true|false,
"keep":bool,"lr":bool}` (BLOCKING, `LISTSEL <widget> <var> <flags>` with
flags = cancel | keep<<1 | lr<<2, opcode 0x3A) shows the widget, lets
up/down navigate (with wrap-around), writes the chosen index (0 = the
first item) into `vars16[var]` on A — or 255 on B when `cancel` is set —
then hides the widget again. `keep`: the widget stays on screen after
closing (without a cursor); `lr`: Left/Right also exit (254 = left, 253 =
right). Multi-panel: two lists side by side, `keep` + `lr` on each, an
"active panel" variable and a loop — the cursor hops from one to the other
(see demo/screens/combat_prairie.json, a full Attaque/Objet/Fuite +
Feu/Soin/Foudre menu). Chain `if_var`s on the index: the battle menu is
built without KEYIN.

**Phase 12 (Key Input Processing, RM2003 style)**:
`{"c":"key_input","var":n,"wait":true|false,"keys":[codes 1-12]}` — writes
the key's code into `vars16[var]` (1 down, 2 left, 3 right, 4 up, 5 A,
6 B, 7 Y, 8 X, 9 L, 10 R, 11 Select, 12 Start; 0 = none). `wait` blocks
until a FRESH press of a ticked key (it also works inside a Parallel
process). `{"c":"sysmenu"}` opens the System menu (saving) — **the
engine's hard-wired START mapping is removed**: the author picks the key
(key_input plus a condition, or any other trigger).

**Phase 12 S1 (dialogue styles)**: `ui/layout.toml` accepts
`[[dialog_style]]` blocks (max 3 beyond the default) — a unique ASCII
`id`, `windowskin` (a 24x24 PNG, default: the theme's), `font` (a 768x8
PNG — 96 8x8 glyphs, default: `assets.font`), `message = { pos, size }`
(default: `[message]`), `choice = { pos, size }` (default: the style's
message). Windows are min 8x3 within 32x28; overlays must not overlap ANY
window of ANY style. The msg/choice commands take an optional `"style":
"<id>"` field (absent = the default box, ALWAYS present) — events.rs
resolves the name (an error listing the styles otherwise) and emits
`DLGSTYLE <n>` (opcode 0x27) before the box, ONLY when the project has
styles (without styles, the bytecode is byte-identical). BG3 VRAM budget:
256 chars — font 0 takes 97, each windowskin 9, the icons 2×N, and each
extra font 96 (deduplicated); overflowing is a detailed datagen error. v1:
every font and skin shares font 0's palette. `project.json` accepts
`"fonts": [...]` (the editor's FontSet register, ignored by datagen —
layout.toml is authoritative).

**Effect layer (S9, "clouds over the village")**: a scene accepts
`"effect": {"pic": "<stem>", "dx": px/s, "dy": px/s, "blend":
"half"|"add"|"sub", "parallax": "half"|"quarter"|"full"}` — a PATTERN (a
TRANSPARENT image from project.pictures, <= 256 unique tiles) drifts above
the game while it plays (the characters stay visible, the dialogues
crisp). The BG1 plane carries the pattern: the UPPER LAYER of those scenes
is ignored (with a warning if it is not empty). VRAM: chars at
$0000-$1000, a 32x32 map in the $1C00 gap (after the BG3 map); entries
carry the priority bit (the pattern IN FRONT of the sprites); in a blend
mode, BG2+OBJ go to the sub screen and the tint and flash are suspended
(screenfx_cm_hold). The speeds are converted into 8.8 steps per frame;
**parallax (S11)**: the pattern's scroll additionally receives
`camera >> 1` (half) or `camera >> 2` (quarter) — the pattern slides at a
fraction of the scenery when the camera moves (depth), absent = fixed on
screen; datagen emits `data_effects.c` (always — 0xFF = a scene with no
effect). Since the pattern is <= 224 px tall, scrolling vertically shows a
32 px empty band once per period (with sparse patterns: invisible).
**Empty cell (S10)**: `-1` is accepted on BOTH scene layers (the eraser) —
a transparent char, the backdrop (CGRAM 0, forced BLACK by the engine)
shows through, and the cell is walkable.

**Phase 12 S3 (pictures, RM2003 style)**: `project.json` accepts
`"pictures": ["assets/….png", …]` — READ by datagen (the order gives the
pic_ids). Each image: an **indexed PNG of <= 16 colours** (a padded
palette is tolerated: only the INDICES used count), dimensions in
multiples of 8, max **256x224** (anchored TOP-LEFT of a 32x32 map padded
with transparency — the screen placement is done by scrolling), **<= 512
unique 8x8 tiles** after deduplication (the sprites' VRAM region, borrowed
while the image is up — flat areas and repeated patterns deduplicate very
well). datagen emits `data_pic{i}.c` (one section = one bank) plus the
`data_pictures.c` register (always, with dummy tables when there is no
image; max 32 images). Commands: `{"c":"pic_show","pic":"<stem>"}`
(SHOWPIC, the name resolved — an error listing them otherwise) shows the
image — messages and choices play ON TOP (BG3); `{"c":"pic_hide"}`
(HIDEPIC) closes it, with the scene and the events INTACT. Close it within
the same script. **S5/S7 options (RM2003 Show/Move Picture style)**:
`pic_show` accepts `"x"`/`"y"` (the screen position in pixels, default =
centred — datagen computes it from the PNG's dimensions and validates
x+w <= 256, y+h <= 224), `"pic_var"` (the picture number read from a
variable — it replaces `"pic"`, flags bit 0), `"x_var"`/`"y_var"` (the
position read from variables, flags bit 1 — the ENGINE then clamps to the
real dimensions, through the register's `pic_wt`/`pic_ht` tables) and
`"dur"` (frames for EACH fade, 0 = instant, default 16; `"fade": false` =
the S5 legacy, equivalent to dur 0). `pic_hide` accepts `"dur"`.
**`"blend"` (S8)**: `"half"` (semi-transparent 50 %), `"add"` (additive)
or `"sub"` (subtractive) — the image blends with the scenery through the
color math (flags bits 3-4); absent = opaque. The screen tint is suspended
while the image is up (the same circuit). **`pic_move` (S7)**: slides the
shown image towards `x`/`y` (or `x_var`/`y_var`) over `"dur"` frames,
WITHOUT blocking the script (0 = a jump) — absent = the centre. Emitted as
`SHOWPIC id x y flags dur` / `HIDEPIC dur` / `MOVEPIC x y flags dur`
(flags: bit 0 image-from-variable, bit 1 position-from-variables, bit 2
engine centring).
**Transparency (S4)**: an entry `{"path": "…", "trans": true}` marks a
TRANSPARENT image (pixels with alpha < 128, punched by the editor's colour
picker at import) — in game, the map's SCENERY layer stays visible behind
the punched pixels (but not the characters: their video memory carries the
image). Those images live on **BG palette 7** (tilemap entries marked by
datagen, colours 113-127 — the palettes 0-6 and the scene's backdrop
colour are preserved); <= 15 opaque colours. If a tileset already occupies
palette 7, datagen warns: the scenery would be wrong in ITS scenes.

**Phase 12 S2 (a font per widget)**: a ROOT `[[node]]` accepts
`font = "assets/….png"` (768x8 — a uigen error if put on a child): all the
widget's text is drawn with that font. The same deduplicated VRAM plan as
the styles' fonts (a font shared between a style and a widget counts
once); uigen emits the per-primitive table `ui_ov_font[]` (the base of the
' ' glyph, 1 = the project font) in ui_overlays.c.

**v0.16 (common events)**: `project.json` carries `"common_events":
[{"name","trigger":"none"|"auto"|"parallel","switch":n?,"commands":
[…]}]` — scripts global to the project, the RM2003 model.
`{"c":"call","n":k}` calls them from any event (assembly `CALL <label>` /
`RET`, an 8-level stack — a common event can call another). The condition
switch is OPTIONAL (absent = always active, like RM2003's unticked box):
`"auto"` = RM2003's Autorun, restarted as long as the condition passes and
the VM is free (it freezes the player — the script must turn its switch
off, or run forever if there is none); `"parallel"` = Parallel process,
running in the background without freezing the player (messages and
choices are REFUSED by datagen, transitively through calls). In each
scene, datagen only emits the bodies referenced (transitively) and puts
the table `CETAB <a|p> <switch> <label>…` at the head of the scripts block
(spec §2). Inside a common event, "this event" means the actor that
started the calling script.

**v0.16 (warps)**: a warp entry accepts `"dir":"down"|"up"|"left"|
"right"` — the hero's direction on arrival; absent = kept ("Retain" in
RM2003). Written into WarpDef.flags (spec §1.5).

**v0.15 (screen)**: `{"c":"scr_hide","speed":1-15}` /
`{"c":"scr_show","speed"}` — a blocking fade out and in (assembly
`SCRHIDE`/`SCRSHOW <speed>`); `{"c":"tint","mode":"off"|"add"|"sub","r",
"g","b"}` (0-31) — the scenery's tint, immediate and persistent (`TINT
<mode> <r> <g> <b>`); **`"dur"` in frames (S12)** = a GRADUAL transition
(day/night): the tint interpolates from the current value towards the
target, NON blocking (`TINTG <mode> <r> <g> <b> <dur>` — an absent or 0
dur leaves the TINT bytecode unchanged), add ↔ sub goes through zero in
two phases, with Matin/Jour/Soir/Nuit presets on the editor side;
**`{"c":"weather","kind":"off"|"rain"|"snow","power":1-3}` (S13)** —
particle weather (`WEATHER <kind> <pow>`), non-blocking, persisting across
scenes; the particles (sprites, `data_weather.c` always emitted) fall IN
FRONT of the effect layer, and the flash crosses the blends (a full storm:
dark clouds + rain + flash); **`{"c":"wave","power":0-7,"speed":1-8}`
(S14)** — a screen ripple through HDMA (`WAVE <power> <speed>`, an absent
speed means 2): the SCENERY ripples (BG1 + BG2, the effect layer
included), while the characters, the text and the HUD stay straight; power
0 stops it, non-blocking, persisting across scenes;
**`{"c":"skygrad","mode":"off"|"add"|"sub","r","g","b","r2","g2","b2"}`
(S15)** — a sky gradient (`SKYGRAD <mode> <r0> <g0> <b0> <r1> <g1> <b1>`,
channels 0-31): a VERTICAL tint from the top (r,g,b) to the bottom
(r2,g2,b2), replacing the flat tint (and `tint` removes the gradient — the
same color math circuit); scenery only, persisting across scenes, zero
cost per frame (a static HDMA table);
**`{"c":"spotlight","radius":0|16-96,"dark":1-31}` (S16)** — a circle of
light following the hero (`SPOTLIGHT <radius> <dark>`, radius 0 = off,
dark 31 = black scenery outside the circle): it replaces the tint and the
gradient, persisting across scenes; the sprites and the text stay visible
everywhere (the same hardware limit as the tint);
**`{"c":"sfx","sound":"stem"}` (B1)** — plays a sound (`PLAYSFX <id>`,
resolved by stem in `project.sounds` — a WAV converted to 8 kHz BRR by
datagen's `sfx` module: <= ~1.8 s (8 KB BRR) per sound, <= 16 sounds,
<= 24 KB in total; an unknown stem is a clear build error), non-blocking,
over the music;
**`{"c":"bgm","music":"stem"|""}` (B1)** — changes the music (`PLAYBGM
<id|255>`, "" = silence): non-blocking and NOT instant (the module is
streamed to the SPC); the scene's music resumes at the next warp;
**composed screen (B3)**: `{"c":"stage_open","pic":"stem"|"","dur"}` —
opens the composed screen (the background is a project picture, "" =
black, a fade of dur frames each way, `STAGEOPEN <pic|255> <dur>`);
`{"c":"stage_pose","slot":1-5,"pic":"stem","x":0-255,"y":0-216}` — lays an
image (the position in pixels, rounded to the 8-pixel tile, `STAGEPOSE
<slot-1> <pic> <x/8> <y/8>`), BLOCKING for the length of the transfer;
`{"c":"stage_clear","slot":1-5}` — removes the image;
`{"c":"slot_fx","slot":1-5,"fx":"flash"|"fadeout"|"dark"|"restore",
"frames"}` — a palette effect on the slot's image (`SLOTFX <slot-1>
<fx 1/2/3/0> <frames>`), non-blocking: a white flash (an attack), a fade
to black (death), darkening (a state, stackable), restore;
**composed screens — editor entities (B6bis, multi-scripts in B6bis-2)**:
`project.screens` lists names, with one `screens/<name>.json` file each:
`{"backdrop":"stem"|"",
"slots":[{"slot":1-5,"pic":"stem","x","y","name":"…"}],
"scripts":[{"name":"…","trigger":"auto"|"call","cond":{…}?,
"commands":[…]}]}` — a slot's `name` is an editor label (no binary);
`trigger:"auto"` = played when the screen opens, `"call"` = played only
through `{"c":"screen_call","script":"<name>"}` from another script of the
same screen (resolved and INLINED by datagen); an optional `cond` on an
auto script: `{"kind":"switch","n","on"}` or
`{"kind":"var","n","op":"=="|"!="|"<"|">"|"<="|">=","value"}` — compiled
into an `if_sw`/`if_var` around the body. The old `script` field (a single
script) is migrated to `scripts[0]`, an auto one named "principal", on
loading. The command `{"c":"screen","name":"<name>","dur"}` is UNROLLED by
datagen into `STAGEOPEN + STAGEPOSE… + the auto scripts inline` (editor
sugar, like the autotiles: the engine only ever sees B3's stage commands;
MAX_DEPTH protects against screens and calls that loop; the background,
the images, the positions and the script names are validated at build
time);
**vignettes (B5)**: `project.vignettes` lists PNG strips of 32x32 frames
(height 32, width a multiple of 32, 1-8 frames, <= 15 colours plus
transparency, converted by datagen into OBJ chars — `data_vig{i}.c`);
`{"c":"vig_show","slot":1-2,"vig":"stem","x","y","anchor":"screen"|
"hero"}` (`VIGSHOW`, hero = signed offsets),
`{"c":"vig_play","slot":1-2,"mode":"once"|"loop"|"stop","speed":1-60}`
(`VIGPLAY` — once hides itself at the end),
`{"c":"vig_hide","slot":1-2}` (`VIGHIDE`);
`{"c":"stage_close","dur"}` — closes it (an internal warp: the scene and
its music come back, the NPCs that moved return to their page position,
and any vignettes still shown are hidden — they are part of the screen's
staging); a budget of ~511 tiles per screen, and no overlapping slots;
`{"c":"flash","r","g","b","frames"}` — a decaying non-blocking flash
(`FLASH`); `{"c":"shake","power":0-8,"speed":1-8,"frames"}` — a
non-blocking horizontal shake, power 0 = stop (`SHAKE`). The tint and the
flash touch neither the text nor the characters (SNES hardware: OBJ color
math is limited to palettes 4-7).

**Frame-by-frame animations (A1)**: `project.animations` lists entries
`{"name","vignette":"stem","loop":bool,"layers":1-4,"frames":[…]}`. The
cell sheet IS a project vignette (§B5) — no new graphics path, an
animation only adds the frame track. Each frame:
`{"cells":[{"cell","x","y"}…],"dur":1-255,"sfx":"stem"}` — one `cells`
entry per LAYER (a cell shown at the same time as the others), `cell: -1`
= that layer shows nothing on this frame, `x`/`y` are SIGNED offsets
(−128..127) from the anchor point, and `sfx` is played ON ENTERING the
frame. The inherited single-layer shape is accepted when reading (`cell`/
`x`/`y` flat on the frame). datagen emits `data_anims.c` (a FLATTENED
track, a FIXED stride of 3L+2 bytes per frame: the player advances by the
stride without multiplying or decoding a variable length) and refuses at
build time: a duplicate name, an unknown vignette, layers outside 1-4,
more cells than layers, a cell outside the sheet, a zero duration, an
out-of-range offset, an unknown sound. It WARNS (without refusing) when K
layers change cell for a duration < K frames: only one cell is transferred
per screen frame, so the last one would show late. Layer 1 at the back,
the following ones in front; 4 simultaneous cells and 2 distinct sheets at
most (OBJ palettes).
`{"c":"anim_play","anim":"name","anchor":"screen"|"hero"|"event",
"event":-1|0-23,"wait":bool}` (`ANIMPLAY`, `event: -1` = "this event",
`wait` blocks the script — never for a looping animation, which never
ends); `{"c":"anim_stop"}` (`ANIMSTOP`). The `screen` anchor: the offsets
start from the CENTRE of the screen; `hero`/`event`: from the tile corner
of the metasprite being followed, recomputed every frame (the animation
follows a walking NPC). Composed in Tools > Animations.

**v0.15**: `{"c":"loop","do":[…]}` — an RM2003 loop: the body repeats
forever; `{"c":"break"}` jumps to the end of the nearest loop (outside a
loop: a datagen error). Pure compilation (a head label plus a `JMP`, no
new opcode). A loop with no blocking command is legal: the VM runs 32
opcodes per frame then hands back (no more debug halt on an exhausted
budget). `{"c":"rem","text":"…"}` — a decorative editor comment, no
bytecode emitted (the text is not under the messages' ASCII constraint).

**v0.14**: per event or per page — `"move": "custom"` plus
`"move_route": {"freq":1-8,"repeat":bool,"skip":bool,"steps":[…]}` (the
same steps as the route command); `"priority":
"below"|"same"|"above"` (default same); `"speed": 1-4` (default 1). In
binary: a 16-byte actor entry, with the route blob at the tail of the
scripts block (the internal `RTBLOB` directive).

**Pages (v0.10)**: an event may replace its flat fields with
`"pages": [...]` — each page has a `condition` (`{"switch": n, "on":
bool}` or `{"var": n, "min": v}`, absent = always), a `trigger`, a
`sprite`, a `dir` and `commands`. datagen compiles each page into a
consecutive actor entry (12 bytes, spec §1.3); in game, the last page
whose condition passes is the active one. A chest, for example: page 1
with no condition (gives the item then `switch 12 ON`), page 2
`{"switch":12,"on":true}` (an open appearance, "already empty").

**v0.9**: the `switch`es (0-511) and the 16-bit `var`s (0-255) are global,
persistent and saved (spec §4bis v2) — that is the RM2003 model. The 8-bit
`set`/`add`/`if` commands on `v<n>`/`g<n>` are still compiled (legacy),
but the Event Editor only offers the modern versions. Assembly: `SW`,
`JSW`, `SET16`, `ADD16`, `JCMP16` (spec §2). Maximum nesting: 6 levels.

**Tilesets (Phase 5)**: a PNG as a grid of 16x16 tiles (dimensions in
multiples of 16, max 999 tiles), indices **row by row** like the RPG Maker
palette, up to 256 colours (chipsets). datagen compiles the gfx **per
scene** (v0.4): only the tiles used go to VRAM — the per-scene limits are
254 distinct tiles, 512 8x8 chars (char 0 reserved transparent) and 8
palettes of 15 colours (spread automatically per char).
**Per scene (Phase 5b)**: `project.json` lists the tilesets in
`"tilesets"` (the order gives the tileset_ids; absent = `assets.tileset`
alone); each scene may declare `"tileset": "<stem>"` (absent = the first).
datagen validates both layers' ids against the scene's tileset.
**Sprite sheet (Phase 6)**: a strip of **16x24** frames, in **character
blocks of 12 frames** (4 directions down/up/left/right × 3 steps idle/step
A/step B — the RM2003 charset model). The player is block 0, and an
actor's `sprite` is a block index. The project may have many blocks (64
max): datagen compiles a **sprite set per scene** (like the tilesets) with
only the player plus the blocks of that scene's actors — **5 blocks max
per scene** (an SNES VRAM limit), with an explicit error beyond. Each
block gets its OBJ palette (15 colours plus transparent; beyond that, the
closest are merged automatically with a warning). Each frame is rendered
by 2 stacked 16x16 OBJs, anchored with an 8 px overhang above the tile
(the head overlaps the tile above). `project.json` may carry `"charsets":
["Héros", …]` — the block names the editor shows (ignored by datagen).
Tiles meant for the upper layer must have an **index 0 background**
(transparent) to let the ground show.

## Tileset sidecar (Phase 5c — the RPG Maker 2003 model)

`assets/tilesets/<tileset>.json`, optional (absent = everything walkable, no
autotiles):

```json
{
  "autotiles": ["assets/eau_auto.png", "assets/chemin_auto.png"],
  "solid": [1, 3, 4, 1000],
  "above": [5]
}
```

- **`autotiles`**: a 48x64 PNG in the RM2003 autotile format (3x4 tiles of
  16x16: the preview islet, an unused cell, the inner corners, then the
  9-slice block). datagen computes the borders by 8x8 quarters from the
  neighbours of the same autotile (a map edge counts as the same) and only
  emits the variants used. The logical id of autotile k is `1000+k`. Not
  yet: animation (water).
- **`solid`**: the blocking logical ids (X). **`above`**: the ☆ ids —
  drawn ABOVE the hero when they are on the upper layer, and never
  blocking.
- Collision derived per cell: an upper tile present and not ☆ → its
  passability wins (a walkable bridge over solid water), otherwise the
  lower tile's.

## Importing RPG Maker 2003 chipsets

```bash
cargo run --release --manifest-path tools/Cargo.toml -p datagen -- \
  import-chipset mon_chipset.png demo bourg
```

Slices an RM2003 chipset (an indexed 480x256 PNG, the LCF layout) into
project assets: `assets/tilesets/<name>.png` (a 6-column grid: 144 lower tiles then
144 upper ones — the sidecar records `upper_start: 144` so the editor can
filter the palette by layer), the **12 ground autotiles** (a direct copy,
native format), **water A** converted into a static autotile (an
approximation: the borders are recomposed from frame 0 — no animation),
and the sidecar. The tileset is added to `project.json`. The background
colour of the first upper tile becomes index 0 (transparent). Passability
arrives blank (water solid by default): it is set in the editor, in
"Passabilité O/X/☆" mode. Not imported: water B and deep water, animation
tiles (waterfalls).

## Importing RPG Maker 2003 charsets

```bash
cargo run --release --manifest-path tools/Cargo.toml -p datagen -- \
  import-charset mon_charset.png demo 2 1
```

Imports one character from an RM2003 charset (a **288x256** PNG = 8
characters of 72x128, or **72x128** = a single one) into a **block** of
the project's sprite sheet (`assets.sprites`). Arguments: the character
(0-7, reading by rows) then the destination block (0-63; 0 = the player).
Each 24x32 RM2003 frame is reframed to 16x24 (bottom-centre); RM's row
order (up, right, down, left) and column order (left step, idle, right
step) are recomposed into ours. The sheet is rewritten as an RGBA PNG
(extended if needed) — the transparency comes from the alpha, or from the
palette's index 0 for an indexed charset (the RM2003 convention).

## Script assembler (VM v0, spec §2)

One instruction per line, `;` starts a comment, `label:` marks a jump
target. Actors point at a label through `entry` — no hand-written offsets.

```
salut:
  JEQ g1 1 deja         ; g0..g63 = GLOBAL variables (they persist across
  MSG q_fleur           ;   scenes) - RM2003's give/has pattern
  CHOICE v1 opt_oui opt_non   ; 2-4 choices, the chosen index -> v1
  JEQ v1 1 refus
  MSG r_fleur
  SETVAR g1 1           ; "give the flower": a gvar
  END
refus:
  MSG r_non
  END
deja:
  MSG deja_fleur
  END
panneau:                ; the script of a "trigger" actor (on contact)
  CHOICE v2 opt_oui opt_non
  JEQ v2 0 va_bourg
  END
va_bourg:
  WARP bourg 16 28      ; teleports the hero - ends the script
```

Opcodes (spec §2 v0.6): `END`, `MSG <text>`, `SETVAR|ADDVAR v<n>|g<n>
<val>`, `SETGVAR g<n> <val>` (an alias), `JMP <label>`, `JEQ|JNE|JGEQ
v<n>|g<n> <val> <label>`, `CHOICE v<n>|g<n> <text>…` (2-4 choices),
`WARP <scene> <x> <y>`, `FACE <actor> <down|up|left|right>`. The table is
contractual (spec §2) — the tool refuses everything else.

## Guarantees

- Deterministic output: the same sources give the same files.
- Validations: map dimensions (min 20x15, layer consistency), unknown
  labels and texts, variables outside 0-63, non-ASCII texts, unknown actor
  types → an explicit error, and nothing corrupt is written.
- Checked by regression: the `demo/` project regenerates the validated
  Phase 1 data identically (the scripts' bytecode included).
