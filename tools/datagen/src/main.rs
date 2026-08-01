//! datagen — source project (JSON plus indexed PNGs) to engine data.
//!
//! Usage: datagen <project_dir> <engine_dir>
//!   e.g.  datagen demo engine
//!
//! Outputs:
//!  - engine/src/data/scenes.bin and texts.bin — the byte-exact binary
//!    format (spec §1-2), pinned to banks $82/$86 by
//!    src/data/databanks.asm
//!  - engine/src/data/*.c — graphics and tables as generated C

mod binbank;
mod charset;
mod chipset;
mod db;
mod emit;
mod events;
mod gfx;
mod project;
mod script;
mod sfx;
mod tileset;
mod ui;

use anyhow::{bail, Context, Result};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() >= 2 && args[1] == "import-chipset" {
        if args.len() != 5 {
            bail!("usage : datagen import-chipset <chipset.png> <dossier_projet> <nom>");
        }
        return chipset::import(Path::new(&args[2]), Path::new(&args[3]), &args[4]);
    }
    if args.len() >= 2 && args[1] == "import-charset" {
        if args.len() != 6 {
            bail!(
                "usage : datagen import-charset <charset.png> <dossier_projet> \
                 <personnage 0-7> <bloc 0-4>"
            );
        }
        let perso: usize = args[4].parse().context("personnage : nombre attendu")?;
        let bloc: usize = args[5].parse().context("bloc : nombre attendu")?;
        return charset::import(Path::new(&args[2]), Path::new(&args[3]), perso, bloc);
    }
    // --debug burns the debug-menu flag into the ROM. It comes from the
    // editor's "Play" button, never from the cartridge build — a
    // cartridge must not ship the menu.
    let debug_rom = args.iter().any(|a| a == "--debug");
    let args: Vec<String> = args.into_iter().filter(|a| a != "--debug").collect();
    if args.len() != 3 {
        bail!(
            "usage : datagen <dossier_projet> <dossier_engine> [--debug]\n\
             \x20       datagen import-chipset <chipset.png> <dossier_projet> <nom>\n\
             \x20       datagen import-charset <charset.png> <dossier_projet> <perso> <bloc>"
        );
    }
    let proj_dir = PathBuf::from(&args[1]);
    let engine_dir = PathBuf::from(&args[2]);
    let out_dir = engine_dir.join("src/data");

    let project: project::Project =
        read_json(&proj_dir.join("project.json")).context("project.json")?;
    let mut texts: Vec<project::TextEntry> =
        read_json(&proj_dir.join("texts.json")).context("texts.json")?;
    // The database loads BEFORE the events (db_read resolves tables,
    // entries and fields) and is encoded AFTER, against a closed text bank.
    let mut database = db::load(&proj_dir)?;
    let mut scene_gfx_blocks: Vec<Vec<u8>> = Vec::new();

    // The UI layout loads EARLY: the "show a UI widget" event command
    // resolves widget names to their indices.
    let ui_icon_count = match project.ui.as_ref().and_then(|u| u.icons.as_ref()) {
        Some(path) => gfx::load_indexed_png(&proj_dir.join(path))?.width / 8,
        None => 0,
    };
    // Images of "Image" widgets in picture mode are mapped to the font's
    // palette — the UI layer has only 4 colours — so the layout needs
    // that palette as soon as it loads.
    let ui_font_pal = gfx::load_indexed_png(&proj_dir.join(&project.assets.font))
        .with_context(|| format!("fonte {}", project.assets.font))?
        .palette_n(4);
    let ui_pic_paths: HashMap<String, String> = project
        .pictures
        .iter()
        .map(|p| {
            let p = p.path().to_string();
            let stem = std::path::Path::new(&p)
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            (stem, p)
        })
        .collect();
    let (ui_layout, mut ui_prims, ui_widgets, ui_pics) =
        ui::load(&proj_dir, ui_icon_count, &ui_pic_paths, &ui_font_pal)?;
    let ui_widget_ids: Vec<String> = ui_widgets.iter().map(|w| w.0.clone()).collect();
    let ui_style_ids: Vec<String> =
        ui_layout.dialog_style.iter().map(|st| st.id.clone()).collect();

    // BG3 VRAM plan (char bases, budget 256): font 0 (97 chars, a
    // transparent one plus 96 glyphs) | skins (9 chars each) | icons
    // (2 x N: normal, then panel-background variants) | extra fonts
    // (96 chars, based on ' ').
    let theme_skin = project.ui.as_ref().and_then(|u| u.windowskin.clone());
    let mut ui_fonts: Vec<String> = vec![project.assets.font.clone()];
    let mut ui_skins: Vec<String> = Vec::new();
    if let Some(skn) = &theme_skin {
        ui_skins.push(skn.clone());
    }
    for st in &ui_layout.dialog_style {
        if let Some(f) = &st.font {
            if !ui_fonts.contains(f) {
                ui_fonts.push(f.clone());
            }
        }
        if let Some(k) = &st.windowskin {
            if !ui_skins.contains(k) {
                ui_skins.push(k.clone());
            }
        }
    }
    // WIDGET fonts, deduplicated against the style fonts
    for p in &ui_prims {
        if let Some(f) = &p.font {
            if !ui_fonts.contains(f) {
                ui_fonts.push(f.clone());
            }
        }
    }
    let ui_skin_base = |path: &Option<String>| -> usize {
        // a skin's base char (0 means a solid box); the theme's if absent
        let p = path.as_ref().or(theme_skin.as_ref());
        match p {
            Some(p) => ui_skins.iter().position(|k| k == p).map(|i| 97 + 9 * i).unwrap_or(0),
            None => 0,
        }
    };
    let ui_icon_base = 97 + 9 * ui_skins.len();
    let ui_font_base = |path: &Option<String>| -> usize {
        match path {
            None => 1,
            Some(p) => {
                let i = ui_fonts.iter().position(|f| f == p).unwrap_or(0);
                if i == 0 { 1 } else { ui_icon_base + 2 * ui_icon_count + 96 * (i - 1) }
            }
        }
    };
    // Widget images (picture mode): their chars sit AFTER the extra
    // fonts. Until now the primitives only carried the image's index;
    // it is replaced here by the final base char.
    let ui_pic_base = ui_icon_base + 2 * ui_icon_count + 96 * (ui_fonts.len() - 1);
    let mut ui_pic_offsets: Vec<usize> = Vec::new();
    let mut ui_pic_chars = 0usize;
    for (_, chars, _, _) in ui_pics.iter() {
        ui_pic_offsets.push(ui_pic_chars);
        ui_pic_chars += chars.len() / 16; /* 16 octets par char 2bpp */
    }
    for p in ui_prims.iter_mut() {
        if p.kind == 8 {
            p.icon = (ui_pic_base + ui_pic_offsets[p.icon as usize]) as u8;
        }
    }
    let ui_prims = ui_prims;
    let ui_total_chars = ui_pic_base + ui_pic_chars;
    if ui_total_chars > 256 {
        bail!(
            "ui : budget de caracteres BG3 depasse ({} > 256) — fonte(s) {} x 96, \
             skin(s) {} x 9, {} icone(s) x 2, {} image(s) de widget = {} chars. \
             Retirer un style, une fonte, des icones, ou reduire une image.",
            ui_total_chars, ui_fonts.len(), ui_skins.len(), ui_icon_count,
            ui_pics.len(), ui_pic_chars
        );
    }
    if ui_pic_chars > 0 {
        println!(
            "  ui : {} image(s) de widget -> {} chars BG3 ({} / 256 utilises)",
            ui_pics.len(), ui_pic_chars, ui_total_chars
        );
    }
    // Style tables: style 0 (default), then the dialog_style entries
    let ui_msg = ui_layout.message.clone().unwrap();
    let ui_chc = ui_layout.choice.clone().unwrap();
    let mut ui_style_rows: Vec<(ui::Win, ui::Win, usize, usize)> = vec![(
        ui_msg.clone(),
        ui_chc.clone(),
        1,
        ui_skin_base(&None),
    )];
    for st in &ui_layout.dialog_style {
        let m = st.message.clone().unwrap_or_else(|| ui_msg.clone());
        let c = st.choice.clone().unwrap_or_else(|| m.clone());
        ui_style_rows.push((m, c, ui_font_base(&st.font), ui_skin_base(&st.windowskin)));
    }

    // Pictures: indexed PNGs of at most 16 colours, compiled to
    // deduplicated 4bpp chars plus a tilemap and a palette. pic_show
    // commands reference them by stem; loaded BEFORE the scenes.
    let mut pic_names: Vec<String> = Vec::new();
    let mut pic_dims: Vec<(usize, usize)> = Vec::new();
    let mut pic_trans: Vec<bool> = Vec::new();
    let mut pic_data: Vec<(Vec<u8>, Vec<u16>, Vec<u16>)> = Vec::new();
    for entry in &project.pictures {
        let rel = entry.path();
        let stem = Path::new(rel)
            .file_stem()
            .and_then(|s| s.to_str())
            .with_context(|| format!("picture '{}' : nom illisible", rel))?
            .to_string();
        if pic_names.contains(&stem) {
            bail!("picture '{}' : stem en double", stem);
        }
        let img = gfx::load_indexed_png(&proj_dir.join(rel))
            .with_context(|| format!("picture '{}'", rel))?;
        pic_dims.push((img.width, img.height));
        pic_data
            .push(img.to_picture(entry.trans()).with_context(|| format!("picture '{}'", rel))?);
        pic_names.push(stem);
        pic_trans.push(entry.trans());
    }
    if pic_names.len() > 32 {
        bail!("{} pictures (max 32)", pic_names.len());
    }

    // Vignettes: strips of 32x32 OBJ sprite frames; vig_show commands
    // reference them by stem
    let mut vig_names: Vec<String> = Vec::new();
    let mut vig_data: Vec<(Vec<u8>, usize, Vec<u16>)> = Vec::new();
    for rel in &project.vignettes {
        let stem = Path::new(rel)
            .file_stem()
            .and_then(|s| s.to_str())
            .with_context(|| format!("vignette '{}' : nom illisible", rel))?
            .to_string();
        if vig_names.contains(&stem) {
            bail!("vignette '{}' : stem en double", stem);
        }
        let img = gfx::load_indexed_png(&proj_dir.join(rel))
            .with_context(|| format!("vignette '{}'", rel))?;
        vig_data.push(img.to_vignette(&stem)?);
        vig_names.push(stem);
    }
    if vig_names.len() > 32 {
        bail!("{} vignettes (max 32)", vig_names.len());
    }

    // Composed screens (screens/<name>.json): validated here, unrolled
    // into stage commands by events.rs. No new binary format.
    let mut screens: Vec<project::ScreenDef> = Vec::new();
    for name in &project.screens {
        let path = proj_dir.join("screens").join(format!("{}.json", name));
        let txt = std::fs::read_to_string(&path)
            .with_context(|| format!("écran '{}' : lecture de {}", name, path.display()))?;
        let mut def: project::ScreenDef = serde_json::from_str(&txt)
            .with_context(|| format!("écran '{}' : JSON invalide", name))?;
        def.name = name.clone();
        if screens.iter().any(|s| s.name == def.name) {
            bail!("écran '{}' : nom en double", name);
        }
        // legacy: the old "script" field becomes the first named script
        if def.scripts.is_empty() {
            def.scripts.push(project::ScreenScript {
                name: "principal".to_string(),
                trigger: "auto".to_string(),
                cond: None,
                commands: std::mem::take(&mut def.script),
            });
        }
        for (i, sc) in def.scripts.iter_mut().enumerate() {
            if sc.trigger.is_empty() {
                sc.trigger = if i == 0 { "auto" } else { "call" }.to_string();
            }
            if sc.trigger != "auto" && sc.trigger != "call" {
                bail!(
                    "écran '{}' : script '{}' — déclencheur inconnu '{}'",
                    name, sc.name, sc.trigger
                );
            }
        }
        {
            let mut seen = std::collections::HashSet::new();
            for sc in &def.scripts {
                if !seen.insert(sc.name.clone()) {
                    bail!("écran '{}' : script '{}' en double", name, sc.name);
                }
            }
        }
        for sl in &def.slots {
            if sl.slot < 1 || sl.slot > 5 {
                bail!("écran '{}' : slot {} (attendu 1-5)", name, sl.slot);
            }
            if !pic_names.contains(&sl.pic) {
                bail!(
                    "écran '{}' : image '{}' introuvable (supprimée ou renommée ?)",
                    name, sl.pic
                );
            }
        }
        if !def.backdrop.is_empty() && !pic_names.contains(&def.backdrop) {
            bail!(
                "écran '{}' : fond '{}' introuvable (supprimé ou renommé ?)",
                name, def.backdrop
            );
        }
        screens.push(def);
    }

    let mut scenes = Vec::new();

    // Sounds: the id is the index in project.sounds, the name the stem
    let mut sound_ids: HashMap<String, u8> = HashMap::new();
    let mut sound_names: Vec<String> = Vec::new();
    for (i, m) in project.sounds.iter().enumerate() {
        let stem = Path::new(m)
            .file_stem()
            .and_then(|s| s.to_str())
            .with_context(|| format!("nom de son invalide : '{}'", m))?;
        if sound_ids.insert(stem.to_string(), i as u8).is_some() {
            bail!("son en double : '{}'", stem);
        }
        sound_names.push(stem.to_string());
    }
    if project.sounds.len() > sfx::SFX_MAX_COUNT {
        bail!("trop de sons (max {})", sfx::SFX_MAX_COUNT);
    }

    // ---- Frame-by-frame animations -----------------------------------
    // The cell sheet is a project VIGNETTE: the graphics pipeline (32x32
    // OBJ chars, palette, VBlank transfer) already exists and is tested,
    // so an animation only adds the frame track.
    // The track is FLATTENED with a FIXED stride, so the engine advances
    // by a constant step with no variable-length decoding. Per frame: L
    // records of 3 bytes [cell][signed dx][signed dy], one per LAYER
    // (cell 0xFF means that layer shows nothing), then [duration
    // 1-255][sound, 0xFF for none]. The stride is 3L + 2; with one layer
    // that is exactly the original 5-byte format.
    let mut anim_names: Vec<String> = Vec::new();
    let mut anim_vig: Vec<u8> = Vec::new();
    let mut anim_flags: Vec<u8> = Vec::new();
    let mut anim_layers: Vec<u8> = Vec::new();
    let mut anim_nframes: Vec<u8> = Vec::new();
    let mut anim_ofs: Vec<u16> = Vec::new();
    let mut anim_track: Vec<u8> = Vec::new();
    for a in &project.animations {
        if anim_names.contains(&a.name) {
            bail!("animation '{}' : nom en double", a.name);
        }
        let vig = vig_names
            .iter()
            .position(|v| v == &a.vignette)
            .with_context(|| {
                format!(
                    "animation '{}' : vignette '{}' introuvable (vignettes du projet : {})",
                    a.name,
                    a.vignette,
                    if vig_names.is_empty() {
                        "aucune".to_string()
                    } else {
                        vig_names.join(", ")
                    }
                )
            })?;
        let cells = vig_data[vig].1;
        if a.frames.is_empty() {
            bail!("animation '{}' : aucune frame", a.name);
        }
        if a.frames.len() > 255 {
            bail!("animation '{}' : {} frames (max 255)", a.name, a.frames.len());
        }
        // layers: the engine's limits (vignette slots and OAM entries)
        let nl = a.layers as usize;
        if !(1..=4).contains(&nl) {
            bail!(
                "animation '{}' : {} calques (1 a 4 — au dela, plus de slot de vignette)",
                a.name, a.layers
            );
        }
        let stride = nl * 3 + 2;
        if anim_track.len() + a.frames.len() * stride > 65535 {
            bail!("animations : piste trop longue (max 64 Ko)");
        }
        anim_ofs.push(anim_track.len() as u16);
        for (i, f) in a.frames.iter().enumerate() {
            let posed = f.posed();
            if posed.len() > nl {
                bail!(
                    "animation '{}', frame {} : {} cellules posees pour {} calque(s)",
                    a.name, i + 1, posed.len(), nl
                );
            }
            if f.dur == 0 {
                bail!("animation '{}', frame {} : duree nulle", a.name, i + 1);
            }
            for l in 0..nl {
                // A layer left unset on this frame shows nothing, which is
                // what lets a layer appear midway without needing a second
                // timeline.
                let (c, x, y) = posed.get(l).copied().unwrap_or((-1, 0, 0));
                if c < 0 {
                    anim_track.extend_from_slice(&[0xFF, 0, 0]);
                    continue;
                }
                if c as usize >= cells {
                    bail!(
                        "animation '{}', frame {}, calque {} : cellule {} hors de la vignette '{}' ({} cellule(s))",
                        a.name, i + 1, l + 1, c, a.vignette, cells
                    );
                }
                if !(-128..=127).contains(&x) || !(-128..=127).contains(&y) {
                    bail!(
                        "animation '{}', frame {}, calque {} : decalage [{}, {}] hors de -128..127",
                        a.name, i + 1, l + 1, x, y
                    );
                }
                anim_track.push(c as u8);
                anim_track.push(x as i8 as u8);
                anim_track.push(y as i8 as u8);
            }
            let sfx = match &f.sfx {
                None => 0xFFu8,
                Some(n) => *sound_ids.get(n).with_context(|| {
                    format!(
                        "animation '{}', frame {} : son '{}' introuvable dans le projet",
                        a.name, i + 1, n
                    )
                })?,
            };
            anim_track.push(f.dur);
            anim_track.push(sfx);
        }
        // VBlank budget: one cell is 4 DMA transfers and only ONE passes
        // per screen frame (measured — see VIG_VB_MAX in
        // engine/src/vignette.c). If K layers change cell on entering a
        // frame, they need K screen frames to catch up: a shorter frame
        // shows one layer late. We SAY so rather than forbid it — the
        // author may want that flicker.
        for i in 1..a.frames.len() {
            let prev = a.frames[i - 1].posed();
            let cur = a.frames[i].posed();
            let changed = (0..nl)
                .filter(|&l| {
                    let p = prev.get(l).map(|c| c.0).unwrap_or(-1);
                    let c = cur.get(l).map(|c| c.0).unwrap_or(-1);
                    p != c
                })
                .count();
            if changed > a.frames[i].dur as usize {
                println!(
                    "  attention : animation '{}', frame {} — {} cellules changent                      pour une duree de {} image(s) : une cellule aura du retard                      (allonger la duree, ou echelonner les changements)",
                    a.name, i + 1, changed, a.frames[i].dur
                );
            }
        }
        anim_vig.push(vig as u8);
        anim_flags.push(a.r#loop as u8);
        anim_layers.push(nl as u8);
        anim_nframes.push(a.frames.len() as u8);
        anim_names.push(a.name.clone());
    }
    if anim_names.len() > 255 {
        bail!("{} animations (max 255)", anim_names.len());
    }
    if !anim_names.is_empty() {
        let frames: usize = anim_nframes.iter().map(|&n| n as usize).sum();
        let maxl = anim_layers.iter().copied().max().unwrap_or(1);
        println!(
            "  animations : {} ({} frames, jusqu'a {} calque(s), {} octets de piste)",
            anim_names.len(),
            frames,
            maxl,
            anim_track.len()
        );
    }
    let music_names: Vec<String> = project
        .musics
        .iter()
        .map(|m| Path::new(m).file_stem().unwrap().to_str().unwrap().to_string())
        .collect();

    // TILE appearances: the sprite sheet loads BEFORE the events are
    // compiled, since virtual blocks are indexed after the real ones. The
    // global registry collects the (tileset, tile) pairs encountered, and
    // the extended sheet is composed after the loop.
    let sprites = gfx::load_indexed_png(&proj_dir.join(&project.assets.sprites))
        .with_context(|| format!("sprites {}", project.assets.sprites))?;
    let real_sprite_blocks = sprites.sprite_blocks()?;
    let mut tile_blocks: Vec<(String, u16)> = Vec::new();
    let default_ts_stem = {
        let first = project
            .tilesets
            .first()
            .unwrap_or(&project.assets.tileset);
        Path::new(first)
            .file_stem()
            .and_then(|x| x.to_str())
            .with_context(|| format!("nom de tileset invalide : '{}'", first))?
            .to_string()
    };

    for name in &project.scenes {
        let mut scene: project::Scene =
            read_json(&proj_dir.join("scenes").join(format!("{}.json", name)))
                .with_context(|| format!("scene '{}'", name))?;
        if &scene.name != name {
            bail!("scene '{}' : champ name incoherent ('{}')", name, scene.name);
        }
        scene.validate()?;
        // legacy: old trigger/auto actors were invisible
        for a in &mut scene.actors {
            if a.kind != "npc" {
                a.sprite = 255;
            }
        }
        // Events (Event Editor): compiled to actors plus VM assembly,
        // their inline texts joining the text bank, deduplicated.
        // ALWAYS run — every script block starts with the CETAB table of
        // auto common events at offset 0, which the engine reads, even
        // when it is empty.
        {
            let scene_ts = match &scene.tileset {
                Some(t) => t.clone(),
                None => default_ts_stem.clone(),
            };
            let mut ec = events::EventCompiler::new(&mut texts);
            let (asm, actors, gfx_blocks, cetab) = ec.compile_scene(
                name,
                &scene.events,
                &project.common_events,
                &project.functions,
                database.as_ref(),
                &ui_widget_ids,
                &ui_style_ids,
                &pic_names,
                &pic_dims,
                &sound_names,
                &music_names,
                &vig_names,
                &anim_names,
                &screens,
                &scene_ts,
                &mut tile_blocks,
                real_sprite_blocks,
            )?;
            scene.script.insert(0, cetab);
            scene.script.extend(asm);
            scene.actors.extend(actors);
            scene_gfx_blocks.push(gfx_blocks);
        }
        scenes.push(scene);
    }
    if project.common_events.len() > 255 {
        bail!("trop de common events (max 255)");
    }

    let mut text_ids: HashMap<String, u16> = HashMap::new();
    for (i, t) in texts.iter().enumerate() {
        if text_ids.insert(t.name.clone(), i as u16).is_some() {
            bail!("texte en double : '{}'", t.name);
        }
    }
    let boot_id = project
        .scenes
        .iter()
        .position(|s| s == &project.boot_scene)
        .with_context(|| format!("boot_scene '{}' absente de scenes[]", project.boot_scene))?;

    // Music: the id is the index in project.musics, the name the stem
    let mut music_ids: HashMap<String, u8> = HashMap::new();
    for (i, m) in project.musics.iter().enumerate() {
        let stem = Path::new(m)
            .file_stem()
            .and_then(|s| s.to_str())
            .with_context(|| format!("nom de module invalide : '{}'", m))?;
        if music_ids.insert(stem.to_string(), i as u8).is_some() {
            bail!("musique en double : '{}'", stem);
        }
    }
    if project.musics.len() > 254 {
        bail!("trop de musiques (max 254, 0xFF = silence)");
    }


    // Tilesets: the id is the index in project.tilesets (default: assets.tileset alone)
    let tileset_paths: Vec<String> = if project.tilesets.is_empty() {
        vec![project.assets.tileset.clone()]
    } else {
        project.tilesets.clone()
    };
    let mut tileset_ids: HashMap<String, u8> = HashMap::new();
    for (i, t) in tileset_paths.iter().enumerate() {
        let stem = Path::new(t)
            .file_stem()
            .and_then(|s| s.to_str())
            .with_context(|| format!("nom de tileset invalide : '{}'", t))?;
        if tileset_ids.insert(stem.to_string(), i as u8).is_some() {
            bail!("tileset en double : '{}'", stem);
        }
    }

    std::fs::create_dir_all(&out_dir)?;

    // Modules are copied to engine/src/data/music/NN_stem.it: alphabetical
    // order (the prefix) is the music_id order the soundbank Make expects
    let music_dir = out_dir.join("music");
    if music_dir.exists() {
        for e in std::fs::read_dir(&music_dir)? {
            let e = e?;
            if e.path().extension().and_then(|x| x.to_str()) == Some("it") {
                std::fs::remove_file(e.path())?;
            }
        }
    }
    std::fs::create_dir_all(&music_dir)?;
    for (i, m) in project.musics.iter().enumerate() {
        let srcp = proj_dir.join(m);
        let stem = Path::new(m).file_stem().unwrap().to_str().unwrap();
        let dst = music_dir.join(format!("{:02}_{}.it", i, stem));
        std::fs::copy(&srcp, &dst)
            .with_context(|| format!("copie de {}", srcp.display()))?;
        println!("  {}", dst.display());
    }
    // Sounds: WAV to 8 kHz BRR. data_sfx.c is ALWAYS emitted — no data
    // hardcoded in the engine, so it is empty without sounds. The SPC
    // region is sized for the largest sound; see sfx.rs.
    let mut sfx_max = 0usize;
    {
        let mut s = String::from(emit::HEADER);
        s.push_str("#include <snes.h>\n\n");
        s.push_str("/* sons (B1) — echantillons BRR 8 kHz (module sfx de datagen) */\n");
        let mut total = 0usize;
        let mut lens: Vec<u16> = Vec::new();
        for (i, m) in project.sounds.iter().enumerate() {
            let raw = std::fs::read(proj_dir.join(m))
                .with_context(|| format!("lecture du son {}", m))?;
            let mono = sfx::wav_to_mono_8k(&raw, &sound_names[i])?;
            let brr = sfx::encode_brr(&mono);
            if brr.len() > sfx::SFX_MAX_BRR {
                bail!(
                    "son '{}' trop long : {} octets BRR (max {} — raccourcir \
                     le son, ~1,8 s maximum)",
                    sound_names[i], brr.len(), sfx::SFX_MAX_BRR
                );
            }
            total += brr.len();
            sfx_max = sfx_max.max(brr.len());
            lens.push(brr.len() as u16);
            s.push_str(&emit::u8_array(&format!("sfx_{:02}", i), &brr, 16, false));
            println!(
                "  son {:02} '{}' : {} octets BRR ({} ms)",
                i, sound_names[i], brr.len(),
                mono.len() * 1000 / sfx::SFX_RATE as usize
            );
        }
        if total > sfx::SFX_MAX_TOTAL {
            bail!(
                "sons : {} octets BRR au total (max {} — la bank de \
                 données est partagée)",
                total, sfx::SFX_MAX_TOTAL
            );
        }
        if !project.sounds.is_empty() {
            s.push_str("\nconst u8 *const sfx_ptr[] = {\n");
            for i in 0..project.sounds.len() {
                s.push_str(&format!("  sfx_{:02},\n", i));
            }
            s.push_str("};\n");
            s.push_str(&format!("const u16 sfx_len[{}] = {{\n", lens.len()));
            for l in &lens {
                s.push_str(&format!("  {},\n", l));
            }
            s.push_str("};\n");
        }
        write_out(&out_dir, "data_sfx.c", s)?;
    }
    write_out(
        &out_dir,
        "audio_cfg.h",
        format!(
            "/* GENERE par datagen — ne pas editer. */
#define AUDIO_ENABLED {}
#define SFX_COUNT {}
#define SFX_REGION {}
",
            if project.musics.is_empty() { 0 } else { 1 },
            project.sounds.len(),
            (sfx_max + 255) / 256,
        ),
    )?;

    // Tilesets: grid plus sidecar (autotiles, passability). The autotile
    // variants USED by the scenes are collected before compilation — the
    // binary ids follow the grid, in deterministic order.
    let sources: Vec<tileset::SourceTileset> = tileset_paths
        .iter()
        .map(|p| tileset::load_source(&proj_dir, p).with_context(|| format!("tileset {}", p)))
        .collect::<Result<_>>()?;

    let scene_ts = |sc: &project::Scene| -> Result<usize> {
        Ok(match &sc.tileset {
            None => 0usize,
            Some(name) => *tileset_ids
                .get(name.as_str())
                .with_context(|| format!("scene '{}' : tileset inconnu '{}'", sc.name, name))?
                as usize,
        })
    };

    // Validate the logical ids of both layers
    for sc in &scenes {
        let ts = scene_ts(sc)?;
        let src = &sources[ts];
        let upper = sc.upper_or_empty();
        // The eraser (-1) is accepted on BOTH layers: an empty cell reads
        // black in game. expand_scene already handled it; the validation
        // had stayed behind.
        for layer in [&sc.tilemap, &upper] {
            for row in layer.iter() {
                for &id in row {
                    if !src.valid_id(id) && id != tileset::EMPTY {
                        bail!("scene '{}' : id de tile {} hors tileset", sc.name, id);
                    }
                }
            }
        }
    }

    // Graphics compiled PER SCENE (the real VRAM budget), shared between
    // scenes with identical content through a fingerprint
    let mut fp_ids: HashMap<Vec<u8>, u8> = HashMap::new();
    let mut gfx_sets: Vec<tileset::GfxSet> = Vec::new();
    let mut set_ids: Vec<u8> = Vec::new();
    let mut grids = Vec::new();
    // Animated tiles: per scene, sequences resolved to chars of the gfx
    // set — dest is the VRAM chars of the base tile, src the ROM chars of
    // each frame. (dest4, frames of 4 chars, mode 0 = "123" / 1 = "1232",
    // speed in display frames)
    let mut scene_anims: Vec<Vec<([u16; 4], Vec<[u16; 4]>, u8, u8)>> = Vec::new();
    for sc in &scenes {
        let ts = scene_ts(sc)?;
        let upper = sc.upper_or_empty();
        let gfx = sources[ts].compile_scene(&sc.name, &sc.tilemap, &upper)?;
        gfx.verify(&sc.name)?;
        grids.push(sources[ts].expand_scene(&gfx, &sc.name, &sc.tilemap, &upper)?);
        let mut rows: Vec<([u16; 4], Vec<[u16; 4]>, u8, u8)> = Vec::new();
        for a in &sources[ts].meta.anims {
            if a.tiles.len() < 2 || a.tiles.len() > 4 {
                bail!("tileset : une sequence animee demande 2 a 4 tiles");
            }
            if a.mode != "123" && a.mode != "1232" {
                bail!("tileset : mode d'animation « {} » (123 ou 1232)", a.mode);
            }
            if a.speed == 0 {
                bail!("tileset : vitesse d'animation 1-255 frames");
            }
            for &t in &a.tiles {
                if t < 0 || t >= tileset::AUTO_BASE {
                    bail!(
                        "tileset : tile animee {} — tiles de GRILLE uniquement                          (pas d'autotiles pour l'instant)",
                        t
                    );
                }
            }
            let base = a.tiles[0] as u16;
            let Some(dest) = gfx.plain_entries(base) else {
                continue; // la tile de base n'est pas posée dans cette scène
            };
            // Sharing chars BETWEEN the frames of one sequence is fine
            // (unchanged quarters); sharing with any other tile is not.
            let allowed: Vec<u8> = a
                .tiles
                .iter()
                .filter_map(|&t| gfx.plain_local(t as u16))
                .collect();
            for e in dest {
                if gfx.char_shared_outside(e & 0x3FF, &allowed) {
                    bail!(
                        "scene '{}' : la tile animee {} PARTAGE des chars avec une tile hors sequence (dedup) — dessine-la avec des pixels qui lui sont propres",
                        sc.name, base
                    );
                }
            }
            let mut frames: Vec<[u16; 4]> = Vec::new();
            frames.push([
                dest[0] & 0x3FF, dest[1] & 0x3FF, dest[2] & 0x3FF, dest[3] & 0x3FF,
            ]);
            for &f in &a.tiles[1..] {
                let fe = gfx.plain_entries(f as u16).with_context(|| {
                    format!(
                        "scene '{}' : frame {} de la tile animee {} non compilee                          (bug datagen)",
                        sc.name, f, base
                    )
                })?;
                for k in 0..4 {
                    if (fe[k] >> 10) != (dest[k] >> 10) {
                        bail!(
                            "scene '{}' : la frame {} de la tile animee {} n'a pas                              la meme palette — memes couleurs exigees (le swap ne                              change que les pixels)",
                            sc.name, f, base
                        );
                    }
                }
                frames.push([fe[0] & 0x3FF, fe[1] & 0x3FF, fe[2] & 0x3FF, fe[3] & 0x3FF]);
            }
            rows.push((
                [dest[0] & 0x3FF, dest[1] & 0x3FF, dest[2] & 0x3FF, dest[3] & 0x3FF],
                frames,
                (a.mode == "1232") as u8,
                a.speed,
            ));
        }
        scene_anims.push(rows);
        let fp = gfx.fingerprint();
        let id = match fp_ids.get(&fp) {
            Some(&i) => i,
            None => {
                if gfx_sets.len() == 255 {
                    bail!("plus de 255 gfx sets");
                }
                let i = gfx_sets.len() as u8;
                fp_ids.insert(fp, i);
                gfx_sets.push(gfx);
                i
            }
        };
        set_ids.push(id);
    }
    println!("  {} gfx sets pour {} scenes", gfx_sets.len(), scenes.len());

    // 16x24 sprite sheet: character blocks of 12 frames (RM2003 charset
    // model); an actor's sprite is a block index.
    // Sets are compiled PER SCENE, like the tilesets: a scene only
    // embeds the player block (0) plus its actors' blocks, 5 at most, and
    // datagen remaps the binary sprite_id to local slots.
    // EXTENDED sheet: the virtual blocks of tile appearances are composed
    // after the real ones — 12 identical 16x24 frames, the posed tile on
    // lines 8-23 so it aligns with the cell in game. The tile's colours
    // join the sheet's palette (index 0 transparent); to_obj_sheet then
    // re-indexes per block, as for any other charset.
    let sprites = if tile_blocks.is_empty() {
        sprites
    } else {
        let mut ext = sprites;
        let new_w = ext.width + tile_blocks.len() * 12 * 16;
        let mut px = vec![0u8; new_w * 24];
        for y in 0..24 {
            px[y * new_w..y * new_w + ext.width]
                .copy_from_slice(&ext.pixels[y * ext.width..(y + 1) * ext.width]);
        }
        for (k, (ts_stem, tile)) in tile_blocks.iter().enumerate() {
            let path = tileset_paths
                .iter()
                .find(|t| {
                    Path::new(t).file_stem().and_then(|x| x.to_str())
                        == Some(ts_stem.as_str())
                })
                .with_context(|| {
                    format!("apparence tile : tileset '{}' introuvable", ts_stem)
                })?;
            let img = gfx::load_indexed_png(&proj_dir.join(path))?;
            let per_row = (img.width / 16).max(1);
            let tx = (*tile as usize % per_row) * 16;
            let ty = (*tile as usize / per_row) * 16;
            if ty + 16 > img.height {
                bail!(
                    "apparence tile : tile {} hors du chipset '{}'",
                    tile, ts_stem
                );
            }
            let mut remap = [0usize; 256];
            let fx0 = ext.width + k * 12 * 16;
            for yy in 0..16 {
                for xx in 0..16 {
                    let src = img.pixels[(ty + yy) * img.width + tx + xx] as usize;
                    if src == 0 {
                        continue; // transparent
                    }
                    if remap[src] == 0 {
                        let c = img.palette[src];
                        remap[src] = match ext
                            .palette
                            .iter()
                            .skip(1)
                            .position(|&pc| pc == c)
                        {
                            Some(i) => i + 1,
                            None => {
                                if ext.palette.len() >= 256 {
                                    // palette full: nearest existing colour
                                    let mut best = (1usize, u32::MAX);
                                    for (i, &pc) in
                                        ext.palette.iter().enumerate().skip(1)
                                    {
                                        let d = tileset::dist555(pc, c);
                                        if d < best.1 {
                                            best = (i, d);
                                        }
                                    }
                                    best.0
                                } else {
                                    ext.palette.push(c);
                                    ext.palette.len() - 1
                                }
                            }
                        };
                    }
                    let v = remap[src] as u8;
                    for f in 0..12 {
                        px[(8 + yy) * new_w + fx0 + f * 16 + xx] = v;
                    }
                }
            }
        }
        ext.width = new_w;
        ext.pixels = px;
        ext
    };
    let sprite_blocks = real_sprite_blocks + tile_blocks.len();
    let mut ss_ids: HashMap<Vec<usize>, u8> = HashMap::new();
    let mut sprite_sets: Vec<(Vec<u8>, Vec<u16>)> = Vec::new();
    let mut sprite_set_ids: Vec<u8> = Vec::new();
    let mut sprite_remaps: Vec<HashMap<u8, u8>> = Vec::new();
    for (sci, sc) in scenes.iter().enumerate() {
        let mut used: std::collections::BTreeSet<usize> = [0usize].into();
        for &b in &scene_gfx_blocks[sci] {
            if (b as usize) >= real_sprite_blocks {
                bail!(
                    "scene '{}' : pas gfx:{} — bloc hors feuille de sprites ({} bloc(s))",
                    sc.name, b, sprite_blocks
                );
            }
            used.insert(b as usize);
        }
        for a in &sc.actors {
            if a.sprite == 255 {
                continue; // invisible : pas de sprite (spec §1.3 v0.8)
            }
            if (a.sprite as usize) >= sprite_blocks {
                bail!(
                    "scene '{}' : acteur en ({},{}) — bloc de personnage {} \
                     hors feuille de sprites ({} bloc(s))",
                    sc.name, a.x, a.y, a.sprite, sprite_blocks
                );
            }
            used.insert(a.sprite as usize);
        }
        let used: Vec<usize> = used.into_iter().collect();
        if used.len() > 5 {
            // Name the culprit: it is NOT the number of events that
            // overflows but the variety of appearances — OBJ VRAM is
            // 16 KB, that is 5 charsets per scene, hero included.
            let charset_name = |b: usize| -> String {
                if b >= real_sprite_blocks {
                    let (ts, t) = &tile_blocks[b - real_sprite_blocks];
                    return format!("tile {} ({})", t, ts);
                }
                match project.charsets.get(b) {
                    Some(n) if !n.is_empty() => format!("bloc {} « {} »", b, n),
                    _ if b == 0 => "bloc 0 (heros)".to_string(),
                    _ => format!("bloc {}", b),
                }
            };
            let mut detail = String::new();
            for &b in &used {
                let evs: Vec<String> = sc
                    .actors
                    .iter()
                    .filter(|a| a.sprite as usize == b)
                    .map(|a| format!("({},{})", a.x, a.y))
                    .collect();
                detail.push_str(&format!(
                    "\n  - {}{}",
                    charset_name(b),
                    if b == 0 && evs.is_empty() {
                        " : le joueur".to_string()
                    } else {
                        format!(" : event(s) en {}", evs.join(" "))
                    }
                ));
            }
            bail!(
                "scene '{}' : {} charsets DIFFERENTS utilises, limite SNES : \
                 5 par scene, heros compris (VRAM OBJ 16 Ko). Le nombre \
                 d'events est libre — c'est la variete d'apparences qui \
                 compte.{}\nReutiliser des apparences deja presentes, ou \
                 repartir ces events sur d'autres scenes.",
                sc.name,
                used.len(),
                detail
            );
        }
        let id = match ss_ids.get(&used) {
            Some(&i) => i,
            None => {
                let i = sprite_sets.len() as u8;
                sprite_sets.push(sprites.to_obj_sheet(&used)?);
                ss_ids.insert(used.clone(), i);
                i
            }
        };
        sprite_set_ids.push(id);
        sprite_remaps.push(
            used.iter()
                .enumerate()
                .map(|(s, &b)| (b as u8, s as u8))
                .collect(),
        );
    }
    println!(
        "  {} sprite sets pour {} scenes ({} bloc(s) dans la feuille)",
        sprite_sets.len(),
        scenes.len(),
        sprite_blocks
    );

    // Binary banks (spec §1-2) plus the pinning asm. The scene and text
    // pools extend into extra banks allocated in sequence, from
    // EXTRA_WLA_FIRST onwards.
    let mut next_extra = binbank::EXTRA_WLA_FIRST;
    let scene_pool = binbank::build_scene_bank(
        &scenes, &grids, &set_ids, &sprite_set_ids, &sprite_remaps, &text_ids,
        &music_ids, boot_id as u8, &mut next_extra,
    )?;
    let text_pool = binbank::build_text_bank(&texts, &mut next_extra)?;
    for (k, blob) in scene_pool.blobs.iter().enumerate() {
        write_bin(&out_dir, &binbank::pool_bin_name("scenes", k), blob)?;
    }
    for (k, blob) in text_pool.blobs.iter().enumerate() {
        write_bin(&out_dir, &binbank::pool_bin_name("texts", k), blob)?;
    }
    // Purge the .bin files of a previous, larger build: databanks.asm no
    // longer references them, but an orphan file sows doubt.
    for base in ["scenes", "texts"] {
        let n = if base == "scenes" { scene_pool.blobs.len() } else { text_pool.blobs.len() };
        for k in n..binbank::WLA_BANK_COUNT as usize {
            let path = out_dir.join(binbank::pool_bin_name(base, k));
            if path.exists() {
                std::fs::remove_file(&path)
                    .with_context(|| format!("purge de {}", path.display()))?;
            }
        }
    }
    write_out(
        &engine_dir,
        "databanks.asm",
        binbank::databanks_asm(&scene_pool, &text_pool),
    )?;
    println!(
        "  banks scenes : {}/{} octets ({} bank(s))",
        scene_pool.used(), scene_pool.capacity(), scene_pool.blobs.len()
    );
    println!(
        "  banks textes : {}/{} octets ({} bank(s))",
        text_pool.used(), text_pool.capacity(), text_pool.blobs.len()
    );

    // Debug menu: the flag plus the REAL bank budgets, burned into the
    // data. ALWAYS emitted — the engine includes debug.c unconditionally
    // and it is inert without the flag. The SCN/TXT row is PRE-FORMATTED
    // here: the engine has neither division nor room to format
    // multi-bank totals.
    {
        let mut row = format!(
            "SCN {}/{} TXT {}/{}",
            scene_pool.used(), scene_pool.capacity(),
            text_pool.used(), text_pool.capacity()
        );
        if row.len() > 32 {
            row = format!(
                "SCN {}/{}K TXT {}/{}K",
                scene_pool.used() / 1024, scene_pool.capacity() / 1024,
                text_pool.used() / 1024, text_pool.capacity() / 1024
            );
        }
        assert!(row.len() <= 32, "rangee debug > 32 colonnes");
        let mut s = String::from(emit::HEADER);
        s.push_str("#include <snes.h>\n\n");
        s.push_str(&format!(
            "/* menu de debug en jeu (Start+Select+R) — S6/M1 */\n\
             const u8 dbg_enabled = {};\n\
             /* rangée budgets pré-formatée (32 colonnes max) */\n\
             const char dbg_banks_txt[] = \"{}\";\n",
            debug_rom as u8, row
        ));
        write_out(&out_dir, "data_debug.c", s)?;
    }
    if debug_rom {
        println!("  debug : menu Start+Select+R actif dans cette ROM");
    }

    // Graphics assets as generated C (no binary format in the spec).
    // ONE FILE PER SET, because a ROM section is unsplittable at 32 KB.
    // Purge the data_gfx*/data_sprites* of a previous run first, or a set
    // that has since disappeared would stay compiled and linked.
    for entry in std::fs::read_dir(&out_dir)? {
        let path = entry?.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if (name.starts_with("data_gfx")
            || name.starts_with("data_sprites")
            || name.starts_with("data_pic"))
            && !path.is_dir()
        {
            std::fs::remove_file(&path)
                .with_context(|| format!("purge de {}", path.display()))?;
        }
    }
    // Transparent images live on BG palette 7. If a tileset occupies it
    // too, the scenery seen through the image would be wrong IN ITS
    // scenes — a warning, not an error: the author may never show the
    // image there.
    if pic_trans.iter().any(|&t| t) {
        for (i, g) in gfx_sets.iter().enumerate() {
            if g.pal[112..128].iter().any(|&c| c != 0) {
                println!(
                    "  attention : le gfx set {} occupe la palette BG 7 — le \
                     decor derriere une image a TRANSPARENCE sera faux dans \
                     les scenes qui l'utilisent",
                    i
                );
            }
        }
    }
    for (name, content) in gen_asset_files(&gfx_sets, &sprite_sets)? {
        write_out(&out_dir, &name, content)?;
    }
    // Pictures: one file per image (one ROM section, one bank) plus the
    // data_pictures.c registry. ALWAYS emitted — the engine includes
    // picture.c unconditionally, with dummy tables when there is none.
    for (name, content) in gen_vignette_files(&vig_names, &vig_data) {
        write_out(&out_dir, &name, content)?;
    }
    // Animations: the registry is ALWAYS emitted — the engine compiles
    // anim.c unconditionally, with dummy tables when the project has
    // none. Same recipe as the vignettes and the pictures.
    {
        let mut s = String::from(emit::HEADER);
        let one = |v: &Vec<u8>| -> Vec<u8> {
            if v.is_empty() { vec![0] } else { v.clone() }
        };
        s.push_str("#include <snes.h>\n\n");
        s.push_str(&format!("const u8 anim_count = {};\n\n", anim_names.len()));
        s.push_str("/* vignette servant de planche de cellules, par animation */\n");
        s.push_str(&emit::u8_array("anim_vig", &one(&anim_vig), 16, false));
        s.push_str("\n/* bit 0 = boucle */\n");
        s.push_str(&emit::u8_array("anim_flags", &one(&anim_flags), 16, false));
        s.push_str("\n/* cellules simultanees (calques) : pas de piste = 3L + 2 */\n");
        s.push_str(&emit::u8_array("anim_layers", &one(&anim_layers), 16, false));
        s.push_str("\n/* nombre de frames */\n");
        s.push_str(&emit::u8_array("anim_nframes", &one(&anim_nframes), 16, false));
        s.push_str("\n/* offset de la premiere frame dans anim_track */\n");
        s.push_str(&emit::u16_array(
            "anim_ofs",
            &(if anim_ofs.is_empty() { vec![0] } else { anim_ofs.clone() }),
        ));
        s.push_str(
            "\n/* piste aplatie, pas FIXE de 3L + 2 octets par frame :\n                L x [cellule (0xFF = calque vide)][dx signe][dy signe]\n                puis [duree][son, 0xFF = aucun] */\n",
        );
        s.push_str(&emit::u8_array("anim_track", &one(&anim_track), 16, false));
        write_out(&out_dir, "data_anims.c", s)?;
    }
    for (name, content) in gen_picture_files(&pic_names, &pic_data, &pic_trans, &pic_dims) {
        write_out(&out_dir, &name, content)?;
    }
    if !pic_names.is_empty() {
        println!("  pictures : {} image(s) plein ecran", pic_names.len());
    }
    // Per-scene effect layer: data_effects.c is ALWAYS emitted (the
    // engine includes effectlayer.c unconditionally); 0xFF means none.
    // Speeds in px/s are converted to 8.8 steps per frame at 60 Hz.
    {
        let n = scenes.len().max(1);
        let mut e_pic = vec![0xFFu8; n];
        let mut e_blend = vec![0u8; n];
        let mut e_par = vec![0u8; n];
        let mut e_dx = vec![0u16; n];
        let mut e_dy = vec![0u16; n];
        let mut e_mode = vec![0u8; n]; // 0 = front (surimpression), 1 = back (panorama)
        let mut e_repeat = vec![1u8; n]; // 1 = répété (défile), 0 = fixe
        for (i, sc) in scenes.iter().enumerate() {
            let eff = match &sc.effect {
                Some(e) => e,
                None => continue,
            };
            // Plane position: "front" overlays, "back" is a panorama
            let is_back = match eff.mode.as_deref() {
                None | Some("front") => false,
                Some("back") => true,
                Some(o) => bail!("scene '{}' : mode d'effet inconnu « {} » (front, back)", sc.name, o),
            };
            e_mode[i] = is_back as u8;
            e_repeat[i] = eff.repeat.unwrap_or(true) as u8;
            let idx = pic_names.iter().position(|p| p == &eff.pic).with_context(|| {
                format!(
                    "scene '{}' : image d'effet « {} » introuvable dans \
                     project.pictures (images : {})",
                    sc.name,
                    eff.pic,
                    if pic_names.is_empty() { "aucune".to_string() } else { pic_names.join(", ") }
                )
            })?;
            // The effect plane lives on BG palette 7, which the engine
            // forces. Front (clouds): the image MUST be imported "with
            // transparency" — the transparency IS the effect, the scenery
            // showing between the clouds. Back (panorama): opaque is
            // accepted, but colour index 0 stays transparent on the SNES
            // (black backdrop), so we warn — the author can re-import and
            // choose which colour lands on that index.
            if !pic_trans[idx] {
                if is_back {
                    println!(
                        "  attention : scene '{}' — panorama « {} » importe SANS \
                         transparence : sa couleur d'index 0 sera transparente \
                         (fond noir). Pour la maitriser, reimporter en choisissant \
                         une couleur transparente.",
                        sc.name, eff.pic
                    );
                } else {
                    bail!(
                        "scene '{}' : le motif d'effet « {} » (surimpression) doit \
                         etre importe AVEC transparence — c'est ce qui laisse voir \
                         le decor entre les nuages",
                        sc.name, eff.pic
                    );
                }
            }
            let chars = pic_data[idx].0.len() / 32;
            if chars > 256 {
                bail!(
                    "scene '{}' : motif d'effet « {} » — {} tiles 8x8 UNIQUES > 256 \
                     (budget VRAM). Astuce : dessiner 2-4 formes et les REPETER a \
                     des positions multiples de 8 px (les tuiles se partagent) — \
                     eviter le dessin a main levee et l'anti-aliasing, qui rendent \
                     chaque bloc 8x8 unique",
                    sc.name, eff.pic, chars
                );
            }
            e_pic[i] = idx as u8;
            e_blend[i] = match eff.blend.as_deref() {
                None | Some("none") => 0,
                Some("half") => 1,
                Some("add") => 2,
                Some("sub") => 3,
                Some(o) => bail!("scene '{}' : blend d'effet inconnu « {} »", sc.name, o),
            };
            // Camera follow is a shift (camera >> n): 1 is half, 2 a quarter
            e_par[i] = match eff.parallax.as_deref() {
                None | Some("none") => 0,
                Some("half") => 1,
                Some("quarter") => 2,
                Some("full") => 3, // collé au décor (camera >> 0) — ombres au sol
                Some(o) => bail!("scene '{}' : parallax d'effet inconnu « {} »", sc.name, o),
            };
            let to_fp = |v: f64, what: &str| -> Result<u16> {
                let f = (v * 256.0 / 60.0).round();
                if !(-32768.0..=32767.0).contains(&f) {
                    bail!("scene '{}' : vitesse d'effet {} hors bornes", sc.name, what);
                }
                Ok((f as i32 as i16) as u16)
            };
            e_dx[i] = to_fp(eff.dx, "dx")?;
            e_dy[i] = to_fp(eff.dy, "dy")?;
            if sc.upper.as_ref().map_or(false, |rows| rows.iter().flatten().any(|&v| v >= 0)) {
                println!(
                    "  attention : scene '{}' — couche sup non vide IGNOREE \
                     (couche d'effet active, le plan BG1 porte le motif)",
                    sc.name
                );
            }
        }
        let mut s = String::from(emit::HEADER);
        s.push_str("#include <snes.h>\n\n/* couche d'effet par scene (S9) — 0xFF = aucune */\n");
        let dump_u8 = |name: &str, v: &[u8]| {
            let mut o = format!("const u8 {}[{}] = {{ ", name, v.len());
            for x in v { o.push_str(&format!("{}, ", x)); }
            o.push_str("};\n");
            o
        };
        let dump_u16 = |name: &str, v: &[u16]| {
            let mut o = format!("const u16 {}[{}] = {{ ", name, v.len());
            for x in v { o.push_str(&format!("{}, ", x)); }
            o.push_str("};\n");
            o
        };
        s.push_str(&dump_u8("eff_pic", &e_pic));
        s.push_str(&dump_u8("eff_blend", &e_blend));
        s.push_str(&dump_u8("eff_par", &e_par));
        s.push_str(&dump_u16("eff_dx", &e_dx));
        s.push_str(&dump_u16("eff_dy", &e_dy));
        s.push_str(&dump_u8("eff_mode", &e_mode)); /* 0 front, 1 back panorama (S17) */
        s.push_str(&dump_u8("eff_repeat", &e_repeat)); /* 1 répété, 0 fixe */
        write_out(&out_dir, "data_effects.c", s)?;
        if e_pic.iter().any(|&p| p != 0xFF) {
            println!("  couche d'effet : active sur {} scene(s)",
                e_pic.iter().filter(|&&p| p != 0xFF).count());
        }
    }
    // Weather: data_weather.c is ALWAYS emitted — the 4bpp particle chars
    // (rain, snow; 16x16 blocks as TL, TR, then BL, BR) plus OBJ palette 7
    // (4 colours). No data hardcoded in the engine.
    {
        // encode one 8x8 char (indices 0-15) as planar SNES 4bpp
        let pack_char = |px: &dyn Fn(usize, usize) -> u8| -> [u8; 32] {
            let mut out = [0u8; 32];
            for y in 0..8 {
                let (mut p0, mut p1, mut p2, mut p3) = (0u8, 0u8, 0u8, 0u8);
                for x in 0..8 {
                    let v = px(x, y);
                    let bit = 0x80 >> x;
                    if v & 1 != 0 { p0 |= bit; }
                    if v & 2 != 0 { p1 |= bit; }
                    if v & 4 != 0 { p2 |= bit; }
                    if v & 8 != 0 { p3 |= bit; }
                }
                out[y * 2] = p0;
                out[y * 2 + 1] = p1;
                out[16 + y * 2] = p2;
                out[16 + y * 2 + 1] = p3;
            }
            out
        };
        // a 16x16 block is 128 bytes (TL, TR, BL, BR)
        let pack_block = |bm: &[[u8; 16]; 16]| -> Vec<u8> {
            let mut out = Vec::with_capacity(128);
            for (qy, qx) in [(0usize, 0usize), (0, 8), (8, 0), (8, 8)] {
                out.extend_from_slice(&pack_char(&|x, y| bm[qy + y][qx + x]));
            }
            out
        };
        // rain: a 2 px diagonal streak, white head and blue trail
        let mut rain = [[0u8; 16]; 16];
        for i in 0..12usize {
            let x = 11 - i / 2;
            let y = 2 + i;
            rain[y][x] = if i < 4 { 1 } else { 2 };
            if i % 2 == 0 && x + 1 < 16 {
                rain[y][x + 1] = 2;
            }
        }
        // snow: a flake, white cross with blue tips
        let mut snow = [[0u8; 16]; 16];
        for (x, y, c) in [
            (8, 8, 1u8), (7, 8, 1), (9, 8, 1), (8, 7, 1), (8, 9, 1),
            (6, 8, 2), (10, 8, 2), (8, 6, 2), (8, 10, 2),
            (7, 7, 2), (9, 9, 2), (9, 7, 2), (7, 9, 2),
        ] {
            snow[y][x] = c;
        }
        // OBJ palette 7: transparent, white, light blue, (free)
        let bgr = |r: u16, g: u16, b: u16| -> u16 { (b << 10) | (g << 5) | r };
        let pal = [0u16, bgr(31, 31, 31), bgr(22, 26, 31), 0];
        let mut s = String::from(emit::HEADER);
        s.push_str("#include <snes.h>\n\n/* particules meteo (S13) — blocs 16x16 4bpp, palette OBJ 7 */\n");
        s.push_str(&emit::u8_array("wea_rain", &pack_block(&rain), 16, false));
        s.push_str(&emit::u8_array("wea_snow", &pack_block(&snow), 16, false));
        s.push_str(&format!(
            "const u16 wea_pal[4] = {{ {}, {}, {}, {} }};\n",
            pal[0], pal[1], pal[2], pal[3]
        ));
        write_out(&out_dir, "data_weather.c", s)?;
    }

    // Animated tiles: per-scene flattened tables (data_tileanim.c).
    // ta_first[s]..ta_first[s+1] are scene s's sequences. Per sequence:
    // 4 destination VRAM chars, n frames of 4 source ROM chars, mode
    // (0 = 1-2-3, 1 = 1-2-3-2), speed in frames. tileanim.c copies
    // 128 bytes from the ROM charset into VRAM at each step.
    {
        let mut first: Vec<u8> = vec![0];
        let mut dest: Vec<u16> = Vec::new();
        let mut ffirst: Vec<u8> = vec![0]; // index de frame par séquence
        let mut srcs: Vec<u16> = Vec::new();
        let mut modes: Vec<u8> = Vec::new();
        let mut speeds: Vec<u8> = Vec::new();
        let mut nseq = 0usize;
        let mut nfr = 0usize;
        for rows in &scene_anims {
            for (d, frames, mode, speed) in rows {
                dest.extend_from_slice(d);
                for f in frames {
                    srcs.extend_from_slice(f);
                }
                nfr += frames.len();
                if nfr > 255 {
                    bail!("tiles animees : plus de 255 frames au total");
                }
                ffirst.push(nfr as u8);
                modes.push(*mode);
                speeds.push(*speed);
            }
            nseq += rows.len();
            if nseq > 255 {
                bail!("tiles animees : plus de 255 sequences au total");
            }
            first.push(nseq as u8);
        }
        let mut c = String::from(emit::HEADER);
        c.push_str("#include <snes.h>

");
        c.push_str(&emit::u8_array("ta_first", &first, 16, false));
        c.push_str(&emit::u8_array("ta_ffirst", &if nseq > 0 { ffirst } else { vec![0, 0] }, 16, false));
        c.push_str(&emit::u8_array("ta_mode", &if modes.is_empty() { vec![0] } else { modes }, 16, false));
        c.push_str(&emit::u8_array("ta_speed", &if speeds.is_empty() { vec![0] } else { speeds }, 16, false));
        c.push_str(&emit::u16_array("ta_dest", &if dest.is_empty() { vec![0] } else { dest }));
        c.push_str(&emit::u16_array("ta_src", &if srcs.is_empty() { vec![0] } else { srcs }));
        write_out(&out_dir, "data_tileanim.c", c)?;
        if nseq > 0 {
            println!("  tiles animees : {} sequence(s)", nseq);
        }
    }
    write_out(&out_dir, "data_font.c", gen_font(&proj_dir, &project, &ui_skins, &ui_fonts[1..], &ui_pics)?)?;
    // UI system: the theme plus the uigen layouts. The engine reads its
    // configuration through defines, always emitted (as for audio_cfg.h).
    {
        let (has_skin, speed) = match &project.ui {
            Some(u) => (u.windowskin.is_some() as u8, u.text_speed),
            None => (0, 0),
        };
        // The sheet and layout were loaded and validated upstream, when
        // the events resolved widget names; here we only emit.
        let icon_count = ui_icon_count;
        let icon_base = ui_icon_base;
        let (layout, prims) = (&ui_layout, &ui_prims);
        write_out(
            &out_dir,
            "ui_cfg.h",
            format!(
                "/* GENERE par datagen — ne pas editer. */\n#define UI_HAS_SKIN {}\n#define UI_TEXT_SPEED {}\n#define UI_ICON_BASE {}\n#define UI_ICON_COUNT {}\n#define UI_STYLE_COUNT {}\n{}",
                has_skin,
                speed,
                icon_base,
                icon_count,
                ui_style_rows.len(),
                ui::cfg_defines(layout, prims, &ui_widgets)
            ),
        )?;
        let ui_ov_font_bases: Vec<usize> =
            prims.iter().map(|p| ui_font_base(&p.font)).collect();
        write_out(
            &out_dir,
            "ui_overlays.c",
            ui::emit_overlays(prims, &ui_widgets, &ui_ov_font_bases),
        )?;
        write_out(&out_dir, "ui_styles.c", ui::emit_styles(&ui_style_rows))?;
        if !prims.is_empty() {
            println!("  ui : {} primitive(s) de widgets (designer D1)", prims.len());
        }
    }

    // Database (docs/PLANNING_SYSTEME_DATABASE.md): TOML schemas and
    // instances to byte-packed C tables. Purge the db_* of a previous run
    // first, or a deleted table leaves a ghost symbol.
    for entry in std::fs::read_dir(&out_dir)? {
        let path = entry?.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name.starts_with("db_") && !path.is_dir() {
            std::fs::remove_file(&path)
                .with_context(|| format!("purge de {}", path.display()))?;
        }
    }
    match &mut database {
        Some(d) => {
            db::encode(d, &text_ids, &db::ResNames {
                pictures: &pic_names,
                sounds: &sound_names,
                musics: &music_names,
            })?;
            for (name, content) in db::emit_files(d) {
                write_out(&out_dir, &name, content)?;
            }
            for (ti, sc) in d.schemas.iter().enumerate() {
                println!(
                    "  database : table {} — {} entree(s) x {} octets",
                    sc.name,
                    d.ids[ti].len(),
                    db::entry_size(sc)
                );
            }
        }
        None => {
            // empty registry: the engine includes db_tables.h unconditionally
            for (name, content) in db::emit_empty() {
                write_out(&out_dir, &name, content)?;
            }
        }
    }

    println!(
        "datagen : {} scenes, {} textes -> {}",
        scenes.len(),
        texts.len(),
        out_dir.display()
    );
    Ok(())
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    let data = std::fs::read_to_string(path)
        .with_context(|| format!("lecture de {}", path.display()))?;
    serde_json::from_str(&data).with_context(|| format!("parse de {}", path.display()))
}

fn write_out(dir: &Path, name: &str, content: String) -> Result<()> {
    let path = dir.join(name);
    std::fs::write(&path, content).with_context(|| format!("ecriture de {}", path.display()))?;
    println!("  {}", path.display());
    Ok(())
}

fn write_bin(dir: &Path, name: &str, content: &[u8]) -> Result<()> {
    let path = dir.join(name);
    std::fs::write(&path, content).with_context(|| format!("ecriture de {}", path.display()))?;
    println!("  {} ({} octets)", path.display(), content.len());
    Ok(())
}

/// Asset C files: ONE FILE PER SET. tcc-816 emits each .c file's
/// `.rodata` as ONE SUPERFREE WLA section — unsplittable, therefore
/// 32 KB max, one LoROM bank. Putting everything in a single
/// data_assets.c capped the whole project at ~32 KB of assets ("No room
/// for section .rodata"); split per set, wlalink spreads the sections
/// over the free banks. data_assets.c keeps only the pointer tables,
/// resolved at link time as 24-bit far pointers, so each set's bank does not matter.
fn gen_asset_files(
    gfx_sets: &[tileset::GfxSet],
    sprite_sets: &[(Vec<u8>, Vec<u16>)],
) -> Result<Vec<(String, String)>> {
    // Guard rail: one section, one bank. No legitimate set comes close
    // (a full chipset is ~15 KB) — reaching this means a pathological
    // asset, not a splitting problem.
    const SET_MAX: usize = 0x7C00;
    let mut files = Vec::new();

    // One gfx set per scene (shared by fingerprint) plus pointer tables
    // indexed by gfx_set_id (header byte 1) — the "scene_table" pattern:
    // indexing an array of pointers is reliable under tcc.
    // gs{i}_prio: one byte per local id, 1 meaning above (BG1 priority).
    // gs{i}_pal: the full BG CGRAM, 8 palettes of 16 colours.
    for (i, g) in gfx_sets.iter().enumerate() {
        let bytes = g.charset.len() + 2 * g.table.len() + g.prio.len() + 2 * g.pal.len();
        if bytes > SET_MAX {
            bail!(
                "gfx set {} : {} octets > {} (une section ROM = une bank \
                 LoROM de 32 Ko) — reduire le tileset",
                i, bytes, SET_MAX
            );
        }
        let mut s = String::from(emit::HEADER);
        s.push_str("#include <snes.h>\n\n");
        s.push_str(&emit::u8_array(&format!("gs{}_chars", i), &g.charset, 16, false));
        s.push_str(&format!(
            "const u16 gs{}_chars_size = sizeof(gs{}_chars);\n\n",
            i, i
        ));
        s.push_str(&emit::u16_array(&format!("gs{}_meta", i), &g.table));
        s.push('\n');
        s.push_str(&emit::u8_array(&format!("gs{}_prio", i), &g.prio, 16, false));
        s.push('\n');
        s.push_str(&emit::u16_array(&format!("gs{}_pal", i), &g.pal));
        files.push((format!("data_gfx{}.c", i), s));
    }

    // Per-scene sprite sets: OBJ chars plus the full OBJ CGRAM
    for (i, (chars, pal)) in sprite_sets.iter().enumerate() {
        let bytes = chars.len() + 2 * pal.len();
        if bytes > SET_MAX {
            bail!(
                "sprite set {} : {} octets > {} (une section ROM = une bank \
                 LoROM de 32 Ko)",
                i, bytes, SET_MAX
            );
        }
        let mut s = String::from(emit::HEADER);
        s.push_str("#include <snes.h>\n\n");
        s.push_str(&emit::u8_array(&format!("ss{}_chars", i), chars, 16, false));
        s.push_str(&format!(
            "const u16 ss{}_chars_size = sizeof(ss{}_chars);\n\n",
            i, i
        ));
        s.push_str(&emit::u16_array(&format!("ss{}_pal", i), pal));
        files.push((format!("data_sprites{}.c", i), s));
    }

    files.push(("data_assets.c".to_string(), gen_asset_tables(gfx_sets, sprite_sets)));
    Ok(files)
}

/// data_assets.c: the pointer tables indexed by set_id, the only
/// structures the engine references. The data itself lives in the
/// data_gfx{i}.c / data_sprites{i}.c files, in banks the linker picks.
fn gen_asset_tables(
    gfx_sets: &[tileset::GfxSet],
    sprite_sets: &[(Vec<u8>, Vec<u16>)],
) -> String {
    let mut s = String::from(emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    for i in 0..gfx_sets.len() {
        s.push_str(&format!(
            "extern const u8 gs{i}_chars[];\nextern const u16 gs{i}_chars_size;\n\
             extern const u16 gs{i}_meta[];\nextern const u8 gs{i}_prio[];\n\
             extern const u16 gs{i}_pal[];\n",
            i = i
        ));
    }
    for i in 0..sprite_sets.len() {
        s.push_str(&format!(
            "extern const u8 ss{i}_chars[];\nextern const u16 ss{i}_chars_size;\n\
             extern const u16 ss{i}_pal[];\n",
            i = i
        ));
    }
    s.push('\n');

    s.push_str("const u8 *const gfx_chars[] = {\n");
    for i in 0..gfx_sets.len() {
        s.push_str(&format!("  gs{}_chars,\n", i));
    }
    s.push_str("};\n\nconst u16 *const gfx_chars_sizes[] = {\n");
    for i in 0..gfx_sets.len() {
        s.push_str(&format!("  &gs{}_chars_size,\n", i));
    }
    s.push_str("};\n\nconst u16 *const gfx_metas[] = {\n");
    for i in 0..gfx_sets.len() {
        s.push_str(&format!("  gs{}_meta,\n", i));
    }
    s.push_str("};\n\nconst u8 *const gfx_prios[] = {\n");
    for i in 0..gfx_sets.len() {
        s.push_str(&format!("  gs{}_prio,\n", i));
    }
    s.push_str("};\n\nconst u16 *const gfx_pals[] = {\n");
    for i in 0..gfx_sets.len() {
        s.push_str(&format!("  gs{}_pal,\n", i));
    }
    s.push_str("};\n\n");

    // Per-scene sprite sets, indexed by byte 27 of the Scene Header
    // through pointer tables (the "scene_table" pattern).
    s.push_str("const u8 *const sprite_chars[] = {\n");
    for i in 0..sprite_sets.len() {
        s.push_str(&format!("  ss{}_chars,\n", i));
    }
    s.push_str("};\n\nconst u16 *const sprite_chars_sizes[] = {\n");
    for i in 0..sprite_sets.len() {
        s.push_str(&format!("  &ss{}_chars_size,\n", i));
    }
    s.push_str("};\n\nconst u16 *const sprite_pals[] = {\n");
    for i in 0..sprite_sets.len() {
        s.push_str(&format!("  ss{}_pal,\n", i));
    }
    s.push_str("};\n");
    s
}

/// Pictures: data_pic{i}.c per image (4bpp chars, tilemap, palette — one
/// section, one LoROM bank) plus data_pictures.c, the registry of pointer
/// tables indexed by pic_id ("scene_table" pattern). Always emitted, with
/// dummy tables when there is no image (picture.c is unconditional).
/// Vignettes: data_vig{i}.c (the frames' 4bpp chars plus a palette) and
/// data_vignettes.c, the registry indexed by vig_id — ALWAYS emitted.
fn gen_vignette_files(
    names: &[String],
    vigs: &[(Vec<u8>, usize, Vec<u16>)],
) -> Vec<(String, String)> {
    let mut files = Vec::new();
    for (i, (chars, _frames, pal)) in vigs.iter().enumerate() {
        let mut s = String::from(emit::HEADER);
        s.push_str("#include <snes.h>\n\n");
        s.push_str(&format!("/* vignette « {} » */\n", names[i]));
        s.push_str(&emit::u8_array(&format!("vig{}_chars", i), chars, 16, false));
        s.push('\n');
        s.push_str(&emit::u16_array(&format!("vig{}_pal", i), pal));
        files.push((format!("data_vig{}.c", i), s));
    }
    let mut s = String::from(emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    for i in 0..vigs.len() {
        s.push_str(&format!(
            "extern const u8 vig{i}_chars[];\nextern const u16 vig{i}_pal[];\n",
            i = i
        ));
    }
    s.push_str(&format!("\nconst u8 vig_count = {};\n\n", vigs.len()));
    let n = vigs.len().max(1);
    s.push_str(&format!("const u8 vig_frames[{}] = {{ ", n));
    for i in 0..n {
        s.push_str(&format!("{}, ", vigs.get(i).map(|v| v.1).unwrap_or(0)));
    }
    s.push_str(&format!("}};\n\nconst u8 *const vig_chars[{}] = {{ ", n));
    for i in 0..n {
        if i < vigs.len() {
            s.push_str(&format!("vig{}_chars, ", i));
        } else {
            s.push_str("0, ");
        }
    }
    s.push_str(&format!("}};\n\nconst u16 *const vig_pals[{}] = {{ ", n));
    for i in 0..n {
        if i < vigs.len() {
            s.push_str(&format!("vig{}_pal, ", i));
        } else {
            s.push_str("0, ");
        }
    }
    s.push_str("};\n");
    files.push(("data_vignettes.c".to_string(), s));
    files
}

fn gen_picture_files(
    names: &[String],
    pics: &[(Vec<u8>, Vec<u16>, Vec<u16>)],
    trans: &[bool],
    dims: &[(usize, usize)],
) -> Vec<(String, String)> {
    let mut files = Vec::new();

    for (i, (chars, map, pal)) in pics.iter().enumerate() {
        let mut s = String::from(emit::HEADER);
        s.push_str("#include <snes.h>\n\n");
        s.push_str(&format!("/* picture « {} » */\n", names[i]));
        s.push_str(&emit::u8_array(&format!("pic{}_chars", i), chars, 16, false));
        s.push_str(&format!(
            "const u16 pic{}_chars_size = sizeof(pic{}_chars);\n\n",
            i, i
        ));
        s.push_str(&emit::u16_array(&format!("pic{}_map", i), map));
        s.push('\n');
        s.push_str(&emit::u16_array(&format!("pic{}_pal", i), pal));
        files.push((format!("data_pic{}.c", i), s));
    }

    let mut s = String::from(emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    for i in 0..pics.len() {
        s.push_str(&format!(
            "extern const u8 pic{i}_chars[];\nextern const u16 pic{i}_chars_size;\n\
             extern const u16 pic{i}_map[];\nextern const u16 pic{i}_pal[];\n",
            i = i
        ));
    }
    s.push_str(&format!("\nconst u8 pic_count = {};\n\n", pics.len()));
    // Dimensions in tiles: the engine clamps and centres at RUNTIME, which
    // is mandatory as soon as the position or the image comes from a variable.
    {
        let n = pics.len().max(1);
        s.push_str(&format!("const u8 pic_wt[{}] = {{ ", n));
        for i in 0..n {
            s.push_str(&format!("{}, ", dims.get(i).map(|d| d.0 / 8).unwrap_or(0)));
        }
        s.push_str(&format!("}};\nconst u8 pic_ht[{}] = {{ ", n));
        for i in 0..n {
            s.push_str(&format!("{}, ", dims.get(i).map(|d| d.1 / 8).unwrap_or(0)));
        }
        s.push_str("};\n\n");
    }
    // Per-image flags: bit 0 is transparency, which makes the engine keep
    // the scenery layer visible and preserve the scene's backdrop colour.
    {
        let n = pics.len().max(1);
        s.push_str(&format!("const u8 pic_flags[{}] = {{ ", n));
        for i in 0..n {
            s.push_str(&format!("{}, ", trans.get(i).map(|&t| t as u8).unwrap_or(0)));
        }
        s.push_str("};\n\n");
    }
    let n = pics.len().max(1);
    s.push_str(&format!("const u8 *const pic_chars[{}] = {{ ", n));
    for i in 0..n {
        if i < pics.len() {
            s.push_str(&format!("pic{}_chars, ", i));
        } else {
            s.push_str("0, ");
        }
    }
    s.push_str(&format!("}};\n\nconst u16 *const pic_chars_sizes[{}] = {{ ", n));
    for i in 0..n {
        if i < pics.len() {
            s.push_str(&format!("&pic{}_chars_size, ", i));
        } else {
            s.push_str("0, ");
        }
    }
    s.push_str(&format!("}};\n\nconst u16 *const pic_maps[{}] = {{ ", n));
    for i in 0..n {
        if i < pics.len() {
            s.push_str(&format!("pic{}_map, ", i));
        } else {
            s.push_str("0, ");
        }
    }
    s.push_str(&format!("}};\n\nconst u16 *const pic_pals[{}] = {{ ", n));
    for i in 0..n {
        if i < pics.len() {
            s.push_str(&format!("pic{}_pal, ", i));
        } else {
            s.push_str("0, ");
        }
    }
    s.push_str("};\n");
    files.push(("data_pictures.c".to_string(), s));
    files
}

fn gen_font(
    proj_dir: &Path,
    project: &project::Project,
    ui_skins: &[String],
    ui_extra_fonts: &[String],
    ui_pics: &[(String, Vec<u8>, u8, u8)],
) -> Result<String> {
    let font = gfx::load_indexed_png(&proj_dir.join(&project.assets.font))?;

    let mut s = String::from(emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    let mut gfx_bytes = font.to_font()?;

    // VRAM order (the plan computed at the top of main): font 0 | skins
    // (9 chars each, theme then styles) | icons (normal, then
    // panel-background variants) | the styles' extra fonts (96 chars).
    // Every font and skin shares the PALETTE of font 0.
    for skin_path in ui_skins.iter() {
        let skin = gfx::load_indexed_png(&proj_dir.join(skin_path))
            .with_context(|| format!("windowskin {}", skin_path))?;
        gfx_bytes.extend(skin.to_windowskin().with_context(|| {
            format!("windowskin {}", skin_path)
        })?);
    }
    if let Some(ui) = &project.ui {
        if let Some(icons_path) = &ui.icons {
            let icons = gfx::load_indexed_png(&proj_dir.join(icons_path))
                .with_context(|| format!("icones UI {}", icons_path))?;
            gfx_bytes.extend(icons.to_icons().with_context(|| {
                format!("icones UI {}", icons_path)
            })?);
            gfx_bytes.extend(icons.to_icons_bg().with_context(|| {
                format!("icones UI {}", icons_path)
            })?);
        }
    }
    for extra in ui_extra_fonts.iter() {
        let f = gfx::load_indexed_png(&proj_dir.join(extra))
            .with_context(|| format!("fonte de style {}", extra))?;
        gfx_bytes.extend(f.to_font_glyphs().with_context(|| {
            format!("fonte de style {}", extra)
        })?);
    }
    // "Image" widget images are placed LAST, in the order the layout
    // meets them — the same order as the char plan computed at the top of
    // main (ui_pic_base).
    for (_, chars, _, _) in ui_pics.iter() {
        gfx_bytes.extend_from_slice(chars);
    }
    s.push_str(&emit::u8_array("font_gfx", &gfx_bytes, 16, false));
    s.push_str("\nconst u16 font_gfx_size = sizeof(font_gfx);\n\n");
    let mut pal = font.palette_n(4);
    pal[0] = 0; // index 0 : transparent
    s.push_str(&emit::u16_array("textbox_pal", &pal));
    Ok(s)
}
