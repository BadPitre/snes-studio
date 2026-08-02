// Transparent colour picker at import (S4): the chosen image is shown,
// you CLICK the colour to treat as transparent — the preview replaces it
// with a chequerboard. "Aucune" imports the image as is. The transform
// (pixels -> alpha 0) is done by applyTransparency; datagen recognises
// the alpha (index 0 reserved).

import { useEffect, useRef, useState } from "react";

export type Rgb = [number, number, number];

interface Props {
  bmp: ImageBitmap;
  // clicked colour (or null = no transparency) — Valider sends the state
  onOk: (color: Rgb | null) => void;
  onClose: () => void; // cancels the import
}

// "transparent pixel" chequerboard (the same look as image editors)
function checker(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#9a9a9a";
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = "#666";
  const h = s / 2;
  ctx.fillRect(x, y, h, h);
  ctx.fillRect(x + h, y + h, h, h);
}

export default function TransparencyPickModal(props: Props) {
  const [sel, setSel] = useState<Rgb | null>(null);
  const [hover, setHover] = useState<Rgb | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<ImageData | null>(null);

  const scale = Math.max(1, Math.min(3, Math.floor(480 / props.bmp.width), Math.floor(360 / props.bmp.height)));
  const w = props.bmp.width;
  const h = props.bmp.height;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    // source pixels (a single read)
    if (!dataRef.current) {
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext("2d")!;
      tctx.drawImage(props.bmp, 0, 0);
      dataRef.current = tctx.getImageData(0, 0, w, h);
    }
    const d = dataRef.current.data;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const transparent =
          d[i + 3] < 128 ||
          (sel !== null && d[i] === sel[0] && d[i + 1] === sel[1] && d[i + 2] === sel[2]);
        if (transparent) checker(ctx, x * scale, y * scale, scale <= 1 ? 2 : scale);
        else {
          ctx.fillStyle = `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
  }, [props.bmp, sel, scale, w, h]);

  const colorAt = (e: React.MouseEvent): Rgb | null => {
    const cv = canvasRef.current!;
    const b = cv.getBoundingClientRect();
    const x = Math.floor(((e.clientX - b.left) / b.width) * w);
    const y = Math.floor(((e.clientY - b.top) / b.height) * h);
    const dd = dataRef.current;
    if (!dd || x < 0 || y < 0 || x >= w || y >= h) return null;
    const i = (y * w + x) * 4;
    if (dd.data[i + 3] < 128) return null; // already transparent
    return [dd.data[i], dd.data[i + 1], dd.data[i + 2]];
  };

  const swatch = (c: Rgb | null, label: string) => (
    <span className="row" style={{ alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 18,
          height: 18,
          border: "1px solid #000",
          background: c ? `rgb(${c[0]},${c[1]},${c[2]})` : "transparent",
        }}
      />
      <span className="hint">
        {label}
        {c ? ` rgb(${c[0]}, ${c[1]}, ${c[2]})` : " —"}
      </span>
    </span>
  );

  return (
    <div className="modal-backdrop transpick-top" onClick={props.onClose}>
      <div className="modal transpick" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Import image</div>
        <div style={{ alignSelf: "center", maxWidth: "100%", overflow: "auto" }}>
          <canvas
            ref={canvasRef}
            width={w * scale}
            height={h * scale}
            style={{ cursor: "crosshair", border: "1px solid #000" }}
            onMouseMove={(e) => setHover(colorAt(e))}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => {
              const c = colorAt(e);
              if (c) setSel(c);
            }}
          />
        </div>
        <div className="row" style={{ alignItems: "center" }}>
          {swatch(hover, "Sous le curseur :")}
          {swatch(sel, "Choisie :")}
          {sel && (
            <button onClick={() => setSel(null)} title="Annuler le choix de couleur">
              ✕ Retirer
            </button>
          )}
        </div>
        <div className="row">
          <button onClick={() => props.onOk(sel)}>Valider</button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

// Rewrites a PNG with the given colour punched to alpha 0 (the output
// format is an RGBA PNG — datagen indexes automatically, alpha < 128 =
// index 0, transparent). Returns the bytes of the new PNG.
export async function applyTransparency(
  bytes: Uint8Array,
  color: Rgb
): Promise<Uint8Array> {
  const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: "image/png" }));
  const cv = document.createElement("canvas");
  cv.width = bmp.width;
  cv.height = bmp.height;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4)
    if (d[i] === color[0] && d[i + 1] === color[1] && d[i + 2] === color[2]) d[i + 3] = 0;
  ctx.putImageData(img, 0, 0);
  const blob: Blob = await new Promise((res, rej) =>
    cv.toBlob((b) => (b ? res(b) : rej(new Error("encodage PNG"))), "image/png")
  );
  return new Uint8Array(await blob.arrayBuffer());
}
