// Sprite-animé extraction (RM-extract): a PNG sheet is shown, you pick
// the transparent colour with the pipette, then DRAW RECTANGLES over
// the frames to extract — each rectangle becomes one 32x32 cell of the
// resulting strip, in drawing order. The strip goes through the
// ordinary sprite-animé import, so it is validated and recorded like a
// hand-made sheet.
//
// Rules the tool enforces while you draw:
//  - a rectangle is clamped to 32x32 (the cell size — see vignette.h);
//  - at most 64 frames (one ROM bank of cells, datagen's ceiling);
//  - each frame lands bottom-centred in its cell (feet on the ground,
//    the charset helper's convention).

import { useEffect, useRef, useState } from "react";
import type { Rgb } from "./TransparencyPickModal";

export interface ExtractRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  bmp: ImageBitmap;
  onOk: (name: string, bytes: Uint8Array) => void;
  onClose: () => void;
}

const CELL = 32;
const MAX_FRAMES = 64; // one ROM bank of cells — datagen's own ceiling

// The pure cut: source pixels -> strip pixels (n cells of 32x32, each
// rectangle bottom-centred, the transparent colour punched to alpha 0).
// Kept free of canvas state so it can be tested off the DOM.
export function buildStrip(
  src: ImageData,
  rects: ExtractRect[],
  trans: Rgb | null
): ImageData {
  const out = new ImageData(rects.length * CELL, CELL);
  const s = src.data;
  const d = out.data;
  for (let n = 0; n < rects.length; n++) {
    const r = rects[n];
    const ox = n * CELL + ((CELL - r.w) >> 1); // centred horizontally
    const oy = CELL - r.h; // feet on the cell's bottom edge
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

function checker(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#9a9a9a";
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = "#666";
  const h = s / 2;
  ctx.fillRect(x, y, h, h);
  ctx.fillRect(x + h, y + h, h, h);
}

export default function SpriteExtractModal(props: Props) {
  const [mode, setMode] = useState<"pipette" | "rect">("pipette");
  const [trans, setTrans] = useState<Rgb | null>(null);
  const [rects, setRects] = useState<ExtractRect[]>([]);
  const [drag, setDrag] = useState<ExtractRect | null>(null);
  const [name, setName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<ImageData | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const w = props.bmp.width;
  const h = props.bmp.height;
  // zoom: starts on a comfortable automatic fit, then Ctrl+wheel
  const [scale, setScale] = useState(() =>
    Math.max(1, Math.min(3, Math.floor(560 / props.bmp.width), Math.floor(380 / props.bmp.height)))
  );

  // Ctrl+wheel zoom on the sheet. A NATIVE listener: React (and the
  // browser) treat wheel events as passive, and a passive handler
  // cannot preventDefault — the page would pinch-zoom instead.
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

  // the two mode buttons carry their state INLINE — the shared .active
  // class only styles tab bars, and an invisible mode is how "I picked
  // the colour and now the rectangles won't draw" happens
  const modeStyle = (on: boolean): React.CSSProperties => ({
    fontSize: 16,
    width: 36,
    height: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...(on ? { background: "var(--sel)", color: "var(--sel-text)", fontWeight: 700 } : {}),
  });

  // a pipette the emoji set does not have — a 14 px eyedropper
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
  // into an offscreen 1:1 canvas (a putImageData, not a fillRect per
  // pixel). The interactive redraw below only blits it. The first
  // version repainted every pixel of the sheet on every mouse move of
  // a drag — the lag made precise rectangles impossible (reported).
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
    const drawRect = (r: ExtractRect, n: number, live: boolean) => {
      ctx.strokeStyle = live ? "#ffd24a" : "#7a5cff";
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x * scale + 0.5, r.y * scale + 0.5, r.w * scale - 1, r.h * scale - 1);
      if (!live) {
        ctx.fillStyle = "#7a5cff";
        ctx.fillRect(r.x * scale, r.y * scale, 16, 12);
        ctx.fillStyle = "#fff";
        ctx.font = "10px monospace";
        ctx.fillText(String(n + 1), r.x * scale + 5, r.y * scale + 10);
      }
    };
    rects.forEach((r, n) => drawRect(r, n, false));
    if (drag) drawRect(drag, rects.length, true);
  }, [redraw, rects, drag, scale, w, h]);

  // the resulting strip, live
  useEffect(() => {
    const cv = previewRef.current;
    const dd = dataRef.current;
    if (!cv || !dd) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const n = Math.max(1, rects.length);
    for (let i = 0; i < n; i++)
      for (let cy = 0; cy < 4; cy++)
        for (let cx = 0; cx < 4; cx++)
          checker(ctx, (i * CELL + cx * 8) * 2, cy * 8 * 2, 16);
    if (!rects.length) return;
    const strip = buildStrip(dd, rects, trans);
    const tmp = document.createElement("canvas");
    tmp.width = strip.width;
    tmp.height = strip.height;
    tmp.getContext("2d")!.putImageData(strip, 0, 0);
    ctx.drawImage(tmp, 0, 0, strip.width * 2, strip.height * 2);
    ctx.strokeStyle = "#7a5cff";
    for (let i = 1; i < rects.length; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL * 2 + 0.5, 0);
      ctx.lineTo(i * CELL * 2 + 0.5, CELL * 2);
      ctx.stroke();
    }
  }, [rects, trans]);

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
    if (rw > CELL) {
      if (x1 < x0) x = x0 - CELL + 1;
      rw = CELL;
    }
    if (rh > CELL) {
      if (y1 < y0) y = y0 - CELL + 1;
      rh = CELL;
    }
    return { x, y, w: rw, h: rh };
  };

  return (
    <div className="modal-backdrop transpick-top" onClick={props.onClose}>
      <div
        className="modal transpick sprx"
        style={{ width: "min(96vw, 1180px)", maxWidth: "96vw", maxHeight: "94vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ alignItems: "center" }}>
          <div className="panel-title" style={{ flex: 1 }}>
            Extraire des sprites animés d'une planche
          </div>
          <button
            onClick={props.onClose}
            title="Fermer sans importer"
            style={{ width: 26, height: 24, padding: 0, marginLeft: "auto" }}
          >
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
          <button
            style={modeStyle(mode === "rect")}
            onClick={() => setMode("rect")}
            title="Tracer les frames — un rectangle (32x32 max) autour de chaque frame, dans l'ordre"
          >
            ▭
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
              style={{ width: 24 }}
            >
              ✕
            </button>
          )}
        </div>
        <div
          ref={viewRef}
          style={{ alignSelf: "center", maxWidth: "100%", maxHeight: "58vh", overflow: "auto" }}
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
                  setMode("rect"); /* the colour is picked: the natural
                     next gesture is drawing frames — switch for the
                     author instead of waiting for a second click */
                }
                return;
              }
              if (rects.length >= MAX_FRAMES) return;
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
              if (drag && drag.w > 1 && drag.h > 1) setRects((r) => [...r, drag]);
              dragStart.current = null;
              setDrag(null);
            }}
            onMouseLeave={() => {
              dragStart.current = null;
              setDrag(null);
            }}
          />
        </div>
        <span className="hint">
          {rects.length
            ? `${rects.length} frame(s) — la planche (✕ sur une frame pour la retirer) :`
            : "Aucune frame — tracer des rectangles sur l'image (64 max)."}
        </span>
        <div style={{ alignSelf: "center", maxWidth: "100%", overflowX: "auto" }}>
          <div style={{ position: "relative", width: Math.max(1, rects.length) * CELL * 2 }}>
            <canvas
              ref={previewRef}
              width={Math.max(1, rects.length) * CELL * 2}
              height={CELL * 2}
              style={{ border: "1px solid #000", display: "block" }}
            />
            {rects.map((r, i) => (
              <button
                key={i}
                title={`Retirer la frame ${i + 1} (${r.w}x${r.h} en ${r.x}, ${r.y})`}
                onClick={() => setRects((rs) => rs.filter((_, k) => k !== i))}
                style={{
                  position: "absolute",
                  left: i * CELL * 2 + CELL * 2 - 18,
                  top: 2,
                  width: 16,
                  height: 16,
                  padding: 0,
                  lineHeight: "14px",
                  fontSize: 10,
                }}
              >
                ✕
              </button>
            ))}
          </div>
        </div>
        <div className="row" style={{ alignItems: "center", gap: 8 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Nom :
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mon_sprite"
              style={{ width: 160 }}
            />
          </label>
          <button
            disabled={!rects.length || !name.trim()}
            onClick={() => {
              const dd = dataRef.current;
              if (!dd) return;
              const strip = buildStrip(dd, rects, trans);
              const cv = document.createElement("canvas");
              cv.width = strip.width;
              cv.height = strip.height;
              cv.getContext("2d")!.putImageData(strip, 0, 0);
              cv.toBlob(async (blob) => {
                if (!blob) return;
                const bytes = new Uint8Array(await blob.arrayBuffer());
                const nm = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
                props.onOk(`${nm}.png`, bytes);
              }, "image/png");
            }}
          >
            Importer
          </button>
          <span className="hint">15 couleurs + la transparence, comme toute planche.</span>
        </div>
      </div>
    </div>
  );
}
