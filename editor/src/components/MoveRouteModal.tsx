// Fenêtre « Itinéraire » — calquée sur le dialogue Move Route de RM2003 :
// liste des pas `$>` à gauche, grille de boutons à droite, options
// Répéter / Ignorer si bloqué. L'itinéraire part en tâche de fond en jeu
// (cinématiques) — le séquencer avec « Attendre la fin des déplacements ».

import { useState } from "react";
import type { Command, RouteStep } from "../types";
import { ROUTE_STEP_LABELS } from "../types";

type RouteCmd = Extract<Command, { c: "route" }>;

interface Props {
  cmd: RouteCmd;
  eventNames: string[]; // noms des events de la scène (index = n° d'entrée)
  onOk: (c: RouteCmd) => void;
  onClose: () => void;
}

const STEP_BUTTONS: { s: RouteStep["s"]; label: string }[] = [
  { s: "up", label: "Marcher haut" },
  { s: "tup", label: "Tourner haut" },
  { s: "right", label: "Marcher droite" },
  { s: "tright", label: "Tourner droite" },
  { s: "down", label: "Marcher bas" },
  { s: "tdown", label: "Tourner bas" },
  { s: "left", label: "Marcher gauche" },
  { s: "tleft", label: "Tourner gauche" },
  { s: "fwd", label: "Un pas en avant" },
  { s: "face", label: "Vers le héros" },
];

function stepLabel(st: RouteStep): string {
  if (st.s === "wait") return `Attendre ${st.n * 8} frames`;
  return ROUTE_STEP_LABELS[st.s];
}

export default function MoveRouteModal(props: Props) {
  const [draft, setDraft] = useState<RouteCmd>(() => structuredClone(props.cmd));
  const [sel, setSel] = useState(draft.steps.length); // insertion en queue

  const insert = (st: RouteStep) => {
    const steps = [...draft.steps];
    steps.splice(Math.min(sel, steps.length), 0, st);
    setDraft({ ...draft, steps });
    setSel(Math.min(sel, steps.length - 1) + 1);
  };

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal moveroute" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Itinéraire</div>
        <div className="row">
          <label style={{ flex: 1 }}>
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
        </div>
        <div className="moveroute-body">
          <div className="evedit-cmds" style={{ flex: 1 }}>
            {[...draft.steps, null].map((st, i) => (
              <div
                key={i}
                className={"evedit-line" + (i === sel ? " active" : "")}
                onClick={() => setSel(i)}
              >
                {st ? `$> ${stepLabel(st)}` : "$>"}
              </div>
            ))}
          </div>
          <div className="moveroute-grid">
            {STEP_BUTTONS.map((b) => (
              <button key={b.s} onClick={() => insert({ s: b.s } as RouteStep)}>
                {b.label}
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
        </div>
        <div className="row">
          <label className="row" style={{ gap: 4, flex: 0 }} title="L'itinéraire reboucle pour toujours (les scripts ne l'attendent pas)">
            <input
              type="checkbox"
              checked={draft.repeat}
              onChange={(e) => setDraft({ ...draft, repeat: e.target.checked })}
            />
            Répéter
          </label>
          <label className="row" style={{ gap: 4, flex: 0 }} title="Un pas bloqué est abandonné au lieu d'être retenté">
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
