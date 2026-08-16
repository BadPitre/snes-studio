// Tools > Charsets (CH1b): where a charset's WALK is laid — the import
// only extracts a frame POOL; here each of the 12 cells (4 directions x
// 3 steps) picks a pool frame, optionally MIRRORED, so one drawn side
// serves left AND right. « Appliquer » bakes the composed RM2003 sheet
// through the ordinary import-charset flow: the pool and the layout are
// editor metadata, the ROM only ever sees the baked sprite sheet.
// This window is the planned home of the custom charset animations
// (PLANNING_CHARSETS.md, CH3).

import { useEffect, useRef, useState } from "react";
import {
  FRAME_W,
  FRAME_H,
  composeRm2003,
  drawCell,
  type CharsetCellRef,
} from "../charset";
import { loadAssetPng } from "../io";
import type { CaStep, CharsetAnim, CharsetAnimation, CharsetPool } from "../types";

const DIRS = ["Bas", "Haut", "Gauche", "Droite"];
const STEPS = ["Repos", "Pas A", "Pas B"];
const DIR_LEFT = 2;
const DIR_RIGHT = 3;

interface Props {
  root: string;
  blockNames: string[];
  pools: (CharsetPool | null)[];
  anims: (CharsetAnim | null)[]; // CH2 — walk speed + idle per block
  sprites: ImageBitmap | null; // the baked sheet, shown for pool-less blocks
  initialBlock?: number;
  onCells: (block: number, cells: (CharsetCellRef | null)[]) => void;
  onAnim: (block: number, anim: CharsetAnim | null) => void;
  onBake: (block: number, bytes: Uint8Array) => Promise<void>;
  // CH3 — the custom animation workshop (project.charset_animations)
  animations: CharsetAnimation[];
  onAnimations: (list: CharsetAnimation[]) => void;
  onClose: () => void;
}

const END_LABELS: [CharsetAnimation["end"], string][] = [
  ["normal", "Retour à la marche"],
  ["loop", "Boucler"],
  ["hold", "Rester figé"],
];

// A frame of the BAKED sheet, drawn at 2x over a chequer — the step
// previews and the player read the same sheet the game will.
function drawSheetFrame(
  cv: HTMLCanvasElement | null,
  sprites: ImageBitmap | null,
  block: number,
  frame: number
) {
  if (!cv) return;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < FRAME_H * 2; y += 4)
    for (let x = 0; x < FRAME_W * 2; x += 4) {
      ctx.fillStyle = ((x ^ y) / 4) & 1 ? "#666" : "#9a9a9a";
      ctx.fillRect(x, y, 4, 4);
    }
  if (!sprites) return;
  const f = block * 12 + frame;
  if ((f + 1) * FRAME_W > sprites.width) return;
  ctx.drawImage(sprites, f * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W * 2, FRAME_H * 2);
}

export default function CharsetsModal(props: Props) {
  const [sel, setSel] = useState(
    Math.min(props.initialBlock ?? 0, Math.max(0, props.blockNames.length - 1))
  );
  const [selF, setSelF] = useState(0); // selected pool frame
  const [pool, setPool] = useState<ImageData | null>(null);
  const [baking, setBaking] = useState(false);
  // CH3 — the custom animation workshop
  const [selA, setSelA] = useState(0);
  const stepRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const playRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLCanvasElement>(null);
  const cellRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const walkRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const entry = props.pools[sel] ?? null;
  const cells = entry?.cells ?? Array.from({ length: 12 }, () => null);
  const frames = pool ? Math.floor(pool.width / FRAME_W) : 0;

  // the selected block's pool strip, as pixels
  const sheet = entry?.sheet;
  useEffect(() => {
    if (!sheet) {
      setPool(null);
      return;
    }
    let alive = true;
    loadAssetPng(props.root, sheet)
      .then((bmp) => {
        if (!alive) return;
        const cv = document.createElement("canvas");
        cv.width = bmp.width;
        cv.height = bmp.height;
        const ctx = cv.getContext("2d")!;
        ctx.drawImage(bmp, 0, 0);
        setPool(ctx.getImageData(0, 0, bmp.width, bmp.height));
        setSelF(0);
      })
      .catch(() => setPool(null));
    return () => {
      alive = false;
    };
  }, [props.root, sheet]);

  // the pool strip with the selected frame highlighted
  useEffect(() => {
    const cv = stripRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!pool) return;
    for (let f = 0; f < frames; f++) {
      ctx.save();
      ctx.translate(f * FRAME_W * 2, 0);
      const cell = document.createElement("canvas");
      cell.width = FRAME_W * 2;
      cell.height = FRAME_H * 2;
      drawCell(cell.getContext("2d")!, pool, { f }, 2);
      ctx.drawImage(cell, 0, 0);
      ctx.restore();
      ctx.strokeStyle = f === selF ? "#ffd24a" : "#000";
      ctx.lineWidth = f === selF ? 2 : 1;
      ctx.strokeRect(f * FRAME_W * 2 + 1, 1, FRAME_W * 2 - 2, FRAME_H * 2 - 2);
    }
  }, [pool, frames, selF]);

  // the 12-cell grid — from the pool when there is one, otherwise the
  // baked frames of the sprite sheet (an RM2003 import, read-only)
  useEffect(() => {
    for (let n = 0; n < 12; n++) {
      const cv = cellRefs.current[n];
      if (!cv) continue;
      const ctx = cv.getContext("2d")!;
      if (pool) {
        drawCell(ctx, pool, cells[n], 2);
      } else {
        drawCell(ctx, null, null, 2); /* the chequer */
        if (props.sprites)
          ctx.drawImage(
            props.sprites,
            (sel * 12 + n) * FRAME_W, 0, FRAME_W, FRAME_H,
            0, 0, FRAME_W * 2, FRAME_H * 2
          );
      }
    }
  }, [pool, cells, sel, props.sprites]);

  // the walking preview: 4 canvases cycling 0/A/0/B at the engine's
  // pace (a step every 8 display frames)
  useEffect(() => {
    let phase = 0;
    const timer = window.setInterval(() => {
      phase = (phase + 1) & 3;
      const step = phase & 1 ? 1 + (phase >> 1) : 0;
      for (let dir = 0; dir < 4; dir++) {
        const cv = walkRefs.current[dir];
        if (!cv) continue;
        const ctx = cv.getContext("2d")!;
        const n = dir * 3 + step;
        if (pool) {
          drawCell(ctx, pool, cells[n], 2);
        } else {
          drawCell(ctx, null, null, 2);
          if (props.sprites)
            ctx.drawImage(
              props.sprites,
              (sel * 12 + n) * FRAME_W, 0, FRAME_W, FRAME_H,
              0, 0, FRAME_W * 2, FRAME_H * 2
            );
        }
      }
    }, 133);
    return () => window.clearInterval(timer);
  }, [pool, cells, sel, props.sprites]);

  const setCell = (n: number, c: CharsetCellRef | null) => {
    const next = cells.slice();
    next[n] = c;
    props.onCells(sel, next);
  };

  // one direction becomes the other's mirror, step by step
  const mirror = (from: number, to: number) => {
    const next = cells.slice();
    for (let s = 0; s < 3; s++) {
      const src = cells[from * 3 + s];
      next[to * 3 + s] = src ? { f: src.f, flip: !src.flip } : null;
    }
    props.onCells(sel, next);
  };

  const filled = cells.filter(Boolean).length;
  const anim = props.anims[sel] ?? null;

  // CH3 — the selected custom animation and its edits (undo-recorded
  // through the parent's mutate, like every project change)
  const curA =
    props.animations[Math.min(selA, Math.max(0, props.animations.length - 1))] ?? null;
  const curAi = curA ? Math.min(selA, props.animations.length - 1) : -1;
  const setA = (a: CharsetAnimation) => {
    const next = props.animations.slice();
    next[curAi] = a;
    props.onAnimations(next);
  };
  const setStep = (k: number, st: CaStep) => {
    if (!curA) return;
    const steps = curA.steps.slice();
    steps[k] = st;
    setA({ ...curA, steps });
  };

  // step previews — the baked sheet is what the game shows
  useEffect(() => {
    if (!curA) return;
    for (let k = 0; k < curA.steps.length; k++)
      drawSheetFrame(stepRefs.current[k], props.sprites, curA.steps[k].charset, curA.steps[k].frame);
  }, [curA, props.sprites]);

  // the playback preview: steps at their real durations (60 Hz)
  useEffect(() => {
    if (!curA || !curA.steps.length) return;
    let k = 0;
    let t = curA.steps[0].dur || 1;
    drawSheetFrame(playRef.current, props.sprites, curA.steps[0].charset, curA.steps[0].frame);
    const timer = window.setInterval(() => {
      if (t > 1) {
        t--;
        return;
      }
      k = (k + 1) % curA.steps.length;
      t = curA.steps[k].dur || 1;
      drawSheetFrame(playRef.current, props.sprites, curA.steps[k].charset, curA.steps[k].frame);
    }, 1000 / 60);
    return () => window.clearInterval(timer);
  }, [curA, props.sprites]);

  // CH2 — a changed field writes {speed, idle}; both back at their
  // defaults writes null so project.json stays clean.
  const setAnim = (speed: number, idle: number) => {
    props.onAnim(
      sel,
      speed === 8 && idle === 0 ? null : { speed, idle }
    );
  };

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div
        className="modal charsets"
        style={{ width: "min(94vw, 900px)", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-title">
          Charsets
          <button className="modal-x" title="Fermer" onClick={props.onClose}>
            ✕
          </button>
        </div>
        <div className="row" style={{ alignItems: "stretch", gap: 12, minHeight: 0 }}>
          <div
            style={{
              flex: "0 0 180px",
              overflowY: "auto",
              maxHeight: "70vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {props.blockNames.map((n, b) => (
              <div
                key={b}
                className={"tree-row" + (b === sel ? " active" : "")}
                onClick={() => setSel(b)}
              >
                👤 {n}
                {props.pools[b] ? "" : " ·RM"}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            {pool ? (
              <>
                <span className="hint">
                  Le vivier — cliquer une frame, puis une case de la grille pour la poser :
                </span>
                <div style={{ maxWidth: "100%", overflowX: "auto" }}>
                  <canvas
                    ref={stripRef}
                    width={Math.max(1, frames) * FRAME_W * 2}
                    height={FRAME_H * 2}
                    style={{ display: "block", cursor: "pointer" }}
                    onClick={(e) => {
                      const b = e.currentTarget.getBoundingClientRect();
                      const f = Math.floor((e.clientX - b.left) / (FRAME_W * 2));
                      if (f >= 0 && f < frames) setSelF(f);
                    }}
                  />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    title="Poser les trois cases Droite avec les frames de Gauche, en miroir"
                    onClick={() => mirror(DIR_LEFT, DIR_RIGHT)}
                  >
                    Droite = Gauche en miroir
                  </button>
                  <button
                    title="Poser les trois cases Gauche avec les frames de Droite, en miroir"
                    onClick={() => mirror(DIR_RIGHT, DIR_LEFT)}
                  >
                    Gauche = Droite en miroir
                  </button>
                </div>
              </>
            ) : (
              <span className="hint">
                Ce charset vient d'un import RM2003 : pas de vivier de frames. Réimporter une
                planche libre (Gestionnaire → Charsets → Importer) pour pouvoir poser la marche
                ici.
              </span>
            )}
            <div className="row" style={{ alignItems: "flex-start", gap: 24 }}>
              <div>
                <span className="hint">Les 12 cases de la marche :</span>
                <table style={{ borderSpacing: 4 }}>
                  <thead>
                    <tr>
                      <th />
                      {DIRS.map((d) => (
                        <th key={d} className="hint" style={{ fontWeight: 400 }}>
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {STEPS.map((st, s) => (
                      <tr key={st}>
                        <td className="hint" style={{ textAlign: "right" }}>{st}</td>
                        {DIRS.map((_, d) => {
                          const n = d * 3 + s;
                          const c = cells[n];
                          return (
                            <td key={n} style={{ padding: 0 }}>
                              <div style={{ position: "relative", width: FRAME_W * 2 + 4 }}>
                                <canvas
                                  ref={(el) => { cellRefs.current[n] = el; }}
                                  width={FRAME_W * 2}
                                  height={FRAME_H * 2}
                                  title={
                                    pool
                                      ? `${DIRS[d]} — ${st} : poser la frame ${selF + 1}`
                                      : `${DIRS[d]} — ${st}`
                                  }
                                  onClick={() => {
                                    if (pool) setCell(n, { f: selF });
                                  }}
                                  style={{
                                    display: "block",
                                    cursor: pool ? "pointer" : "default",
                                    border: "2px solid #000",
                                  }}
                                />
                                {pool && c && (
                                  <>
                                    <button
                                      title={c.flip ? "Remettre à l'endroit" : "Mettre en miroir"}
                                      onClick={() => setCell(n, { f: c.f, flip: !c.flip })}
                                      style={{
                                        position: "absolute",
                                        left: 1,
                                        bottom: 1,
                                        width: 15,
                                        height: 15,
                                        padding: 0,
                                        lineHeight: "13px",
                                        fontSize: 10,
                                        fontWeight: c.flip ? 700 : 400,
                                      }}
                                    >
                                      ⇄
                                    </button>
                                    <button
                                      title="Vider la case"
                                      onClick={() => setCell(n, null)}
                                      style={{
                                        position: "absolute",
                                        right: 1,
                                        top: 1,
                                        width: 14,
                                        height: 14,
                                        padding: 0,
                                        lineHeight: "12px",
                                        fontSize: 9,
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <span className="hint">La marche (0/A/0/B) :</span>
                <div className="row" style={{ gap: 8, marginTop: 4 }}>
                  {DIRS.map((d, i) => (
                    <div key={d} style={{ textAlign: "center" }}>
                      <canvas
                        ref={(el) => { walkRefs.current[i] = el; }}
                        width={FRAME_W * 2}
                        height={FRAME_H * 2}
                        style={{ display: "block", border: "1px solid #000" }}
                      />
                      <span className="hint">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="row" style={{ alignItems: "center", gap: 12 }}>
              <label style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                Vitesse de marche :
                <input
                  type="number"
                  min={1}
                  max={63}
                  value={anim?.speed || 8}
                  title="Frames entre deux pas de l'animation de marche (8 = RM2003)"
                  style={{ width: 56 }}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(63, Number(e.target.value) || 8));
                    setAnim(v, anim?.idle ?? 0);
                  }}
                />
              </label>
              <label style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                Au repos :
                <select
                  value={anim?.idle ?? 0}
                  title="Marche sur place : le personnage continue son cycle de pas à l'arrêt (torche, oiseau…)"
                  onChange={(e) => setAnim(anim?.speed || 8, Number(e.target.value))}
                >
                  <option value={0}>Immobile</option>
                  <option value={1}>Marche sur place</option>
                </select>
              </label>
              <span className="hint">appliqué au prochain lancement du jeu</span>
            </div>
            {pool && (
              <div className="row" style={{ alignItems: "center", gap: 8 }}>
                <button
                  disabled={!filled || baking}
                  onClick={async () => {
                    if (!pool) return;
                    setBaking(true);
                    try {
                      const rm = composeRm2003(pool, cells);
                      const cv = document.createElement("canvas");
                      cv.width = rm.width;
                      cv.height = rm.height;
                      cv.getContext("2d")!.putImageData(rm, 0, 0);
                      const blob: Blob | null = await new Promise((res) =>
                        cv.toBlob(res, "image/png")
                      );
                      if (blob)
                        await props.onBake(sel, new Uint8Array(await blob.arrayBuffer()));
                    } finally {
                      setBaking(false);
                    }
                  }}
                >
                  {baking ? "Application…" : "Appliquer au jeu"}
                </button>
                <span className="hint">
                  {filled}/12 case(s) posée(s) — Appliquer écrit les 12 frames dans la feuille de
                  sprites du projet (une case vide reste transparente).
                </span>
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--border, #333)", paddingTop: 8, marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="row" style={{ alignItems: "center", gap: 8 }}>
                <b>Animations custom</b>
                <select
                  value={curAi}
                  onChange={(e) => setSelA(Number(e.target.value))}
                  style={{ minWidth: 140 }}
                >
                  {props.animations.length === 0 && <option value={-1}>(aucune)</option>}
                  {props.animations.map((a, i) => (
                    <option key={i} value={i}>{a.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const n = props.animations.length + 1;
                    props.onAnimations([
                      ...props.animations,
                      { name: `anim_${n}`, steps: [{ charset: sel, frame: 0, dur: 8 }], end: "normal" },
                    ]);
                    setSelA(props.animations.length);
                  }}
                >
                  + Nouvelle
                </button>
                {curA && (
                  <button
                    title="Supprimer l'animation (le build signale les commandes orphelines)"
                    onClick={() => {
                      props.onAnimations(props.animations.filter((_, i) => i !== curAi));
                      setSelA(0);
                    }}
                  >
                    ✕ Supprimer
                  </button>
                )}
              </div>
              {curA && (
                <>
                  <div className="row" style={{ alignItems: "center", gap: 8 }}>
                    <label style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                      Nom :
                      <input
                        value={curA.name}
                        style={{ width: 140 }}
                        onChange={(e) =>
                          setA({ ...curA, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })
                        }
                      />
                    </label>
                    <label style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                      À la fin :
                      <select
                        value={curA.end}
                        onChange={(e) => setA({ ...curA, end: e.target.value as CharsetAnimation["end"] })}
                      >
                        {END_LABELS.map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <span className="hint">aperçu :</span>
                    <canvas
                      ref={playRef}
                      width={FRAME_W * 2}
                      height={FRAME_H * 2}
                      style={{ border: "1px solid #000" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
                    {curA.steps.map((st, k) => (
                      <div key={k} className="row" style={{ alignItems: "center", gap: 6 }}>
                        <canvas
                          ref={(el) => { stepRefs.current[k] = el; }}
                          width={FRAME_W * 2}
                          height={FRAME_H * 2}
                          style={{ border: "1px solid #000", flex: "0 0 auto" }}
                        />
                        <select
                          value={st.charset}
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
                            style={{ width: 54 }}
                            onChange={(e) =>
                              setStep(k, { ...st, dur: Math.max(1, Math.min(255, Number(e.target.value) || 1)) })
                            }
                          />
                        </label>
                        <button
                          title="Retirer l'étape"
                          disabled={curA.steps.length <= 1}
                          onClick={() => setA({ ...curA, steps: curA.steps.filter((_, i) => i !== k) })}
                          style={{ width: 20, height: 20, padding: 0, lineHeight: "18px" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="row" style={{ alignItems: "center", gap: 8 }}>
                    <button
                      disabled={curA.steps.length >= 255}
                      onClick={() =>
                        setA({
                          ...curA,
                          steps: [...curA.steps, { ...curA.steps[curA.steps.length - 1] }],
                        })
                      }
                    >
                      + Ajouter une étape
                    </button>
                    <span className="hint">
                      Jouée par la commande « Jouer une animation de charset » (héros ou event).
                      Une étape sur un autre charset = transformation — ses blocs comptent dans
                      les 5 de la scène.
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
