// Event Editor façon RPG Maker 2003 : nom + pages (P4), conditions (P4),
// apparence (charset + direction + aperçu), déclencheur, mouvement (P4),
// et la liste de commandes « Contenu » (@>) avec branches imbriquées
// (choix, conditions). Les commandes sont compilées par datagen vers la VM.

import { useEffect, useRef, useState } from "react";
import type { TextEntry, Command, Direction, EventPage, EventPriority, GameEvent, MoveType, Scene, ScreenTrans, VarOp, VarSource, TintPreset, FnSig, ValueSrc } from "../types";
import { DIRECTIONS, TRANS_OPTIONS, eventFrame } from "../types";
import EventCommandPicker from "./EventCommandPicker";
import VarListModal, { type VarKind } from "./VarListModal";
import MoveRouteModal from "./MoveRouteModal";
import GraphicPickerModal from "./GraphicPickerModal";
import type { Database } from "../db";

// Sélecteur de transition d'écran (S18) — warps et écrans composés.
// « fade » (défaut) n'est pas écrit dans le JSON (champ absent).
function TransSelect(props: {
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
  // T4 — apparence tile : chipset de la scène + ids de la couche haute
  tilesetBmp?: ImageBitmap | null;
  upperCells?: number[];
  blockNames: string[];
  // charsets déjà affichés par la scène (héros + AUTRES events) : sert à
  // avertir dès qu'une apparence ferait dépasser les 5 charsets/scène
  usedBlocks: number[];
  sprites: ImageBitmap | null;
  labels: string[]; // labels du script manuel (champ avancé)
  switchNames: string[]; // noms des switches (project.json)
  varNames: string[]; // noms des variables 16-bit
  // libellés des ENTRÉES acteur de la scène (une par page d'event) —
  // cibles de « Déplacer un event » et « Tourner un event »
  entryNames: string[];
  charsetNames: string[]; // noms des blocs (pas gfx des itinéraires)
  commonNames: string[];
  fnSigs?: FnSig[]; // F1 — fonctions du projet (Tools > Fonctions)
  // F1 — paramètres de la FONCTION dont on édite le corps. Vide ou
  // absent ailleurs : c'est ce qui décide si « Paramètre » est une
  // source proposée, et sur quels noms.
  fnParams?: string[]; // noms des common events (v0.16)
  db: Database | null; // database du projet (commande db_read, v0.17)
  uiWidgets: string[]; // racines du layout (commande ui_show, Ph. 12)
  uiStyles: string[]; // styles de dialogue (S1) — champ style de msg/choice
  texts: TextEntry[]; // catalogue Tools > Textes (msg par référence, T2)
  pictures: string[]; // stems des images (S3) — commande pic_show
  tintPresets: TintPreset[]; // presets de teinte du projet (S12b)
  soundNames: string[]; // stems des sons du projet (B1)
  musicNames: string[]; // stems des musiques du projet (B1)
  vigNames: string[]; // stems des vignettes (B5)
  animNames: string[]; // noms des animations image par image (A1)
  screenNames: string[]; // écrans composés (B6bis)
  screenScriptNames?: string[]; // scripts de l'écran courant (B6bis-2)
  onTintPresets: (list: TintPreset[]) => void; // remplace la liste (créer/supprimer)
  onRenameVars: (switches: string[], variables: string[]) => void;
  onSave: (ev: GameEvent) => void;
  onClose: () => void;
}

// Une ligne affichée de la liste Contenu. path = adresse de la commande
// dans l'arbre ("2", "2.o0.1", "3.t.0", "3.e.1") ; les lignes "fin de
// liste" (insertion en queue) ont l'index length.
interface Line {
  path: string;
  depth: number;
  label: string;
  branch?: boolean; // ligne de branche ( : Quand [Oui] ) — non éditable
  comment?: boolean; // commande « Commentaire » — style vert RM2003
}

// suffixe de transition des commandes picture (S7) : dur 0 / fade false
// = instantané, 16 = défaut (rien à dire), sinon la durée
function picDurLabel(dur?: number, fade?: boolean): string {
  const d = fade === false && dur === undefined ? 0 : dur ?? 16;
  if (d === 0) return " (instantané)";
  return d === 16 ? "" : ` (fondu ${d}f)`;
}

// F1 — libellé court d'une valeur d'entrée, pour les résumés de ligne.
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
      const src = c.from === "var" ? `variable [${c.value}]`
        : c.from === "hero_x" ? "X du héros"
        : c.from === "hero_y" ? "Y du héros"
        : c.from === "timer" ? "le timer"
        : c.from === "scene" ? "n° de scène" : String(c.value);
      return c.op === "rand"
        ? `Variable [${c.n}] = hasard 0..${src}`
        : `Variable [${c.n}] ${c.op}= ${src}`;
    }
    case "if_sw":
      return `Condition : si switch [${c.n}] est ${c.on ? "ON" : "OFF"}`;
    case "if_var":
      return `Condition : si variable [${c.n}] ${c.op} ${c.value}`;
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

// Titre de la fenêtre d'options d'une commande (mêmes libellés que le
// sélecteur par onglets)
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
  out.push({ path: base + cmds.length, depth, label: "" }); // queue de liste
}

// Résout la LISTE contenant la commande désignée par path, et son index.
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
        i++; // consomme le sélecteur de branche
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

// Éditeur de liste de commandes — la colonne « Contenu » (@>) avec ses
// fenêtres (sélecteur par onglets, options, listes de variables, menu
// contextuel, Ctrl+C/V/Suppr). Partagé entre l'Event Editor et la fenêtre
// Common events (v0.16). La liste reçue est MUTÉE EN PLACE ; commit()
// prévient le parent après chaque changement. Remonter le composant
// (key=) quand la liste affichée change d'identité.
export function CommandListEditor(props: {
  cmds: Command[];
  commit: () => void;
  shortcutsOff?: boolean; // sous-fenêtre du parent ouverte : couper le clavier
  sceneNames: string[];
  scenes: Record<string, Scene>;
  switchNames: string[];
  varNames: string[];
  entryNames: string[];
  charsetNames: string[];
  commonNames: string[];
  fnSigs?: FnSig[]; // F1 — fonctions du projet (Tools > Fonctions)
  // F1 — paramètres de la FONCTION dont on édite le corps. Vide ou
  // absent ailleurs : c'est ce qui décide si « Paramètre » est une
  // source proposée, et sur quels noms.
  fnParams?: string[];
  db: Database | null;
  uiWidgets: string[];
  uiStyles: string[];
  texts: TextEntry[]; // catalogue Tools > Textes (msg par référence, T2)
  pictures: string[];
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
  const [form, setForm] = useState<Command | null>(null); // en cours d'édition
  const [formIsNew, setFormIsNew] = useState(false);
  const [picking, setPicking] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [varPick, setVarPick] = useState<{ kind: VarKind; current: number; cb: (n: number) => void } | null>(null);
  const [clipCmd, setClipCmd] = useState<Command | null>(null);

  const lines: Line[] = [];
  flatten(cmds, "", 0, lines, props.commonNames, (props.fnSigs ?? []).map((f) => f.name));

  // Commande à ce chemin, ou null si la ligne est vide (queue de liste)
  function cmdAt(path: string): Command | null {
    const line = lines.find((l) => l.path === path);
    if (!line || line.branch) return null;
    const { list, index } = resolve(cmds, path);
    return list[index] ?? null;
  }

  // Ouvre le sélecteur de commandes pour insérer AVANT la ligne visée
  function openPicker(path: string) {
    setSel(path);
    setForm(null);
    setPicking(true);
  }

  // Ouvre la fenêtre d'options de la commande de cette ligne
  function openEditor(path: string) {
    const c = cmdAt(path);
    if (!c) return;
    setSel(path);
    setPicking(false);
    setForm(structuredClone(c));
    setFormIsNew(false);
  }

  // Ctrl+C copie la commande sélectionnée, Ctrl+V l'insère à la ligne
  // courante, Suppr la supprime — inactifs quand un champ a le focus ou
  // qu'une sous-fenêtre est ouverte (demande utilisateur).
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
        return { c: "if_var", n: 0, op: "==", value: 1, then: [], else: [] };
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
        // Un argument par parametre des le depart : datagen refuse un
        // appel mal dimensionne, autant ne pas laisser l'auteur
        // fabriquer ce cas.
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
              // ligne pleine : on édite ; ligne vide : on choisit une
              // commande à insérer (comme RM2003)
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
              db={props.db}
              uiWidgets={props.uiWidgets}
              uiStyles={props.uiStyles}
              texts={props.texts}
              pictures={props.pictures}
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
  // page éditée : 0 = champs plats de l'event (page 1), k>0 = extraPages[k-1]
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
  // fenêtre Switches/Variables ouverte depuis les conditions de page (…)
  const [varPick, setVarPick] = useState<{ kind: VarKind; current: number; cb: (n: number) => void } | null>(null);
  // fenêtre Itinéraire de la ROUTE CUSTOM de la page (v0.14)
  const [pageRouteOpen, setPageRouteOpen] = useState(false);
  // fenêtre Apparence façon RM2003 (T3)
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
                style={k === page ? { background: "#31547a" } : undefined}
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
            >
              ＋ page
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
            >
              🗑 page
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
              db={props.db}
              uiWidgets={props.uiWidgets}
              uiStyles={props.uiStyles}
              texts={props.texts}
              pictures={props.pictures}
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

// Formulaire des paramètres d'une commande (zone sous la liste, façon
// F1 — « source + valeur », le même bloc partout : argument d'appel,
// valeur rendue. « Paramètre » n'apparaît que dans le corps d'une
// fonction, sinon il désignerait un cadre qui n'existe pas (datagen le
// refuse aussi, mais mieux vaut ne pas le proposer du tout).
function ValueSourceFields(props: {
  v: ValueSrc;
  fnParams?: string[];
  onChange: (v: ValueSrc) => void;
}) {
  const { v } = props;
  const params = props.fnParams ?? [];
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
          <option value="ret">Résultat du dernier appel</option>
        </select>
      </label>
      {from === "param" ? (
        <label>
          Paramètre
          <select
            value={v.value}
            onChange={(e) => props.onChange({ ...v, value: Number(e.target.value) })}
          >
            {params.map((pname, k) => (
              <option key={k} value={k}>
                {k + 1}. {pname || "sans nom"}
              </option>
            ))}
          </select>
        </label>
      ) : numeric ? (
        <label>
          {from === "var" ? "N° de variable" : "Valeur"}
          <input
            type="number"
            min={from === "var" ? 0 : -32768}
            max={from === "var" ? 255 : 65535}
            value={v.value}
            onChange={(e) => props.onChange({ ...v, value: Number(e.target.value) })}
          />
        </label>
      ) : null}
    </>
  );
}

// double-clic RM2003)
function CommandForm(props: {
  cmd: Command;
  sceneNames: string[];
  scenes: Record<string, Scene>;
  switchNames: string[];
  varNames: string[];
  entryNames: string[];
  charsetNames: string[];
  commonNames: string[];
  fnSigs?: FnSig[]; // F1 — fonctions du projet (Tools > Fonctions)
  // F1 — paramètres de la FONCTION dont on édite le corps. Vide ou
  // absent ailleurs : c'est ce qui décide si « Paramètre » est une
  // source proposée, et sur quels noms.
  fnParams?: string[];
  uiWidgets: string[];
  uiStyles: string[];
  texts: TextEntry[];
  pictures: string[];
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
}) {
  const { cmd, onChange } = props;
  // fenêtre Itinéraire (commande « Déplacer un event »)
  const [routeOpen, setRouteOpen] = useState(false);
  // nom du preset de teinte à enregistrer (S12b)
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

  // sélecteur de boîte de dialogue (S1) — affiché seulement si le projet
  // a des styles ; absent = la boîte par défaut (toujours là)
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

  let body = null;
  let valid = true;
  switch (cmd.c) {
    case "msg": {
      const fromCat = cmd.text_ref !== undefined;
      const catEntry = fromCat
        ? props.texts.find((t) => t.name === cmd.text_ref)
        : undefined;
      valid = fromCat ? !!catEntry : cmd.text.trim().length > 0;
      body = (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={fromCat}
              onChange={(e) => {
                if (e.target.checked)
                  onChange({ ...cmd, text_ref: props.texts[0]?.name ?? "" });
                else {
                  const { text_ref: _drop, ...rest } = cmd;
                  onChange(rest);
                }
              }}
            />
            Texte du catalogue (Tools → Textes) — modifiable au catalogue
            sans retoucher l'event
          </label>
          {fromCat ? (
            <>
              <label>
                Texte
                <select
                  value={cmd.text_ref ?? ""}
                  onChange={(e) => onChange({ ...cmd, text_ref: e.target.value })}
                >
                  {props.texts.length === 0 && (
                    <option value="">(catalogue vide)</option>
                  )}
                  {props.texts.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                      {t.cat ? ` — ${t.cat}` : ""}
                    </option>
                  ))}
                  {cmd.text_ref && !catEntry && (
                    <option value={cmd.text_ref}>{cmd.text_ref} (?)</option>
                  )}
                </select>
              </label>
              {catEntry ? (
                <span className="hint">« {catEntry.text} »</span>
              ) : cmd.text_ref ? (
                <span className="hint">
                  ⚠ texte « {cmd.text_ref} » introuvable au catalogue
                </span>
              ) : null}
            </>
          ) : (
            <label>
              Texte du message
              <textarea
                rows={3}
                value={cmd.text}
                autoFocus
                onChange={(e) => onChange({ ...cmd, text: e.target.value })}
              />
            </label>
          )}
          <span className="hint">
            {"Codes : \\v[n] variable · \\s[n] vitesse (frames/caractère, 0 = instantané) · \\. pause courte · \\| pause longue · \\! attendre A · \\^ ferme sans appui · \\>…\\< bloc instantané · \\\\ backslash"}
          </span>
          {styleField(cmd, (s) => onChange({ ...cmd, style: s }))}
        </>
      );
      break;
    }
    case "choice":
      valid = cmd.options.length >= 2 && cmd.options.every((o) => o.text.trim());
      body = (
        <>
          {cmd.options.map((o, i) => (
            <div className="row" key={i}>
              <label style={{ flex: 1 }}>
                Choix {i + 1}
                <input
                  value={o.text}
                  onChange={(e) => {
                    const options = cmd.options.map((x, j) =>
                      j === i ? { ...x, text: e.target.value } : x
                    );
                    onChange({ ...cmd, options });
                  }}
                />
              </label>
              <button
                className="browse danger"
                disabled={cmd.options.length <= 2}
                title="Retirer ce choix (et ses commandes)"
                onClick={() => onChange({ ...cmd, options: cmd.options.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            disabled={cmd.options.length >= 4}
            onClick={() => onChange({ ...cmd, options: [...cmd.options, { text: "", do: [] }] })}
          >
            + Ajouter un choix
          </button>
          <p className="hint">Les commandes de chaque branche s'ajoutent ensuite sous « : Quand […] ».</p>
          {styleField(cmd, (s) => onChange({ ...cmd, style: s }))}
        </>
      );
      break;
    case "set":
    case "add":
      valid = varOk(cmd.var);
      body = (
        <div className="row">
          {varField(cmd.var, (v) => onChange({ ...cmd, var: v }))}
          <label>
            {cmd.c === "set" ? "Valeur (=)" : "Ajouter (+)"}
            <input
              type="number"
              min={0}
              max={255}
              value={cmd.value}
              onChange={(e) => onChange({ ...cmd, value: Number(e.target.value) })}
            />
          </label>
        </div>
      );
      break;
    case "if":
      valid = varOk(cmd.var);
      body = (
        <div className="row">
          {varField(cmd.var, (v) => onChange({ ...cmd, var: v }))}
          <label>
            Opérateur
            <select
              value={cmd.op}
              onChange={(e) => onChange({ ...cmd, op: e.target.value as "==" | "!=" | ">=" })}
            >
              <option value="==">=</option>
              <option value="!=">≠</option>
              <option value=">=">≥</option>
            </select>
          </label>
          <label>
            Valeur
            <input
              type="number"
              min={0}
              max={255}
              value={cmd.value}
              onChange={(e) => onChange({ ...cmd, value: Number(e.target.value) })}
            />
          </label>
        </div>
      );
      break;
    case "switch":
      valid = cmd.n >= 0 && cmd.n < 512;
      body = (
        <div className="row">
          <label>
            Switch (0-511)
            <span className="row" style={{ gap: 4 }}>
              <input
                type="number" min={0} max={511} value={cmd.n} autoFocus
                onChange={(e) => onChange({ ...cmd, n: Number(e.target.value) })}
              />
              <button className="browse" title="Choisir dans la liste"
                onClick={() => props.onPickVar("switch", cmd.n, (n) => onChange({ ...cmd, n }))}>…</button>
            </span>
            <span className="hint">{props.switchNames[cmd.n] || ""}</span>
          </label>
          <label>
            État
            <select
              value={cmd.on ? "on" : "off"}
              onChange={(e) => onChange({ ...cmd, on: e.target.value === "on" })}
            >
              <option value="on">ON</option>
              <option value="off">OFF</option>
            </select>
          </label>
        </div>
      );
      break;
    case "var":
      valid = cmd.n >= 0 && cmd.n < 256 && cmd.value >= -32768 && cmd.value <= 65535;
      body = (
        <div className="row" style={{ flexWrap: "wrap" }}>
          <label>
            Variable (0-255)
            <span className="row" style={{ gap: 4 }}>
              <input
                type="number" min={0} max={255} value={cmd.n} autoFocus
                onChange={(e) => onChange({ ...cmd, n: Number(e.target.value) })}
              />
              <button className="browse" title="Choisir dans la liste"
                onClick={() => props.onPickVar("var", cmd.n, (n) => onChange({ ...cmd, n }))}>…</button>
            </span>
            <span className="hint">{props.varNames[cmd.n] || ""}</span>
          </label>
          <label>
            Opération
            <select
              value={cmd.op}
              onChange={(e) => onChange({ ...cmd, op: e.target.value as VarOp })}
            >
              <option value="=">= (affecter)</option>
              <option value="+">+ (ajouter)</option>
              <option value="-">− (soustraire)</option>
              <option value="*">× (multiplier)</option>
              <option value="/">÷ (diviser)</option>
              <option value="%">mod (reste)</option>
              <option value="rand">hasard 0..N</option>
            </select>
          </label>
          <label>
            Source
            <select
              value={cmd.from ?? "const"}
              onChange={(e) => {
                const from = e.target.value as VarSource;
                onChange({ ...cmd, from: from === "const" ? undefined : from });
              }}
            >
              <option value="const">Constante</option>
              <option value="var">Une variable</option>
              <option value="hero_x">X du héros (tiles)</option>
              <option value="hero_y">Y du héros (tiles)</option>
              <option value="timer">Timer (secondes)</option>
              <option value="scene">N° de la scène courante</option>
              {(props.fnParams?.length ?? 0) > 0 && (
                <option value="param">Un paramètre (F1)</option>
              )}
              <option value="ret">Résultat du dernier appel (F1)</option>
            </select>
          </label>
          {cmd.from === "param" ? (
            <label>
              Paramètre
              <select
                value={cmd.value}
                onChange={(e) => onChange({ ...cmd, value: Number(e.target.value) })}
              >
                {(props.fnParams ?? []).map((pname, k) => (
                  <option key={k} value={k}>
                    {k + 1}. {pname || "sans nom"}
                  </option>
                ))}
              </select>
            </label>
          ) : (cmd.from ?? "const") === "const" || cmd.from === "var" ? (
            <label>
              {cmd.from === "var" ? "N° de variable source" : "Valeur"}
              <input
                type="number" min={cmd.from === "var" ? 0 : -32768}
                max={cmd.from === "var" ? 255 : 65535} value={cmd.value}
                onChange={(e) => onChange({ ...cmd, value: Number(e.target.value) })}
              />
            </label>
          ) : null}
        </div>
      );
      break;
    case "if_sw":
      valid = cmd.n >= 0 && cmd.n < 512;
      body = (
        <div className="row">
          <label>
            Switch (0-511)
            <span className="row" style={{ gap: 4 }}>
              <input
                type="number" min={0} max={511} value={cmd.n} autoFocus
                onChange={(e) => onChange({ ...cmd, n: Number(e.target.value) })}
              />
              <button className="browse" title="Choisir dans la liste"
                onClick={() => props.onPickVar("switch", cmd.n, (n) => onChange({ ...cmd, n }))}>…</button>
            </span>
            <span className="hint">{props.switchNames[cmd.n] || ""}</span>
          </label>
          <label>
            Est
            <select
              value={cmd.on ? "on" : "off"}
              onChange={(e) => onChange({ ...cmd, on: e.target.value === "on" })}
            >
              <option value="on">ON</option>
              <option value="off">OFF</option>
            </select>
          </label>
        </div>
      );
      break;
    case "if_var":
      valid = cmd.n >= 0 && cmd.n < 256 && cmd.value >= 0 && cmd.value <= 65535;
      body = (
        <div className="row">
          <label>
            Variable (0-255)
            <span className="row" style={{ gap: 4 }}>
              <input
                type="number" min={0} max={255} value={cmd.n} autoFocus
                onChange={(e) => onChange({ ...cmd, n: Number(e.target.value) })}
              />
              <button className="browse" title="Choisir dans la liste"
                onClick={() => props.onPickVar("var", cmd.n, (n) => onChange({ ...cmd, n }))}>…</button>
            </span>
            <span className="hint">{props.varNames[cmd.n] || ""}</span>
          </label>
          <label>
            Opérateur
            <select
              value={cmd.op}
              onChange={(e) => onChange({ ...cmd, op: e.target.value as "==" | "!=" | ">=" })}
            >
              <option value="==">=</option>
              <option value="!=">≠</option>
              <option value=">=">≥</option>
            </select>
          </label>
          <label>
            Valeur
            <input
              type="number" min={0} max={65535} value={cmd.value}
              onChange={(e) => onChange({ ...cmd, value: Number(e.target.value) })}
            />
          </label>
        </div>
      );
      break;
    case "route":
      valid = cmd.steps.length > 0;
      body = (
        <>
          <span className="hint">
            {cmd.event < 0 ? "Cet event" : props.entryNames[cmd.event] ?? `event ${cmd.event}`} —{" "}
            {cmd.steps.length} pas{cmd.repeat ? ", répété" : ""}
            {cmd.skip ? ", ignore si bloqué" : ""}. L'itinéraire part en
            tâche de fond : le séquencer avec « Attendre la fin des
            déplacements ».
          </span>
          <button onClick={() => setRouteOpen(true)}>Modifier l'itinéraire…</button>
          {routeOpen && (
            <MoveRouteModal
              cmd={cmd}
              eventNames={props.entryNames}
              switchNames={props.switchNames}
              charsetNames={props.charsetNames}
              onClose={() => setRouteOpen(false)}
              onOk={(c) => {
                onChange(c);
                setRouteOpen(false);
              }}
            />
          )}
        </>
      );
      break;
    case "wait_route":
      body = (
        <span className="hint">
          Bloque le script jusqu'à la fin de tous les itinéraires (les
          itinéraires « répétés » ne sont pas attendus).
        </span>
      );
      break;
    case "wait":
      valid = cmd.frames >= 1 && cmd.frames <= 255;
      body = (
        <label>
          Durée (frames, 60 = 1 seconde)
          <input
            type="number" min={1} max={255} value={cmd.frames} autoFocus
            onChange={(e) => onChange({ ...cmd, frames: Number(e.target.value) })}
          />
        </label>
      );
      break;
    case "timer":
      valid = cmd.op !== "start" || ((cmd.secs ?? 0) >= 1 && (cmd.secs ?? 0) <= 5999);
      body = (
        <div className="row">
          <label>
            Action
            <select
              value={cmd.op}
              onChange={(e) => onChange({ ...cmd, op: e.target.value as "start" | "stop" | "show" | "hide" })}
            >
              <option value="start">Régler et démarrer</option>
              <option value="stop">Arrêter</option>
              <option value="show">Afficher (coin haut-droit)</option>
              <option value="hide">Cacher</option>
            </select>
          </label>
          {cmd.op === "start" && (
            <label>
              Secondes (1-5999)
              <input
                type="number" min={1} max={5999} value={cmd.secs ?? 60}
                onChange={(e) => onChange({ ...cmd, secs: Number(e.target.value) })}
              />
            </label>
          )}
        </div>
      );
      break;
    case "campan":
      body = (
        <div className="row">
          <label>
            Tile x
            <input type="number" min={0} max={254} value={cmd.x}
              onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })} />
          </label>
          <label>
            Tile y
            <input type="number" min={0} max={254} value={cmd.y}
              onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })} />
          </label>
          <label>
            Vitesse (px/frame)
            <input type="number" min={1} max={8} value={cmd.speed}
              onChange={(e) => onChange({ ...cmd, speed: Number(e.target.value) })} />
          </label>
          <span className="hint">Non bloquant — enchaîner avec « Attendre la caméra ».</span>
        </div>
      );
      break;
    case "cam_return":
      body = (
        <label>
          Vitesse (px/frame)
          <input type="number" min={1} max={8} value={cmd.speed}
            onChange={(e) => onChange({ ...cmd, speed: Number(e.target.value) })} />
        </label>
      );
      break;
    case "wait_cam":
      body = <span className="hint">Bloque le script jusqu'à la fin du pan caméra.</span>;
      break;
    case "loop":
      body = (
        <span className="hint">
          Les commandes ajoutées entre « Boucle » et « : Fin de boucle »
          se répètent pour toujours — en sortir avec « Sortir de la
          boucle » (ou Téléporter le héros).
        </span>
      );
      break;
    case "break":
      body = (
        <span className="hint">
          Saute à la fin de la boucle la plus proche. Hors d'une boucle,
          datagen refusera la scène.
        </span>
      );
      break;
    case "rem":
      body = (
        <label>
          Commentaire (jamais affiché en jeu)
          <textarea
            rows={3}
            value={cmd.text}
            autoFocus
            onChange={(e) => onChange({ ...cmd, text: e.target.value })}
          />
        </label>
      );
      break;
    case "hero_loc":
    case "warp_var": {
      const triple: { key: "vs" | "vx" | "vy"; label: string }[] = [
        { key: "vs", label: "Variable scène" },
        { key: "vx", label: "Variable X (tiles)" },
        { key: "vy", label: "Variable Y (tiles)" },
      ];
      valid = triple.every((t) => cmd[t.key] >= 0 && cmd[t.key] < 256);
      body = (
        <>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {triple.map((t) => (
              <label key={t.key}>
                {t.label}
                <span className="row" style={{ gap: 4 }}>
                  <input
                    type="number" min={0} max={255} value={cmd[t.key]}
                    onChange={(e) => onChange({ ...cmd, [t.key]: Number(e.target.value) })}
                  />
                  <button className="browse" title="Choisir dans la liste"
                    onClick={() => props.onPickVar("var", cmd[t.key], (n) => onChange({ ...cmd, [t.key]: n }))}>…</button>
                </span>
                <span className="hint">{props.varNames[cmd[t.key]] || ""}</span>
              </label>
            ))}
            {cmd.c === "warp_var" && (
              <TransSelect value={cmd.trans} onChange={(t) => onChange({ ...cmd, trans: t })} />
            )}
          </div>
          <span className="hint">
            {cmd.c === "hero_loc"
              ? "Écrit la scène courante et la tile du héros dans ces trois variables (à rappeler avec « Téléporter aux variables »)."
              : "Téléporte le héros à la scène et la tile lues dans ces trois variables — termine le script, comme un warp."}
          </span>
        </>
      );
      break;
    }
    case "setpos":
      valid = cmd.x >= 0 && cmd.x <= 254 && cmd.y >= 0 && cmd.y <= 254;
      body = (
        <div className="row" style={{ flexWrap: "wrap" }}>
          <label style={{ flex: 2 }}>
            Event
            <select
              value={cmd.event}
              onChange={(e) => onChange({ ...cmd, event: Number(e.target.value) })}
            >
              <option value={-1}>Cet event</option>
              {props.entryNames.map((n, i) => (
                <option key={i} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Coordonnées
            <select
              value={cmd.from}
              onChange={(e) => onChange({ ...cmd, from: e.target.value as "const" | "vars" })}
            >
              <option value="const">Constantes (tiles)</option>
              <option value="vars">Dans des variables</option>
            </select>
          </label>
          <label>
            {cmd.from === "vars" ? "Variable X" : "x"}
            <span className="row" style={{ gap: 4 }}>
              <input
                type="number" min={0} max={cmd.from === "vars" ? 255 : 254} value={cmd.x}
                onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })}
              />
              {cmd.from === "vars" && (
                <button className="browse" title="Choisir dans la liste"
                  onClick={() => props.onPickVar("var", cmd.x, (n) => onChange({ ...cmd, x: n }))}>…</button>
              )}
            </span>
          </label>
          <label>
            {cmd.from === "vars" ? "Variable Y" : "y"}
            <span className="row" style={{ gap: 4 }}>
              <input
                type="number" min={0} max={cmd.from === "vars" ? 255 : 254} value={cmd.y}
                onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })}
              />
              {cmd.from === "vars" && (
                <button className="browse" title="Choisir dans la liste"
                  onClick={() => props.onPickVar("var", cmd.y, (n) => onChange({ ...cmd, y: n }))}>…</button>
              )}
            </span>
          </label>
        </div>
      );
      break;
    case "swappos":
      valid = cmd.a !== cmd.b;
      body = (
        <div className="row">
          {(["a", "b"] as const).map((k) => (
            <label key={k} style={{ flex: 1 }}>
              {k === "a" ? "Event A" : "Event B"}
              <select
                value={cmd[k]}
                onChange={(e) => onChange({ ...cmd, [k]: Number(e.target.value) })}
              >
                <option value={-1}>Cet event</option>
                {props.entryNames.map((n, i) => (
                  <option key={i} value={i}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      );
      break;
    case "key_input": {
      valid = cmd.keys.length > 0;
      const KEY_NAMES: [number, string][] = [
        [1, "Bas (1)"], [2, "Gauche (2)"], [3, "Droite (3)"], [4, "Haut (4)"],
        [5, "A — valider (5)"], [6, "B — annuler (6)"], [7, "Y (7)"], [8, "X (8)"],
        [9, "L (9)"], [10, "R (10)"], [11, "Select (11)"], [12, "Start (12)"],
      ];
      body = (
        <>
          <label>
            Variable destination (reçoit le code, 0 = aucune touche)
            <div className="row" style={{ gap: 4 }}>
              <input type="number" min={0} max={255} value={cmd.var} autoFocus
                onChange={(e) => onChange({ ...cmd, var: Number(e.target.value) })} />
              <button className="browse"
                onClick={() => props.onPickVar("var", cmd.var, (n) => onChange({ ...cmd, var: n }))}>
                …
              </button>
            </div>
            <span className="hint">{props.varNames[cmd.var] || ""}</span>
          </label>
          <label className="checkline">
            <input type="checkbox" checked={cmd.wait}
              onChange={(e) => onChange({ ...cmd, wait: e.target.checked })} />
            Attendre l'appui d'une touche (sinon : lecture immédiate)
          </label>
          <fieldset className="evedit-box">
            <legend>Touches autorisées</legend>
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              {KEY_NAMES.map(([code, name]) => (
                <label className="checkline" key={code}>
                  <input type="checkbox" checked={cmd.keys.includes(code)}
                    onChange={(e) =>
                      onChange({
                        ...cmd,
                        keys: e.target.checked
                          ? [...cmd.keys, code].sort((a, b) => a - b)
                          : cmd.keys.filter((k) => k !== code),
                      })
                    } />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
          <span className="hint">
            Façon RM2003 : le code de la touche est écrit dans la variable.
            En « attendre », le script bloque jusqu'à un appui NEUF d'une
            touche cochée.
          </span>
        </>
      );
      break;
    }
    case "sysmenu":
      body = (
        <span className="hint">
          Ouvre le menu Système (sauvegarder/charger) quand le script se
          termine. Le mapping START en dur a été retiré : mappe ta touche
          avec « Touche pressée » + une condition, ou appelle cette
          commande où tu veux.
        </span>
      );
      break;
    case "pic_show": {
      valid = cmd.pic_var !== undefined || cmd.pic !== "";
      const posMode =
        cmd.x_var !== undefined
          ? "vars"
          : cmd.x !== undefined || cmd.y !== undefined
            ? "xy"
            : "center";
      const cut = (cmd.fade === false && cmd.dur === undefined) || cmd.dur === 0;
      body = (
        <>
          <label>
            Image (Gestionnaire de ressources → Picture)
            <select
              value={cmd.pic} autoFocus
              onChange={(e) => onChange({ ...cmd, pic: e.target.value })}
            >
              <option value="">(choisir)</option>
              {props.pictures.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
              {cmd.pic && !props.pictures.includes(cmd.pic) && (
                <option value={cmd.pic}>{cmd.pic} (?)</option>
              )}
            </select>
          </label>
          <label>
            Position à l'écran
            <select
              value={posMode}
              onChange={(e) => {
                const m = e.target.value;
                if (m === "center")
                  onChange({ ...cmd, x: undefined, y: undefined, x_var: undefined, y_var: undefined });
                else if (m === "xy")
                  onChange({ ...cmd, x: cmd.x ?? 0, y: cmd.y ?? 0, x_var: undefined, y_var: undefined });
                else
                  onChange({ ...cmd, x: undefined, y: undefined, x_var: cmd.x_var ?? 0, y_var: cmd.y_var ?? 1 });
              }}
            >
              <option value="center">Centrée</option>
              <option value="xy">Position X/Y (pixels)</option>
              <option value="vars">Position lue dans des variables</option>
            </select>
          </label>
          {posMode === "xy" && (
            <div className="row">
              <label>
                X (0-255)
                <input type="number" min={0} max={255} value={cmd.x ?? 0}
                  onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })} />
              </label>
              <label>
                Y (0-216)
                <input type="number" min={0} max={216} value={cmd.y ?? 0}
                  onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })} />
              </label>
            </div>
          )}
          {posMode === "vars" && (
            <div className="row">
              <label>
                Variable X (0-255)
                <input type="number" min={0} max={255} value={cmd.x_var ?? 0}
                  onChange={(e) => onChange({ ...cmd, x_var: Number(e.target.value) })} />
              </label>
              <label>
                Variable Y (0-255)
                <input type="number" min={0} max={255} value={cmd.y_var ?? 1}
                  onChange={(e) => onChange({ ...cmd, y_var: Number(e.target.value) })} />
              </label>
            </div>
          )}
          <label>
            Transition
            <select
              value={cut ? "cut" : "fade"}
              onChange={(e) =>
                onChange({ ...cmd, fade: undefined, dur: e.target.value === "cut" ? 0 : 16 })
              }
            >
              <option value="fade">Fondu</option>
              <option value="cut">Instantanée</option>
            </select>
          </label>
          {!cut && (
            <label>
              Durée du fondu (frames — 60 = 1 seconde)
              <input type="number" min={1} max={255} value={cmd.dur ?? 16}
                onChange={(e) =>
                  onChange({ ...cmd, fade: undefined, dur: Number(e.target.value) })
                } />
            </label>
          )}
          <label>
            Mélange avec le décor
            <select
              value={cmd.blend ?? "none"}
              onChange={(e) =>
                onChange({
                  ...cmd,
                  blend:
                    e.target.value === "none"
                      ? undefined
                      : (e.target.value as "half" | "add" | "sub"),
                })
              }
            >
              <option value="none">Normal (opaque)</option>
              <option value="half">Semi-transparent (50 %)</option>
              <option value="add">Additif (lueur)</option>
              <option value="sub">Soustractif (ombre)</option>
            </select>
          </label>
          <span className="hint">
            Les messages et choix se jouent PAR-DESSUS l'image et restent
            nets même en mélange. Le mélange fond l'image avec le décor
            (circuit couleur de la console) et suspend la teinte d'écran
            le temps de l'image. Refermer avec « Effacer l'image » dans le
            même script.
          </span>
        </>
      );
      break;
    }
    case "pic_move": {
      const posMode = cmd.x_var !== undefined ? "vars" : "xy";
      body = (
        <>
          <label>
            Nouvelle position
            <select
              value={posMode}
              onChange={(e) =>
                onChange(
                  e.target.value === "vars"
                    ? { ...cmd, x: undefined, y: undefined, x_var: cmd.x_var ?? 0, y_var: cmd.y_var ?? 1 }
                    : { ...cmd, x: cmd.x ?? 0, y: cmd.y ?? 0, x_var: undefined, y_var: undefined }
                )
              }
            >
              <option value="xy">Position X/Y (pixels)</option>
              <option value="vars">Position lue dans des variables</option>
            </select>
          </label>
          {posMode === "xy" ? (
            <div className="row">
              <label>
                X (0-255)
                <input type="number" min={0} max={255} value={cmd.x ?? 0} autoFocus
                  onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })} />
              </label>
              <label>
                Y (0-216)
                <input type="number" min={0} max={216} value={cmd.y ?? 0}
                  onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })} />
              </label>
            </div>
          ) : (
            <div className="row">
              <label>
                Variable X (0-255)
                <input type="number" min={0} max={255} value={cmd.x_var ?? 0}
                  onChange={(e) => onChange({ ...cmd, x_var: Number(e.target.value) })} />
              </label>
              <label>
                Variable Y (0-255)
                <input type="number" min={0} max={255} value={cmd.y_var ?? 1}
                  onChange={(e) => onChange({ ...cmd, y_var: Number(e.target.value) })} />
              </label>
            </div>
          )}
          <label>
            Durée du déplacement (frames — 0 = immédiat, 60 = 1 seconde)
            <input type="number" min={0} max={255} value={cmd.dur ?? 30}
              onChange={(e) => onChange({ ...cmd, dur: Number(e.target.value) })} />
          </label>
          <span className="hint">
            Glisse l'image affichée vers la cible SANS bloquer le script
            (façon Move Picture RM2003) — enchaîne avec « Attendre » si tu
            veux attendre la fin. Sans image affichée : ignoré.
          </span>
        </>
      );
      break;
    }
    case "pic_hide": {
      const cut = (cmd.fade === false && cmd.dur === undefined) || cmd.dur === 0;
      body = (
        <>
          <label>
            Transition
            <select
              value={cut ? "cut" : "fade"}
              onChange={(e) =>
                onChange({ ...cmd, fade: undefined, dur: e.target.value === "cut" ? 0 : 16 })
              }
            >
              <option value="fade">Fondu</option>
              <option value="cut">Instantanée</option>
            </select>
          </label>
          {!cut && (
            <label>
              Durée du fondu (frames — 60 = 1 seconde)
              <input type="number" min={1} max={255} value={cmd.dur ?? 16}
                onChange={(e) =>
                  onChange({ ...cmd, fade: undefined, dur: Number(e.target.value) })
                } />
            </label>
          )}
          <span className="hint">
            Referme l'image et rend l'écran au jeu — carte, personnages et
            états inchangés. Sans image affichée : ignoré.
          </span>
        </>
      );
      break;
    }
    case "ui_show":
      valid = cmd.widget !== "";
      body = (
        <>
          <label>
            Widget (racines de ui/layout.toml — fenêtre UI)
            <select
              value={cmd.widget} autoFocus
              onChange={(e) => onChange({ ...cmd, widget: e.target.value })}
            >
              <option value="">(choisir)</option>
              {props.uiWidgets.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </label>
          <label>
            Action
            <select
              value={cmd.on ? "on" : "off"}
              onChange={(e) => onChange({ ...cmd, on: e.target.value === "on" })}
            >
              <option value="on">Afficher</option>
              <option value="off">Cacher</option>
            </select>
          </label>
          <span className="hint">
            Les widgets sont CACHÉS au démarrage (sauf « Visible au démarrage »
            dans la fenêtre UI) — cette commande les affiche ou les cache.
          </span>
        </>
      );
      break;
    case "list_select":
      valid = cmd.widget !== "";
      body = (
        <>
          <label>
            Widget liste (fenêtre UI — type « Liste (curseur) »)
            <select
              value={cmd.widget} autoFocus
              onChange={(e) => onChange({ ...cmd, widget: e.target.value })}
            >
              <option value="">(choisir)</option>
              {props.uiWidgets.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </label>
          <label>
            Variable destination (index choisi, 0 = premier item)
            <div className="row" style={{ gap: 4 }}>
              <input type="number" min={0} max={255} value={cmd.var}
                onChange={(e) => onChange({ ...cmd, var: Number(e.target.value) })} />
              <button className="browse"
                onClick={() => props.onPickVar("var", cmd.var, (n) => onChange({ ...cmd, var: n }))}>
                …
              </button>
            </div>
            <span className="hint">{props.varNames[cmd.var] || ""}</span>
          </label>
          <label className="checkline">
            <input type="checkbox" checked={cmd.cancel}
              onChange={(e) => onChange({ ...cmd, cancel: e.target.checked })} />
            B annule (la variable reçoit 255)
          </label>
          <label className="checkline">
            <input type="checkbox" checked={cmd.keep ?? false}
              onChange={(e) => onChange({ ...cmd, keep: e.target.checked || undefined })} />
            Laisser le widget affiché à la fermeture (multi-panneaux)
          </label>
          <label className="checkline">
            <input type="checkbox" checked={cmd.lr ?? false}
              onChange={(e) => onChange({ ...cmd, lr: e.target.checked || undefined })} />
            Gauche/Droite quittent la liste (254 = gauche, 253 = droite)
          </label>
          <span className="hint">
            BLOQUANT : le menu s'ouvre (le widget est affiché), haut/bas
            naviguent avec bouclage, A valide (index : 0 = premier item).
            Multi-panneaux : cocher les deux cases, tester 253/254 dans une
            condition et enchaîner sur la liste voisine — le widget resté
            affiché n'a plus de curseur, cacher avec « Afficher/cacher un
            widget UI » quand le menu se ferme pour de bon.
          </span>
        </>
      );
      break;
    case "scr_hide":
    case "scr_show": {
      const fr = cmd.frames ?? Math.ceil(15 / (cmd.speed || 15));
      valid = fr >= 1 && fr <= 255;
      body = (
        <>
          <div className="row">
            <label>
              Durée (frames, 60 = 1 seconde)
              <input
                type="number" min={1} max={255} value={fr} autoFocus
                onChange={(e) =>
                  onChange({ ...cmd, frames: Number(e.target.value), speed: undefined })
                }
              />
            </label>
            <TransSelect value={cmd.trans} onChange={(t) => onChange({ ...cmd, trans: t })} />
          </div>
          <span className="hint">
            {cmd.c === "scr_hide"
              ? "Cache l'écran — bloque le script jusqu'au noir complet. L'écran reste caché jusqu'à « Montrer l'écran » (un téléport le rallume)."
              : "Montre l'écran — bloque le script jusqu'à la pleine luminosité."}
          </span>
        </>
      );
      break;
    }
    case "tint":
      valid = [cmd.r, cmd.g, cmd.b].every((v) => v >= 0 && v <= 31);
      body = (
        <>
          <label>
            Preset (remplit les champs)
            <select
              value=""
              onChange={(e) => {
                const std: Record<string, { mode: "off" | "add" | "sub"; r: number; g: number; b: number }> = {
                  "*jour": { mode: "off", r: 0, g: 0, b: 0 },
                  "*matin": { mode: "sub", r: 6, g: 3, b: 0 },
                  "*soir": { mode: "sub", r: 0, g: 6, b: 14 },
                  "*nuit": { mode: "sub", r: 16, g: 12, b: 4 },
                };
                const v = e.target.value;
                if (std[v]) {
                  onChange({ ...cmd, ...std[v] });
                  return;
                }
                const p = props.tintPresets.find((t) => t.name === v);
                if (p) onChange({ ...cmd, mode: p.mode, r: p.r, g: p.g, b: p.b });
              }}
            >
              <option value="">(choisir un preset…)</option>
              <optgroup label="Standards">
                <option value="*matin">Matin (bleuté pâle)</option>
                <option value="*jour">Jour (normale)</option>
                <option value="*soir">Soir (orangé)</option>
                <option value="*nuit">Nuit (bleu sombre)</option>
              </optgroup>
              {props.tintPresets.length > 0 && (
                <optgroup label="Du projet">
                  {props.tintPresets.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <div className="row">
            <label>
              Enregistrer les valeurs comme preset
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="ex. Crépuscule violet"
                maxLength={24}
              />
            </label>
            <button
              disabled={presetName.trim() === ""}
              title="Enregistre mode + RGB actuels sous ce nom (écrase un preset du même nom) — stocké dans le projet"
              onClick={() => {
                const name = presetName.trim();
                props.onTintPresets([
                  ...props.tintPresets.filter((t) => t.name !== name),
                  { name, mode: cmd.mode, r: cmd.r, g: cmd.g, b: cmd.b },
                ]);
                setPresetName("");
              }}
            >
              💾 Enregistrer
            </button>
          </div>
          {props.tintPresets.length > 0 && (
            <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
              {props.tintPresets.map((p) => (
                <button
                  key={p.name}
                  title={`Supprimer le preset « ${p.name} » du projet`}
                  onClick={() =>
                    props.onTintPresets(props.tintPresets.filter((t) => t.name !== p.name))
                  }
                >
                  🗑 {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="row" style={{ flexWrap: "wrap" }}>
            <label>
              Mode
              <select
                value={cmd.mode}
                onChange={(e) => onChange({ ...cmd, mode: e.target.value as "off" | "add" | "sub" })}
              >
                <option value="off">Normale (retirer la teinte)</option>
                <option value="add">Éclaircir (+)</option>
                <option value="sub">Assombrir (−)</option>
              </select>
            </label>
            {cmd.mode !== "off" &&
              (["r", "g", "b"] as const).map((k) => (
                <label key={k}>
                  {k.toUpperCase()} (0-31)
                  <input
                    type="number" min={0} max={31} value={cmd[k]}
                    onChange={(e) => onChange({ ...cmd, [k]: Number(e.target.value) })}
                  />
                </label>
              ))}
          </div>
          <label>
            Transition (frames — 0 = immédiate, 180 = 3 secondes)
            <input
              type="number" min={0} max={255} value={cmd.dur ?? 0}
              onChange={(e) =>
                onChange({ ...cmd, dur: Number(e.target.value) || undefined })
              }
            />
          </label>
          <span className="hint">
            Persiste entre les scènes ; la transition graduelle (S12) est
            NON bloquante — enchaîner avec « Attendre » pour la laisser
            finir. Teinte le décor, pas les personnages ni le texte
            (limite hardware). Suspendue à l'écran pendant un mélange de
            couche d'effet ou d'image.
          </span>
        </>
      );
      break;
    case "wave": {
      body = (
        <>
          <div className="row">
            <label>
              Amplitude (px — 0 = arrêter)
              <select
                value={cmd.power}
                onChange={(e) => onChange({ ...cmd, power: Number(e.target.value) })}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7].map((v) => (
                  <option key={v} value={v}>{v === 0 ? "0 (stop)" : v}</option>
                ))}
              </select>
            </label>
            {cmd.power > 0 && (
              <label>
                Vitesse de la houle (1-8)
                <input
                  type="number" min={1} max={8} value={cmd.speed ?? 2}
                  onChange={(e) => onChange({ ...cmd, speed: Number(e.target.value) })}
                />
              </label>
            )}
          </div>
          <span className="hint">
            L'écran ondule ligne par ligne (chaleur du désert, sous l'eau,
            rêve) — non bloquant, persiste entre les scènes jusqu'à
            « 0 (stop) ». Le DÉCOR ondule ; les personnages, le texte
            et le HUD restent droits (les sprites ne passent pas par les
            scrolls — matériel). Suspendue pendant une image plein
            écran.
          </span>
        </>
      );
      break;
    }
    case "skygrad":
      body = (
        <>
          <label>
            Mode
            <select
              value={cmd.mode}
              onChange={(e) => onChange({ ...cmd, mode: e.target.value as "off" | "add" | "sub" })}
            >
              <option value="off">Retirer le dégradé</option>
              <option value="add">Éclaircir (+)</option>
              <option value="sub">Assombrir (−)</option>
            </select>
          </label>
          {cmd.mode !== "off" && (
            <>
              <div className="row">
                <span style={{ alignSelf: "center", minWidth: 110 }}>Haut de l'écran</span>
                {(["r", "g", "b"] as const).map((k) => (
                  <label key={k}>
                    {k.toUpperCase()} (0-31)
                    <input
                      type="number" min={0} max={31} value={cmd[k]}
                      onChange={(e) => onChange({ ...cmd, [k]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>
              <div className="row">
                <span style={{ alignSelf: "center", minWidth: 110 }}>Bas de l'écran</span>
                {(["r2", "g2", "b2"] as const).map((k) => (
                  <label key={k}>
                    {k[0].toUpperCase()} (0-31)
                    <input
                      type="number" min={0} max={31} value={cmd[k]}
                      onChange={(e) => onChange({ ...cmd, [k]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          <span className="hint">
            Teinte VERTICALE (coucher de soleil, aube, profondeur) : la
            couleur évolue du haut vers le bas de l'écran, ligne par
            ligne. Remplace la teinte plate — et « Teinter l'écran »
            retire le dégradé (même circuit console). Le décor est
            teinté, pas les personnages ni le texte. Persiste entre les
            scènes ; en pause pendant un mélange (couche d'effet /
            image) ou un flash. Immédiat, non bloquant, aucun coût en
            jeu (table calculée à la commande).
          </span>
        </>
      );
      break;
    case "spotlight":
      body = (
        <>
          <div className="row">
            <label>
              Rayon du cercle (px — 0 = arrêter)
              <select
                value={cmd.radius}
                onChange={(e) => onChange({ ...cmd, radius: Number(e.target.value) })}
              >
                <option value={0}>0 (arrêter)</option>
                {[24, 32, 40, 48, 64, 80, 96].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            {cmd.radius > 0 && (
              <label>
                Obscurité (1-31 — 31 = noir total)
                <input
                  type="number" min={1} max={31} value={cmd.dark ?? 31}
                  onChange={(e) => onChange({ ...cmd, dark: Number(e.target.value) })}
                />
              </label>
            )}
          </div>
          <span className="hint">
            Cercle de lumière qui SUIT le héros (grotte, nuit, torche) :
            le décor est assombri hors du cercle. Remplace la teinte et
            le dégradé — et « Teinter l'écran » retire le spotlight
            (même circuit console). Les personnages et le texte restent
            visibles partout (limite matérielle, comme la teinte).
            Immédiat, non bloquant, persiste entre les scènes.
          </span>
        </>
      );
      break;
    case "screen":
      body = (
        <>
          <div className="row">
            <label>
              Écran (Tools → Écrans composés)
              <select
                value={cmd.name}
                onChange={(e) => onChange({ ...cmd, name: e.target.value })}
              >
                <option value="">(choisir un écran…)</option>
                {props.screenNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Fondu (frames par sens)
              <input
                type="number" min={0} max={255} value={cmd.dur ?? 20}
                onChange={(e) => onChange({ ...cmd, dur: Number(e.target.value) })}
              />
            </label>
            <TransSelect value={cmd.trans} onChange={(t) => onChange({ ...cmd, trans: t })} />
          </div>
          <span className="hint">
            Ouvre l'écran composé dessiné dans Tools → Écrans composés :
            son fond, ses images posées, puis son script. Équivaut à la
            suite Ouvrir + Poser + … écrite à la main — mais composée à
            la souris. L'écran se referme par « Fermer l'écran
            composé » (dans son script, ou après).
          </span>
        </>
      );
      break;
    case "screen_call":
      body = (
        <>
          <label>
            Script de l'écran
            {props.screenScriptNames ? (
              <select
                value={cmd.script}
                onChange={(e) => onChange({ ...cmd, script: e.target.value })}
              >
                <option value="">(choisir…)</option>
                {props.screenScriptNames.slice(1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            ) : (
              <input
                value={cmd.script}
                placeholder="nom du script"
                onChange={(e) => onChange({ ...cmd, script: e.target.value })}
              />
            )}
          </label>
          <span className="hint">
            Joue un AUTRE script du même écran composé (tes
            sous-routines locales : tour_joueur, victoire…) — comme
            « Appeler un common event », mais rangé dans l'écran.
            Valable uniquement depuis un script d'écran (le build le
            vérifie).
          </span>
        </>
      );
      break;
    case "stage_open":
      body = (
        <>
          <div className="row">
            <label>
              Fond (image plein écran, opaque de préférence)
              <select
                value={cmd.pic}
                onChange={(e) => onChange({ ...cmd, pic: e.target.value })}
              >
                <option value="">(aucun — fond noir)</option>
                {props.pictures.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Fondu (frames par sens — 0 = instantané)
              <input
                type="number" min={0} max={255} value={cmd.dur ?? 20}
                onChange={(e) => onChange({ ...cmd, dur: Number(e.target.value) })}
              />
            </label>
            <TransSelect value={cmd.trans} onChange={(t) => onChange({ ...cmd, trans: t })} />
          </div>
          <span className="hint">
            Remplace la vue de la scène par un ÉCRAN COMPOSÉ : le fond
            sur une couche, jusqu'à 5 images posées par-dessus (slots),
            les dialogues et widgets par-dessus tout. C'est l'écran de
            combat façon FF (fond + monstres) — ou un plateau, une carte,
            une scène illustrée. Les personnages de la map sont cachés
            le temps de l'écran. Fermer l'écran restaure la scène ET sa
            musique (les PNJ déplacés reviennent à leur position de
            page, comme après une téléportation).
          </span>
        </>
      );
      break;
    case "stage_pose":
      body = (
        <>
          <div className="row">
            <label>
              Slot (1-5)
              <select
                value={cmd.slot}
                onChange={(e) => onChange({ ...cmd, slot: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Image (à transparence pour un monstre)
              <select
                value={cmd.pic}
                onChange={(e) => onChange({ ...cmd, pic: e.target.value })}
              >
                <option value="">(choisir une image…)</option>
                {props.pictures.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <label>
              X (px, arrondi à 8)
              <input
                type="number" min={0} max={255} step={8} value={cmd.x}
                onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })}
              />
            </label>
            <label>
              Y (px, arrondi à 8)
              <input
                type="number" min={0} max={216} step={8} value={cmd.y}
                onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })}
              />
            </label>
          </div>
          <span className="hint">
            Pose l'image sur l'écran composé, avec SA palette (une par
            slot — le clignotement d'un monstre ne touche pas les
            autres). L'image apparaît en quelques frames (transfert
            progressif), le script attend la fin. Re-poser la même
            image dans le même slot = déplacement instantané. Budget
            partagé : ~511 tuiles pour l'écran — au-delà, la pose est
            ignorée (simplifier les images, ou fermer/rouvrir).
            Éviter le chevauchement de deux images (couche unique).
          </span>
        </>
      );
      break;
    case "stage_clear":
      body = (
        <>
          <label>
            Slot à retirer (1-5)
            <select
              value={cmd.slot}
              onChange={(e) => onChange({ ...cmd, slot: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
          <span className="hint">
            Efface l'image du slot (mort d'un monstre, objet ramassé).
            Re-poser la même image plus tard ne recoûte rien.
          </span>
        </>
      );
      break;
    case "slot_fx":
      body = (
        <>
          <div className="row">
            <label>
              Slot (1-5)
              <select
                value={cmd.slot}
                onChange={(e) => onChange({ ...cmd, slot: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Effet
              <select
                value={cmd.fx}
                onChange={(e) =>
                  onChange({ ...cmd, fx: e.target.value as "restore" | "flash" | "fadeout" | "dark" })
                }
              >
                <option value="flash">Flash blanc (attaque)</option>
                <option value="fadeout">Fondu au noir (mort)</option>
                <option value="dark">Assombrir (état)</option>
                <option value="restore">Restaurer les couleurs</option>
              </select>
            </label>
            {(cmd.fx === "flash" || cmd.fx === "fadeout") && (
              <label>
                Durée (frames)
                <input
                  type="number" min={1} max={255}
                  value={cmd.frames ?? (cmd.fx === "flash" ? 6 : 30)}
                  onChange={(e) => onChange({ ...cmd, frames: Number(e.target.value) })}
                />
              </label>
            )}
          </div>
          <span className="hint">
            Manipule la PALETTE de l'image du slot — les autres images
            et le fond ne bougent pas (une palette par slot). Flash =
            le monstre attaque ou encaisse ; fondu au noir = mort
            (enchaîner avec « Retirer une image ») ; assombrir =
            poison, pierre (cumulable) ; restaurer = fin d'état. Non
            bloquant — enchaîner avec « Attendre ».
          </span>
        </>
      );
      break;
    case "stage_close":
      body = (
        <>
          <div className="row">
            <label>
              Fondu (frames par sens — 0 = instantané)
              <input
                type="number" min={0} max={255} value={cmd.dur ?? 20}
                onChange={(e) => onChange({ ...cmd, dur: Number(e.target.value) })}
              />
            </label>
            <TransSelect value={cmd.trans} onChange={(t) => onChange({ ...cmd, trans: t })} />
          </div>
          <span className="hint">
            Referme l'écran composé et restaure la scène complète :
            décor, personnages, ambiances et musique de la scène.
          </span>
        </>
      );
      break;
    case "vig_show":
      body = (
        <>
          <div className="row">
            <label>
              Slot (1-2)
              <select
                value={cmd.slot}
                onChange={(e) => onChange({ ...cmd, slot: Number(e.target.value) })}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>
            <label>
              Vignette (bande de frames 32x32)
              <select
                value={cmd.vig}
                onChange={(e) => onChange({ ...cmd, vig: e.target.value })}
              >
                <option value="">(choisir une vignette…)</option>
                {props.vigNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Ancrage
              <select
                value={cmd.anchor}
                onChange={(e) =>
                  onChange({ ...cmd, anchor: e.target.value as "screen" | "hero" })
                }
              >
                <option value="screen">Position écran</option>
                <option value="hero">Sur le héros</option>
              </select>
            </label>
          </div>
          <div className="row">
            <label>
              {cmd.anchor === "hero" ? "Décalage X (-128 à 127)" : "X (0-255)"}
              <input
                type="number" min={cmd.anchor === "hero" ? -128 : 0} max={255}
                value={cmd.x}
                onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })}
              />
            </label>
            <label>
              {cmd.anchor === "hero" ? "Décalage Y (-128 à 127)" : "Y (0-216)"}
              <input
                type="number" min={cmd.anchor === "hero" ? -128 : 0} max={255}
                value={cmd.y}
                onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })}
              />
            </label>
          </div>
          <span className="hint">
            Petite image en SPRITE (32x32), affichée frame 1 — les
            personnages restent visibles (contrairement aux pictures).
            « Sur le héros » : la vignette le suit (émoticône « ! » :
            X -8, Y -32). 2 vignettes à l'écran max. Marche sur la map
            ET sur l'écran composé (animations d'attaque par-dessus
            les monstres). Persiste entre les scènes.
          </span>
        </>
      );
      break;
    case "vig_play":
      body = (
        <>
          <div className="row">
            <label>
              Slot (1-2)
              <select
                value={cmd.slot}
                onChange={(e) => onChange({ ...cmd, slot: Number(e.target.value) })}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>
            <label>
              Mode
              <select
                value={cmd.mode}
                onChange={(e) =>
                  onChange({ ...cmd, mode: e.target.value as "loop" | "once" | "stop" })
                }
              >
                <option value="once">Une fois (puis se cache)</option>
                <option value="loop">En boucle</option>
                <option value="stop">Figer</option>
              </select>
            </label>
            {cmd.mode !== "stop" && (
              <label>
                Vitesse (frames par image)
                <input
                  type="number" min={1} max={60} value={cmd.speed ?? 8}
                  onChange={(e) => onChange({ ...cmd, speed: Number(e.target.value) })}
                />
              </label>
            )}
          </div>
          <span className="hint">
            Joue les frames de la planche. « Une fois » se cache tout
            seul à la fin — parfait pour un coup d'épée ou une
            explosion (8 frames/image = ~2 images par seconde ; 4 =
            rapide). Non bloquant — enchaîner avec « Attendre ».
          </span>
        </>
      );
      break;
    case "anim_play":
      valid = cmd.anim !== "";
      body = (
        <>
          <div className="row">
            <label>
              Animation
              <select
                value={cmd.anim}
                onChange={(e) => onChange({ ...cmd, anim: e.target.value })}
              >
                <option value="">(choisir une animation…)</option>
                {props.animNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Sur quoi
              <select
                value={cmd.anchor}
                onChange={(e) =>
                  onChange({ ...cmd, anchor: e.target.value as "screen" | "hero" | "event" })
                }
              >
                <option value="screen">L'écran</option>
                <option value="hero">Le héros</option>
                <option value="event">Un event</option>
              </select>
            </label>
            {cmd.anchor === "event" && (
              <label>
                Event
                <select
                  value={cmd.event ?? -1}
                  onChange={(e) => onChange({ ...cmd, event: Number(e.target.value) })}
                >
                  <option value={-1}>Cet event</option>
                  {props.entryNames.map((n, i) => (
                    <option key={i} value={i}>{n}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className="checkline">
            <input
              type="checkbox"
              checked={!!cmd.wait}
              onChange={(e) => onChange({ ...cmd, wait: e.target.checked })}
            />
            Attendre la fin de l'animation
          </label>
          {props.animNames.length === 0 && (
            <span className="hint">
              Aucune animation dans le projet — Tools → Animations… pour
              en composer une.
            </span>
          )}
          <span className="hint">
            Suite de cellules 32x32 avec position et son par image
            (Tools → Animations…). Passe PAR-DESSUS le décor et les
            personnages. Posée sur le héros ou sur un event, elle le
            SUIT s'il se déplace. Sans « attendre la fin », le script
            continue et l'animation vit sa vie — c'est ce qui permet
            d'animer pendant un dialogue. Une animation en boucle ne
            s'arrête jamais toute seule : « Arrêter les animations ».
          </span>
        </>
      );
      break;
    case "anim_stop":
      body = (
        <span className="hint">
          Arrête TOUTES les animations en cours et range leurs sprites.
          Sert à sortir d'une animation lancée en boucle.
        </span>
      );
      break;
    case "vig_hide":
      body = (
        <>
          <label>
            Slot à cacher (1-2)
            <select
              value={cmd.slot}
              onChange={(e) => onChange({ ...cmd, slot: Number(e.target.value) })}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
        </>
      );
      break;
    case "sfx":
      body = (
        <>
          <label>
            Son
            <select
              value={cmd.sound}
              onChange={(e) => onChange({ ...cmd, sound: e.target.value })}
            >
              <option value="">(choisir un son…)</option>
              {props.soundNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <span className="hint">
            Joue l'effet sonore par-dessus la musique (coffre, porte,
            coup…) — immédiat, non bloquant. Les sons s'importent dans
            le Gestionnaire de ressources (WAV, ~2 secondes max). Un
            son vide ou supprimé est signalé au build.
          </span>
        </>
      );
      break;
    case "bgm":
      body = (
        <>
          <label>
            Musique
            <select
              value={cmd.music}
              onChange={(e) => onChange({ ...cmd, music: e.target.value })}
            >
              <option value="">(silence)</option>
              {props.musicNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <span className="hint">
            Change la musique de fond (combat, boss, moment calme) —
            non bloquant, sans effet si c'est déjà la musique courante.
            Le changement n'est PAS instantané : le module est envoyé
            au processeur audio (jusqu'à quelques secondes pour un gros
            morceau). Au prochain changement de scène, la musique de la
            scène reprend ses droits.
          </span>
        </>
      );
      break;
    case "weather":
      body = (
        <>
          <label>
            Météo
            <select
              value={cmd.kind}
              onChange={(e) =>
                onChange({ ...cmd, kind: e.target.value as "off" | "rain" | "snow" })
              }
            >
              <option value="off">Aucune (arrêter)</option>
              <option value="rain">Pluie</option>
              <option value="snow">Neige</option>
            </select>
          </label>
          {cmd.kind !== "off" && (
            <label>
              Intensité
              <select
                value={cmd.power ?? 2}
                onChange={(e) => onChange({ ...cmd, power: Number(e.target.value) })}
              >
                <option value={1}>Légère (8 particules)</option>
                <option value={2}>Normale (16)</option>
                <option value={3}>Forte (24)</option>
              </select>
            </label>
          )}
          <span className="hint">
            Non bloquant — persiste entre les scènes jusqu'au prochain
            changement (modèle RM2003). Les particules tombent DEVANT la
            couche d'effet : orage complet = nuages sombres (soustractif)
            + Pluie + « Flash d'écran » pour les éclairs.
          </span>
        </>
      );
      break;
    case "flash":
      valid =
        [cmd.r, cmd.g, cmd.b].every((v) => v >= 0 && v <= 31) &&
        cmd.frames >= 1 && cmd.frames <= 255;
      body = (
        <>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {(["r", "g", "b"] as const).map((k) => (
              <label key={k}>
                {k.toUpperCase()} (0-31)
                <input
                  type="number" min={0} max={31} value={cmd[k]}
                  onChange={(e) => onChange({ ...cmd, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
            <label>
              Durée (frames)
              <input
                type="number" min={1} max={255} value={cmd.frames}
                onChange={(e) => onChange({ ...cmd, frames: Number(e.target.value) })}
              />
            </label>
          </div>
          <span className="hint">
            Éclair qui décroît sur la durée — non bloquant (enchaîner avec
            « Attendre »). Blanc plein : 31,31,31.
          </span>
        </>
      );
      break;
    case "call_fn": {
      const fns = props.fnSigs ?? [];
      const sig = fns[cmd.n];
      valid =
        !!sig &&
        cmd.args.length === sig.params.length &&
        (cmd.dst === undefined || (sig.returns && cmd.dst >= 0 && cmd.dst < 256));
      body = (
        <>
          {fns.length === 0 ? (
            <span className="hint" style={{ color: "#ff7070" }}>
              Aucune fonction dans le projet — les créer via
              Tools → Fonctions…
            </span>
          ) : (
            <>
              <label>
                Fonction
                <select
                  value={cmd.n}
                  autoFocus
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    const want = fns[n]?.params.length ?? 0;
                    // le nombre d'arguments SUIT la fonction choisie :
                    // datagen refuse un appel mal dimensionné, autant ne
                    // pas laisser l'auteur fabriquer ce cas
                    const args: ValueSrc[] = [];
                    for (let k = 0; k < want; k++)
                      args.push(cmd.args[k] ?? { value: 0 });
                    onChange({
                      ...cmd,
                      n,
                      args,
                      dst: fns[n]?.returns ? cmd.dst : undefined,
                    });
                  }}
                >
                  {fns.map((sg, i) => (
                    <option key={i} value={i}>
                      {String(i + 1).padStart(4, "0")}: {sg.name}(
                      {sg.params.join(", ")}){sg.returns ? " → valeur" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {sig?.params.map((pname, k) => (
                <div className="row" key={k} style={{ flexWrap: "wrap" }}>
                  <span style={{ alignSelf: "center", minWidth: 90 }}>
                    {pname || `paramètre ${k + 1}`}
                  </span>
                  <ValueSourceFields
                    v={cmd.args[k] ?? { value: 0 }}
                    fnParams={props.fnParams}
                    onChange={(v) => {
                      const args = cmd.args.slice();
                      args[k] = v;
                      onChange({ ...cmd, args });
                    }}
                  />
                </div>
              ))}
              {sig?.returns && (
                <label className="row" style={{ gap: 6, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    style={{ flex: "0 0 auto", width: 14, height: 14, boxShadow: "none" }}
                    checked={cmd.dst !== undefined}
                    onChange={(e) =>
                      onChange({ ...cmd, dst: e.target.checked ? 0 : undefined })
                    }
                  />
                  Ranger le résultat dans la variable
                  <input
                    type="number" min={0} max={255}
                    disabled={cmd.dst === undefined}
                    value={cmd.dst ?? 0}
                    onChange={(e) => onChange({ ...cmd, dst: Number(e.target.value) })}
                  />
                  <span className="hint">{props.varNames[cmd.dst ?? 0] || ""}</span>
                </label>
              )}
              <span className="hint">
                Sans « ranger le résultat », la valeur rendue reste lisible
                par la source « Résultat du dernier appel » — c'est ainsi
                qu'on passe le retour d'une fonction en argument d'une
                autre.
              </span>
            </>
          )}
        </>
      );
      break;
    }
    case "ret_fn":
      valid = cmd.value >= -32768 && cmd.value <= 65535;
      body = (
        <>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <span style={{ alignSelf: "center", minWidth: 90 }}>Valeur rendue</span>
            <ValueSourceFields
              v={cmd}
              fnParams={props.fnParams}
              onChange={(v) => onChange({ ...cmd, from: v.from, value: v.value })}
            />
          </div>
          <span className="hint">
            Sort de la fonction immédiatement. À n'utiliser que dans le
            corps d'une fonction déclarée « rend une valeur ».
          </span>
        </>
      );
      break;
    case "call":
      valid = props.commonNames.length > 0 && cmd.n >= 0 && cmd.n < props.commonNames.length;
      body = (
        <>
          {props.commonNames.length === 0 ? (
            <span className="hint" style={{ color: "#ff7070" }}>
              Aucun common event dans le projet — les créer via
              Tools → Common events…
            </span>
          ) : (
            <label>
              Common event
              <select
                value={cmd.n}
                autoFocus
                onChange={(e) => onChange({ ...cmd, n: Number(e.target.value) })}
              >
                {props.commonNames.map((n, i) => (
                  <option key={i} value={i}>
                    {String(i + 1).padStart(4, "0")}: {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="hint">
            Exécute les commandes du common event puis reprend ici (8
            niveaux d'appels max). « Cet event » y désigne l'event
            appelant.
          </span>
        </>
      );
      break;
    case "db_read": {
      const sc = props.db?.schemas.find((s) => s.name === cmd.table);
      const entries = props.db?.entries[cmd.table] ?? [];
      valid =
        !!sc &&
        sc.fields.some((f) => f.name === cmd.field) &&
        cmd.dst >= 0 && cmd.dst < 256 &&
        (cmd.from === "var"
          ? Number(cmd.entry) >= 0 && Number(cmd.entry) < 256
          : entries.some((e) => e.id === cmd.entry));
      body = !props.db ? (
        <span className="hint" style={{ color: "#ff7070" }}>
          Le projet n'a pas de database — créer une table via
          Tools → Database…
        </span>
      ) : (
        <>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <label>
              Table
              <select
                value={cmd.table}
                autoFocus
                onChange={(e) => {
                  const ns = props.db!.schemas.find((s) => s.name === e.target.value)!;
                  onChange({
                    ...cmd,
                    table: ns.name,
                    entry: cmd.from === "var" ? cmd.entry
                      : props.db!.entries[ns.name]?.[0]?.id ?? "",
                    field: ns.fields[0]?.name ?? "",
                  });
                }}
              >
                {props.db.schemas.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.title || s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fiche
              <select
                value={cmd.from ?? "const"}
                onChange={(e) => {
                  const from = e.target.value as "const" | "var";
                  onChange({
                    ...cmd,
                    from: from === "const" ? undefined : from,
                    entry: from === "var" ? 0 : entries[0]?.id ?? "",
                  });
                }}
              >
                <option value="const">Fixe (choisir)</option>
                <option value="var">Depuis une variable</option>
              </select>
            </label>
            {cmd.from === "var" ? (
              <label>
                Variable (n° de fiche)
                <span className="row" style={{ gap: 4 }}>
                  <input
                    type="number" min={0} max={255} value={Number(cmd.entry)}
                    onChange={(e) => onChange({ ...cmd, entry: Number(e.target.value) })}
                  />
                  <button className="browse" title="Choisir dans la liste"
                    onClick={() => props.onPickVar("var", Number(cmd.entry), (n) => onChange({ ...cmd, entry: n }))}>…</button>
                </span>
              </label>
            ) : (
              <label>
                Entrée
                <select
                  value={String(cmd.entry)}
                  onChange={(e) => onChange({ ...cmd, entry: e.target.value })}
                >
                  {entries.map((en) => (
                    <option key={en.id} value={en.id}>
                      {en.name || en.id}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Champ
              <select
                value={cmd.field}
                onChange={(e) => onChange({ ...cmd, field: e.target.value })}
              >
                {(sc?.fields ?? []).map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name} ({f.type})
                  </option>
                ))}
              </select>
            </label>
            <label>
              → Variable destination
              <span className="row" style={{ gap: 4 }}>
                <input
                  type="number" min={0} max={255} value={cmd.dst}
                  onChange={(e) => onChange({ ...cmd, dst: Number(e.target.value) })}
                />
                <button className="browse" title="Choisir dans la liste"
                  onClick={() => props.onPickVar("var", cmd.dst, (n) => onChange({ ...cmd, dst: n }))}>…</button>
              </span>
              <span className="hint">{props.varNames[cmd.dst] || ""}</span>
            </label>
          </div>
          <span className="hint">
            Copie la valeur du champ dans la variable (flags8 : l'octet des
            bits ; ref : l'index de la fiche visée ; « depuis une
            variable » : le n° de fiche est lu dans la variable, hors
            table → 0).
          </span>
        </>
      );
      break;
    }
    case "shake":
      valid = cmd.power >= 0 && cmd.power <= 8 && cmd.speed >= 1 && cmd.speed <= 8 &&
        cmd.frames >= 0 && cmd.frames <= 255;
      body = (
        <>
          <div className="row">
            <label>
              Force (px, 0 = arrêter)
              <input
                type="number" min={0} max={8} value={cmd.power} autoFocus
                onChange={(e) => onChange({ ...cmd, power: Number(e.target.value) })}
              />
            </label>
            <label>
              Vitesse (frames par va-et-vient)
              <input
                type="number" min={1} max={8} value={cmd.speed}
                onChange={(e) => onChange({ ...cmd, speed: Number(e.target.value) })}
              />
            </label>
            <label>
              Durée (frames)
              <input
                type="number" min={0} max={255} value={cmd.frames}
                onChange={(e) => onChange({ ...cmd, frames: Number(e.target.value) })}
              />
            </label>
          </div>
          <span className="hint">
            Secousse horizontale — non bloquante (enchaîner avec
            « Attendre »).
          </span>
        </>
      );
      break;
    case "warp": {
      const dest = props.scenes[cmd.to];
      valid =
        !!dest && cmd.x >= 0 && cmd.y >= 0 && cmd.x < (dest?.width ?? 0) && cmd.y < (dest?.height ?? 0);
      body = (
        <div className="row">
          <label style={{ flex: 2 }}>
            Scène cible
            <select
              value={cmd.to}
              onChange={(e) => {
                const d = props.scenes[e.target.value];
                onChange({
                  ...cmd,
                  to: e.target.value,
                  x: d?.player_start[0] ?? 3,
                  y: d?.player_start[1] ?? 3,
                });
              }}
            >
              {props.sceneNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            x
            <input type="number" min={0} value={cmd.x} onChange={(e) => onChange({ ...cmd, x: Number(e.target.value) })} />
          </label>
          <label>
            y
            <input type="number" min={0} value={cmd.y} onChange={(e) => onChange({ ...cmd, y: Number(e.target.value) })} />
          </label>
          <TransSelect value={cmd.trans} onChange={(t) => onChange({ ...cmd, trans: t })} />
        </div>
      );
      break;
    }
    case "face":
      body = (
        <div className="row">
          <label>
            Event n° (ordre de la scène)
            <input
              type="number"
              min={0}
              max={254}
              value={cmd.event}
              onChange={(e) => onChange({ ...cmd, event: Number(e.target.value) })}
            />
          </label>
          <label>
            Direction
            <select value={cmd.dir} onChange={(e) => onChange({ ...cmd, dir: e.target.value as Direction })}>
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
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
