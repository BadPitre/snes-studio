//! Modèle du projet source (JSON) — le format que l'éditeur (Phase 3)
//! produira. Réf : docs/SPEC_FORMATS.md.

use serde::Deserialize;

#[derive(Deserialize)]
pub struct Project {
    #[allow(dead_code)]
    pub name: String,
    pub boot_scene: String,
    pub scenes: Vec<String>,
    pub assets: Assets,
}

#[derive(Deserialize)]
pub struct Assets {
    pub tileset: String,
    pub sprites: String,
    pub font: String,
}

#[derive(Deserialize)]
pub struct Scene {
    pub name: String,
    pub width: u8,
    pub height: u8,
    pub player_start: [u8; 2],
    pub tilemap: Vec<Vec<u8>>,
    pub collision: Vec<Vec<u8>>,
    pub actors: Vec<Actor>,
    #[serde(default)]
    pub script: Vec<String>,
    #[serde(default)]
    pub warps: Vec<Warp>,
}

#[derive(Deserialize)]
pub struct Warp {
    pub x: u8,
    pub y: u8,
    /// Nom de la scène cible
    pub to: String,
    pub tx: u8,
    pub ty: u8,
}

#[derive(Deserialize)]
pub struct Actor {
    #[serde(rename = "type")]
    pub kind: String,
    pub x: u8,
    pub y: u8,
    pub sprite: u8,
    pub dir: String,
    /// Label d'entrée dans le script de la scène (absent = pas de script)
    #[serde(default)]
    pub entry: Option<String>,
}

#[derive(Deserialize)]
pub struct TextEntry {
    pub name: String,
    pub text: String,
}

impl Scene {
    /// Vérifications de cohérence avec la spec (§1.2, §1.4, contrainte >= 32)
    pub fn validate(&self) -> anyhow::Result<()> {
        use anyhow::bail;
        if self.width < 32 || self.height < 32 {
            bail!(
                "scene '{}' : map {}x{} — la spec v0 impose >= 32x32",
                self.name,
                self.width,
                self.height
            );
        }
        if self.tilemap.len() != self.height as usize
            || self.tilemap.iter().any(|r| r.len() != self.width as usize)
        {
            bail!("scene '{}' : tilemap n'est pas {}x{}", self.name, self.width, self.height);
        }
        if self.collision.len() != self.height as usize
            || self.collision.iter().any(|r| r.len() != self.width as usize)
        {
            bail!("scene '{}' : collision n'est pas {}x{}", self.name, self.width, self.height);
        }
        if self.actors.len() > 255 {
            bail!("scene '{}' : trop d'acteurs", self.name);
        }
        for a in &self.actors {
            if a.kind != "npc" {
                bail!("scene '{}' : actor_type '{}' inconnu (v0 : npc)", self.name, a.kind);
            }
            dir_code(&a.dir)?;
        }
        for w in &self.warps {
            if w.x >= self.width || w.y >= self.height {
                bail!("scene '{}' : warp ({},{}) hors map", self.name, w.x, w.y);
            }
            if self.collision[w.y as usize][w.x as usize] != 0 {
                bail!("scene '{}' : warp ({},{}) sur une tile solide", self.name, w.x, w.y);
            }
        }
        Ok(())
    }
}

pub fn dir_code(dir: &str) -> anyhow::Result<u8> {
    Ok(match dir {
        "down" => 0,
        "up" => 1,
        "left" => 2,
        "right" => 3,
        other => anyhow::bail!("direction inconnue : '{}'", other),
    })
}
