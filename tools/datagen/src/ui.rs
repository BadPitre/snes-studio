//! "uigen" — see docs/SPEC_SYSTEME_UI.md and
//! docs/PLANNING_SYSTEME_MENUS.md.
//!
//! Reads `<project>/ui/layout.toml`, all positions and sizes IN TILES:
//!   [message] / [choice]  pos, size — the dialogue windows
//!
//!   [[node]] — the designer's widget TREE (UMG model):
//!     type = "window"   9-slice frame, explicit size, margin=[1,1];
//!                       its children stack vertically inside
//!     type = "vbox"     stacks children top to bottom (gap)
//!     type = "hbox"     lays children left to right (gap)
//!     type = "label"    static text (text)
//!     type = "value"    a variable's value (var, width 1-5, right
//!                       aligned by default)
//!     type = "image"    a run of icons from the sheet (icon, w), or a
//!                       project picture (pic = "name"), in which case
//!                       the widget's size comes from the image, mapped
//!                       to the UI layer's 4 colours at compile time
//!     type = "gauge" / "icon_row" / "icon_value" / "variable_display"
//!                       the HUD widgets, same props, explicit size
//!     type = "list"     cursor menu: items = ["Attack", ...], frame
//!                       defaults to true, size is AUTO (one cursor
//!                       column plus the longest item) — driven by the
//!                       "choose from a list" event command.
//!                       rows = n shows only n rows: the list SCROLLS
//!                       (one extra column for the ^ / v indicators);
//!                       cursor_icon = n replaces the '>' cursor with
//!                       an icon from the ui.icons sheet
//!     parent = "id"     attaches to a container; no parent means a ROOT,
//!                       which then requires pos = [x, y]
//!
//!   [[overlay]] — the older flat format is still accepted: each entry
//!   becomes a leaf root, migrated transparently.
//!
//! The tree is FLATTENED at compile time into primitives positioned in
//! tiles. The engine knows nothing of vbox or hbox — zero runtime cost:
//!   0 variable_display  1 gauge  2 icon_row  3 icon_value
//!   4 panel (frame only)  5 label (static text)  6 image (icons)
//!   7 list (cursor menu; items in `text`, separated by \n)
//!   8 image (picture: a rectangle of chars, base char in `icon`)
//! Types 4-6 are STATIC: never redrawn when a variable changes, only on
//! a refresh.
//!
//! Compile-time validation (§9.3): unique ids, existing parents, bounded
//! depth, non-empty containers, everything on screen, at most 32
//! primitives, roots overlapping neither each other nor message/choice,
//! icons within the sheet, ASCII text.

use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::fmt::Write as _;
use std::path::Path;

/// SNES screen in tiles: 32 x 28 (256 x 224).
const SCREEN_W: i64 = 32;
const SCREEN_H: i64 = 28;
/// Flattened primitives, the engine's tables. A Chrono Trigger panel uses
/// about a dozen; 32 leaves room without inflating WRAM.
const PRIM_MAX: usize = 32;
const DEPTH_MAX: usize = 6;

#[derive(Deserialize, Default)]
pub struct Layout {
    #[serde(default)]
    pub message: Option<Win>,
    #[serde(default)]
    pub choice: Option<Win>,
    /// Older flat format, accepted and converted to leaf roots.
    #[serde(default)]
    pub overlay: Vec<Overlay>,
    /// The designer's tree.
    #[serde(default)]
    pub node: Vec<Node>,
    /// Extra dialogue styles; style 0 is the default.
    #[serde(default)]
    pub dialog_style: Vec<DialogStyle>,
}

#[derive(Deserialize, Clone)]
pub struct Win {
    pub pos: [i64; 2],
    pub size: [i64; 2],
}

/// A dialogue box style. Each msg/choice may pick one; style 0 is the
/// theme plus [message]/[choice].
#[derive(Deserialize, Clone)]
pub struct DialogStyle {
    pub id: String,
    /// Windowskin OWNED by the style (default: the theme's).
    #[serde(default)]
    pub windowskin: Option<String>,
    /// Its own font (768x8 PNG, default assets.font). For now every font
    /// shares the PALETTE of the project font.
    #[serde(default)]
    pub font: Option<String>,
    #[serde(default)]
    pub message: Option<Win>,
    #[serde(default)]
    pub choice: Option<Win>,
}

/// The old flat overlay — see the module docs.
#[derive(Deserialize)]
pub struct Overlay {
    #[serde(default)]
    pub id: String,
    pub pos: [i64; 2],
    pub size: [i64; 2],
    pub content: String,
    #[serde(default)]
    pub var: Option<u8>,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub frame: Option<bool>,
    #[serde(default)]
    pub max: Option<u16>,
    #[serde(default)]
    pub max_var: Option<u8>,
    #[serde(default)]
    pub icon: Option<u8>,
    #[serde(default)]
    pub dir: Option<String>,
    #[serde(default)]
    pub pad: Option<u8>,
}

/// A node of the designer's tree.
#[derive(Deserialize, Clone)]
pub struct Node {
    pub id: String,
    #[serde(default)]
    pub parent: Option<String>,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub pos: Option<[i64; 2]>, // racines seulement
    #[serde(default)]
    pub size: Option<[i64; 2]>, // window/gauge/icon_row/variable_display
    #[serde(default)]
    pub margin: Option<[i64; 2]>, // window (défaut [1,1])
    #[serde(default)]
    pub gap: Option<i64>, // vbox/hbox (défaut 0)
    #[serde(default)]
    pub text: Option<String>, // label
    #[serde(default)]
    pub width: Option<i64>, // value (chiffres 1-5) / image (icônes) / icon_value
    #[serde(default)]
    pub var: Option<u8>,
    #[serde(default)]
    pub label: Option<String>, // variable_display
    #[serde(default)]
    pub frame: Option<bool>,
    #[serde(default)]
    pub max: Option<u16>,
    #[serde(default)]
    pub max_var: Option<u8>,
    #[serde(default)]
    pub icon: Option<u8>,
    /// Image in picture mode: the name of a project picture. The UI layer
    /// only has 4 colours, so the image is mapped to the font's palette at
    /// compile time (gfx::to_ui_image).
    #[serde(default)]
    pub pic: Option<String>,
    #[serde(default)]
    pub dir: Option<String>,
    #[serde(default)]
    pub pad: Option<u8>, // icon_value : zéros de tête
    /// value: "left" pins the value left; the default is right.
    #[serde(default)]
    pub align: Option<String>,
    /// Roots: visible at startup. Defaults to FALSE — widgets are shown
    /// by the "show a UI widget" event command.
    #[serde(default)]
    pub visible: Option<bool>,
    /// Roots: the WIDGET's font (768x8 PNG, default assets.font). All the
    /// widget's text — labels, values, counters — uses it.
    #[serde(default)]
    pub font: Option<String>,
    /// list: the menu items, one per row.
    #[serde(default)]
    pub items: Option<Vec<String>>,
    /// list: visible rows — fewer than the item count makes the list
    /// scroll (an extra column carries the ^ / v indicators).
    #[serde(default)]
    pub rows: Option<i64>,
    /// list: icon from the ui.icons sheet drawn as the cursor instead
    /// of the '>' glyph.
    #[serde(default)]
    pub cursor_icon: Option<u8>,
}

/// A flattened primitive: what the engine actually draws.
pub struct Prim {
    pub x: i64,
    pub y: i64,
    pub w: i64,
    pub h: i64,
    pub kind: i64, // 0-7
    pub frame: bool,
    pub var: u8,
    pub icon: u8,
    pub vertical: bool,
    pub pad: u8,
    pub max: u16,
    pub max_var: Option<u8>,
    pub bg: bool, // dans une window : cellules vides = fond du cadre
    pub widget: usize, // index de la RACINE (visibilité par widget)
    pub text: String, // label des types 0 et 5
    pub font: Option<String>, // fonte de la racine (S2) — None = fonte 0
}

fn ascii_ok(s: &str) -> bool {
    s.chars().all(|c| (' '..='~').contains(&c))
}

fn overlaps(a: (i64, i64, i64, i64), b: (i64, i64, i64, i64)) -> bool {
    !(a.0 + a.2 <= b.0 || b.0 + b.2 <= a.0 || a.1 + a.3 <= b.1 || b.1 + b.3 <= a.1)
}

impl Node {
    fn framed(&self) -> bool {
        self.frame.unwrap_or(self.kind == "variable_display")
    }
    fn vertical(&self) -> bool {
        self.dir.as_deref() == Some("v")
    }
}

/// Converts a flat [[overlay]] into the equivalent root node.
fn overlay_to_node(ov: &Overlay, i: usize) -> Node {
    Node {
        id: if ov.id.is_empty() { format!("overlay{}", i + 1) } else { ov.id.clone() },
        parent: None,
        kind: ov.content.clone(),
        pos: Some(ov.pos),
        size: Some(ov.size),
        margin: None,
        gap: None,
        text: None,
        width: None,
        var: ov.var,
        label: Some(ov.label.clone()),
        frame: ov.frame,
        max: ov.max,
        max_var: ov.max_var,
        pic: None, /* l'ancien format plat n'a pas d'image de widget */
        icon: ov.icon,
        dir: ov.dir.clone(),
        pad: ov.pad,
        align: None,
        visible: Some(true), // compat W1 : les overlays plats restent visibles
        font: None,
        items: None,
        rows: None,
        cursor_icon: None,
    }
}

/// The flattener: tree to primitives. `icon_count` bounds the icons.
struct Flattener<'a> {
    children: Vec<Vec<usize>>,
    nodes: &'a [Node],
    icon_count: usize,
    widget: usize, // index de la racine en cours de placement
    font: Option<String>, // fonte de la racine en cours (S2)
    prims: Vec<Prim>,
    /// Converted UI images (the "Image" widget in picture mode), in order
    /// of first use: (name, 2bpp chars, width, height in tiles). The final
    /// base CHAR is not known here — it depends on the full VRAM plan
    /// (fonts, frames, icons) computed in main.rs, which patches the
    /// primitives afterwards.
    pics: Vec<(String, Vec<u8>, u8, u8)>,
    /// Variant of each `pics` entry: true means "panel background", with
    /// transparent pixels replaced by the frame's background.
    pic_bg: Vec<bool>,
    /// Sizes in tiles, known from the pre-pass — they do not depend on
    /// the variant.
    pic_size: HashMap<String, (u8, u8)>,
    pic_dir: &'a Path,
    pic_paths: &'a HashMap<String, String>,
    ui_pal: &'a [u16],
}

impl<'a> Flattener<'a> {
    /// Loads and converts a picture-mode "image" node, once per picture.
    /// Returns (index into pics, w, h in tiles).
    fn need_pic(&mut self, n: &Node, name: &str, bg: bool) -> Result<(u8, i64, i64)> {
        if let Some(k) = self
            .pics
            .iter()
            .zip(self.pic_bg.iter())
            .position(|((p, _, _, _), b)| p == name && *b == bg)
        {
            let (_, _, w, h) = &self.pics[k];
            return Ok((k as u8, *w as i64, *h as i64));
        }
        let path = self.pic_paths.get(name).with_context(|| {
            format!(
                "nœud « {} » : image « {} » introuvable dans les pictures du projet",
                n.id, name
            )
        })?;
        let img = crate::gfx::load_indexed_png(&self.pic_dir.join(path))
            .with_context(|| format!("nœud « {} » : image « {} »", n.id, name))?;
        // Inside a window, an image's TRANSPARENT pixels must show the
        // frame and not the game. SNES compositing is per tile, so this is
        // resolved at compile time by replacing transparency with the
        // panel background — the same recipe as the icon variants
        // (gfx::to_icons_bg).
        let (chars, w, h) = img
            .to_ui_image_bg(self.ui_pal, bg)
            .with_context(|| format!("nœud « {} » : image « {} »", n.id, name))?;
        if self.pics.len() >= 255 {
            bail!("ui : trop d'images de widgets");
        }
        self.pic_size.insert(name.to_string(), (w, h));
        self.pics.push((name.to_string(), chars, w, h));
        self.pic_bg.push(bg);
        Ok(((self.pics.len() - 1) as u8, w as i64, h as i64))
    }
}

impl<'a> Flattener<'a> {
    /// A node's intrinsic size, recursive for containers.
    fn size_of(&self, i: usize, depth: usize) -> Result<[i64; 2]> {
        let n = &self.nodes[i];
        if depth > DEPTH_MAX {
            bail!("ui : arbre trop profond autour de « {} » (max {})", n.id, DEPTH_MAX);
        }
        let kids = &self.children[i];
        Ok(match n.kind.as_str() {
            "window" | "gauge" | "icon_row" | "variable_display" => {
                let s = n.size.with_context(|| {
                    format!("nœud « {} » ({}) : size = [w, h] requis", n.id, n.kind)
                })?;
                s
            }
            "vbox" => {
                if kids.is_empty() {
                    bail!("ui : conteneur « {} » vide", n.id);
                }
                let gap = n.gap.unwrap_or(0);
                let mut w = 1;
                let mut h = 0;
                for (k, &c) in kids.iter().enumerate() {
                    let s = self.size_of(c, depth + 1)?;
                    w = w.max(s[0]);
                    h += s[1] + if k > 0 { gap } else { 0 };
                }
                [w, h]
            }
            "hbox" => {
                if kids.is_empty() {
                    bail!("ui : conteneur « {} » vide", n.id);
                }
                let gap = n.gap.unwrap_or(0);
                let mut w = 0;
                let mut h = 1;
                for (k, &c) in kids.iter().enumerate() {
                    let s = self.size_of(c, depth + 1)?;
                    h = h.max(s[1]);
                    w += s[0] + if k > 0 { gap } else { 0 };
                }
                [w, h]
            }
            "label" => {
                let t = n.text.clone().unwrap_or_default();
                [(t.chars().count() as i64).max(1), 1]
            }
            "value" => [n.width.unwrap_or(3).clamp(1, 5), 1],
            "image" => match &n.pic {
                // picture mode: the size comes from the image itself
                Some(p) => match self.pic_size.get(p) {
                    Some((w, h)) => [*w as i64, *h as i64],
                    None => [1, 1], /* pré-passe pas encore passée */
                },
                None => [n.width.unwrap_or(1).max(1), 1],
            },
            "icon_value" => [n.width.unwrap_or(4).max(2), 1],
            "list" => {
                // AUTO size: one cursor column plus the longest item, one
                // row per item, +2 in each direction when framed. `rows`
                // below the item count = a SCROLLING list, one extra
                // column for the ^ / v indicators.
                let items = n.items.clone().unwrap_or_default();
                let f = if n.frame.unwrap_or(true) { 2 } else { 0 };
                let wmax = items.iter().map(|t| t.chars().count() as i64).max().unwrap_or(1);
                let total = items.len().max(1) as i64;
                let vis = match n.rows {
                    Some(r) if r >= 1 && r < total => r,
                    _ => total,
                };
                let ind = if vis < total { 1 } else { 0 };
                [1 + wmax + ind + f, vis + f]
            }
            other => bail!("ui : nœud « {} » : type inconnu « {} »", n.id, other),
        })
    }

    fn need_icon(&self, n: &Node, span: i64, what: &str) -> Result<u8> {
        let b = n.icon.with_context(|| {
            format!("nœud « {} » : {} demande icon = n (planche ui.icons)", n.id, what)
        })?;
        if self.icon_count == 0 {
            bail!(
                "nœud « {} » : {} demande une planche d'icones — ajouter \"icons\" \
                 dans le bloc \"ui\" de project.json (Gestionnaire de ressources, IconSet)",
                n.id, what
            );
        }
        if b as i64 + span > self.icon_count as i64 {
            bail!(
                "nœud « {} » : icones {}..{} hors planche ({} icones)",
                n.id, b, b as i64 + span - 1, self.icon_count
            );
        }
        Ok(b)
    }

    /// Places a node at absolute (x, y) and emits its primitives.
    fn place(&mut self, i: usize, x: i64, y: i64, depth: usize, in_window: bool) -> Result<()> {
        let n = &self.nodes[i].clone();
        let size = self.size_of(i, depth)?;
        let kids: Vec<usize> = self.children[i].clone();
        match n.kind.as_str() {
            "window" => {
                if size[0] < 3 || size[1] < 3 {
                    bail!("nœud « {} » : une window fait au moins 3x3", n.id);
                }
                self.emit(Prim {
                    x, y, w: size[0], h: size[1],
                    kind: 4, frame: true, var: 0, icon: 0, vertical: false,
                    pad: 0, max: 0, max_var: None, bg: in_window, widget: 0, text: String::new(), font: None,
                })?;
                // children stack vertically inside the frame
                let m = n.margin.unwrap_or([1, 1]);
                let mut cy = y + m[1];
                for &c in &kids {
                    let cs = self.size_of(c, depth + 1)?;
                    if cy + cs[1] > y + size[1] - m[1] || m[0] + cs[0] > size[0] - m[0] {
                        bail!(
                            "nœud « {} » : l'enfant « {} » déborde de la window « {} »",
                            self.nodes[c].id, self.nodes[c].id, n.id
                        );
                    }
                    self.place(c, x + m[0], cy, depth + 1, true)?;
                    cy += cs[1];
                }
            }
            "vbox" => {
                let gap = n.gap.unwrap_or(0);
                let mut cy = y;
                for &c in &kids {
                    let cs = self.size_of(c, depth + 1)?;
                    self.place(c, x, cy, depth + 1, in_window)?;
                    cy += cs[1] + gap;
                }
            }
            "hbox" => {
                let gap = n.gap.unwrap_or(0);
                let mut cx = x;
                for &c in &kids {
                    let cs = self.size_of(c, depth + 1)?;
                    self.place(c, cx, y, depth + 1, in_window)?;
                    cx += cs[0] + gap;
                }
            }
            "label" => {
                let t = n.text.clone().unwrap_or_default();
                if !ascii_ok(&t) {
                    bail!("nœud « {} » : texte non-ASCII", n.id);
                }
                self.emit(Prim {
                    x, y, w: size[0], h: 1,
                    kind: 5, frame: false, var: 0, icon: 0, vertical: false,
                    pad: 0, max: 0, max_var: None, bg: in_window, widget: 0, text: t, font: None,
                })?;
            }
            "value" => {
                let var = n.var.with_context(|| {
                    format!("nœud « {} » : value demande var = n", n.id)
                })?;
                self.emit(Prim {
                    x, y, w: size[0], h: 1,
                    kind: 0, frame: false, var, icon: 0,
                    // the "dir" flag, unused by type 0, carries the
                    // alignment: 1 pins the value LEFT
                    vertical: n.align.as_deref() == Some("left"),
                    pad: 0, max: 0, max_var: None, bg: in_window, widget: 0, text: String::new(), font: None,
                })?;
            }
            "image" => {
                if let Some(name) = n.pic.clone() {
                    // picture mode: a rectangle of consecutive chars;
                    // "icon" temporarily holds the image's index
                    let (idx, w, h) = self.need_pic(n, &name, in_window)?;
                    self.emit(Prim {
                        x, y, w, h,
                        kind: 8, frame: false, var: 0, icon: idx, vertical: false,
                        pad: 0, max: 0, max_var: None, bg: in_window, widget: 0, text: String::new(), font: None,
                    })?;
                } else {
                    let icon = self.need_icon(n, size[0], "image")?;
                    self.emit(Prim {
                        x, y, w: size[0], h: 1,
                        kind: 6, frame: false, var: 0, icon, vertical: false,
                        pad: 0, max: 0, max_var: None, bg: in_window, widget: 0, text: String::new(), font: None,
                    })?;
                }
            }
            "variable_display" => {
                let var = n.var.with_context(|| {
                    format!("nœud « {} » : variable_display demande var = n", n.id)
                })?;
                let f = n.framed();
                let label = n.label.clone().unwrap_or_default();
                if !ascii_ok(&label) {
                    bail!("nœud « {} » : label non-ASCII", n.id);
                }
                let inner_w = size[0] - if f { 2 } else { 0 };
                let (min_w, min_h) = if f { (4, 3) } else { (3, 1) };
                if size[0] < min_w || size[1] < min_h {
                    bail!("nœud « {} » : minimum {}x{}", n.id, min_w, min_h);
                }
                if label.chars().count() as i64 > inner_w - 1 {
                    bail!("nœud « {} » : label trop long ({} tiles utiles)", n.id, inner_w - 1);
                }
                self.emit(Prim {
                    x, y, w: size[0], h: size[1],
                    kind: 0, frame: f, var, icon: 0, vertical: false,
                    pad: 0, max: 0, max_var: None, bg: in_window, widget: 0, text: label, font: None,
                })?;
            }
            "gauge" | "icon_row" => {
                let var = n.var.with_context(|| {
                    format!("nœud « {} » : {} demande var = n", n.id, n.kind)
                })?;
                let (max, max_var) = match (n.max, n.max_var) {
                    (Some(m), None) if m > 0 => (m, None),
                    (None, Some(v)) => (0, Some(v)),
                    _ => bail!(
                        "nœud « {} » : {} demande max = n (> 0) OU max_var = n",
                        n.id, n.kind
                    ),
                };
                let icon = self.need_icon(n, 3, &n.kind)?;
                if n.kind == "icon_row" && n.vertical() {
                    bail!("nœud « {} » : icon_row est horizontal", n.id);
                }
                let f = n.framed();
                let (min_w, min_h) = if f { (3, 3) } else { (1, 1) };
                if size[0] < min_w || size[1] < min_h {
                    bail!("nœud « {} » : minimum {}x{}", n.id, min_w, min_h);
                }
                self.emit(Prim {
                    x, y, w: size[0], h: size[1],
                    kind: if n.kind == "gauge" { 1 } else { 2 },
                    frame: f, var, icon, vertical: n.vertical(),
                    pad: 0, max, max_var, bg: in_window, widget: 0, text: String::new(), font: None,
                })?;
            }
            "icon_value" => {
                let var = n.var.with_context(|| {
                    format!("nœud « {} » : icon_value demande var = n", n.id)
                })?;
                let icon = self.need_icon(n, 1, "icon_value")?;
                let f = n.framed();
                let pad = n.pad.unwrap_or(0) as i64;
                let inner_w = size[0] - if f { 2 } else { 0 };
                if pad > 5 || pad > inner_w - 1 {
                    bail!("nœud « {} » : pad {} invalide", n.id, pad);
                }
                let (min_w, min_h) = if f { (4, 3) } else { (2, 1) };
                let h = if f { n.size.map(|s| s[1]).unwrap_or(3) } else { 1 };
                if size[0] < min_w || h < min_h {
                    bail!("nœud « {} » : minimum {}x{}", n.id, min_w, min_h);
                }
                self.emit(Prim {
                    x, y, w: size[0], h,
                    kind: 3, frame: f, var, icon, vertical: false,
                    pad: pad as u8, max: 0, max_var: None, bg: in_window, widget: 0, text: String::new(), font: None,
                })?;
            }
            "list" => {
                let items = n.items.clone().unwrap_or_default();
                if items.len() < 2 || items.len() > 32 {
                    bail!("nœud « {} » : list demande 2 à 32 items", n.id);
                }
                for t in &items {
                    if t.is_empty() || !ascii_ok(t) {
                        bail!("nœud « {} » : item vide ou non-ASCII", n.id);
                    }
                    if t.contains('\n') {
                        bail!("nœud « {} » : item multi-lignes", n.id);
                    }
                }
                if let Some(r) = n.rows {
                    if r < 1 {
                        bail!("nœud « {} » : rows = {} invalide (minimum 1)", n.id, r);
                    }
                }
                // the pad flag (unused by lists) says "the cursor is an
                // icon" — the icon field then carries which one
                let (cur_icon, cur_flag) = match n.cursor_icon {
                    Some(ic) => {
                        if self.icon_count == 0 {
                            bail!(
                                "nœud « {} » : cursor_icon demande une planche d'icones — \
                                 ajouter \"icons\" dans le bloc \"ui\" de project.json \
                                 (Gestionnaire de ressources, IconSet)",
                                n.id
                            );
                        }
                        if ic as usize >= self.icon_count {
                            bail!(
                                "nœud « {} » : cursor_icon {} hors planche ({} icones)",
                                n.id, ic, self.icon_count
                            );
                        }
                        (ic, 1)
                    }
                    None => (0, 0),
                };
                self.emit(Prim {
                    x, y, w: size[0], h: size[1],
                    kind: 7, frame: n.frame.unwrap_or(true), var: 0, icon: cur_icon,
                    vertical: false, pad: cur_flag, max: 0, max_var: None, bg: in_window,
                    widget: 0, text: items.join("\n"), font: None,
                })?;
            }
            other => bail!("ui : nœud « {} » : type inconnu « {} »", n.id, other),
        }
        Ok(())
    }

    fn emit(&mut self, p: Prim) -> Result<()> {
        if p.x < 0 || p.y < 0 || p.x + p.w > SCREEN_W || p.y + p.h > SCREEN_H {
            bail!(
                "ui : une primitive sort de l'écran 32x28 (pos [{},{}] size [{},{}])",
                p.x, p.y, p.w, p.h
            );
        }
        let mut p = p;
        p.widget = self.widget;
        p.font = self.font.clone();
        self.prims.push(p);
        if self.prims.len() > PRIM_MAX {
            bail!("ui : plus de {} primitives à l'écran — simplifier le layout", PRIM_MAX);
        }
        Ok(())
    }
}

/// Loads, validates and FLATTENS the layout. Returns (windows, primitives).
pub fn load(
    proj_dir: &Path,
    icon_count: usize,
    pic_paths: &HashMap<String, String>,
    ui_pal: &[u16],
) -> Result<(Layout, Vec<Prim>, Vec<(String, bool)>, Vec<(String, Vec<u8>, u8, u8)>)> {
    let p = proj_dir.join("ui").join("layout.toml");
    let mut lay: Layout = if p.is_file() {
        let src = std::fs::read_to_string(&p)
            .with_context(|| format!("lecture de {}", p.display()))?;
        toml::from_str(&src).with_context(|| format!("ui/layout.toml"))?
    } else {
        Layout::default()
    };
    let hist = Win { pos: [0, 20], size: [32, 8] };
    let msg = lay.message.clone().unwrap_or_else(|| hist.clone());
    let chc = lay.choice.clone().unwrap_or_else(|| msg.clone());
    // Extra styles: at most 3 — a VRAM budget, 4 styles in total.
    if lay.dialog_style.len() > 3 {
        bail!("ui : {} dialog_style (max 3 en plus du défaut)", lay.dialog_style.len());
    }
    {
        let mut ids: Vec<&str> = Vec::new();
        for st in &lay.dialog_style {
            if st.id.is_empty() || !ascii_ok(&st.id) {
                bail!("ui : dialog_style sans id ASCII");
            }
            if ids.contains(&st.id.as_str()) {
                bail!("ui : dialog_style « {} » en double", st.id);
            }
            ids.push(&st.id);
        }
    }
    for (name, w) in [("message", &msg), ("choice", &chc)] {
        let [x, y] = w.pos;
        let [ww, hh] = w.size;
        if x < 0 || y < 0 || ww < 8 || hh < 3 || x + ww > SCREEN_W || y + hh > SCREEN_H {
            bail!(
                "ui/layout.toml : fenetre {} pos [{},{}] size [{},{}] invalide \
                 (ecran 32x28, minimum 8x3)",
                name, x, y, ww, hh
            );
        }
    }

    // Every dialogue window (default plus styles): the shadow band covers
    // them, so no widget may overlap ANY of them.
    let mut all_wins: Vec<(String, Win)> =
        vec![("message".into(), msg.clone()), ("choice".into(), chc.clone())];
    for st in &lay.dialog_style {
        let m = st.message.clone().unwrap_or_else(|| msg.clone());
        let c = st.choice.clone().unwrap_or_else(|| m.clone());
        for (what, w) in [("message", &m), ("choice", &c)] {
            let [x, y] = w.pos;
            let [ww, hh] = w.size;
            if x < 0 || y < 0 || ww < 8 || hh < 3 || x + ww > SCREEN_W || y + hh > SCREEN_H {
                bail!(
                    "ui : style « {} » : fenetre {} invalide (ecran 32x28, min 8x3)",
                    st.id, what
                );
            }
        }
        all_wins.push((format!("message du style « {} »", st.id), m));
        all_wins.push((format!("choice du style « {} »", st.id), c));
    }

    // The tree is [[node]] plus the [[overlay]] entries turned into leaf roots.
    let mut nodes: Vec<Node> = lay.node.clone();
    for (i, ov) in lay.overlay.iter().enumerate() {
        nodes.push(overlay_to_node(ov, i));
    }

    let mut by_id: HashMap<&str, usize> = HashMap::new();
    for (i, n) in nodes.iter().enumerate() {
        if n.id.is_empty() {
            bail!("ui : nœud sans id");
        }
        if by_id.insert(n.id.as_str(), i).is_some() {
            bail!("ui : id « {} » en double", n.id);
        }
    // Font per WIDGET: a property of the ROOT only.
        if n.parent.is_some() && n.font.is_some() {
            bail!(
                "ui : nœud « {} » : font se pose sur la RACINE du widget, pas sur un enfant",
                n.id
            );
        }
    }
    let mut children: Vec<Vec<usize>> = vec![Vec::new(); nodes.len()];
    let mut roots: Vec<usize> = Vec::new();
    for (i, n) in nodes.iter().enumerate() {
        match &n.parent {
            Some(pid) => {
                let &pi = by_id.get(pid.as_str()).with_context(|| {
                    format!("ui : nœud « {} » : parent « {} » introuvable", n.id, pid)
                })?;
                let pk = nodes[pi].kind.as_str();
                if pk != "window" && pk != "vbox" && pk != "hbox" {
                    bail!(
                        "ui : nœud « {} » : le parent « {} » ({}) n'est pas un conteneur",
                        n.id, pid, pk
                    );
                }
                children[pi].push(i);
            }
            None => roots.push(i),
        }
    }

    let mut fl = Flattener {
        children, nodes: &nodes, icon_count, widget: 0, font: None, prims: Vec::new(),
        pics: Vec::new(), pic_bg: Vec::new(), pic_size: HashMap::new(),
        pic_dir: proj_dir, pic_paths, ui_pal,
    };
    // Widget images are converted BEFORE sizes are computed: the image is
    // what gives the node its size, and size_of cannot load files — it is
    // called recursively down the containers.
    for i in 0..fl.nodes.len() {
        if fl.nodes[i].kind == "image" {
            if let Some(name) = fl.nodes[i].pic.clone() {
                let n = fl.nodes[i].clone();
                fl.need_pic(&n, &name, false)?;
            }
        }
    }
    let mut widgets: Vec<(String, bool)> = Vec::new();
    let mut root_rects: Vec<(String, (i64, i64, i64, i64))> = Vec::new();
    for &r in &roots {
        let n = &nodes[r];
        let pos = n.pos.with_context(|| {
            format!("ui : racine « {} » : pos = [x, y] requis", n.id)
        })?;
        let size = fl.size_of(r, 0)?;
        let rect = (pos[0], pos[1], size[0], size[1]);
        for (pid, prev) in &root_rects {
            if overlaps(rect, *prev) {
                bail!("ui : « {} » et « {} » se chevauchent", pid, n.id);
            }
        }
        for (name, w) in &all_wins {
            if overlaps(rect, (w.pos[0], w.pos[1], w.size[0], w.size[1])) {
                bail!(
                    "ui : « {} » chevauche la fenetre {} — les dialogues l'ecraseraient",
                    n.id, name
                );
            }
        }
        root_rects.push((n.id.clone(), rect));
        fl.widget = widgets.len();
        fl.font = n.font.clone();
        widgets.push((n.id.clone(), n.visible.unwrap_or(false)));
        fl.place(r, pos[0], pos[1], 0, false)?;
    }
    if widgets.len() > 16 {
        bail!("ui : {} widgets (max 16)", widgets.len());
    }
    let prims = fl.prims;
    let pics = fl.pics;

    lay.message = Some(msg);
    lay.choice = Some(chc);
    Ok((lay, prims, widgets, pics))
}

/// Defines for ui_cfg.h: the message/choice windows and the prim count.
pub fn cfg_defines(lay: &Layout, prims: &[Prim], widgets: &[(String, bool)]) -> String {
    let m = lay.message.as_ref().unwrap();
    let c = lay.choice.as_ref().unwrap();
    // Textbox shadow area: the UNION of the rows of ALL dialogue windows
    // (default plus the extra styles).
    let mut top = m.pos[1].min(c.pos[1]);
    let mut bottom = (m.pos[1] + m.size[1]).max(c.pos[1] + c.size[1]);
    for st in &lay.dialog_style {
        let sm = st.message.clone().unwrap_or_else(|| m.clone());
        let sc = st.choice.clone().unwrap_or_else(|| sm.clone());
        top = top.min(sm.pos[1]).min(sc.pos[1]);
        bottom = bottom.max(sm.pos[1] + sm.size[1]).max(sc.pos[1] + sc.size[1]);
    }
    format!(
        "#define UI_MSG_COL {}\n#define UI_MSG_ROW {}\n#define UI_MSG_W {}\n#define UI_MSG_H {}\n\
         #define UI_CHC_COL {}\n#define UI_CHC_ROW {}\n#define UI_CHC_W {}\n#define UI_CHC_H {}\n\
         #define UI_SHADOW_ROW {}\n#define UI_SHADOW_H {}\n\
         #define UI_OV_COUNT {}\n#define UI_WIDGET_COUNT {}\n",
        m.pos[0], m.pos[1], m.size[0], m.size[1],
        c.pos[0], c.pos[1], c.size[0], c.size[1],
        top, bottom - top,
        prims.len(),
        widgets.len()
    )
}

/// ui_styles.c: the dialogue style tables, one entry per style, style 0
/// the default — (msg, chc, font base, skin base; 0 means a solid box).
/// Plain u8 arrays.
pub fn emit_styles(rows: &[(Win, Win, usize, usize)]) -> String {
    let mut s = String::from(crate::emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    let n = rows.len().max(1);
    let field = |name: &str, f: &dyn Fn(&(Win, Win, usize, usize)) -> i64| {
        let mut a = format!("const u8 ui_st_{}[{}] = {{ ", name, n);
        for i in 0..n {
            let v = rows.get(i).map(f).unwrap_or(0);
            let _ = write!(a, "{}, ", v);
        }
        a.push_str("};\n");
        a
    };
    s.push_str(&field("mx", &|r| r.0.pos[0]));
    s.push_str(&field("my", &|r| r.0.pos[1]));
    s.push_str(&field("mw", &|r| r.0.size[0]));
    s.push_str(&field("mh", &|r| r.0.size[1]));
    s.push_str(&field("cx", &|r| r.1.pos[0]));
    s.push_str(&field("cy", &|r| r.1.pos[1]));
    s.push_str(&field("cw", &|r| r.1.size[0]));
    s.push_str(&field("ch", &|r| r.1.size[1]));
    s.push_str(&field("font", &|r| r.2 as i64));
    s.push_str(&field("skin", &|r| r.3 as i64));
    s
}

/// ui_overlays.c: the primitive tables (plain u8, with `max` split into
/// lo/hi) plus the text pointer table (types 0 and 5). `font_bases` holds
/// the base char of glyph ' ' for each prim's font (1 = font 0), resolved
/// by the VRAM plan in main.rs.
pub fn emit_overlays(
    prims: &[Prim],
    widgets: &[(String, bool)],
    font_bases: &[usize],
) -> String {
    let mut s = String::from(crate::emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    let n = prims.len().max(1);
    let field = |name: &str, f: &dyn Fn(&Prim) -> i64| {
        let mut a = format!("const u8 ui_ov_{}[{}] = {{ ", name, n);
        for i in 0..n {
            let v = prims.get(i).map(f).unwrap_or(0);
            let _ = write!(a, "{}, ", v);
        }
        a.push_str("};\n");
        a
    };
    s.push_str(&field("x", &|o| o.x));
    s.push_str(&field("y", &|o| o.y));
    s.push_str(&field("w", &|o| o.w));
    s.push_str(&field("h", &|o| o.h));
    s.push_str(&field("var", &|o| o.var as i64));
    s.push_str(&field("type", &|o| o.kind));
    s.push_str(&field("frame", &|o| o.frame as i64));
    s.push_str(&field("icon", &|o| o.icon as i64));
    s.push_str(&field("dir", &|o| o.vertical as i64));
    s.push_str(&field("pad", &|o| o.pad as i64));
    s.push_str(&field("bg", &|o| o.bg as i64));
    s.push_str(&field("widget", &|o| o.widget as i64));
    s.push_str(&field("maxvar", &|o| o.max_var.map(|v| v as i64).unwrap_or(0xFF)));
    s.push_str(&field("maxlo", &|o| (o.max & 0xFF) as i64));
    s.push_str(&field("maxhi", &|o| (o.max >> 8) as i64));
    // Font base per primitive: glyph ' ' (1 is the project font).
    let mut a = format!("const u8 ui_ov_font[{}] = {{ ", n);
    for i in 0..n {
        let _ = write!(a, "{}, ", font_bases.get(i).copied().unwrap_or(1));
    }
    a.push_str("};\n");
    s.push_str(&a);
    // Initial visibility per WIDGET (root); changed by SHOWUI.
    let wn = widgets.len().max(1);
    let mut a = format!("const u8 ui_widget_vis[{}] = {{ ", wn);
    for i in 0..wn {
        let _ = write!(a, "{}, ", widgets.get(i).map(|w| w.1 as u8).unwrap_or(0));
    }
    a.push_str("};\n");
    s.push_str(&a);
    for (i, p) in prims.iter().enumerate() {
        let _ = write!(s, "static const char ui_ov_l{}[] = {:?};\n", i, p.text);
    }
    s.push_str(&format!("const char *const ui_ov_label[{}] = {{ ", n));
    for i in 0..n {
        if i < prims.len() {
            let _ = write!(s, "ui_ov_l{}, ", i);
        } else {
            s.push_str("0, ");
        }
    }
    s.push_str("};\n");
    s
}

/// BG3 VRAM char plan (budget 256 chars).
///
/// Layout: font 0 (97 chars — one transparent plus 96 glyphs) | skins
/// (9 chars each) | icons (2 x N: the normal ones, then the
/// panel-background variants) | extra fonts (96 chars each, based on ' ')
/// | widget images.
///
/// Every base char the emitters need comes from here, so the plan and the
/// data that depends on it cannot drift apart.
pub struct Plan {
    /// Fonts in char order; `fonts[0]` is the project font (base 1).
    pub fonts: Vec<String>,
    pub skins: Vec<String>,
    pub icon_count: usize,
    pub icon_base: usize,
    /// Chars taken by the widget images, after the extra fonts.
    pub pic_chars: usize,
    pub total_chars: usize,
    theme_skin: Option<String>,
}

impl Plan {
    /// Base char of a skin (0 means a solid box); the theme's when absent.
    pub fn skin_base(&self, path: &Option<String>) -> usize {
        match path.as_ref().or(self.theme_skin.as_ref()) {
            Some(p) => self.skins.iter().position(|k| k == p).map(|i| 97 + 9 * i).unwrap_or(0),
            None => 0,
        }
    }

    /// Base char of the ' ' glyph of a font; the project font when absent.
    pub fn font_base(&self, path: &Option<String>) -> usize {
        match path {
            None => 1,
            Some(p) => {
                let i = self.fonts.iter().position(|f| f == p).unwrap_or(0);
                if i == 0 {
                    1
                } else {
                    self.icon_base + 2 * self.icon_count + 96 * (i - 1)
                }
            }
        }
    }

    /// The fonts loaded IN ADDITION to the project font.
    pub fn extra_fonts(&self) -> &[String] {
        &self.fonts[1..]
    }

    /// Style table rows: style 0 (the theme) then the dialog_style entries,
    /// each as (message window, choice window, font base, skin base).
    pub fn style_rows(&self, layout: &Layout) -> Vec<(Win, Win, usize, usize)> {
        let msg = layout.message.clone().unwrap();
        let chc = layout.choice.clone().unwrap();
        let mut rows = vec![(msg.clone(), chc, 1, self.skin_base(&None))];
        for st in &layout.dialog_style {
            let m = st.message.clone().unwrap_or_else(|| msg.clone());
            let c = st.choice.clone().unwrap_or_else(|| m.clone());
            rows.push((m, c, self.font_base(&st.font), self.skin_base(&st.windowskin)));
        }
        rows
    }
}

/// Builds the char plan and finishes the primitives: a kind 8 (picture)
/// primitive arrives carrying the image's INDEX, which only becomes a
/// char once the fonts before it are placed.
pub fn plan(
    layout: &Layout,
    prims: &mut [Prim],
    pics: &[(String, Vec<u8>, u8, u8)],
    project_font: &str,
    theme_skin: Option<String>,
    icon_count: usize,
) -> Result<Plan> {
    let mut fonts: Vec<String> = vec![project_font.to_string()];
    let mut skins: Vec<String> = Vec::new();
    if let Some(skn) = &theme_skin {
        skins.push(skn.clone());
    }
    for st in &layout.dialog_style {
        if let Some(f) = &st.font {
            if !fonts.contains(f) {
                fonts.push(f.clone());
            }
        }
        if let Some(k) = &st.windowskin {
            if !skins.contains(k) {
                skins.push(k.clone());
            }
        }
    }
    // WIDGET fonts, deduplicated against the style fonts
    for p in prims.iter() {
        if let Some(f) = &p.font {
            if !fonts.contains(f) {
                fonts.push(f.clone());
            }
        }
    }

    let icon_base = 97 + 9 * skins.len();
    let pic_base = icon_base + 2 * icon_count + 96 * (fonts.len() - 1);
    let mut offsets: Vec<usize> = Vec::new();
    let mut pic_chars = 0usize;
    for (_, chars, _, _) in pics.iter() {
        offsets.push(pic_chars);
        pic_chars += chars.len() / 16; /* 16 octets par char 2bpp */
    }
    for p in prims.iter_mut() {
        if p.kind == 8 {
            p.icon = (pic_base + offsets[p.icon as usize]) as u8;
        }
    }

    let total_chars = pic_base + pic_chars;
    if total_chars > 256 {
        bail!(
            "ui : budget de caracteres BG3 depasse ({} > 256) — fonte(s) {} x 96, \
             skin(s) {} x 9, {} icone(s) x 2, {} image(s) de widget = {} chars. \
             Retirer un style, une fonte, des icones, ou reduire une image.",
            total_chars, fonts.len(), skins.len(), icon_count,
            pics.len(), pic_chars
        );
    }
    Ok(Plan {
        fonts,
        skins,
        icon_count,
        icon_base,
        pic_chars,
        total_chars,
        theme_skin,
    })
}
