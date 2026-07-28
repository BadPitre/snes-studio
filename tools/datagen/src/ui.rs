//! ui.rs — « uigen » (Phase 11 v1 + Phase 12 W1, docs/SPEC_SYSTEME_UI.md
//! et docs/PLANNING_SYSTEME_MENUS.md).
//!
//! Lit `<projet>/ui/layout.toml` (positions/tailles EN TILES) :
//!   [message]  pos = [x, y]  size = [w, h]   — fenêtre du dialogue
//!   [choice]   pos/size                       — fenêtre des choix
//!   [[overlay]] — fenêtres/widgets PERMANENTS, placement LIBRE (W1) :
//!     content = "variable_display" : libellé + valeur (var)
//!     content = "gauge"      : barre pleine/demie/vide (var, max ou
//!                              max_var, icon = 1er de 3, dir = h|v)
//!     content = "icon_row"   : icônes répétées façon cœurs Zelda
//!                              (var, max/max_var, icon = 1er de 3)
//!     content = "icon_value" : icône + compteur (var, icon, pad 0-5)
//!     frame = true|false : cadre 9-slice/boîte (défaut : true pour
//!     variable_display, false pour les widgets — style Zelda)
//!
//! Valide tout À LA COMPILATION (bornes écran, chevauchements entre
//! overlays ET contre les fenêtres message/choix, icônes existantes,
//! bornes de contenu — le compilateur refuse l'invalide, règle §9.3)
//! et émet :
//!   - les defines de ui_cfg.h (UI_MSG_*, UI_CHC_*, UI_OV_COUNT)
//!   - ui_overlays.c : tables des widgets (u8 nus + max en 2 tableaux
//!     lo/hi — pas de u16 nu, piège toolchain) + libellés
//!
//! Pas de fichier ui/layout.toml = layout historique (boîte en bas,
//! pleine largeur) — aucun changement de rendu.

use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::fmt::Write as _;
use std::path::Path;

/// Écran SNES en tiles : 32 x 28 (256 x 224)
const SCREEN_W: i64 = 32;
const SCREEN_H: i64 = 28;
const OV_MAX: usize = 8;

#[derive(Deserialize, Default)]
pub struct Layout {
    #[serde(default)]
    pub message: Option<Win>,
    #[serde(default)]
    pub choice: Option<Win>,
    #[serde(default)]
    pub overlay: Vec<Overlay>,
}

#[derive(Deserialize, Clone)]
pub struct Win {
    pub pos: [i64; 2],
    pub size: [i64; 2],
}

#[derive(Deserialize)]
pub struct Overlay {
    #[serde(default)]
    pub id: String,
    pub pos: [i64; 2],
    pub size: [i64; 2],
    pub content: String,
    /// variable 16-bit affichée / mesurée
    #[serde(default)]
    pub var: Option<u8>,
    /// libellé court (ASCII) — variable_display seulement
    #[serde(default)]
    pub label: String,
    /// cadre 9-slice/boîte (défaut : selon le content, cf. framed())
    #[serde(default)]
    pub frame: Option<bool>,
    /// gauge/icon_row : maximum constant (exclusif avec max_var)
    #[serde(default)]
    pub max: Option<u16>,
    /// gauge/icon_row : n° de variable qui porte le maximum
    #[serde(default)]
    pub max_var: Option<u8>,
    /// index dans la planche d'icônes (gauge/icon_row : 1er de 3
    /// consécutives pleine/demie/vide ; icon_value : l'icône seule)
    #[serde(default)]
    pub icon: Option<u8>,
    /// gauge : "h" (défaut) ou "v" (remplie de BAS en haut)
    #[serde(default)]
    pub dir: Option<String>,
    /// icon_value : zéros de tête (072) — 0 = aucun, max 5
    #[serde(default)]
    pub pad: Option<u8>,
}

impl Overlay {
    /// Code du content pour le moteur (ui_ov_type)
    pub fn type_code(&self) -> i64 {
        match self.content.as_str() {
            "gauge" => 1,
            "icon_row" => 2,
            "icon_value" => 3,
            _ => 0, // variable_display
        }
    }

    /// Cadre : explicite, sinon défaut par content (fenêtre pour
    /// variable_display, nu façon Zelda pour les widgets)
    pub fn framed(&self) -> bool {
        self.frame.unwrap_or(self.content == "variable_display")
    }

    /// gauge verticale ?
    pub fn vertical(&self) -> bool {
        self.dir.as_deref() == Some("v")
    }
}

fn check_win(name: &str, w: &Win, min_w: i64, min_h: i64) -> Result<()> {
    let [x, y] = w.pos;
    let [ww, hh] = w.size;
    if x < 0 || y < 0 || ww < min_w || hh < min_h
        || x + ww > SCREEN_W || y + hh > SCREEN_H
    {
        bail!(
            "ui/layout.toml : fenetre {} pos [{},{}] size [{},{}] invalide \
             (ecran 32x28 tiles, minimum {}x{})",
            name, x, y, ww, hh, min_w, min_h
        );
    }
    Ok(())
}

fn overlaps(a_pos: [i64; 2], a_size: [i64; 2], b_pos: [i64; 2], b_size: [i64; 2]) -> bool {
    !(a_pos[0] + a_size[0] <= b_pos[0]
        || b_pos[0] + b_size[0] <= a_pos[0]
        || a_pos[1] + a_size[1] <= b_pos[1]
        || b_pos[1] + b_size[1] <= a_pos[1])
}

/// Charge et valide le layout (défauts historiques sans fichier).
/// `icon_count` = nombre d'icônes de la planche ui.icons (0 = pas de
/// planche) — les widgets à icônes sont refusés sans elle.
pub fn load(proj_dir: &Path, icon_count: usize) -> Result<Layout> {
    let p = proj_dir.join("ui").join("layout.toml");
    let mut lay: Layout = if p.is_file() {
        let src = std::fs::read_to_string(&p)
            .with_context(|| format!("lecture de {}", p.display()))?;
        toml::from_str(&src).with_context(|| format!("ui/layout.toml"))?
    } else {
        Layout::default()
    };
    // défauts = la boîte historique (bas, pleine largeur, 8 rangées)
    let hist = Win { pos: [0, 20], size: [32, 8] };
    let msg = lay.message.clone().unwrap_or_else(|| hist.clone());
    let chc = lay.choice.clone().unwrap_or_else(|| msg.clone());
    // marges du cadre : 2 colonnes de chaque côté, 1 rangée haut/bas
    check_win("message", &msg, 8, 3)?;
    check_win("choice", &chc, 8, 3)?;
    if lay.overlay.len() > OV_MAX {
        bail!("ui/layout.toml : {} overlays (max {})", lay.overlay.len(), OV_MAX);
    }
    for (i, ov) in lay.overlay.iter().enumerate() {
        let w = Win { pos: ov.pos, size: ov.size };
        let f = ov.framed();
        // bornes écran + minimums : cadre = 1 tile de marge tout autour
        let (min_w, min_h) = match (ov.content.as_str(), f) {
            ("variable_display", true) => (4, 3),
            (_, true) => (3, 3),
            ("variable_display", false) => (3, 1),
            ("icon_value", false) => (2, 1),
            _ => (1, 1),
        };
        check_win(&format!("overlay {}", i + 1), &w, min_w, min_h)?;
        let inner_w = ov.size[0] - if f { 2 } else { 0 };
        let need_icons = |base: Option<u8>, span: usize, what: &str| -> Result<()> {
            let b = base.with_context(|| {
                format!("overlay « {} » : {} demande icon = n (planche ui.icons)", ov.id, what)
            })? as usize;
            if icon_count == 0 {
                bail!(
                    "overlay « {} » : {} demande une planche d'icones — \
                     ajouter \"icons\" dans le bloc \"ui\" de project.json \
                     (Gestionnaire de ressources, categorie IconSet)",
                    ov.id, what
                );
            }
            if b + span > icon_count {
                bail!(
                    "overlay « {} » : icon {}..{} hors planche ({} icones)",
                    ov.id, b, b + span - 1, icon_count
                );
            }
            Ok(())
        };
        match ov.content.as_str() {
            "variable_display" => {
                ov.var.with_context(|| {
                    format!("overlay « {} » : variable_display demande var = n", ov.id)
                })?;
                if !ov.label.chars().all(|c| (' '..='~').contains(&c)) {
                    bail!("overlay « {} » : label non-ASCII", ov.id);
                }
                if ov.label.len() as i64 > inner_w - 1 {
                    bail!(
                        "overlay « {} » : label « {} » trop long pour la fenetre \
                         ({} tiles utiles)",
                        ov.id, ov.label, inner_w - 1
                    );
                }
            }
            "gauge" | "icon_row" => {
                ov.var.with_context(|| {
                    format!("overlay « {} » : {} demande var = n", ov.id, ov.content)
                })?;
                match (ov.max, ov.max_var) {
                    (Some(m), None) if m > 0 => {}
                    (None, Some(_)) => {}
                    _ => bail!(
                        "overlay « {} » : {} demande max = n (> 0) OU max_var = n",
                        ov.id, ov.content
                    ),
                }
                // 3 icônes consécutives : pleine, demie, vide
                need_icons(ov.icon, 3, &ov.content)?;
                if ov.content == "icon_row" && ov.vertical() {
                    bail!("overlay « {} » : icon_row est horizontal (dir = h)", ov.id);
                }
                if let Some(d) = &ov.dir {
                    if d != "h" && d != "v" {
                        bail!("overlay « {} » : dir = \"h\" ou \"v\"", ov.id);
                    }
                }
            }
            "icon_value" => {
                ov.var.with_context(|| {
                    format!("overlay « {} » : icon_value demande var = n", ov.id)
                })?;
                need_icons(ov.icon, 1, "icon_value")?;
                let pad = ov.pad.unwrap_or(0) as i64;
                if pad > 5 || pad > inner_w - 1 {
                    bail!(
                        "overlay « {} » : pad {} invalide (max 5, et {} chiffres \
                         tiennent dans la fenetre)",
                        ov.id, pad, inner_w - 1
                    );
                }
            }
            other => bail!(
                "overlay « {} » : content inconnu « {} » (variable_display, \
                 gauge, icon_row, icon_value)",
                ov.id, other
            ),
        }
        for prev in &lay.overlay[..i] {
            if overlaps(ov.pos, ov.size, prev.pos, prev.size) {
                bail!(
                    "ui/layout.toml : overlays « {} » et « {} » se chevauchent",
                    prev.id, ov.id
                );
            }
        }
        // W1 : placement libre, MAIS jamais sous les fenêtres du dialogue
        // (leur bande est effacée/redessinée — un widget dessous serait
        // écrasé pendant chaque dialogue)
        for (name, w) in [("message", &msg), ("choice", &chc)] {
            if overlaps(ov.pos, ov.size, w.pos, w.size) {
                bail!(
                    "ui/layout.toml : l'overlay « {} » chevauche la fenetre {} — \
                     les dialogues l'ecraseraient, le deplacer",
                    ov.id, name
                );
            }
        }
    }
    lay.message = Some(msg);
    lay.choice = Some(chc);
    Ok(lay)
}

/// Defines pour ui_cfg.h (fenêtres message/choix + compteur d'overlays)
pub fn cfg_defines(lay: &Layout) -> String {
    let m = lay.message.as_ref().unwrap();
    let c = lay.choice.as_ref().unwrap();
    // zone shadow de la textbox : l'UNION des rangées message + choix
    // (bande effacée à l'ouverture/fermeture — ui_screen depuis M1)
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
        lay.overlay.len()
    )
}

/// ui_overlays.c : tables des widgets (tableaux u8 nus + max scindé en
/// lo/hi — pas de u16 nu, piège toolchain) + table de pointeurs libellés
pub fn emit_overlays(lay: &Layout) -> String {
    let mut s = String::from(crate::emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    let n = lay.overlay.len().max(1);
    let field = |name: &str, f: &dyn Fn(&Overlay) -> i64| {
        let mut a = format!("const u8 ui_ov_{}[{}] = {{ ", name, n);
        for i in 0..n {
            let v = lay.overlay.get(i).map(f).unwrap_or(0);
            let _ = write!(a, "{}, ", v);
        }
        a.push_str("};\n");
        a
    };
    s.push_str(&field("x", &|o| o.pos[0]));
    s.push_str(&field("y", &|o| o.pos[1]));
    s.push_str(&field("w", &|o| o.size[0]));
    s.push_str(&field("h", &|o| o.size[1]));
    s.push_str(&field("var", &|o| o.var.unwrap_or(0) as i64));
    // W1 : type de content, cadre, icône, direction, pad, maximum
    s.push_str(&field("type", &|o| o.type_code()));
    s.push_str(&field("frame", &|o| o.framed() as i64));
    s.push_str(&field("icon", &|o| o.icon.unwrap_or(0) as i64));
    s.push_str(&field("dir", &|o| o.vertical() as i64));
    s.push_str(&field("pad", &|o| o.pad.unwrap_or(0) as i64));
    // max : 0xFF dans maxvar = constante (lue dans maxlo/maxhi)
    s.push_str(&field("maxvar", &|o| o.max_var.map(|v| v as i64).unwrap_or(0xFF)));
    s.push_str(&field("maxlo", &|o| (o.max.unwrap_or(0) & 0xFF) as i64));
    s.push_str(&field("maxhi", &|o| (o.max.unwrap_or(0) >> 8) as i64));
    for (i, ov) in lay.overlay.iter().enumerate() {
        let _ = write!(s, "static const char ui_ov_l{}[] = {:?};\n", i, ov.label);
    }
    s.push_str(&format!("const char *const ui_ov_label[{}] = {{ ", n));
    for i in 0..n {
        if i < lay.overlay.len() {
            let _ = write!(s, "ui_ov_l{}, ", i);
        } else {
            s.push_str("0, ");
        }
    }
    s.push_str("};\n");
    s
}
