# The OBJ video map (vidmap) — datagen-computed allocation

## Why

The OBJ side of VRAM (16 KB, 512 chars), the 128 OAM entries and the 8
OBJ palettes are shared by six systems — scene sprite sets, animated
vignettes, posed battlers, damage-popup digits, weather particles,
full-screen borrowers (pictures, stage backgrounds). Until now every
one of them carried its own hardcoded numbers, and the collisions
between them lived in comments. One of those comments was wrong:
weather.c claimed sprite sets "cap out around 360 chars, so there is
no collision", but datagen allows 5 charsets per scene = 512 chars —
a legal scene silently overwrites the digit sheet (char 336+), both
vignette bands (384+, 448+) and the weather blocks (484+). Nothing
checked it; nobody had hit it only because the shipped projects use
small sets.

The founding principle says the engine owns generic primitives and the
game is data. The video map is data: it depends on what THIS project
uses. So datagen computes it and the engine reads it — the same
mechanism as the BG3 char plan (`ui.rs::Plan` → `ui_cfg.h`), which has
kept the UI emitters and the engine from drifting since S1.

## The model

Two temporal CONTEXTS partition the concurrent users; overlap across
contexts is free, overlap inside one is a real collision.

- SCENE: sprite sets (chars 0..footprint), weather, vignettes.
- COMPOSED SCREEN (stage): the backdrop's chars (0..unique), digits,
  posed battlers, vignettes.

Pictures borrow the whole region but suspend everybody, and every
system reloads after them — they stay out of the map.

`tools/datagen/src/vidmap.rs` scans every JSON file of the project
(the `mode7::collect_ramps` recipe) for the commands that actually
engage each system: `weather`, `popup`, `btl_pose`, `vig_show` /
`vig_play` / `vig_hide` / `anim_play`, plus the screens' posed
vignettes. An unused system reserves nothing.

## What is generated

`engine/src/data/vidmap.h` — always emitted, `#define`s only, so the
engine keeps compile-time constants (tcc-816 pays for every indirection)
while the NUMBERS become project property. Consumers converted:
`vignette.c` (char/OAM tables, palette pool), `btlprim.c` (battler
cells, digit sheet, popup OAM, digit palette), `weather.c` (blocks,
OAM, palette). The canonical layout is unchanged when a feature is
used — v1 moves the OWNERSHIP of the numbers, not the numbers.

One value already varies: `VID_VIG_PAL_C`. In a scene the vignette
palette pool was {5, 6} because weather owns 7 — in a project with no
weather command, the pool becomes {5, 6, 7}: three distinct sheets on
a map instead of two. `0xFF` (never matching) when weather is used.

Two invariants the header documents because the engine bakes them into
OAM attribute bytes: vignette and battler chars stay ≥ 256 (tile bit 8
is hardwired to 1), and the digit/weather palettes are baked with
`(pal << 1)` in `om[3]` — vidmap.rs asserts what it emits.

## The checks

- ERROR — scene footprint: if vignettes are used anywhere, a scene's
  sprite set must stay under the vignette base (384 chars = 4 blocks);
  under the weather blocks (484) if only weather is used. The message
  names the scene, its block count and who owns the chars above the
  limit. This replaces silent corruption; the old flat "5 charsets max"
  still applies when nothing above is in use.
- WARNING — screen backdrop: a backdrop with more unique chars than
  336 (digits in use) or 384 (vignettes) is reported with the screen
  and picture names. A warning and not an error because which screens
  actually pop damage is a runtime question; SPEC_FORMATS already calls
  this collision "documented (rare)".
- WARNING — weather vs slots 5-8: their chars are shared ground
  (vignette.h); the build now says so when a project combines rain or
  snow with high slots or the animation player.

## Later (out of v1)

- Dynamic placement: move the bases themselves (weather aliasing the
  digit rows — scene vs stage makes it free), size the vignette band by
  sheet count. Consumers are ready: they no longer know any number.
- O-C (multi-size sprite cells) will size the band per sheet; the char
  quantum stays 4 chars / aligned rows (see the 16-wide name grid).
- BG side (vram.h) stays engine-owned for now: its layout does not
  depend on project data the way the OBJ side does.
