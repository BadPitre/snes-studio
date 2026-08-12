//! Frame-by-frame animations (A1).
//!
//! The cell sheet is a project VIGNETTE: the graphics pipeline (32x32 OBJ
//! chars, palette, VBlank transfer) already exists and is tested, so an
//! animation only adds the frame track.
//!
//! The track is FLATTENED with a FIXED stride, so the engine advances by a
//! constant step with no variable-length decoding. Per frame: L records of
//! 3 bytes [cell][signed dx][signed dy], one per LAYER (cell 0xFF means
//! that layer shows nothing), then [duration 1-255][sound, 0xFF for none].
//! The stride is 3L + 2; with one layer that is exactly the original
//! 5-byte format.

use anyhow::{bail, Context, Result};
use std::collections::HashMap;

use crate::project::AnimEntry;

/// The tables emitted as data_animations.c, one entry per animation plus
/// the shared track.
pub struct Tables {
    pub names: Vec<String>,
    pub vig: Vec<u8>,
    pub flags: Vec<u8>,
    pub layers: Vec<u8>,
    pub nframes: Vec<u8>,
    pub ofs: Vec<u16>,
    pub track: Vec<u8>,
}

impl Tables {
    pub fn is_empty(&self) -> bool {
        self.names.is_empty()
    }

    pub fn len(&self) -> usize {
        self.names.len()
    }
}

/// Compiles the project's animations against the vignettes (the cell
/// sheets) and the sound registry.
///
/// `vig_cells[i]` is the number of cells of vignette `vig_names[i]`.
pub fn compile(
    animations: &[AnimEntry],
    vig_names: &[String],
    vig_cells: &[usize],
    sound_ids: &HashMap<String, u8>,
) -> Result<Tables> {
    let mut t = Tables {
        names: Vec::new(),
        vig: Vec::new(),
        flags: Vec::new(),
        layers: Vec::new(),
        nframes: Vec::new(),
        ofs: Vec::new(),
        track: Vec::new(),
    };

    for a in animations {
        if t.names.contains(&a.name) {
            bail!("animation '{}' : nom en double", a.name);
        }
        let vig = vig_names.iter().position(|v| v == &a.vignette).with_context(|| {
            format!(
                "animation '{}' : sprite animé '{}' introuvable (sprites animés du projet : {})",
                a.name,
                a.vignette,
                if vig_names.is_empty() {
                    "aucune".to_string()
                } else {
                    vig_names.join(", ")
                }
            )
        })?;
        let cells = vig_cells[vig];
        if a.frames.is_empty() {
            bail!("animation '{}' : aucune frame", a.name);
        }
        if a.frames.len() > 255 {
            bail!("animation '{}' : {} frames (max 255)", a.name, a.frames.len());
        }
        // layers: the engine's limits (vignette slots and OAM entries)
        let nl = a.layers as usize;
        if !(1..=4).contains(&nl) {
            bail!(
                "animation '{}' : {} calques (1 a 4 — au dela, plus de slot de sprite animé)",
                a.name, a.layers
            );
        }
        let stride = nl * 3 + 2;
        if t.track.len() + a.frames.len() * stride > 65535 {
            bail!("animations : piste trop longue (max 64 Ko)");
        }
        t.ofs.push(t.track.len() as u16);
        for (i, f) in a.frames.iter().enumerate() {
            let posed = f.posed();
            if posed.len() > nl {
                bail!(
                    "animation '{}', frame {} : {} cellules posees pour {} calque(s)",
                    a.name, i + 1, posed.len(), nl
                );
            }
            if f.dur == 0 {
                bail!("animation '{}', frame {} : duree nulle", a.name, i + 1);
            }
            for l in 0..nl {
                // A layer left unset on this frame shows nothing, which is
                // what lets a layer appear midway without needing a second
                // timeline.
                let (c, x, y) = posed.get(l).copied().unwrap_or((-1, 0, 0));
                if c < 0 {
                    t.track.extend_from_slice(&[0xFF, 0, 0]);
                    continue;
                }
                if c as usize >= cells {
                    bail!(
                        "animation '{}', frame {}, calque {} : cellule {} hors du sprite animé '{}' ({} cellule(s))",
                        a.name, i + 1, l + 1, c, a.vignette, cells
                    );
                }
                if !(-128..=127).contains(&x) || !(-128..=127).contains(&y) {
                    bail!(
                        "animation '{}', frame {}, calque {} : decalage [{}, {}] hors de -128..127",
                        a.name, i + 1, l + 1, x, y
                    );
                }
                t.track.push(c as u8);
                t.track.push(x as i8 as u8);
                t.track.push(y as i8 as u8);
            }
            let sfx = match &f.sfx {
                None => 0xFFu8,
                Some(n) => *sound_ids.get(n).with_context(|| {
                    format!(
                        "animation '{}', frame {} : son '{}' introuvable dans le projet",
                        a.name, i + 1, n
                    )
                })?,
            };
            t.track.push(f.dur);
            t.track.push(sfx);
        }
        warn_late_cells(a, nl);
        t.vig.push(vig as u8);
        t.flags.push(a.r#loop as u8);
        t.layers.push(nl as u8);
        t.nframes.push(a.frames.len() as u8);
        t.names.push(a.name.clone());
    }
    if t.names.len() > 255 {
        bail!("{} animations (max 255)", t.names.len());
    }
    Ok(t)
}

/// VBlank budget: one cell is 4 DMA transfers and only ONE passes per
/// screen frame (measured — see VIG_VB_MAX in engine/src/vignette.c). If K
/// layers change cell on entering a frame, they need K screen frames to
/// catch up: a shorter frame shows one layer late. We SAY so rather than
/// forbid it — the author may want that flicker.
fn warn_late_cells(a: &AnimEntry, nl: usize) {
    for i in 1..a.frames.len() {
        let prev = a.frames[i - 1].posed();
        let cur = a.frames[i].posed();
        let changed = (0..nl)
            .filter(|&l| {
                let p = prev.get(l).map(|c| c.0).unwrap_or(-1);
                let c = cur.get(l).map(|c| c.0).unwrap_or(-1);
                p != c
            })
            .count();
        if changed > a.frames[i].dur as usize {
            println!(
                "  attention : animation '{}', frame {} — {} cellules changent                      pour une duree de {} image(s) : une cellule aura du retard                      (allonger la duree, ou echelonner les changements)",
                a.name, i + 1, changed, a.frames[i].dur
            );
        }
    }
}

/// The one-line summary datagen prints for the animation phase.
pub fn report(t: &Tables) {
    if t.is_empty() {
        return;
    }
    let frames: usize = t.nframes.iter().map(|&n| n as usize).sum();
    let maxl = t.layers.iter().copied().max().unwrap_or(1);
    println!(
        "  animations : {} ({} frames, jusqu'a {} calque(s), {} octets de piste)",
        t.len(),
        frames,
        maxl,
        t.track.len()
    );
}
