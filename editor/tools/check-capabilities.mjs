// check-capabilities.mjs — every Tauri API the editor calls must be
// granted by the capability file.
//
// WHY: this is the one class of editor bug nothing else catches. tsc is
// happy (the import exists), the smoke tests are happy (they run in
// BROWSER mode, where hasTauri is false and none of it executes), and the
// packaged app then refuses the call at runtime with an ACL error. It has
// bitten twice: `exists` was called with no fs:allow-exists, and
// `.spawn()` with no shell:allow-spawn — the second only broke Linux and
// macOS, because the Windows path goes through `cmd /C start`.
//
//   node tools/check-capabilities.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../src");
const CAP = resolve(HERE, "../src-tauri/capabilities/default.json");

// What each import needs. Only the APIs the editor actually uses are
// listed: a table of everything Tauri offers would rot, this one fails
// loudly the moment an unknown import shows up.
const NEEDS = {
  "@tauri-apps/plugin-fs": {
    exists: "fs:allow-exists",
    readTextFile: "fs:allow-read-text-file",
    writeTextFile: "fs:allow-write-text-file",
    readFile: "fs:allow-read-file",
    writeFile: "fs:allow-write-file",
    rename: "fs:allow-rename",
    remove: "fs:allow-remove",
    mkdir: "fs:allow-mkdir",
    readDir: "fs:allow-read-dir",
  },
  "@tauri-apps/plugin-dialog": {
    open: "dialog:default", // grants allow-open / allow-save / allow-message
    save: "dialog:default",
    message: "dialog:default",
  },
  "@tauri-apps/api/path": {
    resolveResource: "core:default", // core:path:default -> allow-resolve-directory
    appLocalDataDir: "core:default",
  },
};
// Command is not an import-level check: what matters is which METHOD is
// called on it.
const METHODS = { ".execute()": "shell:allow-execute", ".spawn()": "shell:allow-spawn" };

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const cap = JSON.parse(readFileSync(CAP, "utf8"));
const granted = new Set(
  cap.permissions.map((p) => (typeof p === "string" ? p : p.identifier))
);

const problems = [];
const unknown = [];

for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");

  for (const [mod, map] of Object.entries(NEEDS)) {
    const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${mod}["']`, "g");
    for (const m of text.matchAll(re)) {
      for (const raw of m[1].split(",")) {
        // "readFile as tauriRead" -> readFile
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        if (!name) continue;
        const need = map[name];
        if (!need) {
          unknown.push(`${file}: ${mod} -> ${name} (not in the table)`);
        } else if (!granted.has(need)) {
          problems.push(`${file}: ${name}() needs ${need}`);
        }
      }
    }
  }

  for (const [method, need] of Object.entries(METHODS)) {
    if (text.includes(method) && text.includes("@tauri-apps/plugin-shell") && !granted.has(need)) {
      problems.push(`${file}: ${method} needs ${need}`);
    }
  }
}

if (unknown.length) {
  console.log("  ! Tauri APIs used but absent from the table — add them:");
  for (const u of unknown) console.log(`      ${u}`);
}
if (problems.length) {
  console.log(`${problems.length} ungranted call(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("\nAdd the permission to src-tauri/capabilities/default.json.");
  process.exit(1);
}
if (unknown.length) process.exit(1);
console.log("capabilities: every Tauri call used is granted.");
