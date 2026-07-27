// Panneau acteurs : liste + édition du PNJ sélectionné, import de
// charsets RM2003 (feuilles de personnages) vers les blocs de sprites.

import type { Actor, Scene } from "../types";
import { DIRECTIONS, SPRITE_BLOCKS_MAX } from "../types";
import { scriptLabels } from "../state";

interface Props {
  scene: Scene;
  selected: number | null;
  canImport: boolean;
  onSelect: (i: number | null) => void;
  onUpdate: (i: number, patch: Partial<Actor>) => void;
  onRemove: (i: number) => void;
  onImportCharset: () => void;
}

export default function ActorPanel({
  scene,
  selected,
  canImport,
  onSelect,
  onUpdate,
  onRemove,
  onImportCharset,
}: Props) {
  const labels = scriptLabels(scene.script);
  const a = selected !== null ? scene.actors[selected] : null;

  return (
    <div className="panel">
      <div className="panel-title">Acteurs ({scene.actors.length})</div>
      <button
        onClick={onImportCharset}
        disabled={!canImport}
        title="Importer un charset RPG Maker 2003 (PNG 288x256 ou 72x128) dans un bloc de la feuille de sprites"
        style={{ marginBottom: 10 }}
      >
        Charset RM2003…
      </button>
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
            Charset (bloc de personnage)
            <select
              value={a.sprite}
              onChange={(e) => onUpdate(selected, { sprite: Number(e.target.value) })}
            >
              {Array.from({ length: SPRITE_BLOCKS_MAX }, (_, b) => (
                <option key={b} value={b}>
                  Bloc {b}
                  {b === 0 ? " — joueur" : ""}
                </option>
              ))}
            </select>
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
