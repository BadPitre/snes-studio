// Lancement de datagen depuis l'éditeur (plugin shell Tauri).
// Convention de layout repo : <racine>/demo, <racine>/tools, <racine>/engine
// — la racine est le dossier parent du projet ouvert.

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

// Compile le ROM : make dans <racine>/engine. Sous Windows on passe par le
// bash de MSYS2 (chemin configurable — réglages ⚙), ailleurs par sh.
// clean = recompilation complète (make clean d'abord).
export async function runMake(
  projectRoot: string,
  bashPath: string,
  clean = false
): Promise<BuildResult> {
  return runMakeCmd(projectRoot, bashPath, clean ? "make clean && make" : "make");
}

// Build « cartouche » : make cart → engine/snesstudio.smc (512 Ko minimum,
// miroité + checksum recalculé — validé sur Super UFO Pro 8)
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

// Lance l'émulateur (configurable — réglages ⚙) sur le ROM compilé,
// sans attendre sa fermeture.
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

// Ouvre le dossier du projet dans l'explorateur de fichiers du système
export async function openProjectFolder(root: string): Promise<void> {
  if (!hasTauri) return;
  if (isWindows()) {
    await Command.create("cmd", ["/C", "start", "", root]).execute();
  } else {
    await Command.create("sh", ["-c", `xdg-open '${root}' >/dev/null 2>&1 &`]).execute();
  }
}

// Import d'un chipset RPG Maker 2003 (480x256) via datagen import-chipset
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

// Import d'un charset RPG Maker 2003 (288x256 ou 72x128) via
// datagen import-charset : personnage → bloc de la feuille de sprites
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

export async function runDatagen(projectRoot: string): Promise<BuildResult> {
  if (!hasTauri) return { ok: false, output: "mode navigateur : datagen indisponible" };
  const repo = parentDir(projectRoot);
  const cmd = Command.create("cargo", [
    "run",
    "--release",
    "--manifest-path",
    `${repo}/tools/Cargo.toml`,
    "-p",
    "datagen",
    "--",
    projectRoot,
    `${repo}/engine`,
  ]);
  const out = await cmd.execute();
  const output = [out.stdout, out.stderr].filter(Boolean).join("\n").trim();
  return { ok: out.code === 0, output };
}
