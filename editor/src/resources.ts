// The editor's RESOURCE model.
//
// Seven of the project's registers — windowskins, icon sheets, fonts,
// pictures, sounds, music, vignettes — are the same object seen seven
// times: a file under assets/, a path in project.json, and four actions
// (import, export, rename, delete). The FLOW of those four actions is
// identical everywhere, and used to be written out once per resource.
//
// What genuinely differs is small and stays declared here, resource by
// resource: the accepted dimensions, the wording shown to the author, and
// the register semantics (a picture entry may be an object, a font can
// never leave assets.font, a windowskin materialises its migration when
// written back). Everything else lives once, in the four run* functions
// at the bottom.

import type { Project, ProjectData } from "./types";
import {
  assetStem,
  picPath,
  projectFonts,
  projectIconsets,
  projectPictures,
  projectWindowskins,
} from "./types";
import {
  ensureProjectDir,
  pickFile,
  pickPngFile,
  pickSavePath,
  readBinaryFile,
  removePath,
  renamePath,
  saveProject,
  writeBinaryFile,
} from "./io";

export type ResKind =
  | "windowskin"
  | "iconset"
  | "font"
  | "picture"
  | "sound"
  | "music"
  | "vignette"
  | "mode7";

// Everything the four flows need from the App: the loaded project and the
// three ways it can change (a recorded mutation, a save + reload, a status
// line).
export interface ResCtx {
  data: ProjectData;
  sceneName: string;
  setStatus: (s: string) => void;
  mutate: (f: (d: ProjectData) => ProjectData) => void;
  reload: (root: string, keepScene?: string) => Promise<unknown>;
  // Imports that go through the transparent-colour picker (S4) stop here
  // and are finished by the App once the colour is known.
  beginTransPick: (t: {
    kind: "iconset" | "picture" | "charset";
    file: string;
    bytes: Uint8Array;
    bmp: ImageBitmap;
  }) => void;
  // Reference rewrites that live outside project.json (ui/layout.toml).
  renameInLayout?: (root: string, oldRel: string, newRel: string) => Promise<void>;
  layoutUsers?: (root: string, rel: string) => Promise<string[]>;
}

export interface Resource {
  kind: ResKind;
  // Where an import lands, and therefore where a rename moves a file to.
  // One folder per resource type: an author browsing assets/ on disk sees
  // the same categories as the resource manager (`datagen tidy` files an
  // older project the same way).
  dir: string; // "assets/pictures" | "assets/sounds" | …
  ext: string; // "png" | "wav" | "it"
  // Lowercase and scrub the imported filename. The PNG registers keep the
  // author's filename; the ones datagen indexes by name do not.
  slug: boolean;
  // An already-registered path aborts the import instead of overwriting.
  refuseDuplicate: boolean;
  // A second import phase: pick the transparent colour, then the App
  // finishes (it is the only part that inspects the pixels).
  transPick?: "iconset" | "picture";

  // ---- register --------------------------------------------------------
  // What the author sees and what a duplicate is checked against.
  list: (p: Project) => string[];
  // `trans` is set only by the transparency picker, and only a picture
  // entry records it — the other registers ignore it.
  add: (p: Project, rel: string, opts?: { trans?: boolean }) => Project;
  remove: (p: Project, rel: string) => Project;
  rename: (p: Project, oldRel: string, newRel: string) => Project;
  // Locked: the resource is in use as THE project's font / theme / icon
  // sheet. Renaming still works (the reference follows), deleting does not.
  locked?: (p: Project, rel: string) => boolean;

  // ---- wording ---------------------------------------------------------
  // Every string the author reads. Kept verbatim per resource rather than
  // declined from a root: French gender and agreement are not worth a
  // grammar engine, and the messages differ in substance anyway (an image
  // warns about "Afficher une image", a music about the scenes using it).
  pickImport: () => Promise<string | null>;
  // Widened from ImageBitmap to what it actually reads, so the ROM ripper
  // can ask "would a 32x32 cut be accepted here?" before a PNG exists.
  badSize?: (bmp: { width: number; height: number }) => string | null;
  // Only the registers that refuse a duplicate ever say so.
  exists?: (stem: string) => string;
  imported: (stem: string, bmp: { width: number; height: number } | null, opts?: { trans?: boolean }) => string;
  importFailed: (e: unknown) => string;
  pickExport: string;
  exported: (path: string) => string;
  exportFailed: (e: unknown) => string;
  renameTaken: (stem: string) => string;
  renamed: (oldStem: string, newStem: string) => string;
  confirmDelete: (stem: string) => string;
  deleted: (stem: string) => string;
}

// ---- register helpers ------------------------------------------------

// A plain string[] register: absent when empty, so a project that never
// used the resource keeps a clean project.json.
function stringRegister(key: "fonts" | "sounds" | "musics" | "vignettes") {
  return {
    add: (p: Project, rel: string): Project => ({
      ...p,
      [key]: [...(p[key] ?? []), rel],
    }),
    remove: (p: Project, rel: string): Project => {
      const next = (p[key] ?? []).filter((r) => r !== rel);
      return { ...p, [key]: next.length ? next : undefined };
    },
    rename: (p: Project, oldRel: string, newRel: string): Project => ({
      ...p,
      [key]: (p[key] ?? []).map((r) => (r === oldRel ? newRel : r)),
    }),
  };
}

// windowskins / iconsets: the accessor migrates projects from before the
// register by folding the active entry in, and writing that list back is
// what makes the migration permanent.
function uiRegister(
  key: "windowskins" | "iconsets",
  uiKey: "windowskin" | "icons",
  read: (p: Project) => string[]
) {
  return {
    list: read,
    add: (p: Project, rel: string): Project =>
      read(p).includes(rel) ? p : { ...p, [key]: [...read(p), rel] },
    remove: (p: Project, rel: string): Project => {
      const next = read(p).filter((r) => r !== rel);
      return { ...p, [key]: next.length ? next : undefined };
    },
    rename: (p: Project, oldRel: string, newRel: string): Project => ({
      ...p,
      [key]: read(p).map((r) => (r === oldRel ? newRel : r)),
      ui: p.ui?.[uiKey] === oldRel ? { ...p.ui, [uiKey]: newRel } : p.ui,
    }),
    locked: (p: Project, rel: string) => p.ui?.[uiKey] === rel,
  };
}

// ---- the resources ---------------------------------------------------

const windowskin: Resource = {
  kind: "windowskin",
  dir: "assets/windowskins",
  ext: "png",
  slug: false,
  refuseDuplicate: false,
  ...uiRegister("windowskins", "windowskin", projectWindowskins),
  pickImport: () => pickPngFile("Importer un windowskin (PNG 24x24, 9-slice)"),
  badSize: (b) =>
    b.width !== 24 || b.height !== 24
      ? `Windowskin : attendu 24x24 (9 tiles 8x8), reçu ${b.width}x${b.height}`
      : null,
  imported: (s) => `Windowskin importé : ${s}.png`,
  importFailed: (e) => `Import windowskin : ${e}`,
  pickExport: "Exporter le windowskin (PNG 24x24)",
  exported: (p) => `Windowskin exporté : ${p}`,
  exportFailed: (e) => `Export windowskin : ${e}`,
  renameTaken: (s) => `Renommage : le windowskin « ${s} » existe déjà`,
  renamed: (o, n) => `Windowskin renommé : ${o} → ${n}`,
  confirmDelete: (s) => `Supprimer le windowskin « ${s} » et son fichier ?`,
  deleted: (s) => `Windowskin supprimé : ${s}`,
};

const iconset: Resource = {
  kind: "iconset",
  dir: "assets/iconsets",
  ext: "png",
  slug: false,
  refuseDuplicate: false,
  transPick: "iconset",
  ...uiRegister("iconsets", "icons", projectIconsets),
  pickImport: () =>
    pickPngFile("Importer une planche d'icônes (PNG Nx8, largeur multiple de 8)"),
  badSize: (b) =>
    b.height !== 8 || b.width % 8 !== 0 || b.width === 0 || b.width > 512
      ? `Planche d'icônes : attendu une bande Nx8 (largeur multiple de 8, max 64 icônes), reçu ${b.width}x${b.height}`
      : null,
  imported: (s, b) => `Planche d'icônes importée : ${s}.png (${b ? b.width / 8 : 0} icônes)`,
  importFailed: (e) => `Import planche d'icônes : ${e}`,
  pickExport: "Exporter la planche d'icônes (PNG)",
  exported: (p) => `Planche d'icônes exportée : ${p}`,
  exportFailed: (e) => `Export planche d'icônes : ${e}`,
  renameTaken: (s) => `Renommage : la planche « ${s} » existe déjà`,
  renamed: (o, n) => `Planche d'icônes renommée : ${o} → ${n}`,
  confirmDelete: (s) => `Supprimer la planche d'icônes « ${s} » et son fichier ?`,
  deleted: (s) => `Planche d'icônes supprimée : ${s}`,
};

// The register is p.fonts, but the list shown starts with assets.font —
// which is NOT necessarily in p.fonts. Mutating through the shown list
// would inject the project's font into the register, so the two stay
// apart here.
const font: Resource = {
  kind: "font",
  dir: "assets/fonts",
  ext: "png",
  slug: false,
  refuseDuplicate: false,
  list: projectFonts,
  ...stringRegister("fonts"),
  rename: (p, oldRel, newRel) => ({
    ...p,
    fonts: (p.fonts ?? []).map((r) => (r === oldRel ? newRel : r)),
    assets: p.assets.font === oldRel ? { ...p.assets, font: newRel } : p.assets,
  }),
  locked: (p, rel) => p.assets.font === rel,
  pickImport: () => pickPngFile("Importer une fonte (PNG 768x8 — 96 glyphes 8x8)"),
  badSize: (b) =>
    b.width !== 768 || b.height !== 8
      ? `Fonte : attendu une bande 768x8 (96 glyphes 8x8, ASCII 32-127), reçu ${b.width}x${b.height}`
      : null,
  imported: (s) => `Fonte importée : ${s}.png`,
  importFailed: (e) => `Import fonte : ${e}`,
  pickExport: "Exporter la fonte (PNG)",
  exported: (p) => `Fonte exportée : ${p}`,
  exportFailed: (e) => `Export fonte : ${e}`,
  renameTaken: (s) => `Renommage : la fonte « ${s} » existe déjà`,
  renamed: (o, n) => `Fonte renommée : ${o} → ${n}`,
  confirmDelete: (s) => `Supprimer la fonte « ${s} » et son fichier ?`,
  deleted: (s) => `Fonte supprimée : ${s}`,
};

// A picture entry carries its transparency flag, so the register is a
// list of OBJECTS as often as of strings — renaming has to keep the shape.
const picture: Resource = {
  kind: "picture",
  dir: "assets/pictures",
  ext: "png",
  slug: false,
  refuseDuplicate: false,
  transPick: "picture",
  list: (p) => projectPictures(p).map(picPath),
  add: (p, rel, opts) => ({
    ...p,
    pictures: [...projectPictures(p), opts?.trans ? { path: rel, trans: true } : rel],
  }),
  remove: (p, rel) => {
    const next = projectPictures(p).filter((e) => picPath(e) !== rel);
    return { ...p, pictures: next.length ? next : undefined };
  },
  rename: (p, oldRel, newRel) => ({
    ...p,
    pictures: projectPictures(p).map((e) =>
      picPath(e) !== oldRel ? e : typeof e === "string" ? newRel : { ...e, path: newRel }
    ),
  }),
  pickImport: () => pickPngFile("Importer une image (PNG indexé ≤ 16 couleurs, ≤ 256x224)"),
  badSize: (b) =>
    b.width === 0 || b.height === 0 || b.width > 256 || b.height > 224 ||
    b.width % 8 !== 0 || b.height % 8 !== 0
      ? `Image : attendu ≤ 256x224 avec dimensions multiples de 8, reçu ${b.width}x${b.height}`
      : null,
  imported: (s, b, o) =>
    `Image importée : ${s}.png (${b ? `${b.width}x${b.height}` : "?"}${
      o?.trans ? ", avec transparence — le décor se verra à travers" : ""
    })`,
  importFailed: (e) => `Import image : ${e}`,
  pickExport: "Exporter l'image (PNG)",
  exported: (p) => `Image exportée : ${p}`,
  exportFailed: (e) => `Export image : ${e}`,
  renameTaken: (s) => `Renommage : l'image « ${s} » existe déjà`,
  renamed: (o, n) =>
    `Image renommée : ${o} → ${n} — corriger les « Afficher une image » qui l'utilisaient (le build les signale)`,
  confirmDelete: (s) =>
    `Supprimer l'image « ${s} » et son fichier ? Les commandes « Afficher une image » qui l'utilisent seront signalées au build.`,
  deleted: (s) => `Image supprimée : ${s}`,
};

const sound: Resource = {
  kind: "sound",
  dir: "assets/sounds",
  ext: "wav",
  slug: true,
  refuseDuplicate: true,
  list: (p) => p.sounds ?? [],
  ...stringRegister("sounds"),
  pickImport: () =>
    pickFile("Importer un son (WAV, ~2 s max — converti en BRR au build)", "WAV", ["wav"]),
  exists: (s) => `Import : « ${s} » existe déjà dans le projet`,
  imported: (s) => `Son importé : ${s} — à jouer via la commande « Jouer un son »`,
  importFailed: (e) => `Import audio : ${e}`,
  pickExport: "Exporter le son (WAV)",
  exported: (p) => `Exporté : ${p}`,
  exportFailed: (e) => `Export : ${e}`,
  renameTaken: (s) => `Renommage : « ${s} » existe déjà`,
  renamed: (o, n) =>
    `Renommé : ${o} → ${n} — corriger les « Jouer un son » qui l'utilisaient (le build les signale)`,
  confirmDelete: (s) => `Supprimer le son « ${s} » et son fichier ?`,
  deleted: (s) => `Supprimé : ${s}`,
};

const music: Resource = {
  kind: "music",
  dir: "assets/music",
  ext: "it",
  slug: true,
  refuseDuplicate: true,
  list: (p) => p.musics ?? [],
  ...stringRegister("musics"),
  pickImport: () =>
    pickFile("Importer une musique (module Impulse Tracker)", "IT", ["it"]),
  exists: (s) => `Import : « ${s} » existe déjà dans le projet`,
  imported: (s) =>
    `Musique importée : ${s} — à choisir dans l'onglet Scène ou « Changer la musique »`,
  importFailed: (e) => `Import audio : ${e}`,
  pickExport: "Exporter la musique (IT)",
  exported: (p) => `Exporté : ${p}`,
  exportFailed: (e) => `Export : ${e}`,
  renameTaken: (s) => `Renommage : « ${s} » existe déjà`,
  renamed: (o, n) =>
    `Renommé : ${o} → ${n} — corriger les scènes et « Changer la musique » qui l'utilisaient`,
  confirmDelete: (s) => `Supprimer la musique « ${s} » et son fichier ?`,
  deleted: (s) => `Supprimé : ${s}`,
};

const vignette: Resource = {
  kind: "vignette",
  dir: "assets/vignettes",
  ext: "png",
  slug: true,
  refuseDuplicate: true,
  list: (p) => p.vignettes ?? [],
  ...stringRegister("vignettes"),
  pickImport: () =>
    pickPngFile("Importer un sprite animé (bande de frames 32x32, PNG à transparence)"),
  badSize: (b) =>
    /* 64 frames = one ROM bank of cells, datagen's own ceiling — the
       editor gate used to stop at 8 and silently ate bigger imports
       from the rectangle extractor (the status line hid behind it) */
    b.height !== 32 || b.width % 32 !== 0 || b.width === 0 || b.width > 64 * 32
      ? `Sprite animé : attendu une bande 32 px de haut, largeur multiple de 32 (1-64 frames) — reçu ${b.width}x${b.height}`
      : null,
  exists: (s) => `Sprite animé « ${s} » : existe déjà`,
  imported: (s, b) => `Sprite animé importé : ${s} (${b ? b.width / 32 : 0} frame(s))`,
  importFailed: (e) => `Import sprite animé : ${e}`,
  pickExport: "Exporter le sprite animé (PNG)",
  exported: (p) => `Vignette exportée : ${p}`,
  exportFailed: (e) => `Export : ${e}`,
  renameTaken: (s) => `Renommage : « ${s} » existe déjà`,
  renamed: (o, n) =>
    `Vignette renommée : ${o} → ${n} — corriger les « Afficher une vignette » qui l'utilisaient (le build les signale)`,
  confirmDelete: (s) => `Supprimer la vignette « ${s} » et son fichier ?`,
  deleted: (s) => `Vignette supprimée : ${s}`,
};

// A Mode 7 image is its OWN asset, never a reinterpreted picture: a
// picture is 4bpp and validated at 16 colours, and sourcing from one
// would cap the plane at 16 too — throwing away the whole point of 8bpp.
// The author still just picks an image; the distinction lives here.
//
// No size check on import. Anything is accepted and datagen AUTO-FITS it
// (quantise to 128 colours, deduplicate patterns, shrink until it fits
// 255 of them). Refusing an image would push a tile budget onto someone
// who never asked to hear about tiles.
const mode7: Resource = {
  kind: "mode7",
  dir: "assets/mode7",
  ext: "png",
  slug: true,
  refuseDuplicate: true,
  list: (p) => p.mode7?.images ?? [],
  add: (p, rel) => ({
    ...p,
    mode7: { ...(p.mode7 ?? {}), images: [...(p.mode7?.images ?? []), rel] },
  }),
  remove: (p, rel) => {
    const next = (p.mode7?.images ?? []).filter((e) => e !== rel);
    return { ...p, mode7: next.length ? { ...p.mode7, images: next } : undefined };
  },
  rename: (p, oldRel, newRel) => ({
    ...p,
    mode7: {
      ...(p.mode7 ?? {}),
      images: (p.mode7?.images ?? []).map((e) => (e === oldRel ? newRel : e)),
    },
  }),
  pickImport: () => pickPngFile("Importer une image zoomable (PNG)"),
  imported: (s, b) =>
    `Image zoomable importée : ${s}.png (${
      b ? `${b.width}x${b.height}` : "?"
    }) — le build indique la taille réelle après ajustement`,
  importFailed: (e) => `Import image zoomable : ${e}`,
  pickExport: "Exporter l'image zoomable (PNG)",
  exported: (p) => `Image zoomable exportée : ${p}`,
  exportFailed: (e) => `Export image zoomable : ${e}`,
  renameTaken: (s) => `Renommage : l'image zoomable « ${s} » existe déjà`,
  renamed: (o, n) =>
    `Image zoomable renommée : ${o} → ${n} — corriger les « Zoom cinématique » qui l'utilisaient (le build les signale)`,
  confirmDelete: (s) =>
    `Supprimer l'image zoomable « ${s} » et son fichier ? Les « Zoom cinématique » qui l'utilisent seront signalés au build.`,
  deleted: (s) => `Image zoomable supprimée : ${s}`,
};

export const RESOURCES: Record<ResKind, Resource> = {
  windowskin,
  iconset,
  font,
  picture,
  sound,
  music,
  vignette,
  mode7,
};

// ---- the four flows --------------------------------------------------

function stemOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

// Only PNGs are decoded — a WAV or an IT module has no dimensions to check
// and no preview to build.
async function bitmapIfPng(res: Resource, bytes: Uint8Array): Promise<ImageBitmap | null> {
  if (res.ext !== "png") return null;
  return await createImageBitmap(new Blob([bytes as BlobPart], { type: "image/png" }));
}

// `src` is the ROM ripper's seam (X2): bytes it built in memory instead of
// a file the author browsed to. Everything after those first two lines —
// size check, slug, duplicate refusal, register write, status line — is
// the flow the eight resources already share, and the ripper inherits it
// whole rather than reimplementing a single rule of it.
//
// One deliberate difference: a ripped image skips the transparency picker,
// because the ripper already knows which palette index is transparent and
// has punched it into the PNG. `src.trans` says whether it did.
export interface ImportSrc {
  name: string; // filename to register, extension included
  bytes: Uint8Array;
  trans?: boolean;
}

export async function runImport(
  ctx: ResCtx,
  res: Resource,
  src?: ImportSrc
): Promise<void> {
  const { data } = ctx;
  try {
    const file = src ? src.name : await res.pickImport();
    if (!file) return;
    const bytes = src ? src.bytes : await readBinaryFile(file);
    const bmp = await bitmapIfPng(res, bytes);
    if (bmp && res.badSize) {
      const err = res.badSize(bmp);
      if (err) {
        ctx.setStatus(err);
        return;
      }
    }
    let name = file.split(/[\\/]/).pop()!;
    if (res.slug) name = name.toLowerCase().replace(/[^a-z0-9_.]/g, "_");
    const rel = `${res.dir}/${name}`;
    if (res.refuseDuplicate && res.list(data.project).includes(rel)) {
      ctx.setStatus(res.exists!(assetStem(rel)));
      return;
    }
    // The transparency picker owns the rest: the colour it returns decides
    // both the bytes written and what the register records.
    if (res.transPick && bmp && !src) {
      ctx.beginTransPick({ kind: res.transPick, file, bytes, bmp });
      return;
    }
    // A project that never used this resource has no folder for it yet.
    await ensureProjectDir(data.root, res.dir);
    await writeBinaryFile(`${data.root}/${rel}`, bytes);
    if (!res.list(data.project).includes(rel)) {
      ctx.mutate((d) => ({ ...d, project: res.add(d.project, rel, { trans: src?.trans }) }));
    }
    ctx.setStatus(res.imported(assetStem(rel), bmp, { trans: src?.trans }));
  } catch (e) {
    ctx.setStatus(res.importFailed(e));
  }
}

export async function runExport(ctx: ResCtx, res: Resource, rel: string): Promise<void> {
  const { data } = ctx;
  const path = await pickSavePath(res.pickExport, `${assetStem(rel)}.${res.ext}`);
  if (!path) return;
  try {
    await writeBinaryFile(path, await readBinaryFile(`${data.root}/${rel}`));
    ctx.setStatus(res.exported(path));
  } catch (e) {
    ctx.setStatus(res.exportFailed(e));
  }
}

export async function runRename(
  ctx: ResCtx,
  res: Resource,
  oldRel: string,
  newName: string
): Promise<void> {
  const { data } = ctx;
  const newStem = stemOf(newName);
  if (!newStem || newStem === assetStem(oldRel)) return;
  const newRel = `${res.dir}/${newStem}.${res.ext}`;
  if (res.list(data.project).includes(newRel)) {
    ctx.setStatus(res.renameTaken(newStem));
    return;
  }
  const keep = ctx.sceneName;
  try {
    // The file, the register and every reference move together, and the
    // project is saved before the reload so the disk stays coherent even
    // if the reload fails.
    const project = res.rename(data.project, oldRel, newRel);
    await renamePath(`${data.root}/${oldRel}`, `${data.root}/${newRel}`);
    if (res.kind === "font" && ctx.renameInLayout) {
      await ctx.renameInLayout(data.root, oldRel, newRel);
    }
    await saveProject({ ...data, project });
    await ctx.reload(data.root, keep);
    ctx.setStatus(res.renamed(assetStem(oldRel), newStem));
  } catch (e) {
    ctx.setStatus(`Renommage : ${e}`);
  }
}

export async function runDelete(ctx: ResCtx, res: Resource, rel: string): Promise<void> {
  const { data } = ctx;
  if (res.locked?.(data.project, rel)) return; // active theme / sheet / font ★
  try {
    // A font may still be claimed by a dialogue style or a widget — said
    // BEFORE the confirmation, so the author is not asked about something
    // that will be refused anyway.
    if (res.kind === "font" && ctx.layoutUsers) {
      const users = await ctx.layoutUsers(data.root, rel);
      if (users.length) {
        ctx.setStatus(
          `Fonte utilisée par : ${users.join(", ")} — changer d'abord dans Tools → UI.`
        );
        return;
      }
    }
    if (!confirm(res.confirmDelete(assetStem(rel)))) return;
    const keep = ctx.sceneName;
    await saveProject({ ...data, project: res.remove(data.project, rel) });
    try {
      await removePath(`${data.root}/${rel}`);
    } catch {
      /* already gone */
    }
    await ctx.reload(data.root, keep);
    ctx.setStatus(res.deleted(assetStem(rel)));
  } catch (e) {
    ctx.setStatus(`Suppression : ${e}`);
  }
}
