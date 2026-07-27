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

fn op_size(op: &str, argc: usize) -> Result<u16> {
    Ok(match op {
        "END" => 1,
        "MSG" | "SETVAR" | "ADDVAR" | "SETGVAR" | "JMP" => 3,
        "JEQ" | "JNE" | "JGEQ" => 5,
        "WARP" => 4,
        "FACE" => 3,
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
            Line::Op(op, args) => pc += op_size(op, args.len())?,
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
            "CHOICE" => {
                op_size(op, argc)?; // valide 2-4 choix
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
