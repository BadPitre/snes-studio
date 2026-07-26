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
    /// Modules .it, dans l'ordre des music_id (optionnel)
    #[serde(default)]
    pub musics: Vec<String>,
    /// Tilesets 16x16, dans l'ordre des tileset_id (defaut : [assets.tileset])
    #[serde(default)]
    pub tilesets: Vec<String>,
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
    /// Couche inférieure : ids logiques (0.. = grille, 1000+k = autotile k)
    pub tilemap: Vec<Vec<i32>>,
    /// Couche supérieure : -1 = vide (absent = tout vide)
    #[serde(default)]
    pub upper: Option<Vec<Vec<i32>>>,
    /// Héritage pré-passabilité : IGNORÉ (la collision est dérivée du
    /// tileset depuis la Phase 5c) — accepté pour les vieux fichiers
    #[serde(default)]
    #[allow(dead_code)]
    pub collision: Option<Vec<Vec<u8>>>,
    pub actors: Vec<Actor>,
    #[serde(default)]
    pub script: Vec<String>,
    #[serde(default)]
    pub warps: Vec<Warp>,
    /// Nom (stem) d'un module de project.musics — absent = silence
    #[serde(default)]
    pub music: Option<String>,
    /// Nom (stem) d'un tileset de project.tilesets — absent = le premier
    #[serde(default)]
    pub tileset: Option<String>,
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
        if let Some(up) = &self.upper {
            if up.len() != self.height as usize
                || up.iter().any(|r| r.len() != self.width as usize)
            {
                bail!("scene '{}' : upper n'est pas {}x{}", self.name, self.width, self.height);
            }
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
            // « warp sur tile libre » : vérifié après dérivation de la
            // collision (binbank), la passabilité venant du tileset
        }
        Ok(())
    }

    /// Couche supérieure, ou grille vide (-1) si absente
    pub fn upper_or_empty(&self) -> Vec<Vec<i32>> {
        match &self.upper {
            Some(up) => up.clone(),
            None => vec![vec![crate::tileset::EMPTY; self.width as usize]; self.height as usize],
        }
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
