// ROM ripper (X0 stages X1/X2): reading SNES graphics out of a raw byte
// range — a ROM, or any file the author points at.
//
// Everything here is pure: bytes in, indices or PNG bytes out. No React,
// no Tauri, no project. The window on top of it (RomRipModal) owns the
// interaction, and resources.ts owns what happens after the extraction —
// the ripper never writes to project.json.
//
// Two decisions worth knowing about.
//
// Decoding runs HERE and not in a datagen sidecar: a round-trip to a
// native binary on every scroll tick would make the viewer unusable, and
// the whole job is bit shuffling over a Uint8Array. Only the visible
// window is ever decoded.
//
// The PNG written out is INDEXED, not truecolour, even though datagen
// accepts both. An indexed PNG keeps the palette order the author chose,
// and that order is load-bearing: gfx.rs reads raw indices, and a font
// or a windowskin means "0 transparent, 1 background, 2 text, 3 accent"
// positionally. A truecolour PNG would have datagen re-index by
// first-seen scan order, which is not the same thing.

export type Rgb = [number, number, number];

// ---- the file --------------------------------------------------------

export interface Rom {
  name: string;
  raw: Uint8Array; // exactly what was read from disk
  header: number; // copier-header bytes skipped (0 or 512)
  bytes: Uint8Array; // raw without the header — every offset is in here
}

// A copier header is 512 bytes glued in front of a ROM whose real size is
// a whole number of kilobytes. Detected, shown, and overridable: a
// mangled dump can lie about it.
export function loadRom(name: string, raw: Uint8Array): Rom {
  return withHeader({ name, raw, header: 0, bytes: raw }, raw.length % 1024 === 512 ? 512 : 0);
}

export function withHeader(rom: Rom, header: number): Rom {
  const h = Math.max(0, Math.min(header, rom.raw.length));
  return { ...rom, header: h, bytes: h ? rom.raw.subarray(h) : rom.raw };
}

// ---- tile formats ----------------------------------------------------

export type Bpp = "1bpp" | "2bpp" | "4bpp" | "8bpp" | "m7";

export interface BppDef {
  id: Bpp;
  label: string;
  bytes: number; // bytes per 8x8 tile
  colors: number; // palette entries the format can address
}

export const BPPS: BppDef[] = [
  { id: "1bpp", label: "1 bpp — 2 couleurs (fontes)", bytes: 8, colors: 2 },
  { id: "2bpp", label: "2 bpp — 4 couleurs (fontes, cadres)", bytes: 16, colors: 4 },
  { id: "4bpp", label: "4 bpp — 16 couleurs (sprites, décors)", bytes: 32, colors: 16 },
  { id: "8bpp", label: "8 bpp — 256 couleurs", bytes: 64, colors: 256 },
  { id: "m7", label: "Mode 7 — linéaire, 256 couleurs", bytes: 64, colors: 256 },
];

export function bppDef(b: Bpp): BppDef {
  return BPPS.find((d) => d.id === b) ?? BPPS[2];
}

// One 8x8 tile to 64 palette indices.
//
// SNES tiles are BITPLANES: for 2bpp, each row is two bytes (plane 0 then
// plane 1) and a pixel's index is one bit taken from each. 4bpp and 8bpp
// stack that same 16-byte group two and four times — planes 0/1, then
// 2/3, then 4/5, 6/7 — which is why the loop below is written once.
// Mode 7 is the exception: one byte per pixel, no planes at all.
export function decodeTile(src: Uint8Array, off: number, bpp: Bpp, out: Uint8Array): void {
  out.fill(0);
  if (bpp === "m7") {
    for (let i = 0; i < 64; i++) out[i] = src[off + i] ?? 0;
    return;
  }
  if (bpp === "1bpp") {
    for (let y = 0; y < 8; y++) {
      const b = src[off + y] ?? 0;
      for (let x = 0; x < 8; x++) out[y * 8 + x] = (b >> (7 - x)) & 1;
    }
    return;
  }
  const planes = bpp === "2bpp" ? 2 : bpp === "4bpp" ? 4 : 8;
  for (let g = 0; g * 2 < planes; g++) {
    const base = off + g * 16;
    for (let y = 0; y < 8; y++) {
      const lo = src[base + y * 2] ?? 0;
      const hi = src[base + y * 2 + 1] ?? 0;
      for (let x = 0; x < 8; x++) {
        const s = 7 - x;
        out[y * 8 + x] |= (((lo >> s) & 1) | (((hi >> s) & 1) << 1)) << (g * 2);
      }
    }
  }
}

// ---- the view --------------------------------------------------------

export interface ViewOpts {
  offset: number;
  bpp: Bpp;
  widthTiles: number;
  rowsTiles: number;
  // SNES sprites are stored as 2x2 tile groups in sequence. Without this
  // every character in the ROM shows up quartered and interleaved, which
  // is why it is not an advanced option.
  blocks16: boolean;
}

export interface View {
  w: number; // pixels
  h: number;
  px: Uint8Array; // w*h palette indices
  opts: ViewOpts;
}

// Where the Nth tile of the byte stream lands on screen.
function tilePos(t: number, o: ViewOpts): [number, number] {
  if (!o.blocks16 || o.widthTiles < 2) return [t % o.widthTiles, Math.floor(t / o.widthTiles)];
  const bw = o.widthTiles >> 1; // 16x16 blocks per row
  const b = t >> 2;
  const s = t & 3;
  return [(b % bw) * 2 + (s & 1), Math.floor(b / bw) * 2 + (s >> 1)];
}

export function decodeView(rom: Rom, o: ViewOpts): View {
  const bt = bppDef(o.bpp).bytes;
  const w = o.widthTiles * 8;
  const h = o.rowsTiles * 8;
  const px = new Uint8Array(w * h);
  const tile = new Uint8Array(64);
  const n = o.widthTiles * o.rowsTiles;
  for (let t = 0; t < n; t++) {
    const [tx, ty] = tilePos(t, o);
    if (tx >= o.widthTiles || ty >= o.rowsTiles) continue;
    decodeTile(rom.bytes, o.offset + t * bt, o.bpp, tile);
    for (let y = 0; y < 8; y++) {
      const dst = (ty * 8 + y) * w + tx * 8;
      for (let x = 0; x < 8; x++) px[dst + x] = tile[y * 8 + x];
    }
  }
  return { w, h, px, opts: o };
}

// A rectangle of the view, in TILES. The cut is taken from the decoded
// view and not from the ROM, because a 2-tile-wide selection inside a
// 16-tile-wide view is not contiguous in the file.
export interface Cut {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function cutPixels(v: View, c: Cut): { w: number; h: number; px: Uint8Array } {
  const w = c.w * 8;
  const h = c.h * 8;
  const px = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = c.y * 8 + y;
    for (let x = 0; x < w; x++) px[y * w + x] = v.px[sy * v.w + c.x * 8 + x] ?? 0;
  }
  return { w, h, px };
}

export function usedColors(px: Uint8Array): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < px.length; i++) s.add(px[i]);
  return s;
}

// Renumber a cut so its indices are 0..n-1, transparent first.
//
// This is not cosmetic. datagen reads the raw indices of an indexed PNG,
// and a font or a windowskin is refused outright when any index exceeds
// 3 — so four colours picked out of a 16-entry palette have to become
// 0,1,2,3 before they can be a windowskin. Reserving index 0 for the
// transparent colour, used or not, is the other half of the same
// convention.
export function compactCut(
  px: Uint8Array,
  palette: Rgb[],
  transIndex: number
): { px: Uint8Array; palette: Rgb[]; transIndex: number } {
  const used = [...usedColors(px)].sort((a, b) => a - b);
  const order = transIndex >= 0 ? [transIndex, ...used.filter((i) => i !== transIndex)] : used;
  const map = new Uint8Array(256);
  order.forEach((src, dst) => (map[src] = dst));
  const out = new Uint8Array(px.length);
  for (let i = 0; i < px.length; i++) out[i] = map[px[i]];
  return {
    px: out,
    palette: order.map((i) => palette[i] ?? ([0, 0, 0] as Rgb)),
    transIndex: transIndex >= 0 ? 0 : -1,
  };
}

// ---- palettes --------------------------------------------------------

// SNES colour: 16 bits little-endian, 5 bits per channel, BGR order.
// Bit 15 is unused by the hardware — which is what makes the scan below
// selective.
export function bgr555(lo: number, hi: number): Rgb {
  const c = lo | (hi << 8);
  const r = c & 31;
  const g = (c >> 5) & 31;
  const b = (c >> 10) & 31;
  return [(r << 3) | (r >> 2), (g << 3) | (g >> 2), (b << 3) | (b >> 2)];
}

export function readPalette(rom: Rom, off: number, count: number): Rgb[] {
  const out: Rgb[] = [];
  for (let i = 0; i < count; i++)
    out.push(bgr555(rom.bytes[off + i * 2] ?? 0, rom.bytes[off + i * 2 + 1] ?? 0));
  return out;
}

export function greyPalette(count: number): Rgb[] {
  const out: Rgb[] = [];
  for (let i = 0; i < count; i++) {
    const v = count <= 1 ? 0 : Math.round((i * 255) / (count - 1));
    out.push([v, v, v]);
  }
  return out;
}

// Candidate 16-colour palettes. Not an answer — a list to click through.
// Two cheap tests do most of the work: bit 15 clear on all sixteen words
// (a 1-in-65536 accident), and enough distinct colours that a run of
// padding or of tile data cannot pass.
export function scanPalettes(rom: Rom, limit = 300, minDistinct = 12): number[] {
  const hits: number[] = [];
  const b = rom.bytes;
  for (let o = 0; o + 32 <= b.length && hits.length < limit; o += 2) {
    let ok = true;
    const seen = new Set<number>();
    for (let i = 0; i < 16; i++) {
      const c = b[o + i * 2] | (b[o + i * 2 + 1] << 8);
      if (c & 0x8000) {
        ok = false;
        break;
      }
      seen.add(c);
    }
    if (!ok || seen.size < minDistinct) continue;
    hits.push(o);
    o += 30; // a hit consumes its own 32 bytes
  }
  return hits;
}

export function rgbToHex(c: Rgb): string {
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgb(s: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// ---- addresses -------------------------------------------------------

export function hex(v: number, w: number): string {
  return v.toString(16).toUpperCase().padStart(w, "0");
}

// The tool addresses the FILE, not the CPU bus — mapping only matters
// when following a pointer. These two exist because that is the notation
// a documentation site or a RAM map will quote at the author.
export function loRomAddr(off: number): string {
  return `$${hex(0x80 + Math.floor(off / 0x8000), 2)}:${hex(0x8000 + (off % 0x8000), 4)}`;
}

export function hiRomAddr(off: number): string {
  return `$${hex(0xc0 + Math.floor(off / 0x10000), 2)}:${hex(off % 0x10000, 4)}`;
}

// "1A8000" is a file offset; "C2:8000" is a LoROM address (the colon is
// what tells them apart). Returns null when it is neither.
export function parseOffset(s: string): number | null {
  const t = s.trim().replace(/^\$|^0x/i, "");
  const colon = /^([0-9a-f]{2}):([0-9a-f]{4})$/i.exec(t);
  if (colon) {
    const bank = parseInt(colon[1], 16) & 0x7f;
    const addr = parseInt(colon[2], 16);
    if (addr < 0x8000) return null;
    return bank * 0x8000 + (addr - 0x8000);
  }
  if (!/^[0-9a-f]+$/i.test(t)) return null;
  return parseInt(t, 16);
}

// Next offset whose following bytes are not all the same value. A ROM is
// mostly not graphics, and blank padding is most of what sits between the
// parts that are.
export function skipBlank(rom: Rom, from: number, step: number, span = 512): number {
  const b = rom.bytes;
  const last = Math.max(0, b.length - span);
  let o = from;
  for (let guard = 0; guard < 100000; guard++) {
    o += step;
    if (o <= 0) return 0;
    if (o >= last) return last;
    const first = b[o];
    let flat = true;
    for (let i = 1; i < span && o + i < b.length; i++)
      if (b[o + i] !== first) {
        flat = false;
        break;
      }
    if (!flat) return o;
  }
  return Math.max(0, Math.min(o, last));
}

// ---- indexed PNG out -------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(buf: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  dv.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

// zlib stream made of STORED deflate blocks. No compressor is needed and
// none is worth pulling in: the biggest image the project accepts is
// 256x224, and CompressionStream is not dependable across the WebViews
// the editor ships on.
function zlibStored(data: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(data.length / 65535));
  const out = new Uint8Array(2 + blocks * 5 + data.length + 4);
  let p = 0;
  out[p++] = 0x78;
  out[p++] = 0x01;
  for (let i = 0; i < blocks; i++) {
    const start = i * 65535;
    const len = Math.min(65535, data.length - start);
    out[p++] = i === blocks - 1 ? 1 : 0;
    out[p++] = len & 255;
    out[p++] = (len >> 8) & 255;
    out[p++] = ~len & 255;
    out[p++] = (~len >> 8) & 255;
    out.set(data.subarray(start, start + len), p);
    p += len;
  }
  new DataView(out.buffer).setUint32(p, adler32(data));
  return out.subarray(0, p + 4);
}

// An 8-bit indexed PNG. `transIndex` below 0 means fully opaque; any
// other value gets an alpha of 0 through tRNS, which is what the editor's
// own preview reads and what datagen treats as index 0 anyway.
export function encodeIndexedPng(
  w: number,
  h: number,
  px: Uint8Array,
  palette: Rgb[],
  transIndex: number
): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // colour type: indexed
  const n = Math.max(1, palette.length);
  const plte = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = palette[i] ?? [0, 0, 0];
    plte[i * 3] = c[0];
    plte[i * 3 + 1] = c[1];
    plte[i * 3 + 2] = c[2];
  }
  const raw = new Uint8Array((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0; // filter: none
    raw.set(px.subarray(y * w, y * w + w), y * (w + 1) + 1);
  }
  const parts: Uint8Array[] = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
  ];
  if (transIndex >= 0 && transIndex < n) {
    const trns = new Uint8Array(transIndex + 1).fill(255);
    trns[transIndex] = 0;
    parts.push(chunk("tRNS", trns));
  }
  parts.push(chunk("IDAT", zlibStored(raw)), chunk("IEND", new Uint8Array(0)));
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}
