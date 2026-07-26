// Panneau textes : la table name → texte (les text_id suivent l'ordre).

import type { TextEntry } from "../types";

interface Props {
  texts: TextEntry[];
  onChange: (texts: TextEntry[]) => void;
}

// v0 : ASCII 32-126 uniquement (datagen refuse le reste)
function asciiOnly(s: string): string {
  return [...s].filter((c) => c >= " " && c <= "~").join("");
}

export default function TextsPanel({ texts, onChange }: Props) {
  function update(i: number, patch: Partial<TextEntry>) {
    onChange(texts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }

  return (
    <div className="panel">
      <div className="panel-title">Textes ({texts.length})</div>
      {texts.map((t, i) => (
        <div key={i} className="text-entry">
          <input
            className="text-name"
            value={t.name}
            onChange={(e) => update(i, { name: e.target.value.replace(/[^a-z0-9_]/g, "") })}
          />
          <textarea
            rows={2}
            value={t.text}
            onChange={(e) => update(i, { text: asciiOnly(e.target.value) })}
          />
          <button className="danger" onClick={() => onChange(texts.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...texts, { name: `texte_${texts.length}`, text: "" }])}>
        + Ajouter un texte
      </button>
      <p className="hint">
        ASCII uniquement en v0 (pas d'accents — fonte définitive en v1). Les
        scripts référencent les textes par leur nom.
      </p>
    </div>
  );
}
