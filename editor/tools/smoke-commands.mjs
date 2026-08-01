// smoke-commands.mjs — opens the OPTIONS FORM of every event command and
// checks it renders without an error, on the demo project.
//
// Why a second harness: smoke.mjs opens the eleven Tools windows, which
// says nothing about CommandForm — the single biggest piece of the editor,
// one branch per command. A refactor there compiles fine and breaks a
// branch nobody clicks until an author does.
//
// The route is Tools > Logique > Common events…, which hosts the same
// command list editor as the Event Editor and offers the FULL command set
// (a function body restricts it). For each tab of the picker we insert
// every enabled command, assert its form renders, and cancel.
//
//   npm run smoke:commands                 (the preview must be running)
//   SMOKE_URL=http://localhost:4183 npm run smoke:commands

import { chromium } from "playwright";
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const URL = process.env.SMOKE_URL ?? "http://localhost:4183";
const OUT = `${ROOT}/editor/tools/smoke-out`;

mkdirSync(OUT, { recursive: true });

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
page.setDefaultTimeout(5000);

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`exception : ${e.message}`));

await page.goto(URL);
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Ouvrir un projet…" }).click();
await page.waitForTimeout(2500);
if (await page.getByRole("button", { name: "Ouvrir un projet…" }).count()) {
  console.log("  ✗ the project did not load — check editor/public/project");
  await browser.close();
  process.exit(1);
}

// Tools > Logique > Common events…
await page.locator(".menubar > .menu > button", { hasText: "Tools" }).first().click();
await page.locator(".menu-subwrap > button", { hasText: "Logique" }).first().hover();
await page.waitForTimeout(250);
await page.locator(".menu-sub button", { hasText: "Common events…" }).first().click();
await page.waitForTimeout(600);
if (!(await page.locator(".modal.cevents").count())) {
  console.log("  ✗ the Common events window did not open");
  await browser.close();
  process.exit(1);
}

// The list editor needs a common event to show a command list, and the
// demo project ships none — so we add one. Nothing is saved: the window is
// closed without confirming, and the project on disk is untouched.
if (!(await page.locator(".modal.cevents .cevents-list .evedit-line").count())) {
  await page.locator('.modal.cevents [title="Ajouter un common event"]').first().click();
  await page.waitForTimeout(300);
}
await page.locator(".modal.cevents .cevents-list .evedit-line").first().click();
await page.waitForTimeout(300);

// The LAST row of the list is the empty "append" one: double-clicking it
// opens the picker rather than editing a command.
async function openPicker() {
  // scoped to the right pane: .cevents-list uses the same class for
  // its own rows, and picking one of those would just switch event.
  const rows = page.locator(".modal.cevents .cevents-right .evedit-line");
  const n = await rows.count();
  if (!n) throw new Error("no command line");
  await rows.nth(n - 1).dblclick();
  await page.waitForTimeout(300);
  return page.locator(".modal.cmdpick");
}

let picker = await openPicker();
if (!(await picker.count())) {
  console.log("  ✗ the command picker did not open");
  await browser.close();
  process.exit(1);
}
const tabCount = await picker.locator(".cmdpick-tabs button").count();
console.log(`— ${tabCount} command tab(s)`);

let checked = 0;
let failures = 0;
for (let t = 0; t < tabCount; t++) {
  if (!(await page.locator(".modal.cmdpick").count())) picker = await openPicker();
  await page.locator(".modal.cmdpick .cmdpick-tabs button").nth(t).click();
  await page.waitForTimeout(150);
  const tabName = await page.locator(".modal.cmdpick .cmdpick-tabs button").nth(t).innerText();
  const items = page.locator(".modal.cmdpick .cmdpick-grid button:not([disabled])");
  const labels = await items.allInnerTexts();
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i].trim();
    const before = errors.length;
    try {
      if (!(await page.locator(".modal.cmdpick").count())) {
        picker = await openPicker();
        await page.locator(".modal.cmdpick .cmdpick-tabs button").nth(t).click();
        await page.waitForTimeout(150);
      }
      await page.locator(".modal.cmdpick .cmdpick-grid button:not([disabled])").nth(i).click();
      await page.waitForTimeout(350);
      // Some commands carry no options and insert straight away; the ones
      // with a form must show it.
      const form = page.locator(".modal.cmdform .evedit-form");
      if (await form.count()) {
        if (!(await form.locator("button", { hasText: "Annuler" }).count()))
          throw new Error("formulaire sans bouton Annuler");
        await form.locator("button", { hasText: "Annuler" }).first().click();
        await page.waitForTimeout(150);
      }
      const fresh = errors.slice(before);
      if (fresh.length) throw new Error(fresh[0]);
      checked++;
    } catch (e) {
      console.log(`  ✗ ${tabName} / ${label} — ${e.message.split("\n")[0]}`);
      await page.screenshot({ path: `${OUT}/ECHEC-cmd-${label.replace(/[^\w]/g, "_")}.png` });
      failures++;
      // leave a clean screen for the next command
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
    }
  }
  console.log(`  ✓ ${tabName} — ${labels.length} command(s)`);
}

await browser.close();
console.log("");
if (failures) {
  console.log(`${failures} form(s) failed out of ${checked + failures}.`);
  process.exit(1);
}
console.log(`${checked} command forms opened, no errors.`);
