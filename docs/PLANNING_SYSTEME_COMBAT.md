# Battle system — design document (C0)

> **Superseded in part.** C1-C6 built a battle MACHINE in C. V1-V4
> (`PLANNING_COMBAT_EN_EVENTS.md`) moved every decision into events,
> and G1-G2 (`PLANNING_COMBAT_GENERIQUE.md`) dissolved the last
> combat-specific tools: heroes are a database table, a battle is a
> composed screen. Read this for the reasoning; read the other two
> for what the code does today.

Status: DESIGN — no code yet. This document plays the role
PLANNING_SYSTEME_MODE7.md played for the world map: decide the
architecture on paper, cut it into gated milestones, and write down the
constraints BEFORE the first line, so every later chantier argues
against this text instead of re-litigating from scratch.

The target, in one sentence: **an FF5/FF6-style battle — ATB gauges,
the party on the RIGHT of the screen, the monsters on the left, command
windows at the bottom — authored entirely from the editor, with zero
script required for the common case.**

---

## 1. What already exists, and what the showcase proved

The B-series was quietly built toward this. Inventory of the bricks a
battle reuses as-is:

| Brick | Where | Battle use |
| --- | --- | --- |
| Composed screens (STAGE, 5 slots) | `stage.c`, Screens editor | battle backdrop + monster battlers as placed pictures |
| SLOTFX | `stage.c` | hit flash, death fade of a battler |
| Cursor list widget | B6, `ui_*` | the command menu (Attaque/Magie/Objet/Fuite) |
| Gauge widget | W1 | ATB bars, HP bars |
| Windowskins + styles | S1 | the FF6 window look |
| Vignettes + animations (4 slots, layers) | B5/A1 | spell/attack effects on targets |
| Database + schemas | dbgen | `monsters` table EXISTS (hp/atk/def/xp/gold/battle_pic/cry_sfx) |
| User functions (params + return) | F1 | damage formulas as author-editable data |
| VM: variables, parallel processes, KEYIN, rand | — | orchestration and hooks |
| Transitions (mosaic), bgm switch | S18/B1 | the classic battle entry |

The showcase's `combat_gobelin` / `combat_dragon` screens are a
**complete 1-vs-1 turn-based battle in pure script** — menu, database
stats, potions, flee, counter-attack. That experiment is this
document's most valuable input, because it exposed exactly where pure
script stops scaling:

- everything is HAND-WIRED per monster (two monsters = two screens);
- there is no time: strictly alternating turns, no ATB;
- there is one implicit hero (variables 10/11 are his HP), no party;
- damage lives in raw variable arithmetic pasted per screen;
- no target choice, no damage popups, no victory flow worth the name.

The conclusion is NOT "script harder". It is the same conclusion the
world map reached: **the engine owns the clock and the registers; the
game stays data.**

## 2. The founding decision — what is engine, what is data

A battle system can be built three ways:

1. **Pure script** (the showcase way) — proven, and proven unscalable.
2. **Pure engine** (a hardcoded FF6 clone) — betrays the project: the
   author could change numbers but not the game.
3. **RM2003's way** — a battle RUNTIME in the engine, driven entirely
   by DATABASE data, with SCRIPT HOOKS at the joints. The author never
   scripts the loop; he fills tables and, when he wants a special
   moment, attaches an event to a hook.

We take 3, and draw the line precisely:

**The engine module (`btl.c`) owns:** the ATB clock, the ready queue,
the action resolution order, the target cursor, damage application and
KO, the win/lose detection, and the damage popups. These are the parts
where per-frame timing and fairness live — script cannot do them well,
and no game needs them to differ.

**The database owns:** heroes, monsters, skills, troops, drop tables,
formulas (by function name). Changing the GAME means editing tables.

**Script hooks own:** the special moments — battle start, a monster's
turn override, low-HP triggers, victory/defeat cinematics. A hook is an
ordinary command list, edited in the ordinary editor, running under the
ordinary VM while the battle waits.

The display layer adds NOTHING new: the battle screen is a composed
screen (backdrop + battler slots), the windows are ui_screen/widgets on
BG3, the party and cursor are OBJ, effects are the A1 animation slots.
Mode 1 throughout — a battle is the most ordinary screen this console
draws. No Mode 2/5/7 exotica anywhere near this system.

## 3. Hard constraints (numbers first, dreams second)

- **STAGE slots: 5.** Backdrop is not a slot; monsters are. Cap:
  **4 monsters** per troop (FF6 shows up to 6 small ones; 4 is the
  honest ceiling with per-slot palettes and VRAM, and one slot stays
  free for effects). Big single bosses: one slot, bigger picture.
- **Vignette/animation slots: 4.** One spell effect + one popup wave at
  a time is the budget; the ready queue serialises actions anyway.
- **OBJ:** party of **4**, one 16x24 battler each (2-3 OBJ apiece),
  target cursor (1), damage digits (4x 8x8 per popup). Trivial against
  128 OAM entries; the walking scene's actors are absent during battle.
- **BG3/CGRAM:** the textbox font and windows already own their CGRAM
  rows; gauges and cursor lists exist. Nothing new to budget.
- **VBlank:** the ATB tick is main-loop arithmetic (8 u16 adds), and
  the UI redraw rides the existing ui_screen dirty-row path. The only
  new VBlank traffic is the damage digits' OAM, which is the ordinary
  OAM DMA. No new channel, no HDMA.
- **WRAM:** battle state is ~dozens of bytes per combatant x 8. Noise.
- **ROM:** battlers are Pictures (existing resource); a troop is bytes.

## 4. The screen (FF6 layout, our bricks)

```
+--------------------------------------------------+
|  backdrop (composed screen background)           |
|                                                  |
|   [monster A]  [monster C]          hero 1  >    |
|   [monster B]  [monster D]          hero 2  >    |
|         (stage slots, BG2)          hero 3  >    |
|                                     hero 4  >    |
|                                   (OBJ, right)   |
+-----------------------+--------------------------+
| monster names (BG3)   | name  HP    MP   [ATB==] |
| Gobelin               | Terra 240/300 82  [====] |
| Gobelin               | Locke 180/180 12  [==  ] |
+-----------------------+--------------------------+
```

- Monsters: stage slots at troop-defined x/y. SLOTFX flashes on hit,
  fades on death — both exist.
- Party: right side, one column, each hero an OBJ battler. **v1 reuses
  the charset format** (16x24, 12 frames): a "battle charset" block per
  hero gives idle / act / hurt / KO poses with zero new tooling. A
  dedicated larger battler format is a later, purely additive step.
- Bottom windows: ui_screen on BG3, two windowskinned panes. The right
  pane is four rows of name + HP + ATB gauge (existing widgets bound to
  battle-owned variables). The command menu is the cursor-list widget,
  opened over the left pane when a hero becomes ready.
- Target cursor: one OBJ hand, moved by btl among alive targets
  (monsters = slot positions, heroes = fixed rows). KEYIN vocabulary.
- Damage popups: 1-4 OBJ digits above the target, rising ~16 px and
  fading, one popup at a time from a small queue. White for damage,
  green for heal, "MISS" as a 4-tile word.

## 5. The ATB

- Each combatant has `atb` (0..255) and `speed` (from stats). Every
  frame the battle is UNPAUSED: `atb += speed >> 2` saturating; full =>
  pushed on the READY queue.
- Heroes on ready: their row highlights, the command menu opens (if no
  other menu is open — FF6 behaviour). Monsters on ready: their AI
  picks an action, queued.
- **One action resolves at a time** (animation + damage + popups),
  ATB keeps ticking underneath — that is what makes it "active".
- **Wait/Active option** (project setting, like FF6's config): in Wait,
  the clock pauses while a menu or target cursor is open. DEFAULT:
  Wait — kinder for the RM2003 audience, and the showcase can ship
  Active to show off.
- Escape: hold-B FF6 style is v2; v1 is a Fuir command with a success
  roll (the showcase already wrote that logic — it becomes the default
  formula).

## 6. Data model (database tables — dbgen already knows how)

- **`heroes`** (NEW): name, battle charset block, max_hp, max_mp,
  strength, defense, magic, speed, command list (v1 fixed: Attaque /
  Compétence / Objet / Fuir), skill set id. The ACTIVE PARTY (1-4 hero
  ids) lives in project settings and is changeable by event command.
- **`monsters`** (EXISTS — extend): + speed, + magic_def, + ai id,
  + skill refs. Keeps hp/atk/def/xp/gold/battle_pic/cry_sfx untouched.
- **`skills`** (NEW): name, mp cost, power, element?, target mode
  (one enemy / all enemies / one ally / self), animation id, sfx,
  formula = USER FUNCTION NAME (F1). Two built-in formulas ship as
  defaults (physical, magical — FF-style), so an empty project fights
  correctly with zero functions written.
- **`troops`** (NEW): up to 4 (monster id, x, y) + backdrop picture +
  music override + hook script ids. Edited VISUALLY (see §8).
- **Items in battle:** the existing `items` table gains a `battle_use`
  field (heal amount / skill ref). v1: consumables only. **Amended by
  C6:** the table's existing `heal` is the battle effect, and a new
  `count_var` names the (project-named) VARIABLE counting how many the
  party carries — the RM2003-light inventory the showcase already
  used (the potion was variable 17 all along). A menu action
  `item:<id>` spends one, heals the targeted ally and lifts poison;
  an empty count refuses like unpaid MP.
- **Rewards:** xp/gold summed by btl, delivered through a hook with
  the totals in reserved variables — progression (levels) is DATA in
  `heroes` growth fields, applied by a default common event the author
  may replace. The engine does not know what a level is.

## 7. Flow and hooks

```
BATTLE <troop> ->  transition (mosaic) -> intro hook
  -> ATB loop:  tick -> ready -> (menu | AI) -> action queue
                -> resolve: animation, damage, popups, KO checks
                -> hooks: on_monster_low_hp, on_turn_N, ...
  -> all monsters KO -> victory hook (rewards in vars) -> return
  -> all heroes KO   -> defeat hook (default: game over screen)
  -> Fuir success    -> flee hook -> return
```

- `BATTLE` is an event command ("Lancer un combat", RM2003's exact
  vocabulary). **Amended by C2:** the design above said "the calling
  event branches on a result variable" — it cannot. The battle closes
  through the internal warp, and a scene change ENDS the running
  script (the engine's invariant, true even of scripted warps). The
  post-battle sequence is therefore an AUTO event page conditioned on
  the reserved switch 500, which btl raises as the curtain falls and
  the page turns back off; the outcome and the rewards travel in the
  reserved variables 248-250. More RM2003 than the original idea, and
  it costs the engine nothing.
- Hooks are command lists attached to the troop (like screen scripts
  today). While a hook runs, the ATB clock pauses. The showcase's
  scripted-battle experience maps 1:1 onto hooks. **Built by C4:** a
  hook is an ordinary COMMON EVENT the troop references by name
  (troops.toml `intro` / `low_hp`); datagen adds a type-2 entry to
  every scene's CETAB table mapping the common's index to its body,
  so a battle started anywhere finds its hooks locally
  (vm_common_hook). To free the VM for them, the BATTLE opcode now
  ENDS the calling script instead of waiting — nothing after `battle`
  ever ran anyway (the close is an internal warp, the C2 amendment
  above), so the change costs no author anything; the main loop gains
  a "battle owns the loop" branch so the AUTO scan and the player
  stay asleep while no hook runs. Hook set shipped: `intro` (before
  the first tick) and `low_hp` (once, when a living monster falls
  under HALF its hp). Victory/defeat/flee stay the switch-500 AUTO
  page's business.
- The walking scene is suspended exactly like m7 images/stage do it
  today (same takeover recipe, same restore path — scene_load rebuilds
  behind us). This is well-trodden ground.

## 8. Editor

- **Database window** grows the new tables for free (schema-driven
  since R2/dbgen — this is why that refactor existed).
- **Troop editor** (NEW window, the one real UI chantier): canvas with
  the backdrop, drag the monsters from the bestiary, see the exact
  in-game layout (the Screens editor already does 90% of this — it is
  a variant of it, not a new concept).
- **"Lancer un combat"** command form: troop picker, result variable.
- **Party window**: pick the active heroes, order = screen order.
- The words the author sees: Héros, Monstres, Groupes de monstres,
  Compétences, Lancer un combat. No "ATB tick", no "ready queue".

## 9. What v1 deliberately does NOT do

Rows/formations, back attacks, steal, summons with cutscenes, complex
status effects (v1 ships poison + KO only), multi-hit weapons, dual
wield, FF6 desperation attacks, mid-battle dialogue with portraits
(the hook + textbox covers the need plainly). Each is additive later;
none bends the architecture. Written here so nobody "just quickly"
adds one during C2.

## 10. Milestones (each gated like the M7 chantiers)

- **C1 — the screen stands.** `btl.c` takes over, draws a troop from
  the database (backdrop, monsters, party battlers, windows, static
  gauges), returns on a button. Gate: harness capture vs layout.
- **C2 — it fights.** ATB clock, command menu, Attaque, damage via
  default formula, KO, victory/defeat, rewards, `BATTLE` command
  wired from an event. THE demo: two heroes vs two gobelins, end to
  end, scripted inputs in the harness. **Done — with two deferrals,
  both to C3: the damage POPUPS (digits as OBJ) and the visual ATB
  gauges (the gauge widget requires an IconSet the showcase lacks);
  damage reads today through the live PV windows.**
- **C3 — it casts.** Skills + MP, target cursor, A1 animations on
  targets, Fuir. **Done — with amendments:** the menu's SEMANTICS are
  data (heroes.toml `actions`, one meaning per widget item: attack /
  skill:x / flee), because list items are compiled text and a dynamic
  skill submenu needs UI work that belongs to C5; target modes shipped
  are one-enemy and one-ally (all-enemies joins the multi-target pass);
  the animation aims through the new `anim_screen_at` (the ANIMPLAY
  opcode resets the centre so scripts never inherit the battle's aim);
  ITEMS moved to C5 where the inventory model lives. Damage popups
  moved to C4.
- **C4 — it thinks and it talks.** Monster AI patterns (simple
  weighted action lists in the database) + the hook set. **Done:**
  monsters gained `speed`/`magic`/`magic_def` (schema fields) and
  `ai` — a weighted action list ("attack:3", "skill:eclair:1"),
  carried by a new `build` schema field type (validated by the
  schema, read raw by datagen, zero ROM bytes in the packed table;
  its editor UI belongs to C5). Monsters cast through the same
  BT_ANIM path as heroes — mirrored formulas (btl_mon_mag against
  btl_hero_mdef), heal on the most wounded ally, capped by the ROM
  hp; monsters have NO MP — the weights ration their casting, the
  RM2003 way. Damage POPUPS landed: white 8x8 digits (a datagen-made
  sheet on OBJ chars 336-383, palette 4, OAM 100-103), risen a few
  pixels over the hit. And C1's "+256-word VRAM bias" was ELUCIDATED
  as a misread dump: a battler cell's top char row is transparent
  (16x24 art centred at y+4), so a correct upload looks exactly like
  a +16-char shift once the REAL bug (the 4-transfer burst losing its
  tail) truncated the cells; the one-row-per-frame change was the
  whole fix, and the compensation — which only slid the art 8 px up
  inside its frame — is gone.
- **C5 — it is authorable.** Troop editor window, party window, forms,
  diagnostics. The showcase's two scripted battles are REPLACED by
  database troops — the deletion of those two screens is the proof.
  **Done:** Tools → Combat holds "Groupes de monstres" (a canvas with
  the backdrop, drag-placed monsters from the bestiary, the party
  column ghosted at the engine's exact anchors, hook dropdowns) and
  "Équipe" (heroes, stats, screen order, the menu widget and the
  MEANING of its lines). "Lancer un combat" is a picker command
  (Combat tab) whose form names the troop and teaches the switch-500
  aftermath. The monsters' `ai` got its weighted-action widget in the
  Database window (skills read from data/skills.toml). And the proof
  stands: combat_gobelin/combat_dragon are DELETED — the plaine's
  Gobelin and Dragon events now run `battle` on database troops, with
  one AUTO page (switch 500) branching on the reserved variables and
  a named "Combat en cours (plaine)" variable telling which fight
  just ended. Diagnostics stayed with datagen (it refuses an unknown
  troop/hook by name at build time). ITEMS + inventory and the ATB
  gauges did not fit this milestone — they move to C6 with the
  polish pass.
- **C6 — polish.** Wait/Active option, poison, hold-to-flee, balance
  pass on the showcase, doc §-updates. **Done:** heroes.toml
  `atb = "active"` keeps the gauges filling through the menus (the
  served-one-at-a-time queue is unchanged — a ready monster strikes
  the moment the hero's action resolves); skills may carry
  `status = "poison"` — the bite is a sixteenth of max hp, taken when
  the POISONED one acts (the popup rides his own turn), a darkened
  slot marks a poisoned monster, the potion lifts it; holding L+R
  through a tick or a menu rolls the flee coin every 45 frames;
  battle items landed (see §6); the gauges are mirrored into the
  reserved variables 236-239 for the project's widgets; and the
  reserved-variable map was CORRECTED — MP moved from 244+h to 232+h,
  where the old spot collided with the hp pairs from the third hero
  on (latent while every project fought with two). The dragon grew
  into his boss shoes (90 hp, a poisoned Morsure in his list).

C1+C2 make the system real; the rest is rhythm. Estimated shape: C2 is
the big one (the clock and the queue), C5 is the wide one (editor).

## 11. Open questions (parked, not blocking)

1. Hero MP display: numbers only, or a second gauge? (FF6: numbers.)
2. Battler art: keep charset 16x24 forever, or add a 32x32 battler
   resource in C3+? (Cost: a new resource category.)
3. Should troops allow 1 BIG picture monster (boss) to bypass the
   4-slot grid? (Probably yes, cheap.)
4. Random encounters: ship a ready-made common event in new projects
   (M2's menu chantier has the same "default content" question)?

---

*C0 ends here. The next step is C1, and the first argument someone has
with this document should be written INTO it, not around it.*

*Post-C6 note: the author argued with §2's dividing line — the loop
itself must be HIS, in events, not ours in C. That argument is
written into docs/PLANNING_COMBAT_EN_EVENTS.md (V0), which plans the
rebuild of this system on four generic primitives and an editable
event library. C1-C6 stay as the specification the library must
reproduce.*
