//! tileset.rs — tilesets sources (grille + autotiles RM2003 + sidecar de
//! passabilité) et compilation des GFX PAR SCÈNE.
//!
//! Id logiques (JSON auteur) :
//!   0..count-1     tile de la grille PNG (rangée par rangée, max 999)
//!   1000 + k       autotile k du sidecar (les bordures sont calculées)
//!   -1             vide (couche supérieure uniquement)
//!
//! Depuis la Phase 5d, la VRAM est budgétée PAR SCÈNE (réalité SNES : une
//! scène ne peut afficher que 512 chars 8x8 et 8 palettes de 15 couleurs).
//! datagen compile pour chaque scène un « gfx set » : uniquement les tiles
//! utilisées, chars dédupliqués (char 0 réservé transparent), palettes
//! multiples réparties par char (bits 10-12 des entrées BG), table de
//! priorités ☆. Les scènes au contenu identique partagent le même set.
//! Les PNG sources peuvent donc avoir jusqu'à 256 couleurs (chipsets
//! RM2003) : les limites s'appliquent à la scène, pas au tileset.
//!
//! Passabilité (sidecar assets/<stem>.json) : `solid` = ids logiques X,
//! `above` = ids ☆ (au-dessus du héros sur la couche sup, jamais
//! bloquants). La couche collision binaire est DÉRIVÉE : tile sup présente
//! et non-☆ → sa passabilité l'emporte (ponts), sinon la tile inférieure.

use crate::gfx::IndexedImage;
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet, HashMap};
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
    /// Indication éditeur (palette par couche) — ignorée par datagen
    #[serde(default)]
    #[allow(dead_code)]
    pub upper_start: Option<u32>,
    /// T1 — côtés FERMÉS par id logique (clé = id en chaîne JSON) :
    /// bits 1 bas, 2 haut, 4 gauche, 8 droite (1 << DIR_*)
    #[serde(default)]
    pub dirs: std::collections::HashMap<String, u8>,
    /// T1 — séquences de tiles ANIMÉES (tiles de grille uniquement) :
    /// la première tile est celle posée sur les maps, les suivantes
    /// sont ses frames (2-4 tiles, mode "123" ou "1232")
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
    /// Nombre de tiles de la grille PNG
    pub count: u16,
}

/// GFX compilés d'une scène (ou partagés par plusieurs scènes identiques)
pub struct GfxSet {
    pub charset: Vec<u8>,
    pub table: Vec<u16>,
    /// 1 octet par id local : 1 = ☆ (priorité BG1 sur la couche sup)
    pub prio: Vec<u8>,
    /// CGRAM BG : 8 palettes x 16 couleurs (entrée 0 transparente)
    pub pal: Vec<u16>,
    pub blank_id: u8,
    local_of: BTreeMap<TileKey, u8>,
    /// Quarts effectivement compilés (après quantifications) — référence
    /// de l'auto-contrôle
    quarters: Vec<Quarter>,
}

impl GfxSet {
    /// Entrées de table (char | pal<<10 | prio) des 4 quarts d'une tile
    /// de GRILLE — None si la tile n'est pas compilée dans cette scène
    pub fn plain_entries(&self, id: u16) -> Option<[u16; 4]> {
        let &local = self.local_of.get(&TileKey::Grid(id))?;
        let i = local as usize * 4;
        Some([self.table[i], self.table[i + 1], self.table[i + 2], self.table[i + 3]])
    }

    /// Le char c est-il partagé par une tile HORS de l'ensemble donné ?
    /// (dédup : animer un char partagé animerait aussi l'autre tile —
    /// le partage ENTRE les frames d'une même séquence est légitime,
    /// leurs quarts inchangés pointent les mêmes chars)
    pub fn char_shared_outside(&self, c: u16, allowed: &[u8]) -> bool {
        for (i, e) in self.table.iter().enumerate() {
            if (e & 0x3FF) == c && !allowed.contains(&((i / 4) as u8)) {
                return true;
            }
        }
        false
    }

    /// id local d'une tile de grille
    pub fn plain_local(&self, id: u16) -> Option<u8> {
        self.local_of.get(&TileKey::Grid(id)).copied()
    }
}

/// Grilles binaires d'une scène (row-major, w*h octets chacune)
pub struct SceneGrids {
    pub lower: Vec<u8>,
    pub upper: Vec<u8>,
    pub collision: Vec<u8>,
}

/// Tile référencée par une scène, en ids sources
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

    // Avertissement (une fois par tileset) : tiles dont un bloc 8x8 dépasse
    // 15 couleurs — elles seront quantifiées (fusion des plus proches)
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
    /// Côtés fermés d'un id logique (T1) — nibble haut de la collision
    fn closed_sides(&self, id: i32) -> u8 {
        if id == EMPTY {
            return 0;
        }
        self.meta.dirs.get(&id.to_string()).copied().unwrap_or(0) & 0x0F
    }
}

/* --- Autotiles : algorithme de bordure RM2003 -----------------------------
 * Chaque quart 8x8 d'une tile choisit sa pièce selon ses voisins de MÊME
 * autotile (bord de map = même). Pièces : 0 coin externe, 1 bord
 * horizontal, 2 bord vertical, 3 coin interne, 4 centre. Le gabarit 3x4 :
 * (0,0) îlot d'aperçu, (1,0) inutilisé, (2,0) coins internes, rangées 1-3 =
 * bloc 9-slice. */

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

/// Position (col,row) de la pièce p dans le gabarit, pour le quart (qx,qy).
/// Gabarit RM2003 : (0,0) îlot, (1,0) inutilisé, (2,0) coins internes,
/// rangées 1-3 = bloc 9-slice.
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

/// Clé de variante : pièce de chaque quart (TL,TR,BL,BR), encodée base 5
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

/* --- Empaquetage des jeux de couleurs en palettes de 15 -------------------
 * Deux familles d'heuristiques déterministes : fusion agglomérative (par
 * recouvrement maximal, ou par plus petite union) et best-fit décroissant.
 * Les égalités se départagent par indices croissants. */

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

/// Solveur exact (backtracking borné) : trouve une répartition en
/// `max_pal` palettes si elle existe. Jeux triés du plus contraint au
/// moins contraint ; élagage par symétrie (clusters identiques) et budget
/// de nœuds pour rester instantané.
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

/// Regroupe les jeux maximaux par cluster d'accueil (premier sur-ensemble)
/// et recalcule les unions effectives.
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

/// Tente de dissoudre UN cluster (le plus petit possible) en redistribuant
/// ses jeux dans les autres. Retourne true si un cluster a disparu.
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

/* --- Compilation par scène ------------------------------------------------
 * Quart 8x8 en pixels sources : None = transparent (index 0), Some(bgr555).
 * L'encodage 4bpp dépend de la palette attribuée au char : extraction
 * d'abord, répartition en <= 8 palettes de 15 couleurs, encodage ensuite. */

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

/// Distance entre deux couleurs BGR555 (carrés des écarts par canal)
pub(crate) fn dist555(a: u16, b: u16) -> u32 {
    let d = |x: u16, y: u16| {
        let v = (x as i32) - (y as i32);
        (v * v) as u32
    };
    d(a & 31, b & 31) + d((a >> 5) & 31, (b >> 5) & 31) + d((a >> 10) & 31, (b >> 10) & 31)
}

/// Une étape de fusion : les deux couleurs les plus proches du bloc sont
/// confondues (la moins fréquente prend la valeur de l'autre), de façon
/// déterministe. Retourne false si le bloc a moins de 2 couleurs.
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
            // victime = la moins fréquente (à égalité : la plus grande)
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

/// Un bloc 8x8 SNES a 15 couleurs max : au-delà (chipsets RM2003), fusion
/// des couleurs les plus proches jusqu'à passer sous la limite. Appliqué à
/// l'EXTRACTION : compilation et auto-contrôle voient le même bloc.
fn quantize_quarter(q: &mut Quarter) {
    loop {
        let n: BTreeSet<u16> = q.iter().flatten().flatten().copied().collect();
        if n.len() <= 15 || !quantize_step(q) {
            return;
        }
    }
}

/// Les 4 quarts (TL,TR,BL,BR) d'une tile référencée
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

impl SourceTileset {
    /// Compile le gfx set d'une scène : tiles utilisées par les deux
    /// couches logiques uniquement. Limites PAR SCÈNE : 254 ids locaux,
    /// 512 chars, 8 palettes de 15 couleurs.
    pub fn compile_scene(
        &self,
        name: &str,
        lower: &[Vec<i32>],
        upper: &[Vec<i32>],
    ) -> Result<GfxSet> {
        let h = lower.len();
        let w = if h > 0 { lower[0].len() } else { 0 };

        // 1. tiles utilisées, ordre déterministe (BTreeSet)
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
        // T1 : les FRAMES des tiles animées rejoignent le charset dès que
        // leur tile de base est posée — leurs chars servent de source ROM
        // au module tileanim (jamais référencés par la carte)
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

        // 2. quarts + jeux de couleurs
        let colorset = |q: &Quarter| -> BTreeSet<u16> {
            q.iter().flatten().flatten().copied().collect()
        };
        let mut quarters: Vec<Quarter> = Vec::with_capacity(locals.len() * 4);
        for &key in &locals {
            // les blocs > 15 couleurs sont quantifiés à l'extraction
            quarters.extend_from_slice(&tile_quarters(self, key)?);
        }

        // 3. répartition en palettes : jeux uniques triés (taille desc puis
        //    contenu), placement dans la première palette qui peut absorber
        // 3. Empaquetage en <= 8 palettes de 15 : bin-packing avec la
        // contrainte « chaque jeu de couleurs entier dans une palette ».
        // Stratégie : plusieurs gloutons déterministes + passe de réduction
        // + solveur exact ; si la scène est VRAIMENT trop riche, on fusionne
        // les couleurs les plus proches des blocs les plus chargés d'un cran
        // et on réessaie (dégradation douce, jamais d'échec) — comme les
        // pipelines SNES d'époque.
        let mut squeezed = 0u32;
        let mut clusters: Vec<BTreeSet<u16>>;
        loop {
            let mut uniq: Vec<BTreeSet<u16>> = quarters.iter().map(colorset).collect();
            uniq.sort_by(|a, b| b.len().cmp(&a.len()).then_with(|| a.cmp(b)));
            uniq.dedup();
            // seuls les jeux MAXIMAUX contraignent (les sous-ensembles
            // suivent leur sur-ensemble)
            let mut max_sets: Vec<BTreeSet<u16>> = Vec::new();
            'outer: for s in &uniq {
                for o in &uniq {
                    if o.len() > s.len() && s.is_subset(o) {
                        continue 'outer;
                    }
                }
                max_sets.push(s.clone());
            }
            // les sous-ensembles servent parfois de « ponts » à la fusion
            // agglomérative : chaque stratégie est essayée avec ET sans eux
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
            // Faisable : <= 8 palettes ET, si 8, la plus petite doit tenir
            // en 12 couleurs (slots CGRAM 16-19 réservés à la textbox)
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
            // trop riche : serre d'un cran les blocs les plus chargés
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
        // Palettes hardware : la CGRAM 16-19 (palette 1, indices 0-3) est
        // RÉSERVÉE à la fonte de la textbox (BG3 2bpp, spec §4). Tant qu'il
        // y a <= 7 clusters, la palette 1 n'est pas utilisée ; à 8, le plus
        // petit cluster (<= 12 couleurs) y loge, ses couleurs placées aux
        // indices 4-15 (CGRAM 20-31).
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

        // 4. encodage 4bpp + dédup chars + table de metatiles
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

        // metatile transparent (id local = dernier)
        let blank_id = (table.len() / 4) as u8;
        table.extend_from_slice(&[0, 0, 0, 0]);

        if charset.len() / 32 > 512 {
            bail!(
                "scene '{}' : {} chars 8x8 uniques > 512 (VRAM)",
                name,
                charset.len() / 32
            );
        }

        // 5. priorités ☆ + CGRAM 8x16
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

    /// Grilles binaires d'une scène : couches en ids locaux + collision
    /// dérivée de la passabilité (règle : la tile sup non-☆ l'emporte)
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
                        // S10 : -1 accepte sur les DEUX couches — cellule
                        // vide = char transparent, la couleur de fond
                        // (CGRAM 0, forcee noire par le moteur) se voit
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
                // T1 : côtés fermés (nibble haut) — inutiles sur du solide
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
    /// Auto-contrôle : décode chaque tile compilée (char 4bpp + bits de
    /// palette + CGRAM) et la compare pixel par pixel aux quarts compilés
    /// (source après quantifications éventuelles). Toute divergence est un
    /// bug datagen — on refuse d'émettre des données fausses.
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
    /// Empreinte pour partager un set entre scènes identiques
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
