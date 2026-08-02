// fetch-pvsneslib.mjs — downloads a PVSnesLib release for the current OS
// and unpacks it, so CI can vendor the toolchain into the installer.
//
// Only CI needs this: on your own machine you already have PVSnesLib, and
// vendor.mjs takes it from PVSNESLIB_HOME.
//
// It picks the asset by matching the OS against the asset names of the
// pinned release, and if nothing matches it FAILS AND PRINTS THE LIST
// rather than guessing. A wrong guess here would produce an installer that
// looks complete and cannot build a ROM — vendor.mjs refuses a partial
// toolchain for the same reason.
//
//   node tools/fetch-pvsneslib.mjs --to <dir> [--tag <release tag>]

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const DEST = resolve(arg("--to", "pvsneslib"));
// "latest" tracks upstream; pin a tag here when a release breaks the build.
const TAG = arg("--tag", "latest");

const OS_KEYS = { win32: ["windows", "win"], darwin: ["darwin", "macos", "osx"], linux: ["linux"] };
const keys = OS_KEYS[process.platform];
if (!keys) {
  console.error(`fetch-pvsneslib: unsupported platform ${process.platform}`);
  process.exit(1);
}

const api =
  TAG === "latest"
    ? "https://api.github.com/repos/alekmaul/pvsneslib/releases/latest"
    : `https://api.github.com/repos/alekmaul/pvsneslib/releases/tags/${TAG}`;

const headers = { "user-agent": "snes-studio-build" };
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const release = await (await fetch(api, { headers })).json();
const assets = release.assets ?? [];
if (!assets.length) {
  console.error(`fetch-pvsneslib: release ${release.tag_name ?? TAG} carries no asset`);
  process.exit(1);
}

const match = assets.find((a) => {
  const n = a.name.toLowerCase();
  return n.endsWith(".zip") && keys.some((k) => n.includes(k));
});
if (!match) {
  console.error(
    `fetch-pvsneslib: no ${keys[0]} archive in release ${release.tag_name}. Assets:`
  );
  for (const a of assets) console.error(`  ${a.name}`);
  process.exit(1);
}

console.log(`fetch-pvsneslib: ${release.tag_name} / ${match.name}`);
mkdirSync(DEST, { recursive: true });
const zip = join(DEST, "pvsneslib.zip");
const buf = Buffer.from(
  await (await fetch(match.browser_download_url, { headers })).arrayBuffer()
);
const { writeFileSync } = await import("node:fs");
writeFileSync(zip, buf);

// unzip on the runners: tar reads zip on Windows and macOS, and CI
// installs unzip on Linux images that lack it.
execFileSync("tar", ["-xf", zip, "-C", DEST], { stdio: "inherit" });

// The archive may hold a single top-level folder; vendor.mjs wants the
// root that has devkitsnes/ in it.
let root = DEST;
if (!existsSync(join(root, "devkitsnes"))) {
  const dirs = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
  const inner = dirs.find((d) => existsSync(join(root, d.name, "devkitsnes")));
  if (!inner) {
    console.error(`fetch-pvsneslib: no devkitsnes/ under ${root} — unexpected layout`);
    process.exit(1);
  }
  root = join(root, inner.name);
}
console.log(root);
