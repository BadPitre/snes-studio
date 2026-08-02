// "Switches / Variables" window — modelled on RPG Maker 2003's Switch
// and Variable dialogues: slices of 20 on the left, a numbered list on
// the right, a Name field under the list. Two uses:
//  - management (Tools menu): rename freely, Switches/Variables tabs;
//  - selection (the "…" button of the command forms): a double-click or
//    OK returns the chosen number (the type is locked), renaming allowed.
// The names live in project.json (editor only — datagen reads them when
// it needs them for its error messages).

import { useState } from "react";
import { SWITCH_COUNT, VAR16_COUNT } from "../types";

export type VarKind = "switch" | "var";

interface Props {
  kind: VarKind; // initial tab (locked in selection mode)
  switches: string[];
  variables: string[];
  pick?: boolean; // selection mode
  initial?: number; // preselected number (selection mode)
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
    <div className="modal-backdrop">
      <div className="modal varlist" onClick={(e) => e.stopPropagation()}>
        <div className="cmdpick-tabs">
          <button className="modal-x" title="Fermer" onClick={props.onClose}
            style={{ order: 99, marginLeft: "auto" }}>✕</button>
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
                  className={"varlist-row" + (n === selIn ? " active" : "")}
                  onClick={() => setSel(n)}
                  onDoubleClick={() => {
                    if (props.pick) {
                      setSel(n);
                      props.onOk({ switches: sw, variables: va, picked: n, kind });
                    }
                  }}
                >
                  <span className="varlist-num">{pad(n)}</span>
                  <input
                    className="varlist-inline"
                    value={names[n] ?? ""}
                    placeholder="(sans nom)"
                    onFocus={() => setSel(n)}
                    onChange={(e) => {
                      const next = [...names];
                      while (next.length <= n) next.push("");
                      next[n] = e.target.value;
                      setNames(next);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="row">
          <button onClick={ok}>OK</button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
