// Fenêtre « Tilesets » (Tools →, T1/T2) — l'onglet Tileset de la Database
// RM2003 : la LISTE des tilesets du projet à gauche (＋ en crée un VIDE,
// on lui assigne ensuite un fichier chipset importé via le Gestionnaire
// de ressources), Nom + Fichier en tête, deux onglets Couche basse /
// Couche haute, et les modes d'édition en colonne à gauche de la grille :
//   Passabilité   : O passable, X solide, ☆ au-dessus du héros (cycle)
//   Directionnel  : 4 flèches par tile — un côté FERMÉ ne se franchit
//                   plus (comptoirs, corniches) ; clic près d'un bord
//   Animations    : séquences de tiles animées façon eau RM2003
//                   (2-4 tiles de grille, 1-2-3 ou 1-2-3-2, vitesse)
// La passabilité & co vivent dans le sidecar du FICHIER (assets/<stem>
// .json) : deux tilesets qui partagent un fichier partagent ses réglages.

import { useEffect, useRef, useState } from "react";
import type { TilesetDef, TilesetMeta } from "../types";
import { AUTOTILE_BASE, assetStem } from "../types";
import { isAboveId, isSolidId, cyclePassability } from "../state";
import { drawAutotilePreview } from "../autotile";

interface Props {
  defs: TilesetDef[]; // entrées nommées (project.tileset_defs)
  files: string[]; // chipsets importés (project.tilesets — chemins PNG)
  tilesets: Record<string, ImageBitmap>; // bitmaps par stem de fichier
  autoImgs: Record<string, ImageBitmap[]>; // autotiles par stem
  meta: Record<string, TilesetMeta>; // sidecars par stem
  onOk: (defs: TilesetDef[], meta: Record<string, TilesetMeta>) => void;
  onClose: () => void;
}

type Mode = "pass" | "dirs" | "anims";
type Tab = "lower" | "upper";

const COLS = 6;
const CELL = 40; // tile 16x16 affichée x2 + marge pour les flèches

// bits des côtés fermés — alignés sur DIR_* du moteur
const B_DOWN = 1, B_UP = 2, B_LEFT = 4, B_RIGHT = 8;

export default function TilesetsModal(props: Props) {
  const [defs, setDefs] = useState<TilesetDef[]>(() => structuredClone(props.defs));
  const [draft, setDraft] = useState<Record<string, TilesetMeta>>(() =>
    structuredClone(props.meta)
  );
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState<Mode>("pass");
  const [tab, setTab] = useState<Tab>("lower");
  const [seqSel, setSeqSel] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);

  const def = defs[sel];
  const stem = def?.file ? assetStem(def.file) : "";
  const bmp = (stem && props.tilesets[stem]) || null;
  const autos = (stem && props.autoImgs[stem]) || [];
  const meta: TilesetMeta =
    (stem && draft[stem]) || { autotiles: [], solid: [], above: [] };
  const gridCount = bmp
    ? Math.max(1, Math.floor(bmp.width / 16)) * Math.max(1, Math.floor(bmp.height / 16))
    : 0;
  const anims = meta.anims ?? [];

  // cellules affichées, filtrées par ONGLET (chipsets RM2003 :
  // upper_start sépare les sections ; sans lui, tout vit en couche basse)
  const us = meta.upper_start;
  const cells: number[] = [];
  if (tab === "lower") {
    for (let k = 0; k < autos.length; k++) cells.push(AUTOTILE_BASE + k);
    const t1 = us !== undefined ? Math.min(us, gridCount) : gridCount;
    for (let t = 0; t < t1; t++) cells.push(t);
  } else {
    const t0 = us !== undefined ? Math.min(us, gridCount) : gridCount;
    for (let t = t0; t < gridCount; t++) cells.push(t);
  }
  const rows = Math.max(1, Math.ceil(cells.length / COLS));

  const patch = (m: TilesetMeta) => {
    if (stem) setDraft({ ...draft, [stem]: m });
  };

  // nom libre le plus proche pour une nouvelle entrée
  function freeName(): string {
    for (let i = defs.length + 1; ; i++) {
      const n = `tileset${i}`;
      if (!defs.some((d) => d.name === n)) return n;
    }
  }

  // ---- rendu de la grille ----------------------------------------------
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = COLS * CELL;
    cv.height = rows * CELL;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#14161c";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (!bmp) return;
    const srcCols = Math.max(1, Math.floor(bmp.width / 16));
    cells.forEach((id, i) => {
      const x = (i % COLS) * CELL + 4;
      const y = Math.floor(i / COLS) * CELL + 4;
      if (id >= AUTOTILE_BASE) {
        const a = autos[id - AUTOTILE_BASE];
        if (a) drawAutotilePreview(ctx, a, x, y, 2);
      } else {
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
        const arrow = (dx: number, dy: number, closed: boolean, rot: number) => {
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
  }, [bmp, autos, meta, mode, tab, seqSel, rows, stem]);

  // ---- clics sur la grille -----------------------------------------------
  function onClick(e: React.MouseEvent) {
    if (!bmp) return;
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
  const nameBad =
    !!def && (def.name.trim() === "" || defs.some((d, i) => i !== sel && d.name === def.name));

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal database" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Tilesets</div>
        <div className="db-body">
          {/* ---- colonne gauche : la liste, façon Database RM2003 ---- */}
          <div className="db-tablecol">
            <div className="evedit-cmds db-tables">
              {defs.map((d, i) => (
                <div
                  key={i}
                  className={"evedit-line" + (i === sel ? " active" : "")}
                  onClick={() => {
                    setSel(i);
                    setSeqSel(0);
                    setTab("lower");
                  }}
                >
                  {String(i + 1).padStart(4, "0")}: {d.name || "(sans nom)"}
                  {!d.file && <span className="db-badge">vide</span>}
                </div>
              ))}
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
              <button
                title="Nouveau tileset (vide — assigner ensuite un fichier)"
                onClick={() => {
                  setDefs([...defs, { name: freeName(), file: "" }]);
                  setSel(defs.length);
                }}
              >
                ＋
              </button>
              <button
                className="danger"
                disabled={!def || defs.length <= 1}
                title="Retirer l'entrée (le fichier chipset reste au projet)"
                onClick={() => {
                  setDefs(defs.filter((_, i) => i !== sel));
                  setSel(Math.max(0, sel - 1));
                }}
              >
                🗑
              </button>
            </div>
          </div>

          {/* ---- panneau principal ---- */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {def && (
              <div className="row" style={{ gap: 8 }}>
                <label style={{ flex: 1 }}>
                  Nom
                  <input
                    value={def.name}
                    style={nameBad ? { outline: "1px solid #ff7070" } : undefined}
                    onChange={(e) => {
                      const list = [...defs];
                      list[sel] = { ...def, name: e.target.value };
                      setDefs(list);
                    }}
                  />
                </label>
                <label style={{ flex: 1 }}>
                  Fichier tileset (chipsets importés — Gestionnaire de ressources)
                  <select
                    value={def.file}
                    onChange={(e) => {
                      const list = [...defs];
                      list[sel] = { ...def, file: e.target.value };
                      setDefs(list);
                    }}
                  >
                    <option value="">(aucun — tileset vide)</option>
                    {props.files.map((f) => (
                      <option key={f} value={f}>
                        {assetStem(f)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {/* onglets de couche, comme RM2003 */}
            <div className="tabs">
              <button className={tab === "lower" ? "active" : ""} onClick={() => setTab("lower")}>
                Couche basse
              </button>
              <button className={tab === "upper" ? "active" : ""} onClick={() => setTab("upper")}>
                Couche haute
              </button>
            </div>
            <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
              {/* modes d'édition en colonne (Editing Mode de RM2003) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 170 }}>
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
                {mode === "anims" && (
                  <>
                    <div className="evedit-cmds" style={{ maxHeight: 140, overflowY: "auto" }}>
                      {anims.map((a, i) => (
                        <div
                          key={i}
                          className={"evedit-line" + (i === seqSel ? " active" : "")}
                          onClick={() => setSeqSel(i)}
                        >
                          ▶ {a.tiles.length ? a.tiles.join("→") : "(vide)"} · {a.speed}f
                        </div>
                      ))}
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <button
                        disabled={!stem}
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
                      <>
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
                          Vitesse (frames)
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
                      </>
                    )}
                    {animErrors.map((er) => (
                      <p className="hint" key={er} style={{ color: "#ff9090" }}>⚠ {er}</p>
                    ))}
                  </>
                )}
                <p className="hint">
                  {mode === "pass" &&
                    "Clic : O (passable) → X (solide) → ☆ (au-dessus du héros) → O. Autotiles compris."}
                  {mode === "dirs" &&
                    "Clic PRÈS D'UN BORD : ferme/rouvre ce côté (rouge = infranchissable, héros et événements). Tiles de grille, hors solide."}
                  {mode === "anims" &&
                    "La PREMIÈRE tile (B) est celle posée sur les maps, les suivantes ses frames (mêmes couleurs). Clic sur la grille : ajouter/retirer."}
                </p>
              </div>
              {/* grille du tileset */}
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {!def?.file ? (
                  <p className="hint" style={{ width: 240 }}>
                    Tileset vide — choisir un « Fichier tileset » ci-dessus.
                    Les chipsets s'importent dans le Gestionnaire de
                    ressources (catégorie ChipSet).
                  </p>
                ) : cells.length === 0 ? (
                  <p className="hint" style={{ width: 240 }}>
                    {tab === "upper"
                      ? "Pas de section couche haute (chipsets RM2003 uniquement — upper_start)."
                      : "Grille vide."}
                  </p>
                ) : (
                  <canvas ref={ref} onMouseDown={onClick} style={{ cursor: "pointer" }} />
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          <span className="hint" style={{ flex: 1 }}>
            Deux tilesets qui partagent un même fichier partagent sa
            passabilité, ses côtés fermés et ses animations (sidecar du
            fichier).
          </span>
          <button
            disabled={defs.some(
              (d, i) =>
                d.name.trim() === "" || defs.some((o, j) => j !== i && o.name === d.name)
            ) || animErrors.length > 0}
            title="Désactivé tant qu'un nom est vide/en double ou qu'une séquence est invalide"
            onClick={() => props.onOk(defs, draft)}
          >
            OK
          </button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
