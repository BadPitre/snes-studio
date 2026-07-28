// Système de Database (Phase 10) — lecture des schémas et lecture/écriture
// des instances TOML. Réf contractuelle : docs/PLANNING_SYSTEME_DATABASE.md
// et docs/INTEGRATION_DATABASE_EDITEUR.md.
//
// RÈGLE : le schéma est l'unique source de vérité — aucun type, aucune
// borne, aucun nom de champ en dur ici. Ce module ne connaît que les
// TYPES du système (u8/u16/s8/s16/flags8/ref:/text_id), jamais les tables.

import { parse } from "smol-toml";
import { readDir } from "@tauri-apps/plugin-fs";
import { ensureProjectDir, readProjectText, removePath, writeProjectText } from "./io";

export interface DbField {
  name: string;
  type: string;
  flags?: string[];
  optional?: boolean;
  runtime_copy?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
}

export interface DbSchema {
  name: string;
  title?: string;
  max?: number;
  fields: DbField[];
}

// une instance : id symbolique + libellé + valeurs de champs
export type DbEntry = { id: string; name?: string } & Record<string, unknown>;

export interface Database {
  schemas: DbSchema[];
  entries: Record<string, DbEntry[]>; // par nom de table
}

const hasTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Taille ROM d'un champ (octets) — miroir de dbgen (db.rs)
export function fieldSize(ty: string): number {
  if (ty === "u16" || ty === "s16" || ty === "text_id") return 2;
  return 1; // u8, s8, flags8, ref: — les types inconnus comptent 1 (info)
}

export function entrySize(sc: DbSchema): number {
  return sc.fields.reduce((n, f) => n + fieldSize(f.type), 0);
}

// Bornes d'un champ numérique : bornes du type ∩ min/max du schéma
export function fieldBounds(f: DbField): [number, number] | null {
  const t: Record<string, [number, number]> = {
    u8: [0, 255],
    u16: [0, 65535],
    s8: [-128, 127],
    s16: [-32768, 32767],
  };
  const b = t[f.type];
  if (!b) return null;
  return [Math.max(b[0], f.min ?? b[0]), Math.min(b[1], f.max ?? b[1])];
}

export function isSnake(s: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(s);
}

// Charge schémas + instances. null = le projet n'a pas de database.
// Énumération : readDir en Tauri (le dossier fait foi) ; en mode
// navigateur, le manifeste schemas/_index.json (maintenu par l'éditeur à
// la sauvegarde, ignoré par dbgen).
export async function loadDatabase(root: string): Promise<Database | null> {
  let names: string[];
  if (hasTauri) {
    try {
      const dir = await readDir(`${root}/schemas`);
      names = dir
        .filter((e) => e.name?.endsWith(".toml"))
        .map((e) => e.name!.replace(/\.toml$/, ""))
        .sort();
    } catch {
      return null; // pas de dossier schemas/ = pas de database
    }
  } else {
    try {
      names = JSON.parse(await readProjectText(root, "schemas/_index.json"));
    } catch {
      return null;
    }
  }
  if (names.length === 0) return null;

  const schemas: DbSchema[] = [];
  const entries: Record<string, DbEntry[]> = {};
  for (const n of names) {
    const raw = parse(await readProjectText(root, `schemas/${n}.toml`)) as unknown as DbSchema;
    const sc: DbSchema = {
      name: raw.name ?? n,
      title: raw.title,
      max: raw.max,
      fields: (raw.fields ?? []).map((f) => ({ ...f })),
    };
    schemas.push(sc);
    let list: DbEntry[] = [];
    try {
      const df = parse(await readProjectText(root, `data/${sc.name}.toml`)) as {
        entry?: DbEntry[];
      };
      list = (df.entry ?? []).map((e) => ({ ...e }));
    } catch {
      // pas de fichier data = table vide
    }
    entries[sc.name] = list;
  }
  return { schemas, entries };
}

// ---- écriture ---------------------------------------------------------

function tomlScalar(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return `[${v.map(tomlScalar).join(", ")}]`;
  return JSON.stringify(String(v)); // les chaînes TOML basiques = JSON
}

// data/<table>.toml — clés dans l'ORDRE DU SCHÉMA, une entrée par bloc :
// diffs Git stables (règle 2 du planning)
export function dataToToml(sc: DbSchema, list: DbEntry[]): string {
  let s = `# GENERE par l'editeur SNES Studio — table « ${sc.name} »\n# (editable a la main : dbgen relit ce fichier tel quel)\n`;
  for (const e of list) {
    s += `\n[[entry]]\nid = ${tomlScalar(e.id)}\n`;
    if (e.name !== undefined && e.name !== "") s += `name = ${tomlScalar(e.name)}\n`;
    for (const f of sc.fields) {
      const v = e[f.name];
      if (v === undefined || v === null || v === "") continue; // défaut/absent
      s += `${f.name} = ${tomlScalar(v)}\n`;
    }
  }
  return s;
}

// schemas/<table>.toml — clés dans un ordre FIXE (diffs Git stables) ;
// relu tel quel par dbgen : l'éditeur et la main écrivent le même format
export function schemaToToml(sc: DbSchema): string {
  let s = `# Schema de la table « ${sc.name} » — docs/PLANNING_SYSTEME_DATABASE.md\nname  = ${tomlScalar(sc.name)}\n`;
  if (sc.title) s += `title = ${tomlScalar(sc.title)}\n`;
  if (sc.max !== undefined && sc.max !== 255) s += `max   = ${sc.max}\n`;
  for (const f of sc.fields) {
    s += `\n[[fields]]\nname = ${tomlScalar(f.name)}\ntype = ${tomlScalar(f.type)}\n`;
    if (f.type === "flags8") s += `flags = ${tomlScalar(f.flags ?? [])}\n`;
    if (f.optional) s += `optional = true\n`;
    if (f.runtime_copy) s += `runtime_copy = true\n`;
    if (f.default !== undefined) s += `default = ${tomlScalar(f.default)}\n`;
    if (f.min !== undefined) s += `min = ${f.min}\n`;
    if (f.max !== undefined) s += `max = ${f.max}\n`;
  }
  return s;
}

// Sauvegarde complète : schémas + instances + manifeste ; les fichiers
// des tables supprimées dans l'éditeur sont retirés du disque.
export async function saveDatabase(
  root: string,
  db: Database,
  removedTables: string[] = []
): Promise<void> {
  await ensureProjectDir(root, "schemas"); // première table d'un projet
  await ensureProjectDir(root, "data");
  for (const n of removedTables) {
    if (db.schemas.some((s) => s.name === n)) continue; // recréée depuis
    await removePath(`${root}/schemas/${n}.toml`);
    await removePath(`${root}/data/${n}.toml`);
  }
  for (const sc of db.schemas) {
    await writeProjectText(root, `schemas/${sc.name}.toml`, schemaToToml(sc));
    await writeProjectText(root, `data/${sc.name}.toml`, dataToToml(sc, db.entries[sc.name] ?? []));
  }
  // manifeste du mode navigateur (le dossier schemas/ fait foi en Tauri)
  await writeProjectText(
    root,
    "schemas/_index.json",
    JSON.stringify(db.schemas.map((s) => s.name)) + "\n"
  );
}

// ---- refs -------------------------------------------------------------

// usages d'une entrée : [table, id d'entrée, champ] pour chaque ref qui la vise
export function refUsages(
  db: Database,
  table: string,
  id: string
): { table: string; entry: string; field: string }[] {
  const out: { table: string; entry: string; field: string }[] = [];
  for (const sc of db.schemas) {
    for (const f of sc.fields) {
      if (f.type !== `ref:${table}`) continue;
      for (const e of db.entries[sc.name] ?? []) {
        if (e[f.name] === id) out.push({ table: sc.name, entry: e.id, field: f.name });
      }
    }
  }
  return out;
}

// renomme une entrée et met à jour TOUTES les refs (refactoring auto)
export function renameEntry(db: Database, table: string, oldId: string, newId: string) {
  for (const sc of db.schemas) {
    for (const f of sc.fields) {
      if (f.type !== `ref:${table}`) continue;
      for (const e of db.entries[sc.name] ?? []) {
        if (e[f.name] === oldId) e[f.name] = newId;
      }
    }
  }
}
