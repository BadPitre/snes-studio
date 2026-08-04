// Battle data (C5) — reading and writing the three FIXED-format files
// of the combat system: data/heroes.toml (the party), data/troops.toml
// (the monster groups), data/skills.toml (read-only here: the skills
// window is not this milestone's). datagen's battle module reads these
// files as they are — the editor and a human write the same format.

import { parse } from "smol-toml";
import { readProjectText, writeProjectText } from "./io";

export interface TroopMon {
  id: string; // monsters table entry
  x: number; // screen TILES (32x28)
  y: number;
}

export interface Troop {
  id: string;
  backdrop: string; // project picture stem
  monsters: TroopMon[];
  intro?: string; // hook: a common event name (C4)
  low_hp?: string;
}

export interface BattleHero {
  id: string;
  name: string;
  charset: string; // project charset name
  max_hp: number;
  max_mp: number;
  speed: number;
  attack: number;
  defense: number;
  magic: number;
  magic_def: number;
}

export interface HeroesFile {
  menu: string; // cursor-list widget of the UI layout ("" = none)
  actions: string[]; // menu semantics: attack / skill:<id> / flee / other
  heroes: BattleHero[];
}

export interface SkillDef {
  id: string;
  name: string;
}

const num = (v: unknown, d: number) => (typeof v === "number" ? v : d);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

export async function loadTroops(root: string): Promise<Troop[] | null> {
  let raw: string;
  try {
    raw = await readProjectText(root, "data/troops.toml");
  } catch {
    return null; // no battle data in this project
  }
  const t = parse(raw) as { troop?: Record<string, unknown>[] };
  return (t.troop ?? []).map((tr) => ({
    id: str(tr.id, "?"),
    backdrop: str(tr.backdrop),
    intro: str(tr.intro) || undefined,
    low_hp: str(tr.low_hp) || undefined,
    monsters: ((tr.monsters as Record<string, unknown>[]) ?? []).map((m) => ({
      id: str(m.id, "?"),
      x: num(m.x, 0),
      y: num(m.y, 0),
    })),
  }));
}

export async function loadHeroes(root: string): Promise<HeroesFile | null> {
  let raw: string;
  try {
    raw = await readProjectText(root, "data/heroes.toml");
  } catch {
    return null;
  }
  const h = parse(raw) as {
    menu?: string;
    actions?: string[];
    hero?: Record<string, unknown>[];
  };
  return {
    menu: str(h.menu),
    actions: (h.actions ?? []).map((a) => String(a)),
    heroes: (h.hero ?? []).map((e) => ({
      id: str(e.id, "?"),
      name: str(e.name),
      charset: str(e.charset),
      max_hp: num(e.max_hp, 1),
      max_mp: num(e.max_mp, 0),
      speed: num(e.speed, 50),
      attack: num(e.attack, 5),
      defense: num(e.defense, 0),
      magic: num(e.magic, 5),
      magic_def: num(e.magic_def, 0),
    })),
  };
}

export async function loadSkillDefs(root: string): Promise<SkillDef[]> {
  let raw: string;
  try {
    raw = await readProjectText(root, "data/skills.toml");
  } catch {
    return [];
  }
  const s = parse(raw) as { skill?: Record<string, unknown>[] };
  return (s.skill ?? []).map((sk) => ({
    id: str(sk.id, "?"),
    name: str(sk.name, str(sk.id, "?")),
  }));
}

const tstr = (s: string) => JSON.stringify(s); // basic TOML strings = JSON

export async function saveTroops(root: string, troops: Troop[]): Promise<void> {
  let s =
    "# Groupes de monstres — edite par Tools > Combat > Groupes de monstres.\n" +
    "# Les stats et le battler de chaque monstre viennent de la table\n" +
    "# `monsters` de la database ; le groupe ARRANGE. x, y en tiles (32x28).\n" +
    "# intro / low_hp : hooks — des common events joues par le moteur (C4).\n";
  for (const t of troops) {
    s += `\n[[troop]]\nid = ${tstr(t.id)}\nbackdrop = ${tstr(t.backdrop)}\n`;
    if (t.intro) s += `intro = ${tstr(t.intro)}\n`;
    if (t.low_hp) s += `low_hp = ${tstr(t.low_hp)}\n`;
    s += "monsters = [\n";
    for (const m of t.monsters)
      s += `  { id = ${tstr(m.id)}, x = ${m.x}, y = ${m.y} },\n`;
    s += "]\n";
  }
  await writeProjectText(root, "data/troops.toml", s);
}

export async function saveHeroes(root: string, h: HeroesFile): Promise<void> {
  let s =
    "# L'equipe — editee par Tools > Combat > Equipe.\n" +
    "# L'ordre est l'ordre d'affichage a droite de l'ecran de combat.\n" +
    "# `menu` : le widget liste a curseur du layout servant de menu de combat.\n" +
    "# `actions` : le SENS de chaque entree du menu (attack, skill:<id>, flee).\n";
  if (h.menu) s += `menu = ${tstr(h.menu)}\n`;
  if (h.actions.length)
    s += `actions = [${h.actions.map(tstr).join(", ")}]\n`;
  for (const e of h.heroes) {
    s += `\n[[hero]]\nid = ${tstr(e.id)}\nname = ${tstr(e.name)}\ncharset = ${tstr(e.charset)}\n`;
    s += `max_hp = ${e.max_hp}\nmax_mp = ${e.max_mp}\nspeed = ${e.speed}\n`;
    s += `attack = ${e.attack}\ndefense = ${e.defense}\nmagic = ${e.magic}\n`;
    s += `magic_def = ${e.magic_def}\n`;
  }
  await writeProjectText(root, "data/heroes.toml", s);
}
