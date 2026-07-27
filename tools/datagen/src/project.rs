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
    /// Noms des blocs de personnage (écrits par l'éditeur) — purement
    /// cosmétique côté datagen : sert à nommer les charsets dans les
    /// messages d'erreur (« PNJ vert » plutôt que « bloc 3 »)
    #[serde(default)]
    pub charsets: Vec<String>,
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
    #[serde(default)]
    pub actors: Vec<Actor>,
    /// Événements (Event Editor) — compilés vers actors + script (events.rs)
    #[serde(default)]
    pub events: Vec<Event>,
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
    /// "npc" (parle avec A), "trigger" (contact : le script part quand le
    /// héros marche sur la tile), "auto" (le script part au chargement de
    /// la scène) — modèle des déclencheurs RM2003 (v0.6)
    #[serde(rename = "type")]
    pub kind: String,
    pub x: u8,
    pub y: u8,
    /// Bloc de personnage — ignoré pour trigger/auto (invisibles)
    #[serde(default)]
    pub sprite: u8,
    #[serde(default = "dir_down")]
    pub dir: String,
    /// Label d'entrée dans le script de la scène (absent = pas de script)
    #[serde(default)]
    pub entry: Option<String>,
    /// v0.10 — pages d'events : page 2+ du même event (entrées consécutives)
    #[serde(default)]
    pub cont: bool,
    /// v0.10 — condition d'activation : 0 aucune, 1 switch ON, 2 switch OFF,
    /// 3 variable >= valeur (spec §1.3)
    #[serde(default)]
    pub cond_type: u8,
    #[serde(default)]
    pub cond_idx: u16,
    #[serde(default)]
    pub cond_val: u16,
}

fn dir_down() -> String {
    "down".into()
}

#[derive(Deserialize)]
pub struct TextEntry {
    pub name: String,
    pub text: String,
}

/// Événement (Event Editor, modèle RM2003) — sucre du format SOURCE :
/// compilé par events.rs vers un acteur + du bytecode VM (TOOLS.md).
#[derive(Deserialize)]
pub struct Event {
    #[serde(default)]
    pub name: String,
    pub x: u8,
    pub y: u8,
    /// "action" (touche A), "touch" (contact), "auto" (chargement)
    #[serde(default = "trigger_action")]
    pub trigger: String,
    /// Bloc de personnage ; -1 = invisible (touch/auto)
    #[serde(default = "minus_one")]
    pub sprite: i16,
    #[serde(default = "dir_down")]
    pub dir: String,
    /// Label d'un script écrit à la main (avancé) — ignoré si commands
    #[serde(default)]
    pub entry: Option<String>,
    /// Commandes structurées (Event Editor)
    #[serde(default)]
    pub commands: Vec<serde_json::Value>,
    /// v0.10 — pages conditionnelles (absent = 1 page implicite formée des
    /// champs ci-dessus). Chaque page a sa condition, son apparence, son
    /// déclencheur et ses commandes ; la DERNIÈRE page dont la condition
    /// passe est active (modèle RM2003).
    #[serde(default)]
    pub pages: Vec<EventPage>,
}

#[derive(serde::Deserialize)]
pub struct EventPage {
    /// {"switch": n, "on": bool} ou {"var": n, "min": v} — absent = toujours
    #[serde(default)]
    pub condition: Option<serde_json::Value>,
    #[serde(default = "trigger_action")]
    pub trigger: String,
    #[serde(default = "minus_one")]
    pub sprite: i16,
    #[serde(default = "dir_down")]
    pub dir: String,
    #[serde(default)]
    pub entry: Option<String>,
    #[serde(default)]
    pub commands: Vec<serde_json::Value>,
}

fn trigger_action() -> String {
    "action".into()
}

fn minus_one() -> i16 {
    -1
}

impl Scene {
    /// Vérifications de cohérence avec la spec (§1.2, §1.4, contrainte >= 32)
    pub fn validate(&self) -> anyhow::Result<()> {
        use anyhow::bail;
        if self.width < 20 || self.height < 15 {
            bail!(
                "scene '{}' : map {}x{} — minimum 20x15 (un ecran, comme RM2003)",
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
            match a.kind.as_str() {
                "npc" => {}
                "trigger" | "auto" => {
                    // sans script, un déclencheur ne sert à rien
                    if a.entry.is_none() {
                        bail!(
                            "scene '{}' : acteur '{}' en ({},{}) sans entry (script requis)",
                            self.name, a.kind, a.x, a.y
                        );
                    }
                }
                other => bail!(
                    "scene '{}' : actor_type '{}' inconnu (npc, trigger, auto)",
                    self.name, other
                ),
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
