//! charset.rs — import d'un charset RPG Maker 2003 (feuille de personnages
//! 288x256) vers la feuille de sprites 16x24 d'un projet SNES Studio.
//!
//! Layout RM2003 : 8 personnages de 72x128 (4 colonnes x 2 rangées), chaque
//! personnage = 3 colonnes x 4 rangées de frames 24x32. Ordre RM des
//! rangées : haut, droite, bas, gauche ; colonnes : pas gauche, repos,
//! pas droit. Notre bloc de 12 frames (bas, haut, gauche, droite x repos,
//! pas A, pas B) est recomposé, et chaque frame 24x32 est recadrée en 16x24
//! (centre-bas : x 4..20, y 8..32 — les persos RM2003 tiennent dedans).
//!
//! La frame arrive dans <assets.sprites> (PNG RGBA, bande de frames 16x24)
//! au bloc demandé — datagen build ré-indexe ensuite par bloc (une palette
//! OBJ par bloc). Couleur transparente : alpha (PNG truecolor) ou index 0
//! de la palette (convention des ressources RM2003).

use crate::gfx;
use anyhow::{bail, Context, Result};
use std::path::Path;

/// Nos directions dans l'ordre des blocs → rangée RM2003 correspondante
const RM_ROW: [usize; 4] = [2, 0, 3, 1]; // bas, haut, gauche, droite
/// Nos pas (repos, pas A, pas B) → colonne RM2003
const RM_COL: [usize; 3] = [1, 0, 2];

const FRAME_W: usize = 16;
const FRAME_H: usize = 24;
const MAX_BLOCKS: usize = 5; // 5 blocs x 12 frames = 60 <= 64 frames OBJ

fn write_rgba_png(path: &Path, w: usize, h: usize, rgba: &[u8]) -> Result<()> {
    let file = std::fs::File::create(path)
        .with_context(|| format!("ecriture de {}", path.display()))?;
    let mut enc = png::Encoder::new(std::io::BufWriter::new(file), w as u32, h as u32);
    enc.set_color(png::ColorType::Rgba);
    enc.set_depth(png::BitDepth::Eight);
    let mut writer = enc.write_header()?;
    writer.write_image_data(rgba)?;
    println!("  {}", path.display());
    Ok(())
}

/// IndexedImage → tampon RGBA (index 0 = transparent)
fn to_rgba(img: &gfx::IndexedImage) -> Vec<u8> {
    let mut out = vec![0u8; img.width * img.height * 4];
    for (i, &p) in img.pixels.iter().enumerate() {
        if p == 0 {
            continue;
        }
        let c = &img.palette_rgb[p as usize * 3..p as usize * 3 + 3];
        out[i * 4..i * 4 + 3].copy_from_slice(c);
        out[i * 4 + 3] = 255;
    }
    out
}

pub fn import(charset: &Path, proj_dir: &Path, perso: usize, bloc: usize) -> Result<()> {
    if bloc >= MAX_BLOCKS {
        bail!("bloc {} : 0-{} (feuille de sprites limitee a 64 frames)", bloc, MAX_BLOCKS - 1);
    }
    let img = gfx::load_indexed_png(charset)?;
    // Feuille complète (8 personnages) ou personnage seul
    let (px0, py0) = if img.width == 288 && img.height == 256 {
        if perso > 7 {
            bail!("personnage {} : 0-7 sur un charset 288x256", perso);
        }
        ((perso % 4) * 72, (perso / 4) * 128)
    } else if img.width == 72 && img.height == 128 {
        if perso != 0 {
            bail!("personnage {} : un PNG 72x128 n'en contient qu'un (0)", perso);
        }
        (0, 0)
    } else {
        bail!(
            "{} : attendu un charset RM2003 288x256 (8 personnages) ou \
             72x128 (un personnage) — recu {}x{}",
            charset.display(),
            img.width,
            img.height
        );
    };

    // Les 12 frames 16x24 du bloc, en RGBA
    let mut frames_rgba = vec![0u8; 12 * FRAME_W * FRAME_H * 4];
    for d in 0..4 {
        for s in 0..3 {
            let fx = px0 + RM_COL[s] * 24 + 4; // recadrage 24x32 → 16x24
            let fy = py0 + RM_ROW[d] * 32 + 8;
            let f = d * 3 + s;
            for y in 0..FRAME_H {
                for x in 0..FRAME_W {
                    let p = img.pixels[(fy + y) * img.width + fx + x];
                    if p == 0 {
                        continue;
                    }
                    let c = &img.palette_rgb[p as usize * 3..p as usize * 3 + 3];
                    let o = (y * 12 * FRAME_W + f * FRAME_W + x) * 4;
                    frames_rgba[o..o + 3].copy_from_slice(c);
                    frames_rgba[o + 3] = 255;
                }
            }
        }
    }

    // Feuille de sprites du projet : lue si présente, étendue au besoin
    let pj: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(proj_dir.join("project.json")).context("project.json")?,
    )?;
    let sprites_rel = pj["assets"]["sprites"]
        .as_str()
        .context("project.json : assets.sprites manquant")?;
    let sprites_path = proj_dir.join(sprites_rel);

    let old_frames;
    let mut old_rgba;
    if sprites_path.exists() {
        let old = gfx::load_indexed_png(&sprites_path)?;
        if old.height != FRAME_H || old.width % FRAME_W != 0 {
            bail!(
                "{} : la feuille de sprites doit etre une bande de frames \
                 16x24 (recu {}x{})",
                sprites_path.display(),
                old.width,
                old.height
            );
        }
        old_frames = old.width / FRAME_W;
        old_rgba = to_rgba(&old);
    } else {
        old_frames = 0;
        old_rgba = Vec::new();
    }

    let new_frames = old_frames.max((bloc + 1) * 12);
    let new_w = new_frames * FRAME_W;
    let mut out = vec![0u8; new_w * FRAME_H * 4];
    // copie de l'existant
    if old_frames > 0 {
        let old_w = old_frames * FRAME_W;
        for y in 0..FRAME_H {
            out[(y * new_w) * 4..(y * new_w + old_w) * 4]
                .copy_from_slice(&old_rgba[(y * old_w) * 4..(y + 1) * old_w * 4]);
        }
        old_rgba.clear();
    }
    // collage du bloc (efface l'ancien contenu du bloc)
    let bx = bloc * 12 * FRAME_W;
    for y in 0..FRAME_H {
        let src = y * 12 * FRAME_W * 4;
        let dst = (y * new_w + bx) * 4;
        out[dst..dst + 12 * FRAME_W * 4]
            .copy_from_slice(&frames_rgba[src..src + 12 * FRAME_W * 4]);
    }

    if let Some(parent) = sprites_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    write_rgba_png(&sprites_path, new_w, FRAME_H, &out)?;
    println!(
        "import-charset : personnage {} → bloc {} (frames {}-{}) de {}",
        perso,
        bloc,
        bloc * 12,
        bloc * 12 + 11,
        sprites_rel
    );
    Ok(())
}
