//! Mode 7 conversion (M7-A1) — see docs/PLANNING_SYSTEME_MODE7.md.
//!
//! Mode 7 has no "image mode": the hardware knows a 128x128 tilemap of
//! 8x8 tiles in 8bpp with an affine transform. An image is therefore the
//! degenerate case, a tilemap whose patterns each occur once — which is
//! why the 256-pattern budget bites so hard here and not on a map
//! painted from a tileset.
//!
//! Two hardware limits shape everything below:
//!   - **256 distinct 8x8 patterns.** No flip bits in a Mode 7 map
//!     entry, so a mirrored tile is a separate pattern.
//!   - **colours 0-127 only.** 8bpp indexes CGRAM directly and the OBJ
//!     palettes live at 128-255; staying in the low half is what keeps
//!     the hero, the events and the animations usable over the plane.
//!
//! AUTO-FIT, NEVER AN ERROR (§8.3). An image that does not fit is
//! downscaled until it does, and the caller reports what happened so the
//! editor can show a before/after. Refusing it would push a hardware
//! detail onto an author who never asked to hear about tiles.
//!
//! The conversion is written ONCE, here, because the editor's preview
//! calls it too: two implementations would drift and the preview would
//! start lying about what the game shows.

use crate::gfx::IndexedImage;
use crate::tileset::dist555;
use anyhow::{bail, Result};
use std::collections::BTreeMap;

/// Distinct 8x8 patterns the hardware can hold, INCLUDING the reserved
/// blank one — so an image may use 255 of them.
///
/// Pattern 0 and colour 0 are reserved blank, and that is not tidiness.
/// A Mode 7 plane is 128x128 tiles; an image covers a corner of it and
/// every other cell reads pattern 0. If pattern 0 were an ordinary tile
/// of the image, the whole screen around the picture would be tiled with
/// it — seen on the first run, a nebula framed in orange wallpaper. The
/// composed screen reserves its char 0 for the same reason.
pub const MAX_TILES: usize = 256;
/// Colours left to the background once the sprites keep CGRAM 128-255.
pub const MAX_COLOURS: usize = 128;
/// The plane, in tiles. Also the widest an image may be after fitting.
pub const PLANE_TILES: usize = 128;

/// A converted image, ready to emit.
///
/// The map is COMPACT — `wt * ht` bytes, not the whole 16 KB plane. The
/// plane is mostly tile 0, and 16 KB of zeroes per image would be paid
/// for in ROM for nothing; the engine fills the plane with tile 0 and
/// then writes these rows into it.
pub struct Mode7Image {
    /// 8bpp patterns, 64 bytes each, linear (one byte per pixel).
    pub chars: Vec<u8>,
    /// One tile index per cell, row-major, `wt` per row.
    pub map: Vec<u8>,
    /// Exactly MAX_COLOURS entries in BGR555.
    pub palette: Vec<u16>,
    pub wt: usize,
    pub ht: usize,
    /// What the fit did, for the editor to show and datagen to print.
    pub report: FitReport,
}

#[derive(Clone)]
pub struct FitReport {
    pub src_w: usize,
    pub src_h: usize,
    pub out_w: usize,
    pub out_h: usize,
    pub tiles: usize,
    pub colours: usize,
    /// True when the image had to be shrunk to fit the pattern budget.
    pub downscaled: bool,
}

impl FitReport {
    /// The sentence the author reads. French on purpose: it is shown, not
    /// logged — the editor puts it under the before/after preview.
    pub fn summary(&self) -> String {
        if self.downscaled {
            format!(
                "reduite en {}x{} ({} tuiles, {} couleurs) — depuis {}x{}",
                self.out_w, self.out_h, self.tiles, self.colours, self.src_w, self.src_h
            )
        } else {
            format!(
                "{}x{} ({} tuiles, {} couleurs)",
                self.out_w, self.out_h, self.tiles, self.colours
            )
        }
    }
}

/// Converts a picture to its Mode 7 form, shrinking it until it fits.
///
/// The steps are 8/8, 7/8, 6/8 … 2/8 of the original, each snapped to a
/// multiple of 8 so the tiling stays whole. Downscaling averages in
/// COLOUR space and re-quantises after: averaging palette indices would
/// be meaningless, and it is the classic way to turn a clean picture
/// into noise.
pub fn convert(img: &IndexedImage) -> Result<Mode7Image> {
    if img.width == 0 || img.height == 0 {
        bail!("image vide");
    }
    for num in (2..=8).rev() {
        let (w, h) = scaled_size(img.width, img.height, num);
        if w == 0 || h == 0 {
            continue;
        }
        if w > PLANE_TILES * 8 || h > PLANE_TILES * 8 {
            continue; /* wider than the plane itself */
        }
        let rgb = resample(img, w, h);
        let (indices, palette) = quantise(&rgb, MAX_COLOURS);
        let (chars, map, tiles) = tile_and_dedupe(&indices, w, h);
        if tiles <= MAX_TILES {
            let colours = palette_used(&palette);
            return Ok(Mode7Image {
                chars,
                map,
                palette,
                wt: w / 8,
                ht: h / 8,
                report: FitReport {
                    src_w: img.width,
                    src_h: img.height,
                    out_w: w,
                    out_h: h,
                    tiles,
                    colours,
                    downscaled: num != 8,
                },
            });
        }
    }
    // Unreachable in practice: at 2/8 of a full screen an image is 64x56,
    // i.e. 56 tiles. Kept because "unreachable" is a claim, not a fact.
    bail!("image inconvertible en Mode 7 meme reduite au quart")
}

/// Dimensions at `num`/8 of the original, snapped DOWN to a multiple of
/// 8 and never zero.
fn scaled_size(w: usize, h: usize, num: usize) -> (usize, usize) {
    let f = |v: usize| {
        let s = (v * num / 8) & !7;
        if s == 0 && v > 0 {
            8
        } else {
            s
        }
    };
    (f(w), f(h))
}

/// Box-filter resample into BGR555, one entry per output pixel. At full
/// size this is a straight palette lookup — no rounding at all on the
/// common path.
fn resample(img: &IndexedImage, w: usize, h: usize) -> Vec<u16> {
    let mut out = Vec::with_capacity(w * h);
    let px = |x: usize, y: usize| -> u16 {
        let i = img.pixels[y * img.width + x] as usize;
        *img.palette.get(i).unwrap_or(&0)
    };
    if w == img.width && h == img.height {
        for y in 0..h {
            for x in 0..w {
                out.push(px(x, y));
            }
        }
        return out;
    }
    for y in 0..h {
        let y0 = y * img.height / h;
        let y1 = (((y + 1) * img.height + h - 1) / h).max(y0 + 1).min(img.height);
        for x in 0..w {
            let x0 = x * img.width / w;
            let x1 = (((x + 1) * img.width + w - 1) / w).max(x0 + 1).min(img.width);
            let (mut r, mut g, mut b, mut n) = (0u32, 0u32, 0u32, 0u32);
            for sy in y0..y1 {
                for sx in x0..x1 {
                    let c = px(sx, sy);
                    r += (c & 31) as u32;
                    g += ((c >> 5) & 31) as u32;
                    b += ((c >> 10) & 31) as u32;
                    n += 1;
                }
            }
            let n = n.max(1);
            out.push(((r / n) as u16) | (((g / n) as u16) << 5) | (((b / n) as u16) << 10));
        }
    }
    out
}

/// Median cut down to `max` colours, then nearest-representative
/// mapping. Deterministic: the boxes are split on a fixed rule and the
/// histogram is ordered, so the same PNG always gives the same bytes —
/// gate-datagen.sh depends on it.
fn quantise(rgb: &[u16], max: usize) -> (Vec<u8>, Vec<u16>) {
    let mut hist: BTreeMap<u16, u32> = BTreeMap::new();
    for &c in rgb {
        *hist.entry(c).or_insert(0) += 1;
    }
    let entries: Vec<(u16, u32)> = hist.into_iter().collect();

    // One slot fewer for the image: colour 0 is reserved black, so the
    // reserved blank pattern renders as nothing rather than as whatever
    // median cut happened to put first.
    let budget = max - 1;
    let reps: Vec<u16> = if entries.len() <= budget {
        entries.iter().map(|e| e.0).collect()
    } else {
        median_cut(&entries, budget)
    };

    // The palette always has MAX_COLOURS slots: the engine uploads a
    // fixed-size block, and unused entries being black is what makes a
    // stray index harmless instead of a random colour.
    let mut palette = vec![0u16; max];
    for (i, &c) in reps.iter().take(budget).enumerate() {
        palette[i + 1] = c; /* index 0 stays black */
    }

    // Nearest representative per DISTINCT colour, not per pixel: a
    // full-screen image has far fewer colours than pixels.
    let mut lut: BTreeMap<u16, u8> = BTreeMap::new();
    let mut indices = Vec::with_capacity(rgb.len());
    for &c in rgb {
        let idx = *lut.entry(c).or_insert_with(|| {
            let mut best = 0usize;
            let mut bd = u32::MAX;
            for (i, &r) in reps.iter().take(budget).enumerate() {
                let d = dist555(c, r);
                if d < bd {
                    bd = d;
                    best = i;
                }
            }
            (best + 1) as u8 /* index 0 is the reserved black */
        });
        indices.push(idx);
    }
    (indices, palette)
}

/// Classic median cut: split the box with the widest channel spread at
/// its median until there are `max` boxes, then average each box.
fn median_cut(entries: &[(u16, u32)], max: usize) -> Vec<u16> {
    let chan = |c: u16, k: usize| ((c >> (5 * k)) & 31) as u32;
    let mut boxes: Vec<Vec<(u16, u32)>> = vec![entries.to_vec()];
    while boxes.len() < max {
        // Widest box, by the largest spread over the three channels.
        let mut pick = None;
        let mut pick_span = 0u32;
        let mut pick_chan = 0usize;
        for (i, b) in boxes.iter().enumerate() {
            if b.len() < 2 {
                continue;
            }
            for k in 0..3 {
                let mut lo = u32::MAX;
                let mut hi = 0u32;
                for &(c, _) in b {
                    let v = chan(c, k);
                    lo = lo.min(v);
                    hi = hi.max(v);
                }
                if hi - lo > pick_span {
                    pick_span = hi - lo;
                    pick = Some(i);
                    pick_chan = k;
                }
            }
        }
        let Some(i) = pick else { break }; /* every box is one colour */
        let mut b = boxes.swap_remove(i);
        b.sort_by_key(|&(c, _)| (chan(c, pick_chan), c));
        let half = b.len() / 2;
        let rest = b.split_off(half.max(1));
        boxes.push(b);
        boxes.push(rest);
    }
    // Weighted average per box, so a colour covering half the image is
    // not dragged away by a handful of stray pixels.
    let mut reps: Vec<u16> = boxes
        .iter()
        .filter(|b| !b.is_empty())
        .map(|b| {
            let (mut r, mut g, mut bl, mut n) = (0u64, 0u64, 0u64, 0u64);
            for &(c, w) in b {
                let w = w as u64;
                r += (c & 31) as u64 * w;
                g += ((c >> 5) & 31) as u64 * w;
                bl += ((c >> 10) & 31) as u64 * w;
                n += w;
            }
            let n = n.max(1);
            ((r / n) as u16) | (((g / n) as u16) << 5) | (((bl / n) as u16) << 10)
        })
        .collect();
    reps.sort_unstable();
    reps.dedup();
    reps
}

/// Cuts the indexed bitmap into 8x8 patterns and deduplicates them
/// EXACTLY — no flips, a Mode 7 map entry has no bits for them.
fn tile_and_dedupe(indices: &[u8], w: usize, h: usize) -> (Vec<u8>, Vec<u8>, usize) {
    let (wt, ht) = (w / 8, h / 8);
    // Pattern 0 is BLANK and belongs to nobody: every plane cell the
    // image does not cover reads it (see MAX_TILES).
    let mut chars: Vec<u8> = vec![0u8; 64];
    let mut map: Vec<u8> = Vec::with_capacity(wt * ht);
    let mut seen: BTreeMap<[u8; 64], usize> = BTreeMap::new();
    seen.insert([0u8; 64], 0);
    for ty in 0..ht {
        for tx in 0..wt {
            let mut tile = [0u8; 64];
            for row in 0..8 {
                for col in 0..8 {
                    tile[row * 8 + col] = indices[(ty * 8 + row) * w + tx * 8 + col];
                }
            }
            let next = seen.len();
            let id = *seen.entry(tile).or_insert(next);
            if id == next {
                chars.extend_from_slice(&tile);
            }
            // Beyond 256 the caller retries smaller; the byte written
            // here is meaningless but the COUNT is what it reads.
            map.push(id as u8);
        }
    }
    (chars, map, seen.len())
}

fn palette_used(palette: &[u16]) -> usize {
    // Trailing zeroes are the unused slots; a real black in the middle of
    // the palette still counts.
    let mut n = palette.len();
    while n > 0 && palette[n - 1] == 0 {
        n -= 1;
    }
    n
}

// ---------------------------------------------------------------------
// Zoom ramps
// ---------------------------------------------------------------------

/// Percentages the author may ask for. Below 25 % the plane is a speck;
/// above 400 % one source pixel covers a 4x4 block and the result is
/// mush. Both ends are stated so the editor can clamp its fields to the
/// same numbers instead of inventing its own.
pub const MIN_PCT: u32 = 25;
pub const MAX_PCT: u32 = 400;
pub const MAX_RAMP_FRAMES: u32 = 255;

#[derive(Clone, Copy, PartialEq)]
pub enum Curve {
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
}

impl Curve {
    pub fn parse(s: &str) -> Result<Curve> {
        Ok(match s {
            "linear" => Curve::Linear,
            "ease_in" => Curve::EaseIn,
            "ease_out" => Curve::EaseOut,
            "ease_in_out" | "" => Curve::EaseInOut,
            other => bail!(
                "courbe '{}' inconnue (linear, ease_in, ease_out, ease_in_out)",
                other
            ),
        })
    }

    /// Eased progress, in thousandths — integer arithmetic so the table
    /// is bit-for-bit reproducible on every platform. Floating point
    /// would put gate-datagen.sh at the mercy of an FMA.
    fn apply(self, t: u32) -> u32 {
        match self {
            Curve::Linear => t,
            Curve::EaseIn => t * t / 1000,
            Curve::EaseOut => 1000 - (1000 - t) * (1000 - t) / 1000,
            Curve::EaseInOut => {
                if t < 500 {
                    2 * t * t / 1000
                } else {
                    let u = 1000 - t;
                    1000 - 2 * u * u / 1000
                }
            }
        }
    }
}

/// Compiles a zoom into the table the engine feeds to setMode7Scale.
///
/// The scale register wants the RECIPROCAL of the zoom: at 100 % it is
/// 0x0100, at 200 % it is 0x0080. Computing that offline is the whole
/// point — a division per frame is exactly what P4/P5/P6 spent their
/// effort removing, and the runtime is left reading the next cell and
/// writing two registers.
pub fn compile_ramp(from_pct: u32, to_pct: u32, frames: u32, curve: Curve) -> Result<Vec<u16>> {
    if frames == 0 || frames > MAX_RAMP_FRAMES {
        bail!("duree {} frames (1-{})", frames, MAX_RAMP_FRAMES);
    }
    for (label, pct) in [("depart", from_pct), ("arrivee", to_pct)] {
        if pct < MIN_PCT || pct > MAX_PCT {
            bail!("zoom de {} a {}% (autorise {}-{}%)", label, pct, MIN_PCT, MAX_PCT);
        }
    }
    let mut out = Vec::with_capacity(frames as usize);
    for f in 0..frames {
        // t over [0,1000]; a single-frame ramp lands straight on the end
        // value rather than dividing by zero.
        let t = if frames == 1 { 1000 } else { f * 1000 / (frames - 1) };
        let e = curve.apply(t).min(1000);
        let pct = from_pct * (1000 - e) + to_pct * e; /* in per-mille of a percent */
        let pct = pct.max(MIN_PCT * 1000);
        // m7a = 256 * 100 / pct, with pct scaled by 1000 — rounded.
        out.push(((25_600_000 + pct / 2) / pct) as u16);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gfx::IndexedImage;

    fn img(w: usize, h: usize, f: impl Fn(usize, usize) -> u8, colours: usize) -> IndexedImage {
        let mut pixels = Vec::with_capacity(w * h);
        for y in 0..h {
            for x in 0..w {
                pixels.push(f(x, y));
            }
        }
        // A spread-out palette so quantisation has something to lose.
        let palette = (0..colours).map(|i| (i as u16 * 7) & 0x7FFF).collect();
        IndexedImage { width: w, height: h, pixels, palette, palette_rgb: Vec::new() }
    }

    /// Every 8x8 tile carries its own index written as bits in its top
    /// rows, in TWO colours. Distinctness then comes from the ARRANGEMENT,
    /// not from the palette — so colour quantisation cannot silently
    /// collapse the tiles and weaken the test. (It did, on the first
    /// version of these two: a 256-colour image of flat tiles came back
    /// under budget for free.)
    fn stamped(w: usize, h: usize) -> IndexedImage {
        let wt = w / 8;
        img(
            w,
            h,
            move |x, y| {
                let t = (y / 8) * wt + (x / 8);
                let (row, col) = (y % 8, x % 8);
                let bit = match row {
                    0 => (t >> col) & 1,
                    1 => (t >> (col + 8)) & 1,
                    _ => 0,
                };
                bit as u8
            },
            2,
        )
    }

    /// Pattern 0 and colour 0 are RESERVED blank. This is the guard for a
    /// bug that reached a running ROM: without the reservation, pattern 0
    /// was the image's own top-left tile, so every cell of the 128x128
    /// plane the image did not cover displayed it — the picture came up
    /// framed in wallpaper made of itself.
    #[test]
    fn pattern_zero_and_colour_zero_are_reserved_blank() {
        let m = convert(&img(64, 64, |x, y| ((x / 8 + y / 8) % 7 + 1) as u8, 8)).unwrap();
        assert!(m.chars[..64].iter().all(|&b| b == 0), "pattern 0 must be blank");
        assert_eq!(m.palette[0], 0, "colour 0 must be black");
        assert!(!m.map.contains(&0), "no image cell may claim pattern 0");
    }

    #[test]
    fn image_within_budget_is_untouched() {
        // 120x120 = 225 distinct tiles, plus the reserved blank = 226:
        // inside the budget, so no shrink.
        let m = convert(&stamped(120, 120)).unwrap();
        assert!(!m.report.downscaled);
        assert_eq!((m.wt, m.ht), (15, 15));
        assert_eq!(m.report.tiles, 226);
        assert_eq!(m.chars.len(), 226 * 64);
        assert_eq!(m.map.len(), 15 * 15);
        assert_eq!(m.palette.len(), MAX_COLOURS);
        // The map must name every image pattern exactly once.
        let mut seen = m.map.clone();
        seen.sort_unstable();
        seen.dedup();
        assert_eq!(seen.len(), 225);
    }

    /// 128x128 stamped is 256 distinct tiles, which USED to be exactly
    /// the budget. With the blank reserved it is one too many, so the
    /// image is shrunk — the boundary is 255 now, and this pins it.
    #[test]
    fn the_reserved_blank_costs_one_pattern_of_budget() {
        let m = convert(&stamped(128, 128)).unwrap();
        assert!(m.report.downscaled);
    }

    #[test]
    fn oversized_image_is_downscaled_not_refused() {
        // A full screen of all-distinct tiles is 32x28 = 896 patterns.
        // Auto-fit must shrink it rather than fail — §8.3.
        let m = convert(&stamped(256, 224)).unwrap();
        assert!(m.report.downscaled);
        assert!(m.report.tiles <= MAX_TILES, "tiles = {}", m.report.tiles);
        assert!(m.out_w_ok());
        assert!(m.report.out_w < 256 && m.report.out_h < 224);
    }

    impl Mode7Image {
        fn out_w_ok(&self) -> bool {
            self.wt * 8 == self.report.out_w && self.ht * 8 == self.report.out_h
        }
    }

    #[test]
    fn flat_image_collapses_to_one_tile() {
        // Two patterns: the reserved blank, and the one the whole image
        // is made of.
        let m = convert(&img(64, 64, |_, _| 3, 8)).unwrap();
        assert_eq!(m.report.tiles, 2);
        assert_eq!(m.chars.len(), 2 * 64);
        assert!(m.map.iter().all(|&t| t == 1));
    }

    #[test]
    fn palette_never_exceeds_the_sprite_boundary() {
        let m = convert(&img(64, 64, |x, y| ((x + y) % 200) as u8, 200)).unwrap();
        assert_eq!(m.palette.len(), MAX_COLOURS);
        assert!(m.report.colours <= MAX_COLOURS);
    }

    #[test]
    fn conversion_is_deterministic() {
        let a = convert(&img(96, 96, |x, y| ((x * 3 + y * 5) % 137) as u8, 137)).unwrap();
        let b = convert(&img(96, 96, |x, y| ((x * 3 + y * 5) % 137) as u8, 137)).unwrap();
        assert_eq!(a.chars, b.chars);
        assert_eq!(a.map, b.map);
        assert_eq!(a.palette, b.palette);
    }

    #[test]
    fn ramp_endpoints_are_the_reciprocals() {
        let r = compile_ramp(100, 200, 60, Curve::Linear).unwrap();
        assert_eq!(r.len(), 60);
        assert_eq!(r[0], 0x0100, "100% must be 1:1");
        assert_eq!(r[59], 0x0080, "200% must be half the step");
    }

    #[test]
    fn ramp_is_monotonic_on_every_curve() {
        for c in [Curve::Linear, Curve::EaseIn, Curve::EaseOut, Curve::EaseInOut] {
            let r = compile_ramp(100, 300, 45, c).unwrap();
            assert!(r.windows(2).all(|w| w[1] <= w[0]), "zoom in must never step back");
            assert_eq!(r[0], 0x0100);
            assert_eq!(*r.last().unwrap(), 25_600 / 300);
        }
    }

    #[test]
    fn single_frame_ramp_lands_on_the_end_value() {
        let r = compile_ramp(100, 200, 1, Curve::EaseInOut).unwrap();
        assert_eq!(r, vec![0x0080]);
    }

    #[test]
    fn ramp_rejects_what_the_editor_must_clamp() {
        assert!(compile_ramp(100, 200, 0, Curve::Linear).is_err());
        assert!(compile_ramp(100, 200, 256, Curve::Linear).is_err());
        assert!(compile_ramp(10, 200, 30, Curve::Linear).is_err());
        assert!(compile_ramp(100, 500, 30, Curve::Linear).is_err());
    }

    #[test]
    fn curve_names_match_the_editor_vocabulary() {
        assert!(Curve::parse("linear").is_ok());
        assert!(Curve::parse("ease_in").is_ok());
        assert!(Curve::parse("ease_out").is_ok());
        assert!(Curve::parse("ease_in_out").is_ok());
        assert!(Curve::parse("").is_ok());
        assert!(Curve::parse("bounce").is_err());
    }
}
