// Palette de tileset façon RPG Maker 2003 : le tileset de la scène est
// affiché en grille verticale de 6 colonnes ; clic = tile seule, glisser =
// sélection rectangulaire utilisée comme tampon multi-tiles sur la map.
// La sélection reste visible même quand un autre outil est actif.

import { useEffect, useRef, useState } from "react";
import type { Tool } from "../state";

interface Props {
  tileset: ImageBitmap | null;
  tilesetNames: string[]; // stems, ordre = tileset_id
  current: string; // stem du tileset de la scène
  canImport: boolean;
  tool: Tool;
  onTool: (t: Tool) => void;
  onSelectTileset: (stem: string) => void;
  onImport: () => void;
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
  const { tileset, tool, onTool } = props;
  const ref = useRef<HTMLCanvasElement>(null);
  // grille source du PNG (row-major, même convention que datagen)
  const srcCols = tileset ? Math.max(1, Math.floor(tileset.width / 16)) : 1;
  const count = tileset
    ? srcCols * Math.max(1, Math.floor(tileset.height / 16))
    : 0;
  const rows = Math.max(1, Math.ceil(count / COLS));

  const [sel, setSel] = useState<Rect>({ x: 0, y: 0, w: 1, h: 1 });
  const [drag, setDrag] = useState<Rect | null>(null); // rect en cours de glisser
  const dragStart = useRef<[number, number] | null>(null);

  // nouveau tileset (changement de scène / d'assignation) : repartir sur la tile 0
  useEffect(() => {
    setSel({ x: 0, y: 0, w: 1, h: 1 });
    if (count > 0) onTool({ kind: "tile", tiles: [[0]] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileset]);

  function cellAt(e: React.PointerEvent): [number, number] {
    const rect = ref.current!.getBoundingClientRect();
    let x = Math.floor((e.clientX - rect.left) / CELL);
    let y = Math.floor((e.clientY - rect.top) / CELL);
    x = Math.max(0, Math.min(COLS - 1, x));
    y = Math.max(0, Math.min(rows - 1, y));
    if (y * COLS + x >= count) {
      // dernière rangée partielle : se recaler sur la dernière tile valide
      y = Math.floor((count - 1) / COLS);
      x = Math.min(x, (count - 1) % COLS);
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
        row.push(i < count ? i : 0); // coin de rangée partielle : herbe
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
    for (let i = 0; i < count; i++) {
      const sx = (i % srcCols) * 16;
      const sy = Math.floor(i / srcCols) * 16;
      ctx.drawImage(
        tileset,
        sx,
        sy,
        16,
        16,
        (i % COLS) * CELL,
        Math.floor(i / COLS) * CELL,
        CELL,
        CELL
      );
    }
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.strokeRect(x * CELL + 0.5, 0, 0, rows * CELL);
    }
    for (let y = 1; y < rows; y++) {
      ctx.strokeRect(0, y * CELL + 0.5, COLS * CELL, 0);
    }
    const r = drag ?? sel;
    ctx.strokeStyle = tool.kind === "tile" ? "#20c0ff" : "#7a8290";
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x * CELL + 1.5, r.y * CELL + 1.5, r.w * CELL - 3, r.h * CELL - 3);
  }, [tileset, tool, sel, drag, count, srcCols, rows]);

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
      </div>
      <div className="palette-title">Tiles</div>
      <canvas
        ref={ref}
        width={COLS * CELL}
        height={rows * CELL}
        onPointerDown={(e) => {
          if (!count) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const c = cellAt(e);
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
          className={tool.kind === "collision" && tool.solid ? "active" : ""}
          onClick={() => onTool({ kind: "collision", solid: true })}
        >
          Collision +
        </button>
        <button
          className={tool.kind === "collision" && !tool.solid ? "active" : ""}
          onClick={() => onTool({ kind: "collision", solid: false })}
        >
          Collision -
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
