//! Assembleur de scripts VM v0 (spec §2) : texte avec labels → bytecode.
//!
//! Syntaxe (une instruction par ligne, `;` = commentaire) :
//!   label:
//!     END
//!     MSG <nom_de_texte>
//!     SETVAR v<n> <val>      ADDVAR v<n> <val>      SETGVAR g<n> <val>
//!     JMP <label>
//!     JEQ v<n> <val> <label> JNE v<n> <val> <label> JGEQ v<n> <val> <label>
//!     CHOICE v<n> <texte1> <texte2> [<texte3>] [<texte4>]
//!     WARP <scene> <x> <y>   ; téléporte le héros — termine le script
//!     FACE <acteur> <dir>    ; tourne l'acteur n (down/up/left/right)
//!     SW <n> 0|1             ; switch n (0-511) OFF/ON — v0.9
//!     JSW <n> 0|1 <label>    ; saute si le switch n vaut 0|1
//!     SET16 <n> <val>        ; variable 16-bit n (0-255) = val
//!     ADD16 <n> <val>        ; += val (négatif accepté, wrap 16-bit)
//!     JCMP16 <n> ==|!=|>= <val> <label> ; saute si comparaison vraie
//!
//! Variables (v0.6) : v<n> = variable de scène, g<n> = variable globale
//! (persistante entre scènes) — acceptées partout où une variable est
//! attendue (bit 0x80 de l'octet variable = globale). SETGVAR est l'alias
//! historique de SETVAR g<n>.
//!
//! Deux passes : tailles/labels puis émission avec offsets résolus.

use anyhow::{bail, Context, Result};
use std::collections::HashMap;

pub struct Assembled {
    pub bytecode: Vec<u8>,
    pub labels: HashMap<String, u16>,
}

// Opcodes — spec §2 (table contractuelle)
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

/// Encode un pas d'itinéraire en octets (spec §2 v0.13 — Move Route
/// complet). swon:/swoff: portent un u16, gfx: un u8 (slot local via
/// remap bloc projet → sprite set de la scène).
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

/// Taille en octets d'un token de pas (passe 1)
fn route_step_size(tok: &str) -> u16 {
    if tok.starts_with("swon:") || tok.starts_with("swoff:") {
        3
    } else if tok.starts_with("gfx:") {
        2
    } else {
        1
    }
}

/// Bit « variable globale » dans l'octet variable (spec §2 v0.6)
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
        "WARP" => 4,
        "FACE" => 3,
        "SW" | "SET16" | "ADD16" => 4,
        "JSW" => 6,
        "JCMP16" => 7,
        "WAITROUTE" => 1,
        "WAIT" => 2,
        "VAROP" => 6,
        "TIMER" => 4,
        "CAMPAN" => 4,
        "CAMRET" => 2,
        "WAITCAM" => 1,
        // ROUTE <acteur> <r> <s> <freq> <pas...> : 5 octets d'en-tête
        "ROUTE" => {
            if argc < 5 {
                bail!("ROUTE <acteur> <repeat 0|1> <skip 0|1> <freq 1-8> <pas...>");
            }
            5 + args[4..].iter().map(|t| route_step_size(t)).sum::<u16>()
        }
        // CHOICE v<n> <texte>... : opcode, variable, count, count x u16
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

/// Opérande variable : v<n> (scène) ou g<n> (globale, bit 0x80)
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

pub fn assemble(
    source: &[String],
    text_ids: &HashMap<String, u16>,
    scene_ids: &HashMap<&str, u8>,
    sprite_remap: &HashMap<u8, u8>,
) -> Result<Assembled> {
    let lines = parse_lines(source)?;

    // Passe 1 : labels
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

    // Passe 2 : émission
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
                if argc != 3 { bail!("WARP <scene> <x> <y>"); }
                let dest = *scene_ids
                    .get(args[0])
                    .with_context(|| format!("scene inconnue : '{}'", args[0]))?;
                code.push(OP_WARP);
                code.push(dest);
                code.push(parse_u8(args[1])?);
                code.push(parse_u8(args[2])?);
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
                // négatif accepté (complément à deux, wrap 16-bit)
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
                if argc != 4 { bail!("JCMP16 <n> ==|!=|>= <val> <label>"); }
                let n: u8 = args[0]
                    .parse()
                    .with_context(|| format!("variable 16-bit invalide : '{}'", args[0]))?;
                let opb = match args[1] {
                    "==" => 0u8,
                    "!=" => 1u8,
                    ">=" => 2u8,
                    o => bail!("JCMP16 : opérateur inconnu '{}' (==, !=, >=)", o),
                };
                let val: u16 = args[2]
                    .parse()
                    .with_context(|| format!("valeur 16-bit invalide : '{}'", args[2]))?;
                code.push(OP_JCMP16);
                code.push(n);
                code.push(opb);
                code.extend_from_slice(&val.to_le_bytes());
                code.extend_from_slice(&label_of(args[3])?.to_le_bytes());
            }
            // VAROP <dst> <=|+|-|*|/|%|rand> <const|var|hx|hy|timer> <src>
            "VAROP" => {
                if argc != 4 { bail!("VAROP <dst> <op> <src_type> <src>"); }
                let dst: u8 = args[0].parse()
                    .with_context(|| format!("variable invalide : '{}'", args[0]))?;
                let opb = match args[1] {
                    "=" => 0u8, "+" => 1, "-" => 2, "*" => 3, "/" => 4,
                    "%" => 5, "rand" => 6,
                    o => bail!("VAROP : operation inconnue '{}'", o),
                };
                let st = match args[2] {
                    "const" => 0u8, "var" => 1, "hx" => 2, "hy" => 3, "timer" => 4,
                    o => bail!("VAROP : source inconnue '{}'", o),
                };
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
