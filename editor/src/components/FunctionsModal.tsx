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
import type { Command, CommonEvent, FnSig, FunctionDef, Scene } from "../types";
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

// Toutes les valeurs « source » d'une commande, la seule chose qui peut
// porter une référence à un paramètre : membre droit d'une affectation,
// arguments d'un appel, valeur retournée.
function sources(c: Command): { from?: string; value: number }[] {
  const any = c as unknown as {
    from?: string;
    value?: number;
    args?: { from?: string; value: number }[];
  };
  const out: { from?: string; value: number }[] = [];
  if (any.value !== undefined) out.push(any as { from?: string; value: number });
  for (const a of any.args ?? []) out.push(a);
  return out;
}

function walkCmds(cmds: Command[] | undefined, fn: (c: Command) => void): void {
  for (const c of cmds ?? []) {
    fn(c);
    const any = c as unknown as Record<string, Command[] | undefined>;
    walkCmds(any.do, fn);
    walkCmds(any.then, fn);
    walkCmds(any.else, fn);
    const opts = (c as unknown as { options?: { do?: Command[] }[] }).options;
    for (const o of opts ?? []) walkCmds(o.do, fn);
  }
}

// Retirer un paramètre décale tous les suivants : sans remapper, « le
// 3e » devient « le 2e » et la fonction calcule autre chose en silence.
// Et si le corps se sert ENCORE de celui qu'on enlève, il n'y a pas de
// bonne valeur de repli — on refuse plutôt que de deviner. C'est ce cas
// qui remontait jusqu'à datagen sous la forme d'un message obscur.
function paramUsed(cmds: Command[], k: number): boolean {
  let used = false;
  walkCmds(cmds, (c) => {
    for (const v of sources(c)) if (v.from === "param" && v.value === k) used = true;
  });
  return used;
}

function shiftParams(cmds: Command[], removed: number): void {
  walkCmds(cmds, (c) => {
    for (const v of sources(c))
      if (v.from === "param" && v.value > removed) v.value -= 1;
  });
}


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
                  {f.returns ? " → résultat" : ""}
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
                    // `.modal label` force une colonne : sans ce
                    // flexDirection en clair, la case se retrouve AU-DESSUS
                    // de son libelle
                    style={{
                      flexDirection: "row",
                      gap: 6,
                      alignItems: "center",
                      flex: "0 0 auto",
                      paddingBottom: 4,
                    }}
                    title="La fonction rend un résultat, que l'appelant peut ranger dans une variable"
                  >
                    <input
                      type="checkbox"
                      style={{ flex: "0 0 auto", width: 14, height: 14, boxShadow: "none" }}
                      checked={cur.returns}
                      onChange={(e) => patch({ returns: e.target.checked })}
                    />
                    Retourne un résultat
                  </label>
                </div>
                <label>
                  Paramètres (max {PARAMS_MAX})
                  {/* Une LIGNE par paramètre : leur ORDRE est ce que
                      l'appelant devra respecter, et une grille qui se
                      réenroule au gré de la largeur ne le montre pas. Le
                      numéro à gauche est celui qu'on retrouve dans la
                      source « Un paramètre ». */}
                  <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {cur.params.map((pname, k) => (
                      <span
                        key={k}
                        style={{ display: "flex", gap: 4, alignItems: "center" }}
                      >
                        <span style={{ width: 16, opacity: 0.7, flex: "0 0 auto" }}>
                          {k + 1}.
                        </span>
                        <input
                          style={{ flex: "1 1 auto", maxWidth: 220 }}
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
                          style={{ flex: "0 0 auto", width: 24 }}
                          onClick={() => {
                            if (paramUsed(cur.commands, k)) {
                              alert(
                                `Le paramètre n° ${k + 1} (« ${pname || "sans nom"} ») ` +
                                  `est encore utilisé dans le corps de la fonction.\n\n` +
                                  `Retirer d'abord les commandes qui s'en servent : ` +
                                  `sinon elles désigneraient un paramètre qui n'existe ` +
                                  `plus, et le build échouerait.`
                              );
                              return;
                            }
                            const commands = structuredClone(cur.commands);
                            shiftParams(commands, k);
                            patch({
                              params: cur.params.filter((_, i) => i !== k),
                              commands,
                            });
                          }}
                        >
                          −
                        </button>
                      </span>
                    ))}
                    <span>
                      <button
                        title="Ajouter un paramètre"
                        style={{ flex: "0 0 auto", width: 28, marginLeft: 20 }}
                        disabled={cur.params.length >= PARAMS_MAX}
                        onClick={() => patch({ params: [...cur.params, ""] })}
                      >
                        ＋
                      </button>
                    </span>
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
                  inFunction
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
