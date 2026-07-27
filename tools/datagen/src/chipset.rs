//! chipset.rs — import d'un chipset RPG Maker 2003 (480x256, PNG indexé)
//! vers les assets d'un projet SNES Studio.
//!
//! Layout RM2003 (LCF) :
//!   x 0-95            eau/animations (3 frames par colonne de 16 px)
//!   x 96-191          12 autotiles de sol 48x64 (format gabarit natif)
//!   x 192-287         tiles couche basse 1 (6x16 = 96)
//!   x 288-383 y 0-127 tiles couche basse 2 (6x8 = 48)
//!   x 288-383 y 128+  tiles couche haute 1 (6x8 = 48)
//!   x 384-479         tiles couche haute 2 (6x16 = 96)
//!
//! Sorties dans <projet>/assets/ :
//!   <nom>.png         grille 6 colonnes : 144 tiles basses puis 144 hautes
//!   <nom>_water.png   autotile eau A converti (statique, frame 0)
//!   <nom>_a{k}.png    les 12 autotiles de sol (copie directe)
//!   <nom>.json        sidecar : autotiles + upper_start (144)
//! et ajoute le tileset à project.json. La couleur « transparente » du
//! chipset (fond de la première tile haute) devient l'index 0.

use crate::gfx;
use anyhow::{bail, Context, Result};
use std::path::Path;

const W: usize = 480;
const H: usize = 256;

/// Grille de travail : indices dans la palette de SORTIE (0 = transparent)
struct Sheet {
    px: Vec<u8>,
    pal: Vec<u8>, // triplets RGB
}

impl Sheet {
    fn get(&self, x: usize, y: usize) -> u8 {
        self.px[y * W + x]
    }
}

fn write_indexed_png(path: &Path, w: usize, h: usize, pixels: &[u8], pal: &[u8]) -> Result<()> {
    let file = std::fs::File::create(path)
        .with_context(|| format!("ecriture de {}", path.display()))?;
    let mut enc = png::Encoder::new(std::io::BufWriter::new(file), w as u32, h as u32);
    enc.set_color(png::ColorType::Indexed);
    enc.set_depth(png::BitDepth::Eight);
    enc.set_palette(pal.to_vec());
    let mut writer = enc.write_header()?;
    writer.write_image_data(pixels)?;
    println!("  {}", path.display());
    Ok(())
}

pub fn import(chipset: &Path, proj_dir: &Path, name: &str) -> Result<()> {
    if !name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_') {
        bail!("nom '{}' : a-z, 0-9, _ uniquement", name);
    }
    let img = gfx::load_indexed_png(chipset)?;
    if img.width != W || img.height != H {
        bail!(
            "{} : attendu un chipset RM2003 480x256 (recu {}x{})",
            chipset.display(),
            img.width,
            img.height
        );
    }

    // Couleur transparente = fond de la première tile de la couche haute
    // (convention RM2003 : cette tile est la tile vide). Elle passe à
    // l'index 0 par échange avec l'ancien index 0.
    let ti = img.pixels[129 * W + 289] as usize;
    let mut pal = img.palette_rgb.clone();
    pal.resize(256 * 3, 0);
    if ti != 0 {
        for c in 0..3 {
            pal.swap(c, ti * 3 + c);
        }
    }
    let px: Vec<u8> = img
        .pixels
        .iter()
        .map(|&p| {
            let p = p as usize;
            (if p == ti { 0 } else if p == 0 { ti } else { p }) as u8
        })
        .collect();
    let sheet = Sheet { px, pal };

    let assets = proj_dir.join("assets");
    std::fs::create_dir_all(&assets)?;

    // --- grille 6 colonnes : 144 basses puis 144 hautes ------------------
    let blocks: [(usize, usize, usize, usize); 4] = [
        (192, 0, 6, 16), // basses 1
        (288, 0, 6, 8),  // basses 2
        (288, 128, 6, 8), // hautes 1
        (384, 0, 6, 16), // hautes 2
    ];
    let mut tiles: Vec<[u8; 256]> = Vec::new();
    for &(bx, by, cols, rows) in &blocks {
        for r in 0..rows {
            for c in 0..cols {
                let mut t = [0u8; 256];
                for y in 0..16 {
                    for x in 0..16 {
                        t[y * 16 + x] = sheet.get(bx + c * 16 + x, by + r * 16 + y);
                    }
                }
                tiles.push(t);
            }
        }
    }
    let rows_out = tiles.len() / 6; // 48
    let mut grid = vec![0u8; 96 * rows_out * 16];
    for (i, t) in tiles.iter().enumerate() {
        let (gx, gy) = ((i % 6) * 16, (i / 6) * 16);
        for y in 0..16 {
            for x in 0..16 {
                grid[(gy + y) * 96 + gx + x] = t[y * 16 + x];
            }
        }
    }
    write_indexed_png(&assets.join(format!("{}.png", name)), 96, rows_out * 16, &grid, &sheet.pal)?;

    // --- 12 autotiles de sol : copie directe (format natif) --------------
    let ground: [(usize, usize); 12] = [
        (96, 0), (144, 0), (96, 64), (144, 64),
        (0, 128), (48, 128), (96, 128), (144, 128),
        (0, 192), (48, 192), (96, 192), (144, 192),
    ];
    let mut auto_paths: Vec<String> = Vec::new();
    let crop48x64 = |bx: usize, by: usize| -> Vec<u8> {
        let mut out = vec![0u8; 48 * 64];
        for y in 0..64 {
            for x in 0..48 {
                out[y * 48 + x] = sheet.get(bx + x, by + y);
            }
        }
        out
    };

    // Eau A (statique, frame 0) : synthèse du gabarit depuis la colonne
    // x0-15 (tile0 bords T+G+D, tile1 bords G+D+B, tile2 bord T, tile3
    // pleine eau). Bordures recomposées en bandes de 4 px sur la tile
    // pleine — approximation correcte pour les rives RM2003.
    {
        let tile = |ty: usize| -> [u8; 256] {
            let mut t = [0u8; 256];
            for y in 0..16 {
                for x in 0..16 {
                    t[y * 16 + x] = sheet.get(x, ty * 16 + y);
                }
            }
            t
        };
        let t0 = tile(0);
        let t1 = tile(1);
        let center = tile(3);
        // îlot : moitié haute de t0 + moitié basse de t1
        let mut island = [0u8; 256];
        island[..128].copy_from_slice(&t0[..128]);
        island[128..].copy_from_slice(&t1[128..]);

        let paste = |dst: &mut [u8; 256], sides: &[&str], corners: bool| {
            for y in 0..16 {
                for x in 0..16 {
                    let mut take = false;
                    for s in sides {
                        take |= match *s {
                            "top" => y < 4,
                            "bottom" => y >= 12,
                            "left" => x < 4,
                            "right" => x >= 12,
                            _ => false,
                        };
                    }
                    if corners {
                        take |= (x < 4 || x >= 12) && (y < 4 || y >= 12);
                    }
                    if take {
                        dst[y * 16 + x] = island[y * 16 + x];
                    }
                }
            }
        };
        let cell = |sides: &[&str], corners: bool| -> [u8; 256] {
            let mut c = center;
            paste(&mut c, sides, corners);
            c
        };
        let cells: [[u8; 256]; 12] = [
            island,                        // (0,0) îlot
            cell(&[], true),               // (1,0) coins internes
            center,                        // (2,0) inutilisé
            cell(&["top", "left"], false), cell(&["top"], false), cell(&["top", "right"], false),
            cell(&["left"], false),        center,                cell(&["right"], false),
            cell(&["bottom", "left"], false), cell(&["bottom"], false), cell(&["bottom", "right"], false),
        ];
        let mut out = vec![0u8; 48 * 64];
        for (i, c) in cells.iter().enumerate() {
            let (cx, cy) = ((i % 3) * 16, (i / 3) * 16);
            for y in 0..16 {
                for x in 0..16 {
                    out[(cy + y) * 48 + cx + x] = c[y * 16 + x];
                }
            }
        }
        let rel = format!("assets/{}_water.png", name);
        write_indexed_png(&assets.join(format!("{}_water.png", name)), 48, 64, &out, &sheet.pal)?;
        auto_paths.push(rel);
    }

    for (k, &(bx, by)) in ground.iter().enumerate() {
        let rel = format!("assets/{}_a{}.png", name, k);
        write_indexed_png(
            &assets.join(format!("{}_a{}.png", name, k)),
            48,
            64,
            &crop48x64(bx, by),
            &sheet.pal,
        )?;
        auto_paths.push(rel);
    }

    // --- sidecar : eau solide par défaut, le reste se règle dans l'éditeur
    let sidecar = format!(
        "{{\n  \"autotiles\": [{}],\n  \"solid\": [1000],\n  \"above\": [],\n  \"upper_start\": 144\n}}\n",
        auto_paths
            .iter()
            .map(|p| format!("\"{}\"", p))
            .collect::<Vec<_>>()
            .join(", ")
    );
    let sidecar_path = assets.join(format!("{}.json", name));
    std::fs::write(&sidecar_path, sidecar)?;
    println!("  {}", sidecar_path.display());

    // --- project.json : ajout du tileset -------------------------------
    let pj_path = proj_dir.join("project.json");
    let mut pj: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&pj_path).context("project.json")?)?;
    let default_ts = pj["assets"]["tileset"].as_str().unwrap_or("").to_string();
    let list = pj["tilesets"].as_array().cloned().unwrap_or_default();
    let mut list: Vec<serde_json::Value> = if list.is_empty() {
        vec![serde_json::Value::String(default_ts)]
    } else {
        list
    };
    let rel = format!("assets/{}.png", name);
    if !list.iter().any(|v| v.as_str() == Some(rel.as_str())) {
        list.push(serde_json::Value::String(rel));
    }
    pj["tilesets"] = serde_json::Value::Array(list);
    std::fs::write(&pj_path, serde_json::to_string_pretty(&pj)? + "\n")?;
    println!("  {} (tileset '{}' ajoute)", pj_path.display(), name);

    println!(
        "import-chipset : {} tiles ({} basses + {} hautes), 13 autotiles",
        tiles.len(),
        144,
        144
    );
    Ok(())
}
