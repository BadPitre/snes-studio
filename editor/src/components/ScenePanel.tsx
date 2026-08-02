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
  /** World map rotation, as a step count (0 = off). */
  onRotate: (steps: number) => void;
  /** World map sky: flat colour, a gradient's two ends, or an image. */
  onSky: (flat?: string, top?: string, bottom?: string, image?: string) => void;
  /** Project pictures, as [label, path] — a sky image is an ordinary
   *  16-colour PNG, so it needs no resource category of its own. */
  pictures: [string, string][];
}

type SkyMode = "black" | "flat" | "gradient" | "image";

function skyOf(scene: Scene): SkyMode {
  if (scene.m7_sky_image) return "image";
  if (scene.m7_sky_top && scene.m7_sky_bottom) return "gradient";
  return scene.m7_sky ? "flat" : "black";
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
  const sky = skyOf(scene);
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
            <div className="palette-title">Rotation</div>
            <select
              value={scene.m7_rotate ?? 0}
              onChange={(e) => props.onRotate(Number(e.target.value))}
            >
              <option value={0}>Aucune — le nord reste en haut</option>
              <option value={16}>16 crans (22,5°) — ~14 Ko</option>
              <option value={32}>32 crans (11,25°) — ~28 Ko</option>
              <option value={64}>64 crans (5,6°) — ~56 Ko</option>
            </select>
            <p className="hint">
              {scene.m7_rotate
                ? "La commande « Tourner la vue » parcourt les crans elle-même, par le plus court chemin. Les crans achètent la finesse, la durée achète le mouvement — ni l'un ni l'autre ne coûte quoi que ce soit par frame. Changer l'inclinaison en jeu désactive la rotation jusqu'au rechargement de la scène."
                : "Sans rotation, la carte ne coûte rien de plus et le nord reste en haut."}
            </p>
            <div className="palette-title">Ciel</div>
            <select
              value={sky}
              onChange={(e) => {
                const m = e.target.value as SkyMode;
                if (m === "black") props.onSky();
                else if (m === "flat") props.onSky(scene.m7_sky ?? "#4090e0");
                else if (m === "image")
                  props.onSky(
                    scene.m7_sky ?? "#000000",
                    undefined,
                    undefined,
                    scene.m7_sky_image ?? props.pictures[0]?.[1] ?? ""
                  );
                else
                  props.onSky(
                    undefined,
                    scene.m7_sky_top ?? "#102060",
                    scene.m7_sky_bottom ?? "#f0a060"
                  );
              }}
            >
              <option value="black">Noir (rien à afficher)</option>
              <option value="flat">Couleur unie</option>
              <option value="gradient" disabled={!!scene.m7_rotate}>
                Dégradé vertical{scene.m7_rotate ? " — impossible avec la rotation" : ""}
              </option>
              <option value="image" disabled={!props.pictures.length}>
                Image{!props.pictures.length ? " — aucune image dans le projet" : ""}
              </option>
            </select>
            {sky === "flat" && (
              <div className="row">
                <label>
                  Couleur
                  <input
                    type="color"
                    value={scene.m7_sky ?? "#4090e0"}
                    onChange={(e) => props.onSky(e.target.value)}
                  />
                </label>
              </div>
            )}
            {sky === "image" && (
              <div className="row">
                <label>
                  Image
                  <select
                    value={scene.m7_sky_image ?? ""}
                    onChange={(e) =>
                      props.onSky(scene.m7_sky, undefined, undefined, e.target.value)
                    }
                  >
                    {props.pictures.map(([label, path]) => (
                      <option key={path} value={path}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Fond derrière
                  <input
                    type="color"
                    value={scene.m7_sky ?? "#000000"}
                    onChange={(e) =>
                      props.onSky(e.target.value, undefined, undefined, scene.m7_sky_image)
                    }
                  />
                </label>
              </div>
            )}
            {sky === "gradient" && (
              <div className="row">
                <label>
                  Haut
                  <input
                    type="color"
                    value={scene.m7_sky_top ?? "#102060"}
                    onChange={(e) =>
                      props.onSky(undefined, e.target.value, scene.m7_sky_bottom)
                    }
                  />
                </label>
                <label>
                  Bas (horizon)
                  <input
                    type="color"
                    value={scene.m7_sky_bottom ?? "#f0a060"}
                    onChange={(e) =>
                      props.onSky(undefined, scene.m7_sky_top, e.target.value)
                    }
                  />
                </label>
              </div>
            )}
            <p className="hint">
              Le ciel est aussi ce qui s'affiche AU-DELÀ des bords de la carte —
              une couleur d'eau ou de brume s'y lit bien. Le dégradé prend un
              canal HDMA, que la rotation occupe déjà : les deux s'excluent, et
              datagen le refuse plutôt que de l'ignorer.
              {sky === "image"
                ? " Une image de ciel coûte 16 couleurs au plan (112 au lieu de 128), et sa couleur d'index 0 est TRANSPARENTE — c'est ce qui permet de poser des nuages sur la couleur de fond."
                : ""}
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
