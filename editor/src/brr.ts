// ROM ripper, audio side (X3): finding and decoding BRR samples.
//
// This is the part of the ripper that works BEST, and for a structural
// reason rather than a lucky one. Graphics in a ROM are just bytes: you
// find them by looking. A BRR sample describes itself — 9-byte blocks,
// a range field that cannot legally exceed 12, and exactly one end flag,
// at the end — so a scan can assert its way to a sample instead of
// guessing at one. Compression is not in the way either: BRR *is* the
// compressed form, and games store it as is.
//
// Pure module: bytes in, samples and WAV bytes out. No React, no Tauri.

// ---- the format ------------------------------------------------------
//
// Block = 1 header byte + 8 data bytes = 16 four-bit deltas.
//   header: range<<4 | filter<<2 | loop<<1 | end
// A sample is a chain of blocks ending at the first one with `end` set.

export const BRR_BLOCK = 9;

export interface BrrSample {
  offset: number; // first block, in the byte range it was found in
  blocks: number;
  loop: boolean; // loop flag on the last block
  loopOffset?: number; // only an SPC directory knows this for certain
  dirIndex?: number; // instrument number, when it came from a directory
}

// The DSP's integer prediction for filters 0-3. Same coefficients as
// datagen's brr_predict (tools/datagen/src/sfx.rs) — that encoder and
// this decoder are two directions of one format, and they must not drift.
function predict(filter: number, p1: number, p2: number): number {
  switch (filter) {
    case 1:
      return (p1 * 15) >> 4;
    case 2:
      return ((p1 * 61) >> 5) - ((p2 * 15) >> 4);
    case 3:
      return ((p1 * 115) >> 6) - ((p2 * 13) >> 4);
    default:
      return 0;
  }
}

// Walks a chain from `off` and returns what it found, or null when the
// bytes there are not a well-formed sample.
//
// Three tests carry the whole scanner. `range` above 12 is undefined on
// real hardware, so it never appears in authored data. The first block of
// a sample must use filter 0, because filters 1-3 predict from previous
// samples that do not exist yet. And the chain has to actually terminate.
export function brrChain(
  b: Uint8Array,
  off: number,
  maxBlocks = 8192,
  requireFilter0 = true
): { blocks: number; loop: boolean } | null {
  if (off < 0 || off + BRR_BLOCK > b.length) return null;
  if (requireFilter0 && ((b[off] >> 2) & 3) !== 0) return null;
  for (let n = 0; n < maxBlocks; n++) {
    const o = off + n * BRR_BLOCK;
    if (o + BRR_BLOCK > b.length) return null;
    const h = b[o];
    if (h >> 4 > 12) return null;
    if (h & 1) return { blocks: n + 1, loop: !!(h & 2) };
  }
  return null;
}

// Every plausible sample in the byte range.
//
// `minBlocks` is the only real knob: 16 blocks is ~256 samples, about
// 8 ms, and short enough to catch a blip while long enough that random
// bytes essentially never pass (a chain needs `end` clear on every block
// but the last, which is a coin flip each time).
//
// One artefact is inherent and cannot be scanned away: the END of a chain
// is exact — the end flag is unambiguous — but its START is only the
// earliest byte from which the chain still parses. Whatever sits in front
// of a real sample has about a one-in-five chance of reading as a valid
// header, and then the reported sample carries one junk block at the
// front. The panel answers this with a per-block trim rather than
// pretending the scan is exact.
export function scanBrr(
  b: Uint8Array,
  minBlocks = 16,
  limit = 400
): BrrSample[] {
  const out: BrrSample[] = [];
  for (let o = 0; o + BRR_BLOCK <= b.length && out.length < limit; o++) {
    const c = brrChain(b, o);
    if (!c || c.blocks < minBlocks) continue;
    // Silence passes every structural test; it is never what is wanted.
    let quiet = true;
    for (let i = 1; i < 9 && quiet; i++) if (b[o + i]) quiet = false;
    if (quiet) continue;
    out.push({ offset: o, blocks: c.blocks, loop: c.loop });
    o += c.blocks * BRR_BLOCK - 1;
  }
  return out;
}

// A sample to 16-bit mono PCM. 16 samples per block.
export function decodeBrr(b: Uint8Array, off: number, blocks: number): Int16Array {
  const out = new Int16Array(blocks * 16);
  let p1 = 0;
  let p2 = 0;
  let k = 0;
  for (let n = 0; n < blocks; n++) {
    const o = off + n * BRR_BLOCK;
    const h = b[o] ?? 0;
    const range = h >> 4;
    const filter = (h >> 2) & 3;
    for (let i = 0; i < 8; i++) {
      const byte = b[o + 1 + i] ?? 0;
      for (const half of [byte >> 4, byte & 15]) {
        const nib = (half ^ 8) - 8; // sign-extend the 4-bit delta
        let s = range <= 12 ? (nib << range) >> 1 : (nib >> 3) << 11;
        s += predict(filter, p1, p2);
        s = s > 32767 ? 32767 : s < -32768 ? -32768 : s;
        s = ((s & 0x7fff) ^ 0x4000) - 0x4000; // the DSP keeps 15 bits
        p2 = p1;
        p1 = s;
        // BRR output is 15-bit; doubling it fills a normal 16-bit WAV.
        out[k++] = s < -16384 ? -32768 : s > 16383 ? 32767 : s * 2;
      }
    }
  }
  return out;
}

// ---- WAV out ---------------------------------------------------------

// Mono 16-bit PCM. datagen's wav_to_mono_8k takes any rate from 4000 to
// 96000 Hz and resamples, so nothing here needs to match the engine.
export function encodeWav(pcm: Int16Array, rate: number): Uint8Array {
  const out = new Uint8Array(44 + pcm.length * 2);
  const dv = new DataView(out.buffer);
  const ascii = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i);
  };
  ascii(0, "RIFF");
  dv.setUint32(4, 36 + pcm.length * 2, true);
  ascii(8, "WAVEfmt ");
  dv.setUint32(16, 16, true); // fmt chunk size
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true); // byte rate
  dv.setUint16(32, 2, true); // block align
  dv.setUint16(34, 16, true); // bits
  ascii(36, "data");
  dv.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) dv.setInt16(44 + i * 2, pcm[i], true);
  return out;
}

// ---- SPC input -------------------------------------------------------
//
// An .spc is a snapshot of a RUNNING sound chip: 64 KB of ARAM plus the
// DSP registers. That makes it a better source than a ROM for audio, and
// the reason is register $5D: it holds the page of the SAMPLE DIRECTORY,
// a real table of start and loop addresses. From an SPC the tool does not
// scan at all — it reads the list, with exact boundaries and true loop
// points, for every instrument the song uses.

export interface Spc {
  aram: Uint8Array; // 64 KB
  dsp: Uint8Array; // 128 registers
  title: string;
  game: string;
}

const SPC_MAGIC = "SNES-SPC700 Sound File Data";

export function loadSpc(raw: Uint8Array): Spc | null {
  if (raw.length < 0x10180) return null;
  let magic = "";
  for (let i = 0; i < SPC_MAGIC.length; i++) magic += String.fromCharCode(raw[i]);
  if (magic !== SPC_MAGIC) return null;
  const text = (o: number, n: number) => {
    let s = "";
    for (let i = 0; i < n && raw[o + i]; i++) s += String.fromCharCode(raw[o + i]);
    return s.trim();
  };
  return {
    aram: raw.subarray(0x100, 0x100 + 0x10000),
    dsp: raw.subarray(0x10100, 0x10180),
    title: text(0x2e, 32),
    game: text(0x4e, 32),
  };
}

// The instruments the snapshot's directory points at. Entries that do not
// decode as a well-formed chain are dropped: a directory has 256 slots
// and a song rarely fills them, so the tail is whatever was in memory.
//
// requireFilter0 is relaxed here — the directory is authoritative about
// where a sample starts, and a few drivers do write a non-zero filter in
// the first block.
export function spcSamples(spc: Spc): BrrSample[] {
  const dir = spc.dsp[0x5d] << 8;
  const out: BrrSample[] = [];
  for (let i = 0; i < 256; i++) {
    const e = dir + i * 4;
    if (e + 4 > spc.aram.length) break;
    const start = spc.aram[e] | (spc.aram[e + 1] << 8);
    const loop = spc.aram[e + 2] | (spc.aram[e + 3] << 8);
    if (start === 0 || start >= 0x10000) continue;
    const c = brrChain(spc.aram, start, 8192, false);
    if (!c || c.blocks < 2) continue;
    if (out.some((s) => s.offset === start)) continue;
    out.push({
      offset: start,
      blocks: c.blocks,
      loop: c.loop,
      loopOffset: loop >= start ? loop : undefined,
      dirIndex: i,
    });
  }
  return out;
}

// ---- what the engine will make of it ---------------------------------

// The build resamples to 8 kHz and re-encodes to BRR, so the size that
// matters is not the one in the ROM. Budgets: docs/TOOLS.md — 8 KB per
// sound (~1.8 s), 16 sounds, 24 KB total.
export const SFX_RATE = 8000;
export const SFX_MAX_BRR = 8192;

export function brrSizeAtBuild(sampleCount: number, rate: number): number {
  const resampled = Math.round((sampleCount * SFX_RATE) / Math.max(1, rate));
  return Math.ceil(resampled / 16) * BRR_BLOCK;
}

// ---- could this song ever be a module? (X5-a) ------------------------
//
// Before anyone writes an SPC700 emulator to transcribe a song, there is
// a cheaper question: would its instruments even fit? snesmod loads one
// module at a time into ARAM, and what is left after its driver is the
// hard ceiling. The number below is read off the vendored smconv itself
// — it reports "649 bytes used, 57308 free" for the demo's smallest
// module, and the same total from every other one.
export const ARAM_MODULE_BUDGET = 57957;

export function samplesTotal(list: BrrSample[]): number {
  return list.reduce((n, s) => n + s.blocks * BRR_BLOCK, 0);
}

export interface AramVerdict {
  total: number; // BRR bytes the directory advertises
  budget: number;
  fits: boolean;
  // Samples are only the floor: pattern data and the echo region are
  // charged on top, and echo alone runs to 28 KB on the demo's pollen8.
  verdict: string;
}

export function aramVerdict(list: BrrSample[]): AramVerdict {
  const total = samplesTotal(list);
  const budget = ARAM_MODULE_BUDGET;
  const pct = Math.round((total / budget) * 100);
  let verdict: string;
  if (total >= budget)
    verdict = `Ne tiendra pas : les échantillons seuls font ${pct} % du budget (${total} o pour ${budget} o), avant même les patterns et l'écho.`;
  else if (total > budget / 2)
    verdict = `Serré : ${pct} % du budget rien qu'en échantillons. Les patterns s'ajoutent, et l'écho peut coûter jusqu'à 28 Ko — il faudra le couper et sans doute alléger le jeu d'instruments.`;
  else
    verdict = `Tient : ${pct} % du budget en échantillons, de la place pour les patterns. Garder l'écho à zéro.`;
  return { total, budget, fits: total < budget, verdict };
}
