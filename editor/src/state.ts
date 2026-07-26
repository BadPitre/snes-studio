// Outils de l'éditeur + petites opérations pures sur les scènes.

import type { Actor, Scene } from "./types";

export type Tool =
  | { kind: "select" }
  | { kind: "tile"; tiles: number[][] } // tampon : bloc sélectionné dans la palette
  | { kind: "collision"; solid: boolean }
  | { kind: "actor" }
  | { kind: "warp" }
  | { kind: "player_start" };

// Tampon façon RPG Maker : le bloc de la palette se répète en motif aligné
// sur la première tile posée (ox,oy = origine du drag sur la map).
export function paintStamp(
  sc: Scene,
  cx: number,
  cy: number,
  ox: number,
  oy: number,
  tiles: number[][]
): Scene {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  if (!w) return sc;
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  const ax = cx - mod(cx - ox, w);
  const ay = cy - mod(cy - oy, h);
  let changed = false;
  const tilemap = sc.tilemap.map((row) => row.slice());
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = ax + dx;
      const y = ay + dy;
      if (x < 0 || y < 0 || x >= sc.width || y >= sc.height) continue;
      if (tilemap[y][x] !== tiles[dy][dx]) {
        tilemap[y][x] = tiles[dy][dx];
        changed = true;
      }
    }
  }
  return changed ? { ...sc, tilemap } : sc;
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
  const actor: Actor = { type: "npc", x: tx, y: ty, sprite: 8, dir: "down" };
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

// Redimensionne : recadre ou étend (herbe libre), reconstruit la bordure de
// murs sur les nouveaux bords, écarte acteurs/warps hors limites.
export function resizeScene(sc: Scene, width: number, height: number): Scene {
  const grid = (rows: number[][], fill: number) =>
    Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => rows[y]?.[x] ?? fill)
    );
  const tilemap = grid(sc.tilemap, 0);
  const collision = grid(sc.collision, 0);
  for (let x = 0; x < width; x++) {
    tilemap[0][x] = 1; collision[0][x] = 1;
    tilemap[height - 1][x] = 1; collision[height - 1][x] = 1;
  }
  for (let y = 0; y < height; y++) {
    tilemap[y][0] = 1; collision[y][0] = 1;
    tilemap[y][width - 1] = 1; collision[y][width - 1] = 1;
  }
  const inside = (x: number, y: number) => x > 0 && y > 0 && x < width - 1 && y < height - 1;
  return {
    ...sc,
    width,
    height,
    tilemap,
    collision,
    player_start: [
      Math.min(sc.player_start[0], width - 2),
      Math.min(sc.player_start[1], height - 2),
    ],
    actors: sc.actors.filter((a) => inside(a.x, a.y)),
    warps: sc.warps.filter((w) => inside(w.x, w.y)),
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
