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

/// Multi-bank (M1) — banks WLA (CPU = $80 + n) : la TABLE des scènes vit
/// en bank 2 ($82) et l'en-tête des textes en bank 6 ($86), adresses que
/// le moteur connaît (rom_layout.h). Les DONNÉES débordent dans des banks
/// supplémentaires allouées à partir de EXTRA_WLA_FIRST — leurs numéros
/// voyagent dans les pointeurs far des tables, le moteur les suit sans
/// rien connaître du découpage. Tenir WLA_BANK_COUNT en phase avec le
/// ROMBANKS de engine/hdr.asm.
pub const SCENE_WLA_BANK0: u8 = 2;
pub const TEXT_WLA_BANK0: u8 = 6;
pub const EXTRA_WLA_FIRST: u8 = 8;
pub const WLA_BANK_COUNT: u8 = 32; /* ROM 1 Mo */

/// Un pool de banks : blobs parallèles à leurs numéros de bank WLA.
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

/// Alloue une bank supplémentaire du pool commun (scènes puis textes).
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
    next_extra: &mut u8,
) -> Result<BankPool> {
    let scene_ids: HashMap<&str, u8> = scenes
        .iter()
        .enumerate()
        .map(|(i, s)| (s.name.as_str(), i as u8))
        .collect();
    // Multi-bank (M1) : la bank 0 du pool ($82) porte la Scene Table,
    // les scènes se placent à la suite (first-fit séquentiel — une scène
    // est ATOMIQUE : elle tient entière dans une bank)
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

        // v0.7 : les trois grilles voyagent compressées (RLE) et sont
        // décompressées au chargement vers les buffers WRAM du moteur —
        // d'où la limite de cellules par scène.
        if w * h > MAP_BUF_CELLS {
            bail!(
                "scene '{}' : {}x{} = {} tiles > {} (budget WRAM de \
                 décompression, spec §1.6) — réduire la map ou la découper",
                sc.name, w, h, w * h, MAP_BUF_CELLS
            );
        }
        // Collision dérivée du tileset (spec §1.4) ; les tiles de warp
        // sont marquées 0x02 par l'outil — et doivent être traversables
        let mut collision = g.collision.clone();
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
        let rle_lower = rle_encode(&g.lower);
        let rle_upper = rle_encode(&g.upper);
        let rle_col = rle_encode(&collision);
        grids_raw += 3 * w * h;
        grids_rle += rle_lower.len() + rle_upper.len() + rle_col.len();

        // Layout de la scène : header 28 o (v0.3), puis tilemap (couche
        // inf) RLE, tilemap sup RLE, collision RLE, acteurs (8 o),
        // warps (8 o), scripts
        let chunk_len = 28
            + rle_lower.len() + rle_upper.len() + rle_col.len()
            + sc.actors.len() * 16 + sc.warps.len() * 8
            + asm.bytecode.len();
        if chunk_len > BANK_CAPACITY {
            bail!(
                "scene '{}' : {} octets > 32 Ko — une scène doit tenir                  entière dans une bank (réduire la map ou ses scripts)",
                sc.name, chunk_len
            );
        }
        // first-fit séquentiel : bank courante, sinon une neuve du pool
        if pool.blobs.last().unwrap().len() + chunk_len > BANK_CAPACITY {
            pool.wla_banks.push(alloc_extra(next_extra, "banks scenes")?);
            pool.blobs.push(Vec::new());
        }
        let cpu_bank = 0x80 + *pool.wla_banks.last().unwrap();
        let header_ofs = pool.blobs.last().unwrap().len();

        // Entrée de la Scene Table (bank 0 du pool) : far vers le header
        let entry = 4 + i * 4;
        pool.blobs[0][entry] = cpu_bank;
        pool.blobs[0][entry + 1..entry + 3]
            .copy_from_slice(&(BANK_BASE + header_ofs as u16).to_le_bytes());

        let blob = pool.blobs.last_mut().unwrap();
        let tilemap_ofs = header_ofs + 28;
        let upper_ofs = tilemap_ofs + rle_lower.len();
        let collision_ofs = upper_ofs + rle_upper.len();
        let actors_ofs = collision_ofs + rle_col.len();
        let warps_ofs = actors_ofs + sc.actors.len() * 16;
        let scripts_ofs = warps_ofs + sc.warps.len() * 8;

        // Scene Header (spec §1.2 v0.3 — 28 octets)
        let mut header = [0u8; 28];
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
        blob.extend_from_slice(&header);

        blob.extend_from_slice(&rle_lower);
        blob.extend_from_slice(&rle_upper);
        blob.extend_from_slice(&rle_col);

        // Entrées acteurs (spec §1.3 v0.14, 16 octets)
        for a in &sc.actors {
            let ofs = match &a.entry {
                None => 0xFFFFu16,
                Some(label) => *asm.labels.get(label).with_context(|| {
                    format!("scene '{}' : entry '{}' introuvable", sc.name, label)
                })?,
            };
            // actor_type (spec §1.3) : 0x01 npc, 0x02 contact, 0x03 auto
            blob.push(match a.kind.as_str() {
                "npc" => 0x01,
                "trigger" => 0x02,
                _ => 0x03,
            });
            blob.push(a.x);
            blob.push(a.y);
            // sprite_id binaire = SLOT LOCAL dans le sprite set de la
            // scène (v0.5) — le bloc global du JSON est remappé ici.
            // 255 = invisible (spec §1.3 v0.8), quel que soit le type.
            blob.push(if a.sprite == 255 {
                255
            } else {
                sprite_remaps[i][&a.sprite]
            });
            blob.extend_from_slice(&ofs.to_le_bytes());
            blob.push(project::dir_code(&a.dir)?);
            // v0.10 : flags (bit 7 = page de continuation, bits 0-2 =
            // type de condition) + condition (spec §1.3)
            blob.push(if a.cont { 0x80 } else { 0 } | a.cond_type | (a.move_type << 3));
            blob.extend_from_slice(&a.cond_idx.to_le_bytes());
            blob.extend_from_slice(&a.cond_val.to_le_bytes());
            // v0.14 : priorité | vitesse<<4, réservé, route custom
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
            // flags (v0.16) : bits 0-2 = direction d'arrivée du héros
            // (0 = conserver, 1-4 = DIR_* + 1)
            blob.push(match &wp.dir {
                None => 0,
                Some(d) => crate::project::dir_code(d)? + 1,
            });
            blob.push(0);
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

/// Grilles de scène compressées en RLE (v0.7) : paires [count 1-255][valeur],
/// décodées au chargement de scène vers les buffers WRAM du moteur.
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

/// Budget WRAM du moteur pour une grille décompressée (scene.c)
pub const MAP_BUF_CELLS: usize = 8192;

/// Codes speciaux des textes (modele RM2003, spec §2) — encodes en octets
/// de controle < 0x20 AVANT le DTE (opaques pour le dictionnaire) :
///   \v[n] -> [0x01][n+1]  afficher la variable n (0-254) en decimal
///   \s[n] -> [0x02][n+1]  vitesse : n frames par caractere (0-19,
///                          0 = instantane jusqu'a la fin)
///   \.    -> [0x03]       pause courte (1/4 s)
///   \|    -> [0x04]       pause longue (1 s)
///   \!    -> [0x05]       attendre un appui sur A avant de continuer
///   \^    -> [0x06]       le message se ferme sans appui a la fin
///   \>    -> [0x07]       debut d'affichage instantane
///   \<    -> [0x08]       fin d'affichage instantane
///   \\    -> '\\'          backslash litteral
/// (n+1 : jamais d'octet nul dans une chaine.)
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

/// Un octet de controle et son parametre eventuel : 0x01/0x02 sont suivis
/// d'un octet (qui peut valoir n'importe quoi — jamais une paire DTE).
fn ctrl_len(b: u8) -> usize {
    match b {
        0x01 | 0x02 => 2,
        0x03..=0x08 => 1,
        _ => 0,
    }
}

/// Bank textes (spec §2 v0.7) — chaînes compressées par dictionnaire de
/// bigrammes (DTE) : les codes 0x80-0xFF désignent une PAIRE de caractères
/// ASCII de la table (256 octets), décodée à la volée par la textbox.
/// [u16 text_count][u16 offset × N (relatifs au debut de bank)]
/// [table de paires : 128 × 2 octets][chaines encodees \0]
pub fn build_text_bank(
    texts: &[project::TextEntry],
    next_extra: &mut u8,
) -> Result<BankPool> {
    for t in texts {
        if !t.text.chars().all(|c| (' '..='~').contains(&c)) {
            bail!("texte '{}' : caractere non-ASCII (v0 : ASCII 32-126)", t.name);
        }
    }

    // Codes speciaux -> octets de controle AVANT le DTE (opaques pour le
    // dictionnaire — le decodeur/machine a ecrire les interprete)
    let encoded: Vec<Vec<u8>> = texts
        .iter()
        .map(|t| escape_codes(&t.name, &t.text))
        .collect::<Result<_>>()?;

    // Dictionnaire : les 128 bigrammes ASCII les plus fréquents (une seule
    // passe, paires de caractères BRUTS — le décodeur moteur n'est pas
    // récursif). Ordre déterministe : fréquence puis valeur. Les octets
    // d'échappement (< 0x20) ne forment jamais de paire.
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

    // Multi-bank (M1) : la bank 0 du pool ($86) porte l'en-tête —
    // [u16 count][entrées 3 o : ofs lo, ofs hi, bank CPU][paires 256 o] —
    // puis les chaînes se placent à la suite (first-fit séquentiel dans
    // des banks supplémentaires quand la bank d'en-tête est pleine)
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
        // encodage DTE dans un tampon : la taille décide du placement
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

/// L'asm qui épingle les blobs dans leurs banks (LoROM : bank ROM n =
/// CPU $80+n). Multi-bank (M1) : une section FORCE par bank de chaque
/// pool — les fichiers s'appellent scenes.bin, scenes1.bin, … (idem
/// textes), la bank 0 de chaque pool garde son nom historique.
pub fn databanks_asm(scene_pool: &BankPool, text_pool: &BankPool) -> String {
    let mut s = String::from(
        "; FICHIER GENERE par tools/datagen — NE PAS EDITER A LA MAIN.\n\
         ; Epingle les blobs binaires dans leurs banks ROM (spec kit §3).\n\
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

/// Nom du fichier .bin de la bank k d'un pool ("scenes.bin", "scenes1.bin"…)
pub fn pool_bin_name(base: &str, k: usize) -> String {
    if k == 0 {
        format!("{}.bin", base)
    } else {
        format!("{}{}.bin", base, k)
    }
}

