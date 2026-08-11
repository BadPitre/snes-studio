// SPC700 emulation, enough to make a game's own sound driver play (X5-c).
//
// The idea this rests on: whatever private sequence format a studio
// invented, its driver ends up writing the SAME eight voices of the SAME
// DSP. So instead of trying to READ a sequence nobody documented, we RUN
// the driver — which the .spc file conveniently ships with — and write
// down what it asks the chip to do. One implementation, every game.
//
// What is emulated, and why exactly this much:
//   - the CPU, all 256 opcodes, because the driver is a program;
//   - the three timers, because drivers clock their tempo off them;
//   - the DSP REGISTER FILE, because that is where the answers are;
//   - per-voice BRR playback POSITION (not audio), because ENDX is
//     polled by many drivers to know a sample finished;
//   - the ADSR/GAIN envelope, because ENVX is polled for the same kind
//     of reason.
// No mixing, no echo, no filtering: we never need a sample of audio,
// only the register writes.

export interface NoteOn {
  t: number; // time in DSP samples (32000 Hz)
  voice: number; // 0-7
  srcn: number; // sample directory entry
  pitch: number; // 14-bit pitch register
  vol: number; // 0-127, mean of |left| and |right|
  volL: number; // signed, as the driver wrote them — the stereo image
  volR: number;
}

// A volume change DURING a note. Drivers shape crescendos and fades by
// rewriting VxVOL while the voice plays; ignoring those is what makes a
// transcription sound flat.
export interface VolChange {
  t: number;
  voice: number;
  vol: number; // 0-127, same scale as NoteOn.vol
}

export interface NoteOff {
  t: number;
  voice: number;
}

export interface SpcTrace {
  ons: NoteOn[];
  offs: NoteOff[];
  vols: VolChange[];
  samples: number; // length of the run, in DSP samples
  srcnUsed: Set<number>;
}

const FLAG_N = 0x80;
const FLAG_V = 0x40;
const FLAG_P = 0x20;
const FLAG_B = 0x10;
const FLAG_H = 0x08;
const FLAG_I = 0x04;
const FLAG_Z = 0x02;
const FLAG_C = 0x01;

// Cycles per opcode. Tempo accuracy rides on this table; a wrong entry
// shifts timing slightly and never changes which notes are played.
const CYCLES = [
  2, 8, 4, 5, 3, 4, 3, 6, 2, 6, 5, 4, 5, 4, 6, 8,
  2, 8, 4, 5, 4, 5, 5, 6, 5, 5, 6, 5, 2, 2, 4, 6,
  2, 8, 4, 5, 3, 4, 3, 6, 2, 6, 5, 4, 5, 4, 5, 4,
  2, 8, 4, 5, 4, 5, 5, 6, 5, 5, 6, 5, 2, 2, 3, 8,
  2, 8, 4, 5, 3, 4, 3, 6, 2, 6, 4, 4, 5, 4, 6, 6,
  2, 8, 4, 5, 4, 5, 5, 6, 5, 5, 4, 5, 2, 2, 4, 3,
  2, 8, 4, 5, 3, 4, 3, 6, 2, 6, 4, 4, 5, 4, 5, 5,
  2, 8, 4, 5, 4, 5, 5, 6, 5, 5, 5, 5, 2, 2, 3, 6,
  2, 8, 4, 5, 3, 4, 3, 6, 2, 6, 5, 4, 5, 2, 4, 5,
  2, 8, 4, 5, 4, 5, 5, 6, 5, 5, 5, 5, 2, 2, 12, 5,
  3, 8, 4, 5, 3, 4, 3, 6, 2, 6, 4, 4, 5, 2, 4, 4,
  2, 8, 4, 5, 4, 5, 5, 6, 5, 5, 5, 5, 2, 2, 3, 4,
  3, 8, 4, 5, 4, 5, 4, 7, 2, 5, 6, 4, 5, 2, 4, 9,
  2, 8, 4, 5, 5, 6, 6, 7, 4, 5, 5, 5, 2, 2, 6, 3,
  2, 8, 4, 5, 3, 4, 3, 6, 2, 4, 5, 3, 4, 3, 4, 3,
  2, 8, 4, 5, 4, 5, 5, 6, 3, 4, 5, 4, 2, 2, 4, 3,
];

// Envelope rates, in DSP samples per step (0 = never). Standard table.
const ENV_RATE = [
  0, 2048, 1536, 1280, 1024, 768, 640, 512, 384, 320, 256, 192, 160, 128, 96,
  80, 64, 48, 40, 32, 24, 20, 16, 12, 10, 8, 6, 5, 4, 3, 2, 1,
];

interface Voice {
  // BRR playback position — tracked for ENDX only, no audio is produced.
  active: boolean;
  brr: number; // current block address in ARAM
  brrPos: number; // sample index inside the block, 0-15
  loopAddr: number;
  frac: number; // fractional position, 12 bits like the pitch register
  // envelope
  env: number; // 0..2047
  envState: number; // 0 attack, 1 decay, 2 sustain, 3 release
  envCount: number;
}

export class Spc700 {
  ram: Uint8Array; // 64 KB ARAM
  dsp = new Uint8Array(128);
  a = 0;
  x = 0;
  y = 0;
  sp = 0xff;
  pc = 0;
  psw = 0;
  cycles = 0;

  // timers: 3 dividers, 3 four-bit outputs, and the stage counters
  private tDiv = [0, 0, 0];
  private tCount = [0, 0, 0];
  private tOut = [0, 0, 0];
  private tTick = [0, 0, 0];
  private control = 0;
  private dspAddr = 0;

  private voices: Voice[] = [];
  private dspTick = 0;
  private dspSamples = 0;

  ons: NoteOn[] = [];
  offs: NoteOff[] = [];
  vols: VolChange[] = [];

  constructor(aram: Uint8Array, dsp: Uint8Array, regs: {
    pc: number; a: number; x: number; y: number; psw: number; sp: number;
  }) {
    this.ram = Uint8Array.from(aram);
    this.dsp.set(dsp.subarray(0, 128));
    this.pc = regs.pc;
    this.a = regs.a;
    this.x = regs.x;
    this.y = regs.y;
    this.psw = regs.psw;
    this.sp = regs.sp;
    // The dumper stores the SPC700's own I/O registers inside the ARAM
    // image; the timers must resume from there or the tempo is wrong.
    this.control = this.ram[0xf1];
    for (let i = 0; i < 3; i++) this.tDiv[i] = this.ram[0xfa + i];
    for (let v = 0; v < 8; v++)
      this.voices.push({
        active: false, brr: 0, brrPos: 0, loopAddr: 0, frac: 0,
        env: 0, envState: 3, envCount: 0,
      });
  }

  // ---- flags ---------------------------------------------------------

  private setNZ(v: number): number {
    this.psw = (this.psw & ~(FLAG_N | FLAG_Z)) | (v & 0x80) | (v === 0 ? FLAG_Z : 0);
    return v;
  }
  private setNZ16(v: number): number {
    this.psw =
      (this.psw & ~(FLAG_N | FLAG_Z)) |
      ((v >> 8) & 0x80) |
      ((v & 0xffff) === 0 ? FLAG_Z : 0);
    return v & 0xffff;
  }
  private get c(): number {
    return this.psw & FLAG_C;
  }
  private setC(on: boolean) {
    this.psw = on ? this.psw | FLAG_C : this.psw & ~FLAG_C;
  }

  // ---- memory --------------------------------------------------------

  read(addr: number): number {
    addr &= 0xffff;
    if (addr >= 0xf0 && addr <= 0xff) {
      switch (addr) {
        case 0xf2:
          return this.dspAddr;
        case 0xf3:
          return this.readDsp(this.dspAddr & 0x7f);
        case 0xfd:
        case 0xfe:
        case 0xff: {
          // reading a timer output clears it — drivers count on that
          const i = addr - 0xfd;
          const v = this.tOut[i];
          this.tOut[i] = 0;
          return v;
        }
        default:
          return this.ram[addr];
      }
    }
    return this.ram[addr];
  }

  write(addr: number, v: number) {
    addr &= 0xffff;
    v &= 0xff;
    if (addr >= 0xf0 && addr <= 0xff) {
      switch (addr) {
        case 0xf1: {
          // enabling a timer resets its stage and output
          for (let i = 0; i < 3; i++)
            if (!(this.control & (1 << i)) && v & (1 << i)) {
              this.tCount[i] = 0;
              this.tOut[i] = 0;
              this.tTick[i] = 0;
            }
          this.control = v;
          break;
        }
        case 0xf2:
          this.dspAddr = v;
          break;
        case 0xf3:
          if (this.dspAddr < 0x80) this.writeDsp(this.dspAddr, v);
          break;
        case 0xfa:
        case 0xfb:
        case 0xfc:
          this.tDiv[addr - 0xfa] = v; // 0 means 256
          break;
        default:
          break;
      }
      this.ram[addr] = v;
      return;
    }
    this.ram[addr] = v;
  }

  private dp(off: number): number {
    return ((this.psw & FLAG_P ? 0x100 : 0) + (off & 0xff)) & 0xffff;
  }
  private fetch(): number {
    const v = this.ram[this.pc & 0xffff];
    this.pc = (this.pc + 1) & 0xffff;
    return v;
  }
  private fetch16(): number {
    const lo = this.fetch();
    return lo | (this.fetch() << 8);
  }
  private push(v: number) {
    this.ram[0x100 + this.sp] = v & 0xff;
    this.sp = (this.sp - 1) & 0xff;
  }
  private pop(): number {
    this.sp = (this.sp + 1) & 0xff;
    return this.ram[0x100 + this.sp];
  }

  // ---- DSP -----------------------------------------------------------

  private readDsp(r: number): number {
    return this.dsp[r];
  }

  private writeDsp(r: number, v: number) {
    if (r === 0x7c) {
      // ENDX is write-to-clear
      this.dsp[0x7c] = 0;
      return;
    }
    this.dsp[r] = v;
    if (r === 0x4c) this.keyOn(v);
    else if (r === 0x5c) this.keyOff(v);
    else if ((r & 0x0f) <= 1 && r < 0x80) {
      // VxVOL rewritten mid-note: log it if the level really moved.
      const voice = r >> 4;
      const vc = this.voices[voice];
      if (vc && vc.active && this.vols.length < 60000) {
        const l = (this.dsp[voice * 16] << 24) >> 24;
        const rr = (this.dsp[voice * 16 + 1] << 24) >> 24;
        const vol = Math.min(127, (Math.abs(l) + Math.abs(rr)) >> 1);
        const last = this.lastVol[voice];
        if (Math.abs(vol - last) >= 4) {
          this.lastVol[voice] = vol;
          this.vols.push({ t: this.dspSamples, voice, vol });
        }
      }
    }
  }

  private lastVol = new Array(8).fill(0);

  private keyOn(mask: number) {
    for (let i = 0; i < 8; i++) {
      if (!(mask & (1 << i))) continue;
      const v = this.voices[i];
      const srcn = this.dsp[i * 16 + 4];
      const dir = (this.dsp[0x5d] << 8) & 0xffff;
      const e = (dir + srcn * 4) & 0xffff;
      v.brr = this.ram[e] | (this.ram[e + 1] << 8);
      v.loopAddr = this.ram[e + 2] | (this.ram[e + 3] << 8);
      v.frac = 0;
      v.brrPos = 0;
      v.active = true;
      v.env = 0;
      v.envState = 0;
      v.envCount = 0;
      this.dsp[0x7c] &= ~(1 << i); // key-on clears this voice's ENDX
      const l = (this.dsp[i * 16] << 24) >> 24;
      const r = (this.dsp[i * 16 + 1] << 24) >> 24;
      const vol = Math.min(127, (Math.abs(l) + Math.abs(r)) >> 1);
      this.lastVol[i] = vol;
      this.ons.push({
        t: this.dspSamples,
        voice: i,
        srcn,
        pitch: (this.dsp[i * 16 + 2] | (this.dsp[i * 16 + 3] << 8)) & 0x3fff,
        vol,
        volL: l,
        volR: r,
      });
    }
  }

  private keyOff(mask: number) {
    for (let i = 0; i < 8; i++) {
      if (!(mask & (1 << i)) || !this.voices[i].active) continue;
      this.voices[i].envState = 3;
      this.offs.push({ t: this.dspSamples, voice: i });
    }
  }

  // One DSP sample: advance each voice's read position and its envelope.
  // The only outputs that matter are ENDX and ENVX, because those are
  // what a driver reads back.
  private dspStep() {
    this.dspSamples++;
    const reset = (this.dsp[0x6c] & 0x80) !== 0; // FLG soft reset
    for (let i = 0; i < 8; i++) {
      const v = this.voices[i];
      if (!v.active) continue;
      if (reset) {
        v.active = false;
        v.env = 0;
        continue;
      }
      const pitch = (this.dsp[i * 16 + 2] | (this.dsp[i * 16 + 3] << 8)) & 0x3fff;
      v.frac += pitch;
      while (v.frac >= 0x1000) {
        v.frac -= 0x1000;
        v.brrPos++;
        if (v.brrPos >= 16) {
          v.brrPos = 0;
          const h = this.ram[v.brr & 0xffff];
          if (h & 1) {
            this.dsp[0x7c] |= 1 << i;
            if (h & 2) v.brr = v.loopAddr;
            else {
              v.active = false;
              v.env = 0;
              break;
            }
          } else {
            v.brr = (v.brr + 9) & 0xffff;
          }
        }
      }
      this.envStep(i, v);
      this.dsp[i * 16 + 8] = v.env >> 4; // ENVX
    }
  }

  private envStep(i: number, v: Voice) {
    const adsr1 = this.dsp[i * 16 + 5];
    const useAdsr = (adsr1 & 0x80) !== 0;
    let rate = 0;
    let target = 2047;
    let mode: "lin+" | "exp-" | "lin-" | "none" = "none";
    if (v.envState === 3) {
      // release: fixed linear ramp to zero
      v.env = Math.max(0, v.env - 8);
      return;
    }
    if (useAdsr) {
      const adsr2 = this.dsp[i * 16 + 6];
      if (v.envState === 0) {
        const ar = adsr1 & 0x0f;
        rate = ar === 15 ? 1 : ENV_RATE[ar * 2 + 1];
        mode = "lin+";
        target = 2047;
      } else if (v.envState === 1) {
        rate = ENV_RATE[((adsr1 >> 4) & 0x07) * 2 + 16];
        mode = "exp-";
        target = ((adsr2 >> 5) + 1) * 0x100;
      } else {
        rate = ENV_RATE[adsr2 & 0x1f];
        mode = "exp-";
        target = 0;
      }
    } else {
      const gain = this.dsp[i * 16 + 7];
      if (!(gain & 0x80)) {
        v.env = (gain & 0x7f) * 16; // direct
        return;
      }
      rate = ENV_RATE[gain & 0x1f];
      const g = (gain >> 5) & 3;
      mode = g === 0 ? "lin-" : g === 1 ? "exp-" : "lin+";
      target = mode === "lin+" ? 2047 : 0;
    }
    if (!rate) return;
    if (++v.envCount < rate) return;
    v.envCount = 0;
    if (mode === "lin+") v.env = Math.min(2047, v.env + 32);
    else if (mode === "lin-") v.env = Math.max(0, v.env - 32);
    else v.env = Math.max(0, v.env - (((v.env - 1) >> 8) + 1));
    if (v.envState === 0 && v.env >= 2047) v.envState = 1;
    else if (v.envState === 1 && v.env <= target) v.envState = 2;
  }

  private tick(n: number) {
    this.cycles += n;
    // DSP runs at 32 kHz; the CPU at 1.024 MHz — 32 cycles per sample.
    this.dspTick += n;
    while (this.dspTick >= 32) {
      this.dspTick -= 32;
      this.dspStep();
    }
    // timers 0 and 1 at 8 kHz (every 128 cycles), timer 2 at 64 kHz (16)
    for (let i = 0; i < 3; i++) {
      if (!(this.control & (1 << i))) continue;
      const period = i === 2 ? 16 : 128;
      this.tTick[i] += n;
      while (this.tTick[i] >= period) {
        this.tTick[i] -= period;
        const div = this.tDiv[i] === 0 ? 256 : this.tDiv[i];
        if (++this.tCount[i] >= div) {
          this.tCount[i] = 0;
          this.tOut[i] = (this.tOut[i] + 1) & 0x0f;
        }
      }
    }
  }

  // ---- arithmetic helpers --------------------------------------------

  private adc(a: number, b: number): number {
    const r = a + b + this.c;
    this.psw &= ~(FLAG_V | FLAG_H | FLAG_C);
    if (~(a ^ b) & (a ^ r) & 0x80) this.psw |= FLAG_V;
    if ((a ^ b ^ r) & 0x10) this.psw |= FLAG_H;
    if (r > 0xff) this.psw |= FLAG_C;
    return this.setNZ(r & 0xff);
  }
  private sbc(a: number, b: number): number {
    return this.adc(a, ~b & 0xff);
  }
  private cmp(a: number, b: number) {
    const r = a - b;
    this.setC(r >= 0);
    this.setNZ(r & 0xff);
  }
  private asl(v: number): number {
    this.setC((v & 0x80) !== 0);
    return this.setNZ((v << 1) & 0xff);
  }
  private lsr(v: number): number {
    this.setC((v & 1) !== 0);
    return this.setNZ(v >> 1);
  }
  private rol(v: number): number {
    const c = this.c;
    this.setC((v & 0x80) !== 0);
    return this.setNZ(((v << 1) | c) & 0xff);
  }
  private ror(v: number): number {
    const c = this.c;
    this.setC((v & 1) !== 0);
    return this.setNZ((v >> 1) | (c ? 0x80 : 0));
  }

  // A bit operand: 13 address bits then 3 bit-index bits.
  private bitOperand(): [number, number] {
    const w = this.fetch16();
    return [w & 0x1fff, (w >> 13) & 7];
  }

  private branch(cond: boolean) {
    const rel = (this.fetch() << 24) >> 24;
    if (cond) {
      this.pc = (this.pc + rel) & 0xffff;
      this.tick(2);
    }
  }

  // ---- the interpreter -----------------------------------------------

  step() {
    const op = this.fetch();
    this.tick(CYCLES[op]);
    switch (op) {
      // -- flags and misc
      case 0x00: break; // NOP
      case 0x20: this.psw &= ~FLAG_P; break; // CLRP
      case 0x40: this.psw |= FLAG_P; break; // SETP
      case 0x60: this.psw &= ~FLAG_C; break; // CLRC
      case 0x80: this.psw |= FLAG_C; break; // SETC
      case 0xa0: this.psw |= FLAG_I; break; // EI
      case 0xc0: this.psw &= ~FLAG_I; break; // DI
      case 0xe0: this.psw &= ~(FLAG_V | FLAG_H); break; // CLRV
      case 0xed: this.psw ^= FLAG_C; break; // NOTC
      case 0xef: case 0xff: this.pc = (this.pc - 1) & 0xffff; break; // SLEEP/STOP

      // -- 8-bit loads
      case 0xe8: this.a = this.setNZ(this.fetch()); break;
      case 0xe4: this.a = this.setNZ(this.read(this.dp(this.fetch()))); break;
      case 0xf4: this.a = this.setNZ(this.read(this.dp(this.fetch() + this.x))); break;
      case 0xe5: this.a = this.setNZ(this.read(this.fetch16())); break;
      case 0xf5: this.a = this.setNZ(this.read((this.fetch16() + this.x) & 0xffff)); break;
      case 0xf6: this.a = this.setNZ(this.read((this.fetch16() + this.y) & 0xffff)); break;
      case 0xe6: this.a = this.setNZ(this.read(this.dp(this.x))); break;
      case 0xbf: {
        this.a = this.setNZ(this.read(this.dp(this.x)));
        this.x = (this.x + 1) & 0xff;
        break;
      }
      case 0xe7: this.a = this.setNZ(this.read(this.indX())); break;
      case 0xf7: this.a = this.setNZ(this.read(this.indY())); break;
      case 0xcd: this.x = this.setNZ(this.fetch()); break;
      case 0xf8: this.x = this.setNZ(this.read(this.dp(this.fetch()))); break;
      case 0xf9: this.x = this.setNZ(this.read(this.dp(this.fetch() + this.y))); break;
      case 0xe9: this.x = this.setNZ(this.read(this.fetch16())); break;
      case 0x8d: this.y = this.setNZ(this.fetch()); break;
      case 0xeb: this.y = this.setNZ(this.read(this.dp(this.fetch()))); break;
      case 0xfb: this.y = this.setNZ(this.read(this.dp(this.fetch() + this.x))); break;
      case 0xec: this.y = this.setNZ(this.read(this.fetch16())); break;

      // -- 8-bit stores
      case 0xc4: this.write(this.dp(this.fetch()), this.a); break;
      case 0xd4: this.write(this.dp(this.fetch() + this.x), this.a); break;
      case 0xc5: this.write(this.fetch16(), this.a); break;
      case 0xd5: this.write((this.fetch16() + this.x) & 0xffff, this.a); break;
      case 0xd6: this.write((this.fetch16() + this.y) & 0xffff, this.a); break;
      case 0xc6: this.write(this.dp(this.x), this.a); break;
      case 0xaf: {
        this.write(this.dp(this.x), this.a);
        this.x = (this.x + 1) & 0xff;
        break;
      }
      case 0xc7: this.write(this.indX(), this.a); break;
      case 0xd7: this.write(this.indY(), this.a); break;
      case 0xd8: this.write(this.dp(this.fetch()), this.x); break;
      case 0xd9: this.write(this.dp(this.fetch() + this.y), this.x); break;
      case 0xc9: this.write(this.fetch16(), this.x); break;
      case 0xcb: this.write(this.dp(this.fetch()), this.y); break;
      case 0xdb: this.write(this.dp(this.fetch() + this.x), this.y); break;
      case 0xcc: this.write(this.fetch16(), this.y); break;
      case 0x8f: {
        const v = this.fetch();
        this.write(this.dp(this.fetch()), v);
        break;
      }
      case 0xfa: {
        const s = this.read(this.dp(this.fetch()));
        this.write(this.dp(this.fetch()), s);
        break;
      }

      // -- register transfers
      case 0x7d: this.a = this.setNZ(this.x); break;
      case 0x5d: this.x = this.setNZ(this.a); break;
      case 0xdd: this.a = this.setNZ(this.y); break;
      case 0xfd: this.y = this.setNZ(this.a); break;
      case 0x9d: this.x = this.setNZ(this.sp); break;
      case 0xbd: this.sp = this.x; break;

      // -- stack
      case 0x2d: this.push(this.a); break;
      case 0x4d: this.push(this.x); break;
      case 0x6d: this.push(this.y); break;
      case 0x0d: this.push(this.psw); break;
      case 0xae: this.a = this.pop(); break;
      case 0xce: this.x = this.pop(); break;
      case 0xee: this.y = this.pop(); break;
      case 0x8e: this.psw = this.pop(); break;

      // -- ALU on A
      case 0x08: this.a = this.setNZ(this.a | this.fetch()); break;
      case 0x04: this.a = this.setNZ(this.a | this.read(this.dp(this.fetch()))); break;
      case 0x14: this.a = this.setNZ(this.a | this.read(this.dp(this.fetch() + this.x))); break;
      case 0x05: this.a = this.setNZ(this.a | this.read(this.fetch16())); break;
      case 0x15: this.a = this.setNZ(this.a | this.read((this.fetch16() + this.x) & 0xffff)); break;
      case 0x16: this.a = this.setNZ(this.a | this.read((this.fetch16() + this.y) & 0xffff)); break;
      case 0x06: this.a = this.setNZ(this.a | this.read(this.dp(this.x))); break;
      case 0x07: this.a = this.setNZ(this.a | this.read(this.indX())); break;
      case 0x17: this.a = this.setNZ(this.a | this.read(this.indY())); break;
      case 0x28: this.a = this.setNZ(this.a & this.fetch()); break;
      case 0x24: this.a = this.setNZ(this.a & this.read(this.dp(this.fetch()))); break;
      case 0x34: this.a = this.setNZ(this.a & this.read(this.dp(this.fetch() + this.x))); break;
      case 0x25: this.a = this.setNZ(this.a & this.read(this.fetch16())); break;
      case 0x35: this.a = this.setNZ(this.a & this.read((this.fetch16() + this.x) & 0xffff)); break;
      case 0x36: this.a = this.setNZ(this.a & this.read((this.fetch16() + this.y) & 0xffff)); break;
      case 0x26: this.a = this.setNZ(this.a & this.read(this.dp(this.x))); break;
      case 0x27: this.a = this.setNZ(this.a & this.read(this.indX())); break;
      case 0x37: this.a = this.setNZ(this.a & this.read(this.indY())); break;
      case 0x48: this.a = this.setNZ(this.a ^ this.fetch()); break;
      case 0x44: this.a = this.setNZ(this.a ^ this.read(this.dp(this.fetch()))); break;
      case 0x54: this.a = this.setNZ(this.a ^ this.read(this.dp(this.fetch() + this.x))); break;
      case 0x45: this.a = this.setNZ(this.a ^ this.read(this.fetch16())); break;
      case 0x55: this.a = this.setNZ(this.a ^ this.read((this.fetch16() + this.x) & 0xffff)); break;
      case 0x56: this.a = this.setNZ(this.a ^ this.read((this.fetch16() + this.y) & 0xffff)); break;
      case 0x46: this.a = this.setNZ(this.a ^ this.read(this.dp(this.x))); break;
      case 0x47: this.a = this.setNZ(this.a ^ this.read(this.indX())); break;
      case 0x57: this.a = this.setNZ(this.a ^ this.read(this.indY())); break;
      case 0x88: this.a = this.adc(this.a, this.fetch()); break;
      case 0x84: this.a = this.adc(this.a, this.read(this.dp(this.fetch()))); break;
      case 0x94: this.a = this.adc(this.a, this.read(this.dp(this.fetch() + this.x))); break;
      case 0x85: this.a = this.adc(this.a, this.read(this.fetch16())); break;
      case 0x95: this.a = this.adc(this.a, this.read((this.fetch16() + this.x) & 0xffff)); break;
      case 0x96: this.a = this.adc(this.a, this.read((this.fetch16() + this.y) & 0xffff)); break;
      case 0x86: this.a = this.adc(this.a, this.read(this.dp(this.x))); break;
      case 0x87: this.a = this.adc(this.a, this.read(this.indX())); break;
      case 0x97: this.a = this.adc(this.a, this.read(this.indY())); break;
      case 0xa8: this.a = this.sbc(this.a, this.fetch()); break;
      case 0xa4: this.a = this.sbc(this.a, this.read(this.dp(this.fetch()))); break;
      case 0xb4: this.a = this.sbc(this.a, this.read(this.dp(this.fetch() + this.x))); break;
      case 0xa5: this.a = this.sbc(this.a, this.read(this.fetch16())); break;
      case 0xb5: this.a = this.sbc(this.a, this.read((this.fetch16() + this.x) & 0xffff)); break;
      case 0xb6: this.a = this.sbc(this.a, this.read((this.fetch16() + this.y) & 0xffff)); break;
      case 0xa6: this.a = this.sbc(this.a, this.read(this.dp(this.x))); break;
      case 0xa7: this.a = this.sbc(this.a, this.read(this.indX())); break;
      case 0xb7: this.a = this.sbc(this.a, this.read(this.indY())); break;
      case 0x68: this.cmp(this.a, this.fetch()); break;
      case 0x64: this.cmp(this.a, this.read(this.dp(this.fetch()))); break;
      case 0x74: this.cmp(this.a, this.read(this.dp(this.fetch() + this.x))); break;
      case 0x65: this.cmp(this.a, this.read(this.fetch16())); break;
      case 0x75: this.cmp(this.a, this.read((this.fetch16() + this.x) & 0xffff)); break;
      case 0x76: this.cmp(this.a, this.read((this.fetch16() + this.y) & 0xffff)); break;
      case 0x66: this.cmp(this.a, this.read(this.dp(this.x))); break;
      case 0x67: this.cmp(this.a, this.read(this.indX())); break;
      case 0x77: this.cmp(this.a, this.read(this.indY())); break;
      case 0xc8: this.cmp(this.x, this.fetch()); break;
      case 0x3e: this.cmp(this.x, this.read(this.dp(this.fetch()))); break;
      case 0x1e: this.cmp(this.x, this.read(this.fetch16())); break;
      case 0xad: this.cmp(this.y, this.fetch()); break;
      case 0x7e: this.cmp(this.y, this.read(this.dp(this.fetch()))); break;
      case 0x5e: this.cmp(this.y, this.read(this.fetch16())); break;

      // -- ALU, memory to memory (source byte comes FIRST in the stream)
      case 0x09: this.memOp((a, b) => this.setNZ(a | b)); break;
      case 0x29: this.memOp((a, b) => this.setNZ(a & b)); break;
      case 0x49: this.memOp((a, b) => this.setNZ(a ^ b)); break;
      case 0x89: this.memOp((a, b) => this.adc(a, b)); break;
      case 0xa9: this.memOp((a, b) => this.sbc(a, b)); break;
      case 0x69: this.memCmp(); break;
      case 0x18: this.immOp((a, b) => this.setNZ(a | b)); break;
      case 0x38: this.immOp((a, b) => this.setNZ(a & b)); break;
      case 0x58: this.immOp((a, b) => this.setNZ(a ^ b)); break;
      case 0x98: this.immOp((a, b) => this.adc(a, b)); break;
      case 0xb8: this.immOp((a, b) => this.sbc(a, b)); break;
      case 0x78: {
        const v = this.fetch();
        this.cmp(this.read(this.dp(this.fetch())), v);
        break;
      }
      case 0x19: this.xyOp((a, b) => this.setNZ(a | b)); break;
      case 0x39: this.xyOp((a, b) => this.setNZ(a & b)); break;
      case 0x59: this.xyOp((a, b) => this.setNZ(a ^ b)); break;
      case 0x99: this.xyOp((a, b) => this.adc(a, b)); break;
      case 0xb9: this.xyOp((a, b) => this.sbc(a, b)); break;
      case 0x79: this.cmp(this.read(this.dp(this.x)), this.read(this.dp(this.y))); break;

      // -- increment / decrement
      case 0xbc: this.a = this.setNZ((this.a + 1) & 0xff); break;
      case 0x9c: this.a = this.setNZ((this.a - 1) & 0xff); break;
      case 0x3d: this.x = this.setNZ((this.x + 1) & 0xff); break;
      case 0x1d: this.x = this.setNZ((this.x - 1) & 0xff); break;
      case 0xfc: this.y = this.setNZ((this.y + 1) & 0xff); break;
      case 0xdc: this.y = this.setNZ((this.y - 1) & 0xff); break;
      case 0xab: this.rmw(this.dp(this.fetch()), (v) => this.setNZ((v + 1) & 0xff)); break;
      case 0xbb: this.rmw(this.dp(this.fetch() + this.x), (v) => this.setNZ((v + 1) & 0xff)); break;
      case 0xac: this.rmw(this.fetch16(), (v) => this.setNZ((v + 1) & 0xff)); break;
      case 0x8b: this.rmw(this.dp(this.fetch()), (v) => this.setNZ((v - 1) & 0xff)); break;
      case 0x9b: this.rmw(this.dp(this.fetch() + this.x), (v) => this.setNZ((v - 1) & 0xff)); break;
      case 0x8c: this.rmw(this.fetch16(), (v) => this.setNZ((v - 1) & 0xff)); break;

      // -- shifts
      case 0x1c: this.a = this.asl(this.a); break;
      case 0x0b: this.rmw(this.dp(this.fetch()), (v) => this.asl(v)); break;
      case 0x1b: this.rmw(this.dp(this.fetch() + this.x), (v) => this.asl(v)); break;
      case 0x0c: this.rmw(this.fetch16(), (v) => this.asl(v)); break;
      case 0x5c: this.a = this.lsr(this.a); break;
      case 0x4b: this.rmw(this.dp(this.fetch()), (v) => this.lsr(v)); break;
      case 0x5b: this.rmw(this.dp(this.fetch() + this.x), (v) => this.lsr(v)); break;
      case 0x4c: this.rmw(this.fetch16(), (v) => this.lsr(v)); break;
      case 0x3c: this.a = this.rol(this.a); break;
      case 0x2b: this.rmw(this.dp(this.fetch()), (v) => this.rol(v)); break;
      case 0x3b: this.rmw(this.dp(this.fetch() + this.x), (v) => this.rol(v)); break;
      case 0x2c: this.rmw(this.fetch16(), (v) => this.rol(v)); break;
      case 0x7c: this.a = this.ror(this.a); break;
      case 0x6b: this.rmw(this.dp(this.fetch()), (v) => this.ror(v)); break;
      case 0x7b: this.rmw(this.dp(this.fetch() + this.x), (v) => this.ror(v)); break;
      case 0x6c: this.rmw(this.fetch16(), (v) => this.ror(v)); break;
      case 0x9f: {
        this.a = this.setNZ(((this.a >> 4) | (this.a << 4)) & 0xff); // XCN
        break;
      }

      // -- 16-bit
      case 0xba: {
        const d = this.dp(this.fetch());
        const v = this.read(d) | (this.read((d + 1) & 0xffff) << 8);
        this.a = v & 0xff;
        this.y = v >> 8;
        this.setNZ16(v);
        break;
      }
      case 0xda: {
        const d = this.dp(this.fetch());
        this.write(d, this.a);
        this.write((d + 1) & 0xffff, this.y);
        break;
      }
      case 0x3a: this.incw(1); break;
      case 0x1a: this.incw(-1); break;
      case 0x7a: this.addw(false); break;
      case 0x9a: this.addw(true); break;
      case 0x5a: {
        const d = this.dp(this.fetch());
        const v = this.read(d) | (this.read((d + 1) & 0xffff) << 8);
        const ya = this.a | (this.y << 8);
        const r = ya - v;
        this.setC(r >= 0);
        this.setNZ16(r & 0xffff);
        break;
      }
      case 0xcf: {
        const r = this.y * this.a;
        this.a = r & 0xff;
        this.y = (r >> 8) & 0xff;
        this.setNZ(this.y);
        break;
      }
      case 0x9e: this.div(); break;

      // -- decimal adjust
      case 0xdf: {
        let a = this.a;
        if (this.c || a > 0x99) {
          a += 0x60;
          this.psw |= FLAG_C;
        }
        if (this.psw & FLAG_H || (a & 15) > 9) a += 6;
        this.a = this.setNZ(a & 0xff);
        break;
      }
      case 0xbe: {
        let a = this.a;
        if (!this.c || a > 0x99) {
          a -= 0x60;
          this.psw &= ~FLAG_C;
        }
        if (!(this.psw & FLAG_H) || (a & 15) > 9) a -= 6;
        this.a = this.setNZ(a & 0xff);
        break;
      }

      // -- branches
      case 0x2f: this.branch(true); break;
      case 0x10: this.branch(!(this.psw & FLAG_N)); break;
      case 0x30: this.branch(!!(this.psw & FLAG_N)); break;
      case 0x50: this.branch(!(this.psw & FLAG_V)); break;
      case 0x70: this.branch(!!(this.psw & FLAG_V)); break;
      case 0x90: this.branch(!this.c); break;
      case 0xb0: this.branch(!!this.c); break;
      case 0xd0: this.branch(!(this.psw & FLAG_Z)); break;
      case 0xf0: this.branch(!!(this.psw & FLAG_Z)); break;
      case 0x2e: {
        const v = this.read(this.dp(this.fetch()));
        this.branch(v !== this.a);
        break;
      }
      case 0xde: {
        const v = this.read(this.dp(this.fetch() + this.x));
        this.branch(v !== this.a);
        break;
      }
      case 0x6e: {
        const d = this.dp(this.fetch());
        const v = (this.read(d) - 1) & 0xff;
        this.write(d, v);
        this.branch(v !== 0);
        break;
      }
      case 0xfe: {
        this.y = (this.y - 1) & 0xff;
        this.branch(this.y !== 0);
        break;
      }

      // -- jumps and calls
      case 0x5f: this.pc = this.fetch16(); break;
      case 0x1f: {
        const b = (this.fetch16() + this.x) & 0xffff;
        this.pc = this.ram[b] | (this.ram[(b + 1) & 0xffff] << 8);
        break;
      }
      case 0x3f: {
        const t = this.fetch16();
        this.push(this.pc >> 8);
        this.push(this.pc & 0xff);
        this.pc = t;
        break;
      }
      case 0x4f: {
        const t = 0xff00 | this.fetch();
        this.push(this.pc >> 8);
        this.push(this.pc & 0xff);
        this.pc = t;
        break;
      }
      case 0x6f: {
        const lo = this.pop();
        this.pc = lo | (this.pop() << 8);
        break;
      }
      case 0x7f: {
        this.psw = this.pop();
        const lo = this.pop();
        this.pc = lo | (this.pop() << 8);
        break;
      }
      case 0x0f: {
        this.push(this.pc >> 8);
        this.push(this.pc & 0xff);
        this.push(this.psw);
        this.psw = (this.psw | FLAG_B) & ~FLAG_I;
        this.pc = this.ram[0xffde] | (this.ram[0xffdf] << 8);
        break;
      }

      // -- TCALL n: vector at $FFDE - 2n
      case 0x01: case 0x11: case 0x21: case 0x31:
      case 0x41: case 0x51: case 0x61: case 0x71:
      case 0x81: case 0x91: case 0xa1: case 0xb1:
      case 0xc1: case 0xd1: case 0xe1: case 0xf1: {
        const n = op >> 4;
        const vec = (0xffde - n * 2) & 0xffff;
        this.push(this.pc >> 8);
        this.push(this.pc & 0xff);
        this.pc = this.ram[vec] | (this.ram[(vec + 1) & 0xffff] << 8);
        break;
      }

      // -- SET1 / CLR1 dp.bit
      case 0x02: case 0x22: case 0x42: case 0x62:
      case 0x82: case 0xa2: case 0xc2: case 0xe2: {
        const d = this.dp(this.fetch());
        this.write(d, this.read(d) | (1 << (op >> 5)));
        break;
      }
      case 0x12: case 0x32: case 0x52: case 0x72:
      case 0x92: case 0xb2: case 0xd2: case 0xf2: {
        const d = this.dp(this.fetch());
        this.write(d, this.read(d) & ~(1 << (op >> 5)));
        break;
      }

      // -- BBS / BBC dp.bit, rel
      case 0x03: case 0x23: case 0x43: case 0x63:
      case 0x83: case 0xa3: case 0xc3: case 0xe3: {
        const v = this.read(this.dp(this.fetch()));
        this.branch((v & (1 << (op >> 5))) !== 0);
        break;
      }
      case 0x13: case 0x33: case 0x53: case 0x73:
      case 0x93: case 0xb3: case 0xd3: case 0xf3: {
        const v = this.read(this.dp(this.fetch()));
        this.branch((v & (1 << (op >> 5))) === 0);
        break;
      }

      // -- carry/bit instructions on a 13-bit address
      case 0x0a: { const [m, b] = this.bitOperand(); this.setC(!!this.c || !!((this.read(m) >> b) & 1)); break; }
      case 0x2a: { const [m, b] = this.bitOperand(); this.setC(!!this.c || !((this.read(m) >> b) & 1)); break; }
      case 0x4a: { const [m, b] = this.bitOperand(); this.setC(!!this.c && !!((this.read(m) >> b) & 1)); break; }
      case 0x6a: { const [m, b] = this.bitOperand(); this.setC(!!this.c && !((this.read(m) >> b) & 1)); break; }
      case 0x8a: { const [m, b] = this.bitOperand(); this.setC(!!this.c !== !!((this.read(m) >> b) & 1)); break; }
      case 0xaa: { const [m, b] = this.bitOperand(); this.setC(!!((this.read(m) >> b) & 1)); break; }
      case 0xca: {
        const [m, b] = this.bitOperand();
        this.write(m, this.c ? this.read(m) | (1 << b) : this.read(m) & ~(1 << b));
        break;
      }
      case 0xea: { const [m, b] = this.bitOperand(); this.write(m, this.read(m) ^ (1 << b)); break; }

      // -- TSET1 / TCLR1
      case 0x0e: {
        const m = this.fetch16();
        const v = this.read(m);
        this.setNZ((this.a - v) & 0xff);
        this.write(m, v | this.a);
        break;
      }
      case 0x4e: {
        const m = this.fetch16();
        const v = this.read(m);
        this.setNZ((this.a - v) & 0xff);
        this.write(m, v & ~this.a);
        break;
      }

      default:
        break; // unreachable: the table above is complete
    }
  }

  // ---- addressing helpers --------------------------------------------

  private indX(): number {
    const d = this.dp(this.fetch() + this.x);
    return this.read(d) | (this.read((d + 1) & 0xffff) << 8);
  }
  private indY(): number {
    const d = this.dp(this.fetch());
    return ((this.read(d) | (this.read((d + 1) & 0xffff) << 8)) + this.y) & 0xffff;
  }
  private rmw(addr: number, f: (v: number) => number) {
    this.write(addr, f(this.read(addr)));
  }
  // `OP dd, ss`: the SOURCE byte is encoded first.
  private memOp(f: (a: number, b: number) => number) {
    const s = this.read(this.dp(this.fetch()));
    const d = this.dp(this.fetch());
    this.write(d, f(this.read(d), s));
  }
  private memCmp() {
    const s = this.read(this.dp(this.fetch()));
    const d = this.read(this.dp(this.fetch()));
    this.cmp(d, s);
  }
  // `OP dd, #imm`: the immediate is encoded first.
  private immOp(f: (a: number, b: number) => number) {
    const imm = this.fetch();
    const d = this.dp(this.fetch());
    this.write(d, f(this.read(d), imm));
  }
  private xyOp(f: (a: number, b: number) => number) {
    const dx = this.dp(this.x);
    this.write(dx, f(this.read(dx), this.read(this.dp(this.y))));
  }
  private incw(delta: number) {
    const d = this.dp(this.fetch());
    const v = (this.read(d) | (this.read((d + 1) & 0xffff) << 8)) + delta;
    this.write(d, v & 0xff);
    this.write((d + 1) & 0xffff, (v >> 8) & 0xff);
    this.setNZ16(v & 0xffff);
  }
  private addw(sub: boolean) {
    const d = this.dp(this.fetch());
    const v = this.read(d) | (this.read((d + 1) & 0xffff) << 8);
    const ya = this.a | (this.y << 8);
    const b = sub ? (~v + 1) & 0xffff : v;
    const r = ya + b;
    this.psw &= ~(FLAG_V | FLAG_H | FLAG_C);
    if (sub) {
      if ((ya ^ v) & (ya ^ (r & 0xffff)) & 0x8000) this.psw |= FLAG_V;
      if ((ya & 0xfff) - (v & 0xfff) >= 0) this.psw |= FLAG_H;
      if (ya >= v) this.psw |= FLAG_C;
    } else {
      if (~(ya ^ v) & (ya ^ (r & 0xffff)) & 0x8000) this.psw |= FLAG_V;
      if (((ya & 0xfff) + (v & 0xfff)) > 0xfff) this.psw |= FLAG_H;
      if (r > 0xffff) this.psw |= FLAG_C;
    }
    this.a = r & 0xff;
    this.y = (r >> 8) & 0xff;
    this.setNZ16(r & 0xffff);
  }
  private div() {
    const ya = this.a | (this.y << 8);
    this.psw &= ~(FLAG_V | FLAG_H);
    if (this.y >= this.x) this.psw |= FLAG_V;
    if ((this.y & 15) >= (this.x & 15)) this.psw |= FLAG_H;
    if (this.x === 0) {
      this.a = 0xff;
      this.y = 0xff;
    } else if (this.y < this.x * 2) {
      this.a = Math.floor(ya / this.x) & 0xff;
      this.y = ya % this.x;
    } else {
      this.a = (255 - Math.floor((ya - (this.x << 9)) / (256 - this.x))) & 0xff;
      this.y = (this.x + ((ya - (this.x << 9)) % (256 - this.x))) & 0xff;
    }
    this.setNZ(this.a);
  }

  // ---- the run --------------------------------------------------------

  run(seconds: number): SpcTrace {
    const target = Math.round(seconds * 1024000);
    let guard = 0;
    while (this.cycles < target && guard++ < 200_000_000) this.step();
    const srcnUsed = new Set<number>();
    for (const o of this.ons) srcnUsed.add(o.srcn);
    return { ons: this.ons, offs: this.offs, vols: this.vols, samples: this.dspSamples, srcnUsed };
  }
}
