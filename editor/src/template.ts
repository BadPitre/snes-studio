// New-project template: starter assets embedded (a 6-tile tileset, a
// hero and a villager in 16x24, the textbox font, a slime battler —
// taken from or drawn for demo/) and the construction of the minimal
// project on disk.
//
// V4: the project is BORN FIGHTING — the combat event library
// (combatlib.ts) is copied in like a prefab, with the data it reads:
// a monsters table (one slime), an items table (the potion), a party
// of one, a troop of two, the battle menu widget, and a sample scene
// event that starts the duel. From the first build, the author can
// open combat_tour in Tools > Common events and READ his battle.

import { mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import type { ProjectData, Screen } from "./types";
import { newScene } from "./state";
import { saveProject, writeBinaryFile } from "./io";
import {
  COMBAT_COMMON_EVENTS,
  COMBAT_FUNCTIONS,
  COMBAT_SWITCHES,
  COMBAT_VARIABLES,
} from "./combatlib";
import { MENU_COMMON_EVENTS } from "./menulib";

const TILESET_PNG = "iVBORw0KGgoAAAANSUhEUgAAAGAAAAAQCAMAAADeZIrLAAADAFBMVEUAAAAYWCAwgDBgqEhAQEiAgIi4uMCQcEDIqHAYOJBIeNBgOBjIMDDoyEDw8PAQEBgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACsQy21AAABAUlEQVR4nJ2T2xKDIAxEidhiQeX//7aEe4JBx50RfNpDsolatAZYFsAD9aVaN6Yfk4ryQepa6I3GBfChegTwXgcJiIURBoBp5vhrLdpaW+7qD8AIRwVkaS1VYPInVJD9AyFZ7sn/OBjgUYvMCKj+mbDviQAkA3x+LGEKMFcV+OqfS8jO0FpUAn4Xsq/+FFBCTu661LEy9QFHQMs33ggAChimiNRQ5r8sQh+wFPLMXwp5LT16sAc+E7oxPTkgjagAMDeATOj9z7POq7BovAIzAwSEc6Q/0Oa1PT9eMG+R2egex01GOacGQDpZh6YZGLECDlAMcBPyzRSJgMspkvbgLeAP/eQbqr5ipc0AAAAASUVORK5CYII=";
const SPRITES_PNG = "iVBORw0KGgoAAAANSUhEUgAAAYAAAAAYCAYAAADzhSolAAABo0lEQVR4nO3cPU4CQRiA4cF4gInhAJzAGEoLY6ysKSyorC3MnmBjOMHGE1BRWFBbWlkS4wk4AMUewGRtNAI7M7JZ3W+/mfepwNkX+ZlkGP6MAQAAAAAAAAAAAAAAAAAAAAAAWgz2/2DtsAoFZbmpNfT09PT0+vqdM9YOq9uz41Bv5m8f3itBT6+9z7Is2BdFQU8fTX8UPBoAEK3a06WHPA8G80l4XLrXTvr+S73PLk6C40URHBbvtZO+/1Lr2QEAQKLcC8B4akbfz5S2Tx9Kutes7e2V7j1Gk9yY8VRHLz1/mf96e4++zn/3ArBamPVyVj99KOles7a3V7r3WC9nxqwWOnrp+cv819t79HX+hz8yoZD0a8ipv4cBWdpeg4Ys3gMAgETt7AC+Ph9aXT6eOw9+uX8NfhGBnj6G/vr9yTn+fHpDTx9Vzw4AABLFAgAAiaotAPbqzrvFCI3R09PT0+vq2QEAAH5YO6y2f1Vu/zx9f3vXsV32ruOb9r7L6KrX/PjT0zfpO9kBlOVm8NvPmP5n31YM11+y/6v/23QRaNsDsfsEn1RYZGPqL54AAAAASUVORK5CYII=";
const SLIME_PNG = "iVBORw0KGgoAAAANSUhEUgAAADAAAAAoCAYAAAC4h3lxAAABE0lEQVR4nO2YKRKDQBBFh1QOgUQiW+QAkRwhEhGRIyGROQIyB4hoiYzkFkRQLGEWlhmWJv0UxVQXv/l/mkUIhmEYhmGY/8UzLYYxlGsJGSJPUan1rCsIYygh8pdTNBkoVU2ctpDiEqUtprt/CUE6987RpSYtmBVSlMg7IDWwv+y3QORLg+VYDuz57tf0XdCOUR3dDZtETyGEEPegXX9kN2N9XdNlqMYE+QhNdqAPwLU5RnwtVqODvAPkG2giNHcCzYmAbWwqndW7kdUemDM9bCaOCvIROk4DeYoeZsWWWkbTfSsl74D1g6wPJh/jOjwCp9dz3oBrgUOQj9BPAxQ2cv+z8lgOUET7V2JtIWPR/eBituILSPpUrs1SgeEAAAAASUVORK5CYII=";
const FONT_PNG = "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";

function bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Creates a minimal project in `root` (an empty folder): a 30x20 scene
// with a water border, the starter tileset/characters/font. The project's
// name is the folder's name.
export async function scaffoldProject(root: string): Promise<void> {
  const name = root.split(/[\\/]/).pop() || "projet";
  await mkdir(`${root}/scenes`, { recursive: true });
  await mkdir(`${root}/assets/pictures`, { recursive: true });
  await mkdir(`${root}/schemas`, { recursive: true });
  await mkdir(`${root}/data`, { recursive: true });
  await mkdir(`${root}/ui`, { recursive: true });
  await writeBinaryFile(`${root}/assets/tileset.png`, bytes(TILESET_PNG));
  await writeBinaryFile(`${root}/assets/sprites.png`, bytes(SPRITES_PNG));
  await writeBinaryFile(`${root}/assets/font.png`, bytes(FONT_PNG));
  await writeBinaryFile(`${root}/assets/pictures/slime.png`, bytes(SLIME_PNG));

  // The combat starter's data: ordinary database tables, all of it read
  // by the library's own events (db_read) — each is the author's to
  // grow, from the same Database window as everything else.
  await writeTextFile(`${root}/schemas/_index.json`,
    JSON.stringify(["monsters", "items", "heroes"]));
  await writeTextFile(`${root}/schemas/monsters.toml`, MONSTERS_SCHEMA);
  await writeTextFile(`${root}/schemas/items.toml`, ITEMS_SCHEMA);
  await writeTextFile(`${root}/schemas/heroes.toml`, HEROES_SCHEMA);
  await writeTextFile(`${root}/data/monsters.toml`, MONSTERS_DATA);
  await writeTextFile(`${root}/data/items.toml`, ITEMS_DATA);
  await writeTextFile(`${root}/data/heroes.toml`, HEROES_DATA);
  await writeTextFile(`${root}/ui/layout.toml`, UI_LAYOUT);

  const data: ProjectData = {
    root,
    project: {
      name,
      boot_scene: "scene1",
      scenes: ["scene1"],
      assets: {
        tileset: "assets/tileset.png",
        sprites: "assets/sprites.png",
        font: "assets/font.png",
      },
      musics: [],
      tilesets: ["assets/tileset.png"],
      charsets: ["Héros", "Villageois"],
      pictures: [{ path: "assets/pictures/slime.png", trans: true }],
      common_events: [...COMBAT_COMMON_EVENTS, ...MENU_COMMON_EVENTS],
      functions: COMBAT_FUNCTIONS,
      variables: nameMenuVars(COMBAT_VARIABLES),
      switches: nameMenuSwitches(COMBAT_SWITCHES),
    },
    scenes: { scene1: starterScene() },
    texts: [],
    screens: { combat_slimes: STARTER_BATTLE_SCREEN },
    tilesetMeta: { tileset: { autotiles: [], solid: [1, 3, 4], above: [5] } },
  };
  await saveProject(data);
}

// Names for the menu library's variables and switches, layered over
// the combat library's.
function nameMenuVars(base: string[]): string[] {
  const v = [...base];
  v[70] = "Menu: touche Start";
  v[71] = "Menu: choix";
  v[72] = "Menu: slot choisi";
  v[73] = "Menu: slot occupe";
  return v;
}

function nameMenuSwitches(base: string[]): string[] {
  const s = [...base];
  s[20] = "Menu demande";
  s[22] = "Menu autorise";
  return s;
}

// The sample scene: a villager who starts the starter battle, and the
// post-battle AUTO page conditioned on the reserved switch 500 — the
// same RM2003 pattern the showcase uses.
function starterScene() {
  const sc = newScene("scene1", 30, 20);
  sc.events.push({
    name: "Duel",
    x: 6,
    y: 3,
    trigger: "action",
    sprite: 1,
    dir: "down",
    commands: [
      { c: "msg", text: "Des slimes ! (le combat est un ECRAN : Tools > Ecrans > combat_slimes)" },
      { c: "var", n: 17, op: "=", value: 3 },
      { c: "screen", name: "combat_slimes", dur: 30, trans: "mosaic" },
    ],
  });
  sc.events.push({
    name: "_init",
    x: 1,
    y: 2,
    trigger: "auto",
    sprite: -1,
    dir: "down",
    condition: { switch: 22, on: false },
    commands: [
      { c: "rem", text: "Arme le menu (Start) — la page se desactive une fois le switch pose" },
      { c: "switch", n: 22, on: true },
      { c: "rem", text: "L'equipe de depart : la fiche heroes de la 1re place." },
      { c: "db_entry", table: "heroes", entry: "heros", dst: 60 },
    ],
  });
  sc.events.push({
    name: "_apres_combat",
    x: 1,
    y: 1,
    trigger: "auto",
    sprite: -1,
    dir: "down",
    condition: { switch: 500, on: true },
    commands: [
      { c: "if_var", n: 248, op: "==", value: 1,
        then: [{ c: "msg", text: "Victoire ! \\v[249] XP et \\v[250] pieces d'or." }],
        else: [{ c: "if_var", n: 248, op: "==", value: 3,
          then: [{ c: "msg", text: "Vous prenez la fuite !" }],
          else: [{ c: "msg", text: "Defaite..." }] }] },
      { c: "switch", n: 500, on: false },
    ],
  });
  return sc;
}

const MONSTERS_SCHEMA = `# Table des monstres — le bestiaire, lu par la bibliotheque de combat
name  = "monsters"
title = "Monstres"
max   = 255

[[fields]]
name    = "max_hp"
type    = "u16"
default = 10

[[fields]]
name    = "attack"
type    = "u8"
default = 1

[[fields]]
name    = "defense"
type    = "u8"
default = 0

[[fields]]
name    = "xp"
type    = "u16"
default = 5

[[fields]]
name    = "gold"
type    = "u16"
default = 0

[[fields]]
name     = "battle_pic"
type     = "picture"
optional = true

[[fields]]
name    = "speed"
type    = "u8"
default = 40

[[fields]]
name    = "magic"
type    = "u8"
default = 0

[[fields]]
name    = "magic_def"
type    = "u8"
default = 0
`;

const ITEMS_SCHEMA = `# Table des objets — la Potion du menu de combat (db_read)
name  = "items"
title = "Objets"
max   = 255

[[fields]]
name    = "heal"
type    = "u8"
default = 0

[[fields]]
name    = "count_var"
type    = "u8"
default = 0
`;

const MONSTERS_DATA = `[[entry]]
id = "slime"
name = "Slime"
max_hp = 20
attack = 6
defense = 1
xp = 10
gold = 5
battle_pic = "slime"
speed = 40
magic = 0
magic_def = 0
`;

const ITEMS_DATA = `[[entry]]
id = "potion"
name = "Potion"
heal = 20
count_var = 17
`;

const HEROES_SCHEMA = `# Table des heros — une table de database ORDINAIRE, editee dans
# Tools > Database. Le champ \`charset\` est le seul que le generateur
# lit : il compose le combattant 32x32 depuis ce bloc de la planche de
# sprites (vue de gauche, au repos). Tout le reste est TA donnee, lue
# par TES events (« Lire la database »).
name  = "heroes"
title = "Heros"
max   = 8

[[fields]]
name = "charset"
type = "charset"

[[fields]]
name    = "max_hp"
type    = "u16"
default = 50

[[fields]]
name    = "max_mp"
type    = "u16"
default = 10

[[fields]]
name    = "speed"
type    = "u8"
default = 60

[[fields]]
name    = "attack"
type    = "u8"
default = 8

[[fields]]
name    = "defense"
type    = "u8"
default = 2

[[fields]]
name    = "magic"
type    = "u8"
default = 5

[[fields]]
name    = "magic_def"
type    = "u8"
default = 2
`;

const HEROES_DATA = `[[entry]]
id = "heros"
name = "Heros"
charset = "Héros"
max_hp = 50
max_mp = 10
speed = 60
attack = 8
defense = 2
magic = 5
magic_def = 2
`;

// The starter battle: a COMPOSED SCREEN (Tools > Écrans). Its slots
// place the monsters visually, its script names their database entries
// for the library, then hands the fight to combat_tour. No backdrop yet
// — a new project fights on black until it owns a picture.
const STARTER_BATTLE_SCREEN: Screen = {
  backdrop: "",
  slots: [
    { slot: 1, pic: "slime", x: 40, y: 40, name: "slime_g" },
    { slot: 2, pic: "slime", x: 80, y: 64, name: "slime_d" },
  ],
  scripts: [
    {
      name: "principal",
      trigger: "auto",
      commands: [
        { c: "rem", text: "Les monstres de l'ecran, nommes pour la bibliotheque (var 252+)." },
        { c: "db_entry", table: "monsters", entry: "slime", dst: 252 },
        { c: "db_entry", table: "monsters", entry: "slime", dst: 253 },
        { c: "rem", text: "...puis la bibliotheque prend le combat (combat_tour)." },
        { c: "call", n: 0 },
      ],
    },
  ],
};

const UI_LAYOUT = `# Layout UI du projet — le menu de combat et la fenetre de PV que la
# bibliotheque (combat_tour) affiche, et le menu de jeu (Start) de la
# bibliotheque menu. Positions en tiles (ecran 32x28).

[[node]]
id = "menu_combat"
type = "list"
pos = [1, 14]
items = ["Attaque", "Objets", "Fuir"]

[[node]]
id = "combat_pv1"
type = "variable_display"
pos = [21, 16]
size = [9, 3]
var = 240
label = "PV"

# Menu des objets — ses lignes SONT la table \`items\` : ajouter un objet
# dans la Database l'ajoute au menu. \`source_filter\` cache la ligne tant
# que la variable de comptage vaut 0, \`source_count\` affiche la quantite.
# Un seul widget, deux appelants : le menu de jeu et le menu de combat.
[[node]]
id = "menu_objets"
type = "list"
pos = [2, 8]
size = [14, 6]
source = "items"
source_filter = "count_var"
source_count = "count_var"

[[node]]
id = "menu_principal"
type = "list"
pos = [2, 2]
items = ["Objets", "Sauvegarder", "Charger", "Fermer"]

[[node]]
id = "menu_slots"
type = "list"
pos = [16, 2]
items = ["Partie 1", "Partie 2", "Partie 3"]
`;
