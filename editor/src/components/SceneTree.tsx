// Arborescence des scènes façon RPG Maker 2003 : racine = projet,
// scènes imbricables (champ parent, purement organisationnel), création
// sous la ligne sélectionnée, boot ★, réorganisation par glisser-déposer.

import { useState } from "react";
import type { Project, Scene } from "../types";

interface Props {
  project: Project;
  scenes: Record<string, Scene>;
  current: string;
  onSelect: (name: string) => void;
  onCreate: (parent: string | null) => void;
  onDelete: () => void;
  onSetBoot: () => void;
  onReparent: (name: string, parent: string | null) => void;
}

export default function SceneTree(props: Props) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [rootSel, setRootSel] = useState(false);
  const names = props.project.scenes;

  // parent effectif : ignoré s'il est inconnu ou auto-référent
  const parentOf = (n: string): string | null => {
    const p = props.scenes[n]?.parent;
    return p && p !== n && names.includes(p) ? p : null;
  };
  const kids = (parent: string | null) => names.filter((n) => parentOf(n) === parent);
  const isDescendant = (name: string, of: string): boolean => {
    let p = parentOf(name);
    let guard = 0;
    while (p && guard++ < 256) {
      if (p === of) return true;
      p = parentOf(p);
    }
    return false;
  };

  function drop(target: string | null) {
    if (!dragged) return;
    if (target && (target === dragged || isDescendant(target, dragged))) {
      setDragged(null);
      return;
    }
    props.onReparent(dragged, target);
    setDragged(null);
  }

  function rows(parent: string | null, depth: number): React.ReactNode[] {
    return kids(parent).flatMap((n) => [
      <div
        key={n}
        className={"tree-row" + (!rootSel && n === props.current ? " active" : "")}
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable
        onDragStart={() => setDragged(n)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.stopPropagation();
          drop(n);
        }}
        onClick={() => {
          setRootSel(false);
          props.onSelect(n);
        }}
      >
        <span className="tree-icon">▦</span>
        <span>
          {n}
          {n === props.project.boot_scene ? " ★" : ""}
        </span>
      </div>,
      ...rows(n, depth + 1),
    ]);
  }

  return (
    <div
      className="scene-tree"
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => drop(null)}
    >
      <div className="tree-head">
        <button
          onClick={() => props.onCreate(rootSel ? null : props.current)}
          title="Nouvelle scène sous la ligne sélectionnée"
        >
          ＋
        </button>
        <button
          onClick={props.onSetBoot}
          disabled={rootSel || props.current === props.project.boot_scene}
          title="Définir la scène sélectionnée comme scène de boot"
        >
          ★
        </button>
        <button
          className="danger"
          onClick={props.onDelete}
          disabled={rootSel || props.current === props.project.boot_scene}
          title="Supprimer la scène sélectionnée (ses enfants remontent d'un cran)"
        >
          🗑
        </button>
      </div>
      <div
        className={"tree-row tree-root" + (rootSel ? " active" : "")}
        onClick={() => setRootSel(true)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.stopPropagation();
          drop(null);
        }}
        title="Racine du projet — sélectionner puis ＋ pour créer une scène à la racine"
      >
        <span className="tree-icon">🗀</span>
        <span>{props.project.name}</span>
      </div>
      {rows(null, 1)}
    </div>
  );
}
