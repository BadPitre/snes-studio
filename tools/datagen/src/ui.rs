//! "uigen" — see docs/SPEC_SYSTEME_UI.md and
//! docs/PLANNING_SYSTEME_MENUS.md.
//!
//! Reads `<project>/ui/layout.toml`, all positions and sizes IN TILES:
//!   [message] / [choice]  pos, size — the dialogue windows
//!
//!   [[node]] — the designer's widget TREE (UMG model):
//!     type = "canvas"   a rectangle, explicit size; its children stack
//!                       vertically inside. frame = true draws the
//!                       windowskin over it (margin, default [1,1]);
//!                       WITHOUT a frame — the default — it is a bare
//!                       placement box, Unity's Canvas. "window" is the
//!                       old name, still read, and it frames by default.
//!     type = "vbox"     stacks children top to bottom (gap)
//!     type = "hbox"     lays children left to right (gap)
//!     type = "label"    text (text). It may carry \v[n] escapes — the
//!                       value of variable n, `\v[n,w]` right-aligned on
//!                       w columns, `\v[n,0w]` zero-padded — which is
//!                       how a label shows a number. At most TWO
//!                       variables per label (the engine watches two);
//!                       past that, split it across an hbox.
//!     type = "image"    a run of icons from the sheet (icon, width), or
//!                       a project picture (pic = "name"), whose size
//!                       comes from the image, mapped to the UI layer's
//!                       4 colours at compile time. mode picks what is
//!                       done with it, Unity style:
//!                         "normal" (default) draws it as it is
//!                         "sliced"  stretches a 3x3 picture over `size`
//!                                   (the windowskin recipe, any image)
//!                         "fill"    reveals it in proportion to
//!                                   var/max (or max_var), left to right
//!                                   or bottom up (dir = "v"), two units
//!                                   per tile. On the ICON sheet it is
//!                                   the classic 3-icon bar: full, half,
//!                                   empty.
//!     type = "gauge" / "icon_row" / "icon_value" / "variable_display"
//!                       the OLD HUD widgets. Still compiled so no
//!                       project breaks, but gone from the palette: a
//!                       filled image replaces the first two, a label
//!                       with \v[n] the last two.
//!     type = "list"     cursor menu: items = ["Attack", ...], frame
//!                       defaults to true, size is AUTO (one cursor
//!                       column plus the longest item) — driven by the
//!                       "choose from a list" event command.
//!                       rows = n shows only n rows: the list SCROLLS
//!                       (one extra column for the ^ / v indicators);
//!                       cursor_icon = n replaces the '>' cursor with
//!                       an icon from the ui.icons sheet.
//!                       source = "items" makes the rows the ENTRIES of
//!                       a database table (their names) — an inventory,
//!                       a spell list; `size` is then required, and
//!                       LISTSEL answers the chosen ENTRY's number.
//!                       source_filter = "col" hides a row while the
//!                       variable that column names holds 0;
//!                       source_count = "col" draws that variable's
//!                       value right-aligned (the quantity)
//!     parent = "id"     attaches to a container; no parent means a ROOT,
//!                       which then requires pos = [x, y]
//!     anchor = "tl"     ROOTS: which point of the 32x28 screen pos is
//!                       counted from, Unity style — t/m/b then l/c/r,
//!                       default "tl". The same corner of the widget is
//!                       pinned to it, so an "br" widget keeps its
//!                       bottom-right corner put as it grows.
//!
//!   [[overlay]] — the older flat format is still accepted: each entry
//!   becomes a leaf root, migrated transparently.
//!
//! The tree is FLATTENED at compile time into primitives positioned in
//! tiles. The engine knows nothing of vbox or hbox — zero runtime cost:
//!   0 variable_display  1 gauge  2 icon_row  3 icon_value
//!   4 panel (frame or bare rectangle)  5 label (static text)
//!   6 image (icons)
//!   7 list (cursor menu; items in `text`, separated by \n)
//!   8 image (picture: a rectangle of chars, base char in `icon`)
//!   9 image (sliced: a 3x3 picture stretched over the rect)
//!  10 image (filled: the picture, then its CUT copy right after)
//!  11 label (dynamic: \v[n] escapes encoded as 0x01, n+1, format)
//! Types 4-9 are STATIC: never redrawn when a variable changes, only on
//! a refresh.
//!
//! Compile-time validation (§9.3): unique ids, existing parents, bounded
//! depth, non-empty containers, everything on screen, at most 32
//! primitives, no widget over a dialogue window, icons within the sheet,
//! ASCII text. Widgets MAY overlap each other: the engine repaints by
//! z-order, and the later widget wins.

use anyhow::{bail, Context, Result};

use crate::db::Db;
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
    /// Roots: the screen point `pos` is counted from, Unity style —
    /// "tl" (default), "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br".
    #[serde(default)]
    pub anchor: Option<String>,
    #[serde(default)]
    pub size: Option<[i64; 2]>, // canvas/gauge/icon_row/variable_display
    #[serde(default)]
    pub margin: Option<[i64; 2]>, // canvas framed (défaut [1,1])
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
    /// image: "normal" (default), "sliced" or "fill" — see the module docs.
    #[serde(default)]
    pub mode: Option<String>,
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
    /// list: the rows ARE the entries of this database TABLE (their
    /// display names). `items` is then ignored, `size` is required —
    /// the table grows without the layout knowing.
    #[serde(default)]
    pub source: Option<String>,
    /// list + source: a u8 column holding a VARIABLE NUMBER. The row is
    /// hidden while that variable is 0 — an inventory shows what the
    /// party owns.
    #[serde(default)]
    pub source_filter: Option<String>,
    /// list + source: a u8 column holding a VARIABLE NUMBER whose VALUE
    /// is drawn right-aligned on the row — the quantity.
    #[serde(default)]
    pub source_count: Option<String>,
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
    /// list sourced on a database table: table id, and the byte offsets
    /// of the filter / quantity columns (0xFF = none).
    pub src_table: u8,
    pub src_filter: u8,
    pub src_count: u8,
}

fn ascii_ok(s: &str) -> bool {
    s.chars().all(|c| (' '..='~').contains(&c))
}

/// A C string literal. Non-printable bytes go out as three-digit OCTAL —
/// `\x` in C is greedy, so "\x01A" would read as one character 0x1A. A
/// label's \v[n] escapes are exactly such bytes.
fn c_string(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            c if (' '..='~').contains(&c) => out.push(c),
            c => {
                let _ = write!(out, "\\{:03o}", c as u32 & 0xFF);
            }
        }
    }
    out.push('"');
    out
}

fn overlaps(a: (i64, i64, i64, i64), b: (i64, i64, i64, i64)) -> bool {
    !(a.0 + a.2 <= b.0 || b.0 + b.2 <= a.0 || a.1 + a.3 <= b.1 || b.1 + b.3 <= a.1)
}

impl Node {
    fn framed(&self) -> bool {
        // A CANVAS is bare unless asked otherwise; "window", the old name,
        // keeps framing by default so no existing layout changes look.
        self.frame
            .unwrap_or(self.kind == "variable_display" || self.kind == "window")
    }
    fn vertical(&self) -> bool {
        self.dir.as_deref() == Some("v")
    }
    /// "normal" | "sliced" | "fill" — the image widget's Unity-style type.
    fn mode(&self) -> &str {
        match self.mode.as_deref() {
            None | Some("") => "normal",
            Some(m) => m,
        }
    }
}

/// A canvas, whatever it is called. "window" is the name the type had
/// before the designer renamed it; both compile.
fn is_canvas(kind: &str) -> bool {
    kind == "canvas" || kind == "window"
}

/// Where a root's `pos` is counted from: the anchor point of the 32x28
/// screen, minus the SAME corner of the widget, Unity style. "tl" (the
/// default) gives back plain absolute coordinates.
fn anchor_origin(anchor: Option<&str>, size: [i64; 2]) -> Result<(i64, i64)> {
    let a = anchor.unwrap_or("tl");
    let b = a.as_bytes();
    if b.len() != 2 {
        bail!("ui : ancre « {} » inconnue (t/m/b puis l/c/r, ex. \"br\")", a);
    }
    let y = match b[0] {
        b't' => 0,
        b'm' => SCREEN_H / 2 - size[1] / 2,
        b'b' => SCREEN_H - size[1],
        _ => bail!("ui : ancre « {} » : première lettre t (haut), m (milieu) ou b (bas)", a),
    };
    let x = match b[1] {
        b'l' => 0,
        b'c' => SCREEN_W / 2 - size[0] / 2,
        b'r' => SCREEN_W - size[0],
        _ => bail!("ui : ancre « {} » : deuxième lettre l (gauche), c (centre) ou r (droite)", a),
    };
    Ok((x, y))
}

/// One piece of a label: literal text, or a variable to interpolate.
enum LabelPart {
    Text(String),
    /// (variable, format byte — 1 plain, w+1 space-padded, 0x80|(w+1) zeros)
    Var(u8, u8),
}

/// Splits a label on its `\v[n]` / `\v[n,w]` / `\v[n,0w]` escapes. Anything
/// that is not one of those stays literal, backslash included.
fn parse_label(id: &str, text: &str) -> Result<Vec<LabelPart>> {
    let mut out: Vec<LabelPart> = Vec::new();
    let mut lit = String::new();
    let b: Vec<char> = text.chars().collect();
    let mut i = 0;
    while i < b.len() {
        if b[i] != '\\' || i + 2 >= b.len() || b[i + 1] != 'v' || b[i + 2] != '[' {
            lit.push(b[i]);
            i += 1;
            continue;
        }
        let close = match b[i + 3..].iter().position(|&c| c == ']') {
            Some(k) => i + 3 + k,
            None => bail!("nœud « {} » : \\v[ sans ] dans le texte", id),
        };
        let body: String = b[i + 3..close].iter().collect();
        let (num, fmt) = match body.split_once(',') {
            None => (body.as_str().trim().to_string(), 1u8),
            Some((n, f)) => {
                let f = f.trim();
                let zeros = f.starts_with('0') && f.len() > 1;
                let w: i64 = f
                    .parse()
                    .with_context(|| format!("nœud « {} » : largeur « {} » de \\v[]", id, f))?;
                if !(1..=5).contains(&w) {
                    bail!("nœud « {} » : \\v[{},{}] — largeur de 1 à 5 chiffres", id, n, f);
                }
                (n.trim().to_string(), (w as u8 + 1) | if zeros { 0x80 } else { 0 })
            }
        };
        let v: i64 = num
            .parse()
            .with_context(|| format!("nœud « {} » : \\v[{}] n'est pas un numéro de variable", id, num))?;
        if !(0..=254).contains(&v) {
            bail!(
                "nœud « {} » : \\v[{}] — variables 0 à 254 dans un label \
                 (la 255 sert de marqueur)",
                id, v
            );
        }
        if !lit.is_empty() {
            out.push(LabelPart::Text(std::mem::take(&mut lit)));
        }
        out.push(LabelPart::Var(v as u8, fmt));
        i = close + 1;
    }
    if !lit.is_empty() {
        out.push(LabelPart::Text(lit));
    }
    Ok(out)
}

/// The parts as the engine reads them: literal bytes, and each variable
/// as 0x01 / number+1 / format. Returns (encoded string, columns it
/// takes at most, the variables it reads in order).
fn encode_label(parts: &[LabelPart]) -> (String, i64, Vec<u8>) {
    let mut s = String::new();
    let mut w = 0i64;
    let mut vars: Vec<u8> = Vec::new();
    for p in parts {
        match p {
            LabelPart::Text(t) => {
                w += t.chars().count() as i64;
                s.push_str(t);
            }
            LabelPart::Var(v, f) => {
                // no width given: reserve the worst case, five digits
                w += if *f == 1 { 5 } else { ((*f & 0x7F) - 1) as i64 };
                s.push('\u{1}');
                s.push((*v as u8 + 1) as char);
                s.push(*f as char);
                if !vars.contains(v) {
                    vars.push(*v);
                }
            }
        }
    }
    (s, w.max(1), vars)
}

/// Converts a flat [[overlay]] into the equivalent root node.
fn overlay_to_node(ov: &Overlay, i: usize) -> Node {
    Node {
        id: if ov.id.is_empty() { format!("overlay{}", i + 1) } else { ov.id.clone() },
        parent: None,
        kind: ov.content.clone(),
        pos: Some(ov.pos),
        anchor: None,
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
        mode: None,
        icon: ov.icon,
        dir: ov.dir.clone(),
        pad: ov.pad,
        align: None,
        visible: Some(true), // compat W1 : les overlays plats restent visibles
        font: None,
        items: None,
        rows: None,
        cursor_icon: None,
        source: None,
        source_filter: None,
        source_count: None,
    }
}

/// The flattener: tree to primitives. `icon_count` bounds the icons.
struct Flattener<'a> {
    children: Vec<Vec<usize>>,
    nodes: &'a [Node],
    /// The project's database — a list widget can source its rows on a
    /// table, which is resolved here.
    db: Option<&'a Db>,
    /// Tables a list draws its rows from: their entry NAMES must reach
    /// ROM (db::emit_files takes this list).
    list_tables: Vec<String>,
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
    /// Variant of each `pics` entry: (panel background — transparent
    /// pixels replaced by the frame's background, cut). The cut is 0 for
    /// the whole image, 1 for "left half of every tile" and 2 for
    /// "bottom half", the half-steps of a FILLED image.
    pic_bg: Vec<(bool, u8)>,
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
        self.need_variant(n, name, bg, VAR_WHOLE)
    }

    /// A FILLED image needs two copies laid side by side: the whole one
    /// and the one cut in half, which gives the bar its second unit per
    /// tile. Their variant codes only ever appear as a PAIR, so they are
    /// always consecutive and the engine finds the cut chars at
    /// base + w*h — one base char is enough.
    fn need_fill_pic(&mut self, n: &Node, name: &str, bg: bool, vert: bool) -> Result<(u8, i64, i64)> {
        let (full, half) = if vert {
            (VAR_FILL_V, VAR_CUT_V)
        } else {
            (VAR_FILL_H, VAR_CUT_H)
        };
        if let Some(k) = self.find_variant(name, bg, full) {
            let (_, _, w, h) = &self.pics[k];
            return Ok((k as u8, *w as i64, *h as i64));
        }
        let (idx, w, h) = self.need_variant(n, name, bg, full)?;
        self.need_variant(n, name, bg, half)?;
        Ok((idx, w, h))
    }

    fn find_variant(&self, name: &str, bg: bool, variant: u8) -> Option<usize> {
        self.pics
            .iter()
            .zip(self.pic_bg.iter())
            .position(|((p, _, _, _), (b, v))| p == name && *b == bg && *v == variant)
    }

    fn need_variant(&mut self, n: &Node, name: &str, bg: bool, variant: u8) -> Result<(u8, i64, i64)> {
        if let Some(k) = self.find_variant(name, bg, variant) {
            let (_, _, w, h) = &self.pics[k];
            return Ok((k as u8, *w as i64, *h as i64));
        }
        // pixels kept: the whole tile, its left half, or its bottom half
        let cut = match variant {
            VAR_CUT_H => 1,
            VAR_CUT_V => 2,
            _ => 0,
        };
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
            .to_ui_image_bg(self.ui_pal, bg, cut)
            .with_context(|| format!("nœud « {} » : image « {} »", n.id, name))?;
        if self.pics.len() >= 255 {
            bail!("ui : trop d'images de widgets");
        }
        self.pic_size.insert(name.to_string(), (w, h));
        self.pics.push((name.to_string(), chars, w, h));
        self.pic_bg.push((bg, variant));
        Ok(((self.pics.len() - 1) as u8, w as i64, h as i64))
    }
}

/// `pic_bg` variant codes — see Flattener::need_fill_pic.
const VAR_WHOLE: u8 = 0;
const VAR_FILL_H: u8 = 1;
const VAR_CUT_H: u8 = 2;
const VAR_FILL_V: u8 = 3;
const VAR_CUT_V: u8 = 4;

impl<'a> Flattener<'a> {
    /// A node's intrinsic size, recursive for containers.
    fn size_of(&self, i: usize, depth: usize) -> Result<[i64; 2]> {
        let n = &self.nodes[i];
        if depth > DEPTH_MAX {
            bail!("ui : arbre trop profond autour de « {} » (max {})", n.id, DEPTH_MAX);
        }
        let kids = &self.children[i];
        let need_size = |what: &str| -> Result<[i64; 2]> {
            n.size.with_context(|| {
                format!("nœud « {} » ({}) : size = [w, h] requis", n.id, what)
            })
        };
        Ok(match n.kind.as_str() {
            k if is_canvas(k) => need_size("canvas")?,
            "gauge" | "icon_row" | "variable_display" => need_size(&n.kind)?,
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
                let (_, w, _) = encode_label(&parse_label(&n.id, &t)?);
                [w, 1]
            }
            "value" => [n.width.unwrap_or(3).clamp(1, 5), 1],
            // sliced: the author gives the rect the 3x3 is stretched over
            "image" if n.mode() == "sliced" => need_size("image sliced")?,
            // filled icons: the bar's length is the author's, like a gauge
            "image" if n.mode() == "fill" && n.pic.is_none() => need_size("image fill")?,
            "image" => match &n.pic {
                // picture mode: the size comes from the image itself
                Some(p) => match self.pic_size.get(p) {
                    Some((w, h)) => [*w as i64, *h as i64],
                    None => [1, 1], /* pré-passe pas encore passée */
                },
                None => [n.width.unwrap_or(1).max(1), 1],
            },
            "icon_value" => [n.width.unwrap_or(4).max(2), 1],
            "list" if n.source.is_some() => {
                // Sourced on a table: the row count is a RUNTIME thing
                // (the table grows, the filter hides rows), so the size
                // cannot be inferred — the author gives it.
                n.size.with_context(|| {
                    format!(
                        "nœud « {} » : une liste branchée sur une table demande \
                         size = [w, h] (le nombre de lignes varie en jeu)",
                        n.id
                    )
                })?
            }
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
            k if is_canvas(k) => {
                let f = n.framed();
                if f && (size[0] < 3 || size[1] < 3) {
                    bail!("nœud « {} » : un canvas encadré fait au moins 3x3", n.id);
                }
                self.emit(Prim {
                    x, y, w: size[0], h: size[1],
                    kind: 4, frame: f, var: 0, icon: 0, vertical: false,
                    pad: 0, max: 0, max_var: None, bg: in_window, widget: 0, text: String::new(), font: None, src_table: 0xFF, src_filter: 0xFF, src_count: 0xFF,
                })?;
                // children stack vertically inside; a bare canvas has no
                // frame to keep clear of, so its margin starts at zero
                let m = n.margin.unwrap_or(if f { [1, 1] } else { [0, 0] });
                let mut cy = y + m[1];
                for &c in &kids {
                    let cs = self.size_of(c, depth + 1)?;
                    if cy + cs[1] > y + size[1] - m[1] || m[0] + cs[0] > size[0] - m[0] {
                        bail!(
                            "ui : l'enfant « {} » ({}x{}) déborde du canvas « {} » ({}x{}, marge [{},{}])",
                            self.nodes[c].id, cs[0], cs[1], n.id, size[0], size[1], m[0], m[1]
                        );
                    }
                    // only a FRAMED canvas gives its children a background
                    self.place(c, x + m[0], cy, depth + 1, in_window || f)?;
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
                // \v[n] escapes make the label DYNAMIC (type 11): it then
                // watches its variables like a value does. The engine
                // tracks two of them — var and max_var.
                let (enc, _, vars) = encode_label(&parse_label(&n.id, &t)?);
                if vars.len() > 2 {
                    bail!(
                        "nœud « {} » : {} variables dans un label (2 au maximum) — \
                         couper en deux labels dans une hbox",
                        n.id, vars.len()
                    );
                }
                self.emit(Prim {
                    x, y, w: size[0], h: 1,
                    kind: if vars.is_empty() { 5 } else { 11 },
                    frame: false, var: vars.first().copied().unwrap_or(0),
                    icon: 0, vertical: false,
                    pad: 0, max: 0, max_var: vars.get(1).copied(),
                    bg: in_window, widget: 0, text: enc, font: None, src_table: 0xFF, src_filter: 0xFF, src_count: 0xFF,
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
                    pad: 0, max: 0, max_var: None, bg: in_window, widget: 0, text: String::new(), font: None, src_table: 0xFF, src_filter: 0xFF, src_count: 0xFF,
                })?;
            }
            "image" => {
                let mode = n.mode();
                if !matches!(mode, "normal" | "sliced" | "fill") {
                    bail!(
                        "nœud « {} » : mode « {} » inconnu (normal, sliced ou fill)",
                        n.id, mode
                    );
                }
                // A filled image reads a variable against a maximum, the
                // gauge's contract — kept generic, any artwork.
                let fill_range = |n: &Node| -> Result<(u16, Option<u8>)> {
                    match (n.max, n.max_var) {
                        (Some(m), None) if m > 0 => Ok((m, None)),
                        (None, Some(v)) => Ok((0, Some(v))),
                        _ => bail!(
                            "nœud « {} » : une image en mode fill demande max = n (> 0) \
                             OU max_var = n",
                            n.id
                        ),
                    }
                };
                match (n.pic.clone(), mode) {
                    (Some(name), "sliced") => {
                        let (idx, pw, ph) = self.need_pic(n, &name, in_window)?;
                        if pw != 3 || ph != 3 {
                            bail!(
                                "nœud « {} » : une image sliced fait exactement 3x3 tuiles \
                                 (24x24 px, comme un windowskin) — « {} » en fait {}x{}",
                                n.id, name, pw, ph
                            );
                        }
                        if size[0] < 3 || size[1] < 3 {
                            bail!("nœud « {} » : une image sliced fait au moins 3x3", n.id);
                        }
                        self.emit(Prim {
                            x, y, w: size[0], h: size[1],
                            kind: 9, frame: false, var: 0, icon: idx, vertical: false,
                            pad: 0, max: 0, max_var: None, bg: in_window, widget: 0, text: String::new(), font: None, src_table: 0xFF, src_filter: 0xFF, src_count: 0xFF,
                        })?;
                    }
                    (Some(name), "fill") => {
                        let var = n.var.with_context(|| {
                            format!("nœud « {} » : une image en mode fill demande var = n", n.id)
                        })?;
                        let (max, max_var) = fill_range(n)?;
                        let (idx, w, h) = self.need_fill_pic(n, &name, in_window, n.vertical())?;
                        self.emit(Prim {
                            x, y, w, h,
                            kind: 10, frame: false, var, icon: idx, vertical: n.vertical(),
                            pad: 0, max, max_var, bg: in_window, widget: 0, text: String::new(), font: None, src_table: 0xFF, src_filter: 0xFF, src_count: 0xFF,
                        })?;
                    }
                    (Some(name), _) => {
                        // picture mode: a rectangle of consecutive chars;
                        // "icon" temporarily holds the image's index
                        let (idx, w, h) = self.need_pic(n, &name, in_window)?;
                        self.emit(Prim {
                            x, y, w, h,
                            kind: 8, frame: false, var: 0, icon: idx, vertical: false,
                            pad: 0, max: 0, max_var: None, bg: in_window, widget: 0, text: String::new(), font: None, src_table: 0xFF, src_filter: 0xFF, src_count: 0xFF,
                        })?;
                    }
                    (None, "sliced") => bail!(
                        "nœud « {} » : le mode sliced demande une image du projet (pic), \
                         pas des icônes",
                        n.id
                    ),
                    (None, "fill") => {
                        // On the icon sheet, a filled image IS the classic
                        // three-icon bar: full, half, empty.
                        let var = n.var.with_context(|| {
                            format!("nœud « {} » : une image en mode fill demande var = n", n.id)
                        })?;
                        let (max, max_var) = fill_range(n)?;
                        let icon = self.need_icon(n, 3, "une image en mode fill")?;
                        self.emit(Prim {
                            x, y, w: size[0], h: size[1],
                            kind: 1, frame: false, var, icon, vertical: n.vertical(),
                            pad: 0, max, max_var, bg: in_window, widget: 0, text: String::new(), font: None, src_table: 0xFF, src_filter: 0xFF, src_count: 0xFF,
                        })?;
                    }
                    (None, _) => {
                        let icon = self.need_icon(n, size[0], "image")?;
                        self.emit(Prim {
                            x, y, w: size[0], h: 1,
                            kind: 6, frame: false, var: 0, icon, vertical: false,
                            pad: 0, max: 0, max_var: None, bg: in_window, widget: 0, text: String::new(), font: None, src_table: 0xFF, src_filter: 0xFF, src_count: 0xFF,
                        })?;
                    }
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
                    pad: 0, max: 0, max_var: None, bg: in_window, widget: 0, text: label, font: None, src_table: 0xFF, src_filter: 0xFF, src_count: 0xFF,
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
                    pad: 0, max, max_var, bg: in_window, widget: 0, text: String::new(), font: None, src_table: 0xFF, src_filter: 0xFF, src_count: 0xFF,
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
                    pad: pad as u8, max: 0, max_var: None, bg: in_window, widget: 0, text: String::new(), font: None, src_table: 0xFF, src_filter: 0xFF, src_count: 0xFF,
                })?;
            }
            "list" if n.source.is_some() => {
                let tname = n.source.clone().unwrap();
                let db = self.db.with_context(|| {
                    format!(
                        "nœud « {} » : source = « {} » demande une database \
                         (dossier schemas/)",
                        n.id, tname
                    )
                })?;
                let ti = db.table_id(&tname).with_context(|| {
                    format!("nœud « {} » : table « {} » inconnue", n.id, tname)
                })?;
                // filter / quantity columns: a u8 holding a VARIABLE number
                let col = |f: &Option<String>, what: &str| -> Result<u8> {
                    match f {
                        None => Ok(0xFF),
                        Some(c) => {
                            let (ofs, sz) = db.field_info(ti, c).with_context(|| {
                                format!(
                                    "nœud « {} » : colonne « {} » absente de la table {}",
                                    n.id, c, tname
                                )
                            })?;
                            if sz != 1 {
                                bail!(
                                    "nœud « {} » : {} « {} » doit tenir sur 1 octet \
                                     (elle porte un NUMERO DE VARIABLE)",
                                    n.id, what, c
                                );
                            }
                            if ofs > 254 {
                                bail!("nœud « {} » : colonne « {} » trop loin", n.id, c);
                            }
                            Ok(ofs as u8)
                        }
                    }
                };
                let filt = col(&n.source_filter, "le filtre")?;
                let cnt = col(&n.source_count, "la quantité")?;
                let f = n.frame.unwrap_or(true);
                let inner = (size[0] - if f { 2 } else { 0 }, size[1] - if f { 2 } else { 0 });
                if inner.0 < 3 || inner.1 < 1 {
                    bail!("nœud « {} » : minimum 3 colonnes utiles et 1 ligne", n.id);
                }
                self.list_tables.push(tname);
                self.emit(Prim {
                    x, y, w: size[0], h: size[1],
                    kind: 7, frame: f, var: 0, icon: n.cursor_icon.unwrap_or(0),
                    vertical: false,
                    pad: if n.cursor_icon.is_some() { 1 } else { 0 },
                    max: 0, max_var: None, bg: in_window, widget: 0,
                    text: String::new(), font: None,
                    src_table: ti as u8, src_filter: filt, src_count: cnt,
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
                    widget: 0, text: items.join("\n"), font: None, src_table: 0xFF, src_filter: 0xFF, src_count: 0xFF,
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
    db: Option<&Db>,
) -> Result<(
    Layout,
    Vec<Prim>,
    Vec<(String, bool)>,
    Vec<(String, Vec<u8>, u8, u8)>,
    Vec<String>,
)> {
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
                if !is_canvas(pk) && pk != "vbox" && pk != "hbox" {
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
        children, nodes: &nodes, db, list_tables: Vec::new(),
        icon_count, widget: 0, font: None, prims: Vec::new(),
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
                if n.mode() == "fill" {
                    fl.need_fill_pic(&n, &name, false, n.vertical())?;
                } else {
                    fl.need_pic(&n, &name, false)?;
                }
            }
        }
    }
    let mut widgets: Vec<(String, bool)> = Vec::new();
    for &r in &roots {
        let n = &nodes[r];
        let pos = n.pos.with_context(|| {
            format!("ui : racine « {} » : pos = [x, y] requis", n.id)
        })?;
        let size = fl.size_of(r, 0)?;
        // pos counts from the ANCHOR, not from the top-left corner
        let (ax, ay) = anchor_origin(n.anchor.as_deref(), size)
            .with_context(|| format!("ui : racine « {} »", n.id))?;
        let (x, y) = (ax + pos[0], ay + pos[1]);
        // Widgets MAY overlap each other — the engine repaints by z-order.
        // A dialogue window is a different matter: the textbox writes into
        // the same tilemap and is NOT a primitive, so nothing can bring a
        // widget back under it.
        for (name, w) in &all_wins {
            if overlaps((x, y, size[0], size[1]), (w.pos[0], w.pos[1], w.size[0], w.size[1])) {
                bail!(
                    "ui : « {} » chevauche la fenetre {} — les dialogues l'ecraseraient",
                    n.id, name
                );
            }
        }
        fl.widget = widgets.len();
        fl.font = n.font.clone();
        widgets.push((n.id.clone(), n.visible.unwrap_or(false)));
        fl.place(r, x, y, 0, false)?;
    }
    if widgets.len() > 16 {
        bail!("ui : {} widgets (max 16)", widgets.len());
    }
    let prims = fl.prims;
    let pics = fl.pics;
    let mut list_tables = fl.list_tables;
    list_tables.sort();
    list_tables.dedup();

    lay.message = Some(msg);
    lay.choice = Some(chc);
    Ok((lay, prims, widgets, pics, list_tables))
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
    s.push_str(&field("src", &|o| o.src_table as i64));
    s.push_str(&field("srcfilt", &|o| o.src_filter as i64));
    s.push_str(&field("srccnt", &|o| o.src_count as i64));
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
        let _ = write!(s, "static const char ui_ov_l{}[] = {};\n", i, c_string(&p.text));
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
        // 8 plain, 9 sliced, 10 filled: all three carry an image INDEX
        // until the plan turns it into a base char
        if p.kind == 8 || p.kind == 9 || p.kind == 10 {
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
