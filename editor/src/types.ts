// Project model — an exact mirror of the serde structs in tools/datagen
// (project.rs). Any change here must be mirrored there and documented in
// docs/TOOLS.md.

export interface Project {
  name: string;
  boot_scene: string;
  scenes: string[];
  assets: {
    tileset: string;
    sprites: string;
    font: string;
  };
  musics?: string[]; // .it paths, the order gives the music_ids
  sounds?: string[]; // .wav paths (B1), the order gives the sfx_ids
  vignettes?: string[]; // 32x32 frame strips (B5), the order = vig_id
  // frame-by-frame animations (A1) — the order gives the anim_ids. The
  // cell sheet is a project VIGNETTE: no second graphics pipeline, an
  // animation only adds the frame track.
  animations?: AnimationDef[];
  screens?: string[]; // composed screens (B6bis) — screens/<name>.json files
  tilesets?: string[]; // 16x16 .png paths, the order gives the tileset_ids
  charsets?: string[]; // names of the character blocks (editor only,
  // ignored by datagen) — index = block of the sprite sheet
  prefabs?: EventPrefab[]; // event prefabs (editor only)
  switches?: string[]; // switch names (editor only, index = n)
  variables?: string[]; // names of the 16-bit variables (editor only)
  common_events?: CommonEvent[]; // global scripts (v0.16, compiled by datagen)
  functions?: FunctionDef[]; // functions with parameters (F1) — Tools > Fonctions
  // UI theme v1 (docs/SPEC_SYSTEME_UI.md): 24x24 windowskin (9-slice,
  // the font's palette), typewriter speed, and the widgets' icon sheet
  // (W1 — an Nx8 strip, 64 max)
  ui?: { windowskin?: string; text_speed?: number; icons?: string };
  windowskins?: string[]; // 24x24 PNG paths imported through the manager
  // manager (editor only, ignored by datagen) — the active theme
  // (ui.windowskin) points at one of them
  iconsets?: string[]; // imported icon sheets (same model)
  fonts?: string[]; // imported fonts (S1) — assets.font is the default ★
  // pictures (S3): PNG <= 16 colours, <= 256x224 (multiples of 8) —
  // READ by datagen (the order gives the pic_ids), shown by the
  // "Afficher une image" event command. Object entry (S4):
  // { path, trans: true } = an image WITH TRANSPARENCY (the map's
  // scenery shows through the pixels punched out at import)
  pictures?: PictureEntry[];
  // Mode 7 (M7) — images compiled to the 8bpp affine plane. Their own
  // asset, not pictures: a picture is 4bpp and capped at 16 colours,
  // which would throw away the very thing Mode 7 is for.
  mode7?: Mode7Config;
  // T2 — named tileset entries (Tools > Tilesets window, RM2003)
  tileset_defs?: TilesetDef[];
  // named tint presets (S12b — editor only, see TintPreset)
  tint_presets?: TintPreset[];
}

// One LAID cell (A1-e): what the LAYER shows on this frame.
// cell = -1: this layer shows nothing here — that is what gives
// independent tracks their flexibility with a single timeline.
export interface AnimCell {
  cell: number; // -1 = nothing
  x: number; // -128..127
  y: number; // -128..127
}

// One animation frame (A1): the cells shown SIMULTANEOUSLY (one per
// layer), the duration in screen frames, and the sound played ON ITS
// ENTRY. Mirrors AnimFrame (tools/datagen/project.rs).
export interface AnimFrame {
  cells: AnimCell[]; // one entry per layer
  dur: number; // 1..255 screen frames
  sfx?: string; // stem of a project sound
  // INHERITED single-layer shape (projects from before layers) — read by
  // animFrameCells, never written back
  cell?: number;
  x?: number;
  y?: number;
}

export interface AnimationDef {
  name: string;
  vignette: string; // stem of the vignette used as the cell sheet
  loop?: boolean;
  layers?: number; // simultaneous cells (1-4), default 1
  frames: AnimFrame[];
}

export const ANIM_LAYERS_MAX = 4;

// Cells laid on a frame, padded to `layers` entries (an unfilled layer
// shows nothing) and including the inherited shape.
export function animFrameCells(f: AnimFrame, layers: number): AnimCell[] {
  const base: AnimCell[] =
    f.cells && f.cells.length
      ? f.cells
      : [{ cell: f.cell ?? 0, x: f.x ?? 0, y: f.y ?? 0 }];
  const out = base.slice(0, layers).map((c) => ({ ...c }));
  while (out.length < layers) out.push({ cell: -1, x: 0, y: 0 });
  return out;
}

export type PictureEntry = string | { path: string; trans?: boolean };
export function picPath(e: PictureEntry): string {
  return typeof e === "string" ? e : e.path;
}
export function picTrans(e: PictureEntry): boolean {
  return typeof e !== "string" && !!e.trans;
}

// The project's windowskins — the active theme is always in there
// (migration of projects from before the register)
export function projectWindowskins(p: Project): string[] {
  const list = p.windowskins ?? [];
  const cur = p.ui?.windowskin;
  return cur && !list.includes(cur) ? [...list, cur] : list;
}

// The project's icon sheets — same migration rule
export function projectIconsets(p: Project): string[] {
  const list = p.iconsets ?? [];
  const cur = p.ui?.icons;
  return cur && !list.includes(cur) ? [...list, cur] : list;
}

// Mode 7 images. The zoom ramps are NOT here: they are carried by the
// commands and datagen derives the distinct tables from a project-wide
// scan (docs/PLANNING_SYSTEME_MODE7.md).
export interface Mode7Config {
  images?: string[];
}

// The easing the author picks in the form. Same four names datagen
// parses — a mismatch here is a build error, so they stay in step.
export type M7Curve = "linear" | "ease_in" | "ease_out" | "ease_in_out";

export function projectMode7(p: Project): string[] {
  return p.mode7?.images ?? [];
}

// The project's pictures (S3) — datagen reads this register as is
export function projectPictures(p: Project): PictureEntry[] {
  return p.pictures ?? [];
}

// The project's fonts: assets.font (the default) always first
export function projectFonts(p: Project): string[] {
  const list = p.fonts ?? [];
  return list.includes(p.assets.font)
    ? [p.assets.font, ...list.filter((f) => f !== p.assets.font)]
    : [p.assets.font, ...list];
}

// uigen v1 layout (ui/layout.toml) — positions/sizes IN TILES
export interface UiWin {
  pos: [number, number];
  size: [number, number];
}
export interface UiOverlay {
  id: string;
  pos: [number, number];
  size: [number, number];
  // "variable_display" | "gauge" | "icon_row" | "icon_value" (W1)
  content: string;
  var?: number;
  label: string;
  frame?: boolean; // default: true for variable_display, false otherwise
  max?: number; // gauge/icon_row: a constant maximum…
  max_var?: number; // …or carried by a variable (exclusive)
  icon?: number; // gauge/icon_row: 1st of 3 (full/half/empty); icon_value: the only one
  dir?: string; // gauge: "h" (default) | "v"
  pad?: number; // icon_value: leading zeros (0-5)
}

// default frame of an overlay according to its content (uigen W1 rule)
export function overlayFramed(o: UiOverlay): boolean {
  return o.frame ?? o.content === "variable_display";
}
export interface UiLayout {
  message: UiWin;
  choice: UiWin;
  overlay: UiOverlay[];
}
// historic defaults (no file) — the same values as uigen
export function defaultUiLayout(): UiLayout {
  return {
    message: { pos: [0, 20], size: [32, 8] },
    choice: { pos: [0, 20], size: [32, 8] },
    overlay: [],
  };
}

// stem of an asset path ("assets/tileset_automne.png" -> "tileset_automne")
export function assetStem(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path;
  return base.replace(/\.[^.]+$/, "");
}

// stem of a module path ("assets/music/pollen8.it" -> "pollen8")
export function musicStem(path: string): string {
  return assetStem(path);
}

// the project's tilesets (order gives the tileset_ids) — default: assets.tileset
export function projectTilesets(p: Project): string[] {
  return p.tilesets && p.tilesets.length > 0 ? p.tilesets : [p.assets.tileset];
}

// T2 — RM2003-style TILESET entries: a NAMED entry points at an
// imported chipset file (Resource manager). The scenes reference the
// FILE (its stem) — the entry is the editor-side face of it.
export interface TilesetDef {
  name: string;
  file: string; // project path of the PNG ("" = not assigned yet)
}

export function projectTilesetDefs(p: Project): TilesetDef[] {
  if (p.tileset_defs && p.tileset_defs.length) return p.tileset_defs;
  return projectTilesets(p).map((f) => ({ name: assetStem(f), file: f }));
}

export type Direction = "down" | "up" | "left" | "right";

// Actor types (RM2003 triggers, v0.6): npc = a visible NPC (talks with
// A), trigger = a script on contact (stepping on the tile), auto = a
// script when the scene loads. trigger/auto: invisible, no sprite.
// LEGACY: old scene files carry "actors" — converted to EVENTS on load
// (io.ts), saved back as events.
export type ActorKind = "npc" | "trigger" | "auto";

export interface Actor {
  type: ActorKind;
  x: number;
  y: number;
  sprite: number;
  // T4 — TILE appearance (grid id in the upper layer of the scene's
  // tileset): exclusive with sprite (datagen composes a virtual block)
  tile?: number;
  dir: Direction;
  entry?: string;
}

// ---- Events (Event Editor, RM2003 model) ---------------------------------
// An event = position + trigger + appearance + structured COMMANDS,
// compiled by datagen down to the VM (actor + bytecode). See docs/TOOLS.md.

export type EventTrigger = "action" | "touch" | "auto";

export type Command =
  | { c: "msg"; text: string; text_ref?: string; style?: string } // text_ref: an entry of the Tools > Textes catalogue (wins over text); style: S1 box (absent = default)
  | { c: "choice"; var?: string; style?: string; options: { text: string; do: Command[] }[] }
  | { c: "set"; var: string; value: number }
  | { c: "add"; var: string; value: number }
  | { c: "if"; var: string; op: "==" | "!=" | ">="; value: number; then: Command[]; else: Command[] }
  | { c: "warp"; to: string; x: number; y: number; trans?: ScreenTrans }
  | { c: "face"; event: number; dir: Direction }
  // v0.9 — switches (512) and 16-bit variables (256), RM2003 style.
  // set/add/if on 8-bit v/g stay readable (legacy) but the command
  // window only offers the modern versions.
  | { c: "switch"; n: number; on: boolean }
  | { c: "if_sw"; n: number; on: boolean; then: Command[]; else: Command[] }
  // F2 — both sides are sources: a constant, a variable, the hero's X/Y,
  // the timer, a function parameter, the last call's result. `n` and
  // `value` are still read when `left`/`right` are absent (projects saved
  // before F2 — datagen accepts them too).
  | {
      c: "if_var";
      n: number;
      op: "==" | "!=" | ">=";
      value: number;
      left?: ValueSrc;
      right?: ValueSrc;
      then: Command[];
      else: Command[];
    }
  // v0.12 — Move Route (cutscenes): a background route, waiting for it
  // to end, a blocking pause
  | { c: "route"; event: number; repeat: boolean; skip: boolean; freq?: number; steps: RouteStep[] }
  | { c: "wait_route" }
  | { c: "wait"; frames: number }
  // v0.13 — advanced operations, timer, scripted camera
  // F2b — "dst" picks the destination space: a project global variable
  // (default), or a LOCAL variable of the current function, in which
  // case "n" is the local's index and not a global's.
  | {
      c: "var";
      dst?: "global" | "local";
      n: number;
      op: VarOp;
      from?: VarSource;
      value: number;
    }
  | { c: "timer"; op: "start" | "stop" | "show" | "hide"; secs?: number }
  | { c: "campan"; x: number; y: number; speed: number }
  | { c: "cam_return"; speed: number }
  | { c: "wait_cam" }
  // v0.15 — RM2003 loops and comments (pure datagen: loop = label + JMP,
  // break = JMP to the end of the loop, rem = nothing)
  | { c: "loop"; do: Command[] }
  | { c: "break" }
  | { c: "rem"; text: string }
  // v0.15 — scripted positions: remember the hero's position in 3
  // variables (scene/X/Y), recall it (teleport), place or swap events.
  // event/a/b: -1 = this event, otherwise the scene ENTRY number.
  | { c: "hero_loc"; vs: number; vx: number; vy: number }
  | { c: "warp_var"; vs: number; vx: number; vy: number; trans?: ScreenTrans }
  | { c: "setpos"; event: number; from: "const" | "vars"; x: number; y: number }
  | { c: "swappos"; a: number; b: number }
  // v0.15 — screen effects (screenfx module): a blocking fade, a
  // persistent tint (scenery only — hardware), non-blocking flash and
  // shake (chain them with "Attendre")
  // Phase 12 — Key Input Processing (RM2003): the key's code into a
  // variable (1 down, 2 left, 3 right, 4 up, 5 A, 6 B, 7 Y, 8 X, 9 L,
  // 10 R, 11 Select, 12 Start; 0 = none)
  | { c: "key_input"; var: number; wait: boolean; keys: number[] }
  | { c: "sysmenu" } // System menu (the hard-wired START mapping is gone)
  // S3 — full-screen pictures (RM2003 style): the image covers the game
  // (BG3 stays: dialogues play ON TOP), pic = a stem of the
  // project.pictures register; pic_hide closes it and restores the scene
  // intact. x/y: screen position in pixels (absent = centred) — S5. S7:
  // pic_var = the picture number read from a variable (replaces pic),
  // x_var/y_var = the position read from variables, dur = frames of
  // fade/slide (0 = instant, default 16); fade: false = S5 legacy
  // (equivalent to dur 0). pic_move slides the shown image towards the
  // target over dur frames, WITHOUT blocking the script.
  // blend (S8): color math blending with the scenery — half = semi-
  // transparent (50 %), add = additive (a glow), sub = subtractive (a
  // shadow). Absent = an opaque image. pic_var is still accepted by
  // datagen but no longer exposed in the form (one image at a time).
  | {
      c: "pic_show";
      pic: string;
      pic_var?: number;
      x?: number;
      y?: number;
      x_var?: number;
      y_var?: number;
      dur?: number;
      fade?: boolean;
      blend?: "half" | "add" | "sub";
    }
  | { c: "pic_hide"; dur?: number; fade?: boolean }
  | { c: "pic_move"; x?: number; y?: number; x_var?: number; y_var?: number; dur?: number }
  | { c: "ui_show"; widget: string; on: boolean }
  | { c: "list_select"; widget: string; var: number; cancel: boolean; keep?: boolean; lr?: boolean }
  // S18d: frames = duration (1-255); speed = legacy (1-15 brightness
  // levels per frame, converted by datagen when frames is absent)
  | { c: "scr_hide"; frames?: number; speed?: number; trans?: ScreenTrans }
  | { c: "scr_show"; frames?: number; speed?: number; trans?: ScreenTrans }
  // dur (S12): frames of a GRADUAL transition (day/night) — absent or
  // 0 = an immediate tint (the TINT bytecode is unchanged)
  | { c: "tint"; mode: "off" | "add" | "sub"; r: number; g: number; b: number; dur?: number }
  // Particle weather (S13, RM2003 Weather Effects style): persists
  // across scenes until the next change
  | { c: "weather"; kind: "off" | "rain" | "snow"; power?: number }
  // Screen ripple (S14, HDMA): power 0 = stop, persists
  | { c: "screen"; name: string; dur?: number; trans?: ScreenTrans }
  | { c: "screen_call"; script: string }
  | { c: "stage_open"; pic: string; dur?: number; trans?: ScreenTrans }
  | { c: "stage_pose"; slot: number; pic: string; x: number; y: number }
  | { c: "stage_clear"; slot: number }
  | { c: "slot_fx"; slot: number; fx: "restore" | "flash" | "fadeout" | "dark"; frames?: number }
  | { c: "stage_close"; dur?: number; trans?: ScreenTrans }
  // M7 — "Zoom cinematique": ONE command that opens the Mode 7 screen,
  // plays the zoom to its end and closes it. The zoom lives here rather
  // than in a named resource, so filling the form is all there is to do.
  | {
      c: "m7";
      image: string;
      from: number;
      to: number;
      frames: number;
      curve: M7Curve;
      dur?: number;
    }
  // M7-B — the WORLD MAP's camera angle, mid-game. Named presets, since
  // "horizon 88, anchor 168" describes nothing; "custom" exposes the two
  // screen lines for anyone who wants them.
  | {
      c: "m7_view";
      preset: M7View;
      horizon?: number;
      anchor?: number;
    }
  // M7-B4 — turns the world map's plane around the hero. 16 steps of
  // 22.5 degrees, because the tables are compiled per angle and the
  // count must be a multiple of 4 (see PLANNING_SYSTEME_MODE7 §7.2d).
  | { c: "m7_rot"; step: number }
  // M7-B4 — an ANIMATED turn: the engine walks the steps itself, the
  // short way round. The step count buys resolution, this buys motion.
  | { c: "m7_turn"; step: number; frames: number; wait: boolean }
  | { c: "vig_show"; slot: number; vig: string; x: number; y: number; anchor: "screen" | "hero"; vig_var?: number; x_var?: number; y_var?: number }
  | { c: "vig_play"; slot: number; mode: "loop" | "once" | "stop"; speed?: number }
  | { c: "vig_hide"; slot: number }
  // A1 — frame-by-frame animations. anchor "event" + event = -1 for
  // "this event". wait: blocks the script until the end (never for a
  // looping animation, which never ends).
  // x/y (V2): where a SCREEN-anchored animation lands (default 112,96,
  // the screen centre) — the combat library aims skills at their target.
  | { c: "anim_play"; anim: string; anchor: "screen" | "hero" | "event"; event?: number; wait?: boolean; x?: number; y?: number; anim_var?: number; x_var?: number; y_var?: number }
  // G2 — there is no "Lancer un combat" command: a battle is a COMPOSED
  // SCREEN ("Aller à l'écran"), whose script names its monsters and
  // calls the project's library. The aftermath stays an AUTO page
  // conditioned on the reserved switch 500.
  // V1 — the battle PRIMITIVES (PLANNING_COMBAT_EN_EVENTS.md §2): the
  // four generic services scripted battles are built on. btl_pose
  // shows/hides, in one of 4 slots, the battler of an entry of the
  // database's `heroes` table — the party is the script's data, so
  // pointing a slot at another entry swaps the character; popup pops a
  // number (constant, or value_var when set); clock serves `lanes`
  // (gauge, speed) variable pairs from `base` every frame (0 stops);
  // target_sel walks the stage's occupied slots (or the posed party
  // when ally) and writes the pick (255 on cancel).
  | { c: "btl_pose"; slot: number; entry?: string | number; entry_var?: number;
      x: number; y: number; show: boolean;
      /** V1 name of the slot — read by datagen for older projects */
      hero?: number }
  | { c: "popup"; value: number; value_var?: number; x: number; y: number }
  | { c: "clock"; base: number; lanes: number }
  | { c: "target_sel"; var: number; ally?: boolean; cancel: boolean }
  // M2 — the SRAM primitive: the menus around it are the project's
  // events (PLANNING_MENU_EN_EVENTS.md). Slot is 1-4 for the author.
  | { c: "save_slot"; slot: number }
  | { c: "load_slot"; slot: number }
  | { c: "slot_info"; slot: number; var: number }
  | { c: "anim_stop" }
  | { c: "sfx"; sound: string }
  | { c: "bgm"; music: string }
  | { c: "wave"; power: number; speed?: number }
  | { c: "spotlight"; radius: number; dark?: number }
  | {
      c: "skygrad";
      mode: "off" | "add" | "sub";
      r: number;
      g: number;
      b: number;
      r2: number;
      g2: number;
      b2: number;
    }
  | { c: "flash"; r: number; g: number; b: number; frames: number }
  | { c: "shake"; power: number; speed: number; frames: number }
  // v0.16 — call of a common event (CALL/RET, an 8-level stack)
  | { c: "call"; n: number }
  // F1 — call of a FUNCTION: one argument per declared parameter; dst
  // stores the returned value in a variable (sugar for the call followed
  // by an assignment from the "ret" source).
  | { c: "call_fn"; n: number; args: ValueSrc[]; dst?: number }
  | { c: "ret_fn"; from?: VarSource; value: number }
  // v0.17 — read a Database field into a 16-bit variable.
  // entry: a symbolic id (from const) or a variable number (from var)
  | { c: "db_read"; table: string; from?: "const" | "var"; entry: string | number; field: string; dst: number }
  // The NUMBER of a database entry, into a variable — the generic way
  // to name a table row in a script (which monster a screen poses,
  // which hero a party slot holds). Resolved at build time, so the
  // author names the entry and never types an index.
  | { c: "db_entry"; table: string; entry: string; dst: number };

// Common event (v0.16, the RM2003 Database -> Common Events model): a
// project-global script — callable ({"c":"call"}), Autorun (restarted as
// long as its switch is ON, freezes the player) or Parallel process (runs
// in the background without freezing the player; messages and choices
// forbidden). The condition switch is required for both auto and parallel.
export interface CommonEvent {
  name: string;
  trigger: "none" | "auto" | "parallel";
  switch?: number; // optional condition (absent = always active)
  commands: Command[];
}

// F1 — a FUNCTION: a global script that takes parameters and can return
// a value. Deliberately SEPARATE from common events: a common event is a
// block of commands you trigger, a function is a computation you call.
// Mixing the two in the same window meant reading a checkbox to know
// which one you were looking at.
export interface FunctionDef {
  name: string;
  params: string[]; // names (editor only — the engine sees indices)
  // F2b — LOCAL variables: they live in the call frame, right after the
  // parameters. Every call has its own, zeroed, recursion included —
  // that is what allows a scratch value without borrowing a global
  // variable.
  locals?: string[];
  returns: boolean; // returns a value ("Retourner" command)
  commands: Command[];
}

// A function's signature, as the forms need it to offer the right fields
// (number of arguments, return value).
export interface FnSig {
  name: string;
  params: string[];
  returns: boolean;
}

export type VarOp = "=" | "+" | "-" | "*" | "/" | "%" | "rand";
// F1: "param" = parameter n of the current function (inside a function
// body only), "ret" = the value returned by the last call.
export type VarSource =
  | "const" | "var" | "hero_x" | "hero_y" | "timer" | "scene"
  | "param" | "local" | "ret";

// An input value, the same everywhere: source + number. The number is a
// constant, a variable number or a parameter number depending on source.
export interface ValueSrc {
  from?: VarSource; // absent = a constant
  value: number;
}

// One route step (v0.13, the full Move Route dialogue).
// wait: n x 8 frames (1-15); swon/swoff: n = switch; gfx: project block.
export type RouteStep =
  | {
      s:
        | "down" | "up" | "left" | "right"
        | "mrand" | "mhero" | "mflee" | "fwd"
        | "tdown" | "tup" | "tleft" | "tright"
        | "t90r" | "t90l" | "t180" | "t90x" | "trand" | "face" | "tflee"
        | "spd+" | "spd-" | "frq+" | "frq-"
        | "fixon" | "fixoff" | "thruon" | "thruoff";
    }
  | { s: "wait"; n: number }
  | { s: "swon"; n: number }
  | { s: "swoff"; n: number }
  | { s: "gfx"; block: number };

export const ROUTE_STEP_LABELS: Record<string, string> = {
  down: "Marcher bas",
  up: "Marcher haut",
  left: "Marcher gauche",
  right: "Marcher droite",
  mrand: "Marcher au hasard",
  mhero: "Vers le héros",
  mflee: "Fuir le héros",
  fwd: "Un pas en avant",
  tdown: "Tourner bas",
  tup: "Tourner haut",
  tleft: "Tourner gauche",
  tright: "Tourner droite",
  t90r: "Tourner 90° droite",
  t90l: "Tourner 90° gauche",
  t180: "Demi-tour",
  t90x: "90° gauche ou droite",
  trand: "Tourner au hasard",
  face: "Se tourner vers le héros",
  tflee: "Tourner dos au héros",
  "spd+": "Vitesse +",
  "spd-": "Vitesse −",
  "frq+": "Fréquence +",
  "frq-": "Fréquence −",
  fixon: "Direction fixe ON",
  fixoff: "Direction fixe OFF",
  thruon: "Passe-muraille ON",
  thruoff: "Passe-muraille OFF",
  wait: "Attendre",
  swon: "Switch ON",
  swoff: "Switch OFF",
  gfx: "Changer le graphisme",
};

export const SWITCH_COUNT = 512;
export const VAR16_COUNT = 256;

// Activation condition of a page (v0.10): a switch ON/OFF or var >= min
export type PageCondition =
  | { switch: number; on: boolean }
  | { var: number; min: number };

// An extra page of an event (v0.10). GameEvent's flat fields ARE page 1
// — extraPages carries pages 2+ (the LAST page whose condition passes is
// the active one in game, RM2003 model).
export type MoveType = "static" | "random" | "vertical" | "horizontal" | "custom";
export type EventPriority = "below" | "same" | "above";

// Custom route of a page (movement type "custom", v0.14)
export interface PageRoute {
  freq: number; // 1-8
  repeat: boolean;
  skip: boolean;
  steps: RouteStep[];
}

export interface EventPage {
  condition?: PageCondition;
  trigger: EventTrigger;
  sprite: number;
  // T4 — TILE appearance (grid id in the upper layer of the scene's
  // tileset): exclusive with sprite (datagen composes a virtual block)
  tile?: number;
  dir: Direction;
  entry?: string;
  commands: Command[];
  move?: MoveType; // v0.11 — moving NPCs (default: static)
  move_route?: PageRoute; // v0.14 — required when move == "custom"
  priority?: EventPriority; // v0.14 — default "same"
  speed?: number; // v0.14 — 1-4 (default 1)
}

export interface GameEvent {
  name: string;
  x: number;
  y: number;
  trigger: EventTrigger;
  sprite: number;
  // T4 — TILE appearance (grid id in the upper layer of the scene's
  // tileset): exclusive with sprite (datagen composes a virtual block)
  tile?: number;
  dir: Direction;
  entry?: string; // label of a hand-written script (advanced)
  commands: Command[];
  condition?: PageCondition; // condition of page 1 (rare but allowed)
  extraPages?: EventPage[]; // pages 2+ (v0.10)
  move?: MoveType; // v0.11 — movement type of page 1
  move_route?: PageRoute; // v0.14
  priority?: EventPriority; // v0.14
  speed?: number; // v0.14
}

// Prefab: a reusable event, without a position (project.json "prefabs").
// v0.16: a free-form category to organise the library ("PNJ",
// "Coffres", … — absent = "Sans catégorie").
export interface EventPrefab {
  name: string;
  category?: string;
  event: Omit<GameEvent, "x" | "y">;
}

// conversion of the old actors (io.ts)
export function actorToEvent(a: Actor, index: number): GameEvent {
  return {
    name: `EV${String(index + 1).padStart(3, "0")}`,
    x: a.x,
    y: a.y,
    trigger: a.type === "npc" ? "action" : a.type === "trigger" ? "touch" : "auto",
    sprite: a.type === "npc" ? a.sprite : -1,
    dir: a.dir,
    entry: a.entry,
    commands: [],
  };
}

export interface Warp {
  x: number;
  y: number;
  to: string; // target scene
  tx: number;
  ty: number;
  dir?: Direction; // v0.16 — the hero's direction on arrival (absent =
  // kept, RM2003 "Retain") — WarpDef.flags on the engine side
  trans?: ScreenTrans; // S18 — transition (absent = fade)
}

// Screen transition (S18): fade (default), instant, mosaic, wipes
// (S18b — a black curtain, line by line)
export type ScreenTrans =
  | "fade"
  | "none"
  | "mosaic"
  | "wipe_down"
  | "wipe_up"
  | "wipe_center";
export const TRANS_OPTIONS: { value: ScreenTrans; label: string }[] = [
  { value: "fade", label: "Fondu (défaut)" },
  { value: "none", label: "Instantané" },
  { value: "mosaic", label: "Mosaïque" },
  { value: "wipe_down", label: "Balayage vers le bas" },
  { value: "wipe_up", label: "Balayage vers le haut" },
  { value: "wipe_center", label: "Balayage vers le centre" },
];

// A scene's TYPE. Absent or "map" is an ordinary scene; "worldmap" is
// projected on the Mode 7 plane (docs/PLANNING_SYSTEME_MODE7.md §8.2).
// Chosen at creation, never ticked afterwards: it changes what the scene
// may contain, not merely how it is drawn.
export type SceneKind = "map" | "worldmap";

/** World map camera angles. The gap between the horizon and the anchor
 *  IS the tilt: "plongeante" is nearly top-down, "tres_rasante" is an
 *  F-Zero floor. */
export type M7View =
  | "plongeante"
  | "standard"
  | "rasante"
  | "tres_rasante"
  | "custom";

/** The two screen lines behind each preset — shared by the scene panel
 *  and the command form, and the SAME table datagen carries. */
export const M7_VIEWS: Record<Exclude<M7View, "custom">, [number, number]> = {
  plongeante: [24, 200],
  standard: [56, 176],
  rasante: [88, 168],
  tres_rasante: [104, 160],
};

export const M7_VIEW_LABELS: Record<M7View, string> = {
  plongeante: "Plongeante — presque vue de dessus",
  standard: "Standard — equilibree",
  rasante: "Rasante — beaucoup de profondeur",
  tres_rasante: "Tres rasante — sol facon F-Zero",
  custom: "Personnalisee (lignes d'ecran)",
};

export interface Scene {
  name: string;
  kind?: SceneKind;
  /** World map CAMERA ANGLE, in screen lines: where the ground vanishes,
   *  and where it is drawn 1:1 (the hero's feet). Absent = 56 / 176.
   *  Ignored on an ordinary scene. */
  m7_horizon?: number;
  m7_anchor?: number;
  /** World map ROTATION, as a STEP COUNT: 0/absent off, or 16 / 32 / 64.
   *  Finer steps buy smoothness with ROM — about 14 KB at 16 and 56 KB
   *  at 64 — so a map that only faces four ways should not pay for 64. */
  m7_rotate?: number;
  /** World map SKY, the band above the horizon — black when absent.
   *  A flat colour costs no HDMA channel and works with rotation; the
   *  gradient needs one, and rotation takes all five. */
  m7_sky?: string;
  m7_sky_top?: string;
  m7_sky_bottom?: string;
  /** A sky IMAGE, by path — mode 1 above the horizon (§7.2f). Costs the
   *  plane 16 colours, and excludes the gradient. */
  m7_sky_image?: string;
  width: number;
  height: number;
  player_start: [number, number];
  // logical ids: 0.. = a grid tile, AUTOTILE_BASE+k = autotile k
  tilemap: number[][]; // lower layer
  upper: number[][]; // upper layer, EMPTY_TILE = empty
  events: GameEvent[]; // the Events layer (old actors migrate into it)
  script: string[];
  warps: Warp[];
  music?: string; // stem of a project.musics module — absent = silence
  tileset?: string; // stem of a project.tilesets tileset — absent = the first
  // parent scene in the editor's tree (organisational only — ignored by
  // datagen)
  parent?: string;
  // Effect layer (S9): a drifting pattern (clouds, mist) carried by the
  // upper layer's plane — which is therefore DISABLED in this scene.
  // pic = the stem of a TRANSPARENT image from project.pictures;
  // dx/dy in px per second; blend = color math blending in game.
  effect?: SceneEffect;
}

// The project's tint presets (S12b): created/named/deleted from the
// "Teinter l'écran" command — stored in project.json (editor only,
// ignored by datagen)
export interface TintPreset {
  name: string;
  mode: "off" | "add" | "sub";
  r: number;
  g: number;
  b: number;
}

export interface SceneEffect {
  pic: string;
  dx?: number;
  dy?: number;
  blend?: "half" | "add" | "sub";
  // S11: camera follow — the pattern slides at 1/2 or 1/4 of the
  // scenery's speed when the camera moves (depth); "full" = stuck to the
  // scenery (1:1 — ground shadows); absent = fixed on screen
  parallax?: "half" | "quarter" | "full";
  // S17: the plane's position — "front" (default) = an overlay (clouds,
  // mist); "back" = a PANORAMA behind the map, seen through the erased
  // tiles of the lower layer (RPG Maker style)
  mode?: "front" | "back";
  // S17: panorama — repeat (default true, a looping, scrolling pattern)
  // or a single fixed image (false)
  repeat?: boolean;
}

// Sidecar assets/<tileset>.json — passability + autotiles (RM2003 model).
// The engine's collision is DERIVED from these lists by datagen.
export interface TilesetMeta {
  autotiles: string[]; // 48x64 PNG paths
  solid: number[]; // logical ids X
  above: number[]; // logical ids ☆ (above the hero, walkable)
  // RM2003 chipsets: the first id of the "upper layer" section — the
  // palette then filters the tiles by layer, as RPG Maker does
  upper_start?: number;
  // T1 — CLOSED sides by grid id (key = the id as a string): bits
  // 1 down, 2 up, 4 left, 8 right (1 << the engine's DIR_*)
  dirs?: Record<string, number>;
  // T1 — animated tile sequences (the first tile is the one you lay)
  anims?: { tiles: number[]; mode: string; speed: number }[];
}

export const AUTOTILE_BASE = 1000;
export const EMPTY_TILE = -1;

export type Layer = "lower" | "upper" | "events";

export interface TextEntry {
  name: string;
  text: string;
  // filing category (Textes window — editor only, datagen ignores the
  // unknown fields of texts.json)
  cat?: string;
}

/* Composed screen (B6bis): a visual composition + a script — unrolled by
   datagen into stage commands (the engine sees nothing new). */
export interface Screen {
  backdrop: string; // stem of a picture, "" = a black background
  slots: ScreenSlot[];
  // The standing cast (H3): vignettes posed with the mouse, unrolled by
  // datagen into ordinary vig_show/vig_play/anim_play commands at the
  // head of the automatic script.
  vignettes?: ScreenVig[];
  // NAMED scripts: the FIRST runs on opening, the others are called
  // through "Appeler un script de l'écran" (unrolled inline)
  scripts: ScreenScript[];
}

export interface ScreenScript {
  name: string;
  // trigger: "auto" = when the screen opens (in order), "call" = through
  // "Appeler un script de l'écran". An auto script can carry a CONDITION
  // (switch/variable) — compiled into an if around it.
  trigger: "auto" | "call";
  cond?: ScreenCond;
  commands: Command[];
}

export interface ScreenCond {
  kind: "switch" | "var";
  n: number;
  on?: boolean; // switch
  op?: "==" | "!=" | ">="; // variable
  value?: number;
}

export interface ScreenVig {
  name: string; // free label
  slot: number; // 1-8
  vig?: string; // a vignette strip (frame 0, or looped)...
  anim?: string; // ...or an animation, played through the player
  mode: "stop" | "loop" | "once";
  speed?: number; // frames per cell when looping
  x: number;
  y: number;
}

export interface ScreenSlot {
  slot: number; // 1-5
  pic: string; // stem
  x: number; // pixels (multiples of 8)
  y: number;
  name?: string; // author's label ("gobelin gauche") — editor only
}

export interface ProjectData {
  root: string; // the project's folder on disk
  project: Project;
  scenes: Record<string, Scene>;
  texts: TextEntry[];
  // passability sidecars, by tileset stem (undo/redo like the rest)
  tilesetMeta: Record<string, TilesetMeta>;
  // composed screens (B6bis), by name — screens/<name>.json files
  screens: Record<string, Screen>;
}

export const TILE_SIZE = 16;
export const MIN_W = 20; // minimum size of a scene (one screen, like RM2003)
export const MIN_H = 15;
export const DIRECTIONS: Direction[] = ["down", "up", "left", "right"];

// 16x24 sprite sheet: RM2003 character blocks of 12 frames (4 directions
// x idle/step A/step B). An actor's sprite = a block.
// The sets are compiled PER SCENE by datagen (v0.5): the project can
// have many blocks, each scene uses 5 at most (the player included).
export const SCENE_SPRITE_BLOCKS_MAX = 5;
export const PROJECT_SPRITE_BLOCKS_MAX = 64;

// idle frame shown for an actor: block*12 + direction*3
export function actorFrame(a: Actor): number {
  return a.sprite * 12 + DIRECTIONS.indexOf(a.dir) * 3;
}

// number of blocks in the loaded sprite sheet
export function spriteBlockCount(bmp: ImageBitmap | null): number {
  return bmp ? Math.max(1, Math.ceil(bmp.width / 16 / 12)) : 1;
}

// name of a character block (project.charsets, editor only)
export function charsetName(p: Project, b: number): string {
  return p.charsets?.[b] || (b === 0 ? "Héros" : `Bloc ${b}`);
}

// character blocks used by a scene (the player = block 0 included) —
// every event with an appearance counts, whatever its trigger
export function sceneSpriteBlocks(sc: Scene): number[] {
  const used = new Set<number>([0]);
  for (const e of sc.events) {
    if (e.sprite >= 0) used.add(e.sprite);
    for (const p of e.extraPages ?? []) {
      if (p.sprite >= 0) used.add(p.sprite);
    }
  }
  return [...used].sort((x, y) => x - y);
}

// idle frame shown for a visible event
export function eventFrame(e: GameEvent): number {
  return e.sprite * 12 + DIRECTIONS.indexOf(e.dir) * 3;
}

// event at this tile (the first found), or -1
export function eventAt(sc: Scene, tx: number, ty: number): number {
  return sc.events.findIndex((e) => e.x === tx && e.y === ty);
}
