// Event Editor façon RPG Maker 2003 : nom + pages (P4), conditions (P4),
// apparence (charset + direction + aperçu), déclencheur, mouvement (P4),
// et la liste de commandes « Contenu » (@>) avec branches imbriquées
// (choix, conditions). Les commandes sont compilées par datagen vers la VM.

import { useEffect, useRef, useState } from "react";
import type { Command, Direction, EventPage, EventPriority, GameEvent, MoveType, Scene, VarOp, VarSource } from "../types";
import { DIRECTIONS, eventFrame } from "../types";
import EventCommandPicker from "./EventCommandPicker";
import VarListModal, { type VarKind } from "./VarListModal";
import MoveRouteModal from "./MoveRouteModal";
import type { Database } from "../db";

interface Props {
  event: GameEvent;
  sceneNames: string[];
  scenes: Record<string, Scene>;
  blockCount: number;
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
  commonNames: string[]; // noms des common events (v0.16)
  db: Database | null; // database du projet (commande db_read, v0.17)
  uiWidgets: string[]; // racines du layout (commande ui_show, Ph. 12)
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

function labelOf(c: Command, ceNames?: string[]): string {
  switch (c.c) {
    case "msg":
      return `Message : ${c.text}`;
    case "choice":
      return "Afficher un choix…";
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
    case "key_input":
      return `Touche pressée → [${c.var}]${c.wait ? " (attendre)" : ""}`;
    case "sysmenu":
      return "Ouvrir le menu Système (sauvegarde)";
    case "scr_hide":
      return `Cacher l'écran (vitesse ${c.speed})`;
    case "scr_show":
      return `Montrer l'écran (vitesse ${c.speed})`;
    case "tint":
      return c.mode === "off"
        ? "Teinte : normale"
        : `Teinte : ${c.mode === "add" ? "éclaircir" : "assombrir"} (${c.r},${c.g},${c.b})`;
    case "flash":
      return `Flash d'écran (${c.r},${c.g},${c.b}) ${c.frames} frames`;
    case "shake":
      return c.power === 0
        ? "Secousse : stop"
        : `Secouer l'écran (force ${c.power}, ${c.frames} frames)`;
    case "call":
      return `Appeler le common event [${String(c.n + 1).padStart(4, "0")}${
        ceNames?.[c.n] ? ": " + ceNames[c.n] : ""}]`;
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
    flash: "Flash d'écran",
    shake: "Secouer l'écran",
    call: "Appeler un common event",
    db_read: "Lire la database",
  };
  return titles[c] ?? "Options de la commande";
}

function flatten(cmds: Command[], base: string, depth: number, out: Line[], ceNames?: string[]) {
  cmds.forEach((c, i) => {
    const path = base + i;
    out.push({ path, depth, label: labelOf(c, ceNames), comment: c.c === "rem" });
    if (c.c === "loop") {
      flatten(c.do, `${path}.d.`, depth + 1, out, ceNames);
      out.push({ path: `${path}.d.-1`, depth: depth + 1, label: ": Fin de boucle", branch: true });
    } else if (c.c === "choice") {
      c.options.forEach((o, k) => {
        out.push({ path: `${path}.o${k}.-1`, depth: depth + 1, label: `: Quand [${o.text}]`, branch: true });
        flatten(o.do, `${path}.o${k}.`, depth + 2, out, ceNames);
      });
    } else if (c.c === "if" || c.c === "if_sw" || c.c === "if_var") {
      out.push({ path: `${path}.t.-1`, depth: depth + 1, label: ": Si vrai", branch: true });
      flatten(c.then, `${path}.t.`, depth + 2, out, ceNames);
      out.push({ path: `${path}.e.-1`, depth: depth + 1, label: ": Sinon", branch: true });
      flatten(c.else, `${path}.e.`, depth + 2, out, ceNames);
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
  db: Database | null;
  uiWidgets: string[]; // schémas + instances (commande db_read)
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
  flatten(cmds, "", 0, lines, props.commonNames);

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
      case "key_input":
        return { c: "key_input", var: 0, wait: true, keys: [1, 2, 3, 4, 5, 6] };
      case "sysmenu":
        return { c: "sysmenu" };
      case "scr_hide":
        return { c: "scr_hide", speed: 1 };
      case "scr_show":
        return { c: "scr_show", speed: 1 };
      case "tint":
        return { c: "tint", mode: "sub", r: 8, g: 8, b: 8 };
      case "flash":
        return { c: "flash", r: 31, g: 31, b: 31, frames: 8 };
      case "shake":
        return { c: "shake", power: 4, speed: 2, frames: 30 };
      case "call":
        return { c: "call", n: 0 };
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
        <div className="modal-backdrop" onClick={() => setForm(null)}>
          <div className="modal cmdform" onClick={(e) => e.stopPropagation()}>
            <div className="palette-title">{cmdTitle(form.c)}</div>
            <CommandForm
              cmd={form}
              sceneNames={props.sceneNames}
              scenes={props.scenes}
              switchNames={props.switchNames}
              varNames={props.varNames}
              entryNames={props.entryNames}
              charsetNames={props.charsetNames}
              commonNames={props.commonNames}
              db={props.db}
              uiWidgets={props.uiWidgets}
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
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = previewRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#16181c";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (props.sprites && cur.sprite >= 0) {
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
      <div className="modal-backdrop" onClick={props.onClose}>
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
                <canvas ref={previewRef} width={64} height={84} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <select
                    value={cur.sprite}
                    onChange={(e) => patchCur({ sprite: Number(e.target.value) })}
                  >
                    <option value={-1}>(invisible)</option>
                    {Array.from({ length: props.blockCount }, (_, b) => (
                      <option key={b} value={b}>
                        {(props.blockNames[b] ?? `Bloc ${b}`) +
                          (props.usedBlocks.includes(b) ? " ✓" : "")}
                      </option>
                    ))}
                  </select>
                  {cur.sprite >= 0 &&
                    !props.usedBlocks.includes(cur.sprite) &&
                    props.usedBlocks.length >= 5 && (
                      <span className="hint" style={{ color: "#ff7070" }}>
                        {props.usedBlocks.length + 1}e charset de la scène —
                        la SNES en affiche 5 max (héros compris). Réutiliser
                        une apparence ✓, sinon datagen refusera.
                      </span>
                    )}
                  <select
                    value={cur.dir}
                    onChange={(e) => patchCur({ dir: e.target.value as Direction })}
                  >
                    {DIRECTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
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
              db={props.db}
              uiWidgets={props.uiWidgets}
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
    </>
  );
}

// Formulaire des paramètres d'une commande (zone sous la liste, façon
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
  uiWidgets: string[];
  db: Database | null;
  onPickVar: (kind: VarKind, current: number, cb: (n: number) => void) => void;
  onChange: (c: Command) => void;
  onOk: () => void;
  onCancel: () => void;
}) {
  const { cmd, onChange } = props;
  // fenêtre Itinéraire (commande « Déplacer un event »)
  const [routeOpen, setRouteOpen] = useState(false);
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

  let body = null;
  let valid = true;
  switch (cmd.c) {
    case "msg":
      valid = cmd.text.trim().length > 0;
      body = (
        <>
          <label>
            Texte du message
            <textarea
              rows={3}
              value={cmd.text}
              autoFocus
              onChange={(e) => onChange({ ...cmd, text: e.target.value })}
            />
          </label>
          <span className="hint">
            \v[n] affiche la variable n au moment de l'affichage (ex. « Tu
            as \v[12] pièces d'or ») — marche aussi dans les choix.
          </span>
        </>
      );
      break;
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
            </select>
          </label>
          {(cmd.from ?? "const") === "const" || cmd.from === "var" ? (
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
    case "scr_hide":
    case "scr_show":
      valid = cmd.speed >= 1 && cmd.speed <= 15;
      body = (
        <>
          <label>
            Vitesse (luminosité par frame, 1 = ~15 frames, 15 = instantané)
            <input
              type="number" min={1} max={15} value={cmd.speed} autoFocus
              onChange={(e) => onChange({ ...cmd, speed: Number(e.target.value) })}
            />
          </label>
          <span className="hint">
            {cmd.c === "scr_hide"
              ? "Fondu vers le noir — bloque le script jusqu'au noir complet. L'écran reste caché jusqu'à « Montrer l'écran » (un téléport le rallume)."
              : "Fondu entrant — bloque le script jusqu'à la pleine luminosité."}
          </span>
        </>
      );
      break;
    case "tint":
      valid = [cmd.r, cmd.g, cmd.b].every((v) => v >= 0 && v <= 31);
      body = (
        <>
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
          <span className="hint">
            Immédiate, persiste entre les scènes. Teinte le décor — pas les
            personnages ni le texte (limite hardware SNES). Nuit :
            assombrir (12,12,4).
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
