// Vérifications statiques du projet (fenêtre de diagnostic) : tout ce que
// datagen refusera ou qui cassera à la génération, détecté côté éditeur
// avec des messages localisés. La vérité finale reste datagen (lancé par
// la fenêtre) — ces contrôles donnent le « où » lisible.

import type { ProjectData, Scene } from "./types";
import { MIN_H, MIN_W, SCENE_SPRITE_BLOCKS_MAX, animFrameCells, sceneSpriteBlocks } from "./types";
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
  sc.events.forEach((e, i) => {
    const who = e.name || `event #${i}`;
    if (e.x >= sc.width || e.y >= sc.height) err(`${who} hors map (${e.x},${e.y})`);
    if (e.trigger === "action" && e.sprite >= blockCount)
      err(`${who} : personnage ${e.sprite} hors feuille de sprites (${blockCount} blocs)`);
    if (e.trigger === "action" && e.sprite < 0)
      err(`${who} : un event « touche action » doit avoir une apparence`);
    if (e.trigger !== "action" && !e.commands.length && !e.entry)
      err(`${who} (${e.trigger === "touch" ? "contact" : "auto"}) sans commandes — requis`);
    if (!e.commands.length && e.entry && !labels.has(e.entry))
      err(`${who} : label « ${e.entry} » absent du script`);
    if (e.trigger === "action" && !e.commands.length && !e.entry)
      warn(`${who} sans commandes (il ne dira rien)`);
    // textes des commandes : non-ASCII refuse par datagen
    const scan = (cmds: import("./types").Command[]) => {
      for (const cmd of cmds) {
        if (cmd.c === "msg" && cmd.text_ref !== undefined) {
          if (!data.texts.some((t) => t.name === cmd.text_ref))
            err(`${who} : texte du catalogue « ${cmd.text_ref} » introuvable (Tools > Textes)`);
        } else if (cmd.c === "msg") {
          if (![...cmd.text].every((ch) => ch >= " " && ch <= "~"))
            err(`${who} : message « ${cmd.text.slice(0, 24)}… » avec accents (non supportes en v0)`);
          // codes speciaux (T2) : memes regles que datagen
          const bad = cmd.text.match(/\\(?!v\[\d+\]|s\[\d+\]|[.|!^><\\])/);
          if (bad)
            err(`${who} : code « \\${cmd.text[(bad.index ?? 0) + 1] ?? ""} » inconnu (codes : \\v[n] \\s[n] \\. \\| \\! \\^ \\> \\< \\\\)`);
        }
        if (cmd.c === "choice") cmd.options.forEach((o) => scan(o.do));
        if (cmd.c === "if") {
          scan(cmd.then);
          scan(cmd.else);
        }
        if (cmd.c === "warp" && !data.scenes[cmd.to]) err(`${who} : téléport vers une scène inconnue « ${cmd.to} »`);
        if (cmd.c === "anim_play" && !(data.project.animations ?? []).some((a) => a.name === cmd.anim))
          err(`${who} : animation « ${cmd.anim} » introuvable (Tools > Animations)`);
      }
    };
    scan(e.commands);
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

  // Animations (A1) : ce que datagen refusera, avec le « où » lisible
  const vigStems = new Set(
    (data.project.vignettes ?? []).map((p) => (p.split(/[\\/]/).pop() ?? p).replace(/\.[^.]+$/, ""))
  );
  const sndStems = new Set(
    (data.project.sounds ?? []).map((p) => (p.split(/[\\/]/).pop() ?? p).replace(/\.[^.]+$/, ""))
  );
  const seenAnim = new Set<string>();
  for (const a of data.project.animations ?? []) {
    const err = (msg: string) => out.push({ level: "error", where: "animations", msg });
    if (seenAnim.has(a.name)) err(`« ${a.name} » : nom en double`);
    seenAnim.add(a.name);
    if (!a.vignette || !vigStems.has(a.vignette))
      err(`« ${a.name} » : planche « ${a.vignette} » introuvable dans les vignettes du projet`);
    if (a.frames.length === 0) err(`« ${a.name} » : aucune frame`);
    const nl = Math.max(1, Math.min(4, a.layers ?? 1));
    if ((a.layers ?? 1) < 1 || (a.layers ?? 1) > 4)
      err(`« ${a.name} » : ${a.layers} calques (1 à 4)`);
    for (const [i, f] of a.frames.entries()) {
      if (f.dur < 1) err(`« ${a.name} », frame ${i + 1} : durée nulle`);
      for (const c of animFrameCells(f, nl))
        if (c.x < -128 || c.x > 127 || c.y < -128 || c.y > 127)
          err(`« ${a.name} », frame ${i + 1} : décalage hors de -128..127`);
      if (f.sfx && !sndStems.has(f.sfx))
        err(`« ${a.name} », frame ${i + 1} : son « ${f.sfx} » introuvable`);
    }
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
