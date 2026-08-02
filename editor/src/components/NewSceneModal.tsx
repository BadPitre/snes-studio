// Scene creation: a name + dimensions (spec constraint: >= 20x15).

import { useState } from "react";
import type { SceneKind } from "../types";
import { MIN_H, MIN_W } from "../types";

interface Props {
  existing: string[];
  // parent scene in the tree (null = the project's root)
  parent: string | null;
  onCreate: (name: string, width: number, height: number, kind: SceneKind) => void;
  onClose: () => void;
}

export default function NewSceneModal({ existing, parent, onCreate, onClose }: Props) {
  const [name, setName] = useState("");
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);
  // The scene TYPE is chosen here and not ticked later: Mode 7 is not a
  // rendering option, it changes what a scene may contain (one plane, no
  // dialogue). Flipping it on a finished scene would silently strip the
  // upper layer and the per-tile palettes — see the design doc §8.2.
  const [kind, setKind] = useState<SceneKind>("map");
  const world = kind === "worldmap";

  // the name TYPED must be valid as it stands (a-z, 0-9, _) — no silent
  // cleanup: "MaScene" must not silently become "ascene"
  const charsOk = /^[a-z0-9_]+$/.test(name);
  const taken = charsOk && existing.includes(name);
  const nameOk = charsOk && !taken;
  // 8192 tiles max per scene (WRAM decompression budget, spec §1.6)
  const sizeOk =
    width >= MIN_W && height >= MIN_H &&
    width <= (world ? 64 : 255) && height <= (world ? 64 : 255) &&
    width * height <= 8192;

  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Nouvelle scène<button className="modal-x" title="Fermer" onClick={onClose}>✕</button></div>
        <p className="hint">Créée sous : {parent ?? "racine du projet"}</p>
        <label>
          Nom (a-z, 0-9, _)
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Type
          <select
            value={kind}
            onChange={(e) => {
              const k = e.target.value as SceneKind;
              setKind(k);
              if (k === "worldmap") {
                setWidth((w) => Math.min(w, 64));
                setHeight((h) => Math.min(h, 64));
              }
            }}
          >
            <option value="map">Scène classique</option>
            <option value="worldmap">Carte du monde (projetée en Mode 7)</option>
          </select>
        </label>
        {world && (
          <p className="hint">
            La scène se peint comme une autre, avec les mêmes tilesets, mais
            elle est <b>projetée sur un plan unique</b>. Elle perd donc la
            couche supérieure, la couche d'effet, les miroirs de tuiles et
            le ☆, et <b>les dialogues et le HUD n'y sont pas affichables</b>
            (limite matérielle). Les PNJ, les warps et les déclencheurs
            Contact / Auto fonctionnent : c'est le vocabulaire d'une
            mappemonde. Taille maximale 64x64.
          </p>
        )}
        <div className="row">
          <label>
            Largeur (tiles)
            <input
              type="number"
              min={MIN_W}
              max={world ? 64 : 255}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
          <label>
            Hauteur (tiles)
            <input
              type="number"
              min={MIN_H}
              max={world ? 64 : 255}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </label>
        </div>
        {name.length > 0 && !charsOk && (
          <p className="hint" style={{ color: "#ff7070" }}>
            ⚠ Caractères autorisés : minuscules a-z, chiffres, _ (pas de
            majuscule, d'espace ni d'accent).
          </p>
        )}
        {taken && <p className="hint" style={{ color: "#ff7070" }}>⚠ Nom déjà pris.</p>}
        {!sizeOk && (
          <p className="hint">
            Dimensions : {MIN_W}x{MIN_H} à {world ? "64x64" : "255x255"},
            8192 tiles max.
          </p>
        )}
        <div className="row">
          <button disabled={!nameOk || !sizeOk} onClick={() => onCreate(name, width, height, kind)}>
            Créer
          </button>
          <button onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
