// Charset pixel math shared by the extractor (CharsetExtractModal) and
// the Tools > Charsets window (CharsetsModal): the frame POOL strip cut
// at import, and the 72x128 RM2003 sheet baked from the pool + the
// 12-cell layout — the sheet `datagen import-charset` already accepts,
// so the CLI and the engine see nothing new. All DOM-free, like
// SpriteExtractModal's buildStrip.

import type { Rgb } from "./components/TransparencyPickModal";

export interface ExtractRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// What a walk cell shows: a pool frame, optionally MIRRORED — one drawn
// side serves left AND right (Bertrand's ask). Persisted per block in
// project.json (charset_pools, editor only).
export interface CharsetCellRef {
  f: number;
  flip?: boolean;
}

export const FRAME_W = 16;
export const FRAME_H = 24;
export const POOL_MAX = 64; // frames per pool — editor comfort, not VRAM

// Our block order to the RM2003 sheet — the same tables as
// tools/datagen/src/charset.rs and exportCharset (App.tsx), so the
// round trip through import-charset is exact.
const RM_ROW = [2, 0, 3, 1]; // d = down, up, left, right
const RM_COL = [1, 0, 2]; // s = idle, step A, step B

// The pool strip: n rectangles cut from the source sheet, each
// bottom-centred in a 16x24 cell, the transparent colour punched.
export function buildPoolStrip(
  src: ImageData,
  rects: ExtractRect[],
  trans: Rgb | null
): ImageData {
  const out = new ImageData(rects.length * FRAME_W, FRAME_H);
  for (let n = 0; n < rects.length; n++)
    blitRect(src, rects[n], trans, out, n * FRAME_W, 0, false);
  return out;
}

// The RM2003 sheet: each cell's pool frame pasted (flipped if asked) at
// its RM position. Cells may be null — a two-direction character is
// legal, the empty frames stay transparent.
export function composeRm2003(
  pool: ImageData,
  cells: (CharsetCellRef | null)[]
): ImageData {
  const out = new ImageData(72, 128);
  const frames = Math.floor(pool.width / FRAME_W);
  for (let d = 0; d < 4; d++)
    for (let s = 0; s < 3; s++) {
      const c = cells[d * 3 + s];
      if (!c || c.f >= frames) continue;
      const r = { x: c.f * FRAME_W, y: 0, w: FRAME_W, h: FRAME_H };
      blitRect(pool, r, null, out, RM_COL[s] * 24 + 4, RM_ROW[d] * 32 + 8, !!c.flip);
    }
  return out;
}

// Copies rect r of src into dst at (dx,dy), bottom-centred in a 16x24
// frame, mirrored horizontally when flip is set; alpha holes and the
// transparent colour stay holes.
function blitRect(
  src: ImageData,
  r: ExtractRect,
  trans: Rgb | null,
  dst: ImageData,
  dx: number,
  dy: number,
  flip: boolean
): void {
  const s = src.data;
  const d = dst.data;
  const ox = dx + ((FRAME_W - r.w) >> 1);
  const oy = dy + (FRAME_H - r.h);
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
      const tx = flip ? r.w - 1 - x : x;
      const di = ((oy + y) * dst.width + ox + tx) * 4;
      d[di] = s[si];
      d[di + 1] = s[si + 1];
      d[di + 2] = s[si + 2];
      d[di + 3] = 255;
    }
}

// Draws pool frame c into a (FRAME_W*z) x (FRAME_H*z) canvas over a
// chequer — the cell renderer shared by the extractor's strip, the
// window's grid and the walking previews.
export function drawCell(
  ctx: CanvasRenderingContext2D,
  pool: ImageData | null,
  c: CharsetCellRef | null,
  z: number
): void {
  for (let y = 0; y < FRAME_H * z; y += 4)
    for (let x = 0; x < FRAME_W * z; x += 4) {
      ctx.fillStyle = ((x ^ y) / 4) & 1 ? "#666" : "#9a9a9a";
      ctx.fillRect(x, y, 4, 4);
    }
  if (!pool || !c || c.f * FRAME_W >= pool.width) return;
  const s = pool.data;
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      const si = (y * pool.width + c.f * FRAME_W + x) * 4;
      if (s[si + 3] < 128) continue;
      ctx.fillStyle = `rgb(${s[si]},${s[si + 1]},${s[si + 2]})`;
      const tx = c.flip ? FRAME_W - 1 - x : x;
      ctx.fillRect(tx * z, y * z, z, z);
    }
}
