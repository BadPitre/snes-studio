//! The OBJ-side video map (docs/PLANNING_VIDMAP.md).
//!
//! OBJ chars, OAM entries and OBJ palettes are shared by six systems
//! whose numbers used to live hardcoded in the engine, with the
//! collisions between them documented only in comments — one of which
//! (weather.c's "sprite sets cap out around 360 chars") was plain
//! wrong: a legal 5-charset scene is 512 chars and silently overwrote
//! everything above 336. This module scans what the project actually
//! USES, checks the real footprints against the map, and emits the map
//! as `engine/src/data/vidmap.h` — the `ui.rs::Plan` → `ui_cfg.h`
//! recipe applied to the OBJ side. An unused system reserves nothing.
//!
//! v1 keeps the canonical layout whenever a system is in use: it moves
//! the OWNERSHIP of the numbers into generated data, not the numbers
//! themselves. The one value that already varies is the third scene
//! palette for vignettes, freed when no weather command exists.

use serde_json::Value;

use anyhow::{bail, Result};

use crate::emit;
use crate::project::ScreenDef;

/* The canonical OBJ map (chars are OBJ tile numbers, 0-511). See the
   context table in PLANNING_VIDMAP.md: scene users are the sprite sets
   (from char 0 up), weather and vignettes; stage users are the
   backdrop (from 0 up), the digits, the battlers and vignettes. */
const DIG_CHAR: u16 = 336; /* damage-popup digit sheet, 48 chars */
const VIG_BASE: u16 = 384; /* vignette slots 0-7, 128 chars */
const BP_BASE: u16 = 448; /* posed battlers, aliases slots 4-7 */
const WEA_RAIN: u16 = 484; /* 16x16 block: c, c+1, c+16, c+17 */
const WEA_SNOW: u16 = 486;

/// What the project actually engages, harvested from every JSON file
/// (the `mode7::collect_ramps` recipe: a command hidden inside a
/// condition, a loop or a screen script is found without anyone
/// maintaining a list of places to look).
#[derive(Default)]
pub struct Usage {
    pub weather: bool,
    pub popups: bool,
    pub battlers: bool,
    pub vignettes: bool,
    /// Slots 5-8 or the animation player (which allocates from the top
    /// down): the users whose chars the weather shares in a scene.
    pub high_slots: bool,
}

pub fn scan(roots: &[Value], screens: &[ScreenDef]) -> Usage {
    fn walk(v: &Value, u: &mut Usage) {
        match v {
            Value::Object(m) => {
                if let Some(c) = m.get("c").and_then(|c| c.as_str()) {
                    match c {
                        "weather" => u.weather = true,
                        "popup" => u.popups = true,
                        "btl_pose" => u.battlers = true,
                        "vig_show" | "vig_play" | "vig_hide" => {
                            u.vignettes = true;
                            if m.get("slot").and_then(|s| s.as_u64()).unwrap_or(0) >= 5 {
                                u.high_slots = true;
                            }
                        }
                        "anim_play" => {
                            u.vignettes = true;
                            u.high_slots = true;
                        }
                        _ => {}
                    }
                }
                for sub in m.values() {
                    walk(sub, u);
                }
            }
            Value::Array(a) => {
                for sub in a {
                    walk(sub, u);
                }
            }
            _ => {}
        }
    }
    let mut u = Usage::default();
    for r in roots {
        walk(r, &mut u);
    }
    // Screens pose vignettes as data, not commands ({name, slot, vig});
    // their JSON is in `roots` but carries no "c" to match on.
    for def in screens {
        for v in &def.vignettes {
            u.vignettes = true;
            if v.slot >= 5 {
                u.high_slots = true;
            }
        }
    }
    u
}

/// The scene-context check: a scene's sprite set grows from char 0 and
/// must stop below the first reserved region the project engages.
/// `scenes` is (name, char footprint of its sprite set).
pub fn check_scenes(u: &Usage, scenes: &[(String, usize)]) -> Result<()> {
    // (limit, owner) of the lowest engaged region above the sets.
    let limit: Option<(usize, &str)> = if u.vignettes {
        Some((VIG_BASE as usize, "les sprites animés (chars 384-511)"))
    } else if u.weather {
        Some((WEA_RAIN as usize, "les particules météo (chars 484+)"))
    } else {
        None
    };
    let Some((limit, owner)) = limit else { return Ok(()) };
    for (name, chars) in scenes {
        if *chars > limit {
            bail!(
                "scene '{}' : ses charsets occupent {} chars OBJ, mais {} \
                 commencent au char {} — la scène les écraserait en \
                 silence.\nRéduire la variété d'apparences de la scène \
                 ({} chars = 4 blocs de personnage), ou retirer du projet \
                 les commandes qui utilisent cette réserve.",
                name, chars, owner, limit, limit
            );
        }
    }
    Ok(())
}

/// The stage-context advisory: a backdrop's unique chars grow from 0
/// and can reach into the digits or the vignettes. A warning and not
/// an error — which screens actually pop damage is a runtime question
/// (SPEC_FORMATS calls the collision "documented, rare").
/// `backdrops` is (screen name, picture name, unique chars).
pub fn warn_screens(u: &Usage, backdrops: &[(String, String, usize)]) {
    let limit: Option<(usize, &str)> = if u.popups {
        Some((DIG_CHAR as usize, "les chiffres de dégâts (char 336+)"))
    } else if u.vignettes {
        Some((VIG_BASE as usize, "les sprites animés (char 384+)"))
    } else {
        None
    };
    let Some((limit, owner)) = limit else { return };
    for (screen, pic, chars) in backdrops {
        if *chars > limit {
            println!(
                "  attention : écran '{}' — le fond '{}' occupe {} chars \
                 OBJ et déborde sur {} ; les sprites de l'écran peuvent \
                 se corrompre",
                screen, pic, chars, owner
            );
        }
    }
    if u.weather && u.high_slots {
        println!(
            "  attention : météo + sprites animés en emplacements 5-8 \
             (ou animations) — leurs chars sont partagés en scène, \
             pluie/neige corrompt ces emplacements tant qu'elle tombe"
        );
    }
}

/// The generated header. Always emitted; `#define`s so the engine
/// keeps compile-time constants (tcc-816 pays for indirection).
pub fn header(u: &Usage) -> String {
    // Both invariants the engine bakes into OAM attribute bytes: keep
    // them true here rather than teaching the engine to compute them.
    assert!(VIG_BASE >= 256 && BP_BASE >= 256, "OAM tile bit 8 is baked to 1");
    let pal_c: u8 = if u.weather { 0xFF } else { 7 };
    let mut s = String::from(emit::HEADER);
    s.push_str(
        "/* OBJ-side video map (vidmap.rs, PLANNING_VIDMAP.md). The engine\n\
         \x20  bakes OAM tile bit 8 to 1 for vignettes and battlers: their\n\
         \x20  chars stay >= 256 by construction here. */\n\n",
    );
    s.push_str("/* vignettes: 8 slots of 16 chars (4 grid columns x 4 rows) */\n");
    s.push_str(&format!(
        "#define VID_VIG_CHARS {{ {}, {}, {}, {}, {}, {}, {}, {} }}\n",
        VIG_BASE, VIG_BASE + 4, VIG_BASE + 8, VIG_BASE + 12,
        BP_BASE, BP_BASE + 4, BP_BASE + 8, BP_BASE + 12
    ));
    s.push_str(
        "#define VID_VIG_OAMS \\\n  { 96 << 2, 97 << 2, 98 << 2, 99 << 2, \
         50 << 2, 51 << 2, 52 << 2, 53 << 2 }\n",
    );
    s.push_str(&format!(
        "/* scene palette pool for vignettes: {{A, B[, C]}} — C is the\n\
         \x20  weather's palette, in the pool only when no weather command\n\
         \x20  exists in the project (0xFF = never matches) */\n\
         #define VID_VIG_PAL_A 5\n\
         #define VID_VIG_PAL_B 6\n\
         #define VID_VIG_PAL_C 0x{:02X}\n\n", pal_c
    ));
    s.push_str(&format!(
        "/* posed battlers: 4 cells aliasing vignette slots 4-7 (documented\n\
         \x20  exclusivity, vignette.h) */\n\
         #define VID_BP_CHAR_BASE {}\n\
         #define VID_BP_OAM_BASE 104\n\n", BP_BASE
    ));
    s.push_str(&format!(
        "/* damage-popup digits: 48 chars, OBJ palette 4 */\n\
         #define VID_DIG_CHAR {}\n\
         #define VID_DIG_PAL 4\n\
         #define VID_POP_OAM_BASE 100\n\n", DIG_CHAR
    ));
    s.push_str(&format!(
        "/* weather: two 16x16 blocks (c, c+1, c+16, c+17 each) */\n\
         #define VID_WEA_CHAR_RAIN {}\n\
         #define VID_WEA_CHAR_SNOW {}\n\
         #define VID_WEA_OAM_BASE 100\n\
         #define VID_WEA_PAL 7\n", WEA_RAIN, WEA_SNOW
    ));
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cmds(json: &str) -> Vec<Value> {
        vec![serde_json::from_str(json).unwrap()]
    }

    #[test]
    fn scan_finds_nested_commands() {
        let roots = cmds(
            r#"{"scenes":[{"events":[{"pages":[{"commands":[
                {"c":"if_var","then":[{"c":"weather","type":"rain"}]},
                {"c":"vig_show","slot":6,"vig":"x"}]}]}]}]}"#,
        );
        let u = scan(&roots, &[]);
        assert!(u.weather && u.vignettes && u.high_slots);
        assert!(!u.popups && !u.battlers);
    }

    #[test]
    fn scene_over_vignettes_is_an_error() {
        let u = Usage { vignettes: true, ..Default::default() };
        let scenes = vec![("plaine".to_string(), 512usize)];
        let err = check_scenes(&u, &scenes).unwrap_err().to_string();
        assert!(err.contains("plaine") && err.contains("384"), "{err}");
    }

    #[test]
    fn scene_fits_when_nothing_reserved() {
        let u = Usage::default();
        let scenes = vec![("plaine".to_string(), 512usize)];
        assert!(check_scenes(&u, &scenes).is_ok());
    }

    #[test]
    fn four_blocks_exactly_fit_under_vignettes() {
        let u = Usage { vignettes: true, ..Default::default() };
        let scenes = vec![("bourg".to_string(), 384usize)];
        assert!(check_scenes(&u, &scenes).is_ok());
    }

    #[test]
    fn third_palette_follows_the_weather() {
        let dry = header(&Usage::default());
        assert!(dry.contains("#define VID_VIG_PAL_C 0x07"), "{dry}");
        let wet = header(&Usage { weather: true, ..Default::default() });
        assert!(wet.contains("#define VID_VIG_PAL_C 0xFF"), "{wet}");
    }
}
