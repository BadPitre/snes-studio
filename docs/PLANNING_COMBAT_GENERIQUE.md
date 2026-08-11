# Generic tools only: the combat windows dissolve into the database (G0)

*Design doc, C0-style. The author's directive: "les tools proposés
doivent être le plus générique possible — éviter les menus trop
spécifiques comme Groupes et monstres ainsi que Équipe ; normalement
c'est les bases de données qui s'occupent de cela."*

## 1. What he is pointing at

The combat chantier (V0-V4) moved every DECISION into events, but it
kept three SPECIALIZED editor doors from C5: the Équipe window
(fixed-format heroes.toml), the Groupes window (fixed-format
troops.toml), and the "Lancer un combat" form. Each is a bespoke tool
for data the generic Database window could hold. They survive only to
feed the last combat-specific engine piece: the `battle` OPENER,
which pours party stats into reserved variables and poses a troop.

The directive dissolves all three. The end state: **the editor's
tools are scenes, events, screens, database, interface, resources —
and nothing that knows the word "combat".**

## 2. The dividing line, final form

- **`heroes` becomes an ordinary database table** the author creates
  like any other (the starter kit ships it): charset, max_hp, max_mp,
  speed, attack, defense, magic, magic_def. datagen composes each
  entry's BATTLER CELL from its charset column at build time — the
  one build-time service heroes still need. The Équipe window dies;
  the Database window edits heroes like it edits monsters.
- **The library reads hero stats itself** (db_read on `heroes`,
  entry-from-variable). The opener's reserved-variable pour
  (208-227, 231) disappears; 240+/232+ stay as mere library
  conventions (the widgets bind to them, the library writes them).
  The party is LIBRARY DATA: variables holding each slot's hero id
  (default 0-3) — swapping a party member is a script line, not a
  window.
- **A battle is a COMPOSED SCREEN.** The Groupes window and
  troops.toml die: the author poses his monsters VISUALLY on a
  screen, exactly what the Écrans tool was built for, and the
  screen's script names them (their `monsters` db ids into the
  library's slot variables) then calls combat_tour. The `battle`
  command and the opener (btl.c, the last combat C) are deleted —
  "Lancer un combat" is "Aller à l'écran".
- **skills.toml dies unparsed.** Skill semantics moved into the
  library at V2; monsters' `ai` column stays as the author's data
  that HIS library interprets.
- **What survives in the engine:** btlprim.c only — four generic
  primitives, none of which knows what a battle is. BTLPOSE's hero
  argument becomes an index into the heroes TABLE (cells emitted per
  entry, cap 8).

## 3. The honest cost

1. **Random encounters lose their one-liner.** Today `battle
   <troop>` serves N troops with one command. After: one screen per
   arrangement, or a chooser script (RAND over screen calls) — the
   RM2003 author's habit anyway. Named in the open: this is the
   price of killing the troop format.
2. **Old projects with `battle`/heroes.toml/troops.toml** get clear
   datagen migration errors (the sysmenu recipe) and the showcase
   shows the target form.
3. **The Database window becomes the ONLY door** for balance data —
   which is the point, but the heroes table needs a `charset` field
   type (resource picker) so the Database window can do what Équipe
   did.

## 4. Milestones

- **G1 — heroes as a table.** `charset` db field type; datagen
  composes battler cells from the `heroes` table; BTLPOSE reindexed;
  the library DBREADs hero stats; Équipe window deleted. Showcase
  and template migrate their heroes.
- **G2 — battles as screens.** The showcase's three battles become
  composed screens (the duel posed visually); troops.toml, the
  Groupes window, the `battle` command, btl.c and the BATTLE opcode
  deleted; the template's slime fight becomes a screen. Migration
  errors for the removed command.
- **G3 — sweep.** skills.toml unparsed, battle.ts editor helpers
  gone, docs updated: the Tools menu contains no game-specific
  window, and the engine contains no combat word outside btlprim's
  comments.

*G0 ends here. G1 starts on the author's go.*

## 5. G1 + G2 — shipped

Delivered in one pass, because the author's instruction ("plus le menu
combat dans Tools") removes both windows at once and the two windows
are the two milestones.

**The Tools menu no longer contains the word Combat.** The Groupes and
Équipe entries, `TroopsModal.tsx`, `PartyModal.tsx` and `battle.ts` are
deleted. What they held is ordinary project data now.

**Heroes are a database table.** A new `charset` field type (datagen
`db.rs`, the Schema editor, the Database window's resource picker)
names a block of the sprite sheet; datagen composes that entry's 32x32
battler cell at build time and emits nothing else about it. Every other
column — max_hp, attack, whatever the author invents — is his data,
read by his events. `battle.rs` shrank from 765 lines to ~280: battler
cells and the popup digit sheet, nothing more. heroes.toml, troops.toml
and skills.toml as FORMATS are gone; `heroes.toml` is now an ordinary
`[[entry]]` data file of the `heroes` table.

**A battle is a composed screen.** `btl.c`, `btl.h`, the BATTLE opcode
(0x46, freed) and the "Lancer un combat" command are deleted; the
engine has no battle opener left. The author arranges his monsters
visually in Tools > Écrans, the screen's script names their database
entries and calls his library. The showcase's three battles became two
screens (`combat_gobelins`, `combat_dragon`); the starter kit ships
`combat_slimes`.

**Two new generic tools carry the weight:**

- **« Numéro d'une fiche » (`db_entry`)** — writes a table row's INDEX
  into a variable. No opcode: datagen resolves the name at build time
  and emits a plain assignment, so naming a row never becomes typing a
  number. This is what lets a screen say "these are gobelins" and a
  script say "this hero is in place 1".
- **BTLPOSE takes a slot AND an entry**, the entry optionally from a
  VARIABLE. The four slots are what VRAM allows (OBJ char rows 28-31,
  OBJ palettes 0-3); WHICH entry a slot shows is data. Pointing a slot
  at another row swaps the character — a party is variables now, not a
  window.

**The library grew one common event**, `combat_preparer`: it DBREADs
each party slot's hero row into the working variables (PV 240+, PM
232+, stats 208-227) that the widgets bind to. The opener's reserved
pour is gone; those numbers are library conventions, written by library
events the author can read and change.

**Honest costs, as named in §3.** Random encounters lost their
one-liner: one screen per arrangement, or a chooser script. Projects
written before G1 get French migration errors on `battle` pointing at
the screen recipe; `btl_pose`'s old `hero` field is still accepted as
the slot, so older scripts compile.

**Verified in the emulator**, frame by frame: the showcase's gobelin
fight opens as a screen, poses both monsters and both battlers from the
`heroes` table, shows Arven 300 / Nadia 240 read by `combat_preparer`,
lands a 16-damage popup on an attack and fires the wounded-monster
hook. The scaffolded fresh project fights its slimes with one battler
and PV 50. The pixel regression is unchanged.

*The Tools menu now holds scenes, events, screens, database, interface,
resources — and nothing that knows the word "combat".*
