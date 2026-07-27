// Event Editor façon RPG Maker 2003 : nom + pages (P4), conditions (P4),
// apparence (charset + direction + aperçu), déclencheur, mouvement (P4),
// et la liste de commandes « Contenu » (@>) avec branches imbriquées
// (choix, conditions). Les commandes sont compilées par datagen vers la VM.

import { useEffect, useRef, useState } from "react";
import type { Command, Direction, EventPage, GameEvent, MoveType, Scene } from "../types";
import { DIRECTIONS, eventFrame } from "../types";
import EventCommandPicker from "./EventCommandPicker";
import VarListModal, { type VarKind } from "./VarListModal";
import MoveRouteModal from "./MoveRouteModal";

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
}

function labelOf(c: Command): string {
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
    case "var":
      return `Variable [${c.n}] ${c.op === "=" ? "=" : "+="} ${c.value}`;
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
  }
}

function flatten(cmds: Command[], base: string, depth: number, out: Line[]) {
  cmds.forEach((c, i) => {
    const path = base + i;
    out.push({ path, depth, label: labelOf(c) });
    if (c.c === "choice") {
      c.options.forEach((o, k) => {
        out.push({ path: `${path}.o${k}.-1`, depth: depth + 1, label: `: Quand [${o.text}]`, branch: true });
        flatten(o.do, `${path}.o${k}.`, depth + 2, out);
      });
    } else if (c.c === "if" || c.c === "if_sw" || c.c === "if_var") {
      out.push({ path: `${path}.t.-1`, depth: depth + 1, label: ": Si vrai", branch: true });
      flatten(c.then, `${path}.t.`, depth + 2, out);
      out.push({ path: `${path}.e.-1`, depth: depth + 1, label: ": Sinon", branch: true });
      flatten(c.else, `${path}.e.`, depth + 2, out);
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
      }
    }
  }
  return { list, index: parseInt(parts[parts.length - 1], 10) };
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
  const [sel, setSel] = useState<string>(String(props.event.commands.length));
  const [form, setForm] = useState<Command | null>(null); // en cours d'édition
  const [formIsNew, setFormIsNew] = useState(false);
  const [picking, setPicking] = useState(false);
  // clic droit sur une ligne : menu contextuel Insérer / Éditer / Supprimer
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  // fenêtre Switches/Variables ouverte depuis un formulaire (bouton …)
  const [varPick, setVarPick] = useState<{ kind: VarKind; current: number; cb: (n: number) => void } | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const lines: Line[] = [];
  flatten(cmds, "", 0, lines);

  // Commande à ce chemin, ou null si la ligne est vide (queue de liste)
  function cmdAt(path: string): Command | null {
    const line = lines.find((l) => l.path === path);
    if (!line || line.branch) return null;
    const { list, index } = resolve(cmds, path);
    return list[index] ?? null;
  }
  const selCmd = cmdAt(sel);

  // Ouvre le sélecteur de commandes pour insérer AVANT la ligne visée
  function openPicker(path: string) {
    setSel(path);
    setForm(null);
    setPicking(true);
  }

  // Ouvre le formulaire de la commande de cette ligne
  function openEditor(path: string) {
    const c = cmdAt(path);
    if (!c) return;
    setSel(path);
    setPicking(false);
    setForm(structuredClone(c));
    setFormIsNew(false);
  }

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

  const commit = (mut: () => void) => {
    mut();
    setDraft({ ...draft });
  };

  function insertCmd(c: Command) {
    commit(() => {
      const { list, index } = resolve(cmds, sel);
      list.splice(Math.min(index, list.length), 0, c);
    });
    setForm(null);
    setPicking(false);
  }

  function replaceCmd(c: Command) {
    commit(() => {
      const { list, index } = resolve(cmds, sel);
      if (index < list.length) list[index] = c;
    });
    setForm(null);
  }

  function deleteCmd(path = sel) {
    if (!cmdAt(path)) return;
    commit(() => {
      const { list, index } = resolve(cmds, path);
      list.splice(index, 1);
    });
    setForm(null);
  }

  function moveCmd(delta: number) {
    if (!selCmd) return;
    const { list, index } = resolve(cmds, sel);
    const j = index + delta;
    if (j < 0 || j >= list.length) return;
    commit(() => {
      const [c] = list.splice(index, 1);
      list.splice(j, 0, c);
    });
    setSel(sel.replace(/\d+$/, String(j)));
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
    }
  }

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
                onClick={() => { setPage(k); setForm(null); setPicking(false); setSel("0"); }}
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
                setForm(null);
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
                onChange={(e) =>
                  patchCur({ move: e.target.value === "static" ? undefined : (e.target.value as MoveType) })
                }
              >
                <option value="static">Statique</option>
                <option value="random">Aléatoire</option>
                <option value="vertical">Vertical (haut-bas)</option>
                <option value="horizontal">Horizontal (gauche-droite)</option>
              </select>
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
            <fieldset className="evedit-box" disabled title="À venir (P4)">
              <legend>Priorité / Vitesse</legend>
              <select>
                <option>Sous le héros</option>
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
            <div className="evedit-cmds">
              {lines.map((l) => (
                <div
                  key={l.path}
                  className={
                    "evedit-line" + (l.path === sel ? " active" : "") + (l.branch ? " branch" : "")
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
            <p className="hint">
              Double-clic sur une ligne vide : ajouter une commande. Clic droit :
              insérer / éditer.
            </p>
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              <button onClick={() => openPicker(sel)}>Ajouter…</button>
              <button disabled={!selCmd} onClick={() => openEditor(sel)}>
                Modifier…
              </button>
              <button disabled={!selCmd} onClick={() => deleteCmd()}>
                Supprimer
              </button>
              <button disabled={!selCmd} onClick={() => moveCmd(-1)}>
                ↑
              </button>
              <button disabled={!selCmd} onClick={() => moveCmd(1)}>
                ↓
              </button>
            </div>
            {form && (
              <CommandForm
                cmd={form}
                sceneNames={props.sceneNames}
                scenes={props.scenes}
                switchNames={props.switchNames}
                varNames={props.varNames}
                entryNames={props.entryNames}
                onPickVar={(kind, current, cb) => setVarPick({ kind, current, cb })}
                onChange={setForm}
                onOk={() => (formIsNew ? insertCmd(form) : replaceCmd(form))}
                onCancel={() => setForm(null)}
              />
            )}
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

// Formulaire des paramètres d'une commande (zone sous la liste, façon
// double-clic RM2003)
function CommandForm(props: {
  cmd: Command;
  sceneNames: string[];
  scenes: Record<string, Scene>;
  switchNames: string[];
  varNames: string[];
  entryNames: string[];
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
        <label>
          Texte du message
          <textarea
            rows={3}
            value={cmd.text}
            autoFocus
            onChange={(e) => onChange({ ...cmd, text: e.target.value })}
          />
        </label>
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
            Opération
            <select
              value={cmd.op}
              onChange={(e) => onChange({ ...cmd, op: e.target.value as "=" | "+" })}
            >
              <option value="=">= (affecter)</option>
              <option value="+">+ (ajouter)</option>
            </select>
          </label>
          <label>
            Valeur (16 bits{cmd.op === "+" ? ", négatif accepté" : ""})
            <input
              type="number" min={-32768} max={65535} value={cmd.value}
              onChange={(e) => onChange({ ...cmd, value: Number(e.target.value) })}
            />
          </label>
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
