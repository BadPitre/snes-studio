// Editor tools + small pure operations on scenes.
// Since Phase 5c (the RPG Maker 2003 model): two tile layers,
// passability carried by the tileset (a sidecar), collision derived.

import type { GameEvent, Layer, Scene, TilesetMeta } from "./types";
import { AUTOTILE_BASE, EMPTY_TILE } from "./types";

// A single tool from the Events layer (A2): the tile stamp.
// Events/warps/start are laid with a right click on the Events layer.
export type Tool = { kind: "tile"; tiles: number[][] };

// Drawing mode of the stamp (RM2003 toolbar): pencil, rectangle,
// ellipse, paint bucket
export type DrawMode = "pen" | "rect" | "circle" | "fill";

// RPG Maker style stamp: the palette's block repeats as a pattern aligned
// on the first tile laid (ox,oy = the origin of the drag on the map).
export function paintStamp(
  sc: Scene,
  layer: Layer,
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
  const src = layer === "lower" ? sc.tilemap : sc.upper;
  let changed = false;
  const grid = src.map((row) => row.slice());
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = ax + dx;
      const y = ay + dy;
      if (x < 0 || y < 0 || x >= sc.width || y >= sc.height) continue;
      let v = tiles[dy][dx];
      // S10: the eraser also applies to the lower layer — EMPTY cell (black in game)
      if (grid[y][x] !== v) {
        grid[y][x] = v;
        changed = true;
      }
    }
  }
  if (!changed) return sc;
  return layer === "lower" ? { ...sc, tilemap: grid } : { ...sc, upper: grid };
}

// Applies the stamp's pattern to a list of cells (rectangle, ellipse,
// fill), pattern anchored at (ax,ay) — the same alignment rule as the
// pencil. One history entry per gesture (called on release).
export function paintCells(
  sc: Scene,
  layer: Layer,
  cells: Array<[number, number]>,
  ax: number,
  ay: number,
  tiles: number[][]
): Scene {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  if (!w) return sc;
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  const src = layer === "lower" ? sc.tilemap : sc.upper;
  let changed = false;
  const grid = src.map((row) => row.slice());
  for (const [x, y] of cells) {
    if (x < 0 || y < 0 || x >= sc.width || y >= sc.height) continue;
    let v = tiles[mod(y - ay, h)][mod(x - ax, w)];
    // S10: the eraser also applies to the lower layer — EMPTY cell (black in game)
    if (grid[y][x] !== v) {
      grid[y][x] = v;
      changed = true;
    }
  }
  if (!changed) return sc;
  return layer === "lower" ? { ...sc, tilemap: grid } : { ...sc, upper: grid };
}

// --- passability (RM2003 model) ------------------------------------------

export function isSolidId(meta: TilesetMeta, id: number): boolean {
  return meta.solid.includes(id);
}
export function isAboveId(meta: TilesetMeta, id: number): boolean {
  return meta.above.includes(id);
}

// Blocking cell? An upper tile present and not ☆ -> its passability wins
// (bridges over water); otherwise the lower layer's.
// THE SAME RULE as datagen (tileset.rs) — keep any change in step.
export function cellSolid(sc: Scene, meta: TilesetMeta, x: number, y: number): boolean {
  const u = sc.upper[y][x];
  if (u !== EMPTY_TILE && !isAboveId(meta, u)) return isSolidId(meta, u);
  return isSolidId(meta, sc.tilemap[y][x]);
}

// O -> X -> ☆ -> O cycle of a logical id in the sidecar
export function cyclePassability(meta: TilesetMeta, id: number): TilesetMeta {
  const solid = meta.solid.filter((v) => v !== id);
  const above = meta.above.filter((v) => v !== id);
  if (isSolidId(meta, id)) above.push(id); // X -> ☆
  else if (!isAboveId(meta, id)) solid.push(id); // O -> X
  // ☆ -> O: the two filtered lists are enough
  return { ...meta, solid: solid.sort((a, b) => a - b), above: above.sort((a, b) => a - b) };
}

// --- actors / warps / start -----------------------------------------------

// --- events (Events layer, Event Editor) ----------------------------------

export function addEvent(sc: Scene, ev: GameEvent): Scene {
  if (sc.events.some((e) => e.x === ev.x && e.y === ev.y)) return sc;
  return { ...sc, events: [...sc.events, ev] };
}

export function updateEvent(sc: Scene, index: number, ev: GameEvent): Scene {
  return { ...sc, events: sc.events.map((e, i) => (i === index ? ev : e)) };
}

export function removeEvent(sc: Scene, index: number): Scene {
  return { ...sc, events: sc.events.filter((_, i) => i !== index) };
}

// default name of a new event (EV001, EV002…)
export function nextEventName(sc: Scene): string {
  return `EV${String(sc.events.length + 1).padStart(3, "0")}`;
}

export function setPlayerStart(sc: Scene, tx: number, ty: number): Scene {
  return { ...sc, player_start: [tx, ty] };
}

export function placeWarp(
  sc: Scene,
  meta: TilesetMeta,
  tx: number,
  ty: number,
  defaultTo: string
): Scene {
  if (sc.warps.some((w) => w.x === tx && w.y === ty)) return sc;
  if (cellSolid(sc, meta, tx, ty)) return sc; // a warp only on a free tile
  return { ...sc, warps: [...sc.warps, { x: tx, y: ty, to: defaultTo, tx: 3, ty: 3 }] };
}

export function updateWarp(sc: Scene, index: number, patch: Partial<import("./types").Warp>): Scene {
  const warps = sc.warps.map((w, i) => (i === index ? { ...w, ...patch } : w));
  return { ...sc, warps };
}

export function removeWarp(sc: Scene, index: number): Scene {
  return { ...sc, warps: sc.warps.filter((_, i) => i !== index) };
}

// --- scenes ----------------------------------------------------------------

// New scene: grass (tile 0) + a wall border (tile 1) on the ground, the
// upper layer empty — the same convention as the demo's maps.
export function newScene(name: string, width: number, height: number): Scene {
  const border = (x: number, y: number) =>
    x === 0 || y === 0 || x === width - 1 || y === height - 1;
  const tilemap = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => (border(x, y) ? 1 : 0))
  );
  const upper = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => EMPTY_TILE)
  );
  return {
    name,
    width,
    height,
    player_start: [3, 3],
    tilemap,
    upper,
    events: [],
    script: [],
    warps: [],
  };
}

// Resize: crops or extends (free grass, empty upper layer), rebuilds the
// wall border, pushes out-of-bounds events/warps aside.
export function resizeScene(sc: Scene, width: number, height: number): Scene {
  const grid = (rows: number[][], fill: number) =>
    Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => rows[y]?.[x] ?? fill)
    );
  const tilemap = grid(sc.tilemap, 0);
  const upper = grid(sc.upper, EMPTY_TILE);
  for (let x = 0; x < width; x++) {
    tilemap[0][x] = 1;
    tilemap[height - 1][x] = 1;
  }
  for (let y = 0; y < height; y++) {
    tilemap[y][0] = 1;
    tilemap[y][width - 1] = 1;
  }
  const inside = (x: number, y: number) => x > 0 && y > 0 && x < width - 1 && y < height - 1;
  return {
    ...sc,
    width,
    height,
    tilemap,
    upper,
    player_start: [
      Math.min(sc.player_start[0], width - 2),
      Math.min(sc.player_start[1], height - 2),
    ],
    events: sc.events.filter((e) => inside(e.x, e.y)),
    warps: sc.warps.filter((w) => inside(w.x, w.y)),
  };
}

// Labels declared in a scene's script (valid targets for entry)
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

// AUTOTILE_BASE re-exported for the components (logical id = base + index)
export { AUTOTILE_BASE, EMPTY_TILE };
