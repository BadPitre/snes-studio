// The Event Editor's "Apparence" window — modelled on RPG Maker 2003's
// Graphic dialogue: the charset list on the left, a preview of the
// selected block on the right (the 4 directions, click to choose),
// Direction radios. "(invisible)" heads the list for events with no
// sprite (pure triggers).

import { useEffect, useRef, useState } from "react";
import type { Direction } from "../types";
import { DIRECTIONS } from "../types";

interface Props {
  sprites: ImageBitmap | null; // the project's sheet (16x24 strip)
  blockCount: number;
  blockNames: string[];
  usedBlocks: number[]; // blocks already shown by the scene (budget 5)
  sprite: number; // initial selection (-1 = invisible)
  dir: Direction;
  // T4 — TILE appearance: the scene's chipset + the ids of the upper
  // layer section (upper_start in the sidecar); absent = no Tileset entry
  tileset?: ImageBitmap | null;
  upperCells?: number[];
  tile?: number; // initial selection (exclusive with sprite)
  onOk: (sprite: number, dir: Direction, tile?: number) => void;
  onClose: () => void;
}

const DIR_LABELS: Record<Direction, string> = {
  up: "Haut",
  right: "Droite",
  down: "Bas",
  left: "Gauche",
};

export default function GraphicPickerModal(props: Props) {
  const [sprite, setSprite] = useState(props.sprite);
  const [dir, setDir] = useState<Direction>(props.dir);
  // undefined = charset mode; otherwise the chosen tile id (tileset mode)
  const [tile, setTile] = useState<number | undefined>(props.tile);
  const [tsMode, setTsMode] = useState(props.tile !== undefined);
  const cells = props.upperCells ?? [];
  const ref = useRef<HTMLCanvasElement>(null);
  const tsRef = useRef<HTMLCanvasElement>(null);
  const TCOLS = 8;
  const TCELL = 36; // a 16x16 tile x2 + margin

  // grid of the upper layer's tiles (tileset mode)
  useEffect(() => {
    const cv = tsRef.current;
    if (!cv || !tsMode || !props.tileset) return;
    const rows = Math.max(1, Math.ceil(cells.length / TCOLS));
    cv.width = TCOLS * TCELL;
    cv.height = rows * TCELL;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#3a7d44";
    ctx.fillRect(0, 0, cv.width, cv.height);
    const perRow = Math.max(1, Math.floor(props.tileset.width / 16));
    cells.forEach((id, i) => {
      const x = (i % TCOLS) * TCELL + 2;
      const y = Math.floor(i / TCOLS) * TCELL + 2;
      ctx.drawImage(props.tileset!, (id % perRow) * 16, Math.floor(id / perRow) * 16, 16, 16, x, y, 32, 32);
      if (id === tile) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1, y - 1, 34, 34);
      }
    });
  }, [tsMode, tile, props.tileset, cells]);

  const CELL_W = 72; // cell of one direction (a 16x24 frame at scale 3)
  const CELL_H = 92;

  useEffect(() => {
    const cv = ref.current;
    if (!cv || tsMode) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#3a7d44"; // grass background, like the RM2003 preview
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (!props.sprites || sprite < 0) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = "#fff";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("(invisible)", cv.width / 2, cv.height / 2);
      return;
    }
    DIRECTIONS.forEach((d, i) => {
      const f = sprite * 12 + i * 3; // idle frame of the direction
      const x = i * CELL_W;
      ctx.drawImage(props.sprites!, f * 16, 0, 16, 24, x + 12, 10, 48, 72);
      if (d === dir) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, 2, CELL_W - 4, CELL_H - 4);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 3.5, 3.5, CELL_W - 7, CELL_H - 7);
      }
    });
  }, [sprite, dir, props.sprites]);

  const wouldExceed =
    sprite >= 0 &&
    !props.usedBlocks.includes(sprite) &&
    props.usedBlocks.length >= 5;

  return (
    <div className="modal-backdrop">
      <div className="modal graphicpick" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Apparence<button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button></div>
        <div className="graphicpick-body">
          <div className="evedit-cmds graphicpick-list">
            <div
              className={"evedit-line" + (!tsMode && sprite === -1 ? " active" : "")}
              onClick={() => {
                setTsMode(false);
                setTile(undefined);
                setSprite(-1);
              }}
              onDoubleClick={() => props.onOk(-1, dir, undefined)}
            >
              (invisible)
            </div>
            {cells.length > 0 && (
              <div
                className={"evedit-line" + (tsMode ? " active" : "")}
                title="Apparence tile : l'event prend l'aspect d'une tile de la couche haute du tileset de la scène (vases, rochers… — datagen compose le sprite au build)"
                onClick={() => {
                  setTsMode(true);
                  if (tile === undefined) setTile(cells[0]);
                }}
              >
                ▦ Tileset (couche haute)
              </div>
            )}
            {Array.from({ length: props.blockCount }, (_, b) => (
              <div
                key={b}
                className={"evedit-line" + (!tsMode && b === sprite ? " active" : "")}
                onClick={() => {
                  setTsMode(false);
                  setTile(undefined);
                  setSprite(b);
                }}
                onDoubleClick={() => props.onOk(b, dir, undefined)}
              >
                👤 {(props.blockNames[b] ?? `Bloc ${b}`) +
                  (props.usedBlocks.includes(b) ? " ✓" : "")}
              </div>
            ))}
          </div>
          <div className="graphicpick-side">
            {tsMode ? (
              <div style={{ maxHeight: 240, overflowY: "auto", alignSelf: "center" }}>
                <canvas
                  ref={tsRef}
                  title="Clic : choisir la tile"
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                    const cx = Math.floor((e.clientX - r.left) / TCELL);
                    const cy = Math.floor((e.clientY - r.top) / TCELL);
                    const i = cy * TCOLS + cx;
                    if (cx >= 0 && cx < TCOLS && i >= 0 && i < cells.length)
                      setTile(cells[i]);
                  }}
                />
              </div>
            ) : (
            <canvas
              ref={ref}
              width={CELL_W * 4}
              height={CELL_H}
              title="Clic : choisir la direction"
              style={{ cursor: sprite >= 0 ? "pointer" : "default" }}
              onClick={(e) => {
                if (sprite < 0) return;
                const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                const i = Math.floor((e.clientX - r.left) / CELL_W);
                if (i >= 0 && i < 4) setDir(DIRECTIONS[i]);
              }}
            />
            )}
            <fieldset className="evedit-box" style={tsMode ? { opacity: 0.5 } : undefined}>
              <legend>Direction</legend>
              <div className="row" style={{ gap: 12 }}>
                {DIRECTIONS.map((d) => (
                  <label key={d} className="checkline">
                    <input
                      type="radio"
                      name="gp-dir"
                      checked={dir === d}
                      onChange={() => setDir(d)}
                    />
                    {DIR_LABELS[d]}
                  </label>
                ))}
              </div>
            </fieldset>
            {wouldExceed && (
              <span className="hint" style={{ color: "#ff7070" }}>
                {props.usedBlocks.length + 1}e charset de la scène — la SNES
                en affiche 5 max (héros compris). Réutiliser une apparence ✓,
                sinon datagen refusera.
              </span>
            )}
            <span className="hint">
              ✓ = déjà affiché dans la scène. Les charsets s'importent dans
              le Gestionnaire de ressources (catégorie CharSet).
            </span>
          </div>
        </div>
        <div className="modal-actions">
          <button
            onClick={() =>
              props.onOk(tsMode ? -1 : sprite, dir, tsMode ? tile : undefined)
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
