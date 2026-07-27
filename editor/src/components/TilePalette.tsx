// Palette de tileset façon RPG Maker 2003 : grille verticale de 6 colonnes.
// Ordre RM2003 : gomme (couche sup), autotiles, puis tiles de la grille.
// Clic = tile seule, glisser = sélection rectangulaire (tampon multi-tiles).
// Mode « Passabilité » : les cellules affichent O/X/☆ et un clic fait
// tourner l'état de la tile (écrit dans le sidecar du tileset).

import { useEffect, useRef, useState } from "react";
import type { Layer, TilesetMeta } from "../types";
import { AUTOTILE_BASE, EMPTY_TILE } from "../types";
import type { Tool } from "../state";
import { isAboveId, isSolidId } from "../state";
import { drawAutotilePreview } from "../autotile";

interface Props {
  tileset: ImageBitmap | null;
  autotiles: ImageBitmap[];
  meta: TilesetMeta;
  tilesetNames: string[]; // stems, ordre = tileset_id
  current: string; // stem du tileset de la scène
  canImport: boolean;
  tool: Tool;
  layer: Layer;
  passMode: boolean;
  onTool: (t: Tool) => void;
  onSelectTileset: (stem: string) => void;
  onImport: () => void;
  onImportChipset: () => void;
  onPassMode: (on: boolean) => void;
  onCyclePassability: (id: number) => void;
}

const COLS = 6; // colonnes de la palette, comme RPG Maker 2003
const CELL = 32; // tile 16x16 affichée x2

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function TilePalette(props: Props) {
  const { tileset, autotiles, meta, tool, layer, passMode, onTool } = props;
  const ref = useRef<HTMLCanvasElement>(null);

  // Cellules de la palette, dans l'ordre d'affichage (ids logiques).
  const srcCols = tileset ? Math.max(1, Math.floor(tileset.width / 16)) : 1;
  const gridCount = tileset
    ? srcCols * Math.max(1, Math.floor(tileset.height / 16))
    : 0;
  const cells: number[] = [];
  if (layer === "upper" && !passMode) cells.push(EMPTY_TILE); // gomme
  // Chipset RM2003 (upper_start) : la palette filtre les tiles par couche,
  // comme RPG Maker — sauf en mode passabilité (tout est éditable)
  const us = passMode ? undefined : meta.upper_start;
  if (us === undefined || layer === "lower") {
    for (let k = 0; k < autotiles.length; k++) cells.push(AUTOTILE_BASE + k);
  }
  const t0 = us !== undefined && layer === "upper" ? Math.min(us, gridCount) : 0;
  const t1 = us !== undefined && layer === "lower" ? Math.min(us, gridCount) : gridCount;
  for (let t = t0; t < t1; t++) cells.push(t);
  const rows = Math.max(1, Math.ceil(cells.length / COLS));

  const [sel, setSel] = useState<Rect>({ x: 0, y: 0, w: 1, h: 1 });
  const [drag, setDrag] = useState<Rect | null>(null);
  const dragStart = useRef<[number, number] | null>(null);

  // nouveau tileset (changement de scène / d'assignation) : repartir sur la
  // première cellule
  useEffect(() => {
    setSel({ x: 0, y: 0, w: 1, h: 1 });
    if (gridCount > 0) onTool({ kind: "tile", tiles: [[cells[0]]] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileset, layer]);

  function cellAt(e: React.PointerEvent): [number, number] {
    const rect = ref.current!.getBoundingClientRect();
    let x = Math.floor((e.clientX - rect.left) / CELL);
    let y = Math.floor((e.clientY - rect.top) / CELL);
    x = Math.max(0, Math.min(COLS - 1, x));
    y = Math.max(0, Math.min(rows - 1, y));
    if (y * COLS + x >= cells.length) {
      // dernière rangée partielle : se recaler sur la dernière cellule
      y = Math.floor((cells.length - 1) / COLS);
      x = Math.min(x, (cells.length - 1) % COLS);
    }
    return [x, y];
  }

  function rectFrom(a: [number, number], b: [number, number]): Rect {
    const x = Math.min(a[0], b[0]);
    const y = Math.min(a[1], b[1]);
    return { x, y, w: Math.abs(a[0] - b[0]) + 1, h: Math.abs(a[1] - b[1]) + 1 };
  }

  function rectTiles(r: Rect): number[][] {
    const out: number[][] = [];
    for (let y = r.y; y < r.y + r.h; y++) {
      const row: number[] = [];
      for (let x = r.x; x < r.x + r.w; x++) {
        const i = y * COLS + x;
        row.push(i < cells.length ? cells[i] : 0);
      }
      out.push(row);
    }
    return out;
  }

  // rendu de la grille + surbrillance (drag en cours sinon sélection retenue)
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !tileset) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#16181c";
    ctx.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < cells.length; i++) {
      const id = cells[i];
      const dx = (i % COLS) * CELL;
      const dy = Math.floor(i / COLS) * CELL;
      if (id === EMPTY_TILE) {
        // gomme : damier
        ctx.fillStyle = "#2a2d33";
        ctx.fillRect(dx, dy, CELL, CELL);
        ctx.fillStyle = "#3a3e46";
        for (let cy = 0; cy < 4; cy++) {
          for (let cx = (cy & 1); cx < 4; cx += 2) {
            ctx.fillRect(dx + cx * 8, dy + cy * 8, 8, 8);
          }
        }
      } else if (id >= AUTOTILE_BASE) {
        const img = autotiles[id - AUTOTILE_BASE];
        if (img) drawAutotilePreview(ctx, img, dx, dy, CELL);
      } else {
        const sx = (id % srcCols) * 16;
        const sy = Math.floor(id / srcCols) * 16;
        ctx.drawImage(tileset, sx, sy, 16, 16, dx, dy, CELL, CELL);
      }
      if (passMode && id !== EMPTY_TILE) {
        // overlay O/X/☆ (modèle RM2003)
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(dx, dy, CELL, CELL);
        ctx.font = "bold 18px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (isSolidId(meta, id)) {
          ctx.fillStyle = "#ff5050";
          ctx.fillText("X", dx + CELL / 2, dy + CELL / 2 + 1);
        } else if (isAboveId(meta, id)) {
          ctx.fillStyle = "#ffd040";
          ctx.fillText("☆", dx + CELL / 2, dy + CELL / 2 + 1);
        } else {
          ctx.fillStyle = "#80d0ff";
          ctx.fillText("O", dx + CELL / 2, dy + CELL / 2 + 1);
        }
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) ctx.strokeRect(x * CELL + 0.5, 0, 0, rows * CELL);
    for (let y = 1; y < rows; y++) ctx.strokeRect(0, y * CELL + 0.5, COLS * CELL, 0);
    if (!passMode) {
      const r = drag ?? sel;
      ctx.strokeStyle = tool.kind === "tile" ? "#20c0ff" : "#7a8290";
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x * CELL + 1.5, r.y * CELL + 1.5, r.w * CELL - 3, r.h * CELL - 3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileset, autotiles, meta, tool, sel, drag, passMode, layer, srcCols, rows]);

  return (
    <div className="palette">
      <div className="palette-title">Tileset</div>
      <div className="palette-tileset">
        <select
          value={props.current}
          onChange={(e) => props.onSelectTileset(e.target.value)}
          title="Tileset de la scène"
        >
          {props.tilesetNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {props.canImport && (
          <button onClick={props.onImport} title="Importer un PNG de tileset dans le projet">
            Importer…
          </button>
        )}
        {props.canImport && (
          <button
            onClick={props.onImportChipset}
            title="Importer un chipset RPG Maker 2003 (PNG 480x256) : tiles, autotiles et couches découpés automatiquement"
          >
            Chipset RM2003…
          </button>
        )}
        <button
          className={passMode ? "active" : ""}
          onClick={() => props.onPassMode(!passMode)}
          title="Éditer la passabilité des tiles : O passable, X solide, ☆ au-dessus du héros"
        >
          Passabilité O/X/☆
        </button>
      </div>
      <div className="palette-title">Tiles</div>
      <canvas
        ref={ref}
        width={COLS * CELL}
        height={rows * CELL}
        onPointerDown={(e) => {
          if (!cells.length) return;
          const c = cellAt(e);
          if (passMode) {
            const id = cells[c[1] * COLS + c[0]];
            if (id !== EMPTY_TILE) props.onCyclePassability(id);
            return;
          }
          e.currentTarget.setPointerCapture(e.pointerId);
          dragStart.current = c;
          setDrag(rectFrom(c, c));
        }}
        onPointerMove={(e) => {
          if (!dragStart.current) return;
          setDrag(rectFrom(dragStart.current, cellAt(e)));
        }}
        onPointerUp={(e) => {
          if (!dragStart.current) return;
          const r = rectFrom(dragStart.current, cellAt(e));
          dragStart.current = null;
          setDrag(null);
          setSel(r);
          onTool({ kind: "tile", tiles: rectTiles(r) });
        }}
      />
      <div className="palette-title">Outils</div>
      <div className="tools">
        <button
          className={tool.kind === "select" ? "active" : ""}
          onClick={() => onTool({ kind: "select" })}
        >
          Sélection
        </button>
        <button
          className={tool.kind === "actor" ? "active" : ""}
          onClick={() => onTool({ kind: "actor" })}
        >
          + PNJ
        </button>
        <button
          className={tool.kind === "warp" ? "active" : ""}
          onClick={() => onTool({ kind: "warp" })}
        >
          + Warp
        </button>
        <button
          className={tool.kind === "player_start" ? "active" : ""}
          onClick={() => onTool({ kind: "player_start" })}
        >
          Départ joueur
        </button>
      </div>
    </div>
  );
}
