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

export interface Actor {
  type: "npc";
  x: number;
  y: number;
  sprite: number;
  dir: Direction;
  entry?: string;
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
  actors: Actor[];
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

export type Layer = "lower" | "upper";

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
export const SPRITE_BLOCKS_MAX = 5; // 5 blocs × 12 frames = 60 ≤ 64 frames OBJ

// frame de repos affichée pour un acteur : bloc*12 + direction*3
export function actorFrame(a: Actor): number {
  return a.sprite * 12 + DIRECTIONS.indexOf(a.dir) * 3;
}
