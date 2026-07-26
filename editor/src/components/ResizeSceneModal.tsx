// Redimensionnement de la scène courante (contrainte spec : >= 32x32).
// Rognage/extension gérés par resizeScene (state.ts).

import { useState } from "react";
import { MIN_MAP } from "../types";

interface Props {
  width: number;
  height: number;
  onResize: (width: number, height: number) => void;
  onClose: () => void;
}

export default function ResizeSceneModal({ width: w0, height: h0, onResize, onClose }: Props) {
  const [width, setWidth] = useState(w0);
  const [height, setHeight] = useState(h0);

  const sizeOk = width >= MIN_MAP && height >= MIN_MAP && width <= 255 && height <= 255;
  const shrinks = width < w0 || height < h0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Redimensionner la scène</div>
        <div className="row">
          <label>
            Largeur (tiles)
            <input
              type="number"
              min={MIN_MAP}
              max={255}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
          <label>
            Hauteur (tiles)
            <input
              type="number"
              min={MIN_MAP}
              max={255}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </label>
        </div>
        {!sizeOk && <p className="hint">Dimensions : {MIN_MAP} à 255 (spec v0).</p>}
        {shrinks && sizeOk && (
          <p className="hint">
            Rognage : les acteurs et warps hors limites seront supprimés.
          </p>
        )}
        <div className="row">
          <button
            disabled={!sizeOk || (width === w0 && height === h0)}
            onClick={() => onResize(width, height)}
          >
            Redimensionner
          </button>
          <button onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
