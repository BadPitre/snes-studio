//! snesbuild — drives the PVSnesLib toolchain directly, with no make and
//! no shell.
//!
//! WHY THIS EXISTS: the ROM used to be built by `make`, which includes
//! PVSnesLib's `snes_rules`, which assumes a POSIX shell (wildcards, `ls`,
//! `sed`, `for` loops). On Windows that means MSYS2 — so shipping the
//! editor as an installer meant shipping, or asking the author to install,
//! a whole Unix environment just to press "Build". This binary is the same
//! pipeline expressed once, natively, on every platform.
//!
//! THE CONTRACT: the ROM it produces is BYTE FOR BYTE the one `make`
//! produced. That is checkable (tools/gate-snesbuild.sh) and it is the
//! only reason a rewrite of a build is safe — a build that is "close
//! enough" silently changes the game.
//!
//! The pipeline, per source:
//!     .c   --816-tcc-->  .ps  --816-opt-->  .asp  --constify-->  .asm
//!     .asm --wla-65816-> .obj
//!     all .obj + the LoROM_SlowROM libs --wlalink--> .sfc
//!
//! Usage:
//!     snesbuild build --engine <dir> --toolchain <PVSnesLib root>
//!     snesbuild cart  --engine <dir> --toolchain <dir>   (adds the .smc)
//!     snesbuild clean --engine <dir>
//!     snesbuild sync  --from <read-only sources> --to <work dir>

use anyhow::{bail, Context, Result};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const ROM_NAME: &str = "snesstudio";

struct Cfg {
    engine: PathBuf,
    toolchain: PathBuf,
    rom: String,
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = args.first().map(String::as_str).unwrap_or("");
    let get = |name: &str| -> Option<String> {
        args.iter().position(|a| a == name).and_then(|i| args.get(i + 1).cloned())
    };
    let engine = PathBuf::from(get("--engine").unwrap_or_else(|| ".".into()));
    let rom = get("--rom").unwrap_or_else(|| ROM_NAME.into());

    if cmd == "clean" {
        return clean(&engine, &rom);
    }
    if cmd == "sync" {
        let from = get("--from").context("sync needs --from")?;
        let to = get("--to").context("sync needs --to")?;
        return sync(Path::new(&from), Path::new(&to));
    }
    if !matches!(cmd, "build" | "cart") {
        eprintln!(
            "usage: snesbuild build|cart|clean|sync --engine <dir> --toolchain <dir> [--rom <name>]"
        );
        std::process::exit(2);
    }

    // The toolchain root: the flag, else PVSNESLIB_HOME. The installed
    // editor passes the flag (it carries its own copy); a checkout falls
    // back to the environment, so the repo keeps working as before.
    let toolchain = match get("--toolchain").or_else(|| std::env::var("PVSNESLIB_HOME").ok()) {
        Some(t) => native_path(&t),
        None => bail!(
            "no toolchain: pass --toolchain <PVSnesLib root> or set PVSNESLIB_HOME"
        ),
    };
    let cfg = Cfg { engine, toolchain, rom };
    check_toolchain(&cfg)?;
    build(&cfg)?;
    if cmd == "cart" {
        cart(&cfg)?;
    }
    Ok(())
}

/// PVSnesLib's own Makefile demands a Unix-style PVSNESLIB_HOME, on Windows
/// too (/c/snesdev/pvsneslib) — a form Windows itself cannot open. A
/// checkout falls back to that variable, so accept the shape it has rather
/// than ask the author to keep a second one in step.
fn native_path(p: &str) -> PathBuf {
    #[cfg(windows)]
    {
        let b = p.as_bytes();
        if b.len() > 3 && b[0] == b'/' && b[2] == b'/' && b[1].is_ascii_alphabetic() {
            return PathBuf::from(format!(
                "{}:\\{}",
                (b[1] as char).to_ascii_uppercase(),
                p[3..].replace('/', "\\")
            ));
        }
    }
    PathBuf::from(p)
}

// ---- toolchain layout -------------------------------------------------

impl Cfg {
    fn tool(&self, rel: &str) -> PathBuf {
        let mut p = self.toolchain.join(rel);
        if cfg!(windows) {
            p.set_extension("exe");
        }
        p
    }
    fn cc(&self) -> PathBuf { self.tool("devkitsnes/bin/816-tcc") }
    fn asm(&self) -> PathBuf { self.tool("devkitsnes/bin/wla-65816") }
    fn link(&self) -> PathBuf { self.tool("devkitsnes/bin/wlalink") }
    fn opt(&self) -> PathBuf { self.tool("devkitsnes/tools/816-opt") }
    fn constify(&self) -> PathBuf { self.tool("devkitsnes/tools/constify") }
    fn smconv(&self) -> PathBuf { self.tool("devkitsnes/tools/smconv") }
    /// LoROM + SlowROM: the memory map hdr.asm declares. Changing it means
    /// changing hdr.asm too, so it is not a flag.
    fn libdir(&self) -> PathBuf { self.toolchain.join("pvsneslib/lib/LoROM_SlowROM") }
}

fn check_toolchain(cfg: &Cfg) -> Result<()> {
    for (what, p) in [
        ("816-tcc", cfg.cc()),
        ("wla-65816", cfg.asm()),
        ("wlalink", cfg.link()),
        ("816-opt", cfg.opt()),
        ("constify", cfg.constify()),
        // The HEADERS, not only the binaries. A toolchain that compiles
        // nothing because snes.h is absent used to surface forty lines
        // later as a tcc include error, which names the symptom and not
        // the cause — the classic half-staged vendor copy.
        ("snes.h", cfg.toolchain.join("pvsneslib/include/snes.h")),
    ] {
        if !p.exists() {
            bail!(
                "{} not found at {} — wrong toolchain root, or an \
                 incomplete copy (re-run `npm run vendor` in editor/)",
                what,
                p.display()
            );
        }
    }
    if !cfg.libdir().is_dir() {
        bail!("library folder not found: {}", cfg.libdir().display());
    }
    Ok(())
}

// ---- file discovery ---------------------------------------------------

/// Files matching `<dir>/*.<ext>`, sorted byte-wise. Sorted rather than
/// left in directory order because the order of the objects decides where
/// wlalink puts each section: a build that depends on how the filesystem
/// happens to list a folder is not reproducible.
fn glob(dir: &Path, ext: &str) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    if !dir.is_dir() {
        return Ok(out);
    }
    for e in fs::read_dir(dir).with_context(|| format!("reading {}", dir.display()))? {
        let p = e?.path();
        if p.is_file() && p.extension().is_some_and(|x| x == ext) {
            out.push(p);
        }
    }
    out.sort();
    Ok(out)
}

/// The source tree snes_rules scans: the engine root plus three levels
/// under src/.
fn sources(engine: &Path, ext: &str) -> Result<Vec<PathBuf>> {
    let mut out = glob(engine, ext)?;
    let src = engine.join("src");
    out.extend(glob(&src, ext)?);
    let mut level1: Vec<PathBuf> = Vec::new();
    if src.is_dir() {
        for e in fs::read_dir(&src)? {
            let p = e?.path();
            if p.is_dir() {
                level1.push(p);
            }
        }
        level1.sort();
    }
    for d in &level1 {
        out.extend(glob(d, ext)?);
        let mut level2: Vec<PathBuf> = Vec::new();
        for e in fs::read_dir(d)? {
            let p = e?.path();
            if p.is_dir() {
                level2.push(p);
            }
        }
        level2.sort();
        for d2 in &level2 {
            out.extend(glob(d2, ext)?);
        }
    }
    Ok(out)
}

fn with_ext(p: &Path, ext: &str) -> PathBuf {
    let mut q = p.to_path_buf();
    q.set_extension(ext);
    q
}

/// Paths go into linkfile relative to the engine folder, as make wrote
/// them — wlalink resolves them from its working directory.
fn rel(engine: &Path, p: &Path) -> String {
    p.strip_prefix(engine).unwrap_or(p).to_string_lossy().replace('\\', "/")
}

// ---- running a tool ---------------------------------------------------

fn run(what: &str, cmd: &mut Command) -> Result<()> {
    run_capturing(what, cmd).map(|_| ())
}

/// Same, but hands the tool's stdout back. wlalink already computes the
/// ROM occupancy under `-v` and we were throwing it away.
fn run_capturing(what: &str, cmd: &mut Command) -> Result<String> {
    let out = cmd.output().with_context(|| format!("running {}", what))?;
    if !out.status.success() {
        let mut msg = String::from_utf8_lossy(&out.stdout).into_owned();
        msg.push_str(&String::from_utf8_lossy(&out.stderr));
        bail!("{} failed:\n{}", what, msg.trim());
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// ROM occupancy, from wlalink's own per-bank report.
///
/// Worth surfacing rather than computing: the .sfc is PADDED to the size
/// declared in the header, so its length says nothing at all about how
/// much of it is used. Before this, "how much ROM is left" was a question
/// nobody in the project could answer — and it gates every decision about
/// precompiled tables (Mode 7 rotation, PLANNING_SYSTEME_MODE7 §7.2d).
fn report_rom(link_out: &str) {
    let (mut banks, mut free, mut empty) = (0usize, 0usize, 0usize);
    for line in link_out.lines() {
        let Some(rest) = line.strip_prefix("ROM bank ") else { continue };
        let Some((_, tail)) = rest.split_once(" (") else { continue };
        let Some((n, _)) = tail.split_once(" bytes") else { continue };
        let Ok(n) = n.parse::<usize>() else { continue };
        banks += 1;
        free += n;
        if n == 32768 {
            empty += 1;
        }
    }
    if banks == 0 {
        return; /* an older wlalink, or -v dropped: say nothing rather
                   than print a wrong number */
    }
    let total = banks * 32768;
    println!(
        "  ROM {} Ko utilises sur {} Ko ({} % libre, {} banques vides sur {})",
        (total - free) / 1024,
        total / 1024,
        100 * free / total,
        empty,
        banks
    );
}

/// 816-opt writes the optimised assembly to STDOUT; make redirected it to
/// a file, and so do we.
fn run_to_file(what: &str, cmd: &mut Command, dest: &Path) -> Result<()> {
    let out = cmd.output().with_context(|| format!("running {}", what))?;
    if !out.status.success() {
        bail!("{} failed:\n{}", what, String::from_utf8_lossy(&out.stderr).trim());
    }
    fs::write(dest, &out.stdout).with_context(|| format!("writing {}", dest.display()))?;
    Ok(())
}

// ---- the build --------------------------------------------------------

fn build(cfg: &Cfg) -> Result<()> {
    let engine = &cfg.engine;

    // The .asm and .ps next to a .c are INTERMEDIATES, not sources. An
    // interrupted build leaves them behind, and the next one would take
    // them for hand-written assembly — the object then enters the link
    // twice and the ROM keeps a stale project's state (the phantom-widget
    // bug). Purge them before anything looks at the tree.
    let c_files = sources(engine, "c")?;
    for c in &c_files {
        let _ = fs::remove_file(with_ext(c, "asm"));
        let _ = fs::remove_file(with_ext(c, "ps"));
    }

    // Hand-written assembly is whatever is left once the intermediates are
    // gone. Read BEFORE compiling, for the same reason.
    let mut asm_files = sources(engine, "asm")?;

    // Music: one soundbank for all the .it modules, pinned in bank $87.
    let music = glob(&engine.join("src/data/music"), "it")?;
    if !music.is_empty() {
        let bank = engine.join("src/data/soundbank");
        println!("  soundbank ({} module(s))", music.len());
        let mut c = Command::new(cfg.smconv());
        c.current_dir(engine)
            .args(["-s", "-o"])
            .arg(rel(engine, &bank))
            .args(["-V", "-b", "7"]);
        for m in &music {
            c.arg(rel(engine, m));
        }
        run("smconv", &mut c)?;
        asm_files.push(with_ext(&bank, "asm"));
    }

    // C: three tools per file, exactly as snes_rules chains them.
    let inc_pvs = cfg.toolchain.join("pvsneslib/include");
    let inc_dks = cfg.toolchain.join("devkitsnes/include");
    for c in &c_files {
        println!("  cc  {}", rel(engine, c));
        let ps = with_ext(c, "ps");
        run(
            "816-tcc",
            Command::new(cfg.cc())
                .current_dir(engine)
                .arg(format!("-I{}", inc_pvs.display()))
                .arg(format!("-I{}", inc_dks.display()))
                .arg(format!("-I{}", engine.display()))
                .arg("-Wall")
                .arg("-c")
                .arg(rel(engine, c))
                .arg("-o")
                .arg(rel(engine, &ps)),
        )?;

        let asp = with_ext(c, "asp");
        run_to_file(
            "816-opt",
            Command::new(cfg.opt()).current_dir(engine).arg(rel(engine, &ps)),
            &asp,
        )?;

        // constify moves the read-only tables out of RAM and into ROM; it
        // needs the ORIGINAL .c to know which ones.
        run(
            "constify",
            Command::new(cfg.constify())
                .current_dir(engine)
                .arg(rel(engine, c))
                .arg(rel(engine, &asp))
                .arg(rel(engine, &with_ext(c, "asm"))),
        )?;
        let _ = fs::remove_file(&asp);
    }

    // Assemble everything: the generated assembly and the hand-written
    // assembly go through the same tool with the same flags.
    let mut objects: BTreeSet<String> = BTreeSet::new();
    let all_asm: Vec<PathBuf> =
        c_files.iter().map(|c| with_ext(c, "asm")).chain(asm_files.iter().cloned()).collect();
    for a in &all_asm {
        let obj = with_ext(a, "obj");
        println!("  as  {}", rel(engine, a));
        run(
            "wla-65816",
            Command::new(cfg.asm())
                // -d keeps WLA from folding A-B where both are labels: the
                // PVSnesLib crt0 relies on that arithmetic surviving.
                .current_dir(engine)
                .args(["-d", "-s", "-x", "-o"])
                .arg(rel(engine, &obj))
                .arg(rel(engine, a)),
        )?;
        objects.insert(rel(engine, &obj));
    }

    // linkfile: our objects first, then the runtime libraries. The order
    // is what places the sections, so both lists are sorted.
    //
    // The libraries are COPIED next to the objects and listed relatively.
    // wlalink reads this file with whitespace-separated parsing, so an
    // absolute path containing a space is truncated at the space — which
    // is not hypothetical: the installed toolchain lives under "SNES
    // Studio", and an author's project may well sit in "Mes Jeux". Every
    // path in here is therefore relative to the engine folder, and nothing
    // we write can contain a space.
    let libdst = engine.join("lib");
    fs::create_dir_all(&libdst)?;
    let mut libs: Vec<String> = Vec::new();
    for e in fs::read_dir(cfg.libdir())
        .with_context(|| format!("reading {}", cfg.libdir().display()))?
    {
        let p = e?.path();
        if p.is_file() {
            let name = p.file_name().unwrap().to_string_lossy().into_owned();
            fs::copy(&p, libdst.join(&name))
                .with_context(|| format!("copying {}", p.display()))?;
            libs.push(format!("lib/{}", name));
        }
    }
    libs.sort();

    let mut linkfile = String::from("[objects]\n");
    for o in &objects {
        linkfile.push_str(o);
        linkfile.push('\n');
    }
    for l in &libs {
        linkfile.push_str(l);
        linkfile.push('\n');
    }
    fs::write(engine.join("linkfile"), &linkfile)?;

    let sfc = format!("{}.sfc", cfg.rom);
    let sym = format!("{}.sym", cfg.rom);
    let _ = fs::remove_file(engine.join(&sym));
    println!("  link {}", sfc);
    let link_out = run_capturing(
        "wlalink",
        Command::new(cfg.link())
            .current_dir(engine)
            // -c tolerates duplicate labels; PVSnesLib's libraries need it.
            .args(["-d", "-s", "-v", "-A", "-c", "-L"])
            .arg(cfg.libdir())
            .arg("linkfile")
            .arg(&sfc),
    )?;
    report_rom(&link_out);

    clean_sym(&engine.join(&sym))?;
    check_wram(cfg, &engine.join(&sym), &engine.join(&sfc))?;
    println!("built {}", sfc);
    Ok(())
}

/// The symbol file feeds the Mesen debugger: drop the colon wlalink puts
/// after the address and the section bookkeeping it duplicates.
fn clean_sym(sym: &Path) -> Result<()> {
    if !sym.exists() {
        return Ok(());
    }
    let text = fs::read_to_string(sym).with_context(|| format!("reading {}", sym.display()))?;
    let mut out = String::with_capacity(text.len());
    for line in text.lines() {
        if line.contains(" SECTIONSTART_")
            || line.contains(" SECTIONEND_")
            || line.contains(" RAM_USAGE_SLOT_")
        {
            continue;
        }
        // sed 's/://' — the FIRST colon only
        match line.find(':') {
            Some(i) => {
                out.push_str(&line[..i]);
                out.push_str(&line[i + 1..]);
            }
            None => out.push_str(line),
        }
        out.push('\n');
    }
    fs::write(sym, out)?;
    Ok(())
}

/// tcc-816 puts its .bss in bank $7E SLOT 2 while PVSnesLib puts its own
/// variables (oamMemory at $7E:9094) in SLOT 0 of the SAME bank, and WLA
/// allocates the two slots without noticing the overlap. A .bss past
/// $7E:8000 therefore overwrites the OAM shadow with no link error at all:
/// the zeroed entries become visible 16x16 sprites stacked at (0,0), which
/// saturates the 32-sprites-per-line limit and makes the PPU delete the
/// hero. Fail the build instead, and delete the ROM so nobody runs it.
fn check_wram(_cfg: &Cfg, sym: &Path, sfc: &Path) -> Result<()> {
    if !sym.exists() {
        return Ok(());
    }
    let text = fs::read_to_string(sym)?;
    // A symbol line reads "007e9094 name". Bank $7E at $8000 or above is
    // PVSnesLib's; tccs_ marks a tcc-816 static.
    let bad: Vec<&str> = text
        .lines()
        .filter(|line| {
            let l = line.trim_start().as_bytes();
            l.len() > 9
                && l[..4].eq_ignore_ascii_case(b"007e")
                && matches!(l[4].to_ascii_lowercase(), b'8'..=b'9' | b'a'..=b'f')
                && l[5..8].iter().all(|c| c.is_ascii_hexdigit())
                && l[8] == b' '
                && line.trim_start()[9..].starts_with("tccs_")
        })
        .collect();
    if !bad.is_empty() {
        let _ = fs::remove_file(sfc);
        bail!(
            "the .bss overflows into PVSnesLib's RAM (>= $7E:8000).\n\
             Move the large buffers to bank $7F (see wram7f.asm).\n{}",
            bad.join("\n")
        );
    }
    Ok(())
}

// ---- cartridge build --------------------------------------------------

/// The engine's ROM comes out at 256 KB, a size many flashcarts refuse
/// ("File type error" on a Super UFO Pro 8). Mirror the content up to
/// 512 KB minimum — exactly what a real cartridge's address decoding does
/// with the unwired lines — then repair the internal header.
fn cart(cfg: &Cfg) -> Result<()> {
    let src = cfg.engine.join(format!("{}.sfc", cfg.rom));
    let dst = cfg.engine.join(format!("{}.smc", cfg.rom));
    let mut rom = fs::read(&src).with_context(|| format!("reading {}", src.display()))?;
    while rom.len() < 512 * 1024 {
        rom.extend_from_within(..);
    }

    // Size byte: 2^n KB -> n (512 KB = 0x09, 1 MB = 0x0A, ...)
    let kb = rom.len() / 1024;
    let mut n = 0u8;
    let mut v = kb;
    while v > 1 {
        v /= 2;
        n += 1;
    }
    rom[0x7FD7] = n;

    // Checksum: the sum of every byte with complement=FFFF and
    // checksum=0000 in place (the SNES convention), written back with its
    // complement.
    rom[0x7FDC] = 0xFF;
    rom[0x7FDD] = 0xFF;
    rom[0x7FDE] = 0x00;
    rom[0x7FDF] = 0x00;
    let sum: u32 = rom.iter().map(|&b| b as u32).sum();
    let sum = (sum % 65536) as u16;
    let comp = sum ^ 0xFFFF;
    rom[0x7FDC] = (comp & 0xFF) as u8;
    rom[0x7FDD] = (comp >> 8) as u8;
    rom[0x7FDE] = (sum & 0xFF) as u8;
    rom[0x7FDF] = (sum >> 8) as u8;

    fs::write(&dst, &rom).with_context(|| format!("writing {}", dst.display()))?;
    println!("cartridge: {} ({} KB, checksum {:#06x})", dst.display(), kb, sum);
    Ok(())
}

// ---- clean ------------------------------------------------------------

fn clean(engine: &Path, rom: &str) -> Result<()> {
    for c in sources(engine, "c")? {
        let _ = fs::remove_file(with_ext(&c, "asm"));
        let _ = fs::remove_file(with_ext(&c, "ps"));
        let _ = fs::remove_file(with_ext(&c, "asp"));
    }
    for a in sources(engine, "asm")? {
        let _ = fs::remove_file(with_ext(&a, "obj"));
    }
    // the runtime libraries copied in beside the objects (see build())
    let _ = fs::remove_dir_all(engine.join("lib"));
    for f in [
        format!("{}.sfc", rom),
        format!("{}.smc", rom),
        format!("{}.sym", rom),
        "linkfile".into(),
        "src/data/soundbank.asm".into(),
        "src/data/soundbank.h".into(),
        "src/data/soundbank.bnk".into(),
    ] {
        let _ = fs::remove_file(engine.join(f));
    }
    println!("cleaned");
    Ok(())
}

// ---- staging ----------------------------------------------------------

/// Copies the engine SOURCES into a writable folder.
///
/// An installed editor carries the engine as a read-only bundle resource
/// (Program Files, /usr/lib), and the build writes .obj, .asm and the ROM
/// right next to the sources — so it cannot happen there. The author's
/// project gets its own copy instead, and this is what fills it.
///
/// src/data is SKIPPED: it belongs to datagen, and copying the bundled
/// (empty or stale) version over freshly generated data would build the
/// wrong game. Build leftovers are skipped for the same reason.
fn sync(from: &Path, to: &Path) -> Result<()> {
    if !from.is_dir() {
        bail!("no engine sources at {}", from.display());
    }
    let n = sync_dir(from, to, &mut 0)?;
    println!("synced {} file(s) to {}", n, to.display());
    Ok(())
}

fn skipped(name: &str) -> bool {
    matches!(
        Path::new(name).extension().and_then(|e| e.to_str()),
        Some("obj" | "ps" | "asp" | "sfc" | "smc" | "sym" | "bnk")
    ) || name == "linkfile"
}

fn sync_dir(from: &Path, to: &Path, count: &mut usize) -> Result<usize> {
    fs::create_dir_all(to)?;
    let mut entries: Vec<PathBuf> = fs::read_dir(from)?.map(|e| e.map(|e| e.path())).collect::<std::result::Result<_, _>>()?;
    entries.sort();
    for p in entries {
        let name = match p.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if p.is_dir() {
            // datagen owns src/data; never overwrite generated data with
            // whatever the bundle happened to carry.
            if p.parent().and_then(|d| d.file_name()).and_then(|n| n.to_str()) == Some("src")
                && name == "data"
            {
                fs::create_dir_all(to.join(&name))?;
                continue;
            }
            sync_dir(&p, &to.join(&name), count)?;
        } else if !skipped(&name) {
            fs::copy(&p, to.join(&name))
                .with_context(|| format!("copying {}", p.display()))?;
            *count += 1;
        }
    }
    Ok(*count)
}
