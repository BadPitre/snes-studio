// Fenêtre « Fonctions » (Tools →) — F1.
//
// Une fonction est un script global qui prend des PARAMÈTRES et peut
// rendre une VALEUR. Elle a sa fenêtre à elle, séparée des common
// events, parce que ce n'est pas la même chose : un common event est un
// bloc de commandes qu'on DÉCLENCHE (manuellement, en auto, en tâche de
// fond), une fonction est un calcul qu'on APPELLE. Les mêler dans la
// même liste obligeait à lire une case à cocher pour savoir de quoi on
// parlait — et faisait cohabiter des champs (déclencheur, switch de
// condition) qui n'ont aucun sens pour une fonction.

import { useState } from "react";
import type { CommonEvent, FnSig, FunctionDef, Scene } from "../types";
import type { Database } from "../db";
import { CommandListEditor } from "./EventEditorModal";

interface Props {
  functions: FunctionDef[];
  commons: CommonEvent[]; // appelables depuis le corps d'une fonction
  sceneNames: string[];
  scenes: Record<string, Scene>;
  switchNames: string[];
  varNames: string[];
  charsetNames: string[];
  db: Database | null;
  uiWidgets: string[];
  uiStyles: string[];
  texts: import("../types").TextEntry[];
  pictures: string[];
  tintPresets: import("../types").TintPreset[];
  soundNames: string[];
  musicNames: string[];
  vigNames: string[];
  animNames: string[];
  screenNames: string[];
  onTintPresets: (list: import("../types").TintPreset[]) => void;
  onRenameVars: (switches: string[], variables: string[]) => void;
  onOk: (functions: FunctionDef[]) => void;
  onClose: () => void;
}

const PARAMS_MAX = 8; // VM_PARAMS_MAX côté moteur

export default function FunctionsModal(props: Props) {
  const [draft, setDraft] = useState<FunctionDef[]>(() =>
    structuredClone(props.functions)
  );
  const [sel, setSel] = useState(0);
  const cur = draft[sel] as FunctionDef | undefined;

  const patch = (p: Partial<FunctionDef>) =>
    setDraft(draft.map((f, i) => (i === sel ? { ...f, ...p } : f)));

  // Signatures vues depuis le corps édité : une fonction peut en appeler
  // une autre (et elle-même — le moteur gère la récursion).
  const sigs: FnSig[] = draft.map((f, i) => ({
    name: f.name || `F ${i + 1}`,
    params: f.params,
    returns: f.returns,
  }));

  return (
    <div className="modal-backdrop">
      <div className="modal cevents" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">
          Fonctions
          <button className="modal-x" title="Fermer" onClick={props.onClose}>
            ✕
          </button>
        </div>
        <div className="cevents-body">
          <div className="cevents-list">
            <div className="evedit-cmds" style={{ flex: 1 }}>
              {draft.map((f, i) => (
                <div
                  key={i}
                  className={"evedit-line" + (i === sel ? " active" : "")}
                  onClick={() => setSel(i)}
                >
                  {String(i + 1).padStart(4, "0")}: {f.name}({f.params.join(", ")})
                  {f.returns ? " → valeur" : ""}
                </div>
              ))}
            </div>
            <div className="row">
              <button
                title="Ajouter une fonction"
                onClick={() => {
                  setDraft([
                    ...draft,
                    { name: "", params: [], returns: false, commands: [] },
                  ]);
                  setSel(draft.length);
                }}
              >
                ＋
              </button>
              <button
                className="danger"
                disabled={!cur}
                title="Supprimer cette fonction (les « Appeler une fonction » qui la visent seront à corriger)"
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
                Aucune fonction — « ＋ Ajouter » pour en créer une, puis
                l'appeler depuis n'importe quel event avec « Appeler une
                fonction » (onglet Autres).
                <br />
                <br />
                Une fonction sert à écrire un calcul une seule fois :
                dégâts, prix marchandé, expérience du niveau suivant… Elle
                reçoit ses entrées en paramètres et peut rendre un
                résultat, au lieu de passer par des variables globales
                réservées à la main.
              </p>
            ) : (
              <>
                <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label style={{ flex: "1 1 180px" }}>
                    Nom
                    <input
                      value={cur.name}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </label>
                  <label
                    className="row"
                    style={{ gap: 6, alignItems: "center", flex: "0 0 auto" }}
                    title="La fonction rend une valeur, que l'appelant peut ranger dans une variable"
                  >
                    <input
                      type="checkbox"
                      style={{ flex: "0 0 auto", width: 14, height: 14, boxShadow: "none" }}
                      checked={cur.returns}
                      onChange={(e) => patch({ returns: e.target.checked })}
                    />
                    Rend une valeur
                  </label>
                </div>
                <label>
                  Paramètres (max {PARAMS_MAX})
                  <span className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                    {cur.params.map((pname, k) => (
                      <span className="row" key={k} style={{ gap: 2 }}>
                        <input
                          style={{ width: 100 }}
                          placeholder={"p" + (k + 1)}
                          value={pname}
                          onChange={(e) => {
                            const params = cur.params.slice();
                            params[k] = e.target.value;
                            patch({ params });
                          }}
                        />
                        <button
                          title="Retirer ce paramètre"
                          style={{ flex: "0 0 auto", width: 22 }}
                          onClick={() =>
                            patch({ params: cur.params.filter((_, i) => i !== k) })
                          }
                        >
                          −
                        </button>
                      </span>
                    ))}
                    <button
                      title="Ajouter un paramètre"
                      style={{ flex: "0 0 auto", width: 28 }}
                      disabled={cur.params.length >= PARAMS_MAX}
                      onClick={() => patch({ params: [...cur.params, ""] })}
                    >
                      ＋
                    </button>
                  </span>
                </label>
                <span className="hint">
                  Dans le corps, les paramètres se lisent avec la source
                  « Un paramètre ». Ils sont en LECTURE seule : pour un
                  brouillon, passer par une variable. Une fonction peut en
                  appeler une autre, et s'appeler elle-même.
                </span>
                <div className="palette-title">Contenu</div>
                <CommandListEditor
                  key={sel}
                  cmds={cur.commands}
                  fnSigs={sigs}
                  fnParams={cur.params}
                  commit={() => setDraft([...draft])}
                  sceneNames={props.sceneNames}
                  scenes={props.scenes}
                  switchNames={props.switchNames}
                  varNames={props.varNames}
                  entryNames={[]}
                  charsetNames={props.charsetNames}
                  commonNames={props.commons.map(
                    (ce, i) => ce.name || `CE ${i + 1}`
                  )}
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
                draft.map((f, i) => ({
                  ...f,
                  name: f.name.trim() || `F ${i + 1}`,
                  params: f.params.map((p, k) => p.trim() || `p${k + 1}`),
                }))
              )
            }
          >
            OK
          </button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
