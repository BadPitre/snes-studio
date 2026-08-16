//! Emitting the byte-exact binary format (spec §1): blobs of pinned ROM
//! banks. LoROM gives 32 KB per bank at CPU address $8000-$FFFF.
//!
//! - Bank $82 (`scenes.bin`): the Scene Table at $82:8000, then scene data.
//! - Bank $86 (`texts.bin`):  an offset table, then NUL-terminated strings.
//!
//! A 24-bit far pointer inside a structure is [bank][addr lo][addr hi] —
//! the same order as the Scene Table entries, address little-endian.

use crate::project;
use crate::script;
use crate::tileset;
use anyhow::{bail, Context, Result};
use std::collections::HashMap;

pub const BANK_BASE: u16 = 0x8000;
pub const BANK_CAPACITY: usize = 0x8000;

/// Multi-bank. WLA banks map to CPU $80 + n. The scene TABLE lives in
/// bank 2 ($82) and the text header in bank 6 ($86) — addresses the
/// engine knows (rom_layout.h). The DATA spills into extra banks
/// allocated from EXTRA_WLA_FIRST; their numbers travel inside the far
/// pointers of the tables, so the engine follows them without knowing
/// anything about the split. Keep WLA_BANK_COUNT in step with ROMBANKS
/// in engine/hdr.asm.
pub const SCENE_WLA_BANK0: u8 = 2;
pub const TEXT_WLA_BANK0: u8 = 6;
pub const EXTRA_WLA_FIRST: u8 = 8;
pub const WLA_BANK_COUNT: u8 = 32; /* ROM 1 Mo */

/// A bank pool: blobs parallel to their WLA bank numbers.
pub struct BankPool {
    pub blobs: Vec<Vec<u8>>,
    pub wla_banks: Vec<u8>,
}

impl BankPool {
    pub fn used(&self) -> usize {
        self.blobs.iter().map(|b| b.len()).sum()
    }
    pub fn capacity(&self) -> usize {
        self.blobs.len() * BANK_CAPACITY
    }
}

/// Allocates one extra bank from the common pool (scenes, then texts).
fn alloc_extra(next_extra: &mut u8, what: &str) -> Result<u8> {
    let b = *next_extra;
    if b >= WLA_BANK_COUNT {
        bail!(
            "{} : plus de banks ROM libres ({} banks au total, hdr.asm) —              augmenter ROMBANKS/WLA_BANK_COUNT",
            what, WLA_BANK_COUNT
        );
    }
    *next_extra = b + 1;
    Ok(b)
}

/// Scene Table v0.2 (spec §1.1):
/// [u16 scene_count][u8 boot_scene_id][u8 reserved]
/// then per scene: { u8 bank, u16 addr, u8 reserved }
pub fn build_scene_bank(
    scenes: &[project::Scene],
    grids: &[tileset::SceneGrids],
    set_ids: &[u8],
    sprite_set_ids: &[u8],
    sprite_remaps: &[HashMap<u8, u8>],
    slot_anims: &[[u8; 5]],
    text_ids: &HashMap<String, u16>,
    music_ids: &HashMap<String, u8>,
    boot_id: u8,
    next_extra: &mut u8,
) -> Result<BankPool> {
    let scene_ids: HashMap<&str, u8> = scenes
        .iter()
        .enumerate()
        .map(|(i, s)| (s.name.as_str(), i as u8))
        .collect();
    // Bank 0 of the pool ($82) carries the Scene Table and the scenes
    // follow, placed sequentially first-fit. A scene is ATOMIC: it fits
    // whole inside one bank.
    let table_size = 4 + scenes.len() * 4;
    let mut pool = BankPool {
        blobs: vec![vec![0u8; table_size]],
        wla_banks: vec![SCENE_WLA_BANK0],
    };
    pool.blobs[0][0..2].copy_from_slice(&(scenes.len() as u16).to_le_bytes());
    pool.blobs[0][2] = boot_id;
    let (mut grids_raw, mut grids_rle) = (0usize, 0usize);

    for (i, sc) in scenes.iter().enumerate() {
        let asm = script::assemble(&sc.script, text_ids, &scene_ids, &sprite_remaps[i])
            .with_context(|| format!("script de la scene '{}'", sc.name))?;

        let w = sc.width as usize;
        let h = sc.height as usize;
        let g = &grids[i];

        // The three grids travel RLE-compressed and are expanded at load
        // time into the engine's WRAM buffers — hence the per-scene cell
        // limit. A WORLD MAP ships NO grids at all: its block map lives
        // in ROM and collision reads it through the per-block table
        // (§7.5), so its only bound is the header's u8 sides — 255x255
        // blocks, the FF6 scale.
        let world = sc.is_worldmap();
        if world {
            if w > 255 || h > 255 {
                bail!(
                    "carte du monde '{}' : {}x{} — 255 cases de côté au \
                     plus (les coordonnées de bloc et l'en-tête de scène \
                     tiennent sur un octet)",
                    sc.name, w, h
                );
            }
        } else if w * h > MAP_BUF_CELLS {
            bail!(
                "scene '{}' : {}x{} = {} tiles > {} (budget WRAM de \
                 décompression, spec §1.6) — réduire la map ou la découper",
                sc.name, w, h, w * h, MAP_BUF_CELLS
            );
        }
        // Collision derived from the tileset (spec §1.4). Warp tiles are
        // marked 0x02 by the tool, and must be walkable. A world map has
        // no collision grid to mark — the engine scans its warp LIST.
        let mut collision = g.collision.clone();
        if !world {
            for wp in &sc.warps {
                let ofs = wp.y as usize * w + wp.x as usize;
                if collision[ofs] & 0x0F != 0 {
                    bail!(
                        "scene '{}' : warp ({},{}) sur une tile solide",
                        sc.name, wp.x, wp.y
                    );
                }
                collision[ofs] = 0x02;
            }
        }
        let rle_lower = if world { Vec::new() } else { rle_encode(&g.lower) };
        let rle_upper = if world { Vec::new() } else { rle_encode(&g.upper) };
        let rle_col = if world { Vec::new() } else { rle_encode(&collision) };
        grids_raw += 3 * w * h;
        grids_rle += rle_lower.len() + rle_upper.len() + rle_col.len();

        // Scene layout: 33-byte header, then the lower tilemap RLE, the
        // upper tilemap RLE, the collision RLE, actors (8 B), warps (8 B)
        // and scripts.
        let chunk_len = 33
            + rle_lower.len() + rle_upper.len() + rle_col.len()
            + sc.actors.len() * 16 + sc.warps.len() * 8
            + asm.bytecode.len();
        if chunk_len > BANK_CAPACITY {
            bail!(
                "scene '{}' : {} octets > 32 Ko — une scène doit tenir                  entière dans une bank (réduire la map ou ses scripts)",
                sc.name, chunk_len
            );
        }
        // Sequential first-fit: current bank, else a fresh one from the pool.
        if pool.blobs.last().unwrap().len() + chunk_len > BANK_CAPACITY {
            pool.wla_banks.push(alloc_extra(next_extra, "banks scenes")?);
            pool.blobs.push(Vec::new());
        }
        let cpu_bank = 0x80 + *pool.wla_banks.last().unwrap();
        let header_ofs = pool.blobs.last().unwrap().len();

        // Scene Table entry (pool bank 0): a far pointer to the header.
        let entry = 4 + i * 4;
        pool.blobs[0][entry] = cpu_bank;
        pool.blobs[0][entry + 1..entry + 3]
            .copy_from_slice(&(BANK_BASE + header_ofs as u16).to_le_bytes());

        let blob = pool.blobs.last_mut().unwrap();
        let tilemap_ofs = header_ofs + 33;
        let upper_ofs = tilemap_ofs + rle_lower.len();
        let collision_ofs = upper_ofs + rle_upper.len();
        let actors_ofs = collision_ofs + rle_col.len();
        let warps_ofs = actors_ofs + sc.actors.len() * 16;
        let scripts_ofs = warps_ofs + sc.warps.len() * 8;

        // Scene Header (spec §1.2 — 33 bytes since CH2)
        let mut header = [0u8; 33];
        header[0] = 0x01; // scene_type TOP_DOWN
        header[1] = set_ids[i]; // gfx_set_id (v0.4 — gfx compilés par scène)
        header[2] = sc.width;
        header[3] = sc.height;
        write_far(&mut header[4..7], cpu_bank, tilemap_ofs);
        write_far(&mut header[7..10], cpu_bank, collision_ofs);
        write_far(&mut header[10..13], cpu_bank, actors_ofs);
        write_far(&mut header[13..16], cpu_bank, scripts_ofs);
        header[16] = sc.actors.len() as u8;
        header[17] = sc.player_start[0];
        header[18] = sc.player_start[1];
        header[19] = match &sc.music {
            None => 0xFF, // silence
            Some(name) => *music_ids.get(name.as_str()).with_context(|| {
                format!("scene '{}' : musique inconnue '{}'", sc.name, name)
            })?,
        };
        write_far(&mut header[20..23], cpu_bank, warps_ofs);
        header[23] = sc.warps.len() as u8;
        write_far(&mut header[24..27], cpu_bank, upper_ofs);
        header[27] = sprite_set_ids[i]; // sprite_set_id (v0.5)
        // CH2 — walk anim per sprite slot: bits 0-6 step length,
        // bit 7 stepping idle (walk in place while standing)
        header[28..33].copy_from_slice(&slot_anims[i]);
        blob.extend_from_slice(&header);

        blob.extend_from_slice(&rle_lower);
        blob.extend_from_slice(&rle_upper);
        blob.extend_from_slice(&rle_col);

        // Actor entries (spec §1.3 v0.14, 16 bytes)
        for a in &sc.actors {
            let ofs = match &a.entry {
                None => 0xFFFFu16,
                Some(label) => *asm.labels.get(label).with_context(|| {
                    format!("scene '{}' : entry '{}' introuvable", sc.name, label)
                })?,
            };
            // actor_type (spec §1.3): 0x01 npc, 0x02 touch, 0x03 auto
            blob.push(match a.kind.as_str() {
                "npc" => 0x01,
                "trigger" => 0x02,
                _ => 0x03,
            });
            blob.push(a.x);
            blob.push(a.y);
            // The binary sprite_id is the LOCAL SLOT in the scene's sprite
            // set; the JSON's global block is remapped here. 255 means
            // invisible (spec §1.3 v0.8), whatever the type.
            blob.push(if a.sprite == 255 {
                255
            } else {
                sprite_remaps[i][&a.sprite]
            });
            blob.extend_from_slice(&ofs.to_le_bytes());
            blob.push(project::dir_code(&a.dir)?);
            // flags (bit 7 = continuation page, bits 0-2 = condition type)
            // plus the condition itself (spec §1.3)
            blob.push(if a.cont { 0x80 } else { 0 } | a.cond_type | (a.move_type << 3));
            blob.extend_from_slice(&a.cond_idx.to_le_bytes());
            blob.extend_from_slice(&a.cond_val.to_le_bytes());
            // priority | speed<<4, reserved, custom route
            blob.push(a.priority | (a.speed << 4));
            blob.push(0);
            let rofs = match &a.route_label {
                None => 0xFFFFu16,
                Some(label) => *asm.labels.get(label).with_context(|| {
                    format!("scene '{}' : blob de route '{}' introuvable", sc.name, label)
                })?,
            };
            blob.extend_from_slice(&rofs.to_le_bytes());
        }

        // Warp entries (spec §1.5, 8 bytes)
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
            // flags bits 0-2 hold the hero's arrival direction:
            // 0 keeps the current one, 1-4 are DIR_* + 1.
            blob.push(match &wp.dir {
                None => 0,
                Some(d) => crate::project::dir_code(d)? + 1,
            });
            // trans: 0 fade, 1 instant, 2 mosaic
            blob.push(crate::project::trans_code(&wp.trans)?);
            blob.push(0);
        }

        blob.extend_from_slice(&asm.bytecode);
    }

    println!(
        "  grilles : {} -> {} octets (RLE, {}%)",
        grids_raw,
        grids_rle,
        if grids_raw > 0 { grids_rle * 100 / grids_raw } else { 100 }
    );
    Ok(pool)
}

fn write_far(dst: &mut [u8], bank: u8, offset: usize) {
    let addr = BANK_BASE + offset as u16;
    dst[0] = bank;
    dst[1..3].copy_from_slice(&addr.to_le_bytes());
}

/// Scene grids RLE-compressed as [count 1-255][value] pairs, expanded at
/// scene load into the engine's WRAM buffers.
fn rle_encode(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < data.len() {
        let v = data[i];
        let mut n = 1usize;
        while n < 255 && i + n < data.len() && data[i + n] == v {
            n += 1;
        }
        out.push(n as u8);
        out.push(v);
        i += n;
    }
    out
}

/// The engine's WRAM budget for one expanded grid (scene.c).
pub const MAP_BUF_CELLS: usize = 8192;

/// Special text codes (RM2003 model, spec §2), encoded as control bytes
/// below 0x20 BEFORE the DTE pass so the dictionary treats them as
/// opaque:
///   \v[n] -> [0x01][n+1]  print variable n (0-254) in decimal
///   \s[n] -> [0x02][n+1]  speed: n frames per character (0-19; 0 runs
///                          instantly to the end)
///   \.    -> [0x03]       short pause (1/4 s)
///   \|    -> [0x04]       long pause (1 s)
///   \!    -> [0x05]       wait for A before continuing
///   \^    -> [0x06]       the message closes without a keypress
///   \>    -> [0x07]       start of instant display
///   \<    -> [0x08]       end of instant display
///   \\    -> '\\'          a literal backslash
/// The +1 on the parameter byte is what keeps a NUL out of the string.
fn escape_codes(name: &str, s: &str) -> Result<Vec<u8>> {
    let b = s.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < b.len() {
        if b[i] != b'\\' {
            out.push(b[i]);
            i += 1;
            continue;
        }
        let c = *b.get(i + 1).with_context(|| {
            format!("texte '{}' : \\ en fin de texte (\\\\ pour un backslash)", name)
        })?;
        match c {
            b'v' | b's' => {
                if b.get(i + 2) != Some(&b'[') {
                    bail!(
                        "texte '{}' : \\{} s'ecrit \\{}[n]",
                        name, c as char, c as char
                    );
                }
                let end = b[i + 3..]
                    .iter()
                    .position(|&x| x == b']')
                    .map(|p| p + i + 3)
                    .with_context(|| {
                        format!("texte '{}' : \\{}[ sans ] fermant", name, c as char)
                    })?;
                let max = if c == b'v' { 254 } else { 19 };
                let n: u16 = std::str::from_utf8(&b[i + 3..end])
                    .unwrap_or("")
                    .trim()
                    .parse()
                    .ok()
                    .filter(|&n| n <= max)
                    .with_context(|| {
                        format!(
                            "texte '{}' : \\{}[n] attend n entre 0 et {}",
                            name, c as char, max
                        )
                    })?;
                out.push(if c == b'v' { 0x01 } else { 0x02 });
                out.push((n + 1) as u8);
                i = end + 1;
            }
            b'.' => { out.push(0x03); i += 2; }
            b'|' => { out.push(0x04); i += 2; }
            b'!' => { out.push(0x05); i += 2; }
            b'^' => { out.push(0x06); i += 2; }
            b'>' => { out.push(0x07); i += 2; }
            b'<' => { out.push(0x08); i += 2; }
            b'\\' => { out.push(b'\\'); i += 2; }
            other => bail!(
                "texte '{}' : code \\{} inconnu (codes : \\v[n] \\s[n] \\. \\| \\! \\^ \\> \\< \\\\)",
                name, other as char
            ),
        }
    }
    Ok(out)
}

/// A control byte and its optional parameter: 0x01 and 0x02 are followed
/// by one byte, which may hold anything — it is never a DTE pair.
fn ctrl_len(b: u8) -> usize {
    match b {
        0x01 | 0x02 => 2,
        0x03..=0x08 => 1,
        _ => 0,
    }
}

/// Text bank (spec §2 v0.7). Strings are compressed with a bigram
/// dictionary (DTE): codes 0x80-0xFF stand for a PAIR of ASCII characters
/// from a 256-byte table, decoded on the fly by the textbox.
/// [u16 text_count][u16 offset x N, relative to the bank start]
/// [pair table: 128 x 2 bytes][encoded strings, NUL-terminated]
pub fn build_text_bank(
    texts: &[project::TextEntry],
    next_extra: &mut u8,
) -> Result<BankPool> {
    for t in texts {
        if !t.text.chars().all(|c| (' '..='~').contains(&c)) {
            bail!("texte '{}' : caractere non-ASCII (v0 : ASCII 32-126)", t.name);
        }
    }

    // Special codes become control bytes BEFORE the DTE pass, so the
    // dictionary never sees them; the typewriter interprets them.
    let encoded: Vec<Vec<u8>> = texts
        .iter()
        .map(|t| escape_codes(&t.name, &t.text))
        .collect::<Result<_>>()?;

    // Dictionary: the 128 most frequent ASCII bigrams, in a single pass
    // over RAW character pairs — the engine's decoder is not recursive.
    // Deterministic order: frequency, then value. Escape bytes (< 0x20)
    // never form a pair.
    let mut freq: HashMap<[u8; 2], usize> = HashMap::new();
    for b in &encoded {
        let mut j = 0;
        while j < b.len() {
            let cl = ctrl_len(b[j]);
            if cl > 0 {
                j += cl;
                continue;
            }
            if j + 1 < b.len() && ctrl_len(b[j + 1]) == 0 {
                *freq.entry([b[j], b[j + 1]]).or_insert(0) += 1;
            }
            j += 1;
        }
    }
    let mut pairs: Vec<([u8; 2], usize)> =
        freq.into_iter().filter(|&(_, n)| n >= 2).collect();
    pairs.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    pairs.truncate(128);
    let mut table = [b' '; 256];
    let mut code_of: HashMap<[u8; 2], u8> = HashMap::new();
    for (k, (p, _)) in pairs.iter().enumerate() {
        table[k * 2] = p[0];
        table[k * 2 + 1] = p[1];
        code_of.insert(*p, 0x80 | k as u8);
    }

    // Bank 0 of the pool ($86) carries the header —
    // [u16 count][3-byte entries: ofs lo, ofs hi, CPU bank][256 B of pairs]
    // — and the strings follow, spilling first-fit into extra banks once
    // the header bank is full.
    let header_size = 2 + texts.len() * 3 + 256;
    if header_size > BANK_CAPACITY {
        bail!(
            "bank textes : {} entrees — l'en-tete deborde la bank $86",
            texts.len()
        );
    }
    let mut pool = BankPool {
        blobs: vec![vec![0u8; header_size]],
        wla_banks: vec![TEXT_WLA_BANK0],
    };
    pool.blobs[0][0..2].copy_from_slice(&(texts.len() as u16).to_le_bytes());
    let pairs_ofs = 2 + texts.len() * 3;
    pool.blobs[0][pairs_ofs..header_size].copy_from_slice(&table);

    let mut raw = 0usize;
    for (i, b) in encoded.iter().enumerate() {
        // DTE-encode into a buffer: its size decides the placement
        let mut enc = Vec::new();
        raw += b.len() + 1;
        let mut j = 0;
        while j < b.len() {
            let cl = ctrl_len(b[j]);
            if cl > 0 {
                enc.extend_from_slice(&b[j..j + cl]);
                j += cl;
                continue;
            }
            if j + 1 < b.len() && ctrl_len(b[j + 1]) == 0 {
                if let Some(&c) = code_of.get(&[b[j], b[j + 1]]) {
                    enc.push(c);
                    j += 2;
                    continue;
                }
            }
            enc.push(b[j]);
            j += 1;
        }
        enc.push(0);
        if header_size + enc.len() > BANK_CAPACITY {
            bail!("texte '{}' : trop long pour une bank", texts[i].name);
        }
        if pool.blobs.last().unwrap().len() + enc.len() > BANK_CAPACITY {
            pool.wla_banks.push(alloc_extra(next_extra, "banks textes")?);
            pool.blobs.push(Vec::new());
        }
        let cpu_bank = 0x80 + *pool.wla_banks.last().unwrap();
        let ofs = pool.blobs.last().unwrap().len() as u16;
        let e = 2 + i * 3;
        pool.blobs[0][e..e + 2].copy_from_slice(&ofs.to_le_bytes());
        pool.blobs[0][e + 2] = cpu_bank;
        pool.blobs.last_mut().unwrap().extend_from_slice(&enc);
    }
    let strings: usize = pool.used() - header_size;
    println!(
        "  textes : {} -> {} octets (DTE, {}%)",
        raw,
        strings,
        if raw > 0 { strings * 100 / raw } else { 100 }
    );
    Ok(pool)
}

/// The asm that pins the blobs into their banks (LoROM: ROM bank n is
/// CPU $80+n). One FORCE section per bank of each pool; the files are
/// scenes.bin, scenes1.bin, … and likewise for texts, with bank 0 of
/// each pool keeping its historical name.
pub fn databanks_asm(scene_pool: &BankPool, text_pool: &BankPool) -> String {
    let mut s = String::from(
        "; GENERATED by tools/datagen — DO NOT EDIT BY HAND.\n\
         ; Pins the binary blobs into their ROM banks (kit spec §3).\n\
         .include \"hdr.asm\"\n",
    );
    for (pool, base, label) in
        [(scene_pool, "scenes", "SceneBank"), (text_pool, "texts", "TextBank")]
    {
        for (k, wla) in pool.wla_banks.iter().enumerate() {
            let file = pool_bin_name(base, k);
            s.push_str(&format!(
                "\n.BANK {} SLOT 0\n.ORG 0\n.SECTION \"{}{}\" FORCE\n\
                 .incbin \"src/data/{}\"\n.ENDS\n",
                wla, label, k, file
            ));
        }
    }
    s
}

/// File name of bank k of a pool ("scenes.bin", "scenes1.bin", …).
pub fn pool_bin_name(base: &str, k: usize) -> String {
    if k == 0 {
        format!("{}.bin", base)
    } else {
        format!("{}{}.bin", base, k)
    }
}

