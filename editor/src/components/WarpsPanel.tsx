// Panneau warps : liste + édition (scène cible, position d'arrivée).

import type { Scene, Warp } from "../types";

interface Props {
  scene: Scene;
  sceneNames: string[];
  onUpdate: (i: number, patch: Partial<Warp>) => void;
  onRemove: (i: number) => void;
}

export default function WarpsPanel({ scene, sceneNames, onUpdate, onRemove }: Props) {
  return (
    <div className="panel">
      <div className="panel-title">Warps ({scene.warps.length})</div>
      {scene.warps.length === 0 && (
        <p className="hint">
          Utilise l'outil « Warp » puis clique une tile libre de la map pour
          poser un déclencheur.
        </p>
      )}
      {scene.warps.map((w, i) => (
        <div key={i} className="warp-entry">
          <div className="warp-head">
            <b>
              ({w.x},{w.y})
            </b>
            <button className="danger" onClick={() => onRemove(i)}>
              ×
            </button>
          </div>
          <label>
            Scène cible
            <select value={w.to} onChange={(e) => onUpdate(i, { to: e.target.value })}>
              {sceneNames
                .filter((s) => s !== scene.name)
                .map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </label>
          <div className="row">
            <label>
              Arrivée X
              <input
                type="number"
                min={0}
                max={254}
                value={w.tx}
                onChange={(e) => onUpdate(i, { tx: Number(e.target.value) })}
              />
            </label>
            <label>
              Arrivée Y
              <input
                type="number"
                min={0}
                max={254}
                value={w.ty}
                onChange={(e) => onUpdate(i, { ty: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>
      ))}
      <p className="hint">
        Marcher sur la tile déclenche le warp (fondu). Astuce : place l'arrivée
        une tile À CÔTÉ du warp retour, sinon l'aller-retour est instantané.
      </p>
    </div>
  );
}
