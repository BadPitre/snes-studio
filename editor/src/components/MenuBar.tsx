// RPG Maker 2003 style menu bar: dropdowns (click to open, hover to move
// from one to the next), items with their shortcut displayed,
// separators.

import { useState } from "react";

export interface MenuItem {
  label?: string;
  hint?: string; // shortcut shown on the right (e.g. "Ctrl+Z")
  tip?: string; // tooltip (title) describing what the item does
  action?: () => void;
  disabled?: boolean;
  sep?: boolean;
  sub?: MenuItem[]; // submenu (flyout on hover, e.g. Tools > UI)
}

export interface Menu {
  label: string;
  items: MenuItem[];
}

export default function MenuBar({ menus }: { menus: Menu[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [sub, setSub] = useState<number | null>(null); // item whose flyout is open

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
                    <button disabled={it.disabled} title={it.tip}>
                      <span>{it.label}</span>
                      <span className="menu-hint">▸</span>
                    </button>
                    {sub === j && (
                      <div className="menu-drop menu-sub">
                        {it.sub.map((sit, k) => (
                          <button
                            key={k}
                            disabled={sit.disabled}
                            title={sit.tip}
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
                    title={it.tip}
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
