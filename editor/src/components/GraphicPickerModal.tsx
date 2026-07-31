// Fenêtre « Apparence » de l'Event Editor — calquée sur le dialogue
// Graphic de RPG Maker 2003 : liste des charsets à gauche, aperçu du
// bloc sélectionné à droite (les 4 directions, clic = choisir), radios
// Direction. « (invisible) » en tête de liste pour les events sans
// sprite (déclencheurs purs).

import { useEffect, useRef, useState } from "react";
import type { Direction } from "../types";
import { DIRECTIONS } from "../types";

interface Props {
  sprites: ImageBitmap | null; // feuille du projet (bande 16x24)
  blockCount: number;
  blockNames: string[];
  usedBlocks: number[]; // blocs déjà affichés par la scène (budget 5)
  sprite: number; // sélection initiale (-1 = invisible)
  dir: Direction;
  onOk: (sprite: number, dir: Direction) => void;
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
  const ref = useRef<HTMLCanvasElement>(null);

  const CELL_W = 72; // case d'une direction (frame 16x24 à l'échelle 3)
  const CELL_H = 92;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#3a7d44"; // fond herbe, comme la preview RM2003
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
      const f = sprite * 12 + i * 3; // frame de repos de la direction
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
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal graphicpick" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Apparence</div>
        <div className="graphicpick-body">
          <div className="evedit-cmds graphicpick-list">
            <div
              className={"evedit-line" + (sprite === -1 ? " active" : "")}
              onClick={() => setSprite(-1)}
              onDoubleClick={() => props.onOk(-1, dir)}
            >
              (invisible)
            </div>
            {Array.from({ length: props.blockCount }, (_, b) => (
              <div
                key={b}
                className={"evedit-line" + (b === sprite ? " active" : "")}
                onClick={() => setSprite(b)}
                onDoubleClick={() => props.onOk(b, dir)}
              >
                👤 {(props.blockNames[b] ?? `Bloc ${b}`) +
                  (props.usedBlocks.includes(b) ? " ✓" : "")}
              </div>
            ))}
          </div>
          <div className="graphicpick-side">
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
            <fieldset className="evedit-box">
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
          <button onClick={() => props.onOk(sprite, dir)}>OK</button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
