//! Conversion PNG indexé → formats SNES (chars 4bpp/2bpp planaires,
//! palettes BGR555). Les PNG doivent être en mode palette : l'index de
//! chaque pixel EST l'index de couleur SNES (round-trip sans perte).

use anyhow::{bail, Context, Result};
use std::collections::HashMap;
use std::path::Path;

pub struct IndexedImage {
    pub width: usize,
    pub height: usize,
    /// Index de palette par pixel (row-major)
    pub pixels: Vec<u8>,
    /// Palette convertie en BGR555
    pub palette: Vec<u16>,
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
        bail!("{} : PNG non indexé (mode palette requis)", path.display());
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

    Ok(IndexedImage { width, height, pixels, palette })
}

fn bgr555(r: u8, g: u8, b: u8) -> u16 {
    ((r as u16) >> 3) | (((g as u16) >> 3) << 5) | (((b as u16) >> 3) << 10)
}

impl IndexedImage {
    fn pixel(&self, x: usize, y: usize) -> u8 {
        self.pixels[y * self.width + x]
    }

    /// Encode un char 8x8 en 4bpp planaire SNES (32 octets)
    fn char4bpp(&self, ox: usize, oy: usize) -> [u8; 32] {
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

    /// Tileset : grille de tiles 16x16 (indices rangée par rangée, comme la
    /// palette RPG Maker) → charset 4bpp dédupliqué + table de metatiles
    /// (4 entrées BG u16 par tile : TL, TR, BL, BR — palette 0)
    pub fn to_metatiles(&self) -> Result<(Vec<u8>, Vec<u16>)> {
        if self.width == 0 || self.height == 0 || self.width % 16 != 0 || self.height % 16 != 0 {
            bail!("tileset : dimensions multiples de 16 requises (tiles 16x16)");
        }
        let cols = self.width / 16;
        let rows = self.height / 16;
        if cols * rows > 256 {
            bail!("tileset : {} tiles > 256 (le tilemap indexe en u8)", cols * rows);
        }
        let mut charset: Vec<u8> = Vec::new();
        let mut seen: HashMap<[u8; 32], u16> = HashMap::new();
        let mut table: Vec<u16> = Vec::new();
        for ty in 0..rows {
            for tx in 0..cols {
                for (dy, dx) in [(0usize, 0usize), (0, 8), (8, 0), (8, 8)] {
                    let ch = self.char4bpp(tx * 16 + dx, ty * 16 + dy);
                    let next = (charset.len() / 32) as u16;
                    let id = *seen.entry(ch).or_insert_with(|| {
                        charset.extend_from_slice(&ch);
                        next
                    });
                    table.push(id);
                }
            }
        }
        if charset.len() / 32 > 512 {
            bail!("tileset : {} chars 8x8 uniques > 512 (VRAM)", charset.len() / 32);
        }
        Ok((charset, table))
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
