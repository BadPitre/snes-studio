//! db.rs — « dbgen » : le système de Database (Phase 10).
//! Réf contractuelle : docs/PLANNING_SYSTEME_DATABASE.md.
//!
//! Lit `<projet>/schemas/*.toml` (types des tables) et
//! `<projet>/data/<table>.toml` (les instances), valide tout (bornes,
//! refs symboliques, unicité des ids), puis émet dans engine/src/data :
//!   - db_<table>.c   : la table byte-packed (une section ROM par table)
//!   - db_tables.h    : constantes <TABLE>_<ID>, tailles, offsets, extern
//!
//! Un projet sans dossier schemas/ n'a pas de database : rien n'est émis
//! (les éventuels db_* d'une génération précédente sont purgés).

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
    /// noms des bits d'un flags8 (8 max, bit i = flags[i])
    #[serde(default)]
    pub flags: Vec<String>,
    /// ref:/text_id : la valeur peut être absente (0xFF / 0xFFFF)
    #[serde(default)]
    pub optional: bool,
    /// documentaire (l'éditeur affiche « copié à l'instanciation »)
    #[serde(default)]
    #[allow(dead_code)]
    pub runtime_copy: bool,
    /// valeur pré-remplie à la création (et valeur d'un champ absent)
    #[serde(default)]
    pub default: Option<toml::Value>,
    /// resserrement des bornes numériques du type
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

/// Taille ROM d'un champ, en octets
fn field_size(ty: &str) -> Result<usize> {
    Ok(match ty {
        "u8" | "s8" | "flags8" => 1,
        "u16" | "s16" | "text_id" => 2,
        // B7 : ressources du projet par NOM — un index u8 en ROM
        // (l'ordre des listes de project.json, le même que les opcodes
        // SHOWPIC/PLAYSFX/PLAYBGM), 0xFF = absent (optional)
        "picture" | "sound" | "music" => 1,
        t if t.starts_with("ref:") => 1,
        other => bail!("type de champ inconnu : « {} »", other),
    })
}

/// Bornes numériques d'un type (min, max)
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
    /// par table : les ids symboliques dans l'ordre des index
    pub ids: Vec<Vec<String>>,
    /// par table : les entrées brutes — encodées par `encode` (les
    /// text_id demandent la banque de textes FINALE, close après les
    /// events), et par table : les octets encodés
    entries: Vec<Vec<toml::Table>>,
    pub blobs: Vec<Vec<u8>>,
}

impl Db {
    /// id de table (index du registre db_tables[], opcode DBREAD) par nom
    pub fn table_id(&self, name: &str) -> Option<usize> {
        self.schemas.iter().position(|s| s.name == name)
    }

    /// index d'une entrée par id symbolique
    pub fn entry_index(&self, table: usize, id: &str) -> Option<usize> {
        self.ids[table].iter().position(|s| s == id)
    }

    /// (offset, taille en octets) d'un champ d'une table
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

/// Charge et valide schémas + instances (tout SAUF la résolution des
/// text_id — voir `encode`). `Ok(None)` = pas de database.
pub fn load(proj_dir: &Path) -> Result<Option<Db>> {
    let schema_dir = proj_dir.join("schemas");
    if !schema_dir.is_dir() {
        return Ok(None);
    }

    // Schémas, par ordre alphabétique de fichier (ordre déterministe)
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

    // refs : les tables cibles doivent exister
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

    // Instances : d'abord tous les ids (les refs croisées doivent voir
    // toutes les tables), puis l'encodage
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

/// Encodage byte-packed, champ par champ dans l'ordre du schéma — à
/// appeler quand la banque de textes est CLOSE (text_id résolus ici).
/// Noms des ressources du projet (B7) — l'index dans chaque liste est
/// la valeur ROM des champs picture/sound/music
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
                        // B7 : nom -> index de la liste projet (0xFF = absent)
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
                        // ref:<table> (seul cas restant après field_size)
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

/// Taille d'une entrée d'un schéma, en octets
pub fn entry_size(sc: &Schema) -> usize {
    sc.fields.iter().map(|f| field_size(&f.ty).unwrap_or(0)).sum()
}

/// db_index.c + db_tables.h d'un projet SANS database : le registre vide
/// (le moteur les inclut inconditionnellement — opcode DBREAD, v0.17)
pub fn emit_empty() -> Vec<(String, String)> {
    let mut h = String::from(emit::HEADER);
    h.push_str("#ifndef DB_TABLES_H\n#define DB_TABLES_H\n\n#define DB_TABLE_COUNT 0\n");
    h.push_str("extern const u8 *const db_tables[];\nextern const u8 db_table_sizes[];\nextern const u8 db_table_counts[];\n\n#endif /* DB_TABLES_H */\n");
    let mut c = String::from(emit::HEADER);
    c.push_str("#include <snes.h>\n\nconst u8 *const db_tables[1] = { 0 };\nconst u8 db_table_sizes[1] = { 0 };\nconst u8 db_table_counts[1] = { 0 };\n");
    vec![("db_index.c".to_string(), c), ("db_tables.h".to_string(), h)]
}

/// Émet db_<table>.c (un par table) + db_index.c (registre pour DBREAD)
/// + db_tables.h — (nom, contenu)
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
            // table vide : un octet, jamais lu (un tableau C vide est invalide)
            let _ = write!(c, "const u8 db_{}[1] = {{ 0x00 }};\n", sc.name);
        } else {
            c.push_str(&emit::u8_array(&format!("db_{}", sc.name), &db.blobs[ti], 16, false));
        }
        files.push((format!("db_{}.c", sc.name), c));
    }
    h.push_str("#endif /* DB_TABLES_H */\n");
    files.push(("db_tables.h".to_string(), h));

    // registre des tables (opcode DBREAD, v0.17) : id de table = index
    // dans l'ordre des schémas (alphabétique, stable)
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
