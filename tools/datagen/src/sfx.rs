//! Sound effects: project WAV files to BRR samples for the SPC700
//! (`spcSetSoundEntry` / `spcPlaySound` in PVSnesLib).
//!
//! Chain: PCM WAV (8/16/24/32-bit, mono or stereo, any rate) -> mono ->
//! linear resample to 8000 Hz (SPC pitch 4, hz = pitch * 2000) -> BRR
//! encoding. BRR blocks hold 16 samples in 9 bytes; filter (0-3) and
//! shift (0-12) are picked by exhaustive search for minimal error. All
//! integer arithmetic, so the output is deterministic.
//!
//! Contractual budgets (docs/TOOLS.md): one sound <= 8 KB BRR (~1.8 s),
//! at most 16 sounds, 24 KB total — the data shares one LoROM bank. The
//! SPC region allocated is the size of the largest sound: they load one
//! at a time, at play time, following the PVSnesLib model.

use anyhow::{bail, Context, Result};

pub const SFX_RATE: u32 = 8000; // pitch 4 (hz = pitch x 2000)
pub const SFX_MAX_BRR: usize = 8192; // ~1.8 s at 8 kHz
pub const SFX_MAX_COUNT: usize = 16;
pub const SFX_MAX_TOTAL: usize = 24 * 1024;

/// Decodes a WAV into mono i16 samples at SFX_RATE.
pub fn wav_to_mono_8k(bytes: &[u8], name: &str) -> Result<Vec<i16>> {
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        bail!("son '{}' : pas un fichier WAV (en-tête RIFF/WAVE absent)", name);
    }
    let mut fmt: Option<(u16, u16, u32, u16)> = None; // (format, channels, rate, bits)
    let mut data: Option<&[u8]> = None;
    let mut o = 12usize;
    while o + 8 <= bytes.len() {
        let id = &bytes[o..o + 4];
        let len = u32::from_le_bytes(bytes[o + 4..o + 8].try_into().unwrap()) as usize;
        let body_end = (o + 8 + len).min(bytes.len());
        let body = &bytes[o + 8..body_end];
        match id {
            b"fmt " if body.len() >= 16 => {
                let f = u16::from_le_bytes(body[0..2].try_into().unwrap());
                let ch = u16::from_le_bytes(body[2..4].try_into().unwrap());
                let rate = u32::from_le_bytes(body[4..8].try_into().unwrap());
                let bits = u16::from_le_bytes(body[14..16].try_into().unwrap());
                fmt = Some((f, ch, rate, bits));
            }
            b"data" => data = Some(body),
            _ => {}
        }
        o += 8 + len + (len & 1); // RIFF chunks are 2-aligned
    }
    let (format, channels, rate, bits) =
        fmt.with_context(|| format!("son '{}' : chunk fmt absent", name))?;
    let data = data.with_context(|| format!("son '{}' : chunk data absent", name))?;
    if channels == 0 || channels > 2 {
        bail!("son '{}' : {} canaux (mono ou stéréo attendu)", name, channels);
    }
    if rate < 4000 || rate > 96000 {
        bail!("son '{}' : taux {} Hz hors limites (4000-96000)", name, rate);
    }
    // Format 1 is integer PCM, 3 is 32-bit float. 0xFFFE (extensible) is
    // accepted as PCM: its subformat lives past the 16 bytes we read.
    let read_sample = |frame: usize, ch: usize| -> Result<i32> {
        let bps = (bits / 8) as usize;
        let idx = (frame * channels as usize + ch) * bps;
        if idx + bps > data.len() {
            return Ok(0);
        }
        Ok(match (format, bits) {
            (1, 8) | (0xFFFE, 8) => (data[idx] as i32 - 128) << 8,
            (1, 16) | (0xFFFE, 16) => {
                i16::from_le_bytes(data[idx..idx + 2].try_into().unwrap()) as i32
            }
            (1, 24) | (0xFFFE, 24) => {
                ((data[idx] as i32) | ((data[idx + 1] as i32) << 8)
                    | ((data[idx + 2] as i8 as i32) << 16))
                    >> 8
            }
            (1, 32) | (0xFFFE, 32) => {
                i32::from_le_bytes(data[idx..idx + 4].try_into().unwrap()) >> 16
            }
            (3, 32) => {
                let f = f32::from_le_bytes(data[idx..idx + 4].try_into().unwrap());
                (f.clamp(-1.0, 1.0) * 32767.0) as i32
            }
            _ => bail!(
                "son '{}' : format WAV non géré (format {}, {} bits) — \
                 exporter en PCM 16 bits",
                name, format, bits
            ),
        })
    };
    let bps = (bits / 8) as usize * channels as usize;
    if bps == 0 {
        bail!("son '{}' : en-tête WAV invalide", name);
    }
    let frames = data.len() / bps;
    if frames == 0 {
        bail!("son '{}' : aucun échantillon", name);
    }
    // Downmix and resample to 8 kHz in one pass.
    let out_frames = ((frames as u64 * SFX_RATE as u64) / rate as u64) as usize;
    let out_frames = out_frames.max(1);
    let mut out = Vec::with_capacity(out_frames);
    for i in 0..out_frames {
        let pos = i as u64 * rate as u64 * 256 / SFX_RATE as u64; // 8.8 fixed point
        let f0 = (pos >> 8) as usize;
        let frac = (pos & 255) as i32;
        let f1 = (f0 + 1).min(frames - 1);
        let mut acc = 0i32;
        for c in 0..channels as usize {
            let a = read_sample(f0, c)?;
            let b = read_sample(f1, c)?;
            acc += a + (((b - a) * frac) >> 8);
        }
        out.push((acc / channels as i32).clamp(-32768, 32767) as i16);
    }
    Ok(out)
}

/// Integer prediction for BRR filters 0-3, as the DSP computes it.
fn brr_predict(filter: u8, p1: i32, p2: i32) -> i32 {
    match filter {
        1 => (p1 * 15) >> 4,
        2 => ((p1 * 61) >> 5) - ((p2 * 15) >> 4),
        3 => ((p1 * 115) >> 6) - ((p2 * 13) >> 4),
        _ => 0,
    }
}

/// Encodes mono samples to BRR. A block is [header][8 nibble bytes],
/// header = shift<<4 | filter<<2 | loop<<1 | end. No looping — effects
/// play once — and the END bit goes on the last block.
pub fn encode_brr(samples: &[i16]) -> Vec<u8> {
    let mut padded: Vec<i32> = samples.iter().map(|&s| s as i32).collect();
    while padded.len() % 16 != 0 {
        padded.push(0);
    }
    let nblocks = padded.len() / 16;
    let mut out = Vec::with_capacity(nblocks * 9);
    // Decoder history, tracked with the RECONSTRUCTED values rather than
    // the source ones — that is what the DSP will have.
    let mut hp1 = 0i32;
    let mut hp2 = 0i32;
    for bi in 0..nblocks {
        let blk = &padded[bi * 16..bi * 16 + 16];
        let mut best_err = i64::MAX;
        let mut best = ([0u8; 8], 0u8, 0u8, 0i32, 0i32); // nibbles, filter, shift, p1, p2
        let max_filter = if bi == 0 { 0 } else { 3 }; // block 0 has no history
        for filter in 0..=max_filter {
            for shift in 0..=12u8 {
                let mut p1 = hp1;
                let mut p2 = hp2;
                let mut err = 0i64;
                let mut nib = [0u8; 8];
                for (i, &s) in blk.iter().enumerate() {
                    let pred = brr_predict(filter, p1, p2);
                    let diff = s - pred;
                    let step = 1i32 << shift;
                    let mut q = if diff >= 0 {
                        (diff + step / 2) / step
                    } else {
                        (diff - step / 2) / step
                    };
                    q = q.clamp(-8, 7);
                    let recon = (pred + (q << shift)).clamp(-32768, 32767);
                    let e = (recon - s) as i64;
                    err += e * e;
                    if err >= best_err {
                        break; // this combination has already lost
                    }
                    if i & 1 == 0 {
                        nib[i >> 1] = ((q as u8) & 0xF) << 4;
                    } else {
                        nib[i >> 1] |= (q as u8) & 0xF;
                    }
                    p2 = p1;
                    p1 = recon;
                }
                if err < best_err {
                    best_err = err;
                    best = (nib, filter, shift, p1, p2);
                }
            }
        }
        let (nib, filter, shift, p1, p2) = best;
        let end = if bi == nblocks - 1 { 1u8 } else { 0 };
        out.push((shift << 4) | (filter << 2) | end);
        out.extend_from_slice(&nib);
        hp1 = p1;
        hp2 = p2;
    }
    out
}
