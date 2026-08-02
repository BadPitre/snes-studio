// Running the toolchain from the editor (the Tauri shell plugin).
//
// datagen and snesbuild travel WITH the editor, as Tauri sidecars: the
// installed app carries its own copies and never needs a Rust toolchain
// on the author's machine. `Command.sidecar` resolves them next to the
// executable, whatever the platform named them.
//
// Repo layout convention: <root>/demo, <root>/tools, <root>/engine — the
// root is the parent folder of the open project. That is still how the
// ENGINE SOURCES are found; only the tools stopped being looked up there.

import { Command } from "@tauri-apps/plugin-shell";

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

// The PVSnesLib root snesbuild compiles against. Empty means "fall back to
// PVSNESLIB_HOME", which is what a checkout does.
function toolchainArgs(toolchain: string): string[] {
  return toolchain ? ["--toolchain", toolchain] : [];
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
  const engine = `${parentDir(projectRoot)}/engine`;
  if (clean) {
    const c = await sidecar("snesbuild", ["clean", "--engine", engine]);
    if (!c.ok) return c;
  }
  return sidecar("snesbuild", ["build", "--engine", engine, ...toolchainArgs(toolchain)]);
}

// "Cartridge" build -> engine/snesstudio.smc (512 KB minimum, mirrored +
// checksum recomputed — validated on a Super UFO Pro 8)
export async function runMakeCart(
  projectRoot: string,
  toolchain: string
): Promise<BuildResult> {
  if (!hasTauri) return noTauri("la compilation");
  const engine = `${parentDir(projectRoot)}/engine`;
  return sidecar("snesbuild", ["cart", "--engine", engine, ...toolchainArgs(toolchain)]);
}

// Launches the emulator (configurable — settings ⚙) on the compiled ROM,
// without waiting for it to close.
export async function launchEmulator(
  projectRoot: string,
  emulator: string
): Promise<BuildResult> {
  if (!hasTauri) return noTauri("l'émulateur");
  const repo = parentDir(projectRoot);
  const rom = `${repo}/engine/snesstudio.sfc`;
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
  const args = [projectRoot, `${parentDir(projectRoot)}/engine`];
  if (debug) args.push("--debug");
  return sidecar("datagen", args);
}
