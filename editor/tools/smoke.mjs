// smoke-editor.mjs — vérifie que l'éditeur s'ouvre et que chaque fenêtre
// s'affiche sans erreur, sur le projet demo.
//
// Ce n'est PAS une suite de tests fonctionnels : c'est un détecteur de
// fenêtre cassée. Un remaniement de l'éditeur ne casse presque jamais la
// compilation TypeScript — il casse un rendu, et personne ne s'en aperçoit
// avant d'ouvrir la fenêtre à la main. Ici on les ouvre toutes, on relève
// les erreurs de console et les exceptions React, et on capture l'écran.
//
//   npm run smoke                          (l'aperçu doit tourner)
//   SMOKE_URL=http://localhost:4183 npm run smoke
//
// Les captures partent dans editor/tools/smoke-out/ — pratique pour comparer
// deux versions à l'œil quand une différence est attendue.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const URL = process.env.SMOKE_URL ?? "http://localhost:4183";
const OUT = `${ROOT}/editor/tools/smoke-out`;

// Chaque entrée : un chemin de menu à parcourir, et la CLASSE que la
// fenêtre ouverte doit porter. On vérifie la classe et non un titre :
// les fenêtres n'ont pas toutes le même balisage de titre (.palette-title
// pour la plupart, .panel-title pour Textes, rien pour Switches), et le
// filet ne doit pas dépendre d'une incohérence qu'il est justement là
// pour nous laisser corriger tranquillement.
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
];

mkdirSync(OUT, { recursive: true });
// PLAYWRIGHT_BROWSERS_PATH est posé par certains environnements CI ;
// ailleurs, Playwright trouve son navigateur tout seul.
const exe = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// Un échec doit être RAPIDE : sinon onze entrées x 30 s d'attente par
// défaut et le filet devient trop lent pour être lancé souvent.
page.setDefaultTimeout(5000);

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`exception : ${e.message}`));

await page.goto(URL);
await page.waitForTimeout(1200);

// En mode navigateur, « Ouvrir un projet » ne passe pas par un dialogue :
// il charge ce que public/project désigne (io.ts, pickProjectDir). Sans
// projet, toutes les entrées de menu sont désactivées et le test ne
// prouverait rien.
await page.getByRole("button", { name: "Ouvrir un projet…" }).click();
await page.waitForTimeout(2500);
if (await page.getByRole("button", { name: "Ouvrir un projet…" }).count()) {
  console.log("  ✗ le projet ne s'est pas chargé — vérifier editor/public/project");
  await browser.close();
  process.exit(1);
}

// Referme ce qui est ouvert — fenêtre ET menu — pour que l'entrée
// suivante reparte d'un écran propre, y compris après un échec.
async function closeModal() {
  for (let i = 0; i < 3; i++) {
    const x = page.locator(".modal-x");
    if (!(await x.count())) break;
    await x.first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.keyboard.press("Escape");
  await page.mouse.click(1400, 870); // hors menu : referme un déroulant resté ouvert
  await page.waitForTimeout(200);
}

let failures = 0;
for (const w of WINDOWS) {
  const label = w.path.join(" → ");
  const before = errors.length;
  try {
    // On cible par la STRUCTURE, pas par le texte accessible : le bouton
    // d'un sous-menu porte un chevron ▸ dans son nom accessible, donc un
    // getByRole exact ne le trouve jamais. Une heure perdue là-dessus.
    const [menu, group, item] = w.path;
    await page.locator(".menubar > .menu > button", { hasText: menu }).first().click();
    await page.locator(".menu-subwrap > button", { hasText: group }).first().hover();
    await page.waitForTimeout(250);
    const leaf = page.locator(".menu-sub button", { hasText: item }).first();
    if (await leaf.isDisabled()) throw new Error("entrée désactivée");
    await leaf.click();
    await page.waitForTimeout(500);
    if (!(await page.locator(`.modal.${w.cls}`).count()))
      throw new Error(`aucune fenêtre .${w.cls} à l'écran`);
    await page.screenshot({ path: `${OUT}/${w.path.at(-1).replace(/[^\w]/g, "_")}.png` });
    await closeModal();
  } catch (e) {
    console.log(`  ✗ ${label} — ${e.message.split("\n")[0]}`);
    await page.screenshot({ path: `${OUT}/ECHEC-${w.path.at(-1).replace(/[^\w]/g, "_")}.png` });
    failures++;
    await closeModal(); // ne pas laisser une fenêtre ouverte fausser la suivante
    continue;
  }
  const fresh = errors.slice(before);
  if (fresh.length) {
    console.log(`  ✗ ${label} — ${fresh.length} erreur(s) console`);
    fresh.forEach((t) => console.log(`      ${t}`));
    failures++;
  } else {
    console.log(`  ✓ ${label}`);
  }
}

await browser.close();
console.log("");
if (failures) {
  console.log(`${failures} fenêtre(s) en échec sur ${WINDOWS.length}.`);
  process.exit(1);
}
console.log(`${WINDOWS.length} fenêtres ouvertes, aucune erreur.`);
