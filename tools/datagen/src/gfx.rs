//! Indexed PNG to SNES formats: planar 4bpp/2bpp chars and BGR555
//! palettes. Source PNGs must be in palette mode — a pixel's index IS
//! its SNES colour index, so the round-trip is lossless.

use crate::tileset::dist555 as color_dist;
use anyhow::{bail, Context, Result};
use std::collections::HashMap;
use std::path::Path;

#[derive(Clone)]
pub struct IndexedImage {
    pub width: usize,
    pub height: usize,
    /// Palette index per pixel, row-major.
    pub pixels: Vec<u8>,
    /// Palette converted to BGR555.
    pub palette: Vec<u16>,
    /// Raw source palette (8-bit RGB triples), for the import tools.
    pub palette_rgb: Vec<u8>,
}

pub fn load_indexed_png(path: &Path) -> Result<IndexedImage> {
    let file = std::fs::File::open(path)
        .with_context(|| format!("ouverture de {}", path.display()))?;
    let mut decoder = png::Decoder::new(file);
    // Do NOT expand the palette to RGB here: we want the raw indices.
    decoder.set_transformations(png::Transformations::IDENTITY);
    let mut reader = decoder.read_info()?;

    let info = reader.info();
    if info.color_type != png::ColorType::Indexed {
        // Truecolor PNG (re-saved chipsets, image editor exports): index
        // it on the fly, rounding colours to SNES precision (5 bits per
        // channel). Alpha below 128 counts as transparent.
        drop(reader);
        return load_truecolor_png(path);
    }
    let palette_rgb = info
        .palette
        .as_ref()
        .context("PNG indexé sans palette")?
        .to_vec();
    let bit_depth = info.bit_depth as u8;
    let (width, height) = (info.width as usize, info.height as usize);

    let mut buf = vec![0; reader.output_buffer_size()];
    let out = reader.next_frame(&mut buf)?;
    let bytes_per_row = out.line_size;

    // Unpack indices according to bit depth (PIL writes 1/2/4/8).
    let mut pixels = Vec::with_capacity(width * height);
    for y in 0..height {
        let row = &buf[y * bytes_per_row..(y + 1) * bytes_per_row];
        for x in 0..width {
            let idx = match bit_depth {
                8 => row[x],
                4 => (row[x / 2] >> (4 - 4 * (x % 2))) & 0x0F,
                2 => (row[x / 4] >> (6 - 2 * (x % 4))) & 0x03,
                1 => (row[x / 8] >> (7 - (x % 8))) & 0x01,
                d => bail!("profondeur PNG non geree : {} bits", d),
            };
            pixels.push(idx);
        }
    }

    let palette = palette_rgb
        .chunks(3)
        .map(|c| bgr555(c[0], c[1], c[2]))
        .collect();

    Ok(IndexedImage { width, height, pixels, palette, palette_rgb })
}

fn bgr555(r: u8, g: u8, b: u8) -> u16 {
    ((r as u16) >> 3) | (((g as u16) >> 3) << 5) | (((b as u16) >> 3) << 10)
}

/// Non-indexed PNG to IndexedImage. Colours rounded to the SNES step of 8
/// (5 useful bits) become the palette; index 0 is reserved for
/// transparency (alpha < 128). Refuses more than 255 opaque colours — a
/// legitimate pixel-art chipset always fits.
fn load_truecolor_png(path: &Path) -> Result<IndexedImage> {
    use std::collections::HashMap;

    let file = std::fs::File::open(path)?;
    let mut decoder = png::Decoder::new(file);
    decoder.set_transformations(
        png::Transformations::EXPAND | png::Transformations::STRIP_16,
    );
    let mut reader = decoder.read_info()?;
    let info = reader.info();
    let (width, height) = (info.width as usize, info.height as usize);

    let mut buf = vec![0; reader.output_buffer_size()];
    let out = reader.next_frame(&mut buf)?;
    let stride = out.line_size;
    let channels = match out.color_type {
        png::ColorType::Rgb => 3,
        png::ColorType::Rgba => 4,
        png::ColorType::Grayscale => 1,
        png::ColorType::GrayscaleAlpha => 2,
        other => bail!("{} : type de PNG non gere ({:?})", path.display(), other),
    };

    let mut palette_rgb: Vec<u8> = vec![255, 0, 255]; // index 0 : transparent
    let mut index_of: HashMap<[u8; 3], u8> = HashMap::new();
    let mut pixels = Vec::with_capacity(width * height);
    for y in 0..height {
        let row = &buf[y * stride..];
        for x in 0..width {
            let p = &row[x * channels..];
            let (r, g, b, a) = match channels {
                3 => (p[0], p[1], p[2], 255),
                4 => (p[0], p[1], p[2], p[3]),
                1 => (p[0], p[0], p[0], 255),
                _ => (p[0], p[0], p[0], p[1]),
            };
            if a < 128 {
                pixels.push(0);
                continue;
            }
            // round to the SNES step: kills the noise of re-saved files
            let key = [r & 0xF8, g & 0xF8, b & 0xF8];
            let idx = match index_of.get(&key) {
                Some(&i) => i,
                None => {
                    let i = palette_rgb.len() / 3;
                    if i > 255 {
                        bail!(
                            "{} : plus de 255 couleurs opaques (meme arrondies \
                             SNES) — sauvegarder l'image en PNG indexe",
                            path.display()
                        );
                    }
                    palette_rgb.extend_from_slice(&key);
                    index_of.insert(key, i as u8);
                    i as u8
                }
            };
            pixels.push(idx);
        }
    }

    let palette = palette_rgb
        .chunks(3)
        .map(|c| bgr555(c[0], c[1], c[2]))
        .collect();
    Ok(IndexedImage { width, height, pixels, palette, palette_rgb })
}

impl IndexedImage {
    fn pixel(&self, x: usize, y: usize) -> u8 {
        self.pixels[y * self.width + x]
    }

    /// char4bpp with re-indexing, for per-character-block OBJ palettes:
    /// every source index goes through `remap` before encoding.
    fn char4bpp_mapped(&self, ox: usize, oy: usize, remap: &[u8; 256]) -> [u8; 32] {
        let mut out = [0u8; 32];
        for y in 0..8 {
            for x in 0..8 {
                let src = self.pixel(ox + x, oy + y);
                let c = if src == 0 { 0 } else { remap[src as usize] };
                let bit = 0x80u8 >> x;
                if c & 1 != 0 { out[y * 2] |= bit; }
                if c & 2 != 0 { out[y * 2 + 1] |= bit; }
                if c & 4 != 0 { out[16 + y * 2] |= bit; }
                if c & 8 != 0 { out[16 + y * 2 + 1] |= bit; }
            }
        }
        out
    }

    /// Full-screen picture, RM2003 style: indexed PNG, at most 16 colours,
    /// dimensions multiple of 8, up to 256x224. Smaller images are centred
    /// on the 32x28 grid, empty cells taking colour 0. Returns deduplicated
    /// 4bpp chars, a 32x28 tilemap on palette 0, and a 16-colour BGR555
    /// palette. Budget: 512 chars — the engine covers the BG1 tileset
    /// region and reloads it on close.
    /// With `trans`, the tilemap entries take BG palette 7, which is kept
    /// free for this: the scenery keeps palettes 0-6, so the map layer
    /// showing through stays correct.
    /// Vignette: a horizontal strip of square frames — the PNG height IS
    /// the cell size (16, 32 or 64 since O-C; width a multiple of it),
    /// at most 15 colours plus transparent index 0. Each frame is
    /// emitted row-major over the FULL cell width (cell/8 chars per
    /// row): the engine transfers a cell as `cell/8` DMA rows, and for
    /// a 64x64 the four 32x32 OBJ quadrants fall exactly on the char
    /// blocks of vignette slots {s, s+1, s+4, s+5} (vignette.c).
    /// Returns chars, frame count, a 16-colour palette and the cell.
    pub fn to_vignette(&self, name: &str) -> Result<(Vec<u8>, usize, Vec<u16>, usize)> {
        let cell = self.height;
        if !(cell == 16 || cell == 32 || cell == 64)
            || self.width == 0 || self.width % cell != 0
        {
            bail!(
                "sprite animé '{}' : attendu une bande de frames carrées \
                 (hauteur 16, 32 ou 64 = la taille de cellule, largeur \
                 multiple de la hauteur), recu {}x{}",
                name, self.width, self.height
            );
        }
        let frames = self.width / cell;
        // The real ceiling is the ROM bank: one sheet is one contiguous
        // array (frames x cell^2/2 bytes) and a LoROM bank holds 32 KB —
        // 64 frames of 32x32, 16 of 64x64; 16x16 hits the u8 frame
        // counter (255) before the bank (256).
        let max = (32768 / (cell * cell / 2)).min(255);
        if frames > max {
            bail!(
                "sprite animé '{}' : {} frames (max {} en {}x{} — une banque ROM)",
                name, frames, max, cell, cell
            );
        }
        if let Some(&mx) = self.pixels.iter().max() {
            if mx >= 16 {
                bail!(
                    "sprite animé '{}' : index de couleur {} utilise (max 15 — \
                     15 couleurs + transparence)",
                    name, mx
                );
            }
        }
        let identity: [u8; 256] = std::array::from_fn(|i| i as u8);
        let mut chars: Vec<u8> = Vec::new();
        let n = cell / 8;
        for f in 0..frames {
            for row in 0..n {
                for col in 0..n {
                    let ch =
                        self.char4bpp_mapped(f * cell + col * 8, row * 8, &identity);
                    chars.extend_from_slice(&ch);
                }
            }
        }
        let mut pal: Vec<u16> = self.palette.iter().copied().take(16).collect();
        pal.resize(16, 0);
        Ok((chars, frames, pal, cell))
    }

    pub fn to_picture(&self, trans: bool) -> Result<(Vec<u8>, Vec<u16>, Vec<u16>)> {
        if self.width == 0 || self.height == 0
            || self.width % 8 != 0 || self.height % 8 != 0
            || self.width > 256 || self.height > 224
        {
            bail!(
                "picture : attendu <= 256x224 avec dimensions multiples de 8, recu {}x{}",
                self.width, self.height
            );
        }
        // What matters is the INDICES actually used: PNGs often carry a
        // palette padded to 256 entries, so it is truncated to 16.
        if let Some(&mx) = self.pixels.iter().max() {
            if mx >= 16 {
                bail!(
                    "picture : index de couleur {} utilise (max 15 — image \
                     indexee 16 couleurs)",
                    mx
                );
            }
        }
        let identity: [u8; 256] = std::array::from_fn(|i| i as u8);
        let tw = self.width / 8;
        let th = self.height / 8;
        // The image sits at the map's TOP-LEFT; the engine positions it on
        // screen through the BG1 scroll (pic_show). The map is a FULL 32x32:
        // scrolling vertically brings rows 28-31 into view through the
        // SC_32x32 wrap, so they are padded transparent.
        let mut chars: Vec<u8> = Vec::new();
        let mut seen: HashMap<[u8; 32], u16> = HashMap::new();
        let mut map = vec![0u16; 32 * 32];
        for ty in 0..32usize {
            for tx in 0..32usize {
                let ch: [u8; 32] = if tx < tw && ty < th {
                    self.char4bpp_mapped(tx * 8, ty * 8, &identity)
                } else {
                    [0u8; 32] // hors image : couleur 0 (transparent/fond)
                };
                let n = seen.len() as u16;
                let id = *seen.entry(ch).or_insert_with(|| {
                    chars.extend_from_slice(&ch);
                    n
                });
                // palette 0 (opaque) or 7 (transparency), never flipped
                map[ty * 32 + tx] = if trans { id | (7 << 10) } else { id };
            }
        }
        if seen.len() > 512 {
            bail!(
                "picture : {} tiles 8x8 uniques (max 512 — la région VRAM des \
                 sprites, empruntée pendant l'affichage) — simplifier l'image \
                 (aplats, motifs répétés)",
                seen.len()
            );
        }
        let mut pal: Vec<u16> = self.palette.iter().copied().take(16).collect();
        pal.resize(16, 0);
        Ok((chars, map, pal))
    }

    /// A world map's SKY IMAGE: the band shown above the horizon by the
    /// mid-frame video mode switch (PLANNING_SYSTEME_MODE7 §7.2f).
    ///
    /// Like a picture, with three differences that come from where it
    /// lives. It sits in the 16 KB the Mode 7 plane leaves free, so at
    /// most 256 chars, not 512. Its map entries carry PALETTE 7, because
    /// mode 1's BG2 indexes CGRAM 0-127 — the plane's own half — and the
    /// only way to give the sky colours of its own is to reserve the top
    /// sixteen. And 256 pixels wide is not a maximum but the natural
    /// width: BG2's map is 32 tiles and wraps, so a 256-wide sky loops
    /// seamlessly as the camera turns.
    ///
    /// COLOUR 0 IS TRANSPARENT, and that is useful rather than a
    /// limitation: a cloud layer drawn on index 0 lets the flat sky
    /// colour (CGRAM 0) show behind it.
    pub fn to_m7_sky(&self) -> Result<(Vec<u8>, Vec<u16>, Vec<u16>)> {
        if self.width == 0 || self.height == 0
            || self.width % 8 != 0 || self.height % 8 != 0
            || self.width > 256 || self.height > 128
        {
            bail!(
                "ciel mode7 : attendu <= 256x128 avec dimensions multiples de 8,                  recu {}x{}",
                self.width, self.height
            );
        }
        if let Some(&mx) = self.pixels.iter().max() {
            if mx >= 16 {
                bail!(
                    "ciel mode7 : index de couleur {} utilise (max 15 — le ciel                      tient dans UNE palette de 16, reservee en CGRAM 112-127)",
                    mx
                );
            }
        }
        let identity: [u8; 256] = std::array::from_fn(|i| i as u8);
        let tw = self.width / 8;
        let th = self.height / 8;
        // CHAR 0 IS RESERVED BLANK. Not tidiness: in mode 1 BG1 draws as
        // well, and it is silenced by pointing its tilemap at a ZEROED
        // region — which renders char 0 everywhere. If char 0 were the
        // picture's top-left tile, BG1 would paper the sky with it,
        // scrolled by M7HOFS/M7VOFS. Seen on the first run: the sky came
        // up striped.
        let mut chars: Vec<u8> = vec![0u8; 32];
        let mut seen: HashMap<[u8; 32], u16> = HashMap::new();
        seen.insert([0u8; 32], 0);
        let mut map = vec![0u16; 32 * 32];
        for ty in 0..32usize {
            for tx in 0..32usize {
                let ch: [u8; 32] = if tx < tw && ty < th {
                    self.char4bpp_mapped(tx * 8, ty * 8, &identity)
                } else {
                    [0u8; 32]
                };
                let n = seen.len() as u16;
                let id = *seen.entry(ch).or_insert_with(|| {
                    chars.extend_from_slice(&ch);
                    n
                });
                map[ty * 32 + tx] = id | (7 << 10); /* palette 7 = CGRAM 112 */
            }
        }
        if seen.len() > 256 {
            bail!(
                "ciel mode7 : {} tuiles 8x8 uniques (max 256 — la region VRAM                  laissee libre par le plan) — simplifier l'image ou la faire                  moins haute",
                seen.len()
            );
        }
        let mut pal: Vec<u16> = self.palette.iter().copied().take(16).collect();
        pal.resize(16, 0);
        Ok((chars, map, pal))
    }

    /// Encodes one 8x8 char as planar SNES 2bpp (16 bytes).
    fn char2bpp(&self, ox: usize, oy: usize) -> [u8; 16] {
        let mut out = [0u8; 16];
        for y in 0..8 {
            for x in 0..8 {
                let c = self.pixel(ox + x, oy + y);
                let bit = 0x80u8 >> x;
                if c & 1 != 0 { out[y * 2] |= bit; }
                if c & 2 != 0 { out[y * 2 + 1] |= bit; }
            }
        }
        out
    }

    /// Number of character blocks in the sheet (12 frames of 16x24 each,
    /// RM2003 charset model). Also validates the strip's format.
    pub fn sprite_blocks(&self) -> Result<usize> {
        if self.height != 24 || self.width % 16 != 0 {
            bail!(
                "sprites : attendu une bande de frames 16x24 (hauteur 24) — \
                 blocs de 12 frames (4 directions x 3, modele RM2003)"
            );
        }
        Ok((self.width / 16).div_ceil(12))
    }

    /// OBJ sheet for one sprite SET, compiled per scene like the tilesets.
    /// `blocks` lists the project character blocks to embed (at most 5 —
    /// local slot s receives global block blocks[s]).
    /// Each 16x24 frame is drawn by two stacked 16x16 OBJs. In VRAM a group
    /// of 8 frames occupies 4 rows of 16 chars: rows 0-1 hold the top
    /// halves, rows 2-3 the bottom halves, and the last 8 lines stay empty.
    /// Top OBJ of local frame f is char ((f&0xF8)<<3)|((f&7)<<1); the
    /// bottom one is +32.
    ///
    /// Each slot gets ITS OWN OBJ palette (slot s to palette s): the
    /// block's colours are re-indexed locally to 1..15 with 0 transparent.
    /// Past 15 colours the closest pair is merged, with a warning — this
    /// never fails the build.
    ///
    /// Returns the 4bpp chars and the full 8x16-colour OBJ CGRAM.
    pub fn to_obj_sheet(&self, blocks: &[usize]) -> Result<(Vec<u8>, Vec<u16>)> {
        let total_blocks = self.sprite_blocks()?;
        let frames = self.width / 16;
        if blocks.len() > 5 {
            bail!("sprites : 5 blocs de personnage max par set (60 frames OBJ)");
        }

        // Palette and re-indexing per slot: the distinct BGR555 colours of
        // the block's frames, source index 0 staying transparent.
        let mut pal = vec![0u16; 128];
        let mut remaps: Vec<[u8; 256]> = Vec::new();
        for (s, &b) in blocks.iter().enumerate() {
            if b >= total_blocks {
                bail!("sprites : bloc {} hors feuille ({} bloc(s))", b, total_blocks);
            }
            let f0 = b * 12;
            let f1 = ((b + 1) * 12).min(frames);
            // frequency per BGR555 colour, in stable order of appearance
            let mut colors: Vec<(u16, usize)> = Vec::new();
            for y in 0..24 {
                for x in f0 * 16..f1 * 16 {
                    let idx = self.pixel(x, y);
                    if idx == 0 {
                        continue;
                    }
                    let c = self.palette[idx as usize];
                    match colors.iter_mut().find(|e| e.0 == c) {
                        Some(e) => e.1 += 1,
                        None => colors.push((c, 1)),
                    }
                }
            }
            // Past 15 colours, merge the closest pair — the rarer one takes
            // the other's value, same rule as the BG tiles.
            let mut merged = 0usize;
            while colors.len() > 15 {
                let (mut bi, mut bj, mut bd) = (0usize, 1usize, u32::MAX);
                for i in 0..colors.len() {
                    for j in i + 1..colors.len() {
                        let d = color_dist(colors[i].0, colors[j].0);
                        if d < bd {
                            (bi, bj, bd) = (i, j, d);
                        }
                    }
                }
                // the more frequent colour absorbs the other
                let (keep, drop) = if colors[bi].1 >= colors[bj].1 {
                    (bi, bj)
                } else {
                    (bj, bi)
                };
                colors[keep].1 += colors[drop].1;
                colors.remove(drop);
                merged += 1;
            }
            if merged > 0 {
                println!(
                    "attention : sprites — bloc {} : plus de 15 couleurs, {} fusion(s)",
                    b, merged
                );
            }
            // source index -> local block index, keyed by BGR555 value;
            // a merged colour maps to whichever it was merged into
            let mut remap = [0u8; 256];
            for (src, &c) in self.palette.iter().enumerate() {
                if src == 0 {
                    continue;
                }
                let mut best = (0usize, u32::MAX);
                for (k, &(pc, _)) in colors.iter().enumerate() {
                    let d = color_dist(c, pc);
                    if d < best.1 {
                        best = (k, d);
                    }
                }
                if !colors.is_empty() {
                    remap[src] = (best.0 + 1) as u8;
                }
            }
            for (k, &(c, _)) in colors.iter().enumerate() {
                pal[s * 16 + 1 + k] = c;
            }
            remaps.push(remap);
        }

        // Chars: groups of 8 local frames = 4 rows of 16 chars. Local frame
        // s*12+i comes from source frame blocks[s]*12+i, or blank when the
        // sheet's last block is incomplete.
        let blank = [0u8; 32];
        let mut out = Vec::new();
        let local_frames = blocks.len() * 12;
        let groups = local_frames.div_ceil(8);
        for p in 0..groups {
            for part in 0..4 {
                for i in 0..8 {
                    let f = p * 8 + i;
                    let src = if f < local_frames {
                        blocks[f / 12] * 12 + f % 12
                    } else {
                        frames // hors feuille → blanc
                    };
                    if src >= frames || part == 3 {
                        out.extend_from_slice(&blank);
                        out.extend_from_slice(&blank);
                        continue;
                    }
                    let remap = &remaps[f / 12];
                    out.extend_from_slice(&self.char4bpp_mapped(src * 16, part * 8, remap));
                    out.extend_from_slice(&self.char4bpp_mapped(src * 16 + 8, part * 8, remap));
                }
            }
        }
        Ok((out, pal))
    }

    /// Font: a strip of 96 8x8 glyphs (ASCII 32-127) to 2bpp, preceded by
    /// a generated transparent char (spec §4: BG3 char = 1 + ascii - 32).
    pub fn to_font(&self) -> Result<Vec<u8>> {
        if self.height != 8 || self.width != 96 * 8 {
            bail!("font : attendu 96 glyphes 8x8 (bande 768x8)");
        }
        let mut out = vec![0u8; 16]; // char 0 : transparent
        for c in 0..96 {
            out.extend_from_slice(&self.char2bpp(c * 8, 0));
        }
        Ok(out)
    }

    /// 9-slice windowskin (docs/SPEC_SYSTEME_UI.md): 24x24 indexed PNG,
    /// 3x3 8x8 tiles converted to 2bpp row by row (TL T TR / L C R /
    /// BL B BR). Same four colours as the font: 0 transparent, 1
    /// background, 2 text/border, 3 accent.
    pub fn to_windowskin(&self) -> Result<Vec<u8>> {
        if self.width != 24 || self.height != 24 {
            bail!("windowskin : attendu 24x24 (9-slice de tiles 8x8), recu {}x{}",
                  self.width, self.height);
        }
        if self.pixels.iter().any(|&p| p > 3) {
            bail!("windowskin : 4 couleurs max (indexes 0-3, palette de la fonte)");
        }
        let mut out = Vec::new();
        for ty in 0..3 {
            for tx in 0..3 {
                out.extend_from_slice(&self.char2bpp(tx * 8, ty * 8));
            }
        }
        Ok(out)
    }

    /// An EXTRA font for a dialogue style: the 96 glyphs alone, without
    /// the leading transparent char (the base points at ' ').
    pub fn to_font_glyphs(&self) -> Result<Vec<u8>> {
        let full = self.to_font()?;
        Ok(full[16..].to_vec())
    }

    /// UI widget icon sheet: an Nx8 strip (width a multiple of 8, at most
    /// 64 icons) indexed on the font's palette (0 transparent, 1
    /// background, 2 border, 3 accent). Each icon becomes one 2bpp char,
    /// appended after the windowskin.
    pub fn to_icons(&self) -> Result<Vec<u8>> {
        if self.height != 8 || self.width == 0 || self.width % 8 != 0 {
            bail!(
                "icones UI : attendu une bande Nx8 (largeur multiple de 8), recu {}x{}",
                self.width, self.height
            );
        }
        let n = self.width / 8;
        if n > 64 {
            bail!("icones UI : {} icones (max 64)", n);
        }
        if self.pixels.iter().any(|&p| p > 3) {
            bail!("icones UI : 4 couleurs max (indexes 0-3, palette de la fonte)");
        }
        let mut out = Vec::new();
        for c in 0..n {
            out.extend_from_slice(&self.char2bpp(c * 8, 0));
        }
        Ok(out)
    }

    /// An image for the UI layer — the "Image" widget in picture mode: a
    /// rectangle of 2bpp tiles, like an icon but of free size.
    ///
    /// The SNES UI layer has only four colours and EVERYTHING there shares
    /// the font's palette (glyphs, frames, icons), so the image's colours
    /// are mapped to the nearest of those. Index 0 stays transparency — a
    /// transparent pixel remains one, no neighbour is looked for.
    /// The image is padded with transparency up to the next multiple of 8:
    /// the author does not have to align pixels to the tile grid. Returns
    /// chars, width and height in TILES.
    ///
    /// With `bg`, the "panel background" variant: when the widget lives
    /// inside a designer window, transparent pixels — and the padding to
    /// the tile grid — take the frame's BACKGROUND colour instead of
    /// showing the game through. SNES compositing is per tile, so this is
    /// resolved at compile time, as for the icons (to_icons_bg).
    ///
    /// `cut` keeps only part of EVERY tile, which is what gives a FILLED
    /// image (the "fill" mode of the image widget) its half-step: 0 the
    /// whole tile, 1 its left half — a bar filling left to right — and 2
    /// its bottom half, one filling upwards. The rest goes to `void`.
    pub fn to_ui_image_bg(&self, ui_pal: &[u16], bg: bool, cut: u8) -> Result<(Vec<u8>, u8, u8)> {
        if self.width == 0 || self.height == 0 {
            bail!("image UI : image vide");
        }
        let tw = (self.width + 7) / 8;
        let th = (self.height + 7) / 8;
        if tw > 32 || th > 28 {
            bail!(
                "image UI : {}x{} px = {}x{} tuiles, l'ecran en fait 32x28",
                self.width, self.height, tw, th
            );
        }
        // Inside a window, "empty" — transparent plus the padding to the
        // tile grid — takes the frame BACKGROUND (index 1) rather than
        // letting the game show through.
        let void = if bg { 1u8 } else { 0u8 };
        // image colour -> index 0-3 of the UI palette
        let mut map = vec![void; self.palette.len().max(1)];
        for (i, &c) in self.palette.iter().enumerate() {
            if i == 0 {
                map[i] = void; /* transparent : rien, ou le fond du cadre */
                continue;
            }
            let mut best = 1usize;
            let mut best_d = u32::MAX;
            for j in 1..ui_pal.len().min(4) {
                let d = color_dist(c, ui_pal[j]);
                if d < best_d {
                    best_d = d;
                    best = j;
                }
            }
            map[i] = best as u8;
        }
        // remapped copy, padded to the tile grid
        let mut padded = IndexedImage {
            width: tw * 8,
            height: th * 8,
            pixels: vec![void; tw * 8 * th * 8],
            palette: self.palette.clone(),
            palette_rgb: self.palette_rgb.clone(),
        };
        for y in 0..self.height {
            for x in 0..self.width {
                let src = self.pixels[y * self.width + x] as usize;
                padded.pixels[y * padded.width + x] = *map.get(src).unwrap_or(&void);
            }
        }
        // half tile: blank the part the bar has not reached yet
        if cut != 0 {
            for y in 0..padded.height {
                for x in 0..padded.width {
                    let drop = if cut == 1 { x % 8 >= 4 } else { y % 8 < 4 };
                    if drop {
                        padded.pixels[y * padded.width + x] = void;
                    }
                }
            }
        }
        let mut out = Vec::new();
        for ty in 0..th {
            for tx in 0..tw {
                out.extend_from_slice(&padded.char2bpp(tx * 8, ty * 8));
            }
        }
        Ok((out, tw as u8, th as u8))
    }

    /// "Panel background" variants of the icons: transparent pixels
    /// (index 0) become the BACKGROUND (index 1), so an icon placed in a
    /// window shows the frame behind it and not the game. SNES compositing
    /// is per tile, so it is resolved at compile time.
    /// These chars are appended after the normal icons (UI_ICON_BASE + count).
    pub fn to_icons_bg(&self) -> Result<Vec<u8>> {
        let mut copy = self.clone();
        for p in copy.pixels.iter_mut() {
            if *p == 0 {
                *p = 1;
            }
        }
        copy.to_icons()
    }

    /// Palette padded or truncated to n BGR555 entries.
    pub fn palette_n(&self, n: usize) -> Vec<u16> {
        let mut p = self.palette.clone();
        p.resize(n, 0);
        p
    }
}

/// A 2bpp character filled with ONE palette index — what the "image"
/// widget draws in solid-colour mode. The UI layer only has the font's
/// four colours, so `index` is 0-3 and 0 is transparency.
///
/// `cut` keeps only part of the tile, the half-step of a FILLED image:
/// 0 the whole tile, 1 its left half, 2 its bottom half — the same
/// convention as IndexedImage::to_ui_image_bg.
pub fn solid_char(index: u8, cut: u8) -> Vec<u8> {
    let mut out = vec![0u8; 16];
    for y in 0..8 {
        if cut == 2 && y < 4 {
            continue; /* fills upwards: the top half stays empty */
        }
        let row = if cut == 1 { 0xF0u8 } else { 0xFFu8 };
        if index & 1 != 0 {
            out[y * 2] = row;
        }
        if index & 2 != 0 {
            out[y * 2 + 1] = row;
        }
    }
    out
}
