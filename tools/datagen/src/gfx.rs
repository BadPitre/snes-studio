//! Conversion PNG indexé → formats SNES (chars 4bpp/2bpp planaires,
//! palettes BGR555). Les PNG doivent être en mode palette : l'index de
//! chaque pixel EST l'index de couleur SNES (round-trip sans perte).

use anyhow::{bail, Context, Result};
use std::path::Path;

pub struct IndexedImage {
    pub width: usize,
    pub height: usize,
    /// Index de palette par pixel (row-major)
    pub pixels: Vec<u8>,
    /// Palette convertie en BGR555
    pub palette: Vec<u16>,
    /// Palette source brute (triplets RGB 8-bit) — pour les outils d'import
    pub palette_rgb: Vec<u8>,
}

pub fn load_indexed_png(path: &Path) -> Result<IndexedImage> {
    let file = std::fs::File::open(path)
        .with_context(|| format!("ouverture de {}", path.display()))?;
    let mut decoder = png::Decoder::new(file);
    // Surtout ne PAS étendre la palette en RGB : on veut les indices bruts
    decoder.set_transformations(png::Transformations::IDENTITY);
    let mut reader = decoder.read_info()?;

    let info = reader.info();
    if info.color_type != png::ColorType::Indexed {
        // PNG truecolor (chipsets re-sauvegardés, exports d'éditeurs
        // d'image) : indexation automatique — couleurs arrondies à la
        // précision SNES (5 bits/canal), alpha < 128 = transparent.
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

    // Dépaquetage des indices selon la profondeur (PIL écrit 1/2/4/8 bits)
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

/// PNG non indexé → IndexedImage : les couleurs (arrondies au pas SNES de
/// 8, soit 5 bits utiles) deviennent la palette, l'index 0 est réservé au
/// transparent (pixels d'alpha < 128). Refuse au-delà de 255 couleurs
/// opaques — un chipset pixel-art légitime tient toujours dedans.
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
            // arrondi au pas SNES : supprime le bruit des re-sauvegardes
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

    /// Encode un char 8x8 en 4bpp planaire SNES (32 octets)
    pub(crate) fn char4bpp(&self, ox: usize, oy: usize) -> [u8; 32] {
        let mut out = [0u8; 32];
        for y in 0..8 {
            for x in 0..8 {
                let c = self.pixel(ox + x, oy + y);
                let bit = 0x80u8 >> x;
                if c & 1 != 0 { out[y * 2] |= bit; }
                if c & 2 != 0 { out[y * 2 + 1] |= bit; }
                if c & 4 != 0 { out[16 + y * 2] |= bit; }
                if c & 8 != 0 { out[16 + y * 2 + 1] |= bit; }
            }
        }
        out
    }

    /// Encode un char 8x8 en 2bpp planaire SNES (16 octets)
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

    /// Feuille de sprites : bande de frames 16x16 → table OBJ 32 chars
    /// (rangée haute : TL,TR par frame ; rangée basse : BL,BR — la frame f
    /// utilise les tiles {2f, 2f+1, 2f+16, 2f+17})
    pub fn to_obj_sheet(&self) -> Result<Vec<u8>> {
        if self.height != 16 || self.width % 16 != 0 {
            bail!("sprites : attendu une bande de frames 16x16 (hauteur 16)");
        }
        let frames = self.width / 16;
        if frames > 64 {
            bail!("sprites : 64 frames max");
        }
        let blank = [0u8; 32];
        let mut out = Vec::new();
        // paires de rangées OBJ de 16 chars : 8 frames par paire
        let pairs = frames.div_ceil(8);
        for p in 0..pairs {
            let mut top = Vec::new();
            let mut bottom = Vec::new();
            for i in 0..8 {
                let f = p * 8 + i;
                if f < frames {
                    top.extend_from_slice(&self.char4bpp(f * 16, 0));
                    top.extend_from_slice(&self.char4bpp(f * 16 + 8, 0));
                    bottom.extend_from_slice(&self.char4bpp(f * 16, 8));
                    bottom.extend_from_slice(&self.char4bpp(f * 16 + 8, 8));
                } else {
                    top.extend_from_slice(&blank);
                    top.extend_from_slice(&blank);
                    bottom.extend_from_slice(&blank);
                    bottom.extend_from_slice(&blank);
                }
            }
            out.extend(top);
            out.extend(bottom);
        }
        Ok(out)
    }

    /// Fonte : bande de 96 glyphes 8x8 (ASCII 32-127) → 2bpp, précédés du
    /// char 0 transparent généré (spec §4 : char BG3 = 1 + ascii - 32)
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

    /// Palette complétée/tronquée à n entrées BGR555
    pub fn palette_n(&self, n: usize) -> Vec<u16> {
        let mut p = self.palette.clone();
        p.resize(n, 0);
        p
    }
}
