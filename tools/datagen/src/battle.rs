//! Battler cells (PLANNING_COMBAT_GENERIQUE.md, G1).
//!
//! The only build-time service a battle still needs from the engine's
//! side: turning a row of the database's `heroes` table into the 32x32
//! OBJ cell the BTLPOSE primitive uploads.
//!
//! The `heroes` table is an ORDINARY database table the author creates
//! like any other; the one column this module reads is a `charset`
//! field, naming a block of the project's sprite sheet. Everything else
//! in it — max_hp, attack, whatever the author invents — is his data,
//! read by his events through "Lire la database".
//!
//! The cell is the charset's LEFT-facing idle frame (16x24) centred in
//! a 32x32 4bpp cell, the shape the engine's vignette path uploads.
//!
//! Also here: the damage popups' digit sheet, the other fixed sprite
//! asset the primitives need.

use std::path::Path;

use anyhow::{bail, Context, Result};

use crate::db::Db;
use crate::emit;
use crate::gfx::IndexedImage;

/// Battler cells kept in ROM. Four can be on screen at once (the OBJ
/// char rows and palettes BTLPOSE owns); this is how many DIFFERENT
/// characters a project can pose, party swaps included.
pub const MAX_BATTLERS: usize = 8;

pub struct Battler {
    pub cell: Vec<u8>, // 512 bytes: 32x32 4bpp, 16 chars row-major
    pub pal: Vec<u16>, // 16 colours (0 unused: OBJ transparent)
}

pub struct Battle {
    pub battlers: Vec<Battler>,
}

/// One 8x8 tile of an indexed canvas, encoded 4bpp SNES.
fn tile4(canvas: &[u8; 32 * 32], tx: usize, ty: usize) -> [u8; 32] {
    let mut out = [0u8; 32];
    for y in 0..8 {
        let (mut b0, mut b1, mut b2, mut b3) = (0u8, 0u8, 0u8, 0u8);
        for x in 0..8 {
            let c = canvas[(ty * 8 + y) * 32 + tx * 8 + x];
            let bit = 7 - x;
            b0 |= ((c >> 0) & 1) << bit;
            b1 |= ((c >> 1) & 1) << bit;
            b2 |= ((c >> 2) & 1) << bit;
            b3 |= ((c >> 3) & 1) << bit;
        }
        out[y * 2] = b0;
        out[y * 2 + 1] = b1;
        out[16 + y * 2] = b2;
        out[16 + y * 2 + 1] = b3;
    }
    out
}

/// A 32x32 battler cell from a charset block: the LEFT-facing idle
/// frame (the party faces the monsters), 16x24, centred.
fn battler_cell(sheet: &IndexedImage, block: usize) -> Result<(Vec<u8>, Vec<u16>)> {
    let frame = block * 12 + 6; // 12 frames a block, left idle = dir 2 * 3
    let sx = frame * 16;
    if sx + 16 > sheet.width || sheet.height < 24 {
        bail!("bloc charset {} hors de la planche de sprites", block);
    }
    let mut canvas = [0u8; 32 * 32];
    let mut pal: Vec<u16> = vec![0]; // index 0 = transparent
    let mut map = [0u8; 256];
    for y in 0..24 {
        for x in 0..16 {
            let src = sheet.pixels[y * sheet.width + sx + x] as usize;
            if src == 0 {
                continue;
            }
            if map[src] == 0 {
                if pal.len() >= 16 {
                    bail!("battler : plus de 15 couleurs dans le bloc {}", block);
                }
                map[src] = pal.len() as u8;
                pal.push(sheet.palette[src]);
            }
            canvas[(y + 4) * 32 + x + 8] = map[src];
        }
    }
    pal.resize(16, 0);
    let mut cell = Vec::with_capacity(512);
    for ty in 0..4 {
        for tx in 0..4 {
            cell.extend_from_slice(&tile4(&canvas, tx, ty));
        }
    }
    Ok((cell, pal))
}

/// Composes one battler cell per entry of the database's `heroes`
/// table. No table, or no `charset` column: no battlers, and BTLPOSE
/// stays inert — a project without a battle pays nothing.
pub fn build(
    charsets: &[String],
    sheet: &IndexedImage,
    db: Option<&Db>,
) -> Result<Option<Battle>> {
    let db = match db {
        Some(d) => d,
        None => return Ok(None),
    };
    let ti = match db.table_id("heroes") {
        Some(t) => t,
        None => return Ok(None),
    };
    let has_charset = db.schemas[ti].fields.iter().any(|f| f.ty == "charset");
    if !has_charset {
        return Ok(None);
    }
    let field = db.schemas[ti]
        .fields
        .iter()
        .find(|f| f.ty == "charset")
        .unwrap()
        .name
        .clone();
    let n = db.ids[ti].len();
    if n > MAX_BATTLERS {
        bail!(
            "table heroes : {} fiches — {} au maximum peuvent avoir un \
             combattant (mémoire des cellules 32x32)",
            n, MAX_BATTLERS
        );
    }
    let mut battlers = Vec::new();
    for e in 0..n {
        let id = &db.ids[ti][e];
        let cs = db.field_str(ti, e, &field).unwrap_or_default();
        if cs.is_empty() {
            bail!(
                "heroes « {} » : champ « {} » vide — la planche de sprites \
                 dont son combattant est tiré",
                id, field
            );
        }
        let block = charsets
            .iter()
            .position(|c| *c == cs)
            .with_context(|| {
                format!("heroes « {}» : planche de sprites « {} » inconnue du projet", id, cs)
            })?;
        let (cell, pal) = battler_cell(sheet, block)
            .with_context(|| format!("heroes « {} » : combattant", id))?;
        battlers.push(Battler { cell, pal });
    }
    if battlers.is_empty() {
        return Ok(None);
    }
    println!("  combat : {} combattant(s) (table heroes)", battlers.len());
    Ok(Some(Battle { battlers }))
}

/// The damage popups' digit glyphs (C4): 0-9 as 8x8 white-on-shadow
/// tiles, each on an EVEN char so a digit is a 16x16 small object
/// (OBJ_SIZE16_L32) whose other three chars stay transparent. A name
/// row holds 16 chars = 8 spaced glyphs: 0-7 take row 21 (bottom
/// halves on row 22, blank), 8-9 sit on row 23 as the bottom halves
/// of cells whose tiles point at row 22. 48 chars, 1536 bytes.
fn digit_cells() -> Vec<u8> {
    const GLYPHS: [[&str; 8]; 10] = [
        [".####...", "#....#..", "#...##..", "#..#.#..", "##...#..", "#....#..", ".####...", "........"],
        ["..##....", ".###....", "..##....", "..##....", "..##....", "..##....", "######..", "........"],
        [".####...", "#....#..", ".....#..", "...##...", "..#.....", ".#......", "######..", "........"],
        [".####...", "#....#..", "....#...", "..###...", ".....#..", "#....#..", ".####...", "........"],
        ["...##...", "..#.#...", ".#..#...", "#...#...", "######..", "....#...", "....#...", "........"],
        ["######..", "#.......", "#####...", ".....#..", ".....#..", "#....#..", ".####...", "........"],
        [".####...", "#.......", "#####...", "#....#..", "#....#..", "#....#..", ".####...", "........"],
        ["######..", ".....#..", "....#...", "...#....", "..##....", "..##....", "..##....", "........"],
        [".####...", "#....#..", ".####...", "#....#..", "#....#..", "#....#..", ".####...", "........"],
        [".####...", "#....#..", "#....#..", "#....#..", ".#####..", ".....#..", ".####...", "........"],
    ];
    let mut cells = Vec::with_capacity(1536);
    // canvas: 128 px wide (16 chars) x 24 px tall (3 char rows)
    let w = 128usize;
    let mut canvas = vec![0u8; w * 24];
    for (d, g) in GLYPHS.iter().enumerate() {
        let ox = (d % 8) * 16; // even char = 16 px step
        // 8-9 go to row 23 — the BOTTOM half of a cell whose tile
        // points at row 22 (blank). Row 22 must stay entirely blank:
        // it is the bottom half of every 0-7 cell, and the old layout
        // parked 8-9 there, so a popup showing a 0 or a 1 also showed
        // the top of an 8 or a 9 under it (latent since C4, caught by
        // V1's scripted popup). The engine offsets these two digits
        // 8 px up to compensate.
        let oy = (d / 8) * 16;
        for (y, line) in g.iter().enumerate() {
            for (x, c) in line.bytes().enumerate() {
                if c == b'#' {
                    canvas[(oy + y) * w + ox + x] = 2; // white
                    // drop shadow, bottom-right, where nothing is drawn
                    let (sx, sy) = (ox + x + 1, oy + y + 1);
                    if canvas[sy * w + sx] == 0 {
                        canvas[sy * w + sx] = 1;
                    }
                }
            }
        }
    }
    for ty in 0..3 {
        for tx in 0..16 {
            let mut out = [0u8; 32];
            for y in 0..8 {
                let (mut b0, mut b1, mut b2, mut b3) = (0u8, 0u8, 0u8, 0u8);
                for x in 0..8 {
                    let c = canvas[(ty * 8 + y) * w + tx * 8 + x];
                    let bit = 7 - x;
                    b0 |= (c & 1) << bit;
                    b1 |= ((c >> 1) & 1) << bit;
                    b2 |= ((c >> 2) & 1) << bit;
                    b3 |= ((c >> 3) & 1) << bit;
                }
                out[y * 2] = b0;
                out[y * 2 + 1] = b1;
                out[16 + y * 2] = b2;
                out[16 + y * 2 + 1] = b3;
            }
            cells.extend_from_slice(&out);
        }
    }
    cells
}

/// data_battle.c — ALWAYS emitted, zeroed when the project has no
/// `heroes` table, so btlprim.c links unconditionally (the m7/pictures
/// recipe). G1 diet: battler cells and palettes, one per table entry,
/// plus the popup digit sheet. Nothing else — troops, stats, skills,
/// menus and AI are the project's data and the project's events.
pub fn emit_files(b: Option<&Battle>) -> Vec<(String, String)> {
    let mut s = String::from(emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    match b {
        None => {
            s.push_str("const u8 btl_battler_count = 0;\n");
            s.push_str("const u8 *const btl_battler_cells[1] = { 0, };\n");
            s.push_str("const u16 btl_battler_pals[16] = { 0, };\n");
        }
        Some(b) => {
            let n = b.battlers.len();
            for (i, h) in b.battlers.iter().enumerate() {
                s.push_str(&emit::u8_array(&format!("btl_battler{}_cell", i), &h.cell, 16, false));
            }
            s.push_str(&format!("\nconst u8 btl_battler_count = {};\n", n));
            s.push_str(&format!("const u8 *const btl_battler_cells[{}] = {{ ", n));
            for i in 0..n {
                s.push_str(&format!("btl_battler{}_cell, ", i));
            }
            s.push_str("};\n");
            let mut pals: Vec<u16> = Vec::new();
            for h in &b.battlers {
                pals.extend_from_slice(&h.pal);
            }
            s.push_str(&emit::u16_array("btl_battler_pals", &pals));
        }
    }
    // The digit sheet is unconditional: POPUP is a generic primitive,
    // usable on any composed screen, battle or not.
    s.push_str(&emit::u8_array("btl_digit_cells", &digit_cells(), 16, false));
    // white digits, black drop shadow, on OBJ palette 4
    let dpal: Vec<u16> = vec![0, 0x0000, 0x7FFF, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    s.push_str(&emit::u16_array("btl_digit_pal", &dpal));
    vec![("data_battle.c".into(), s)]
}
