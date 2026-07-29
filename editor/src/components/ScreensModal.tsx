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
    setDraft({ ...draft, [n]: { backdrop: "", slots: [], script: [] } });
    setSel(names.length);
  };

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal cevents" onClick={(e) => e.stopPropagation()}>
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
                    setRenaming(null);
                  }}
                >
                  🖼 {n}
                </div>
              ))}
            </div>
            <div className="row">
              <button onClick={addScreen}>＋ Ajouter</button>
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
              <span className="hint">
                Un ÉCRAN COMPOSÉ est une mise en scène : un fond + des
                images posées à la souris + un script — l'écran de
                combat (fond + monstres), un écran titre, une carte du
                monde… Il se joue par la commande d'event
                « Aller à l'écran » ; « Fermer l'écran composé » rend la
                scène. ＋ Ajouter pour commencer.
              </span>
            ) : (
              <>
                <div className="row">
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
                    Script ({cur.script.length})
                  </button>
                </div>
                {tab === "compo" ? (
                  <>
                    <div className="row">
                      <label>
                        Fond (picture plein écran)
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
                      <label>
                        Poser une image (slot {freeSlot() ?? "—"})
                        <select
                          value=""
                          disabled={freeSlot() === null}
                          onChange={(e) => {
                            const slot = freeSlot();
                            if (!e.target.value || slot === null) return;
                            patch({
                              slots: [
                                ...cur.slots,
                                { slot, pic: e.target.value, x: 96, y: 80 },
                              ],
                            });
                            setSelSlot(slot);
                          }}
                        >
                          <option value="">(choisir…)</option>
                          {props.pictures.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                      {selSlot !== null && (
                        <button
                          className="danger"
                          onClick={() => {
                            patch({ slots: cur.slots.filter((s) => s.slot !== selSlot) });
                            setSelSlot(null);
                          }}
                        >
                          🗑 Slot {selSlot}
                        </button>
                      )}
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={512}
                      height={448}
                      style={{ border: "1px solid #444", cursor: "move", imageRendering: "pixelated" }}
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
                    <span className="hint">
                      Glisser les images à la souris (magnétisme 8 px —
                      la grille de la console). L'aperçu est fidèle au
                      pixel. Chaque image = un slot (1-5) avec SA
                      palette : les effets par slot (flash, fondu de
                      mort…) ne toucheront qu'elle. Éviter les
                      chevauchements (couche unique).
                    </span>
                  </>
                ) : (
                  <>
                    <div className="palette-title">
                      Script de l'écran (lancé à l'ouverture)
                    </div>
                    <CommandListEditor
                      key={name}
                      cmds={cur.script}
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
                      pictures={props.pictures}
                      tintPresets={props.tintPresets}
                      soundNames={props.soundNames}
                      musicNames={props.musicNames}
                      vigNames={props.vigNames}
                      screenNames={names}
                      onTintPresets={props.onTintPresets}
                      onRenameVars={props.onRenameVars}
                    />
                    <span className="hint">
                      La logique de l'écran vit ICI : dialogues, choix,
                      sons, vignettes, effets par slot, variables…
                      Terminer par « Fermer l'écran composé » pour
                      rendre la scène. Le script peut poser/retirer des
                      images par-dessus la composition (renforts,
                      morts).
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <div className="row">
          <button onClick={() => props.onOk(names, draft)}>OK</button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
