//! events.rs — compilation des ÉVÉNEMENTS structurés (Event Editor, modèle
//! RPG Maker 2003) vers le pipeline existant : chaque event devient un
//! acteur (npc/trigger/auto) + des lignes d'assembleur VM ajoutées au
//! script de la scène, et ses textes INLINE partent dans texts.json
//! virtuellement (collectés et dédupliqués dans la bank de textes).
//!
//! Le format binaire (spec §1-2) ne change PAS : les events sont un sucre
//! du format SOURCE, contractualisé dans docs/TOOLS.md.
//!
//! Commandes (JSON) :
//!   {"c":"msg","text":"..."}
//!   {"c":"choice","var":"v63"?,"options":[{"text":"Oui","do":[...]},...]}
//!   {"c":"set","var":"g1","value":1}   {"c":"add","var":"v0","value":1}
//!   {"c":"if","var":"g1","op":"=="|"!="|">=","value":1,
//!    "then":[...],"else":[...]}
//!   {"c":"warp","to":"scene","x":1,"y":2}
//!   {"c":"face","event":0,"dir":"down"}
//!   v0.9 (switches + variables 16-bit, façon RM2003) :
//!   {"c":"switch","n":0-511,"on":true|false}
//!   {"c":"var","n":0-255,"op":"="|"+","value":-32768..65535}
//!   {"c":"if_sw","n":..,"on":true|false,"then":[...],"else":[...]}
//!   {"c":"if_var","n":..,"op":"=="|"!="|">=","value":..,
//!    "then":[...],"else":[...]}
//!   v0.15 (boucles + commentaires) :
//!   {"c":"loop","do":[...]}   {"c":"break"}   {"c":"rem","text":"..."}
//!   v0.15 (positions scriptées) :
//!   {"c":"hero_loc","vs":n,"vx":n,"vy":n}   {"c":"warp_var","vs","vx","vy"}
//!   {"c":"setpos","event":-1|n,"from":"const"|"vars","x":..,"y":..}
//!   {"c":"swappos","a":-1|n,"b":-1|n}
//!   v0.15 (effets d'écran) :
//!   {"c":"scr_hide","speed":1-15}   {"c":"scr_show","speed":1-15}
//!   {"c":"ui_show","widget":"nom","on":true|false}   (widget UI, Ph. 12)
//!   {"c":"key_input","var":n,"wait":bool,"keys":[1-12]}  (Key Input RM2003)
//!   {"c":"sysmenu"}   (menu Système — le mapping START en dur est retiré)
//!   {"c":"tint","mode":"off"|"add"|"sub","r":0-31,"g":..,"b":..}
//!   {"c":"flash","r","g","b","frames":1-255}
//!   {"c":"shake","power":0-8,"speed":1-8,"frames":0-255}

use crate::db::Db;
use crate::project::{Actor, CommonEvent, Event, TextEntry};
use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::collections::HashMap;

/// Variable par défaut des CHOICE générés (réservée, documentée TOOLS.md)
const CHOICE_VAR: &str = "v63";
const MAX_DEPTH: usize = 6;

pub struct EventCompiler<'a> {
    texts: &'a mut Vec<TextEntry>,
    /// database du projet (commande db_read) — None si pas de schemas/
    db: Option<&'a Db>,
    /// widgets UI du layout (Phase 12) — noms résolus vers leurs index
    ui_widgets: Vec<String>,
    /// styles de dialogue (S1) — index 0 = défaut, 1.. = dialog_style
    ui_styles: Vec<String>,
    /// pictures du projet (S3) — stems, résolus vers les pic_id
    pictures: Vec<String>,
    /// dimensions (w, h) en pixels de chaque picture (S5 : position)
    pic_dims: Vec<(usize, usize)>,
    /// sons du projet (B1) — stems, résolus vers les sfx_id
    sounds: Vec<String>,
    /// musiques du projet (B1) — stems, résolus vers les music_id
    musics: Vec<String>,
    /// vignettes du projet (B5) — stems, résolus vers les vig_id
    vignettes: Vec<String>,
    /// contenu → nom (dédoublonnage des textes inline, projets entiers)
    text_of: HashMap<String, String>,
    label_seq: usize,
    /// blocs de personnage référencés par des pas gfx: (Move Route) — à
    /// compter dans le sprite set de la scène en cours
    gfx_blocks: Vec<u8>,
    /// pile des labels de fin de boucle (v0.15) — cible des « break »
    loop_ends: Vec<String>,
    /// v0.16 — scène en cours (suffixe des labels de common events)
    cur_scene: String,
    /// v0.16 — common events référencés par la scène en cours (calls +
    /// déclencheurs auto) : leurs corps sont émis dans le bloc scripts
    used_commons: Vec<bool>,
}

impl<'a> EventCompiler<'a> {
    pub fn new(texts: &'a mut Vec<TextEntry>) -> Self {
        let text_of = texts
            .iter()
            .map(|t| (t.text.clone(), t.name.clone()))
            .collect();
        EventCompiler {
            texts,
            db: None,
            ui_widgets: Vec::new(),
            ui_styles: Vec::new(),
            pictures: Vec::new(),
            pic_dims: Vec::new(),
            sounds: Vec::new(),
            musics: Vec::new(),
            vignettes: Vec::new(),
            text_of,
            label_seq: 0,
            gfx_blocks: Vec::new(),
            loop_ends: Vec::new(),
            cur_scene: String::new(),
            used_commons: Vec::new(),
        }
    }

    /// Nom de texte pour un contenu inline (créé au besoin, dédupliqué)
    /// S1 : résout le champ "style" d'un msg/choice vers l'index de
    /// style (0 = défaut, absent ou "")
    fn style_index(&self, cmd: &Value) -> Result<usize> {
        let name = cmd["style"].as_str().unwrap_or("");
        if name.is_empty() {
            return Ok(0);
        }
        self.ui_styles
            .iter()
            .position(|st| st == name)
            .map(|i| i + 1)
            .with_context(|| {
                format!(
                    "style de dialogue « {} » introuvable dans ui/layout.toml (styles : {})",
                    name,
                    if self.ui_styles.is_empty() {
                        "aucun — fenetre UI > Dialogues et choix".to_string()
                    } else {
                        self.ui_styles.join(", ")
                    }
                )
            })
    }

    fn text_name(&mut self, content: &str) -> Result<String> {
        if !content.chars().all(|c| (' '..='~').contains(&c)) {
            bail!("texte « {} » : caractere non-ASCII (accents en v1)", content);
        }
        if let Some(n) = self.text_of.get(content) {
            return Ok(n.clone());
        }
        let name = format!("__e{}", self.texts.len());
        self.texts.push(TextEntry { name: name.clone(), text: content.to_string() });
        self.text_of.insert(content.to_string(), name.clone());
        Ok(name)
    }

    fn label(&mut self, tag: &str) -> String {
        self.label_seq += 1;
        format!("__l{}_{}", self.label_seq, tag)
    }

    fn var_ref(v: &Value, default: &str) -> Result<String> {
        let s = match v {
            Value::Null => default.to_string(),
            Value::String(s) => s.clone(),
            _ => bail!("variable invalide : {}", v),
        };
        let ok = (s.starts_with('v') || s.starts_with('g'))
            && s[1..].parse::<u8>().map(|n| n <= 63).unwrap_or(false);
        if !ok {
            bail!("variable invalide : « {} » (v0-v63 ou g0-g63)", s);
        }
        Ok(s)
    }

    /// S7 — position d'une commande picture : variables (x_var/y_var,
    /// flags bit 1), constantes (validées si les dims sont connues), ou
    /// absente = centrage (précalculé si dims connues — bytecode S5
    /// inchangé — sinon flags bit 2 : le moteur centre avec les dims)
    fn pic_pos(
        cmd: &Value,
        flags: &mut u8,
        dims: Option<(usize, usize)>,
        what: &str,
    ) -> Result<(u8, u8)> {
        let xv = cmd["x_var"].as_u64();
        let yv = cmd["y_var"].as_u64();
        if xv.is_some() || yv.is_some() {
            let (a, b) = match (xv, yv) {
                (Some(a), Some(b)) if a < 256 && b < 256 => (a, b),
                _ => bail!("{} : x_var ET y_var requis ensemble (0-255)", what),
            };
            *flags |= 2;
            return Ok((a as u8, b as u8));
        }
        match (cmd["x"].as_i64(), cmd["y"].as_i64()) {
            (None, None) => match dims {
                Some((w, h)) => Ok((((256 - w) / 2) as u8, ((224 - h) / 2) as u8)),
                None => {
                    *flags |= 4; // centrage RUNTIME (image par variable)
                    Ok((0, 0))
                }
            },
            (x, y) => {
                let x = x.unwrap_or(0);
                let y = y.unwrap_or(0);
                if let Some((w, h)) = dims {
                    if x < 0 || y < 0 || x as usize + w > 256 || y as usize + h > 224 {
                        bail!(
                            "{} : position ({}, {}) hors écran pour une image {}x{} \
                             (0 <= x <= {}, 0 <= y <= {})",
                            what, x, y, w, h, 256 - w, 224 - h
                        );
                    }
                } else if !(0..=255).contains(&x) || !(0..=216).contains(&y) {
                    bail!(
                        "{} : position ({}, {}) hors écran (x 0-255, y 0-216) — \
                         le moteur recale ensuite aux dims réelles de l'image",
                        what, x, y
                    );
                }
                Ok((x as u8, y as u8))
            }
        }
    }

    /// S7 — durée de fondu/glissement en frames (0 = instantané, 60 =
    /// 1 seconde). Héritage S5 : "fade": false => 0 ; défaut : 16.
    fn pic_dur(cmd: &Value) -> Result<u8> {
        if cmd["fade"].as_bool() == Some(false) && cmd["dur"].is_null() {
            return Ok(0);
        }
        match cmd["dur"].as_u64() {
            None => Ok(16),
            Some(d) if d <= 255 => Ok(d as u8),
            Some(d) => bail!("durée de transition invalide : {} (0-255 frames)", d),
        }
    }

    fn idx_field(cmd: &Value, key: &str, max: u64) -> Result<u16> {
        cmd[key]
            .as_u64()
            .filter(|&n| n < max)
            .map(|n| n as u16)
            .with_context(|| format!("champ « {} » invalide (0-{}) : {}", key, max - 1, cmd))
    }

    fn u8_field(cmd: &Value, key: &str) -> Result<u8> {
        cmd[key]
            .as_u64()
            .filter(|&n| n <= 255)
            .map(|n| n as u8)
            .with_context(|| format!("champ « {} » invalide (0-255) : {}", key, cmd))
    }

    /// Pas d'itinéraire JSON → tokens assembleur (partagé entre la
    /// commande route et les routes custom de page, v0.14). Les blocs des
    /// pas gfx sont accumulés pour le budget charsets de la scène.
    fn steps_tokens(steps: &[Value], gfx_blocks: &mut Vec<u8>) -> Result<Vec<String>> {
        if steps.is_empty() || steps.len() > 200 {
            bail!("route : 1 a 200 pas (recu {})", steps.len());
        }
        let mut toks = Vec::new();
        for st in steps {
            let sname = st["s"].as_str().context("pas sans champ s")?;
            toks.push(match sname {
                "down" | "up" | "left" | "right" | "mrand" | "mhero"
                | "mflee" | "fwd" | "tdown" | "tup" | "tleft" | "tright"
                | "t90r" | "t90l" | "t180" | "t90x" | "trand" | "face"
                | "tflee" | "spd+" | "spd-" | "frq+" | "frq-" | "fixon"
                | "fixoff" | "thruon" | "thruoff" => sname.to_string(),
                "wait" => {
                    let n = st["n"].as_u64().filter(|&n| (1..=15).contains(&n))
                        .context("pas wait : n entre 1 et 15 (x8 frames)")?;
                    format!("w{}", n)
                }
                "swon" | "swoff" => {
                    let n = st["n"].as_u64().filter(|&n| n < 512)
                        .context("pas switch : n entre 0 et 511")?;
                    format!("{}:{}", sname, n)
                }
                "gfx" => {
                    let b = st["block"].as_u64().filter(|&b| b < 64)
                        .context("pas gfx : block entre 0 et 63")?;
                    gfx_blocks.push(b as u8);
                    format!("gfx:{}", b)
                }
                other => bail!("pas d'itineraire inconnu : « {} »", other),
            });
        }
        Ok(toks)
    }

    /// Un common event « parallel » tourne en tâche de fond : messages et
    /// choix y sont interdits — transitivement, à travers les appels
    /// (v0.16, pas d'UI hors du script principal).
    fn check_no_ui(commons: &[CommonEvent], root: usize) -> Result<()> {
        fn scan(
            cmds: &[Value],
            commons: &[CommonEvent],
            seen: &mut Vec<bool>,
            root_name: &str,
        ) -> Result<()> {
            for cmd in cmds {
                let sub = |key: &str| -> &[Value] {
                    cmd[key].as_array().map(|v| v.as_slice()).unwrap_or(&[])
                };
                match cmd["c"].as_str().unwrap_or("") {
                    "msg" | "choice" | "sysmenu" => bail!(
                        "common event « {} » (parallel) : les messages et les \
                         choix sont interdits dans un Parallel process (il \
                         tourne en tache de fond, sans dialogue)",
                        root_name
                    ),
                    "loop" => scan(sub("do"), commons, seen, root_name)?,
                    "if" | "if_sw" | "if_var" => {
                        scan(sub("then"), commons, seen, root_name)?;
                        scan(sub("else"), commons, seen, root_name)?;
                    }
                    "call" => {
                        if let Some(n) = cmd["n"].as_u64() {
                            let n = n as usize;
                            if n < commons.len() && !seen[n] {
                                seen[n] = true;
                                scan(&commons[n].commands, commons, seen, root_name)?;
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(())
        }
        let mut seen = vec![false; commons.len()];
        seen[root] = true;
        scan(&commons[root].commands, commons, &mut seen, &commons[root].name)
    }

    /// Compile une liste de commandes en lignes d'assembleur (spec §2)
    fn compile_list(&mut self, cmds: &[Value], depth: usize, out: &mut Vec<String>) -> Result<()> {
        if depth > MAX_DEPTH {
            bail!("imbrication de commandes trop profonde (max {})", MAX_DEPTH);
        }
        for cmd in cmds {
            let c = cmd["c"].as_str().with_context(|| format!("commande sans champ c : {}", cmd))?;
            match c {
                "msg" => {
                    // S1 : chaque message choisit sa boîte (défaut = style
                    // 0). SANS styles au projet, rien n'est émis — le
                    // bytecode des projets existants reste byte-identique
                    // (le +1 opcode décalait la machine à écrire d'une
                    // frame). Avec styles, le reset à 0 est toujours émis.
                    if !self.ui_styles.is_empty() {
                        out.push(format!("  DLGSTYLE {}", self.style_index(cmd)?));
                    } else {
                        self.style_index(cmd)?; /* valide quand même le champ */
                    }
                    let t = cmd["text"].as_str().context("msg sans texte")?;
                    let name = self.text_name(t)?;
                    out.push(format!("  MSG {}", name));
                }
                "choice" => {
                    if !self.ui_styles.is_empty() {
                        out.push(format!("  DLGSTYLE {}", self.style_index(cmd)?));
                    } else {
                        self.style_index(cmd)?;
                    }
                    let var = Self::var_ref(&cmd["var"], CHOICE_VAR)?;
                    let opts = cmd["options"].as_array().context("choice sans options")?;
                    if opts.len() < 2 || opts.len() > 4 {
                        bail!("choice : 2 a 4 options (recu {})", opts.len());
                    }
                    let mut names = Vec::new();
                    for o in opts {
                        let t = o["text"].as_str().context("option sans texte")?;
                        names.push(self.text_name(t)?);
                    }
                    let end = self.label("finchoix");
                    let branch: Vec<String> =
                        (1..opts.len()).map(|i| self.label(&format!("opt{}", i))).collect();
                    out.push(format!("  CHOICE {} {}", var, names.join(" ")));
                    for (i, lbl) in branch.iter().enumerate() {
                        out.push(format!("  JEQ {} {} {}", var, i + 1, lbl));
                    }
                    // option 0 en séquence
                    self.compile_list(
                        opts[0]["do"].as_array().map(|v| v.as_slice()).unwrap_or(&[]),
                        depth + 1,
                        out,
                    )?;
                    out.push(format!("  JMP {}", end));
                    for (i, lbl) in branch.iter().enumerate() {
                        out.push(format!("{}:", lbl));
                        self.compile_list(
                            opts[i + 1]["do"].as_array().map(|v| v.as_slice()).unwrap_or(&[]),
                            depth + 1,
                            out,
                        )?;
                        if i + 1 < branch.len() {
                            out.push(format!("  JMP {}", end));
                        }
                    }
                    out.push(format!("{}:", end));
                }
                "set" | "add" => {
                    let var = Self::var_ref(&cmd["var"], "")?;
                    let val = Self::u8_field(cmd, "value")?;
                    out.push(format!(
                        "  {} {} {}",
                        if c == "set" { "SETVAR" } else { "ADDVAR" },
                        var,
                        val
                    ));
                }
                "if" => {
                    let var = Self::var_ref(&cmd["var"], "")?;
                    let val = Self::u8_field(cmd, "value")?;
                    let opc = match cmd["op"].as_str().unwrap_or("==") {
                        "==" => "JEQ",
                        "!=" => "JNE",
                        ">=" => "JGEQ",
                        other => bail!("if : operateur inconnu « {} » (==, !=, >=)", other),
                    };
                    let then_l = self.label("alors");
                    let end = self.label("finsi");
                    out.push(format!("  {} {} {} {}", opc, var, val, then_l));
                    self.compile_list(
                        cmd["else"].as_array().map(|v| v.as_slice()).unwrap_or(&[]),
                        depth + 1,
                        out,
                    )?;
                    out.push(format!("  JMP {}", end));
                    out.push(format!("{}:", then_l));
                    self.compile_list(
                        cmd["then"].as_array().map(|v| v.as_slice()).unwrap_or(&[]),
                        depth + 1,
                        out,
                    )?;
                    out.push(format!("{}:", end));
                }
                "switch" => {
                    let n = Self::idx_field(cmd, "n", 512)?;
                    let on = cmd["on"].as_bool().context("switch sans champ on")?;
                    out.push(format!("  SW {} {}", n, if on { 1 } else { 0 }));
                }
                "var" => {
                    // v0.13 : arithmétique complète, aléatoire, sources
                    // (constante, variable, X/Y héros, timer)
                    let n = Self::idx_field(cmd, "n", 256)?;
                    let op = cmd["op"].as_str().unwrap_or("=");
                    if !["=", "+", "-", "*", "/", "%", "rand"].contains(&op) {
                        bail!("var : operation inconnue « {} »", op);
                    }
                    let from = cmd["from"].as_str().unwrap_or("const");
                    let st = match from {
                        "const" => "const",
                        "var" => "var",
                        "hero_x" => "hx",
                        "hero_y" => "hy",
                        "timer" => "timer",
                        "scene" => "scene",
                        o => bail!("var : source inconnue « {} »", o),
                    };
                    let val = cmd["value"]
                        .as_i64()
                        .filter(|v| (-32768..=65535).contains(v))
                        .unwrap_or(0);
                    // les vieux set/add 16-bit passent aussi par VAROP
                    out.push(format!("  VAROP {} {} {} {}", n, op, st, val));
                }
                "timer" => {
                    let op = match cmd["op"].as_str().unwrap_or("start") {
                        "start" => "start",
                        "stop" => "stop",
                        "show" => "show",
                        "hide" => "hide",
                        o => bail!("timer : operation inconnue « {} »", o),
                    };
                    let secs = cmd["secs"].as_u64().filter(|&v| v <= 5999).unwrap_or(0);
                    out.push(format!("  TIMER {} {}", op, secs));
                }
                "campan" => {
                    let speed = cmd["speed"].as_u64().filter(|&v| (1..=8).contains(&v)).unwrap_or(2);
                    out.push(format!(
                        "  CAMPAN {} {} {}",
                        Self::u8_field(cmd, "x")?,
                        Self::u8_field(cmd, "y")?,
                        speed
                    ));
                }
                "cam_return" => {
                    let speed = cmd["speed"].as_u64().filter(|&v| (1..=8).contains(&v)).unwrap_or(2);
                    out.push(format!("  CAMRET {}", speed));
                }
                "wait_cam" => {
                    out.push("  WAITCAM".to_string());
                }
                // v0.15 — effets d'écran
                "scr_hide" | "scr_show" => {
                    let speed = cmd["speed"].as_u64().filter(|&v| (1..=15).contains(&v)).unwrap_or(1);
                    out.push(format!(
                        "  {} {}",
                        if c == "scr_hide" { "SCRHIDE" } else { "SCRSHOW" },
                        speed
                    ));
                }
                // Phase 12 — visibilité des widgets UI (SHOWUI)
                "ui_show" => {
                    let name = cmd["widget"].as_str().unwrap_or("");
                    let idx = self
                        .ui_widgets
                        .iter()
                        .position(|w| w == name)
                        .with_context(|| {
                            format!(
                                "ui_show : widget « {} » introuvable dans ui/layout.toml                                  (widgets : {})",
                                name,
                                if self.ui_widgets.is_empty() {
                                    "aucun".to_string()
                                } else {
                                    self.ui_widgets.join(", ")
                                }
                            )
                        })?;
                    let on = cmd["on"].as_bool().unwrap_or(true);
                    out.push(format!("  SHOWUI {} {}", idx, on as u8));
                }
                // S3 — pictures plein écran (façon RM2003) : nom résolu
                // vers le pic_id de project.pictures
                "pic_show" => {
                    // S7 : image de la liste OU numéro lu dans une variable
                    let mut flags: u8 = 0;
                    let (id, dims) = match cmd["pic_var"].as_u64() {
                        Some(v) => {
                            if v > 255 {
                                bail!("pic_show : pic_var = 0-255");
                            }
                            flags |= 1;
                            (v as usize, None)
                        }
                        None => {
                            let name = cmd["pic"].as_str().unwrap_or("");
                            let idx = self
                                .pictures
                                .iter()
                                .position(|p| p == name)
                                .with_context(|| {
                                    format!(
                                        "pic_show : image « {} » introuvable dans \
                                         project.pictures (images : {})",
                                        name,
                                        if self.pictures.is_empty() {
                                            "aucune — Gestionnaire de ressources > Picture"
                                                .to_string()
                                        } else {
                                            self.pictures.join(", ")
                                        }
                                    )
                                })?;
                            (idx, Some(self.pic_dims[idx]))
                        }
                    };
                    let (x, y) = Self::pic_pos(cmd, &mut flags, dims, "pic_show")?;
                    // S8 : mélange color math avec le décor (flags bits 3-4)
                    flags |= match cmd["blend"].as_str() {
                        None => 0,
                        Some("half") => 1 << 3,
                        Some("add") => 2 << 3,
                        Some("sub") => 3 << 3,
                        Some(o) => bail!(
                            "pic_show : blend inconnu « {} » (half, add ou sub)",
                            o
                        ),
                    };
                    let dur = Self::pic_dur(cmd)?;
                    out.push(format!("  SHOWPIC {} {} {} {} {}", id, x, y, flags, dur));
                }
                "pic_hide" => {
                    out.push(format!("  HIDEPIC {}", Self::pic_dur(cmd)?));
                }
                // S7 — glisse l'image affichée (Move Picture RM2003) vers
                // (x,y) en dur frames : NON-bloquant, le script continue
                "pic_move" => {
                    let mut flags: u8 = 0;
                    let (x, y) = Self::pic_pos(cmd, &mut flags, None, "pic_move")?;
                    let dur = Self::pic_dur(cmd)?;
                    out.push(format!("  MOVEPIC {} {} {} {}", x, y, flags, dur));
                }
                // Phase 12 — Key Input Processing (RM2003) : le code de la
                // touche pressée dans une variable (0 = aucune)
                "key_input" => {
                    let var = cmd["var"].as_u64().filter(|&v| v < 256).with_context(|| {
                        "key_input : var = 0-255 requis".to_string()
                    })?;
                    let wait = cmd["wait"].as_bool().unwrap_or(true);
                    let mut mask: u16 = 0;
                    let keys = cmd["keys"].as_array().map(|v| v.as_slice()).unwrap_or(&[]);
                    if keys.is_empty() {
                        bail!("key_input : keys = [codes 1-12] (au moins une touche)");
                    }
                    for k in keys {
                        let code = k.as_u64().filter(|&c| (1..=12).contains(&c))
                            .with_context(|| {
                                format!("key_input : code de touche invalide « {} » (1-12)", k)
                            })?;
                        mask |= 1u16 << code;
                    }
                    out.push(format!(
                        "  KEYIN {} {} {} {}",
                        wait as u8, mask & 0xFF, mask >> 8, var
                    ));
                }
                "sysmenu" => {
                    out.push("  SYSMENU".to_string());
                }
                "tint" => {
                    let mode = match cmd["mode"].as_str().unwrap_or("off") {
                        "off" => "off",
                        "add" => "add",
                        "sub" => "sub",
                        o => bail!("tint : mode inconnu « {} » (off, add, sub)", o),
                    };
                    let comp = |key: &str| -> u64 {
                        cmd[key].as_u64().map(|v| v.min(31)).unwrap_or(0)
                    };
                    // S12 : "dur" en frames = teinte GRADUELLE (TINTG) ;
                    // absent ou 0 = TINT immédiat (bytecode inchangé)
                    match cmd["dur"].as_u64() {
                        Some(d) if d > 0 => {
                            if d > 255 {
                                bail!("tint : durée invalide {} (1-255 frames)", d);
                            }
                            out.push(format!(
                                "  TINTG {} {} {} {} {}",
                                mode, comp("r"), comp("g"), comp("b"), d
                            ));
                        }
                        _ => out.push(format!(
                            "  TINT {} {} {} {}",
                            mode, comp("r"), comp("g"), comp("b")
                        )),
                    }
                }
                // B3 — écran composé : fond + images posées multi-slots
                "stage_open" => {
                    let dur = cmd["dur"].as_u64().filter(|&v| v <= 255).unwrap_or(20);
                    let pic = cmd["pic"].as_str().unwrap_or("");
                    let id = if pic.is_empty() {
                        255
                    } else {
                        self.pictures
                            .iter()
                            .position(|p| p == pic)
                            .with_context(|| {
                                format!(
                                    "stage_open : image '{}' introuvable \
                                     (supprimée ou renommée ?)",
                                    pic
                                )
                            })? as u64
                    };
                    out.push(format!("  STAGEOPEN {} {}", id, dur));
                }
                "stage_pose" => {
                    let slot = cmd["slot"]
                        .as_u64()
                        .filter(|&v| (1..=5).contains(&v))
                        .with_context(|| "stage_pose : slot 1-5".to_string())?;
                    let pic = cmd["pic"].as_str().unwrap_or("");
                    let id = self
                        .pictures
                        .iter()
                        .position(|p| p == pic)
                        .with_context(|| {
                            format!(
                                "stage_pose : image '{}' introuvable \
                                 (supprimée ou renommée ?)",
                                pic
                            )
                        })?;
                    // position en PIXELS côté auteur, en TILES (x8) au
                    // format binaire — arrondie à la tile
                    let tx = cmd["x"].as_u64().filter(|&v| v <= 255).unwrap_or(0) / 8;
                    let ty = cmd["y"].as_u64().filter(|&v| v <= 216).unwrap_or(0) / 8;
                    out.push(format!(
                        "  STAGEPOSE {} {} {} {}",
                        slot - 1, id, tx, ty
                    ));
                }
                "stage_clear" => {
                    let slot = cmd["slot"]
                        .as_u64()
                        .filter(|&v| (1..=5).contains(&v))
                        .with_context(|| "stage_clear : slot 1-5".to_string())?;
                    out.push(format!("  STAGECLEAR {}", slot - 1));
                }
                // B5 — vignettes animées (sprites 32x32, 2 slots)
                "vig_show" => {
                    let slot = cmd["slot"]
                        .as_u64()
                        .filter(|&v| (1..=2).contains(&v))
                        .with_context(|| "vig_show : slot 1-2".to_string())?;
                    let name = cmd["vig"].as_str().unwrap_or("");
                    let id = self
                        .vignettes
                        .iter()
                        .position(|v| v == name)
                        .with_context(|| {
                            format!(
                                "vig_show : vignette '{}' introuvable \
                                 (supprimée ou renommée ?)",
                                name
                            )
                        })?;
                    let anchor = match cmd["anchor"].as_str().unwrap_or("screen") {
                        "hero" => 1u8,
                        _ => 0,
                    };
                    let x = cmd["x"].as_i64().filter(|&v| (-128..=255).contains(&v)).unwrap_or(0);
                    let y = cmd["y"].as_i64().filter(|&v| (-128..=255).contains(&v)).unwrap_or(0);
                    out.push(format!(
                        "  VIGSHOW {} {} {} {} {}",
                        slot - 1, id, (x as u8) as u8, (y as u8) as u8, anchor
                    ));
                }
                "vig_play" => {
                    let slot = cmd["slot"]
                        .as_u64()
                        .filter(|&v| (1..=2).contains(&v))
                        .with_context(|| "vig_play : slot 1-2".to_string())?;
                    let mode = match cmd["mode"].as_str().unwrap_or("loop") {
                        "once" => 1u8,
                        "stop" => 0,
                        _ => 2, // loop
                    };
                    let spd = cmd["speed"].as_u64().filter(|&v| (1..=60).contains(&v)).unwrap_or(8);
                    out.push(format!("  VIGPLAY {} {} {}", slot - 1, mode, spd));
                }
                "vig_hide" => {
                    let slot = cmd["slot"]
                        .as_u64()
                        .filter(|&v| (1..=2).contains(&v))
                        .with_context(|| "vig_hide : slot 1-2".to_string())?;
                    out.push(format!("  VIGHIDE {}", slot - 1));
                }
                "slot_fx" => {
                    let slot = cmd["slot"]
                        .as_u64()
                        .filter(|&v| (1..=5).contains(&v))
                        .with_context(|| "slot_fx : slot 1-5".to_string())?;
                    let fx = match cmd["fx"].as_str().unwrap_or("restore") {
                        "flash" => 1u8,
                        "fadeout" => 2,
                        "dark" => 3,
                        _ => 0, // restore
                    };
                    let dur = cmd["frames"].as_u64().filter(|&v| v <= 255).unwrap_or(0);
                    out.push(format!("  SLOTFX {} {} {}", slot - 1, fx, dur));
                }
                "stage_close" => {
                    let dur = cmd["dur"].as_u64().filter(|&v| v <= 255).unwrap_or(20);
                    out.push(format!("  STAGECLOSE {}", dur));
                }
                // B1 — jouer un son (effet BRR, non bloquant)
                "sfx" => {
                    let name = cmd["sound"].as_str().unwrap_or("");
                    let id = self
                        .sounds
                        .iter()
                        .position(|s| s == name)
                        .with_context(|| {
                            format!(
                                "commande sfx : son '{}' introuvable dans le \
                                 projet (supprimé ou renommé ?)",
                                name
                            )
                        })?;
                    out.push(format!("  PLAYSFX {}", id));
                }
                // B1 — changer la musique ("" = silence), non bloquant,
                // la musique de la scène reprend au prochain warp
                "bgm" => {
                    let name = cmd["music"].as_str().unwrap_or("");
                    if name.is_empty() {
                        out.push("  PLAYBGM 255".to_string());
                    } else {
                        let id = self
                            .musics
                            .iter()
                            .position(|s| s == name)
                            .with_context(|| {
                                format!(
                                    "commande bgm : musique '{}' introuvable \
                                     dans le projet (supprimée ou renommée ?)",
                                    name
                                )
                            })?;
                        out.push(format!("  PLAYBGM {}", id));
                    }
                }
                // S16 — spotlight : cercle de lumiere autour du heros
                "spotlight" => {
                    let rad = cmd["radius"]
                        .as_u64()
                        .filter(|&v| v == 0 || (16..=96).contains(&v))
                        .unwrap_or(0);
                    let dark = cmd["dark"].as_u64().filter(|&v| (1..=31).contains(&v)).unwrap_or(31);
                    out.push(format!("  SPOTLIGHT {} {}", rad, dark));
                }
                // S15 — degrade de ciel : teinte verticale haut -> bas
                "skygrad" => {
                    let mode = match cmd["mode"].as_str().unwrap_or("off") {
                        "add" => "add",
                        "sub" => "sub",
                        _ => "off",
                    };
                    let ch = |k: &str| cmd[k].as_u64().filter(|&v| v <= 31).unwrap_or(0);
                    out.push(format!(
                        "  SKYGRAD {} {} {} {} {} {} {}",
                        mode, ch("r"), ch("g"), ch("b"), ch("r2"), ch("g2"), ch("b2")
                    ));
                }
                // S14 — ondulation de l'écran (HDMA) : power 0 = stop
                "wave" => {
                    let pow = cmd["power"].as_u64().filter(|&v| v <= 7).unwrap_or(0);
                    let spd = cmd["speed"].as_u64().filter(|&v| (1..=8).contains(&v)).unwrap_or(2);
                    out.push(format!("  WAVE {} {}", pow, spd));
                }
                // S13 — météo en particules (Weather Effects RM2003) :
                // persiste entre les scènes jusqu'au prochain changement
                "weather" => {
                    let kind = match cmd["kind"].as_str().unwrap_or("off") {
                        "off" => 0u8,
                        "rain" => 1,
                        "snow" => 2,
                        o => bail!("weather : type inconnu « {} » (off, rain, snow)", o),
                    };
                    let pow = cmd["power"].as_u64().filter(|&v| (1..=3).contains(&v)).unwrap_or(2);
                    out.push(format!("  WEATHER {} {}", kind, pow));
                }
                "flash" => {
                    let comp = |key: &str| -> u64 {
                        cmd[key].as_u64().map(|v| v.min(31)).unwrap_or(31)
                    };
                    let frames = cmd["frames"].as_u64().filter(|&v| (1..=255).contains(&v)).unwrap_or(8);
                    out.push(format!(
                        "  FLASH {} {} {} {}",
                        comp("r"), comp("g"), comp("b"), frames
                    ));
                }
                "shake" => {
                    let power = cmd["power"].as_u64().filter(|&v| v <= 8).unwrap_or(4);
                    let speed = cmd["speed"].as_u64().filter(|&v| (1..=8).contains(&v)).unwrap_or(2);
                    let frames = cmd["frames"].as_u64().filter(|&v| v <= 255).unwrap_or(30);
                    out.push(format!("  SHAKE {} {} {}", power, speed, frames));
                }
                "if_sw" | "if_var" => {
                    let then_l = self.label("alors");
                    let end = self.label("finsi");
                    if c == "if_sw" {
                        let n = Self::idx_field(cmd, "n", 512)?;
                        let on = cmd["on"].as_bool().unwrap_or(true);
                        out.push(format!("  JSW {} {} {}", n, if on { 1 } else { 0 }, then_l));
                    } else {
                        let n = Self::idx_field(cmd, "n", 256)?;
                        let val = cmd["value"]
                            .as_u64()
                            .filter(|&v| v <= 65535)
                            .with_context(|| format!("if_var : valeur invalide : {}", cmd))?;
                        let ops = match cmd["op"].as_str().unwrap_or("==") {
                            "==" => "==",
                            "!=" => "!=",
                            ">=" => ">=",
                            o => bail!("if_var : operateur inconnu « {} » (==, !=, >=)", o),
                        };
                        out.push(format!("  JCMP16 {} {} {} {}", n, ops, val, then_l));
                    }
                    self.compile_list(
                        cmd["else"].as_array().map(|v| v.as_slice()).unwrap_or(&[]),
                        depth + 1,
                        out,
                    )?;
                    out.push(format!("  JMP {}", end));
                    out.push(format!("{}:", then_l));
                    self.compile_list(
                        cmd["then"].as_array().map(|v| v.as_slice()).unwrap_or(&[]),
                        depth + 1,
                        out,
                    )?;
                    out.push(format!("{}:", end));
                }
                "wait" => {
                    let n = Self::u8_field(cmd, "frames")?;
                    out.push(format!("  WAIT {}", n));
                }
                // v0.15 — boucle RM2003 : label de tête, corps, saut de
                // reprise ; « break » saute au label de fin de la boucle
                // la plus proche. Une boucle sans commande bloquante tourne
                // 32 ops/frame (la VM rend la main, spec §2).
                "loop" => {
                    let start = self.label("boucle");
                    let end = self.label("finboucle");
                    out.push(format!("{}:", start));
                    self.loop_ends.push(end.clone());
                    let r = self.compile_list(
                        cmd["do"].as_array().map(|v| v.as_slice()).unwrap_or(&[]),
                        depth + 1,
                        out,
                    );
                    self.loop_ends.pop();
                    r?;
                    out.push(format!("  JMP {}", start));
                    out.push(format!("{}:", end));
                }
                "break" => {
                    let end = self
                        .loop_ends
                        .last()
                        .context("« Sortir de la boucle » hors d'une boucle")?;
                    out.push(format!("  JMP {}", end));
                }
                // v0.15 — commentaire : décoratif dans l'éditeur, aucun
                // bytecode émis
                "rem" => {}
                // v0.17 — lire un champ de la database dans une variable :
                // {"c":"db_read","table":"stats","from":"const"|"var",
                //  "entry":"slime"|<n° de variable>,"field":"attack","dst":n}
                "db_read" => {
                    let dbr = self.db.with_context(|| {
                        "db_read : le projet n'a pas de database (schemas/)".to_string()
                    })?;
                    let table = cmd["table"].as_str().context("db_read sans table")?;
                    let ti = dbr.table_id(table).with_context(|| {
                        format!("db_read : table inconnue « {} »", table)
                    })?;
                    let field = cmd["field"].as_str().context("db_read sans field")?;
                    let (ofs, size) = dbr.field_info(ti, field).with_context(|| {
                        format!("db_read : champ « {} » absent de {}", field, table)
                    })?;
                    if ofs > 255 {
                        bail!("db_read : offset du champ « {} » > 255", field);
                    }
                    let dst = Self::idx_field(cmd, "dst", 256)?;
                    let (esrc, entry) = match cmd["from"].as_str().unwrap_or("const") {
                        "const" => {
                            let id = cmd["entry"].as_str().with_context(|| {
                                format!("db_read : entry (id symbolique de {})", table)
                            })?;
                            let idx = dbr.entry_index(ti, id).with_context(|| {
                                format!("db_read : « {} » absent de la table {}", id, table)
                            })?;
                            (0, idx as u64)
                        }
                        "var" => (
                            1,
                            cmd["entry"].as_u64().filter(|&n| n < 256).with_context(|| {
                                format!("db_read : entry = n° de variable (0-255) : {}", cmd)
                            })?,
                        ),
                        o => bail!("db_read : source inconnue « {} » (const, var)", o),
                    };
                    out.push(format!(
                        "  DBREAD {} {} {} {} {} {}",
                        ti, esrc, entry, ofs, size, dst
                    ));
                }
                // v0.16 — appel d'un common event (CALL/RET, pile de 8)
                "call" => {
                    let n = cmd["n"]
                        .as_u64()
                        .filter(|&n| (n as usize) < self.used_commons.len())
                        .with_context(|| {
                            format!(
                                "call : common event inexistant ({} definis) : {}",
                                self.used_commons.len(),
                                cmd
                            )
                        })? as usize;
                    self.used_commons[n] = true;
                    out.push(format!("  CALL __ce{}_{}", n, self.cur_scene));
                }
                "wait_route" => {
                    out.push("  WAITROUTE".to_string());
                }
                "route" => {
                    // {"c":"route","event":-1|n,"repeat":b,"skip":b,
                    //  "steps":[{"s":"up"}|{"s":"wait","n":2}...]}
                    // event -1 = « cet event » — résolu par compile_scene
                    // via self_actor (index d'entrée de la page en cours).
                    let target = match cmd["event"].as_i64() {
                        None | Some(-1) => "self".to_string(),
                        Some(n) if (0..24).contains(&n) => n.to_string(),
                        Some(n) => bail!("route : event {} hors limite (0-23)", n),
                    };
                    let steps = cmd["steps"].as_array().context("route sans steps")?;
                    let toks = Self::steps_tokens(steps, &mut self.gfx_blocks)?;
                    if steps.is_empty() || steps.len() > 200 {
                        bail!("route : 1 a 200 pas (recu {})", steps.len());
                    }
                    let freq = cmd["freq"].as_u64().filter(|&f| (1..=8).contains(&f)).unwrap_or(3);
                    out.push(format!(
                        "  ROUTE {} {} {} {} {}",
                        target,
                        if cmd["repeat"].as_bool().unwrap_or(false) { 1 } else { 0 },
                        if cmd["skip"].as_bool().unwrap_or(false) { 1 } else { 0 },
                        freq,
                        toks.join(" ")
                    ));
                }
                // v0.15 — positions scriptées (mémoriser/rappeler RM2003)
                "hero_loc" => {
                    // écrit scène/X/Y du héros dans trois variables 16-bit
                    let vs = Self::idx_field(cmd, "vs", 256)?;
                    let vx = Self::idx_field(cmd, "vx", 256)?;
                    let vy = Self::idx_field(cmd, "vy", 256)?;
                    out.push(format!("  VAROP {} = scene 0", vs));
                    out.push(format!("  VAROP {} = hx 0", vx));
                    out.push(format!("  VAROP {} = hy 0", vy));
                }
                "warp_var" => {
                    let vs = Self::idx_field(cmd, "vs", 256)?;
                    let vx = Self::idx_field(cmd, "vx", 256)?;
                    let vy = Self::idx_field(cmd, "vy", 256)?;
                    out.push(format!("  WARPV {} {} {}", vs, vx, vy));
                }
                "setpos" => {
                    let target = match cmd["event"].as_i64() {
                        None | Some(-1) => "self".to_string(),
                        Some(n) if (0..24).contains(&n) => n.to_string(),
                        Some(n) => bail!("setpos : event {} hors limite (0-23)", n),
                    };
                    let src = match cmd["from"].as_str().unwrap_or("const") {
                        "const" => "c",
                        "vars" => "v",
                        o => bail!("setpos : source inconnue « {} » (const, vars)", o),
                    };
                    out.push(format!(
                        "  SETPOS {} {} {} {}",
                        target,
                        src,
                        Self::u8_field(cmd, "x")?,
                        Self::u8_field(cmd, "y")?
                    ));
                }
                "swappos" => {
                    let ev = |key: &str| -> Result<String> {
                        Ok(match cmd[key].as_i64() {
                            None | Some(-1) => "self".to_string(),
                            Some(n) if (0..24).contains(&n) => n.to_string(),
                            Some(n) => bail!("swappos : event {} hors limite (0-23)", n),
                        })
                    };
                    out.push(format!("  SWAPPOS {} {}", ev("a")?, ev("b")?));
                }
                "warp" => {
                    let to = cmd["to"].as_str().context("warp sans scene cible")?;
                    out.push(format!(
                        "  WARP {} {} {}",
                        to,
                        Self::u8_field(cmd, "x")?,
                        Self::u8_field(cmd, "y")?
                    ));
                }
                "face" => {
                    let dir = cmd["dir"].as_str().context("face sans direction")?;
                    out.push(format!("  FACE {} {}", Self::u8_field(cmd, "event")?, dir));
                }
                other => bail!("commande inconnue : « {} »", other),
            }
        }
        Ok(())
    }

    /// Compile les events d'une scène : lignes d'asm à AJOUTER au script et
    /// acteurs à AJOUTER à la table (le binaire reste le format v0.10).
    /// v0.10 : un event = 1..N PAGES — chaque page devient une entrée acteur
    /// consécutive (flag CONT sur les pages 2+) avec sa condition, son
    /// apparence, son déclencheur et son bytecode. Un event sans "pages"
    /// = une page implicite formée de ses champs directs.
    /// v0.16 : renvoie AUSSI la ligne CETAB (table des common events auto)
    /// que l'appelant doit placer en PREMIÈRE ligne du script assemblé —
    /// le moteur lit cette table à l'offset 0 du bloc scripts.
    pub fn compile_scene(
        &mut self,
        scene_name: &str,
        events: &[Event],
        commons: &[CommonEvent],
        db: Option<&'a Db>,
        ui_widgets: &[String],
        ui_styles: &[String],
        pictures: &[String],
        pic_dims: &[(usize, usize)],
        sounds: &[String],
        musics: &[String],
        vignettes: &[String],
    ) -> Result<(Vec<String>, Vec<Actor>, Vec<u8>, String)> {
        let mut asm = Vec::new();
        let mut actors = Vec::new();
        let mut tail = Vec::new(); /* blobs de routes custom (v0.14) */
        self.gfx_blocks.clear();
        self.cur_scene = scene_name.to_string();
        self.used_commons = vec![false; commons.len()];
        self.db = db;
        self.ui_widgets = ui_widgets.to_vec();
        self.ui_styles = ui_styles.to_vec();
        self.pictures = pictures.to_vec();
        self.pic_dims = pic_dims.to_vec();
        self.sounds = sounds.to_vec();
        self.musics = musics.to_vec();
        self.vignettes = vignettes.to_vec();
        for (i, ev) in events.iter().enumerate() {
            // Vue « pages » uniforme : (condition, trigger, sprite, dir,
            // entry, commands) par page
            #[allow(clippy::type_complexity)]
            let pages: Vec<(&Option<Value>, &str, i16, &str, &Option<String>, &[Value], &Option<String>, &Option<Value>, &Option<String>, u8)> =
                if ev.pages.is_empty() {
                    vec![(&None, ev.trigger.as_str(), ev.sprite, ev.dir.as_str(),
                          &ev.entry, ev.commands.as_slice(), &ev.r#move,
                          &ev.move_route, &ev.priority, ev.speed.unwrap_or(0))]
                } else {
                    ev.pages
                        .iter()
                        .map(|p| (&p.condition, p.trigger.as_str(), p.sprite,
                                  p.dir.as_str(), &p.entry, p.commands.as_slice(),
                                  &p.r#move, &p.move_route, &p.priority,
                                  p.speed.unwrap_or(0)))
                        .collect()
                };
            for (k, (cond, trigger, sprite, dir, entry_lbl, commands, mv, mroute, prio, speed)) in
                pages.iter().enumerate()
            {
                let kind = match *trigger {
                    "action" => "npc",
                    "touch" => "trigger",
                    "auto" => "auto",
                    other => bail!(
                        "scene '{}', event « {} » page {} : declencheur inconnu « {} » \
                         (action, touch, auto)",
                        scene_name, ev.name, k + 1, other
                    ),
                };
                if kind == "npc" && *sprite < 0 {
                    bail!(
                        "scene '{}', event « {} » page {} : un event « touche action » doit \
                         avoir une apparence (choisir un personnage, ou passer en \
                         declencheur contact)",
                        scene_name, ev.name, k + 1
                    );
                }
                // Condition de page (spec §1.3 v0.10)
                let (cond_type, cond_idx, cond_val) = match cond {
                    None | Some(Value::Null) => (0u8, 0u16, 0u16),
                    Some(c) => {
                        if let Some(n) = c["switch"].as_u64() {
                            if n >= 512 {
                                bail!("event « {} » page {} : switch {} hors limite (0-511)",
                                      ev.name, k + 1, n);
                            }
                            let on = c["on"].as_bool().unwrap_or(true);
                            (if on { 1 } else { 2 }, n as u16, 0)
                        } else if let Some(n) = c["var"].as_u64() {
                            if n >= 256 {
                                bail!("event « {} » page {} : variable {} hors limite (0-255)",
                                      ev.name, k + 1, n);
                            }
                            let min = c["min"].as_u64().filter(|&v| v <= 65535).with_context(
                                || format!("event « {} » page {} : champ min invalide",
                                           ev.name, k + 1))?;
                            (3, n as u16, min as u16)
                        } else {
                            bail!("event « {} » page {} : condition invalide ({})",
                                  ev.name, k + 1, c);
                        }
                    }
                };
                let entry = if !commands.is_empty() {
                    let label = format!("__ev{}p{}_{}", i, k, scene_name);
                    asm.push(format!("{}:", label));
                    let first = asm.len();
                    self.compile_list(commands, 0, &mut asm).with_context(|| {
                        format!("event « {} » page {} de la scene '{}'",
                                ev.name, k + 1, scene_name)
                    })?;
                    // « self » -> index d'entrée de CETTE page (le n° de
                    // slot acteur, pas le n° d'event : les pages comptent).
                    // ROUTE/SETPOS/SWAPPOS peuvent viser « cet event » ;
                    // aucun autre token de ces lignes ne vaut « self ».
                    let self_idx = format!(" {}", actors.len());
                    for line in asm.iter_mut().skip(first) {
                        if line.starts_with("  ROUTE self ")
                            || line.starts_with("  SETPOS self ")
                            || line.starts_with("  SWAPPOS ")
                        {
                            *line = line.replace(" self", &self_idx);
                        }
                    }
                    asm.push("  END".to_string());
                    Some(label)
                } else {
                    (*entry_lbl).clone()
                };
                let move_type = match mv.as_deref() {
                    None | Some("static") => 0u8,
                    Some("random") => 1,
                    Some("vertical") => 2,
                    Some("horizontal") => 3,
                    Some("custom") => 4,
                    Some(other) => bail!(
                        "event « {} » page {} : mouvement inconnu « {} » \
                         (static, random, vertical, horizontal, custom)",
                        ev.name, k + 1, other
                    ),
                };
                // Route custom (v0.14) : blob [flags][freq][len][pas...]
                // émis en QUEUE d'asm (jamais exécuté comme du code)
                let route_label = if move_type == 4 {
                    let mr = mroute.as_ref().filter(|v| !v.is_null()).with_context(|| {
                        format!(
                            "event « {} » page {} : mouvement « custom » sans move_route",
                            ev.name, k + 1
                        )
                    })?;
                    let steps = mr["steps"].as_array().with_context(|| {
                        format!("event « {} » page {} : move_route sans steps", ev.name, k + 1)
                    })?;
                    let toks = Self::steps_tokens(steps, &mut self.gfx_blocks)?;
                    let freq = mr["freq"].as_u64().filter(|&f| (1..=8).contains(&f)).unwrap_or(3);
                    let label = format!("__rt{}p{}_{}", i, k, scene_name);
                    tail.push(format!("{}:", label));
                    tail.push(format!(
                        "  RTBLOB {} {} {} {}",
                        if mr["repeat"].as_bool().unwrap_or(true) { 1 } else { 0 },
                        if mr["skip"].as_bool().unwrap_or(false) { 1 } else { 0 },
                        freq,
                        toks.join(" ")
                    ));
                    Some(label)
                } else {
                    None
                };
                let priority = match prio.as_deref() {
                    None | Some("same") => 1u8,
                    Some("below") => 0,
                    Some("above") => 2,
                    Some(other) => bail!(
                        "event « {} » page {} : priorite inconnue « {} » \
                         (below, same, above)",
                        ev.name, k + 1, other
                    ),
                };
                if *speed > 4 {
                    bail!("event « {} » page {} : vitesse {} (1-4)", ev.name, k + 1, speed);
                }
                if move_type != 0 && kind != "npc" {
                    bail!(
                        "event « {} » page {} : le mouvement demande le declencheur \
                         « touche action » (les contacts/autos restent fixes)",
                        ev.name, k + 1
                    );
                }
                actors.push(Actor {
                    kind: kind.to_string(),
                    x: ev.x,
                    y: ev.y,
                    // 255 = invisible (spec §1.3 v0.8) — une apparence est
                    // permise sur TOUT declencheur (coffre visible au contact)
                    sprite: if *sprite < 0 { 255 } else { *sprite as u8 },
                    dir: dir.to_string(),
                    entry,
                    cont: k > 0,
                    cond_type,
                    cond_idx,
                    cond_val,
                    move_type,
                    priority,
                    speed: *speed,
                    route_label,
                });
            }
        }
        asm.extend(tail);

        // Common events (v0.16) : les AUTO sont toujours inclus (entrée de
        // table CETAB), puis les corps référencés — transitivement, un
        // common peut en appeler un autre — sont émis une fois chacun.
        let mut cetab = "CETAB".to_string();
        for (k, ce) in commons.iter().enumerate() {
            match ce.trigger.as_str() {
                "none" => {}
                "auto" | "parallel" => {
                    // switch optionnel (case decochee = toujours actif,
                    // comme RM2003) — un autorun sans switch gele le jeu
                    // pour toujours : c'est un choix d'auteur (cinematique
                    // finale), pas une erreur
                    let sw = match ce.switch {
                        None => "-".to_string(),
                        Some(s) if s < 512 => s.to_string(),
                        Some(s) => bail!(
                            "common event {} « {} » : switch {} hors limite (0-511)",
                            k + 1,
                            ce.name,
                            s
                        ),
                    };
                    // un parallel tourne en tache de fond : pas d'UI dedans
                    if ce.trigger == "parallel" {
                        Self::check_no_ui(commons, k)?;
                    }
                    self.used_commons[k] = true;
                    cetab.push_str(&format!(
                        " {} {} __ce{}_{}",
                        if ce.trigger == "auto" { "a" } else { "p" },
                        sw,
                        k,
                        scene_name
                    ));
                }
                other => bail!(
                    "common event {} « {} » : declencheur inconnu « {} » \
                     (none, auto, parallel)",
                    k + 1,
                    ce.name,
                    other
                ),
            }
        }
        let mut emitted = vec![false; commons.len()];
        while let Some(k) =
            (0..commons.len()).find(|&k| self.used_commons[k] && !emitted[k])
        {
            emitted[k] = true;
            asm.push(format!("__ce{}_{}:", k, scene_name));
            self.compile_list(&commons[k].commands, 0, &mut asm)
                .with_context(|| {
                    format!("common event {} « {} »", k + 1, commons[k].name)
                })?;
            asm.push("  RET".to_string());
        }

        Ok((asm, actors, std::mem::take(&mut self.gfx_blocks), cetab))
    }
}
