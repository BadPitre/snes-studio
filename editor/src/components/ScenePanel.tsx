// Onglet « Scène » : paramètres de la scène courante — tileset (choix,
// passabilité) et redimensionnement. Les imports vivent dans
// Tools → Tilesets… (T1) et le Gestionnaire de ressources.

import { useEffect, useState } from "react";
import type { Scene } from "../types";
import { MIN_H, MIN_W } from "../types";

interface Props {
  scene: Scene;
  tilesetNames: string[]; // stems, ordre = tileset_id
  current: string; // stem du tileset de la scène
  musicNames: string[]; // stems des modules du projet
  passMode: boolean;
  onSelectTileset: (stem: string) => void;
  onSelectMusic: (stem: string | undefined) => void;
  onPassMode: (on: boolean) => void;
  onResize: (width: number, height: number) => void;
}

export default function ScenePanel(props: Props) {
  const { scene } = props;
  const [width, setWidth] = useState(scene.width);
  const [height, setHeight] = useState(scene.height);

  // resynchronise les champs quand on change de scène (ou après un resize)
  useEffect(() => {
    setWidth(scene.width);
    setHeight(scene.height);
  }, [scene.name, scene.width, scene.height]);

  // 8192 tiles max par scène (budget WRAM de décompression, spec §1.6)
  const cellsOk = width * height <= 8192;
  const sizeOk =
    width >= MIN_W && height >= MIN_H && width <= 255 && height <= 255 && cellsOk;
  const changed = width !== scene.width || height !== scene.height;
  const shrinks = width < scene.width || height < scene.height;

  return (
    <div className="panel">
      <div className="panel-title">
        Scène « {scene.name} » — {scene.width}x{scene.height}
      </div>

      <div className="palette-title">Tileset</div>
      <div className="scene-section">
        <select
          value={props.current}
          onChange={(e) => props.onSelectTileset(e.target.value)}
          title="Tileset de la scène — la passabilité (O/X/☆) et le passage directionnel s'éditent dans Tools → Tilesets"
        >
          {props.tilesetNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="palette-title">Musique</div>
      <div className="scene-section">
        <select
          value={scene.music ?? ""}
          onChange={(e) =>
            props.onSelectMusic(e.target.value === "" ? undefined : e.target.value)
          }
          title="Musique de la scène (modules du projet)"
        >
          <option value="">— aucune —</option>
          {props.musicNames.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="palette-title">Redimensionner</div>
      <div className="scene-section">
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
        {!sizeOk && (
          <p className="hint">
            Dimensions : {MIN_W}x{MIN_H} à 255x255, et {8192} tiles max
            (ex. 90x90, 64x128){!cellsOk ? ` — ${width * height} demandées` : ""}.
          </p>
        )}
        {shrinks && sizeOk && (
          <p className="hint">Rognage : les acteurs et warps hors limites seront supprimés.</p>
        )}
        <button disabled={!sizeOk || !changed} onClick={() => props.onResize(width, height)}>
          Redimensionner
        </button>
      </div>
    </div>
  );
}
