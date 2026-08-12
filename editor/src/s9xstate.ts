// Mining a snes9x savestate (X6, the ROM photo booth).
//
// The photo route: snesphoto runs the game headless in a STOCK
// snes9x libretro core and asks it to serialize (retro_serialize).
// That savestate holds, in the clear, everything the game decompressed
// to actually run — which is exactly what the cartridge refuses to
// give: VRAM (the tiles), CGRAM (the real colours), OAM (which tiles
// are live sprites), and the entire sound chip mid-song.
//
// The container is snes9x's own: "#!s9xsnp:VVVV\n", then blocks of
// "NAM:%06d:" + payload. Struct blocks are packed big-endian in the
// order of snes9x's field tables — so the offsets below are not
// guesses, they are SnapPPU (snapshot.cpp) multiplied by the field
// sizes of struct SPPU (ppu.h). Whether a given savestate matches that
// layout is decided by the PPU block's LENGTH, not its version number:
// see ppuLayout for why.
//
// The sound block is blargg's APU state: ARAM at 0, the SMP registers
// as int32 LE from 65536, the 128 DSP registers right behind — enough
// to SYNTHESIZE a standard .spc file, which the audio panel already
// knows how to open, emulate and transcribe. One photo, both tabs.

import type { Rgb } from "./rom";
import { bgr555 } from "./rom";

export interface S9xPhoto {
  version: number;
  vram: Uint8Array; // 64 KB — the tiles, decompressed by the game itself
  cgram: Uint16Array; // 256 BGR555 entries
  oam: Uint8Array; // 544 bytes
  bgMode: number;
  objBase: number; // VRAM BYTE address of the sprite tiles
  bgBase: [number, number, number, number]; // BYTE addresses of BG tiles
  spc: Uint8Array; // a standard .spc synthesized from the APU state
}

interface Block {
  off: number;
  len: number;
}

function blocks(b: Uint8Array): { version: number; map: Map<string, Block> } {
  const text = (o: number, n: number) => {
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]);
    return s;
  };
  if (text(0, 9) !== "#!s9xsnp:") throw new Error("pas une savestate snes9x");
  const version = parseInt(text(9, 4), 10);
  const map = new Map<string, Block>();
  let o = 14; // "#!s9xsnp:0011\n"
  while (o + 11 <= b.length) {
    const name = text(o, 3);
    const sizeField = text(o + 4, 6);
    // Oversize blocks pack the length as 4 raw bytes where the digits go.
    const len =
      sizeField === "------"
        ? (b[o + 6] << 24) | (b[o + 7] << 16) | (b[o + 8] << 8) | b[o + 9]
        : parseInt(sizeField, 10);
    if (!Number.isFinite(len) || len < 0) break;
    map.set(name, { off: o + 11, len });
    o += 11 + len;
  }
  return { version, map };
}

// Byte offsets inside the serialized PPU block. Field order and sizes
// come from SnapPPU x struct SPPU; the only variable field before the
// ones we read is CGSavedByte (v11+), hence the single +1.
//
// The layout is keyed on the BLOCK LENGTH, not the version number. The
// libretro fork bumps the version for things that never touch the PPU
// block (13 and 14 are both MSU-1 fields, in a block we skip), so a
// version test refuses cores that are perfectly readable — the author
// hit exactly that with a buildbot nightly at version 14. The block
// length moves precisely when a PPU field is added or removed, which
// is precisely when these offsets stop being true. 2652 bytes is the
// v11+ layout, 2649 the pre-CGSavedByte/VRAMReadBuffer one.
const PPU_LEN_V11 = 2652;
const PPU_LEN_OLD = 2649;

function ppuLayout(blockLen: number, version: number) {
  if (blockLen !== PPU_LEN_V11 && blockLen !== PPU_LEN_OLD)
    throw new Error(
      `bloc PPU de ${blockLen} octets (savestate version ${version}) : disposition inconnue de ce lecteur — un champ PPU a bougé chez snes9x`
    );
  const cgdata = 63 + (blockLen === PPU_LEN_V11 ? 1 : 0);
  const obj = cgdata + 512; // CGDATA: 256 x uint16
  const objNameBase = obj + 128 * 11 + 3; // 128 sprites, then 3 window bools
  const oamData = objNameBase + 2 + 2 + 1 + 11; // bases, sizes, OAM addressing
  return { cgdata, objNameBase, oamData };
}

const SMP_INTS = 65536; // ARAM, then the SMP registers as int32 LE
const DSP_REGS = SMP_INTS + 41 * 4; // 41 ints: clock..bit (smp_state.cpp)

function ascii(out: Uint8Array, off: number, s: string, len: number) {
  for (let i = 0; i < len && i < s.length; i++) out[off + i] = s.charCodeAt(i) & 0x7f;
}

// The APU state becomes a standard 66048-byte .spc: header, SPC700
// registers, id666 title/game, ARAM, DSP registers. The mmio-shadowed
// bytes of ARAM ($F2, $F8-$F9, $FD-$FF) are patched from the SMP state,
// exactly the set snes9x's own save_spc reconstructs.
function synthesizeSpc(snd: Uint8Array, title: string, game: string): Uint8Array {
  const dv = new DataView(snd.buffer, snd.byteOffset, snd.byteLength);
  const smp = (i: number) => dv.getInt32(SMP_INTS + i * 4, true);
  const pc = smp(3) & 0xffff;
  const sp = smp(4) & 0xff;
  const a = smp(5) & 0xff;
  const x = smp(6) & 0xff;
  const y = smp(7) & 0xff;
  // p.n .. p.c, eight int32 booleans in flag order
  let psw = 0;
  for (let i = 0; i < 8; i++) if (smp(8 + i)) psw |= 0x80 >> i;
  const dspAddr = smp(17) & 0xff;

  const out = new Uint8Array(0x10200);
  ascii(out, 0, "SNES-SPC700 Sound File Data v0.30", 33);
  out[0x21] = 26;
  out[0x22] = 26;
  out[0x23] = 26; // id666 present
  out[0x24] = 30; // version minor
  out[0x25] = pc & 0xff;
  out[0x26] = pc >> 8;
  out[0x27] = a;
  out[0x28] = x;
  out[0x29] = y;
  out[0x2a] = psw;
  out[0x2b] = sp;
  ascii(out, 0x2e, title, 32);
  ascii(out, 0x4e, game, 32);

  out.set(snd.subarray(0, 65536), 0x100);
  const aram = out.subarray(0x100, 0x10100);
  // $F1-$FC are WRITE-ONLY on the chip, so the raw ARAM image holds
  // stale bytes there — but a resuming emulator reads its control and
  // timer state from exactly those cells of the file. Rebuild them from
  // the SMP state. Without this the timers never tick, a driver that
  // paces its tempo by polling $FD polls forever, and the photo's song
  // resumes to absolute silence (measured on snesmod: level 3777 on the
  // real core, zero note-ons in the resumed .spc).
  aram[0xf1] =
    (smp(20) ? 1 : 0) | (smp(25) ? 2 : 0) | (smp(30) ? 4 : 0) | (smp(16) ? 0x80 : 0);
  aram[0xf2] = dspAddr;
  aram[0xf3] = snd[DSP_REGS + (dspAddr & 0x7f)];
  aram[0xf8] = smp(18) & 0xff;
  aram[0xf9] = smp(19) & 0xff;
  aram[0xfa] = smp(21) & 0xff; // timer targets (0 = 256)
  aram[0xfb] = smp(26) & 0xff;
  aram[0xfc] = smp(31) & 0xff;
  // Timer counters: stage3_ticks of the three timers (4-bit up-counters).
  aram[0xfd] = smp(24) & 15;
  aram[0xfe] = smp(29) & 15;
  aram[0xff] = smp(34) & 15;
  out.set(snd.subarray(DSP_REGS, DSP_REGS + 128), 0x10100);
  return out;
}

// ---- savestates made by a HUMAN playing -----------------------------
//
// The photo button reaches what a timer and a Start press reach. For
// everything else — the boss of dungeon 3 — the author plays the game
// themselves and saves a state at the exact moment. Those files are
// the SAME s9xsnp stream inside, wrapped differently per emulator:
//
//   RetroArch  .state    "RASTATE" container, MEM block = the stream,
//                        the whole file optionally RZIP-compressed
//                        (chunked zlib, "#RZIPv1#")
//   Snes9x     .000-.008 the stream, gzip-compressed
//
// Unwrap recursively until the bare stream appears. bsnes and Mesen
// stay refused: different emulators, different (undocumented) formats.

// A cheap sniff for "could this file be a savestate?" — used by the
// door that must refuse invalid files with a helpful message.
export function looksLikeState(b: Uint8Array): boolean {
  const s = (o: number, t: string) => {
    for (let i = 0; i < t.length; i++) if (b[o + i] !== t.charCodeAt(i)) return false;
    return true;
  };
  return (
    (b[0] === 0x1f && b[1] === 0x8b) || // gzip
    s(0, "#RZIPv") ||
    s(0, "RASTATE") ||
    s(0, "#!s9xsnp")
  );
}

async function inflate(b: Uint8Array, format: "gzip" | "deflate"): Promise<Uint8Array> {
  const ds = new DecompressionStream(format);
  const out = await new Response(
    new Blob([b.slice().buffer as ArrayBuffer]).stream().pipeThrough(ds)
  ).arrayBuffer();
  return new Uint8Array(out);
}

// Unwraps any of the containers above down to the raw s9xsnp stream,
// or null when the bytes are not a savestate at all.
export async function loadStateFile(bytes: Uint8Array): Promise<Uint8Array | null> {
  const s = (o: number, t: string) => {
    for (let i = 0; i < t.length; i++) if (bytes[o + i] !== t.charCodeAt(i)) return false;
    return true;
  };
  // Snes9x desktop: one gzip stream around the whole state.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return loadStateFile(await inflate(bytes, "gzip"));
  // RetroArch RZIP: 20-byte header, then u32-prefixed zlib chunks.
  if (s(0, "#RZIPv") && bytes[7] === 35) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const total = Number(dv.getBigUint64(12, true));
    if (total <= 0 || total > 512 * 1024 * 1024) return null;
    const parts: Uint8Array[] = [];
    let o = 20;
    let got = 0;
    while (o + 4 <= bytes.length && got < total) {
      const n = dv.getUint32(o, true);
      o += 4;
      if (n === 0 || o + n > bytes.length) return null;
      const chunk = await inflate(bytes.subarray(o, o + n), "deflate");
      parts.push(chunk);
      got += chunk.length;
      o += n;
    }
    const out = new Uint8Array(got);
    let w = 0;
    for (const p of parts) {
      out.set(p, w);
      w += p.length;
    }
    return loadStateFile(out);
  }
  // RetroArch container: "RASTATE" + version, blocks of 4-char marker +
  // u32 LE size + payload padded to 8. MEM holds the core's stream.
  if (s(0, "RASTATE")) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let o = 8;
    while (o + 8 <= bytes.length) {
      const marker = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
      const len = dv.getUint32(o + 4, true);
      o += 8;
      if (marker === "END ") break;
      if (o + len > bytes.length) return null;
      if (marker === "MEM ") return loadStateFile(bytes.subarray(o, o + len));
      o += (len + 7) & ~7;
    }
    return null;
  }
  if (s(0, "#!s9xsnp")) return bytes;
  return null;
}

export function parsePhoto(state: Uint8Array, title: string, game: string): S9xPhoto {
  const { version, map } = blocks(state);
  const vra = map.get("VRA");
  const ppu = map.get("PPU");
  const snd = map.get("SND");
  if (!vra || vra.len < 0x10000) throw new Error("bloc VRA absent ou tronqué");
  if (!ppu) throw new Error("bloc PPU absent");
  if (!snd || snd.len < DSP_REGS + 128) throw new Error("bloc SND absent ou tronqué");

  const L = ppuLayout(ppu.len, version);
  const p = state.subarray(ppu.off, ppu.off + ppu.len);
  const be16 = (o: number) => (p[o] << 8) | p[o + 1];

  const cgram = new Uint16Array(256);
  for (let i = 0; i < 256; i++) cgram[i] = be16(L.cgdata + i * 2);

  // BG[N] starts at 14, 11 bytes each; NameBase is 7 bytes in — a VRAM
  // WORD address (the renderer shifts it: gfx.cpp `NameBase << 1`).
  // OBJNameBase is already in bytes (`TileAddress = PPU.OBJNameBase`).
  const bgBase = [0, 1, 2, 3].map((n) => (be16(14 + n * 11 + 7) << 1) & 0xffff) as [
    number,
    number,
    number,
    number,
  ];

  return {
    version,
    vram: state.slice(vra.off, vra.off + 0x10000),
    cgram,
    oam: state.slice(ppu.off + L.oamData, ppu.off + L.oamData + 544),
    bgMode: p[58],
    objBase: be16(L.objNameBase) & 0xffff,
    bgBase,
    spc: synthesizeSpc(state.subarray(snd.off, snd.off + snd.len), title, game),
  };
}

// CGRAM as sixteen rows of sixteen colours — the shape the palette
// picker shows. Row 0-7 are the backgrounds' palettes, 8-15 the sprites'.
export function cgramRows(cgram: Uint16Array): Rgb[][] {
  const rows: Rgb[][] = [];
  for (let r = 0; r < 16; r++) {
    const row: Rgb[] = [];
    for (let c = 0; c < 16; c++) row.push(bgr555(cgram[r * 16 + c] & 0xff, cgram[r * 16 + c] >> 8));
    rows.push(row);
  }
  return rows;
}

// A P6 PPM (what snesphoto writes) to an RGBA buffer for a canvas.
export function decodePpm(
  b: Uint8Array
): { w: number; h: number; rgba: Uint8ClampedArray<ArrayBuffer> } | null {
  let o = 0;
  const token = () => {
    while (o < b.length && (b[o] === 32 || b[o] === 10 || b[o] === 13 || b[o] === 9)) o++;
    if (b[o] === 35) {
      while (o < b.length && b[o] !== 10) o++;
      return token();
    }
    let s = "";
    while (o < b.length && b[o] > 32) s += String.fromCharCode(b[o++]);
    return s;
  };
  if (token() !== "P6") return null;
  const w = parseInt(token(), 10);
  const h = parseInt(token(), 10);
  token(); // maxval
  o++; // the single whitespace after the header
  if (!w || !h || o + w * h * 3 > b.length) return null;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = b[o + i * 3];
    rgba[i * 4 + 1] = b[o + i * 3 + 1];
    rgba[i * 4 + 2] = b[o + i * 3 + 2];
    rgba[i * 4 + 3] = 255;
  }
  return { w, h, rgba };
}
