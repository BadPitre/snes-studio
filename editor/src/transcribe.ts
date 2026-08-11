// From what the chip played to a module the engine can load (X5-d).
//
// The SPC700 emulation hands over a flat list of "voice V keyed on
// sample S at pitch P with volume L/R, at time T". Turning that into an
// .it is three decisions, and each is a place where a performance stops
// being a score:
//
//   - TIME becomes rows. Events land on emulated samples; a tracker has
//     a grid. Everything gets quantised, and a driver whose tempo does
//     not divide the grid smears a little.
//   - PITCH becomes a note. The DSP plays a sample at rate
//     P/4096 x 32000 Hz, so the note is 12*log2(P/4096) semitones above
//     C-5. Rounded — most drivers sit on semitones, the ones that bend
//     lose the bend.
//   - SIZE becomes a compromise. ARAM holds one module, and the samples
//     are usually what overflows it, so they are downsampled until the
//     thing fits. That is a real loss, and it is reported.
//
// What is NOT attempted: recovering pattern structure or loop points.
// The output is one long sequence to finish in a tracker.

import { type BrrSample, ARAM_MODULE_BUDGET, BRR_BLOCK, decodeBrr, loopSample } from "./brr";
import { type ItCell, type ItPattern, type ItSample, type ItSong, writeIt } from "./itfile";
import { type SpcTrace } from "./spc700";

export const ROWS_PER_PATTERN = 128;
// smconv's own ceilings, read off its report on the demo's modules.
export const MAX_PATTERNS = 64;
export const MAX_SAMPLES = 64;

export interface TranscribeOpts {
  rowsPerSecond: 15 | 30 | 60;
  name: string;
  // How much ARAM the module may use. Pattern data is charged to the same
  // budget, so the samples are fitted to a fraction of it.
  budget?: number;
}

export interface TranscribeReport {
  notes: number;
  rows: number;
  patterns: number;
  samples: number;
  seconds: number;
  brrBytes: number; // what the samples will cost once smconv re-encodes
  downsampled: number; // 1 = untouched, 2 = halved, ...
  warnings: string[];
}

export interface Transcription {
  it: Uint8Array;
  report: TranscribeReport;
}

// The DSP plays a sample at pitch/4096 of 32000 Hz. C-5 is pitch 4096.
function noteOf(pitch: number): number {
  if (pitch <= 0) return 60;
  const n = Math.round(60 + 12 * Math.log2(pitch / 4096));
  return Math.max(0, Math.min(119, n));
}

function resample(pcm: Int16Array, factor: number): Int16Array {
  if (factor <= 1) return pcm;
  const n = Math.max(1, Math.floor(pcm.length / factor));
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = pcm[Math.min(pcm.length - 1, Math.round(i * factor))];
  return out;
}

function brrCost(sampleCount: number): number {
  return Math.ceil(sampleCount / 16) * BRR_BLOCK;
}

export function transcribe(
  trace: SpcTrace,
  aram: Uint8Array,
  directory: BrrSample[],
  opts: TranscribeOpts
): Transcription {
  const warnings: string[] = [];
  const budget = opts.budget ?? ARAM_MODULE_BUDGET;

  // ---- the instruments the song actually keyed on --------------------
  const used = [...trace.srcnUsed].sort((a, b) => a - b);
  const byDir = new Map(directory.map((d) => [d.dirIndex ?? -1, d]));
  const chosen: { srcn: number; entry: BrrSample }[] = [];
  for (const srcn of used) {
    const entry = byDir.get(srcn);
    if (!entry) {
      warnings.push(`Instrument ${srcn} joué mais absent du répertoire — ignoré.`);
      continue;
    }
    if (chosen.length >= MAX_SAMPLES) {
      warnings.push(`Plus de ${MAX_SAMPLES} instruments : les suivants sont ignorés.`);
      break;
    }
    chosen.push({ srcn, entry });
  }
  const insOf = new Map(chosen.map((c, i) => [c.srcn, i + 1])); // IT is 1-based

  // ---- fit the samples to the ARAM the module will get ---------------
  // Patterns share the budget; a quarter of it is a coarse but safe
  // reserve, and the real figure comes from smconv at build time anyway.
  const sampleBudget = Math.floor(budget * 0.75);
  const pcms = chosen.map((c) => decodeBrr(aram, c.entry.offset, c.entry.blocks));
  let factor = 1;
  while (
    factor < 8 &&
    pcms.reduce((n, p) => n + brrCost(Math.floor(p.length / factor)), 0) > sampleBudget
  )
    factor *= 2;
  const fitted = pcms.map((p) => resample(p, factor));
  const brrBytes = fitted.reduce((n, p) => n + brrCost(p.length), 0);
  if (factor > 1)
    warnings.push(
      `Instruments rééchantillonnés au 1/${factor} pour tenir dans l'ARAM — le son perd en clarté.`
    );
  if (brrBytes > sampleBudget)
    warnings.push(
      `Même au 1/${factor}, les instruments font ${brrBytes} o : le build refusera. Retirer des instruments.`
    );

  const samples: ItSample[] = chosen.map((c, i) => {
    const loop = loopSample(c.entry);
    const ls = loop === undefined ? undefined : Math.floor(loop / factor);
    return {
      name: `srcn ${c.srcn}`,
      pcm: fitted[i],
      c5speed: Math.round(32000 / factor),
      loopStart: ls !== undefined && ls < fitted[i].length - 1 ? ls : undefined,
    };
  });

  // ---- time becomes rows ---------------------------------------------
  const rowSamples = 32000 / opts.rowsPerSecond;
  const totalRows = Math.max(1, Math.ceil(trace.samples / rowSamples));
  const cells: (ItCell | null)[][] = Array.from({ length: totalRows }, () =>
    new Array<ItCell | null>(8).fill(null)
  );

  let notes = 0;
  for (const on of trace.ons) {
    const ins = insOf.get(on.srcn);
    if (ins === undefined) continue;
    const r = Math.min(totalRows - 1, Math.round(on.t / rowSamples));
    cells[r][on.voice] = {
      note: noteOf(on.pitch),
      ins,
      vol: Math.max(0, Math.min(64, Math.round(on.vol / 2))),
    };
    notes++;
  }
  // A key-off only becomes a note-off when the row is otherwise free —
  // a note starting on the same row of the same voice wins.
  for (const off of trace.offs) {
    const r = Math.min(totalRows - 1, Math.round(off.t / rowSamples));
    if (!cells[r][off.voice]) cells[r][off.voice] = { note: 255 };
  }

  // ---- rows become patterns -------------------------------------------
  const patterns: ItPattern[] = [];
  const order: number[] = [];
  for (let start = 0; start < totalRows; start += ROWS_PER_PATTERN) {
    if (patterns.length >= MAX_PATTERNS) {
      warnings.push(
        `Morceau tronqué à ${MAX_PATTERNS} patterns (${Math.round(
          (patterns.length * ROWS_PER_PATTERN) / opts.rowsPerSecond
        )} s) — la limite de smconv.`
      );
      break;
    }
    const rows = Math.min(ROWS_PER_PATTERN, totalRows - start);
    patterns.push({ rows, cells: cells.slice(start, start + rows) });
    order.push(patterns.length - 1);
  }

  // row = (2.5 / tempo) * speed seconds, so tempo 150 gives 60/speed rows
  // per second: speed 1, 2 and 4 land exactly on the three choices.
  const speed = 60 / opts.rowsPerSecond;
  const song: ItSong = {
    name: opts.name.slice(0, 25),
    speed,
    tempo: 150,
    channels: 8,
    samples,
    patterns,
    order,
  };

  return {
    it: writeIt(song),
    report: {
      notes,
      rows: totalRows,
      patterns: patterns.length,
      samples: samples.length,
      seconds: trace.samples / 32000,
      brrBytes,
      downsampled: factor,
      warnings,
    },
  };
}
