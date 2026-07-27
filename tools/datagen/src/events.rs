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
}

impl<'a> EventCompiler<'a> {
    pub fn new(texts: &'a mut Vec<TextEntry>) -> Self {
        let text_of = texts
            .iter()
            .map(|t| (t.text.clone(), t.name.clone()))
            .collect();
        EventCompiler { texts, text_of, label_seq: 0 }
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

    fn u8_field(cmd: &Value, key: &str) -> Result<u8> {
        cmd[key]
            .as_u64()
            .filter(|&n| n <= 255)
            .map(|n| n as u8)
            .with_context(|| format!("champ « {} » invalide (0-255) : {}", key, cmd))
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
    /// acteurs à AJOUTER à la table (le binaire reste le format v0.7).
    pub fn compile_scene(
        &mut self,
        scene_name: &str,
        events: &[Event],
    ) -> Result<(Vec<String>, Vec<Actor>)> {
        let mut asm = Vec::new();
        let mut actors = Vec::new();
        for (i, ev) in events.iter().enumerate() {
            let kind = match ev.trigger.as_str() {
                "action" => "npc",
                "touch" => "trigger",
                "auto" => "auto",
                other => bail!(
                    "scene '{}', event « {} » : declencheur inconnu « {} » (action, touch, auto)",
                    scene_name, ev.name, other
                ),
            };
            if kind == "npc" && ev.sprite < 0 {
                bail!(
                    "scene '{}', event « {} » : un event « touche action » doit avoir une \
                     apparence (choisir un personnage, ou passer en declencheur contact)",
                    scene_name, ev.name
                );
            }
            let entry = if !ev.commands.is_empty() {
                let label = format!("__ev{}_{}", i, scene_name);
                asm.push(format!("{}:", label));
                self.compile_list(&ev.commands, 0, &mut asm)
                    .with_context(|| format!("event « {} » de la scene '{}'", ev.name, scene_name))?;
                asm.push("  END".to_string());
                Some(label)
            } else {
                ev.entry.clone()
            };
            actors.push(Actor {
                kind: kind.to_string(),
                x: ev.x,
                y: ev.y,
                // 255 = invisible (spec §1.3 v0.8) — une apparence est
                // permise sur TOUT declencheur (coffre visible au contact)
                sprite: if ev.sprite < 0 { 255 } else { ev.sprite as u8 },
                dir: ev.dir.clone(),
                entry,
            });
        }
        Ok((asm, actors))
    }
}
