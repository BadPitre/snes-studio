//! datagen — SNES Studio Phase 2 : projet source (JSON + PNG indexés) →
//! données moteur.
//!
//! Usage : datagen <dossier_projet> <dossier_engine>
//!   ex.  : datagen demo engine
//!
//! Sorties :
//!  - engine/src/data/scenes.bin + texts.bin — format binaire byte-exact
//!    (spec §1-2), épinglés en banks $82/$86 par engine/databanks.asm
//!  - engine/src/data/data_assets.c + data_font.c — assets gfx (C, v0)

mod binbank;
mod charset;
mod chipset;
mod db;
mod emit;
mod events;
mod gfx;
mod project;
mod script;
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
    if args.len() != 3 {
        bail!(
            "usage : datagen <dossier_projet> <dossier_engine>\n\
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
    // Database (Phase 10) : chargée AVANT les events (la commande db_read
    // résout tables/entrées/champs), encodée APRÈS (text_id → banque close)
    let mut database = db::load(&proj_dir)?;
    // blocs référencés par des pas gfx: (Move Route), par scène
    let mut scene_gfx_blocks: Vec<Vec<u8>> = Vec::new();

    // Layout UI chargé TÔT (Phase 12) : la commande d'event « Afficher
    // un widget UI » résout les noms de widgets vers leurs index
    let ui_icon_count = match project.ui.as_ref().and_then(|u| u.icons.as_ref()) {
        Some(path) => gfx::load_indexed_png(&proj_dir.join(path))?.width / 8,
        None => 0,
    };
    let (ui_layout, ui_prims, ui_widgets) = ui::load(&proj_dir, ui_icon_count)?;
    let ui_widget_ids: Vec<String> = ui_widgets.iter().map(|w| w.0.clone()).collect();
    let ui_style_ids: Vec<String> =
        ui_layout.dialog_style.iter().map(|st| st.id.clone()).collect();

    // S1 — plan des ressources VRAM BG3 (bases de chars, budget 256) :
    // fonte 0 (97 chars : transparent + 96 glyphes) | skins (9 chars
    // chacun) | icones (2 x N : normales + variantes fond de panneau) |
    // fontes supplementaires (96 chars, base sur ' ')
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
    // fontes des WIDGETS (S2) : dédupliquées avec celles des styles
    for p in &ui_prims {
        if let Some(f) = &p.font {
            if !ui_fonts.contains(f) {
                ui_fonts.push(f.clone());
            }
        }
    }
    let ui_skin_base = |path: &Option<String>| -> usize {
        // base char d'un skin (0 = boite pleine) — theme si absent
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
    let ui_total_chars =
        ui_icon_base + 2 * ui_icon_count + 96 * (ui_fonts.len() - 1);
    if ui_total_chars > 256 {
        bail!(
            "ui : budget de caracteres BG3 depasse ({} > 256) — fonte(s) {} x 96,              skin(s) {} x 9, {} icone(s) x 2. Retirer un style, une fonte ou des icones.",
            ui_total_chars, ui_fonts.len(), ui_skins.len(), ui_icon_count
        );
    }
    // tables des styles : style 0 (defaut) puis les dialog_style
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

    // Pictures (S3) : PNG indexés ≤ 16 couleurs compilés en chars 4bpp
    // dédupliqués + tilemap + palette — les commandes pic_show les
    // référencent par stem, chargés AVANT les scènes
    let mut pic_names: Vec<String> = Vec::new();
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
        pic_data
            .push(img.to_picture(entry.trans()).with_context(|| format!("picture '{}'", rel))?);
        pic_names.push(stem);
        pic_trans.push(entry.trans());
    }
    if pic_names.len() > 32 {
        bail!("{} pictures (max 32)", pic_names.len());
    }

    let mut scenes = Vec::new();
    for name in &project.scenes {
        let mut scene: project::Scene =
            read_json(&proj_dir.join("scenes").join(format!("{}.json", name)))
                .with_context(|| format!("scene '{}'", name))?;
        if &scene.name != name {
            bail!("scene '{}' : champ name incoherent ('{}')", name, scene.name);
        }
        scene.validate()?;
        // Héritage : les vieux acteurs trigger/auto étaient invisibles
        for a in &mut scene.actors {
            if a.kind != "npc" {
                a.sprite = 255;
            }
        }
        // Événements (Event Editor) : compilés vers acteurs + asm VM, leurs
        // textes inline rejoignent la bank de textes (dédupliqués).
        // v0.16 : TOUJOURS exécuté — chaque bloc scripts commence par la
        // table CETAB des common events auto (offset 0, lue par le moteur),
        // même vide.
        {
            let mut ec = events::EventCompiler::new(&mut texts);
            let (asm, actors, gfx_blocks, cetab) = ec.compile_scene(
                name,
                &scene.events,
                &project.common_events,
                database.as_ref(),
                &ui_widget_ids,
                &ui_style_ids,
                &pic_names,
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

    // Musiques : id = index dans project.musics, nom = stem du fichier
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

    // Tilesets : id = index dans project.tilesets (defaut : assets.tileset seul)
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

    // Copie des modules vers engine/src/data/music/NN_stem.it : l'ordre
    // alphabétique (préfixe) = l'ordre des music_id pour le soundbank Make
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
    write_out(
        &out_dir,
        "audio_cfg.h",
        format!(
            "/* GENERE par datagen — ne pas editer. */
#define AUDIO_ENABLED {}
",
            if project.musics.is_empty() { 0 } else { 1 }
        ),
    )?;

    // Tilesets : grille + sidecar (autotiles, passabilité). Les variantes
    // d'autotiles UTILISÉES par les scènes sont collectées avant compilation
    // (les ids binaires suivent la grille, ordre déterministe).
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

    // Validation des ids logiques des deux couches
    for sc in &scenes {
        let ts = scene_ts(sc)?;
        let src = &sources[ts];
        let upper = sc.upper_or_empty();
        for (layer, allow_empty) in [(&sc.tilemap, false), (&upper, true)] {
            for row in layer.iter() {
                for &id in row {
                    let ok = src.valid_id(id) || (allow_empty && id == tileset::EMPTY);
                    if !ok {
                        bail!("scene '{}' : id de tile {} hors tileset", sc.name, id);
                    }
                }
            }
        }
    }

    // GFX compilés PAR SCÈNE (budget VRAM réel) — partagés entre scènes
    // au contenu identique (empreinte)
    let mut fp_ids: HashMap<Vec<u8>, u8> = HashMap::new();
    let mut gfx_sets: Vec<tileset::GfxSet> = Vec::new();
    let mut set_ids: Vec<u8> = Vec::new();
    let mut grids = Vec::new();
    for sc in &scenes {
        let ts = scene_ts(sc)?;
        let upper = sc.upper_or_empty();
        let gfx = sources[ts].compile_scene(&sc.name, &sc.tilemap, &upper)?;
        gfx.verify(&sc.name)?;
        grids.push(sources[ts].expand_scene(&gfx, &sc.name, &sc.tilemap, &upper)?);
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

    // Feuille de sprites 16x24 (Phase 6) : blocs de personnage de 12 frames
    // (modele charset RM2003) — sprite d'un acteur = index de bloc.
    // Sets compilés PAR SCÈNE (v0.5, comme les tilesets) : chaque scène
    // n'embarque que le bloc joueur (0) + les blocs de ses acteurs (5 max),
    // datagen remappe les sprite_id binaires vers les slots locaux.
    let sprites = gfx::load_indexed_png(&proj_dir.join(&project.assets.sprites))
        .with_context(|| format!("sprites {}", project.assets.sprites))?;
    let sprite_blocks = sprites.sprite_blocks()?;
    let mut ss_ids: HashMap<Vec<usize>, u8> = HashMap::new();
    let mut sprite_sets: Vec<(Vec<u8>, Vec<u16>)> = Vec::new();
    let mut sprite_set_ids: Vec<u8> = Vec::new();
    let mut sprite_remaps: Vec<HashMap<u8, u8>> = Vec::new();
    for (sci, sc) in scenes.iter().enumerate() {
        let mut used: std::collections::BTreeSet<usize> = [0usize].into();
        for &b in &scene_gfx_blocks[sci] {
            if (b as usize) >= sprite_blocks {
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
            // Nommer les coupables : ce n'est PAS le nombre d'events qui
            // deborde mais la variete d'apparences (VRAM OBJ = 16 Ko, soit
            // 5 charsets par scene, heros compris).
            let charset_name = |b: usize| -> String {
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

    // Banks binaires (spec §1-2) + asm d'épinglage
    let scene_bank = binbank::build_scene_bank(
        &scenes, &grids, &set_ids, &sprite_set_ids, &sprite_remaps, &text_ids,
        &music_ids, boot_id as u8,
    )?;
    let text_bank = binbank::build_text_bank(&texts)?;
    write_bin(&out_dir, "scenes.bin", &scene_bank)?;
    write_bin(&out_dir, "texts.bin", &text_bank)?;
    write_out(&engine_dir, "databanks.asm", binbank::databanks_asm())?;

    // Assets gfx (representation C v0 — pas de format binaire en spec).
    // Un fichier par set (section ROM insécable = 32 Ko max) : purger
    // d'abord les data_gfx*/data_sprites* d'une génération précédente,
    // sinon un set disparu resterait compilé et lié (symboles fantômes).
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
    // S4 : les images à transparence vivent sur la palette BG 7 — si un
    // tileset l'occupe aussi, le décor visible derrière l'image serait
    // faux DANS SES scènes (avertissement, pas une erreur : l'auteur
    // peut ne jamais montrer l'image là-bas)
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
    // Pictures (S3) : un fichier par image (une section ROM = une bank)
    // + le registre data_pictures.c — TOUJOURS émis (le moteur inclut
    // picture.c inconditionnellement, tables factices si aucune image)
    for (name, content) in gen_picture_files(&pic_names, &pic_data, &pic_trans) {
        write_out(&out_dir, &name, content)?;
    }
    if !pic_names.is_empty() {
        println!("  pictures : {} image(s) plein ecran", pic_names.len());
    }
    write_out(&out_dir, "data_font.c", gen_font(&proj_dir, &project, &ui_skins, &ui_fonts[1..])?)?;
    // Système UI (Phase 11) : thème v1 + layouts uigen — le moteur lit la
    // config via defines (même mécanisme qu'audio_cfg.h, toujours émis)
    {
        let (has_skin, speed) = match &project.ui {
            Some(u) => (u.windowskin.is_some() as u8, u.text_speed),
            None => (0, 0),
        };
        // planche + layout déjà chargés/validés en amont (résolution des
        // widgets par les events) — on ne fait qu'émettre
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

    // Database (Phase 10, docs/PLANNING_SYSTEME_DATABASE.md) : schémas +
    // instances TOML → tables C byte-packed. Purge d'abord les db_* d'une
    // génération précédente (table supprimée = symbole fantôme sinon).
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
            db::encode(d, &text_ids)?;
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
            // registre vide : le moteur inclut db_tables.h sans condition
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

/// Fichiers C d'assets : UN FICHIER PAR SET. tcc-816 émet le `.rodata` de
/// chaque .c comme UNE section WLA SUPERFREE — insécable, donc 32 Ko max
/// (une bank LoROM). Tout dans un seul data_assets.c plafonnait le projet
/// entier à ~32 Ko d'assets (« No room for section .rodata ») ; en
/// éclatant par set, wlalink répartit les sections sur les banks libres.
/// data_assets.c ne garde que les tables de pointeurs (résolues au link,
/// pointeurs far 24-bit : la bank de chaque set n'importe pas).
fn gen_asset_files(
    gfx_sets: &[tileset::GfxSet],
    sprite_sets: &[(Vec<u8>, Vec<u16>)],
) -> Result<Vec<(String, String)>> {
    // Garde-fou : une section = une bank. Aucun set légitime n'approche
    // cette taille (chipset complet ~15 Ko) — si on y arrive, c'est un
    // asset pathologique, pas un problème de découpage.
    const SET_MAX: usize = 0x7C00;
    let mut files = Vec::new();

    // Un gfx set par scene (partage par empreinte) + tables de pointeurs
    // indexees par gfx_set_id (header octet 1) — pattern « scene_table » :
    // l'indexation d'un tableau de pointeurs est fiable chez tcc.
    // gs{i}_prio : 1 octet par id local, 1 = ☆ (priorite BG1, couche sup).
    // gs{i}_pal : CGRAM BG complete, 8 palettes x 16 couleurs.
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

    // Sprite sets par scène (v0.5) : chars OBJ + CGRAM OBJ complète
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

/// data_assets.c : les tables de pointeurs indexées par set_id, seules
/// structures que le moteur référence (les données vivent dans les
/// data_gfx{i}.c / data_sprites{i}.c, banks choisies par le linker).
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

    // Sprite sets par scène (v0.5), indexés par l'octet 27 du Scene
    // Header via des tables de pointeurs (pattern « scene_table »).
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

/// Pictures (S3) : data_pic{i}.c par image (chars 4bpp + tilemap + palette,
/// une section = une bank LoROM) + data_pictures.c, le registre de tables
/// de pointeurs indexées par pic_id (pattern « scene_table »). Toujours
/// émis — tables factices sans image (picture.c est inconditionnel).
fn gen_picture_files(
    names: &[String],
    pics: &[(Vec<u8>, Vec<u16>, Vec<u16>)],
    trans: &[bool],
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
    // drapeaux par image (S4) : bit 0 = transparence (le moteur laisse la
    // couche décor visible et préserve la couleur de fond de la scène)
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
) -> Result<String> {
    let font = gfx::load_indexed_png(&proj_dir.join(&project.assets.font))?;

    let mut s = String::from(emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    let mut gfx_bytes = font.to_font()?;

    // Ordre VRAM (S1, plan calculé en tête de main) : fonte 0 | skins
    // (9 chars chacun, thème puis styles) | icônes (normales + variantes
    // fond de panneau) | fontes supplémentaires des styles (96 chars).
    // Toutes les fontes/skins partagent la PALETTE de la fonte 0.
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
    s.push_str(&emit::u8_array("font_gfx", &gfx_bytes, 16, false));
    s.push_str("\nconst u16 font_gfx_size = sizeof(font_gfx);\n\n");
    let mut pal = font.palette_n(4);
    pal[0] = 0; // index 0 : transparent
    s.push_str(&emit::u16_array("textbox_pal", &pal));
    Ok(s)
}
