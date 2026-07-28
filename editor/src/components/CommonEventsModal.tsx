// Fenêtre « Common events » (Tools →) — calquée sur l'onglet Common
// Events de la Database RM2003 : liste numérotée à gauche, Nom /
// Déclencheur / Switch de condition / Contenu à droite. Les common
// events sont des scripts GLOBAUX au projet : appelables depuis
// n'importe quel event (« Appeler un common event »), ou déclenchés en
// auto par un switch (relancés tant que le switch est ON — le script
// doit l'éteindre, modèle Autorun RM2003).

import { useState } from "react";
import type { CommonEvent, Scene } from "../types";
import { CommandListEditor } from "./EventEditorModal";
import VarListModal from "./VarListModal";

interface Props {
  commons: CommonEvent[];
  sceneNames: string[];
  scenes: Record<string, Scene>;
  switchNames: string[];
  varNames: string[];
  charsetNames: string[];
  onRenameVars: (switches: string[], variables: string[]) => void;
  onOk: (commons: CommonEvent[]) => void;
  onClose: () => void;
}

export default function CommonEventsModal(props: Props) {
  const [draft, setDraft] = useState<CommonEvent[]>(() =>
    structuredClone(props.commons)
  );
  const [sel, setSel] = useState(0);
  const [swPick, setSwPick] = useState(false);
  const cur = draft[sel] as CommonEvent | undefined;

  const patch = (p: Partial<CommonEvent>) =>
    setDraft(draft.map((ce, i) => (i === sel ? { ...ce, ...p } : ce)));

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal cevents" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Common events</div>
        <div className="cevents-body">
          <div className="cevents-list">
            <div className="evedit-cmds" style={{ flex: 1 }}>
              {draft.map((ce, i) => (
                <div
                  key={i}
                  className={"evedit-line" + (i === sel ? " active" : "")}
                  onClick={() => setSel(i)}
                >
                  {String(i + 1).padStart(4, "0")}: {ce.name}
                </div>
              ))}
            </div>
            <div className="row">
              <button
                onClick={() => {
                  setDraft([
                    ...draft,
                    { name: "", trigger: "none", commands: [] },
                  ]);
                  setSel(draft.length);
                }}
              >
                ＋ Ajouter
              </button>
              <button
                className="danger"
                disabled={!cur}
                title="Supprimer ce common event (les « Appeler » qui le visent seront à corriger)"
                onClick={() => {
                  setDraft(draft.filter((_, i) => i !== sel));
                  setSel(Math.max(0, sel - 1));
                }}
              >
                🗑
              </button>
            </div>
          </div>
          <div className="cevents-right">
            {!cur ? (
              <p className="hint">
                Aucun common event — « ＋ Ajouter » pour en créer un, puis
                l'appeler depuis un event avec « Appeler un common event »
                (onglet Autres).
              </p>
            ) : (
              <>
                <div className="row">
                  <label style={{ flex: 2 }}>
                    Nom
                    <input
                      value={cur.name}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </label>
                  <label>
                    Déclencheur
                    <select
                      value={cur.trigger}
                      onChange={(e) =>
                        patch({
                          trigger: e.target.value as CommonEvent["trigger"],
                          switch:
                            e.target.value === "auto" ? cur.switch ?? 0 : undefined,
                        })
                      }
                    >
                      <option value="none">Aucun (appelé)</option>
                      <option value="auto">Auto (switch ON)</option>
                    </select>
                  </label>
                  <label style={{ opacity: cur.trigger === "auto" ? 1 : 0.5 }}>
                    Switch de condition
                    <span className="row" style={{ gap: 4 }}>
                      <input
                        type="number" min={0} max={511}
                        disabled={cur.trigger !== "auto"}
                        value={cur.switch ?? 0}
                        onChange={(e) => patch({ switch: Number(e.target.value) })}
                      />
                      <button className="browse" title="Choisir dans la liste"
                        disabled={cur.trigger !== "auto"}
                        onClick={() => setSwPick(true)}>…</button>
                    </span>
                    <span className="hint">
                      {cur.trigger === "auto"
                        ? props.switchNames[cur.switch ?? 0] || ""
                        : ""}
                    </span>
                  </label>
                </div>
                {cur.trigger === "auto" && (
                  <span className="hint">
                    Relancé tant que le switch est ON (le joueur est gelé) —
                    penser à l'éteindre à la fin du script.
                  </span>
                )}
                <div className="palette-title">Contenu</div>
                <CommandListEditor
                  key={sel}
                  cmds={cur.commands}
                  commit={() => setDraft([...draft])}
                  shortcutsOff={swPick}
                  sceneNames={props.sceneNames}
                  scenes={props.scenes}
                  switchNames={props.switchNames}
                  varNames={props.varNames}
                  entryNames={[]}
                  charsetNames={props.charsetNames}
                  commonNames={draft.map((ce, i) => ce.name || `CE ${i + 1}`)}
                  onRenameVars={props.onRenameVars}
                />
              </>
            )}
          </div>
        </div>
        <div className="row">
          <button
            onClick={() =>
              props.onOk(
                draft.map((ce, i) => ({
                  ...ce,
                  name: ce.name.trim() || `CE ${i + 1}`,
                }))
              )
            }
          >
            OK
          </button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
      {swPick && cur && (
        <VarListModal
          kind="switch"
          pick
          initial={cur.switch ?? 0}
          switches={props.switchNames}
          variables={props.varNames}
          onClose={() => setSwPick(false)}
          onOk={(r) => {
            props.onRenameVars(r.switches, r.variables);
            if (r.picked !== undefined) patch({ switch: r.picked });
            setSwPick(false);
          }}
        />
      )}
    </div>
  );
}
