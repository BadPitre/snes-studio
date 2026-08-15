// Charset extraction (CH1b): the import ONLY PICKS THE FRAMES — the
// sprite-animé gestures (pipette for the transparent colour, rectangles
// drawn over a free-form PNG sheet, each clamped to 16x24 and landing
// bottom-centred) build a frame POOL, in drawing order. Laying the walk
// (which frame is "Bas — Pas A", which side is mirrored) is NOT done
// here: that lives in Tools > Charsets, where the pool can be re-laid
// at any time without re-extracting. First shape had the 12 labeled
// slots in this modal; Bertrand asked for the split.

import { useEffect, useRef, useState } from "react";
import {
  FRAME_W,
  FRAME_H,
  POOL_MAX,
  buildPoolStrip,
  drawCell,
  type ExtractRect,
} from "../charset";
import type { Rgb } from "./TransparencyPickModal";

interface Props {
  bmp: ImageBitmap;
  onOk: (name: string, bytes: Uint8Array) => void;
  onClose: () => void;
}

export default function CharsetExtractModal(props: Props) {
  const [mode, setMode] = useState<"pipette" | "rect">("pipette");
  const [trans, setTrans] = useState<Rgb | null>(null);
  const [rects, setRects] = useState<ExtractRect[]>([]);
  const [drag, setDrag] = useState<ExtractRect | null>(null);
  const [name, setName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRefs = useRef<(HTMLCanvasElement | null)[]>([]);
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

  // the resulting pool, one cell canvas per frame
  useEffect(() => {
    const dd = dataRef.current;
    if (!dd) return;
    for (let n = 0; n < rects.length; n++) {
      const cv = frameRefs.current[n];
      if (!cv) continue;
      const cell = buildPoolStrip(dd, [rects[n]], trans);
      const ctx = cv.getContext("2d")!;
      drawCell(ctx, cell, { f: 0 }, 2);
    }
  }, [rects, trans, redraw]);

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

  return (
    <div className="modal-backdrop transpick-top" onClick={props.onClose}>
      <div
        className="modal transpick sprx"
        style={{ width: "min(96vw, 1180px)", maxWidth: "96vw", maxHeight: "94vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-title">
          Extraire les frames d'un charset
          <button className="modal-x" title="Fermer sans importer" onClick={props.onClose}>
            ✕
          </button>
        </div>
        <div className="row" style={{ alignItems: "center", gap: 8 }}>
          <label style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
            Nom :
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mon_perso"
              style={{ width: 160 }}
            />
          </label>
          <button
            style={{ ...modeStyle(mode === "pipette"), marginLeft: 10 }}
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
            title={`Tracer les frames — un rectangle (${FRAME_W}x${FRAME_H} max) par frame, dans l'ordre`}
          >
            ▭
          </button>
        </div>
        <div
          ref={viewRef}
          style={{ alignSelf: "center", maxWidth: "100%", maxHeight: "54vh", overflow: "auto" }}
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
              if (rects.length >= POOL_MAX) return;
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
            ? `${rects.length} frame(s) — le vivier (✕ sur une frame pour la retirer) :`
            : `Aucune frame — tracer des rectangles sur l'image (${POOL_MAX} max). La pose de la marche se fait ensuite dans Tools → Charsets.`}
        </span>
        <div style={{ alignSelf: "center", maxWidth: "100%", overflowX: "auto" }}>
          <div className="row" style={{ gap: 2, width: "max-content" }}>
            {rects.map((r, i) => (
              <div key={i} style={{ position: "relative" }}>
                <canvas
                  ref={(el) => { frameRefs.current[i] = el; }}
                  width={FRAME_W * 2}
                  height={FRAME_H * 2}
                  title={`Frame ${i + 1} (${r.w}x${r.h} en ${r.x}, ${r.y})`}
                  style={{ display: "block", border: "1px solid #000" }}
                />
                <button
                  title={`Retirer la frame ${i + 1}`}
                  onClick={() => setRects((rs) => rs.filter((_, k) => k !== i))}
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
              </div>
            ))}
          </div>
        </div>
        <div className="row" style={{ alignItems: "center", gap: 8 }}>
          <button
            disabled={!rects.length || !name.trim()}
            onClick={() => {
              const dd = dataRef.current;
              if (!dd) return;
              const strip = buildPoolStrip(dd, rects, trans);
              const cv = document.createElement("canvas");
              cv.width = strip.width;
              cv.height = strip.height;
              cv.getContext("2d")!.putImageData(strip, 0, 0);
              cv.toBlob(async (blob) => {
                if (!blob) return;
                props.onOk(name.trim(), new Uint8Array(await blob.arrayBuffer()));
              }, "image/png");
            }}
          >
            Importer le vivier
          </button>
          <span className="hint">15 couleurs + la transparence, comme toute planche.</span>
        </div>
      </div>
    </div>
  );
}
