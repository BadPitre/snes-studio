//! VM script assembler (spec §2): text with labels to bytecode.
//!
//! Syntax is one instruction per line, `;` starts a comment:
//!   label:
//!     END
//!     MSG <text_name>
//!     SETVAR v<n> <val>      ADDVAR v<n> <val>      SETGVAR g<n> <val>
//!     JMP <label>
//!     JEQ v<n> <val> <label> JNE v<n> <val> <label> JGEQ v<n> <val> <label>
//!     CHOICE v<n> <text1> <text2> [<text3>] [<text4>]
//!     WARP <scene> <x> <y>   ; teleports the hero; ends the script
//!     FACE <actor> <dir>     ; turns actor n (down/up/left/right)
//!     SW <n> 0|1             ; switch n (0-511) OFF/ON
//!     JSW <n> 0|1 <label>    ; jump if switch n equals 0|1
//!     SET16 <n> <val>        ; 16-bit variable n (0-255) = val
//!     ADD16 <n> <val>        ; += val (negative allowed, 16-bit wrap)
//!     JCMP16 <n> ==|!=|>= <val> <label> ; jump if the comparison holds
//!
//! Variables: v<n> is a scene variable, g<n> a global one, persistent
//! across scenes. Both are accepted wherever a variable is expected —
//! bit 0x80 of the variable byte marks it global. SETGVAR is the
//! historical alias for SETVAR g<n>.
//!
//! Two passes: sizes and labels, then emission with resolved offsets.

use anyhow::{bail, Context, Result};
use std::collections::HashMap;

pub struct Assembled {
    pub bytecode: Vec<u8>,
    pub labels: HashMap<String, u16>,
}

// Opcodes — spec §2, the contractual table
const OP_END: u8 = 0x00;
const OP_MSG: u8 = 0x01;
const OP_SETVAR: u8 = 0x02;
const OP_ADDVAR: u8 = 0x03;
const OP_JMP: u8 = 0x04;
const OP_JEQ: u8 = 0x05;
const OP_JNE: u8 = 0x06;
const OP_SETGVAR: u8 = 0x07;
const OP_JGEQ: u8 = 0x08;
const OP_CHOICE: u8 = 0x09;
const OP_WARP: u8 = 0x0A;
const OP_FACE: u8 = 0x0B;
const OP_SW: u8 = 0x0C;
const OP_JSW: u8 = 0x0D;
const OP_SET16: u8 = 0x0E;
const OP_ADD16: u8 = 0x0F;
const OP_JCMP16: u8 = 0x10;
const OP_ROUTE: u8 = 0x11;
const OP_WAITROUTE: u8 = 0x12;
const OP_WAIT: u8 = 0x13;
const OP_VAROP: u8 = 0x14;
const OP_TIMER: u8 = 0x15;
const OP_CAMPAN: u8 = 0x16;
const OP_CAMRET: u8 = 0x17;
const OP_WAITCAM: u8 = 0x18;
const OP_WARPV: u8 = 0x19;
const OP_SETPOS: u8 = 0x1A;
const OP_SWAPPOS: u8 = 0x1B;
const OP_SCRHIDE: u8 = 0x1C;
const OP_SCRSHOW: u8 = 0x1D;
const OP_TINT: u8 = 0x1E;
const OP_FLASH: u8 = 0x1F;
const OP_SHAKE: u8 = 0x20;
const OP_CALL: u8 = 0x21;
const OP_RET: u8 = 0x22;
const OP_DBREAD: u8 = 0x23;
const OP_SHOWUI: u8 = 0x24;
const OP_KEYIN: u8 = 0x25;
const OP_DLGSTYLE: u8 = 0x27;
const OP_SHOWPIC: u8 = 0x28;
const OP_HIDEPIC: u8 = 0x29;
const OP_MOVEPIC: u8 = 0x2A;
const OP_TINTG: u8 = 0x2B;
const OP_WEATHER: u8 = 0x2C;
const OP_WAVE: u8 = 0x2D;
const OP_SKYGRAD: u8 = 0x2E;
const OP_SPOTLIGHT: u8 = 0x2F;
const OP_PLAYSFX: u8 = 0x30;
const OP_PLAYBGM: u8 = 0x31;
const OP_STAGEOPEN: u8 = 0x32;
const OP_STAGEPOSE: u8 = 0x33;
const OP_STAGECLEAR: u8 = 0x34;
const OP_STAGECLOSE: u8 = 0x35;
const OP_SLOTFX: u8 = 0x36;
const OP_VIGSHOW: u8 = 0x37;
const OP_VIGPLAY: u8 = 0x38;
const OP_VIGHIDE: u8 = 0x39;
const OP_LISTSEL: u8 = 0x3A;
const OP_ANIMPLAY: u8 = 0x3B;
const OP_ANIMSTOP: u8 = 0x3C;
const OP_CALLF: u8 = 0x3D;
const OP_RETF: u8 = 0x3E;
const OP_SETLOC: u8 = 0x3F;
const OP_M7OPEN: u8 = 0x40;
const OP_M7ZOOM: u8 = 0x41;
const OP_M7CLOSE: u8 = 0x42;
const OP_M7VIEW: u8 = 0x43;
const OP_M7ROT: u8 = 0x44;
const OP_M7TURN: u8 = 0x45;
const OP_BTLPOSE: u8 = 0x47;
const OP_POPUP: u8 = 0x48;
const OP_CLOCK: u8 = 0x49;
const OP_TARGETSEL: u8 = 0x4A;
const OP_SRAM: u8 = 0x4B;

/// Encodes one route step to bytes (spec §2 v0.13, the full Move Route).
/// swon:/swoff: carry a u16, gfx: a u8 — a local slot, remapped from the
/// project block to the scene's sprite set.
fn route_step(tok: &str, remap: &HashMap<u8, u8>) -> Result<Vec<u8>> {
    Ok(match tok {
        "down" => vec![0x00],
        "up" => vec![0x01],
        "left" => vec![0x02],
        "right" => vec![0x03],
        "mrand" => vec![0x04],
        "mhero" => vec![0x05],
        "mflee" => vec![0x06],
        "fwd" => vec![0x07],
        "tdown" => vec![0x10],
        "tup" => vec![0x11],
        "tleft" => vec![0x12],
        "tright" => vec![0x13],
        "t90r" => vec![0x14],
        "t90l" => vec![0x15],
        "t180" => vec![0x16],
        "t90x" => vec![0x17],
        "trand" => vec![0x18],
        "face" => vec![0x19],
        "tflee" => vec![0x1A],
        "spd+" => vec![0x20],
        "spd-" => vec![0x21],
        "frq+" => vec![0x22],
        "frq-" => vec![0x23],
        "fixon" => vec![0x28],
        "fixoff" => vec![0x29],
        "thruon" => vec![0x2A],
        "thruoff" => vec![0x2B],
        w if w.starts_with("swon:") || w.starts_with("swoff:") => {
            let (op, num) = if let Some(n) = w.strip_prefix("swon:") {
                (0x50u8, n)
            } else {
                (0x51u8, w.strip_prefix("swoff:").unwrap())
            };
            let idx: u16 = num
                .parse()
                .ok()
                .filter(|&n| n < 512)
                .with_context(|| format!("switch invalide : '{}'", w))?;
            vec![op, idx as u8, (idx >> 8) as u8]
        }
        g if g.starts_with("gfx:") => {
            let block: u8 = g[4..]
                .parse()
                .with_context(|| format!("bloc invalide : '{}'", g))?;
            let slot = *remap.get(&block).with_context(|| {
                format!(
                    "gfx:{} — bloc absent du sprite set de la scene (il doit \
                     etre porte par un event de la scene ou compte via les \
                     pas gfx)",
                    block
                )
            })?;
            vec![0x52, slot]
        }
        w if w.starts_with('w') => {
            let n: u8 = w[1..]
                .parse()
                .with_context(|| format!("pas d'attente invalide : '{}'", w))?;
            if n == 0 || n > 15 {
                bail!("attente w<n> : n entre 1 et 15 (x8 frames), recu {}", n);
            }
            vec![0x40 | n]
        }
        other => bail!("pas d'itineraire inconnu : '{}'", other),
    })
}

/// Byte size of a step token (pass 1).
fn route_step_size(tok: &str) -> u16 {
    if tok.starts_with("swon:") || tok.starts_with("swoff:") {
        3
    } else if tok.starts_with("gfx:") {
        2
    } else {
        1
    }
}

/// The "global variable" bit of the variable byte (spec §2 v0.6).
const VAR_GLOBAL: u8 = 0x80;

enum Line<'a> {
    Label(&'a str),
    Op(&'a str, Vec<&'a str>),
}

fn parse_lines(source: &[String]) -> Result<Vec<Line<'_>>> {
    let mut out = Vec::new();
    for raw in source {
        let line = raw.split(';').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }
        if let Some(name) = line.strip_suffix(':') {
            let name = name.trim();
            if name.is_empty() || name.contains(char::is_whitespace) {
                bail!("label invalide : '{}'", raw);
            }
            out.push(Line::Label(name));
        } else {
            let mut it = line.split_whitespace();
            let op = it.next().unwrap();
            out.push(Line::Op(op, it.collect()));
        }
    }
    Ok(out)
}

fn op_size(op: &str, args: &[&str]) -> Result<u16> {
    let argc = args.len();
    Ok(match op {
        "END" => 1,
        "MSG" | "SETVAR" | "ADDVAR" | "SETGVAR" | "JMP" => 3,
        "JEQ" | "JNE" | "JGEQ" => 5,
        "WARP" => 5,
        "FACE" => 3,
        "SW" | "SET16" | "ADD16" => 4,
        "JSW" => 6,
        "JCMP16" => 10,
        // RTBLOB <r> <s> <freq> <steps...>: a custom route blob —
        // [flags][freq][len] then the steps. DATA, never executed.
        "RTBLOB" => {
            if argc < 4 {
                bail!("RTBLOB <repeat 0|1> <skip 0|1> <freq 1-8> <pas...>");
            }
            3 + args[3..].iter().map(|t| route_step_size(t)).sum::<u16>()
        }
        "WAITROUTE" => 1,
        "WAIT" => 2,
        "VAROP" => 6,
        "TIMER" => 4,
        "CAMPAN" => 4,
        "CAMRET" => 2,
        "WAITCAM" => 1,
        "WARPV" => 5,
        "SETPOS" => 5,
        "SWAPPOS" => 3,
        "SCRHIDE" | "SCRSHOW" => 3,
        "TINT" | "FLASH" => 5,
        // TINTG <off|add|sub> <r> <g> <b> <dur> — gradual tint
        "TINTG" => 6,
        // WEATHER <0-2> <1-3> — particle weather
        "WEATHER" => 3,
        // WAVE <power 0-7> <speed 1-8> — HDMA ripple
        "WAVE" => 3,
        // SKYGRAD <off|add|sub> <r0> <g0> <b0> <r1> <g1> <b1> — sky gradient
        "SKYGRAD" => 8,
        // SPOTLIGHT <radius 0|16-96> <dark 1-31> — circle of light
        "SPOTLIGHT" => 3,
        // PLAYSFX <id> — play a BRR sound
        "PLAYSFX" => 2,
        // PLAYBGM <id|255> — change the music; 255 is silence
        "PLAYBGM" => 2,
        // STAGEOPEN <pic|255> <dur> <trans> — composed screen
        "STAGEOPEN" => 4,
        // STAGEPOSE <slot 0-4> <pic> <tx> <ty> — pose an image
        "STAGEPOSE" => 5,
        // STAGECLEAR <slot 0-4> — remove the slot's image
        "STAGECLEAR" => 2,
        // STAGECLOSE <dur> <trans> — close the composed screen
        "STAGECLOSE" => 3,
        // SLOTFX <slot 0-4> <fx 0-3> <dur> — palette effect on a slot
        "SLOTFX" => 4,
        // VIGSHOW <slot 0-1> <vig> <x> <y> <anchor> — vignette
        "VIGSHOW" => 6,
        // VIGPLAY <slot 0-1> <mode 0-2> <speed> — animate it
        "VIGPLAY" => 4,
        // VIGHIDE <slot 0-1> — hide the vignette
        "VIGHIDE" => 2,
        // LISTSEL <widget> <var> <flags> — cursor menu
        "LISTSEL" => 4,
        // ANIMPLAY <anim> <anchor 0-2> <target> <flags bit0 = wait>
        // <x> <y> — screen-anchor aim point (V2)
        "ANIMPLAY" => 7,
        // ANIMSTOP — stop every running animation
        "ANIMSTOP" => 1,
        // M7OPEN <img> <dur> — Mode 7 screen (M7-A)
        "M7OPEN" => 3,
        // M7ZOOM <ramp|255> <flags bit0 = loop, bit1 = wait> — zoom ramp
        "M7ZOOM" => 3,
        // M7CLOSE <dur> — close it (internal warp back to the scene)
        "M7CLOSE" => 2,
        // M7VIEW <horizon> <ancrage> — the world map camera angle
        "M7VIEW" => 3,
        // M7ROT <cran 0-63> — world map rotation, masked by the map at run time
        "M7ROT" => 2,
        // M7TURN <cran> <frames> <flags> — animated world map rotation
        "M7TURN" => 4,
        // BTLPOSE <slot 0-3> <src 0|1> <entry> <x> <y> <op 0|1>
        "BTLPOSE" => 7,
        // POPUP <src 0|1> <value u16> <x> <y> — digit popup (V1)
        "POPUP" => 6,
        // CLOCK <base> <n 0-8> — the gauge clock (V1)
        "CLOCK" => 3,
        // TARGETSEL <var> <flags> — the target cursor (V1), blocking
        "TARGETSEL" => 3,
        // SRAM <op 0|1|2> <slot 0-3> <var> — save / load / exists (M2)
        "SRAM" => 4,
        "SHAKE" => 4,
        "CALL" => 3,
        "RET" => 1,
        // CALLF <label> <nslots> <st0> <v0> ...: a function call —
        // opcode, u16 label, u8 argc, u8 nslots, then 3 bytes per
        // argument
        "CALLF" => {
            if argc < 2 || argc % 2 != 0 {
                bail!("CALLF <label> <nslots> puis des couples <source> <valeur>");
            }
            5 + 3 * ((argc as u16 - 2) / 2)
        }
        // SETLOC <slot> <op> <source> <value>: writes a local
        "SETLOC" => 6,
        // RETF <source> <value>: return with a value
        "RETF" => 4,
        "DBREAD" => 7,
        // SHOWUI <widget> <0|1>: visibility of a UI widget
        "SHOWUI" => 3,
        // KEYIN <wait> <masklo> <maskhi> <var>: Key Input
        "KEYIN" => 5,
        // DLGSTYLE <n>: style of the next dialogue box
        "DLGSTYLE" => 2,
        // SHOWPIC <pic> <x> <y> <flags> <dur> / HIDEPIC <dur> /
        // MOVEPIC <x> <y> <flags> <dur> — pictures
        "SHOWPIC" => 6,
        "HIDEPIC" => 2,
        "MOVEPIC" => 5,
        // CETAB <a|p> <sw> <lbl> ...: the AUTO and PARALLEL common event
        // table — [n] then n x [type u8][switch u16][offset u16]. DATA,
        // and it sits at the HEAD of the script block (offset 0).
        "CETAB" => {
            if argc % 3 != 0 {
                bail!("CETAB <a|p> <switch> <label> ... (triplets)");
            }
            1 + 5 * (argc as u16 / 3)
        }
        // ROUTE <actor> <r> <s> <freq> <steps...>: 5 header bytes
        "ROUTE" => {
            if argc < 5 {
                bail!("ROUTE <acteur> <repeat 0|1> <skip 0|1> <freq 1-8> <pas...>");
            }
            5 + args[4..].iter().map(|t| route_step_size(t)).sum::<u16>()
        }
        // CHOICE v<n> <text>...: opcode, variable, count, count x u16
        "CHOICE" => {
            if argc < 3 || argc > 5 {
                bail!("CHOICE v<n> <texte1> <texte2> [<texte3>] [<texte4>] (2 a 4 choix)");
            }
            (3 + 2 * (argc as u16 - 1)) as u16
        }
        other => bail!("opcode inconnu : '{}'", other),
    })
}

fn parse_var(tok: &str, prefix: char) -> Result<u8> {
    let n: u8 = tok
        .strip_prefix(prefix)
        .with_context(|| format!("attendu {}<n>, trouvé '{}'", prefix, tok))?
        .parse()
        .with_context(|| format!("numéro de variable invalide : '{}'", tok))?;
    if n > 63 {
        bail!("variable {} hors limite (0-63)", tok);
    }
    Ok(n)
}

/// A variable operand: v<n> (scene) or g<n> (global, bit 0x80).
fn parse_any_var(tok: &str) -> Result<u8> {
    if tok.starts_with('g') {
        Ok(parse_var(tok, 'g')? | VAR_GLOBAL)
    } else {
        parse_var(tok, 'v')
    }
}

fn parse_u8(tok: &str) -> Result<u8> {
    tok.parse()
        .with_context(|| format!("valeur u8 invalide : '{}'", tok))
}

/// Source type of a 16-bit value. Shared by VAROP, CALLF and RETF: a
/// function argument is described exactly like the right-hand side of an
/// assignment, so there was no reason to invent a second grammar.
/// "param" and "ret" were added with functions — the first only means
/// something inside a function body, the second only after a call, and
/// events.rs is what checks that. The assembler knows nothing about
/// functions, only labels.
/// Arithmetic operation, shared by VAROP and SETLOC.
fn parse_varop(tok: &str) -> Result<u8> {
    Ok(match tok {
        "=" => 0,
        "+" => 1,
        "-" => 2,
        "*" => 3,
        "/" => 4,
        "%" => 5,
        "rand" => 6,
        o => bail!("operation inconnue '{}' (=, +, -, *, /, %, rand)", o),
    })
}

fn parse_varsrc(tok: &str) -> Result<u8> {
    Ok(match tok {
        "const" => 0,
        "var" => 1,
        "hx" => 2,
        "hy" => 3,
        "timer" => 4,
        "scene" => 5,
        "param" => 6,
        "ret" => 7,
        o => bail!(
            "source inconnue '{}' (const, var, hx, hy, timer, scene, param, ret)",
            o
        ),
    })
}

/// The value that goes with a source: a signed or unsigned constant, a
/// variable index, or a parameter number.
fn parse_srcval(tok: &str) -> Result<u16> {
    let v: i32 = tok
        .parse()
        .with_context(|| format!("valeur invalide : '{}'", tok))?;
    if !(-32768..=65535).contains(&v) {
        bail!("valeur hors limite : {}", v);
    }
    Ok(v as u16)
}

pub fn assemble(
    source: &[String],
    text_ids: &HashMap<String, u16>,
    scene_ids: &HashMap<&str, u8>,
    sprite_remap: &HashMap<u8, u8>,
) -> Result<Assembled> {
    let lines = parse_lines(source)?;

    // Pass 1: labels
    let mut labels: HashMap<String, u16> = HashMap::new();
    let mut pc: u16 = 0;
    for line in &lines {
        match line {
            Line::Label(name) => {
                if labels.insert(name.to_string(), pc).is_some() {
                    bail!("label en double : '{}'", name);
                }
            }
            Line::Op(op, args) => pc += op_size(op, args)?,
        }
    }

    let label_of = |name: &str| -> Result<u16> {
        labels
            .get(name)
            .copied()
            .with_context(|| format!("label inconnu : '{}'", name))
    };

    // Pass 2: emission
    let mut code = Vec::new();
    for line in &lines {
        let (op, args) = match line {
            Line::Label(_) => continue,
            Line::Op(op, args) => (*op, args),
        };
        let argc = args.len();
        match op {
            "END" => {
                if argc != 0 { bail!("END ne prend pas d'argument"); }
                code.push(OP_END);
            }
            "MSG" => {
                if argc != 1 { bail!("MSG <nom_de_texte>"); }
                let id = *text_ids
                    .get(args[0])
                    .with_context(|| format!("texte inconnu : '{}'", args[0]))?;
                code.push(OP_MSG);
                code.extend_from_slice(&id.to_le_bytes());
            }
            "SETVAR" | "ADDVAR" => {
                if argc != 2 { bail!("{} v<n>|g<n> <val>", op); }
                code.push(if op == "SETVAR" { OP_SETVAR } else { OP_ADDVAR });
                code.push(parse_any_var(args[0])?);
                code.push(parse_u8(args[1])?);
            }
            "SETGVAR" => {
                if argc != 2 { bail!("SETGVAR g<n> <val>"); }
                code.push(OP_SETGVAR);
                code.push(parse_var(args[0], 'g')?);
                code.push(parse_u8(args[1])?);
            }
            "JMP" => {
                if argc != 1 { bail!("JMP <label>"); }
                code.push(OP_JMP);
                code.extend_from_slice(&label_of(args[0])?.to_le_bytes());
            }
            "JEQ" | "JNE" | "JGEQ" => {
                if argc != 3 { bail!("{} v<n>|g<n> <val> <label>", op); }
                code.push(match op {
                    "JEQ" => OP_JEQ,
                    "JNE" => OP_JNE,
                    _ => OP_JGEQ,
                });
                code.push(parse_any_var(args[0])?);
                code.push(parse_u8(args[1])?);
                code.extend_from_slice(&label_of(args[2])?.to_le_bytes());
            }
            "WARP" => {
                if argc != 3 && argc != 4 {
                    bail!("WARP <scene> <x> <y> [trans 0-2]");
                }
                let dest = *scene_ids
                    .get(args[0])
                    .with_context(|| format!("scene inconnue : '{}'", args[0]))?;
                code.push(OP_WARP);
                code.push(dest);
                code.push(parse_u8(args[1])?);
                code.push(parse_u8(args[2])?);
                // transition: 0 fade, 1 instant, 2 mosaic
                code.push(if argc == 4 { parse_u8(args[3])? } else { 0 });
            }
            "FACE" => {
                if argc != 2 { bail!("FACE <acteur> <down|up|left|right>"); }
                code.push(OP_FACE);
                code.push(parse_u8(args[0])?);
                code.push(match args[1] {
                    "down" => 0,
                    "up" => 1,
                    "left" => 2,
                    "right" => 3,
                    d => bail!("direction inconnue : '{}'", d),
                });
            }
            "SW" | "JSW" => {
                let idx: u16 = args
                    .first()
                    .and_then(|t| t.parse().ok())
                    .filter(|&n| n < 512)
                    .with_context(|| format!("{} <n 0-511> ...", op))?;
                let want = match args.get(1) {
                    Some(&"0") => 0u8,
                    Some(&"1") => 1u8,
                    _ => bail!("{} {} 0|1 ...", op, idx),
                };
                if op == "SW" {
                    if argc != 2 { bail!("SW <n> 0|1"); }
                    code.push(OP_SW);
                    code.extend_from_slice(&idx.to_le_bytes());
                    code.push(want);
                } else {
                    if argc != 3 { bail!("JSW <n> 0|1 <label>"); }
                    code.push(OP_JSW);
                    code.extend_from_slice(&idx.to_le_bytes());
                    code.push(want);
                    code.extend_from_slice(&label_of(args[2])?.to_le_bytes());
                }
            }
            "SET16" | "ADD16" => {
                if argc != 2 { bail!("{} <n 0-255> <val>", op); }
                let n: u8 = args[0]
                    .parse()
                    .with_context(|| format!("variable 16-bit invalide : '{}'", args[0]))?;
                // negative accepted (two's complement, 16-bit wrap)
                let val: i32 = args[1]
                    .parse()
                    .with_context(|| format!("valeur invalide : '{}'", args[1]))?;
                if !(-32768..=65535).contains(&val) {
                    bail!("valeur 16-bit hors limite : {}", val);
                }
                code.push(if op == "SET16" { OP_SET16 } else { OP_ADD16 });
                code.push(n);
                code.extend_from_slice(&(val as u16).to_le_bytes());
            }
            "JCMP16" => {
                if argc != 6 {
                    bail!("JCMP16 <srcA> <a> ==|!=|>= <srcB> <b> <label>");
                }
                let opb = match args[2] {
                    "==" => 0u8,
                    "!=" => 1u8,
                    ">=" => 2u8,
                    o => bail!("JCMP16 : opérateur inconnu '{}' (==, !=, >=)", o),
                };
                code.push(OP_JCMP16);
                code.push(parse_varsrc(args[0])?);
                code.extend_from_slice(&parse_srcval(args[1])?.to_le_bytes());
                code.push(opb);
                code.push(parse_varsrc(args[3])?);
                code.extend_from_slice(&parse_srcval(args[4])?.to_le_bytes());
                code.extend_from_slice(&label_of(args[5])?.to_le_bytes());
            }
            // VAROP <dst> <=|+|-|*|/|%|rand> <const|var|hx|hy|timer> <src>
            "VAROP" => {
                if argc != 4 { bail!("VAROP <dst> <op> <src_type> <src>"); }
                let dst: u8 = args[0].parse()
                    .with_context(|| format!("variable invalide : '{}'", args[0]))?;
                let opb = parse_varop(args[1])?;
                let st = parse_varsrc(args[2])?;
                let src: i32 = args[3].parse()
                    .with_context(|| format!("valeur invalide : '{}'", args[3]))?;
                if !(-32768..=65535).contains(&src) {
                    bail!("VAROP : valeur hors limite : {}", src);
                }
                code.push(OP_VAROP);
                code.push(dst);
                code.push(opb);
                code.push(st);
                code.extend_from_slice(&(src as u16).to_le_bytes());
            }
            "TIMER" => {
                if argc != 2 { bail!("TIMER <start|stop|show|hide> <val>"); }
                let opb = match args[0] {
                    "start" => 0u8, "stop" => 1, "show" => 2, "hide" => 3,
                    o => bail!("TIMER : operation inconnue '{}'", o),
                };
                let val: u16 = args[1].parse()
                    .with_context(|| format!("valeur invalide : '{}'", args[1]))?;
                code.push(OP_TIMER);
                code.push(opb);
                code.extend_from_slice(&val.to_le_bytes());
            }
            "CAMPAN" => {
                if argc != 3 { bail!("CAMPAN <tx> <ty> <vitesse 1-8>"); }
                code.push(OP_CAMPAN);
                code.push(parse_u8(args[0])?);
                code.push(parse_u8(args[1])?);
                code.push(parse_u8(args[2])?);
            }
            "CAMRET" => {
                if argc != 1 { bail!("CAMRET <vitesse 1-8>"); }
                code.push(OP_CAMRET);
                code.push(parse_u8(args[0])?);
            }
            "WAITCAM" => {
                if argc != 0 { bail!("WAITCAM ne prend pas d'argument"); }
                code.push(OP_WAITCAM);
            }
            // CALLF <label> <src> <val> ... / RETF <src> <val>: a
            // FUNCTION call with arguments and a return value
            "CALLF" => {
                if argc < 2 || argc % 2 != 0 {
                    bail!("CALLF <label> <nslots> puis des couples <source> <valeur>");
                }
                let n = (argc - 2) / 2;
                if n > 8 {
                    bail!("CALLF : {} arguments, le maximum est 8", n);
                }
                code.push(OP_CALLF);
                code.extend_from_slice(&label_of(args[0])?.to_le_bytes());
                code.push(n as u8);
                code.push(parse_u8(args[1])?); /* arguments + locales */
                for k in 0..n {
                    code.push(parse_varsrc(args[2 + 2 * k])?);
                    code.extend_from_slice(&parse_srcval(args[3 + 2 * k])?.to_le_bytes());
                }
            }
            // SETLOC <slot> <op> <source> <value>: the same arithmetic as
            // VAROP, with a slot of the current frame as destination
            "SETLOC" => {
                if argc != 4 { bail!("SETLOC <slot> <op> <source> <valeur>"); }
                code.push(OP_SETLOC);
                code.push(parse_u8(args[0])?);
                code.push(parse_varop(args[1])?);
                code.push(parse_varsrc(args[2])?);
                code.extend_from_slice(&parse_srcval(args[3])?.to_le_bytes());
            }
            "RETF" => {
                if argc != 2 { bail!("RETF <source> <valeur>"); }
                code.push(OP_RETF);
                code.push(parse_varsrc(args[0])?);
                code.extend_from_slice(&parse_srcval(args[1])?.to_le_bytes());
            }
            // CALL <label> / RET: common events
            "CALL" => {
                if argc != 1 { bail!("CALL <label>"); }
                code.push(OP_CALL);
                code.extend_from_slice(&label_of(args[0])?.to_le_bytes());
            }
            "RET" => {
                if argc != 0 { bail!("RET ne prend pas d'argument"); }
                code.push(OP_RET);
            }
            // DBREAD <table> <0|1> <entry> <ofs> <size 1|2> <dst var>:
            // vars16[dst] = a database field. All six operands are
            // already resolved by events.rs, symbolic ids included.
            "DBREAD" => {
                if argc != 6 { bail!("DBREAD <table> <esrc> <entree> <ofs> <taille> <dst>"); }
                code.push(OP_DBREAD);
                for t in args {
                    code.push(parse_u8(t)?);
                }
            }
            "SHOWUI" => {
                if argc != 2 { bail!("SHOWUI <widget> <0|1>"); }
                code.push(OP_SHOWUI);
                code.push(parse_u8(args[0])?);
                code.push(parse_u8(args[1])?);
            }
            "KEYIN" => {
                if argc != 4 { bail!("KEYIN <wait> <masklo> <maskhi> <var>"); }
                code.push(OP_KEYIN);
                for t in args {
                    code.push(parse_u8(t)?);
                }
            }
            "DLGSTYLE" => {
                if argc != 1 { bail!("DLGSTYLE <style>"); }
                code.push(OP_DLGSTYLE);
                code.push(parse_u8(args[0])?);
            }
            "SHOWPIC" => {
                if argc != 5 { bail!("SHOWPIC <pic> <x> <y> <flags> <dur>"); }
                code.push(OP_SHOWPIC);
                for t in args {
                    code.push(parse_u8(t)?);
                }
            }
            "HIDEPIC" => {
                if argc != 1 { bail!("HIDEPIC <dur>"); }
                code.push(OP_HIDEPIC);
                code.push(parse_u8(args[0])?);
            }
            "MOVEPIC" => {
                if argc != 4 { bail!("MOVEPIC <x> <y> <flags> <dur>"); }
                code.push(OP_MOVEPIC);
                for t in args {
                    code.push(parse_u8(t)?);
                }
            }
            "CETAB" => {
                if argc % 3 != 0 { bail!("CETAB <a|p> <switch> <label> ..."); }
                code.push((argc / 3) as u8);
                let mut i = 0;
                while i < argc {
                    code.push(match args[i] {
                        "a" => 0,
                        "p" => 1,
                        "b" => 2, /* battle hook: field 2 = common event id */
                        o => bail!("CETAB : type inconnu '{}' (a, p, b)", o),
                    });
                    // "-" means no condition (always active) -> 0xFFFF
                    let sw: u16 = if args[i + 1] == "-" {
                        0xFFFF
                    } else {
                        args[i + 1]
                            .parse()
                            .ok()
                            .filter(|&n| n < 512)
                            .with_context(|| {
                                format!("CETAB : switch invalide '{}'", args[i + 1])
                            })?
                    };
                    code.extend_from_slice(&sw.to_le_bytes());
                    code.extend_from_slice(&label_of(args[i + 2])?.to_le_bytes());
                    i += 3;
                }
            }
            // WARPV <vs> <vx> <vy> [trans]: teleport to variables
            "WARPV" => {
                if argc != 3 && argc != 4 {
                    bail!("WARPV <var scene> <var x> <var y> [trans 0-2]");
                }
                code.push(OP_WARPV);
                code.push(parse_u8(args[0])?);
                code.push(parse_u8(args[1])?);
                code.push(parse_u8(args[2])?);
                code.push(if argc == 4 { parse_u8(args[3])? } else { 0 });
            }
            // SETPOS <actor|self> <c|v> <x> <y>: place an event —
            // c for constants, v for 16-bit variable numbers
            "SETPOS" => {
                if argc != 4 { bail!("SETPOS <acteur|self> <c|v> <x> <y>"); }
                code.push(OP_SETPOS);
                code.push(if args[0] == "self" { 255 } else { parse_u8(args[0])? });
                code.push(match args[1] {
                    "c" => 0,
                    "v" => 1,
                    o => bail!("SETPOS : source inconnue '{}' (c|v)", o),
                });
                code.push(parse_u8(args[2])?);
                code.push(parse_u8(args[3])?);
            }
            // SWAPPOS <a|self> <b|self>: swap two events
            "SWAPPOS" => {
                if argc != 2 { bail!("SWAPPOS <a|self> <b|self>"); }
                code.push(OP_SWAPPOS);
                code.push(if args[0] == "self" { 255 } else { parse_u8(args[0])? });
                code.push(if args[1] == "self" { 255 } else { parse_u8(args[1])? });
            }
            // Screen effects: duration in frames, plus an optional fx —
            // 0 fade, 1 instant, 2 mosaic, 3-5 wipe down/up/centre
            // 3-5 balayage bas/haut/centre
            "SCRHIDE" | "SCRSHOW" => {
                if argc != 1 && argc != 2 { bail!("{} <frames 1-255> [fx 0-5]", op); }
                let dur: u8 = args[0]
                    .parse()
                    .ok()
                    .filter(|&v| v >= 1)
                    .with_context(|| format!("durée invalide : '{}' (1-255 frames)", args[0]))?;
                code.push(if op == "SCRHIDE" { OP_SCRHIDE } else { OP_SCRSHOW });
                code.push(dur);
                code.push(if argc == 2 { parse_u8(args[1])? } else { 0 });
            }
            // TINT <off|add|sub> <r> <g> <b> (0-31); TINTG adds <dur 1-255>
            "TINT" | "TINTG" => {
                let want = if op == "TINTG" { 5 } else { 4 };
                if argc != want {
                    bail!("{} <off|add|sub> <r> <g> <b>{}", op,
                          if want == 5 { " <dur>" } else { "" });
                }
                let mode = match args[0] {
                    "off" => 0u8,
                    "add" => 1,
                    "sub" => 2,
                    o => bail!("{} : mode inconnu '{}' (off, add, sub)", op, o),
                };
                code.push(if op == "TINTG" { OP_TINTG } else { OP_TINT });
                code.push(mode);
                for t in &args[1..4] {
                    let v: u8 = t
                        .parse()
                        .ok()
                        .filter(|&v| v <= 31)
                        .with_context(|| format!("composante invalide : '{}' (0-31)", t))?;
                    code.push(v);
                }
                if op == "TINTG" {
                    let d: u8 = args[4]
                        .parse()
                        .ok()
                        .filter(|&v| v >= 1)
                        .with_context(|| format!("duree invalide : '{}' (1-255)", args[4]))?;
                    code.push(d);
                }
            }
            // WAVE <power 0-7> <speed 1-8> — ripple
            "WAVE" => {
                if argc != 2 { bail!("WAVE <0-7> <1-8>"); }
                code.push(OP_WAVE);
                for t in args {
                    code.push(parse_u8(t)?);
                }
            }
            // SKYGRAD <off|add|sub> <r0> <g0> <b0> <r1> <g1> <b1> —
            // sky gradient: a vertical tint, top to bottom
            "SKYGRAD" => {
                if argc != 7 { bail!("SKYGRAD <mode> <r0> <g0> <b0> <r1> <g1> <b1>"); }
                code.push(OP_SKYGRAD);
                let mode = match args[0] {
                    "off" => 0u8,
                    "add" => 1,
                    "sub" => 2,
                    m => bail!("SKYGRAD : mode invalide '{}' (off/add/sub)", m),
                };
                code.push(mode);
                for t in &args[1..7] {
                    let v = parse_u8(t)?;
                    if v > 31 { bail!("SKYGRAD : canal > 31 : {}", v); }
                    code.push(v);
                }
            }
            // SPOTLIGHT <radius 0|16-96> <dark 1-31> — circle of light
            // around the hero; radius 0 turns it off
            "SPOTLIGHT" => {
                if argc != 2 { bail!("SPOTLIGHT <0|16-96> <1-31>"); }
                code.push(OP_SPOTLIGHT);
                for t in args {
                    code.push(parse_u8(t)?);
                }
            }
            // PLAYSFX <id> — play a sound
            "PLAYSFX" => {
                if argc != 1 { bail!("PLAYSFX <id>"); }
                code.push(OP_PLAYSFX);
                code.push(parse_u8(args[0])?);
            }
            // PLAYBGM <id|255> — change the music
            "PLAYBGM" => {
                if argc != 1 { bail!("PLAYBGM <id|255>"); }
                code.push(OP_PLAYBGM);
                code.push(parse_u8(args[0])?);
            }
            // STAGEOPEN/STAGEPOSE/STAGECLEAR/STAGECLOSE — composed
            // screen; raw u8 arguments, validated by events.rs
            "STAGEOPEN" => {
                if argc != 2 && argc != 3 {
                    bail!("STAGEOPEN <pic|255> <dur> [trans 0-2]");
                }
                code.push(OP_STAGEOPEN);
                for t in args { code.push(parse_u8(t)?); }
                if argc == 2 { code.push(0); } // trans : fondu (S18)
            }
            "STAGEPOSE" => {
                if argc != 4 { bail!("STAGEPOSE <slot> <pic> <tx> <ty>"); }
                code.push(OP_STAGEPOSE);
                for t in args { code.push(parse_u8(t)?); }
            }
            "STAGECLEAR" => {
                if argc != 1 { bail!("STAGECLEAR <slot>"); }
                code.push(OP_STAGECLEAR);
                code.push(parse_u8(args[0])?);
            }
            "STAGECLOSE" => {
                if argc != 1 && argc != 2 {
                    bail!("STAGECLOSE <dur> [trans 0-2]");
                }
                code.push(OP_STAGECLOSE);
                code.push(parse_u8(args[0])?);
                code.push(if argc == 2 { parse_u8(args[1])? } else { 0 });
            }
            // SLOTFX <slot> <fx 0-3> <dur> — palette effect on one slot
            // of the composed screen
            "SLOTFX" => {
                if argc != 3 { bail!("SLOTFX <slot> <fx> <dur>"); }
                code.push(OP_SLOTFX);
                for t in args { code.push(parse_u8(t)?); }
            }
            // VIGSHOW/VIGPLAY/VIGHIDE — animated vignettes
            "VIGSHOW" => {
                if argc != 5 { bail!("VIGSHOW <slot> <vig> <x> <y> <anchor>"); }
                code.push(OP_VIGSHOW);
                for t in args { code.push(parse_u8(t)?); }
            }
            "VIGPLAY" => {
                if argc != 3 { bail!("VIGPLAY <slot> <mode> <speed>"); }
                code.push(OP_VIGPLAY);
                for t in args { code.push(parse_u8(t)?); }
            }
            "VIGHIDE" => {
                if argc != 1 { bail!("VIGHIDE <slot>"); }
                code.push(OP_VIGHIDE);
                code.push(parse_u8(args[0])?);
            }
            // ANIMPLAY/ANIMSTOP — frame-by-frame animations
            "ANIMPLAY" => {
                if argc != 6 { bail!("ANIMPLAY <anim> <ancre> <cible|self> <flags> <x> <y>"); }
                code.push(OP_ANIMPLAY);
                code.push(parse_u8(args[0])?);
                code.push(parse_u8(args[1])?);
                // "this event": 255, resolved at run time (vm.script_actor)
                code.push(if args[2] == "self" { 255 } else { parse_u8(args[2])? });
                code.push(parse_u8(args[3])?);
                // screen-anchor aim point (V2)
                code.push(parse_u8(args[4])?);
                code.push(parse_u8(args[5])?);
            }
            "ANIMSTOP" => {
                if argc != 0 { bail!("ANIMSTOP ne prend pas d'argument"); }
                code.push(OP_ANIMSTOP);
            }
            // M7OPEN/M7ZOOM/M7CLOSE — the Mode 7 screen (M7-A). The
            // editor exposes ONE command that chains the three; these
            // stay separate because the engine gets primitives.
            "M7OPEN" => {
                if argc != 2 { bail!("M7OPEN <image> <duree>"); }
                code.push(OP_M7OPEN);
                for t in args { code.push(parse_u8(t)?); }
            }
            "M7ZOOM" => {
                if argc != 2 { bail!("M7ZOOM <rampe|255> <flags>"); }
                code.push(OP_M7ZOOM);
                for t in args { code.push(parse_u8(t)?); }
            }
            "M7CLOSE" => {
                if argc != 1 { bail!("M7CLOSE <duree>"); }
                code.push(OP_M7CLOSE);
                code.push(parse_u8(args[0])?);
            }
            // M7VIEW <horizon> <ancrage> — the world map's camera angle.
            // Bounds are the engine's; it clamps rather than refuses, so
            // this only catches what a human can still fix.
            "M7VIEW" => {
                if argc != 2 { bail!("M7VIEW <horizon> <ancrage>"); }
                let hz = parse_u8(args[0])?;
                let an = parse_u8(args[1])?;
                if hz > 180 { bail!("M7VIEW : horizon {} > 180", hz); }
                if an > 216 { bail!("M7VIEW : ancrage {} > 216", an); }
                if an < hz + 16 {
                    bail!("M7VIEW : ancrage {} pour un horizon {} — au moins 16 lignes d'ecart", an, hz);
                }
                code.push(OP_M7VIEW);
                code.push(hz);
                code.push(an);
            }
            // M7ROT <cran> — 16 steps of 22.5 degrees. Refused above 15
            // rather than masked: a script asking for step 20 means
            // something the author did not intend.
            "M7ROT" => {
                if argc != 1 { bail!("M7ROT <cran 0-63>"); }
                let a = parse_u8(args[0])?;
                if a > 63 { bail!("M7ROT : cran {} — 64 crans au maximum (0-63)", a); }
                code.push(OP_M7ROT);
                code.push(a);
            }
            // BTLPOSE <slot 0-3> <entry> <x> <y> <op 0|1> — a battler
            // cell on the composed screen (V1/G1); blocking on the upload
            "BTLPOSE" => {
                if argc != 6 { bail!("BTLPOSE <slot> <src> <entry> <x> <y> <op>"); }
                let h = parse_u8(args[0])?;
                if h > 3 { bail!("BTLPOSE : emplacement {} — 4 au maximum (0-3)", h); }
                code.push(OP_BTLPOSE);
                code.push(h);
                code.push(parse_u8(args[1])?);
                code.push(parse_u8(args[2])?);
                code.push(parse_u8(args[3])?);
                code.push(parse_u8(args[4])?);
                code.push(parse_u8(args[5])?);
            }
            // POPUP <src 0|1> <value u16> <x> <y> — a number in digits
            // over the composed screen (V1)
            "POPUP" => {
                if argc != 4 { bail!("POPUP <src> <valeur> <x> <y>"); }
                code.push(OP_POPUP);
                code.push(parse_u8(args[0])?);
                let v: u16 = args[1]
                    .parse()
                    .with_context(|| format!("POPUP : valeur invalide '{}'", args[1]))?;
                code.push((v & 0xFF) as u8);
                code.push((v >> 8) as u8);
                code.push(parse_u8(args[2])?);
                code.push(parse_u8(args[3])?);
            }
            // CLOCK <base> <n 0-8> — the gauge clock (V1): n lanes of
            // (gauge, speed) variable pairs from base; 0 stops it
            "CLOCK" => {
                if argc != 2 { bail!("CLOCK <base> <n>"); }
                let base = parse_u8(args[0])?;
                let n = parse_u8(args[1])?;
                if n > 8 { bail!("CLOCK : {} voies — 8 au maximum", n); }
                if n > 0 && base as u16 + (n as u16) * 2 > 256 {
                    bail!("CLOCK : base {} + {} paires déborde des 256 variables", base, n);
                }
                code.push(OP_CLOCK);
                code.push(base);
                code.push(n);
            }
            // TARGETSEL <var> <flags bit0 = équipe, bit1 = B annule> —
            // the target cursor (V1); blocking
            "TARGETSEL" => {
                if argc != 2 { bail!("TARGETSEL <var> <flags>"); }
                code.push(OP_TARGETSEL);
                code.push(parse_u8(args[0])?);
                code.push(parse_u8(args[1])?);
            }
            // SRAM <op> <slot> <var> — the save primitive (M2): 0 save,
            // 1 load (ends the script on success), 2 exists -> var
            "SRAM" => {
                if argc != 3 { bail!("SRAM <op> <slot> <var>"); }
                let o = parse_u8(args[0])?;
                if o > 2 { bail!("SRAM : op {} (0 save, 1 load, 2 exists)", o); }
                let slot = parse_u8(args[1])?;
                if slot > 3 { bail!("SRAM : slot {} — 4 slots (0-3)", slot); }
                code.push(OP_SRAM);
                code.push(o);
                code.push(slot);
                code.push(parse_u8(args[2])?);
            }
            // M7TURN <cran> <frames> <flags bit1 = attendre> — the angle
            // is masked by the map's OWN step count at run time, so the
            // bound here is the widest choice (64).
            "M7TURN" => {
                if argc != 3 { bail!("M7TURN <cran> <frames> <flags>"); }
                let a = parse_u8(args[0])?;
                if a > 63 { bail!("M7TURN : cran {} — 64 crans au maximum (0-63)", a); }
                code.push(OP_M7TURN);
                code.push(a);
                code.push(parse_u8(args[1])?);
                code.push(parse_u8(args[2])?);
            }
            // LISTSEL <widget> <var> <flags bit0 = cancellable> — cursor
            // menu on a "list" widget of the UI layout; blocking
            "LISTSEL" => {
                if argc != 3 { bail!("LISTSEL <widget> <var> <flags>"); }
                code.push(OP_LISTSEL);
                for t in args { code.push(parse_u8(t)?); }
            }
            // WEATHER <type 0-2> <intensity 1-3> — weather
            "WEATHER" => {
                if argc != 2 { bail!("WEATHER <0-2> <1-3>"); }
                code.push(OP_WEATHER);
                for t in args {
                    code.push(parse_u8(t)?);
                }
            }
            // FLASH <r> <g> <b> <frames 1-255>
            "FLASH" => {
                if argc != 4 { bail!("FLASH <r> <g> <b> <frames>"); }
                code.push(OP_FLASH);
                for t in &args[0..3] {
                    let v: u8 = t
                        .parse()
                        .ok()
                        .filter(|&v| v <= 31)
                        .with_context(|| format!("composante invalide : '{}' (0-31)", t))?;
                    code.push(v);
                }
                let frames = parse_u8(args[3])?;
                if frames == 0 { bail!("FLASH : frames entre 1 et 255"); }
                code.push(frames);
            }
            // SHAKE <power 0-8> <speed 1-8> <frames>; power 0 stops it
            "SHAKE" => {
                if argc != 3 { bail!("SHAKE <power 0-8> <vitesse 1-8> <frames>"); }
                let power: u8 = args[0]
                    .parse()
                    .ok()
                    .filter(|&v| v <= 8)
                    .with_context(|| format!("power invalide : '{}' (0-8)", args[0]))?;
                let speed: u8 = args[1]
                    .parse()
                    .ok()
                    .filter(|&v| (1..=8).contains(&v))
                    .with_context(|| format!("vitesse invalide : '{}' (1-8)", args[1]))?;
                code.push(OP_SHAKE);
                code.push(power);
                code.push(speed);
                code.push(parse_u8(args[2])?);
            }
            "RTBLOB" => {
                if argc < 4 { bail!("RTBLOB <r> <s> <freq> <pas...>"); }
                let mut flags = 0u8;
                if args[0] == "1" { flags |= 1; }
                if args[1] == "1" { flags |= 2; }
                let freq: u8 = args[2]
                    .parse()
                    .ok()
                    .filter(|&f| (1..=8).contains(&f))
                    .with_context(|| format!("frequence invalide : '{}' (1-8)", args[2]))?;
                let mut steps: Vec<u8> = Vec::new();
                for t in &args[3..] {
                    steps.extend(route_step(t, sprite_remap)?);
                }
                if steps.is_empty() || steps.len() > 255 {
                    bail!("RTBLOB : 1 a 255 octets de pas");
                }
                code.push(flags);
                code.push(freq);
                code.push(steps.len() as u8);
                code.extend_from_slice(&steps);
            }
            "WAITROUTE" => {
                if argc != 0 { bail!("WAITROUTE ne prend pas d'argument"); }
                code.push(OP_WAITROUTE);
            }
            "WAIT" => {
                if argc != 1 { bail!("WAIT <frames 1-255>"); }
                code.push(OP_WAIT);
                code.push(parse_u8(args[0])?);
            }
            "ROUTE" => {
                if argc < 5 { bail!("ROUTE <acteur> <r> <s> <freq> <pas...>"); }
                let actor: u8 = if args[0] == "self" {
                    255
                } else {
                    parse_u8(args[0])?
                };
                let mut flags = 0u8;
                if args[1] == "1" { flags |= 1; }
                if args[2] == "1" { flags |= 2; }
                let freq: u8 = args[3]
                    .parse()
                    .ok()
                    .filter(|&f| (1..=8).contains(&f))
                    .with_context(|| format!("frequence invalide : '{}' (1-8)", args[3]))?;
                let mut steps: Vec<u8> = Vec::new();
                for t in &args[4..] {
                    steps.extend(route_step(t, sprite_remap)?);
                }
                if steps.is_empty() || steps.len() > 255 {
                    bail!("ROUTE : 1 a 255 octets de pas");
                }
                code.push(OP_ROUTE);
                code.push(actor);
                code.push(flags);
                code.push(freq);
                code.push(steps.len() as u8);
                code.extend_from_slice(&steps);
            }
            "CHOICE" => {
                op_size(op, args)?; // valide 2-4 choix
                code.push(OP_CHOICE);
                code.push(parse_any_var(args[0])?);
                code.push((argc - 1) as u8);
                for t in &args[1..] {
                    let id = *text_ids
                        .get(*t)
                        .with_context(|| format!("texte inconnu : '{}'", t))?;
                    code.extend_from_slice(&id.to_le_bytes());
                }
            }
            other => bail!("opcode inconnu : '{}'", other),
        }
    }

    if code.is_empty() {
        code.push(OP_END); // bloc scripts jamais vide (offset 0 valide)
    }

    Ok(Assembled { bytecode: code, labels })
}
