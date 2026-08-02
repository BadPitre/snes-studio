// "Scène" tab: settings of the current scene — tileset (choice,
// passability) and resizing. The imports live in Tools > Tilesets… (T1)
// and in the resource manager.

import { useEffect, useState } from "react";
import type { M7View, Scene } from "../types";
import { M7_VIEW_LABELS, M7_VIEWS, MIN_H, MIN_W } from "../types";

interface Props {
  scene: Scene;
  tilesetNames: string[]; // stems, order = tileset_id
  current: string; // stem of the scene's tileset
  musicNames: string[]; // stems of the project's modules
  passMode: boolean;
  onSelectTileset: (stem: string) => void;
  onSelectMusic: (stem: string | undefined) => void;
  onPassMode: (on: boolean) => void;
  onResize: (width: number, height: number) => void;
  /** World map camera angle, in screen lines. */
  onView: (horizon: number, anchor: number) => void;
  /** World map rotation (opt-in: it costs ROM). */
  onRotate: (on: boolean) => void;
}

/** Which preset a scene's two lines correspond to — "custom" when they
 *  match none. Derived rather than stored: the engine reads lines, so
 *  the lines are the truth and the name is a label over them. */
function viewOf(scene: Scene): M7View {
  const h = scene.m7_horizon ?? 56;
  const a = scene.m7_anchor ?? 176;
  for (const [k, [ph, pa]] of Object.entries(M7_VIEWS)) {
    if (ph === h && pa === a) return k as M7View;
  }
  return "custom";
}

export default function ScenePanel(props: Props) {
  const { scene } = props;
  const [width, setWidth] = useState(scene.width);
  const [height, setHeight] = useState(scene.height);
  const world = scene.kind === "worldmap";
  const view = viewOf(scene);
  const [horizon, setHorizon] = useState(scene.m7_horizon ?? 56);
  const [anchor, setAnchor] = useState(scene.m7_anchor ?? 176);

  // resyncs the fields when the scene changes (or after a resize)
  useEffect(() => {
    setWidth(scene.width);
    setHeight(scene.height);
  }, [scene.name, scene.width, scene.height]);

  useEffect(() => {
    setHorizon(scene.m7_horizon ?? 56);
    setAnchor(scene.m7_anchor ?? 176);
  }, [scene.name, scene.m7_horizon, scene.m7_anchor]);

  // The same bounds datagen enforces — stated here so the author is
  // stopped while typing rather than at build time.
  const viewOk = horizon <= 180 && anchor <= 216 && anchor >= horizon + 16;
  const viewChanged =
    horizon !== (scene.m7_horizon ?? 56) || anchor !== (scene.m7_anchor ?? 176);

  // 8192 tiles max per scene (WRAM decompression budget, spec §1.6)
  const cellsOk = width * height <= 8192;
  const sizeOk =
    width >= MIN_W && height >= MIN_H && width <= 255 && height <= 255 && cellsOk;
  const changed = width !== scene.width || height !== scene.height;
  const shrinks = width < scene.width || height < scene.height;

  return (
    <div className="panel">
      <div className="panel-title">
        Scène « {scene.name} » — {scene.width}x{scene.height}
        {world ? " — Carte du monde (Mode 7)" : ""}
      </div>

      {world && (
        <>
          <div className="palette-title">Angle de caméra</div>
          <div className="scene-section">
            <select
              value={view}
              onChange={(e) => {
                const v = e.target.value as M7View;
                if (v === "custom") return; /* the two fields below take over */
                const [h, a] = M7_VIEWS[v as Exclude<M7View, "custom">];
                props.onView(h, a);
              }}
              title="L'écart entre l'horizon et l'ancrage EST l'inclinaison"
            >
              {(Object.keys(M7_VIEW_LABELS) as M7View[]).map((k) => (
                <option key={k} value={k} disabled={k === "custom"}>
                  {M7_VIEW_LABELS[k]}
                </option>
              ))}
            </select>
            <div className="row">
              <label>
                Horizon (ligne)
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={horizon}
                  onChange={(e) => setHorizon(Number(e.target.value))}
                />
              </label>
              <label>
                Ancrage (ligne)
                <input
                  type="number"
                  min={16}
                  max={216}
                  value={anchor}
                  onChange={(e) => setAnchor(Number(e.target.value))}
                />
              </label>
            </div>
            {!viewOk && (
              <p className="hint">
                Horizon 0-180, ancrage 0-216, et au moins 16 lignes d'écart —
                en dessous la perspective sort du registre et tout l'écran
                devient ciel.
              </p>
            )}
            <button
              disabled={!viewOk || !viewChanged}
              onClick={() => props.onView(horizon, anchor)}
            >
              Appliquer l'angle
            </button>
            <label>
              <input
                type="checkbox"
                checked={!!scene.m7_rotate}
                onChange={(e) => props.onRotate(e.target.checked)}
              />
              Rotation (16 crans de 22,5°)
            </label>
            <p className="hint">
              {scene.m7_rotate
                ? "La vue peut pivoter autour du héros avec la commande « Tourner la vue ». Coût : ~14 Ko de ROM de tables compilées pour CET angle — changer l'inclinaison en jeu désactive la rotation jusqu'au rechargement de la scène."
                : "Sans rotation, le nord reste en haut et la carte ne coûte rien de plus."}
            </p>
            <p className="hint">
              L'écart horizon/ancrage est l'inclinaison : {anchor - horizon} lignes
              {anchor - horizon >= 150
                ? " — presque vue de dessus"
                : anchor - horizon <= 70
                  ? " — sol très rasant"
                  : ""}
              . Le héros se tient sur la ligne d'ancrage.
            </p>
          </div>
        </>
      )}

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
