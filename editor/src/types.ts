// Modèle du projet — miroir exact des structs serde de tools/datagen
// (project.rs). Toute évolution ici doit être répercutée là-bas et
// documentée dans docs/TOOLS.md.

export interface Project {
  name: string;
  boot_scene: string;
  scenes: string[];
  assets: {
    tileset: string;
    sprites: string;
    font: string;
  };
  musics?: string[]; // chemins .it, l'ordre donne les music_id
  sounds?: string[]; // chemins .wav (B1), l'ordre donne les sfx_id
  vignettes?: string[]; // bandes de frames 32x32 (B5), l'ordre = vig_id
  // animations image par image (A1) — l'ordre donne les anim_id. La
  // planche de cellules est une VIGNETTE du projet : pas de second
  // pipeline graphique, l'animation n'ajoute que la piste de frames.
  animations?: AnimationDef[];
  screens?: string[]; // écrans composés (B6bis) — fichiers screens/<nom>.json
  tilesets?: string[]; // chemins .png 16x16, l'ordre donne les tileset_id
  charsets?: string[]; // noms des blocs de personnage (éditeur seulement,
  // ignoré par datagen) — index = bloc de la feuille de sprites
  prefabs?: EventPrefab[]; // prefabs d'events (éditeur seulement)
  switches?: string[]; // noms des switches (éditeur seulement, index = n)
  variables?: string[]; // noms des variables 16-bit (éditeur seulement)
  common_events?: CommonEvent[]; // scripts globaux (v0.16, compilés par datagen)
  // Thème UI v1 (Phase 11, docs/SPEC_SYSTEME_UI.md) : windowskin 24x24
  // (9-slice, palette de la fonte), vitesse de la machine à écrire, et
  // planche d'icônes des widgets (W1 — bande Nx8, max 64)
  ui?: { windowskin?: string; text_speed?: number; icons?: string };
  windowskins?: string[]; // chemins PNG 24x24 importés via le Gestionnaire
  // de ressources (éditeur seulement, ignoré par datagen) — le thème actif
  // (ui.windowskin) pointe l'un d'eux
  iconsets?: string[]; // planches d'icônes importées (même modèle)
  fonts?: string[]; // fontes importées (S1) — assets.font est la défaut ★
  // pictures (S3) : PNG ≤ 16 couleurs, ≤ 256x224 (multiples de 8) —
  // LUES par datagen (l'ordre donne les pic_id), affichées par la
  // commande d'event « Afficher une image ». Entrée objet (S4) :
  // { path, trans: true } = image à TRANSPARENCE (le décor de la carte
  // se voit à travers les pixels percés à l'import)
  pictures?: PictureEntry[];
  // T2 — entrées tileset nommées (fenêtre Tools → Tilesets, RM2003)
  tileset_defs?: TilesetDef[];
  // presets de teinte nommés (S12b — éditeur seulement, voir TintPreset)
  tint_presets?: TintPreset[];
}

// Une cellule POSÉE (A1-e) : ce que le CALQUE affiche sur cette frame.
// cell = -1 : ce calque n'affiche rien ici — c'est ce qui donne la
// souplesse de pistes indépendantes avec une seule timeline.
export interface AnimCell {
  cell: number; // -1 = rien
  x: number; // -128..127
  y: number; // -128..127
}

// Une frame d'animation (A1) : les cellules affichées SIMULTANÉMENT (une
// par calque), la durée en frames écran, et le son joué à SON ENTRÉE.
// Miroir de AnimFrame (tools/datagen/project.rs).
export interface AnimFrame {
  cells: AnimCell[]; // une entrée par calque
  dur: number; // 1..255 frames écran
  sfx?: string; // stem d'un son du projet
  // forme HÉRITÉE mono-calque (projets d'avant les calques) — lue par
  // animFrameCells, jamais réécrite
  cell?: number;
  x?: number;
  y?: number;
}

export interface AnimationDef {
  name: string;
  vignette: string; // stem de la vignette servant de planche de cellules
  loop?: boolean;
  layers?: number; // cellules simultanées (1-4), défaut 1
  frames: AnimFrame[];
}

export const ANIM_LAYERS_MAX = 4;

// Cellules posées d'une frame, complétées à `layers` entrées (un calque
// non renseigné n'affiche rien) et forme héritée comprise.
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

// windowskins du projet — le thème actif y figure toujours (migration des
// projets d'avant le registre)
export function projectWindowskins(p: Project): string[] {
  const list = p.windowskins ?? [];
  const cur = p.ui?.windowskin;
  return cur && !list.includes(cur) ? [...list, cur] : list;
}

// planches d'icônes du projet — même règle de migration
export function projectIconsets(p: Project): string[] {
  const list = p.iconsets ?? [];
  const cur = p.ui?.icons;
  return cur && !list.includes(cur) ? [...list, cur] : list;
}

// pictures du projet (S3) — datagen lit ce registre tel quel
export function projectPictures(p: Project): PictureEntry[] {
  return p.pictures ?? [];
}

// fontes du projet : assets.font (la défaut) toujours en tête
export function projectFonts(p: Project): string[] {
  const list = p.fonts ?? [];
  return list.includes(p.assets.font)
    ? [p.assets.font, ...list.filter((f) => f !== p.assets.font)]
    : [p.assets.font, ...list];
}

// Layout uigen v1 (ui/layout.toml) — positions/tailles EN TILES
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
  frame?: boolean; // défaut : true pour variable_display, false sinon
  max?: number; // gauge/icon_row : maximum constant…
  max_var?: number; // …ou porté par une variable (exclusifs)
  icon?: number; // gauge/icon_row : 1er de 3 (pleine/demie/vide) ; icon_value : seule
  dir?: string; // gauge : "h" (défaut) | "v"
  pad?: number; // icon_value : zéros de tête (0-5)
}

// cadre par défaut d'un overlay selon son content (règle uigen W1)
export function overlayFramed(o: UiOverlay): boolean {
  return o.frame ?? o.content === "variable_display";
}
export interface UiLayout {
  message: UiWin;
  choice: UiWin;
  overlay: UiOverlay[];
}
// défauts historiques (sans fichier) — mêmes valeurs que uigen
export function defaultUiLayout(): UiLayout {
  return {
    message: { pos: [0, 20], size: [32, 8] },
    choice: { pos: [0, 20], size: [32, 8] },
    overlay: [],
  };
}

// stem d'un chemin d'asset ("assets/tileset_automne.png" -> "tileset_automne")
export function assetStem(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path;
  return base.replace(/\.[^.]+$/, "");
}

// stem d'un chemin de module ("assets/music/pollen8.it" -> "pollen8")
export function musicStem(path: string): string {
  return assetStem(path);
}

// tilesets du projet (l'ordre donne les tileset_id) — défaut : assets.tileset
export function projectTilesets(p: Project): string[] {
  return p.tilesets && p.tilesets.length > 0 ? p.tilesets : [p.assets.tileset];
}

// T2 — entrées TILESET façon RM2003 : une entrée NOMMÉE pointe un
// fichier chipset importé (Gestionnaire de ressources). Les scènes
// référencent le FICHIER (stem) — l'entrée est le visage éditeur.
export interface TilesetDef {
  name: string;
  file: string; // chemin projet du PNG ("" = pas encore assigné)
}

export function projectTilesetDefs(p: Project): TilesetDef[] {
  if (p.tileset_defs && p.tileset_defs.length) return p.tileset_defs;
  return projectTilesets(p).map((f) => ({ name: assetStem(f), file: f }));
}

export type Direction = "down" | "up" | "left" | "right";

// Types d'acteurs (déclencheurs RM2003, v0.6) : npc = PNJ visible (parle
// avec A), trigger = script au contact (marcher sur la tile), auto =
// script au chargement de la scène. trigger/auto : invisibles, sans sprite.
// HÉRITAGE : les vieux fichiers de scènes portent des "actors" — convertis
// en ÉVÉNEMENTS au chargement (io.ts), sauvegardés en events.
export type ActorKind = "npc" | "trigger" | "auto";

export interface Actor {
  type: ActorKind;
  x: number;
  y: number;
  sprite: number;
  // T4 — apparence TILE (id de grille de la couche haute du tileset de
  // la scène) : exclusif avec sprite (datagen compose un bloc virtuel)
  tile?: number;
  dir: Direction;
  entry?: string;
}

// ---- Événements (Event Editor, modèle RM2003) -----------------------------
// Un event = position + déclencheur + apparence + COMMANDES structurées,
// compilées par datagen vers la VM (acteur + bytecode). Voir docs/TOOLS.md.

export type EventTrigger = "action" | "touch" | "auto";

export type Command =
  | { c: "msg"; text: string; text_ref?: string; style?: string } // text_ref : entrée du catalogue Tools > Textes (prioritaire sur text) ; style : boîte S1 (absent = défaut)
  | { c: "choice"; var?: string; style?: string; options: { text: string; do: Command[] }[] }
  | { c: "set"; var: string; value: number }
  | { c: "add"; var: string; value: number }
  | { c: "if"; var: string; op: "==" | "!=" | ">="; value: number; then: Command[]; else: Command[] }
  | { c: "warp"; to: string; x: number; y: number; trans?: ScreenTrans }
  | { c: "face"; event: number; dir: Direction }
  // v0.9 — switches (512) et variables 16-bit (256), façon RM2003.
  // set/add/if sur v/g 8-bit restent lisibles (héritage) mais la fenêtre
  // de commandes ne propose plus que les versions modernes.
  | { c: "switch"; n: number; on: boolean }
  | { c: "if_sw"; n: number; on: boolean; then: Command[]; else: Command[] }
  | { c: "if_var"; n: number; op: "==" | "!=" | ">="; value: number; then: Command[]; else: Command[] }
  // v0.12 — Move Route (cinématiques) : itinéraire en tâche de fond,
  // attente de fin, pause bloquante
  | { c: "route"; event: number; repeat: boolean; skip: boolean; freq?: number; steps: RouteStep[] }
  | { c: "wait_route" }
  | { c: "wait"; frames: number }
  // v0.13 — opérations avancées, timer, caméra scriptée
  | { c: "var"; n: number; op: VarOp; from?: VarSource; value: number }
  | { c: "timer"; op: "start" | "stop" | "show" | "hide"; secs?: number }
  | { c: "campan"; x: number; y: number; speed: number }
  | { c: "cam_return"; speed: number }
  | { c: "wait_cam" }
  // v0.15 — boucles RM2003 et commentaires (datagen pur : loop = label +
  // JMP, break = JMP fin de boucle, rem = rien)
  | { c: "loop"; do: Command[] }
  | { c: "break" }
  | { c: "rem"; text: string }
  // v0.15 — positions scriptées : mémoriser la position du héros dans 3
  // variables (scène/X/Y), la rappeler (téléport), placer/échanger des
  // events. event/a/b : -1 = cet event, sinon n° d'ENTRÉE de la scène.
  | { c: "hero_loc"; vs: number; vx: number; vy: number }
  | { c: "warp_var"; vs: number; vx: number; vy: number; trans?: ScreenTrans }
  | { c: "setpos"; event: number; from: "const" | "vars"; x: number; y: number }
  | { c: "swappos"; a: number; b: number }
  // v0.15 — effets d'écran (module screenfx) : fondu bloquant, teinte
  // persistante (décor seulement — hardware), flash et secousse non
  // bloquants (enchaîner avec « Attendre »)
  // Phase 12 — Key Input Processing (RM2003) : code de la touche dans
  // une variable (1 bas, 2 gauche, 3 droite, 4 haut, 5 A, 6 B, 7 Y,
  // 8 X, 9 L, 10 R, 11 Select, 12 Start ; 0 = aucune)
  | { c: "key_input"; var: number; wait: boolean; keys: number[] }
  | { c: "sysmenu" } // menu Système (le mapping START en dur est retiré)
  // S3 — pictures plein écran (façon RM2003) : l'image recouvre le jeu
  // (BG3 reste : les dialogues se jouent DESSUS), pic = stem du registre
  // project.pictures ; pic_hide referme et restaure la scène intacte
  // x/y : position écran en pixels (absents = centré) — S5. S7 :
  // pic_var = numéro d'image lu dans une variable (remplace pic),
  // x_var/y_var = position lue dans des variables, dur = frames de
  // fondu/glissement (0 = instantané, défaut 16) ; fade: false =
  // héritage S5 (équivaut à dur 0). pic_move glisse l'image affichée
  // vers la cible en dur frames, SANS bloquer le script.
  // blend (S8) : mélange color math avec le décor — half = semi-
  // transparent (50 %), add = additif (lueur), sub = soustractif
  // (ombre). Absent = image opaque. pic_var reste accepté par datagen
  // mais n'est plus exposé dans le formulaire (une image à la fois).
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
  // S18d : frames = durée (1-255) ; speed = héritage (1-15 niveaux de
  // luminosité par frame, converti par datagen si frames absent)
  | { c: "scr_hide"; frames?: number; speed?: number; trans?: ScreenTrans }
  | { c: "scr_show"; frames?: number; speed?: number; trans?: ScreenTrans }
  // dur (S12) : frames de transition GRADUELLE (jour/nuit) — absent ou
  // 0 = teinte immédiate (bytecode TINT inchangé)
  | { c: "tint"; mode: "off" | "add" | "sub"; r: number; g: number; b: number; dur?: number }
  // Météo en particules (S13, façon Weather Effects RM2003) : persiste
  // entre les scènes jusqu'au prochain changement
  | { c: "weather"; kind: "off" | "rain" | "snow"; power?: number }
  // Ondulation de l'écran (S14, HDMA) : power 0 = stop, persiste
  | { c: "screen"; name: string; dur?: number; trans?: ScreenTrans }
  | { c: "screen_call"; script: string }
  | { c: "stage_open"; pic: string; dur?: number; trans?: ScreenTrans }
  | { c: "stage_pose"; slot: number; pic: string; x: number; y: number }
  | { c: "stage_clear"; slot: number }
  | { c: "slot_fx"; slot: number; fx: "restore" | "flash" | "fadeout" | "dark"; frames?: number }
  | { c: "stage_close"; dur?: number; trans?: ScreenTrans }
  | { c: "vig_show"; slot: number; vig: string; x: number; y: number; anchor: "screen" | "hero" }
  | { c: "vig_play"; slot: number; mode: "loop" | "once" | "stop"; speed?: number }
  | { c: "vig_hide"; slot: number }
  // A1 — animations image par image. anchor "event" + event = -1 pour
  // « cet event ». wait : bloque le script jusqu'à la fin (jamais pour
  // une animation en boucle, qui ne finit pas).
  | { c: "anim_play"; anim: string; anchor: "screen" | "hero" | "event"; event?: number; wait?: boolean }
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
  // v0.16 — appel d'un common event (CALL/RET, pile de 8 niveaux)
  | { c: "call"; n: number }
  // F1 — appel d'une FONCTION : un argument par paramètre déclaré ;
  // dst range la valeur rendue dans une variable (sucre pour l'appel
  // suivi d'une affectation depuis la source « ret »).
  | { c: "call_fn"; n: number; args: ValueSrc[]; dst?: number }
  | { c: "ret_fn"; from?: VarSource; value: number }
  // v0.17 — lire un champ de la Database dans une variable 16-bit.
  // entry : id symbolique (from const) ou n° de variable (from var)
  | { c: "db_read"; table: string; from?: "const" | "var"; entry: string | number; field: string; dst: number };

// Common event (v0.16, modèle RM2003 Database → Common Events) : script
// global au projet — appelable ({"c":"call"}), Autorun (relancé tant que
// son switch est ON, gèle le joueur) ou Parallel process (tourne en
// tâche de fond sans geler le joueur ; messages/choix interdits). Le
// switch de condition est requis pour auto ET parallel.
export interface CommonEvent {
  name: string;
  trigger: "none" | "auto" | "parallel";
  switch?: number; // condition optionnelle (absente = toujours actif)
  // F1 — un common event qui déclare des PARAMÈTRES est une FONCTION :
  // il s'appelle avec « Appeler une fonction » (arguments fournis à
  // l'appel), et son corps lit ses entrées avec la source « Paramètre ».
  // Les noms ne servent qu'ici ; le moteur ne connaît que des index.
  params?: string[];
  returns?: boolean; // rend une valeur (commande « Retourner »)
  commands: Command[];
}

// Signature d'un common event, telle que les formulaires en ont besoin
// pour proposer les bons champs (nombre d'arguments, valeur de retour).
export interface FnSig {
  name: string;
  params: string[];
  returns: boolean;
}

export type VarOp = "=" | "+" | "-" | "*" | "/" | "%" | "rand";
// F1 : "param" = paramètre n de la fonction en cours (corps d'une
// fonction uniquement), "ret" = valeur rendue par le dernier appel.
export type VarSource =
  | "const" | "var" | "hero_x" | "hero_y" | "timer" | "scene"
  | "param" | "ret";

// Une valeur d'entrée, partout pareille : source + nombre. Le nombre est
// une constante, un n° de variable ou un n° de paramètre selon la source.
export interface ValueSrc {
  from?: VarSource; // absent = constante
  value: number;
}

// Un pas d'itinéraire (v0.13, dialogue Move Route complet).
// wait : n × 8 frames (1-15) ; swon/swoff : n = switch ; gfx : block projet.
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

// Condition d'activation d'une page (v0.10) : switch ON/OFF ou var >= min
export type PageCondition =
  | { switch: number; on: boolean }
  | { var: number; min: number };

// Page supplémentaire d'un event (v0.10). Les champs plats de GameEvent
// SONT la page 1 — extraPages porte les pages 2+ (la DERNIÈRE page dont
// la condition passe est active en jeu, modèle RM2003).
export type MoveType = "static" | "random" | "vertical" | "horizontal" | "custom";
export type EventPriority = "below" | "same" | "above";

// Route custom d'une page (type de mouvement « custom », v0.14)
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
  // T4 — apparence TILE (id de grille de la couche haute du tileset de
  // la scène) : exclusif avec sprite (datagen compose un bloc virtuel)
  tile?: number;
  dir: Direction;
  entry?: string;
  commands: Command[];
  move?: MoveType; // v0.11 — PNJ mobiles (défaut : static)
  move_route?: PageRoute; // v0.14 — requis si move == "custom"
  priority?: EventPriority; // v0.14 — défaut "same"
  speed?: number; // v0.14 — 1-4 (défaut 1)
}

export interface GameEvent {
  name: string;
  x: number;
  y: number;
  trigger: EventTrigger;
  sprite: number;
  // T4 — apparence TILE (id de grille de la couche haute du tileset de
  // la scène) : exclusif avec sprite (datagen compose un bloc virtuel)
  tile?: number;
  dir: Direction;
  entry?: string; // label d'un script écrit à la main (avancé)
  commands: Command[];
  condition?: PageCondition; // condition de la page 1 (rare mais permise)
  extraPages?: EventPage[]; // pages 2+ (v0.10)
  move?: MoveType; // v0.11 — type de mouvement de la page 1
  move_route?: PageRoute; // v0.14
  priority?: EventPriority; // v0.14
  speed?: number; // v0.14
}

// Prefab : un event réutilisable, sans position (project.json "prefabs").
// v0.16 : une catégorie libre pour ranger la bibliothèque (« PNJ »,
// « Coffres », … — absente = « Sans catégorie »).
export interface EventPrefab {
  name: string;
  category?: string;
  event: Omit<GameEvent, "x" | "y">;
}

// conversion des vieux acteurs (io.ts)
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
  to: string; // scène cible
  tx: number;
  ty: number;
  dir?: Direction; // v0.16 — direction du héros à l'arrivée (absente =
  // conservée, « Retain » RM2003) — WarpDef.flags côté moteur
  trans?: ScreenTrans; // S18 — transition (absente = fondu)
}

// Transition d'écran (S18) : fondu (défaut), instantané, mosaïque,
// balayages (S18b — rideau noir ligne à ligne)
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

export interface Scene {
  name: string;
  width: number;
  height: number;
  player_start: [number, number];
  // ids logiques : 0.. = tile de la grille, AUTOTILE_BASE+k = autotile k
  tilemap: number[][]; // couche inférieure
  upper: number[][]; // couche supérieure, EMPTY_TILE = vide
  events: GameEvent[]; // la couche Événements (les vieux actors y migrent)
  script: string[];
  warps: Warp[];
  music?: string; // stem d'un module de project.musics — absent = silence
  tileset?: string; // stem d'un tileset de project.tilesets — absent = le premier
  // scène parente dans l'arborescence de l'éditeur (organisationnel
  // uniquement — ignoré par datagen)
  parent?: string;
  // Couche d'effet (S9) : motif dérivant (nuages, brume) porté par le
  // plan de la couche sup — qui est donc DÉSACTIVÉE dans cette scène.
  // pic = stem d'une image à TRANSPARENCE de project.pictures ;
  // dx/dy en px par seconde ; blend = mélange color math en jeu.
  effect?: SceneEffect;
}

// Presets de teinte du projet (S12b) : créés/nommés/supprimés depuis la
// commande « Teinter l'écran » — stockés dans project.json (éditeur
// seulement, ignorés par datagen)
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
  // S11 : suivi caméra — le motif glisse à ½ ou ¼ de la vitesse du
  // décor quand la caméra bouge (profondeur) ; "full" = collé au décor
  // (1:1 — ombres au sol) ; absent = fixe à l'écran
  parallax?: "half" | "quarter" | "full";
  // S17 : position du plan — "front" (défaut) = surimpression (nuages,
  // brume) ; "back" = PANORAMA derrière la carte, vu par les tuiles
  // gommées de la couche basse (façon RPG Maker)
  mode?: "front" | "back";
  // S17 : panorama — répéter (défaut true, motif qui boucle et défile)
  // ou image fixe unique (false)
  repeat?: boolean;
}

// Sidecar assets/<tileset>.json — passabilité + autotiles (modèle RM2003).
// La collision moteur est DÉRIVÉE de ces listes par datagen.
export interface TilesetMeta {
  autotiles: string[]; // chemins PNG 48x64
  solid: number[]; // ids logiques X
  above: number[]; // ids logiques ☆ (au-dessus du héros, passables)
  // Chipsets RM2003 : premier id de la section « couche haute » — la
  // palette filtre alors les tiles par couche, comme RPG Maker
  upper_start?: number;
  // T1 — côtés FERMÉS par id de grille (clé = id en chaîne) : bits
  // 1 bas, 2 haut, 4 gauche, 8 droite (1 << DIR_* du moteur)
  dirs?: Record<string, number>;
  // T1 — séquences de tiles animées (la première tile est celle posée)
  anims?: { tiles: number[]; mode: string; speed: number }[];
}

export const AUTOTILE_BASE = 1000;
export const EMPTY_TILE = -1;

export type Layer = "lower" | "upper" | "events";

export interface TextEntry {
  name: string;
  text: string;
  // catégorie de rangement (fenêtre Textes — éditeur seulement, datagen
  // ignore les champs inconnus de texts.json)
  cat?: string;
}

/* Écran composé (B6bis) : composition visuelle + script — déroulé par
   datagen en commandes stage (le moteur ne voit rien de nouveau). */
export interface Screen {
  backdrop: string; // stem d'une picture, "" = fond noir
  slots: ScreenSlot[];
  // scripts NOMMÉS : le PREMIER est lancé à l'ouverture, les autres
  // s'appellent via « Appeler un script de l'écran » (déroulés inline)
  scripts: ScreenScript[];
}

export interface ScreenScript {
  name: string;
  // déclenchement : "auto" = à l'ouverture de l'écran (dans l'ordre),
  // "call" = par « Appeler un script de l'écran ». Un script auto peut
  // porter une CONDITION (switch/variable) — compilée en if autour.
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

export interface ScreenSlot {
  slot: number; // 1-5
  pic: string; // stem
  x: number; // pixels (multiples de 8)
  y: number;
  name?: string; // libellé d'auteur (« gobelin gauche ») — éditeur seul
}

export interface ProjectData {
  root: string; // dossier du projet sur disque
  project: Project;
  scenes: Record<string, Scene>;
  texts: TextEntry[];
  // sidecars de passabilité, par stem de tileset (undo/redo comme le reste)
  tilesetMeta: Record<string, TilesetMeta>;
  // écrans composés (B6bis), par nom — fichiers screens/<nom>.json
  screens: Record<string, Screen>;
}

export const TILE_SIZE = 16;
export const MIN_W = 20; // taille minimum d'une scène (un écran, comme RM2003)
export const MIN_H = 15;
export const DIRECTIONS: Direction[] = ["down", "up", "left", "right"];

// Feuille de sprites 16x24 (Phase 6) : blocs de personnage RM2003 de
// 12 frames (4 directions × repos/pas A/pas B). sprite d'un acteur = bloc.
// Les sets sont compilés PAR SCÈNE par datagen (v0.5) : le projet peut
// avoir beaucoup de blocs, chaque scène en utilise 5 max (joueur inclus).
export const SCENE_SPRITE_BLOCKS_MAX = 5;
export const PROJECT_SPRITE_BLOCKS_MAX = 64;

// frame de repos affichée pour un acteur : bloc*12 + direction*3
export function actorFrame(a: Actor): number {
  return a.sprite * 12 + DIRECTIONS.indexOf(a.dir) * 3;
}

// nombre de blocs de la feuille de sprites chargée
export function spriteBlockCount(bmp: ImageBitmap | null): number {
  return bmp ? Math.max(1, Math.ceil(bmp.width / 16 / 12)) : 1;
}

// nom d'un bloc de personnage (project.charsets, éditeur seulement)
export function charsetName(p: Project, b: number): string {
  return p.charsets?.[b] || (b === 0 ? "Héros" : `Bloc ${b}`);
}

// blocs de personnage utilisés par une scène (joueur = bloc 0 inclus) —
// tout event avec une apparence compte, quel que soit son déclencheur
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

// frame de repos affichée pour un event visible
export function eventFrame(e: GameEvent): number {
  return e.sprite * 12 + DIRECTIONS.indexOf(e.dir) * 3;
}

// événement à cette tile (le premier trouvé), ou -1
export function eventAt(sc: Scene, tx: number, ty: number): number {
  return sc.events.findIndex((e) => e.x === tx && e.y === ty);
}
