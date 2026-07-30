// Fenêtre « Database » (Tools →, Phase 10) — l'expérience Database de
// RPG Maker : tables à gauche, instances au centre, formulaire à droite.
// UNE SEULE UI générique pilotée par les schémas : le formulaire se
// dessine depuis schemas/*.toml, AUCUN champ codé en dur ici (règle 1
// de docs/INTEGRATION_DATABASE_EDITEUR.md). Ajouter une table = ajouter
// un schéma, zéro code React.

import { useState } from "react";
import type { Database, DbEntry, DbField, DbSchema } from "../db";
import { entrySize, fieldBounds, fieldSize, isSnake, refUsages, renameEntry } from "../db";
import SchemaEditorModal from "./SchemaEditorModal";
import AudioPreviewButton, { stopPreview } from "./AudioPreview";
import { assetStem } from "../types";

interface Props {
  db: Database;
  textNames: string[]; // banque de textes (champs text_id)
  // B7 — ressources du projet (chemins) : champs picture/sound/music
  root: string;
  pictures: string[];
  sounds: string[];
  musics: string[];
  // removed : tables supprimées (leurs fichiers seront retirés du disque)
  onOk: (db: Database, removed: string[]) => void;
  onClose: () => void;
}

// libellé affiché d'une entrée (liste + menus ref:)
function label(e: DbEntry): string {
  return e.name || e.id;
}

export default function DatabaseModal(props: Props) {
  const [draft, setDraft] = useState<Database>(() => structuredClone(props.db));
  const [table, setTable] = useState(0);
  const [sel, setSel] = useState(0);
  const [confirmDel, setConfirmDel] = useState<string[] | null>(null);
  // création de table (l'utilisateur crée SES databases) + édition de
  // structure + tables supprimées (fichiers retirés à la sauvegarde)
  const [newTable, setNewTable] = useState<{ name: string; title: string } | null>(null);
  const [schemaEdit, setSchemaEdit] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);

  const sc: DbSchema | undefined = draft.schemas[table];
  const list: DbEntry[] = sc ? draft.entries[sc.name] ?? [] : [];
  const cur: DbEntry | undefined = list[sel];
  const commit = () => setDraft({ ...draft });

  // tables dont des champs ref: visent celle-ci (suppression bloquée)
  const tableRefs = (name: string) =>
    draft.schemas
      .filter((s) => s.name !== name && s.fields.some((f) => f.type === `ref:${name}`))
      .map((s) => s.title || s.name);

  function removeTable() {
    if (!sc || tableRefs(sc.name).length) return;
    setRemoved([...removed, sc.name]);
    delete draft.entries[sc.name];
    draft.schemas = draft.schemas.filter((s) => s.name !== sc.name);
    setTable(Math.max(0, table - 1));
    setSel(0);
    commit();
  }

  // applique une nouvelle structure : renommages migrés, champs
  // supprimés purgés des entrées
  function applySchema(next: DbSchema, renames: [string, string][]) {
    const keep = new Set(next.fields.map((f) => f.name));
    for (const e of draft.entries[next.name] ?? []) {
      for (const [oldN, newN] of renames) {
        if (oldN in e) {
          e[newN] = e[oldN];
          delete e[oldN];
        }
      }
      for (const k of Object.keys(e)) {
        if (k !== "id" && k !== "name" && !keep.has(k)) delete e[k];
      }
    }
    draft.schemas[table] = next;
    setSchemaEdit(false);
    commit();
  }

  // id libre le plus proche (nouvel/dupliqué)
  function freeId(base: string): string {
    const ids = new Set(list.map((e) => e.id));
    let stem = base.replace(/[^a-z0-9_]/g, "") || "entree";
    if (!/^[a-z]/.test(stem)) stem = "e" + stem;
    if (!ids.has(stem)) return stem;
    for (let i = 2; ; i++) if (!ids.has(`${stem}_${i}`)) return `${stem}_${i}`;
  }

  function addEntry(from?: DbEntry) {
    if (!sc) return;
    const e: DbEntry = from
      ? { ...structuredClone(from), id: freeId(from.id) }
      : { id: freeId("entree") };
    if (!from) {
      for (const f of sc.fields) {
        if (f.default !== undefined) e[f.name] = structuredClone(f.default);
      }
    }
    const target = (draft.entries[sc.name] ??= []);
    target.push(e);
    setSel(target.length - 1);
    commit();
  }

  function removeEntry() {
    if (!sc || !cur) return;
    const usages = refUsages(draft, sc.name, cur.id);
    if (usages.length && !confirmDel) {
      // suppression protégée : lister les usages avant de confirmer
      setConfirmDel(usages.map((u) => `${u.table} « ${u.entry} » (champ ${u.field})`));
      return;
    }
    draft.entries[sc.name] = list.filter((_, i) => i !== sel);
    setSel(Math.max(0, sel - 1));
    setConfirmDel(null);
    commit();
  }

  function moveEntry(delta: number) {
    if (!sc || !cur) return;
    const j = sel + delta;
    if (j < 0 || j >= list.length) return;
    [list[sel], list[j]] = [list[j], list[sel]];
    setSel(j);
    commit();
  }

  // ---- widgets par type (le mapping du planning) -----------------------

  function fieldWidget(f: DbField) {
    if (!cur) return null;
    const bounds = fieldBounds(f);
    const set = (v: unknown) => {
      if (v === undefined) delete cur[f.name];
      else cur[f.name] = v;
      commit();
    };
    const tip = f.runtime_copy
      ? "Valeur de base — copiée en WRAM à l'instanciation"
      : undefined;
    if (bounds) {
      const v = Number(cur[f.name] ?? f.default ?? 0);
      const bad = v < bounds[0] || v > bounds[1] || !Number.isInteger(v);
      return (
        <label key={f.name} title={tip}>
          {f.name}
          {f.runtime_copy ? " ⟳" : ""} ({f.type} {bounds[0]}..{bounds[1]})
          <input
            type="number" min={bounds[0]} max={bounds[1]} value={v}
            style={bad ? { outline: "1px solid #ff7070" } : undefined}
            onChange={(e) => set(Number(e.target.value))}
          />
        </label>
      );
    }
    if (f.type === "flags8") {
      const on: string[] = Array.isArray(cur[f.name]) ? (cur[f.name] as string[]) : [];
      return (
        <fieldset key={f.name} className="evedit-box">
          <legend>{f.name}</legend>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {(f.flags ?? []).map((fl) => (
              <label key={fl} className="checkline">
                <input
                  type="checkbox"
                  checked={on.includes(fl)}
                  onChange={(e) =>
                    set(
                      e.target.checked
                        ? [...on, fl]
                        : on.filter((x) => x !== fl)
                    )
                  }
                />
                {fl}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    if (f.type.startsWith("ref:")) {
      const target = f.type.slice(4);
      const opts = draft.entries[target] ?? [];
      const v = String(cur[f.name] ?? "");
      const broken = v !== "" && !opts.some((o) => o.id === v);
      return (
        <label key={f.name} title={tip}>
          {f.name} (→ {target})
          <select
            value={v}
            style={broken ? { outline: "1px solid #ff7070" } : undefined}
            onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
          >
            {(f.optional || v === "") && <option value="">(aucun)</option>}
            {broken && <option value={v}>⚠ {v} (ref cassée)</option>}
            {opts.map((o) => (
              <option key={o.id} value={o.id}>
                {label(o)}
              </option>
            ))}
          </select>
        </label>
      );
    }
    if (f.type === "text_id") {
      const v = String(cur[f.name] ?? "");
      const broken = v !== "" && !props.textNames.includes(v);
      return (
        <label key={f.name}>
          {f.name} (texte)
          <select
            value={v}
            style={broken ? { outline: "1px solid #ff7070" } : undefined}
            onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
          >
            {(f.optional || v === "") && <option value="">(aucun)</option>}
            {broken && <option value={v}>⚠ {v} (texte inconnu)</option>}
            {props.textNames.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      );
    }
    if (f.type === "picture" || f.type === "sound" || f.type === "music") {
      // B7 : ressource du projet par NOM (menu déroulant) — dbgen résout
      // vers l'index de la liste projet au build, 0xFF si absent
      const paths =
        f.type === "picture" ? props.pictures : f.type === "sound" ? props.sounds : props.musics;
      const what = f.type === "picture" ? "image" : f.type === "sound" ? "son" : "musique";
      const v = String(cur[f.name] ?? "");
      const vPath = paths.find((pp) => assetStem(pp) === v);
      const broken = v !== "" && !vPath;
      return (
        <label key={f.name} title={tip}>
          {f.name} ({what})
          <div className="row" style={{ gap: 4 }}>
            <select
              style={{ flex: 1, ...(broken ? { outline: "1px solid #ff7070" } : {}) }}
              value={v}
              onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
            >
              {(f.optional || v === "") && <option value="">(aucun{what === "image" ? "e" : ""})</option>}
              {broken && <option value={v}>⚠ {v} (introuvable)</option>}
              {paths.map((pp) => (
                <option key={pp} value={assetStem(pp)}>
                  {assetStem(pp)}
                </option>
              ))}
            </select>
            {f.type !== "picture" && vPath && (
              <AudioPreviewButton path={vPath} root={props.root} />
            )}
          </div>
        </label>
      );
    }
    // dégradation élégante : type inconnu = lecture seule + avertissement
    return (
      <label key={f.name}>
        {f.name} — ⚠ type « {f.type} » inconnu (lecture seule)
        <input value={String(cur[f.name] ?? "")} disabled />
      </label>
    );
  }

  const totalBytes = draft.schemas.reduce(
    (n, s) => n + (draft.entries[s.name]?.length ?? 0) * entrySize(s),
    0
  );

  const close = () => {
    stopPreview(); // l'aperçu audio ne survit pas à la fenêtre
    props.onClose();
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal database" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Database</div>
        <div className="db-body">
          <div className="db-tablecol">
            <div className="evedit-cmds db-tables">
              {draft.schemas.map((s, i) => (
                <div
                  key={s.name}
                  className={"evedit-line" + (i === table ? " active" : "")}
                  onClick={() => {
                    setTable(i);
                    setSel(0);
                  }}
                >
                  {s.title || s.name}
                  <span className="db-badge">
                    {draft.entries[s.name]?.length ?? 0}/{s.max ?? 255}
                  </span>
                </div>
              ))}
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
              <button title="Nouvelle table" onClick={() => setNewTable({ name: "", title: "" })}>
                ＋
              </button>
              <button
                disabled={!sc}
                title="Paramètres de la table (champs et types)"
                onClick={() => setSchemaEdit(true)}
              >
                🗃
              </button>
              <button
                className="danger"
                disabled={!sc || tableRefs(sc?.name ?? "").length > 0}
                title={
                  sc && tableRefs(sc.name).length
                    ? `Visée par des ref: de ${tableRefs(sc.name).join(", ")} — retirer ces champs d'abord`
                    : "Supprimer la table (schéma + données)"
                }
                onClick={removeTable}
              >
                🗑
              </button>
            </div>
          </div>
          <div className="db-list">
            <div className="evedit-cmds" style={{ flex: 1 }}>
              {list.map((e, i) => (
                <div
                  key={i}
                  className={"evedit-line" + (i === sel ? " active" : "")}
                  onClick={() => setSel(i)}
                >
                  {String(i).padStart(3, "0")}: {label(e)}
                </div>
              ))}
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
              <button
                disabled={!sc || list.length >= (sc?.max ?? 255)}
                onClick={() => addEntry()}
              >
                Nouveau
              </button>
              <button disabled={!cur || list.length >= (sc?.max ?? 255)} onClick={() => addEntry(cur)}>
                Dupliquer
              </button>
              <button disabled={!cur} onClick={() => moveEntry(-1)}>↑</button>
              <button disabled={!cur} onClick={() => moveEntry(1)}>↓</button>
              <button className="danger" disabled={!cur} onClick={removeEntry}>
                🗑
              </button>
            </div>
          </div>
          <div className="db-form">
            {!sc ? (
              <p className="hint">Aucun schéma dans schemas/.</p>
            ) : !cur ? (
              <p className="hint">
                « Nouveau » pour créer une entrée de {sc.title || sc.name}.
              </p>
            ) : (
              <>
                <div className="row">
                  <label style={{ flex: 1 }}>
                    id (constante C : {sc.name.toUpperCase()}_
                    {(cur.id || "?").toUpperCase()})
                    <input
                      value={cur.id}
                      style={
                        !isSnake(cur.id) ||
                        list.some((e, i) => i !== sel && e.id === cur.id)
                          ? { outline: "1px solid #ff7070" }
                          : undefined
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isSnake(v) || v === "") {
                          // refactoring : renommer met à jour toutes les refs
                          renameEntry(draft, sc.name, cur.id, v);
                        }
                        cur.id = v;
                        commit();
                      }}
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    Nom affiché
                    <input
                      value={cur.name ?? ""}
                      onChange={(e) => {
                        cur.name = e.target.value || undefined;
                        commit();
                      }}
                    />
                  </label>
                </div>
                <div className="db-fields">{sc.fields.map((f) => fieldWidget(f))}</div>
              </>
            )}
          </div>
        </div>
        <div className="row" style={{ alignItems: "center" }}>
          <span className="hint">
            {sc
              ? `${sc.name} : ${list.length} × ${entrySize(sc)} o = ${
                  list.length * entrySize(sc)
                } o — database totale : ${totalBytes} o en ROM`
              : ""}
          </span>
          <span style={{ flex: 1 }} />
          <button
            disabled={draft.schemas.some((s) =>
              (draft.entries[s.name] ?? []).some(
                (e, i, arr) =>
                  !isSnake(e.id) || arr.some((o, j) => j !== i && o.id === e.id)
              )
            )}
            title="Désactivé tant qu'un id est invalide ou en double"
            onClick={() => {
              stopPreview();
              props.onOk(draft, removed);
            }}
          >
            OK
          </button>
          <button onClick={close}>Annuler</button>
        </div>
      </div>
      {newTable && (
        <div className="modal-backdrop" onClick={() => setNewTable(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="palette-title">Nouvelle table</div>
            <label>
              Nom technique (snake_case — fichiers et constantes C)
              <input
                value={newTable.name}
                autoFocus
                placeholder="monstres"
                style={
                  newTable.name !== "" &&
                  (!isSnake(newTable.name) ||
                    draft.schemas.some((s) => s.name === newTable.name))
                    ? { outline: "1px solid #ff7070" }
                    : undefined
                }
                onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
              />
            </label>
            <label>
              Titre affiché
              <input
                value={newTable.title}
                placeholder="Monstres"
                onChange={(e) => setNewTable({ ...newTable, title: e.target.value })}
              />
            </label>
            <div className="row">
              <button
                disabled={
                  !isSnake(newTable.name) ||
                  draft.schemas.some((s) => s.name === newTable.name)
                }
                onClick={() => {
                  draft.schemas.push({
                    name: newTable.name,
                    title: newTable.title || undefined,
                    max: 255,
                    fields: [{ name: "valeur", type: "u8", default: 0 }],
                  });
                  draft.entries[newTable.name] = [];
                  setRemoved(removed.filter((n) => n !== newTable.name));
                  setTable(draft.schemas.length - 1);
                  setSel(0);
                  setNewTable(null);
                  setSchemaEdit(true); // enchaîner sur la structure
                  commit();
                }}
              >
                Créer
              </button>
              <button onClick={() => setNewTable(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
      {schemaEdit && sc && (
        <SchemaEditorModal
          schema={sc}
          tableNames={draft.schemas.map((s) => s.name)}
          onOk={applySchema}
          onClose={() => setSchemaEdit(false)}
        />
      )}
      {confirmDel && cur && (
        <div className="modal-backdrop" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="palette-title">Entrée référencée</div>
            <p className="hint">
              « {label(cur)} » est utilisé par : {confirmDel.join(", ")}. Les
              refs deviendront cassées (soulignées en rouge).
            </p>
            <div className="row">
              <button className="danger" onClick={removeEntry}>
                Supprimer quand même
              </button>
              <button onClick={() => setConfirmDel(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// taille d'un champ exportée pour les jauges externes (panneau build, v2)
export { fieldSize };
