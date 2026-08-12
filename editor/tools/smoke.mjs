// smoke.mjs — checks that the editor opens and that every window renders
// without an error, on the demo project.
//
// This is NOT a functional test suite: it is a broken-window detector. A
// refactor of the editor almost never breaks the TypeScript compilation —
// it breaks a render, and nobody notices until they open the window by
// hand. Here we open them all, collect the console errors and the React
// exceptions, and take a screenshot.
//
//   npm run smoke                          (the preview must be running)
//   SMOKE_URL=http://localhost:4183 npm run smoke
//
// The screenshots go to editor/tools/smoke-out/ — handy for comparing two
// versions by eye when a difference is expected.

import { chromium } from "playwright";
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const URL = process.env.SMOKE_URL ?? "http://localhost:4183";
const OUT = `${ROOT}/editor/tools/smoke-out`;

// Each entry: a menu path to walk, and the CLASS the opened window must
// carry. We check the class rather than a title: the windows do not all use
// the same title markup (.palette-title for most, .panel-title for Textes,
// nothing for Switches), and the safety net must not depend on an
// inconsistency it exists to let us fix calmly.
const WINDOWS = [
  { path: ["Tools", "Logique", "Switches et variables…"], cls: "varlist" },
  { path: ["Tools", "Logique", "Common events…"], cls: "cevents" },
  { path: ["Tools", "Logique", "Fonctions…"], cls: "cevents" },
  { path: ["Tools", "Cartes", "Tilesets…"], cls: "database" },
  { path: ["Tools", "Cartes", "Prefabs…"], cls: "prefabs" },
  { path: ["Tools", "Mise en scène", "Écrans composés…"], cls: "screens" },
  { path: ["Tools", "Mise en scène", "Animations…"], cls: "anims" },
  { path: ["Tools", "Interface", "Widgets…"], cls: "uitheme" },
  { path: ["Tools", "Interface", "Dialogues et choix…"], cls: "uitheme" },
  { path: ["Tools", "Données", "Database…"], cls: "database" },
  { path: ["Tools", "Données", "Textes…"], cls: "textsmodal" },
  // Only the ROM door: "Extraire une musique…" opens the native file
  // picker on mount, which a headless run has no way to answer.
  { path: ["Tools", "Ressources", "Extraire d'une ROM…"], cls: "romrip" },
];

mkdirSync(OUT, { recursive: true });
// Playwright looks for a browser build matching ITS OWN version, so a
// Chromium pre-installed under PLAYWRIGHT_BROWSERS_PATH becomes invisible
// to it as soon as the two versions drift apart — and the failure reads as
// "please run npx playwright install", which is the wrong advice in an
// environment that ships the browser. CHROMIUM_PATH forces one; otherwise
// we take any chromium-*/chrome-linux/chrome found there before falling
// back to Playwright's own lookup.
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return null;
  for (const d of readdirSync(root)) {
    if (!d.startsWith("chromium-")) continue;
    const exe = join(root, d, "chrome-linux", "chrome");
    if (existsSync(exe)) return exe;
  }
  return null;
}
const exe = findChromium();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// A failure must be FAST: otherwise eleven entries x the 30 s default wait,
// and the safety net gets too slow to run often.
page.setDefaultTimeout(5000);

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`exception : ${e.message}`));

await page.goto(URL);
await page.waitForTimeout(1200);

// In browser mode, "Ouvrir un projet" does not go through a dialogue: it
// loads whatever public/project points at (io.ts, pickProjectDir). With no
// project, every menu entry is disabled and the test would prove nothing.
await page.getByRole("button", { name: "Ouvrir un projet…" }).click();
await page.waitForTimeout(2500);
if (await page.getByRole("button", { name: "Ouvrir un projet…" }).count()) {
  console.log("  ✗ the project did not load — check editor/public/project");
  await browser.close();
  process.exit(1);
}

// Closes whatever is open — window AND menu — so the next entry starts from
// a clean screen, including after a failure.
async function closeModal() {
  for (let i = 0; i < 3; i++) {
    const x = page.locator(".modal-x");
    if (!(await x.count())) break;
    await x.first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.keyboard.press("Escape");
  await page.mouse.click(1400, 870); // outside the menu: closes a dropdown left open
  await page.waitForTimeout(200);
}

let failures = 0;
for (const w of WINDOWS) {
  const label = w.path.join(" → ");
  const before = errors.length;
  try {
    // We target by STRUCTURE, not by accessible text: a submenu's button
    // carries a ▸ chevron in its accessible name, so an exact getByRole
    // never finds it. An hour lost on that one.
    const [menu, group, item] = w.path;
    await page.locator(".menubar > .menu > button", { hasText: menu }).first().click();
    await page.locator(".menu-subwrap > button", { hasText: group }).first().hover();
    await page.waitForTimeout(250);
    const leaf = page.locator(".menu-sub button", { hasText: item }).first();
    if (await leaf.isDisabled()) throw new Error("menu entry disabled");
    await leaf.click();
    await page.waitForTimeout(500);
    if (!(await page.locator(`.modal.${w.cls}`).count()))
      throw new Error(`no .${w.cls} window on screen`);
    await page.screenshot({ path: `${OUT}/${w.path.at(-1).replace(/[^\w]/g, "_")}.png` });
    await closeModal();
  } catch (e) {
    console.log(`  ✗ ${label} — ${e.message.split("\n")[0]}`);
    await page.screenshot({ path: `${OUT}/ECHEC-${w.path.at(-1).replace(/[^\w]/g, "_")}.png` });
    failures++;
    await closeModal(); // do not let an open window skew the next entry
    continue;
  }
  const fresh = errors.slice(before);
  if (fresh.length) {
    console.log(`  ✗ ${label} — ${fresh.length} console error(s)`);
    fresh.forEach((t) => console.log(`      ${t}`));
    failures++;
  } else {
    console.log(`  ✓ ${label}`);
  }
}

// The Mode 7 preview is not in the Tools menu: it belongs to a WORLD MAP
// and opens from the Scene tab of one. Two things are checked here that a
// render alone would not catch — that the window appears, and that its
// canvas is not black, which is what a broken projection looks like.
{
  const label = "Scène monde → Aperçu Mode 7…";
  const before = errors.length;
  try {
    await page.locator(".scene-tree", { hasText: "monde" })
      .locator("text=monde")
      .first()
      .click();
    await page.waitForTimeout(400);
    await page.locator(".sidebar .tabs button", { hasText: "Scène" }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Aperçu Mode 7…" }).click();
    await page.waitForTimeout(700);
    if (!(await page.locator(".modal.m7preview").count()))
      throw new Error("no .m7preview window on screen");
    // A blank canvas is the failure mode that matters: the window renders,
    // the transform produces nothing, and only a human notices.
    const lit = await page.evaluate(() => {
      const cv = document.querySelector(".m7preview-canvas");
      if (!cv) return -1;
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] | d[i + 1] | d[i + 2]) n++;
      return n;
    });
    if (lit < 1000) throw new Error(`canvas almost black (${lit} lit pixels)`);
    await page.screenshot({ path: `${OUT}/Apercu_Mode7.png` });
    const fresh = errors.slice(before);
    if (fresh.length) throw new Error(`${fresh.length} console error(s): ${fresh[0]}`);
    console.log(`  ✓ ${label} — ${lit} lit pixels`);
    await closeModal();
  } catch (e) {
    console.log(`  ✗ ${label} — ${e.message.split("\n")[0]}`);
    await page.screenshot({ path: `${OUT}/ECHEC-Apercu_Mode7.png` });
    failures++;
    await closeModal();
  }
}

await browser.close();
console.log("");
if (failures) {
  console.log(`${failures} window(s) failed out of ${WINDOWS.length + 1}.`);
  process.exit(1);
}
console.log(`${WINDOWS.length + 1} windows opened, no errors.`);
