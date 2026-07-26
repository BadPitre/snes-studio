//! tileset.rs — compilation d'un tileset : grille de tiles + autotiles
//! (format RPG Maker 2003) + sidecar de passabilité.
//!
//! Id logiques (JSON auteur) :
//!   0..count-1     tile de la grille PNG (rangée par rangée)
//!   1000 + k       autotile k du sidecar (les bordures sont calculées)
//!   -1             vide (couche supérieure uniquement)
//!
//! Id binaires (u8, tilemap moteur) :
//!   0..count-1     tiles de la grille (inchangés)
//!   count..        variantes d'autotiles UTILISÉES (ordre déterministe)
//!   dernier id     metatile transparent (couche sup vide) — le char 0 de
//!                  chaque charset est réservé transparent.
//!
//! Passabilité (sidecar assets/<stem>.json) : `solid` = ids logiques X,
//! `above` = ids logiques ☆ (dessinés au-dessus du héros sur la couche
//! sup, jamais bloquants). La couche collision binaire est DÉRIVÉE :
//! tile sup présente et non-☆ → sa passabilité l'emporte (ponts), sinon
//! celle de la tile inférieure.

use crate::gfx::IndexedImage;
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::{BTreeSet, HashMap};
use std::path::Path;

pub const AUTO_BASE: i32 = 1000;
pub const EMPTY: i32 = -1;

/// Sidecar optionnel `assets/<stem>.json`
#[derive(Deserialize, Default)]
pub struct TilesetMeta {
    /// PNG d'autotiles 48x64 (3x4 tiles, format RPG Maker 2003)
    #[serde(default)]
    pub autotiles: Vec<String>,
    /// Ids logiques bloquants (X)
    #[serde(default)]
    pub solid: Vec<i32>,
    /// Ids logiques ☆ (au-dessus du héros, passables)
    #[serde(default)]
    pub above: Vec<i32>,
}

pub struct SourceTileset {
    pub img: IndexedImage,
    pub autos: Vec<IndexedImage>,
    pub meta: TilesetMeta,
    /// Nombre de tiles de la grille PNG
    pub count: u16,
}

pub struct CompiledTileset {
    pub charset: Vec<u8>,
    pub table: Vec<u16>,
    /// 1 octet par id binaire : 1 = ☆ (priorité BG1 sur la couche sup)
    pub prio: Vec<u8>,
    pub blank_id: u8,
    variant_ids: HashMap<(usize, u16), u8>,
}

/// Grilles binaires d'une scène (row-major, w*h octets chacune)
pub struct SceneGrids {
    pub lower: Vec<u8>,
    pub upper: Vec<u8>,
    pub collision: Vec<u8>,
}

pub fn load_source(proj_dir: &Path, png_rel: &str) -> Result<SourceTileset> {
    let img = crate::gfx::load_indexed_png(&proj_dir.join(png_rel))?;
    if img.width == 0 || img.height == 0 || img.width % 16 != 0 || img.height % 16 != 0 {
        bail!("tileset {} : dimensions multiples de 16 requises", png_rel);
    }
    let count = (img.width / 16) * (img.height / 16);
    if count > 256 {
        bail!("tileset {} : {} tiles > 256", png_rel, count);
    }

    let sidecar = Path::new(png_rel).with_extension("json");
    let meta: TilesetMeta = match std::fs::read_to_string(proj_dir.join(&sidecar)) {
        Ok(s) => serde_json::from_str(&s)
            .with_context(|| format!("sidecar {}", sidecar.display()))?,
        Err(_) => TilesetMeta::default(),
    };

    let mut autos = Vec::new();
    for rel in &meta.autotiles {
        let a = crate::gfx::load_indexed_png(&proj_dir.join(rel))?;
        if a.width != 48 || a.height != 64 {
            bail!("autotile {} : attendu 48x64 (3x4 tiles, format RM2003)", rel);
        }
        autos.push(a);
    }

    let src = SourceTileset { img, autos, meta, count: count as u16 };
    for &id in src.meta.solid.iter().chain(src.meta.above.iter()) {
        if !src.valid_id(id) {
            bail!("tileset {} : id logique {} inconnu dans le sidecar", png_rel, id);
        }
    }
    Ok(src)
}

impl SourceTileset {
    pub fn valid_id(&self, id: i32) -> bool {
        (0..self.count as i32).contains(&id)
            || (AUTO_BASE..AUTO_BASE + self.autos.len() as i32).contains(&id)
    }
    fn is_solid(&self, id: i32) -> bool {
        self.meta.solid.contains(&id)
    }
    fn is_above(&self, id: i32) -> bool {
        self.meta.above.contains(&id)
    }
}

/* --- Autotiles : algorithme de bordure RM2003 -----------------------------
 * Chaque quart 8x8 d'une tile choisit sa pièce selon ses voisins de MÊME
 * autotile (bord de map = même). Pièces : 0 coin externe, 1 bord
 * horizontal, 2 bord vertical, 3 coin interne, 4 centre. Le gabarit 3x4 :
 * (0,0) îlot d'aperçu, (1,0) coins internes, rangées 1-3 = bloc 9-slice. */

fn quarter_piece(v: bool, h: bool, d: bool) -> u16 {
    match (v, h) {
        (false, false) => 0,
        (false, true) => 1,
        (true, false) => 2,
        (true, true) => {
            if d {
                4
            } else {
                3
            }
        }
    }
}

/// Position (col,row) de la pièce p dans le gabarit, pour le quart (qx,qy)
fn piece_pos(p: u16, qx: usize, qy: usize) -> (usize, usize) {
    let cx = if qx == 1 { 2 } else { 0 };
    let ry = if qy == 1 { 3 } else { 1 };
    match p {
        0 => (cx, ry),
        1 => (1, ry),
        2 => (cx, 2),
        3 => (1, 0),
        4 => (1, 2),
        _ => unreachable!(),
    }
}

/// Clé de variante : pièce de chaque quart (TL,TR,BL,BR), encodée base 5.
/// n/e/s/w/... : le voisin est-il le même autotile ?
#[allow(clippy::too_many_arguments)]
pub fn variant_key(
    n: bool, e: bool, s: bool, w: bool, nw: bool, ne: bool, sw: bool, se: bool,
) -> u16 {
    let tl = quarter_piece(n, w, nw);
    let tr = quarter_piece(n, e, ne);
    let bl = quarter_piece(s, w, sw);
    let br = quarter_piece(s, e, se);
    tl * 125 + tr * 25 + bl * 5 + br
}

/// Clé de variante de la cellule (x,y) d'une grille logique (hors-map = même)
fn cell_key(grid: &[Vec<i32>], x: usize, y: usize, w: usize, h: usize) -> u16 {
    let id = grid[y][x];
    let same = |dx: i32, dy: i32| -> bool {
        let nx = x as i32 + dx;
        let ny = y as i32 + dy;
        if nx < 0 || ny < 0 || nx >= w as i32 || ny >= h as i32 {
            return true;
        }
        grid[ny as usize][nx as usize] == id
    };
    variant_key(
        same(0, -1), same(1, 0), same(0, 1), same(-1, 0),
        same(-1, -1), same(1, -1), same(-1, 1), same(1, 1),
    )
}

/// Variantes utilisées par une grille logique, ajoutées à `used` (k, clé)
pub fn collect_variants(grid: &[Vec<i32>], used: &mut BTreeSet<(usize, u16)>) {
    let h = grid.len();
    let w = if h > 0 { grid[0].len() } else { 0 };
    for y in 0..h {
        for x in 0..w {
            let id = grid[y][x];
            if id >= AUTO_BASE {
                used.insert(((id - AUTO_BASE) as usize, cell_key(grid, x, y, w, h)));
            }
        }
    }
}

impl SourceTileset {
    /// Compile charset + metatiles + priorités. `used` : variantes
    /// d'autotiles réellement utilisées par les scènes de ce tileset.
    pub fn compile(&self, used: &BTreeSet<(usize, u16)>) -> Result<CompiledTileset> {
        let mut charset: Vec<u8> = Vec::new();
        let mut seen: HashMap<[u8; 32], u16> = HashMap::new();
        let mut table: Vec<u16> = Vec::new();

        // char 0 : transparent réservé (couche sup vide, coins hors palette)
        let blank_char = [0u8; 32];
        seen.insert(blank_char, 0);
        charset.extend_from_slice(&blank_char);

        let mut push_char = |ch: [u8; 32], charset: &mut Vec<u8>| -> u16 {
            let next = (charset.len() / 32) as u16;
            *seen.entry(ch).or_insert_with(|| {
                charset.extend_from_slice(&ch);
                next
            })
        };

        // tiles de la grille : ids binaires 0..count-1 (inchangés)
        let cols = self.img.width / 16;
        for t in 0..self.count as usize {
            let (ox, oy) = ((t % cols) * 16, (t / cols) * 16);
            for (dy, dx) in [(0usize, 0usize), (0, 8), (8, 0), (8, 8)] {
                let id = push_char(self.img.char4bpp(ox + dx, oy + dy), &mut charset);
                table.push(id);
            }
        }
        let mut prio: Vec<u8> = (0..self.count as i32)
            .map(|id| self.is_above(id) as u8)
            .collect();

        // variantes d'autotiles utilisées, dans l'ordre du BTreeSet
        let mut variant_ids: HashMap<(usize, u16), u8> = HashMap::new();
        for &(k, key) in used {
            let auto = self
                .autos
                .get(k)
                .with_context(|| format!("autotile {} inconnu dans le sidecar", k))?;
            let next_id = table.len() / 4;
            if next_id > 254 {
                bail!("tileset : plus de 255 metatiles (grille + variantes d'autotiles)");
            }
            let pieces = [key / 125, (key / 25) % 5, (key / 5) % 5, key % 5];
            for (q, &p) in pieces.iter().enumerate() {
                let (qx, qy) = (q & 1, q >> 1); // TL,TR,BL,BR
                let (col, row) = piece_pos(p, qx, qy);
                let ch = auto.char4bpp(col * 16 + qx * 8, row * 16 + qy * 8);
                let id = push_char(ch, &mut charset);
                table.push(id);
            }
            variant_ids.insert((k, key), next_id as u8);
            prio.push(self.is_above(AUTO_BASE + k as i32) as u8);
        }

        // metatile transparent (dernier id)
        let blank_id = table.len() / 4;
        if blank_id > 255 {
            bail!("tileset : plus de 256 metatiles (grille + variantes d'autotiles)");
        }
        table.extend_from_slice(&[0, 0, 0, 0]);
        prio.push(0);

        if charset.len() / 32 > 512 {
            bail!("tileset : {} chars 8x8 uniques > 512 (VRAM)", charset.len() / 32);
        }
        Ok(CompiledTileset {
            charset,
            table,
            prio,
            blank_id: blank_id as u8,
            variant_ids,
        })
    }

    /// Grilles binaires d'une scène : couches expansées + collision dérivée
    pub fn expand_scene(
        &self,
        compiled: &CompiledTileset,
        name: &str,
        lower: &[Vec<i32>],
        upper: &[Vec<i32>],
    ) -> Result<SceneGrids> {
        let h = lower.len();
        let w = if h > 0 { lower[0].len() } else { 0 };

        let expand = |grid: &[Vec<i32>], is_upper: bool| -> Result<Vec<u8>> {
            let mut out = Vec::with_capacity(w * h);
            for y in 0..h {
                for x in 0..w {
                    let id = grid[y][x];
                    out.push(if id == EMPTY {
                        if !is_upper {
                            bail!("scene '{}' : -1 interdit sur la couche inferieure", name);
                        }
                        compiled.blank_id
                    } else if id >= AUTO_BASE {
                        let k = (id - AUTO_BASE) as usize;
                        *compiled
                            .variant_ids
                            .get(&(k, cell_key(grid, x, y, w, h)))
                            .context("variante d'autotile non collectee (bug datagen)")?
                    } else {
                        id as u8
                    });
                }
            }
            Ok(out)
        };

        let mut collision = Vec::with_capacity(w * h);
        for y in 0..h {
            for x in 0..w {
                let u = upper[y][x];
                let solid = if u != EMPTY && !self.is_above(u) {
                    self.is_solid(u)
                } else {
                    self.is_solid(lower[y][x])
                };
                collision.push(solid as u8);
            }
        }

        Ok(SceneGrids {
            lower: expand(lower, false)?,
            upper: expand(upper, true)?,
            collision,
        })
    }
}
