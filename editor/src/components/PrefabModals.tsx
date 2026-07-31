// Fenêtres des prefabs (v0.16) :
// — SavePrefabModal : « Enregistrer comme prefab » avec nom + CATÉGORIE
//   (fini le prompt du navigateur, et fini les prefabs tous au même
//   endroit) ;
// — PrefabsModal : bibliothèque groupée par catégorie — sert de fenêtre
//   « Nouvel événement depuis un prefab » (pick) ET de gestionnaire
//   (Tools → Prefabs… : renommer, recatégoriser, supprimer).

import { useState } from "react";
import type { EventPrefab } from "../types";

const NO_CAT = "Sans catégorie";

function categories(prefabs: EventPrefab[]): string[] {
  const cats: string[] = [];
  for (const pf of prefabs) {
    const c = pf.category?.trim() || NO_CAT;
    if (!cats.includes(c)) cats.push(c);
  }
  return cats;
}

// ---- Enregistrer comme prefab ---------------------------------------------

export function SavePrefabModal(props: {
  defaultName: string;
  existingCategories: string[];
  onOk: (name: string, category: string | undefined) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(props.defaultName);
  const [cat, setCat] = useState("");
  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Enregistrer comme prefab<button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button></div>
        <label>
          Nom du prefab
          <input value={name} autoFocus onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Catégorie (libre — pour ranger la bibliothèque)
          <input
            value={cat}
            list="prefab-cats"
            placeholder={NO_CAT}
            onChange={(e) => setCat(e.target.value)}
          />
          <datalist id="prefab-cats">
            {props.existingCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <div className="row">
          <button
            disabled={!name.trim()}
            onClick={() => props.onOk(name.trim(), cat.trim() || undefined)}
          >
            OK
          </button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

// ---- Bibliothèque : choisir / gérer ---------------------------------------

export function PrefabsModal(props: {
  prefabs: EventPrefab[];
  pick?: boolean; // « Nouvel événement depuis un prefab » : double-clic = créer
  onPick?: (pf: EventPrefab) => void;
  onOk: (prefabs: EventPrefab[]) => void; // renommages/suppressions appliqués
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EventPrefab[]>(() =>
    structuredClone(props.prefabs)
  );
  const [sel, setSel] = useState(0);
  const cur = draft[sel] as EventPrefab | undefined;
  const patch = (p: Partial<EventPrefab>) =>
    setDraft(draft.map((pf, i) => (i === sel ? { ...pf, ...p } : pf)));

  const pick = (i: number) => {
    if (!props.pick || !draft[i]) return;
    props.onOk(draft); // les éditions faites en passant sont conservées
    props.onPick?.(draft[i]);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal prefabs" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">
          {props.pick ? "Nouvel événement depuis un prefab" : "Prefabs"}
        <button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button></div>
        {draft.length === 0 ? (
          <p className="hint">
            Aucun prefab — clic droit sur un event de la carte →
            « Enregistrer comme prefab… ».
          </p>
        ) : (
          <div className="prefabs-body">
            <div className="evedit-cmds" style={{ flex: 1 }}>
              {categories(draft).map((c) => (
                <div key={c}>
                  <div className="prefabs-cat">{c}</div>
                  {draft.map((pf, i) =>
                    (pf.category?.trim() || NO_CAT) === c ? (
                      <div
                        key={i}
                        className={"evedit-line" + (i === sel ? " active" : "")}
                        onClick={() => setSel(i)}
                        onDoubleClick={() => pick(i)}
                      >
                        {pf.name}
                      </div>
                    ) : null
                  )}
                </div>
              ))}
            </div>
            <div className="prefabs-side">
              {cur && (
                <>
                  <label>
                    Nom
                    <input value={cur.name} onChange={(e) => patch({ name: e.target.value })} />
                  </label>
                  <label>
                    Catégorie
                    <input
                      value={cur.category ?? ""}
                      list="prefab-cats2"
                      placeholder={NO_CAT}
                      onChange={(e) =>
                        patch({ category: e.target.value.trim() || undefined })
                      }
                    />
                    <datalist id="prefab-cats2">
                      {categories(draft).filter((c) => c !== NO_CAT).map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </label>
                  <span className="hint">
                    Déclencheur : {cur.event.trigger} —{" "}
                    {cur.event.commands.length} commande(s)
                    {cur.event.extraPages?.length
                      ? `, ${1 + cur.event.extraPages.length} pages`
                      : ""}
                  </span>
                  {props.pick && (
                    <button onClick={() => pick(sel)}>Créer ici</button>
                  )}
                  <button
                    className="danger"
                    onClick={() => {
                      setDraft(draft.filter((_, i) => i !== sel));
                      setSel(Math.max(0, sel - 1));
                    }}
                  >
                    Supprimer le prefab
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <div className="row">
          {!props.pick && (
            <button onClick={() => props.onOk(draft)}>OK</button>
          )}
          <button onClick={props.onClose}>
            {props.pick ? "Annuler" : "Fermer"}
          </button>
        </div>
      </div>
    </div>
  );
}
