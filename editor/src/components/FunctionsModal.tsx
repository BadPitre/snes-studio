// "Fonctions" window (Tools >) — F1.
//
// A function is a global script that takes PARAMETERS and can return a
// VALUE. It has a window of its own, separate from the common events,
// because it is not the same thing: a common event is a block of
// commands you TRIGGER (by hand, on autorun, in the background), a
// function is a computation you CALL. Mixing them in one list meant
// reading a checkbox to know which one you were looking at — and made
// fields cohabit (trigger, condition switch) that mean nothing for a
// function.

import { useState } from "react";
import type { Command, CommonEvent, FnSig, FunctionDef, Scene } from "../types";
import type { Database } from "../db";
import { CommandListEditor } from "./EventEditorModal";

interface Props {
  functions: FunctionDef[];
  commons: CommonEvent[]; // callable from a function body
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

const PARAMS_MAX = 8; // VM_PARAMS_MAX on the engine side
const LOCALS_MAX = 8; // VM_LOCALS_MAX

// Every "source" value of a command, the only thing that can carry a
// reference to a parameter: the right side of an assignment, a call's
// arguments, a returned value.
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

// Removing a parameter shifts all the following ones: without remapping,
// "the 3rd" becomes "the 2nd" and the function silently computes
// something else. And if the body STILL uses the one being removed there
// is no good fallback value — we refuse rather than guess. That is the
// case that used to reach datagen as an obscure message.
function slotUsed(cmds: Command[], kind: "param" | "local", k: number): boolean {
  let used = false;
  walkCmds(cmds, (c) => {
    for (const v of sources(c))
      if (v.from === kind && v.value === k) used = true;
    // a local is also a possible DESTINATION ("Modifier une variable"
    // with dst = local): forgetting it would leave a command writing
    // into a slot that no longer exists
    const any = c as unknown as { c: string; dst?: string; n?: number };
    if (kind === "local" && any.c === "var" && any.dst === "local" && any.n === k)
      used = true;
  });
  return used;
}

function shiftSlots(cmds: Command[], kind: "param" | "local", removed: number): void {
  walkCmds(cmds, (c) => {
    for (const v of sources(c))
      if (v.from === kind && v.value > removed) v.value -= 1;
    const any = c as unknown as { c: string; dst?: string; n?: number };
    if (
      kind === "local" && any.c === "var" && any.dst === "local" &&
      any.n !== undefined && any.n > removed
    )
      any.n -= 1;
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

  // Signatures visible from the body being edited: a function can call
  // another one (and itself — the engine handles recursion).
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
                  {(f.locals?.length ?? 0) > 0 ? ` [${f.locals!.length} loc.]` : ""}
                </div>
              ))}
            </div>
            <div className="row">
              <button
                title="Ajouter une fonction"
                onClick={() => {
                  setDraft([
                    ...draft,
                    { name: "", params: [], locals: [], returns: false, commands: [] },
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
            {/* The parameters live UNDER the function list, in the
                narrow column: they describe the selected function, not
                its content, and the room was free there. The body itself
                keeps the whole right-hand width. */}
            {cur && (
            <label>
              Paramètres (max {PARAMS_MAX})
              {/* One ROW per parameter: their ORDER is what
                  the caller will have to respect, and a grid that
                  rewraps with the width does not show that. The number
                  on the left is the one you find again in the
                  source "Un paramètre". */}
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
                      style={{ flex: "1 1 auto", minWidth: 0 }}
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
                        if (slotUsed(cur.commands, "param", k)) {
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
                        shiftSlots(commands, "param", k);
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
            )}
            {cur && (
            <label>
              Variables locales (max {LOCALS_MAX})
              {/* They live in the call FRAME, not among the
                  project's variables: every call has its own, zeroed.
                  That is what lets a recursive function keep a scratch
                  value without a nested call overwriting it.
                  */}
              <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {(cur.locals ?? []).map((lname, k) => (
                  <span
                    key={k}
                    style={{ display: "flex", gap: 4, alignItems: "center" }}
                  >
                    <span style={{ width: 16, opacity: 0.7, flex: "0 0 auto" }}>
                      {k + 1}.
                    </span>
                    <input
                      style={{ flex: "1 1 auto", minWidth: 0 }}
                      placeholder={"tmp" + (k + 1)}
                      value={lname}
                      onChange={(e) => {
                        const locals = (cur.locals ?? []).slice();
                        locals[k] = e.target.value;
                        patch({ locals });
                      }}
                    />
                    <button
                      title="Retirer cette variable locale"
                      style={{ flex: "0 0 auto", width: 24 }}
                      onClick={() => {
                        if (slotUsed(cur.commands, "local", k)) {
                          alert(
                            `La variable locale n° ${k + 1} (« ${lname || "sans nom"} ») ` +
                              `est encore utilisée dans le corps de la fonction.\n\n` +
                              `Retirer d'abord les commandes qui s'en servent.`
                          );
                          return;
                        }
                        const commands = structuredClone(cur.commands);
                        shiftSlots(commands, "local", k);
                        patch({
                          locals: (cur.locals ?? []).filter((_, i) => i !== k),
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
                    title="Ajouter une variable locale"
                    style={{ flex: "0 0 auto", width: 28, marginLeft: 20 }}
                    disabled={(cur.locals?.length ?? 0) >= LOCALS_MAX}
                    onClick={() => patch({ locals: [...(cur.locals ?? []), ""] })}
                  >
                    ＋
                  </button>
                </span>
              </span>
            </label>
            )}
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
                    // `.modal label` forces a column: without this
                    // flexDirection spelled out, the checkbox ends up
                    // ABOVE its label
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
                <span className="hint">
                  Dans le corps, les paramètres se lisent avec la source
                  « Un paramètre » — ils restent en LECTURE seule. Pour un
                  brouillon, utiliser une VARIABLE LOCALE : chaque appel a
                  les siennes, remises à zéro, donc une fonction récursive
                  ne s'écrase pas elle-même. Une fonction peut en appeler
                  une autre, et s'appeler elle-même.
                </span>
                <div className="palette-title">Contenu</div>
                <CommandListEditor
                  key={sel}
                  cmds={cur.commands}
                  fnSigs={sigs}
                  fnParams={cur.params}
                  fnLocals={cur.locals ?? []}
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
                  locals: (f.locals ?? []).map((l, k) => l.trim() || `tmp${k + 1}`),
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
