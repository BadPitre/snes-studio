// Reading/writing the project through the Tauri plugins (dialog + fs).
// The JSON written stays diff-readable: tilemap/collision one row per
// line, the same layout as the historic sources.

import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile as tauriReadText, readFile as tauriRead, writeTextFile as tauriWriteText, writeFile as tauriWrite, rename as tauriRename, remove as tauriRemove, mkdir as tauriMkdir } from "@tauri-apps/plugin-fs";
import type { Actor, EventPage, GameEvent, Project, ProjectData, Scene, TextEntry, TilesetMeta,
  Screen,
} from "./types";
import { EMPTY_TILE, actorToEvent, assetStem, projectTilesets } from "./types";

// Browser mode (vite dev/preview without Tauri): the "project" is served
// over HTTP (read only) — handy for UI work and screenshots.
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

// The project's text files by relative path (database: TOML schemas,
// instances) — root is "/project" in browser mode (see loadProject)
export async function readProjectText(root: string, rel: string): Promise<string> {
  return readTextFile(`${root}/${rel}`);
}

export async function writeProjectText(root: string, rel: string, content: string): Promise<void> {
  return writeTextFile(`${root}/${rel}`, content);
}

// creates a project folder when it does not exist (schemas/, data/)
export async function ensureProjectDir(root: string, rel: string): Promise<void> {
  if (!hasTauri) return;
  try {
    await tauriMkdir(`${root}/${rel}`, { recursive: true });
  } catch {
    /* already there */
  }
}

// Binary files / asset management (Resource Manager) — Tauri only
export async function readBinaryFile(path: string): Promise<Uint8Array> {
  return readFile(path);
}

export async function writeBinaryFile(path: string, bytes: Uint8Array): Promise<void> {
  if (!hasTauri) {
    console.warn(`mode navigateur : écriture ignorée (${path})`, bytes.length);
    return;
  }
  return tauriWrite(path, bytes);
}

export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  if (hasTauri) await tauriRename(oldPath, newPath);
}

export async function removePath(path: string): Promise<void> {
  if (hasTauri) await tauriRemove(path);
}

// "save as" dialogue (asset export)
export async function pickSavePath(
  title: string,
  defaultName: string
): Promise<string | null> {
  if (!hasTauri) return null;
  return save({
    title,
    defaultPath: defaultName,
    filters: [{ name: "PNG", extensions: ["png"] }],
  });
}

// browser mode is read only (no asset import)
export function canWriteFiles(): boolean {
  return hasTauri;
}

export async function pickProjectDir(): Promise<string | null> {
  if (!hasTauri) return "/project"; // served statically in browser mode
  const dir = await open({ directory: true, title: "Ouvrir un projet SNES Studio" });
  return typeof dir === "string" ? dir : null;
}

export async function loadProject(root: string): Promise<ProjectData> {
  const project: Project = JSON.parse(await readTextFile(`${root}/project.json`));
  // T2: migration — projects without tileset entries get one per file
  // (name = the stem), the format the Tilesets window edits
  if (!project.tileset_defs || !project.tileset_defs.length) {
    project.tileset_defs = projectTilesets(project).map((f) => ({
      name: assetStem(f),
      file: f,
    }));
  }
  const texts: TextEntry[] = JSON.parse(await readTextFile(`${root}/texts.json`));
  const scenes: Record<string, Scene> = {};
  for (const name of project.scenes) {
    const sc: Scene = JSON.parse(await readTextFile(`${root}/scenes/${name}.json`));
    sc.warps ??= []; // optional fields in the older files
    sc.script ??= [];
    sc.events ??= [];
    sc.upper ??= Array.from({ length: sc.height }, () =>
      Array.from({ length: sc.width }, () => EMPTY_TILE)
    );
    const raw = sc as unknown as Record<string, unknown>;
    delete raw["collision"]; // legacy: derived from the tileset
    // legacy: the old "actors" become events
    const legacy = raw["actors"] as Actor[] | undefined;
    if (legacy?.length) {
      sc.events.push(...legacy.map((a, i) => actorToEvent(a, sc.events.length + i)));
    }
    delete raw["actors"];
    for (const e of sc.events) {
      // v0.10: the JSON's "pages" shape -> page 1 into the flat fields,
      // pages 2+ into extraPages (the editor's internal model)
      const rawPages = (e as unknown as { pages?: EventPage[] }).pages;
      if (rawPages && rawPages.length > 0) {
        const p1 = rawPages[0];
        e.condition = p1.condition;
        e.move = p1.move;
        e.move_route = p1.move_route;
        e.priority = p1.priority;
        e.speed = p1.speed;
        e.trigger = p1.trigger;
        e.sprite = p1.sprite;
        e.tile = p1.tile;
        e.dir = p1.dir;
        e.entry = p1.entry;
        e.commands = p1.commands ?? [];
        e.extraPages = rawPages.slice(1).map((p) => ({
          condition: p.condition,
          trigger: p.trigger ?? "action",
          sprite: p.sprite ?? -1,
          tile: p.tile,
          dir: p.dir ?? "down",
          entry: p.entry,
          commands: p.commands ?? [],
        }));
        delete (e as unknown as Record<string, unknown>)["pages"];
      }
      e.commands ??= [];
      e.sprite ??= -1;
      e.dir ??= "down";
      e.trigger ??= "action";
      e.name ??= "EV";
      for (const p of e.extraPages ?? []) {
        p.commands ??= [];
        p.sprite ??= -1;
        p.dir ??= "down";
        p.trigger ??= "action";
      }
    }
    scenes[name] = sc;
  }
  // passability sidecars (assets/<stem>.json) — absent = everything walkable
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
        dirs: m.dirs && Object.keys(m.dirs).length ? m.dirs : undefined,
        anims: m.anims && m.anims.length ? m.anims : undefined,
      };
    } catch {
      tilesetMeta[stem] = { autotiles: [], solid: [], above: [] };
    }
  }
  // composed screens (B6bis): screens/<name>.json — absent = no screens
  const screens: Record<string, Screen> = {};
  for (const n of project.screens ?? []) {
    try {
      const sc = JSON.parse(await readTextFile(`${root}/screens/${n}.json`));
      screens[n] = {
        backdrop: sc.backdrop ?? "",
        slots: sc.slots ?? [],
        // legacy: the old "script" field becomes the first named script
        // (run when the screen opens)
        scripts: (
          sc.scripts ?? [{ name: "principal", commands: sc.script ?? [] }]
        ).map((x: { name: string; trigger?: string; cond?: unknown; commands?: unknown[] }, i: number) => ({
          name: x.name ?? `script${i + 1}`,
          trigger: x.trigger ?? (i === 0 ? "auto" : "call"),
          cond: x.cond,
          commands: x.commands ?? [],
        })),
      };
    } catch {
      screens[n] = {
        backdrop: "",
        slots: [],
        scripts: [{ name: "principal", trigger: "auto", commands: [] }],
      };
    }
  }
  return { root, project, scenes, texts, tilesetMeta, screens };
}

// First colour of the PLTE chunk of an indexed PNG — index 0 is
// TRANSPARENT on the SNES, and the editor must match that.
function pngFirstPaletteColor(bytes: Uint8Array): [number, number, number] | null {
  let o = 8; // after the PNG signature
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
  return loadPngBitmap(`${root}/${rel}`);
}

// PNG from an absolute path (import previews) — the same transparency key
// as the project assets (the first colour of the PLTE palette)
export async function loadPngBitmap(path: string): Promise<ImageBitmap> {
  const bytes = await readFile(path);
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

// Serialisation with compact rows (one line per map row)
function sceneToJson(sc: Scene): string {
  const grid = (rows: number[][]) =>
    "[\n" + rows.map((r) => "    [" + r.join(", ") + "]").join(",\n") + "\n  ]";
  // events: one per line (the nested commands stay compact)
  const eventJson = (e: GameEvent): string => {
    if (!e.extraPages || e.extraPages.length === 0) {
      const flat = { ...e };
      delete flat.extraPages;
      return JSON.stringify(flat);
    }
    const page1: EventPage = {
      condition: e.condition,
      move: e.move,
      move_route: e.move_route,
      priority: e.priority,
      speed: e.speed,
      trigger: e.trigger,
      sprite: e.sprite,
      tile: e.tile,
      dir: e.dir,
      entry: e.entry,
      commands: e.commands,
    };
    return JSON.stringify({
      name: e.name,
      x: e.x,
      y: e.y,
      pages: [page1, ...e.extraPages],
    });
  };
  const events =
    sc.events.length === 0
      ? "[]"
      : "[\n" + sc.events.map((e) => "    " + eventJson(e)).join(",\n") + "\n  ]";
  const warps =
    sc.warps.length === 0
      ? "[]"
      : "[\n" +
        sc.warps
          .map(
            (w) =>
              `    {"x": ${w.x}, "y": ${w.y}, "to": ${JSON.stringify(w.to)}, "tx": ${w.tx}, "ty": ${w.ty}${
                w.dir ? `, "dir": ${JSON.stringify(w.dir)}` : ""
              }${w.trans ? `, "trans": ${JSON.stringify(w.trans)}` : ""}}`
          )
          .join(",\n") +
        "\n  ]";
  const script =
    sc.script.length === 0
      ? "[]"
      : "[\n" + sc.script.map((l) => "    " + JSON.stringify(l)).join(",\n") + "\n  ]";
  const music = sc.music ? `\n  "music": ${JSON.stringify(sc.music)},` : "";
  const tileset = sc.tileset ? `\n  "tileset": ${JSON.stringify(sc.tileset)},` : "";
  const parent = sc.parent ? `\n  "parent": ${JSON.stringify(sc.parent)},` : "";
  // effect layer (S9) — LESSON: this serialiser is MANUAL, every new
  // Scene field must be added here or it is silently lost on save (the
  // bug in the first S9 delivery: the effect invisible in game)
  const effect = sc.effect ? `\n  "effect": ${JSON.stringify(sc.effect)},` : "";
  // Scene TYPE (M7): only written when it is not the default, so an
  // ordinary scene's JSON is unchanged. The comment above is not
  // decoration — this field was lost on save exactly as `effect` once
  // was, and the symptom was the same: a world map that came back
  // rendered like any other scene.
  const kind = sc.kind && sc.kind !== "map" ? `\n  "kind": ${JSON.stringify(sc.kind)},` : "";
  // World map CAMERA ANGLE — same rule as `kind`: written only when the
  // author moved it off the engine's default, so an ordinary scene's JSON
  // does not grow two fields nothing will ever read.
  const view =
    sc.kind === "worldmap" && (sc.m7_horizon !== undefined || sc.m7_anchor !== undefined)
      ? `\n  "m7_horizon": ${sc.m7_horizon ?? 56},\n  "m7_anchor": ${sc.m7_anchor ?? 176},`
      : "";
  return `{
  "name": ${JSON.stringify(sc.name)},
  "width": ${sc.width},
  "height": ${sc.height},
  "player_start": [${sc.player_start[0]}, ${sc.player_start[1]}],${kind}${view}${music}${tileset}${parent}${effect}
  "tilemap": ${grid(sc.tilemap)},
  "upper": ${grid(sc.upper)},
  "events": ${events},
  "warps": ${warps},
  "script": ${script}
}
`;
}

// Passability sidecar, canonical format (readable diffs)
function metaToJson(m: import("./types").TilesetMeta): string {
  const upper =
    m.upper_start !== undefined ? `,\n  "upper_start": ${m.upper_start}` : "";
  // T1: closed sides + animated sequences — omitted when empty
  const dirEntries = Object.entries(m.dirs ?? {}).filter(([, v]) => v);
  const dirs = dirEntries.length
    ? `,\n  "dirs": { ${dirEntries
        .map(([k, v]) => `"${k}": ${v}`)
        .join(", ")} }`
    : "";
  const anims = (m.anims ?? []).length
    ? `,\n  "anims": [\n${(m.anims ?? [])
        .map(
          (a) =>
            `    { "tiles": [${a.tiles.join(", ")}], "mode": ${JSON.stringify(
              a.mode
            )}, "speed": ${a.speed} }`
        )
        .join(",\n")}\n  ]`
    : "";
  return `{
  "autotiles": [${m.autotiles.map((a) => JSON.stringify(a)).join(", ")}],
  "solid": [${m.solid.join(", ")}],
  "above": [${m.above.join(", ")}]${upper}${dirs}${anims}
}
`;
}

// A tileset's autotile PNGs, in the sidecar's order
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

// File selection (without copying)
export async function pickFile(
  title: string,
  name: string,
  extensions: string[]
): Promise<string | null> {
  if (!hasTauri) return null;
  const file = await open({ title, filters: [{ name, extensions }] });
  return typeof file === "string" ? file : null;
}

// PNG selection — for the RM2003 chipset import
export function pickPngFile(title: string): Promise<string | null> {
  return pickFile(title, "PNG", ["png"]);
}

// Tileset PNG import: chosen through a dialog, copied into assets/
export async function importTilesetPng(root: string): Promise<string | null> {
  if (!hasTauri) return null;
  const file = await open({
    title: "Importer un tileset (PNG indexé, tiles 16x16)",
    filters: [{ name: "PNG", extensions: ["png"] }],
  });
  if (typeof file !== "string") return null;
  const name = file.split(/[\\/]/).pop()!;
  const bytes = await tauriRead(file);
  // one folder per resource type (see resources.ts, and `datagen tidy`)
  await ensureProjectDir(root, "assets/tilesets");
  await tauriWrite(`${root}/assets/tilesets/${name}`, bytes);
  return `assets/tilesets/${name}`;
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
  // composed screens (B6bis) — one file per screen, like the scenes
  if ((data.project.screens ?? []).length) {
    await ensureProjectDir(data.root, "screens");
    for (const n of data.project.screens ?? []) {
      const sc = data.screens[n];
      if (sc)
        await writeTextFile(
          `${data.root}/screens/${n}.json`,
          JSON.stringify(sc, null, 2) + "\n"
        );
    }
  }
}
