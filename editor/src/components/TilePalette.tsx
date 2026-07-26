// Palette d'outils : tiles du tileset, collision, acteurs, départ joueur.

import { useEffect, useRef } from "react";
import type { Tool } from "../state";

interface Props {
  tileset: ImageBitmap | null;
  tool: Tool;
  onTool: (t: Tool) => void;
}

const CELL = 40;

export default function TilePalette({ tileset, tool, onTool }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const count = tileset ? Math.floor(tileset.width / 16) : 0;

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !tileset) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < count; i++) {
      ctx.drawImage(tileset, i * 16, 0, 16, 16, i * CELL + 4, 4, CELL - 8, CELL - 8);
      if (tool.kind === "tile" && tool.index === i) {
        ctx.strokeStyle = "#20c0ff";
        ctx.lineWidth = 3;
        ctx.strokeRect(i * CELL + 2, 2, CELL - 4, CELL - 4);
      }
    }
  }, [tileset, tool, count]);

  return (
    <div className="palette">
      <div className="palette-title">Tiles</div>
      <canvas
        ref={ref}
        width={Math.max(count * CELL, CELL)}
        height={CELL}
        onClick={(e) => {
          const rect = ref.current!.getBoundingClientRect();
          const i = Math.floor((e.clientX - rect.left) / CELL);
          if (i >= 0 && i < count) onTool({ kind: "tile", index: i });
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
