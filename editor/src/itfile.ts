// Writing an Impulse Tracker module (X5-d).
//
// The target format is not a choice: the engine plays music through
// snesmod, and snesmod is fed by smconv, which eats .it. So a transcribed
// song has to come out as one.
//
// Deliberately in SAMPLE mode, not instrument mode: an SNES voice is a
// sample plus a pitch, with no envelope layer above it worth modelling,
// and the project's own modules are built the same way (smconv reports
// "Instrument data: 0 bytes" on them).

export interface ItSample {
  name: string;
  pcm: Int16Array;
  c5speed: number;
  loopStart?: number; // in samples; absent = no loop
}

export interface ItCell {
  note?: number; // 0-119, C-5 = 60; 255 = note off
  ins?: number; // 1-based sample number
  vol?: number; // 0-64
}

export interface ItPattern {
  rows: number;
  cells: (ItCell | null)[][]; // [row][channel]
}

export interface ItSong {
  name: string;
  speed: number; // ticks per row
  tempo: number; // BPM; row = (2.5 / tempo) * speed seconds
  channels: number;
  samples: ItSample[];
  patterns: ItPattern[];
  order: number[];
}

function ascii(out: Uint8Array, off: number, s: string, len: number) {
  for (let i = 0; i < len; i++) out[off + i] = i < s.length ? s.charCodeAt(i) & 0x7f : 0;
}

// IT pattern packing: per row, one entry per non-empty channel, then a
// zero byte. A channel repeats its previous field mask unless bit 7 of
// the channel byte says a new mask follows.
function packPattern(p: ItPattern, channels: number): Uint8Array {
  const out: number[] = [];
  const lastMask = new Uint8Array(64);
  const lastNote = new Uint8Array(64);
  const lastIns = new Uint8Array(64);
  const lastVol = new Uint8Array(64);
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < channels; c++) {
      const cell = p.cells[r]?.[c];
      if (!cell) continue;
      let mask = 0;
      if (cell.note !== undefined) mask |= cell.note === lastNote[c] ? 16 : 1;
      if (cell.ins !== undefined) mask |= cell.ins === lastIns[c] ? 32 : 2;
      if (cell.vol !== undefined) mask |= cell.vol === lastVol[c] ? 64 : 4;
      if (!mask) continue;
      if (mask !== lastMask[c]) {
        out.push((c + 1) | 0x80, mask);
        lastMask[c] = mask;
      } else {
        out.push(c + 1);
      }
      if (mask & 1) {
        out.push(cell.note!);
        lastNote[c] = cell.note!;
      }
      if (mask & 2) {
        out.push(cell.ins!);
        lastIns[c] = cell.ins!;
      }
      if (mask & 4) {
        out.push(cell.vol!);
        lastVol[c] = cell.vol!;
      }
    }
    out.push(0); // end of row
  }
  return Uint8Array.from(out);
}

export function writeIt(song: ItSong): Uint8Array {
  const ordNum = song.order.length + 1; // the list ends with 255
  const smpNum = song.samples.length;
  const patNum = song.patterns.length;

  const headerLen = 192 + ordNum + smpNum * 4 + patNum * 4;
  const packed = song.patterns.map((p) => packPattern(p, song.channels));

  // Layout: header, then sample headers, then pattern blocks, then the
  // sample data (pointed at from each sample header).
  const smpHdrAt = headerLen;
  const patAt = smpHdrAt + smpNum * 80;
  const patOffsets: number[] = [];
  let o = patAt;
  for (const p of packed) {
    patOffsets.push(o);
    o += 8 + p.length;
  }
  const smpDataOffsets: number[] = [];
  for (const s of song.samples) {
    smpDataOffsets.push(o);
    o += s.pcm.length * 2;
  }

  const out = new Uint8Array(o);
  const dv = new DataView(out.buffer);

  ascii(out, 0, "IMPM", 4);
  ascii(out, 4, song.name, 26);
  out[30] = 4; // row highlight minor
  out[31] = 16; // row highlight major
  dv.setUint16(32, ordNum, true);
  dv.setUint16(34, 0, true); // no instruments: sample mode
  dv.setUint16(36, smpNum, true);
  dv.setUint16(38, patNum, true);
  dv.setUint16(40, 0x0214, true); // Cwtv
  dv.setUint16(42, 0x0200, true); // Cmwt
  dv.setUint16(44, 0x0009, true); // flags: stereo + linear slides
  dv.setUint16(46, 0, true); // special
  out[48] = 128; // global volume
  out[49] = 48; // mix volume
  out[50] = song.speed;
  out[51] = song.tempo;
  out[52] = 128; // pan separation
  for (let c = 0; c < 64; c++) {
    out[64 + c] = c < song.channels ? 32 : 32 | 0x80; // centre; unused muted
    out[128 + c] = 64;
  }
  let p = 192;
  for (const ord of song.order) out[p++] = ord;
  out[p++] = 255; // end of order list
  for (let i = 0; i < smpNum; i++) {
    dv.setUint32(p, smpHdrAt + i * 80, true);
    p += 4;
  }
  for (let i = 0; i < patNum; i++) {
    dv.setUint32(p, patOffsets[i], true);
    p += 4;
  }

  song.samples.forEach((s, i) => {
    const h = smpHdrAt + i * 80;
    ascii(out, h, "IMPS", 4);
    ascii(out, h + 4, s.name.slice(0, 12), 12);
    out[h + 17] = 64; // global volume
    // bit0 associated with header, bit1 16-bit, bit4 use loop
    out[h + 18] = 1 | 2 | (s.loopStart !== undefined ? 16 : 0);
    out[h + 19] = 64; // default volume
    ascii(out, h + 20, s.name, 26);
    out[h + 46] = 1; // Cvt: signed samples
    out[h + 47] = 32; // default pan (unused without bit 7)
    dv.setUint32(h + 48, s.pcm.length, true);
    dv.setUint32(h + 52, s.loopStart ?? 0, true);
    dv.setUint32(h + 56, s.loopStart !== undefined ? s.pcm.length : 0, true);
    dv.setUint32(h + 60, s.c5speed, true);
    dv.setUint32(h + 72, smpDataOffsets[i], true);
  });

  packed.forEach((pk, i) => {
    const at = patOffsets[i];
    dv.setUint16(at, pk.length, true);
    dv.setUint16(at + 2, song.patterns[i].rows, true);
    out.set(pk, at + 8);
  });

  song.samples.forEach((s, i) => {
    let d = smpDataOffsets[i];
    for (let k = 0; k < s.pcm.length; k++, d += 2) dv.setInt16(d, s.pcm[k], true);
  });

  return out;
}
