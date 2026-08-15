// Charset extraction (CH1): the sprite-animé extractor's gestures —
// pipette for the transparent colour, rectangles drawn over a free-form
// PNG sheet — pointed at the charset's 12 LABELED SLOTS (4 directions x
// 3 steps) instead of an open-ended strip. The next empty slot is the
// target; clicking a cell of the grid retargets it, so any frame can be
// redone. An empty slot imports blank — a two-direction character is
// legal.
//
// Rules the tool enforces while you draw:
//  - a rectangle is clamped to a frame (16x24, formats.h);
//  - each frame lands bottom-centred in its slot (feet on the ground,
//    the charset convention shared with buildStrip);
//  - the preview WALKS (0/A/0/B per direction): a swapped step A/B is
//    invisible in a grid and obvious in motion.
//
// The output is the 72x128 RM2003 sheet `datagen import-charset`
// already accepts — the composition mirrors charset.rs (RM_ROW/RM_COL,
// the 16x24 frame at +4,+8 of its 24x32 cell), so this modal changes
// nothing downstream: the block/name window and the CLI stay as they
// are.

import { useEffect, useRef, useState } from "react";
import type { Rgb } from "./TransparencyPickModal";

export interface ExtractRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRAME_W = 16;
export const FRAME_H = 24;

// Slot order is the ENGINE's block order (formats.h DIR_*): frame =
// dir*3 + step. The labels are what the author reads.
const DIRS = ["Bas", "Haut", "Gauche", "Droite"];
const STEPS = ["Repos", "Pas A", "Pas B"];

// Our block order to the RM2003 sheet — the same tables as
// tools/datagen/src/charset.rs and exportCharset (App.tsx), so the
// round trip through import-charset is exact.
const RM_ROW = [2, 0, 3, 1];
const RM_COL = [1, 0, 2];

// The pure composition: source pixels + the 12 slot rectangles -> the
// 72x128 RM2003 sheet (each rectangle bottom-centred in its 16x24
// frame, pasted at the +4,+8 crop point of its 24x32 RM cell; the
// picked colour punched to alpha 0). Kept free of canvas state, like
// buildStrip.
export function buildCharsetSheet(
  src: ImageData,
  slots: (ExtractRect | null)[],
  trans: Rgb | null
): ImageData {
  const out = new ImageData(72, 128);
  const s = src.data;
  const d = out.data;
  for (let dir = 0; dir < 4; dir++)
    for (let st = 0; st < 3; st++) {
      const r = slots[dir * 3 + st];
      if (!r) continue;
      const ox = RM_COL[st] * 24 + 4 + ((FRAME_W - r.w) >> 1);
      const oy = RM_ROW[dir] * 32 + 8 + (FRAME_H - r.h);
      for (let y = 0; y < r.h; y++)
        for (let x = 0; x < r.w; x++) {
          const si = ((r.y + y) * src.width + r.x + x) * 4;
          if (s[si + 3] < 128) continue; // already a hole
          if (
            trans &&
            s[si] === trans[0] &&
            s[si + 1] === trans[1] &&
            s[si + 2] === trans[2]
          )
            continue; // the picked colour is the sheet's background
          const di = ((oy + y) * out.width + ox + x) * 4;
          d[di] = s[si];
          d[di + 1] = s[si + 1];
          d[di + 2] = s[si + 2];
          d[di + 3] = 255;
        }
    }
  return out;
}

function checker(ctx: CanvasRenderingContext2D, w: number, h: number, s: number) {
  for (let y = 0; y < h; y += s)
    for (let x = 0; x < w; x += s) {
      ctx.fillStyle = ((x ^ y) / s) & 1 ? "#666" : "#9a9a9a";
      ctx.fillRect(x, y, s, s);
    }
}

// Draws slot rectangle r punched of its transparency, scaled by z, at
// the bottom-centre of a FRAME_W x FRAME_H canvas — the shared cell
// renderer of the grid and the walking preview.
function drawSlot(
  ctx: CanvasRenderingContext2D,
  src: ImageData,
  r: ExtractRect | null,
  trans: Rgb | null,
  z: number
) {
  checker(ctx, FRAME_W * z, FRAME_H * z, 4);
  if (!r) return;
  const s = src.data;
  const ox = (FRAME_W - r.w) >> 1;
  const oy = FRAME_H - r.h;
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const si = ((r.y + y) * src.width + r.x + x) * 4;
      if (s[si + 3] < 128) continue;
      if (
        trans &&
        s[si] === trans[0] &&
        s[si + 1] === trans[1] &&
        s[si + 2] === trans[2]
      )
        continue;
      ctx.fillStyle = `rgb(${s[si]},${s[si + 1]},${s[si + 2]})`;
      ctx.fillRect((ox + x) * z, (oy + y) * z, z, z);
    }
}

interface Props {
  bmp: ImageBitmap;
  onOk: (bytes: Uint8Array) => void;
  onClose: () => void;
}

export default function CharsetExtractModal(props: Props) {
  const [mode, setMode] = useState<"pipette" | "rect">("pipette");
  const [trans, setTrans] = useState<Rgb | null>(null);
  const [slots, setSlots] = useState<(ExtractRect | null)[]>(() =>
    Array.from({ length: 12 }, () => null)
  );
  const [cur, setCur] = useState(0);
  const [drag, setDrag] = useState<ExtractRect | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const walkRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const dataRef = useRef<ImageData | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const w = props.bmp.width;
  const h = props.bmp.height;
  const [scale, setScale] = useState(() =>
    Math.max(1, Math.min(3, Math.floor(560 / props.bmp.width), Math.floor(380 / props.bmp.height)))
  );

  // Ctrl+wheel zoom — a NATIVE listener, React's wheel handlers are
  // passive and cannot preventDefault (SpriteExtractModal's lesson).
  const viewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setScale((z) => Math.max(1, Math.min(8, z + (e.deltaY < 0 ? 1 : -1))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const modeStyle = (on: boolean): React.CSSProperties => ({
    fontSize: 16,
    width: 36,
    height: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...(on ? { background: "var(--sel)", color: "var(--sel-text)", fontWeight: 700 } : {}),
  });

  const Pipette = (
    <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
      <path
        d="M13.6 1.4a2.2 2.2 0 0 0-3.1 0L8.6 3.3l-.7-.7-1.2 1.2.7.7-5.2 5.2-.9 2.9 2.9-.9 5.2-5.2.7.7 1.2-1.2-.7-.7 1.9-1.9a2.2 2.2 0 0 0 0-3.1zM3.5 11.2l-1 .3.3-1 4.8-4.8.7.7-4.8 4.8z"
        fill="currentColor"
      />
    </svg>
  );

  // source pixels, read once
  useEffect(() => {
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext("2d")!;
    tctx.drawImage(props.bmp, 0, 0);
    dataRef.current = tctx.getImageData(0, 0, w, h);
  }, [props.bmp, w, h]);

  const [redraw, setRedraw] = useState(0);

  // The sheet with its transparency, rendered ONCE per colour change
  // into an offscreen 1:1 canvas; the interactive redraw only blits it
  // (repainting per pixel per mouse move made rectangles undrawable —
  // SpriteExtractModal's reported lag).
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const dd = dataRef.current;
    if (!dd) return;
    const base = document.createElement("canvas");
    base.width = w;
    base.height = h;
    const img = new ImageData(w, h);
    const s = dd.data;
    const d = img.data;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const transparent =
          s[i + 3] < 128 ||
          (trans !== null &&
            s[i] === trans[0] && s[i + 1] === trans[1] && s[i + 2] === trans[2]);
        if (transparent) {
          const g = ((x ^ y) & 1) ? 0x66 : 0x9a; /* pixel chequer */
          d[i] = g; d[i + 1] = g; d[i + 2] = g; d[i + 3] = 255;
        } else {
          d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = 255;
        }
      }
    base.getContext("2d")!.putImageData(img, 0, 0);
    baseRef.current = base;
    setRedraw((k) => k + 1); /* the blit effect below re-runs */
  }, [props.bmp, trans, w, h]);

  // the blit + rectangles: cheap, runs on every drag step
  useEffect(() => {
    const cv = canvasRef.current;
    const base = baseRef.current;
    if (!cv || !base) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, w * scale, h * scale);
    const drawRect = (r: ExtractRect, label: string, live: boolean) => {
      ctx.strokeStyle = live ? "#ffd24a" : "#7a5cff";
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x * scale + 0.5, r.y * scale + 0.5, r.w * scale - 1, r.h * scale - 1);
      if (!live) {
        ctx.fillStyle = "#7a5cff";
        ctx.fillRect(r.x * scale, r.y * scale, 8 + label.length * 6, 12);
        ctx.fillStyle = "#fff";
        ctx.font = "10px monospace";
        ctx.fillText(label, r.x * scale + 4, r.y * scale + 10);
      }
    };
    slots.forEach((r, n) => {
      if (r) drawRect(r, `${DIRS[n / 3 | 0]} ${STEPS[n % 3]}`, false);
    });
    if (drag) drawRect(drag, "", true);
  }, [redraw, slots, drag, scale, w, h]);

  // the 12-slot grid, one small canvas per cell
  useEffect(() => {
    const dd = dataRef.current;
    if (!dd) return;
    for (let n = 0; n < 12; n++) {
      const cv = cellRefs.current[n];
      if (!cv) continue;
      drawSlot(cv.getContext("2d")!, dd, slots[n], trans, 2);
    }
  }, [slots, trans, redraw]);

  // the walking preview: 4 canvases cycling 0/A/0/B at the engine's
  // pace (a step every 8 display frames — 7.5 steps per second)
  useEffect(() => {
    let phase = 0;
    const timer = window.setInterval(() => {
      const dd = dataRef.current;
      if (!dd) return;
      phase = (phase + 1) & 3;
      const step = phase & 1 ? 1 + (phase >> 1) : 0;
      for (let dir = 0; dir < 4; dir++) {
        const cv = walkRefs.current[dir];
        if (!cv) continue;
        drawSlot(cv.getContext("2d")!, dd, slots[dir * 3 + step], trans, 2);
      }
    }, 133);
    return () => window.clearInterval(timer);
  }, [slots, trans]);

  const pixelAt = (e: React.MouseEvent) => {
    const cv = canvasRef.current!;
    const b = cv.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(w - 1, Math.floor(((e.clientX - b.left) / b.width) * w))),
      y: Math.max(0, Math.min(h - 1, Math.floor(((e.clientY - b.top) / b.height) * h))),
    };
  };

  const clampRect = (x0: number, y0: number, x1: number, y1: number): ExtractRect => {
    let x = Math.min(x0, x1);
    let y = Math.min(y0, y1);
    let rw = Math.abs(x1 - x0) + 1;
    let rh = Math.abs(y1 - y0) + 1;
    if (rw > FRAME_W) {
      if (x1 < x0) x = x0 - FRAME_W + 1;
      rw = FRAME_W;
    }
    if (rh > FRAME_H) {
      if (y1 < y0) y = y0 - FRAME_H + 1;
      rh = FRAME_H;
    }
    return { x, y, w: rw, h: rh };
  };

  const filled = slots.filter(Boolean).length;

  return (
    <div className="modal-backdrop transpick-top" onClick={props.onClose}>
      <div
        className="modal transpick sprx"
        style={{ width: "min(96vw, 1180px)", maxWidth: "96vw", maxHeight: "94vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-title">
          Extraire un charset d'une planche
          <button className="modal-x" title="Fermer sans importer" onClick={props.onClose}>
            ✕
          </button>
        </div>
        <div className="row" style={{ alignItems: "center", gap: 8 }}>
          <button
            style={modeStyle(mode === "pipette")}
            onClick={() => setMode("pipette")}
            title="Couleur de transparence — cliquer la couleur de fond sur la planche"
          >
            {Pipette}
          </button>
          <span
            style={{
              width: 18,
              height: 18,
              border: "1px solid #000",
              background: trans ? `rgb(${trans[0]},${trans[1]},${trans[2]})` : "transparent",
            }}
          />
          <span className="hint">
            {trans
              ? `transparence : rgb(${trans[0]}, ${trans[1]}, ${trans[2]})`
              : "transparence : — (pipette, puis cliquer le fond)"}
          </span>
          {trans && (
            <button
              onClick={() => setTrans(null)}
              title="Retirer la couleur de transparence"
              style={{
                width: 20,
                height: 20,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          )}
          <button
            style={{ ...modeStyle(mode === "rect"), marginLeft: 10 }}
            onClick={() => setMode("rect")}
            title={`Tracer les frames — un rectangle (${FRAME_W}x${FRAME_H} max) par case, la case cible est surlignée`}
          >
            ▭
          </button>
          <span className="hint">
            case cible : <b>{DIRS[cur / 3 | 0]} — {STEPS[cur % 3]}</b> (cliquer une case de la
            grille pour la refaire)
          </span>
        </div>
        <div
          ref={viewRef}
          style={{ alignSelf: "center", maxWidth: "100%", maxHeight: "48vh", overflow: "auto" }}
        >
          <canvas
            ref={canvasRef}
            width={w * scale}
            height={h * scale}
            style={{ cursor: "crosshair", border: "1px solid #000" }}
            onMouseDown={(e) => {
              const p = pixelAt(e);
              if (mode === "pipette") {
                const dd = dataRef.current;
                if (!dd) return;
                const i = (p.y * w + p.x) * 4;
                if (dd.data[i + 3] >= 128) {
                  setTrans([dd.data[i], dd.data[i + 1], dd.data[i + 2]]);
                  setMode("rect"); /* the colour is picked: drawing is
                     the natural next gesture */
                }
                return;
              }
              dragStart.current = p;
              setDrag({ x: p.x, y: p.y, w: 1, h: 1 });
            }}
            onMouseMove={(e) => {
              const st = dragStart.current;
              if (!st) return;
              const p = pixelAt(e);
              setDrag(clampRect(st.x, st.y, p.x, p.y));
            }}
            onMouseUp={() => {
              if (drag && drag.w > 1 && drag.h > 1) {
                const d2 = drag;
                setSlots((sl) => {
                  const next = sl.slice();
                  next[cur] = d2;
                  return next;
                });
                // advance to the NEXT empty slot; stay put when the
                // grid is full (the author is redoing cells by click)
                setCur((c) => {
                  for (let k = 1; k <= 12; k++) {
                    const n = (c + k) % 12;
                    if (!slots[n] && n !== c) return n;
                  }
                  return c;
                });
              }
              dragStart.current = null;
              setDrag(null);
            }}
            onMouseLeave={() => {
              dragStart.current = null;
              setDrag(null);
            }}
          />
        </div>
        <div className="row" style={{ alignItems: "flex-start", gap: 24, alignSelf: "center" }}>
          <div>
            <span className="hint">Les 12 cases (✕ pour en vider une) :</span>
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
                      return (
                        <td key={n} style={{ position: "relative", padding: 0 }}>
                          <canvas
                            ref={(el) => { cellRefs.current[n] = el; }}
                            width={FRAME_W * 2}
                            height={FRAME_H * 2}
                            title={`${DIRS[d]} — ${st}`}
                            onClick={() => setCur(n)}
                            style={{
                              display: "block",
                              cursor: "pointer",
                              border: n === cur ? "2px solid #ffd24a" : "2px solid #000",
                            }}
                          />
                          {slots[n] && (
                            <button
                              title="Vider la case"
                              onClick={() =>
                                setSlots((sl) => {
                                  const next = sl.slice();
                                  next[n] = null;
                                  return next;
                                })
                              }
                              style={{
                                position: "absolute",
                                right: 0,
                                top: 0,
                                width: 14,
                                height: 14,
                                padding: 0,
                                lineHeight: "12px",
                                fontSize: 9,
                              }}
                            >
                              ✕
                            </button>
                          )}
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
        <div className="row" style={{ alignItems: "center", gap: 8 }}>
          <button
            disabled={!filled}
            onClick={() => {
              const dd = dataRef.current;
              if (!dd) return;
              const sheet = buildCharsetSheet(dd, slots, trans);
              const cv = document.createElement("canvas");
              cv.width = sheet.width;
              cv.height = sheet.height;
              cv.getContext("2d")!.putImageData(sheet, 0, 0);
              cv.toBlob(async (blob) => {
                if (!blob) return;
                props.onOk(new Uint8Array(await blob.arrayBuffer()));
              }, "image/png");
            }}
          >
            Importer
          </button>
          <span className="hint">
            {filled}/12 case(s) remplie(s) — une case vide reste transparente. 15 couleurs + la
            transparence, comme toute planche.
          </span>
        </div>
      </div>
    </div>
  );
}
