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
mod chipset;
mod emit;
mod gfx;
mod project;
mod script;
mod tileset;

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
    if args.len() != 3 {
        bail!(
            "usage : datagen <dossier_projet> <dossier_engine>\n\
             \x20       datagen import-chipset <chipset.png> <dossier_projet> <nom>"
        );
    }
    let proj_dir = PathBuf::from(&args[1]);
    let engine_dir = PathBuf::from(&args[2]);
    let out_dir = engine_dir.join("src/data");

    let project: project::Project =
        read_json(&proj_dir.join("project.json")).context("project.json")?;
    let texts: Vec<project::TextEntry> =
        read_json(&proj_dir.join("texts.json")).context("texts.json")?;

    let mut text_ids: HashMap<String, u16> = HashMap::new();
    for (i, t) in texts.iter().enumerate() {
        if text_ids.insert(t.name.clone(), i as u16).is_some() {
            bail!("texte en double : '{}'", t.name);
        }
    }

    let mut scenes = Vec::new();
    for name in &project.scenes {
        let scene: project::Scene =
            read_json(&proj_dir.join("scenes").join(format!("{}.json", name)))
                .with_context(|| format!("scene '{}'", name))?;
        if &scene.name != name {
            bail!("scene '{}' : champ name incoherent ('{}')", name, scene.name);
        }
        scene.validate()?;
        scenes.push(scene);
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
        sources[ts].verify_gfx(&sc.name, &gfx)?;
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

    // Banks binaires (spec §1-2) + asm d'épinglage
    let scene_bank = binbank::build_scene_bank(
        &scenes, &grids, &set_ids, &text_ids, &music_ids, boot_id as u8,
    )?;
    let text_bank = binbank::build_text_bank(&texts)?;
    write_bin(&out_dir, "scenes.bin", &scene_bank)?;
    write_bin(&out_dir, "texts.bin", &text_bank)?;
    write_out(&engine_dir, "databanks.asm", binbank::databanks_asm())?;

    // Assets gfx (representation C v0 — pas de format binaire en spec)
    write_out(&out_dir, "data_assets.c", gen_assets(&proj_dir, &project, &gfx_sets)?)?;
    write_out(&out_dir, "data_font.c", gen_font(&proj_dir, &project)?)?;

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

fn gen_assets(
    proj_dir: &Path,
    project: &project::Project,
    gfx_sets: &[tileset::GfxSet],
) -> Result<String> {
    let sprites = gfx::load_indexed_png(&proj_dir.join(&project.assets.sprites))?;

    let mut s = String::from(emit::HEADER);
    s.push_str("#include <snes.h>\n\n");

    // Un gfx set par scene (partage par empreinte) + tables de pointeurs
    // indexees par gfx_set_id (header octet 1) — pattern « scene_table » :
    // l'indexation d'un tableau de pointeurs est fiable chez tcc.
    // gs{i}_prio : 1 octet par id local, 1 = ☆ (priorite BG1, couche sup).
    // gs{i}_pal : CGRAM BG complete, 8 palettes x 16 couleurs.
    for (i, g) in gfx_sets.iter().enumerate() {
        s.push_str(&emit::u8_array(&format!("gs{}_chars", i), &g.charset, 16, true));
        s.push_str(&format!(
            "static const u16 gs{}_chars_size = sizeof(gs{}_chars);\n\n",
            i, i
        ));
        s.push_str(&emit::u16_array_static(&format!("gs{}_meta", i), &g.table));
        s.push('\n');
        s.push_str(&emit::u8_array(&format!("gs{}_prio", i), &g.prio, 16, true));
        s.push('\n');
        s.push_str(&emit::u16_array_static(&format!("gs{}_pal", i), &g.pal));
        s.push('\n');
    }

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

    s.push_str(&emit::u8_array("sprite_gfx", &sprites.to_obj_sheet()?, 16, false));
    s.push_str("\nconst u16 sprite_gfx_size = sizeof(sprite_gfx);\n\n");
    s.push_str(&emit::u16_array("sprite_pal", &sprites.palette_n(16)));
    Ok(s)
}

fn gen_font(proj_dir: &Path, project: &project::Project) -> Result<String> {
    let font = gfx::load_indexed_png(&proj_dir.join(&project.assets.font))?;

    let mut s = String::from(emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    s.push_str(&emit::u8_array("font_gfx", &font.to_font()?, 16, false));
    s.push_str("\nconst u16 font_gfx_size = sizeof(font_gfx);\n\n");
    let mut pal = font.palette_n(4);
    pal[0] = 0; // index 0 : transparent
    s.push_str(&emit::u16_array("textbox_pal", &pal));
    Ok(s)
}
