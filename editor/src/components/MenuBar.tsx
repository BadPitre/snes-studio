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
  sub?: MenuItem[]; // sous-menu (flyout au survol, ex. Tools → UI)
}

export interface Menu {
  label: string;
  items: MenuItem[];
}

export default function MenuBar({ menus }: { menus: Menu[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [sub, setSub] = useState<number | null>(null); // item au flyout ouvert

  return (
    <div className="menubar">
      {open !== null && <div className="menu-backdrop" onClick={() => setOpen(null)} />}
      {menus.map((m, i) => (
        <div key={m.label} className="menu">
          <button
            className={"menu-title" + (open === i ? " active" : "")}
            onClick={() => {
              setOpen(open === i ? null : i);
              setSub(null);
            }}
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
                ) : it.sub ? (
                  <div
                    key={j}
                    className="menu-subwrap"
                    onMouseEnter={() => setSub(j)}
                    onMouseLeave={() => setSub(null)}
                  >
                    <button disabled={it.disabled}>
                      <span>{it.label}</span>
                      <span className="menu-hint">▸</span>
                    </button>
                    {sub === j && (
                      <div className="menu-drop menu-sub">
                        {it.sub.map((sit, k) => (
                          <button
                            key={k}
                            disabled={sit.disabled}
                            onClick={() => {
                              setOpen(null);
                              setSub(null);
                              sit.action?.();
                            }}
                          >
                            <span>{sit.label}</span>
                            {sit.hint && <span className="menu-hint">{sit.hint}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
