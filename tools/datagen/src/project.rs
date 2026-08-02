//! The source project model: the JSON the editor writes.
//! Reference: docs/SPEC_FORMATS.md.

use serde::Deserialize;

#[derive(Deserialize)]
pub struct Project {
    #[allow(dead_code)]
    pub name: String,
    pub boot_scene: String,
    pub scenes: Vec<String>,
    pub assets: Assets,
    /// .it modules, in music_id order (optional).
    #[serde(default)]
    pub musics: Vec<String>,
    /// WAV sounds, in sfx_id order (optional). datagen converts them to
    /// 8 kHz BRR — see the sfx module.
    #[serde(default)]
    pub sounds: Vec<String>,
    /// 16x16 tilesets, in tileset_id order (defaults to [assets.tileset]).
    #[serde(default)]
    pub tilesets: Vec<String>,
    /// Character block names, written by the editor. Cosmetic here: they
    /// let error messages say "green NPC" rather than "block 3".
    #[serde(default)]
    pub charsets: Vec<String>,
    /// Common events, RM2003 style: global scripts callable from any event
    /// ({"c":"call","n":k}) or run automatically by a switch. Compiled PER
    /// SCENE — only the bodies actually referenced land in a scene's
    /// script block.
    #[serde(default)]
    pub common_events: Vec<CommonEvent>,
    #[serde(default)]
    pub functions: Vec<FunctionDef>,
    /// UI system (docs/SPEC_SYSTEME_UI.md): the project theme.
    #[serde(default)]
    pub ui: Option<UiConfig>,
    /// Pictures, RM2003 style: PNGs of at most 16 colours shown full
    /// screen by the "show picture" command. Order gives the pic_id;
    /// commands reference them by stem.
    /// An object entry { path, trans: true } marks a TRANSPARENT image —
    /// alpha pixels are punched through at import and the scenery shows.
    #[serde(default)]
    pub pictures: Vec<PicEntry>,
    /// Vignettes: strips of 32x32 sprite frames — emotes, portraits,
    /// attack animations. Order gives the vig_id.
    #[serde(default)]
    pub vignettes: Vec<String>,
    /// Frame-by-frame animations — see docs/PLANNING_SYSTEME_ANIMATIONS.
    #[serde(default)]
    pub animations: Vec<AnimEntry>,
    /// Composed screens: names of screens/<name>.json. Visual compositions
    /// (background plus slots) and a script, UNROLLED by the {"c":"screen"}
    /// command into STAGEOPEN/STAGEPOSE plus the inline script.
    #[serde(default)]
    pub screens: Vec<String>,
    /// Mode 7 (docs/PLANNING_SYSTEME_MODE7.md). Absent in every project
    /// that does not use it, and datagen then emits NOTHING extra — which
    /// is what keeps gate-datagen.sh byte-identical while M7 lands.
    #[serde(default)]
    pub mode7: Option<Mode7Config>,
}

/// The project's Mode 7 images.
///
/// The ZOOM RAMPS are not here: they live on the commands that use them
/// (from % to % over N frames along a curve), and datagen derives the
/// distinct tables from a project-wide scan. An author who fills a form
/// should not also have to manage a resource they never asked for.
///
/// Images are named by the STEM of an ordinary picture: a Mode 7 image is
/// not a separate resource the author has to manage, it is a second form
/// datagen compiles of a picture they already have (§5.2). Listing them
/// here is the M7-A1 shape; once the commands exist datagen will add the
/// pictures they reference to the same list.
#[derive(Deserialize, Clone, Default)]
pub struct Mode7Config {
    #[serde(default)]
    pub images: Vec<String>,
}

/// A composed screen (screens/<name>.json). Editor sugar: the engine only
/// ever sees the existing stage commands.
#[derive(Deserialize, Clone)]
pub struct ScreenDef {
    #[serde(skip)]
    pub name: String,
    /// Stem of a picture used as background; absent or empty means black.
    #[serde(default)]
    pub backdrop: String,
    /// Images posed on open (slot 1-5, position in pixels).
    #[serde(default)]
    pub slots: Vec<ScreenSlot>,
    /// Legacy single script; becomes scripts[0].
    #[serde(default)]
    pub script: Vec<serde_json::Value>,
    /// NAMED scripts: the first runs on open, the others are called with
    /// {"c":"screen_call","script":"name"} and inlined.
    #[serde(default)]
    pub scripts: Vec<ScreenScript>,
}

#[derive(Deserialize, Clone)]
pub struct ScreenScript {
    #[serde(default)]
    pub name: String,
    /// "auto" runs on open, in order; "call" runs via screen_call.
    /// Absent: the first script is auto and the rest are call (legacy).
    #[serde(default)]
    pub trigger: String,
    /// Condition on an auto script (switch or variable), compiled to an
    /// `if` around the body.
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
    /// Author label — editor only, ignored here.
    #[serde(default)]
    #[allow(dead_code)]
    pub name: String,
}

/// A pictures registry entry: a bare path, or an object carrying the
/// transparency flag.
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

/// UI theme (docs/SPEC_SYSTEME_UI.md §6). One theme per project for now;
/// the database table arrives with multiple themes.
#[derive(Deserialize)]
pub struct UiConfig {
    /// 24x24 PNG (9-slice, 3x3 tiles of 8x8) on the SAME palette as the
    /// font: 0 transparent, 1 background, 2 text/border, 3 accent.
    /// Absent means the historical solid box.
    #[serde(default)]
    pub windowskin: Option<String>,
    /// Typewriter frames per character; 0 (the default) is instant.
    #[serde(default)]
    pub text_speed: u8,
    /// UI widget icon sheet: an Nx8 strip (width a multiple of 8, at most
    /// 64 icons) on the font's palette. Its BG3 chars are appended after
    /// the windowskin (UI_ICON_BASE).
    #[serde(default)]
    pub icons: Option<String>,
}

#[derive(Deserialize)]
pub struct CommonEvent {
    #[serde(default)]
    pub name: String,
    /// "none" means callable only; "auto" reruns while its switch is ON
    /// (RM2003 Autorun), and then the switch is MANDATORY.
    #[serde(default = "trigger_none")]
    pub trigger: String,
    /// Condition switch, required when trigger == "auto".
    #[serde(default)]
    pub switch: Option<u16>,
    #[serde(default)]
    pub commands: Vec<serde_json::Value>,
    /// VESTIGIAL. Functions started life as common events with
    /// parameters; they have their own list now. This field only exists
    /// to refuse an old-format project explicitly, rather than silently
    /// losing its contents.
    #[serde(default)]
    pub params: Vec<String>,
}

/// A FUNCTION: a global script that takes parameters and may return a
/// value. Kept apart from common events because it is not the same
/// thing — a common event is a block of commands you trigger, a function
/// is a computation you call. Parameter names serve the editor only; the
/// engine knows nothing but indices into the call frame.
#[derive(Deserialize)]
pub struct FunctionDef {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub params: Vec<String>,
    /// Names of the LOCAL variables. They live in the call frame right
    /// after the parameters: every call gets its own, zeroed, recursion
    /// included. That is what lets a function keep scratch state without
    /// borrowing a global — and without two nested calls trampling each
    /// other.
    #[serde(default)]
    pub locals: Vec<String>,
    /// Whether it returns a value ("ret_fn"), read by the "ret" source.
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
    /// Absent or "map" = an ordinary scene. "worldmap" = a Mode 7 plane
    /// (docs/PLANNING_SYSTEME_MODE7.md §5.4): the same tileset library
    /// and the same painting, rendered on the affine plane. Absent in
    /// every existing project, so nothing changes for them.
    #[serde(default)]
    pub kind: Option<String>,
    /// World map CAMERA ANGLE: the screen line the ground vanishes into,
    /// and the one drawn 1:1 where the hero stands. Their difference is
    /// the whole tilt — a large gap gives a gentle, almost top-down view,
    /// a small one a low raking one. Absent means the engine's default
    /// (56 / 176). Ignored on an ordinary scene.
    #[serde(default)]
    pub m7_horizon: Option<u8>,
    #[serde(default)]
    pub m7_anchor: Option<u8>,
    pub width: u8,
    pub height: u8,
    pub player_start: [u8; 2],
    /// Lower layer: logical ids (0.. = grid, 1000+k = autotile k).
    pub tilemap: Vec<Vec<i32>>,
    /// Upper layer: -1 is empty; absent means all empty.
    #[serde(default)]
    pub upper: Option<Vec<Vec<i32>>>,
    /// Pre-passability legacy: IGNORED. Collision is derived from the
    /// tileset now; the field is still accepted for old files.
    #[serde(default)]
    #[allow(dead_code)]
    pub collision: Option<Vec<Vec<u8>>>,
    #[serde(default)]
    pub actors: Vec<Actor>,
    /// Events (Event Editor), compiled to actors plus script — events.rs.
    #[serde(default)]
    pub events: Vec<Event>,
    #[serde(default)]
    pub script: Vec<String>,
    #[serde(default)]
    pub warps: Vec<Warp>,
    /// Stem of a module in project.musics; absent means silence.
    #[serde(default)]
    pub music: Option<String>,
    /// Stem of a tileset in project.tilesets; absent means the first.
    #[serde(default)]
    pub tileset: Option<String>,
    /// Effect layer: a drifting pattern carried by BG1 in place of the
    /// upper layer, which is ignored in those scenes. `pic` is the stem
    /// of a TRANSPARENT image in project.pictures; dx/dy are px per second.
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
    /// "half" (semi-transparent), "add", "sub"; absent means opaque.
    #[serde(default)]
    pub blend: Option<String>,
    /// Camera follow: "half" or "quarter". Absent means the pattern is
    /// fixed on screen — very distant — and only the drift moves it.
    #[serde(default)]
    pub parallax: Option<String>,
    /// Plane position: "front" (default) overlays the game (clouds, mist);
    /// "back" is a PANORAMA behind the map, seen through the erased tiles
    /// of the lower layer, RPG Maker style.
    #[serde(default)]
    pub mode: Option<String>,
    /// Panorama: repeat the image (default true — a looping, scrollable
    /// pattern) or not (false — one fixed image, no scrolling).
    #[serde(default)]
    pub repeat: Option<bool>,
}

#[derive(Deserialize)]
pub struct Warp {
    pub x: u8,
    pub y: u8,
    /// Target scene name.
    pub to: String,
    pub tx: u8,
    pub ty: u8,
    /// Hero facing on arrival ("down"/"up"/"left"/"right"); absent keeps
    /// the current one (WarpDef.flags, spec §1.5).
    #[serde(default)]
    pub dir: Option<String>,
    /// Transition: "fade" (default), "none" (instant), "mosaic"
    /// ($2106 mosaic) — WarpDef.trans.
    #[serde(default)]
    pub trans: Option<String>,
}

/// Engine code for a screen transition.
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
    /// "npc" talks with A; "trigger" fires when the hero steps on the
    /// tile; "auto" fires when the scene loads. RM2003 trigger model.
    #[serde(rename = "type")]
    pub kind: String,
    pub x: u8,
    pub y: u8,
    /// Character block; ignored for trigger/auto, which are invisible.
    #[serde(default)]
    pub sprite: u8,
    #[serde(default = "dir_down")]
    pub dir: String,
    /// Entry label in the scene's script; absent means no script.
    #[serde(default)]
    pub entry: Option<String>,
    /// Event pages: page 2+ of the same event, as consecutive entries.
    #[serde(default)]
    pub cont: bool,
    /// Activation condition: 0 none, 1 switch ON, 2 switch OFF,
    /// 3 variable >= value (spec §1.3).
    #[serde(default)]
    pub cond_type: u8,
    #[serde(default)]
    pub cond_idx: u16,
    #[serde(default)]
    pub cond_val: u16,
    /// 0 static, 1 random, 2 vertical, 3 horizontal, 4 custom route.
    /// 4 route custom (v0.14)
    #[serde(default)]
    pub move_type: u8,
    /// 0 below the hero, 1 same as the hero, 2 above.
    #[serde(default = "prio_same")]
    pub priority: u8,
    /// Speed 1-4 (0 means the default, 1).
    #[serde(default)]
    pub speed: u8,
    /// Label of the custom route blob in the script block.
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

/// An event (Event Editor, RM2003 model). Sugar over the SOURCE format:
/// events.rs compiles it to an actor plus VM bytecode (TOOLS.md).
#[derive(Deserialize)]
pub struct Event {
    #[serde(default)]
    pub name: String,
    pub x: u8,
    pub y: u8,
    /// "action" (A button), "touch" (contact), "auto" (scene load).
    #[serde(default = "trigger_action")]
    pub trigger: String,
    /// Character block; -1 means invisible (touch/auto).
    #[serde(default = "minus_one")]
    pub sprite: i16,
    /// TILE appearance: a grid id from the upper layer of the scene's
    /// tileset, exclusive with `sprite`. datagen composes a virtual
    /// sprite block from that tile.
    #[serde(default)]
    pub tile: Option<u16>,
    #[serde(default = "dir_down")]
    pub dir: String,
    /// Label of a hand-written script (advanced); ignored if `commands`.
    #[serde(default)]
    pub entry: Option<String>,
    /// Structured commands (Event Editor).
    #[serde(default)]
    pub commands: Vec<serde_json::Value>,
    /// Movement type: "static" (default), "random", "vertical",
    /// "horizontal", "custom" (which requires move_route).
    #[serde(default)]
    pub r#move: Option<String>,
    /// Custom route: {"freq","repeat","skip","steps":[...]}.
    #[serde(default)]
    pub move_route: Option<serde_json::Value>,
    /// "below" | "same" (default) | "above".
    #[serde(default)]
    pub priority: Option<String>,
    /// Speed 1-4; absent means 1.
    #[serde(default)]
    pub speed: Option<u8>,
    /// Conditional pages; absent means one implicit page made of the
    /// fields above. Each page has its condition, appearance, trigger and
    /// commands; the LAST page whose condition passes is active (RM2003).
    #[serde(default)]
    pub pages: Vec<EventPage>,
}

#[derive(serde::Deserialize)]
pub struct EventPage {
    /// {"switch": n, "on": bool} or {"var": n, "min": v}; absent = always.
    #[serde(default)]
    pub condition: Option<serde_json::Value>,
    #[serde(default = "trigger_action")]
    pub trigger: String,
    #[serde(default = "minus_one")]
    pub sprite: i16,
    /// Tile appearance — see Event::tile.
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
    /// Consistency checks against the spec (§1.2, §1.4, the >= 32 rule).
    /// True for a Mode 7 world map.
    pub fn is_worldmap(&self) -> bool {
        self.kind.as_deref() == Some("worldmap")
    }

    /// The world map's camera angle, validated. REFUSED here rather than
    /// clamped: the engine clamps because a script can reach it at run
    /// time, but a number written in a project file is something the
    /// author can still fix, so say so instead of silently drawing
    /// something else.
    ///
    /// The 16-line floor on the gap is where the vertical scale leaves
    /// its 8.8 register — below it the whole screen is sky.
    pub fn m7_view(&self) -> anyhow::Result<(u8, u8)> {
        use anyhow::bail;
        let horizon = self.m7_horizon.unwrap_or(56);
        let anchor = self.m7_anchor.unwrap_or(176);
        if horizon > 180 {
            bail!(
                "carte du monde '{}' : horizon {} — la ligne d'horizon doit \
                 rester entre 0 et 180 (l'ecran fait 224 lignes)",
                self.name,
                horizon
            );
        }
        if anchor > 216 {
            bail!(
                "carte du monde '{}' : ancrage {} — la ligne d'ancrage doit \
                 rester entre 0 et 216 (le heros y tient debout)",
                self.name,
                anchor
            );
        }
        if anchor < horizon + 16 {
            bail!(
                "carte du monde '{}' : ancrage {} pour un horizon {} — il faut \
                 au moins 16 lignes d'ecart, sinon la perspective sort du \
                 registre et tout l'ecran devient ciel",
                self.name,
                anchor,
                horizon
            );
        }
        Ok((horizon, anchor))
    }

    pub fn validate(&self) -> anyhow::Result<()> {
        use anyhow::bail;
        if let Some(k) = &self.kind {
            if k != "map" && k != "worldmap" {
                bail!("scene '{}' : kind '{}' inconnu (map, worldmap)", self.name, k);
            }
        }
        if self.is_worldmap() {
            // The plane is 128x128 tiles of 8x8, so 64x64 metatiles. Not
            // a choice: past that the map has nowhere to go.
            if self.width > 64 || self.height > 64 {
                bail!(
                    "carte du monde '{}' : {}x{} — maximum 64x64 blocs (le plan \
                     Mode 7 fait 128x128 tuiles de 8x8)",
                    self.name,
                    self.width,
                    self.height
                );
            }
            // One plane, so no upper layer and no effect layer: both would
            // need a second BG that Mode 7 does not have.
            // The editor ALWAYS writes an upper layer, filled with EMPTY.
            // So the question is not "is there an array" but "is anything
            // painted on it" — the first version asked the former and
            // refused every world map the editor could produce.
            let painted = self.upper.as_ref().map_or(false, |u| {
                u.iter().any(|row| row.iter().any(|&t| t != crate::tileset::EMPTY))
            });
            if painted {
                bail!(
                    "carte du monde '{}' : la couche superieure porte des tuiles, \
                     et le Mode 7 n'a qu'un seul plan — les effacer (ou repasser \
                     la scene en type classique)",
                    self.name
                );
            }
            if self.effect.is_some() {
                bail!(
                    "carte du monde '{}' : la couche d'effet demande un second \
                     plan, que le Mode 7 n'a pas",
                    self.name
                );
            }
        }
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
                    // a trigger with no script does nothing
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
            // "warp on a walkable tile" is checked after collision is
            // derived (binbank): passability comes from the tileset
        }
        Ok(())
    }

    /// Upper layer, or an empty (-1) grid when absent.
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

/// One POSED cell: the layer shows `cell` of the sheet at offset (x, y).
/// `cell = -1` means this layer shows NOTHING on that frame — the same
/// convention as `event: -1` elsewhere in the format.
#[derive(Deserialize)]
pub struct AnimCell {
    /// Cell index within the vignette used as sheet; -1 means nothing.
    pub cell: i16,
    /// Signed pixel offset from the anchor point.
    #[serde(default)]
    pub x: i16,
    #[serde(default)]
    pub y: i16,
}

/// One animation frame: the cells shown SIMULTANEOUSLY (one per layer),
/// how long, and an optional sound played when the frame is entered.
#[derive(Deserialize)]
pub struct AnimFrame {
    /// One entry per LAYER.
    #[serde(default)]
    pub cells: Vec<AnimCell>,
    /// LEGACY single-layer form, from projects predating layers. Read
    /// when `cells` is absent, never written back by the editor.
    #[serde(default)]
    pub cell: Option<i16>,
    #[serde(default)]
    pub x: i16,
    #[serde(default)]
    pub y: i16,
    /// Duration in screen frames (1-255).
    #[serde(default = "anim_dur_default")]
    pub dur: u8,
    /// Sound played ON ENTERING this frame (project name).
    #[serde(default)]
    pub sfx: Option<String>,
}

fn anim_dur_default() -> u8 {
    4
}

impl AnimFrame {
    /// The frame's posed cells, legacy form included.
    pub fn posed(&self) -> Vec<(i16, i16, i16)> {
        if !self.cells.is_empty() {
            return self.cells.iter().map(|c| (c.cell, c.x, c.y)).collect();
        }
        vec![(self.cell.unwrap_or(0), self.x, self.y)]
    }
}

/// A frame-by-frame animation. The cell sheet is a project VIGNETTE: the
/// graphics pipeline (32x32 OBJ chars, palette, VBlank transfer) is
/// already written and tested, so an animation only adds the frame track.
#[derive(Deserialize)]
pub struct AnimEntry {
    pub name: String,
    /// Stem of the vignette used as cell sheet.
    pub vignette: String,
    #[serde(default)]
    pub r#loop: bool,
    /// Cells shown SIMULTANEOUSLY (1-4). A layer costs a vignette slot but
    /// NO extra palette: they all come from the same sheet. See
    /// engine/src/vignette.h.
    #[serde(default = "anim_layers_default")]
    pub layers: u8,
    pub frames: Vec<AnimFrame>,
}

fn anim_layers_default() -> u8 {
    1
}
