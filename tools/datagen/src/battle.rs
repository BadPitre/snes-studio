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
}

/// One monster INSTANCE in a troop — its stats baked at build time
/// from the database's `monsters` table, so the engine never walks the
/// generic table registry on the battle's hot path.
pub struct TroopMon {
    pub pic: u8,
    pub x: u8,
    pub y: u8,
    pub hp: u16,
    pub atk: u8,
    pub def: u8,
    pub spd: u8,
    pub xp: u16,
    pub gold: u16,
}

pub struct Troop {
    pub backdrop: u8, // picture id
    pub mons: Vec<TroopMon>,
}

pub struct Battle {
    pub heroes: Vec<Hero>,
    pub troops: Vec<Troop>,
    /// Widget index of the command menu (a cursor list of the project's
    /// UI layout), 0xFF when the project names none — btl then attacks
    /// without a menu.
    pub menu_widget: u8,
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
        });
    }
    if heroes.is_empty() || heroes.len() > MAX_HEROES {
        bail!("combat : 1 à {} héros dans heroes.toml", MAX_HEROES);
    }
    // The command menu: a cursor-list widget of the project's UI layout,
    // named in heroes.toml (`menu = "menu_combat"`). Optional — without
    // it the heroes attack unprompted, which keeps a bare project alive.
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
    let tv: toml::Table = toml::from_str(&std::fs::read_to_string(&tp)?)
        .context("data/troops.toml")?;
    let mut troops = Vec::new();
    for t in tv.get("troop").and_then(|v| v.as_array()).unwrap_or(&Vec::new()) {
        let tid = t.get("id").and_then(|v| v.as_str()).unwrap_or("?");
        let back = t.get("backdrop").and_then(|v| v.as_str()).unwrap_or("");
        let backdrop = pic_id(back, &format!("fond du groupe '{}'", tid))?;
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
            mons.push(TroopMon {
                pic: pid,
                x,
                y,
                hp: n("max_hp", 1) as u16,
                atk: n("attack", 1) as u8,
                def: n("defense", 0) as u8,
                spd: n("speed", 40) as u8,
                xp: n("xp", 0) as u16,
                gold: n("gold", 0) as u16,
            });
        }
        if mons.is_empty() || mons.len() > MAX_MONS {
            bail!("groupe '{}' : 1 à {} monstres", tid, MAX_MONS);
        }
        troops.push(Troop { backdrop, mons });
    }
    if troops.is_empty() {
        bail!("combat : troops.toml sans groupe");
    }
    println!(
        "  combat : {} héros, {} groupe(s) de monstres",
        heroes.len(),
        troops.len()
    );
    Ok(Some(Battle { heroes, troops, menu_widget }))
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

/// data_battle.c — ALWAYS emitted, dummy when the project has no battle
/// data, so btl.c links unconditionally (the m7/pictures recipe).
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
            s.push_str("const u8 btl_troop_count = 0;\n");
            s.push_str("const u8 btl_troop_back[1] = { 0, };\n");
            s.push_str("const u8 btl_troop_n[1] = { 0, };\n");
            s.push_str("const u8 btl_troop_pic[1] = { 0, };\n");
            s.push_str("const u8 btl_troop_x[1] = { 0, };\n");
            s.push_str("const u8 btl_troop_y[1] = { 0, };\n");
            s.push_str("const u8 btl_hero_atk[1] = { 0, };\n");
            s.push_str("const u8 btl_hero_def[1] = { 0, };\n");
            s.push_str("const u16 btl_mon_hp[1] = { 0, };\n");
            s.push_str("const u8 btl_mon_atk[1] = { 0, };\n");
            s.push_str("const u8 btl_mon_def[1] = { 0, };\n");
            s.push_str("const u8 btl_mon_spd[1] = { 0, };\n");
            s.push_str("const u16 btl_mon_xp[1] = { 0, };\n");
            s.push_str("const u16 btl_mon_gold[1] = { 0, };\n");
            s.push_str("const u8 btl_menu_widget = 0xFF;\n");
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

            let nt = b.troops.len();
            s.push_str(&format!("\nconst u8 btl_troop_count = {};\n", nt));
            let back: Vec<u8> = b.troops.iter().map(|t| t.backdrop).collect();
            s.push_str(&emit::u8_array("btl_troop_back", &back, 16, false));
            let n: Vec<u8> = b.troops.iter().map(|t| t.mons.len() as u8).collect();
            s.push_str(&emit::u8_array("btl_troop_n", &n, 16, false));
            let mut pic = Vec::new();
            let mut xs = Vec::new();
            let mut ys = Vec::new();
            let (mut mhp, mut mxp, mut mgold) = (Vec::new(), Vec::new(), Vec::new());
            let (mut matk, mut mdef, mut mspd) = (Vec::new(), Vec::new(), Vec::new());
            for t in &b.troops {
                for k in 0..MAX_MONS {
                    match t.mons.get(k) {
                        Some(m) => {
                            pic.push(m.pic);
                            xs.push(m.x);
                            ys.push(m.y);
                            mhp.push(m.hp);
                            matk.push(m.atk);
                            mdef.push(m.def);
                            mspd.push(m.spd);
                            mxp.push(m.xp);
                            mgold.push(m.gold);
                        }
                        None => {
                            pic.push(0);
                            xs.push(0);
                            ys.push(0);
                            mhp.push(0);
                            matk.push(0);
                            mdef.push(0);
                            mspd.push(0);
                            mxp.push(0);
                            mgold.push(0);
                        }
                    }
                }
            }
            s.push_str(&emit::u8_array("btl_troop_pic", &pic, 16, false));
            s.push_str(&emit::u8_array("btl_troop_x", &xs, 16, false));
            s.push_str(&emit::u8_array("btl_troop_y", &ys, 16, false));
            let hat: Vec<u8> = b.heroes.iter().map(|h| h.attack).collect();
            let hde: Vec<u8> = b.heroes.iter().map(|h| h.defense).collect();
            s.push_str(&emit::u8_array("btl_hero_atk", &hat, 16, false));
            s.push_str(&emit::u8_array("btl_hero_def", &hde, 16, false));
            s.push_str(&emit::u16_array("btl_mon_hp", &mhp));
            s.push_str(&emit::u8_array("btl_mon_atk", &matk, 16, false));
            s.push_str(&emit::u8_array("btl_mon_def", &mdef, 16, false));
            s.push_str(&emit::u8_array("btl_mon_spd", &mspd, 16, false));
            s.push_str(&emit::u16_array("btl_mon_xp", &mxp));
            s.push_str(&emit::u16_array("btl_mon_gold", &mgold));
            s.push_str(&format!("const u8 btl_menu_widget = {};\n", b.menu_widget));
        }
    }
    vec![("data_battle.c".into(), s)]
}
