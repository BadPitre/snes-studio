// Outils de l'éditeur + petites opérations pures sur les scènes.

import type { Actor, Scene } from "./types";

export type Tool =
  | { kind: "select" }
  | { kind: "tile"; index: number }
  | { kind: "collision"; solid: boolean }
  | { kind: "actor" }
  | { kind: "warp" }
  | { kind: "player_start" };

export function paintTile(sc: Scene, tx: number, ty: number, tile: number): Scene {
  if (sc.tilemap[ty][tx] === tile) return sc;
  const tilemap = sc.tilemap.map((row, y) =>
    y === ty ? row.map((v, x) => (x === tx ? tile : v)) : row
  );
  return { ...sc, tilemap };
}

export function paintCollision(sc: Scene, tx: number, ty: number, solid: boolean): Scene {
  const v = solid ? 1 : 0;
  if (sc.collision[ty][tx] === v) return sc;
  const collision = sc.collision.map((row, y) =>
    y === ty ? row.map((c, x) => (x === tx ? v : c)) : row
  );
  return { ...sc, collision };
}

export function placeActor(sc: Scene, tx: number, ty: number): Scene {
  if (sc.actors.some((a) => a.x === tx && a.y === ty)) return sc;
  const actor: Actor = { type: "npc", x: tx, y: ty, sprite: 4, dir: "down" };
  return { ...sc, actors: [...sc.actors, actor] };
}

export function updateActor(sc: Scene, index: number, patch: Partial<Actor>): Scene {
  const actors = sc.actors.map((a, i) => (i === index ? { ...a, ...patch } : a));
  return { ...sc, actors };
}

export function removeActor(sc: Scene, index: number): Scene {
  return { ...sc, actors: sc.actors.filter((_, i) => i !== index) };
}

export function setPlayerStart(sc: Scene, tx: number, ty: number): Scene {
  return { ...sc, player_start: [tx, ty] };
}

export function placeWarp(sc: Scene, tx: number, ty: number, defaultTo: string): Scene {
  if (sc.warps.some((w) => w.x === tx && w.y === ty)) return sc;
  if (sc.collision[ty][tx] !== 0) return sc; // warp sur tile libre uniquement
  return { ...sc, warps: [...sc.warps, { x: tx, y: ty, to: defaultTo, tx: 3, ty: 3 }] };
}

export function updateWarp(sc: Scene, index: number, patch: Partial<import("./types").Warp>): Scene {
  const warps = sc.warps.map((w, i) => (i === index ? { ...w, ...patch } : w));
  return { ...sc, warps };
}

export function removeWarp(sc: Scene, index: number): Scene {
  return { ...sc, warps: sc.warps.filter((_, i) => i !== index) };
}

// Nouvelle scène : herbe (tile 0) + bordure de murs (tile 1) solide —
// même convention que les maps du demo.
export function newScene(name: string, width: number, height: number): Scene {
  const border = (x: number, y: number) =>
    x === 0 || y === 0 || x === width - 1 || y === height - 1;
  const tilemap = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => (border(x, y) ? 1 : 0))
  );
  const collision = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => (border(x, y) ? 1 : 0))
  );
  return {
    name,
    width,
    height,
    player_start: [3, 3],
    tilemap,
    collision,
    actors: [],
    script: [],
    warps: [],
  };
}

// Labels déclarés dans le script d'une scène (cibles valides pour entry)
export function scriptLabels(script: string[]): string[] {
  const labels: string[] = [];
  for (const raw of script) {
    const line = raw.split(";")[0].trim();
    if (line.endsWith(":")) {
      const name = line.slice(0, -1).trim();
      if (name && !/\s/.test(name)) labels.push(name);
    }
  }
  return labels;
}
