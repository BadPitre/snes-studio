// Barre de menus façon RPG Maker 2003 : menus déroulants (clic pour
// ouvrir, survol pour passer de l'un à l'autre), items avec raccourci
// affiché, séparateurs.

import { useState } from "react";

export interface MenuItem {
  label?: string;
  hint?: string; // raccourci affiché à droite (ex. « Ctrl+Z »)
  action?: () => void;
  disabled?: boolean;
  sep?: boolean;
}

export interface Menu {
  label: string;
  items: MenuItem[];
}

export default function MenuBar({ menus }: { menus: Menu[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="menubar">
      {open !== null && <div className="menu-backdrop" onClick={() => setOpen(null)} />}
      {menus.map((m, i) => (
        <div key={m.label} className="menu">
          <button
            className={"menu-title" + (open === i ? " active" : "")}
            onClick={() => setOpen(open === i ? null : i)}
            onMouseEnter={() => {
              if (open !== null) setOpen(i);
            }}
          >
            {m.label}
          </button>
          {open === i && (
            <div className="menu-drop">
              {m.items.map((it, j) =>
                it.sep ? (
                  <div key={j} className="menu-sep" />
                ) : (
                  <button
                    key={j}
                    disabled={it.disabled}
                    onClick={() => {
                      setOpen(null);
                      it.action?.();
                    }}
                  >
                    <span>{it.label}</span>
                    {it.hint && <span className="menu-hint">{it.hint}</span>}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
