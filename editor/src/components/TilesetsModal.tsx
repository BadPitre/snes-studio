// "Tilesets" window (Tools >, T1/T2) — the Tileset tab of the RM2003
// Database: the LIST of the project's tilesets on the left (＋ creates an
// EMPTY one, you then assign it a chipset file imported through the
// resource manager), Name + File at the top, two tabs Lower layer /
// Upper layer, and the editing modes in a column left of the grid:
//   Passability   : O walkable, X solid, ☆ above the hero (a cycle)
//   Directional   : 4 arrows per tile — a CLOSED side can no longer be
//                   crossed (counters, ledges); click near an edge
//   Animations    : animated tile sequences, RM2003 water style
//                   (2-4 grid tiles, 1-2-3 or 1-2-3-2, a speed)
// Passability and friends live in the FILE's sidecar (assets/<stem>
// .json): two tilesets sharing a file share its settings.

import { useEffect, useRef, useState } from "react";
import type { TilesetDef, TilesetMeta } from "../types";
import { AUTOTILE_BASE, assetStem } from "../types";
import { isAboveId, isSolidId, cyclePassability } from "../state";
import { drawAutotilePreview } from "../autotile";

interface Props {
  defs: TilesetDef[]; // named entries (project.tileset_defs)
  files: string[]; // imported chipsets (project.tilesets — PNG paths)
  tilesets: Record<string, ImageBitmap>; // bitmaps by file stem
  autoImgs: Record<string, ImageBitmap[]>; // autotiles by stem
  meta: Record<string, TilesetMeta>; // sidecars by stem
  onOk: (defs: TilesetDef[], meta: Record<string, TilesetMeta>) => void;
  onClose: () => void;
}

type Mode = "pass" | "dirs" | "anims";
type Tab = "lower" | "upper";

const COLS = 6;
const CELL = 40; // a 16x16 tile shown x2 + margin for the arrows

// bits of the closed sides — aligned on the engine's DIR_*
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

  // cells shown, filtered by TAB (RM2003 chipsets: upper_start splits the
  // sections; without it, everything lives in the lower layer)
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

  // nearest free name for a new entry
  function freeName(): string {
    for (let i = defs.length + 1; ; i++) {
      const n = `tileset${i}`;
      if (!defs.some((d) => d.name === n)) return n;
    }
  }

  // ---- grid rendering --------------------------------------------------
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

  // ---- clicks on the grid ------------------------------------------------
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
    if (id >= AUTOTILE_BASE) return; // dirs/anims: grid tiles only
    if (mode === "dirs") {
      if (isSolidId(meta, id)) return; // a solid has no sides
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
    <div className="modal-backdrop">
      <div className="modal database" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">Tilesets<button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button></div>
        <div className="db-body">
          {/* ---- left column: the list, RM2003 Database style ---- */}
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

          {/* ---- main panel ---- */}
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
            <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
              {/* editing modes in a column (RM2003's Editing Mode) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 200px" }}>
                <button className={mode === "pass" ? "active" : ""} onClick={() => setMode("pass")}
                  title="Clic : O (passable) → X (solide) → ☆ (au-dessus du héros) → O. Autotiles compris.">
                  Passabilité O/X/☆
                </button>
                <button className={mode === "dirs" ? "active" : ""} onClick={() => setMode("dirs")}
                  title="Clic près d'un bord : ferme/rouvre ce côté (flèche rouge = infranchissable, héros et événements). Tiles de grille, hors solide.">
                  ✥ Directionnel
                </button>
                <button className={mode === "anims" ? "active" : ""} onClick={() => setMode("anims")}
                  title="Séquences de tiles animées (eau, torches…). La PREMIÈRE tile (B) est celle posée sur les maps, les suivantes ses frames. Clic sur la grille : ajouter/retirer.">
                  ▶ Animations
                </button>
                {mode === "anims" && (
                  <>
                    <div
                      className="evedit-cmds"
                      style={{ flex: "0 0 auto", minHeight: 40, maxHeight: 80, overflowY: "auto" }}
                    >
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
              </div>
              {/* the tileset grid — layer tabs just above */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="tabs">
                  <button
                    className={tab === "lower" ? "active" : ""}
                    style={{ flex: "0 0 auto", padding: "3px 12px" }}
                    onClick={() => setTab("lower")}
                  >
                    Couche basse
                  </button>
                  <button
                    className={tab === "upper" ? "active" : ""}
                    style={{ flex: "0 0 auto", padding: "3px 12px" }}
                    onClick={() => setTab("upper")}
                  >
                    Couche haute
                  </button>
                </div>
                <div style={{ maxHeight: 360, overflowY: "auto" }}>
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
        </div>
        <div className="modal-actions">
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
