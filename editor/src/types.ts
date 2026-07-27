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
  tilesets?: string[]; // chemins .png 16x16, l'ordre donne les tileset_id
  charsets?: string[]; // noms des blocs de personnage (éditeur seulement,
  // ignoré par datagen) — index = bloc de la feuille de sprites
  prefabs?: EventPrefab[]; // prefabs d'events (éditeur seulement)
  switches?: string[]; // noms des switches (éditeur seulement, index = n)
  variables?: string[]; // noms des variables 16-bit (éditeur seulement)
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
  dir: Direction;
  entry?: string;
}

// ---- Événements (Event Editor, modèle RM2003) -----------------------------
// Un event = position + déclencheur + apparence + COMMANDES structurées,
// compilées par datagen vers la VM (acteur + bytecode). Voir docs/TOOLS.md.

export type EventTrigger = "action" | "touch" | "auto";

export type Command =
  | { c: "msg"; text: string }
  | { c: "choice"; var?: string; options: { text: string; do: Command[] }[] }
  | { c: "set"; var: string; value: number }
  | { c: "add"; var: string; value: number }
  | { c: "if"; var: string; op: "==" | "!=" | ">="; value: number; then: Command[]; else: Command[] }
  | { c: "warp"; to: string; x: number; y: number }
  | { c: "face"; event: number; dir: Direction }
  // v0.9 — switches (512) et variables 16-bit (256), façon RM2003.
  // set/add/if sur v/g 8-bit restent lisibles (héritage) mais la fenêtre
  // de commandes ne propose plus que les versions modernes.
  | { c: "switch"; n: number; on: boolean }
  | { c: "if_sw"; n: number; on: boolean; then: Command[]; else: Command[] }
  | { c: "if_var"; n: number; op: "==" | "!=" | ">="; value: number; then: Command[]; else: Command[] }
  // v0.12 — Move Route (cinématiques) : itinéraire en tâche de fond,
  // attente de fin, pause bloquante
  | { c: "route"; event: number; repeat: boolean; skip: boolean; steps: RouteStep[] }
  | { c: "wait_route" }
  | { c: "wait"; frames: number }
  // v0.13 — opérations avancées, timer, caméra scriptée
  | { c: "var"; n: number; op: VarOp; from?: VarSource; value: number }
  | { c: "timer"; op: "start" | "stop" | "show" | "hide"; secs?: number }
  | { c: "campan"; x: number; y: number; speed: number }
  | { c: "cam_return"; speed: number }
  | { c: "wait_cam" };

export type VarOp = "=" | "+" | "-" | "*" | "/" | "%" | "rand";
export type VarSource = "const" | "var" | "hero_x" | "hero_y" | "timer";

// Un pas d'itinéraire. wait : n × 8 frames (1-15).
export type RouteStep =
  | { s: "down" | "up" | "left" | "right" | "tdown" | "tup" | "tleft" | "tright" | "fwd" | "face" }
  | { s: "wait"; n: number };

export const ROUTE_STEP_LABELS: Record<string, string> = {
  down: "Marcher bas",
  up: "Marcher haut",
  left: "Marcher gauche",
  right: "Marcher droite",
  tdown: "Tourner bas",
  tup: "Tourner haut",
  tleft: "Tourner gauche",
  tright: "Tourner droite",
  fwd: "Un pas en avant",
  face: "Vers le héros",
  wait: "Attendre",
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
export type MoveType = "static" | "random" | "vertical" | "horizontal";

export interface EventPage {
  condition?: PageCondition;
  trigger: EventTrigger;
  sprite: number;
  dir: Direction;
  entry?: string;
  commands: Command[];
  move?: MoveType; // v0.11 — PNJ mobiles (défaut : static)
}

export interface GameEvent {
  name: string;
  x: number;
  y: number;
  trigger: EventTrigger;
  sprite: number; // bloc de personnage ; -1 = invisible
  dir: Direction;
  entry?: string; // label d'un script écrit à la main (avancé)
  commands: Command[];
  condition?: PageCondition; // condition de la page 1 (rare mais permise)
  extraPages?: EventPage[]; // pages 2+ (v0.10)
  move?: MoveType; // v0.11 — type de mouvement de la page 1
}

// Prefab : un event réutilisable, sans position (project.json "prefabs")
export interface EventPrefab {
  name: string;
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
}

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
}

export const AUTOTILE_BASE = 1000;
export const EMPTY_TILE = -1;

export type Layer = "lower" | "upper" | "events";

export interface TextEntry {
  name: string;
  text: string;
}

export interface ProjectData {
  root: string; // dossier du projet sur disque
  project: Project;
  scenes: Record<string, Scene>;
  texts: TextEntry[];
  // sidecars de passabilité, par stem de tileset (undo/redo comme le reste)
  tilesetMeta: Record<string, TilesetMeta>;
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
