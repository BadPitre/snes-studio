//! sfx.rs — effets sonores (B1) : WAV du projet → échantillons BRR pour
//! le SPC700 (spcSetSoundEntry/spcPlaySound de PVSnesLib).
//!
//! Chaîne : WAV PCM (8/16/24/32 bits, mono ou stéréo, tout taux)
//! → mono → ré-échantillonnage linéaire à 8000 Hz (pitch 4 du SPC,
//! hz = pitch x 2000) → encodage BRR (blocs de 16 échantillons sur
//! 9 octets, filtres 0-3 et shift 0-12 choisis par recherche
//! exhaustive de l'erreur minimale — l'encodeur du kit, pas d'outil
//! externe). Sortie stable et déterministe (arithmétique entière).
//!
//! Budgets contractuels (docs/TOOLS.md) : un son ≤ 8 Ko BRR (~1,8 s),
//! ≤ 16 sons, total ≤ 24 Ko (les données partagent une bank LoROM).
//! La région SPC allouée = le plus gros son (ils s'y chargent chacun
//! leur tour au moment de jouer — modèle PVSnesLib).

use anyhow::{bail, Context, Result};

pub const SFX_RATE: u32 = 8000; // pitch 4 (hz = pitch x 2000)
pub const SFX_MAX_BRR: usize = 8192; // ~1,8 s à 8 kHz
pub const SFX_MAX_COUNT: usize = 16;
pub const SFX_MAX_TOTAL: usize = 24 * 1024;

/// Décode un WAV en échantillons mono i16 à SFX_RATE.
pub fn wav_to_mono_8k(bytes: &[u8], name: &str) -> Result<Vec<i16>> {
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        bail!("son '{}' : pas un fichier WAV (en-tête RIFF/WAVE absent)", name);
    }
    let mut fmt: Option<(u16, u16, u32, u16)> = None; // (format, canaux, taux, bits)
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
        o += 8 + len + (len & 1); // les chunks RIFF sont alignés sur 2
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
    // format 1 = PCM entier, 3 = float 32 ; 0xFFFE (extensible) est
    // accepté en supposant PCM (le sous-format est au-delà des 16 octets)
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
    // mono + ré-échantillonnage linéaire vers 8 kHz en une passe
    let out_frames = ((frames as u64 * SFX_RATE as u64) / rate as u64) as usize;
    let out_frames = out_frames.max(1);
    let mut out = Vec::with_capacity(out_frames);
    for i in 0..out_frames {
        let pos = i as u64 * rate as u64 * 256 / SFX_RATE as u64; // 8.8 fixe
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

/// prédiction entière des filtres BRR 0-3 (formules du DSP)
fn brr_predict(filter: u8, p1: i32, p2: i32) -> i32 {
    match filter {
        1 => (p1 * 15) >> 4,
        2 => ((p1 * 61) >> 5) - ((p2 * 15) >> 4),
        3 => ((p1 * 115) >> 6) - ((p2 * 13) >> 4),
        _ => 0,
    }
}

/// Encode des échantillons mono en BRR : blocs [header][8 octets de
/// nibbles], header = shift<<4 | filtre<<2 | loop<<1 | end. Pas de
/// boucle (les effets jouent une fois), bit END sur le dernier bloc.
pub fn encode_brr(samples: &[i16]) -> Vec<u8> {
    let mut padded: Vec<i32> = samples.iter().map(|&s| s as i32).collect();
    while padded.len() % 16 != 0 {
        padded.push(0);
    }
    let nblocks = padded.len() / 16;
    let mut out = Vec::with_capacity(nblocks * 9);
    let mut hp1 = 0i32; // historique du décodeur (suivi avec les valeurs
    let mut hp2 = 0i32; // RECONSTRUITES, pas les sources)
    for bi in 0..nblocks {
        let blk = &padded[bi * 16..bi * 16 + 16];
        let mut best_err = i64::MAX;
        let mut best = ([0u8; 8], 0u8, 0u8, 0i32, 0i32); // nibbles, filtre, shift, p1, p2
        let max_filter = if bi == 0 { 0 } else { 3 }; // bloc 0 : historique nul
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
                        break; // cette combinaison a déjà perdu
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
