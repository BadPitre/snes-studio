// smoke-resources.mjs — walks the nine categories of the resource manager
// and checks each one lists, previews and offers its actions without an
// error, on the demo project.
//
// Why a third harness: smoke.mjs opens the Tools windows, which the
// resource manager is not (it hangs off a toolbar button), and the window
// is nine renderings behind one class. A table-driven rewrite compiles
// whatever the table says — only opening every category proves the table
// is right.
//
// Nothing is imported, renamed or deleted: the window is opened, walked
// and closed, and the project on disk is untouched.
//
//   npm run smoke:resources                 (the preview must be running)
//   SMOKE_URL=http://localhost:4183 npm run smoke:resources

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

await page.getByRole("button", { name: "🗂 Ressources" }).click();
await page.waitForTimeout(600);
const modal = page.locator(".modal.resmgr");
if (!(await modal.count())) {
  console.log("  ✗ the resource manager did not open");
  await browser.close();
  process.exit(1);
}

const cats = await modal.locator(".resmgr-cats .tree-row").allInnerTexts();
console.log(`— ${cats.length} categor(ies)`);

let failures = 0;
for (let i = 0; i < cats.length; i++) {
  const name = cats[i].replace(/^🗀\s*/, "").trim();
  const before = errors.length;
  try {
    await modal.locator(".resmgr-cats .tree-row").nth(i).click();
    await page.waitForTimeout(400);
    const rows = modal.locator(".resmgr-list .tree-row");
    const n = await rows.count();
    // Selecting an entry is what drives the preview and the enabled state
    // of Export / Rename / Delete — an empty register is legitimate (the
    // demo ships no icon sheet), the window must simply stay usable.
    if (n) {
      await rows.first().click();
      await page.waitForTimeout(350);
      await rows.nth(n - 1).click();
      await page.waitForTimeout(350);
    }
    // Import / Export / Rename / Delete — the import button is labelled
    // "Chipset RM2003…" on that one category, so count rather than match.
    const acts = await modal.locator(".resmgr-actions > button").count();
    if (acts < 4) throw new Error(`${acts} action buttons, expected 4`);
    if (!(await modal.locator("canvas.resmgr-preview").count()))
      throw new Error("no preview canvas");
    const fresh = errors.slice(before);
    if (fresh.length) throw new Error(fresh[0]);
    console.log(`  ✓ ${name} — ${n} entr(ies)`);
  } catch (e) {
    console.log(`  ✗ ${name} — ${e.message.split("\n")[0]}`);
    await page.screenshot({ path: `${OUT}/ECHEC-res-${name.replace(/[^\w]/g, "_")}.png` });
    failures++;
  }
}

await browser.close();
console.log("");
if (failures) {
  console.log(`${failures} categor(ies) failed out of ${cats.length}.`);
  process.exit(1);
}
console.log(`${cats.length} resource categories walked, no errors.`);
