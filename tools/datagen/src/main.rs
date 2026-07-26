//! datagen — SNES Studio Phase 2 : projet source (JSON + PNG indexés) →
//! fichiers de données C consommés par le moteur (engine/src/data/).
//!
//! Usage : datagen <dossier_projet> <dossier_sortie>
//!   ex.  : datagen demo engine/src/data
//!
//! Le format binaire byte-exact (banks épinglées, Scene Table à adresse
//! fixe — spec §1) viendra en Phase 2b ; cette passe émet la représentation
//! C v0 de la Phase 1, à l'identique de ce que le moteur consomme déjà.

mod emit;
mod gfx;
mod project;
mod script;

use anyhow::{bail, Context, Result};
use std::collections::HashMap;
use std::fmt::Write as _;
use std::path::{Path, PathBuf};

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        bail!("usage : datagen <dossier_projet> <dossier_sortie>");
    }
    let proj_dir = PathBuf::from(&args[1]);
    let out_dir = PathBuf::from(&args[2]);

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

    std::fs::create_dir_all(&out_dir)?;
    write_out(&out_dir, "data_scenes.c", gen_scenes(&scenes, &text_ids, boot_id as u8)?)?;
    write_out(&out_dir, "data_texts.c", gen_texts(&texts))?;
    write_out(&out_dir, "data_assets.c", gen_assets(&proj_dir, &project)?)?;
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

fn gen_scenes(
    scenes: &[project::Scene],
    text_ids: &HashMap<String, u16>,
    boot_id: u8,
) -> Result<String> {
    let mut s = String::from(emit::HEADER);
    s.push_str("#include <snes.h>\n#include \"../formats.h\"\n\n");

    for (i, sc) in scenes.iter().enumerate() {
        let asm = script::assemble(&sc.script, text_ids)
            .with_context(|| format!("script de la scene '{}'", sc.name))?;

        let _ = write!(s, "/* ---- Scene {} : {} ({}x{}) ---- */\n\n", i, sc.name, sc.width, sc.height);
        s.push_str(&emit::u8_grid(&format!("scene{}_tilemap", i), &sc.tilemap, true));
        s.push('\n');
        s.push_str(&emit::u8_grid(&format!("scene{}_collision", i), &sc.collision, true));
        s.push('\n');
        s.push_str(&emit::u8_array(&format!("scene{}_scripts", i), &asm.bytecode, 16, true));
        s.push('\n');

        if !sc.actors.is_empty() {
            let _ = write!(s, "static const ActorDef scene{}_actors[] = {{\n", i);
            for a in &sc.actors {
                let ofs = match &a.entry {
                    None => 0xFFFFu16, // SCRIPT_NONE
                    Some(label) => *asm.labels.get(label).with_context(|| {
                        format!("scene '{}' : entry '{}' introuvable dans le script", sc.name, label)
                    })?,
                };
                let _ = write!(
                    s,
                    "  {{ ACTOR_TYPE_NPC_STATIC, {}, {}, {}, 0x{:04X}, {}, 0 }},\n",
                    a.x,
                    a.y,
                    a.sprite,
                    ofs,
                    project::dir_code(&a.dir)?
                );
            }
            s.push_str("};\n\n");
        }

        let actors_ref = if sc.actors.is_empty() {
            "0".to_string()
        } else {
            format!("scene{}_actors", i)
        };
        let _ = write!(
            s,
            "static const SceneDef scene{i} = {{\n  SCENE_TYPE_TOP_DOWN,\n  0,\n  {w}, {h},\n  scene{i}_tilemap,\n  scene{i}_collision,\n  {actors},\n  scene{i}_scripts,\n  {count},\n  {px}, {py},\n  0,\n}};\n\n",
            i = i,
            w = sc.width,
            h = sc.height,
            actors = actors_ref,
            count = sc.actors.len(),
            px = sc.player_start[0],
            py = sc.player_start[1],
        );
    }

    s.push_str("/* ---- Scene Table (spec §1.1, representation C v0) ---- */\n\n");
    s.push_str("const SceneDef *const scene_table[] = {\n");
    for i in 0..scenes.len() {
        let _ = write!(s, "  &scene{},\n", i);
    }
    s.push_str("};\n\n");
    let _ = write!(s, "const u16 scene_count = {};\n\n", scenes.len());
    let _ = write!(s, "const u8 boot_scene_id = {};\n", boot_id);
    Ok(s)
}

fn gen_texts(texts: &[project::TextEntry]) -> String {
    let mut s = String::from(emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    for t in texts {
        let _ = write!(s, "static const char txt_{}[] = {};\n", t.name, emit::c_string(&t.text));
    }
    s.push_str("\nconst char *const text_table[] = {\n");
    for (i, t) in texts.iter().enumerate() {
        let _ = write!(s, "  txt_{}, /* {} */\n", t.name, i);
    }
    s.push_str("};\n\n");
    let _ = write!(s, "const u16 text_count = {};\n", texts.len());
    s
}

fn gen_assets(proj_dir: &Path, project: &project::Project) -> Result<String> {
    let tileset = gfx::load_indexed_png(&proj_dir.join(&project.assets.tileset))?;
    let sprites = gfx::load_indexed_png(&proj_dir.join(&project.assets.sprites))?;

    let mut s = String::from(emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    s.push_str(&emit::u8_array("tileset", &tileset.to_bg_tileset()?, 16, false));
    s.push_str("\nconst u16 tileset_size = sizeof(tileset);\n\n");
    s.push_str(&emit::u16_array("tileset_pal", &tileset.palette_n(16)));
    s.push('\n');
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
