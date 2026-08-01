// Running datagen from the editor (the Tauri shell plugin).
// Repo layout convention: <root>/demo, <root>/tools, <root>/engine — the
// root is the parent folder of the open project.

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

// Compiles the ROM: make in <root>/engine. On Windows we go through the
// MSYS2 bash (path configurable — settings ⚙), elsewhere through sh.
// clean = a full rebuild (make clean first).
export async function runMake(
  projectRoot: string,
  bashPath: string,
  clean = false
): Promise<BuildResult> {
  return runMakeCmd(projectRoot, bashPath, clean ? "make clean && make" : "make");
}

// "Cartridge" build: make cart -> engine/snesstudio.smc (512 KB minimum,
// mirrored + checksum recomputed — validated on a Super UFO Pro 8)
export async function runMakeCart(
  projectRoot: string,
  bashPath: string
): Promise<BuildResult> {
  return runMakeCmd(projectRoot, bashPath, "make cart");
}

async function runMakeCmd(
  projectRoot: string,
  bashPath: string,
  mk: string
): Promise<BuildResult> {
  if (!hasTauri) return { ok: false, output: "mode navigateur : make indisponible" };
  const repo = parentDir(projectRoot);
  const cmd = isWindows()
    ? Command.create("cmd", [
        "/C",
        bashPath,
        "-lc",
        `cd "$(cygpath '${repo}')/engine" && ${mk}`,
      ])
    : Command.create("sh", ["-lc", `cd '${repo}/engine' && ${mk}`]);
  const out = await cmd.execute();
  const output = [out.stdout, out.stderr].filter(Boolean).join("\n").trim();
  return { ok: out.code === 0, output };
}

// Launches the emulator (configurable — settings ⚙) on the compiled ROM,
// without waiting for it to close.
export async function launchEmulator(
  projectRoot: string,
  emulator: string
): Promise<BuildResult> {
  if (!hasTauri) return { ok: false, output: "mode navigateur : émulateur indisponible" };
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
  if (!hasTauri) return { ok: false, output: "mode navigateur : import indisponible" };
  const repo = parentDir(projectRoot);
  const cmd = Command.create("cargo", [
    "run",
    "--release",
    "--manifest-path",
    `${repo}/tools/Cargo.toml`,
    "-p",
    "datagen",
    "--",
    "import-chipset",
    chipsetPath,
    projectRoot,
    name,
  ]);
  const out = await cmd.execute();
  const output = [out.stdout, out.stderr].filter(Boolean).join("\n").trim();
  return { ok: out.code === 0, output };
}

// RPG Maker 2003 charset import (288x256 or 72x128) through
// datagen import-charset: a character -> a block of the sprite sheet
export async function runImportCharset(
  projectRoot: string,
  charsetPath: string,
  perso: number,
  bloc: number
): Promise<BuildResult> {
  if (!hasTauri) return { ok: false, output: "mode navigateur : import indisponible" };
  const repo = parentDir(projectRoot);
  const cmd = Command.create("cargo", [
    "run",
    "--release",
    "--manifest-path",
    `${repo}/tools/Cargo.toml`,
    "-p",
    "datagen",
    "--",
    "import-charset",
    charsetPath,
    projectRoot,
    String(perso),
    String(bloc),
  ]);
  const out = await cmd.execute();
  const output = [out.stdout, out.stderr].filter(Boolean).join("\n").trim();
  return { ok: out.code === 0, output };
}

// debug = a test ROM with the Start+Select+R menu (settings ⚙, S6) — the
// cartridge build always passes debug=false
export async function runDatagen(projectRoot: string, debug = false): Promise<BuildResult> {
  if (!hasTauri) return { ok: false, output: "mode navigateur : datagen indisponible" };
  const repo = parentDir(projectRoot);
  const args = [
    "run",
    "--release",
    "--manifest-path",
    `${repo}/tools/Cargo.toml`,
    "-p",
    "datagen",
    "--",
    projectRoot,
    `${repo}/engine`,
  ];
  if (debug) args.push("--debug");
  const cmd = Command.create("cargo", args);
  const out = await cmd.execute();
  const output = [out.stdout, out.stderr].filter(Boolean).join("\n").trim();
  return { ok: out.code === 0, output };
}
