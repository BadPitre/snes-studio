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

