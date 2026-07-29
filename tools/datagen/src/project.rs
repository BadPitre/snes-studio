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
    /// Common events (v0.16, modèle RM2003) : scripts globaux appelables
    /// depuis n'importe quel event ({"c":"call","n":k}) ou déclenchés en
    /// auto par un switch. Compilés PAR SCÈNE (seuls les corps référencés
    /// sont émis dans le bloc scripts de la scène).
    #[serde(default)]
    pub common_events: Vec<CommonEvent>,
    /// Système UI (Phase 11, docs/SPEC_SYSTEME_UI.md) : thème v1
    #[serde(default)]
    pub ui: Option<UiConfig>,
    /// Pictures (S3, façon RM2003) : PNG ≤ 16 couleurs affichés plein
    /// écran par la commande d'event « Afficher une image » — l'ordre
    /// donne les pic_id, les commandes les référencent par stem.
    /// Entrée objet (S4) : { path, trans: true } = image à TRANSPARENCE
    /// (pixels alpha percés à l'import — le décor se voit à travers)
    #[serde(default)]
    pub pictures: Vec<PicEntry>,
}

/// Entrée du registre pictures : chemin nu, ou objet avec le drapeau de
/// transparence (S4)
#[derive(Deserialize)]
#[serde(untagged)]
pub enum PicEntry {
    Path(String),
    Obj {
        path: String,
        #[serde(default)]
        trans: bool,
    },
}

impl PicEntry {
    pub fn path(&self) -> &str {
        match self {
            PicEntry::Path(p) => p,
            PicEntry::Obj { path, .. } => path,
        }
    }
    pub fn trans(&self) -> bool {
        matches!(self, PicEntry::Obj { trans: true, .. })
    }
}

/// Thème UI v1 (docs/SPEC_SYSTEME_UI.md §6 — la table database arrive
/// avec les thèmes multiples ; v1 = un thème projet)
#[derive(Deserialize)]
pub struct UiConfig {
    /// PNG 24x24 (9-slice : 3x3 tiles 8x8) — MÊME palette que la fonte
    /// (0 transparent, 1 fond, 2 texte/bord, 3 accent). Absent = boîte
    /// pleine historique.
    #[serde(default)]
    pub windowskin: Option<String>,
    /// frames par caractère du typewriter (0 = instantané, défaut)
    #[serde(default)]
    pub text_speed: u8,
    /// Planche d'icônes UI des widgets (W1, PLANNING_SYSTEME_MENUS.md) :
    /// PNG bande Nx8 (largeur multiple de 8, max 64 icônes), palette de
    /// la fonte — chars BG3 appendus après le windowskin (UI_ICON_BASE).
    #[serde(default)]
    pub icons: Option<String>,
}

#[derive(Deserialize)]
pub struct CommonEvent {
    #[serde(default)]
    pub name: String,
    /// "none" (appelable seulement) ou "auto" (relancé tant que son
    /// switch est ON — RM2003 Autorun ; switch OBLIGATOIRE)
    #[serde(default = "trigger_none")]
    pub trigger: String,
    /// Switch de condition (requis si trigger == "auto")
    #[serde(default)]
    pub switch: Option<u16>,
    #[serde(default)]
    pub commands: Vec<serde_json::Value>,
}

fn trigger_none() -> String {
    "none".into()
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
    /// Couche d'effet (S9) : motif dérivant porté par BG1 à la place de
    /// la couche sup (ignorée dans ces scènes). pic = stem d'une image à
    /// TRANSPARENCE de project.pictures, dx/dy en px par seconde.
    #[serde(default)]
    pub effect: Option<Effect>,
}

#[derive(Deserialize)]
pub struct Effect {
    pub pic: String,
    #[serde(default)]
    pub dx: f64,
    #[serde(default)]
    pub dy: f64,
    /// "half" (semi-transparent), "add", "sub" — absent = opaque
    #[serde(default)]
    pub blend: Option<String>,
    /// Suivi caméra (S11) : "half" (½) ou "quarter" (¼) — absent = le
    /// motif est fixe à l'écran (très lointain), seule la dérive bouge
    #[serde(default)]
    pub parallax: Option<String>,
}

#[derive(Deserialize)]
pub struct Warp {
    pub x: u8,
    pub y: u8,
    /// Nom de la scène cible
    pub to: String,
    pub tx: u8,
    pub ty: u8,
    /// v0.16 — direction du héros à l'arrivée ("down"/"up"/"left"/
    /// "right"), absente = conserver (WarpDef.flags, spec §1.5)
    #[serde(default)]
    pub dir: Option<String>,
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
    /// v0.11 — 0 statique, 1 aléatoire, 2 vertical, 3 horizontal,
    /// 4 route custom (v0.14)
    #[serde(default)]
    pub move_type: u8,
    /// v0.14 — 0 sous le héros, 1 comme le héros, 2 au-dessus
    #[serde(default = "prio_same")]
    pub priority: u8,
    /// v0.14 — vitesse 1-4 (0 = défaut 1)
    #[serde(default)]
    pub speed: u8,
    /// v0.14 — label du blob de route custom dans le bloc scripts
    #[serde(default)]
    pub route_label: Option<String>,
}

fn prio_same() -> u8 {
    1
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
    /// v0.11 — type de mouvement : "static" (défaut), "random",
    /// "vertical", "horizontal", "custom" (v0.14 : move_route requis)
    #[serde(default)]
    pub r#move: Option<String>,
    /// v0.14 — route custom : {"freq","repeat","skip","steps":[...]}
    #[serde(default)]
    pub move_route: Option<serde_json::Value>,
    /// v0.14 — "below" | "same" (défaut) | "above"
    #[serde(default)]
    pub priority: Option<String>,
    /// v0.14 — vitesse 1-4 (absent = 1)
    #[serde(default)]
    pub speed: Option<u8>,
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
    #[serde(default)]
    pub r#move: Option<String>,
    #[serde(default)]
    pub move_route: Option<serde_json::Value>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub speed: Option<u8>,
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
