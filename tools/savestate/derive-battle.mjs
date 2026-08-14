// Derives the BATTLE test project (T-CI): a copy of showcase/ whose
// title scene boots straight into the gobelin battle — the recipe
// every battler investigation of this project used by hand, now
// written down. The derived copy lives outside the repo (out dir),
// the showcase itself is never touched.
//
//   node derive-battle.mjs <showcase_dir> <out_dir>

import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const [, , src, out] = process.argv;
if (!src || !out) {
  console.error("usage: node derive-battle.mjs <showcase_dir> <out_dir>");
  process.exit(2);
}
rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });

const p = out + "/scenes/titre.json";
const sc = JSON.parse(readFileSync(p, "utf8"));
const ev = (sc.events ?? []).find((e) => e.name === "_titre");
if (!ev) {
  console.error("scenes/titre.json : event _titre introuvable");
  process.exit(2);
}
// nouvelle_partie (common event 0) fills the party (v60/v61), then the
// battle screen opens with its HP windows — the showcase's own flow,
// minus the menu wait.
ev.commands = [
  { c: "call", n: 0 },
  { c: "ui_show", widget: "combat_pv1", on: true },
  { c: "ui_show", widget: "combat_pv2", on: true },
  { c: "screen", name: "combat_gobelins" },
];
writeFileSync(p, JSON.stringify(sc));
console.log("  projet combat dérivé dans " + out);
