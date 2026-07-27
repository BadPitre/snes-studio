// Autotiles RPG Maker 2003 : PNG 48x64 = 12 tiles 16x16.
// (0,0) îlot d'aperçu, (1,0) inutilisé, (2,0) coins internes,
// rangées 1-3 = bloc 9-slice. Chaque quart 8x8 d'une cellule choisit sa
// pièce selon ses voisins de MÊME autotile (bord de map = même).
// MÊME ALGORITHME que tools/datagen/src/tileset.rs — toute évolution ici
// doit être répercutée là-bas.

// pièce : 0 coin externe, 1 bord horizontal, 2 bord vertical,
// 3 coin interne, 4 centre
function quarterPiece(v: boolean, h: boolean, d: boolean): number {
  if (!v && !h) return 0;
  if (!v && h) return 1;
  if (v && !h) return 2;
  return d ? 4 : 3;
}

// position (col,row) de la pièce dans le gabarit, pour le quart (qx,qy)
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

// Dessine la cellule autotile (dx,dy taille size px) d'après `same(ox,oy)` :
// le voisin (offset en tiles) est-il le même autotile ?
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

// Aperçu palette : la tile îlot (0,0) du gabarit
export function drawAutotilePreview(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  dx: number,
  dy: number,
  size: number
) {
  ctx.drawImage(img, 0, 0, 16, 16, dx, dy, size, size);
}
