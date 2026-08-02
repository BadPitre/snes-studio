// RPG Maker 2003 autotiles: a 48x64 PNG = 12 tiles of 16x16.
// (0,0) preview islet, (1,0) unused, (2,0) inner corners,
// rows 1-3 = the 9-slice block. Each 8x8 quarter of a cell picks its
// piece from its neighbours of the SAME autotile (map edge = same).
// THE SAME ALGORITHM as tools/datagen/src/tileset.rs — any change here
// must be mirrored there.

// piece: 0 outer corner, 1 horizontal edge, 2 vertical edge,
// 3 inner corner, 4 centre
function quarterPiece(v: boolean, h: boolean, d: boolean): number {
  if (!v && !h) return 0;
  if (!v && h) return 1;
  if (v && !h) return 2;
  return d ? 4 : 3;
}

// position (col,row) of the piece in the template, for the quarter (qx,qy)
function piecePos(p: number, qx: number, qy: number): [number, number] {
  const cx = qx === 1 ? 2 : 0;
  const ry = qy === 1 ? 3 : 1;
  switch (p) {
    case 0: return [cx, ry];
    case 1: return [1, ry];
    case 2: return [cx, 2];
    case 3: return [2, 0];
    default: return [1, 2];
  }
}

// Draws the autotile cell (dx,dy, size px) from `same(ox,oy)`: is the
// neighbour (offset in tiles) the same autotile?
export function drawAutotileCell(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  dx: number,
  dy: number,
  size: number,
  same: (ox: number, oy: number) => boolean
) {
  const n = same(0, -1);
  const e = same(1, 0);
  const s = same(0, 1);
  const w = same(-1, 0);
  const q = size / 2;
  for (let qy = 0; qy < 2; qy++) {
    for (let qx = 0; qx < 2; qx++) {
      const v = qy === 0 ? n : s;
      const h = qx === 0 ? w : e;
      const d = same(qx === 0 ? -1 : 1, qy === 0 ? -1 : 1);
      const [col, row] = piecePos(quarterPiece(v, h, d), qx, qy);
      ctx.drawImage(
        img,
        col * 16 + qx * 8,
        row * 16 + qy * 8,
        8,
        8,
        dx + qx * q,
        dy + qy * q,
        q,
        q
      );
    }
  }
}

// Palette preview: the islet tile (0,0) of the template
export function drawAutotilePreview(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  dx: number,
  dy: number,
  size: number
) {
  ctx.drawImage(img, 0, 0, 16, 16, dx, dy, size, size);
}
