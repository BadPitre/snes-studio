// Vérifications statiques du projet (fenêtre de diagnostic) : tout ce que
// datagen refusera ou qui cassera à la génération, détecté côté éditeur
// avec des messages localisés. La vérité finale reste datagen (lancé par
// la fenêtre) — ces contrôles donnent le « où » lisible.

import type { ProjectData, Scene } from "./types";
import { MIN_H, MIN_W, SCENE_SPRITE_BLOCKS_MAX, sceneSpriteBlocks } from "./types";
import { scriptLabels } from "./state";

export interface Diag {
  level: "error" | "warn";
  where: string; // scène ou domaine
  msg: string;
}

const MAX_CELLS = 8192; // budget WRAM de décompression (spec §1.6)

function checkScene(
  name: string,
  sc: Scene,
  data: ProjectData,
  blockCount: number,
  textNames: Set<string>,
  out: Diag[]
) {
  const err = (msg: string) => out.push({ level: "error", where: name, msg });
  const warn = (msg: string) => out.push({ level: "warn", where: name, msg });

  if (sc.width < MIN_W || sc.height < MIN_H) err(`map ${sc.width}x${sc.height} < ${MIN_W}x${MIN_H}`);
  if (sc.width * sc.height > MAX_CELLS)
    err(`${sc.width * sc.height} tiles > ${MAX_CELLS} (budget WRAM, spec §1.6)`);

  const used = sceneSpriteBlocks(sc).length;
  if (used > SCENE_SPRITE_BLOCKS_MAX)
    err(`${used} charsets utilisés > ${SCENE_SPRITE_BLOCKS_MAX} (héros inclus, limite VRAM)`);

  if (sc.tileset && !data.tilesetMeta[sc.tileset] && !(data.project.tilesets ?? []).some((p) => p.includes(sc.tileset!)))
    warn(`tileset « ${sc.tileset} » introuvable dans le projet`);

  const labels = new Set(scriptLabels(sc.script));
  sc.actors.forEach((a, i) => {
    if (a.x >= sc.width || a.y >= sc.height) err(`acteur #${i} hors map (${a.x},${a.y})`);
    if (a.type === "npc" && a.sprite >= blockCount)
      err(`acteur #${i} : personnage ${a.sprite} hors feuille de sprites (${blockCount} blocs)`);
    if (a.type !== "npc" && !a.entry)
      err(`acteur #${i} (${a.type === "trigger" ? "contact" : "auto"}) sans script — requis`);
    if (a.entry && !labels.has(a.entry)) err(`acteur #${i} : label « ${a.entry} » absent du script`);
    if (a.type === "npc" && !a.entry) warn(`PNJ #${i} sans script (il ne dira rien)`);
  });

  sc.warps.forEach((w, i) => {
    if (w.x >= sc.width || w.y >= sc.height) err(`warp #${i} hors map (${w.x},${w.y})`);
    const dest = data.scenes[w.to];
    if (!dest) err(`warp #${i} vers une scène inconnue « ${w.to} »`);
    else if (w.tx >= dest.width || w.ty >= dest.height)
      err(`warp #${i} : arrivée (${w.tx},${w.ty}) hors de « ${w.to} »`);
  });

  // Références des scripts : textes (MSG/CHOICE) et scènes (WARP)
  for (const raw of sc.script) {
    const line = raw.split(";")[0].trim();
    if (!line || line.endsWith(":")) continue;
    const tok = line.split(/\s+/);
    if (tok[0] === "MSG" && tok[1] && !textNames.has(tok[1]))
      err(`script : texte inconnu « ${tok[1]} » (${line})`);
    if (tok[0] === "CHOICE")
      for (const t of tok.slice(2)) if (!textNames.has(t)) err(`script : texte inconnu « ${t} » (CHOICE)`);
    if (tok[0] === "WARP" && tok[1] && !data.scenes[tok[1]])
      err(`script : WARP vers une scène inconnue « ${tok[1]} »`);
  }
}

export function checkProject(data: ProjectData, blockCount: number): Diag[] {
  const out: Diag[] = [];
  const textNames = new Set(data.texts.map((t) => t.name));

  if (!data.scenes[data.project.boot_scene])
    out.push({ level: "error", where: "projet", msg: `scène de boot « ${data.project.boot_scene} » introuvable` });

  for (const t of data.texts) {
    if (![...t.text].every((c) => c >= " " && c <= "~"))
      out.push({
        level: "error",
        where: "textes",
        msg: `« ${t.name} » : caractère non-ASCII (accents non supportés en v0)`,
      });
  }

  for (const name of data.project.scenes) {
    const sc = data.scenes[name];
    if (!sc) {
      out.push({ level: "error", where: name, msg: "fichier de scène manquant" });
      continue;
    }
    checkScene(name, sc, data, blockCount, textNames, out);
  }
  return out;
}
