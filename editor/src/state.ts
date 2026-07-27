// Outils de l'éditeur + petites opérations pures sur les scènes.
// Depuis la Phase 5c (modèle RPG Maker 2003) : deux couches de tiles,
// passabilité portée par le tileset (sidecar), collision dérivée.

import type { Actor, Layer, Scene, TilesetMeta } from "./types";
import { AUTOTILE_BASE, EMPTY_TILE } from "./types";

export type Tool =
  | { kind: "select" }
  | { kind: "tile"; tiles: number[][] } // tampon : bloc sélectionné dans la palette
  | { kind: "actor" }
  | { kind: "warp" }
  | { kind: "player_start" };

// Mode de dessin du tampon (barre d'outils RM2003) : crayon, rectangle,
// ellipse, pot de peinture
export type DrawMode = "pen" | "rect" | "circle" | "fill";

// Tampon façon RPG Maker : le bloc de la palette se répète en motif aligné
// sur la première tile posée (ox,oy = origine du drag sur la map).
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
      if (v === EMPTY_TILE && layer === "lower") v = 0; // gomme au sol = tile de base
      if (grid[y][x] !== v) {
        grid[y][x] = v;
        changed = true;
      }
    }
  }
  if (!changed) return sc;
  return layer === "lower" ? { ...sc, tilemap: grid } : { ...sc, upper: grid };
}

// Applique le motif du tampon sur une liste de cellules (rectangle, ellipse,
// remplissage), motif ancré en (ax,ay) — même règle d'alignement que le
// crayon. Une seule entrée d'historique par geste (appelé au relâchement).
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
    if (v === EMPTY_TILE && layer === "lower") v = 0; // gomme au sol = tile de base
    if (grid[y][x] !== v) {
      grid[y][x] = v;
      changed = true;
    }
  }
  if (!changed) return sc;
  return layer === "lower" ? { ...sc, tilemap: grid } : { ...sc, upper: grid };
}

// --- passabilité (modèle RM2003) -----------------------------------------

export function isSolidId(meta: TilesetMeta, id: number): boolean {
  return meta.solid.includes(id);
}
export function isAboveId(meta: TilesetMeta, id: number): boolean {
  return meta.above.includes(id);
}

// Cellule bloquante ? Tile sup présente et non-☆ → sa passabilité l'emporte
// (ponts au-dessus de l'eau) ; sinon celle de la couche inférieure.
// MÊME RÈGLE que datagen (tileset.rs) — toute évolution synchronisée.
export function cellSolid(sc: Scene, meta: TilesetMeta, x: number, y: number): boolean {
  const u = sc.upper[y][x];
  if (u !== EMPTY_TILE && !isAboveId(meta, u)) return isSolidId(meta, u);
  return isSolidId(meta, sc.tilemap[y][x]);
}

// Cycle O → X → ☆ → O d'un id logique dans le sidecar
export function cyclePassability(meta: TilesetMeta, id: number): TilesetMeta {
  const solid = meta.solid.filter((v) => v !== id);
  const above = meta.above.filter((v) => v !== id);
  if (isSolidId(meta, id)) above.push(id); // X → ☆
  else if (!isAboveId(meta, id)) solid.push(id); // O → X
  // ☆ → O : les deux listes filtrées suffisent
  return { ...meta, solid: solid.sort((a, b) => a - b), above: above.sort((a, b) => a - b) };
}

// --- acteurs / warps / départ ---------------------------------------------

export function placeActor(sc: Scene, tx: number, ty: number): Scene {
  if (sc.actors.some((a) => a.x === tx && a.y === ty)) return sc;
  // bloc de personnage 1 par défaut (0 = joueur)
  const actor: Actor = { type: "npc", x: tx, y: ty, sprite: 1, dir: "down" };
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

export function placeWarp(
  sc: Scene,
  meta: TilesetMeta,
  tx: number,
  ty: number,
  defaultTo: string
): Scene {
  if (sc.warps.some((w) => w.x === tx && w.y === ty)) return sc;
  if (cellSolid(sc, meta, tx, ty)) return sc; // warp sur tile libre uniquement
  return { ...sc, warps: [...sc.warps, { x: tx, y: ty, to: defaultTo, tx: 3, ty: 3 }] };
}

export function updateWarp(sc: Scene, index: number, patch: Partial<import("./types").Warp>): Scene {
  const warps = sc.warps.map((w, i) => (i === index ? { ...w, ...patch } : w));
  return { ...sc, warps };
}

export function removeWarp(sc: Scene, index: number): Scene {
  return { ...sc, warps: sc.warps.filter((_, i) => i !== index) };
}

// --- scènes ----------------------------------------------------------------

// Nouvelle scène : herbe (tile 0) + bordure de murs (tile 1) au sol,
// couche supérieure vide — même convention que les maps du demo.
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
    actors: [],
    script: [],
    warps: [],
  };
}

// Redimensionne : recadre ou étend (herbe libre, couche sup vide),
// reconstruit la bordure de murs, écarte acteurs/warps hors limites.
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

// AUTOTILE_BASE réexporté pour les composants (id logique = base + index)
export { AUTOTILE_BASE, EMPTY_TILE };
