// Lecture/écriture du projet via les plugins Tauri (dialog + fs).
// Les JSON écrits restent lisibles en diff : tilemap/collision à une
// rangée par ligne, même mise en page que les sources historiques.

import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile as tauriReadText, readFile as tauriRead, writeTextFile as tauriWriteText, writeFile as tauriWrite } from "@tauri-apps/plugin-fs";
import type { Project, ProjectData, Scene, TextEntry, TilesetMeta } from "./types";
import { EMPTY_TILE, assetStem, projectTilesets } from "./types";

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

// le mode navigateur est en lecture seule (pas d'import d'assets)
export function canWriteFiles(): boolean {
  return hasTauri;
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
    sc.warps ??= []; // champs optionnels dans les anciens fichiers
    sc.script ??= [];
    sc.upper ??= Array.from({ length: sc.height }, () =>
      Array.from({ length: sc.width }, () => EMPTY_TILE)
    );
    delete (sc as unknown as Record<string, unknown>)["collision"]; // héritage : dérivée du tileset
    scenes[name] = sc;
  }
  // sidecars de passabilité (assets/<stem>.json) — absent = tout passable
  const tilesetMeta: Record<string, TilesetMeta> = {};
  for (const p of projectTilesets(project)) {
    const stem = assetStem(p);
    const sidecar = p.replace(/\.[^.]+$/, ".json");
    try {
      const m = JSON.parse(await readTextFile(`${root}/${sidecar}`));
      tilesetMeta[stem] = {
        autotiles: m.autotiles ?? [],
        solid: m.solid ?? [],
        above: m.above ?? [],
        upper_start: m.upper_start,
      };
    } catch {
      tilesetMeta[stem] = { autotiles: [], solid: [], above: [] };
    }
  }
  return { root, project, scenes, texts, tilesetMeta };
}

// Première couleur du chunk PLTE d'un PNG indexé — l'index 0 est
// TRANSPARENT côté SNES, l'éditeur doit le rendre pareil.
function pngFirstPaletteColor(bytes: Uint8Array): [number, number, number] | null {
  let o = 8; // après la signature PNG
  while (o + 8 <= bytes.length) {
    const len =
      (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];
    const type = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]);
    if (type === "PLTE" && len >= 3) {
      return [bytes[o + 8], bytes[o + 9], bytes[o + 10]];
    }
    o += 12 + len;
  }
  return null;
}

export async function loadAssetPng(root: string, rel: string): Promise<ImageBitmap> {
  const bytes = await readFile(`${root}/${rel}`);
  const bmp = await createImageBitmap(
    new Blob([new Uint8Array(bytes)], { type: "image/png" })
  );
  const key = pngFirstPaletteColor(bytes);
  if (!key) return bmp;
  const cv = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] === key[0] && d[i + 1] === key[1] && d[i + 2] === key[2]) d[i + 3] = 0;
  }
  ctx.putImageData(img, 0, 0);
  return createImageBitmap(cv);
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
  const music = sc.music ? `\n  "music": ${JSON.stringify(sc.music)},` : "";
  const tileset = sc.tileset ? `\n  "tileset": ${JSON.stringify(sc.tileset)},` : "";
  return `{
  "name": ${JSON.stringify(sc.name)},
  "width": ${sc.width},
  "height": ${sc.height},
  "player_start": [${sc.player_start[0]}, ${sc.player_start[1]}],${music}${tileset}
  "tilemap": ${grid(sc.tilemap)},
  "upper": ${grid(sc.upper)},
  "actors": ${actors},
  "warps": ${warps},
  "script": ${script}
}
`;
}

// Sidecar de passabilité, format canonique (diffs lisibles)
function metaToJson(m: import("./types").TilesetMeta): string {
  const upper =
    m.upper_start !== undefined ? `,\n  "upper_start": ${m.upper_start}` : "";
  return `{
  "autotiles": [${m.autotiles.map((a) => JSON.stringify(a)).join(", ")}],
  "solid": [${m.solid.join(", ")}],
  "above": [${m.above.join(", ")}]${upper}
}
`;
}

// PNG d'autotiles d'un tileset, dans l'ordre du sidecar
export async function loadAutotiles(
  root: string,
  meta: import("./types").TilesetMeta
): Promise<ImageBitmap[]> {
  const out: ImageBitmap[] = [];
  for (const rel of meta.autotiles) {
    out.push(await loadAssetPng(root, rel));
  }
  return out;
}

// Sélection d'un PNG (sans copie) — pour l'import de chipset RM2003
export async function pickPngFile(title: string): Promise<string | null> {
  if (!hasTauri) return null;
  const file = await open({ title, filters: [{ name: "PNG", extensions: ["png"] }] });
  return typeof file === "string" ? file : null;
}

// Import d'un PNG de tileset : choisi via dialog, copié dans assets/
export async function importTilesetPng(root: string): Promise<string | null> {
  if (!hasTauri) return null;
  const file = await open({
    title: "Importer un tileset (PNG indexé, tiles 16x16)",
    filters: [{ name: "PNG", extensions: ["png"] }],
  });
  if (typeof file !== "string") return null;
  const name = file.split(/[\\/]/).pop()!;
  const bytes = await tauriRead(file);
  await tauriWrite(`${root}/assets/${name}`, bytes);
  return `assets/${name}`;
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
  for (const p of projectTilesets(data.project)) {
    const meta = data.tilesetMeta[assetStem(p)];
    if (!meta) continue;
    await writeTextFile(`${data.root}/${p.replace(/\.[^.]+$/, ".json")}`, metaToJson(meta));
  }
}
