//! Source tilesets (grid, RM2003 autotiles, passability sidecar) and the
//! compilation of PER-SCENE graphics.
//!
//! Logical ids, as written in the author's JSON:
//!   0..count-1     a tile of the PNG grid, row by row, up to 999
//!   1000 + k       autotile k from the sidecar; its borders are computed
//!   -1             empty (upper layer only)
//!
//! VRAM is budgeted PER SCENE, because that is the SNES reality: one
//! scene can only show 512 8x8 chars and 8 palettes of 15 colours.
//! datagen compiles a "gfx set" for each scene: only the tiles actually
//! used, chars deduplicated (char 0 reserved transparent), several
//! palettes spread per char (bits 10-12 of the BG entries), and a
//! priority table. Scenes with identical content share one set.
//! Source PNGs may therefore hold up to 256 colours (RM2003 chipsets):
//! the limits apply to the scene, not to the tileset.
//!
//! Passability (sidecar assets/<stem>.json): `solid` lists blocking
//! logical ids, `above` lists the ones drawn over the hero on the upper
//! layer, never blocking. The binary collision layer is DERIVED: a
//! present, non-above upper tile wins (bridges), otherwise the lower one.

use crate::gfx::IndexedImage;
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::Path;

pub const AUTO_BASE: i32 = 1000;
pub const EMPTY: i32 = -1;

/// Optional sidecar `assets/<stem>.json`.
#[derive(Deserialize, Default)]
pub struct TilesetMeta {
    /// 48x64 autotile PNGs (3x4 tiles, RPG Maker 2003 format).
    #[serde(default)]
    pub autotiles: Vec<String>,
    /// Blocking logical ids.
    #[serde(default)]
    pub solid: Vec<i32>,
    /// Above-the-hero logical ids: drawn over him, walkable.
    #[serde(default)]
    pub above: Vec<i32>,
    /// Editor hint (palette per layer); datagen ignores it.
    #[serde(default)]
    #[allow(dead_code)]
    pub upper_start: Option<u32>,
    /// CLOSED sides per logical id (key = the id as a JSON string):
    /// bits 1 down, 2 up, 4 left, 8 right (1 << DIR_*).
    #[serde(default)]
    pub dirs: std::collections::HashMap<String, u8>,
    /// ANIMATED tile sequences (grid tiles only): the first tile is the
    /// one posed on the maps, the rest are its frames — 2 to 4 tiles,
    /// mode "123" or "1232".
    #[serde(default)]
    pub anims: Vec<AnimDef>,
}

#[derive(Deserialize)]
pub struct AnimDef {
    pub tiles: Vec<i32>,
    #[serde(default = "default_anim_mode")]
    pub mode: String,
    #[serde(default = "default_anim_speed")]
    pub speed: u8,
}

fn default_anim_mode() -> String {
    "1232".to_string()
}

fn default_anim_speed() -> u8 {
    20
}

pub struct SourceTileset {
    pub img: IndexedImage,
    pub autos: Vec<IndexedImage>,
    pub meta: TilesetMeta,
    /// Number of tiles in the PNG grid.
    pub count: u16,
}

/// The compiled graphics of a scene, possibly shared by identical scenes.
pub struct GfxSet {
    pub charset: Vec<u8>,
    pub table: Vec<u16>,
    /// One byte per local id: 1 means above (BG1 priority on the upper layer).
    pub prio: Vec<u8>,
    /// BG CGRAM: 8 palettes x 16 colours, entry 0 transparent.
    pub pal: Vec<u16>,
    pub blank_id: u8,
    local_of: BTreeMap<TileKey, u8>,
    /// The quarters actually compiled, after any quantisation — the
    /// reference the self-check compares against.
    quarters: Vec<Quarter>,
}

impl GfxSet {
    /// Table entries (char | pal<<10 | prio) for the 4 quarters of a GRID
    /// tile; None when the tile is not compiled into this scene.
    pub fn plain_entries(&self, id: u16) -> Option<[u16; 4]> {
        let &local = self.local_of.get(&TileKey::Grid(id))?;
        let i = local as usize * 4;
        Some([self.table[i], self.table[i + 1], self.table[i + 2], self.table[i + 3]])
    }

    /// Is char c shared by a tile OUTSIDE the given set? Animating a
    /// shared char would animate the other tile too. Sharing BETWEEN the
    /// frames of one sequence is legitimate — their unchanged quarters
    /// point at the same chars.
    pub fn char_shared_outside(&self, c: u16, allowed: &[u8]) -> bool {
        for (i, e) in self.table.iter().enumerate() {
            if (e & 0x3FF) == c && !allowed.contains(&((i / 4) as u8)) {
                return true;
            }
        }
        false
    }

    /// Local id of a grid tile.
    pub fn plain_local(&self, id: u16) -> Option<u8> {
        self.local_of.get(&TileKey::Grid(id)).copied()
    }
}

/// A scene's binary grids, row-major, w*h bytes each.
pub struct SceneGrids {
    pub lower: Vec<u8>,
    pub upper: Vec<u8>,
    pub collision: Vec<u8>,
}

/// A tile referenced by a scene, in source ids.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum TileKey {
    Grid(u16),
    Var(usize, u16), // (autotile k, clé de variante)
}

pub fn load_source(proj_dir: &Path, png_rel: &str) -> Result<SourceTileset> {
    let img = crate::gfx::load_indexed_png(&proj_dir.join(png_rel))?;
    if img.width == 0 || img.height == 0 || img.width % 16 != 0 || img.height % 16 != 0 {
        bail!("tileset {} : dimensions multiples de 16 requises", png_rel);
    }
    let count = (img.width / 16) * (img.height / 16);
    if count > 999 {
        bail!("tileset {} : {} tiles > 999 (ids logiques)", png_rel, count);
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

    // Warn once per tileset about tiles whose 8x8 block exceeds 15
    // colours: they will be quantised by merging the closest pair.
    let mut over: BTreeSet<u16> = BTreeSet::new();
    let cols_grid = src.img.width / 16;
    for by in 0..src.img.height / 8 {
        for bx in 0..src.img.width / 8 {
            let mut cols: BTreeSet<u16> = BTreeSet::new();
            for y in 0..8 {
                for x in 0..8 {
                    let i = src.img.pixels[(by * 8 + y) * src.img.width + bx * 8 + x];
                    if i != 0 {
                        cols.insert(src.img.palette[i as usize]);
                    }
                }
            }
            if cols.len() > 15 {
                over.insert(((by / 2) * cols_grid + bx / 2) as u16);
            }
        }
    }
    if !over.is_empty() {
        println!(
            "  attention : {} — tiles {:?} ont un bloc 8x8 a plus de 15 \
             couleurs (limite SNES), fusion automatique des plus proches",
            png_rel,
            over.iter().collect::<Vec<_>>()
        );
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
    /// Closed sides of a logical id — the high nibble of the collision byte.
    fn closed_sides(&self, id: i32) -> u8 {
        if id == EMPTY {
            return 0;
        }
        self.meta.dirs.get(&id.to_string()).copied().unwrap_or(0) & 0x0F
    }
}

/* --- Autotiles: the RM2003 border algorithm -------------------------------
 * Each 8x8 quarter of a tile picks its piece from its neighbours of the
 * SAME autotile (a map edge counts as the same). Pieces: 0 outer corner,
 * 1 horizontal edge, 2 vertical edge, 3 inner corner, 4 centre. The 3x4
 * template: (0,0) preview islet, (1,0) unused, (2,0) inner corners,
 * rows 1-3 = the 9-slice block. */

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

/// Position (col, row) of piece p in the template, for quarter (qx, qy).
/// RM2003 template: (0,0) island, (1,0) unused, (2,0) inner corners,
/// rows 1-3 the 9-slice block.
fn piece_pos(p: u16, qx: usize, qy: usize) -> (usize, usize) {
    let cx = if qx == 1 { 2 } else { 0 };
    let ry = if qy == 1 { 3 } else { 1 };
    match p {
        0 => (cx, ry),
        1 => (1, ry),
        2 => (cx, 2),
        3 => (2, 0),
        4 => (1, 2),
        _ => unreachable!(),
    }
}

/// Variant key: the piece of each quarter (TL,TR,BL,BR), base-5 encoded.
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

/// Variant key of cell (x,y) of a logical grid; off-map counts as same.
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

fn key_of_cell(grid: &[Vec<i32>], x: usize, y: usize, w: usize, h: usize) -> Option<TileKey> {
    let id = grid[y][x];
    if id == EMPTY {
        None
    } else if id >= AUTO_BASE {
        Some(TileKey::Var((id - AUTO_BASE) as usize, cell_key(grid, x, y, w, h)))
    } else {
        Some(TileKey::Grid(id as u16))
    }
}

/* --- Packing colour sets into palettes of 15 ------------------------------
 * Two families of deterministic heuristics: agglomerative merging (by
 * maximum overlap, or by smallest union) and best-fit decreasing. Ties
 * are broken by increasing index. */

fn pack_agglo(mut clusters: Vec<BTreeSet<u16>>, by_union: bool) -> Vec<BTreeSet<u16>> {
    loop {
        let mut best: Option<(i64, usize, usize)> = None; // (score, i, j)
        for i in 0..clusters.len() {
            for j in i + 1..clusters.len() {
                let inter = clusters[i].intersection(&clusters[j]).count() as i64;
                let union = clusters[i].len() as i64 + clusters[j].len() as i64 - inter;
                if union > 15 {
                    continue;
                }
                let score = if by_union {
                    -(union * 100) + inter
                } else {
                    inter * 100 - union
                };
                if best.map_or(true, |(s, _, _)| score > s) {
                    best = Some((score, i, j));
                }
            }
        }
        match best {
            Some((_, i, j)) => {
                let merged: BTreeSet<u16> =
                    clusters[i].union(&clusters[j]).copied().collect();
                clusters.remove(j);
                clusters[i] = merged;
            }
            None => break,
        }
    }
    clusters
}

fn pack_bfd(sets: &[BTreeSet<u16>]) -> Vec<BTreeSet<u16>> {
    let mut sorted = sets.to_vec();
    sorted.sort_by(|a, b| b.len().cmp(&a.len()).then_with(|| a.cmp(b)));
    let mut clusters: Vec<BTreeSet<u16>> = Vec::new();
    for s in &sorted {
        let mut best: Option<(usize, usize)> = None; // (croissance, idx)
        for (i, c) in clusters.iter().enumerate() {
            let grow = s.difference(c).count();
            if c.len() + grow <= 15 && best.map_or(true, |(g, _)| grow < g) {
                best = Some((grow, i));
            }
        }
        match best {
            Some((_, i)) => clusters[i].extend(s.iter().copied()),
            None => clusters.push(s.clone()),
        }
    }
    clusters
}

/// Exact solver (bounded backtracking): finds a split into `max_pal`
/// palettes if one exists. Sets are sorted most-constrained first, with
/// symmetry pruning (identical clusters) and a node budget so it stays
/// instantaneous.
fn pack_exact(sets: &[BTreeSet<u16>], max_pal: usize) -> Option<Vec<BTreeSet<u16>>> {
    let mut sorted = sets.to_vec();
    sorted.sort_by(|a, b| b.len().cmp(&a.len()).then_with(|| a.cmp(b)));

    fn rec(
        idx: usize,
        clusters: &mut Vec<BTreeSet<u16>>,
        sets: &[BTreeSet<u16>],
        max_pal: usize,
        nodes: &mut u32,
    ) -> bool {
        if idx == sets.len() {
            return true;
        }
        if *nodes == 0 {
            return false;
        }
        *nodes -= 1;
        let s = sets[idx].clone();
        let mut tried: Vec<BTreeSet<u16>> = Vec::new();
        for i in 0..clusters.len() {
            let grow = s.difference(&clusters[i]).count();
            if clusters[i].len() + grow > 15 || tried.contains(&clusters[i]) {
                continue;
            }
            tried.push(clusters[i].clone());
            let saved = clusters[i].clone();
            clusters[i].extend(s.iter().copied());
            if rec(idx + 1, clusters, sets, max_pal, nodes) {
                return true;
            }
            clusters[i] = saved;
        }
        if clusters.len() < max_pal {
            clusters.push(s.clone());
            if rec(idx + 1, clusters, sets, max_pal, nodes) {
                return true;
            }
            clusters.pop();
        }
        false
    }

    let mut clusters: Vec<BTreeSet<u16>> = Vec::new();
    let mut nodes: u32 = 2_000_000;
    if rec(0, &mut clusters, &sorted, max_pal, &mut nodes) {
        Some(clusters)
    } else {
        None
    }
}

/// Groups maximal sets by host cluster (the first superset) and
/// recomputes the effective unions.
fn regroup(
    sets: &[BTreeSet<u16>],
    clusters: &[BTreeSet<u16>],
) -> (Vec<Vec<usize>>, Vec<BTreeSet<u16>>) {
    let mut groups: Vec<Vec<usize>> = vec![Vec::new(); clusters.len()];
    for (si, s) in sets.iter().enumerate() {
        if let Some(ci) = clusters.iter().position(|c| s.is_subset(c)) {
            groups[ci].push(si);
        }
    }
    let mut out_g = Vec::new();
    let mut out_u = Vec::new();
    for g in groups {
        if g.is_empty() {
            continue;
        }
        let u: BTreeSet<u16> = g.iter().flat_map(|&si| sets[si].iter().copied()).collect();
        out_g.push(g);
        out_u.push(u);
    }
    (out_g, out_u)
}

/// Tries to dissolve ONE cluster — the smallest possible — by
/// redistributing its sets into the others. True if one disappeared.
fn reduce_pass(
    groups: &mut Vec<Vec<usize>>,
    unions: &mut Vec<BTreeSet<u16>>,
    sets: &[BTreeSet<u16>],
) -> bool {
    let mut order: Vec<usize> = (0..groups.len()).collect();
    order.sort_by_key(|&i| (unions[i].len(), i));
    for &ci in &order {
        let mut t_groups = groups.clone();
        let mut t_unions = unions.clone();
        let members = t_groups[ci].clone();
        let mut ok = true;
        for &si in &members {
            let mut host: Option<(usize, usize)> = None; // (croissance, idx)
            for i in 0..t_unions.len() {
                if i == ci {
                    continue;
                }
                let grow = sets[si].difference(&t_unions[i]).count();
                if t_unions[i].len() + grow <= 15 && host.map_or(true, |(g, _)| grow < g) {
                    host = Some((grow, i));
                }
            }
            match host {
                Some((_, i)) => {
                    t_unions[i].extend(sets[si].iter().copied());
                    t_groups[i].push(si);
                }
                None => {
                    ok = false;
                    break;
                }
            }
        }
        if ok {
            t_groups.remove(ci);
            t_unions.remove(ci);
            *groups = t_groups;
            *unions = t_unions;
            return true;
        }
    }
    false
}

/* --- Per-scene compilation ------------------------------------------------
 * An 8x8 quarter in source pixels: None = transparent (index 0),
 * Some(bgr555). The 4bpp encoding depends on the palette assigned to the
 * char: extract first, spread over <= 8 palettes of 15 colours, encode
 * afterwards. */

type Quarter = [[Option<u16>; 8]; 8];

fn extract_quarter(img: &IndexedImage, ox: usize, oy: usize) -> Quarter {
    let mut q = [[None; 8]; 8];
    for (y, row) in q.iter_mut().enumerate() {
        for (x, px) in row.iter_mut().enumerate() {
            let idx = img.pixels[(oy + y) * img.width + ox + x] as usize;
            if idx != 0 {
                *px = Some(img.palette[idx]);
            }
        }
    }
    quantize_quarter(&mut q);
    q
}

/// Distance between two BGR555 colours: squared per-channel differences.
pub(crate) fn dist555(a: u16, b: u16) -> u32 {
    let d = |x: u16, y: u16| {
        let v = (x as i32) - (y as i32);
        (v * v) as u32
    };
    d(a & 31, b & 31) + d((a >> 5) & 31, (b >> 5) & 31) + d((a >> 10) & 31, (b >> 10) & 31)
}

/// One merge step: the block's two closest colours are conflated, the
/// rarer taking the other's value, deterministically. False when the
/// block has fewer than 2 colours.
fn quantize_step(q: &mut Quarter) -> bool {
    let mut counts: BTreeMap<u16, u32> = BTreeMap::new();
    for c in q.iter().flatten().flatten() {
        *counts.entry(*c).or_insert(0) += 1;
    }
    if counts.len() < 2 {
        return false;
    }
    let cols: Vec<u16> = counts.keys().copied().collect();
    let mut best: Option<(u32, u16, u16)> = None; // (dist, victime, cible)
    for i in 0..cols.len() {
        for j in i + 1..cols.len() {
            let (a, b) = (cols[i], cols[j]);
            // victim: the rarer one; on a tie, the larger value
            let (from, to) = if (counts[&a], b) < (counts[&b], a) {
                (a, b)
            } else {
                (b, a)
            };
            let cand = (dist555(a, b), from, to);
            if best.map_or(true, |v| cand < v) {
                best = Some(cand);
            }
        }
    }
    let (_, from, to) = best.unwrap();
    for row in q.iter_mut() {
        for px in row.iter_mut() {
            if *px == Some(from) {
                *px = Some(to);
            }
        }
    }
    true
}

/// An 8x8 SNES block holds at most 15 colours. Past that (RM2003
/// chipsets) the closest colours are merged until it fits. Applied at
/// EXTRACTION, so compilation and self-check see the same block.
fn quantize_quarter(q: &mut Quarter) {
    loop {
        let n: BTreeSet<u16> = q.iter().flatten().flatten().copied().collect();
        if n.len() <= 15 || !quantize_step(q) {
            return;
        }
    }
}

/// The 4 quarters (TL,TR,BL,BR) of a referenced tile.
fn tile_quarters(src: &SourceTileset, key: TileKey) -> Result<[Quarter; 4]> {
    Ok(match key {
        TileKey::Grid(t) => {
            let cols = src.img.width / 16;
            let (ox, oy) = ((t as usize % cols) * 16, (t as usize / cols) * 16);
            [
                extract_quarter(&src.img, ox, oy),
                extract_quarter(&src.img, ox + 8, oy),
                extract_quarter(&src.img, ox, oy + 8),
                extract_quarter(&src.img, ox + 8, oy + 8),
            ]
        }
        TileKey::Var(k, vkey) => {
            let auto = src
                .autos
                .get(k)
                .with_context(|| format!("autotile {} inconnu dans le sidecar", k))?;
            let pieces = [vkey / 125, (vkey / 25) % 5, (vkey / 5) % 5, vkey % 5];
            let mut out = [[[None; 8]; 8]; 4];
            for (q, &p) in pieces.iter().enumerate() {
                let (qx, qy) = (q & 1, q >> 1);
                let (col, row) = piece_pos(p, qx, qy);
                out[q] = extract_quarter(auto, col * 16 + qx * 8, row * 16 + qy * 8);
            }
            out
        }
    })
}

/// A world map's blocks, resolved to pixels, plus the map's index into
/// them. `pixels` is BGR555, 0 meaning the tileset's transparent index —
/// which is also the plane's reserved colour 0.
pub struct ComposedBlocks {
    pub pixels: Vec<u16>,
    pub width: usize,
    pub height: usize,
    /// One block index per scene cell, row-major.
    pub map: Vec<u8>,
    /// Distinct blocks composed, block 0 (blank) included.
    pub count: usize,
}

/// Blocks per row of the composed sheet — layout only, nothing downstream
/// depends on it.
const COMPOSE_COLS: usize = 16;

impl SourceTileset {
    /// Composes the 16x16 blocks a map ACTUALLY paints into one sheet,
    /// autotile variants resolved, and returns the map's index into it.
    ///
    /// This exists for the Mode 7 world map, which needs PIXELS where the
    /// ordinary path needs logical ids. An autotile is not a block in the
    /// chipset: it is a block computed from its neighbours, so ids 1000+k
    /// have no pixels of their own and the plane has nowhere to compute
    /// them at run time. Resolving them here is the same `key_of_cell` /
    /// `tile_quarters` pair `compile_scene` uses, so a world map and an
    /// ordinary scene painted identically produce the same picture.
    ///
    /// Only the LOWER layer: Mode 7 has one plane, and a world map with
    /// anything painted above is refused earlier (`project.rs`).
    pub fn compose_blocks(&self, name: &str, lower: &[Vec<i32>]) -> Result<ComposedBlocks> {
        let h = lower.len();
        let w = if h > 0 { lower[0].len() } else { 0 };

        // Block 0 is blank, so an EMPTY cell has somewhere to point.
        let mut order: Vec<TileKey> = Vec::new();
        let mut index: BTreeMap<TileKey, usize> = BTreeMap::new();
        let mut map: Vec<u8> = Vec::with_capacity(w * h);
        for y in 0..h {
            for x in 0..w {
                match key_of_cell(lower, x, y, w, h) {
                    None => map.push(0),
                    Some(k) => {
                        let next = order.len() + 1;
                        let id = *index.entry(k).or_insert(next);
                        if id == next {
                            order.push(k);
                        }
                        if id > 255 {
                            bail!(
                                "carte du monde '{}' : plus de 255 blocs distincts \
                                 (autotiles comptees par variante) — le plan Mode 7 \
                                 n'en adresse pas davantage",
                                name
                            );
                        }
                        map.push(id as u8);
                    }
                }
            }
        }

        let count = order.len() + 1;
        let rows = (count + COMPOSE_COLS - 1) / COMPOSE_COLS;
        let (sw, sh) = (COMPOSE_COLS * 16, rows * 16);
        let mut pixels = vec![0u16; sw * sh];
        for (i, &key) in order.iter().enumerate() {
            let b = i + 1; /* block 0 stays blank */
            let (ox, oy) = ((b % COMPOSE_COLS) * 16, (b / COMPOSE_COLS) * 16);
            let quarters = tile_quarters(self, key)?;
            for (q, quarter) in quarters.iter().enumerate() {
                let (qx, qy) = (ox + (q & 1) * 8, oy + (q >> 1) * 8);
                for (y, row) in quarter.iter().enumerate() {
                    for (x, px) in row.iter().enumerate() {
                        pixels[(qy + y) * sw + qx + x] = px.unwrap_or(0);
                    }
                }
            }
        }
        Ok(ComposedBlocks { pixels, width: sw, height: sh, map, count })
    }

    /// Compiles a scene's gfx set: only the tiles used by the two logical
    /// layers. PER-SCENE limits: 254 local ids, 512 chars, 8 palettes of
    /// 15 colours.
    pub fn compile_scene(
        &self,
        name: &str,
        lower: &[Vec<i32>],
        upper: &[Vec<i32>],
    ) -> Result<GfxSet> {
        let h = lower.len();
        let w = if h > 0 { lower[0].len() } else { 0 };

        // 1. tiles used, in deterministic order (BTreeSet)
        let mut used: BTreeSet<TileKey> = BTreeSet::new();
        for grid in [lower, upper] {
            for y in 0..h {
                for x in 0..w {
                    if let Some(k) = key_of_cell(grid, x, y, w, h) {
                        used.insert(k);
                    }
                }
            }
        }
        // The FRAMES of animated tiles join the charset as soon as their
        // base tile is posed: their chars are the ROM source for the
        // tileanim module, and are never referenced by the map.
        for a in &self.meta.anims {
            if a.tiles.first().map_or(false, |&b| {
                b >= 0 && used.contains(&TileKey::Grid(b as u16))
            }) {
                for &f in &a.tiles[1..] {
                    if f >= 0 && f < AUTO_BASE {
                        used.insert(TileKey::Grid(f as u16));
                    }
                }
            }
        }
        let locals: Vec<TileKey> = used.iter().copied().collect();
        if locals.len() > 254 {
            bail!("scene '{}' : {} tiles distinctes > 254", name, locals.len());
        }

        // 2. quarters and colour sets
        let colorset = |q: &Quarter| -> BTreeSet<u16> {
            q.iter().flatten().flatten().copied().collect()
        };
        let mut quarters: Vec<Quarter> = Vec::with_capacity(locals.len() * 4);
        for &key in &locals {
            // blocks over 15 colours are quantised at extraction
            quarters.extend_from_slice(&tile_quarters(self, key)?);
        }

        // 3. Pack into <= 8 palettes of 15: bin-packing under the
        // constraint that each colour set fits whole in one palette.
        // Strategy: several deterministic greedy passes, a reduction pass,
        // then the exact solver. If the scene is TRULY too rich, the
        // closest colours of the heaviest blocks are merged one notch and
        // we try again — graceful degradation, never a failure, the way
        // period SNES pipelines did it.
        let mut squeezed = 0u32;
        let mut clusters: Vec<BTreeSet<u16>>;
        loop {
            let mut uniq: Vec<BTreeSet<u16>> = quarters.iter().map(colorset).collect();
            uniq.sort_by(|a, b| b.len().cmp(&a.len()).then_with(|| a.cmp(b)));
            uniq.dedup();
            // only MAXIMAL sets constrain; subsets follow their superset
            let mut max_sets: Vec<BTreeSet<u16>> = Vec::new();
            'outer: for s in &uniq {
                for o in &uniq {
                    if o.len() > s.len() && s.is_subset(o) {
                        continue 'outer;
                    }
                }
                max_sets.push(s.clone());
            }
            // subsets sometimes act as "bridges" for agglomerative
            // merging, so each strategy is tried with AND without them
            let mut best: Option<Vec<BTreeSet<u16>>> = None;
            for cand in [
                pack_agglo(uniq.clone(), false),
                pack_agglo(uniq.clone(), true),
                pack_agglo(max_sets.clone(), false),
                pack_agglo(max_sets.clone(), true),
                pack_bfd(&uniq),
                pack_bfd(&max_sets),
            ] {
                let (mut groups, mut unions) = regroup(&max_sets, &cand);
                while unions.len() > 8 && reduce_pass(&mut groups, &mut unions, &max_sets) {}
                if best.as_ref().map_or(true, |c| unions.len() < c.len()) {
                    best = Some(unions);
                }
            }
            // Feasible: <= 8 palettes, and at 8 the smallest must fit in
            // 12 colours (CGRAM slots 16-19 are reserved for the textbox)
            let feasible = |c: &Vec<BTreeSet<u16>>| {
                c.len() <= 7
                    || (c.len() == 8
                        && c.iter().map(|s| s.len()).min().unwrap_or(0) <= 12)
            };
            let mut c = best.unwrap_or_default();
            if !feasible(&c) {
                if let Some(e) = pack_exact(&max_sets, 7) {
                    c = e;
                }
            }
            if !feasible(&c) {
                if let Some(e) = pack_exact(&max_sets, 8) {
                    if feasible(&e) {
                        c = e;
                    }
                }
            }
            if feasible(&c) {
                clusters = c;
                break;
            }
            // too rich: tighten the heaviest blocks by one notch
            let maxlen = quarters.iter().map(|q| colorset(q).len()).max().unwrap_or(0);
            if maxlen <= 2 {
                bail!("scene '{}' : empaquetage de palettes impossible (bug datagen)", name);
            }
            for q in quarters.iter_mut() {
                if colorset(q).len() == maxlen && quantize_step(q) {
                    squeezed += 1;
                }
            }
        }
        if squeezed > 0 {
            println!(
                "  attention : scene '{}' — trop de couleurs pour les 8 palettes \
                 de la SNES, {} fusion(s) de couleurs tres proches appliquee(s) \
                 sur les tiles les plus riches",
                name, squeezed
            );
        }
        clusters.sort(); // ordre stable
        // Hardware palettes: CGRAM 16-19 (palette 1, indices 0-3) is
        // RESERVED for the textbox font (BG3 2bpp, spec §4). With <= 7
        // clusters palette 1 goes unused; at 8, the smallest cluster
        // (<= 12 colours) lodges there, its colours placed at indices
        // 4-15 (CGRAM 20-31).
        let hw_free: [u8; 7] = [0, 2, 3, 4, 5, 6, 7];
        let mut hw: Vec<u8> = vec![0; clusters.len()];
        if clusters.len() <= 7 {
            for (i, h) in hw.iter_mut().enumerate() {
                *h = hw_free[i];
            }
        } else {
            let small = (0..clusters.len())
                .min_by_key(|&i| (clusters[i].len(), i))
                .unwrap();
            if clusters[small].len() > 12 {
                bail!(
                    "scene '{}' : 8 palettes de plus de 12 couleurs — \
                     impossible de reserver les slots CGRAM 16-19 de la \
                     textbox (reduire les couleurs de la scene)",
                    name
                );
            }
            let mut next = 0;
            for (i, h) in hw.iter_mut().enumerate() {
                if i == small {
                    *h = 1;
                } else {
                    *h = hw_free[next];
                    next += 1;
                }
            }
        }
        let base = |h: u8| -> u8 { if h == 1 { 4 } else { 1 } };

        let palettes: Vec<Vec<u16>> =
            clusters.iter().map(|c| c.iter().copied().collect()).collect();
        let mut assign: HashMap<Vec<u16>, u8> = HashMap::new();
        for q in &quarters {
            let set = colorset(q);
            let key: Vec<u16> = set.iter().copied().collect();
            if assign.contains_key(&key) {
                continue;
            }
            let p = clusters
                .iter()
                .position(|c| set.is_subset(c))
                .context("cluster de palette introuvable (bug datagen)")?;
            assign.insert(key, p as u8);
        }

        // 4. 4bpp encoding, char dedup, metatile table
        let mut charset: Vec<u8> = vec![0; 32]; // char 0 : transparent réservé
        let mut seen: HashMap<[u8; 32], u16> = HashMap::new();
        seen.insert([0u8; 32], 0);
        let mut table: Vec<u16> = Vec::new();
        let mut local_of: BTreeMap<TileKey, u8> = BTreeMap::new();

        for (i, &key) in locals.iter().enumerate() {
            local_of.insert(key, i as u8);
            for q in &quarters[i * 4..i * 4 + 4] {
                let set: Vec<u16> = colorset(q).iter().copied().collect();
                let ci = *assign.get(&set).unwrap() as usize;
                let h = hw[ci];
                let b = base(h);
                let pal = &palettes[ci];
                let mut ch = [0u8; 32];
                for y in 0..8 {
                    for x in 0..8 {
                        let c = match q[y][x] {
                            None => 0u8,
                            Some(col) => {
                                b + pal.iter().position(|&v| v == col).unwrap() as u8
                            }
                        };
                        let bit = 0x80u8 >> x;
                        if c & 1 != 0 { ch[y * 2] |= bit; }
                        if c & 2 != 0 { ch[y * 2 + 1] |= bit; }
                        if c & 4 != 0 { ch[16 + y * 2] |= bit; }
                        if c & 8 != 0 { ch[16 + y * 2 + 1] |= bit; }
                    }
                }
                let next = (charset.len() / 32) as u16;
                let id = *seen.entry(ch).or_insert_with(|| {
                    charset.extend_from_slice(&ch);
                    next
                });
                table.push(id | ((h as u16) << 10));
            }
        }

        // transparent metatile (local id = last)
        let blank_id = (table.len() / 4) as u8;
        table.extend_from_slice(&[0, 0, 0, 0]);

        if charset.len() / 32 > 512 {
            bail!(
                "scene '{}' : {} chars 8x8 uniques > 512 (VRAM)",
                name,
                charset.len() / 32
            );
        }

        // 5. priorities and the 8x16 CGRAM
        let mut prio: Vec<u8> = locals
            .iter()
            .map(|&key| {
                let id = match key {
                    TileKey::Grid(t) => t as i32,
                    TileKey::Var(k, _) => AUTO_BASE + k as i32,
                };
                self.is_above(id) as u8
            })
            .collect();
        prio.push(0); // blank

        let mut pal = vec![0u16; 128];
        for (ci, cols) in palettes.iter().enumerate() {
            let h = hw[ci] as usize;
            let b = base(hw[ci]) as usize;
            for (i, &c) in cols.iter().enumerate() {
                pal[h * 16 + b + i] = c;
            }
        }

        Ok(GfxSet { charset, table, prio, pal, blank_id, local_of, quarters })
    }

    /// A scene's binary grids: the layers in local ids, plus collision
    /// derived from passability (a non-above upper tile wins).
    pub fn expand_scene(
        &self,
        gfx: &GfxSet,
        _name: &str,
        lower: &[Vec<i32>],
        upper: &[Vec<i32>],
    ) -> Result<SceneGrids> {
        let h = lower.len();
        let w = if h > 0 { lower[0].len() } else { 0 };

        let expand = |grid: &[Vec<i32>]| -> Result<Vec<u8>> {
            let mut out = Vec::with_capacity(w * h);
            for y in 0..h {
                for x in 0..w {
                    out.push(match key_of_cell(grid, x, y, w, h) {
                        // -1 is accepted on BOTH layers: an empty cell is
                        // a transparent char, and the backdrop colour
                        // (CGRAM 0, forced black by the engine) shows.
                        None => gfx.blank_id,
                        Some(key) => *gfx
                            .local_of
                            .get(&key)
                            .context("tile non compilee (bug datagen)")?,
                    });
                }
            }
            Ok(out)
        };

        let mut collision = Vec::with_capacity(w * h);
        for y in 0..h {
            for x in 0..w {
                let u = upper[y][x];
                let eff = if u != EMPTY && !self.is_above(u) { u } else { lower[y][x] };
                let solid = self.is_solid(eff);
                // closed sides (high nibble); pointless on solid tiles
                let sides = if solid { 0 } else { self.closed_sides(eff) };
                collision.push(solid as u8 | (sides << 4));
            }
        }

        Ok(SceneGrids {
            lower: expand(lower)?,
            upper: expand(upper)?,
            collision,
        })
    }
}

impl GfxSet {
    /// Self-check: decode every compiled tile (4bpp char, palette bits,
    /// CGRAM) and compare it pixel by pixel against the compiled quarters
    /// (the source after any quantisation). Any divergence is a datagen
    /// bug — we refuse to emit wrong data.
    pub fn verify(&self, name: &str) -> Result<()> {
        for local in 0..self.quarters.len() / 4 {
            for q in 0..4 {
                let quarter = &self.quarters[local * 4 + q];
                let entry = self.table[local * 4 + q];
                let char_id = (entry & 0x3FF) as usize;
                let pal = ((entry >> 10) & 7) as usize;
                let ch = &self.charset[char_id * 32..char_id * 32 + 32];
                for y in 0..8 {
                    for x in 0..8 {
                        let bit = 7 - x;
                        let idx = ((ch[y * 2] >> bit) & 1)
                            | (((ch[y * 2 + 1] >> bit) & 1) << 1)
                            | (((ch[16 + y * 2] >> bit) & 1) << 2)
                            | (((ch[16 + y * 2 + 1] >> bit) & 1) << 3);
                        let got = if idx == 0 {
                            None
                        } else {
                            Some(self.pal[pal * 16 + idx as usize])
                        };
                        if got != quarter[y][x] {
                            bail!(
                                "verify: scene '{}' tile locale {} quart {} pixel \
                                 ({},{}) : attendu {:?}, obtenu {:?} (bug datagen)",
                                name, local, q, x, y, quarter[y][x], got
                            );
                        }
                    }
                }
            }
        }
        Ok(())
    }
}

impl GfxSet {
    /// Fingerprint, so identical scenes share one set.
    pub fn fingerprint(&self) -> Vec<u8> {
        let mut v = self.charset.clone();
        for &e in &self.table {
            v.extend_from_slice(&e.to_le_bytes());
        }
        v.extend_from_slice(&self.prio);
        for &c in &self.pal {
            v.extend_from_slice(&c.to_le_bytes());
        }
        v
    }
}

#[cfg(test)]
mod compose_tests {
    use super::*;

    /// A sheet whose pixels are (tile index + 1) everywhere, so two grid
    /// tiles are never confused and colour 0 stays the transparent one.
    fn sheet(tiles: usize) -> IndexedImage {
        let w = tiles * 16;
        let mut pixels = vec![0u8; w * 16];
        for t in 0..tiles {
            for y in 0..16 {
                for x in 0..16 {
                    pixels[y * w + t * 16 + x] = (t + 1) as u8;
                }
            }
        }
        IndexedImage {
            width: w,
            height: 16,
            pixels,
            palette: (0..=tiles as u16).map(|i| i * 37 + 1).collect(),
            palette_rgb: Vec::new(),
        }
    }

    /// The RM2003 autotile sheet: 48x64, each of its twelve 16x16 pieces a
    /// different colour, so a variant's four quarters are identifiable.
    fn auto() -> IndexedImage {
        let mut pixels = vec![0u8; 48 * 64];
        for y in 0..64 {
            for x in 0..48 {
                pixels[y * 48 + x] = (1 + (y / 16) * 3 + x / 16) as u8;
            }
        }
        IndexedImage {
            width: 48,
            height: 64,
            pixels,
            palette: (0..=12u16).map(|i| i * 101 + 3).collect(),
            palette_rgb: Vec::new(),
        }
    }

    fn src(tiles: usize, autos: Vec<IndexedImage>) -> SourceTileset {
        SourceTileset {
            img: sheet(tiles),
            autos,
            meta: TilesetMeta::default(),
            count: tiles as u16,
        }
    }

    #[test]
    fn an_empty_cell_points_at_the_blank_block() {
        let s = src(2, Vec::new());
        let c = s.compose_blocks("m", &[vec![EMPTY, 0], vec![1, EMPTY]]).unwrap();
        assert_eq!(c.map[0], 0);
        assert_eq!(c.map[3], 0);
        assert_ne!(c.map[1], 0);
        // blank + two grid tiles
        assert_eq!(c.count, 3);
    }

    #[test]
    fn the_same_tile_twice_costs_one_block() {
        let s = src(2, Vec::new());
        let c = s.compose_blocks("m", &[vec![1, 1, 1], vec![1, 1, 1]]).unwrap();
        assert_eq!(c.count, 2); /* blank + the one tile */
        assert!(c.map.iter().all(|&b| b == 1));
    }

    /// The whole point of the exercise: id 1000+k has no pixels of its own,
    /// so a world map painted with an autotile must come out as several
    /// DIFFERENT blocks — the variants — not as one, and not as a failure.
    #[test]
    fn an_autotile_becomes_one_block_per_variant() {
        let s = src(1, vec![auto()]);
        // A 3x3 patch of autotile 0 INSIDE a grid tile: its centre is
        // surrounded, its edges and corners are not, so they cannot share
        // a variant. Surrounded it must be — a patch touching the map's
        // border would see the border as "same" and collapse to one
        // variant, which is correct and is why this grid is 5x5.
        let a = AUTO_BASE;
        let g = vec![
            vec![0, 0, 0, 0, 0],
            vec![0, a, a, a, 0],
            vec![0, a, a, a, 0],
            vec![0, a, a, a, 0],
            vec![0, 0, 0, 0, 0],
        ];
        let c = s.compose_blocks("m", &g).unwrap();
        // blank + the grid tile + corner / edge / centre variants
        assert!(c.count >= 5, "expected several variants, got {}", c.count);
        assert_ne!(c.map[6], c.map[12], "a corner and the centre must differ");
        assert!(c.map.iter().all(|&b| b != 0), "nothing here is empty");
    }

    #[test]
    fn an_autotile_and_a_grid_tile_do_not_share_a_block() {
        let s = src(1, vec![auto()]);
        let c = s.compose_blocks("m", &[vec![0, AUTO_BASE]]).unwrap();
        assert_ne!(c.map[0], c.map[1]);
    }
}
