// Outils de l'éditeur + petites opérations pures sur les scènes.

import type { Actor, Scene } from "./types";

export type Tool =
  | { kind: "select" }
  | { kind: "tile"; index: number }
  | { kind: "collision"; solid: boolean }
  | { kind: "actor" }
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
