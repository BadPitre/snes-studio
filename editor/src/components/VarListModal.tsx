// Fenêtre « Switches / Variables » — calquée sur les dialogues Switch et
// Variable de RPG Maker 2003 : tranches de 20 à gauche, liste numérotée à
// droite, champ Nom sous la liste. Deux usages :
//  - gestion (menu Tools) : renommer librement, onglets Switches/Variables ;
//  - sélection (bouton « … » des formulaires de commande) : double-clic ou
//    OK renvoie le numéro choisi (le type est verrouillé), renommage permis.
// Les noms vivent dans project.json (éditeur seulement — datagen les lit
// au besoin pour ses messages d'erreur).

import { useState } from "react";
import { SWITCH_COUNT, VAR16_COUNT } from "../types";

export type VarKind = "switch" | "var";

interface Props {
  kind: VarKind; // onglet initial (verrouillé en mode sélection)
  switches: string[];
  variables: string[];
  pick?: boolean; // mode sélection
  initial?: number; // numéro présélectionné (mode sélection)
  onOk: (r: { switches: string[]; variables: string[]; picked?: number; kind: VarKind }) => void;
  onClose: () => void;
}

const GROUP = 20;

function pad(n: number): string {
  return String(n).padStart(4, "0");
}

export default function VarListModal(props: Props) {
  const [kind, setKind] = useState<VarKind>(props.kind);
  const [sw, setSw] = useState<string[]>(() => [...props.switches]);
  const [va, setVa] = useState<string[]>(() => [...props.variables]);
  const [sel, setSel] = useState<number>(props.initial ?? 0);
  const [group, setGroup] = useState<number>(Math.floor((props.initial ?? 0) / GROUP));

  const count = kind === "switch" ? SWITCH_COUNT : VAR16_COUNT;
  const names = kind === "switch" ? sw : va;
  const setNames = kind === "switch" ? setSw : setVa;
  const groups = Math.ceil(count / GROUP);
  const g = Math.min(group, groups - 1);
  const selIn = Math.min(sel, count - 1);

  const ok = () =>
    props.onOk({ switches: sw, variables: va, picked: props.pick ? selIn : undefined, kind });

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal varlist" onClick={(e) => e.stopPropagation()}>
        <div className="cmdpick-tabs">
          {(["switch", "var"] as VarKind[]).map((k) => (
            <button
              key={k}
              className={kind === k ? "active" : ""}
              style={{ width: "auto", padding: "3px 12px" }}
              disabled={!!props.pick && k !== props.kind}
              onClick={() => {
                setKind(k);
                setSel(0);
                setGroup(0);
              }}
            >
              {k === "switch" ? `Switches (${SWITCH_COUNT})` : `Variables (${VAR16_COUNT})`}
            </button>
          ))}
        </div>
        <div className="varlist-body">
          <div className="varlist-groups">
            {Array.from({ length: groups }, (_, i) => (
              <button
                key={i}
                className={i === g ? "active" : ""}
                onClick={() => {
                  setGroup(i);
                  setSel(i * GROUP);
                }}
              >
                [ {pad(i * GROUP)} - {pad(Math.min((i + 1) * GROUP, count) - 1)} ]
              </button>
            ))}
          </div>
          <div className="varlist-items">
            {Array.from({ length: Math.min(GROUP, count - g * GROUP) }, (_, i) => {
              const n = g * GROUP + i;
              return (
                <div
                  key={n}
                  className={"evedit-line" + (n === selIn ? " active" : "")}
                  onClick={() => setSel(n)}
                  onDoubleClick={() => {
                    if (props.pick) {
                      setSel(n);
                      props.onOk({ switches: sw, variables: va, picked: n, kind });
                    }
                  }}
                >
                  {pad(n)}: {names[n] ?? ""}
                </div>
              );
            })}
          </div>
        </div>
        <label className="varlist-name">
          Nom {pad(selIn)} :
          <input
            value={names[selIn] ?? ""}
            onChange={(e) => {
              const next = [...names];
              while (next.length <= selIn) next.push("");
              next[selIn] = e.target.value;
              setNames(next);
            }}
          />
        </label>
        <div className="row">
          <button onClick={ok}>OK</button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
