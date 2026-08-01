// STRUCTURE editor for a Database table (Phase 10): the list of fields
// and their types — the user creates their own tables without touching
// the TOML. The result is saved to schemas/<table>.toml, identical to a
// hand-written schema (dbgen sees no difference).

import { useState } from "react";
import type { DbField, DbSchema } from "../db";
import { fieldSize, isSnake } from "../db";

// the SYSTEM's types (docs/PLANNING_SYSTEME_DATABASE.md) — not tables:
// the list of tables a ref: can target comes from the props
const NUM_TYPES = ["u8", "u16", "s8", "s16"] as const;

interface Props {
  schema: DbSchema;
  tableNames: string[]; // possible targets of the ref: (every table)
  // renames: [old field name, new] — to migrate the data
  onOk: (schema: DbSchema, renames: [string, string][]) => void;
  onClose: () => void;
}

export default function SchemaEditorModal(props: Props) {
  const [draft, setDraft] = useState<DbSchema>(() => structuredClone(props.schema));
  const [sel, setSel] = useState(0);
  // follows the field renames (original index -> original name)
  const [origNames] = useState<string[]>(() => props.schema.fields.map((f) => f.name));
  const [origOf, setOrigOf] = useState<(number | null)[]>(() =>
    props.schema.fields.map((_, i) => i)
  );
  const cur: DbField | undefined = draft.fields[sel];
  const commit = () => setDraft({ ...draft });

  const patch = (p: Partial<DbField>) => {
    Object.assign(cur!, p);
    commit();
  };

  function addField() {
    const used = new Set(draft.fields.map((f) => f.name));
    let n = "champ";
    for (let i = 2; used.has(n); i++) n = `champ_${i}`;
    draft.fields.push({ name: n, type: "u8" });
    setOrigOf([...origOf, null]);
    setSel(draft.fields.length - 1);
    commit();
  }

  function removeField() {
    if (!cur) return;
    draft.fields.splice(sel, 1);
    setOrigOf(origOf.filter((_, i) => i !== sel));
    setSel(Math.max(0, sel - 1));
    commit();
  }

  function moveField(delta: number) {
    const j = sel + delta;
    if (!cur || j < 0 || j >= draft.fields.length) return;
    [draft.fields[sel], draft.fields[j]] = [draft.fields[j], draft.fields[sel]];
    const o = [...origOf];
    [o[sel], o[j]] = [o[j], o[sel]];
    setOrigOf(o);
    setSel(j);
    commit();
  }

  // changing type: purges the options that no longer make sense
  function setType(ty: string) {
    const f = cur!;
    f.type = ty;
    if (ty !== "flags8") delete f.flags;
    else f.flags ??= ["flag_1"];
    if (!(ty.startsWith("ref:") || ty === "text_id")) delete f.optional;
    if (!NUM_TYPES.includes(ty as (typeof NUM_TYPES)[number])) {
      delete f.min;
      delete f.max;
      delete f.default;
    }
    commit();
  }

  const nameBad = (f: DbField, i: number) =>
    !isSnake(f.name) || draft.fields.some((o, j) => j !== i && o.name === f.name);
  const anyBad =
    draft.fields.length === 0 ||
    draft.fields.some((f, i) => nameBad(f, i)) ||
    draft.fields.some((f) => f.type === "flags8" && !(f.flags ?? []).length);
  const typeValue = cur?.type.startsWith("ref:") ? "ref" : cur?.type ?? "u8";

  return (
    <div className="modal-backdrop">
      <div className="modal schemaedit" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">
          Structure de la table « {draft.title || draft.name} »
        <button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button></div>
        <div className="row">
          <label style={{ flex: 1 }}>
            Titre affiché
            <input
              value={draft.title ?? ""}
              onChange={(e) => {
                draft.title = e.target.value || undefined;
                commit();
              }}
            />
          </label>
          <label>
            Entrées max (1-255)
            <input
              type="number" min={1} max={255} value={draft.max ?? 255}
              onChange={(e) => {
                draft.max = Number(e.target.value);
                commit();
              }}
            />
          </label>
        </div>
        <div className="db-body" style={{ height: 360 }}>
          <div className="db-list" style={{ width: 210 }}>
            <div className="evedit-cmds" style={{ flex: 1 }}>
              {draft.fields.map((f, i) => (
                <div
                  key={i}
                  className={"evedit-line" + (i === sel ? " active" : "")}
                  style={nameBad(f, i) ? { color: "#ff7070" } : undefined}
                  onClick={() => setSel(i)}
                >
                  {f.name} <span className="db-badge">{f.type} · {fieldSize(f.type)} o</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 4 }}>
              <button title="Nouveau champ" onClick={addField}>＋</button>
              <button disabled={!cur} onClick={() => moveField(-1)}>↑</button>
              <button disabled={!cur} onClick={() => moveField(1)}>↓</button>
              <button className="danger" disabled={!cur || draft.fields.length <= 1}
                title="Les valeurs de ce champ seront retirées des entrées"
                onClick={removeField}>
                🗑
              </button>
            </div>
          </div>
          <div className="db-form">
            {!cur ? (
              <p className="hint">« ＋ Champ » pour ajouter un champ.</p>
            ) : (
              <>
                <div className="row">
                  <label style={{ flex: 1 }}>
                    Nom du champ (snake_case)
                    <input
                      value={cur.name}
                      style={nameBad(cur, sel) ? { outline: "1px solid #ff7070" } : undefined}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </label>
                  <label>
                    Type
                    <select
                      value={typeValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        setType(v === "ref" ? `ref:${props.tableNames[0] ?? draft.name}` : v);
                      }}
                    >
                      {NUM_TYPES.map((t) => (
                        <option key={t} value={t}>{t} (nombre)</option>
                      ))}
                      <option value="flags8">flags8 (8 cases à cocher)</option>
                      <option value="ref">ref (vers une autre table)</option>
                      <option value="text_id">text_id (banque de textes)</option>
                      <option value="picture">picture (image du projet)</option>
                      <option value="sound">sound (son du projet)</option>
                      <option value="music">music (musique du projet)</option>
                    </select>
                  </label>
                </div>
                {cur.type.startsWith("ref:") && (
                  <label>
                    Table cible
                    <select
                      value={cur.type.slice(4)}
                      onChange={(e) => patch({ type: `ref:${e.target.value}` })}
                    >
                      {props.tableNames.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                )}
                {cur.type === "flags8" && (
                  <label>
                    Noms des flags (un par ligne, 8 max — bit 0 en premier)
                    <textarea
                      rows={5}
                      value={(cur.flags ?? []).join("\n")}
                      style={!(cur.flags ?? []).length || (cur.flags ?? []).length > 8
                        ? { outline: "1px solid #ff7070" } : undefined}
                      onChange={(e) =>
                        patch({ flags: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 8) })
                      }
                    />
                  </label>
                )}
                {NUM_TYPES.includes(cur.type as (typeof NUM_TYPES)[number]) && (
                  <div className="row">
                    <label>
                      Valeur par défaut
                      <input
                        type="number" value={Number(cur.default ?? 0)}
                        onChange={(e) => patch({ default: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      min (option)
                      <input
                        type="number" value={cur.min ?? ""}
                        placeholder="type"
                        onChange={(e) =>
                          patch({ min: e.target.value === "" ? undefined : Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      max (option)
                      <input
                        type="number" value={cur.max ?? ""}
                        placeholder="type"
                        onChange={(e) =>
                          patch({ max: e.target.value === "" ? undefined : Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                )}
                <div className="row" style={{ gap: 14 }}>
                  {(cur.type.startsWith("ref:") || cur.type === "text_id") && (
                    <label className="checkline">
                      <input
                        type="checkbox"
                        checked={!!cur.optional}
                        onChange={(e) => patch({ optional: e.target.checked || undefined })}
                      />
                      Optionnel (« aucun » permis)
                    </label>
                  )}
                  <label className="checkline" title="Valeur de base, copiée en WRAM à l'instanciation (info)">
                    <input
                      type="checkbox"
                      checked={!!cur.runtime_copy}
                      onChange={(e) => patch({ runtime_copy: e.target.checked || undefined })}
                    />
                    Copie runtime ⟳
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="row" style={{ alignItems: "center" }}>
          <span className="hint">
            Taille d'une entrée : {draft.fields.reduce((n, f) => n + fieldSize(f.type), 0)} octet(s).
            Renommer un champ migre les valeurs ; le supprimer les retire.
          </span>
          <span style={{ flex: 1 }} />
          <button
            disabled={anyBad}
            title={anyBad ? "Un champ est invalide (nom, doublon ou flags vides)" : undefined}
            onClick={() => {
              const renames: [string, string][] = [];
              draft.fields.forEach((f, i) => {
                const o = origOf[i];
                if (o !== null && origNames[o] !== f.name) renames.push([origNames[o], f.name]);
              });
              props.onOk(draft, renames);
            }}
          >
            OK
          </button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
