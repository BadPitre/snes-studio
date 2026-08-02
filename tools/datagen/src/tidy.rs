//! `datagen tidy` — files a project's assets/ folder by resource type.
//!
//! assets/ grew as the resource types arrived: sounds, music and vignettes
//! got a folder each, the six that came before and after did not. So a
//! project's assets/ root ends up mixing tilesets, their sidecars, their
//! autotile strips, pictures, the font, the icon sheet and the character
//! sheet — thirty files in the demo, and an author looking for their
//! picture has to know which name is which kind.
//!
//! A path lives in exactly three places, which is what makes this
//! mechanical rather than risky:
//!   project.json      the registers, and assets.{font,sprites,tileset}
//!   the tileset sidecars  their `autotiles` lists
//!   ui/layout.toml    the fonts named by dialogue styles and widgets (S2)
//! Scenes and events reference resources by NAME, never by path, so none of
//! them is touched.
//!
//! The plan is computed by PARSING those files, but applied by replacing
//! the quoted paths in the ORIGINAL text: serde_json without preserve_order
//! sorts an object's keys, so re-emitting project.json would reshuffle a
//! file the author reads and reviews. This way the diff shows the paths and
//! nothing else.
//!
//! Idempotent: a project already filed is left alone, so it is safe to run
//! twice, and safe to run on a project half-migrated by an interrupted go.
//!
//!     datagen tidy <project folder> [--dry-run]

use anyhow::{bail, Context, Result};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Where each resource type belongs. The names echo the resource manager's
/// categories and the existing folders (sounds, music, vignettes), so what
/// an author sees on disk matches what they see in the window.
const TILESETS: &str = "assets/tilesets";
const PICTURES: &str = "assets/pictures";
const FONTS: &str = "assets/fonts";
const ICONSETS: &str = "assets/iconsets";
const WINDOWSKINS: &str = "assets/windowskins";
const CHARSETS: &str = "assets/charsets";

pub fn run(proj: &Path, dry_run: bool) -> Result<()> {
    let pj = proj.join("project.json");
    let text = fs::read_to_string(&pj)
        .with_context(|| format!("reading {}", pj.display()))?;
    let json: serde_json::Value =
        serde_json::from_str(&text).with_context(|| format!("parsing {}", pj.display()))?;

    // old path -> new path, for every asset the project names
    let mut moves: BTreeMap<String, String> = BTreeMap::new();

    let plan = |rel: &str, dir: &str, moves: &mut BTreeMap<String, String>| -> String {
        let name = match Path::new(rel).file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => return rel.to_string(),
        };
        let dest = format!("{}/{}", dir, name);
        if dest != rel {
            moves.insert(rel.to_string(), dest.clone());
        }
        dest
    };

    // ---- the registers -------------------------------------------------
    for (key, dir) in [
        ("tilesets", TILESETS),
        ("windowskins", WINDOWSKINS),
        ("iconsets", ICONSETS),
        ("fonts", FONTS),
        ("vignettes", "assets/vignettes"),
        ("sounds", "assets/sounds"),
        ("musics", "assets/music"),
    ] {
        if let Some(arr) = json.get(key).and_then(|v| v.as_array()) {
            for e in arr.iter() {
                if let Some(rel) = e.as_str() {
                    plan(rel, dir, &mut moves);
                }
            }
        }
    }

    // Pictures: an entry is a bare path OR an object carrying its
    // transparency flag, and the shape has to survive.
    if let Some(arr) = json.get("pictures").and_then(|v| v.as_array()) {
        for e in arr.iter() {
            if let Some(rel) = e.as_str() {
                plan(rel, PICTURES, &mut moves);
            } else if let Some(rel) = e.get("path").and_then(|p| p.as_str()) {
                plan(rel, PICTURES, &mut moves);
            }
        }
    }

    // ---- assets.{font, sprites, tileset} -------------------------------
    for (field, dir) in
        [("font", FONTS), ("sprites", CHARSETS), ("tileset", TILESETS)]
    {
        let cur = json
            .get("assets")
            .and_then(|a| a.get(field))
            .and_then(|v| v.as_str())
            .map(str::to_string);
        if let Some(rel) = cur {
            plan(&rel, dir, &mut moves);
        }
    }

    // ---- the active theme and icon sheet -------------------------------
    for (field, dir) in [("windowskin", WINDOWSKINS), ("icons", ICONSETS)] {
        let cur = json
            .get("ui")
            .and_then(|u| u.get(field))
            .and_then(|v| v.as_str())
            .map(str::to_string);
        if let Some(rel) = cur {
            plan(&rel, dir, &mut moves);
        }
    }

    // ---- tileset sidecars ----------------------------------------------
    // The sidecar path is DERIVED from the PNG's (same stem, .json), so it
    // follows its tileset for free. Its autotile strips do not: they are
    // stored paths, and they belong beside the tileset they dress.
    let mut sidecars: Vec<(PathBuf, PathBuf, String)> = Vec::new();
    for (old_png, new_png) in moves.clone() {
        if !old_png.ends_with(".png") {
            continue;
        }
        let old_side = PathBuf::from(&old_png).with_extension("json");
        if !proj.join(&old_side).is_file() {
            continue;
        }
        let new_side = PathBuf::from(&new_png).with_extension("json");
        let raw = fs::read_to_string(proj.join(&old_side))
            .with_context(|| format!("reading {}", old_side.display()))?;
        let side: serde_json::Value = serde_json::from_str(&raw)
            .with_context(|| format!("parsing {}", old_side.display()))?;
        if let Some(arr) = side.get("autotiles").and_then(|v| v.as_array()) {
            for e in arr.iter() {
                if let Some(rel) = e.as_str() {
                    plan(rel, TILESETS, &mut moves);
                }
            }
        }
        sidecars.push((old_side, new_side, raw));
    }

    // ---- ui/layout.toml ------------------------------------------------
    // Dialogue styles and widgets name a font by path (S2). Rewritten as
    // plain text: the layout is hand-editable and re-emitting it from a
    // parsed model would reformat a file the author owns.
    let retarget = |text: &str, moves: &BTreeMap<String, String>| -> String {
        let mut t = text.to_string();
        for (old, new) in moves {
            t = t.replace(&format!("\"{}\"", old), &format!("\"{}\"", new));
        }
        t
    };
    let layout = proj.join("ui/layout.toml");
    let layout_new = if layout.is_file() {
        let raw = fs::read_to_string(&layout)?;
        let t = retarget(&raw, &moves);
        if t != raw { Some(t) } else { None }
    } else {
        None
    };

    if moves.is_empty() {
        println!("already filed: nothing to move in {}", proj.display());
        return Ok(());
    }

    // Refuse to overwrite: two resources with the same filename in
    // different folders would collide, and silently losing one of them is
    // not a tidy-up.
    for (old, new) in &moves {
        if !proj.join(old).is_file() {
            bail!("{} is named by the project but missing on disk", old);
        }
        if proj.join(new).exists() {
            bail!("{} already exists — refusing to overwrite it with {}", new, old);
        }
    }

    println!("{} file(s) to file:", moves.len());
    for (old, new) in &moves {
        println!("  {} -> {}", old, new);
    }
    if dry_run {
        println!("(dry run — nothing written)");
        return Ok(());
    }

    // Move the files first: if anything goes wrong the project.json still
    // describes the old layout, and a re-run finishes the job.
    for (old, new) in &moves {
        let dest = proj.join(new);
        fs::create_dir_all(dest.parent().unwrap())?;
        fs::rename(proj.join(old), &dest)
            .with_context(|| format!("moving {} to {}", old, new))?;
    }
    for (old, new, body) in &sidecars {
        fs::create_dir_all(proj.join(new).parent().unwrap())?;
        fs::write(proj.join(new), retarget(body, &moves))?;
        if old != new {
            let _ = fs::remove_file(proj.join(old));
        }
    }
    if let Some(t) = layout_new {
        fs::write(&layout, t)?;
    }
    fs::write(&pj, retarget(&text, &moves))?;

    println!("filed {} asset(s) in {}", moves.len(), proj.display());
    Ok(())
}
