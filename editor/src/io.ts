// Lecture/écriture du projet via les plugins Tauri (dialog + fs).
// Les JSON écrits restent lisibles en diff : tilemap/collision à une
// rangée par ligne, même mise en page que les sources historiques.

import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile as tauriReadText, readFile as tauriRead, writeTextFile as tauriWriteText } from "@tauri-apps/plugin-fs";
import type { Project, ProjectData, Scene, TextEntry } from "./types";

// Mode navigateur (vite dev/preview sans Tauri) : le "projet" est servi en
// HTTP (lecture seule) — pratique pour développer l'UI et les captures.
const hasTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function readTextFile(path: string): Promise<string> {
  if (hasTauri) return tauriReadText(path);
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.text();
}

async function readFile(path: string): Promise<Uint8Array> {
  if (hasTauri) return tauriRead(path);
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function writeTextFile(path: string, content: string): Promise<void> {
  if (hasTauri) return tauriWriteText(path, content);
  console.warn(`mode navigateur : écriture ignorée (${path})`, content.length);
}

export async function pickProjectDir(): Promise<string | null> {
  if (!hasTauri) return "/project"; // servi statiquement en mode navigateur
  const dir = await open({ directory: true, title: "Ouvrir un projet SNES Studio" });
  return typeof dir === "string" ? dir : null;
}

export async function loadProject(root: string): Promise<ProjectData> {
  const project: Project = JSON.parse(await readTextFile(`${root}/project.json`));
  const texts: TextEntry[] = JSON.parse(await readTextFile(`${root}/texts.json`));
  const scenes: Record<string, Scene> = {};
  for (const name of project.scenes) {
    const sc: Scene = JSON.parse(await readTextFile(`${root}/scenes/${name}.json`));
    sc.warps ??= []; // champ optionnel dans les anciens fichiers
    sc.script ??= [];
    scenes[name] = sc;
  }
  return { root, project, scenes, texts };
}

export async function loadAssetPng(root: string, rel: string): Promise<ImageBitmap> {
  const bytes = await readFile(`${root}/${rel}`);
  return createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
}

// Sérialisation avec rangées compactes (une ligne par rangée de map)
function sceneToJson(sc: Scene): string {
  const grid = (rows: number[][]) =>
    "[\n" + rows.map((r) => "    [" + r.join(", ") + "]").join(",\n") + "\n  ]";
  const actors =
    sc.actors.length === 0
      ? "[]"
      : "[\n" +
        sc.actors
          .map((a) => {
            const entry = a.entry !== undefined ? `, "entry": ${JSON.stringify(a.entry)}` : "";
            return `    {"type": "npc", "x": ${a.x}, "y": ${a.y}, "sprite": ${a.sprite}, "dir": "${a.dir}"${entry}}`;
          })
          .join(",\n") +
        "\n  ]";
  const warps =
    sc.warps.length === 0
      ? "[]"
      : "[\n" +
        sc.warps
          .map(
            (w) =>
              `    {"x": ${w.x}, "y": ${w.y}, "to": ${JSON.stringify(w.to)}, "tx": ${w.tx}, "ty": ${w.ty}}`
          )
          .join(",\n") +
        "\n  ]";
  const script =
    sc.script.length === 0
      ? "[]"
      : "[\n" + sc.script.map((l) => "    " + JSON.stringify(l)).join(",\n") + "\n  ]";
  return `{
  "name": ${JSON.stringify(sc.name)},
  "width": ${sc.width},
  "height": ${sc.height},
  "player_start": [${sc.player_start[0]}, ${sc.player_start[1]}],
  "tilemap": ${grid(sc.tilemap)},
  "collision": ${grid(sc.collision)},
  "actors": ${actors},
  "warps": ${warps},
  "script": ${script}
}
`;
}

export async function saveProject(data: ProjectData): Promise<void> {
  await writeTextFile(
    `${data.root}/project.json`,
    JSON.stringify(data.project, null, 2) + "\n"
  );
  await writeTextFile(
    `${data.root}/texts.json`,
    JSON.stringify(data.texts, null, 2) + "\n"
  );
  for (const name of data.project.scenes) {
    await writeTextFile(`${data.root}/scenes/${name}.json`, sceneToJson(data.scenes[name]));
  }
}
