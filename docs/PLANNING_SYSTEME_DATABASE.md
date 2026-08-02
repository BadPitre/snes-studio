# SNES STUDIO — the Database system (schemas + dbgen)

**Goal:** structured game data (stats, items, monsters…) defined by
**schemas**, entered as **text TOML**, compiled into **byte-packed C
tables** in the ROM. RPG Maker 2003's "Database" counterpart, but
extensible: adding a table means adding a schema.

Companion document: `INTEGRATION_DATABASE_EDITEUR.md` (the editor's
generic UI). Contractual on the same footing as `SPEC_FORMATS.md`: code
that diverges from it must update this document in the same commit.

---

## 1. Project layout

```
myproject/
  project.json
  scenes/…
  schemas/            # ONE TOML file per table (the source of truth for types)
    stats.toml
    items.toml
  data/               # the instances, entered from the editor (or by hand)
    stats.toml
    items.toml
```

A project WITHOUT a `schemas/` folder has no database: dbgen emits
nothing and nothing changes (full compatibility with existing projects).

## 2. Schema format (`schemas/<table>.toml`)

```toml
name  = "stats"        # snake_case — the name of the C constants (STATS_*)
title = "Stats"        # the title shown in the editor
max   = 255            # maximum number of entries (1-255, default 255)

[[fields]]
name    = "max_hp"     # snake_case
type    = "u16"
default = 10           # @default — pre-filled on creation

[[fields]]
name = "attack"
type = "u8"

[[fields]]
name  = "elem_resist"
type  = "flags8"       # 8 named checkboxes
flags = ["feu", "glace", "foudre", "eau", "terre", "vent", "lumiere", "ombre"]

[[fields]]
name = "drop_item"
type = "ref:items"     # a dropdown filled from the items table — stores the
                       # u8 index (0xFF = none when optional = true)
optional = true

[[fields]]
name = "hp"
type = "u16"
runtime_copy = true    # @runtime_copy — a base value copied into WRAM at
                       # instantiation (UI information, same ROM encoding)
```

### Field types (v1)

| Type | ROM size | Range | Editor widget |
|------|----------|-------|---------------|
| `u8`  | 1 byte | 0..255 | numeric |
| `u16` | 2 bytes (little-endian) | 0..65535 | numeric |
| `s8`  | 1 byte (two's complement) | −128..127 | numeric |
| `s16` | 2 bytes (two's complement) | −32768..32767 | numeric |
| `flags8` | 1 byte (bit i = flags[i]) | 8 names max | 8 checkboxes |
| `ref:<table>` | 1 byte (index in the target table) | table <= 255 entries; `optional = true` → 0xFF = none | dropdown |
| `text_id` | 2 bytes (id in the text bank, little-endian) | the name of a text in texts.json; `optional = true` → 0xFFFF = none | text picker |
| `picture` / `sound` / `music` | 1 byte (index in the project list — the same one SHOWPIC/PLAYSFX/PLAYBGM use) | the stem of a project.json resource; `optional = true` → 0xFF = none; an unknown name is a build error (B7) | dropdown by name + a ▶ play/pause (sound/music) |

Field attributes: `default` (the value on creation — for `ref:` the target
symbolic name, for `flags8` a list of names), `optional` (refs, text_id
and resources only), `runtime_copy` (documentary), `min`/`max` (tighten a
numeric type's range — enforced by dbgen AND by the editor).

**Graceful degradation**: an unknown type (a future version) is shown
read-only by the editor with a warning; dbgen, for its part, refuses to
build — the build never guesses.

## 3. Instance format (`data/<table>.toml`)

```toml
[[entry]]
id     = "slime"       # snake_case, UNIQUE in the table → STATS_SLIME
name   = "Slime"       # human label (editor only, not in ROM)
max_hp = 20
attack = 5
elem_resist = ["feu"]  # flags8: the list of names ticked
drop_item = "potion"   # ref: by symbolic id, never by index
```

- The ORDER of the entries in the file is the order of the ROM indices
  (reordering in the editor rewrites the file). Since refs are symbolic,
  reordering breaks nothing.
- A missing field takes the schema's `default` (or 0; an absent `optional`
  ref/text_id means none; otherwise it is an error).
- The editor writes the keys in schema order, one entry per `[[entry]]`
  block — stable Git diffs.

## 4. dbgen — the single translator

Implementation: **datagen's `db.rs` module** (one binary, one build path —
`make data` stays the only command; the planning document's "dbgen" is a
module, not a separate executable).

Inputs: `schemas/*.toml` + `data/*.toml` + texts.json (for the
`text_id`s). Outputs, under `engine/src/data/`:

- `db_<table>.c` — the byte-packed table:
  `const u8 db_<table>[N * ENTRY_SIZE] = {…};` (one ROM section per table,
  the same 32 KB rule as the assets).
- `db_tables.h` — for EVERY table: `#define <TABLE>_<ID> <index>` (the
  symbolic constants), `#define DB_<TABLE>_COUNT N`,
  `#define DB_<TABLE>_SIZE <entry size>`, the field offsets
  `#define DB_<TABLE>_<FIELD> <offset>`, and the `extern const u8 …`.

Validations (the same rules as the editor): unique snake_case ids, type
ranges and min/max, refs that exist, known flags, a full table (> max), an
unknown field in an entry, an unknown schema type. Error messages name
what failed ("stats.toml : entree "slime", champ "attack" : 300 hors
bornes u8").

The engine reads these tables like any other data (`db_stats[STATS_SLIME *
DB_STATS_SIZE + DB_STATS_ATTACK]`) — NO data hard-coded in the engine, as
always. The VM opcodes that read the database ("give item X", "read stat
Y") arrive in a later phase, on an explicit request (the opcode extension
rule).

## 5. Design rules (a reminder)

1. The schema is the single source of truth — nothing hard-coded on the
   editor side.
2. The `data/` files stay readable and diffable (stable ordering).
3. One generation path: editor → data/*.toml → dbgen → C.
4. Graceful degradation on an unknown type (read-only, not a crash).
5. Moddability: advanced users can define their own custom tables — the
   generic UI shows them with no new code.

## 6. Phasing

| Phase | Deliverable |
|-------|-------------|
| **P10-a** | dbgen (the datagen module) + the demo's `stats`/`items` schemas + the tables in ROM |
| **P10-b** | A generic Database tab/window in the editor (three panels, widgets by type, live validation, a byte gauge) |
| **v2** | The full RM2003 tables (Monsters, Skills, States…), specialised widgets (curves), read/write VM opcodes, global ref search |
