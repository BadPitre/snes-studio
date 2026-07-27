// Onglet « Scène » : paramètres de la scène courante — tileset (choix,
// imports, passabilité) et redimensionnement.

import { useEffect, useState } from "react";
import type { Scene } from "../types";
import { MIN_H, MIN_W } from "../types";

interface Props {
  scene: Scene;
  tilesetNames: string[]; // stems, ordre = tileset_id
  current: string; // stem du tileset de la scène
  canImport: boolean;
  passMode: boolean;
  onSelectTileset: (stem: string) => void;
  onImport: () => void;
  onImportChipset: () => void;
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

  const sizeOk = width >= MIN_W && height >= MIN_H && width <= 255 && height <= 255;
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
          title="Tileset de la scène"
        >
          {props.tilesetNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {props.canImport && (
          <button onClick={props.onImport} title="Importer un PNG de tileset dans le projet">
            Importer…
          </button>
        )}
        {props.canImport && (
          <button
            onClick={props.onImportChipset}
            title="Importer un chipset RPG Maker 2003 (PNG 480x256) : tiles, autotiles et couches découpés automatiquement"
          >
            Chipset RM2003…
          </button>
        )}
        <button
          className={props.passMode ? "active" : ""}
          onClick={() => props.onPassMode(!props.passMode)}
          title="Éditer la passabilité des tiles dans la palette : O passable, X solide, ☆ au-dessus du héros"
        >
          Passabilité O/X/☆
        </button>
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
        {!sizeOk && <p className="hint">Dimensions : {MIN_W}x{MIN_H} à 255x255.</p>}
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
