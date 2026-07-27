// Canvas de la map : rendu des deux couches (autotiles recalculés en
// direct, style RPG Maker 2003) + calque d'interaction séparé (survol
// encadré, aperçu rectangle/ellipse, sélection pipette) pour ne pas
// redessiner la map à chaque mouvement de souris.
//
// Souris (comme RM2003) : clic gauche = dessin selon le mode (crayon,
// rectangle, ellipse, pot de peinture) ; clic droit = pipette — un clic
// prend la tile sous le curseur, un glisser copie un bloc de la map dans
// le tampon.

import { useEffect, useRef, useState } from "react";
import type { Layer, Scene, TilesetMeta } from "../types";
import { AUTOTILE_BASE, EMPTY_TILE, actorFrame } from "../types";
import type { DrawMode, Tool } from "../state";
import { cellSolid } from "../state";
import { drawAutotileCell } from "../autotile";

// curseurs façon RM2003 : crayon (dessin) et pot de peinture
const CUR_PEN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='17' height='17'%3E%3Cpath d='M1 16l2.2-5.8L12 1.4 15.6 5 6.8 13.8z' fill='%23ffd75e' stroke='%23222'/%3E%3Cpath d='M1 16l2.2-5.8 3.6 3.6z' fill='%23f0b060' stroke='%23222'/%3E%3C/svg%3E\") 0 16, crosshair";
const CUR_FILL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18'%3E%3Cpath d='M4 9l6-6 6 6-6 6z' fill='%2380b0ff' stroke='%23222'/%3E%3Cpath d='M3 12q-2 3 0 4t3-1q1-2-1-4z' fill='%234a90e2' stroke='%23222'/%3E%3C/svg%3E\") 9 16, crosshair";

interface Props {
  scene: Scene;
  tileset: ImageBitmap | null;
  autotiles: ImageBitmap[];
  meta: TilesetMeta;
  sprites: ImageBitmap | null;
  tool: Tool;
  layer: Layer;
  drawMode: DrawMode;
  // taille d'une tile à l'écran, en px (zoom : 32 = 1/1 … 4 = 1/8)
  ts: number;
  showCollision: boolean;
  showGrid: boolean;
  // crayon / outils ponctuels — first = début de geste (1 entrée d'historique)
  onPaint: (tx: number, ty: number, ox: number, oy: number, first: boolean) => void;
  // rectangle / ellipse / remplissage — motif ancré en (ax,ay)
  onApplyPattern: (cells: Array<[number, number]>, ax: number, ay: number) => void;
  // pipette (clic droit) : bloc copié depuis la couche active
  onPickBlock: (tiles: number[][]) => void;
  // position du curseur en tiles (null = hors de la map)
  onHover: (pos: [number, number] | null) => void;
  onSelectActor: (index: number) => void;
}

type Cell = [number, number];

export default function MapCanvas(props: Props) {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const origin = useRef<Cell>([0, 0]);
  const [hover, setHover] = useState<Cell | null>(null);
  const [shapeDrag, setShapeDrag] = useState<{ start: Cell; cur: Cell } | null>(null);
  const [pickDrag, setPickDrag] = useState<{ start: Cell; cur: Cell } | null>(null);

  const { scene, tileset, autotiles, meta, sprites, layer, drawMode, showCollision, showGrid } =
    props;
  const TS = props.ts;
  const activeGrid = layer === "lower" ? scene.tilemap : scene.upper;

  // --- rendu de la map (couches + overlays statiques) ---------------------
  useEffect(() => {
    const cv = baseRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (!tileset) return;

    const perRow = Math.max(1, Math.floor(tileset.width / 16));
    const drawCell = (grid: number[][], x: number, y: number) => {
      const t = grid[y][x];
      if (t === EMPTY_TILE) return;
      if (t >= AUTOTILE_BASE) {
        const img = autotiles[t - AUTOTILE_BASE];
        if (!img) return;
        const same = (ox: number, oy: number) => {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= scene.width || ny >= scene.height) return true;
          return grid[ny][nx] === t;
        };
        drawAutotileCell(ctx, img, x * TS, y * TS, TS, same);
        return;
      }
      const sx = (t % perRow) * 16;
      const sy = Math.floor(t / perRow) * 16;
      ctx.drawImage(tileset, sx, sy, 16, 16, x * TS, y * TS, TS, TS);
    };

    const drawLayer = (grid: number[][], dim: boolean) => {
      ctx.globalAlpha = dim ? 0.4 : 1;
      for (let y = 0; y < scene.height; y++) {
        for (let x = 0; x < scene.width; x++) {
          drawCell(grid, x, y);
        }
      }
      ctx.globalAlpha = 1;
    };

    // couche inf puis sup — la couche non éditée est atténuée (repère RM2003)
    drawLayer(scene.tilemap, layer === "upper");
    drawLayer(scene.upper, layer === "lower");

    // collision dérivée de la passabilité du tileset (lecture seule)
    if (showCollision) {
      ctx.fillStyle = "rgba(255,40,40,0.35)";
      for (let y = 0; y < scene.height; y++) {
        for (let x = 0; x < scene.width; x++) {
          if (cellSolid(scene, meta, x, y)) ctx.fillRect(x * TS, y * TS, TS, TS);
        }
      }
    }

    // grille
    if (showGrid) {
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= scene.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TS + 0.5, 0);
        ctx.lineTo(x * TS + 0.5, scene.height * TS);
        ctx.stroke();
      }
      for (let y = 0; y <= scene.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TS + 0.5);
        ctx.lineTo(scene.width * TS, y * TS + 0.5);
        ctx.stroke();
      }
    }

    // warps (violet, "W")
    ctx.font = `${Math.max(6, TS - 10)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const w of scene.warps) {
      ctx.fillStyle = "rgba(160,70,255,0.35)";
      ctx.fillRect(w.x * TS, w.y * TS, TS, TS);
      ctx.strokeStyle = "#b060ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(w.x * TS + 1, w.y * TS + 1, TS - 2, TS - 2);
      ctx.fillStyle = "#e8d0ff";
      ctx.fillText("W", w.x * TS + TS / 2, w.y * TS + TS / 2 + 1);
    }

    // départ joueur
    ctx.strokeStyle = "#20c0ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      scene.player_start[0] * TS + 1,
      scene.player_start[1] * TS + 1,
      TS - 2,
      TS - 2
    );

    // acteurs — PNJ = sprite ; déclencheurs invisibles en jeu = marqueurs
    // éditeur (orange "C" contact, cyan "A" auto, comme les warps "W")
    for (const a of scene.actors) {
      if (a.type !== "npc") {
        const auto = a.type === "auto";
        ctx.fillStyle = auto ? "rgba(60,190,210,0.35)" : "rgba(255,150,40,0.35)";
        ctx.fillRect(a.x * TS, a.y * TS, TS, TS);
        ctx.strokeStyle = auto ? "#40c8e0" : "#ff9628";
        ctx.lineWidth = 2;
        ctx.strokeRect(a.x * TS + 1, a.y * TS + 1, TS - 2, TS - 2);
        ctx.fillStyle = auto ? "#d8f4fa" : "#ffe8c8";
        ctx.fillText(auto ? "A" : "C", a.x * TS + TS / 2, a.y * TS + TS / 2 + 1);
        continue;
      }
      if (sprites) {
        // frame 16x24 ancrée en bas de la tile (la tête dépasse de 8 px
        // au-dessus, façon RM2003)
        const f = actorFrame(a);
        ctx.drawImage(
          sprites, f * 16, 0, 16, 24,
          a.x * TS, a.y * TS - TS / 2, TS, TS + TS / 2
        );
      }
      ctx.strokeStyle = "#ffe020";
      ctx.lineWidth = 2;
      ctx.strokeRect(a.x * TS + 1, a.y * TS + 1, TS - 2, TS - 2);
    }
  }, [scene, tileset, autotiles, meta, sprites, layer, showCollision, showGrid, TS]);

  // --- calque d'interaction : survol encadré + aperçus --------------------
  useEffect(() => {
    const cv = overlayRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);

    // cadre double (blanc sur noir) lisible sur tout décor — façon RM2003
    const frame = (x: number, y: number, w: number, h: number) => {
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = 4;
      ctx.strokeRect(x * TS + 2, y * TS + 2, w * TS - 4, h * TS - 4);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(x * TS + 2, y * TS + 2, w * TS - 4, h * TS - 4);
    };

    if (pickDrag) {
      // sélection pipette : cadre jaune pointillé
      const x = Math.min(pickDrag.start[0], pickDrag.cur[0]);
      const y = Math.min(pickDrag.start[1], pickDrag.cur[1]);
      const w = Math.abs(pickDrag.start[0] - pickDrag.cur[0]) + 1;
      const h = Math.abs(pickDrag.start[1] - pickDrag.cur[1]) + 1;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#ffe020";
      ctx.lineWidth = 2;
      ctx.strokeRect(x * TS + 1, y * TS + 1, w * TS - 2, h * TS - 2);
      ctx.setLineDash([]);
      return;
    }

    if (shapeDrag && props.tool.kind === "tile") {
      const [x0, y0] = shapeDrag.start;
      const [x1, y1] = shapeDrag.cur;
      const x = Math.min(x0, x1);
      const y = Math.min(y0, y1);
      const w = Math.abs(x1 - x0) + 1;
      const h = Math.abs(y1 - y0) + 1;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      if (drawMode === "circle") {
        ctx.beginPath();
        ctx.ellipse(
          (x + w / 2) * TS,
          (y + h / 2) * TS,
          (w / 2) * TS,
          (h / 2) * TS,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillRect(x * TS, y * TS, w * TS, h * TS);
        frame(x, y, w, h);
      }
      return;
    }

    if (hover) {
      // cadre de survol à la taille du tampon (1x1 pour les autres outils)
      let w = 1;
      let h = 1;
      if (props.tool.kind === "tile" && drawMode !== "fill") {
        h = props.tool.tiles.length;
        w = props.tool.tiles[0]?.length ?? 1;
      }
      frame(hover[0], hover[1], w, h);
    }
  }, [hover, shapeDrag, pickDrag, props.tool, drawMode, scene.width, scene.height, TS]);

  function tileAt(e: React.MouseEvent): Cell {
    const rect = overlayRef.current!.getBoundingClientRect();
    const tx = Math.floor((e.clientX - rect.left) / TS);
    const ty = Math.floor((e.clientY - rect.top) / TS);
    return [
      Math.max(0, Math.min(props.scene.width - 1, tx)),
      Math.max(0, Math.min(props.scene.height - 1, ty)),
    ];
  }

  // cellules d'une forme (rectangle plein ou ellipse inscrite)
  function shapeCells(a: Cell, b: Cell, circle: boolean): Array<[number, number]> {
    const x0 = Math.min(a[0], b[0]);
    const y0 = Math.min(a[1], b[1]);
    const x1 = Math.max(a[0], b[0]);
    const y1 = Math.max(a[1], b[1]);
    const out: Array<[number, number]> = [];
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = (x1 - x0 + 1) / 2;
    const ry = (y1 - y0 + 1) / 2;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (circle) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          if (dx * dx + dy * dy > 1) continue;
        }
        out.push([x, y]);
      }
    }
    return out;
  }

  // remplissage : zone connexe de même tile sur la couche active
  function floodCells(x0: number, y0: number): Array<[number, number]> {
    const target = activeGrid[y0][x0];
    const seen = new Set<number>();
    const out: Array<[number, number]> = [];
    const stack: Cell[] = [[x0, y0]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) continue;
      const k = y * scene.width + x;
      if (seen.has(k) || activeGrid[y][x] !== target) continue;
      seen.add(k);
      out.push([x, y]);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return out;
  }

  function handleDown(e: React.MouseEvent) {
    const [tx, ty] = tileAt(e);
    if (e.button === 2) {
      // pipette : clic = tile, glisser = bloc
      setPickDrag({ start: [tx, ty], cur: [tx, ty] });
      return;
    }
    if (e.button !== 0) return;
    const hit = props.scene.actors.findIndex((a) => a.x === tx && a.y === ty);
    if (props.tool.kind === "select" && hit >= 0) {
      props.onSelectActor(hit);
      return;
    }
    if (props.tool.kind === "tile") {
      if (drawMode === "fill") {
        props.onApplyPattern(floodCells(tx, ty), tx, ty);
        return;
      }
      if (drawMode === "rect" || drawMode === "circle") {
        setShapeDrag({ start: [tx, ty], cur: [tx, ty] });
        return;
      }
    }
    painting.current = true;
    origin.current = [tx, ty];
    props.onPaint(tx, ty, tx, ty, true);
  }

  function handleMove(e: React.MouseEvent) {
    const [tx, ty] = tileAt(e);
    setHover((h) => {
      if (h && h[0] === tx && h[1] === ty) return h;
      props.onHover([tx, ty]);
      return [tx, ty];
    });
    if (pickDrag) {
      setPickDrag((d) => (d ? { start: d.start, cur: [tx, ty] } : d));
      return;
    }
    if (shapeDrag) {
      setShapeDrag((d) => (d ? { start: d.start, cur: [tx, ty] } : d));
      return;
    }
    if (!painting.current) return;
    props.onPaint(tx, ty, origin.current[0], origin.current[1], false);
  }

  function handleUp(e: React.MouseEvent) {
    const [tx, ty] = tileAt(e);
    if (pickDrag) {
      const x0 = Math.min(pickDrag.start[0], tx);
      const y0 = Math.min(pickDrag.start[1], ty);
      const x1 = Math.max(pickDrag.start[0], tx);
      const y1 = Math.max(pickDrag.start[1], ty);
      const tiles: number[][] = [];
      for (let y = y0; y <= y1; y++) {
        const row: number[] = [];
        for (let x = x0; x <= x1; x++) {
          row.push(activeGrid[y][x]);
        }
        tiles.push(row);
      }
      setPickDrag(null);
      props.onPickBlock(tiles);
      return;
    }
    if (shapeDrag) {
      props.onApplyPattern(
        shapeCells(shapeDrag.start, [tx, ty], drawMode === "circle"),
        shapeDrag.start[0],
        shapeDrag.start[1]
      );
      setShapeDrag(null);
      return;
    }
    painting.current = false;
  }

  const cursor =
    props.tool.kind === "tile"
      ? drawMode === "pen"
        ? CUR_PEN
        : drawMode === "fill"
          ? CUR_FILL
          : "crosshair"
      : "crosshair";

  return (
    <div
      style={{
        position: "relative",
        width: scene.width * TS,
        height: scene.height * TS,
      }}
    >
      <canvas
        ref={baseRef}
        width={scene.width * TS}
        height={scene.height * TS}
        style={{ position: "absolute", inset: 0, imageRendering: "pixelated" }}
      />
      <canvas
        ref={overlayRef}
        width={scene.width * TS}
        height={scene.height * TS}
        style={{ position: "absolute", inset: 0, cursor }}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={() => {
          painting.current = false;
          setHover(null);
          props.onHover(null);
          setShapeDrag(null);
          setPickDrag(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
