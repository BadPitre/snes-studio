// "Common events" window (Tools >) — modelled on the Common Events tab
// of the RM2003 Database: a numbered list on the left, Name / Trigger /
// Condition switch / Contents on the right. Common events are scripts
// GLOBAL to the project: callable from any event ("Appeler un common
// event"), or triggered automatically by a switch (restarted as long as
// the switch is ON — the script must turn it off, the RM2003 Autorun
// model).

import { useState } from "react";
import type { CommonEvent, Scene } from "../types";
import type { Database } from "../db";
import { CommandListEditor } from "./EventEditorModal";
import VarListModal from "./VarListModal";

interface Props {
  commons: CommonEvent[];
  fnSigs: import("../types").FnSig[]; // callable functions (F1)
  sceneNames: string[];
  scenes: Record<string, Scene>;
  switchNames: string[];
  varNames: string[];
  charsetNames: string[];
  db: Database | null; // db_read command (v0.17)
  uiWidgets: string[]; // layout roots (ui_show command, Ph. 12)
  uiStyles: string[]; // dialogue styles (S1) — msg/choice style field
  texts: import("../types").TextEntry[]; // catalogue (msg by reference, T2)
  pictures: string[]; // picture stems (S3) — pic_show command
  mode7Images: string[]; // Mode 7 image stems (M7)
  tintPresets: import("../types").TintPreset[]; // tint presets (S12b)
  soundNames: string[]; // sound stems (B1)
  musicNames: string[]; // music stems (B1)
  vigNames: string[]; // vignette stems (B5)
  animNames: string[]; // names of the frame-by-frame animations (A1)
  screenNames: string[]; // composed screens (B6bis)
  onTintPresets: (list: import("../types").TintPreset[]) => void;
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
    <div className="modal-backdrop">
      <div className="modal cevents" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Common events<button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button></div>
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
                title="Ajouter un common event"
                onClick={() => {
                  setDraft([
                    ...draft,
                    { name: "", trigger: "none", commands: [] },
                  ]);
                  setSel(draft.length);
                }}
              >
                ＋
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
                          switch: e.target.value === "none" ? undefined : cur.switch,
                        })
                      }
                    >
                      <option value="none">None (appelé)</option>
                      <option value="auto">Autorun</option>
                      <option value="parallel">Parallel process</option>
                    </select>
                  </label>
                  <label style={{ opacity: cur.trigger !== "none" ? 1 : 0.5 }}>
                    Condition switch
                    <span
                      className="row"
                      style={{ gap: 4, alignItems: "center" }}
                      title="Condition switch : le common event n'est actif que si ce switch est ON"
                    >
                      <input
                        type="checkbox"
                        style={{ flex: "0 0 auto", width: 14, height: 14, boxShadow: "none" }}
                        disabled={cur.trigger === "none"}
                        checked={cur.switch !== undefined}
                        onChange={(e) =>
                          patch({ switch: e.target.checked ? 0 : undefined })
                        }
                      />
                      <input
                        type="number" min={0} max={511}
                        disabled={cur.trigger === "none" || cur.switch === undefined}
                        value={cur.switch ?? 0}
                        onChange={(e) => patch({ switch: Number(e.target.value) })}
                      />
                      <button className="browse" title="Choisir dans la liste"
                        disabled={cur.trigger === "none" || cur.switch === undefined}
                        onClick={() => setSwPick(true)}>…</button>
                    </span>
                  </label>
                </div>
                {cur.trigger === "auto" && (
                  <span className="hint">
                    Autorun : relancé tant que la condition passe, le joueur
                    est gelé (cinématiques) — penser à éteindre le switch à
                    la fin du script. Sans condition switch, il tourne POUR
                    TOUJOURS (fin de jeu, écran titre…).
                  </span>
                )}
                {cur.trigger === "parallel" && (
                  <span className="hint">
                    Parallel process : tourne en tâche de fond, le joueur
                    reste libre (timers, pièges, ambiances…) — sans
                    condition switch, en permanence. Messages et choix
                    interdits ; rythmer avec « Attendre ».
                  </span>
                )}
                <div className="palette-title">Contenu</div>
                <CommandListEditor
                  key={sel}
                  cmds={cur.commands}
                  fnSigs={props.fnSigs}
                  commit={() => setDraft([...draft])}
                  shortcutsOff={swPick}
                  sceneNames={props.sceneNames}
                  scenes={props.scenes}
                  switchNames={props.switchNames}
                  varNames={props.varNames}
                  entryNames={[]}
                  charsetNames={props.charsetNames}
                  commonNames={draft.map((ce, i) => ce.name || `CE ${i + 1}`)}
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
                  onTintPresets={props.onTintPresets}
                  onRenameVars={props.onRenameVars}
                />
              </>
            )}
          </div>
        </div>
        <div className="modal-actions">
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
