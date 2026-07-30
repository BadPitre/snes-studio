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
    // --debug (S6) : grave le drapeau du menu de debug dans la ROM —
    // passé par le bouton « Jouer » de l'éditeur, jamais par le build
    // cartouche (une cartouche ne doit pas embarquer le menu)
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

    // Vignettes (B5) : bandes de frames 32x32 en sprites OBJ — les
    // commandes vig_show les référencent par stem
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

    // Écrans composés (B6bis) : screens/<nom>.json — validés ici, déroulés
    // en commandes stage par events.rs (aucun format binaire nouveau)
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
        // héritage : l'ancien champ « script » devient le premier
        // script nommé
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

    // Sons (B1) : id = index dans project.sounds, nom = stem du fichier
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
    let music_names: Vec<String> = project
        .musics
        .iter()
        .map(|m| Path::new(m).file_stem().unwrap().to_str().unwrap().to_string())
        .collect();

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
                &pic_dims,
                &sound_names,
                &music_names,
                &vig_names,
                &screens,
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
    // Sons (B1) : WAV -> BRR 8 kHz, data_sfx.c TOUJOURS émis (zéro
    // donnée en dur dans le moteur — vide sans sons), région SPC = le
    // plus gros son (ils s'y chargent chacun leur tour, cf sfx.rs)
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
        // S10 : la gomme (-1) est acceptée sur les DEUX couches — cellule
        // vide = noir en jeu (expand_scene la gère déjà, la validation
        // était restée pré-S10)
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

    // GFX compilés PAR SCÈNE (budget VRAM réel) — partagés entre scènes
    // au contenu identique (empreinte)
    let mut fp_ids: HashMap<Vec<u8>, u8> = HashMap::new();
    let mut gfx_sets: Vec<tileset::GfxSet> = Vec::new();
    let mut set_ids: Vec<u8> = Vec::new();
    let mut grids = Vec::new();
    // T1 — tiles animées : par scène, séquences résolues en chars du
    // gfx set (dest = chars VRAM de la tile de base, src = chars ROM de
    // chaque frame). (dest4, frames de 4 chars, mode 0="123"/1="1232",
    // vitesse en frames d'affichage)
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
            // partage de chars toléré ENTRE les frames de la séquence
            // (quarts inchangés), interdit avec toute autre tile
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

    // Banks binaires (spec §1-2) + asm d'épinglage — multi-bank (M1) :
    // les pools scènes et textes s'étendent sur des banks supplémentaires
    // allouées à la suite (EXTRA_WLA_FIRST…)
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
    // purge des .bin d'un build précédent plus large (le databanks.asm ne
    // les référence plus, mais un fichier orphelin sème le doute)
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

    // Menu de debug (S6) : drapeau + budgets RÉELS des banks, gravés dans
    // les données — TOUJOURS émis (le moteur inclut debug.c
    // inconditionnellement, inerte sans le drapeau). La rangée SCN/TXT
    // est PRÉ-FORMATÉE ici : le moteur n'a ni division ni place pour
    // formater des totaux multi-bank (M1).
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
    for (name, content) in gen_vignette_files(&vig_names, &vig_data) {
        write_out(&out_dir, &name, content)?;
    }
    for (name, content) in gen_picture_files(&pic_names, &pic_data, &pic_trans, &pic_dims) {
        write_out(&out_dir, &name, content)?;
    }
    if !pic_names.is_empty() {
        println!("  pictures : {} image(s) plein ecran", pic_names.len());
    }
    // Couche d'effet par scène (S9) : data_effects.c TOUJOURS émis (le
    // moteur inclut effectlayer.c inconditionnellement) — 0xFF = aucune.
    // Vitesses en px/s converties en pas 8.8 par frame (60 Hz).
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
            // Position du plan (S17) : "front" surimpression, "back" panorama
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
            // Le plan d'effet vit sur la palette BG 7 (slot dédié) : l'image
            // DOIT être importée « avec transparence » — c'est ce qui la
            // range sur la palette 7 (sinon elle pointe la palette 0 du
            // décor, couleurs fausses). Front : les pixels index 0 laissent
            // voir le décor. Back (panorama) : index 0 = transparent aussi
            // (on voit le fond noir) — réserver l'index 0 dans l'image.
            if !pic_trans[idx] {
                bail!(
                    "scene '{}' : l'image d'effet « {} » doit être importée AVEC \
                     transparence (le plan d'effet utilise la palette dédiée ; \
                     {})",
                    sc.name, eff.pic,
                    if is_back { "panorama : reserver l'index 0, il reste transparent" }
                    else { "le decor se voit par les pixels perces" }
                );
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
            // S11 : suivi caméra = décalage binaire (camera >> n) — 1 = ½, 2 = ¼
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
    // Météo (S13) : data_weather.c TOUJOURS émis — chars 4bpp des
    // particules (pluie/neige, blocs 16x16 : TL,TR puis BL,BR) +
    // palette OBJ 7 (4 couleurs). Zéro donnée en dur dans le moteur.
    {
        // encode un char 8x8 (indices 0-15) en 4bpp planaire SNES
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
        // bloc 16x16 -> 128 octets (TL, TR, BL, BR)
        let pack_block = |bm: &[[u8; 16]; 16]| -> Vec<u8> {
            let mut out = Vec::with_capacity(128);
            for (qy, qx) in [(0usize, 0usize), (0, 8), (8, 0), (8, 8)] {
                out.extend_from_slice(&pack_char(&|x, y| bm[qy + y][qx + x]));
            }
            out
        };
        // pluie : trait diagonal 2 px (tête blanche, traîne bleutée)
        let mut rain = [[0u8; 16]; 16];
        for i in 0..12usize {
            let x = 11 - i / 2;
            let y = 2 + i;
            rain[y][x] = if i < 4 { 1 } else { 2 };
            if i % 2 == 0 && x + 1 < 16 {
                rain[y][x + 1] = 2;
            }
        }
        // neige : flocon (croix blanche + pointes bleutées)
        let mut snow = [[0u8; 16]; 16];
        for (x, y, c) in [
            (8, 8, 1u8), (7, 8, 1), (9, 8, 1), (8, 7, 1), (8, 9, 1),
            (6, 8, 2), (10, 8, 2), (8, 6, 2), (8, 10, 2),
            (7, 7, 2), (9, 9, 2), (9, 7, 2), (7, 9, 2),
        ] {
            snow[y][x] = c;
        }
        // palette OBJ 7 : transparent, blanc, bleu clair, (libre)
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

    // T1 — tiles animées : tables aplaties par scène (data_tileanim.c).
    // ta_first[s]..ta_first[s+1] = séquences de la scène s ; par séquence :
    // 4 chars VRAM de destination, n frames de 4 chars ROM sources, mode
    // (0 = 1-2-3, 1 = 1-2-3-2), vitesse en frames. Le moteur (tileanim.c)
    // copie 4 chars (128 octets) du charset ROM vers la VRAM à chaque pas.
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
/// Vignettes (B5) : data_vig{i}.c (chars 4bpp des frames + palette) +
/// data_vignettes.c, le registre indexé par vig_id — TOUJOURS émis.
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
    // dimensions en tiles (S7) : clamp/centrage RUNTIME par le moteur —
    // obligatoire dès que la position ou l'image sortent de variables
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
