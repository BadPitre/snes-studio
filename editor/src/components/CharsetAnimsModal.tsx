// The custom charset animation workshop (CH3), in its OWN window —
// the first cut lived at the bottom of Tools > Charsets and Bertrand
// asked for room. Left: the project's animations; right: the selected
// one — name, end behaviour, playback at real durations, and the step
// list (charset, frame, duration per step). Everything reads the BAKED
// sprite sheet: what the preview shows is what the game will.

import { useEffect, useRef, useState } from "react";
import { FRAME_W, FRAME_H } from "../charset";
import type { CaStep, CharsetAnimation } from "../types";

const DIRS = ["Bas", "Haut", "Gauche", "Droite"];
const STEPS = ["Repos", "Pas A", "Pas B"];

const END_LABELS: [CharsetAnimation["end"], string][] = [
  ["normal", "Retour à la marche"],
  ["loop", "Boucler"],
  ["hold", "Rester figé"],
];

// A frame of the baked sheet over a chequer, at an integer zoom.
function drawSheetFrame(
  cv: HTMLCanvasElement | null,
  sprites: ImageBitmap | null,
  block: number,
  frame: number,
  z: number
) {
  if (!cv) return;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < FRAME_H * z; y += 4)
    for (let x = 0; x < FRAME_W * z; x += 4) {
      ctx.fillStyle = ((x ^ y) / 4) & 1 ? "#666" : "#9a9a9a";
      ctx.fillRect(x, y, 4, 4);
    }
  if (!sprites) return;
  const f = block * 12 + frame;
  if ((f + 1) * FRAME_W > sprites.width) return;
  ctx.drawImage(sprites, f * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W * z, FRAME_H * z);
}

interface Props {
  blockNames: string[];
  sprites: ImageBitmap | null;
  animations: CharsetAnimation[];
  onAnimations: (list: CharsetAnimation[]) => void;
  onClose: () => void;
}

export default function CharsetAnimsModal(props: Props) {
  const [sel, setSel] = useState(0);
  const stepRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const playRef = useRef<HTMLCanvasElement>(null);

  const cur = props.animations[Math.min(sel, Math.max(0, props.animations.length - 1))] ?? null;
  const curI = cur ? Math.min(sel, props.animations.length - 1) : -1;
  const setA = (a: CharsetAnimation) => {
    const next = props.animations.slice();
    next[curI] = a;
    props.onAnimations(next);
  };
  const setStep = (k: number, st: CaStep) => {
    if (!cur) return;
    const steps = cur.steps.slice();
    steps[k] = st;
    setA({ ...cur, steps });
  };

  // step previews
  useEffect(() => {
    if (!cur) return;
    for (let k = 0; k < cur.steps.length; k++)
      drawSheetFrame(stepRefs.current[k], props.sprites, cur.steps[k].charset, cur.steps[k].frame, 2);
  }, [cur, props.sprites]);

  // playback at the real durations (60 Hz)
  useEffect(() => {
    if (!cur || !cur.steps.length) return;
    let k = 0;
    let t = cur.steps[0].dur || 1;
    drawSheetFrame(playRef.current, props.sprites, cur.steps[0].charset, cur.steps[0].frame, 4);
    const timer = window.setInterval(() => {
      if (t > 1) {
        t--;
        return;
      }
      k = (k + 1) % cur.steps.length;
      t = cur.steps[k].dur || 1;
      drawSheetFrame(playRef.current, props.sprites, cur.steps[k].charset, cur.steps[k].frame, 4);
    }, 1000 / 60);
    return () => window.clearInterval(timer);
  }, [cur, props.sprites]);

  return (
    <div className="modal-backdrop transpick-top" onClick={props.onClose}>
      <div
        className="modal chanims"
        style={{ width: "min(92vw, 760px)", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-title">
          Animations de charset
          <button className="modal-x" title="Fermer" onClick={props.onClose}>
            ✕
          </button>
        </div>
        <div className="row" style={{ alignItems: "stretch", gap: 12, minHeight: 0 }}>
          <div style={{ flex: "0 0 170px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ overflowY: "auto", maxHeight: "58vh", display: "flex", flexDirection: "column" }}>
              {props.animations.map((a, i) => (
                <div
                  key={i}
                  className={"tree-row" + (i === curI ? " active" : "")}
                  onClick={() => setSel(i)}
                >
                  ▶ {a.name}
                </div>
              ))}
              {props.animations.length === 0 && (
                <span className="hint">Aucune animation — « + Nouvelle ».</span>
              )}
            </div>
            <button
              onClick={() => {
                props.onAnimations([
                  ...props.animations,
                  {
                    name: `anim_${props.animations.length + 1}`,
                    steps: [{ charset: 0, frame: 0, dur: 8 }],
                    end: "normal",
                  },
                ]);
                setSel(props.animations.length);
              }}
            >
              + Nouvelle
            </button>
            {cur && (
              <button
                title="Supprimer l'animation (le build signale les commandes orphelines)"
                onClick={() => {
                  props.onAnimations(props.animations.filter((_, i) => i !== curI));
                  setSel(0);
                }}
              >
                ✕ Supprimer
              </button>
            )}
          </div>
          {cur && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              <div className="row" style={{ alignItems: "center", gap: 10 }}>
                <label style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                  Nom :
                  <input
                    value={cur.name}
                    style={{ width: 150 }}
                    onChange={(e) =>
                      setA({ ...cur, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })
                    }
                  />
                </label>
                <label style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                  À la fin :
                  <select
                    value={cur.end}
                    onChange={(e) => setA({ ...cur, end: e.target.value as CharsetAnimation["end"] })}
                  >
                    {END_LABELS.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, maxHeight: "46vh", overflowY: "auto" }}>
                  {cur.steps.map((st, k) => (
                    <div key={k} className="row" style={{ alignItems: "center", gap: 8 }}>
                      <span className="hint" style={{ width: 18, textAlign: "right" }}>{k + 1}.</span>
                      <canvas
                        ref={(el) => { stepRefs.current[k] = el; }}
                        width={FRAME_W * 2}
                        height={FRAME_H * 2}
                        style={{ width: FRAME_W * 2, height: FRAME_H * 2, border: "1px solid #000", flex: "0 0 auto" }}
                      />
                      <select
                        value={st.charset}
                        style={{ minWidth: 110 }}
                        onChange={(e) => setStep(k, { ...st, charset: Number(e.target.value) })}
                      >
                        {props.blockNames.map((n, b) => (
                          <option key={b} value={b}>{n}</option>
                        ))}
                      </select>
                      <select
                        value={st.frame}
                        onChange={(e) => setStep(k, { ...st, frame: Number(e.target.value) })}
                      >
                        {Array.from({ length: 12 }, (_, f) => (
                          <option key={f} value={f}>
                            {DIRS[(f / 3) | 0]} — {STEPS[f % 3]}
                          </option>
                        ))}
                      </select>
                      <label style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
                        durée
                        <input
                          type="number"
                          min={1}
                          max={255}
                          value={st.dur}
                          style={{ width: 56 }}
                          onChange={(e) =>
                            setStep(k, { ...st, dur: Math.max(1, Math.min(255, Number(e.target.value) || 1)) })
                          }
                        />
                      </label>
                      <button
                        title="Monter l'étape"
                        disabled={k === 0}
                        onClick={() => {
                          const steps = cur.steps.slice();
                          [steps[k - 1], steps[k]] = [steps[k], steps[k - 1]];
                          setA({ ...cur, steps });
                        }}
                        style={{ width: 22, height: 22, padding: 0 }}
                      >
                        ↑
                      </button>
                      <button
                        title="Descendre l'étape"
                        disabled={k === cur.steps.length - 1}
                        onClick={() => {
                          const steps = cur.steps.slice();
                          [steps[k], steps[k + 1]] = [steps[k + 1], steps[k]];
                          setA({ ...cur, steps });
                        }}
                        style={{ width: 22, height: 22, padding: 0 }}
                      >
                        ↓
                      </button>
                      <button
                        title="Retirer l'étape"
                        disabled={cur.steps.length <= 1}
                        onClick={() => setA({ ...cur, steps: cur.steps.filter((_, i) => i !== k) })}
                        style={{ width: 22, height: 22, padding: 0 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    disabled={cur.steps.length >= 255}
                    style={{ alignSelf: "flex-start" }}
                    onClick={() =>
                      setA({ ...cur, steps: [...cur.steps, { ...cur.steps[cur.steps.length - 1] }] })
                    }
                  >
                    + Ajouter une étape
                  </button>
                </div>
                <div style={{ textAlign: "center" }}>
                  <span className="hint">aperçu</span>
                  <canvas
                    ref={playRef}
                    width={FRAME_W * 4}
                    height={FRAME_H * 4}
                    style={{ width: FRAME_W * 4, height: FRAME_H * 4, border: "1px solid #000", display: "block", marginTop: 4 }}
                  />
                </div>
              </div>
              <span className="hint">
                Jouée par la commande « Jouer une animation de charset » (héros ou event). Une
                étape sur un autre charset = transformation — ses blocs comptent dans les 5 de
                la scène, vérifié au build.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
