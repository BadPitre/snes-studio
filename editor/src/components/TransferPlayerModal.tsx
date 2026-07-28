// Fenêtre « Téléporter » — calquée sur le dialogue Transfer Player de
// RM2003 : arbre des scènes à gauche, aperçu de la scène sélectionnée à
// droite (clic = tile d'arrivée, carré blanc), radios Direction
// (Conserver / Haut / Droite / Bas / Gauche) et zoom 1/1, 1/2, 1/4.
// Utilisée pour créer/éditer les WARPS de tile (v0.16 : direction
// d'arrivée dans WarpDef.flags).

import { useEffect, useRef, useState } from "react";
import type { Direction, Scene, TilesetMeta, Warp } from "../types";
import { AUTOTILE_BASE, EMPTY_TILE, assetStem } from "../types";
import { drawAutotileCell } from "../autotile";

interface Props {
  warp: Warp; // valeurs initiales (to/tx/ty/dir)
  sceneNames: string[]; // ordre du projet
  scenes: Record<string, Scene>;
  tilesets: Record<string, ImageBitmap>; // par stem
  autoImgs: Record<string, ImageBitmap[]>; // autotiles par stem
  tilesetMeta: Record<string, TilesetMeta>;
  defaultTileset: string; // stem du tileset par défaut du projet
  onOk: (patch: Pick<Warp, "to" | "tx" | "ty" | "dir">) => void;
  onClose: () => void;
}

const DIRS: { key: Direction | ""; label: string }[] = [
  { key: "", label: "Conserver" },
  { key: "up", label: "Haut" },
  { key: "right", label: "Droite" },
  { key: "down", label: "Bas" },
  { key: "left", label: "Gauche" },
];

export default function TransferPlayerModal(props: Props) {
  const [to, setTo] = useState(props.warp.to);
  const [tx, setTx] = useState(props.warp.tx);
  const [ty, setTy] = useState(props.warp.ty);
  const [dir, setDir] = useState<Direction | "">(props.warp.dir ?? "");
  const [zoom, setZoom] = useState(0.5); // 1/2 par défaut, comme RM2003
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dest = props.scenes[to];

  // arbre : scènes racines puis enfants (une profondeur, comme la barre
  // latérale) — l'indentation suffit à lire la hiérarchie
  const ordered: { name: string; depth: number }[] = [];
  for (const n of props.sceneNames) {
    if (!props.scenes[n]?.parent) {
      ordered.push({ name: n, depth: 0 });
      for (const m of props.sceneNames) {
        if (props.scenes[m]?.parent === n) ordered.push({ name: m, depth: 1 });
      }
    }
  }
  for (const n of props.sceneNames) {
    if (!ordered.some((o) => o.name === n)) ordered.push({ name: n, depth: 1 });
  }

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !dest) return;
    const TS = Math.max(4, 16 * zoom);
    cv.width = dest.width * TS;
    cv.height = dest.height * TS;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cv.width, cv.height);
    const stem = dest.tileset ?? props.defaultTileset;
    const tileset = props.tilesets[stem];
    const autotiles = props.autoImgs[stem] ?? [];
    if (tileset) {
      const perRow = Math.max(1, Math.floor(tileset.width / 16));
      const drawLayer = (grid: number[][]) => {
        for (let y = 0; y < dest.height; y++) {
          for (let x = 0; x < dest.width; x++) {
            const t = grid[y][x];
            if (t === EMPTY_TILE) continue;
            if (t >= AUTOTILE_BASE) {
              const img = autotiles[t - AUTOTILE_BASE];
              if (!img) continue;
              const same = (ox: number, oy: number) => {
                const nx = x + ox;
                const ny = y + oy;
                if (nx < 0 || ny < 0 || nx >= dest.width || ny >= dest.height) return true;
                return grid[ny][nx] === t;
              };
              drawAutotileCell(ctx, img, x * TS, y * TS, TS, same);
              continue;
            }
            const sx = (t % perRow) * 16;
            const sy = Math.floor(t / perRow) * 16;
            ctx.drawImage(tileset, sx, sy, 16, 16, x * TS, y * TS, TS, TS);
          }
        }
      };
      drawLayer(dest.tilemap);
      drawLayer(dest.upper);
    }
    // tile d'arrivée : carré blanc (repère RM2003)
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(tx * TS + 1, ty * TS + 1, TS - 2, TS - 2);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(tx * TS + 2.5, ty * TS + 2.5, TS - 5, TS - 5);
  }, [dest, to, tx, ty, zoom, props.tilesets, props.autoImgs]);

  const sceneIdx = Math.max(0, props.sceneNames.indexOf(to));
  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal transfer" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">
          Téléporter — warp en ({props.warp.x},{props.warp.y})
        </div>
        <div className="transfer-body">
          <div className="evedit-cmds transfer-tree">
            {ordered.map(({ name, depth }) => (
              <div
                key={name}
                className={"evedit-line" + (name === to ? " active" : "")}
                style={{ paddingLeft: 6 + depth * 14 }}
                onClick={() => {
                  const d = props.scenes[name];
                  setTo(name);
                  setTx(Math.min(d?.player_start[0] ?? 3, (d?.width ?? 1) - 1));
                  setTy(Math.min(d?.player_start[1] ?? 3, (d?.height ?? 1) - 1));
                }}
              >
                ▪ {name}
              </div>
            ))}
          </div>
          <div className="transfer-preview">
            {dest ? (
              <canvas
                ref={canvasRef}
                onClick={(e) => {
                  const cv = canvasRef.current!;
                  const r = cv.getBoundingClientRect();
                  const TS = Math.max(4, 16 * zoom);
                  const x = Math.floor((e.clientX - r.left) / TS);
                  const y = Math.floor((e.clientY - r.top) / TS);
                  if (x >= 0 && y >= 0 && x < dest.width && y < dest.height) {
                    setTx(x);
                    setTy(y);
                  }
                }}
              />
            ) : (
              <p className="hint">Scène introuvable.</p>
            )}
          </div>
        </div>
        <fieldset className="evedit-box">
          <legend>Direction à l'arrivée</legend>
          <div className="row" style={{ gap: 12 }}>
            {DIRS.map((d) => (
              <label key={d.label} className="checkline">
                <input
                  type="radio"
                  name="tp-dir"
                  checked={dir === d.key}
                  onChange={() => setDir(d.key)}
                />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row" style={{ alignItems: "center" }}>
          <span className="hint">
            {String(sceneIdx).padStart(4, "0")}:{to} ({String(tx).padStart(3, "0")}.
            {String(ty).padStart(3, "0")})
          </span>
          <span style={{ flex: 1 }} />
          {[1, 0.5, 0.25].map((z) => (
            <button
              key={z}
              style={zoom === z ? { background: "#31547a" } : undefined}
              onClick={() => setZoom(z)}
            >
              1/{Math.round(1 / z)}
            </button>
          ))}
          <button
            onClick={() =>
              props.onOk({ to, tx, ty, dir: dir === "" ? undefined : dir })
            }
          >
            OK
          </button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

// stem du tileset par défaut d'un projet (première entrée)
export function defaultTilesetStem(paths: string[]): string {
  return assetStem(paths[0] ?? "");
}
