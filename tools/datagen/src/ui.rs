//! ui.rs — « uigen » v1 (Phase 11, docs/SPEC_SYSTEME_UI.md).
//!
//! Lit `<projet>/ui/layout.toml` (positions/tailles EN TILES, §3) :
//!   [message]  pos = [x, y]  size = [w, h]   — fenêtre du dialogue
//!   [choice]   pos/size                       — fenêtre des choix
//!   [[overlay]] id/pos/size/content/var/label — fenêtres permanentes
//!
//! Valide tout À LA COMPILATION (bornes écran, zone overlay = 4 rangées
//! du haut, chevauchements, budgets — le compilateur refuse l'invalide,
//! règle §9.3) et émet :
//!   - les defines de ui_cfg.h (UI_MSG_*, UI_CHC_*, UI_OV_COUNT)
//!   - ui_overlays.c : tables des fenêtres permanentes + libellés
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
/// Zone overlay (§2) : les 4 rangées du HAUT (le bas est aux popups)
const OV_ROWS: i64 = 4;
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
    /// variable_display : variable 16-bit affichée
    #[serde(default)]
    pub var: Option<u8>,
    /// libellé court (ASCII) dessiné avant la valeur
    #[serde(default)]
    pub label: String,
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

/// Charge et valide le layout (défauts historiques sans fichier)
pub fn load(proj_dir: &Path) -> Result<Layout> {
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
        check_win(&format!("overlay {}", i + 1), &w, 4, 3)?;
        if ov.pos[1] + ov.size[1] > OV_ROWS {
            bail!(
                "ui/layout.toml : overlay « {} » sort de la zone overlay \
                 (rangées 0-{} du haut — le bas appartient aux dialogues)",
                ov.id, OV_ROWS - 1
            );
        }
        match ov.content.as_str() {
            "variable_display" => {
                ov.var.with_context(|| {
                    format!("overlay « {} » : variable_display demande var = n", ov.id)
                })?;
            }
            other => bail!(
                "overlay « {} » : content inconnu « {} » (v1 : variable_display)",
                ov.id, other
            ),
        }
        if !ov.label.chars().all(|c| (' '..='~').contains(&c)) {
            bail!("overlay « {} » : label non-ASCII", ov.id);
        }
        if ov.label.len() as i64 > ov.size[0] - 2 {
            bail!(
                "overlay « {} » : label « {} » trop long pour la fenetre \
                 ({} tiles utiles)",
                ov.id, ov.label, ov.size[0] - 2
            );
        }
        for prev in &lay.overlay[..i] {
            let no = ov.pos[0] + ov.size[0] <= prev.pos[0]
                || prev.pos[0] + prev.size[0] <= ov.pos[0]
                || ov.pos[1] + ov.size[1] <= prev.pos[1]
                || prev.pos[1] + prev.size[1] <= ov.pos[1];
            if !no {
                bail!(
                    "ui/layout.toml : overlays « {} » et « {} » se chevauchent",
                    prev.id, ov.id
                );
            }
        }
    }
    // la zone overlay (rangées 0-3) est réservée aux fenêtres permanentes :
    // les popups ne doivent pas y mordre quand des overlays existent
    if !lay.overlay.is_empty() {
        for (name, w) in [("message", &msg), ("choice", &chc)] {
            if w.pos[1] < OV_ROWS {
                bail!(
                    "ui/layout.toml : la fenetre {} (rangée {}) mord sur la zone \
                     overlay (rangées 0-{}) — la descendre, ou retirer les overlays",
                    name, w.pos[1], OV_ROWS - 1
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
    // (un seul buffer WRAM, transfert VBlank d'un bloc)
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

/// ui_overlays.c : tables des fenêtres permanentes (tableaux u8 nus +
/// table de pointeurs de libellés — pas de u16, piège toolchain)
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
