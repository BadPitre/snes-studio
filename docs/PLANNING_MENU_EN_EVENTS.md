# The game menu, on events (M2)

*Mini design doc, V0-style. The combat chantier
(PLANNING_COMBAT_EN_EVENTS.md) proved the recipe; this applies it to
the LAST game screen still decided in C: the System menu (sysmenu.c,
170 lines of drawn menu), and the game menu a new project never had
(the old M2 task).*

## The dividing line

**The engine keeps one primitive family — the SRAM, which a script
cannot touch:**

- `SRAM save <slot>` — write the game state (scene, position, facing,
  gvars, switches, 16-bit variables) into the slot. save.c already
  owns this (save_write).
- `SRAM load <slot>` — read the slot and RESTORE: the main loop warps
  to the saved scene, the warp invariant ends the calling script. An
  invalid slot changes nothing and the script continues — check first.
- `SRAM exists <slot> → var` — 1 if the slot holds a valid save.

**Events own everything else:** the Start poll (the showcase's
parallel + AUTO switch pattern, now shipped), the menu itself
(LISTSEL), the save/load screens, the texts, the confirmation, the
game-over-offers-Load flow. sysmenu.c is DELETED, along with the
SYSMENU opcode — no project uses it, and a button that only opens an
engine-drawn screen is the old world.

## The starter library (menulib.ts, copied like combatlib)

Four common events in every new project: `menu_poll` (parallel on
switch 22 "Menu autorise") raises switch 20 on Start; `menu_jeu`
(AUTO on switch 20) runs the LISTSEL menu — Objets, Sauvegarder,
Charger, Fermer; `menu_sauvegarder` and `menu_charger` walk the
slots. Two list widgets. The battle's L+R parallel sits BEFORE the
poll in the list, so the menu sleeps during battles for free (one
parallel at a time, first match wins).

## Milestones

- **M2-P — the primitive.** SRAM opcode (save/load/exists), sysmenu.c
  and SYSMENU deleted, three editor commands. Proof: a script saves,
  another reloads it after walking away.
- **M2-L — the library.** menulib in the template + widgets + the
  arming switch; a fresh project presses Start and saves. The editor
  no longer offers the dead SYSMENU button (old projects see a clear
  datagen error and an "obsolete" form).
