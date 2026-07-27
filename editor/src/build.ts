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
