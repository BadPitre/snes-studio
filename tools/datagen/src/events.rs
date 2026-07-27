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

use crate::project::{Actor, Event, TextEntry};
use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::collections::HashMap;

/// Variable par défaut des CHOICE générés (réservée, documentée TOOLS.md)
const CHOICE_VAR: &str = "v63";
const MAX_DEPTH: usize = 6;

pub struct EventCompiler<'a> {
    texts: &'a mut Vec<TextEntry>,
    /// contenu → nom (dédoublonnage des textes inline, projets entiers)
    text_of: HashMap<String, String>,
    label_seq: usize,
    /// blocs de personnage référencés par des pas gfx: (Move Route) — à
    /// compter dans le sprite set de la scène en cours
    gfx_blocks: Vec<u8>,
    /// pile des labels de fin de boucle (v0.15) — cible des « break »
    loop_ends: Vec<String>,
}

impl<'a> EventCompiler<'a> {
    pub fn new(texts: &'a mut Vec<TextEntry>) -> Self {
        let text_of = texts
            .iter()
            .map(|t| (t.text.clone(), t.name.clone()))
            .collect();
        EventCompiler {
            texts,
            text_of,
            label_seq: 0,
            gfx_blocks: Vec::new(),
            loop_ends: Vec::new(),
        }
    }

    /// Nom de texte pour un contenu inline (créé au besoin, dédupliqué)
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

    /// Compile une liste de commandes en lignes d'assembleur (spec §2)
    fn compile_list(&mut self, cmds: &[Value], depth: usize, out: &mut Vec<String>) -> Result<()> {
        if depth > MAX_DEPTH {
            bail!("imbrication de commandes trop profonde (max {})", MAX_DEPTH);
        }
        for cmd in cmds {
            let c = cmd["c"].as_str().with_context(|| format!("commande sans champ c : {}", cmd))?;
            match c {
                "msg" => {
                    let t = cmd["text"].as_str().context("msg sans texte")?;
                    let name = self.text_name(t)?;
                    out.push(format!("  MSG {}", name));
                }
                "choice" => {
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
    pub fn compile_scene(
        &mut self,
        scene_name: &str,
        events: &[Event],
    ) -> Result<(Vec<String>, Vec<Actor>, Vec<u8>)> {
        let mut asm = Vec::new();
        let mut actors = Vec::new();
        let mut tail = Vec::new(); /* blobs de routes custom (v0.14) */
        self.gfx_blocks.clear();
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
                    // ROUTE self -> index d'entrée de CETTE page (le n° de
                    // slot acteur, pas le n° d'event : les pages comptent)
                    let self_idx = actors.len().to_string();
                    for line in asm.iter_mut().skip(first) {
                        if line.starts_with("  ROUTE self ") {
                            *line = line.replacen("self", &self_idx, 1);
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
        Ok((asm, actors, std::mem::take(&mut self.gfx_blocks)))
    }
}
