// Fenêtre « Tilesets » (Tools →, T1) — l'onglet Tileset de la Database
// RM2003 : liste des tilesets, import (PNG libre ou chipset RM2003), et
// trois modes d'édition sur la grille :
//   Passabilité   : O passable, X solide, ☆ au-dessus du héros (cycle)
//   Directionnel  : 4 flèches par tile — un côté FERMÉ ne se franchit
//                   plus (comptoirs, corniches) ; clic près d'un bord
//   Animations    : séquences de tiles animées façon eau RM2003
//                   (2-4 tiles de grille, 1-2-3 ou 1-2-3-2, vitesse)
// Tout vit dans le sidecar assets/<stem>.json — dirs (côtés fermés par
// id) et anims (séquences), compilés par datagen (collision nibble haut
// + data_tileanim.c).

import { useEffect, useRef, useState } from "react";
import type { TilesetMeta } from "../types";
import { AUTOTILE_BASE } from "../types";
import { isAboveId, isSolidId, cyclePassability } from "../state";
import { drawAutotilePreview } from "../autotile";

interface Props {
  tilesetNames: string[]; // stems, ordre du projet
  tilesets: Record<string, ImageBitmap>;
  autoImgs: Record<string, ImageBitmap[]>; // autotiles par stem
  meta: Record<string, TilesetMeta>;
  canImport: boolean;
  onImport: () => void; // PNG libre (les handlers App gèrent tout)
  onImportChipset: () => void;
  onOk: (meta: Record<string, TilesetMeta>) => void;
  onClose: () => void;
}

type Mode = "pass" | "dirs" | "anims";

const COLS = 6;
const CELL = 40; // tile 16x16 affichée x2 + marge pour les flèches

// bits des côtés fermés — alignés sur DIR_* du moteur
const B_DOWN = 1, B_UP = 2, B_LEFT = 4, B_RIGHT = 8;

export default function TilesetsModal(props: Props) {
  const [draft, setDraft] = useState<Record<string, TilesetMeta>>(() =>
    structuredClone(props.meta)
  );
  const [stem, setStem] = useState(props.tilesetNames[0] ?? "");
  const [mode, setMode] = useState<Mode>("pass");
  const [seqSel, setSeqSel] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);

  const bmp = props.tilesets[stem] ?? null;
  const autos = props.autoImgs[stem] ?? [];
  const meta: TilesetMeta =
    draft[stem] ?? { autotiles: [], solid: [], above: [] };
  const gridCount = bmp
    ? Math.max(1, Math.floor(bmp.width / 16)) * Math.max(1, Math.floor(bmp.height / 16))
    : 0;
  const anims = meta.anims ?? [];

  // cellules affichées : autotiles puis grille (ids logiques)
  const cells: number[] = [];
  for (let k = 0; k < autos.length; k++) cells.push(AUTOTILE_BASE + k);
  for (let t = 0; t < gridCount; t++) cells.push(t);
  const rows = Math.max(1, Math.ceil(cells.length / COLS));

  const patch = (m: TilesetMeta) => setDraft({ ...draft, [stem]: m });

  // ---- rendu -----------------------------------------------------------
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = COLS * CELL;
    cv.height = rows * CELL;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#14161c";
    ctx.fillRect(0, 0, cv.width, cv.height);
    const srcCols = bmp ? Math.max(1, Math.floor(bmp.width / 16)) : 1;
    cells.forEach((id, i) => {
      const x = (i % COLS) * CELL + 4;
      const y = Math.floor(i / COLS) * CELL + 4;
      if (id >= AUTOTILE_BASE) {
        const a = autos[id - AUTOTILE_BASE];
        if (a) drawAutotilePreview(ctx, a, x, y, 2);
      } else if (bmp) {
        const sx = (id % srcCols) * 16;
        const sy = Math.floor(id / srcCols) * 16;
        ctx.drawImage(bmp, sx, sy, 16, 16, x, y, 32, 32);
      }
      if (mode === "pass") {
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = isSolidId(meta, id) ? "X" : isAboveId(meta, id) ? "☆" : "O";
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(x + 6, y + 6, 20, 20);
        ctx.fillStyle =
          label === "X" ? "#ff8080" : label === "☆" ? "#80c0ff" : "#a0ffa0";
        ctx.fillText(label, x + 16, y + 17);
      } else if (mode === "dirs" && id < AUTOTILE_BASE) {
        const m = meta.dirs?.[String(id)] ?? 0;
        if (isSolidId(meta, id)) {
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(x, y, 32, 32);
          return;
        }
        const arrow = (
          dx: number, dy: number, closed: boolean, rot: number
        ) => {
          ctx.save();
          ctx.translate(x + 16 + dx, y + 16 + dy);
          ctx.rotate(rot);
          ctx.beginPath();
          ctx.moveTo(0, -5);
          ctx.lineTo(4, 2);
          ctx.lineTo(-4, 2);
          ctx.closePath();
          ctx.fillStyle = closed ? "rgba(255,90,90,0.95)" : "rgba(120,255,120,0.9)";
          ctx.fill();
          ctx.restore();
        };
        arrow(0, 11, !!(m & B_DOWN), Math.PI);
        arrow(0, -11, !!(m & B_UP), 0);
        arrow(-11, 0, !!(m & B_LEFT), -Math.PI / 2);
        arrow(11, 0, !!(m & B_RIGHT), Math.PI / 2);
      } else if (mode === "anims" && id < AUTOTILE_BASE) {
        const seq = anims[seqSel];
        const k = seq ? seq.tiles.indexOf(id) : -1;
        const inAny = anims.some((a) => a.tiles.includes(id));
        if (k >= 0) {
          ctx.strokeStyle = "#ffd060";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, 30, 30);
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(x + 2, y + 2, 14, 14);
          ctx.fillStyle = "#ffd060";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(k === 0 ? "B" : String(k), x + 5, y + 4);
        } else if (inAny) {
          ctx.strokeStyle = "rgba(255,208,96,0.4)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, 30, 30);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bmp, autos, meta, mode, seqSel, rows, stem]);

  // ---- clics -------------------------------------------------------------
  function onClick(e: React.MouseEvent) {
    const rect = ref.current!.getBoundingClientRect();
    const cx = Math.floor((e.clientX - rect.left) / CELL);
    const cy = Math.floor((e.clientY - rect.top) / CELL);
    const i = cy * COLS + cx;
    if (cx < 0 || cx >= COLS || i < 0 || i >= cells.length) return;
    const id = cells[i];
    if (mode === "pass") {
      patch(cyclePassability(meta, id));
      return;
    }
    if (id >= AUTOTILE_BASE) return; // dirs/anims : tiles de grille seules
    if (mode === "dirs") {
      if (isSolidId(meta, id)) return; // un solide n'a pas de côtés
      // côté le plus proche du clic dans la cellule
      const lx = e.clientX - rect.left - cx * CELL - 20; // centre 0
      const ly = e.clientY - rect.top - cy * CELL - 20;
      const bit =
        Math.abs(lx) > Math.abs(ly)
          ? lx > 0 ? B_RIGHT : B_LEFT
          : ly > 0 ? B_DOWN : B_UP;
      const dirs = { ...(meta.dirs ?? {}) };
      const cur = dirs[String(id)] ?? 0;
      const next = cur ^ bit;
      if (next) dirs[String(id)] = next;
      else delete dirs[String(id)];
      patch({ ...meta, dirs });
      return;
    }
    // anims : ajoute/retire la tile de la séquence sélectionnée
    const seq = anims[seqSel];
    if (!seq) return;
    const list = [...anims];
    const k = seq.tiles.indexOf(id);
    const tiles =
      k >= 0 ? seq.tiles.filter((t) => t !== id) : [...seq.tiles, id].slice(0, 4);
    list[seqSel] = { ...seq, tiles };
    patch({ ...meta, anims: list });
  }

  const animErrors = anims
    .map((a, i) =>
      a.tiles.length < 2 || a.tiles.length > 4
        ? `séquence ${i + 1} : 2 à 4 tiles`
        : null
    )
    .filter(Boolean) as string[];

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal database" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Tilesets</div>
        <div className="row" style={{ alignItems: "flex-end", gap: 8 }}>
          <label style={{ minWidth: 180 }}>
            Tileset
            <select value={stem} onChange={(e) => { setStem(e.target.value); setSeqSel(0); }}>
              {props.tilesetNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          {props.canImport && (
            <button onClick={props.onImport} title="Importer un PNG de tileset dans le projet">
              Importer…
            </button>
          )}
          {props.canImport && (
            <button
              onClick={props.onImportChipset}
              title="Importer un chipset RPG Maker 2003 (PNG 480x256) : tiles, autotiles et couches découpés automatiquement"
            >
              Chipset RM2003…
            </button>
          )}
          <span style={{ flex: 1 }} />
          <div className="row" style={{ gap: 4 }}>
            <button className={mode === "pass" ? "active" : ""} onClick={() => setMode("pass")}
              title="O passable, X solide, ☆ au-dessus du héros — clic = cycle">
              Passabilité O/X/☆
            </button>
            <button className={mode === "dirs" ? "active" : ""} onClick={() => setMode("dirs")}
              title="Côtés fermés (flèche rouge = ne se franchit plus) — clic près d'un bord">
              ✥ Directionnel
            </button>
            <button className={mode === "anims" ? "active" : ""} onClick={() => setMode("anims")}
              title="Séquences de tiles animées (eau, torches…)">
              ▶ Animations
            </button>
          </div>
        </div>
        <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            <canvas ref={ref} onMouseDown={onClick} style={{ cursor: "pointer" }} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            {mode === "pass" && (
              <p className="hint">
                Clic sur une tile : O (passable) → X (solide) → ☆ (au-dessus du
                héros, passable) → O. S'applique aussi aux autotiles. La même
                édition reste disponible dans l'onglet Scène (bouton
                Passabilité).
              </p>
            )}
            {mode === "dirs" && (
              <p className="hint">
                Passage directionnel (RM2003) : cliquer PRÈS D'UN BORD ferme ou
                rouvre ce côté (flèche rouge = fermé). Un côté fermé ne se
                franchit plus, ni en sortant ni en entrant — comptoirs de
                magasin, corniches à sens unique. Héros ET événements mobiles.
                Tiles de GRILLE uniquement (pas les autotiles), et inutile sur
                du solide.
              </p>
            )}
            {mode === "anims" && (
              <>
                <p className="hint">
                  Façon eau RM2003 : la PREMIÈRE tile (B) est celle posée sur
                  les maps, les suivantes (1, 2…) sont ses frames — mêmes
                  couleurs, pixels propres à la séquence. Clic sur une tile de
                  la grille : l'ajouter / la retirer de la séquence.
                </p>
                <div className="evedit-cmds" style={{ maxHeight: 150, overflowY: "auto" }}>
                  {anims.map((a, i) => (
                    <div
                      key={i}
                      className={"evedit-line" + (i === seqSel ? " active" : "")}
                      onClick={() => setSeqSel(i)}
                    >
                      ▶ {a.tiles.length ? a.tiles.join(" → ") : "(vide)"} · {a.mode} ·{" "}
                      {a.speed}f
                    </div>
                  ))}
                </div>
                <div className="row" style={{ gap: 4, marginTop: 4 }}>
                  <button
                    title="Nouvelle séquence"
                    onClick={() => {
                      patch({
                        ...meta,
                        anims: [...anims, { tiles: [], mode: "1232", speed: 20 }],
                      });
                      setSeqSel(anims.length);
                    }}
                  >
                    ＋
                  </button>
                  <button
                    className="danger"
                    disabled={!anims[seqSel]}
                    title="Supprimer la séquence"
                    onClick={() => {
                      patch({ ...meta, anims: anims.filter((_, i) => i !== seqSel) });
                      setSeqSel(0);
                    }}
                  >
                    🗑
                  </button>
                </div>
                {anims[seqSel] && (
                  <div className="row" style={{ gap: 8, marginTop: 4 }}>
                    <label>
                      Séquence
                      <select
                        value={anims[seqSel].mode}
                        onChange={(e) => {
                          const list = [...anims];
                          list[seqSel] = { ...list[seqSel], mode: e.target.value };
                          patch({ ...meta, anims: list });
                        }}
                      >
                        <option value="123">1-2-3 (boucle)</option>
                        <option value="1232">1-2-3-2 (aller-retour)</option>
                      </select>
                    </label>
                    <label>
                      Vitesse (frames par image)
                      <input
                        type="number" min={1} max={255}
                        value={anims[seqSel].speed}
                        onChange={(e) => {
                          const list = [...anims];
                          list[seqSel] = {
                            ...list[seqSel],
                            speed: Math.max(1, Math.min(255, Number(e.target.value) || 1)),
                          };
                          patch({ ...meta, anims: list });
                        }}
                      />
                    </label>
                  </div>
                )}
                {animErrors.map((e) => (
                  <p className="hint" key={e} style={{ color: "#ff9090" }}>⚠ {e}</p>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="row">
          <span style={{ flex: 1 }} />
          <button
            disabled={animErrors.length > 0}
            title={animErrors.length ? "Corriger les séquences d'abord" : undefined}
            onClick={() => props.onOk(draft)}
          >
            OK
          </button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
