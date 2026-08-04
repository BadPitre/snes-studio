//! "dbgen": the Database system.
//! Contractual reference: docs/PLANNING_SYSTEME_DATABASE.md.
//!
//! Reads `<project>/schemas/*.toml` (table types) and
//! `<project>/data/<table>.toml` (the instances), validates everything
//! (bounds, symbolic refs, id uniqueness), then emits into engine/src/data:
//!   - db_<table>.c   the byte-packed table, one ROM section per table
//!   - db_tables.h    <TABLE>_<ID> constants, sizes, offsets, externs
//!
//! A project with no schemas/ directory has no database: nothing is
//! emitted, and any db_* left from a previous run is purged.

use crate::emit;
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::fmt::Write as _;
use std::path::Path;

#[derive(Deserialize)]
pub struct Schema {
    pub name: String,
    #[serde(default)]
    #[allow(dead_code)] // titre UI (éditeur) — pas utilisé par dbgen
    pub title: String,
    #[serde(default = "default_max")]
    pub max: u32,
    #[serde(default)]
    pub fields: Vec<Field>,
}

fn default_max() -> u32 {
    255
}

#[derive(Deserialize)]
pub struct Field {
    pub name: String,
    #[serde(rename = "type")]
    pub ty: String,
    /// Names of a flags8's bits (at most 8; bit i is flags[i]).
    #[serde(default)]
    pub flags: Vec<String>,
    /// For ref: and text_id, the value may be absent (0xFF / 0xFFFF).
    #[serde(default)]
    pub optional: bool,
    /// Documentary: the editor shows "copied on instantiation".
    #[serde(default)]
    #[allow(dead_code)]
    pub runtime_copy: bool,
    /// Value pre-filled on creation, and the value of an absent field.
    #[serde(default)]
    pub default: Option<toml::Value>,
    /// Tightens the type's numeric bounds.
    #[serde(default)]
    pub min: Option<i64>,
    #[serde(default)]
    pub max: Option<i64>,
}

#[derive(Deserialize)]
struct DataFile {
    #[serde(default)]
    entry: Vec<toml::Table>,
}

fn is_snake(s: &str) -> bool {
    !s.is_empty()
        && s.chars().next().unwrap().is_ascii_lowercase()
        && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

/// ROM size of a field, in bytes.
fn field_size(ty: &str) -> Result<usize> {
    Ok(match ty {
        "u8" | "s8" | "flags8" => 1,
        "u16" | "s16" | "text_id" => 2,
        // Project resources by NAME become a u8 index in ROM: the order
        // of the project.json lists, the same one the SHOWPIC/PLAYSFX/
        // PLAYBGM opcodes use. 0xFF means absent (optional).
        "picture" | "sound" | "music" => 1,
        t if t.starts_with("ref:") => 1,
        other => bail!("type de champ inconnu : « {} »", other),
    })
}

/// Numeric bounds of a type, as (min, max).
fn type_bounds(ty: &str) -> (i64, i64) {
    match ty {
        "u8" => (0, 255),
        "u16" => (0, 65535),
        "s8" => (-128, 127),
        _ => (-32768, 32767), // s16
    }
}

pub struct Db {
    pub schemas: Vec<Schema>,
    /// Per table: symbolic ids in index order.
    pub ids: Vec<Vec<String>>,
    /// Per table: the raw entries. `encode` turns them into bytes, and
    /// needs the FINAL text bank — closed after the events — to resolve
    /// text_id. The encoded bytes go here too.
    entries: Vec<Vec<toml::Table>>,
    pub blobs: Vec<Vec<u8>>,
}

impl Db {
    /// Table id (index into db_tables[], used by DBREAD), keyed by name.
    pub fn table_id(&self, name: &str) -> Option<usize> {
        self.schemas.iter().position(|s| s.name == name)
    }

    /// Entry index, keyed by symbolic id.
    pub fn entry_index(&self, table: usize, id: &str) -> Option<usize> {
        self.ids[table].iter().position(|s| s == id)
    }

    /// A STRING field of one entry, raw from the TOML — for build-time
    /// consumers that resolve resources by name (the battle module reads
    /// a monster's battle_pic to pose it). None when absent or not a
    /// string.
    pub fn field_str(&self, table: usize, entry: usize, field: &str) -> Option<String> {
        self.entries[table]
            .get(entry)?
            .get(field)?
            .as_str()
            .map(|s| s.to_string())
    }

    /// An INTEGER field of one entry, raw from the TOML (or the schema
    /// default when the entry omits it). For build-time consumers — the
    /// battle module bakes monster stats into troop tables.
    pub fn field_int(&self, table: usize, entry: usize, field: &str) -> Option<i64> {
        let e = self.entries[table].get(entry)?;
        if let Some(v) = e.get(field).and_then(|v| v.as_integer()) {
            return Some(v);
        }
        self.schemas[table]
            .fields
            .iter()
            .find(|f| f.name == field)
            .and_then(|f| f.default.as_ref())
            .and_then(|d| d.as_integer())
    }

    /// (offset, size in bytes) of a table's field.
    pub fn field_info(&self, table: usize, field: &str) -> Option<(usize, usize)> {
        let mut ofs = 0usize;
        for f in &self.schemas[table].fields {
            let sz = field_size(&f.ty).ok()?;
            if f.name == field {
                return Some((ofs, sz));
            }
            ofs += sz;
        }
        None
    }
}

/// Loads and validates schemas and instances — everything EXCEPT text_id
/// resolution, which `encode` does. `Ok(None)` means no database.
pub fn load(proj_dir: &Path) -> Result<Option<Db>> {
    let schema_dir = proj_dir.join("schemas");
    if !schema_dir.is_dir() {
        return Ok(None);
    }

    // Schemas in alphabetical file order, so the output is deterministic.
    let mut paths: Vec<_> = std::fs::read_dir(&schema_dir)?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("toml"))
        .collect();
    paths.sort();
    let mut schemas = Vec::new();
    for p in &paths {
        let src = std::fs::read_to_string(p)
            .with_context(|| format!("lecture de {}", p.display()))?;
        let sc: Schema = toml::from_str(&src)
            .with_context(|| format!("schema {}", p.display()))?;
        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("");
        if sc.name != stem {
            bail!(
                "schema {} : name = \"{}\" doit etre le nom du fichier (\"{}\")",
                p.display(), sc.name, stem
            );
        }
        if !is_snake(&sc.name) {
            bail!("schema {} : nom de table non snake_case", p.display());
        }
        if sc.max == 0 || sc.max > 255 {
            bail!("schema {} : max = {} (1-255)", p.display(), sc.max);
        }
        if sc.fields.is_empty() {
            bail!("schema {} : aucun champ", p.display());
        }
        let mut seen = HashSet::new();
        for f in &sc.fields {
            if !is_snake(&f.name) {
                bail!("schema {} : champ « {} » non snake_case", sc.name, f.name);
            }
            if !seen.insert(f.name.clone()) {
                bail!("schema {} : champ « {} » en double", sc.name, f.name);
            }
            field_size(&f.ty).with_context(|| {
                format!("schema {}, champ « {} »", sc.name, f.name)
            })?;
            if f.ty == "flags8" && (f.flags.is_empty() || f.flags.len() > 8) {
                bail!(
                    "schema {}, champ « {} » : flags8 demande 1 a 8 noms",
                    sc.name, f.name
                );
            }
            let is_res = matches!(f.ty.as_str(), "picture" | "sound" | "music");
            if f.optional && !(f.ty.starts_with("ref:") || f.ty == "text_id" || is_res) {
                bail!(
                    "schema {}, champ « {} » : optional est reserve aux \
                     ref:/text_id/ressources",
                    sc.name, f.name
                );
            }
        }
        schemas.push(sc);
    }
    let table_idx: HashMap<String, usize> = schemas
        .iter()
        .enumerate()
        .map(|(i, s)| (s.name.clone(), i))
        .collect();

    // refs: the target tables must exist
    for sc in &schemas {
        for f in &sc.fields {
            if let Some(target) = f.ty.strip_prefix("ref:") {
                if !table_idx.contains_key(target) {
                    bail!(
                        "schema {}, champ « {} » : table cible « {} » inconnue",
                        sc.name, f.name, target
                    );
                }
            }
        }
    }

    // Instances: collect every id first, so cross-refs can see all the
    // tables, then encode.
    let mut entries: Vec<Vec<toml::Table>> = Vec::new();
    let mut ids: Vec<Vec<String>> = Vec::new();
    for sc in &schemas {
        let p = proj_dir.join("data").join(format!("{}.toml", sc.name));
        let list = if p.is_file() {
            let src = std::fs::read_to_string(&p)
                .with_context(|| format!("lecture de {}", p.display()))?;
            let df: DataFile =
                toml::from_str(&src).with_context(|| format!("data {}", p.display()))?;
            df.entry
        } else {
            Vec::new()
        };
        if list.len() as u32 > sc.max {
            bail!(
                "data/{}.toml : {} entrees, le schema en permet {}",
                sc.name, list.len(), sc.max
            );
        }
        let mut tids = Vec::new();
        let mut seen = HashSet::new();
        for e in &list {
            let id = e
                .get("id")
                .and_then(|v| v.as_str())
                .with_context(|| format!("data/{}.toml : entree sans id", sc.name))?;
            if !is_snake(id) {
                bail!("data/{}.toml : id « {} » non snake_case", sc.name, id);
            }
            if !seen.insert(id.to_string()) {
                bail!("data/{}.toml : id « {} » en double", sc.name, id);
            }
            tids.push(id.to_string());
        }
        ids.push(tids);
        entries.push(list);
    }

    Ok(Some(Db { schemas, ids, entries, blobs: Vec::new() }))
}

/// Byte-packed encoding, field by field in schema order. Call once the
/// text bank is CLOSED — text_id is resolved here.
/// The project resource names are passed in: a field's ROM value is its
/// index in the matching list (picture/sound/music).
pub struct ResNames<'a> {
    pub pictures: &'a [String],
    pub sounds: &'a [String],
    pub musics: &'a [String],
}

pub fn encode(db: &mut Db, text_ids: &HashMap<String, u16>, res: &ResNames) -> Result<()> {
    let Db { schemas, ids, entries, blobs } = db;
    let table_idx: HashMap<String, usize> = schemas
        .iter()
        .enumerate()
        .map(|(i, s)| (s.name.clone(), i))
        .collect();
    let id_index: Vec<HashMap<&str, usize>> = ids
        .iter()
        .map(|t| t.iter().enumerate().map(|(i, s)| (s.as_str(), i)).collect())
        .collect();

    for (ti, sc) in schemas.iter().enumerate() {
        let mut blob = Vec::new();
        for (ei, e) in entries[ti].iter().enumerate() {
            for key in e.keys() {
                if key != "id" && key != "name" && !sc.fields.iter().any(|f| &f.name == key) {
                    bail!(
                        "data/{}.toml : entree « {} », champ inconnu « {} »",
                        sc.name, ids[ti][ei], key
                    );
                }
            }
            for f in &sc.fields {
                let raw = e.get(&f.name).or(f.default.as_ref());
                let ctx = || format!("data/{}.toml : entree « {} », champ « {} »",
                                     sc.name, ids[ti][ei], f.name);
                match f.ty.as_str() {
                    "u8" | "u16" | "s8" | "s16" => {
                        let v = match raw {
                            None => 0,
                            Some(v) => v.as_integer().with_context(|| {
                                format!("{} : nombre attendu", ctx())
                            })?,
                        };
                        let (mut lo, mut hi) = type_bounds(&f.ty);
                        if let Some(m) = f.min { lo = lo.max(m); }
                        if let Some(m) = f.max { hi = hi.min(m); }
                        if v < lo || v > hi {
                            bail!("{} : {} hors bornes ({}..{})", ctx(), v, lo, hi);
                        }
                        let sz = field_size(&f.ty)?;
                        blob.push((v & 0xFF) as u8);
                        if sz == 2 {
                            blob.push(((v >> 8) & 0xFF) as u8);
                        }
                    }
                    "flags8" => {
                        let mut byte = 0u8;
                        if let Some(v) = raw {
                            let arr = v.as_array().with_context(|| {
                                format!("{} : liste de noms de flags attendue", ctx())
                            })?;
                            for it in arr {
                                let s = it.as_str().with_context(|| {
                                    format!("{} : noms de flags (chaines)", ctx())
                                })?;
                                let bit = f.flags.iter().position(|x| x == s)
                                    .with_context(|| {
                                        format!("{} : flag inconnu « {} »", ctx(), s)
                                    })?;
                                byte |= 1 << bit;
                            }
                        }
                        blob.push(byte);
                    }
                    "picture" | "sound" | "music" => {
                        // name -> index in the project list (0xFF absent)
                        let (list, what): (&[String], &str) = match f.ty.as_str() {
                            "picture" => (res.pictures, "picture"),
                            "sound" => (res.sounds, "son"),
                            _ => (res.musics, "musique"),
                        };
                        match raw.and_then(|v| v.as_str()) {
                            None | Some("") => {
                                if !f.optional {
                                    bail!("{} : {} requis(e)", ctx(), what);
                                }
                                blob.push(0xFF);
                            }
                            Some(name) => {
                                let idx = list.iter().position(|n| n == name)
                                    .with_context(|| {
                                        format!(
                                            "{} : {} « {} » introuvable au projet \
                                             (supprimee ou renommee ?)",
                                            ctx(), what, name
                                        )
                                    })?;
                                blob.push(idx as u8);
                            }
                        }
                    }
                    "text_id" => match raw.and_then(|v| v.as_str()) {
                        None | Some("") => {
                            if !f.optional {
                                bail!("{} : nom de texte requis", ctx());
                            }
                            blob.extend_from_slice(&0xFFFFu16.to_le_bytes());
                        }
                        Some(name) => {
                            let tid = *text_ids.get(name).with_context(|| {
                                format!("{} : texte inconnu « {} »", ctx(), name)
                            })?;
                            blob.extend_from_slice(&tid.to_le_bytes());
                        }
                    },
                    t => {
                        // ref:<table>, the only case left after field_size
                        let target = t.strip_prefix("ref:").unwrap();
                        let tt = table_idx[target];
                        match raw.and_then(|v| v.as_str()) {
                            None | Some("") => {
                                if !f.optional {
                                    bail!("{} : ref « {} » requise", ctx(), target);
                                }
                                blob.push(0xFF);
                            }
                            Some(rid) => {
                                let idx = *id_index[tt].get(rid).with_context(|| {
                                    format!("{} : « {} » absent de la table {}",
                                            ctx(), rid, target)
                                })?;
                                blob.push(idx as u8);
                            }
                        }
                    }
                }
            }
        }
        if blob.len() > 32000 {
            bail!("table {} : {} octets > 32 Ko (section ROM)", sc.name, blob.len());
        }
        blobs.push(blob);
    }

    Ok(())
}

/// Size of one entry of a schema, in bytes.
pub fn entry_size(sc: &Schema) -> usize {
    sc.fields.iter().map(|f| field_size(&f.ty).unwrap_or(0)).sum()
}

/// db_index.c and db_tables.h for a project with NO database: an empty
/// registry. The engine includes them unconditionally (DBREAD).
pub fn emit_empty() -> Vec<(String, String)> {
    let mut h = String::from(emit::HEADER);
    h.push_str("#ifndef DB_TABLES_H\n#define DB_TABLES_H\n\n#define DB_TABLE_COUNT 0\n");
    h.push_str("extern const u8 *const db_tables[];\nextern const u8 db_table_sizes[];\nextern const u8 db_table_counts[];\n\n#endif /* DB_TABLES_H */\n");
    let mut c = String::from(emit::HEADER);
    c.push_str("#include <snes.h>\n\nconst u8 *const db_tables[1] = { 0 };\nconst u8 db_table_sizes[1] = { 0 };\nconst u8 db_table_counts[1] = { 0 };\n");
    vec![("db_index.c".to_string(), c), ("db_tables.h".to_string(), h)]
}

/// Emits db_<table>.c (one per table), db_index.c (the DBREAD registry)
/// and db_tables.h, as (name, contents).
pub fn emit_files(db: &Db) -> Vec<(String, String)> {
    let mut files = Vec::new();
    let mut h = String::from(emit::HEADER);
    h.push_str("#ifndef DB_TABLES_H\n#define DB_TABLES_H\n\n");
    let _ = write!(h, "#define DB_TABLE_COUNT {}\n", db.schemas.len());
    h.push_str("extern const u8 *const db_tables[];\nextern const u8 db_table_sizes[];\nextern const u8 db_table_counts[];\n\n");
    for (ti, sc) in db.schemas.iter().enumerate() {
        let up = sc.name.to_uppercase();
        let esz = entry_size(sc);
        let _ = write!(
            h,
            "/* table {} — {} entree(s) x {} octet(s) */\n#define DB_{}_COUNT {}\n#define DB_{}_SIZE {}\n",
            sc.name, db.ids[ti].len(), esz, up, db.ids[ti].len(), up, esz
        );
        let mut ofs = 0usize;
        for f in &sc.fields {
            let _ = write!(h, "#define DB_{}_{} {}\n", up, f.name.to_uppercase(), ofs);
            ofs += field_size(&f.ty).unwrap_or(0);
        }
        for (i, id) in db.ids[ti].iter().enumerate() {
            let _ = write!(h, "#define {}_{} {}\n", up, id.to_uppercase(), i);
        }
        let _ = write!(h, "extern const u8 db_{}[];\n\n", sc.name);

        let mut c = String::from(emit::HEADER);
        c.push_str("#include <snes.h>\n\n");
        if db.blobs[ti].is_empty() {
            // Empty table: one byte, never read — an empty C array is invalid.
            let _ = write!(c, "const u8 db_{}[1] = {{ 0x00 }};\n", sc.name);
        } else {
            c.push_str(&emit::u8_array(&format!("db_{}", sc.name), &db.blobs[ti], 16, false));
        }
        files.push((format!("db_{}.c", sc.name), c));
    }
    h.push_str("#endif /* DB_TABLES_H */\n");
    files.push(("db_tables.h".to_string(), h));

    // Table registry (DBREAD): a table's id is its index in schema order,
    // which is alphabetical and therefore stable.
    let mut c = String::from(emit::HEADER);
    c.push_str("#include <snes.h>\n#include \"db_tables.h\"\n\n");
    c.push_str("const u8 *const db_tables[] = {\n");
    for sc in &db.schemas {
        let _ = write!(c, "  db_{},\n", sc.name);
    }
    c.push_str("};\nconst u8 db_table_sizes[] = {\n ");
    for sc in &db.schemas {
        let _ = write!(c, " {},", entry_size(sc));
    }
    c.push_str("\n};\nconst u8 db_table_counts[] = {\n ");
    for (ti, _) in db.schemas.iter().enumerate() {
        let _ = write!(c, " {},", db.ids[ti].len());
    }
    c.push_str("\n};\n");
    files.push(("db_index.c".to_string(), c));
    files
}
