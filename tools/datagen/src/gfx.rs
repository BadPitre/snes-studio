//! Conversion PNG indexé → formats SNES (chars 4bpp/2bpp planaires,
//! palettes BGR555). Les PNG doivent être en mode palette : l'index de
//! chaque pixel EST l'index de couleur SNES (round-trip sans perte).

use crate::tileset::dist555 as color_dist;
use anyhow::{bail, Context, Result};
use std::collections::HashMap;
use std::path::Path;

#[derive(Clone)]
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

    /// char4bpp avec ré-indexation (palettes OBJ par bloc de personnage) :
    /// chaque index source passe par la table remap avant encodage
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

    /// Picture plein écran (S3, façon RM2003) : PNG indexé ≤ 16 couleurs,
    /// dimensions multiples de 8, max 256x224 — centré sur la grille
    /// 32x28 si plus petit (cellules vides = couleur 0). Retourne
    /// (chars 4bpp dédupliqués, tilemap 32x28 palette 0, palette 16
    /// couleurs BGR555). Budget : 512 chars (le moteur recouvre la
    /// région tileset BG1, rechargée à la fermeture).
    /// `trans` (S4) : image à transparence — les entrées de tilemap
    /// prennent la PALETTE BG 7 (réservée : le décor garde les palettes
    /// 0-6) pour que la couche carte visible derrière reste correcte.
    /// Vignette (B5) : bande horizontale de frames 32x32 (largeur
    /// multiple de 32, hauteur 32, 1-8 frames), ≤ 15 couleurs + index 0
    /// transparent. Chaque frame est émise en 16 chars OBJ 4bpp en
    /// ordre rangée par rangée (4 rangées de 4 chars = 4 DMA de 128
    /// octets au changement de frame). Retourne (chars, nb frames,
    /// palette 16 couleurs).
    pub fn to_vignette(&self, name: &str) -> Result<(Vec<u8>, usize, Vec<u16>)> {
        if self.height != 32 || self.width == 0 || self.width % 32 != 0 {
            bail!(
                "vignette '{}' : attendu une bande de frames 32x32 \
                 (hauteur 32, largeur multiple de 32), recu {}x{}",
                name, self.width, self.height
            );
        }
        let frames = self.width / 32;
        if frames > 8 {
            bail!("vignette '{}' : {} frames (max 8)", name, frames);
        }
        if let Some(&mx) = self.pixels.iter().max() {
            if mx >= 16 {
                bail!(
                    "vignette '{}' : index de couleur {} utilise (max 15 — \
                     15 couleurs + transparence)",
                    name, mx
                );
            }
        }
        let identity: [u8; 256] = std::array::from_fn(|i| i as u8);
        let mut chars: Vec<u8> = Vec::new();
        for f in 0..frames {
            for row in 0..4 {
                for col in 0..4 {
                    let ch =
                        self.char4bpp_mapped(f * 32 + col * 8, row * 8, &identity);
                    chars.extend_from_slice(&ch);
                }
            }
        }
        let mut pal: Vec<u16> = self.palette.iter().copied().take(16).collect();
        pal.resize(16, 0);
        Ok((chars, frames, pal))
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
        // ce qui compte : les INDEX utilisés (les PNG ont souvent une
        // palette paddée à 256 entrées — on la tronque à 16)
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
        // S5 : image calée en HAUT-GAUCHE de la carte — le moteur la
        // positionne à l'écran par le scroll BG1 (commande pic_show).
        // Carte 32x32 COMPLÈTE : au scroll vertical, les rangées 28-31
        // deviennent visibles (wrap SC_32x32) — padding transparent.
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
                // palette 0 (opaque) ou 7 (transparence S4), sans flip
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

    /// Nombre de blocs de personnage de la feuille (12 frames 16x24 par
    /// bloc, modèle charset RM2003) — valide aussi le format de la bande.
    pub fn sprite_blocks(&self) -> Result<usize> {
        if self.height != 24 || self.width % 16 != 0 {
            bail!(
                "sprites : attendu une bande de frames 16x24 (hauteur 24) — \
                 blocs de 12 frames (4 directions x 3, modele RM2003)"
            );
        }
        Ok((self.width / 16).div_ceil(12))
    }

    /// Feuille OBJ d'un SET de sprites (v0.5, compilé par scène comme les
    /// tilesets) : `blocks` liste les blocs de personnage du projet à
    /// embarquer (max 5 — le slot local s reçoit le bloc global blocks[s]).
    /// Chaque frame 16x24 est rendue par 2 OBJs 16x16 empilés — en VRAM,
    /// un groupe de 8 frames occupe 4 rangées de 16 chars : rangées 0-1 =
    /// moitiés hautes, rangées 2-3 = moitiés basses (les 8 dernières
    /// lignes, vides, restent à 0). OBJ haut de la frame locale f :
    /// char ((f&0xF8)<<3)|((f&7)<<1) ; bas : +32.
    ///
    /// Chaque slot reçoit SA palette OBJ (slot s → palette s) : les
    /// couleurs du bloc sont ré-indexées localement (1..15, 0 =
    /// transparent) ; au-delà de 15 couleurs, fusion des plus proches avec
    /// avertissement (jamais d'échec).
    ///
    /// Retourne (chars 4bpp, CGRAM OBJ complète 8x16 couleurs).
    pub fn to_obj_sheet(&self, blocks: &[usize]) -> Result<(Vec<u8>, Vec<u16>)> {
        let total_blocks = self.sprite_blocks()?;
        let frames = self.width / 16;
        if blocks.len() > 5 {
            bail!("sprites : 5 blocs de personnage max par set (60 frames OBJ)");
        }

        // Palette + ré-indexation par slot : couleurs BGR555 distinctes des
        // frames du bloc (index source 0 = transparent, convention inchangée)
        let mut pal = vec![0u16; 128];
        let mut remaps: Vec<[u8; 256]> = Vec::new();
        for (s, &b) in blocks.iter().enumerate() {
            if b >= total_blocks {
                bail!("sprites : bloc {} hors feuille ({} bloc(s))", b, total_blocks);
            }
            let f0 = b * 12;
            let f1 = ((b + 1) * 12).min(frames);
            // fréquence par couleur BGR555 (ordre d'apparition stable)
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
            // > 15 couleurs : fusion des deux plus proches (la moins
            // fréquente prend la valeur de l'autre), comme pour les tiles BG
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
                // la plus fréquente absorbe l'autre
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
            // table index source → index local du bloc (via valeur BGR555,
            // couleur fusionnée → sa couleur d'arrivée la plus proche)
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

        // Chars : groupes de 8 frames locales = 4 rangées de 16 chars.
        // La frame locale s*12+i vient de la frame source blocks[s]*12+i
        // (blanche si le dernier bloc de la feuille est incomplet).
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

    /// Windowskin 9-slice (Phase 11, docs/SPEC_SYSTEME_UI.md) : PNG 24x24
    /// indexé, 3x3 tiles 8x8 converties en 2bpp dans l'ordre ligne par
    /// ligne (HG H HD / G C D / BG B BD). Mêmes 4 couleurs que la fonte
    /// (0 transparent, 1 fond, 2 texte/bord, 3 accent).
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

    /// Fonte SUPPLÉMENTAIRE d'un style de dialogue (S1) : les 96 glyphes
    /// seuls, SANS le char transparent de tête (la base pointe sur ' ').
    pub fn to_font_glyphs(&self) -> Result<Vec<u8>> {
        let full = self.to_font()?;
        Ok(full[16..].to_vec())
    }

    /// Planche d'icônes UI des widgets (W1, PLANNING_SYSTEME_MENUS.md) :
    /// bande Nx8 (largeur multiple de 8, 64 icônes max), indexée sur la
    /// palette de la fonte (0 transparent, 1 fond, 2 bord, 3 accent).
    /// Chaque icône devient un char 2bpp, appendu après le windowskin.
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

    /// Variantes « fond de panneau » des icônes (D1) : les pixels
    /// transparents (index 0) deviennent le FOND (index 1) — une icône
    /// posée dans une window montre le cadre derrière elle, pas le jeu
    /// (le compositing SNES est par tiles, on résout à la compilation).
    /// Chars appendus après les icônes normales (UI_ICON_BASE + count).
    pub fn to_icons_bg(&self) -> Result<Vec<u8>> {
        let mut copy = self.clone();
        for p in copy.pixels.iter_mut() {
            if *p == 0 {
                *p = 1;
            }
        }
        copy.to_icons()
    }

    /// Palette complétée/tronquée à n entrées BGR555
    pub fn palette_n(&self, n: usize) -> Vec<u16> {
        let mut p = self.palette.clone();
        p.resize(n, 0);
        p
    }
}
