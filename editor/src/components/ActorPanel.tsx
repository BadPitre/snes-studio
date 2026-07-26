// Panneau acteurs : liste + édition du PNJ sélectionné.

import type { Actor, Scene } from "../types";
import { DIRECTIONS } from "../types";
import { scriptLabels } from "../state";

interface Props {
  scene: Scene;
  selected: number | null;
  onSelect: (i: number | null) => void;
  onUpdate: (i: number, patch: Partial<Actor>) => void;
  onRemove: (i: number) => void;
}

export default function ActorPanel({ scene, selected, onSelect, onUpdate, onRemove }: Props) {
  const labels = scriptLabels(scene.script);
  const a = selected !== null ? scene.actors[selected] : null;

  return (
    <div className="panel">
      <div className="panel-title">Acteurs ({scene.actors.length})</div>
      <ul className="actor-list">
        {scene.actors.map((actor, i) => (
          <li
            key={i}
            className={i === selected ? "active" : ""}
            onClick={() => onSelect(i)}
          >
            PNJ #{i} — ({actor.x},{actor.y}) {actor.dir}
            {actor.entry ? ` → ${actor.entry}` : " (sans script)"}
          </li>
        ))}
      </ul>
      {a && selected !== null && (
        <div className="actor-edit">
          <label>
            Direction
            <select
              value={a.dir}
              onChange={(e) => onUpdate(selected, { dir: e.target.value as Actor["dir"] })}
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sprite (frame de base)
            <input
              type="number"
              min={0}
              max={7}
              value={a.sprite}
              onChange={(e) => onUpdate(selected, { sprite: Number(e.target.value) })}
            />
          </label>
          <label>
            Script (label d'entrée)
            <select
              value={a.entry ?? ""}
              onChange={(e) =>
                onUpdate(selected, { entry: e.target.value === "" ? undefined : e.target.value })
              }
            >
              <option value="">— aucun —</option>
              {labels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button className="danger" onClick={() => onRemove(selected)}>
            Supprimer ce PNJ
          </button>
        </div>
      )}
    </div>
  );
}
