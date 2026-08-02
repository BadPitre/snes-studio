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
use anyhow::{bail, Context, Result};
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

/// Renders a converted image back to RGB, exactly as the PPU would read
/// it: pattern per map cell, colour per palette index, BGR555 widened to
/// 8 bits per channel.
///
/// This exists so the editor can show the author what the GAME will
/// display rather than what they imported — the two differ by the
/// auto-fit and by the 5-bit colour, and an author who tunes a zoom on a
/// crisp image and gets something else in game is the worst outcome this
/// feature has (section 8.5). It is deliberately the same `convert`
/// output the build uses: a preview computed by a second implementation
/// would drift and start lying.
pub fn preview_rgb(m: &Mode7Image) -> Vec<u8> {
    let (w, h) = (m.wt * 8, m.ht * 8);
    let mut out = vec![0u8; w * h * 3];
    let widen = |c: u16, shift: u32| -> u8 {
        let v = ((c >> shift) & 31) as u8;
        (v << 3) | (v >> 2)
    };
    for ty in 0..m.ht {
        for tx in 0..m.wt {
            let t = m.map[ty * m.wt + tx] as usize;
            for row in 0..8 {
                for col in 0..8 {
                    let idx = m.chars[t * 64 + row * 8 + col] as usize;
                    let c = *m.palette.get(idx).unwrap_or(&0);
                    let o = ((ty * 8 + row) * w + tx * 8 + col) * 3;
                    out[o] = widen(c, 0);
                    out[o + 1] = widen(c, 5);
                    out[o + 2] = widen(c, 10);
                }
            }
        }
    }
    out
}

/// `datagen m7-preview <in.png> <out.png>`: converts one image and writes
/// what the game will show, printing the author-facing summary.
pub fn preview_command(src: &std::path::Path, dst: &std::path::Path) -> Result<()> {
    let img = crate::gfx::load_indexed_png(src)
        .with_context(|| format!("lecture de {}", src.display()))?;
    let m = convert(&img)?;
    let rgb = preview_rgb(&m);
    let file = std::fs::File::create(dst)
        .with_context(|| format!("ecriture de {}", dst.display()))?;
    let mut enc = png::Encoder::new(
        std::io::BufWriter::new(file),
        (m.wt * 8) as u32,
        (m.ht * 8) as u32,
    );
    enc.set_color(png::ColorType::Rgb);
    enc.set_depth(png::BitDepth::Eight);
    enc.write_header()?.write_image_data(&rgb)?;
    // The editor reads this line and shows it under the before/after.
    println!("{}", m.report.summary());
    Ok(())
}

// ---------------------------------------------------------------------
// Mode 7 tileset (M7-B1)
// ---------------------------------------------------------------------

/// The author paints a world map in 16x16 metatiles, exactly as they
/// paint an ordinary scene — that is the promise of section 8.2, and it
/// is why a Mode 7 tileset is authored as a grid of 16x16 blocks rather
/// than as raw 8x8 patterns. A 128x128-tile plane is 64x64 metatiles;
/// datagen expands each block into its four quadrants.
pub const METATILE_PX: usize = 16;
/// The plane in metatiles — what the editor bounds a world map to.
#[allow(dead_code)] // used by the worldmap scene type, still to land
pub const PLANE_METATILES: usize = PLANE_TILES / 2;

#[allow(dead_code)] // chars/meta/palette land with the worldmap emitter
pub struct Mode7Tileset {
    /// 8bpp patterns, 64 bytes each. Pattern 0 is the reserved blank.
    pub chars: Vec<u8>,
    /// Four pattern indices per metatile, in reading order
    /// (top-left, top-right, bottom-left, bottom-right).
    pub meta: Vec<u8>,
    pub palette: Vec<u16>,
    /// Metatiles in the sheet.
    pub count: usize,
    pub patterns: usize,
    pub colours: usize,
}

/// Compiles a 16x16 metatile sheet into Mode 7 patterns.
///
/// Unlike an image (§8.3), a tileset that does not fit is REFUSED rather
/// than auto-fitted. Shrinking an image loses detail the author can live
/// with; shrinking a tileset would break every map painted with it, so
/// the honest move is to say what is over budget and by how much.
pub fn convert_tileset(img: &IndexedImage) -> Result<Mode7Tileset> {
    if img.width % METATILE_PX != 0 || img.height % METATILE_PX != 0 {
        bail!(
            "planche de {}x{} : attendu des multiples de {} (grille de blocs {0}x{0})",
            img.width,
            img.height,
            METATILE_PX
        );
    }
    let (mw, mh) = (img.width / METATILE_PX, img.height / METATILE_PX);
    if mw == 0 || mh == 0 {
        bail!("planche vide");
    }

    // One quantisation for the WHOLE sheet: the plane has a single
    // palette, so two blocks cannot each keep their own colours.
    let rgb = resample(img, img.width, img.height);
    let (indices, palette) = quantise(&rgb, MAX_COLOURS);

    let mut chars: Vec<u8> = vec![0u8; 64]; /* pattern 0 blank, as in convert */
    let mut seen: BTreeMap<[u8; 64], usize> = BTreeMap::new();
    seen.insert([0u8; 64], 0);
    let mut meta: Vec<u8> = Vec::with_capacity(mw * mh * 4);

    for my in 0..mh {
        for mx in 0..mw {
            for q in 0..4 {
                let ox = mx * METATILE_PX + (q & 1) * 8;
                let oy = my * METATILE_PX + (q >> 1) * 8;
                let mut tile = [0u8; 64];
                for row in 0..8 {
                    for col in 0..8 {
                        tile[row * 8 + col] = indices[(oy + row) * img.width + ox + col];
                    }
                }
                let next = seen.len();
                let id = *seen.entry(tile).or_insert(next);
                if id == next {
                    chars.extend_from_slice(&tile);
                }
                meta.push(id.min(255) as u8);
            }
        }
    }

    let patterns = seen.len();
    if patterns > MAX_TILES {
        bail!(
            "tileset mode7 : {} motifs 8x8 uniques pour {} bloc(s) — maximum {} \
             (motif 0 reserve vide). Simplifier les blocs, ou en reutiliser \
             davantage : c'est le REEMPLOI qui paie ici, pas la taille",
            patterns,
            mw * mh,
            MAX_TILES
        );
    }
    let colours = palette_used(&palette);
    Ok(Mode7Tileset {
        chars,
        meta,
        palette,
        count: mw * mh,
        patterns,
        colours,
    })
}

/// `datagen m7-tileset <chipset.png>`: reports what a tileset would cost
/// as a world map's plane, without generating anything.
///
/// The editor calls this before letting a scene become a world map, so
/// the author learns "this tileset is over budget" while choosing rather
/// than at build time. Prints one line either way — a refusal comes back
/// as the error, which is already worded for a human.
pub fn tileset_check_command(src: &std::path::Path) -> Result<()> {
    let img = crate::gfx::load_indexed_png(src)
        .with_context(|| format!("lecture de {}", src.display()))?;
    let t = convert_tileset(&img)?;
    println!(
        "{} bloc(s) 16x16 — {} motifs 8x8 sur {} disponibles, {} couleurs",
        t.count,
        t.patterns,
        MAX_TILES,
        t.colours
    );
    Ok(())
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

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
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

/// A zoom as the author states it on a command, and the key that makes
/// two identical zooms share one table.
#[derive(Clone, Copy, PartialEq)]
pub struct Ramp {
    pub from: u32,
    pub to: u32,
    pub frames: u32,
    pub curve: Curve,
}

impl Ramp {
    /// Reads the four fields off a command object, with the same defaults
    /// the editor's form shows. Returns None when the command is not an
    /// "m7" — the scan uses that to walk past everything else.
    pub fn from_command(v: &serde_json::Value) -> Option<Ramp> {
        if v.get("c")?.as_str()? != "m7" {
            return None;
        }
        Some(Ramp {
            from: v.get("from").and_then(|x| x.as_u64()).unwrap_or(100) as u32,
            to: v.get("to").and_then(|x| x.as_u64()).unwrap_or(150) as u32,
            frames: v.get("frames").and_then(|x| x.as_u64()).unwrap_or(90) as u32,
            curve: Curve::parse(v.get("curve").and_then(|x| x.as_str()).unwrap_or(""))
                .unwrap_or(Curve::EaseInOut),
        })
    }
}

/// Every distinct zoom in the project, in the order first met.
///
/// The scan is a RECURSIVE WALK of the raw JSON rather than a tour of the
/// typed structures: commands nest inside `then`, `else` and `do`, and a
/// hand-written list of the places to look would rot the first time a
/// container is added. Anything shaped like an m7 command is found
/// wherever it hides — map events and their pages, scene scripts, common
/// events, functions, screens.
///
/// Deduplication is what makes a zoom used on ten commands cost one
/// table.
///
/// On ORDER: this crate's serde_json has no `preserve_order`, so an
/// object's keys are visited ALPHABETICALLY — inside an `if_var`, `else`
/// is walked before `then`. That is surprising but it is REPRODUCIBLE,
/// which is the only property the ramp indices need, and gate-datagen.sh
/// is what holds it. Do not rely on document order here.
pub fn collect_ramps(roots: &[&serde_json::Value]) -> Vec<Ramp> {
    fn walk(v: &serde_json::Value, out: &mut Vec<Ramp>) {
        match v {
            serde_json::Value::Object(m) => {
                if let Some(r) = Ramp::from_command(v) {
                    if !out.contains(&r) {
                        out.push(r);
                    }
                }
                for (_, sub) in m {
                    walk(sub, out);
                }
            }
            serde_json::Value::Array(a) => {
                for sub in a {
                    walk(sub, out);
                }
            }
            _ => {}
        }
    }
    let mut out = Vec::new();
    for r in roots {
        walk(r, &mut out);
    }
    out
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

    /// A metatile sheet whose blocks are each a flat, distinct colour:
    /// every block collapses to ONE pattern, shared by its four
    /// quadrants. That is the reuse the format is built on.
    fn sheet(mw: usize, mh: usize, colours: usize) -> IndexedImage {
        img(
            mw * 16,
            mh * 16,
            move |x, y| (((y / 16) * mw + (x / 16)) % (colours - 1) + 1) as u8,
            colours,
        )
    }

    #[test]
    fn a_flat_block_costs_one_pattern_not_four() {
        let t = convert_tileset(&sheet(4, 4, 17)).unwrap();
        assert_eq!(t.count, 16);
        // 16 distinct flat blocks + the reserved blank.
        assert_eq!(t.patterns, 17);
        assert_eq!(t.chars.len(), 17 * 64);
        assert_eq!(t.meta.len(), 16 * 4);
        // Each block's four quadrants name the SAME pattern.
        for b in 0..16 {
            let q = &t.meta[b * 4..b * 4 + 4];
            assert!(q.iter().all(|&v| v == q[0]), "block {} split into {:?}", b, q);
        }
        assert!(!t.meta.contains(&0), "no block may claim the reserved blank");
    }

    #[test]
    fn the_quadrants_are_in_reading_order() {
        // Each 16x16 block carries a different index in each quadrant, so
        // the four patterns must differ and follow TL, TR, BL, BR.
        let t = convert_tileset(&img(
            16,
            16,
            |x, y| (1 + (y / 8) * 2 + (x / 8)) as u8,
            8,
        ))
        .unwrap();
        assert_eq!(t.count, 1);
        assert_eq!(t.patterns, 5); /* four quadrants + the blank */
        let q = &t.meta[0..4];
        assert_eq!(q.len(), 4);
        assert!(q[0] != q[1] && q[1] != q[2] && q[2] != q[3]);
        // The pattern of quadrant k is filled with the colour of index k+1.
        for (k, &pat) in q.iter().enumerate() {
            let first = t.chars[pat as usize * 64];
            assert!(t.chars[pat as usize * 64..pat as usize * 64 + 64]
                .iter()
                .all(|&b| b == first));
            assert_eq!(
                t.palette[first as usize],
                sheet_colour(k + 1),
                "quadrant {} out of order",
                k
            );
        }
    }

    fn sheet_colour(i: usize) -> u16 {
        // Mirrors the palette `img` builds: index i is (i * 7) & 0x7FFF.
        (i as u16 * 7) & 0x7FFF
    }

    #[test]
    fn an_oversized_tileset_is_refused_not_shrunk() {
        // Every 8x8 distinct: 8x8 blocks = 256 quadrants, past the budget.
        // A tileset cannot be auto-fitted — shrinking it would break every
        // map painted with it — so the author must be told plainly.
        let t = convert_tileset(&stamped(128, 128));
        let e = t.err().expect("must refuse").to_string();
        assert!(e.contains("motifs"), "unhelpful message: {}", e);
        assert!(e.contains("reutiliser") || e.contains("REEMPLOI"), "no advice: {}", e);
    }

    #[test]
    fn a_sheet_off_the_block_grid_is_refused() {
        let e = convert_tileset(&img(20, 16, |_, _| 1, 4)).err().unwrap().to_string();
        assert!(e.contains("multiples de 16"), "unhelpful message: {}", e);
    }

    #[test]
    fn the_tileset_palette_leaves_the_sprites_their_half() {
        let t = convert_tileset(&sheet(8, 8, 120)).unwrap();
        assert_eq!(t.palette.len(), MAX_COLOURS);
        assert_eq!(t.palette[0], 0, "colour 0 stays black");
        assert!(t.colours <= MAX_COLOURS);
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
    fn ramps_are_collected_wherever_commands_hide() {
        // Two identical zooms must share one table, a different one must
        // not, and both must be found however deep they nest — inside a
        // condition, inside a loop, inside a screen script.
        let j: serde_json::Value = serde_json::from_str(
            r#"{
              "events": [
                { "pages": [ { "commands": [
                    { "c": "msg", "text": "hi" },
                    { "c": "if_var", "then": [
                        { "c": "m7", "image": "a", "from": 100, "to": 150,
                          "frames": 90, "curve": "ease_in_out" } ],
                      "else": [
                        { "c": "loop", "do": [
                            { "c": "m7", "image": "b", "from": 100, "to": 130,
                              "frames": 10, "curve": "ease_out" } ] } ] }
                  ] } ] }
              ],
              "scripts": [ { "commands": [
                  { "c": "m7", "image": "c", "from": 100, "to": 150,
                    "frames": 90, "curve": "ease_in_out" } ] } ]
            }"#,
        )
        .unwrap();
        let r = collect_ramps(&[&j]);
        assert_eq!(r.len(), 2, "the two identical zooms must share a table");
        let mut got: Vec<(u32, u32, u32)> =
            r.iter().map(|x| (x.from, x.to, x.frames)).collect();
        got.sort();
        assert_eq!(got, vec![(100, 130, 10), (100, 150, 90)]);
        assert!(r.iter().any(|x| x.curve == Curve::EaseOut));
        // The ORDER is alphabetical-by-key, not document order (see
        // collect_ramps). What matters is that it is reproducible.
        assert_eq!(
            collect_ramps(&[&j]).iter().map(|x| x.frames).collect::<Vec<_>>(),
            r.iter().map(|x| x.frames).collect::<Vec<_>>()
        );
    }

    #[test]
    fn a_command_with_no_zoom_fields_takes_the_form_defaults() {
        let j: serde_json::Value =
            serde_json::from_str(r#"[{ "c": "m7", "image": "a" }]"#).unwrap();
        let r = collect_ramps(&[&j]);
        assert_eq!(r.len(), 1);
        assert_eq!((r[0].from, r[0].to, r[0].frames), (100, 150, 90));
        assert_eq!(r[0].curve, Curve::EaseInOut);
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
