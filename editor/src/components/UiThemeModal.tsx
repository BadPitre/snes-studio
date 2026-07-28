// Fenêtre « UI / Thème » (Tools →) — DESIGNER à canvas (Phase 12 D1,
// modèle UMG demandé par Bertrand) : palette d'objets à gauche +
// arborescence, canvas central interactif (sélection au clic, drag des
// racines, poignée de redimensionnement, snap à la grille de 8 px),
// inspecteur des propriétés à droite. Compile vers ui/layout.toml
// ([[node]] en arbre) — l'aplatisseur (uilayout.ts) est le MIROIR de
// uigen : ce que montre le canvas est ce que le moteur dessinera.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../types";
import { assetStem } from "../types";
import type { NodeKind, UiLayout2, UiNode } from "../uilayout";
import {
  childrenOf,
  flatten,
  isContainer,
  layoutToToml,
  nodeFramed,
  parseLayoutToml,
  rootAncestor,
  rootsOf,
  sizeOf,
} from "../uilayout";
import {
  ensureProjectDir,
  loadAssetPng,
  readProjectText,
  writeProjectText,
} from "../io";
import VarListModal from "./VarListModal";

interface Props {
  root: string;
  project: Project;
  windowskins: string[];
  iconsets: string[];
  varNames: string[];
  switchNames: string[];
  onRenameVars: (switches: string[], variables: string[]) => void;
  onOk: (ui: Project["ui"]) => void;
  onClose: () => void;
}

const KIND_LABELS: Record<NodeKind, string> = {
  window: "🗔 Fenêtre",
  vbox: "☰ Liste verticale",
  hbox: "⋯ Boîte horizontale",
  label: "🄰 Label",
  image: "🖼 Image",
  value: "№ Valeur",
  gauge: "▮ Jauge",
  icon_row: "♥ Cœurs",
  icon_value: "♦ Icône + compteur",
  variable_display: "🗇 Libellé + valeur",
};

// nœud neuf par type (le designer complète id/pos/parent)
function newNode(kind: NodeKind): Partial<UiNode> {
  switch (kind) {
    case "window": return { size: [10, 4] };
    case "vbox": case "hbox": return {};
    case "label": return { text: "Texte" };
    case "value": return { var: 0, width: 3 };
    case "image": return { icon: 0, width: 1 };
    case "gauge": return { var: 0, max: 10, icon: 0, size: [6, 1], frame: false };
    case "icon_row": return { var: 0, max: 12, icon: 0, size: [6, 1], frame: false };
    case "icon_value": return { var: 0, icon: 0, width: 5, frame: false };
    case "variable_display": return { var: 0, label: "Compteur", size: [12, 3] };
  }
}

export async function loadUiLayout2(root: string): Promise<UiLayout2> {
  try {
    return parseLayoutToml(await readProjectText(root, "ui/layout.toml"));
  } catch {
    return { message: { pos: [0, 20], size: [32, 8] }, choice: { pos: [0, 20], size: [32, 8] }, nodes: [] };
  }
}

export default function UiThemeModal(props: Props) {
  const [ui, setUi] = useState<NonNullable<Project["ui"]>>(() => ({ ...(props.project.ui ?? {}) }));
  const [lay, setLay] = useState<UiLayout2 | null>(null);
  const [font, setFont] = useState<ImageBitmap | null>(null);
  const [skin, setSkin] = useState<ImageBitmap | null>(null);
  const [icons, setIcons] = useState<ImageBitmap | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [varPick, setVarPick] = useState<{ current: number; cb: (n: number) => void } | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // drag en cours : déplacement d'une racine ou redimensionnement
  const dragRef = useRef<
    | { mode: "move"; id: string; offX: number; offY: number }
    | { mode: "resize"; id: string }
    | null
  >(null);

  useEffect(() => {
    void loadUiLayout2(props.root).then(setLay);
    void loadAssetPng(props.root, props.project.assets.font).then(setFont).catch(() => {});
  }, [props.root]);
  useEffect(() => {
    if (ui.windowskin)
      void loadAssetPng(props.root, ui.windowskin).then(setSkin).catch(() => setSkin(null));
    else setSkin(null);
  }, [ui.windowskin, props.root]);
  useEffect(() => {
    if (ui.icons)
      void loadAssetPng(props.root, ui.icons).then(setIcons).catch(() => setIcons(null));
    else setIcons(null);
  }, [ui.icons, props.root]);

  const iconCount = icons ? Math.floor(icons.width / 8) : 0;
  const flat = useMemo(() => (lay ? flatten(lay, iconCount) : null), [lay, iconCount]);

  const iconUrls = useMemo(() => {
    if (!icons) return [] as string[];
    const urls: string[] = [];
    const cv = document.createElement("canvas");
    cv.width = 8;
    cv.height = 8;
    const ctx = cv.getContext("2d")!;
    for (let i = 0; i < iconCount; i++) {
      ctx.clearRect(0, 0, 8, 8);
      ctx.drawImage(icons, i * 8, 0, 8, 8, 0, 0, 8, 8);
      urls.push(cv.toDataURL());
    }
    return urls;
  }, [icons, iconCount]);

  // ---- rendu du canvas (fidèle moteur, via les primitives aplaties) ----
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !lay || !flat) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#4a8a4c";
    ctx.fillRect(0, 0, 256, 224);
    ctx.fillStyle = "#3d7440";
    for (let y = 0; y < 28; y++)
      for (let x = 0; x < 32; x++) if ((x + y) % 2) ctx.fillRect(x * 8, y * 8, 8, 8);

    const glyph = (c: string, dx: number, dy: number) => {
      const k = c.charCodeAt(0);
      if (k < 32 || k > 126 || !font) return;
      ctx.drawImage(font, (k - 32) * 8, 0, 8, 8, dx, dy, 8, 8);
    };
    const text = (s: string, tx: number, ty: number, max: number) => {
      for (let i = 0; i < s.length && i < max; i++) glyph(s[i], (tx + i) * 8, ty * 8);
    };
    const icon = (n: number, dx: number, dy: number) => {
      if (!icons || n < 0 || n >= iconCount) return;
      ctx.drawImage(icons, n * 8, 0, 8, 8, dx, dy, 8, 8);
    };
    const bgCell = (tx: number, ty: number) => {
      if (skin) ctx.drawImage(skin, 8, 8, 8, 8, tx * 8, ty * 8, 8, 8);
      else {
        ctx.fillStyle = "#10185a";
        ctx.fillRect(tx * 8, ty * 8, 8, 8);
      }
    };
    const win = (x: number, y: number, w: number, h: number) => {
      if (skin) {
        for (let ty = 0; ty < h; ty++)
          for (let tx = 0; tx < w; tx++) {
            const sx = tx === 0 ? 0 : tx === w - 1 ? 2 : 1;
            const sy = ty === 0 ? 0 : ty === h - 1 ? 2 : 1;
            ctx.drawImage(skin, sx * 8, sy * 8, 8, 8, (x + tx) * 8, (y + ty) * 8, 8, 8);
          }
      } else {
        ctx.fillStyle = "#10185a";
        ctx.fillRect(x * 8, y * 8, w * 8, h * 8);
      }
    };

    // primitives dans l'ordre d'émission (les panneaux précèdent leurs
    // enfants — même z-order que le moteur)
    for (const p of flat.prims) {
      const f = p.frame;
      if (f) win(p.x, p.y, p.w, p.h);
      else if (p.bg)
        for (let ty = 0; ty < p.h; ty++)
          for (let tx = 0; tx < p.w; tx++) bgCell(p.x + tx, p.y + ty);
      const x0 = p.x + (f ? 1 : 0);
      const y0 = p.y + (f ? 1 : 0);
      const cw = p.w - (f ? 2 : 0);
      const ch = p.h - (f ? 2 : 0);
      switch (p.kind) {
        case 1:
        case 2: {
          const cells = p.vertical ? ch : cw;
          const fill = Math.floor(cells * 2 * 0.58);
          for (let k = 0; k < cells; k++) {
            const d = Math.max(0, Math.min(2, fill - k * 2));
            const n = p.icon + 2 - d;
            if (p.vertical) icon(n, x0 * 8, (y0 + ch - 1 - k) * 8);
            else icon(n, (x0 + k) * 8, y0 * 8);
          }
          break;
        }
        case 3: {
          icon(p.icon, x0 * 8, y0 * 8);
          const val = String(72).padStart(p.pad, "0");
          text(val, x0 + cw - val.length, y0, 5);
          break;
        }
        case 5:
          text(p.text, x0, y0, cw);
          break;
        case 6:
          for (let k = 0; k < p.w; k++) icon(p.icon + k, (x0 + k) * 8, y0 * 8);
          break;
        case 0: {
          text(p.text, x0, y0, cw - 1);
          const val = "42";
          text(val, x0 + cw - val.length, y0, 5);
          break;
        }
      }
    }
    // fenêtres du dialogue (zones interdites aux widgets)
    const m = lay.message;
    win(m.pos[0], m.pos[1], m.size[0], m.size[1]);
    text("Fenetre message", m.pos[0] + 2, m.pos[1] + 1, m.size[0] - 4);
    const c = lay.choice;
    if (c.pos[0] !== m.pos[0] || c.pos[1] !== m.pos[1]) {
      win(c.pos[0], c.pos[1], c.size[0], c.size[1]);
      text("> Choix", c.pos[0] + 2, c.pos[1] + 1, c.size[0] - 4);
    }
    // sélection : cadre blanc/noir + poignée de redimensionnement
    if (selId && flat.rects[selId]) {
      const r = flat.rects[selId];
      ctx.strokeStyle = "#000";
      ctx.strokeRect(r.x * 8 - 1.5, r.y * 8 - 1.5, r.w * 8 + 3, r.h * 8 + 3);
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(r.x * 8 - 0.5, r.y * 8 - 0.5, r.w * 8 + 1, r.h * 8 + 1);
      const n = lay.nodes.find((k) => k.id === selId);
      if (n?.size) {
        ctx.fillStyle = "#fff";
        ctx.fillRect((r.x + r.w) * 8 - 4, (r.y + r.h) * 8 - 4, 4, 4);
        ctx.strokeStyle = "#000";
        ctx.strokeRect((r.x + r.w) * 8 - 4.5, (r.y + r.h) * 8 - 4.5, 5, 5);
      }
    }
  }, [lay, flat, font, skin, icons, iconCount, selId]);

  if (!lay || !flat) return null;
  const sel = lay.nodes.find((n) => n.id === selId);

  const patchNode = (id: string, patch: Partial<UiNode>) => {
    setLay({
      ...lay,
      nodes: lay.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
  };
  const patchWin = (key: "message" | "choice", i: number, axis: "pos" | "size", v: number) => {
    const w = { ...lay[key], [axis]: [...lay[key][axis]] as [number, number] };
    w[axis][i] = v;
    setLay({ ...lay, [key]: w });
  };

  // profondeur d'un nœud (hit-test : on prend le plus PROFOND)
  const depthOf = (id: string): number => {
    let d = 0;
    let n = lay.nodes.find((k) => k.id === id);
    while (n?.parent && d < 16) {
      d++;
      n = lay.nodes.find((k) => k.id === n!.parent);
    }
    return d;
  };
  const nodeAt = (tx: number, ty: number): string | null => {
    let best: string | null = null;
    let bestD = -1;
    for (const [id, r] of Object.entries(flat.rects)) {
      if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) {
        const d = depthOf(id);
        if (d > bestD) {
          bestD = d;
          best = id;
        }
      }
    }
    return best;
  };

  const tileOf = (e: React.MouseEvent) => {
    const cv = canvasRef.current!;
    const b = cv.getBoundingClientRect();
    return [
      Math.floor(((e.clientX - b.left) / b.width) * 32),
      Math.floor(((e.clientY - b.top) / b.height) * 28),
    ] as [number, number];
  };

  const onCanvasDown = (e: React.MouseEvent) => {
    const [tx, ty] = tileOf(e);
    // poignée de resize du nœud sélectionné ?
    if (sel && sel.size && flat.rects[sel.id]) {
      const r = flat.rects[sel.id];
      if (tx === r.x + r.w - 1 && ty === r.y + r.h - 1) {
        dragRef.current = { mode: "resize", id: sel.id };
        return;
      }
    }
    const hit = nodeAt(tx, ty);
    setSelId(hit);
    if (hit) {
      const root = rootAncestor(lay.nodes, hit);
      if (root?.pos) {
        dragRef.current = {
          mode: "move",
          id: root.id,
          offX: tx - root.pos[0],
          offY: ty - root.pos[1],
        };
      }
    }
  };
  const onCanvasMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const [tx, ty] = tileOf(e);
    if (d.mode === "move") {
      const n = lay.nodes.find((k) => k.id === d.id);
      if (!n) return;
      const s = sizeOf(lay.nodes, n);
      const nx = Math.max(0, Math.min(32 - s[0], tx - d.offX));
      const ny = Math.max(0, Math.min(28 - s[1], ty - d.offY));
      if (n.pos?.[0] !== nx || n.pos?.[1] !== ny) patchNode(d.id, { pos: [nx, ny] });
    } else {
      const r = flat.rects[d.id];
      const n = lay.nodes.find((k) => k.id === d.id);
      if (!r || !n) return;
      const w = Math.max(1, tx - r.x + 1);
      const h = Math.max(1, ty - r.y + 1);
      if (n.size?.[0] !== w || n.size?.[1] !== h) patchNode(d.id, { size: [w, h] });
    }
  };
  const onCanvasUp = () => {
    dragRef.current = null;
  };

  // ---- palette : ajout d'un nœud --------------------------------------
  const addNode = (kind: NodeKind) => {
    let i = 1;
    while (lay.nodes.some((n) => n.id === `${kind}${i}`)) i++;
    const node: UiNode = { id: `${kind}${i}`, type: kind, ...newNode(kind) };
    // dans le conteneur sélectionné, sinon frère, sinon racine libre
    const target =
      sel && isContainer(sel) ? sel.id : sel?.parent ? sel.parent : undefined;
    if (target) node.parent = target;
    else node.pos = [1, 1];
    setLay({ ...lay, nodes: [...lay.nodes, node] });
    setSelId(node.id);
  };

  const deleteSel = () => {
    if (!sel) return;
    const doomed = new Set<string>([sel.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of lay.nodes)
        if (n.parent && doomed.has(n.parent) && !doomed.has(n.id)) {
          doomed.add(n.id);
          grew = true;
        }
    }
    setLay({ ...lay, nodes: lay.nodes.filter((n) => !doomed.has(n.id)) });
    setSelId(null);
  };

  const moveSel = (delta: -1 | 1) => {
    if (!sel) return;
    const sibs = lay.nodes.filter((n) => n.parent === sel.parent);
    const at = sibs.findIndex((n) => n.id === sel.id);
    const other = sibs[at + delta];
    if (!other) return;
    const a = lay.nodes.indexOf(sel);
    const b = lay.nodes.indexOf(other);
    const nodes = [...lay.nodes];
    [nodes[a], nodes[b]] = [nodes[b], nodes[a]];
    setLay({ ...lay, nodes });
  };

  const renameSel = (newId: string) => {
    if (!sel || !newId || lay.nodes.some((n) => n.id === newId && n.id !== sel.id)) return;
    setLay({
      ...lay,
      nodes: lay.nodes.map((n) =>
        n.id === sel.id
          ? { ...n, id: newId }
          : n.parent === sel.id
            ? { ...n, parent: newId }
            : n
      ),
    });
    setSelId(newId);
  };

  // ---- arborescence ----------------------------------------------------
  const TreeRow = ({ n, depth }: { n: UiNode; depth: number }) => (
    <>
      <div
        className={"tree-row" + (n.id === selId ? " active" : "")}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => setSelId(n.id)}
      >
        {KIND_LABELS[n.type].split(" ")[0]} {n.id}
      </div>
      {childrenOf(lay.nodes, n.id).map((c) => (
        <TreeRow key={c.id} n={c} depth={depth + 1} />
      ))}
    </>
  );

  const num = (
    label: string,
    value: number | "",
    cb: (v: number | undefined) => void,
    opts: { min?: number; max?: number; empty?: boolean } = {}
  ) => (
    <label className="uitheme-num" key={label}>
      {label}
      <input
        type="number"
        min={opts.min}
        max={opts.max}
        value={value}
        onChange={(e) =>
          cb(e.target.value === "" && opts.empty ? undefined : Number(e.target.value))
        }
      />
    </label>
  );

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal uitheme" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">UI / Thème — designer</div>
        <div className="uitheme-body">
          {/* colonne gauche : thème + palette + arborescence */}
          <div className="uitheme-left">
            <fieldset className="evedit-box">
              <legend onClick={() => setThemeOpen(!themeOpen)} style={{ cursor: "pointer" }}>
                Thème {themeOpen ? "▾" : "▸"}
              </legend>
              {themeOpen && (
                <>
                  <label>
                    Windowskin
                    <select
                      value={ui.windowskin ?? ""}
                      onChange={(e) => setUi({ ...ui, windowskin: e.target.value || undefined })}
                    >
                      <option value="">(aucun — boîte pleine)</option>
                      {props.windowskins.map((rel) => (
                        <option key={rel} value={rel}>{assetStem(rel)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Planche d'icônes
                    <select
                      value={ui.icons ?? ""}
                      onChange={(e) => setUi({ ...ui, icons: e.target.value || undefined })}
                    >
                      <option value="">(aucune)</option>
                      {props.iconsets.map((rel) => (
                        <option key={rel} value={rel}>{assetStem(rel)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Vitesse du texte (0 = instantané)
                    <input
                      type="number" min={0} max={10} value={ui.text_speed ?? 0}
                      onChange={(e) => setUi({ ...ui, text_speed: Number(e.target.value) || undefined })}
                    />
                  </label>
                  <span className="hint">Import : Gestionnaire de ressources.</span>
                </>
              )}
            </fieldset>
            <fieldset className="evedit-box">
              <legend>Palette (clic = ajouter)</legend>
              <div className="uitheme-palette">
                {(Object.keys(KIND_LABELS) as NodeKind[]).map((k) => (
                  <button key={k} onClick={() => addNode(k)} title={
                    sel && isContainer(sel)
                      ? `Ajouter dans « ${sel.id} »`
                      : sel?.parent
                        ? `Ajouter à côté de « ${sel.id} »`
                        : "Ajouter sur le canvas"
                  }>
                    {KIND_LABELS[k]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="evedit-box uitheme-tree">
              <legend>Arborescence</legend>
              <div className="uitheme-treelist">
                {rootsOf(lay.nodes).map((r) => (
                  <TreeRow key={r.id} n={r} depth={0} />
                ))}
                {lay.nodes.length === 0 && (
                  <span className="hint">Vide — ajoute un objet depuis la palette.</span>
                )}
              </div>
            </fieldset>
          </div>

          {/* canvas central */}
          <div className="uitheme-preview">
            <span className="hint">
              Canvas (clic = sélectionner, glisser = déplacer la racine, coin ▪ = redimensionner)
            </span>
            <canvas
              ref={canvasRef}
              width={256}
              height={224}
              onMouseDown={onCanvasDown}
              onMouseMove={onCanvasMove}
              onMouseUp={onCanvasUp}
              onMouseLeave={onCanvasUp}
            />
            <div className="row" style={{ alignItems: "center" }}>
              <span className="hint">Fenêtre message :</span>
              {([0, 1] as const).map((i) =>
                num(i ? "y" : "x", lay.message.pos[i], (v) => patchWin("message", i, "pos", v ?? 0))
              )}
              {([0, 1] as const).map((i) =>
                num(i ? "hauteur" : "largeur", lay.message.size[i], (v) =>
                  patchWin("message", i, "size", v ?? 8)
                )
              )}
            </div>
            <div className="row" style={{ alignItems: "center" }}>
              <span className="hint">Fenêtre choix :</span>
              {([0, 1] as const).map((i) =>
                num(i ? "y" : "x", lay.choice.pos[i], (v) => patchWin("choice", i, "pos", v ?? 0))
              )}
              {([0, 1] as const).map((i) =>
                num(i ? "hauteur" : "largeur", lay.choice.size[i], (v) =>
                  patchWin("choice", i, "size", v ?? 8)
                )
              )}
            </div>
            {flat.errors.length > 0 && (
              <div className="hint uitheme-errors">
                {flat.errors.map((e, i) => (
                  <div key={i}>⚠ {e}</div>
                ))}
              </div>
            )}
          </div>

          {/* inspecteur */}
          <div className="uitheme-inspector">
            <fieldset className="evedit-box">
              <legend>Inspecteur</legend>
              {!sel && <span className="hint">Sélectionne un objet (canvas ou arborescence).</span>}
              {sel && (
                <>
                  <div className="row">
                    <span className="hint" style={{ flex: 1 }}>{KIND_LABELS[sel.type]}</span>
                    <button onClick={() => moveSel(-1)} title="Monter parmi ses frères">↑</button>
                    <button onClick={() => moveSel(1)} title="Descendre">↓</button>
                    <button className="danger" onClick={deleteSel} title="Supprimer (et ses enfants)">🗑</button>
                  </div>
                  <label>id
                    <input value={sel.id} onChange={(e) => renameSel(e.target.value)} />
                  </label>
                  {!sel.parent && (
                    <div className="row">
                      {num("x", sel.pos?.[0] ?? 0, (v) =>
                        patchNode(sel.id, { pos: [v ?? 0, sel.pos?.[1] ?? 0] })
                      )}
                      {num("y", sel.pos?.[1] ?? 0, (v) =>
                        patchNode(sel.id, { pos: [sel.pos?.[0] ?? 0, v ?? 0] })
                      )}
                    </div>
                  )}
                  {sel.size && (
                    <div className="row">
                      {num("largeur", sel.size[0], (v) =>
                        patchNode(sel.id, { size: [v ?? 1, sel.size![1]] })
                      )}
                      {num("hauteur", sel.size[1], (v) =>
                        patchNode(sel.id, { size: [sel.size![0], v ?? 1] })
                      )}
                    </div>
                  )}
                  {(sel.type === "vbox" || sel.type === "hbox") &&
                    num("Espacement (gap)", sel.gap ?? 0, (v) => patchNode(sel.id, { gap: v || undefined }))}
                  {sel.type === "label" && (
                    <label>Texte
                      <input value={sel.text ?? ""}
                        onChange={(e) => patchNode(sel.id, { text: e.target.value })} />
                    </label>
                  )}
                  {sel.type === "variable_display" && (
                    <label>Libellé
                      <input value={sel.label ?? ""}
                        onChange={(e) => patchNode(sel.id, { label: e.target.value })} />
                    </label>
                  )}
                  {(sel.type === "value" || sel.type === "image" || sel.type === "icon_value") &&
                    num(
                      sel.type === "value" ? "Chiffres (1-5)" : sel.type === "image" ? "Icônes (largeur)" : "Largeur",
                      sel.width ?? (sel.type === "value" ? 3 : sel.type === "image" ? 1 : 4),
                      (v) => patchNode(sel.id, { width: v }),
                      { min: 1, max: sel.type === "value" ? 5 : 32 }
                    )}
                  {(sel.type === "value" ||
                    sel.type === "gauge" ||
                    sel.type === "icon_row" ||
                    sel.type === "icon_value" ||
                    sel.type === "variable_display") && (
                    <label>Variable
                      <div className="row" style={{ gap: 4 }}>
                        <input type="number" min={0} max={255} value={sel.var ?? 0}
                          onChange={(e) => patchNode(sel.id, { var: Number(e.target.value) })} />
                        <button className="browse" title="Choisir dans la liste des variables"
                          onClick={() =>
                            setVarPick({ current: sel.var ?? 0, cb: (n) => patchNode(sel.id, { var: n }) })
                          }>
                          …
                        </button>
                      </div>
                      <span className="hint">{props.varNames[sel.var ?? 0] || ""}</span>
                    </label>
                  )}
                  {(sel.type === "gauge" || sel.type === "icon_row") && (
                    <>
                      {num(`Max${sel.max_var !== undefined ? " (ignoré)" : ""}`, sel.max ?? 1, (v) =>
                        patchNode(sel.id, { max: v }), { min: 1 })}
                      <label>Max depuis var (vide = constante)
                        <div className="row" style={{ gap: 4 }}>
                          <input type="number" min={0} max={255} value={sel.max_var ?? ""}
                            onChange={(e) =>
                              patchNode(sel.id, {
                                max_var: e.target.value === "" ? undefined : Number(e.target.value),
                              })
                            } />
                          <button className="browse"
                            onClick={() =>
                              setVarPick({
                                current: sel.max_var ?? 0,
                                cb: (n) => patchNode(sel.id, { max_var: n }),
                              })
                            }>
                            …
                          </button>
                        </div>
                      </label>
                    </>
                  )}
                  {sel.type === "gauge" && (
                    <label>Direction
                      <select value={sel.dir ?? "h"}
                        onChange={(e) => patchNode(sel.id, { dir: e.target.value === "v" ? "v" : undefined })}>
                        <option value="h">Horizontale</option>
                        <option value="v">Verticale (remplie du bas)</option>
                      </select>
                    </label>
                  )}
                  {sel.type === "icon_value" &&
                    num("Zéros de tête (pad)", sel.pad ?? 0, (v) => patchNode(sel.id, { pad: v || undefined }), { min: 0, max: 5 })}
                  {(sel.type === "gauge" ||
                    sel.type === "icon_row" ||
                    sel.type === "icon_value" ||
                    sel.type === "variable_display") && (
                    <label className="checkline">
                      <input type="checkbox" checked={nodeFramed(sel)}
                        onChange={(e) => patchNode(sel.id, { frame: e.target.checked })} />
                      Cadre
                    </label>
                  )}
                  {(sel.type === "gauge" || sel.type === "icon_row" || sel.type === "icon_value" || sel.type === "image") && (
                    <>
                      <span className="hint">
                        Icône : {sel.icon ?? 0}
                        {(sel.type === "gauge" || sel.type === "icon_row") &&
                          ` (+ ${(sel.icon ?? 0) + 1} demie, ${(sel.icon ?? 0) + 2} vide)`}
                        {iconCount === 0 && " — choisis une planche (Thème)."}
                      </span>
                      {iconCount > 0 && (
                        <div className="iconpick">
                          {iconUrls.map((u, i) => {
                            const span = sel.type === "gauge" || sel.type === "icon_row" ? 3 : 1;
                            const s0 = sel.icon ?? 0;
                            return (
                              <button key={i}
                                className={i === s0 ? "sel" : i > s0 && i < s0 + span ? "sel2" : undefined}
                                title={`icône ${i}`}
                                onClick={() => patchNode(sel.id, { icon: i })}>
                                <img src={u} alt={`icône ${i}`} />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </fieldset>
          </div>
        </div>
        <div className="row">
          <button
            disabled={flat.errors.length > 0}
            title={flat.errors.length ? "Corriger les erreurs d'abord" : undefined}
            onClick={() => {
              void (async () => {
                await ensureProjectDir(props.root, "ui");
                await writeProjectText(props.root, "ui/layout.toml", layoutToToml(lay));
              })();
              props.onOk(ui.windowskin || ui.text_speed || ui.icons ? ui : undefined);
            }}
          >
            OK
          </button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
        {varPick && (
          <VarListModal
            kind="var"
            pick
            initial={varPick.current}
            switches={props.switchNames}
            variables={props.varNames}
            onClose={() => setVarPick(null)}
            onOk={(r) => {
              props.onRenameVars(r.switches, r.variables);
              if (r.picked !== undefined) varPick.cb(r.picked);
              setVarPick(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
