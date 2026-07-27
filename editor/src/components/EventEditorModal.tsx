// Event Editor façon RPG Maker 2003 : nom + pages (P4), conditions (P4),
// apparence (charset + direction + aperçu), déclencheur, mouvement (P4),
// et la liste de commandes « Contenu » (@>) avec branches imbriquées
// (choix, conditions). Les commandes sont compilées par datagen vers la VM.

import { useEffect, useRef, useState } from "react";
import type { Command, Direction, GameEvent, Scene } from "../types";
import { DIRECTIONS, eventFrame } from "../types";
import EventCommandPicker from "./EventCommandPicker";

interface Props {
  event: GameEvent;
  sceneNames: string[];
  scenes: Record<string, Scene>;
  blockCount: number;
  blockNames: string[];
  sprites: ImageBitmap | null;
  labels: string[]; // labels du script manuel (champ avancé)
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
    } else if (c.c === "if") {
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
      } else if (c.c === "if" && (sel === "t" || sel === "e")) {
        list = sel === "t" ? c.then : c.else;
        i++;
      }
    }
  }
  return { list, index: parseInt(parts[parts.length - 1], 10) };
}

export default function EventEditorModal(props: Props) {
  const [draft, setDraft] = useState<GameEvent>(() => structuredClone(props.event));
  const [sel, setSel] = useState<string>(String(props.event.commands.length));
  const [form, setForm] = useState<Command | null>(null); // en cours d'édition
  const [formIsNew, setFormIsNew] = useState(false);
  const [picking, setPicking] = useState(false);
  // clic droit sur une ligne : menu contextuel Insérer / Éditer / Supprimer
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const lines: Line[] = [];
  flatten(draft.commands, "", 0, lines);

  // Commande à ce chemin, ou null si la ligne est vide (queue de liste)
  function cmdAt(path: string): Command | null {
    const line = lines.find((l) => l.path === path);
    if (!line || line.branch) return null;
    const { list, index } = resolve(draft.commands, path);
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
    if (props.sprites && draft.sprite >= 0) {
      const f = eventFrame(draft);
      ctx.drawImage(props.sprites, f * 16, 0, 16, 24, 8, 6, 48, 72);
    } else {
      ctx.fillStyle = "#9aa0a8";
      ctx.font = "11px system-ui";
      ctx.fillText("(invisible)", 6, 44);
    }
  }, [draft, props.sprites]);

  const commit = (mut: () => void) => {
    mut();
    setDraft({ ...draft });
  };

  function insertCmd(c: Command) {
    commit(() => {
      const { list, index } = resolve(draft.commands, sel);
      list.splice(Math.min(index, list.length), 0, c);
    });
    setForm(null);
    setPicking(false);
  }

  function replaceCmd(c: Command) {
    commit(() => {
      const { list, index } = resolve(draft.commands, sel);
      if (index < list.length) list[index] = c;
    });
    setForm(null);
  }

  function deleteCmd(path = sel) {
    if (!cmdAt(path)) return;
    commit(() => {
      const { list, index } = resolve(draft.commands, path);
      list.splice(index, 1);
    });
    setForm(null);
  }

  function moveCmd(delta: number) {
    if (!selCmd) return;
    const { list, index } = resolve(draft.commands, sel);
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
          <span className="row" style={{ flex: 0, gap: 6 }} title="Pages d'events : à venir (P4)">
            <button disabled>Nouvelle page</button>
            <button disabled>Copier la page</button>
            <button disabled>Supprimer la page</button>
          </span>
        </div>
        <div className="evedit-body">
          <div className="evedit-left">
            <fieldset className="evedit-box" disabled title="Pages et conditions d'activation : à venir (P4)">
              <legend>Conditions</legend>
              <label className="hint">☐ Switch — à venir (P4)</label>
              <label className="hint">☐ Variable — à venir (P4)</label>
            </fieldset>
            <fieldset className="evedit-box">
              <legend>Apparence</legend>
              <div className="row">
                <canvas ref={previewRef} width={64} height={84} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <select
                    value={draft.sprite}
                    onChange={(e) => setDraft({ ...draft, sprite: Number(e.target.value) })}
                  >
                    <option value={-1}>(invisible)</option>
                    {Array.from({ length: props.blockCount }, (_, b) => (
                      <option key={b} value={b}>
                        {props.blockNames[b] ?? `Bloc ${b}`}
                      </option>
                    ))}
                  </select>
                  <select
                    value={draft.dir}
                    onChange={(e) => setDraft({ ...draft, dir: e.target.value as Direction })}
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
            <fieldset className="evedit-box" disabled title="Déplacements des events : à venir (PNJ mobiles)">
              <legend>Type de mouvement</legend>
              <select>
                <option>Statique</option>
              </select>
            </fieldset>
            <fieldset className="evedit-box">
              <legend>Déclencheur</legend>
              <select
                value={draft.trigger}
                onChange={(e) => setDraft({ ...draft, trigger: e.target.value as GameEvent["trigger"] })}
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
                  value={draft.commands.length ? "" : draft.entry ?? ""}
                  disabled={draft.commands.length > 0}
                  title="Label du script assembleur de la scène (ignoré si l'event a des commandes)"
                  onChange={(e) =>
                    setDraft({ ...draft, entry: e.target.value === "" ? undefined : e.target.value })
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
  onChange: (c: Command) => void;
  onOk: () => void;
  onCancel: () => void;
}) {
  const { cmd, onChange } = props;
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
