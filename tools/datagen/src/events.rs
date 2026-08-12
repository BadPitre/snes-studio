//! Compiling structured EVENTS (Event Editor, RPG Maker 2003 model) onto
//! the existing pipeline: each event becomes an actor (npc/trigger/auto)
//! plus VM assembly lines appended to the scene's script, and its INLINE
//! texts join texts.json virtually — collected and deduplicated into the
//! text bank.
//!
//! The binary format (spec §1-2) does NOT change: events are sugar over
//! the SOURCE format, contractualised in docs/TOOLS.md.
//!
//! Commands (JSON):
//!   {"c":"msg","text":"..."}
//!   {"c":"choice","var":"v63"?,"options":[{"text":"Yes","do":[...]},...]}
//!   {"c":"set","var":"g1","value":1}   {"c":"add","var":"v0","value":1}
//!   {"c":"if","var":"g1","op":"=="|"!="|">=","value":1,
//!    "then":[...],"else":[...]}
//!   {"c":"warp","to":"scene","x":1,"y":2}
//!   {"c":"face","event":0,"dir":"down"}
//!   Switches and 16-bit variables, RM2003 style:
//!   {"c":"switch","n":0-511,"on":true|false}
//!   {"c":"var","n":0-255,"op":"="|"+","value":-32768..65535}
//!   {"c":"if_sw","n":..,"on":true|false,"then":[...],"else":[...]}
//!   {"c":"if_var","left":{"from":..,"value":..},"op":"=="|"!="|">=",
//!    "right":{"from":..,"value":..},"then":[...],"else":[...]}
//!    — the historical "n"/"value" form is still accepted
//!   Loops and comments:
//!   {"c":"loop","do":[...]}   {"c":"break"}   {"c":"rem","text":"..."}
//!   Scripted positions:
//!   {"c":"hero_loc","vs":n,"vx":n,"vy":n}   {"c":"warp_var","vs","vx","vy"}
//!   {"c":"setpos","event":-1|n,"from":"const"|"vars","x":..,"y":..}
//!   {"c":"swappos","a":-1|n,"b":-1|n}
//!   Screen effects:
//!   {"c":"scr_hide","speed":1-15}   {"c":"scr_show","speed":1-15}
//!   {"c":"ui_show","widget":"name","on":true|false}
//!   {"c":"key_input","var":n,"wait":bool,"keys":[1-12]}
//!   {"c":"sysmenu"}
//!   {"c":"tint","mode":"off"|"add"|"sub","r":0-31,"g":..,"b":..}
//!   {"c":"flash","r","g","b","frames":1-255}
//!   {"c":"shake","power":0-8,"speed":1-8,"frames":0-255}

use crate::db::Db;
use crate::project::{FunctionDef, Actor, CommonEvent, Event, ScreenDef, TextEntry};
use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::collections::HashMap;

/// Default variable of generated CHOICEs (reserved, documented in TOOLS.md).
const CHOICE_VAR: &str = "v63";
const MAX_DEPTH: usize = 6;

pub struct EventCompiler<'a> {
    texts: &'a mut Vec<TextEntry>,
    /// The project database (db_read); None when there is no schemas/.
    db: Option<&'a Db>,
    /// UI widgets of the layout; names are resolved to their indices.
    ui_widgets: Vec<String>,
    /// Dialogue styles; index 0 is the default, 1.. are dialog_style.
    ui_styles: Vec<String>,
    /// Project pictures (stems), resolved to pic_id.
    pictures: Vec<String>,
    /// Pixel dimensions (w, h) of each picture, for positioning.
    pic_dims: Vec<(usize, usize)>,
    /// Project sounds (stems), resolved to sfx_id.
    sounds: Vec<String>,
    /// Project music (stems), resolved to music_id.
    musics: Vec<String>,
    /// Project vignettes (stems), resolved to vig_id.
    vignettes: Vec<String>,
    /// Project animations (names), resolved to anim_id.
    animations: Vec<String>,
    /// Mode 7 images (stems), resolved to ids, and the DISTINCT zoom
    /// ramps of the whole project — a command resolves its own four
    /// fields to the index of the table datagen will emit.
    m7_images: Vec<String>,
    m7_ramps: Vec<crate::mode7::Ramp>,
    /// Composed screens, unrolled by the "screen" command.
    screens: Vec<ScreenDef>,
    /// Stack of screens currently being unrolled: screen_call resolves
    /// script names inside the CURRENT screen.
    screen_stack: Vec<usize>,
    /// Content to name, deduplicating inline texts across whole projects.
    text_of: HashMap<String, String>,
    label_seq: usize,
    /// Character blocks referenced by gfx: route steps, to be counted in
    /// the current scene's sprite set.
    gfx_blocks: Vec<u8>,
    /// Stack of loop-end labels; "break" targets the innermost.
    loop_ends: Vec<String>,
    /// Current scene, used as the suffix of common event labels.
    cur_scene: String,
    /// Common events referenced by the current scene (calls plus auto
    /// triggers): their bodies are emitted into the script block.
    used_commons: Vec<bool>,
    /// Signature of the FUNCTION whose body is being compiled:
    /// (parameters, locals, returns a value). None outside a function,
    /// and that is what lets us refuse a "param" or a "local" written in
    /// a map event, where it would mean nothing.
    cur_fn: Option<(usize, usize, bool)>,
    /// Signatures of the project's FUNCTIONS: argument count, frame size
    /// to reserve, whether there is a result.
    fn_sigs: Vec<(usize, usize, bool)>,
    /// Functions referenced by the current scene; their bodies are
    /// emitted into the script block, transitively.
    used_fns: Vec<bool>,
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
            animations: Vec::new(),
            m7_images: Vec::new(),
            m7_ramps: Vec::new(),
            screens: Vec::new(),
            screen_stack: Vec::new(),
            text_of,
            label_seq: 0,
            gfx_blocks: Vec::new(),
            loop_ends: Vec::new(),
            cur_scene: String::new(),
            used_commons: Vec::new(),
            cur_fn: None,
            fn_sigs: Vec::new(),
            used_fns: Vec::new(),
        }
    }

    /// Source of a 16-bit value: {"from": .., "value": ..}. One grammar
    /// for variable assignment, function call arguments and the returned
    /// value — there was no reason to invent three. Returns (assembler
    /// mnemonic, value), and refuses "param" outside a function: anywhere
    /// else it would read a frame that does not exist.
    fn value_source(&self, cmd: &Value, who: &str) -> Result<(&'static str, i64)> {
        let from = cmd["from"].as_str().unwrap_or("const");
        let st = match from {
            "const" => "const",
            "var" => "var",
            "hero_x" => "hx",
            "hero_y" => "hy",
            "timer" => "timer",
            "scene" => "scene",
            "param" => "param",
            // A local is a slot of the frame, AFTER the parameters. The
            // engine cannot tell the difference — it is here, where the
            // signature is known, that a local's name becomes an index.
            "local" => "param",
            "ret" => "ret",
            o => bail!("{} : source inconnue « {} »", who, o),
        };
        let mut val = cmd["value"]
            .as_i64()
            .filter(|v| (-32768..=65535).contains(v))
            .unwrap_or(0);
        if from == "param" || from == "local" {
            let (np, nl, _) = match self.cur_fn {
                None => bail!(
                    "{} : « {} » n'a de sens que dans le corps d'une fonction",
                    who,
                    if from == "local" { "variable locale" } else { "paramètre" }
                ),
                Some(sig) => sig,
            };
            let max = if from == "local" { nl } else { np };
            if val < 0 || val as usize >= max {
                bail!(
                    "{} : {} n° {} demandé, mais la fonction n'en déclare que \
                     {}. Rouvrir la commande et rechoisir dans la liste (un \
                     retrait, ou une source changée sans rechoisir, laisse ce \
                     genre de référence en l'air).",
                    who,
                    if from == "local" { "variable locale" } else { "paramètre" },
                    val + 1,
                    max
                );
            }
            if from == "local" {
                val += np as i64; /* les locales suivent les paramètres */
            }
        }
        Ok((st, val))
    }

    /// Resolves the "style" field of a msg/choice to a style index;
    /// absent or "" means 0, the default.
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

    /// Position of a picture command: variables (x_var/y_var, flags bit
    /// 1), constants (validated when the dimensions are known), or absent
    /// for centring — precomputed when the dimensions are known, leaving
    /// the bytecode unchanged, otherwise flags bit 2 lets the engine centre.
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

    /// Fade or slide duration in frames (0 instant, 60 one second).
    /// Legacy: "fade": false means 0; the default is 16.
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

    /// Screen transition: "fade" (default) 0, "none" 1, "mosaic" 2,
    /// wipes: "wipe_down" 3, "wipe_up" 4, "wipe_center" 5.
    fn trans_field(cmd: &Value) -> Result<u8> {
        Ok(match cmd["trans"].as_str() {
            None | Some("") | Some("fade") => 0,
            Some("none") => 1,
            Some("mosaic") => 2,
            Some("wipe_down") => 3,
            Some("wipe_up") => 4,
            Some("wipe_center") => 5,
            Some(o) => bail!(
                "transition inconnue « {} » (fade, none, mosaic, wipe_down, \
                 wipe_up, wipe_center)",
                o
            ),
        })
    }

    /// JSON route steps to assembler tokens, shared by the route command
    /// and per-page custom routes. The blocks of gfx steps are collected
    /// for the scene's charset budget.
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

    /// A "parallel" common event runs in the background: messages and
    /// choices are forbidden inside it — transitively, through calls.
    /// No UI outside the main script.
    fn check_no_ui(
        commons: &[CommonEvent],
        functions: &[FunctionDef],
        root: usize,
    ) -> Result<()> {
        // "seen" covers BOTH lists — common events first, functions next.
        // A parallel process can call either, and a message hidden two
        // levels down is exactly what this check exists to find.
        fn scan(
            cmds: &[Value],
            commons: &[CommonEvent],
            functions: &[FunctionDef],
            seen: &mut Vec<bool>,
            root_name: &str,
        ) -> Result<()> {
            for cmd in cmds {
                let sub = |key: &str| -> &[Value] {
                    cmd[key].as_array().map(|v| v.as_slice()).unwrap_or(&[])
                };
                match cmd["c"].as_str().unwrap_or("") {
                    "msg" | "choice" | "target_sel" => bail!(
                        "common event « {} » (parallel) : les messages, les \
                         choix et le curseur de cible sont interdits dans un \
                         Parallel process (il tourne en tache de fond, sans \
                         dialogue)",
                        root_name
                    ),
                    "loop" => scan(sub("do"), commons, functions, seen, root_name)?,
                    "if" | "if_sw" | "if_var" => {
                        scan(sub("then"), commons, functions, seen, root_name)?;
                        scan(sub("else"), commons, functions, seen, root_name)?;
                    }
                    "call" => {
                        if let Some(n) = cmd["n"].as_u64() {
                            let n = n as usize;
                            if n < commons.len() && !seen[n] {
                                seen[n] = true;
                                let body = &commons[n].commands;
                                scan(body, commons, functions, seen, root_name)?;
                            }
                        }
                    }
                    "call_fn" => {
                        if let Some(n) = cmd["n"].as_u64() {
                            let n = n as usize;
                            let i = commons.len() + n;
                            if n < functions.len() && !seen[i] {
                                seen[i] = true;
                                let body = &functions[n].commands;
                                scan(body, commons, functions, seen, root_name)?;
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(())
        }
        let mut seen = vec![false; commons.len() + functions.len()];
        seen[root] = true;
        scan(
            &commons[root].commands,
            commons,
            functions,
            &mut seen,
            &commons[root].name,
        )
    }

    /// Compiles a command list into assembler lines (spec §2).
    fn compile_list(&mut self, cmds: &[Value], depth: usize, out: &mut Vec<String>) -> Result<()> {
        if depth > MAX_DEPTH {
            bail!("imbrication de commandes trop profonde (max {})", MAX_DEPTH);
        }
        for cmd in cmds {
            let c = cmd["c"].as_str().with_context(|| format!("commande sans champ c : {}", cmd))?;
            match c {
                "msg" => self.cmd_msg(cmd, out)?,
                "choice" => self.cmd_choice(cmd, out, depth)?,
                "set" | "add" => self.cmd_set_add(cmd, out, c)?,
                "if" => self.cmd_if(cmd, out, depth)?,
                "switch" => self.cmd_switch(cmd, out)?,
                "var" => self.cmd_var(cmd, out)?,
                "timer" => self.cmd_timer(cmd, out)?,
                "campan" => self.cmd_campan(cmd, out)?,
                "cam_return" => self.cmd_cam_return(cmd, out)?,
                "wait_cam" => self.cmd_wait_cam(out)?,
                "scr_hide" | "scr_show" => self.cmd_scr(cmd, out, c)?,
                "ui_show" => self.cmd_ui_show(cmd, out)?,
                "list_select" => self.cmd_list_select(cmd, out)?,
                "pic_show" => self.cmd_pic_show(cmd, out)?,
                "pic_hide" => self.cmd_pic_hide(cmd, out)?,
                "pic_move" => self.cmd_pic_move(cmd, out)?,
                "key_input" => self.cmd_key_input(cmd, out)?,
                "sysmenu" => bail!(
                    "sysmenu : le menu Systeme est devenu une bibliotheque \
                     d'events (M2) — remplacer par les commandes Sauvegarder/\
                     Charger la partie, ou par le menu du gabarit \
                     (PLANNING_MENU_EN_EVENTS.md)"
                ),
                "save_slot" => self.cmd_sram(cmd, out, 0)?,
                "load_slot" => self.cmd_sram(cmd, out, 1)?,
                "slot_info" => self.cmd_sram(cmd, out, 2)?,
                "tint" => self.cmd_tint(cmd, out)?,
                "screen" => self.cmd_screen(cmd, out, depth)?,
                "screen_call" => self.cmd_screen_call(cmd, out, depth)?,
                "stage_open" => self.cmd_stage_open(cmd, out)?,
                "stage_pose" => self.cmd_stage_pose(cmd, out)?,
                "stage_clear" => self.cmd_stage_clear(cmd, out)?,
                "vig_show" => self.cmd_vig_show(cmd, out)?,
                "vig_play" => self.cmd_vig_play(cmd, out)?,
                "anim_play" => self.cmd_anim_play(cmd, out)?,
                "anim_stop" => self.cmd_anim_stop(out)?,
                "vig_hide" => self.cmd_vig_hide(cmd, out)?,
                "slot_fx" => self.cmd_slot_fx(cmd, out)?,
                "stage_close" => self.cmd_stage_close(cmd, out)?,
                "m7" => self.cmd_m7(cmd, out)?,
                "m7_view" => self.cmd_m7_view(cmd, out)?,
                "m7_rot" => self.cmd_m7_rot(cmd, out)?,
                // G2: "Lancer un combat" is gone — a battle is a
                // COMPOSED SCREEN the author arranges visually.
                "battle" => bail!(
                    "la commande « Lancer un combat » n'existe plus : un combat \
                     est un ÉCRAN COMPOSÉ. Créer un écran (Tools → Écrans), y \
                     poser les monstres, et remplacer cette commande par \
                     « Aller à l'écran ». Le script de l'écran nomme ses \
                     monstres (« Numéro d'une fiche ») puis appelle la \
                     bibliothèque (combat_tour)."
                ),
                "btl_pose" => self.cmd_btl_pose(cmd, out)?,
                "popup" => self.cmd_popup(cmd, out)?,
                "clock" => self.cmd_clock(cmd, out)?,
                "target_sel" => self.cmd_target_sel(cmd, out)?,
                "m7_turn" => self.cmd_m7_turn(cmd, out)?,
                "sfx" => self.cmd_sfx(cmd, out)?,
                "bgm" => self.cmd_bgm(cmd, out)?,
                "spotlight" => self.cmd_spotlight(cmd, out)?,
                "skygrad" => self.cmd_skygrad(cmd, out)?,
                "wave" => self.cmd_wave(cmd, out)?,
                "weather" => self.cmd_weather(cmd, out)?,
                "flash" => self.cmd_flash(cmd, out)?,
                "shake" => self.cmd_shake(cmd, out)?,
                "if_sw" | "if_var" => self.cmd_if_sw_var(cmd, out, c, depth)?,
                "wait" => self.cmd_wait(cmd, out)?,
                "loop" => self.cmd_loop(cmd, out, depth)?,
                "break" => self.cmd_break(out)?,
                // Comment: decorative in the editor, no bytecode emitted
                "rem" => {}
                "db_read" => self.cmd_db_read(cmd, out)?,
                "db_entry" => self.cmd_db_entry(cmd, out)?,
                "call" => self.cmd_call(cmd, out)?,
                "call_fn" => self.cmd_call_fn(cmd, out)?,
                "ret_fn" => self.cmd_ret_fn(cmd, out)?,
                "wait_route" => self.cmd_wait_route(out)?,
                "route" => self.cmd_route(cmd, out)?,
                "hero_loc" => self.cmd_hero_loc(cmd, out)?,
                "warp_var" => self.cmd_warp_var(cmd, out)?,
                "setpos" => self.cmd_setpos(cmd, out)?,
                "swappos" => self.cmd_swappos(cmd, out)?,
                "warp" => self.cmd_warp(cmd, out)?,
                "face" => self.cmd_face(cmd, out)?,
                other => bail!("commande inconnue : « {} »", other),
            }
        }
        Ok(())
    }

    /// Compiles a scene's events: assembly lines to APPEND to the script
    /// and actors to APPEND to the table. The binary stays the v0.10
    /// format. An event is 1..N PAGES; each page becomes a consecutive
    /// actor entry (CONT flag on pages 2+) with its condition,
    /// appearance, trigger and bytecode. An event with no "pages" is
    /// one implicit page made of its direct fields.
    /// ALSO returns the CETAB line (the auto common event table) that
    /// the caller must place FIRST in the assembled script — the engine
    /// Mode 7 resources. A setter rather than two more parameters on
    /// compile_scene, which already takes seventeen — and unlike the
    /// tileset these do not vary per scene, so they are set once.
    pub fn set_mode7(&mut self, images: &[String], ramps: &[crate::mode7::Ramp]) {
        self.m7_images = images.to_vec();
        self.m7_ramps = ramps.to_vec();
    }

    /// reads it at offset 0 of the script block.
    pub fn compile_scene(
        &mut self,
        scene_name: &str,
        events: &[Event],
        commons: &[CommonEvent],
        functions: &[FunctionDef],
        db: Option<&'a Db>,
        ui_widgets: &[String],
        // U3-b: the common events that are WIDGET HOOKS — always
        // emitted, and reachable through a CETAB "b" entry.
        ui_hook_ces: &[usize],
        ui_styles: &[String],
        pictures: &[String],
        pic_dims: &[(usize, usize)],
        sounds: &[String],
        musics: &[String],
        vignettes: &[String],
        animations: &[String],
        screens: &[ScreenDef],
        scene_tileset: &str,
        tile_blocks: &mut Vec<(String, u16)>,
        real_blocks: usize,
    ) -> Result<(Vec<String>, Vec<Actor>, Vec<u8>, String)> {
        let mut asm = Vec::new();
        let mut actors = Vec::new();
        let mut tail = Vec::new(); /* blobs de routes custom (v0.14) */
        self.gfx_blocks.clear();
        self.cur_scene = scene_name.to_string();
        self.used_commons = vec![false; commons.len()];
        self.used_fns = vec![false; functions.len()];
        // Signatures first: a map event may call a function defined later
        // in the list, and the argument-count check cannot wait.
        self.fn_sigs = functions
            .iter()
            .map(|f| (f.params.len(), f.locals.len(), f.returns))
            .collect();
        // A project in the previous format still carries its parameters
        // on a common event. Refuse it plainly rather than compile a
        // function stripped of its inputs.
        for (k, ce) in commons.iter().enumerate() {
            if !ce.params.is_empty() {
                bail!(
                    "common event {} « {} » : les fonctions ont maintenant leur \
                     propre liste (Tools > Fonctions). Rouvrir le projet dans \
                     l'editeur suffit a le convertir.",
                    k + 1,
                    ce.name
                );
            }
        }
        self.db = db;
        self.ui_widgets = ui_widgets.to_vec();
        self.ui_styles = ui_styles.to_vec();
        self.pictures = pictures.to_vec();
        self.pic_dims = pic_dims.to_vec();
        self.sounds = sounds.to_vec();
        self.musics = musics.to_vec();
        self.vignettes = vignettes.to_vec();
        self.animations = animations.to_vec();
        self.screens = screens.to_vec();
        for (i, ev) in events.iter().enumerate() {
            // Uniform "pages" view: (condition, trigger, sprite, dir,
            // entry, commands) per page
            #[allow(clippy::type_complexity)]
            let pages: Vec<(&Option<Value>, &str, i16, &str, &Option<String>, &[Value], &Option<String>, &Option<Value>, &Option<String>, u8, Option<u16>)> =
                if ev.pages.is_empty() {
                    vec![(&ev.condition, ev.trigger.as_str(), ev.sprite, ev.dir.as_str(),
                          &ev.entry, ev.commands.as_slice(), &ev.r#move,
                          &ev.move_route, &ev.priority, ev.speed.unwrap_or(0),
                          ev.tile)]
                } else {
                    ev.pages
                        .iter()
                        .map(|p| (&p.condition, p.trigger.as_str(), p.sprite,
                                  p.dir.as_str(), &p.entry, p.commands.as_slice(),
                                  &p.r#move, &p.move_route, &p.priority,
                                  p.speed.unwrap_or(0), p.tile))
                        .collect()
                };
            for (k, (cond, trigger, sprite, dir, entry_lbl, commands, mv, mroute, prio, speed, tile)) in
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
                if kind == "npc" && *sprite < 0 && tile.is_none() {
                    bail!(
                        "scene '{}', event « {} » page {} : un event « touche action » doit \
                         avoir une apparence (choisir un personnage, ou passer en \
                         declencheur contact)",
                        scene_name, ev.name, k + 1
                    );
                }
                // Page condition (spec §1.3 v0.10)
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
                    // "self" is the entry index of THIS page — the actor
                    // slot number, not the event number, since pages
                    // count. ROUTE/SETPOS/SWAPPOS may target "this
                    // event"; no other token on those lines can be self.
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
                // Custom route: a [flags][freq][len][steps...] blob
                // emitted at the TAIL of the asm, never executed as code
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
                    // 255 is invisible (spec §1.3 v0.8). An appearance is
                    // allowed on ANY trigger — a chest visible on contact.
                    // A TILE appearance becomes a VIRTUAL sprite block,
                    // composed by datagen from the tileset's upper layer.
                    sprite: match tile {
                        Some(t) => {
                            let key = (scene_tileset.to_string(), *t);
                            let k = match tile_blocks.iter().position(|e| *e == key) {
                                Some(k) => k,
                                None => {
                                    tile_blocks.push(key);
                                    tile_blocks.len() - 1
                                }
                            };
                            let b = real_blocks + k;
                            if b > 254 {
                                bail!(
                                    "event « {} » : trop d'apparences tile                                      distinctes dans le projet",
                                    ev.name
                                );
                            }
                            b as u8
                        }
                        None => {
                            if *sprite < 0 { 255 } else { *sprite as u8 }
                        }
                    },
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

        // AUTO common events are always included (a CETAB entry), then
        // the referenced bodies — transitively, since one common event
        // may call another — are emitted once each.
        let mut cetab = "CETAB".to_string();
        for (k, ce) in commons.iter().enumerate() {
            match ce.trigger.as_str() {
                "none" => {
                    // A WIDGET HOOK (U3-b) is callable only, like any
                    // "none" common event, but the engine reaches it by
                    // INDEX rather than through a CALL opcode — hence a
                    // CETAB entry of type "b", and a body always emitted.
                    if ui_hook_ces.contains(&k) {
                        Self::check_no_ui(commons, functions, k).with_context(|| {
                            format!(
                                "script du widget « {} » : un hook ne peut pas bloquer \
                                 (message, attente, choix, liste, warp) — la liste \
                                 mangerait sa propre entree",
                                ce.name
                            )
                        })?;
                        self.used_commons[k] = true;
                        cetab.push_str(&format!(" b {} __ce{}_{}", k, k, scene_name));
                    }
                }
                "auto" | "parallel" => {
                    // The switch is optional (box unchecked means always
                    // active, as in RM2003). An autorun with no switch
                    // freezes the game forever: that is an author's
                    // choice — a final cutscene — not an error.
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
                    // a parallel runs in the background: no UI inside it
                    if ce.trigger == "parallel" {
                        Self::check_no_ui(commons, functions, k)?;
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
        // Referenced bodies are emitted once each, and the loop alternates
        // between the two lists: a common event may call a function, a
        // function may call a common event, and either can mark a new one
        // while it is being compiled.
        let mut em_ce = vec![false; commons.len()];
        let mut em_fn = vec![false; functions.len()];
        loop {
            if let Some(k) =
                (0..commons.len()).find(|&k| self.used_commons[k] && !em_ce[k])
            {
                em_ce[k] = true;
                asm.push(format!("__ce{}_{}:", k, scene_name));
                self.compile_list(&commons[k].commands, 0, &mut asm)
                    .with_context(|| {
                        format!("common event {} « {} »", k + 1, commons[k].name)
                    })?;
                asm.push("  RET".to_string());
                continue;
            }
            if let Some(k) = (0..functions.len()).find(|&k| self.used_fns[k] && !em_fn[k])
            {
                em_fn[k] = true;
                asm.push(format!("__fn{}_{}:", k, scene_name));
                // This is where, and only where, "param" means something
                self.cur_fn = Some((
                functions[k].params.len(),
                functions[k].locals.len(),
                functions[k].returns,
            ));
                let r = self.compile_list(&functions[k].commands, 0, &mut asm);
                self.cur_fn = None;
                r.with_context(|| {
                    format!("fonction {} « {} »", k + 1, functions[k].name)
                })?;
                // RET also pops the frame: a function that falls off the
                // end of its body without a "return" yields nothing, but
                // does give its slots back
                asm.push("  RET".to_string());
                continue;
            }
            break;
        }

        Ok((asm, actors, std::mem::take(&mut self.gfx_blocks), cetab))
    }

    fn cmd_msg(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        // Each message picks its box; style 0 is the default.
        // With NO styles in the project nothing is emitted, so
        // existing projects keep byte-identical bytecode — the
        // extra opcode shifted the typewriter by one frame.
        // With styles, the reset to 0 is always emitted.
        if !self.ui_styles.is_empty() {
            out.push(format!("  DLGSTYLE {}", self.style_index(cmd)?));
        } else {
            self.style_index(cmd)?; /* valide quand même le champ */
        }
        // Free text OR a reference to the catalogue (Tools >
        // Texts): text_ref names an entry of texts.json, shared
        // between commands and editable in the catalogue
        // without touching the events.
        let name = if let Some(r) = cmd["text_ref"].as_str() {
            if !self.texts.iter().any(|t| t.name == r) {
                bail!(
                    "msg : texte « {} » introuvable dans le \
                     catalogue (Tools > Textes)",
                    r
                );
            }
            r.to_string()
        } else {
            let t = cmd["text"].as_str().context("msg sans texte")?;
            self.text_name(t)?
        };
        out.push(format!("  MSG {}", name));
        Ok(())
    }

    fn cmd_choice(&mut self, cmd: &Value, out: &mut Vec<String>, depth: usize) -> Result<()> {
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
        // option 0 falls through in sequence
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
        Ok(())
    }

    fn cmd_set_add(&mut self, cmd: &Value, out: &mut Vec<String>, c: &str) -> Result<()> {
        let var = Self::var_ref(&cmd["var"], "")?;
        let val = Self::u8_field(cmd, "value")?;
        out.push(format!(
            "  {} {} {}",
            if c == "set" { "SETVAR" } else { "ADDVAR" },
            var,
            val
        ));
        Ok(())
    }

    fn cmd_if(&mut self, cmd: &Value, out: &mut Vec<String>, depth: usize) -> Result<()> {
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
        Ok(())
    }

    fn cmd_switch(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let n = Self::idx_field(cmd, "n", 512)?;
        let on = cmd["on"].as_bool().context("switch sans champ on")?;
        out.push(format!("  SW {} {}", n, if on { 1 } else { 0 }));
        Ok(())
    }

    fn cmd_var(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        // Full arithmetic, randomness, and sources (constant,
        // variable, hero X/Y, timer).
        // "dst" picks the destination space: a project global,
        // or a LOCAL of the function being compiled.
        let op = cmd["op"].as_str().unwrap_or("=");
        if !["=", "+", "-", "*", "/", "%", "rand"].contains(&op) {
            bail!("var : operation inconnue « {} »", op);
        }
        let (st, val) = self.value_source(cmd, "var")?;
        if cmd["dst"].as_str() == Some("local") {
            let (np, nl, _) = self.cur_fn.with_context(|| {
                "var : une variable LOCALE n'a de sens que dans le \
                 corps d'une fonction"
                    .to_string()
            })?;
            let k = Self::idx_field(cmd, "n", 256)?;
            if k as usize >= nl {
                bail!(
                    "var : variable locale n° {} demandée, mais la \
                     fonction n'en déclare que {}",
                    k + 1,
                    nl
                );
            }
            // locals follow the parameters in the frame
            out.push(format!(
                "  SETLOC {} {} {} {}",
                np as u64 + k as u64,
                op,
                st,
                val
            ));
        } else {
            let n = Self::idx_field(cmd, "n", 256)?;
            // the old 16-bit set/add also go through VAROP
            out.push(format!("  VAROP {} {} {} {}", n, op, st, val));
        }
        Ok(())
    }

    fn cmd_timer(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let op = match cmd["op"].as_str().unwrap_or("start") {
            "start" => "start",
            "stop" => "stop",
            "show" => "show",
            "hide" => "hide",
            o => bail!("timer : operation inconnue « {} »", o),
        };
        let secs = cmd["secs"].as_u64().filter(|&v| v <= 5999).unwrap_or(0);
        out.push(format!("  TIMER {} {}", op, secs));
        Ok(())
    }

    fn cmd_campan(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let speed = cmd["speed"].as_u64().filter(|&v| (1..=8).contains(&v)).unwrap_or(2);
        out.push(format!(
            "  CAMPAN {} {} {}",
            Self::u8_field(cmd, "x")?,
            Self::u8_field(cmd, "y")?,
            speed
        ));
        Ok(())
    }

    fn cmd_cam_return(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let speed = cmd["speed"].as_u64().filter(|&v| (1..=8).contains(&v)).unwrap_or(2);
        out.push(format!("  CAMRET {}", speed));
        Ok(())
    }

    fn cmd_wait_cam(&mut self, out: &mut Vec<String>) -> Result<()> {
        out.push("  WAITCAM".to_string());
        Ok(())
    }

    // screen effects
    fn cmd_scr(&mut self, cmd: &Value, out: &mut Vec<String>, c: &str) -> Result<()> {
        // Duration in FRAMES. Legacy: the old "speed" field
        // (1-15 brightness steps per frame) is converted to
        // the equivalent duration, about 15/speed.
        let dur = match cmd["frames"].as_u64().filter(|&v| (1..=255).contains(&v)) {
            Some(v) => v,
            None => {
                let speed = cmd["speed"]
                    .as_u64()
                    .filter(|&v| (1..=15).contains(&v))
                    .unwrap_or(1);
                (15 + speed - 1) / speed
            }
        };
        out.push(format!(
            "  {} {} {}",
            if c == "scr_hide" { "SCRHIDE" } else { "SCRSHOW" },
            dur,
            Self::trans_field(cmd)?
        ));
        Ok(())
    }

    // UI widget visibility (SHOWUI)
    fn cmd_ui_show(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
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
        Ok(())
    }

    // Cursor menu: the chosen index goes to a variable
    // (255 when cancelled with B and cancelling is allowed).
    fn cmd_list_select(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let name = cmd["widget"].as_str().unwrap_or("");
        let idx = self
            .ui_widgets
            .iter()
            .position(|w| w == name)
            .with_context(|| {
                format!(
                    "list_select : widget « {} » introuvable dans                                  ui/layout.toml (widgets : {})",
                    name,
                    if self.ui_widgets.is_empty() {
                        "aucun".to_string()
                    } else {
                        self.ui_widgets.join(", ")
                    }
                )
            })?;
        let var = cmd["var"]
            .as_u64()
            .filter(|&v| v < 256)
            .with_context(|| "list_select : var 0-255".to_string())?;
        let cancel = cmd["cancel"].as_bool().unwrap_or(true);
        // bit 1: the widget stays visible on close
        // (multi-panel); bit 2: Left/Right exit, returning
        // 254/253 — navigation between neighbouring lists
        let keep = cmd["keep"].as_bool().unwrap_or(false);
        let lr = cmd["lr"].as_bool().unwrap_or(false);
        let flags = cancel as u8 | (keep as u8) << 1 | (lr as u8) << 2;
        out.push(format!("  LISTSEL {} {} {}", idx, var, flags));
        Ok(())
    }

    // Full-screen pictures, RM2003 style: the name is resolved
    // to a pic_id of project.pictures.
    fn cmd_pic_show(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        // the image from the list, OR a number read in a variable
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
        // colour math blending with the scenery (flags bits 3-4)
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
        Ok(())
    }

    fn cmd_pic_hide(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        out.push(format!("  HIDEPIC {}", Self::pic_dur(cmd)?));
        Ok(())
    }

    // Slides the displayed image (RM2003's Move Picture) to
    // (x,y) over N frames. NON-blocking: the script continues.
    fn cmd_pic_move(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let mut flags: u8 = 0;
        let (x, y) = Self::pic_pos(cmd, &mut flags, None, "pic_move")?;
        let dur = Self::pic_dur(cmd)?;
        out.push(format!("  MOVEPIC {} {} {} {}", x, y, flags, dur));
        Ok(())
    }

    // Key Input Processing (RM2003): the code of the pressed
    // key lands in a variable, 0 meaning none.
    fn cmd_key_input(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
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
        Ok(())
    }


    fn cmd_tint(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let mode = match cmd["mode"].as_str().unwrap_or("off") {
            "off" => "off",
            "add" => "add",
            "sub" => "sub",
            o => bail!("tint : mode inconnu « {} » (off, add, sub)", o),
        };
        let comp = |key: &str| -> u64 {
            cmd[key].as_u64().map(|v| v.min(31)).unwrap_or(0)
        };
        // "dur" in frames means a GRADUAL tint (TINTG);
        // absent or 0 is an immediate TINT, bytecode unchanged
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
        Ok(())
    }

    // "Go to screen": the composition made with the mouse
    // (screens/<name>.json) is UNROLLED here into stage
    // commands plus the screen's inline script. The engine
    // sees nothing new — editor sugar, like the autotiles.
    // MAX_DEPTH guards against screens calling each other in
    // a loop.
    fn cmd_screen(&mut self, cmd: &Value, out: &mut Vec<String>, depth: usize) -> Result<()> {
        let name = cmd["name"].as_str().unwrap_or("");
        let idx = self
            .screens
            .iter()
            .position(|sc| sc.name == name)
            .with_context(|| {
                format!(
                    "commande écran : '{}' introuvable \
                     (supprimé ou renommé ?)",
                    name
                )
            })?;
        let sc = self.screens[idx].clone();
        let dur = cmd["dur"].as_u64().filter(|&v| v <= 255).unwrap_or(20);
        let bid = if sc.backdrop.is_empty() {
            255
        } else {
            self.pictures
                .iter()
                .position(|p| *p == sc.backdrop)
                .unwrap() as u64 // validé par main.rs
        };
        out.push(format!(
            "  STAGEOPEN {} {} {}",
            bid, dur,
            Self::trans_field(cmd)?
        ));
        for sl in &sc.slots {
            let pid = self
                .pictures
                .iter()
                .position(|p| *p == sl.pic)
                .unwrap(); // validé par main.rs
            out.push(format!(
                "  STAGEPOSE {} {} {} {}",
                sl.slot - 1, pid, sl.x / 8, sl.y / 8
            ));
        }
        // The posed vignettes (H3): synthesized as ordinary commands
        // and compiled like authored ones, so they share every check.
        for v in &sc.vignettes {
            let cmds = if !v.anim.is_empty() {
                serde_json::json!([{
                    "c": "anim_play", "anim": v.anim, "anchor": "screen",
                    "x": v.x, "y": v.y
                }])
            } else {
                let mut list = vec![serde_json::json!({
                    "c": "vig_show", "slot": v.slot, "vig": v.vig,
                    "x": v.x, "y": v.y, "anchor": "screen"
                })];
                if v.mode == "loop" || v.mode == "once" {
                    list.push(serde_json::json!({
                        "c": "vig_play", "slot": v.slot, "mode": v.mode,
                        "speed": if v.speed == 0 { 8 } else { v.speed }
                    }));
                }
                serde_json::Value::Array(list)
            };
            let list = cmds.as_array().cloned().unwrap_or_default();
            self.compile_list(&list, depth + 1, out)?;
        }
        // AUTO scripts play on open, in order; a condition
        // (switch or variable) becomes an `if` around the
        // body. "call" scripts wait for screen_call, with the
        // context stacked.
        self.screen_stack.push(idx);
        for scr in &sc.scripts {
            if scr.trigger != "auto" {
                continue;
            }
            let body = match &scr.cond {
                None => serde_json::Value::Array(scr.commands.clone()),
                Some(c) if c.kind == "switch" => serde_json::json!([{
                    "c": "if_sw",
                    "n": c.n,
                    "on": c.on.unwrap_or(true),
                    "then": scr.commands.clone(),
                    "else": []
                }]),
                Some(c) => serde_json::json!([{
                    "c": "if_var",
                    "n": c.n,
                    "op": c.op.clone().unwrap_or_else(|| "==".to_string()),
                    "value": c.value.unwrap_or(0),
                    "then": scr.commands.clone(),
                    "else": []
                }]),
            };
            let list = body.as_array().cloned().unwrap_or_default();
            self.compile_list(&list, depth + 1, out)?;
        }
        self.screen_stack.pop();
        Ok(())
    }

    // Calls ANOTHER script of the current screen, unrolled
    // inline; MAX_DEPTH guards against call loops.
    fn cmd_screen_call(&mut self, cmd: &Value, out: &mut Vec<String>, depth: usize) -> Result<()> {
        let sname = cmd["script"].as_str().unwrap_or("");
        let sidx = *self.screen_stack.last().with_context(|| {
            "screen_call : uniquement depuis un script \
             d'écran composé"
                .to_string()
        })?;
        let body = self.screens[sidx]
            .scripts
            .iter()
            .find(|sc| sc.name == sname)
            .map(|sc| sc.commands.clone())
            .with_context(|| {
                format!(
                    "screen_call : script '{}' introuvable dans \
                     l'écran '{}'",
                    sname, self.screens[sidx].name
                )
            })?;
        self.compile_list(&body, depth + 1, out)?;
        Ok(())
    }

    // Composed screen: a background plus posed images in slots
    fn cmd_stage_open(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
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
        out.push(format!(
            "  STAGEOPEN {} {} {}",
            id, dur,
            Self::trans_field(cmd)?
        ));
        Ok(())
    }

    fn cmd_stage_pose(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
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
        // Position is in PIXELS for the author and in TILES
        // (x8) in the binary format, rounded to the tile.
        let tx = cmd["x"].as_u64().filter(|&v| v <= 255).unwrap_or(0) / 8;
        let ty = cmd["y"].as_u64().filter(|&v| v <= 216).unwrap_or(0) / 8;
        out.push(format!(
            "  STAGEPOSE {} {} {} {}",
            slot - 1, id, tx, ty
        ));
        Ok(())
    }

    fn cmd_stage_clear(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let slot = cmd["slot"]
            .as_u64()
            .filter(|&v| (1..=5).contains(&v))
            .with_context(|| "stage_clear : slot 1-5".to_string())?;
        out.push(format!("  STAGECLEAR {}", slot - 1));
        Ok(())
    }

    // Animated vignettes (32x32 sprites, 8 slots — H1)
    fn cmd_vig_show(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let slot = cmd["slot"]
            .as_u64()
            .filter(|&v| (1..=8).contains(&v))
            .with_context(|| "vig_show : slot 1-8".to_string())?;
        // The vignette from the list, OR a number read in a variable —
        // the pictures' pattern (H2a): the engine learns indirection,
        // never what the number means.
        let mut flags: u8 = 0;
        let id = match cmd["vig_var"].as_u64() {
            Some(v) => {
                if v > 255 {
                    bail!("vig_show : vig_var = 0-255");
                }
                flags |= 1;
                v as usize
            }
            None => {
                let name = cmd["vig"].as_str().unwrap_or("");
                self.vignettes
                    .iter()
                    .position(|v| v == name)
                    .with_context(|| {
                        format!(
                            "vig_show : vignette '{}' introuvable \
                             (supprimée ou renommée ?)",
                            name
                        )
                    })?
            }
        };
        let anchor = match cmd["anchor"].as_str().unwrap_or("screen") {
            "hero" => 1u8,
            _ => 0,
        };
        let (x, y) = match (cmd["x_var"].as_u64(), cmd["y_var"].as_u64()) {
            (Some(xv), Some(yv)) => {
                if xv > 255 || yv > 255 {
                    bail!("vig_show : x_var/y_var = 0-255");
                }
                flags |= 2;
                (xv as i64, yv as i64)
            }
            (None, None) => (
                cmd["x"].as_i64().filter(|&v| (-128..=255).contains(&v)).unwrap_or(0),
                cmd["y"].as_i64().filter(|&v| (-128..=255).contains(&v)).unwrap_or(0),
            ),
            _ => bail!("vig_show : x_var et y_var vont ensemble"),
        };
        out.push(format!(
            "  VIGSHOW {} {} {} {} {} {}",
            slot - 1, id, (x as u8) as u8, (y as u8) as u8, anchor, flags
        ));
        Ok(())
    }

    fn cmd_vig_play(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let slot = cmd["slot"]
            .as_u64()
            .filter(|&v| (1..=8).contains(&v))
            .with_context(|| "vig_play : slot 1-8".to_string())?;
        let mode = match cmd["mode"].as_str().unwrap_or("loop") {
            "once" => 1u8,
            "stop" => 0,
            _ => 2, // loop
        };
        let spd = cmd["speed"].as_u64().filter(|&v| (1..=60).contains(&v)).unwrap_or(8);
        out.push(format!("  VIGPLAY {} {} {}", slot - 1, mode, spd));
        Ok(())
    }

    // Frame-by-frame animations; the cell sheet is a vignette
    fn cmd_anim_play(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        // The animation from the list, OR a number read in a variable
        // (H2a) — same pattern as pictures and vignettes.
        let mut vflags: u8 = 0;
        let id = match cmd["anim_var"].as_u64() {
            Some(v) => {
                if v > 255 {
                    bail!("anim_play : anim_var = 0-255");
                }
                vflags |= 2;
                v as usize
            }
            None => {
                let name = cmd["anim"].as_str().unwrap_or("");
                self.animations
                    .iter()
                    .position(|a| a == name)
                    .with_context(|| {
                        format!(
                            "anim_play : animation '{}' introuvable \
                             (supprimée ou renommée ?)",
                            name
                        )
                    })?
            }
        };
        // anchor: the screen (offsets around its centre), the
        // hero, or an event of the scene
        let anchor = match cmd["anchor"].as_str().unwrap_or("screen") {
            "hero" => 1u8,
            "event" => 2,
            _ => 0,
        };
        let target = if anchor == 2 {
            match cmd["event"].as_i64() {
                None | Some(-1) => "self".to_string(),
                Some(n) if (0..24).contains(&n) => n.to_string(),
                Some(n) => bail!("anim_play : event {} hors limite (0-23)", n),
            }
        } else {
            "0".to_string()
        };
        let wait: u8 = if cmd["wait"].as_bool().unwrap_or(false) { 1 } else { 0 };
        // screen aim (V2): where a screen-anchored animation lands —
        // the composed-screen centre by default, a target's pixel when
        // the script says so (the library aims skills at monsters).
        // x_var/y_var (H2a): both coordinates read from variables.
        let (x, y) = match (cmd["x_var"].as_u64(), cmd["y_var"].as_u64()) {
            (Some(xv), Some(yv)) => {
                if xv > 255 || yv > 255 {
                    bail!("anim_play : x_var/y_var = 0-255");
                }
                vflags |= 4;
                (xv, yv)
            }
            (None, None) => (
                cmd["x"].as_u64().filter(|&v| v <= 255).unwrap_or(112),
                cmd["y"].as_u64().filter(|&v| v <= 216).unwrap_or(96),
            ),
            _ => bail!("anim_play : x_var et y_var vont ensemble"),
        };
        out.push(format!(
            "  ANIMPLAY {} {} {} {} {} {}",
            id, anchor, target, wait | vflags, x, y
        ));
        Ok(())
    }

    fn cmd_anim_stop(&mut self, out: &mut Vec<String>) -> Result<()> {
        out.push("  ANIMSTOP".to_string());
        Ok(())
    }

    fn cmd_vig_hide(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let slot = cmd["slot"]
            .as_u64()
            .filter(|&v| (1..=8).contains(&v))
            .with_context(|| "vig_hide : slot 1-8".to_string())?;
        out.push(format!("  VIGHIDE {}", slot - 1));
        Ok(())
    }

    fn cmd_slot_fx(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
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
        Ok(())
    }

    /// "Zoom cinematique" (M7-A): ONE author-facing command that chains
    /// the three engine primitives — open, play the ramp to its end,
    /// close. One line in the event list and no way to leave the screen
    /// open by mistake (PLANNING_SYSTEME_MODE7 section 8.4). The
    /// primitives stay available in the assembler for whoever needs them.
    fn cmd_m7(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let img = cmd["image"].as_str().unwrap_or("");
        let id = self.m7_images.iter().position(|a| a == img).with_context(|| {
            format!(
                "m7 : image '{}' introuvable (images mode7 du projet : {})",
                img,
                if self.m7_images.is_empty() {
                    "aucune".to_string()
                } else {
                    self.m7_images.join(", ")
                }
            )
        })?;
        // The zoom lives ON the command; datagen has already collected
        // the distinct ones project-wide, so this is a lookup that cannot
        // miss — unless someone hand-writes a command the scan never saw.
        let want = crate::mode7::Ramp::from_command(cmd)
            .context("m7 : commande mal formee")?;
        let ramp = self
            .m7_ramps
            .iter()
            .position(|r| *r == want)
            .context("m7 : rampe non collectee (bug datagen, pas un probleme de projet)")?;
        let dur = cmd["dur"].as_u64().filter(|&v| v <= 255).unwrap_or(20);
        out.push(format!("  M7OPEN {} {}", id, dur));
        // flags bit 1 = wait for the end. The composite command ALWAYS
        // waits: closing before the zoom finished would show nothing, and
        // a looping ramp would never let the close happen — which is why
        // loop is only reachable through the primitives.
        out.push(format!("  M7ZOOM {} 2", ramp));
        out.push(format!("  M7CLOSE {}", dur));
        Ok(())
    }

    /// `m7_view` — the world map's CAMERA ANGLE, mid-game.
    fn cmd_m7_view(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let (horizon, anchor) = m7_view_preset(cmd)?;
        out.push(format!("  M7VIEW {} {}", horizon, anchor));
        Ok(())
    }

    /// `btl_pose` — a hero's battler cell on the composed screen (V1).
    /// Blocking while the session's first show uploads the cell.
    fn cmd_btl_pose(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        // `hero` was the old name of the slot (V1) — kept as a fallback
        // so a project written before G1 still compiles.
        let slot = cmd["slot"]
            .as_u64()
            .or_else(|| cmd["hero"].as_u64())
            .filter(|&v| v < 4)
            .with_context(|| "btl_pose : emplacement 0-3".to_string())?;
        // Which entry of the `heroes` table the slot shows: from a
        // VARIABLE (a party that changes), or a symbolic id, or its
        // index; the default is the slot's own number.
        if let Some(v) = cmd["entry_var"].as_u64() {
            if v > 255 {
                bail!("btl_pose : entry_var 0-255");
            }
            let show = cmd["show"].as_bool().unwrap_or(true);
            let x = cmd["x"].as_u64().filter(|&n| n <= 255).unwrap_or(200);
            let y = cmd["y"].as_u64().filter(|&n| n <= 216).unwrap_or(40);
            out.push(format!("  BTLPOSE {} 1 {} {} {} {}", slot, v, x, y, show as u8));
            return Ok(());
        }
        let entry = match cmd["entry"].as_str() {
            Some(id) => {
                let dbr = self.db.with_context(|| {
                    "btl_pose : le projet n'a pas de database (schemas/)".to_string()
                })?;
                let ti = dbr.table_id("heroes").with_context(|| {
                    "btl_pose : la database n'a pas de table « heroes »".to_string()
                })?;
                dbr.entry_index(ti, id).with_context(|| {
                    format!("btl_pose : « {} » absent de la table heroes", id)
                })? as u64
            }
            None => cmd["entry"].as_u64().filter(|&v| v < 256).unwrap_or(slot),
        };
        let show = cmd["show"].as_bool().unwrap_or(true);
        let x = cmd["x"].as_u64().filter(|&v| v <= 255).unwrap_or(200);
        let y = cmd["y"].as_u64().filter(|&v| v <= 216).unwrap_or(40);
        out.push(format!("  BTLPOSE {} 0 {} {} {} {}", slot, entry, x, y, show as u8));
        Ok(())
    }

    /// `popup` — a number in white digits over the composed screen
    /// (V1), from a constant or a variable.
    fn cmd_popup(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let (src, value) = match cmd["value_var"].as_u64() {
            Some(v) => {
                if v > 255 {
                    bail!("popup : value_var 0-255");
                }
                (1u8, v)
            }
            None => (0u8, cmd["value"].as_u64().filter(|&v| v <= 9999).unwrap_or(0)),
        };
        let x = cmd["x"].as_u64().filter(|&v| v <= 255).unwrap_or(112);
        let y = cmd["y"].as_u64().filter(|&v| v <= 216).unwrap_or(96);
        out.push(format!("  POPUP {} {} {} {}", src, value, x, y));
        Ok(())
    }

    /// `clock` — the gauge clock (V1): n lanes of (gauge, speed)
    /// variable pairs from base; 0 lanes stops the service.
    fn cmd_clock(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let base = cmd["base"]
            .as_u64()
            .filter(|&v| v < 256)
            .with_context(|| "clock : base 0-255".to_string())?;
        let lanes = cmd["lanes"]
            .as_u64()
            .filter(|&v| v <= 8)
            .with_context(|| "clock : lanes 0-8".to_string())?;
        if lanes > 0 && base + lanes * 2 > 256 {
            bail!(
                "clock : base {} + {} paires (jauge, vitesse) déborde des \
                 256 variables",
                base,
                lanes
            );
        }
        out.push(format!("  CLOCK {} {}", base, lanes));
        Ok(())
    }

    /// `target_sel` — the target cursor (V1): walks the stage's
    /// occupied slots (or the posed party), pick into a variable.
    fn cmd_target_sel(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let var = cmd["var"]
            .as_u64()
            .filter(|&v| v < 256)
            .with_context(|| "target_sel : var 0-255".to_string())?;
        let ally = cmd["ally"].as_bool().unwrap_or(false);
        let cancel = cmd["cancel"].as_bool().unwrap_or(true);
        let flags = ally as u8 | (cancel as u8) << 1;
        out.push(format!("  TARGETSEL {} {}", var, flags));
        Ok(())
    }

    /// `save_slot` / `load_slot` / `slot_info` — the SRAM primitive
    /// (M2). The menus around it are the project's events.
    fn cmd_sram(&mut self, cmd: &Value, out: &mut Vec<String>, op: u8) -> Result<()> {
        let slot = cmd["slot"]
            .as_u64()
            .filter(|&v| (1..=4).contains(&v))
            .with_context(|| "sauvegarde : slot 1-4".to_string())?;
        let var = if op == 2 {
            cmd["var"]
                .as_u64()
                .filter(|&v| v < 256)
                .with_context(|| "slot_info : var 0-255".to_string())?
        } else {
            0
        };
        out.push(format!("  SRAM {} {} {}", op, slot - 1, var));
        Ok(())
    }

    /// `m7_rot` — turns the world map's plane around the hero.
    fn cmd_m7_rot(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let step = cmd["step"].as_u64().unwrap_or(0);
        if step > 63 {
            bail!(
                "m7_rot : cran {} — 64 crans au maximum (0-63) ; le moteur \
                 ramene le cran au nombre de crans de la scene",
                step
            );
        }
        out.push(format!("  M7ROT {}", step));
        Ok(())
    }

    /// `m7_turn` — an ANIMATED rotation: the engine walks the steps.
    fn cmd_m7_turn(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let step = cmd["step"].as_u64().unwrap_or(0);
        if step > 63 {
            bail!("m7_turn : cran {} — 64 crans au maximum (0-63)", step);
        }
        let frames = cmd["frames"].as_u64().filter(|&v| v <= 255).unwrap_or(30);
        let wait = if cmd["wait"].as_bool().unwrap_or(true) { 2 } else { 0 };
        out.push(format!("  M7TURN {} {} {}", step, frames, wait));
        Ok(())
    }

    fn cmd_stage_close(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let dur = cmd["dur"].as_u64().filter(|&v| v <= 255).unwrap_or(20);
        out.push(format!(
            "  STAGECLOSE {} {}",
            dur,
            Self::trans_field(cmd)?
        ));
        Ok(())
    }

    // Play a BRR sound effect; non-blocking
    fn cmd_sfx(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
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
        Ok(())
    }

    // Change the music ("" is silence); non-blocking, and the
    // scene's own music resumes at the next warp
    fn cmd_bgm(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
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
        Ok(())
    }

    // Spotlight: a circle of light around the hero
    fn cmd_spotlight(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let rad = cmd["radius"]
            .as_u64()
            .filter(|&v| v == 0 || (16..=96).contains(&v))
            .unwrap_or(0);
        let dark = cmd["dark"].as_u64().filter(|&v| (1..=31).contains(&v)).unwrap_or(31);
        out.push(format!("  SPOTLIGHT {} {}", rad, dark));
        Ok(())
    }

    // Sky gradient: a vertical tint, top to bottom
    fn cmd_skygrad(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
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
        Ok(())
    }

    // Screen ripple (HDMA); power 0 stops it
    fn cmd_wave(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let pow = cmd["power"].as_u64().filter(|&v| v <= 7).unwrap_or(0);
        let spd = cmd["speed"].as_u64().filter(|&v| (1..=8).contains(&v)).unwrap_or(2);
        out.push(format!("  WAVE {} {}", pow, spd));
        Ok(())
    }

    // Particle weather (RM2003 Weather Effects): persists
    // across scenes until the next change
    fn cmd_weather(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let kind = match cmd["kind"].as_str().unwrap_or("off") {
            "off" => 0u8,
            "rain" => 1,
            "snow" => 2,
            o => bail!("weather : type inconnu « {} » (off, rain, snow)", o),
        };
        let pow = cmd["power"].as_u64().filter(|&v| (1..=3).contains(&v)).unwrap_or(2);
        out.push(format!("  WEATHER {} {}", kind, pow));
        Ok(())
    }

    fn cmd_flash(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let comp = |key: &str| -> u64 {
            cmd[key].as_u64().map(|v| v.min(31)).unwrap_or(31)
        };
        let frames = cmd["frames"].as_u64().filter(|&v| (1..=255).contains(&v)).unwrap_or(8);
        out.push(format!(
            "  FLASH {} {} {} {}",
            comp("r"), comp("g"), comp("b"), frames
        ));
        Ok(())
    }

    fn cmd_shake(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let power = cmd["power"].as_u64().filter(|&v| v <= 8).unwrap_or(4);
        let speed = cmd["speed"].as_u64().filter(|&v| (1..=8).contains(&v)).unwrap_or(2);
        let frames = cmd["frames"].as_u64().filter(|&v| v <= 255).unwrap_or(30);
        out.push(format!("  SHAKE {} {} {}", power, speed, frames));
        Ok(())
    }

    fn cmd_if_sw_var(&mut self, cmd: &Value, out: &mut Vec<String>, c: &str, depth: usize) -> Result<()> {
        let then_l = self.label("alors");
        let end = self.label("finsi");
        if c == "if_sw" {
            let n = Self::idx_field(cmd, "n", 512)?;
            let on = cmd["on"].as_bool().unwrap_or(true);
            out.push(format!("  JSW {} {} {}", n, if on { 1 } else { 0 }, then_l));
        } else {
            let ops = match cmd["op"].as_str().unwrap_or("==") {
                "==" => "==",
                "!=" => "!=",
                ">=" => ">=",
                o => bail!("if_var : operateur inconnu « {} » (==, !=, >=)", o),
            };
            // Both sides are general sources. The HISTORICAL
            // form is still accepted — "n" on the left, a
            // constant "value" on the right — so projects that
            // predate "left"/"right" keep working. The editor
            // always writes the full form.
            let (la, lv) = match cmd.get("left") {
                Some(l) if l.is_object() => self.value_source(l, "if_var")?,
                _ => ("var", Self::idx_field(cmd, "n", 256)? as i64),
            };
            let (ra, rv) = match cmd.get("right") {
                Some(r) if r.is_object() => self.value_source(r, "if_var")?,
                _ => (
                    "const",
                    cmd["value"]
                        .as_i64()
                        .filter(|&v| (-32768..=65535).contains(&v))
                        .with_context(|| {
                            format!("if_var : valeur invalide : {}", cmd)
                        })?,
                ),
            };
            out.push(format!(
                "  JCMP16 {} {} {} {} {} {}",
                la, lv, ops, ra, rv, then_l
            ));
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
        Ok(())
    }

    fn cmd_wait(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let n = Self::u8_field(cmd, "frames")?;
        out.push(format!("  WAIT {}", n));
        Ok(())
    }

    // RM2003 loop: head label, body, jump back. "break" jumps
    // to the end label of the innermost loop. A loop with no
    // blocking command runs 32 ops per frame — the VM yields
    // (spec §2).
    fn cmd_loop(&mut self, cmd: &Value, out: &mut Vec<String>, depth: usize) -> Result<()> {
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
        Ok(())
    }

    fn cmd_break(&mut self, out: &mut Vec<String>) -> Result<()> {
        let end = self
            .loop_ends
            .last()
            .context("« Sortir de la boucle » hors d'une boucle")?;
        out.push(format!("  JMP {}", end));
        Ok(())
    }

    // Read a database field into a variable:
    // {"c":"db_read","table":"stats","from":"const"|"var",
    //  "entry":"slime"|<variable number>,"field":"attack","dst":n}
    fn cmd_db_read(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
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
        Ok(())
    }

    /// `db_entry` — the NUMBER of a database entry into a variable.
    /// No opcode of its own: the index is resolved here, so this is a
    /// plain "variable = constant". The author names the row; renaming
    /// or moving it later never silently shifts a script.
    fn cmd_db_entry(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let dbr = self.db.with_context(|| {
            "db_entry : le projet n'a pas de database (schemas/)".to_string()
        })?;
        let table = cmd["table"].as_str().context("db_entry sans table")?;
        let ti = dbr.table_id(table).with_context(|| {
            format!("db_entry : table inconnue « {} »", table)
        })?;
        let id = cmd["entry"].as_str().with_context(|| {
            format!("db_entry : entry (id symbolique de {})", table)
        })?;
        let idx = dbr.entry_index(ti, id).with_context(|| {
            format!("db_entry : « {} » absent de la table {}", id, table)
        })?;
        let dst = Self::idx_field(cmd, "dst", 256)?;
        // VAROP, not SETVAR: the 16-bit variable space is 0-255
        out.push(format!("  VAROP {} = const {}", dst, idx));
        Ok(())
    }

    // Call a common event (CALL/RET, stack of 8)
    fn cmd_call(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
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
        Ok(())
    }

    // Call a FUNCTION: arguments are evaluated in the
    // CALLER's frame, the return value stored if wanted
    fn cmd_call_fn(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let n = cmd["n"]
            .as_u64()
            .filter(|&n| (n as usize) < self.fn_sigs.len())
            .with_context(|| {
                format!(
                    "call_fn : fonction inexistante ({} definies) : {}",
                    self.fn_sigs.len(),
                    cmd
                )
            })? as usize;
        let (nparams, nlocals, returns) = self.fn_sigs[n];
        let args = cmd["args"].as_array().map(|v| v.as_slice()).unwrap_or(&[]);
        if args.len() != nparams {
            bail!(
                "call_fn : la fonction {} attend {} parametre(s), \
                 {} fourni(s)",
                n + 1,
                nparams,
                args.len()
            );
        }
        // nslots is arguments plus locals of the CALLEE: the
        // frame it will occupy. The engine zeroes the slots
        // past the arguments.
        let mut line = format!(
            "  CALLF __fn{}_{} {}",
            n,
            self.cur_scene,
            nparams + nlocals
        );
        for a in args {
            let (st, val) = self.value_source(a, "call_fn")?;
            line.push_str(&format!(" {} {}", st, val));
        }
        self.used_fns[n] = true;
        out.push(line);
        // "store the result" is sugar for CALLF + VAROP — the
        // common case, and the one we do not want anyone
        // writing by hand in the editor
        if let Some(dst) = cmd["dst"].as_u64() {
            if !returns {
                bail!(
                    "call_fn : la fonction {} ne rend aucune valeur, \
                     il n'y a rien a ranger",
                    n + 1
                );
            }
            if dst >= 256 {
                bail!("call_fn : variable destination {} hors limite", dst);
            }
            out.push(format!("  VAROP {} = ret 0", dst));
        }
        Ok(())
    }

    // Return a value and leave the function
    fn cmd_ret_fn(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        match self.cur_fn {
            None => bail!(
                "« Retourner » n'a de sens que dans une fonction : \
                 ailleurs, il n'y a personne a qui rendre la valeur"
            ),
            Some((_, _, false)) => bail!(
                "« Retourner » : cette fonction est declaree sans \
                 valeur de retour — cocher la case, ou retirer la \
                 commande"
            ),
            Some(_) => {}
        }
        let (st, val) = self.value_source(cmd, "ret_fn")?;
        out.push(format!("  RETF {} {}", st, val));
        Ok(())
    }

    fn cmd_wait_route(&mut self, out: &mut Vec<String>) -> Result<()> {
        out.push("  WAITROUTE".to_string());
        Ok(())
    }

    fn cmd_route(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        // {"c":"route","event":-1|n,"repeat":b,"skip":b,
        //  "steps":[{"s":"up"}|{"s":"wait","n":2}...]}
        // event -1 means "this event", resolved by
        // compile_scene through self_actor — the entry index
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
        Ok(())
    }

    // Scripted positions (RM2003 memorise/recall)
    fn cmd_hero_loc(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        // writes the hero's scene/X/Y into three 16-bit variables
        let vs = Self::idx_field(cmd, "vs", 256)?;
        let vx = Self::idx_field(cmd, "vx", 256)?;
        let vy = Self::idx_field(cmd, "vy", 256)?;
        out.push(format!("  VAROP {} = scene 0", vs));
        out.push(format!("  VAROP {} = hx 0", vx));
        out.push(format!("  VAROP {} = hy 0", vy));
        Ok(())
    }

    fn cmd_warp_var(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let vs = Self::idx_field(cmd, "vs", 256)?;
        let vx = Self::idx_field(cmd, "vx", 256)?;
        let vy = Self::idx_field(cmd, "vy", 256)?;
        out.push(format!(
            "  WARPV {} {} {} {}",
            vs, vx, vy,
            Self::trans_field(cmd)?
        ));
        Ok(())
    }

    fn cmd_setpos(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
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
        Ok(())
    }

    fn cmd_swappos(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let ev = |key: &str| -> Result<String> {
            Ok(match cmd[key].as_i64() {
                None | Some(-1) => "self".to_string(),
                Some(n) if (0..24).contains(&n) => n.to_string(),
                Some(n) => bail!("swappos : event {} hors limite (0-23)", n),
            })
        };
        out.push(format!("  SWAPPOS {} {}", ev("a")?, ev("b")?));
        Ok(())
    }

    fn cmd_warp(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let to = cmd["to"].as_str().context("warp sans scene cible")?;
        out.push(format!(
            "  WARP {} {} {} {}",
            to,
            Self::u8_field(cmd, "x")?,
            Self::u8_field(cmd, "y")?,
            Self::trans_field(cmd)?
        ));
        Ok(())
    }

    fn cmd_face(&mut self, cmd: &Value, out: &mut Vec<String>) -> Result<()> {
        let dir = cmd["dir"].as_str().context("face sans direction")?;
        out.push(format!("  FACE {} {}", Self::u8_field(cmd, "event")?, dir));
        Ok(())
    }
}

/// The camera-angle PRESETS of a world map, shared by the scene field
/// and the `m7_view` command.
///
/// Named rather than numeric because "horizon 88, anchor 168" describes
/// nothing to an author, while "rasante" does. The two numbers stay
/// reachable through `preset: "custom"` for anyone who wants them — the
/// engine takes lines, not names, so nothing is lost either way.
///
/// The gap between the two IS the tilt: 176 lines is nearly top-down,
/// 56 is a low raking view. Under 16 the vertical scale leaves its 8.8
/// register and the whole screen turns to sky.
pub fn m7_view_preset(cmd: &Value) -> Result<(u8, u8)> {
    let preset = cmd["preset"].as_str().unwrap_or("standard");
    let (h, a) = match preset {
        "plongeante" => (24u8, 200u8), /* gap 176 — almost top-down */
        "standard" => (56, 176),       /* gap 120 — the default */
        "rasante" => (88, 168),        /* gap 80 */
        "tres_rasante" => (104, 160),  /* gap 56 — F-Zero territory */
        "custom" => {
            let h = cmd["horizon"].as_u64().unwrap_or(56);
            let a = cmd["anchor"].as_u64().unwrap_or(176);
            if h > 180 {
                bail!("m7_view : horizon {} — maximum 180 (l'ecran fait 224 lignes)", h);
            }
            if a > 216 {
                bail!("m7_view : ancrage {} — maximum 216 (le heros y tient debout)", a);
            }
            if a < h + 16 {
                bail!(
                    "m7_view : ancrage {} pour un horizon {} — il faut au moins 16 \
                     lignes d'ecart, sinon tout l'ecran devient ciel",
                    a, h
                );
            }
            (h as u8, a as u8)
        }
        other => bail!(
            "m7_view : angle '{}' inconnu — attendu plongeante, standard, \
             rasante, tres_rasante ou custom",
            other
        ),
    };
    Ok((h, a))
}

#[cfg(test)]
mod m7_view_tests {
    use super::*;

    fn cmd(s: &str) -> Value {
        serde_json::from_str(s).unwrap()
    }

    #[test]
    fn the_default_preset_is_the_engines_own_angle() {
        assert_eq!(m7_view_preset(&cmd(r#"{}"#)).unwrap(), (56, 176));
    }

    #[test]
    fn a_raking_preset_tilts_more_than_a_plunging_one() {
        let (hp, ap) = m7_view_preset(&cmd(r#"{"preset":"plongeante"}"#)).unwrap();
        let (hr, ar) = m7_view_preset(&cmd(r#"{"preset":"rasante"}"#)).unwrap();
        assert!(ap - hp > ar - hr, "the gap IS the tilt");
    }

    #[test]
    fn a_custom_angle_too_flat_to_render_is_refused() {
        let e = m7_view_preset(&cmd(r#"{"preset":"custom","horizon":100,"anchor":110}"#));
        assert!(e.is_err());
    }

    #[test]
    fn an_unknown_preset_names_the_ones_that_exist() {
        let e = m7_view_preset(&cmd(r#"{"preset":"oblique"}"#)).unwrap_err().to_string();
        assert!(e.contains("rasante"), "{}", e);
    }
}
