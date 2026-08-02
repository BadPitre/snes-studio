// Running the toolchain from the editor (the Tauri shell plugin).
//
// datagen and snesbuild travel WITH the editor, as Tauri sidecars: the
// installed app carries its own copies and never needs a Rust toolchain
// on the author's machine. `Command.sidecar` resolves them next to the
// executable, whatever the platform named them.
//
// The engine sources are found in one of two places, and which one is in
// play changes nothing else:
//
//   a CHECKOUT — <project>/../engine exists, so that is the engine, and it
//     is built in place exactly as it always was. A contributor editing
//     engine code sees their edits in the next build.
//
//   an INSTALL — no sibling engine, so the bundled copy is staged into
//     <project>/.build/engine and built there. The bundle itself lives in
//     a read-only folder (Program Files, /usr/lib) and a build writes .obj
//     and the ROM next to the sources, so it cannot happen in place.
//
// The author never chooses: a project inside a checkout keeps the
// contributor flow, a project anywhere else gets its own engine.

import { Command } from "@tauri-apps/plugin-shell";
import { resolveResource } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";

const hasTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface BuildResult {
  ok: boolean;
  output: string;
}

function parentDir(path: string): string {
  const norm = path.replace(/[\\/]+$/, "");
  const i = Math.max(norm.lastIndexOf("/"), norm.lastIndexOf("\\"));
  return i > 0 ? norm.slice(0, i) : norm;
}

export function canBuild(): boolean {
  return hasTauri;
}

function isWindows(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");
}

const noTauri = (what: string): BuildResult => ({
  ok: false,
  output: `mode navigateur : ${what} indisponible`,
});

async function sidecar(name: string, args: string[]): Promise<BuildResult> {
  const out = await Command.sidecar(`binaries/${name}`, args).execute();
  const output = [out.stdout, out.stderr].filter(Boolean).join("\n").trim();
  return { ok: out.code === 0, output };
}

// Where the build happens and what it compiles against.
interface Workspace {
  engine: string;
  args: string[]; // --toolchain, when we know which one
}

async function workspace(projectRoot: string, toolchain: string): Promise<Workspace> {
  const sibling = `${parentDir(projectRoot)}/engine`;
  const inCheckout = await exists(sibling).catch(() => false);
  // A setting always wins: an author who names a PVSnesLib means it.
  // Otherwise a checkout falls back to PVSNESLIB_HOME (snesbuild reads it)
  // and an install uses the copy it carries.
  let tc = toolchain;
  if (!tc && !inCheckout) tc = await resolveResource("vendor/pvsneslib");
  const args = tc ? ["--toolchain", tc] : [];

  if (inCheckout) return { engine: sibling, args };

  const engine = `${projectRoot}/.build/engine`;
  const src = await resolveResource("vendor/engine");
  // Cheap (87 files) and always run: it is also how an editor UPDATE
  // reaches a project built with the previous version's engine.
  const sync = await sidecar("snesbuild", ["sync", "--from", src, "--to", engine]);
  if (!sync.ok) throw new Error(sync.output);
  return { engine, args };
}

// Where the ROM lands, for the emulator and for the author to find.
export async function romPath(projectRoot: string): Promise<string> {
  const sibling = `${parentDir(projectRoot)}/engine`;
  const dir = (await exists(sibling).catch(() => false))
    ? sibling
    : `${projectRoot}/.build/engine`;
  return `${dir}/snesstudio.sfc`;
}

// Compiles the ROM. This used to be `make` through a shell — MSYS2 on
// Windows; snesbuild drives the same toolchain natively instead, and
// produces a byte-identical ROM (tools/gate-snesbuild.sh).
// clean = throw the intermediates away first.
export async function runMake(
  projectRoot: string,
  toolchain: string,
  clean = false
): Promise<BuildResult> {
  if (!hasTauri) return noTauri("la compilation");
  const w = await workspace(projectRoot, toolchain);
  if (clean) {
    const c = await sidecar("snesbuild", ["clean", "--engine", w.engine]);
    if (!c.ok) return c;
  }
  return sidecar("snesbuild", ["build", "--engine", w.engine, ...w.args]);
}

// "Cartridge" build -> engine/snesstudio.smc (512 KB minimum, mirrored +
// checksum recomputed — validated on a Super UFO Pro 8)
export async function runMakeCart(
  projectRoot: string,
  toolchain: string
): Promise<BuildResult> {
  if (!hasTauri) return noTauri("la compilation");
  const w = await workspace(projectRoot, toolchain);
  return sidecar("snesbuild", ["cart", "--engine", w.engine, ...w.args]);
}

// Is the configured emulator actually there? The editor does not ship one
// — the author downloads Mesen2, bsnes or whatever they prefer — so
// "missing" is an ORDINARY state, not an edge case, and it has to be said.
// Neither launch path can report it on its own: `start` returns 0 whether
// or not it found the program, and the POSIX path is spawned and never
// waited on.
async function emulatorFound(emulator: string): Promise<boolean> {
  if (!emulator.trim()) return false;
  // A path is checked as a file; a bare name has to be resolved the way
  // the shell would resolve it against PATH.
  if (/[\\/]/.test(emulator)) return await exists(emulator).catch(() => false);
  try {
    const probe = isWindows()
      ? Command.create("cmd", ["/C", "where", emulator])
      : Command.create("sh", ["-c", `command -v '${emulator}'`]);
    return (await probe.execute()).code === 0;
  } catch {
    return false;
  }
}

// Launches the emulator (configurable — settings ⚙) on the compiled ROM,
// without waiting for it to close.
export async function launchEmulator(
  projectRoot: string,
  emulator: string
): Promise<BuildResult> {
  if (!hasTauri) return noTauri("l'émulateur");
  if (!(await emulatorFound(emulator))) {
    return {
      ok: false,
      output: `émulateur introuvable : « ${emulator || "(aucun)" } » — indiquez son chemin dans Réglages ⚙ (Mesen2, bsnes, Snes9x…)`,
    };
  }
  const rom = await romPath(projectRoot);
  if (isWindows()) {
    const out = await Command.create("cmd", ["/C", "start", "", emulator, rom]).execute();
    const output = [out.stdout, out.stderr].filter(Boolean).join("\n").trim();
    return { ok: out.code === 0, output };
  }
  await Command.create("sh", ["-c", `'${emulator}' '${rom}' >/dev/null 2>&1 &`]).spawn();
  return { ok: true, output: "" };
}

// Opens the project folder in the system's file explorer
export async function openProjectFolder(root: string): Promise<void> {
  if (!hasTauri) return;
  if (isWindows()) {
    await Command.create("cmd", ["/C", "start", "", root]).execute();
  } else {
    await Command.create("sh", ["-c", `xdg-open '${root}' >/dev/null 2>&1 &`]).execute();
  }
}

// RPG Maker 2003 chipset import (480x256) through datagen import-chipset
export async function runImportChipset(
  projectRoot: string,
  chipsetPath: string,
  name: string
): Promise<BuildResult> {
  if (!hasTauri) return noTauri("l'import");
  return sidecar("datagen", ["import-chipset", chipsetPath, projectRoot, name]);
}

// RPG Maker 2003 charset import (288x256 or 72x128) through
// datagen import-charset: a character -> a block of the sprite sheet
export async function runImportCharset(
  projectRoot: string,
  charsetPath: string,
  perso: number,
  bloc: number
): Promise<BuildResult> {
  if (!hasTauri) return noTauri("l'import");
  return sidecar("datagen", [
    "import-charset",
    charsetPath,
    projectRoot,
    String(perso),
    String(bloc),
  ]);
}

// debug = a test ROM with the Start+Select+R menu (settings ⚙, S6) — the
// cartridge build always passes debug=false
export async function runDatagen(projectRoot: string, debug = false): Promise<BuildResult> {
  if (!hasTauri) return noTauri("datagen");
  // Generated data goes where the build will look for it, which is the
  // staged engine when there is no checkout around.
  const w = await workspace(projectRoot, "");
  const args = [projectRoot, w.engine];
  if (debug) args.push("--debug");
  return sidecar("datagen", args);
}
