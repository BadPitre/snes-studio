//! Composed screens (screens/<name>.json).
//!
//! A screen is editor sugar: a backdrop plus up to five posed pictures and
//! a few named scripts. It is VALIDATED here and unrolled into stage
//! commands by events.rs — the engine gets no new binary format out of it.

use anyhow::{bail, Context, Result};
use std::collections::HashSet;
use std::path::Path;

use crate::project::{ScreenDef, ScreenScript};

/// Loads and validates every screen named in project.screens.
///
/// `pic_names` is the picture register: a screen may only reference a
/// picture the project still has, which is what catches a backdrop left
/// behind by a rename.
pub fn load(proj_dir: &Path, names: &[String], pic_names: &[String]) -> Result<Vec<ScreenDef>> {
    let mut screens: Vec<ScreenDef> = Vec::new();
    for name in names {
        let path = proj_dir.join("screens").join(format!("{}.json", name));
        let txt = std::fs::read_to_string(&path)
            .with_context(|| format!("écran '{}' : lecture de {}", name, path.display()))?;
        let mut def: ScreenDef = serde_json::from_str(&txt)
            .with_context(|| format!("écran '{}' : JSON invalide", name))?;
        def.name = name.clone();
        if screens.iter().any(|s| s.name == def.name) {
            bail!("écran '{}' : nom en double", name);
        }
        normalise_scripts(&mut def, name)?;
        check_pictures(&def, name, pic_names)?;
        check_vignettes(&def, name)?;
        screens.push(def);
    }
    Ok(screens)
}

/// Fills in the defaults and rejects what events.rs could not unroll: the
/// legacy single "script" field becomes the first named script, a missing
/// trigger defaults to auto for the first and call for the rest.
fn normalise_scripts(def: &mut ScreenDef, name: &str) -> Result<()> {
    if def.scripts.is_empty() {
        def.scripts.push(ScreenScript {
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
    let mut seen = HashSet::new();
    for sc in &def.scripts {
        if !seen.insert(sc.name.clone()) {
            bail!("écran '{}' : script '{}' en double", name, sc.name);
        }
    }
    Ok(())
}

/// The slots and the backdrop must name pictures the project still has.
fn check_pictures(def: &ScreenDef, name: &str, pic_names: &[String]) -> Result<()> {
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
    Ok(())
}

/// Structural checks on the posed vignettes (H3). Name resolution
/// (vignette / animation registers) happens at unroll time in
/// events.rs, which owns those registers and the richer errors.
fn check_vignettes(def: &crate::project::ScreenDef, name: &str) -> Result<()> {
    let mut seen = HashSet::new();
    for v in &def.vignettes {
        if !(1..=8).contains(&v.slot) {
            bail!("écran '{}' : sprite animé '{}' — slot 1-8", name, v.name);
        }
        if !seen.insert(v.slot) {
            bail!("écran '{}' : slot de sprite animé {} en double", name, v.slot);
        }
        if v.vig.is_empty() == v.anim.is_empty() {
            bail!(
                "écran '{}' : sprite animé '{}' — une planche OU une animation",
                name, v.name
            );
        }
    }
    Ok(())
}
