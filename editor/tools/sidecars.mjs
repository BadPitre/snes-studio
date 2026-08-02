// sidecars.mjs — builds datagen and snesbuild and drops them where Tauri
// expects a sidecar: src-tauri/binaries/<name>-<target triple>[.exe].
//
// WHY: without this the installed editor would still need a Rust toolchain
// on the author's machine, because it shelled out to `cargo run`. The two
// binaries are the editor's hands — one turns a project into engine data,
// the other turns engine data into a ROM — so they travel with it.
//
// Tauri runs this from beforeBuildCommand and exports the triple it is
// building for in TAURI_ENV_TARGET_TRIPLE, which is what makes a
// cross-target macOS build (aarch64 from an x86_64 runner, or the other
// way round) pick up the right binaries instead of the host's.
//
//   node tools/sidecars.mjs [--target <triple>]

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const MANIFEST = join(REPO, "tools", "Cargo.toml");
const DEST = join(REPO, "editor", "src-tauri", "binaries");
const BINARIES = ["datagen", "snesbuild"];

function hostTriple() {
  const out = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
  const m = out.match(/^host:\s*(\S+)$/m);
  if (!m) throw new Error("could not read the host triple from rustc -vV");
  return m[1];
}

const argTarget = process.argv.indexOf("--target");
const target =
  (argTarget > -1 ? process.argv[argTarget + 1] : null) ||
  process.env.TAURI_ENV_TARGET_TRIPLE ||
  hostTriple();

const cargo = ["build", "--release", "--manifest-path", MANIFEST];
for (const b of BINARIES) cargo.push("-p", b);
// Only pass --target when it is not the host: doing it anyway would move
// the artefacts into target/<triple>/release and slow a plain local build
// down for nothing.
const cross = target !== hostTriple();
if (cross) cargo.push("--target", target);

console.log(`sidecars: building ${BINARIES.join(", ")} for ${target}`);
execFileSync("cargo", cargo, { stdio: "inherit" });

mkdirSync(DEST, { recursive: true });
const exe = target.includes("windows") ? ".exe" : "";
const from = cross
  ? join(REPO, "tools", "target", target, "release")
  : join(REPO, "tools", "target", "release");

for (const b of BINARIES) {
  const src = join(from, b + exe);
  if (!existsSync(src)) throw new Error(`cargo did not produce ${src}`);
  const dst = join(DEST, `${b}-${target}${exe}`);
  copyFileSync(src, dst);
  console.log(`  ${b} -> ${dst}`);
}
