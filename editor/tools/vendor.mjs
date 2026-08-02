// vendor.mjs — stages everything the installed editor needs to turn a
// project into a ROM, into src-tauri/vendor/ where Tauri picks it up as a
// bundle resource.
//
// Two payloads:
//   engine/     the C and 65816 sources of the fixed engine (~1 MB)
//   pvsneslib/  the PVSnesLib subset the build actually calls (~7 MB)
//
// PVSnesLib is MIT, so redistributing it is allowed; its licence travels
// with it. Only what snesbuild invokes is copied — the graphics converters,
// the docs, the examples and the SPC tooling we never call stay behind.
//
// The source of PVSnesLib is a local installation: --from, else
// PVSNESLIB_HOME. CI downloads a release first and points --from at it.
//
//   node tools/vendor.mjs [--from <PVSnesLib root>]
//
// It FAILS if a required binary is missing rather than staging a partial
// toolchain: an installer that looks complete and cannot build is worse
// than one that never shipped.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const VENDOR = join(REPO, "editor", "src-tauri", "vendor");

const argFrom = process.argv.indexOf("--from");
const PVS =
  (argFrom > -1 ? process.argv[argFrom + 1] : null) || process.env.PVSNESLIB_HOME;
if (!PVS) {
  console.error("vendor: no PVSnesLib — pass --from <root> or set PVSNESLIB_HOME");
  process.exit(1);
}

const exe = process.platform === "win32" ? ".exe" : "";

// Exactly what snesbuild runs, plus what the compiler and the linker read.
const TOOLS = [
  `devkitsnes/bin/816-tcc${exe}`,
  `devkitsnes/bin/wla-65816${exe}`,
  `devkitsnes/bin/wla-spc700${exe}`,
  `devkitsnes/bin/wlalink${exe}`,
  `devkitsnes/tools/816-opt${exe}`,
  `devkitsnes/tools/constify${exe}`,
  `devkitsnes/tools/smconv${exe}`,
];
const TREES = [
  "devkitsnes/include",
  "pvsneslib/include",
  "pvsneslib/lib/LoROM_SlowROM",
];
const LICENCES = ["LICENSE", "pvsneslib/pvsneslib_license.txt"];

function bytes(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    n += e.isDirectory() ? bytes(p) : statSync(p).size;
  }
  return n;
}

rmSync(VENDOR, { recursive: true, force: true });

// ---- the engine ------------------------------------------------------
// snesbuild knows which files are sources and which are build leftovers,
// so it does the copying rather than this script duplicating the rule.
const engineDst = join(VENDOR, "engine");
mkdirSync(engineDst, { recursive: true });
const snesbuild = join(REPO, "tools", "target", "release", "snesbuild" + exe);
if (!existsSync(snesbuild)) {
  console.error(`vendor: ${snesbuild} is missing — run the sidecars step first`);
  process.exit(1);
}
execFileSync(snesbuild, ["sync", "--from", join(REPO, "engine"), "--to", engineDst], {
  stdio: "inherit",
});

// ---- the toolchain ---------------------------------------------------
const pvsDst = join(VENDOR, "pvsneslib");
const missing = [];
for (const rel of TOOLS) {
  const src = join(PVS, rel);
  if (!existsSync(src)) {
    missing.push(rel);
    continue;
  }
  mkdirSync(join(pvsDst, dirname(rel)), { recursive: true });
  cpSync(src, join(pvsDst, rel));
}
for (const rel of TREES) {
  const src = join(PVS, rel);
  if (!existsSync(src)) {
    missing.push(rel);
    continue;
  }
  cpSync(src, join(pvsDst, rel), { recursive: true });
}
for (const rel of LICENCES) {
  const src = join(PVS, rel);
  if (existsSync(src)) {
    mkdirSync(join(pvsDst, dirname(rel)), { recursive: true });
    cpSync(src, join(pvsDst, rel));
  }
}

if (missing.length) {
  console.error(`vendor: PVSnesLib at ${PVS} is missing:`);
  for (const m of missing) console.error(`  ${m}`);
  console.error("Wrong root, or a release that does not carry the binaries.");
  process.exit(1);
}

console.log(
  `vendor: engine ${(bytes(engineDst) / 1e6).toFixed(1)} MB, ` +
    `pvsneslib ${(bytes(pvsDst) / 1e6).toFixed(1)} MB -> ${VENDOR}`
);
