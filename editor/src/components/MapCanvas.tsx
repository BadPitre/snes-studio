// Canvas de la map : rendu tiles + overlays (collision, grille, acteurs,
// départ joueur), peinture à la souris (clic gauche = outil courant).

import { useEffect, useRef } from "react";
import type { Scene } from "../types";
import { TILE_SIZE, actorFrame } from "../types";
import type { Tool } from "../state";

const SCALE = 2;
const TS = TILE_SIZE * SCALE;

interface Props {
  scene: Scene;
  tileset: ImageBitmap | null;
  sprites: ImageBitmap | null;
  tool: Tool;
  showCollision: boolean;
  showGrid: boolean;
  onPaint: (tx: number, ty: number) => void;
  onSelectActor: (index: number) => void;
}

export default function MapCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);

  const { scene, tileset, sprites, showCollision, showGrid } = props;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cv.width, cv.height);

    // tiles
    if (tileset) {
      for (let y = 0; y < scene.height; y++) {
        for (let x = 0; x < scene.width; x++) {
          const t = scene.tilemap[y][x];
          // convention v0 : 1 metatile = 1 char 8x8 répété 2x2
          ctx.drawImage(tileset, t * 8, 0, 8, 8, x * TS, y * TS, TS / 2, TS / 2);
          ctx.drawImage(tileset, t * 8, 0, 8, 8, x * TS + TS / 2, y * TS, TS / 2, TS / 2);
          ctx.drawImage(tileset, t * 8, 0, 8, 8, x * TS, y * TS + TS / 2, TS / 2, TS / 2);
          ctx.drawImage(tileset, t * 8, 0, 8, 8, x * TS + TS / 2, y * TS + TS / 2, TS / 2, TS / 2);
        }
      }
    }

    // collision
    if (showCollision) {
      ctx.fillStyle = "rgba(255,40,40,0.35)";
      for (let y = 0; y < scene.height; y++) {
        for (let x = 0; x < scene.width; x++) {
          if (scene.collision[y][x]) ctx.fillRect(x * TS, y * TS, TS, TS);
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
    ctx.font = `${TS - 10}px monospace`;
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

    // acteurs
    for (const a of scene.actors) {
      if (sprites) {
        const f = actorFrame(a);
        ctx.drawImage(sprites, f * 16, 0, 16, 16, a.x * TS, a.y * TS, TS, TS);
      }
      ctx.strokeStyle = "#ffe020";
      ctx.lineWidth = 2;
      ctx.strokeRect(a.x * TS + 1, a.y * TS + 1, TS - 2, TS - 2);
    }
  }, [scene, tileset, sprites, showCollision, showGrid]);

  function tileAt(e: React.MouseEvent): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    const tx = Math.floor((e.clientX - rect.left) / TS);
    const ty = Math.floor((e.clientY - rect.top) / TS);
    return [
      Math.max(0, Math.min(props.scene.width - 1, tx)),
      Math.max(0, Math.min(props.scene.height - 1, ty)),
    ];
  }

  function handleDown(e: React.MouseEvent) {
    const [tx, ty] = tileAt(e);
    const hit = props.scene.actors.findIndex((a) => a.x === tx && a.y === ty);
    if (props.tool.kind === "select" && hit >= 0) {
      props.onSelectActor(hit);
      return;
    }
    painting.current = true;
    props.onPaint(tx, ty);
  }

  function handleMove(e: React.MouseEvent) {
    if (!painting.current) return;
    const [tx, ty] = tileAt(e);
    props.onPaint(tx, ty);
  }

  return (
    <canvas
      ref={canvasRef}
      width={scene.width * TS}
      height={scene.height * TS}
      style={{ cursor: "crosshair", imageRendering: "pixelated" }}
      onMouseDown={handleDown}
      onMouseMove={handleMove}
      onMouseUp={() => (painting.current = false)}
      onMouseLeave={() => (painting.current = false)}
    />
  );
}
