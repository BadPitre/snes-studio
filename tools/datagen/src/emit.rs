//! Émission des fichiers C de données (formats de la Phase 1, réf
//! docs/SPEC_FORMATS.md). Sortie stable et déterministe : mêmes entrées →
//! mêmes octets.

use std::fmt::Write;

pub const HEADER: &str = "/*\n * FICHIER GENERE par tools/datagen — NE PAS EDITER A LA MAIN.\n * Source : demo/ (projet JSON/PNG). Regenerer : make data (ou cargo run).\n */\n";

pub fn u8_array(name: &str, data: &[u8], cols: usize, static_: bool) -> String {
    let mut s = String::new();
    let prefix = if static_ { "static " } else { "" };
    let _ = write!(s, "{}const u8 {}[] = {{\n", prefix, name);
    for chunk in data.chunks(cols) {
        s.push_str("  ");
        for b in chunk {
            let _ = write!(s, "0x{:02X}, ", b);
        }
        s.pop();
        s.push('\n');
    }
    s.push_str("};\n");
    s
}

/// Tableau u8 mis en page en grille (tilemaps : une rangée de map par ligne)
pub fn u8_grid(name: &str, rows: &[Vec<u8>], static_: bool) -> String {
    let mut s = String::new();
    let prefix = if static_ { "static " } else { "" };
    let _ = write!(
        s,
        "{}const u8 {}[{} * {}] = {{\n",
        prefix,
        name,
        rows[0].len(),
        rows.len()
    );
    for row in rows {
        s.push_str("  ");
        for v in row {
            let _ = write!(s, "{}, ", v);
        }
        s.pop();
        s.push('\n');
    }
    s.push_str("};\n");
    s
}

pub fn u16_array(name: &str, data: &[u16]) -> String {
    let mut s = String::new();
    let _ = write!(s, "const u16 {}[{}] = {{\n", name, data.len());
    for chunk in data.chunks(8) {
        s.push_str("  ");
        for v in chunk {
            let _ = write!(s, "0x{:04X}, ", v);
        }
        s.pop();
        s.push('\n');
    }
    s.push_str("};\n");
    s
}

/// Chaîne C échappée (textes ASCII, spec §2 : accents interdits en v0)
pub fn c_string(text: &str) -> String {
    let mut s = String::from("\"");
    for ch in text.chars() {
        match ch {
            '"' => s.push_str("\\\""),
            '\\' => s.push_str("\\\\"),
            c if (' '..='~').contains(&c) => s.push(c),
            c => panic!("caractère non-ASCII dans un texte : '{}' (v0 : ASCII 32-126)", c),
        }
    }
    s.push('"');
    s
}
