// Fenêtre « Common events » (Tools →) — calquée sur l'onglet Common
// Events de la Database RM2003 : liste numérotée à gauche, Nom /
// Déclencheur / Switch de condition / Contenu à droite. Les common
// events sont des scripts GLOBAUX au projet : appelables depuis
// n'importe quel event (« Appeler un common event »), ou déclenchés en
// auto par un switch (relancés tant que le switch est ON — le script
// doit l'éteindre, modèle Autorun RM2003).

import { useState } from "react";
import type { CommonEvent, Scene } from "../types";
import type { Database } from "../db";
import { CommandListEditor } from "./EventEditorModal";
import VarListModal from "./VarListModal";

interface Props {
  commons: CommonEvent[];
  sceneNames: string[];
  scenes: Record<string, Scene>;
  switchNames: string[];
  varNames: string[];
  charsetNames: string[];
  db: Database | null; // commande db_read (v0.17)
  uiWidgets: string[]; // racines du layout (commande ui_show, Ph. 12)
  uiStyles: string[]; // styles de dialogue (S1) — champ style de msg/choice
  texts: import("../types").TextEntry[]; // catalogue (msg par référence, T2)
  pictures: string[]; // stems des images (S3) — commande pic_show
  tintPresets: import("../types").TintPreset[]; // presets de teinte (S12b)
  soundNames: string[]; // stems des sons (B1)
  musicNames: string[]; // stems des musiques (B1)
  vigNames: string[]; // stems des vignettes (B5)
  animNames: string[]; // noms des animations image par image (A1)
  screenNames: string[]; // écrans composés (B6bis)
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
                <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label style={{ flex: "1 1 260px" }}>
                    Paramètres (max 8)
                    <span className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                      {(cur.params ?? []).map((pname, k) => (
                        <span className="row" key={k} style={{ gap: 2 }}>
                          <input
                            style={{ width: 90 }}
                            placeholder={"p" + (k + 1)}
                            value={pname}
                            onChange={(e) => {
                              const params = (cur.params ?? []).slice();
                              params[k] = e.target.value;
                              patch({ params });
                            }}
                          />
                          <button
                            title="Retirer ce paramètre"
                            style={{ flex: "0 0 auto", width: 22 }}
                            onClick={() =>
                              patch({
                                params: (cur.params ?? []).filter((_, i) => i !== k),
                              })
                            }
                          >
                            −
                          </button>
                        </span>
                      ))}
                      <button
                        title="Ajouter un paramètre"
                        style={{ flex: "0 0 auto", width: 28 }}
                        disabled={
                          (cur.params?.length ?? 0) >= 8 || cur.trigger !== "none"
                        }
                        onClick={() =>
                          patch({ params: [...(cur.params ?? []), ""] })
                        }
                      >
                        ＋
                      </button>
                    </span>
                  </label>
                  <label className="row" style={{ gap: 6, alignItems: "center", flex: "0 0 auto" }}>
                    <input
                      type="checkbox"
                      style={{ flex: "0 0 auto", width: 14, height: 14, boxShadow: "none" }}
                      checked={!!cur.returns}
                      onChange={(e) => patch({ returns: e.target.checked || undefined })}
                    />
                    Rend une valeur
                  </label>
                </div>
                {((cur.params?.length ?? 0) > 0 || cur.returns) && (
                  <span className="hint">
                    Ce common event est une FONCTION : elle s'appelle avec
                    « Appeler une fonction », qui demandera une valeur pour
                    chaque paramètre. Dans son corps, les paramètres se
                    lisent avec la source « Un paramètre ». Ils sont en
                    LECTURE seule — pour un brouillon, passer par une
                    variable.
                  </span>
                )}
                {cur.trigger !== "none" && (cur.params?.length ?? 0) > 0 && (
                  <span className="hint" style={{ color: "#ff7070" }}>
                    Une fonction à paramètres ne peut pas être déclenchée
                    automatiquement : personne ne lui passerait ses
                    arguments. Repasser le déclencheur sur « None », ou
                    retirer les paramètres.
                  </span>
                )}
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
                  commonSigs={draft.map((ce) => ({
                    name: ce.name,
                    params: ce.params ?? [],
                    returns: !!ce.returns,
                  }))}
                  fnParams={cur.params ?? []}
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
