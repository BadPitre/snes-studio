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

export interface Scene {
  name: string;
  width: number;
  height: number;
  player_start: [number, number];
  tilemap: number[][];
  collision: number[][];
  actors: Actor[];
  script: string[];
}

export interface TextEntry {
  name: string;
  text: string;
}

export interface ProjectData {
  root: string; // dossier du projet sur disque
  project: Project;
  scenes: Record<string, Scene>;
  texts: TextEntry[];
}

export const TILE_SIZE = 16;
export const MIN_MAP = 32; // contrainte spec v0
export const DIRECTIONS: Direction[] = ["down", "up", "left", "right"];

// index de frame dans la feuille de sprites : sprite + direction
export function actorFrame(a: Actor): number {
  return a.sprite + DIRECTIONS.indexOf(a.dir);
}
