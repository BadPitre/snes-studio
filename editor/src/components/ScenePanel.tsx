// Onglet « Scène » : paramètres de la scène courante — tileset (choix,
// imports, passabilité) et redimensionnement.

import { useEffect, useState } from "react";
import type { Scene, SceneEffect } from "../types";
import { MIN_H, MIN_W } from "../types";

interface Props {
  scene: Scene;
  tilesetNames: string[]; // stems, ordre = tileset_id
  current: string; // stem du tileset de la scène
  musicNames: string[]; // stems des modules du projet
  pictures: string[]; // stems des images (S9 — motif de la couche d'effet)
  canImport: boolean;
  passMode: boolean;
  onSelectTileset: (stem: string) => void;
  onSelectMusic: (stem: string | undefined) => void;
  onSetEffect: (effect: SceneEffect | undefined) => void;
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

      <div className="palette-title">Couche d'effet</div>
      <div className="scene-section">
        <select
          value={scene.effect?.pic ?? ""}
          onChange={(e) =>
            props.onSetEffect(
              e.target.value === ""
                ? undefined
                : { blend: "half", dx: -8, dy: 2, ...scene.effect, pic: e.target.value }
            )
          }
          title="Motif dérivant au-dessus du jeu (nuages, brume) — une image à TRANSPARENCE du Gestionnaire de ressources"
        >
          <option value="">— aucune —</option>
          {props.pictures.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {scene.effect && (
          <>
            <div className="row">
              <label>
                Vitesse X (px/s)
                <input
                  type="number" min={-64} max={64} step={0.25}
                  value={scene.effect.dx ?? 0}
                  onChange={(e) =>
                    props.onSetEffect({ ...scene.effect!, dx: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Vitesse Y (px/s)
                <input
                  type="number" min={-64} max={64} step={0.25}
                  value={scene.effect.dy ?? 0}
                  onChange={(e) =>
                    props.onSetEffect({ ...scene.effect!, dy: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <label>
              Mélange
              <select
                value={scene.effect.blend ?? "none"}
                onChange={(e) =>
                  props.onSetEffect({
                    ...scene.effect!,
                    blend:
                      e.target.value === "none"
                        ? undefined
                        : (e.target.value as "half" | "add" | "sub"),
                  })
                }
              >
                <option value="none">Opaque</option>
                <option value="half">Semi-transparent (50 %)</option>
                <option value="add">Additif (lueur)</option>
                <option value="sub">Soustractif (ombre)</option>
              </select>
            </label>
            <p className="hint">
              Le motif dérive au-dessus du jeu pendant qu'il se joue
              (personnages visibles). La COUCHE SUPÉRIEURE de cette scène
              est désactivée : le plan qui la portait affiche le motif.
              L'image doit être importée AVEC transparence (≤ 192 tiles
              uniques). En mélange, la teinte d'écran est suspendue dans
              cette scène.
            </p>
          </>
        )}
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
