// Création de scène : nom + dimensions (contrainte spec : >= 32x32).

import { useState } from "react";
import { MIN_H, MIN_W } from "../types";

interface Props {
  existing: string[];
  onCreate: (name: string, width: number, height: number) => void;
  onClose: () => void;
}

export default function NewSceneModal({ existing, onCreate, onClose }: Props) {
  const [name, setName] = useState("");
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);

  const clean = name.replace(/[^a-z0-9_]/g, "");
  const nameOk = clean.length > 0 && !existing.includes(clean);
  const sizeOk = width >= MIN_W && height >= MIN_H && width <= 255 && height <= 255;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Nouvelle scène</div>
        <label>
          Nom (a-z, 0-9, _)
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="row">
          <label>
            Largeur (tiles)
            <input
              type="number"
              min={MIN_W}
              max={255}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
          <label>
            Hauteur (tiles)
            <input
              type="number"
              min={MIN_H}
              max={255}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </label>
        </div>
        {!nameOk && clean.length > 0 && <p className="hint">Nom déjà pris.</p>}
        {!sizeOk && <p className="hint">Dimensions : {MIN_W}x{MIN_H} à 255x255.</p>}
        <div className="row">
          <button disabled={!nameOk || !sizeOk} onClick={() => onCreate(clean, width, height)}>
            Créer
          </button>
          <button onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
