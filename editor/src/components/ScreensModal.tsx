// Fenêtre « Écrans composés » (Tools →, B6bis) : compositions
// visuelles jouées par la commande « Aller à l'écran ». Un écran =
// un fond (picture) + jusqu'à 5 images posées À LA SOURIS (slots) +
// un script (les mêmes commandes que les events) lancé à l'ouverture.
// Sucre d'éditeur : datagen déroule le tout en commandes stage (B3)
// — le moteur ne voit rien de nouveau.

import { useEffect, useRef, useState } from "react";
import type { Scene, Screen, ScreenSlot } from "../types";
import type { Database } from "../db";
import { CommandListEditor } from "./EventEditorModal";
import { loadAssetPng } from "../io";

interface Props {
  root: string;
  screenNames: string[]; // ordre du projet
  screens: Record<string, Screen>;
  picturePaths: Record<string, string>; // stem -> chemin assets/
  sceneNames: string[];
  scenes: Record<string, Scene>;
  switchNames: string[];
  varNames: string[];
  charsetNames: string[];
  db: Database | null;
  uiWidgets: string[];
  uiStyles: string[];
  texts: import("../types").TextEntry[]; // catalogue (msg par référence, T2)
  pictures: string[];
  tintPresets: import("../types").TintPreset[];
  soundNames: string[];
  musicNames: string[];
  vigNames: string[];
  onTintPresets: (list: import("../types").TintPreset[]) => void;
  onRenameVars: (switches: string[], variables: string[]) => void;
  onOk: (names: string[], screens: Record<string, Screen>) => void;
  onClose: () => void;
}

export default function ScreensModal(props: Props) {
  const [names, setNames] = useState<string[]>(() => [...props.screenNames]);
  const [draft, setDraft] = useState<Record<string, Screen>>(() =>
    structuredClone(props.screens)
  );
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<"compo" | "script">("compo");
  const [bmps, setBmps] = useState<Record<string, ImageBitmap>>({});
  const [selSlot, setSelSlot] = useState<number | null>(null);
  const [selScript, setSelScript] = useState(0);
  const [renaming, setRenaming] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ slot: number; dx: number; dy: number } | null>(null);

  const name = names[sel] as string | undefined;
  const cur = name ? draft[name] : undefined;

  const patch = (p: Partial<Screen>) => {
    if (!name) return;
    setDraft({ ...draft, [name]: { ...draft[name], ...p } });
  };

  // charge les bitmaps du fond et des images posées (cache par stem)
  useEffect(() => {
    if (!cur) return;
    const want = [cur.backdrop, ...cur.slots.map((s) => s.pic)].filter(
      (n): n is string => !!n && !bmps[n] && !!props.picturePaths[n]
    );
    for (const stem of want) {
      void loadAssetPng(props.root, props.picturePaths[stem])
        .then((b) => setBmps((m) => ({ ...m, [stem]: b })))
        .catch(() => {});
    }
  }, [cur, bmps, props.root, props.picturePaths]);

  // rendu du canvas (échelle 2, comme la console)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !cur || tab !== "compo") return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (cur.backdrop && bmps[cur.backdrop])
      ctx.drawImage(bmps[cur.backdrop], 0, 0, 512, 448);
    for (const s of cur.slots) {
      const b = bmps[s.pic];
      if (b) ctx.drawImage(b, s.x * 2, s.y * 2, b.width * 2, b.height * 2);
      ctx.strokeStyle = s.slot === selSlot ? "#ffd24a" : "rgba(255,255,255,.35)";
      const w = b ? b.width * 2 : 64;
      const h = b ? b.height * 2 : 64;
      ctx.strokeRect(s.x * 2 + 0.5, s.y * 2 + 0.5, w - 1, h - 1);
      ctx.fillStyle = s.slot === selSlot ? "#ffd24a" : "rgba(255,255,255,.7)";
      ctx.font = "12px system-ui";
      ctx.fillText(String(s.slot), s.x * 2 + 4, s.y * 2 + 14);
    }
  }, [cur, bmps, selSlot, tab]);

  const hit = (px: number, py: number): ScreenSlot | null => {
    if (!cur) return null;
    for (let i = cur.slots.length - 1; i >= 0; i--) {
      const s = cur.slots[i];
      const b = bmps[s.pic];
      const w = b ? b.width : 32;
      const h = b ? b.height : 32;
      if (px >= s.x && px < s.x + w && py >= s.y && py < s.y + h) return s;
    }
    return null;
  };

  const freeSlot = (): number | null => {
    for (let n = 1; n <= 5; n++)
      if (!cur?.slots.some((s) => s.slot === n)) return n;
    return null;
  };

  const addScreen = () => {
    let base = "ecran";
    let i = 1;
    while (names.includes(`${base}${i}`)) i++;
    const n = `${base}${i}`;
    setNames([...names, n]);
    setDraft({
      ...draft,
      [n]: {
        backdrop: "",
        slots: [],
        scripts: [{ name: "principal", trigger: "auto", commands: [] }],
      },
    });
    setSel(names.length);
  };

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal cevents screens" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Écrans composés</div>
        <div className="cevents-body">
          <div className="cevents-list">
            <div className="evedit-cmds" style={{ flex: 1 }}>
              {names.map((n, i) => (
                <div
                  key={n}
                  className={"evedit-line" + (i === sel ? " active" : "")}
                  onClick={() => {
                    setSel(i);
                    setSelSlot(null);
                    setSelScript(0);
                    setRenaming(null);
                  }}
                >
                  🖼 {n}
                </div>
              ))}
            </div>
            <div className="row">
              <button onClick={addScreen} title="Ajouter un écran">＋</button>
              <button
                className="danger"
                disabled={!name}
                onClick={() => {
                  if (!name || !confirm(`Supprimer l'écran « ${name} » ? Les commandes « Aller à l'écran » qui l'utilisent seront signalées au build.`))
                    return;
                  const d2 = { ...draft };
                  delete d2[name];
                  setDraft(d2);
                  setNames(names.filter((x) => x !== name));
                  setSel(0);
                }}
              >
                🗑
              </button>
            </div>
            {name && renaming === null && (
              <button onClick={() => setRenaming(name)}>Renommer…</button>
            )}
            {renaming !== null && (
              <div className="row">
                <input
                  autoFocus
                  value={renaming}
                  onChange={(e) => setRenaming(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setRenaming(null);
                    if (e.key === "Enter" && name) {
                      const v = renaming.toLowerCase().replace(/[^a-z0-9_]/g, "_");
                      if (v && !names.includes(v)) {
                        const d2 = { ...draft, [v]: draft[name] };
                        delete d2[name];
                        setDraft(d2);
                        setNames(names.map((x) => (x === name ? v : x)));
                      }
                      setRenaming(null);
                    }
                  }}
                />
              </div>
            )}
          </div>
          <div className="cevents-form" style={{ overflow: "auto" }}>
            {!cur ? (
              <span
                className="hint"
                title="Un écran composé = un fond + des images posées + un script (combat, titre, carte du monde…). Joué par « Aller à l'écran » ; « Fermer l'écran composé » rend la scène."
              >
                Aucun écran — ＋ pour en créer un.
              </span>
            ) : (
              <>
                <div className="cmdpick-tabs">
                  <button
                    className={tab === "compo" ? "active" : ""}
                    onClick={() => setTab("compo")}
                  >
                    Composition
                  </button>
                  <button
                    className={tab === "script" ? "active" : ""}
                    onClick={() => setTab("script")}
                  >
                    Scripts ({cur.scripts.length})
                  </button>
                </div>
                {tab === "compo" ? (
                  <div className="compo-body">
                    <canvas
                      ref={canvasRef}
                      width={512}
                      height={448}
                      className="compo-canvas"
                      title="Glisser les images à la souris (magnétisme 8 px). Aperçu fidèle au pixel. Chaque image = un slot 1-5 avec sa palette (effets par slot). Éviter les chevauchements."
                      onMouseDown={(e) => {
                        const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                        const px = Math.floor((e.clientX - r.left) / 2);
                        const py = Math.floor((e.clientY - r.top) / 2);
                        const s = hit(px, py);
                        setSelSlot(s ? s.slot : null);
                        if (s) dragRef.current = { slot: s.slot, dx: px - s.x, dy: py - s.y };
                      }}
                      onMouseMove={(e) => {
                        const d = dragRef.current;
                        if (!d || !cur) return;
                        const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                        const px = Math.floor((e.clientX - r.left) / 2);
                        const py = Math.floor((e.clientY - r.top) / 2);
                        patch({
                          slots: cur.slots.map((s) => {
                            if (s.slot !== d.slot) return s;
                            const b = bmps[s.pic];
                            const w = b ? b.width : 32;
                            const h = b ? b.height : 32;
                            const nx = Math.max(0, Math.min(256 - w, (px - d.dx) & ~7));
                            const ny = Math.max(0, Math.min(224 - h, (py - d.dy) & ~7));
                            return { ...s, x: nx, y: ny };
                          }),
                        });
                      }}
                      onMouseUp={() => (dragRef.current = null)}
                      onMouseLeave={() => (dragRef.current = null)}
                    />
                    <div className="compo-side">
                      <label title="Image plein écran affichée en fond de l'écran composé">
                        Fond
                        <select
                          value={cur.backdrop}
                          onChange={(e) => patch({ backdrop: e.target.value })}
                        >
                          <option value="">(aucun — noir)</option>
                          {props.pictures.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                      <div className="compo-imgs-head">
                        <span className="palette-title" style={{ margin: 0 }}>Images</span>
                        <button
                          disabled={freeSlot() === null || props.pictures.length === 0}
                          title="Ajouter une image (glisser ensuite à la souris)"
                          onClick={() => {
                            const slot = freeSlot();
                            if (slot === null) return;
                            patch({
                              slots: [
                                ...cur.slots,
                                { slot, pic: props.pictures[0], x: 96, y: 80, name: `image${slot}` },
                              ],
                            });
                            setSelSlot(slot);
                          }}
                        >
                          ＋
                        </button>
                      </div>
                      <div className="compo-imgs">
                        {cur.slots.map((sl) => (
                          <div
                            key={sl.slot}
                            className={"compo-img" + (sl.slot === selSlot ? " active" : "")}
                            onClick={() => setSelSlot(sl.slot)}
                          >
                            <div className="row" style={{ gap: 4, alignItems: "center" }}>
                              <span className="varlist-num">{sl.slot}</span>
                              <input
                                value={sl.name ?? ""}
                                placeholder="nom…"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  patch({
                                    slots: cur.slots.map((x) =>
                                      x.slot === sl.slot ? { ...x, name: e.target.value } : x
                                    ),
                                  })
                                }
                              />
                              <button
                                className="danger"
                                title="Retirer cette image"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  patch({ slots: cur.slots.filter((x) => x.slot !== sl.slot) });
                                  if (selSlot === sl.slot) setSelSlot(null);
                                }}
                              >
                                🗑
                              </button>
                            </div>
                            <select
                              value={sl.pic}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                patch({
                                  slots: cur.slots.map((x) =>
                                    x.slot === sl.slot ? { ...x, pic: e.target.value } : x
                                  ),
                                })
                              }
                            >
                              {props.pictures.map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
                      {cur.scripts.map((sc, i) => (
                        <button
                          key={i}
                          className={i === selScript ? "active" : ""}
                          onClick={() => setSelScript(i)}
                        >
                          {sc.trigger === "auto" ? "▶ " : "☎ "}{sc.name} ({sc.commands.length})
                        </button>
                      ))}
                      <button
                        style={{ flex: "0 0 auto", width: 30, padding: "3px 0" }}
                        title="Ajouter un script (appelable par « Appeler un script de l'écran »)"
                        onClick={() => {
                          let i = cur.scripts.length + 1;
                          while (cur.scripts.some((sc) => sc.name === `script${i}`)) i++;
                          patch({
                            scripts: [
                              ...cur.scripts,
                              { name: `script${i}`, trigger: "call", commands: [] },
                            ],
                          });
                          setSelScript(cur.scripts.length);
                        }}
                      >
                        ＋
                      </button>
                      {cur.scripts.length > 1 && (
                        <button
                          className="danger"
                          style={{ flex: "0 0 auto", width: 30, padding: "3px 0" }}
                          title="Supprimer ce script"
                          onClick={() => {
                            if (!confirm(`Supprimer le script « ${cur.scripts[selScript]?.name} » ?`)) return;
                            patch({ scripts: cur.scripts.filter((_, i) => i !== selScript) });
                            setSelScript(0);
                          }}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                    <div className="row">
                      <label>
                        Nom du script
                        <input
                          value={cur.scripts[selScript]?.name ?? ""}
                          disabled={!cur.scripts[selScript]}
                          onChange={(e) =>
                            patch({
                              scripts: cur.scripts.map((sc, i) =>
                                i === selScript
                                  ? { ...sc, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }
                                  : sc
                              ),
                            })
                          }
                        />
                      </label>
                      <label title="▶ À l'ouverture : joué quand l'écran s'ouvre, dans l'ordre des scripts — avec une condition, seulement si elle est vraie (l'intro du premier combat, la phase 2 d'un boss selon une variable…). ☎ Par appel : joué par « Appeler un script de l'écran » (sous-routines : tour_joueur, victoire…).">
                        Déclencheur
                        <select
                          value={cur.scripts[selScript]?.trigger ?? "call"}
                          onChange={(e) =>
                            patch({
                              scripts: cur.scripts.map((sc, i) =>
                                i === selScript
                                  ? { ...sc, trigger: e.target.value as "auto" | "call" }
                                  : sc
                              ),
                            })
                          }
                        >
                          <option value="auto">▶ À l'ouverture</option>
                          <option value="call">☎ Par appel</option>
                        </select>
                      </label>
                      {cur.scripts[selScript]?.trigger === "auto" && (
                        <label>
                          Condition
                          <select
                            value={cur.scripts[selScript]?.cond?.kind ?? ""}
                            onChange={(e) => {
                              const k = e.target.value;
                              patch({
                                scripts: cur.scripts.map((sc, i) =>
                                  i === selScript
                                    ? {
                                        ...sc,
                                        cond: k === ""
                                          ? undefined
                                          : k === "switch"
                                            ? { kind: "switch", n: 0, on: true }
                                            : { kind: "var", n: 0, op: "==", value: 0 },
                                      }
                                    : sc
                                ),
                              });
                            }}
                          >
                            <option value="">(aucune — toujours)</option>
                            <option value="switch">Switch</option>
                            <option value="var">Variable</option>
                          </select>
                        </label>
                      )}
                    </div>
                    {cur.scripts[selScript]?.trigger === "auto" &&
                      cur.scripts[selScript]?.cond && (
                        <div className="row">
                          {cur.scripts[selScript].cond!.kind === "switch" ? (
                            <>
                              <label>
                                Switch n°
                                <input
                                  type="number" min={0} max={511}
                                  value={cur.scripts[selScript].cond!.n}
                                  onChange={(e) =>
                                    patch({
                                      scripts: cur.scripts.map((sc, i) =>
                                        i === selScript
                                          ? { ...sc, cond: { ...sc.cond!, n: Number(e.target.value) } }
                                          : sc
                                      ),
                                    })
                                  }
                                />
                              </label>
                              <label>
                                État
                                <select
                                  value={cur.scripts[selScript].cond!.on ? "on" : "off"}
                                  onChange={(e) =>
                                    patch({
                                      scripts: cur.scripts.map((sc, i) =>
                                        i === selScript
                                          ? { ...sc, cond: { ...sc.cond!, on: e.target.value === "on" } }
                                          : sc
                                      ),
                                    })
                                  }
                                >
                                  <option value="on">ON</option>
                                  <option value="off">OFF</option>
                                </select>
                              </label>
                            </>
                          ) : (
                            <>
                              <label>
                                Variable n°
                                <input
                                  type="number" min={0} max={255}
                                  value={cur.scripts[selScript].cond!.n}
                                  onChange={(e) =>
                                    patch({
                                      scripts: cur.scripts.map((sc, i) =>
                                        i === selScript
                                          ? { ...sc, cond: { ...sc.cond!, n: Number(e.target.value) } }
                                          : sc
                                      ),
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Opérateur
                                <select
                                  value={cur.scripts[selScript].cond!.op ?? "=="}
                                  onChange={(e) =>
                                    patch({
                                      scripts: cur.scripts.map((sc, i) =>
                                        i === selScript
                                          ? { ...sc, cond: { ...sc.cond!, op: e.target.value as "==" | "!=" | ">=" } }
                                          : sc
                                      ),
                                    })
                                  }
                                >
                                  <option value="==">==</option>
                                  <option value="!=">!=</option>
                                  <option value=">=">&gt;=</option>
                                </select>
                              </label>
                              <label>
                                Valeur
                                <input
                                  type="number" min={-32768} max={32767}
                                  value={cur.scripts[selScript].cond!.value ?? 0}
                                  onChange={(e) =>
                                    patch({
                                      scripts: cur.scripts.map((sc, i) =>
                                        i === selScript
                                          ? { ...sc, cond: { ...sc.cond!, value: Number(e.target.value) } }
                                          : sc
                                      ),
                                    })
                                  }
                                />
                              </label>
                            </>
                          )}
                        </div>
                      )}
                    <CommandListEditor
                      key={`${name}-${selScript}`}
                      cmds={cur.scripts[selScript]?.commands ?? []}
                      commit={() => setDraft({ ...draft })}
                      shortcutsOff={false}
                      sceneNames={props.sceneNames}
                      scenes={props.scenes}
                      switchNames={props.switchNames}
                      varNames={props.varNames}
                      entryNames={[]}
                      charsetNames={props.charsetNames}
                      commonNames={[]}
                      db={props.db}
                      uiWidgets={props.uiWidgets}
                      uiStyles={props.uiStyles}
                  texts={props.texts}
                      pictures={props.pictures}
                      tintPresets={props.tintPresets}
                      soundNames={props.soundNames}
                      musicNames={props.musicNames}
                      vigNames={props.vigNames}
                      screenNames={names}
                      screenScriptNames={cur.scripts.map((sc) => sc.name)}
                      onTintPresets={props.onTintPresets}
                      onRenameVars={props.onRenameVars}
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={() => props.onOk(names, draft)}>OK</button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
