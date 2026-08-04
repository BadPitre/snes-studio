// "Groupes de monstres" (C5) — the troop editor of the design doc §8:
// a canvas with the backdrop, the monsters dragged from the bestiary,
// the exact in-game layout. Edits data/troops.toml; the monsters' stats
// and battler pictures live in the DATABASE's monsters table — a troop
// only ARRANGES them (the battle doc's line, kept on screen).

import { useEffect, useRef, useState } from "react";
import type { Troop } from "../battle";
import type { Database } from "../db";
import { loadAssetPng } from "../io";

interface Props {
  root: string;
  troops: Troop[];
  db: Database | null;
  pictures: string[]; // picture stems
  picturePaths: Record<string, string>;
  commonNames: string[]; // hook candidates (C4)
  heroNames: string[]; // party preview (right column)
  onOk: (troops: Troop[]) => void;
  onClose: () => void;
}

const MAX_MONS = 4;

export default function TroopsModal(props: Props) {
  const [troops, setTroops] = useState<Troop[]>(() => structuredClone(props.troops));
  const [sel, setSel] = useState(0);
  const [selMon, setSelMon] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [bmps, setBmps] = useState<Record<string, ImageBitmap>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ i: number; dx: number; dy: number } | null>(null);

  const cur = troops[sel] as Troop | undefined;

  // bestiary: the monsters table drives ids and battler pictures
  const monTable = props.db?.schemas.findIndex((s) => s.name === "monsters") ?? -1;
  const bestiary = monTable >= 0 ? props.db!.entries.monsters ?? [] : [];
  const monPic = (id: string): string =>
    String(bestiary.find((e) => e.id === id)?.battle_pic ?? "");

  const patch = (p: Partial<Troop>) => {
    setTroops(troops.map((t, i) => (i === sel ? { ...t, ...p } : t)));
  };

  // bitmaps of the backdrop and the posed monsters (cached by stem)
  useEffect(() => {
    if (!cur) return;
    const want = [cur.backdrop, ...cur.monsters.map((m) => monPic(m.id))].filter(
      (n): n is string => !!n && !bmps[n] && !!props.picturePaths[n]
    );
    for (const stem of want) {
      void loadAssetPng(props.root, props.picturePaths[stem])
        .then((b) => setBmps((m) => ({ ...m, [stem]: b })))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, bmps, props.root, props.picturePaths]);

  // canvas: scale 2, the console's exact frame — plus the party column
  // ghosted on the right (BT_X=200, one 32 px row a hero), so the
  // author sees what the fight will actually look like.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !cur) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (cur.backdrop && bmps[cur.backdrop])
      ctx.drawImage(bmps[cur.backdrop], 0, 0, 512, 448);
    cur.monsters.forEach((m, i) => {
      const b = bmps[monPic(m.id)];
      const x = m.x * 16;
      const y = m.y * 16;
      if (b) ctx.drawImage(b, x, y, b.width * 2, b.height * 2);
      ctx.strokeStyle = i === selMon ? "#ffd24a" : "rgba(255,255,255,.35)";
      const w = b ? b.width * 2 : 64;
      const h = b ? b.height * 2 : 64;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = i === selMon ? "#ffd24a" : "rgba(255,255,255,.7)";
      ctx.font = "12px system-ui";
      ctx.fillText(m.id, x + 4, y + 14);
    });
    // the party's column, ghosted (engine constants BT_X/BT_Y0)
    for (let h = 0; h < Math.min(4, props.heroNames.length); h++) {
      const x = 200 * 2;
      const y = (40 + h * 32) * 2;
      ctx.strokeStyle = "rgba(120,200,255,.5)";
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + 0.5, y + 0.5, 63, 63);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(120,200,255,.8)";
      ctx.fillText(props.heroNames[h], x + 3, y + 76);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, bmps, selMon, props.heroNames]);

  const hit = (px: number, py: number): number | null => {
    if (!cur) return null;
    for (let i = cur.monsters.length - 1; i >= 0; i--) {
      const m = cur.monsters[i];
      const b = bmps[monPic(m.id)];
      const w = b ? b.width : 32;
      const h = b ? b.height : 32;
      if (px >= m.x * 8 && px < m.x * 8 + w && py >= m.y * 8 && py < m.y * 8 + h)
        return i;
    }
    return null;
  };

  const freeId = (base: string) => {
    let v = base;
    let k = 2;
    while (troops.some((t) => t.id === v)) v = `${base}_${k++}`;
    return v;
  };

  return (
    <div className="modal-backdrop">
      <div className="modal cevents screens" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">
          Groupes de monstres
          <button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button>
        </div>
        <div className="cevents-body">
          <div className="cevents-list">
            <div className="cevents-items">
              {troops.map((t, i) => (
                <div
                  key={t.id}
                  className={"cevents-item" + (i === sel ? " selected" : "")}
                  onClick={() => {
                    setSel(i);
                    setSelMon(null);
                    setRenaming(null);
                  }}
                >
                  ⚔ {t.id}
                </div>
              ))}
            </div>
            <div className="row">
              <button
                title="Ajouter un groupe"
                onClick={() => {
                  const t: Troop = {
                    id: freeId("groupe"),
                    backdrop: props.pictures[0] ?? "",
                    monsters: [],
                  };
                  setTroops([...troops, t]);
                  setSel(troops.length);
                }}
              >
                ＋
              </button>
              <button
                className="danger"
                disabled={!cur}
                onClick={() => {
                  if (!cur || !confirm(`Supprimer le groupe « ${cur.id} » ? Les commandes « Lancer un combat » qui l'utilisent seront signalées au build.`))
                    return;
                  setTroops(troops.filter((_, i) => i !== sel));
                  setSel(Math.max(0, sel - 1));
                }}
              >
                🗑
              </button>
            </div>
            {cur && renaming === null && (
              <button onClick={() => setRenaming(cur.id)}>Renommer…</button>
            )}
            {renaming !== null && (
              <div className="row">
                <input
                  autoFocus
                  value={renaming}
                  onChange={(e) => setRenaming(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setRenaming(null);
                    if (e.key === "Enter" && cur) {
                      const v = renaming.toLowerCase().replace(/[^a-z0-9_]/g, "_");
                      if (v && !troops.some((t, i) => i !== sel && t.id === v)) {
                        patch({ id: v });
                        setRenaming(null);
                      }
                    }
                  }}
                />
              </div>
            )}
          </div>
          <div className="cevents-form" style={{ overflow: "auto" }}>
            {!cur ? (
              <span className="hint">
                Aucun groupe — ＋ pour en créer un. Un groupe arrange des
                monstres de la Database sur un fond ; « Lancer un
                combat » l'ouvre depuis n'importe quel event.
              </span>
            ) : (
              <div className="compo-body">
                <canvas
                  ref={canvasRef}
                  width={512}
                  height={448}
                  className="compo-canvas"
                  title="Glisser les monstres à la souris (magnétisme 1 tile). Les cadres bleus : la colonne de l'équipe, telle que le moteur la pose."
                  onMouseDown={(e) => {
                    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                    const px = Math.floor((e.clientX - r.left) / 2);
                    const py = Math.floor((e.clientY - r.top) / 2);
                    const i = hit(px, py);
                    setSelMon(i);
                    if (i !== null && cur)
                      dragRef.current = {
                        i,
                        dx: px - cur.monsters[i].x * 8,
                        dy: py - cur.monsters[i].y * 8,
                      };
                  }}
                  onMouseMove={(e) => {
                    const d = dragRef.current;
                    if (!d || !cur) return;
                    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                    const px = Math.floor((e.clientX - r.left) / 2);
                    const py = Math.floor((e.clientY - r.top) / 2);
                    patch({
                      monsters: cur.monsters.map((m, i) => {
                        if (i !== d.i) return m;
                        const b = bmps[monPic(m.id)];
                        const wt = b ? b.width >> 3 : 4;
                        const ht = b ? b.height >> 3 : 4;
                        const nx = Math.max(0, Math.min(32 - wt, Math.round((px - d.dx) / 8)));
                        const ny = Math.max(0, Math.min(28 - ht, Math.round((py - d.dy) / 8)));
                        return { ...m, x: nx, y: ny };
                      }),
                    });
                  }}
                  onMouseUp={() => (dragRef.current = null)}
                  onMouseLeave={() => (dragRef.current = null)}
                />
                <div className="compo-side">
                  <label title="Image plein écran affichée derrière le combat">
                    Fond
                    <select
                      value={cur.backdrop}
                      onChange={(e) => patch({ backdrop: e.target.value })}
                    >
                      {props.pictures.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <span className="palette-title" style={{ margin: 0 }}>
                    Monstres ({cur.monsters.length}/{MAX_MONS})
                  </span>
                  {cur.monsters.map((m, i) => (
                    <div className="row" key={i}>
                      <select
                        value={m.id}
                        title="Un monstre de la Database (Tools → Données → Database, table monsters)"
                        onChange={(e) =>
                          patch({
                            monsters: cur.monsters.map((mm, j) =>
                              j === i ? { ...mm, id: e.target.value } : mm
                            ),
                          })
                        }
                      >
                        {bestiary.map((b) => (
                          <option key={b.id} value={b.id}>{String(b.name || b.id)}</option>
                        ))}
                      </select>
                      <button
                        className="danger"
                        title="Retirer ce monstre du groupe"
                        onClick={() => {
                          patch({ monsters: cur.monsters.filter((_, j) => j !== i) });
                          setSelMon(null);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    disabled={cur.monsters.length >= MAX_MONS || bestiary.length === 0}
                    title="Poser un monstre du bestiaire (4 au plus — les 5 slots de l'écran composé, moins un pour les effets)"
                    onClick={() =>
                      patch({
                        monsters: [
                          ...cur.monsters,
                          { id: String(bestiary[0]?.id ?? ""), x: 4 + cur.monsters.length * 4, y: 9 },
                        ],
                      })
                    }
                  >
                    ＋ Ajouter un monstre
                  </button>
                  <span className="palette-title" style={{ margin: 0 }}>Hooks</span>
                  <label title="Common event joué à l'ouverture du combat (dialogue de boss…) — l'horloge ATB attend">
                    Intro
                    <select
                      value={cur.intro ?? ""}
                      onChange={(e) => patch({ intro: e.target.value || undefined })}
                    >
                      <option value="">(aucun)</option>
                      {props.commonNames.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label title="Common event joué UNE fois quand un monstre passe sous la moitié de ses PV">
                    Monstre affaibli
                    <select
                      value={cur.low_hp ?? ""}
                      onChange={(e) => patch({ low_hp: e.target.value || undefined })}
                    >
                      <option value="">(aucun)</option>
                      {props.commonNames.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <span className="hint">
                    Les stats (PV, attaque, IA…) et l'image de chaque
                    monstre vivent dans la Database — le groupe ARRANGE.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button
            className="primary"
            disabled={troops.some((t) => t.monsters.length === 0)}
            title={troops.some((t) => t.monsters.length === 0) ? "Chaque groupe doit poser au moins un monstre" : undefined}
            onClick={() => props.onOk(troops)}
          >
            OK
          </button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
