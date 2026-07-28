//! ui.rs — « uigen » (Phase 11 + Phase 12 W1/D1, docs/SPEC_SYSTEME_UI.md
//! et docs/PLANNING_SYSTEME_MENUS.md).
//!
//! Lit `<projet>/ui/layout.toml` (positions/tailles EN TILES) :
//!   [message] / [choice]  pos, size — fenêtres du dialogue
//!
//!   [[node]] — ARBRE de widgets du designer (D1, modèle UMG) :
//!     type = "window"   cadre 9-slice, size explicite, margin=[1,1],
//!                       ses enfants s'empilent verticalement dedans
//!     type = "vbox"     empile ses enfants de haut en bas (gap)
//!     type = "hbox"     aligne ses enfants de gauche à droite (gap)
//!     type = "label"    texte statique (text)
//!     type = "value"    valeur d'une variable (var, width 1-5,
//!                       alignée à droite)
//!     type = "image"    suite d'icônes de la planche (icon, w)
//!     type = "gauge" / "icon_row" / "icon_value" / "variable_display"
//!                       les widgets W1 (mêmes props), size explicite
//!     parent = "id"     rattache à un conteneur ; sans parent = RACINE
//!                       avec pos = [x, y] obligatoire
//!
//!   [[overlay]] — l'ancien format plat (W1) reste accepté : chaque
//!   entrée devient une racine feuille (migration transparente).
//!
//! L'arbre est APLATI à la compilation en PRIMITIVES positionnées en
//! tiles (le moteur ne connaît ni vbox ni hbox — zéro coût runtime) :
//!   0 variable_display  1 gauge  2 icon_row  3 icon_value
//!   4 panel (cadre seul)  5 label (texte statique)  6 image (icônes)
//! Les types 4-6 sont STATIQUES (jamais redessinés sur changement de
//! variable, seulement au refresh).
//!
//! Validation à la compilation (règle §9.3) : ids uniques, parents
//! existants, profondeur bornée, conteneurs non vides, tout tient à
//! l'écran, ≤ 32 primitives, racines sans chevauchement entre elles ni
//! avec message/choice, icônes dans la planche, textes ASCII.

use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::fmt::Write as _;
use std::path::Path;

/// Écran SNES en tiles : 32 x 28 (256 x 224)
const SCREEN_W: i64 = 32;
const SCREEN_H: i64 = 28;
/// Primitives aplaties (tables du moteur) — un panneau Chrono Trigger
/// en consomme une douzaine, 32 laisse de la marge sans gonfler la WRAM
const PRIM_MAX: usize = 32;
const DEPTH_MAX: usize = 6;

#[derive(Deserialize, Default)]
pub struct Layout {
    #[serde(default)]
    pub message: Option<Win>,
    #[serde(default)]
    pub choice: Option<Win>,
    /// ancien format plat (W1) — accepté, converti en racines feuilles
    #[serde(default)]
    pub overlay: Vec<Overlay>,
    /// arbre du designer (D1)
    #[serde(default)]
    pub node: Vec<Node>,
}

#[derive(Deserialize, Clone)]
pub struct Win {
    pub pos: [i64; 2],
    pub size: [i64; 2],
}

/// Ancien overlay plat (W1) — voir la doc du module
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

/// Nœud de l'arbre du designer (D1)
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
    #[serde(default)]
    pub dir: Option<String>,
    #[serde(default)]
    pub pad: Option<u8>, // icon_value : zéros de tête
    /// value : "left" pour coller la valeur à gauche (défaut : droite)
    #[serde(default)]
    pub align: Option<String>,
}

/// Primitive aplatie — ce que le moteur dessine
pub struct Prim {
    pub x: i64,
    pub y: i64,
    pub w: i64,
    pub h: i64,
    pub kind: i64, // 0-6
    pub frame: bool,
    pub var: u8,
    pub icon: u8,
    pub vertical: bool,
    pub pad: u8,
    pub max: u16,
    pub max_var: Option<u8>,
    pub bg: bool, // dans une window : cellules vides = fond du cadre
    pub text: String, // label des types 0 et 5
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

/// Convertit un [[overlay]] W1 en nœud racine équivalent
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
        icon: ov.icon,
        dir: ov.dir.clone(),
        pad: ov.pad,
        align: None,
    }
}

/// Aplatisseur : arbre -> primitives. `icon_count` borne les icônes.
struct Flattener<'a> {
    children: Vec<Vec<usize>>,
    nodes: &'a [Node],
    icon_count: usize,
    prims: Vec<Prim>,
}

impl<'a> Flattener<'a> {
    /// Taille intrinsèque d'un nœud (récursive pour les conteneurs)
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
            "image" => [n.width.unwrap_or(1).max(1), 1],
            "icon_value" => [n.width.unwrap_or(4).max(2), 1],
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

    /// Place un nœud en (x, y) absolu et émet ses primitives
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
                    pad: 0, max: 0, max_var: None, bg: in_window, text: String::new(),
                })?;
                // les enfants s'empilent verticalement dans l'intérieur
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
                    pad: 0, max: 0, max_var: None, bg: in_window, text: t,
                })?;
            }
            "value" => {
                let var = n.var.with_context(|| {
                    format!("nœud « {} » : value demande var = n", n.id)
                })?;
                self.emit(Prim {
                    x, y, w: size[0], h: 1,
                    kind: 0, frame: false, var, icon: 0,
                    // le flag « dir » (inutilisé par le type 0) porte
                    // l'alignement : 1 = valeur collée à GAUCHE
                    vertical: n.align.as_deref() == Some("left"),
                    pad: 0, max: 0, max_var: None, bg: in_window, text: String::new(),
                })?;
            }
            "image" => {
                let icon = self.need_icon(n, size[0], "image")?;
                self.emit(Prim {
                    x, y, w: size[0], h: 1,
                    kind: 6, frame: false, var: 0, icon, vertical: false,
                    pad: 0, max: 0, max_var: None, bg: in_window, text: String::new(),
                })?;
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
                    pad: 0, max: 0, max_var: None, bg: in_window, text: label,
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
                    pad: 0, max, max_var, bg: in_window, text: String::new(),
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
                    pad: pad as u8, max: 0, max_var: None, bg: in_window, text: String::new(),
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
        self.prims.push(p);
        if self.prims.len() > PRIM_MAX {
            bail!("ui : plus de {} primitives à l'écran — simplifier le layout", PRIM_MAX);
        }
        Ok(())
    }
}

/// Charge, valide et APLATIT le layout. Renvoie (fenêtres, primitives).
pub fn load(proj_dir: &Path, icon_count: usize) -> Result<(Layout, Vec<Prim>)> {
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

    // arbre = [[node]] + les [[overlay]] W1 convertis en racines feuilles
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

    let mut fl = Flattener { children, nodes: &nodes, icon_count, prims: Vec::new() };
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
        for (name, w) in [("message", &msg), ("choice", &chc)] {
            if overlaps(rect, (w.pos[0], w.pos[1], w.size[0], w.size[1])) {
                bail!(
                    "ui : « {} » chevauche la fenetre {} — les dialogues l'ecraseraient",
                    n.id, name
                );
            }
        }
        root_rects.push((n.id.clone(), rect));
        fl.place(r, pos[0], pos[1], 0, false)?;
    }
    let prims = fl.prims;

    lay.message = Some(msg);
    lay.choice = Some(chc);
    Ok((lay, prims))
}

/// Defines pour ui_cfg.h (fenêtres message/choix + compteur de prims)
pub fn cfg_defines(lay: &Layout, prims: &[Prim]) -> String {
    let m = lay.message.as_ref().unwrap();
    let c = lay.choice.as_ref().unwrap();
    // zone shadow de la textbox : l'UNION des rangées message + choix
    let top = m.pos[1].min(c.pos[1]);
    let bottom = (m.pos[1] + m.size[1]).max(c.pos[1] + c.size[1]);
    format!(
        "#define UI_MSG_COL {}\n#define UI_MSG_ROW {}\n#define UI_MSG_W {}\n#define UI_MSG_H {}\n\
         #define UI_CHC_COL {}\n#define UI_CHC_ROW {}\n#define UI_CHC_W {}\n#define UI_CHC_H {}\n\
         #define UI_SHADOW_ROW {}\n#define UI_SHADOW_H {}\n\
         #define UI_OV_COUNT {}\n",
        m.pos[0], m.pos[1], m.size[0], m.size[1],
        c.pos[0], c.pos[1], c.size[0], c.size[1],
        top, bottom - top,
        prims.len()
    )
}

/// ui_overlays.c : tables des primitives (u8 nus + max scindé lo/hi) +
/// table de pointeurs des textes (types 0 et 5)
pub fn emit_overlays(prims: &[Prim]) -> String {
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
    s.push_str(&field("maxvar", &|o| o.max_var.map(|v| v as i64).unwrap_or(0xFF)));
    s.push_str(&field("maxlo", &|o| (o.max & 0xFF) as i64));
    s.push_str(&field("maxhi", &|o| (o.max >> 8) as i64));
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
