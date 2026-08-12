# EDITOR — the SNES Studio editor

**Status: Phase 5c.** A Tauri 2 + React + TypeScript application in
`editor/`. It opens a project folder (the JSON/PNG format documented in
`TOOLS.md` — e.g. `demo/`) and edits **exactly the files `datagen`
consumes**: no intermediate format.

UI labels quoted below are the ones the tool actually shows, and they are
in French — the product is French-facing, the code and the docs are not.

## Features (3a)

- Opening a project, selecting a scene
- **Tile painting** with a brush (the palette comes from `tileset.png`)
- **Collision layer**: solid/free painting plus a red overlay
- **Actors**: placement (+ NPCs), selection, direction/sprite/script
  label, deletion — sprites rendered from `sprites.png`
- **Player start** (a blue frame)
- **Scene script**: text editing (datagen's assembly syntax); the labels
  declared feed the NPCs' "Script" list
- **Texts**: editing the table (filtered ASCII, v0 compliant)
- Saving (Ctrl+S) in the canonical format (readable diffs)

## Features (3b)

- **Undo/redo** (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z) on every edit
- **Scene management**: creation (name + dimensions, the spec constraint
  >= 20x15, a wall border by default), choosing the **boot scene** (★),
  deletion (the boot scene is protected)
- **"Générer les données"**: saves, then runs `datagen` straight from the
  editor. datagen travels with the editor as a sidecar, so no Rust
  toolchain is needed; compiling the .sfc is a separate step (▶ Jouer, or
  the cartridge build).

- **Warps** (Phase 4): the "+ Warp" tool (a purple W tile), a dedicated
  tab (target scene plus arrival position)
- **Music per scene** (Phase 4b): the ♪ selector in the toolbar (the list
  is `project.musics`; to add a module, drop the .it in the project and
  add it to `project.json`)

## Features (5b) — an RPG Maker 2003 style palette

- **Vertical tileset palette** (left panel, 6 columns): a click takes one
  tile, **dragging makes a rectangular selection** used as a multi-tile
  stamp; when painting on the map the pattern repeats aligned on the first
  tile laid (RPG Maker behaviour). The selection stays visible while
  another tool is active.
- **Tileset per scene**: a selector at the top of the palette (the list is
  `project.tilesets`) — changing a scene's tileset switches both the
  palette and the map's rendering.
- **Tileset import**: "Importer…" copies a PNG (indexed, a 16x16 tile
  grid, max 256 tiles) into `assets/tilesets/` and adds it to `project.tilesets`.
- **Scene resizing** ("Redim."): extension with grass or cropping, the
  wall border rebuilt, out-of-bounds actors and warps removed (with a
  warning shown).

## Features (5c) — autotiles, layers, passability (RM2003)

- **Two scenery layers**: the "Couche inf. / Couche sup." buttons in the
  toolbar. The layer not being edited is dimmed. BOTH layers have an
  **eraser** (the first cell of the palette — S10): on the upper layer it
  is the classic empty cell; on the lower layer the cell becomes EMPTY and
  the game shows the backdrop colour there (black, forced by the engine) —
  handy for the void in dungeons and interiors. An empty cell is walkable.
  Upper-layer tiles must have a transparent background (index 0).
- **Autotiles** (automatic water/path borders): shown at the head of the
  palette (the preview is the islet tile). While painting, the borders
  recompute themselves from the neighbours — as in RPG Maker 2003. Source
  format: a 48x64 PNG declared in the tileset's sidecar (see TOOLS.md).
- **Passability in the palette**: the "Passabilité O/X/☆" button — the
  cells show their state and a click cycles O (walkable) → X (solid) → ☆
  (above the hero, walkable). There is no painted-collision tool any more:
  the red overlay shows the DERIVED collision (an upper tile that is not ☆
  wins — a bridge over water is walkable automatically).

- **RM2003 chipset import** ("Chipset RM2003…"): slices a 480x256 chipset
  (tiles, 12 ground autotiles, static water, lower/upper sections) and
  adds it to the project — see TOOLS.md. With a chipset, the palette is
  **filtered by layer** as in RPG Maker (lower tiles on the lower layer,
  objects on the upper one).
- **"Scène" tab** (the first tab on the right): the current scene's
  settings — tileset (choice, imports, passability) and resizing (crop or
  extend, the border rebuilt). The left panel keeps only the drawing:
  modes, tiles, tools.

## Features (5e) — the creation loop

- **▶ Jouer**: save → datagen → `snesbuild` → launch the emulator on the
  compiled ROM. Both tools ship inside the editor: no Rust, and no MSYS2
  — snesbuild drives the PVSnesLib toolchain natively (see
  tools/snesbuild). The PVSnesLib folder and the emulator live in the ⚙
  settings (stored on the machine, not in the project); an installed copy
  carries its own PVSnesLib and the field can stay empty.
  The editor ships NO emulator: Mesen2, bsnes or Snes9x are downloaded
  separately, and Jouer says so plainly when it cannot find the one
  configured.
  **Debug menu (S6)**: the "Menu de debug dans la ROM de test" box in the
  ⚙ settings passes `--debug` to datagen for the test ROMs (Jouer and
  "Générer les données") — NEVER for the cartridge build. In game,
  **Start + Select + R** shows and hides a two-row panel at the top of the
  screen: **FPS** (main loop iterations per second), **LAG** (display
  frames missed since boot — the blocking warp/picture fades count in it,
  so seeing it climb at those moments is normal), and the real occupancy
  of the **SCN** (scenes: maps + events + scripts) and **TXT** (texts)
  banks, in bytes out of 32768. The panel costs almost nothing — the
  values it shows stay honest.
- **Drawing modes** (as in RPG Maker 2003): ✏ pencil, ▭ rectangle, ◯
  ellipse, ▨ paint bucket (a connected area of identical tiles) — the
  stamp's pattern repeats within the shape, anchored at the start of the
  gesture. One gesture = one undo entry.
- **RM2003 style hover**: the target area is framed at the stamp's size,
  with a pencil or bucket cursor; the shape is previewed while dragging.
- **Eyedropper / block copy**: right click takes the tile under the
  cursor; right-drag copies a block of the map into the stamp (which also
  works as copy/paste).
- **Scene tree** (under the palette, as in RM2003): the root is the
  project, scenes can nest (a `parent` field, purely organisational —
  ignored by datagen), drag and drop to reorganise, ＋ creates a scene
  under the selected row, ★ marks the boot scene, 🗑 deletes (the children
  move up one level). The palette/tree splitter can be dragged (the height
  is remembered).
- **Zoom**: 4 levels 1/1 → 1/8 (the status bar under the map, or Ctrl +
  wheel); the status bar also shows the cursor position in tiles.

Not yet: autotile animation (water), gfx editing.

## Features (6) — RM2003 style characters

- **16x24 sprites**: actors are drawn on the map with their idle frame
  (block × 12 + direction × 3), anchored at the bottom of their tile — the
  head sticks out 8 px above, as in RM2003 and in game.
- **Charset (character)**: in the Event Editor, an NPC's sprite is chosen
  among the project's characters (named through `project.charsets`). The
  project is not limited (64 blocks max); each **scene** can show **5
  different ones** (the hero included — an SNES VRAM limit; datagen
  compiles one sprite set per scene).
- **RM2003 charset import**: the "Charset RM2003…" button (resource
  manager) → pick a 288x256 PNG (8 characters) or a 72x128 one (a single
  character), click the character in the preview, choose the destination
  block (existing or new) and a name → `datagen import-charset` reframes
  the 24x32 frames to 16x24 and rewrites `assets/sprites.png`.
- **Resource manager** (🗂 Ressources, RM2003 style): the categories are
  **CharSet** (characters), **ChipSet** (tilesets), **Son** (B1 — WAV
  effects, ~2 seconds max, converted to 8 kHz BRR at build time, 16 max;
  played by the "Jouer un son" event command), **Musique** (Impulse
  Tracker .it modules — importable from the editor at last; chosen per
  scene or through "Changer la musique"), **Vignette** (B5 — strips of
  32x32 frames with transparency, 1-8 frames, previewed frame by frame;
  played as SPRITES by the "Afficher/Animer/Cacher la vignette" commands:
  emoticons above heads, held objects, attack animations on a composed
  screen — 2 vignettes on screen at most, the characters stay visible),
  **WindowSkin** (the Phase 11 9-slice frames), **IconSet** (the widgets'
  icon sheets, W1 — an Nx8 PNG strip validated at import, previewed with
  the index under each icon, ★ = the active sheet) and **FontSet** (the S1
  fonts — a 768x8 PNG strip, 96 8x8 glyphs, validated at import; the
  preview is a sample text rendered with the font plus the glyph strip;
  ★ = the project font `assets.font`, which cannot be deleted; the `fonts`
  register in project.json; renaming updates the dialogue styles AND the
  widgets pointing at it, deleting is refused when a style or a widget
  uses it) and **Picture** (RM2003 style S3 images — an indexed PNG <= 16
  colours, <= 256x224 in multiples of 8, validated at import with a colour
  count; a scaled preview plus the dimensions; shown in game by the
  **"Afficher une image"** event command (the Écran tab, with "Effacer
  l'image") — dialogues play on top, and closing returns the scene intact;
  the `pictures` register in project.json, READ by datagen. **S5/S7
  options (RM2003 Show Picture style)**: the "Afficher une image" form
  offers the **Image** (from the Picture list), the **Position à l'écran**
  (centred, an X/Y position in pixels — X 0-255, Y 0-216, validated by
  datagen — or a position read from VARIABLES), the **Transition** (a fade
  with a DURATION in frames — 60 = one second — or instant) and the
  **blend with the scenery (S8)**: Normal (opaque), semi-transparent
  (50 %), additive (a glow) or subtractive (a shadow) — the console's
  colour circuit blends the image with the scenery, the dialogues stay
  crisp, and the screen tint is suspended while the image is up; "Effacer
  l'image" offers a transition plus a duration. Everything that comes from
  a variable is clamped by the engine to the real dimensions (never off
  screen). The `pic_var` JSON field (the picture number read from a
  variable) is still accepted by datagen but no longer exposed in the form
  (one image at a time). **"Déplacer l'image" (S7)**: slides the shown
  image to a new position (constants or variables) over N frames WITHOUT
  blocking the script (RM2003 Move Picture style) — chain "Attendre" to
  wait for the end. JSON fields: `x`/`y`, `x_var`/`y_var`, `pic_var`,
  `dur` (0 = instant; `fade: false` = the S5 legacy).
  **Transparency (S4)**: at import, the **"Import image"** dialogue shows
  the image — a CLICK picks the colour to make transparent (a
  chequerboard preview, ✕ to clear the choice), then **Valider** (with no
  colour clicked, it imports without transparency) or **Annuler** — in
  game the map's scenery shows through the punched pixels, but the
  characters do not; <= 15 opaque colours in that case. The same picker
  opens when importing **IconSets** and **CharSets**: handy for sheets on
  a flat background (white, magenta…) — the clicked colour becomes the
  transparent index 0 without a trip through GIMP),
  a list with previews, and **Importer / Exporter / Renommer / Supprimer**
  actions on every category.
  Charset export in RM2003 format (72x128, a transparent PNG); chipset
  export is a copy of the PNG grid. Renaming a tileset renames its files
  and updates the scenes; deleting is blocked while the resource is used
  by a scene (and block 0 = the hero is protected). Deleting a character
  shifts the following blocks (the actors are updated). Windowskins: the
  import validates the 24x24 PNG (copied into `assets/windowskins/`, the `windowskins`
  register in project.json — editor only, ignored by datagen), the preview
  shows the sheet plus a sample 9-slice window, and ★ marks the active
  theme (deletion blocked — the active theme is chosen in Tools > UI /
  Thème).
- **Scene music**: in the Scène tab (the Musique section).
- **Effect layer (S9/S11)**: A DEDICATED TAB (Scène / Couche d'effet /
  Script) — a PATTERN (a transparent image from the resource manager,
  <= 256 unique tiles) drifts above the game while it plays: clouds, mist,
  cast shadows. X/Y speeds in px/s (negative = left/up, decimals accepted)
  and a blend (Opaque / Semi-transparent / Additive / Subtractive — in
  subtractive mode the pattern becomes cloud SHADOWS on the ground). When
  a pattern is chosen, the **scene's upper layer is disabled** (the button
  greyed out, painting blocked): the plane that carried it shows the
  pattern. In a blend mode, the screen tint is suspended in those scenes.
  **Camera follow (S11)**: None (fixed on screen, very distant), ¼, ½ or
  stuck to the scenery (1:1 — the pattern is part of the ground, the right
  choice for cloud SHADOWS) — while walking, the pattern slides at a
  fraction of the scenery's speed (immediate depth); it combines with the
  drift. "— aucune —" gives the upper layer back.
- **RM2003 style events (v0.6)**: every actor has a trigger type —
  *Action* (a visible NPC, the A key), *Contact* (invisible, the script
  runs when the hero steps on the tile — an orange "C" marker on the map)
  or *Auto* (invisible, the script runs when the scene loads — a cyan "A"
  marker). Scripts: `CHOICE` (2-4 choices with a cursor), the global
  variables `g<n>` in conditions (give/has), `WARP` (a scripted teleport),
  `FACE` (turn an NPC) — see docs/TOOLS.md.
- **Menu bar** (RM2003 style):
  - *Projet*: Nouveau projet (an empty folder → a minimal playable project
    with a starter tileset/characters/font), Ouvrir, Fermer, Explorer le
    dossier du projet, Quitter.
  - *Edit*: Annuler/Rétablir (Ctrl+Z / Ctrl+Y), cut/copy/paste/delete the
    selected NPC, Réglages du projet (bash, emulator).
  - *Tools*: reserved.
  - *Game*: Lancer le jeu, Vérifier le projet, Générer les données,
    **Build cartouche (.smc)** — a `.smc` ready for a flashcart (mirrored
    to 512 KB, checksum recomputed, validated on a Super UFO Pro 8: the
    256 KB `.sfc` gives "File type error" there), Recompiler tout.
  - *Help*: Version.
  The button bar shrinks to: 💾 (save), the layers, Ressources,
  Collision/Grille, then "Générer les données" and "▶ Jouer" at the end.
- **Project check** (Tools > Vérifier le projet…): a diagnostics window —
  a table of the scenes (size, the 8192-tile budget, charsets n/5, actors,
  warps), blocking problems and warnings found on the editor side (missing
  labels/texts/scenes, limits exceeded, triggers with no script…), then
  datagen's real verdict: bank sizes (scenes and texts out of 32 KB),
  compression savings, generation warnings (colour merges…), and the size
  of the last ROM.

## Features (A2) — an RM2003 style event system

- **Events layer** (the third layer button): the events (a white box), the
  warps (W), the player start (S). **Right-clicking a tile**: a new event,
  a new event from a prefab, paste, a new warp, the player start here —
  or, on an event: edit, cut/copy, prefab, delete. Double-click opens the
  Event Editor. The tool palette ("Sélection / +PNJ / +Warp / Départ") is
  gone: everything happens here.
- **Event Editor** (modelled on RM2003): name plus pages (P4), conditions
  (P4), appearance (character + direction + preview), movement type
  (moving NPCs to come), trigger (Touche action / Contact / Auto-start),
  and the **Contenu** list (`@>`): Message, Choix (2-4, with " : Quand
  […]" branches), variables (= and +), a condition (on a variable, with
  Si vrai/Sinon branches), teleport the hero, turn an event. The texts are
  typed straight into the commands — datagen collects them into the text
  bank and compiles the lot down to the VM.
- **The appearance is independent of the trigger**: a *Contact* or *Auto*
  event can show a character (a chest, a sign, an NPC who accosts the
  hero) while staying walkable; "(invisible)" in the character list makes
  it transparent.
- **Switches and variables (v0.9, P4)**: 512 ON/OFF switches and 256
  16-bit variables, global, persistent and saved. Commands: *Modifier un
  switch*, *Modifier une variable* (= or +, negatives accepted),
  *Condition : switch*, *Condition : variable* (=, ≠, ≥) with Si
  vrai/Sinon branches. This is RM2003's give/has mechanic: a chest is a
  condition on a switch plus that switch set to ON.
- **Event pages (v0.10)**: the 1..N / ＋ page / 🗑 page buttons at the top
  of the Event Editor — each page has its **activation condition** (a
  switch ON/OFF or a variable >=, with the "…" button opening the list),
  its appearance, its trigger and its commands. In game, the last page
  whose condition passes is the active one (an open/closed chest, an NPC
  with states).
- **Moving NPCs (v0.11)**: the Event Editor's "Type de mouvement"
  fieldset is live (per page) — Statique / Aléatoire / Vertical /
  Horizontal. In game: half the hero's speed, an about-turn when blocked,
  never onto the hero's tile or another event's, frozen during dialogues
  and the menu.
- **Move Route (v0.12/v0.13)**: the "Déplacer un event…" command opens a
  full RM2003 style **Itinéraire** window: 3 columns of steps (walk ×4 /
  at random / towards or away from the hero / one step forward; turn ×4 /
  90° right-left / about-turn / at random / towards or away from the
  hero; Vitesse ± / Fréquence ± / Direction fixe / Passe-muraille / Switch
  ON-OFF / Graphisme / Attendre), **Fréquence 1-8** radios, Répéter /
  Ignorer si bloqué options; the target is "Cet event" or an event of the
  scene. The route runs in the background — sequence it with "Attendre la
  fin des déplacements"; "Attendre" (in frames) completes the cutscene
  toolkit.
- **v0.13**: "Modifier une variable" covers the full arithmetic (=, +, −,
  ×, ÷, mod, random 0..N) and several sources (a constant, another
  variable, the hero's X/Y, the timer); the **Timer** commands
  (set/stop/show "M:SS" in the top-right corner), **Déplacer la caméra**
  (a non-blocking scripted pan), **Caméra : retour au héros** and
  **Attendre la caméra**.
- **v0.14**: per page — the **"Route custom" movement type** (an "Éditer
  la route…" button opening the Itinéraire window, with the
  Répéter/Ignorer/Fréquence options), **Priorité** (Sous le héros:
  walkable, triggers by standing on it / Comme le héros / Au-dessus:
  walkable, drawn over everything) and **Vitesse 1-4**. Shortcuts in the
  Contenu list and in the Itinéraire: **Ctrl+C / Ctrl+V / Suppr**.
- **v0.15**: the event command window moves to **tabs** by category
  (Messages, Logique, Déplacements, Temps, Écran, Caméra, Autres) —
  extensible as the command list grows. A command's parameters are edited
  in a **separate window** (the title is the command's name, OK/Annuler)
  rather than the inline form under the Contenu list; the
  Ajouter/Modifier/…/↑/↓ button row is gone — everything goes through
  double-click, right click (Insérer / Éditer / ↑ Monter / ↓ Descendre /
  Supprimer) and the keyboard. New Logique commands: **Boucle** (the body
  between "Boucle" and " : Fin de boucle" repeats), **Sortir de la
  boucle** and **Commentaire** (a green italic line, never compiled). New
  Déplacements commands: **Mémoriser la position du héros** (scene/X/Y
  into three variables), **Téléporter aux variables** (recalling the
  memorised position), **Placer un event** (constant coordinates or read
  from variables) and **Échanger deux events**; "Modifier une variable"
  gains the **N° de la scène courante** source. The **Écran** tab:
  **Cacher / Montrer l'écran** (a blocking fade), **Teinter l'écran**
  (normal / lighten / darken plus RGB 0-31 — the scenery only; the
  characters and the text keep their colours; **S12**: Matin/Jour/Soir/
  Nuit presets, plus the project's **CUSTOM presets (S12b)** — name and
  save the current values (💾), delete (🗑), stored in project.json (the
  tint_presets register, editor only) — and a **Transition** field in
  frames — 0 = immediate, otherwise the tint evolves gradually,
  non-blocking: that is the scriptable day/night cycle), **Météo (pluie /
  neige)** (S13 — intensity 1-3, persists across scenes, the particles
  fall in front of the effect layer; "Aucune" stops it), **Ondulation de
  l'écran** (S14 — amplitude 0-7 px, speed 1-8: the SCENERY ripples
  (desert heat, underwater, a dream), the characters, the text and the HUD
  stay straight; amplitude 0 stops it; persists across scenes),
  **Dégradé d'écran (ciel)** (S15 — a VERTICAL tint: top colour → bottom
  colour (RGB 0-31), lighten or darken; a sunset, a dawn, depth. It
  replaces the flat tint, and "Teinter l'écran" removes the gradient —
  the same console circuit. Scenery only, persists across scenes, no
  cost in game), **Spotlight (cercle de lumière)** (S16 — radius 16-96
  px, darkness 1-31: a circle of light that FOLLOWS the hero, with the
  scenery darkened around it; a cave, night, a torch. It replaces the tint
  and the gradient (the same circuit), persists across scenes; the
  characters and the text stay visible everywhere — a hardware limit, like
  the tint. 0 stops it),
  **Jouer un son** (B1 — a WAV imported through the resource manager,
  ~2 s max, played over the music: a chest, a door, a hit;
  non-blocking), **Changer la musique** (B1 — a project module or
  "silence": battle music, boss music; non-blocking and not instant — the
  track is sent to the audio processor; the scene's music resumes at the
  next scene change), **Flash d'écran** (which also crosses the blends:
  the storm's lightning works above semi-transparent clouds) and
  **Secouer l'écran** (both non-blocking — chain "Attendre").
- **"Écran composé" commands (B3)** — the picker gains a dedicated
  category: **Ouvrir un écran composé** (the background is a full-screen
  Picture, preferably opaque, or black; an adjustable fade), **Poser une
  image (slot)** (1-5 — one transparent image per slot, its position in
  pixels rounded to 8; each slot has ITS OWN palette, so per-image effects
  only touch it; the image appears over a few frames and the script waits
  for the end; laying the same image again is a move), **Retirer une
  image (slot)**, **Effet sur une image (slot)** (B4 — a white attack
  flash, a fade to black for death, a stackable darkening for states, and
  restore: only that slot's PALETTE is manipulated, the other images do
  not move; non-blocking, chain "Attendre"), **Afficher / Animer / Cacher
  une vignette** (B5 — a 32x32 sprite animated from a sheet: anchored to
  the screen or "on the hero" (the surprise "!": X -8, Y -36), a "once"
  mode that hides itself — the sword blow on a monster — a loop, and a
  speed in frames per image; 2 slots) and **Fermer l'écran composé**
  (which restores the whole scene, music included). This is the FF style
  battle screen — a background plus monsters — but generic: a board, a
  map, an illustrated scene. Budget ~511 tiles per screen; avoid
  overlapping two images (a single layer). Dialogues, choices and widgets
  work over the screen.
- **"Écrans composés" window** (Tools >, B6bis; multi-scripts in
  B6bis-2): the staging is COMPOSED WITH THE MOUSE — the screen list on
  the left (＋/rename/🗑), and two tabs for each: **Composition** (pick the
  background among the Pictures, an "＋ Ajouter une image" button, the list
  of laid images — each with a free NAME, its slot 1-5, its picture and
  its coordinates — and the canvas where you DRAG them with the mouse, 8
  px snapping, a pixel-faithful preview) and **Scripts** (SEVERAL NAMED
  scripts per screen, each with its **trigger**: **Automatique** — played
  on opening, possibly under a switch or variable **condition** — or **Par
  appel** — played through the "Appeler un script de l'écran" command from
  another script of the same screen; each script is edited with the same
  command editor as the events — the battle logic lives there, ending with
  "Fermer l'écran composé", which also hides any vignettes still shown).
  In game, the **"Aller à l'écran"** command plays the lot: it is sugar —
  datagen unrolls the composition and the automatic scripts into ordinary
  "Écran composé" commands, the engine does not change, and the scripts
  can still lay, remove and flash dynamically on top.
- **"Common events" window** (Tools >, v0.16 — the Common Events tab of
  the RM2003 Database): a numbered list on the left (＋ Ajouter / 🗑), and
  on the right the name, the trigger — **None (appelé)**, **Autorun** or
  **Parallel process** — with the **"Condition switch" box** (unticked =
  always active, RM2003 style) and the contents, the same command editor
  as the Event Editor (double-click, right click, Ctrl+C/V/Suppr, every
  command). A common event is called from any event with **"Appeler un
  common event"** (the Autres tab). Autorun: restarted as long as its
  switch is ON, with the player frozen (remember to turn it off).
  Parallel process: runs in the background, the player free — messages and
  choices forbidden, pace it with "Attendre". "Cet event" there means the
  calling event.
- **"Tilesets" window** (Tools >, T1/T2 — the Tileset tab of the RM2003
  Database): the NUMBERED LIST of the project's tilesets on the left (＋
  creates an EMPTY entry, 🗑 removes it — the file stays in the project), a
  **Nom** field and a **Fichier tileset** menu at the top: the entry is
  assigned a chipset imported through the resource manager (the ChipSet
  category — the "Chipset RM2003…" and "PNG libre…" buttons). Two tilesets
  can share a file (they then share the passability, sides and animations,
  which are carried by the file's sidecar). Two tabs filter the grid by
  layer as RM2003 does: **Couche basse** (autotiles plus the lower
  section) and **Couche haute** (the chipsets' upper section,
  upper_start). Three editing modes on the grid (autotiles included for
  passability): **Passabilité O/X/☆** (a click cycles, as in the Scène
  tab's palette — the same sidecar), **✥ Directionnel** (four arrows per
  grid tile, click near an edge: red = a closed side, which can no longer
  be crossed either entering or leaving — counters, ledges; it applies to
  the hero AND to moving events), **▶ Animations** (animated tile
  sequences, RM2003 water style: ＋ creates a sequence, clicking tiles of
  the grid chains them — the first (B) is the one laid on the maps, the
  following ones are its frames in the same colours — a 1-2-3 or 1-2-3-2
  mode and a speed in frames; every instance of the tile animates
  together). OK writes project.json (tileset_defs) and the sidecars when
  the project is saved. The Scène tab picks the tileset by entry NAME.
- **"Database" window** (Tools >, Phase 10 — see
  `PLANNING_SYSTEME_DATABASE.md` and `INTEGRATION_DATABASE_EDITEUR.md`):
  RPG Maker's Database experience, but **generic and driven by the
  project's schemas** (`schemas/*.toml`) — the tables on the left (an
  N/255 badge), the instances in the middle (Nouveau / Dupliquer / ↑↓ /
  🗑), and the form on the right generated from the schema: numerics with
  their bounds shown and enforced, `flags8` as named checkboxes, `ref:` as
  menus filled from the target table (names shown, ids stored), `text_id`
  wired to the text bank, and an unknown type read-only.
  Renaming an id **updates every ref**; deleting a referenced entry lists
  its uses before confirming; OK is blocked while an id is invalid or
  duplicated; the ROM byte gauge shows at the bottom. OK writes
  `data/*.toml` (keys in schema order — stable Git diffs); dbgen compiles
  them at the next build. Adding a tab means adding a schema, with no
  code.
  The **"Lire la database"** event command (the Logique tab, v0.17) copies
  a record's field into a 16-bit variable — the table, the record (fixed,
  or a number read from a variable) and the field are chosen from menus
  filled by the schemas, the same lists as the Database window.
  **Creating YOUR OWN tables from the editor**: "＋ Table" (a snake_case
  name plus a title, carrying on to the structure), and "Structure…" opens
  the field editor — name, type (u8/u16/s8/s16, flags8 with its bit names,
  a ref to any table, text_id), default/min/max, optional, runtime copy ⟳,
  reordering (the field order is the ROM layout). Renaming a field
  migrates the entries' values; deleting it removes them; "🗑" deletes the
  table (blocked while `ref:`s target it) and its files. OK also writes
  `schemas/*.toml` — identical to hand-written schemas, and dbgen sees no
  difference. A project without a database creates its `schemas/`+`data/`
  folders on the first table. RESOURCE fields (B7): the
  `picture`/`sound`/`music` types — a dropdown of the project's resources
  BY NAME, with a ▶/⏸ button next to the sounds and music to hear them
  without launching the game (a libopenmpt preview for the .it files); the
  same button lives in the resource manager (the Son and Musique
  categories). dbgen checks the names at build time (a deleted or renamed
  resource is a clear error, never a silently wrong index).
- **"UI" windows** (Tools > UI > a **submenu**: "Widgets…" and "Dialogues
  et choix…", Phase 12, see `SPEC_SYSTEME_UI.md`): a canvas interface
  editor, on the UMG model.
  A **palette** on the left of SIX generic objects (click to add):
  **Canvas** (a placement rectangle and a container — `frame` dresses it
  with the windowskin; BARE by default, U1), Liste verticale and Boîte
  horizontale (which stack their children, with adjustable spacing),
  **Label** (text, where `\v[3]` shows variable 3, `\v[3,4]` right-aligned
  on 4 columns and `\v[3,04]` zero-padded — two variables per label at
  most), **Image** (a SOLID COLOUR by default — a picker over the four
  colours the UI layer has, the font's — or a project picture, or icons
  from the sheet, in one of Unity's three types: *normal*, *sliced* — a
  3x3 picture stretched over the widget, the windowskin recipe with any
  drawing — and *fill*, whose amount is a slider from 0 to 100 % unless
  you tick "piloté par une variable"; that is the gauge and the row of
  hearts), and **Liste
  (curseur)** (B6: a navigable menu — the items are edited one per line in
  the inspector, framed by default, auto-sized; in game the **"Choix dans
  une liste"** command opens it, up/down navigate with wrap-around, A
  writes the index into a variable, B writes 255 when cancelling is
  allowed — the Attaque/Magie/Objet/Fuite menu without a KEYIN hack, in
  the picker's Écran category. Multi-panel options: "Laisser le widget
  affiché à la fermeture" (the list stays on screen, without a cursor) and
  "Gauche/Droite quittent la liste" (254 = left, 253 = right) — two lists
  side by side plus an "active panel" variable in a loop, and the cursor
  hops from one panel to the other; a full example is in the demo's
  combat_prairie composed screen, launched by the Duelliste on the plain).
  The object is added INSIDE the selected container (otherwise beside it,
  otherwise on the canvas). The five old specific widgets (Valeur, Jauge,
  Cœurs, Icône + compteur, Libellé + valeur) left the palette in U1 — a
  label with `\v[n]` and an image in fill mode do all five — but a project
  that holds one still opens, draws and compiles it, and the inspector
  still edits it.
  A **tree**: the structure (canvas > lists >
  rows > labels), selected by click, with the map's keyboard shortcuts —
  **Ctrl+C / Ctrl+X / Ctrl+V** (a subtree, renamed), **Suppr**, **Ctrl+Z /
  Ctrl+Y** (a drag counts as one step). A **256x224 tile-faithful canvas**
  (2x, with the real font/windowskin/icons): a click selects the deepest
  object, dragging moves its root (8 px snap), the corner handle resizes.
  An **inspector** on the right: the selection's properties (↑↓ to
  reorder, 🗑 to delete with its children, id, the variable with the named
  "…" list, clickable icon thumbnails, the frame, a constant or variable
  max, the fill direction…), the **size** of ANY object (an explicit one
  overrides what its content computes, with an "auto" button to give it
  back) and its **anchor** (a 3x3 grid, Unity style — x and y count from
  that point and the same corner stays pinned to it as the object grows).
  A root anchors to the screen; a canvas child that ticks "placement
  libre" anchors to its parent's inside instead of stacking with its
  siblings. Several properties carry a **⛓ button** (U3-a, Unreal's Bind
  gesture): remplissage, **image affichée** — a list of candidate
  pictures, all the same size, the shown one from a variable — and
  **visible**. Bound means the engine WATCHES that variable; nothing
  writes back. On a ROOT: visibility at start-up
  and
  **"Fonte du widget"** (S2 — a FontSet for all the widget's text, shown
  live on the canvas). A Chrono Trigger style panel is Canvas > Liste
  verticale > Boîtes horizontales > labels/images. Two widgets MAY overlap
  (U1): the later one is drawn on top, which is how you put a "full" bar
  over its "empty" artwork. A widget may also sit ON a dialogue window
  (U2) — the box wins while it is up and the widget comes back whole when
  the message closes, which the designer says as a NOTE, not an error.
  The errors (the same rules as the compiler — overflows, missing icons)
  show under the canvas and block OK. On a ROOT the inspector also
  carries an **Événements** section (U3-b): `on_show` / `on_hide` on any
  widget, plus `on_move` / `on_confirm` / `on_cancel` on a list, each a
  **+** opening the ordinary event-command editor on a block stored in
  `ui/hooks.json` — the reaction is written where the widget is. A list
  names the variable its chosen row (or database entry number) is handed
  over in. A hook may not block: datagen refuses a message, a wait, a
  choice, a list or a warp inside one, naming the widget. **"Dialogues
  et choix"** (S1) opens on the **"Boîtes de dialogue"** list: the
  **(défaut) ★** box (always there — the theme's windowskin plus the text
  speed plus the message/choice geometry) and up to 3 **named styles** (✧
  Nouveau style, ✎ rename — ASCII —, 🗑 delete with a confirmation). A
  selected style edits ITS windowskin (default: the theme's), ITS font
  (the FontSet list, default: the project font ★) and ITS windows (a
  message is required, a "fenêtre de choix distincte" is optional); the
  preview draws the selected style's box with its skin AND its font. The
  **Message** and **Afficher un choix** command forms gain a "Boîte de
  dialogue" select (the command list's label shows `[style]`).
  **"Widgets"** opens on the list page: the icon sheet and the LIST of
  widgets — 👁 = visible at start-up (a widget is HIDDEN by default and
  shown through the **"Afficher/cacher un widget UI"** event command, the
  Écran tab), **✎ Renommer** (the children follow), Éditer…/double-click
  opens the **scoped designer** on the widget (the others dimmed), ✧
  Nouveau widget creates one on a free spot, and "← Widgets" returns to
  the list. At the top of the designer: a collapsible Thème (windowskin,
  icon sheet, text speed) and, under the canvas, the geometry of the
  message/choice windows. OK writes `ui/layout.toml` (the `[[node]]` tree
  — old flat layouts are migrated on opening). The window applies **the
  same rules as uigen** (minimum sizes, the HUD area, overlaps, bounded
  ASCII labels): the errors show in red and **OK stays blocked** while any
  remain — the designer cannot produce a layout the build would refuse. OK
  writes `ui/layout.toml` plus the `"ui"` section of project.json.
- **"Switches / Variables" window** (Tools > Switches et variables…,
  modelled on RM2003's Switch/Variable dialogues): slices of 20 on the
  left, a numbered list on the right, a Nom field under the list — the
  names are stored in project.json. Every command form (switch, variable,
  conditions) has a "…" button that opens this list in selection mode
  (double-click chooses) and shows the name under the number.
- **"Commande d'événement" window** (RM2003's Event Command style): a
  separate box with **tabs by category** and a grid of buttons, one per
  command (commands that are announced but not yet compilable stay greyed
  out). It opens two ways: **double-clicking an empty `@>` row**, or
  **right click > Insérer…**. Right-clicking a command row also gives
  **Éditer…**, **↑ Monter / ↓ Descendre** and **Supprimer**;
  double-clicking a filled row opens the command's **options window**.
- **Event prefabs (v0.16)**: right click an event → "Enregistrer comme
  prefab…" opens a **name + category** window (free-form — "PNJ",
  "Coffres", … — to organise the library). Right click an empty tile →
  **"Nouvel événement depuis un prefab…"**: the library opens grouped by
  category, and a double-click (or "Créer ici") instantiates the event.
  **Tools > Prefabs…** manages the library: rename, recategorise, delete.
  Stored in project.json.
- On the map's Events layer: **Ctrl+C / Ctrl+X / Ctrl+V / Suppr** on the
  selected event (v0.16 — in addition to the Edit menu and the right
  click). A click sets the **cell cursor** (a white/black frame, RM2003
  style): Ctrl+V pastes onto that cell. The layer buttons are **RM2003
  icons alone** (stacks of tiles, the edited layer highlighted, a tooltip
  on hover). "Vérifier le projet…" now lives in the **Game** menu.
- Warps are edited by right click through the **"Téléporter"** window
  (v0.16, modelled on RM2003's Transfer Player): the scene tree on the
  left, a **preview of the target scene** on the right (a click sets the
  arrival tile, a white square), zoom 1/1-1/2-1/4, and **Direction à
  l'arrivée** (Conserver / Haut / Droite / Bas / Gauche — written into the
  warp's flags; the hero takes it as it comes out of the fade).
- **A lighter sidebar (Phase 12, a user request)**: the **Acteurs**,
  **Warps** and **Textes** tabs are removed — only **Scène** and
  **Script** remain. Everything goes through the map (the Events layer:
  double-click for the Event Editor, right click to create/edit/delete an
  event or a warp) and through the Tools menu.
- **"Textes" window** (Tools > Textes…): the project's text table
  (referenced by NAME in the scripts), filed by **category** — the left
  column holds (tous), each category with its count, and (sans catégorie);
  ✧ Nouvelle catégorie, ✎ rename (its texts follow), 🗑 remove (the texts
  become "sans catégorie", nothing is deleted). Each text has a category
  select; "+ Ajouter un texte" files the new one under the category being
  shown. The category is a `cat` field in texts.json — editor only,
  datagen ignores it (the text_ids follow the file's order).

## Tools -> Ressources -> Extraire (X1/X2/X5)

A tile viewer over a byte range, whose selection lands in a project
resource category already validated. Design doc:
`docs/PLANNING_EXTRACTION_ROM.md`.

**Two doors into one window.** "Extraire d'une ROM…" opens on the cart
and its tiles, with a Graphismes/Sons switch. "Extraire une musique…"
asks for an `.spc` straight away and shows nothing but the audio panel —
same component, but an SPC is 64 KB of *sound* RAM, so its graphics side
is not hidden by policy, it simply does not exist. Both close with the ✕
in the title bar.

**Opening a file.** Any file, not just a `.sfc` — the ROM is a SOURCE and
is never copied into the project. A copier header (512 bytes glued in
front of a dump whose real size is a whole number of kilobytes) is
detected on load and can be forced on or off, because a mangled dump can
lie about it. The current offset is also shown as its LoROM and HiROM
`bank:address` equivalents, since that is the notation documentation
sites quote; the jump field accepts either form (`1A8000`, or `C2:8000`
with a colon).

**Finding something.** Four controls do the work: the format (1/2/4/8bpp
or Mode 7 linear), the width in tiles, the offset, and the **+-1 byte**
nudge — a one-byte misalignment scrambles the whole image, so it has its
own buttons. The wheel scrolls by a row. "Zone suivante" skips to the
next non-uniform stretch, which matters more than it sounds: a ROM is
mostly padding.

**16x16 blocks** is not an advanced option. SNES sprites are stored as
2x2 tile groups in sequence, so without it every character shows up
quartered and interleaved.

**Palette.** Greyscale by default, so something is always visible while
hunting. Then: read 16 colours at the current offset (with a 2-byte
nudge), scan the file for plausible palettes, borrow the palette of a PNG
already in the project, or edit the swatches by hand. One index can be
marked transparent — it becomes index 0 on export, which is the engine's
convention for fonts and windowskins.

**Sending it.** Drag a rectangle, pick a target, and the window says why
a target would refuse before the import does — the size rules are read
from the resource descriptors in `resources.ts`, so the two can never
disagree. Targets: Picture, Tileset, IconSet, Vignette, Fonte,
Windowskin, Mode 7. **CharSet and ChipSet are deliberately absent**: both
expect an RPG Maker 2003 sheet layout (288x256, 480x256) that no SNES ROM
stores, so offering them would only produce a size refusal every time.

A font is the easy case, and worth knowing: our font format is a 768x8
strip, i.e. **96 tiles on one row**. Set the width to 96, select one row,
done.

The extraction is written as an INDEXED PNG (`encodeIndexedPng` in
`rom.ts`), not truecolour, so the palette order the author chose
survives: `gfx.rs` reads raw indices, and a windowskin is refused
outright when any index exceeds 3.

### The audio panel (X3)

Three columns, and the order is deliberate: what the song IS on the left
(its name and the game's, then the technical facts as a label/value
list), the instruments in the middle with a **play button on every row**,
and what one can DO with it on the right.

This is the part of the ripper that works BEST, and structurally rather
than by luck. A BRR sample describes itself — 9-byte blocks, a range
field that cannot legally exceed 12, one end flag at the end — so the
scan asserts its way to a sample instead of guessing at one. Compression
is not in the way either: BRR *is* the compressed form, and games store
it as is. Decoding lives in `editor/src/brr.ts`, with the same filter
coefficients as datagen's `brr_predict` (`tools/datagen/src/sfx.rs`) —
that encoder and this decoder are two directions of one format.

**From a ROM: scan.** "Blocs minimum" is the only knob; 16 blocks is
about 8 ms. Every hit is listed with its address, duration, size and loop
flag; the ▶ on its row plays it and selects it in one gesture.

**From an `.spc`: read.** An SPC is a snapshot of a *running* sound chip
— 64 KB of ARAM plus the DSP registers — and register `$5D` holds the
page of the SAMPLE DIRECTORY. From an SPC the tool does not scan at all:
it reads the table, with exact boundaries, true loop points and the
instrument numbers of one specific song. Any emulator dumps an SPC in one
keypress, so this is the source to prefer. It is what "Extraire une
musique…" asks for, and the "Extraire d'une ROM…" door accepts it too —
the same "Ouvrir" button takes it and the window drops its graphics side.

**The rate is a guess, by construction.** BRR carries no sample rate:
pitch came from the driver's per-voice register at play time. 32000 Hz
is the DSP's output rate and the usual convention, and the selector is
there because only the ear can settle it.

**A scan pins the END of a sample exactly and its start only to within a
block.** Whatever sits in front of a real sample has roughly a one-in-five
chance of reading as a valid header, and the chain then carries one junk
block at the front. The "◀ bloc / bloc ▶" trim answers that — the same
idea as the +-1 byte nudge on the graphics side — instead of pretending
the scan is exact. An SPC does not need it.

**Two consequences of the engine's budget, stated before the author hears
them.** Sound effects are 8 kHz, at most 8 KB of BRR each (~1.8 s), 16
sounds, 24 KB total (`docs/TOOLS.md`). So only short samples fit — the
panel computes the size the build will produce and refuses to send one
that would not — and the chain is BRR -> PCM -> resample to 8 kHz -> BRR
again, so a ripped effect sounds duller than in the original game.

**"Ce morceau tiendrait-il ?"** (X5-a) totals an SPC directory's BRR and
compares it to the 58573 bytes of ARAM a module gets after the snesmod
driver — smconv's own refusal figure, not an estimate. It is an upper
bound:
a directory may list samples the song never plays, and pattern data plus
the echo region are charged on top (echo alone runs to 28 KB on the
demo's `pollen8`). A second, separate ceiling lives in ROM: all the
modules together are concatenated into a soundbank, and past 32 KB smconv
splits it across banks — snesbuild handles that transparently now, but
the ROM cost is real.

**"▶ Jouer le morceau"** (X5-c/X5-d) turns an `.spc` into an `.it` and
plays it, transcribing on the first click and turning into "⏸ Pause"
while it sounds — through the same libopenmpt worklet as the resource
manager's preview, on the bytes in memory, with nothing written to disk
(`toggleBytes` in `AudioPreview.tsx`). One preview at a time still holds:
starting a sample stops the module, and the other way round.

There is no sequence parser behind it and there could not be — every
studio invented its own format. Instead `spc700.ts` EMULATES the sound
CPU and lets the game's own driver play, watching what it writes to the
eight voices: `KON` for note-ons, `VxSRCN` for the instrument,
`VxPITCH` for the note, `VxVOL` for the volume. One implementation, any
game. Roughly 170x real time, so a 30-second capture costs under 200 ms.

Two controls: how long to capture, and how fine the row grid is (15, 30
or 60 rows per second). `transcribe.ts` then quantises events to rows,
maps pitch to a note (12*log2(P/4096) semitones above C-5), and
**downsamples the instruments until they fit the ARAM budget**, saying by
how much. `itfile.ts` writes the module in IT **instrument mode** with **8-bit**
samples — not a style choice: a sample-mode module is accepted by smconv,
builds without a word, and plays absolute silence, because a pattern's
instrument number resolves to nothing. Every module the engine plays is
shaped that way; the transcription now matches them.

**One verb for both exits.** "⬇ Envoyer l'instrument vers le projet" and
"⬇ Envoyer le morceau vers le projet" — a sound and a song leaving by
doors with different-sounding names is the kind of small confusion that
costs an author ten minutes. Both go through `runImport`, so they inherit
the resource manager's own validation.

What comes out is a PERFORMANCE, not a score: one long flat sequence,
no pattern structure, no clean loop points, and a quantised tempo. It is
an `.it` to finish in OpenMPT, and the design doc
(`docs/PLANNING_MUSIQUE_RIPPEE.md`) says so at length. For a game
**VGMTrans** knows, its route is better — it recovers the composition.
This one earns its keep on the games VGMTrans does not know.

## Running it

Prerequisites: Node.js, Rust (already needed for datagen). On Windows,
WebView2 is present by default.

```bash
cd editor
npm install
npm run tauri dev      # the desktop application
```

Workflow: edit → save → ▶ Jouer. From a checkout you can equally run
`make data && make` in `engine/`, or `snesbuild cart --engine engine`.

## Browser mode (UI development)

Without Tauri (`npm run dev` / `vite preview`), the editor runs read-only
in a browser: it loads the project served at `/project` (copy `demo/` into
`dist/project/` for a preview). Writes are ignored — this mode is for
interface work and screenshots.
