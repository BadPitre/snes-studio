//! Émission du format binaire byte-exact (spec §1) : blobs de banks ROM
//! épinglées. LoROM : 32 Ko utiles par bank, adresse CPU $8000-$FFFF.
//!
//! - Bank $82 (`scenes.bin`) : Scene Table à $82:8000 + données de scènes.
//! - Bank $86 (`texts.bin`)  : table d'offsets + chaînes terminées par 0.
//!
//! Pointeur far 24-bit dans les structures : [bank][addr lo][addr hi]
//! (même ordre que les entrées de la Scene Table, addr little-endian).

use crate::project;
use crate::script;
use crate::tileset;
use anyhow::{bail, Context, Result};
use std::collections::HashMap;

pub const BANK_SCENES: u8 = 0x82;
pub const BANK_TEXTS: u8 = 0x86;
pub const BANK_BASE: u16 = 0x8000;
pub const BANK_CAPACITY: usize = 0x8000;

/// Scene Table v0.2 (spec §1.1) :
/// [u16 scene_count][u8 boot_scene_id][u8 reserved]
/// puis par scène : { u8 bank, u16 addr, u8 reserved }
pub fn build_scene_bank(
    scenes: &[project::Scene],
    grids: &[tileset::SceneGrids],
    set_ids: &[u8],
    sprite_set_ids: &[u8],
    sprite_remaps: &[HashMap<u8, u8>],
    text_ids: &HashMap<String, u16>,
    music_ids: &HashMap<String, u8>,
    boot_id: u8,
) -> Result<Vec<u8>> {
    let scene_ids: HashMap<&str, u8> = scenes
        .iter()
        .enumerate()
        .map(|(i, s)| (s.name.as_str(), i as u8))
        .collect();
    let table_size = 4 + scenes.len() * 4;
    let mut blob = vec![0u8; table_size];
    blob[0..2].copy_from_slice(&(scenes.len() as u16).to_le_bytes());
    blob[2] = boot_id;

    for (i, sc) in scenes.iter().enumerate() {
        let asm = script::assemble(&sc.script, text_ids)
            .with_context(|| format!("script de la scene '{}'", sc.name))?;

        let w = sc.width as usize;
        let h = sc.height as usize;
        let g = &grids[i];

        // Layout de la scène : header 28 o (v0.3), puis tilemap (couche
        // inf), tilemap sup, collision, acteurs (8 o), warps (8 o), scripts
        let header_ofs = blob.len();
        let tilemap_ofs = header_ofs + 28;
        let upper_ofs = tilemap_ofs + w * h;
        let collision_ofs = upper_ofs + w * h;
        let actors_ofs = collision_ofs + w * h;
        let warps_ofs = actors_ofs + sc.actors.len() * 8;
        let scripts_ofs = warps_ofs + sc.warps.len() * 8;

        // Entrée de la Scene Table
        let entry = 4 + i * 4;
        blob[entry] = BANK_SCENES;
        blob[entry + 1..entry + 3]
            .copy_from_slice(&(BANK_BASE + header_ofs as u16).to_le_bytes());

        // Scene Header (spec §1.2 v0.3 — 28 octets)
        let mut header = [0u8; 28];
        header[0] = 0x01; // scene_type TOP_DOWN
        header[1] = set_ids[i]; // gfx_set_id (v0.4 — gfx compilés par scène)
        header[2] = sc.width;
        header[3] = sc.height;
        write_far(&mut header[4..7], BANK_SCENES, tilemap_ofs);
        write_far(&mut header[7..10], BANK_SCENES, collision_ofs);
        write_far(&mut header[10..13], BANK_SCENES, actors_ofs);
        write_far(&mut header[13..16], BANK_SCENES, scripts_ofs);
        header[16] = sc.actors.len() as u8;
        header[17] = sc.player_start[0];
        header[18] = sc.player_start[1];
        header[19] = match &sc.music {
            None => 0xFF, // silence
            Some(name) => *music_ids.get(name.as_str()).with_context(|| {
                format!("scene '{}' : musique inconnue '{}'", sc.name, name)
            })?,
        };
        write_far(&mut header[20..23], BANK_SCENES, warps_ofs);
        header[23] = sc.warps.len() as u8;
        write_far(&mut header[24..27], BANK_SCENES, upper_ofs);
        header[27] = sprite_set_ids[i]; // sprite_set_id (v0.5)
        blob.extend_from_slice(&header);

        blob.extend_from_slice(&g.lower);
        blob.extend_from_slice(&g.upper);
        // Collision dérivée du tileset (spec §1.4) ; les tiles de warp
        // sont marquées 0x02 par l'outil — et doivent être traversables
        let mut collision = g.collision.clone();
        for wp in &sc.warps {
            let ofs = wp.y as usize * w + wp.x as usize;
            if collision[ofs] != 0 {
                bail!(
                    "scene '{}' : warp ({},{}) sur une tile solide",
                    sc.name, wp.x, wp.y
                );
            }
            collision[ofs] = 0x02;
        }
        blob.extend_from_slice(&collision);

        // Entrées acteurs (spec §1.3, 8 octets)
        for a in &sc.actors {
            let ofs = match &a.entry {
                None => 0xFFFFu16,
                Some(label) => *asm.labels.get(label).with_context(|| {
                    format!("scene '{}' : entry '{}' introuvable", sc.name, label)
                })?,
            };
            blob.push(0x01); // ACTOR_TYPE_NPC_STATIC
            blob.push(a.x);
            blob.push(a.y);
            // sprite_id binaire = SLOT LOCAL dans le sprite set de la
            // scène (v0.5) — le bloc global du JSON est remappé ici
            blob.push(sprite_remaps[i][&a.sprite]);
            blob.extend_from_slice(&ofs.to_le_bytes());
            blob.push(project::dir_code(&a.dir)?);
            blob.push(0);
        }

        // Entrées warps (spec §1.5, 8 octets)
        for wp in &sc.warps {
            let dest = *scene_ids.get(wp.to.as_str()).with_context(|| {
                format!("scene '{}' : warp vers scene inconnue '{}'", sc.name, wp.to)
            })?;
            let d = &scenes[dest as usize];
            if wp.tx >= d.width || wp.ty >= d.height {
                bail!(
                    "scene '{}' : warp -> '{}' ({},{}) hors map cible",
                    sc.name, wp.to, wp.tx, wp.ty
                );
            }
            blob.push(wp.x);
            blob.push(wp.y);
            blob.push(dest);
            blob.push(wp.tx);
            blob.push(wp.ty);
            blob.push(0);
            blob.push(0);
            blob.push(0);
        }

        blob.extend_from_slice(&asm.bytecode);
    }

    if blob.len() > BANK_CAPACITY {
        bail!(
            "bank scenes : {} octets > 32 Ko — decoupage multi-bank a implementer \
             (bank $83 reservee, spec kit §3)",
            blob.len()
        );
    }
    Ok(blob)
}

fn write_far(dst: &mut [u8], bank: u8, offset: usize) {
    let addr = BANK_BASE + offset as u16;
    dst[0] = bank;
    dst[1..3].copy_from_slice(&addr.to_le_bytes());
}

/// Bank textes (spec §2) :
/// [u16 text_count][u16 offset × N (relatifs au debut de bank)][chaines \0]
pub fn build_text_bank(texts: &[project::TextEntry]) -> Result<Vec<u8>> {
    let table_size = 2 + texts.len() * 2;
    let mut blob = vec![0u8; table_size];
    blob[0..2].copy_from_slice(&(texts.len() as u16).to_le_bytes());

    for (i, t) in texts.iter().enumerate() {
        let ofs = blob.len() as u16;
        blob[2 + i * 2..4 + i * 2].copy_from_slice(&ofs.to_le_bytes());
        if !t.text.chars().all(|c| (' '..='~').contains(&c)) {
            bail!("texte '{}' : caractere non-ASCII (v0 : ASCII 32-126)", t.name);
        }
        blob.extend_from_slice(t.text.as_bytes());
        blob.push(0);
    }

    if blob.len() > BANK_CAPACITY {
        bail!("bank textes : {} octets > 32 Ko", blob.len());
    }
    Ok(blob)
}

/// L'asm qui épingle les blobs dans leurs banks (LoROM : bank ROM n = CPU $80+n)
pub fn databanks_asm() -> String {
    format!(
        "; FICHIER GENERE par tools/datagen — NE PAS EDITER A LA MAIN.\n\
         ; Epingle les blobs binaires dans leurs banks ROM (spec kit §3).\n\
         .include \"hdr.asm\"\n\n\
         .BANK {sb} SLOT 0\n.ORG 0\n.SECTION \"SceneBank\" FORCE\n\
         .incbin \"src/data/scenes.bin\"\n.ENDS\n\n\
         .BANK {tb} SLOT 0\n.ORG 0\n.SECTION \"TextBank\" FORCE\n\
         .incbin \"src/data/texts.bin\"\n.ENDS\n",
        sb = BANK_SCENES - 0x80,
        tb = BANK_TEXTS - 0x80,
    )
}
