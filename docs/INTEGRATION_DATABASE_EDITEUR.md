# SNES STUDIO — Wiring the Database system into the editor

**Goal:** give the editor (Tauri + React) RPG Maker's "Database" experience
— Stats, Items, Monsters tabs where the user fills in records without
writing code — resting entirely on the schema + dbgen system defined in
`docs/PLANNING_SYSTEME_DATABASE.md`.

**The governing idea: ONE generic UI, driven by the schemas.** We do not
code one screen per kind of data; we code a form engine that reads the TOML
schemas and draws itself. Adding a "Skills" tab in v2 means adding a
schema, and zero React.

---

## 1. Editor / database architecture

```
schemas/*.toml  ───read───▶  EDITOR (React)
                             │  generic form UI
                             │  (one tab per schema)
data/*.toml     ◀──write──── │
                             ▼
                       Build/Run button
                             │
                       dbgen (Rust Tauri backend)
                             │
                engine/generated/*.h/.c ─▶ make ─▶ ROM
```

- The editor **reads the schemas** (the source of truth for types, never
  duplicated on the TS side).
- The editor **reads and writes the instance files** (`data/*.toml`) — a
  text format, diffable in Git, and still editable by hand for power users.
- `dbgen` stays the only translator to C and binary. The editor NEVER
  generates C itself: it calls dbgen through the Tauri backend. One build
  path.

---

## 2. The Database UI (the RPG Maker style tab)

### Layout
- **Left sidebar:** the list of tables (one entry per schema found: Stats,
  Actors, Items…), with an entry-count badge ("Stats 12/255").
- **Middle column:** the instances of the selected table (symbolic name +
  a preview), with New / Duplicate / Delete / Reorder.
- **Right panel:** the form for the selected instance, generated from the
  schema.

### Field type to widget mapping (the heart of the generic UI)
| Schema type | React widget |
|-------------|--------------|
| `u8` / `u16` / `s8` / `s16` | numeric field, the type's min/max shown and enforced |
| `flags8` | 8 named checkboxes (the flag names come from the schema) |
| `ref:<table>` | dropdown filled with the target table's entries (shows names, stores the id) |
| `text_id` | a text picker/editor wired to the text bank |
| `@default(n)` | pre-filled on creation |
| `@runtime_copy` | an icon/tooltip "base value, copied at instantiation" (information, not a widget) |

### Key behaviours
- **Symbolic names are the editor's job**: the user names something
  "Slime"; the editor guarantees it is unique and valid (snake_case → the C
  constant `STATS_SLIME`). Renaming an entry updates every ref — automatic
  refactoring.
- **Live validation**: type overflow, a broken ref, a full table (255) are
  underlined in the UI BEFORE the build, under the same rules as dbgen
  (ideally: expose dbgen's validation through Tauri rather than duplicate
  it).
- **Protected deletion**: an entry referenced elsewhere cannot be deleted
  without a confirmation listing its uses ("Slime is used by 3 actors on
  Map_Village").

---

## 3. Connections with the rest of the editor

- **Map editor:** placing an actor opens a small form whose `stats_id`
  field is the same `ref:stats` widget as in the database. Total
  consistency.
- **Event editor:** the commands that manipulate data ("give item X", "read
  stat Y") use the same dropdowns, filled from the same tables.
- **Global search (v2):** "where is ITEM_POTION used?" is trivial to
  implement, since every ref is a symbolic id traceable in the data/ files.
- **Budget gauges:** the editor shows the ROM footprint of the tables
  (bytes per table, bank $83) in the build panel — the user sees the limits
  before hitting them.

---

## 4. Phasing (aligned with the global plan)

| Phase | Database deliverable in the editor |
|-------|------------------------------------|
| **P3 (MVP)** | No dedicated database UI — but the editor already reads the schemas for the actor placement form (the generic widget is born here, in miniature) |
| **P4** | The first Database tab with 2 tables: Actors, Items. The full generic UI (all three panels) is built HERE — that is the investment |
| **v2** | Extension to the full RM2003 database (Monsters, Skills, States, Groups…) = adding schemas plus a few specialised widgets (stat curves, animation timelines). The infrastructure does not change |

**Estimated effort for the generic UI (P4):** ~2-3 weeks. It pays for
itself in v2: each new tab then costs hours, not weeks.

---

## 5. Design rules to hold to

1. **The schema is the single source of truth.** No type, no limit and no
   field name hard-coded in the editor's TypeScript.
2. **The data/ files stay readable and diffable.** The editor formats them
   cleanly (stable key order) for clean Git diffs — essential for user
   projects kept under version control.
3. **One generation path**: editor → data/*.toml → dbgen → C. Never a
   shortcut where the editor writes binary or C directly.
4. **Graceful degradation**: a schema with an unknown type (added by a
   future version) shows read-only with a warning; it does not take the UI
   down.
5. **Think moddability**: since everything is schemas plus TOML, an
   advanced user can define THEIR own custom tables and read them from
   their event scripts (v2+) — a large differentiator against RPG Maker,
   and nearly free with this architecture.
