//! Battle data (design doc PLANNING_SYSTEME_COMBAT.md §6, milestone C1).
//!
//! Two FIXED-format files in the project's data/ directory:
//!
//! `heroes.toml` — the party, in screen order (4 at most):
//! ```toml
//! [[hero]]
//! id = "arven"          # symbolic, for later references
//! name = "Arven"        # shown by the UI layer (labels, C1)
//! charset = "hero"      # a name from project.charsets
//! max_hp = 300
//! max_mp = 40
//! speed = 60
//! ```
//!
//! `troops.toml` — the monster groups ("Groupes de monstres"):
//! ```toml
//! [[troop]]
//! id = "gobelins"
//! backdrop = "fond_prairie"        # a project picture
//! monsters = [ { id = "gobelin", x = 4, y = 10 } ]   # x,y in TILES
//! ```
//! A troop's monster `id` points into the DATABASE's `monsters` table,
//! whose `battle_pic` field names the picture to pose — stats and
//! looks live in one place, the troop only ARRANGES them.
//!
//! The hero's battler is composed HERE, at build time: the charset's
//! left-facing idle frame (16x24), centred in a 32x32 4bpp OBJ cell —
//! the exact shape the engine's vignette path already uploads, so
//! btl.c reuses that recipe unchanged.

use std::path::Path;

use anyhow::{bail, Context, Result};

use crate::db::Db;
use crate::emit;
use crate::gfx::IndexedImage;

pub const MAX_HEROES: usize = 4;
pub const MAX_MONS: usize = 4;

pub struct Hero {
    pub cell: Vec<u8>, // 512 bytes: 32x32 4bpp, 16 chars row-major
    pub pal: Vec<u16>, // 16 colours (0 unused: OBJ transparent)
    pub max_hp: u16,
    pub max_mp: u16,
    pub speed: u8,
    pub attack: u8,
    pub defense: u8,
    pub magic: u8,
    pub mdef: u8,
}

/// One monster INSTANCE in a troop — its stats baked at build time
/// from the database's `monsters` table, so the engine never walks the
/// generic table registry on the battle's hot path.
pub struct TroopMon {
    pub pic: u8,
    pub x: u8,
    pub y: u8,
    /// Index of the monster's entry in the database's `monsters` table
    /// (V2): the thin BATTLE opcode hands it to the event library in a
    /// reserved variable, and the library DBREADs the stats itself.
    pub dbid: u8,
    pub hp: u16,
    pub atk: u8,
    pub def: u8,
    pub spd: u8,
    pub xp: u16,
    pub gold: u16,
    pub mdef: u8,
    pub mag: u8,
    /// Weighted action list (C4): a segment of the Battle's ai_* pools.
    pub ai_start: u8,
    pub ai_n: u8,
}

pub struct Troop {
    pub backdrop: u8, // picture id
    pub mons: Vec<TroopMon>,
    /// Hooks (C4): common event INDEX, 0xFF = none. The battle starts
    /// them on the freed VM (BATTLE ends the calling script) and the
    /// ATB clock waits while they run.
    pub intro: u8,
    pub low_hp: u8,
}

/// A skill (C3): the built-in magical formula uses `power`; `target`
/// 0 = one enemy, 1 = one ally; `anim` is a project animation (0xFF
/// none — the hit flash stands in).
pub struct Skill {
    pub mp: u8,
    pub power: u8,
    pub target: u8,
    pub anim: u8,
    /// 0 none, 1 poison (C6): rides an offensive hit.
    pub status: u8,
}

pub struct Battle {
    pub heroes: Vec<Hero>,
    pub troops: Vec<Troop>,
    /// The command menu's SEMANTICS, one entry per widget item:
    /// kind 0 = attack, 1 = skill (arg = skill index), 2 = flee,
    /// 3 = inert (C5's items). The menu's TEXT stays in the layout —
    /// the author binds meaning to his own labels.
    pub act_kind: Vec<u8>,
    pub act_arg: Vec<u8>,
    pub skills: Vec<Skill>,
    /// Widget index of the command menu (a cursor list of the project's
    /// UI layout), 0xFF when the project names none — btl then attacks
    /// without a menu.
    pub menu_widget: u8,
    /// Monster AI pools (C4): one segment per monster with an `ai`
    /// list, shared by every troop slot carrying that monster.
    /// kind 0 = attack, 1 = skill (arg = skill index); w = weight.
    pub ai_kind: Vec<u8>,
    pub ai_arg: Vec<u8>,
    pub ai_w: Vec<u8>,
    /// C6 — the ACTIVE option: gauges keep filling through the menus.
    pub atb_active: u8,
    /// C6 — battle items named by the menu actions ("item:<id>"):
    /// (heal, count variable). The variable holds how many the party
    /// carries — the RM2003-light inventory this project already used.
    pub items: Vec<(u16, u8)>,
}

/// One 8x8 tile of an indexed canvas, encoded 4bpp SNES.
fn tile4(canvas: &[u8; 32 * 32], tx: usize, ty: usize) -> [u8; 32] {
    let mut out = [0u8; 32];
    for y in 0..8 {
        let (mut b0, mut b1, mut b2, mut b3) = (0u8, 0u8, 0u8, 0u8);
        for x in 0..8 {
            let c = canvas[(ty * 8 + y) * 32 + tx * 8 + x];
            let bit = 7 - x;
            b0 |= ((c >> 0) & 1) << bit;
            b1 |= ((c >> 1) & 1) << bit;
            b2 |= ((c >> 2) & 1) << bit;
            b3 |= ((c >> 3) & 1) << bit;
        }
        out[y * 2] = b0;
        out[y * 2 + 1] = b1;
        out[16 + y * 2] = b2;
        out[16 + y * 2 + 1] = b3;
    }
    out
}

/// The hero's 32x32 battler cell from his charset block: the LEFT-facing
/// idle frame (he faces the monsters), 16x24, centred.
fn hero_cell(sheet: &IndexedImage, block: usize) -> Result<(Vec<u8>, Vec<u16>)> {
    let frame = block * 12 + 6; // 12 frames a block, left idle = dir 2 * 3
    let sx = frame * 16;
    if sx + 16 > sheet.width || sheet.height < 24 {
        bail!("bloc charset {} hors de la planche de sprites", block);
    }
    let mut canvas = [0u8; 32 * 32];
    let mut pal: Vec<u16> = vec![0]; // index 0 = transparent
    let mut map = [0u8; 256];
    for y in 0..24 {
        for x in 0..16 {
            let src = sheet.pixels[y * sheet.width + sx + x] as usize;
            if src == 0 {
                continue;
            }
            if map[src] == 0 {
                if pal.len() >= 16 {
                    bail!("battler : plus de 15 couleurs dans le bloc {}", block);
                }
                map[src] = pal.len() as u8;
                pal.push(sheet.palette[src]);
            }
            canvas[(y + 4) * 32 + x + 8] = map[src];
        }
    }
    pal.resize(16, 0);
    let mut cell = Vec::with_capacity(512);
    for ty in 0..4 {
        for tx in 0..4 {
            cell.extend_from_slice(&tile4(&canvas, tx, ty));
        }
    }
    Ok((cell, pal))
}

pub fn build(
    proj_dir: &Path,
    charsets: &[String],
    sheet: &IndexedImage,
    db: Option<&Db>,
    pic_names: &[String],
    ui_widgets: &[String],
    anims: &[String],
    hook_ids: &[(u8, u8)],
) -> Result<Option<Battle>> {
    let hp = proj_dir.join("data/heroes.toml");
    let tp = proj_dir.join("data/troops.toml");
    if !hp.exists() && !tp.exists() {
        return Ok(None);
    }
    if !hp.exists() || !tp.exists() {
        bail!("combat : heroes.toml et troops.toml vont ensemble (data/)");
    }
    let pic_id = |name: &str, what: &str| -> Result<u8> {
        pic_names
            .iter()
            .position(|p| p == name)
            .map(|i| i as u8)
            .with_context(|| format!("combat : image '{}' introuvable ({})", name, what))
    };

    let hv: toml::Table = toml::from_str(&std::fs::read_to_string(&hp)?)
        .context("data/heroes.toml")?;
    let mut heroes = Vec::new();
    for h in hv.get("hero").and_then(|v| v.as_array()).unwrap_or(&Vec::new()) {
        let cs = h.get("charset").and_then(|v| v.as_str()).unwrap_or("");
        let block = charsets
            .iter()
            .position(|c| c == cs)
            .with_context(|| format!("combat : charset '{}' inconnu du projet", cs))?;
        let (cell, pal) = hero_cell(sheet, block)
            .with_context(|| format!("combat : battler du héros '{}'", cs))?;
        heroes.push(Hero {
            cell,
            pal,
            max_hp: h.get("max_hp").and_then(|v| v.as_integer()).unwrap_or(1) as u16,
            max_mp: h.get("max_mp").and_then(|v| v.as_integer()).unwrap_or(0) as u16,
            speed: h.get("speed").and_then(|v| v.as_integer()).unwrap_or(50) as u8,
            attack: h.get("attack").and_then(|v| v.as_integer()).unwrap_or(5) as u8,
            defense: h.get("defense").and_then(|v| v.as_integer()).unwrap_or(0) as u8,
            magic: h.get("magic").and_then(|v| v.as_integer()).unwrap_or(5) as u8,
            mdef: h.get("magic_def").and_then(|v| v.as_integer()).unwrap_or(0) as u8,
        });
    }
    if heroes.is_empty() || heroes.len() > MAX_HEROES {
        bail!("combat : 1 à {} héros dans heroes.toml", MAX_HEROES);
    }
    // The command menu: a cursor-list widget of the project's UI layout,
    // named in heroes.toml (`menu = "menu_combat"`). Optional — without
    // it the heroes attack unprompted, which keeps a bare project alive.
    // Skills (C3): data/skills.toml, optional.
    let mut skills: Vec<Skill> = Vec::new();
    let mut skill_ids: Vec<String> = Vec::new();
    let sp = proj_dir.join("data/skills.toml");
    if sp.exists() {
        let sv: toml::Table = toml::from_str(&std::fs::read_to_string(&sp)?)
            .context("data/skills.toml")?;
        for sk in sv.get("skill").and_then(|v| v.as_array()).unwrap_or(&Vec::new()) {
            let sid = sk.get("id").and_then(|v| v.as_str()).unwrap_or("?");
            let anim = match sk.get("anim").and_then(|v| v.as_str()) {
                Some(a) => anims
                    .iter()
                    .position(|n| n == a)
                    .map(|i| i as u8)
                    .with_context(|| {
                        format!("compétence '{}' : animation '{}' inconnue", sid, a)
                    })?,
                None => 0xFF,
            };
            let target = match sk.get("target").and_then(|v| v.as_str()).unwrap_or("enemy") {
                "enemy" => 0u8,
                "ally" => 1,
                other => bail!("compétence '{}' : target '{}' (enemy, ally)", sid, other),
            };
            let status = match sk.get("status").and_then(|v| v.as_str()) {
                None => 0u8,
                Some("poison") => 1,
                Some(other) => bail!("compétence '{}' : status '{}' (poison)", sid, other),
            };
            skill_ids.push(sid.to_string());
            skills.push(Skill {
                mp: sk.get("mp").and_then(|v| v.as_integer()).unwrap_or(0) as u8,
                power: sk.get("power").and_then(|v| v.as_integer()).unwrap_or(1) as u8,
                target,
                anim,
                status,
            });
        }
    }
    // Menu ACTIONS (C3): heroes.toml `actions`, aligned with the menu
    // widget's items — the author binds meaning to his own labels.
    let mut act_kind: Vec<u8> = Vec::new();
    let mut act_arg: Vec<u8> = Vec::new();
    let mut item_ids: Vec<String> = Vec::new();
    for a in hv.get("actions").and_then(|v| v.as_array()).unwrap_or(&Vec::new()) {
        let a = a.as_str().unwrap_or("");
        if a == "attack" {
            act_kind.push(0);
            act_arg.push(0);
        } else if let Some(sid) = a.strip_prefix("skill:") {
            let i = skill_ids
                .iter()
                .position(|s| s == sid)
                .with_context(|| format!("actions : compétence '{}' inconnue", sid))?;
            act_kind.push(1);
            act_arg.push(i as u8);
        } else if a == "flee" {
            act_kind.push(2);
            act_arg.push(0);
        } else if let Some(iid) = a.strip_prefix("item:") {
            // battle item (C6): resolved against the db below, once open
            let k = match item_ids.iter().position(|s| s == iid) {
                Some(k) => k,
                None => {
                    item_ids.push(iid.to_string());
                    item_ids.len() - 1
                }
            };
            act_kind.push(4);
            act_arg.push(k as u8);
        } else {
            act_kind.push(3); /* inert — reserved */
            act_arg.push(0);
        }
        if act_kind.len() > 8 {
            bail!("actions : 8 entrées de menu au plus");
        }
    }
    if act_kind.is_empty() {
        act_kind.push(0); /* no list: plain attack */
        act_arg.push(0);
    }
    let atb_active = match hv.get("atb").and_then(|v| v.as_str()) {
        None | Some("wait") => 0u8,
        Some("active") => 1,
        Some(other) => bail!("heroes.toml : atb = '{}' (wait, active)", other),
    };
    let menu_widget = match hv.get("menu").and_then(|v| v.as_str()) {
        Some(name) => ui_widgets
            .iter()
            .position(|w| w == name)
            .map(|i| i as u8)
            .with_context(|| format!("combat : widget menu '{}' absent du layout", name))?,
        None => 0xFF,
    };

    let db = db.with_context(|| "combat : pas de database (table monsters requise)")?;
    let mt = db
        .table_id("monsters")
        .with_context(|| "combat : la database n'a pas de table 'monsters'")?;
    // battle items (C6): heal + count variable from the items table
    let mut items: Vec<(u16, u8)> = Vec::new();
    if !item_ids.is_empty() {
        let it = db
            .table_id("items")
            .with_context(|| "actions item: la database n'a pas de table 'items'")?;
        for iid in &item_ids {
            let e = db.entry_index(it, iid).with_context(|| {
                format!("actions : objet '{}' absent de la database", iid)
            })?;
            let heal = db.field_int(it, e, "heal").unwrap_or(0);
            let cv = db.field_int(it, e, "count_var").unwrap_or(0);
            if cv == 0 {
                bail!(
                    "objet '{}' : count_var manquant — la variable (nommée) qui \
                     compte les exemplaires de l'équipe",
                    iid
                );
            }
            if !(0..=255).contains(&cv) {
                bail!("objet '{}' : count_var {} hors limite (0-255)", iid, cv);
            }
            items.push((heal as u16, cv as u8));
        }
    }
    let tv: toml::Table = toml::from_str(&std::fs::read_to_string(&tp)?)
        .context("data/troops.toml")?;
    let mut troops = Vec::new();
    // Monster AI (C4): one pool segment per monster carrying an `ai`
    // list, parsed once and shared by every slot posing that monster.
    let mut ai_kind: Vec<u8> = Vec::new();
    let mut ai_arg: Vec<u8> = Vec::new();
    let mut ai_w: Vec<u8> = Vec::new();
    let mut ai_map: std::collections::HashMap<String, (u8, u8)> =
        std::collections::HashMap::new();
    for (ti, t) in tv.get("troop").and_then(|v| v.as_array()).unwrap_or(&Vec::new()).iter().enumerate() {
        let tid = t.get("id").and_then(|v| v.as_str()).unwrap_or("?");
        let back = t.get("backdrop").and_then(|v| v.as_str()).unwrap_or("");
        // Optional since V4: an empty backdrop is the BLACK screen
        // (stage_request_open 0xFF) — a new project fights before it
        // owns a single picture.
        let backdrop = if back.is_empty() {
            0xFF
        } else {
            pic_id(back, &format!("fond du groupe '{}'", tid))?
        };
        let mut mons = Vec::new();
        for m in t
            .get("monsters")
            .and_then(|v| v.as_array())
            .with_context(|| format!("groupe '{}' : liste monsters requise", tid))?
        {
            let mid = m.get("id").and_then(|v| v.as_str()).unwrap_or("?");
            let e = db
                .entry_index(mt, mid)
                .with_context(|| format!("groupe '{}' : monstre '{}' absent de la database", tid, mid))?;
            let pic = db
                .field_str(mt, e, "battle_pic")
                .with_context(|| format!("monstre '{}' : champ battle_pic vide", mid))?;
            let pid = pic_id(&pic, &format!("battler du monstre '{}'", mid))?;
            let x = m.get("x").and_then(|v| v.as_integer()).unwrap_or(0) as u8;
            let y = m.get("y").and_then(|v| v.as_integer()).unwrap_or(0) as u8;
            let n = |f: &str, d: i64| db.field_int(mt, e, f).unwrap_or(d);
            // `ai` (C4): weighted actions, "attack[:w]" / "skill:<id>[:w]",
            // weight 1 when omitted. Absent or empty: the C2 plain attack.
            let (ai_start, ai_n) = match ai_map.get(mid) {
                Some(&seg) => seg,
                None => {
                    let start = ai_kind.len() as u8;
                    let mut cnt = 0u8;
                    for a in db
                        .field_raw(mt, e, "ai")
                        .and_then(|v| v.as_array())
                        .unwrap_or(&Vec::new())
                    {
                        let a = a.as_str().unwrap_or("");
                        let parts: Vec<&str> = a.split(':').collect();
                        let (kind, arg, wpos) = match parts[0] {
                            "attack" => (0u8, 0u8, 1),
                            "skill" => {
                                let sid = *parts.get(1).unwrap_or(&"");
                                let i = skill_ids
                                    .iter()
                                    .position(|s| s == sid)
                                    .with_context(|| {
                                        format!(
                                            "monstre '{}' : compétence '{}' inconnue (ai)",
                                            mid, sid
                                        )
                                    })?;
                                (1u8, i as u8, 2)
                            }
                            other => bail!(
                                "monstre '{}' : action ai '{}' (attack, skill:<id>)",
                                mid,
                                other
                            ),
                        };
                        let w: u8 = match parts.get(wpos) {
                            Some(t) => t.parse().ok().filter(|&w| w > 0).with_context(
                                || format!("monstre '{}' : poids ai '{}'", mid, a),
                            )?,
                            None => 1,
                        };
                        ai_kind.push(kind);
                        ai_arg.push(arg);
                        ai_w.push(w);
                        cnt += 1;
                        if ai_kind.len() > 255 {
                            bail!("combat : pool d'actions IA plein (255)");
                        }
                    }
                    ai_map.insert(mid.to_string(), (start, cnt));
                    (start, cnt)
                }
            };
            mons.push(TroopMon {
                pic: pid,
                x,
                y,
                dbid: e as u8,
                hp: n("max_hp", 1) as u16,
                atk: n("attack", 1) as u8,
                def: n("defense", 0) as u8,
                spd: n("speed", 40) as u8,
                xp: n("xp", 0) as u16,
                gold: n("gold", 0) as u16,
                mdef: n("magic_def", 0) as u8,
                mag: n("magic", 0) as u8,
                ai_start,
                ai_n,
            });
        }
        if mons.is_empty() || mons.len() > MAX_MONS {
            bail!("groupe '{}' : 1 à {} monstres", tid, MAX_MONS);
        }
        let (intro, low_hp) = hook_ids.get(ti).copied().unwrap_or((0xFF, 0xFF));
        troops.push(Troop { backdrop, mons, intro, low_hp });
    }
    if troops.is_empty() {
        bail!("combat : troops.toml sans groupe");
    }
    println!(
        "  combat : {} héros, {} groupe(s) de monstres",
        heroes.len(),
        troops.len()
    );
    Ok(Some(Battle {
        heroes,
        troops,
        act_kind,
        act_arg,
        skills,
        menu_widget,
        ai_kind,
        ai_arg,
        ai_w,
        atb_active,
        items,
    }))
}

/// The troop ids, in table order — the BATTLE command resolves by name.
pub fn troop_ids(proj_dir: &Path) -> Result<Vec<String>> {
    let tp = proj_dir.join("data/troops.toml");
    if !tp.exists() {
        return Ok(Vec::new());
    }
    let tv: toml::Table = toml::from_str(&std::fs::read_to_string(&tp)?)
        .context("data/troops.toml")?;
    Ok(tv
        .get("troop")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .map(|t| t.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string())
                .collect()
        })
        .unwrap_or_default())
}

/// The troops' hook names (C4): (intro, low_hp) per troop, straight
/// from troops.toml — read EARLY like troop_ids, because the scene
/// compiler needs the referenced common events before battle::build.
pub fn troop_hooks(proj_dir: &Path) -> Result<Vec<(Option<String>, Option<String>)>> {
    let tp = proj_dir.join("data/troops.toml");
    if !tp.exists() {
        return Ok(Vec::new());
    }
    let tv: toml::Table = toml::from_str(&std::fs::read_to_string(&tp)?)
        .context("data/troops.toml")?;
    Ok(tv
        .get("troop")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .map(|t| {
                    let g = |f: &str| {
                        t.get(f)
                            .and_then(|v| v.as_str())
                            .filter(|s| !s.is_empty())
                            .map(|s| s.to_string())
                    };
                    (g("intro"), g("low_hp"))
                })
                .collect()
        })
        .unwrap_or_default())
}

/// Hook names -> common event indices, one (intro, low_hp) pair per
/// troop (0xFF = none). An unknown name is refused plainly.
pub fn resolve_hooks(
    hooks: &[(Option<String>, Option<String>)],
    ce_names: &[String],
) -> Result<Vec<(u8, u8)>> {
    let find = |n: &Option<String>, what: &str, ti: usize| -> Result<u8> {
        match n {
            None => Ok(0xFF),
            Some(n) => ce_names
                .iter()
                .position(|c| c == n)
                .map(|i| i as u8)
                .with_context(|| {
                    format!(
                        "groupe {} : hook {} « {} » n'est pas un common event",
                        ti + 1,
                        what,
                        n
                    )
                }),
        }
    };
    hooks
        .iter()
        .enumerate()
        .map(|(ti, (i, l))| Ok((find(i, "intro", ti)?, find(l, "low_hp", ti)?)))
        .collect()
}

/// The damage popups' digit glyphs (C4): 0-9 as 8x8 white-on-shadow
/// tiles, each on an EVEN char so a digit is a 16x16 small object
/// (OBJ_SIZE16_L32) whose other three chars stay transparent. A name
/// row holds 16 chars = 8 spaced glyphs: 0-7 take row 21 (bottom
/// halves on row 22, blank), 8-9 sit on row 23 as the bottom halves
/// of cells whose tiles point at row 22. 48 chars, 1536 bytes.
fn digit_cells() -> Vec<u8> {
    const GLYPHS: [[&str; 8]; 10] = [
        [".####...", "#....#..", "#...##..", "#..#.#..", "##...#..", "#....#..", ".####...", "........"],
        ["..##....", ".###....", "..##....", "..##....", "..##....", "..##....", "######..", "........"],
        [".####...", "#....#..", ".....#..", "...##...", "..#.....", ".#......", "######..", "........"],
        [".####...", "#....#..", "....#...", "..###...", ".....#..", "#....#..", ".####...", "........"],
        ["...##...", "..#.#...", ".#..#...", "#...#...", "######..", "....#...", "....#...", "........"],
        ["######..", "#.......", "#####...", ".....#..", ".....#..", "#....#..", ".####...", "........"],
        [".####...", "#.......", "#####...", "#....#..", "#....#..", "#....#..", ".####...", "........"],
        ["######..", ".....#..", "....#...", "...#....", "..##....", "..##....", "..##....", "........"],
        [".####...", "#....#..", ".####...", "#....#..", "#....#..", "#....#..", ".####...", "........"],
        [".####...", "#....#..", "#....#..", "#....#..", ".#####..", ".....#..", ".####...", "........"],
    ];
    let mut cells = Vec::with_capacity(1536);
    // canvas: 128 px wide (16 chars) x 24 px tall (3 char rows)
    let w = 128usize;
    let mut canvas = vec![0u8; w * 24];
    for (d, g) in GLYPHS.iter().enumerate() {
        let ox = (d % 8) * 16; // even char = 16 px step
        // 8-9 go to row 23 — the BOTTOM half of a cell whose tile
        // points at row 22 (blank). Row 22 must stay entirely blank:
        // it is the bottom half of every 0-7 cell, and the old layout
        // parked 8-9 there, so a popup showing a 0 or a 1 also showed
        // the top of an 8 or a 9 under it (latent since C4, caught by
        // V1's scripted popup). The engine offsets these two digits
        // 8 px up to compensate.
        let oy = (d / 8) * 16;
        for (y, line) in g.iter().enumerate() {
            for (x, c) in line.bytes().enumerate() {
                if c == b'#' {
                    canvas[(oy + y) * w + ox + x] = 2; // white
                    // drop shadow, bottom-right, where nothing is drawn
                    let (sx, sy) = (ox + x + 1, oy + y + 1);
                    if canvas[sy * w + sx] == 0 {
                        canvas[sy * w + sx] = 1;
                    }
                }
            }
        }
    }
    for ty in 0..3 {
        for tx in 0..16 {
            let mut out = [0u8; 32];
            for y in 0..8 {
                let (mut b0, mut b1, mut b2, mut b3) = (0u8, 0u8, 0u8, 0u8);
                for x in 0..8 {
                    let c = canvas[(ty * 8 + y) * w + tx * 8 + x];
                    let bit = 7 - x;
                    b0 |= (c & 1) << bit;
                    b1 |= ((c >> 1) & 1) << bit;
                    b2 |= ((c >> 2) & 1) << bit;
                    b3 |= ((c >> 3) & 1) << bit;
                }
                out[y * 2] = b0;
                out[y * 2 + 1] = b1;
                out[16 + y * 2] = b2;
                out[16 + y * 2 + 1] = b3;
            }
            cells.extend_from_slice(&out);
        }
    }
    cells
}

/// data_battle.c — ALWAYS emitted, dummy when the project has no battle
/// data, so btl.c and btlprim.c link unconditionally (the m7/pictures
/// recipe). V2 diet: the engine only opens the field — hero cells and
/// stats (poured into reserved variables), troop layout plus each
/// posed monster's DATABASE index, the intro hook, the digit sheet.
/// Monster stats, skills, menu semantics, AI, items: the event
/// library's business, via DBREAD and its own commands.
pub fn emit_files(b: Option<&Battle>) -> Vec<(String, String)> {
    let mut s = String::from(emit::HEADER);
    s.push_str("#include <snes.h>\n\n");
    match b {
        None => {
            s.push_str("const u8 btl_hero_count = 0;\n");
            s.push_str("const u8 *const btl_hero_cells[1] = { 0, };\n");
            s.push_str("const u16 btl_hero_pals[16] = { 0, };\n");
            s.push_str("const u16 btl_hero_maxhp[1] = { 0, };\n");
            s.push_str("const u16 btl_hero_maxmp[1] = { 0, };\n");
            s.push_str("const u8 btl_hero_speed[1] = { 0, };\n");
            s.push_str("const u8 btl_hero_atk[1] = { 0, };\n");
            s.push_str("const u8 btl_hero_def[1] = { 0, };\n");
            s.push_str("const u8 btl_hero_mag[1] = { 0, };\n");
            s.push_str("const u8 btl_hero_mdef[1] = { 0, };\n");
            s.push_str("const u8 btl_troop_count = 0;\n");
            s.push_str("const u8 btl_troop_back[1] = { 0, };\n");
            s.push_str("const u8 btl_troop_n[1] = { 0, };\n");
            s.push_str("const u8 btl_troop_pic[1] = { 0, };\n");
            s.push_str("const u8 btl_troop_x[1] = { 0, };\n");
            s.push_str("const u8 btl_troop_y[1] = { 0, };\n");
            s.push_str("const u8 btl_troop_monid[1] = { 0xFF, };\n");
            s.push_str("const u8 btl_troop_intro[1] = { 0xFF, };\n");
            s.push_str("const u8 btl_digit_cells[1] = { 0, };\n");
            s.push_str("const u16 btl_digit_pal[1] = { 0, };\n");
        }
        Some(b) => {
            let nh = b.heroes.len();
            for (i, h) in b.heroes.iter().enumerate() {
                s.push_str(&emit::u8_array(&format!("btl_hero{}_cell", i), &h.cell, 16, false));
            }
            s.push_str(&format!("\nconst u8 btl_hero_count = {};\n", nh));
            s.push_str(&format!("const u8 *const btl_hero_cells[{}] = {{ ", MAX_HEROES));
            for i in 0..MAX_HEROES {
                if i < nh {
                    s.push_str(&format!("btl_hero{}_cell, ", i));
                } else {
                    s.push_str("0, ");
                }
            }
            s.push_str("};\n");
            let mut pals: Vec<u16> = Vec::new();
            for i in 0..MAX_HEROES {
                if i < nh {
                    pals.extend_from_slice(&b.heroes[i].pal);
                } else {
                    pals.extend_from_slice(&[0u16; 16]);
                }
            }
            s.push_str(&emit::u16_array("btl_hero_pals", &pals));
            let hp: Vec<u16> = b.heroes.iter().map(|h| h.max_hp).collect();
            let mp: Vec<u16> = b.heroes.iter().map(|h| h.max_mp).collect();
            s.push_str(&emit::u16_array("btl_hero_maxhp", &hp));
            s.push_str(&emit::u16_array("btl_hero_maxmp", &mp));
            let sp: Vec<u8> = b.heroes.iter().map(|h| h.speed).collect();
            s.push_str(&emit::u8_array("btl_hero_speed", &sp, 16, false));
            let hat: Vec<u8> = b.heroes.iter().map(|h| h.attack).collect();
            let hde: Vec<u8> = b.heroes.iter().map(|h| h.defense).collect();
            let hmg: Vec<u8> = b.heroes.iter().map(|h| h.magic).collect();
            let hmd: Vec<u8> = b.heroes.iter().map(|h| h.mdef).collect();
            s.push_str(&emit::u8_array("btl_hero_atk", &hat, 16, false));
            s.push_str(&emit::u8_array("btl_hero_def", &hde, 16, false));
            s.push_str(&emit::u8_array("btl_hero_mag", &hmg, 16, false));
            s.push_str(&emit::u8_array("btl_hero_mdef", &hmd, 16, false));

            let nt = b.troops.len();
            s.push_str(&format!("\nconst u8 btl_troop_count = {};\n", nt));
            let back: Vec<u8> = b.troops.iter().map(|t| t.backdrop).collect();
            s.push_str(&emit::u8_array("btl_troop_back", &back, 16, false));
            let n: Vec<u8> = b.troops.iter().map(|t| t.mons.len() as u8).collect();
            s.push_str(&emit::u8_array("btl_troop_n", &n, 16, false));
            let mut pic = Vec::new();
            let mut xs = Vec::new();
            let mut ys = Vec::new();
            let mut mid = Vec::new();
            for t in &b.troops {
                for k in 0..MAX_MONS {
                    match t.mons.get(k) {
                        Some(m) => {
                            pic.push(m.pic);
                            xs.push(m.x);
                            ys.push(m.y);
                            mid.push(m.dbid);
                        }
                        None => {
                            pic.push(0);
                            xs.push(0);
                            ys.push(0);
                            mid.push(0xFF);
                        }
                    }
                }
            }
            s.push_str(&emit::u8_array("btl_troop_pic", &pic, 16, false));
            s.push_str(&emit::u8_array("btl_troop_x", &xs, 16, false));
            s.push_str(&emit::u8_array("btl_troop_y", &ys, 16, false));
            s.push_str(&emit::u8_array("btl_troop_monid", &mid, 16, false));
            let ti: Vec<u8> = b.troops.iter().map(|t| t.intro).collect();
            s.push_str(&emit::u8_array("btl_troop_intro", &ti, 16, false));
            s.push_str(&emit::u8_array("btl_digit_cells", &digit_cells(), 16, false));
            // white digits, black drop shadow, on OBJ palette 4
            let dpal: Vec<u16> = vec![0, 0x0000, 0x7FFF, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            s.push_str(&emit::u16_array("btl_digit_pal", &dpal));
        }
    }
    vec![("data_battle.c".into(), s)]
}
