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
    /// Sons WAV (B1), dans l'ordre des sfx_id (optionnel) — convertis
    /// en BRR 8 kHz par datagen (module sfx)
    #[serde(default)]
    pub sounds: Vec<String>,
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
    #[serde(default)]
    pub functions: Vec<FunctionDef>,
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
    /// Vignettes (B5) : bandes de frames 32x32 en sprites — émoticônes,
    /// portraits, animations d'attaque. L'ordre donne les vig_id.
    #[serde(default)]
    pub vignettes: Vec<String>,
    /// Animations image par image (A1) — voir docs/PLANNING_SYSTEME_ANIMATIONS
    #[serde(default)]
    pub animations: Vec<AnimEntry>,
    /// Écrans composés (B6bis) : noms des fichiers screens/<nom>.json —
    /// compositions visuelles (fond + slots) + script, DÉROULÉES par la
    /// commande {"c":"screen"} en STAGEOPEN/STAGEPOSE + script inline.
    #[serde(default)]
    pub screens: Vec<String>,
}

/// Écran composé (B6bis, screens/<nom>.json) — sucre d'éditeur : le
/// moteur ne voit que les commandes stage existantes.
#[derive(Deserialize, Clone)]
pub struct ScreenDef {
    #[serde(skip)]
    pub name: String,
    /// stem d'une picture (fond) — absent/vide = fond noir
    #[serde(default)]
    pub backdrop: String,
    /// images posées à l'ouverture (slot 1-5, position en pixels)
    #[serde(default)]
    pub slots: Vec<ScreenSlot>,
    /// héritage : ancien script unique (devient scripts[0])
    #[serde(default)]
    pub script: Vec<serde_json::Value>,
    /// scripts NOMMÉS : le premier est joué à l'ouverture, les autres
    /// s'appellent via {"c":"screen_call","script":"nom"} (inline)
    #[serde(default)]
    pub scripts: Vec<ScreenScript>,
}

#[derive(Deserialize, Clone)]
pub struct ScreenScript {
    #[serde(default)]
    pub name: String,
    /// "auto" = à l'ouverture (dans l'ordre), "call" = par screen_call.
    /// Absent : le premier script est auto, les autres call (héritage).
    #[serde(default)]
    pub trigger: String,
    /// condition d'un script auto (switch ou variable) — compilée en
    /// if autour du corps
    #[serde(default)]
    pub cond: Option<ScreenCond>,
    #[serde(default)]
    pub commands: Vec<serde_json::Value>,
}

#[derive(Deserialize, Clone)]
pub struct ScreenCond {
    pub kind: String, // "switch" | "var"
    pub n: u16,
    #[serde(default)]
    pub on: Option<bool>,
    #[serde(default)]
    pub op: Option<String>,
    #[serde(default)]
    pub value: Option<i64>,
}

#[derive(Deserialize, Clone)]
pub struct ScreenSlot {
    pub slot: u8,
    pub pic: String,
    #[serde(default)]
    pub x: u16,
    #[serde(default)]
    pub y: u16,
    /// libellé d'auteur — purement éditeur, ignoré ici
    #[serde(default)]
    #[allow(dead_code)]
    pub name: String,
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
    /// F1-c — VESTIGE. Les fonctions ont d'abord été des common events à
    /// paramètres ; elles ont maintenant leur propre liste. Ce champ ne
    /// sert plus qu'à refuser explicitement un projet resté au format
    /// d'avant, plutôt que de perdre son contenu en silence.
    #[serde(default)]
    pub params: Vec<String>,
}

/// F1 — une FONCTION : un script global qui prend des paramètres et peut
/// rendre une valeur. Séparée des common events parce que ce n'est pas
/// la même chose : un common event est un bloc de commandes qu'on
/// déclenche, une fonction est un calcul qu'on appelle. Les noms de
/// paramètres ne servent qu'à l'éditeur ; le moteur ne connaît que des
/// index dans le cadre d'appel.
#[derive(Deserialize)]
pub struct FunctionDef {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub params: Vec<String>,
    /// rend une valeur (commande « ret_fn »), lue par la source « ret »
    #[serde(default)]
    pub returns: bool,
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
    /// Position du plan (S17) : "front" (défaut) = surimpression au-dessus
    /// du jeu (nuages, brume) ; "back" = PANORAMA derrière la carte, vu
    /// par les tuiles gommées de la couche basse (façon RPG Maker).
    #[serde(default)]
    pub mode: Option<String>,
    /// Panorama : répéter l'image (défaut true = motif qui boucle et peut
    /// défiler) ou non (false = image fixe unique, sans défilement).
    #[serde(default)]
    pub repeat: Option<bool>,
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
    /// S18 — transition : "fade" (défaut), "none" (instantané),
    /// "mosaic" (mosaïque $2106) — WarpDef.trans
    #[serde(default)]
    pub trans: Option<String>,
}

/// Code moteur d'une transition d'écran (S18/S18b)
pub fn trans_code(trans: &Option<String>) -> anyhow::Result<u8> {
    Ok(match trans.as_deref() {
        None | Some("") | Some("fade") => 0,
        Some("none") => 1,
        Some("mosaic") => 2,
        Some("wipe_down") => 3,
        Some("wipe_up") => 4,
        Some("wipe_center") => 5,
        Some(o) => anyhow::bail!(
            "transition inconnue : '{}' (fade, none, mosaic, wipe_down, wipe_up, wipe_center)",
            o
        ),
    })
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
    /// T4 — apparence TILE : id de grille de la couche haute du tileset
    /// de la scène (exclusif avec sprite ; datagen compose un bloc de
    /// sprite virtuel depuis la tile)
    #[serde(default)]
    pub tile: Option<u16>,
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
    /// T4 — apparence tile (voir Event::tile)
    #[serde(default)]
    pub tile: Option<u16>,
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

/// Une cellule POSÉE (A1-e) : le calque affiche `cell` de la planche au
/// décalage (x, y). `cell = -1` = ce calque n'affiche RIEN sur cette
/// frame — même convention que `event: -1` ailleurs dans le format.
#[derive(Deserialize)]
pub struct AnimCell {
    /// index de cellule DANS la vignette servant de planche, -1 = rien
    pub cell: i16,
    /// décalage signé en pixels par rapport au point d'ancrage
    #[serde(default)]
    pub x: i16,
    #[serde(default)]
    pub y: i16,
}

/// Une frame d'animation (A1) : les cellules affichées SIMULTANÉMENT
/// (une par calque), combien de temps, et un son optionnel joué à
/// l'entrée de la frame.
#[derive(Deserialize)]
pub struct AnimFrame {
    /// une entrée par CALQUE (A1-e)
    #[serde(default)]
    pub cells: Vec<AnimCell>,
    /// forme HÉRITÉE mono-calque (projets d'avant les calques) — lue
    /// quand `cells` est absent, jamais réécrite par l'éditeur
    #[serde(default)]
    pub cell: Option<i16>,
    #[serde(default)]
    pub x: i16,
    #[serde(default)]
    pub y: i16,
    /// durée en frames écran (1-255)
    #[serde(default = "anim_dur_default")]
    pub dur: u8,
    /// son joué À L'ENTRÉE de cette frame (nom du projet)
    #[serde(default)]
    pub sfx: Option<String>,
}

fn anim_dur_default() -> u8 {
    4
}

impl AnimFrame {
    /// Cellules posées de la frame, forme héritée comprise.
    pub fn posed(&self) -> Vec<(i16, i16, i16)> {
        if !self.cells.is_empty() {
            return self.cells.iter().map(|c| (c.cell, c.x, c.y)).collect();
        }
        vec![(self.cell.unwrap_or(0), self.x, self.y)]
    }
}

/// Animation image par image (A1). La planche de cellules est une
/// VIGNETTE du projet : le pipeline graphique (chars OBJ 32x32, palette,
/// transfert au VBlank) est déjà écrit et testé, l'animation n'ajoute
/// que la piste de frames.
#[derive(Deserialize)]
pub struct AnimEntry {
    pub name: String,
    /// nom (stem) de la vignette servant de planche de cellules
    pub vignette: String,
    #[serde(default)]
    pub r#loop: bool,
    /// Cellules affichées SIMULTANÉMENT (1-4). Un calque coûte un slot
    /// de vignette mais AUCUNE palette de plus : tous viennent de la
    /// même planche (voir engine/src/vignette.h).
    #[serde(default = "anim_layers_default")]
    pub layers: u8,
    pub frames: Vec<AnimFrame>,
}

fn anim_layers_default() -> u8 {
    1
}
