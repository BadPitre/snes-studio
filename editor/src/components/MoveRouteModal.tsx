// Fenêtre « Itinéraire » — calquée sur le dialogue Move Route de RM2003 :
// liste des pas `$>` à gauche, grille de boutons (3 colonnes) à droite,
// radios Fréquence 1-8, options Répéter / Ignorer si bloqué. L'itinéraire
// part en tâche de fond en jeu (cinématiques) — le séquencer avec
// « Attendre la fin des déplacements ».

import { useEffect, useState } from "react";
import type { Command, RouteStep } from "../types";
import { ROUTE_STEP_LABELS } from "../types";

type RouteCmd = Extract<Command, { c: "route" }>;

interface Props {
  cmd: RouteCmd;
  hideTarget?: boolean; // route custom de page : pas de sélecteur d'event
  eventNames: string[]; // noms des events de la scène (index = n° d'entrée)
  switchNames: string[]; // noms des switches (libellés swon/swoff)
  charsetNames: string[]; // noms des blocs de personnage (pas gfx)
  onOk: (c: RouteCmd) => void;
  onClose: () => void;
}

// Grille façon RM2003 : 3 colonnes (marcher / tourner / attributs)
const COL1: RouteStep["s"][] = ["up", "right", "down", "left", "mrand", "mhero", "mflee", "fwd"];
const COL2: RouteStep["s"][] = ["tup", "tright", "tdown", "tleft", "t90r", "t90l", "t180", "t90x", "trand", "face", "tflee"];
const COL3: RouteStep["s"][] = ["spd+", "spd-", "frq+", "frq-", "fixon", "fixoff", "thruon", "thruoff"];

function stepLabel(st: RouteStep, swNames: string[], chNames: string[]): string {
  if (st.s === "wait") return `Attendre ${st.n * 8} frames`;
  if (st.s === "swon" || st.s === "swoff")
    return `Switch [${st.n}${swNames[st.n] ? ": " + swNames[st.n] : ""}] ${st.s === "swon" ? "ON" : "OFF"}`;
  if (st.s === "gfx")
    return `Graphisme : ${chNames[st.block] ?? `bloc ${st.block}`}`;
  return ROUTE_STEP_LABELS[st.s];
}

export default function MoveRouteModal(props: Props) {
  const [draft, setDraft] = useState<RouteCmd>(() => ({ freq: 3, ...structuredClone(props.cmd) }));
  const [sel, setSel] = useState(draft.steps.length); // insertion en queue

  const [clipStep, setClipStep] = useState<RouteStep | null>(null);

  // Suppr efface le pas sélectionné ; Ctrl+C / Ctrl+V copient-collent
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "Delete" && sel < draft.steps.length) {
        setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== sel) });
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && sel < draft.steps.length) {
        setClipStep(structuredClone(draft.steps[sel]));
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && clipStep) {
        insert(structuredClone(clipStep));
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const insert = (st: RouteStep) => {
    const steps = [...draft.steps];
    steps.splice(Math.min(sel, steps.length), 0, st);
    setDraft({ ...draft, steps });
    setSel(Math.min(sel, steps.length - 1) + 1);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal moveroute" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Itinéraire<button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button></div>
        <div className="row">
          {!props.hideTarget && (
          <label style={{ flex: 2 }}>
            Event
            <select
              value={draft.event}
              onChange={(e) => setDraft({ ...draft, event: Number(e.target.value) })}
            >
              <option value={-1}>Cet event</option>
              {props.eventNames.map((n, i) => (
                <option key={i} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          )}
          <fieldset className="moveroute-freq">
            <legend>Fréquence</legend>
            {Array.from({ length: 8 }, (_, i) => (
              <label key={i} className="checkline" title={i === 7 ? "8 : pas enchaînés sans pause" : undefined}>
                <input
                  type="radio"
                  name="mr-freq"
                  checked={(draft.freq ?? 3) === i + 1}
                  onChange={() => setDraft({ ...draft, freq: i + 1 })}
                />
                {i + 1}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="moveroute-body">
          <div className="evedit-cmds" style={{ flex: 1 }}>
            {[...draft.steps, null].map((st, i) => (
              <div
                key={i}
                className={"evedit-line" + (i === sel ? " active" : "")}
                onClick={() => setSel(i)}
              >
                {st ? `$> ${stepLabel(st, props.switchNames, props.charsetNames)}` : "$>"}
              </div>
            ))}
          </div>
          <div className="moveroute-grid">
            <div>
              {COL1.map((k) => (
                <button key={k} onClick={() => insert({ s: k } as RouteStep)}>
                  {ROUTE_STEP_LABELS[k]}
                </button>
              ))}
              <button
                onClick={() => {
                  const raw = prompt("Attendre combien de frames ? (multiples de 8, max 120)", "32");
                  if (!raw) return;
                  const n = Math.min(15, Math.max(1, Math.round(Number(raw) / 8)));
                  if (Number.isFinite(n)) insert({ s: "wait", n });
                }}
              >
                Attendre…
              </button>
            </div>
            <div>
              {COL2.map((k) => (
                <button key={k} onClick={() => insert({ s: k } as RouteStep)}>
                  {ROUTE_STEP_LABELS[k]}
                </button>
              ))}
            </div>
            <div>
              {COL3.map((k) => (
                <button key={k} onClick={() => insert({ s: k } as RouteStep)}>
                  {ROUTE_STEP_LABELS[k]}
                </button>
              ))}
              <button
                onClick={() => {
                  const raw = prompt("Switch à passer ON (0-511) :", "0");
                  if (raw === null) return;
                  const n = Number(raw);
                  if (Number.isInteger(n) && n >= 0 && n < 512) insert({ s: "swon", n });
                }}
              >
                Switch ON…
              </button>
              <button
                onClick={() => {
                  const raw = prompt("Switch à passer OFF (0-511) :", "0");
                  if (raw === null) return;
                  const n = Number(raw);
                  if (Number.isInteger(n) && n >= 0 && n < 512) insert({ s: "swoff", n });
                }}
              >
                Switch OFF…
              </button>
              <button
                onClick={() => {
                  const names = props.charsetNames.map((n, i) => `${i} = ${n}`).join(", ");
                  const raw = prompt(`Nouveau graphisme (bloc) : ${names}`, "0");
                  if (raw === null) return;
                  const b = Number(raw);
                  if (Number.isInteger(b) && b >= 0 && b < 64) insert({ s: "gfx", block: b });
                }}
              >
                Graphisme…
              </button>
            </div>
          </div>
        </div>
        <div className="row" style={{ alignItems: "center" }}>
          <label className="checkline" title="L'itinéraire reboucle pour toujours (les scripts ne l'attendent pas)">
            <input
              type="checkbox"
              checked={draft.repeat}
              onChange={(e) => setDraft({ ...draft, repeat: e.target.checked })}
            />
            Répéter
          </label>
          <label className="checkline" title="Un pas bloqué est abandonné au lieu d'être retenté">
            <input
              type="checkbox"
              checked={draft.skip}
              onChange={(e) => setDraft({ ...draft, skip: e.target.checked })}
            />
            Ignorer si bloqué
          </label>
          <span style={{ flex: 1 }} />
          <button
            disabled={sel >= draft.steps.length}
            onClick={() => {
              const steps = draft.steps.filter((_, i) => i !== sel);
              setDraft({ ...draft, steps });
            }}
          >
            Supprimer
          </button>
          <button
            disabled={draft.steps.length === 0}
            onClick={() => setDraft({ ...draft, steps: [] })}
          >
            Tout effacer
          </button>
        </div>
        <div className="row">
          <button disabled={draft.steps.length === 0} onClick={() => props.onOk(draft)}>
            OK
          </button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
