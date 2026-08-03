// Event Editor, RPG Maker 2003 style: name + pages (P4), conditions (P4),
// appearance (charset + direction + preview), trigger, movement (P4), and
// the "Contenu" command list (@>) with nested branches (choices,
// conditions). The commands are compiled by datagen down to the VM.

import { useEffect, useRef, useState } from "react";
import type { TextEntry, Command, EventPage, EventPriority, GameEvent, MoveType, Scene, ScreenTrans, VarSource, TintPreset, FnSig, ValueSrc } from "../types";
import { M7_VIEW_LABELS, TRANS_OPTIONS, eventFrame } from "../types";
import EventCommandPicker from "./EventCommandPicker";
import VarListModal, { type VarKind } from "./VarListModal";
import MoveRouteModal from "./MoveRouteModal";
import GraphicPickerModal from "./GraphicPickerModal";
import type { Database } from "../db";
import {
  formAnimPlay,
  formAnimStop,
  formBgm,
  formBreak,
  formCall,
  formCallFn,
  formCamReturn,
  formCampan,
  formChoice,
  formDbRead,
  formFace,
  formFlash,
  formHeroLocWarpVar,
  formIf,
  formIfSw,
  formIfVar,
  formKeyInput,
  formListSelect,
  formLoop,
  formMsg,
  formPicHide,
  formPicMove,
  formPicShow,
  formRem,
  formRetFn,
  formRoute,
  formScrHideScrShow,
  formScreen,
  formScreenCall,
  formSetAdd,
  formSetpos,
  formSfx,
  formShake,
  formSkygrad,
  formSlotFx,
  formSpotlight,
  formStageClear,
  formStageClose,
  formM7,
  formM7View,
  formM7Rot,
  formM7Turn,
  formStageOpen,
  formStagePose,
  formSwappos,
  formSwitch,
  formSysmenu,
  formTimer,
  formTint,
  formUiShow,
  formVar,
  formVigHide,
  formVigPlay,
  formVigShow,
  formWait,
  formWaitCam,
  formWaitRoute,
  formWarp,
  formWave,
  formWeather,
} from "./CommandForms";

// Screen transition selector (S18) — warps and composed screens.
// "fade" (the default) is not written to the JSON (the field is absent).
export function TransSelect(props: {
  value?: ScreenTrans;
  onChange: (t?: ScreenTrans) => void;
}) {
  return (
    <label
      title="Effet de fermeture/ouverture de l'écran (S18) : fondu au noir, coupe instantanée, ou mosaïque (pixelisation, façon Zelda 3)"
    >
      Transition
      <select
        value={props.value ?? "fade"}
        onChange={(e) =>
          props.onChange(
            e.target.value === "fade" ? undefined : (e.target.value as ScreenTrans)
          )
        }
      >
        {TRANS_OPTIONS.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    </label>
  );
}

interface Props {
  event: GameEvent;
  sceneNames: string[];
  scenes: Record<string, Scene>;
  blockCount: number;
  // T4 — tile appearance: the scene's chipset + upper-layer ids
  tilesetBmp?: ImageBitmap | null;
  upperCells?: number[];
  blockNames: string[];
  // charsets already shown by the scene (hero + OTHER events): used to
  // warn as soon as an appearance would exceed the 5 charsets per scene
  usedBlocks: number[];
  sprites: ImageBitmap | null;
  labels: string[]; // labels of the manual script (advanced field)
  switchNames: string[]; // switch names (project.json)
  varNames: string[]; // names of the 16-bit variables
  // labels of the scene's actor ENTRIES (one per event page) — the
  // targets of "Déplacer un event" and "Tourner un event"
  entryNames: string[];
  charsetNames: string[]; // block names (not the routes' gfx)
  commonNames: string[]; // common event names (v0.16)
  fnSigs?: FnSig[]; // F1 — the project's functions (Tools > Fonctions)
  // F1 — parameters of the FUNCTION whose body is being edited. Absent
  // elsewhere: this is what decides whether "Paramètre" is an offered
  // source, and under which names.
  fnParams?: string[];
  fnLocals?: string[]; // F2b — locals of the function being edited
  // F1-c — a function body: a command list restricted to logic and
  // computation (a function computes, it does not stage anything)
  inFunction?: boolean;
  db: Database | null; // the project's database (db_read command, v0.17)
  uiWidgets: string[]; // layout roots (ui_show command, Ph. 12)
  uiStyles: string[]; // dialogue styles (S1) — msg/choice style field
  texts: TextEntry[]; // Tools > Textes catalogue (msg by reference, T2)
  pictures: string[]; // picture stems (S3) — pic_show command
  mode7Images: string[]; // Mode 7 image stems (M7) — "Zoom cinématique"
  tintPresets: TintPreset[]; // the project's tint presets (S12b)
  soundNames: string[]; // the project's sound stems (B1)
  musicNames: string[]; // the project's music stems (B1)
  vigNames: string[]; // vignette stems (B5)
  animNames: string[]; // names of the frame-by-frame animations (A1)
  screenNames: string[]; // composed screens (B6bis)
  screenScriptNames?: string[]; // scripts of the current screen (B6bis-2)
  onTintPresets: (list: TintPreset[]) => void; // replaces the list (create/delete)
  onRenameVars: (switches: string[], variables: string[]) => void;
  onSave: (ev: GameEvent) => void;
  onClose: () => void;
}

// One displayed row of the Contenu list. path = the command's address in
// the tree ("2", "2.o0.1", "3.t.0", "3.e.1"); the "end of list" rows
// (append) carry the index length.
interface Line {
  path: string;
  depth: number;
  label: string;
  branch?: boolean; // branch row ( : Quand [Oui] ) — not editable
  comment?: boolean; // "Commentaire" command — RM2003 green style
}

// transition suffix of the picture commands (S7): dur 0 / fade false =
// instant, 16 = the default (nothing to say), otherwise the duration
function picDurLabel(dur?: number, fade?: boolean): string {
  const d = fade === false && dur === undefined ? 0 : dur ?? 16;
  if (d === 0) return " (instantané)";
  return d === 16 ? "" : ` (fondu ${d}f)`;
}

// F1 — short label of an input value, for the row summaries.
function srcLabel(v: { from?: VarSource; value: number }): string {
  switch (v.from) {
    case "var": return `variable [${v.value}]`;
    case "hero_x": return "X du héros";
    case "hero_y": return "Y du héros";
    case "timer": return "timer";
    case "scene": return "n° de scène";
    case "param": return `paramètre ${v.value + 1}`;
    case "ret": return "résultat précédent";
    default: return String(v.value);
  }
}

function labelOf(c: Command, ceNames?: string[], fnNames?: string[]): string {
  switch (c.c) {
    case "msg":
      return `Message${c.style ? ` [${c.style}]` : ""} : ${
        c.text_ref !== undefined ? `«${c.text_ref}» (catalogue)` : c.text
      }`;
    case "choice":
      return `Afficher un choix…${c.style ? ` [${c.style}]` : ""}`;
    case "set":
      return `Variable ${c.var} = ${c.value}`;
    case "add":
      return `Variable ${c.var} += ${c.value}`;
    case "if":
      return `Condition : si ${c.var} ${c.op} ${c.value}`;
    case "warp":
      return `Téléporter le héros : ${c.to} (${c.x},${c.y})`;
    case "face":
      return `Tourner l'event ${c.event} vers ${c.dir}`;
    case "switch":
      return `Switch [${c.n}] ${c.on ? "ON" : "OFF"}`;
    case "var": {
      const src = srcLabel(c);
      const dst =
        c.dst === "local" ? `Locale ${c.n + 1}` : `Variable [${c.n}]`;
      return c.op === "rand"
        ? `${dst} = hasard 0..${src}`
        : `${dst} ${c.op}= ${src}`;
    }
    case "if_sw":
      return `Condition : si switch [${c.n}] est ${c.on ? "ON" : "OFF"}`;
    case "if_var":
      return `Condition : si ${srcLabel(c.left ?? { from: "var", value: c.n })} ${
        c.op} ${srcLabel(c.right ?? { value: c.value })}`;
    case "route":
      return `Déplacer ${c.event < 0 ? "cet event" : `l'event ${c.event}`} : ${c.steps.length} pas${c.repeat ? " (répété)" : ""}`;
    case "wait_route":
      return "Attendre la fin des déplacements";
    case "wait":
      return `Attendre ${c.frames} frames`;
    case "timer":
      return c.op === "start" ? `Timer : démarrer (${c.secs ?? 0} s)`
        : c.op === "stop" ? "Timer : arrêter"
        : c.op === "show" ? "Timer : afficher" : "Timer : cacher";
    case "campan":
      return `Caméra : pan vers (${c.x},${c.y}) vitesse ${c.speed}`;
    case "cam_return":
      return `Caméra : retour au héros (vitesse ${c.speed})`;
    case "wait_cam":
      return "Attendre la caméra";
    case "loop":
      return "Boucle";
    case "break":
      return "Sortir de la boucle";
    case "rem":
      return `Commentaire : ${c.text}`;
    case "hero_loc":
      return `Mémoriser la position du héros → variables [${c.vs}],[${c.vx}],[${c.vy}]`;
    case "warp_var":
      return `Téléporter le héros aux variables [${c.vs}],[${c.vx}],[${c.vy}]`;
    case "setpos":
      return `Placer ${c.event < 0 ? "cet event" : `l'event ${c.event}`} : ${
        c.from === "vars" ? `variables [${c.x}],[${c.y}]` : `(${c.x},${c.y})`}`;
    case "swappos":
      return `Échanger ${c.a < 0 ? "cet event" : `l'event ${c.a}`} ↔ ${
        c.b < 0 ? "cet event" : `l'event ${c.b}`}`;
    case "ui_show":
      return `${c.on ? "Afficher" : "Cacher"} le widget UI « ${c.widget || "?"} »`;
    case "list_select":
      return `Choix dans la liste « ${c.widget || "?"} » → [${c.var}]${
        c.cancel ? "" : " (B désactivé)"}${c.keep ? " +affiché" : ""}${
        c.lr ? " +G/D" : ""}`;
    case "key_input":
      return `Touche pressée → [${c.var}]${c.wait ? " (attendre)" : ""}`;
    case "sysmenu":
      return "Ouvrir le menu Système (sauvegarde)";
    case "pic_show":
      return `Afficher l'image ${
        c.pic_var !== undefined ? `n°[${c.pic_var}]` : `« ${c.pic || "?"} »`
      }${
        c.x_var !== undefined
          ? ` en ([${c.x_var}],[${c.y_var}])`
          : c.x !== undefined || c.y !== undefined
            ? ` en (${c.x ?? 0},${c.y ?? 0})`
            : ""
      }${
        c.blend === "half"
          ? " ◐ semi-transp."
          : c.blend === "add"
            ? " ◐ additif"
            : c.blend === "sub"
              ? " ◐ soustractif"
              : ""
      }${picDurLabel(c.dur, c.fade)}`;
    case "pic_move":
      return `Déplacer l'image vers ${
        c.x_var !== undefined
          ? `([${c.x_var}],[${c.y_var}])`
          : c.x !== undefined || c.y !== undefined
            ? `(${c.x ?? 0},${c.y ?? 0})`
            : "le centre"
      } en ${c.dur ?? 16} frames`;
    case "pic_hide":
      return `Effacer l'image${picDurLabel(c.dur, c.fade)}`;
    case "scr_hide":
      return `Cacher l'écran (${c.frames ?? Math.ceil(15 / (c.speed || 15))}f)`;
    case "scr_show":
      return `Montrer l'écran (${c.frames ?? Math.ceil(15 / (c.speed || 15))}f)`;
    case "tint":
      return (
        (c.mode === "off"
          ? "Teinte : normale"
          : `Teinte : ${c.mode === "add" ? "éclaircir" : "assombrir"} (${c.r},${c.g},${c.b})`) +
        (c.dur ? ` en ${c.dur}f` : "")
      );
    case "screen":
      return `Aller à l'écran « ${c.name} »`;
    case "screen_call":
      return `Appeler le script d'écran « ${c.script} »`;
    case "stage_open":
      return c.pic === ""
        ? "Écran composé : ouvrir (fond noir)"
        : `Écran composé : ouvrir (fond « ${c.pic} »)`;
    case "stage_pose":
      return `Poser « ${c.pic} » (slot ${c.slot}) en ${c.x},${c.y}`;
    case "stage_clear":
      return `Retirer l'image du slot ${c.slot}`;
    case "vig_show":
      return `Vignette « ${c.vig} » (slot ${c.slot}${c.anchor === "hero" ? ", sur le héros" : ""})`;
    case "vig_play":
      return c.mode === "stop"
        ? `Vignette ${c.slot} : figer`
        : `Vignette ${c.slot} : ${c.mode === "once" ? "jouer une fois" : "boucler"} (${c.speed ?? 8}f/img)`;
    case "vig_hide":
      return `Cacher la vignette ${c.slot}`;
    case "anim_play": {
      const ou =
        c.anchor === "hero"
          ? "sur le héros"
          : c.anchor === "event"
            ? (c.event ?? -1) < 0
              ? "sur cet event"
              : `sur l'event ${c.event}`
            : "à l'écran";
      return `Animation « ${c.anim} » ${ou}${c.wait ? " (attendre la fin)" : ""}`;
    }
    case "anim_stop":
      return "Arrêter les animations";
    case "slot_fx":
      return c.fx === "restore"
        ? `Slot ${c.slot} : restaurer les couleurs`
        : c.fx === "flash"
          ? `Slot ${c.slot} : flash blanc (${c.frames ?? 6}f)`
          : c.fx === "fadeout"
            ? `Slot ${c.slot} : fondu au noir (${c.frames ?? 30}f)`
            : `Slot ${c.slot} : assombrir`;
    case "m7":
      return `Zoom cinematique : ${c.image || "(image ?)"} — ${c.from}% a ${
        c.to
      }% en ${c.frames} frames`;
    case "m7_rot":
      return `Orienter la vue Mode 7 : cran ${c.step}`;
    case "m7_turn":
      return `Tourner la vue Mode 7 vers le cran ${c.step} en ${c.frames}f${
        c.wait ? " (attendre)" : ""
      }`;
    case "m7_view":
      return `Angle de camera Mode 7 : ${M7_VIEW_LABELS[c.preset].split(" —")[0]}${
        c.preset === "custom" ? ` (${c.horizon ?? 56}/${c.anchor ?? 176})` : ""
      }`;
    case "stage_close":
      return "Écran composé : fermer";
    case "sfx":
      return `Jouer le son « ${c.sound} »`;
    case "bgm":
      return c.music === ""
        ? "Musique : silence"
        : `Musique : « ${c.music} »`;
    case "wave":
      return c.power === 0
        ? "Ondulation : stop"
        : `Ondulation de l'écran (amplitude ${c.power}, vitesse ${c.speed ?? 2})`;
    case "skygrad":
      return c.mode === "off"
        ? "Dégradé : retirer"
        : `Dégradé de ciel : ${c.mode === "add" ? "éclaircir" : "assombrir"} haut (${c.r},${c.g},${c.b}) → bas (${c.r2},${c.g2},${c.b2})`;
    case "spotlight":
      return c.radius === 0
        ? "Spotlight : arrêter"
        : `Spotlight sur le héros (rayon ${c.radius} px, obscurité ${c.dark ?? 31})`;
    case "weather":
      return c.kind === "off"
        ? "Météo : aucune"
        : `Météo : ${c.kind === "rain" ? "pluie" : "neige"} (intensité ${c.power ?? 2})`;
    case "flash":
      return `Flash d'écran (${c.r},${c.g},${c.b}) ${c.frames} frames`;
    case "shake":
      return c.power === 0
        ? "Secousse : stop"
        : `Secouer l'écran (force ${c.power}, ${c.frames} frames)`;
    case "call":
      return `Appeler le common event [${String(c.n + 1).padStart(4, "0")}${
        ceNames?.[c.n] ? ": " + ceNames[c.n] : ""}]`;
    case "call_fn": {
      const args = c.args.map((a) => srcLabel(a)).join(", ");
      const dst = c.dst !== undefined ? `Variable [${c.dst}] = ` : "";
      return `${dst}${fnNames?.[c.n] || "fonction " + (c.n + 1)}(${args})`;
    }
    case "ret_fn":
      return `Retourner ${srcLabel(c)}`;
    case "db_read":
      return `Variable [${c.dst}] = ${c.table}[${
        c.from === "var" ? `variable [${c.entry}]` : c.entry}].${c.field}`;
  }
}

// Title of a command's options window (the same labels as the tabbed
// selector)
function cmdTitle(c: Command["c"]): string {
  const titles: Partial<Record<Command["c"], string>> = {
    msg: "Afficher un message",
    choice: "Afficher un choix",
    set: "Variable 8-bit (héritage)",
    add: "Variable 8-bit (héritage)",
    if: "Condition 8-bit (héritage)",
    switch: "Modifier un switch",
    var: "Modifier une variable",
    if_sw: "Condition : switch",
    if_var: "Condition : variable",
    route: "Déplacer un event",
    wait_route: "Attendre la fin des déplacements",
    face: "Tourner un event",
    warp: "Téléporter le héros",
    wait: "Attendre",
    timer: "Timer",
    campan: "Déplacer la caméra",
    cam_return: "Caméra : retour au héros",
    wait_cam: "Attendre la caméra",
    loop: "Boucle",
    break: "Sortir de la boucle",
    rem: "Commentaire",
    hero_loc: "Mémoriser la position du héros",
    warp_var: "Téléporter aux variables",
    setpos: "Placer un event",
    swappos: "Échanger deux events",
    scr_hide: "Cacher l'écran",
    scr_show: "Montrer l'écran",
    tint: "Teinter l'écran",
    weather: "Météo (pluie / neige)",
    screen: "Aller à l'écran",
    screen_call: "Appeler un script de l'écran",
    stage_open: "Ouvrir un écran composé",
    stage_pose: "Poser une image (slot)",
    stage_clear: "Retirer une image (slot)",
    slot_fx: "Effet sur une image (slot)",
    vig_show: "Afficher une vignette",
    vig_play: "Animer la vignette",
    vig_hide: "Cacher la vignette",
    anim_play: "Jouer une animation",
    anim_stop: "Arrêter les animations",
    stage_close: "Fermer l'écran composé",
    m7: "Zoom cinématique",
    sfx: "Jouer un son",
    bgm: "Changer la musique",
    wave: "Ondulation de l'écran",
    skygrad: "Dégradé d'écran (ciel)",
    spotlight: "Spotlight (cercle de lumière)",
    flash: "Flash d'écran",
    shake: "Secouer l'écran",
    call: "Appeler un common event",
    db_read: "Lire la database",
    pic_show: "Afficher une image",
    pic_move: "Déplacer l'image",
    pic_hide: "Effacer l'image",
  };
  return titles[c] ?? "Options de la commande";
}

function flatten(cmds: Command[], base: string, depth: number, out: Line[], ceNames?: string[], fnNames?: string[]) {
  cmds.forEach((c, i) => {
    const path = base + i;
    out.push({ path, depth, label: labelOf(c, ceNames, fnNames), comment: c.c === "rem" });
    if (c.c === "loop") {
      flatten(c.do, `${path}.d.`, depth + 1, out, ceNames, fnNames);
      out.push({ path: `${path}.d.-1`, depth: depth + 1, label: ": Fin de boucle", branch: true });
    } else if (c.c === "choice") {
      c.options.forEach((o, k) => {
        out.push({ path: `${path}.o${k}.-1`, depth: depth + 1, label: `: Quand [${o.text}]`, branch: true });
        flatten(o.do, `${path}.o${k}.`, depth + 2, out, ceNames, fnNames);
      });
    } else if (c.c === "if" || c.c === "if_sw" || c.c === "if_var") {
      out.push({ path: `${path}.t.-1`, depth: depth + 1, label: ": Si vrai", branch: true });
      flatten(c.then, `${path}.t.`, depth + 2, out, ceNames, fnNames);
      out.push({ path: `${path}.e.-1`, depth: depth + 1, label: ": Sinon", branch: true });
      flatten(c.else, `${path}.e.`, depth + 2, out, ceNames, fnNames);
    }
  });
  out.push({ path: base + cmds.length, depth, label: "" }); // end of list
}

// Resolves the LIST containing the command named by path, and its index.
function resolve(root: Command[], path: string): { list: Command[]; index: number } {
  const parts = path.split(".");
  let list = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (p.startsWith("o")) {
      const prev = list as unknown as { options: { do: Command[] }[] };
      void prev;
    }
    const idx = parseInt(p, 10);
    if (!isNaN(idx)) {
      const c = list[idx];
      const sel = parts[i + 1];
      if (c.c === "choice" && sel.startsWith("o")) {
        list = c.options[parseInt(sel.slice(1), 10)].do;
        i++; // consumes the branch selector
      } else if (
        (c.c === "if" || c.c === "if_sw" || c.c === "if_var") &&
        (sel === "t" || sel === "e")
      ) {
        list = sel === "t" ? c.then : c.else;
        i++;
      } else if (c.c === "loop" && sel === "d") {
        list = c.do;
        i++;
      }
    }
  }
  return { list, index: parseInt(parts[parts.length - 1], 10) };
}

// Command list editor — the "Contenu" column (@>) with its windows
// (tabbed selector, options, variable lists, context menu, Ctrl+C/V/Del).
// Shared between the Event Editor and the Common events window (v0.16).
// The list it receives is MUTATED IN PLACE; commit() tells the parent
// after every change. Remount the component (key=) when the displayed
// list changes identity.
export function CommandListEditor(props: {
  cmds: Command[];
  commit: () => void;
  shortcutsOff?: boolean; // a parent sub-window is open: cut the keyboard
  sceneNames: string[];
  scenes: Record<string, Scene>;
  switchNames: string[];
  varNames: string[];
  entryNames: string[];
  charsetNames: string[];
  commonNames: string[];
  fnSigs?: FnSig[]; // F1 — the project's functions (Tools > Fonctions)
  // F1 — parameters of the FUNCTION whose body is being edited. Empty or
  // absent elsewhere: this is what decides whether "Paramètre" is an
  // offered source, and under which names.
  fnParams?: string[];
  fnLocals?: string[]; // F2b — locals of the function being edited
  inFunction?: boolean;
  db: Database | null;
  uiWidgets: string[];
  uiStyles: string[];
  texts: TextEntry[]; // Tools > Textes catalogue (msg by reference, T2)
  pictures: string[];
  mode7Images: string[];
  tintPresets: TintPreset[];
  soundNames: string[];
  musicNames: string[];
  vigNames: string[];
  animNames: string[];
  screenNames: string[];
  screenScriptNames?: string[];
  onTintPresets: (list: TintPreset[]) => void;
  onRenameVars: (switches: string[], variables: string[]) => void;
}) {
  const { cmds } = props;
  const [sel, setSel] = useState<string>(String(cmds.length));
  const [form, setForm] = useState<Command | null>(null); // being edited
  const [formIsNew, setFormIsNew] = useState(false);
  const [picking, setPicking] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [varPick, setVarPick] = useState<{ kind: VarKind; current: number; cb: (n: number) => void } | null>(null);
  const [clipCmd, setClipCmd] = useState<Command | null>(null);

  const lines: Line[] = [];
  flatten(cmds, "", 0, lines, props.commonNames, (props.fnSigs ?? []).map((f) => f.name));

  // Command at this path, or null when the row is empty (end of list)
  function cmdAt(path: string): Command | null {
    const line = lines.find((l) => l.path === path);
    if (!line || line.branch) return null;
    const { list, index } = resolve(cmds, path);
    return list[index] ?? null;
  }

  // Opens the command selector to insert BEFORE the targeted row
  function openPicker(path: string) {
    setSel(path);
    setForm(null);
    setPicking(true);
  }

  // Opens the options window of this row's command
  function openEditor(path: string) {
    const c = cmdAt(path);
    if (!c) return;
    setSel(path);
    setPicking(false);
    setForm(structuredClone(c));
    setFormIsNew(false);
  }

  // Ctrl+C copies the selected command, Ctrl+V inserts it at the current
  // row, Del removes it — inactive while a field has focus or a
  // sub-window is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (props.shortcutsOff || form || picking || menu || varPick) return;
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        const c = cmdAt(sel);
        if (c) {
          setClipCmd(structuredClone(c));
          e.preventDefault();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (clipCmd) {
          insertCmd(structuredClone(clipCmd));
          e.preventDefault();
        }
      } else if (e.key === "Delete") {
        deleteCmd();
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function insertCmd(c: Command) {
    const { list, index } = resolve(cmds, sel);
    list.splice(Math.min(index, list.length), 0, c);
    props.commit();
    setForm(null);
    setPicking(false);
  }

  function replaceCmd(c: Command) {
    const { list, index } = resolve(cmds, sel);
    if (index < list.length) list[index] = c;
    props.commit();
    setForm(null);
  }

  function deleteCmd(path = sel) {
    if (!cmdAt(path)) return;
    const { list, index } = resolve(cmds, path);
    list.splice(index, 1);
    props.commit();
    setForm(null);
  }

  function moveCmd(delta: number, path = sel) {
    if (!cmdAt(path)) return;
    const { list, index } = resolve(cmds, path);
    const j = index + delta;
    if (j < 0 || j >= list.length) return;
    const [c] = list.splice(index, 1);
    list.splice(j, 0, c);
    props.commit();
    setSel(path.replace(/\d+$/, String(j)));
  }

  function defaultCmd(t: Command["c"]): Command {
    switch (t) {
      case "msg":
        return { c: "msg", text: "" };
      case "choice":
        return { c: "choice", options: [{ text: "Oui", do: [] }, { text: "Non", do: [] }] };
      case "set":
        return { c: "set", var: "g0", value: 1 };
      case "add":
        return { c: "add", var: "v0", value: 1 };
      case "if":
        return { c: "if", var: "g0", op: "==", value: 1, then: [], else: [] };
      case "warp": {
        const to = props.sceneNames[0] ?? "";
        const d = props.scenes[to];
        return { c: "warp", to, x: d?.player_start[0] ?? 3, y: d?.player_start[1] ?? 3 };
      }
      case "face":
        return { c: "face", event: 0, dir: "down" };
      case "switch":
        return { c: "switch", n: 0, on: true };
      case "var":
        return { c: "var", n: 0, op: "=", value: 1 };
      case "if_sw":
        return { c: "if_sw", n: 0, on: true, then: [], else: [] };
      case "if_var":
        return {
          c: "if_var", n: 0, op: "==", value: 1,
          left: { from: "var", value: 0 }, right: { value: 1 },
          then: [], else: [],
        };
      case "route":
        return { c: "route", event: -1, repeat: false, skip: false, steps: [] };
      case "wait_route":
        return { c: "wait_route" };
      case "wait":
        return { c: "wait", frames: 60 };
      case "timer":
        return { c: "timer", op: "start", secs: 60 };
      case "campan":
        return { c: "campan", x: 0, y: 0, speed: 2 };
      case "cam_return":
        return { c: "cam_return", speed: 2 };
      case "wait_cam":
        return { c: "wait_cam" };
      case "loop":
        return { c: "loop", do: [] };
      case "break":
        return { c: "break" };
      case "rem":
        return { c: "rem", text: "" };
      case "hero_loc":
        return { c: "hero_loc", vs: 0, vx: 1, vy: 2 };
      case "warp_var":
        return { c: "warp_var", vs: 0, vx: 1, vy: 2 };
      case "setpos":
        return { c: "setpos", event: -1, from: "const", x: 0, y: 0 };
      case "swappos":
        return { c: "swappos", a: -1, b: 0 };
      case "ui_show":
        return { c: "ui_show", widget: "", on: true };
      case "list_select":
        return { c: "list_select", widget: "", var: 0, cancel: true };
      case "key_input":
        return { c: "key_input", var: 0, wait: true, keys: [1, 2, 3, 4, 5, 6] };
      case "sysmenu":
        return { c: "sysmenu" };
      case "pic_show":
        return { c: "pic_show", pic: "" };
      case "pic_move":
        return { c: "pic_move", x: 0, y: 0, dur: 30 };
      case "pic_hide":
        return { c: "pic_hide" };
      case "scr_hide":
        return { c: "scr_hide", frames: 30 };
      case "scr_show":
        return { c: "scr_show", frames: 30 };
      case "tint":
        return { c: "tint", mode: "sub", r: 8, g: 8, b: 8 };
      case "weather":
        return { c: "weather", kind: "rain", power: 2 };
      case "screen":
        return { c: "screen", name: "", dur: 20 };
      case "screen_call":
        return { c: "screen_call", script: "" };
      case "stage_open":
        return { c: "stage_open", pic: "", dur: 20 };
      case "stage_pose":
        return { c: "stage_pose", slot: 1, pic: "", x: 16, y: 40 };
      case "stage_clear":
        return { c: "stage_clear", slot: 1 };
      case "slot_fx":
        return { c: "slot_fx", slot: 1, fx: "flash", frames: 6 };
      case "vig_show":
        return { c: "vig_show", slot: 1, vig: "", x: 112, y: 96, anchor: "screen" };
      case "vig_play":
        return { c: "vig_play", slot: 1, mode: "once", speed: 8 };
      case "vig_hide":
        return { c: "vig_hide", slot: 1 };
      case "anim_play":
        return { c: "anim_play", anim: "", anchor: "screen", event: -1, wait: false };
      case "anim_stop":
        return { c: "anim_stop" };
      case "m7":
        return {
          c: "m7",
          image: "",
          from: 100,
          to: 150,
          frames: 90,
          curve: "ease_in_out",
          dur: 20,
        };
      case "m7_view":
        return { c: "m7_view", preset: "standard", horizon: 56, anchor: 176 };
      case "m7_rot":
        return { c: "m7_rot", step: 0 };
      case "m7_turn":
        return { c: "m7_turn", step: 0, frames: 30, wait: true };
      case "stage_close":
        return { c: "stage_close", dur: 20 };
      case "sfx":
        return { c: "sfx", sound: "" };
      case "bgm":
        return { c: "bgm", music: "" };
      case "wave":
        return { c: "wave", power: 3, speed: 2 };
      case "skygrad":
        return { c: "skygrad", mode: "sub", r: 12, g: 8, b: 0, r2: 0, g2: 0, b2: 0 };
      case "spotlight":
        return { c: "spotlight", radius: 48, dark: 31 };
      case "flash":
        return { c: "flash", r: 31, g: 31, b: 31, frames: 8 };
      case "shake":
        return { c: "shake", power: 4, speed: 2, frames: 30 };
      case "call":
        return { c: "call", n: 0 };
      case "call_fn":
        // One argument per parameter from the start: datagen refuses a
        // mis-sized call, so there is no point letting the author build
        // that case.
        return {
          c: "call_fn",
          n: 0,
          args: (props.fnSigs?.[0]?.params ?? []).map(() => ({ value: 0 })),
        };
      case "ret_fn":
        return { c: "ret_fn", value: 0 };
      case "db_read": {
        const sc = props.db?.schemas[0];
        return {
          c: "db_read",
          table: sc?.name ?? "",
          entry: props.db?.entries[sc?.name ?? ""]?.[0]?.id ?? "",
          field: sc?.fields[0]?.name ?? "",
          dst: 0,
        };
      }
    }
  }

  return (
    <>
      <div className="evedit-cmds">
        {lines.map((l) => (
          <div
            key={l.path}
            className={
              "evedit-line" + (l.path === sel ? " active" : "") +
              (l.branch ? " branch" : "") + (l.comment ? " comment" : "")
            }
            style={{ paddingLeft: 6 + l.depth * 16 }}
            onClick={() => {
              if (!l.branch) {
                setSel(l.path);
                setForm(null);
                setPicking(false);
              }
            }}
            onDoubleClick={() => {
              if (l.branch) return;
              // a filled row: we edit it; an empty row: we choose a
              // command to insert (like RM2003)
              if (cmdAt(l.path)) openEditor(l.path);
              else openPicker(l.path);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (l.branch) return;
              setSel(l.path);
              setMenu({ x: e.clientX, y: e.clientY, path: l.path });
            }}
          >
            {l.branch ? l.label : `@> ${l.label}`}
          </div>
        ))}
      </div>

      {form && (
        <div className="modal-backdrop">
          <div className="modal cmdform" onClick={(e) => e.stopPropagation()}>
            <div className="palette-title">{cmdTitle(form.c)}<button className="modal-x" title="Fermer" onClick={() => setForm(null)}>✕</button></div>
            <CommandForm
              cmd={form}
              sceneNames={props.sceneNames}
              scenes={props.scenes}
              switchNames={props.switchNames}
              varNames={props.varNames}
              entryNames={props.entryNames}
              charsetNames={props.charsetNames}
              commonNames={props.commonNames}
              fnSigs={props.fnSigs}
              fnParams={props.fnParams}
              fnLocals={props.fnLocals}
              inFunction={props.inFunction}
              db={props.db}
              uiWidgets={props.uiWidgets}
              uiStyles={props.uiStyles}
              texts={props.texts}
              pictures={props.pictures}
              mode7Images={props.mode7Images}
              tintPresets={props.tintPresets}
              soundNames={props.soundNames}
              musicNames={props.musicNames}
              vigNames={props.vigNames}
              animNames={props.animNames}
              screenNames={props.screenNames}
              screenScriptNames={props.screenScriptNames}
              onTintPresets={props.onTintPresets}
              onPickVar={(kind, current, cb) => setVarPick({ kind, current, cb })}
              onChange={setForm}
              onOk={() => (formIsNew ? insertCmd(form) : replaceCmd(form))}
              onCancel={() => setForm(null)}
            />
          </div>
        </div>
      )}

      {picking && (
        <EventCommandPicker
          inFunction={props.inFunction}
          onClose={() => setPicking(false)}
          onPick={(t) => {
            setForm(defaultCmd(t));
            setFormIsNew(true);
            setPicking(false);
          }}
        />
      )}

      {varPick && (
        <VarListModal
          kind={varPick.kind}
          pick
          initial={varPick.current}
          switches={props.switchNames}
          variables={props.varNames}
          onClose={() => setVarPick(null)}
          onOk={(r) => {
            props.onRenameVars(r.switches, r.variables);
            if (r.picked !== undefined) varPick.cb(r.picked);
            setVarPick(null);
          }}
        />
      )}

      {menu && (
        <div
          className="ctx-backdrop"
          onClick={() => setMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu(null);
          }}
        >
          <div
            className="ctx-menu"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                openPicker(menu.path);
                setMenu(null);
              }}
            >
              Insérer…
            </button>
            <button
              disabled={!cmdAt(menu.path)}
              onClick={() => {
                openEditor(menu.path);
                setMenu(null);
              }}
            >
              Éditer…
            </button>
            <div className="menu-sep" />
            <button
              disabled={!cmdAt(menu.path)}
              onClick={() => {
                moveCmd(-1, menu.path);
                setMenu(null);
              }}
            >
              ↑ Monter
            </button>
            <button
              disabled={!cmdAt(menu.path)}
              onClick={() => {
                moveCmd(1, menu.path);
                setMenu(null);
              }}
            >
              ↓ Descendre
            </button>
            <div className="menu-sep" />
            <button
              disabled={!cmdAt(menu.path)}
              onClick={() => {
                setSel(menu.path);
                deleteCmd(menu.path);
                setMenu(null);
              }}
            >
              Supprimer
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function EventEditorModal(props: Props) {
  const [draft, setDraft] = useState<GameEvent>(() => structuredClone(props.event));
  // edited page: 0 = the event's flat fields (page 1), k>0 = extraPages[k-1]
  const [page, setPage] = useState(0);
  const pageCount = 1 + (draft.extraPages?.length ?? 0);
  const cur: EventPage =
    page === 0
      ? {
          condition: draft.condition,
          move: draft.move,
          move_route: draft.move_route,
          priority: draft.priority,
          speed: draft.speed,
          trigger: draft.trigger,
          sprite: draft.sprite,
          dir: draft.dir,
          entry: draft.entry,
          commands: draft.commands,
        }
      : draft.extraPages![page - 1];
  function patchCur(p: Partial<EventPage>) {
    if (page === 0) setDraft({ ...draft, ...p });
    else {
      const extra = [...(draft.extraPages ?? [])];
      extra[page - 1] = { ...extra[page - 1], ...p };
      setDraft({ ...draft, extraPages: extra });
    }
  }
  const cmds = cur.commands;
  // Switches/Variables window opened from the page conditions (…)
  const [varPick, setVarPick] = useState<{ kind: VarKind; current: number; cb: (n: number) => void } | null>(null);
  // Route window of the page's CUSTOM route (v0.14)
  const [pageRouteOpen, setPageRouteOpen] = useState(false);
  // RM2003-style Appearance window (T3)
  const [graphicOpen, setGraphicOpen] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = previewRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#16181c";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (cur.tile !== undefined && props.tilesetBmp) {
      const perRow = Math.max(1, Math.floor(props.tilesetBmp.width / 16));
      ctx.drawImage(
        props.tilesetBmp,
        (cur.tile % perRow) * 16, Math.floor(cur.tile / perRow) * 16, 16, 16,
        8, 18, 48, 48
      );
    } else if (props.sprites && cur.sprite >= 0) {
      const f = eventFrame({ sprite: cur.sprite, dir: cur.dir } as GameEvent);
      ctx.drawImage(props.sprites, f * 16, 0, 16, 24, 8, 6, 48, 72);
    } else {
      ctx.fillStyle = "#9aa0a8";
      ctx.font = "11px system-ui";
      ctx.fillText("(invisible)", 6, 44);
    }
  }, [draft, page, props.sprites]);

  return (
    <>
      <div className="modal-backdrop">
      <div className="modal evedit" onClick={(e) => e.stopPropagation()}>
        <div className="evedit-top">
          <label>
            Nom
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <span className="row" style={{ flex: 0, gap: 6 }}>
            {Array.from({ length: pageCount }, (_, k) => (
              <button
                key={k}
                className={k === page ? "active-page" : ""}
                style={{
                  flex: "0 0 auto",
                  minWidth: 26,
                  ...(k === page ? { background: "#31547a" } : null),
                }}
                onClick={() => setPage(k)}
              >
                {k + 1}
              </button>
            ))}
            <button
              title="Nouvelle page (copie de la page courante) — la DERNIÈRE page dont la condition passe est active en jeu"
              onClick={() => {
                const extra = [...(draft.extraPages ?? []), structuredClone(cur)];
                setDraft({ ...draft, extraPages: extra });
                setPage(extra.length);
              }}
              style={{ flex: "0 0 auto", width: 30 }}
            >
              ＋
            </button>
            <button
              disabled={pageCount <= 1}
              title="Supprimer la page courante"
              onClick={() => {
                if (page === 0) {
                  const [next, ...rest] = draft.extraPages!;
                  setDraft({ ...draft, ...next, extraPages: rest.length ? rest : undefined });
                } else {
                  const extra = (draft.extraPages ?? []).filter((_, i) => i !== page - 1);
                  setDraft({ ...draft, extraPages: extra.length ? extra : undefined });
                  setPage(Math.max(0, page - 1));
                }
              }}
              style={{ flex: "0 0 auto", width: 30 }}
            >
              🗑
            </button>
          </span>
          <button className="modal-x" title="Fermer" onClick={props.onClose} style={{ alignSelf: "flex-start" }}>✕</button>
        </div>
        <div className="evedit-body">
          <div className="evedit-left">
            <fieldset className="evedit-box">
              <legend>Condition de la page {page + 1}</legend>
              <select
                value={!cur.condition ? "none" : "switch" in cur.condition ? (cur.condition.on ? "sw_on" : "sw_off") : "var"}
                onChange={(e) => {
                  const v = e.target.value;
                  patchCur({
                    condition:
                      v === "none" ? undefined :
                      v === "sw_on" ? { switch: 0, on: true } :
                      v === "sw_off" ? { switch: 0, on: false } :
                      { var: 0, min: 1 },
                  });
                }}
              >
                <option value="none">Toujours active</option>
                <option value="sw_on">Si switch ON</option>
                <option value="sw_off">Si switch OFF</option>
                <option value="var">Si variable ≥ valeur</option>
              </select>
              {cur.condition && "switch" in cur.condition && (
                <span className="row" style={{ gap: 4 }}>
                  <input
                    type="number" min={0} max={511} value={cur.condition.switch}
                    onChange={(e) => patchCur({ condition: { ...(cur.condition as { switch: number; on: boolean }), switch: Number(e.target.value) } })}
                  />
                  <button className="browse" title="Choisir dans la liste"
                    onClick={() => setVarPick({ kind: "switch", current: (cur.condition as { switch: number }).switch, cb: (n) => patchCur({ condition: { ...(cur.condition as { switch: number; on: boolean }), switch: n } }) })}>…</button>
                  <span className="hint">{props.switchNames[(cur.condition as { switch: number }).switch] || ""}</span>
                </span>
              )}
              {cur.condition && "var" in cur.condition && (
                <span className="row" style={{ gap: 4 }}>
                  <input
                    type="number" min={0} max={255} value={cur.condition.var}
                    onChange={(e) => patchCur({ condition: { ...(cur.condition as { var: number; min: number }), var: Number(e.target.value) } })}
                  />
                  <button className="browse" title="Choisir dans la liste"
                    onClick={() => setVarPick({ kind: "var", current: (cur.condition as { var: number }).var, cb: (n) => patchCur({ condition: { ...(cur.condition as { var: number; min: number }), var: n } }) })}>…</button>
                  <label style={{ margin: 0 }}>≥
                    <input
                      type="number" min={0} max={65535} value={cur.condition.min}
                      onChange={(e) => patchCur({ condition: { ...(cur.condition as { var: number; min: number }), min: Number(e.target.value) } })}
                    />
                  </label>
                  <span className="hint">{props.varNames[(cur.condition as { var: number }).var] || ""}</span>
                </span>
              )}
              <span className="hint">La dernière page dont la condition passe est active.</span>
            </fieldset>
            <fieldset className="evedit-box">
              <legend>Apparence</legend>
              <div className="row">
                <canvas
                  ref={previewRef}
                  width={64}
                  height={84}
                  title="Choisir l'apparence (charset + direction)"
                  style={{ cursor: "pointer" }}
                  onClick={() => setGraphicOpen(true)}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <span className="hint">
                    {cur.tile !== undefined
                      ? `Tile ${cur.tile} (couche haute)`
                      : cur.sprite < 0
                        ? "(invisible)"
                        : (props.blockNames[cur.sprite] ?? `Bloc ${cur.sprite}`) +
                          ` — ${cur.dir}`}
                  </span>
                  <button onClick={() => setGraphicOpen(true)}>Choisir…</button>
                  {cur.sprite >= 0 &&
                    !props.usedBlocks.includes(cur.sprite) &&
                    props.usedBlocks.length >= 5 && (
                      <span className="hint" style={{ color: "#ff7070" }}>
                        {props.usedBlocks.length + 1}e charset de la scène —
                        5 max (héros compris).
                      </span>
                    )}
                </div>
              </div>
            </fieldset>
            <fieldset className="evedit-box">
              <legend>Type de mouvement</legend>
              <select
                value={cur.move ?? "static"}
                disabled={cur.trigger !== "action"}
                title={cur.trigger !== "action" ? "Seuls les events « touche action » se déplacent" : undefined}
                onChange={(e) => {
                  const move = e.target.value === "static" ? undefined : (e.target.value as MoveType);
                  patchCur({
                    move,
                    move_route:
                      move === "custom"
                        ? cur.move_route ?? { freq: 3, repeat: true, skip: false, steps: [] }
                        : undefined,
                  });
                }}
              >
                <option value="static">Statique</option>
                <option value="random">Aléatoire</option>
                <option value="vertical">Vertical (haut-bas)</option>
                <option value="horizontal">Horizontal (gauche-droite)</option>
                <option value="custom">Route custom</option>
              </select>
              {cur.move === "custom" && (
                <>
                  <button onClick={() => setPageRouteOpen(true)}>
                    Éditer la route… ({cur.move_route?.steps.length ?? 0} pas)
                  </button>
                  {(cur.move_route?.steps.length ?? 0) === 0 && (
                    <span className="hint" style={{ color: "#ff7070" }}>
                      Route vide — datagen la refusera.
                    </span>
                  )}
                </>
              )}
            </fieldset>
            <fieldset className="evedit-box">
              <legend>Déclencheur</legend>
              <select
                value={cur.trigger}
                onChange={(e) => patchCur({ trigger: e.target.value as GameEvent["trigger"] })}
              >
                <option value="action">Touche action (A)</option>
                <option value="touch">Contact du héros</option>
                <option value="auto">Auto-start (chargement)</option>
              </select>
            </fieldset>
            <fieldset className="evedit-box">
              <legend>Priorité / Vitesse</legend>
              <select
                value={cur.priority ?? "same"}
                onChange={(e) =>
                  patchCur({ priority: e.target.value === "same" ? undefined : (e.target.value as EventPriority) })
                }
                title="Sous le héros : traversable, s'active en se tenant dessus. Au-dessus : traversable, dessiné par-dessus tout."
              >
                <option value="below">Sous le héros</option>
                <option value="same">Comme le héros</option>
                <option value="above">Au-dessus du héros</option>
              </select>
              <select
                value={cur.speed ?? 1}
                disabled={cur.trigger !== "action"}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  patchCur({ speed: v === 1 ? undefined : v });
                }}
              >
                <option value={1}>Vitesse 1 (lente)</option>
                <option value={2}>Vitesse 2 (normale)</option>
                <option value={3}>Vitesse 3 (rapide)</option>
                <option value={4}>Vitesse 4 (très rapide)</option>
              </select>
            </fieldset>
            {props.labels.length > 0 && (
              <fieldset className="evedit-box">
                <legend>Script avancé</legend>
                <select
                  value={cmds.length ? "" : cur.entry ?? ""}
                  disabled={cmds.length > 0}
                  title="Label du script assembleur de la scène (ignoré si la page a des commandes)"
                  onChange={(e) =>
                    patchCur({ entry: e.target.value === "" ? undefined : e.target.value })
                  }
                >
                  <option value="">— aucun —</option>
                  {props.labels.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </fieldset>
            )}
          </div>
          <div className="evedit-right">
            <div className="palette-title">Contenu</div>
            <CommandListEditor
              key={page}
              cmds={cmds}
              commit={() => setDraft({ ...draft })}
              shortcutsOff={pageRouteOpen || varPick !== null}
              sceneNames={props.sceneNames}
              scenes={props.scenes}
              switchNames={props.switchNames}
              varNames={props.varNames}
              entryNames={props.entryNames}
              charsetNames={props.charsetNames}
              commonNames={props.commonNames}
              fnSigs={props.fnSigs}
              fnParams={props.fnParams}
              fnLocals={props.fnLocals}
              inFunction={props.inFunction}
              db={props.db}
              uiWidgets={props.uiWidgets}
              uiStyles={props.uiStyles}
              texts={props.texts}
              pictures={props.pictures}
              mode7Images={props.mode7Images}
              tintPresets={props.tintPresets}
              soundNames={props.soundNames}
              musicNames={props.musicNames}
              vigNames={props.vigNames}
              animNames={props.animNames}
              screenNames={props.screenNames}
              screenScriptNames={props.screenScriptNames}
              onTintPresets={props.onTintPresets}
              onRenameVars={props.onRenameVars}
            />
          </div>
        </div>
        <div className="row">
          <button
            onClick={() => props.onSave({ ...draft, name: draft.name.trim() || "EV" })}
          >
            OK
          </button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
      </div>

      {pageRouteOpen && (
        <MoveRouteModal
          cmd={{
            c: "route",
            event: -1,
            repeat: cur.move_route?.repeat ?? true,
            skip: cur.move_route?.skip ?? false,
            freq: cur.move_route?.freq ?? 3,
            steps: cur.move_route?.steps ?? [],
          }}
          hideTarget
          eventNames={props.entryNames}
          switchNames={props.switchNames}
          charsetNames={props.charsetNames}
          onClose={() => setPageRouteOpen(false)}
          onOk={(c) => {
            patchCur({
              move_route: { freq: c.freq ?? 3, repeat: c.repeat, skip: c.skip, steps: c.steps },
            });
            setPageRouteOpen(false);
          }}
        />
      )}
      {varPick && (
        <VarListModal
          kind={varPick.kind}
          pick
          initial={varPick.current}
          switches={props.switchNames}
          variables={props.varNames}
          onClose={() => setVarPick(null)}
          onOk={(r) => {
            props.onRenameVars(r.switches, r.variables);
            if (r.picked !== undefined) varPick.cb(r.picked);
            setVarPick(null);
          }}
        />
      )}
      {graphicOpen && (
        <GraphicPickerModal
          sprites={props.sprites}
          blockCount={props.blockCount}
          blockNames={props.blockNames}
          usedBlocks={props.usedBlocks}
          sprite={cur.sprite}
          dir={cur.dir}
          tileset={props.tilesetBmp}
          upperCells={props.upperCells}
          tile={cur.tile}
          onClose={() => setGraphicOpen(false)}
          onOk={(sprite, dir, tile) => {
            patchCur({ sprite, dir, tile });
            setGraphicOpen(false);
          }}
        />
      )}
    </>
  );
}

// Parameter form of a command (the area under the list, in the style of
// F1 — "source + value", the same block everywhere: a call argument, a
// returned value. "Paramètre" only appears inside a function body,
// otherwise it would name a frame that does not exist (datagen refuses
// it too, but better not to offer it at all).
export function ValueSourceFields(props: {
  v: ValueSrc;
  fnParams?: string[];
  fnLocals?: string[];
  varNames?: string[];
  onPickVar?: (kind: VarKind, current: number, cb: (n: number) => void) => void;
  onChange: (v: ValueSrc) => void;
}) {
  const { v } = props;
  const params = props.fnParams ?? [];
  const locals = props.fnLocals ?? [];
  const from = v.from ?? "const";
  const numeric = from === "const" || from === "var";
  return (
    <>
      <label>
        Source
        <select
          value={from}
          onChange={(e) => {
            const f = e.target.value as VarSource;
            props.onChange({ from: f === "const" ? undefined : f, value: 0 });
          }}
        >
          <option value="const">Constante</option>
          <option value="var">Une variable</option>
          <option value="hero_x">X du héros (tiles)</option>
          <option value="hero_y">Y du héros (tiles)</option>
          <option value="timer">Timer (secondes)</option>
          <option value="scene">N° de la scène courante</option>
          {params.length > 0 && <option value="param">Un paramètre</option>}
          {locals.length > 0 && <option value="local">Une variable locale</option>}
          <option value="ret">Résultat du dernier appel</option>
        </select>
      </label>
      {from === "param" || from === "local" ? (
        <label>
          {from === "local" ? "Variable locale" : "Paramètre"}
          <select
            value={v.value}
            onChange={(e) => props.onChange({ ...v, value: Number(e.target.value) })}
          >
            {(from === "local" ? locals : params).map((pname, k) => (
              <option key={k} value={k}>
                {k + 1}. {pname || "sans nom"}
              </option>
            ))}
          </select>
        </label>
      ) : from === "var" ? (
        <label>
          Variable
          <span className="row" style={{ gap: 4 }}>
            <input
              type="number" min={0} max={255} value={v.value}
              onChange={(e) => props.onChange({ ...v, value: Number(e.target.value) })}
            />
            {props.onPickVar && (
              <button className="browse" title="Choisir dans la liste"
                onClick={() =>
                  props.onPickVar!("var", v.value, (n) => props.onChange({ ...v, value: n }))
                }>…</button>
            )}
          </span>
          <span className="hint">{props.varNames?.[v.value] || ""}</span>
        </label>
      ) : numeric ? (
        <label>
          Valeur
          <input
            type="number" min={-32768} max={65535} value={v.value}
            onChange={(e) => props.onChange({ ...v, value: Number(e.target.value) })}
          />
        </label>
      ) : null}
    </>
  );
}

// Everything a per-command form needs: the props of the window plus
// the shared fields and the bits of local state a few commands drive.
// One object rather than twenty parameters, and one place to look
// when a form needs something new.
export type FormCtx = {
  p: CommandFormProps;
  varField: (v: string, set: (s: string) => void) => JSX.Element;
  varOk: (v: string) => boolean;
  styleField: (
    c: { style?: string },
    set: (s: string | undefined) => void
  ) => JSX.Element | false;
  routeOpen: boolean;
  setRouteOpen: (b: boolean) => void;
  presetName: string;
  setPresetName: (s: string) => void;
};

// What a form contributes: its fields, and whether OK may be pressed.
export type FormBody = { body: JSX.Element | null; valid: boolean };

export type CommandFormProps = {
  cmd: Command;
  sceneNames: string[];
  scenes: Record<string, Scene>;
  switchNames: string[];
  varNames: string[];
  entryNames: string[];
  charsetNames: string[];
  commonNames: string[];
  fnSigs?: FnSig[]; // F1 — the project's functions (Tools > Fonctions)
  // F1 — parameters of the FUNCTION whose body is being edited. Empty or
  // absent elsewhere: this is what decides whether "Paramètre" is an
  // offered source, and under which names.
  fnParams?: string[];
  fnLocals?: string[]; // F2b — locals of the function being edited
  inFunction?: boolean;
  uiWidgets: string[];
  uiStyles: string[];
  texts: TextEntry[];
  pictures: string[];
  mode7Images: string[];
  tintPresets: TintPreset[];
  soundNames: string[];
  musicNames: string[];
  vigNames: string[];
  animNames: string[];
  screenNames: string[];
  screenScriptNames?: string[];
  onTintPresets: (list: TintPreset[]) => void;
  db: Database | null;
  onPickVar: (kind: VarKind, current: number, cb: (n: number) => void) => void;
  onChange: (c: Command) => void;
  onOk: () => void;
  onCancel: () => void;
};

// Options form of one command (the window opened by a double-click).
// The body is chosen by the dispatch table below; every branch lives
// in CommandForms.tsx, one function per command.
function CommandForm(props: CommandFormProps) {
  const { cmd } = props;
  // Route window (the "Déplacer un event" command)
  const [routeOpen, setRouteOpen] = useState(false);
  // name of the tint preset to save (S12b)
  const [presetName, setPresetName] = useState("");
  const varField = (v: string, set: (s: string) => void) => (
    <label>
      Variable (v0-v63 scène, g0-g63 globale)
      <input
        value={v}
        onChange={(e) => set(e.target.value)}
        placeholder="g0"
        style={{ width: 90 }}
      />
    </label>
  );
  const varOk = (v: string) =>
    /^[vg]\d{1,2}$/.test(v) && Number(v.slice(1)) <= 63;

  // dialogue box selector (S1) — shown only when the project has styles;
  // absent = the default box (always there)
  const styleField = (c: { style?: string }, set: (s: string | undefined) => void) =>
    props.uiStyles.length > 0 && (
      <label>
        Boîte de dialogue
        <select value={c.style ?? ""} onChange={(e) => set(e.target.value || undefined)}>
          <option value="">(défaut)</option>
          {props.uiStyles.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          {c.style && !props.uiStyles.includes(c.style) && (
            <option value={c.style}>{c.style} (?)</option>
          )}
        </select>
        {c.style && !props.uiStyles.includes(c.style) && (
          <span className="hint">⚠ style « {c.style} » introuvable (Tools → UI → Dialogues et choix)</span>
        )}
      </label>
    );

  const x: FormCtx = {
    p: props,
    varField,
    varOk,
    styleField,
    routeOpen,
    setRouteOpen,
    presetName,
    setPresetName,
  };
  let body: JSX.Element | null = null;
  let valid = true;
  switch (cmd.c) {
    case "msg":
      ({ body, valid } = formMsg(cmd, x));
      break;
    case "choice":
      ({ body, valid } = formChoice(cmd, x));
      break;
    case "set":
    case "add":
      ({ body, valid } = formSetAdd(cmd, x));
      break;
    case "if":
      ({ body, valid } = formIf(cmd, x));
      break;
    case "switch":
      ({ body, valid } = formSwitch(cmd, x));
      break;
    case "var":
      ({ body, valid } = formVar(cmd, x));
      break;
    case "if_sw":
      ({ body, valid } = formIfSw(cmd, x));
      break;
    case "if_var":
      ({ body, valid } = formIfVar(cmd, x));
      break;
    case "route":
      ({ body, valid } = formRoute(cmd, x));
      break;
    case "wait_route":
      ({ body, valid } = formWaitRoute(cmd, x));
      break;
    case "wait":
      ({ body, valid } = formWait(cmd, x));
      break;
    case "timer":
      ({ body, valid } = formTimer(cmd, x));
      break;
    case "campan":
      ({ body, valid } = formCampan(cmd, x));
      break;
    case "cam_return":
      ({ body, valid } = formCamReturn(cmd, x));
      break;
    case "wait_cam":
      ({ body, valid } = formWaitCam(cmd, x));
      break;
    case "loop":
      ({ body, valid } = formLoop(cmd, x));
      break;
    case "break":
      ({ body, valid } = formBreak(cmd, x));
      break;
    case "rem":
      ({ body, valid } = formRem(cmd, x));
      break;
    case "hero_loc":
    case "warp_var":
      ({ body, valid } = formHeroLocWarpVar(cmd, x));
      break;
    case "setpos":
      ({ body, valid } = formSetpos(cmd, x));
      break;
    case "swappos":
      ({ body, valid } = formSwappos(cmd, x));
      break;
    case "key_input":
      ({ body, valid } = formKeyInput(cmd, x));
      break;
    case "sysmenu":
      ({ body, valid } = formSysmenu(cmd, x));
      break;
    case "pic_show":
      ({ body, valid } = formPicShow(cmd, x));
      break;
    case "pic_move":
      ({ body, valid } = formPicMove(cmd, x));
      break;
    case "pic_hide":
      ({ body, valid } = formPicHide(cmd, x));
      break;
    case "ui_show":
      ({ body, valid } = formUiShow(cmd, x));
      break;
    case "list_select":
      ({ body, valid } = formListSelect(cmd, x));
      break;
    case "scr_hide":
    case "scr_show":
      ({ body, valid } = formScrHideScrShow(cmd, x));
      break;
    case "tint":
      ({ body, valid } = formTint(cmd, x));
      break;
    case "wave":
      ({ body, valid } = formWave(cmd, x));
      break;
    case "skygrad":
      ({ body, valid } = formSkygrad(cmd, x));
      break;
    case "spotlight":
      ({ body, valid } = formSpotlight(cmd, x));
      break;
    case "screen":
      ({ body, valid } = formScreen(cmd, x));
      break;
    case "screen_call":
      ({ body, valid } = formScreenCall(cmd, x));
      break;
    case "stage_open":
      ({ body, valid } = formStageOpen(cmd, x));
      break;
    case "stage_pose":
      ({ body, valid } = formStagePose(cmd, x));
      break;
    case "stage_clear":
      ({ body, valid } = formStageClear(cmd, x));
      break;
    case "slot_fx":
      ({ body, valid } = formSlotFx(cmd, x));
      break;
    case "stage_close":
      ({ body, valid } = formStageClose(cmd, x));
      break;
    case "m7":
      ({ body, valid } = formM7(cmd, x));
      break;
    case "m7_view":
      ({ body, valid } = formM7View(cmd, x));
      break;
    case "m7_rot":
      ({ body, valid } = formM7Rot(cmd, x));
      break;
    case "m7_turn":
      ({ body, valid } = formM7Turn(cmd, x));
      break;
    case "vig_show":
      ({ body, valid } = formVigShow(cmd, x));
      break;
    case "vig_play":
      ({ body, valid } = formVigPlay(cmd, x));
      break;
    case "anim_play":
      ({ body, valid } = formAnimPlay(cmd, x));
      break;
    case "anim_stop":
      ({ body, valid } = formAnimStop(cmd, x));
      break;
    case "vig_hide":
      ({ body, valid } = formVigHide(cmd, x));
      break;
    case "sfx":
      ({ body, valid } = formSfx(cmd, x));
      break;
    case "bgm":
      ({ body, valid } = formBgm(cmd, x));
      break;
    case "weather":
      ({ body, valid } = formWeather(cmd, x));
      break;
    case "flash":
      ({ body, valid } = formFlash(cmd, x));
      break;
    case "call_fn":
      ({ body, valid } = formCallFn(cmd, x));
      break;
    case "ret_fn":
      ({ body, valid } = formRetFn(cmd, x));
      break;
    case "call":
      ({ body, valid } = formCall(cmd, x));
      break;
    case "db_read":
      ({ body, valid } = formDbRead(cmd, x));
      break;
    case "shake":
      ({ body, valid } = formShake(cmd, x));
      break;
    case "warp":
      ({ body, valid } = formWarp(cmd, x));
      break;
    case "face":
      ({ body, valid } = formFace(cmd, x));
      break;
  }

  return (
    <div className="evedit-form">
      {body}
      <div className="row">
        <button disabled={!valid} onClick={props.onOk}>
          OK
        </button>
        <button onClick={props.onCancel}>Annuler</button>
      </div>
    </div>
  );
}
