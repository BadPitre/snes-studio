// Database system (Phase 10) — reading the schemas and reading/writing
// the TOML instances. Contract: docs/PLANNING_SYSTEME_DATABASE.md and
// docs/INTEGRATION_DATABASE_EDITEUR.md.
//
// RULE: the schema is the single source of truth — no type, no bound and
// no field name hard-coded here. This module only knows the system's
// TYPES (u8/u16/s8/s16/flags8/ref:/text_id), never the tables.

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

// one instance: symbolic id + label + field values
export type DbEntry = { id: string; name?: string } & Record<string, unknown>;

export interface Database {
  schemas: DbSchema[];
  entries: Record<string, DbEntry[]>; // by table name
}

const hasTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ROM size of a field (bytes) — mirrors dbgen (db.rs)
export function fieldSize(ty: string): number {
  if (ty === "u16" || ty === "s16" || ty === "text_id") return 2;
  return 1; // u8, s8, flags8, ref: — unknown types count as 1 (informational)
}

export function entrySize(sc: DbSchema): number {
  return sc.fields.reduce((n, f) => n + fieldSize(f.type), 0);
}

// Bounds of a numeric field: the type's bounds ∩ the schema's min/max
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

// Loads schemas + instances. null = the project has no database.
// Enumeration: readDir under Tauri (the folder is authoritative); in
// browser mode, the schemas/_index.json manifest (kept up to date by the
// editor on save, ignored by dbgen).
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
      return null; // no schemas/ folder = no database
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
      // no data file = an empty table
    }
    entries[sc.name] = list;
  }
  return { schemas, entries };
}

// ---- writing ----------------------------------------------------------

function tomlScalar(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return `[${v.map(tomlScalar).join(", ")}]`;
  return JSON.stringify(String(v)); // basic TOML strings = JSON
}

// data/<table>.toml — keys in SCHEMA ORDER, one entry per block: stable
// Git diffs (rule 2 of the planning)
export function dataToToml(sc: DbSchema, list: DbEntry[]): string {
  let s = `# GENERE par l'editeur SNES Studio — table « ${sc.name} »\n# (editable a la main : dbgen relit ce fichier tel quel)\n`;
  for (const e of list) {
    s += `\n[[entry]]\nid = ${tomlScalar(e.id)}\n`;
    if (e.name !== undefined && e.name !== "") s += `name = ${tomlScalar(e.name)}\n`;
    for (const f of sc.fields) {
      const v = e[f.name];
      if (v === undefined || v === null || v === "") continue; // default/absent
      s += `${f.name} = ${tomlScalar(v)}\n`;
    }
  }
  return s;
}

// schemas/<table>.toml — keys in a FIXED order (stable Git diffs); read
// back as is by dbgen: the editor and a human write the same format
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

// Full save: schemas + instances + manifest; the files of tables deleted
// in the editor are removed from disk.
export async function saveDatabase(
  root: string,
  db: Database,
  removedTables: string[] = []
): Promise<void> {
  await ensureProjectDir(root, "schemas"); // first table of a project
  await ensureProjectDir(root, "data");
  for (const n of removedTables) {
    if (db.schemas.some((s) => s.name === n)) continue; // recreated from
    await removePath(`${root}/schemas/${n}.toml`);
    await removePath(`${root}/data/${n}.toml`);
  }
  for (const sc of db.schemas) {
    await writeProjectText(root, `schemas/${sc.name}.toml`, schemaToToml(sc));
    await writeProjectText(root, `data/${sc.name}.toml`, dataToToml(sc, db.entries[sc.name] ?? []));
  }
  // browser-mode manifest (the schemas/ folder is authoritative under Tauri)
  await writeProjectText(
    root,
    "schemas/_index.json",
    JSON.stringify(db.schemas.map((s) => s.name)) + "\n"
  );
}

// ---- refs -------------------------------------------------------------

// uses of an entry: [table, entry id, field] for every ref that targets it
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

// renames an entry and updates ALL the refs (automatic refactoring)
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
