// "UI / Thème" window (Tools >) — a canvas DESIGNER (Phase 12 D1, on the
// UMG model): an object palette on the left plus a tree, an interactive
// canvas in the middle (click to select, drag the roots, a resize handle,
// snap to the 8 px grid), a property inspector on the right. Compiles to
// ui/layout.toml ([[node]] as a tree) — the flattener (uilayout.ts) is
// the MIRROR of uigen: what the canvas shows is what the engine will
// draw.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../types";
import { assetStem } from "../types";
import type { DialogStyle, NodeKind, UiLayout2, UiNode } from "../uilayout";
import {
  childrenOf,
  flatten,
  setPicSizes,
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
  // "widgets": the widget list + designer; "dialogs": the theme +
  // message/choice windows (Tools > UI, two submenus)
  mode: "widgets" | "dialogs";
  project: Project;
  windowskins: string[];
  iconsets: string[];
  fonts: string[]; // the project's fonts (S1) — the default (assets.font) first
  varNames: string[];
  switchNames: string[];
  onRenameVars: (switches: string[], variables: string[]) => void;
  // the project's ui + widgets (roots) + dialogue styles — ui/layout.toml
  // is written BEFORE the call, the lists feed the event commands
  onOk: (ui: Project["ui"], widgets: string[], styles: string[]) => void;
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
  list: "▤ Liste (curseur)",
};

// a fresh node per type (the designer fills in id/pos/parent)
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
    case "list": return { items: ["Attaque", "Magie", "Objet", "Fuite"] };
  }
}

export async function loadUiLayout2(root: string): Promise<UiLayout2> {
  try {
    return parseLayoutToml(await readProjectText(root, "ui/layout.toml"));
  } catch {
    return { message: { pos: [0, 20], size: [32, 8] }, choice: { pos: [0, 20], size: [32, 8] }, nodes: [], styles: [] };
  }
}

export default function UiThemeModal(props: Props) {
  const [ui, setUi] = useState<NonNullable<Project["ui"]>>(() => ({ ...(props.project.ui ?? {}) }));
  const [lay, setLay] = useState<UiLayout2 | null>(null);
  const [font, setFont] = useState<ImageBitmap | null>(null);
  const [skin, setSkin] = useState<ImageBitmap | null>(null);
  const [icons, setIcons] = useState<ImageBitmap | null>(null);
  // the project's pictures (the "Image" widget in picture mode): bitmap
  // by NAME (the stem, as in the event commands)
  const [pics, setPics] = useState<Record<string, ImageBitmap>>({});
  const [selId, setSelId] = useState<string | null>(null);
  // dialogs mode (S1): the selected box — 0 = default, i+1 = styles[i];
  // skin/font OWNED by the style, for the preview
  const [styleIdx, setStyleIdx] = useState(0);
  const [stSkin, setStSkin] = useState<ImageBitmap | null>(null);
  const [stFont, setStFont] = useState<ImageBitmap | null>(null);
  // widget (root) being edited — the canvas shows ONLY that widget;
  // null = the whole screen ("Vue d'ensemble", every widget in context)
  const [scope, setScope] = useState<string | null>(null);
  // two pages: the widget list -> the designer
  const [view, setView] = useState<"list" | "design">("list");
  const [varPick, setVarPick] = useState<{ current: number; cb: (n: number) => void } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // drag in progress: moving a root or resizing
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
  // The widgets' images are sized by the image itself: the designer needs
  // their sizes to place and check the layout.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const out: Record<string, ImageBitmap> = {};
      for (const e of props.project.pictures ?? []) {
        const p = typeof e === "string" ? e : e.path;
        try {
          out[assetStem(p)] = await loadAssetPng(props.root, p);
        } catch {
          /* unreadable image: ignored, the node will report it missing */
        }
      }
      if (alive) setPics(out);
    })();
    return () => {
      alive = false;
    };
  }, [props.project.pictures, props.root]);
  useEffect(() => {
    const sizes: Record<string, [number, number]> = {};
    for (const [name, bmp] of Object.entries(pics))
      sizes[name] = [Math.ceil(bmp.width / 8), Math.ceil(bmp.height / 8)];
    setPicSizes(sizes);
  }, [pics]);
  // assets OWNED by the selected style (S1) — absent = the theme's
  const curStyle = styleIdx > 0 ? lay?.styles[styleIdx - 1] : undefined;
  useEffect(() => {
    if (curStyle?.windowskin)
      void loadAssetPng(props.root, curStyle.windowskin).then(setStSkin).catch(() => setStSkin(null));
    else setStSkin(null);
  }, [curStyle?.windowskin, props.root]);
  useEffect(() => {
    if (curStyle?.font)
      void loadAssetPng(props.root, curStyle.font).then(setStFont).catch(() => setStFont(null));
    else setStFont(null);
  }, [curStyle?.font, props.root]);
  // WIDGET fonts (S2): bitmaps loaded for the preview — the key only
  // changes when the list of fonts in use changes
  const [fontMap, setFontMap] = useState<Record<string, ImageBitmap>>({});
  const widgetFontKey = [
    ...new Set((lay?.nodes ?? []).filter((n) => !n.parent && n.font).map((n) => n.font!)),
  ]
    .sort()
    .join("|");
  useEffect(() => {
    let dead = false;
    const wanted = widgetFontKey ? widgetFontKey.split("|") : [];
    void Promise.all(
      wanted.map(async (rel) => {
        try {
          return [rel, await loadAssetPng(props.root, rel)] as const;
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (!dead)
        setFontMap(Object.fromEntries(entries.filter((e): e is readonly [string, ImageBitmap] => !!e)));
    });
    return () => {
      dead = true;
    };
  }, [widgetFontKey, props.root]);

  const iconCount = icons ? Math.floor(icons.width / 8) : 0;
  const flat = useMemo(() => (lay ? flatten(lay, iconCount) : null), [lay, iconCount, pics]);

  // ids under the edited widget — with a scope the canvas draws (and
  // hit-tests) ONLY those nodes; null = whole-screen view
  const scopeIds = useMemo(() => {
    if (!scope || !lay) return null;
    const ids = new Set([scope]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of lay.nodes)
        if (n.parent && ids.has(n.parent) && !ids.has(n.id)) {
          ids.add(n.id);
          grew = true;
        }
    }
    return ids;
  }, [scope, lay]);

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

  // ---- canvas rendering (engine-faithful, through the flat primitives) ----
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

    const glyph = (c: string, dx: number, dy: number, f = font) => {
      const k = c.charCodeAt(0);
      if (k < 32 || k > 126 || !f) return;
      ctx.drawImage(f, (k - 32) * 8, 0, 8, 8, dx, dy, 8, 8);
    };
    const text = (s: string, tx: number, ty: number, max: number, f = font) => {
      for (let i = 0; i < s.length && i < max; i++) glyph(s[i], (tx + i) * 8, ty * 8, f);
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
    const win = (x: number, y: number, w: number, h: number, sk = skin) => {
      if (sk) {
        for (let ty = 0; ty < h; ty++)
          for (let tx = 0; tx < w; tx++) {
            const sx = tx === 0 ? 0 : tx === w - 1 ? 2 : 1;
            const sy = ty === 0 ? 0 : ty === h - 1 ? 2 : 1;
            ctx.drawImage(sk, sx * 8, sy * 8, 8, 8, (x + tx) * 8, (y + ty) * 8, 8, 8);
          }
      } else {
        ctx.fillStyle = "#10185a";
        ctx.fillRect(x * 8, y * 8, w * 8, h * 8);
      }
    };

    // primitives in emission order (panels come before their children —
    // the same z-order as the engine); a scoped widget hides everything
    // else
    for (const p of flat.prims) {
      if (scopeIds && !scopeIds.has(p.nodeId)) continue;
      // the widget's font (S2) — the project's if absent or not loaded
      const pf = p.font ? fontMap[p.font] ?? font : font;
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
          text(val, x0 + cw - val.length, y0, 5, pf);
          break;
        }
        case 5:
          text(p.text, x0, y0, cw, pf);
          break;
        case 6:
          for (let k = 0; k < p.w; k++) icon(p.icon + k, (x0 + k) * 8, y0 * 8);
          break;
        case 8: {
          // a project image: we show it as it is. In game it will be
          // brought back to the font's 4 colours (a reminder is shown in
          // the inspector) — the preview places and sizes it, it does not
          // simulate the colour reduction.
          const bmp = p.pic ? pics[p.pic] : undefined;
          if (bmp) ctx.drawImage(bmp, x0 * 8, y0 * 8);
          break;
        }
        case 0: {
          text(p.text, x0, y0, cw - 1, pf);
          const val = "42";
          if (p.vertical) text(val, x0 + p.text.length, y0, 5, pf); // align left
          else text(val, x0 + cw - val.length, y0, 5, pf);
          break;
        }
        case 7: {
          // cursor list (B6): one item per row, the cursor ('>' or an
          // icon — pad flag) on the first; a scrolling list shows the
          // 'v' indicator (the preview always sits at the top)
          const items = p.text.split("\n");
          for (let k = 0; k < items.length && k < ch; k++) {
            if (k === 0) {
              if (p.pad) icon(p.icon, x0 * 8, y0 * 8);
              else text(">", x0, y0, 1, pf);
            }
            text(items[k], x0 + 1, y0 + k, cw - 1, pf);
          }
          if (items.length > ch) text("v", x0 + cw - 1, y0 + ch - 1, 1, pf);
          break;
        }
      }
    }
    // the dialogue's windows (areas forbidden to widgets) — in dialogs
    // mode, those of the SELECTED style, with ITS skin and ITS font.
    // Hidden while a widget is scoped: only the edited widget is shown.
    if (!scopeIds) {
      const st = props.mode === "dialogs" && styleIdx > 0 ? lay.styles[styleIdx - 1] : undefined;
      const dSkin = st?.windowskin ? stSkin : skin;
      const dFont = st?.font ? stFont : font;
      const m = st ? st.message ?? lay.message : lay.message;
      win(m.pos[0], m.pos[1], m.size[0], m.size[1], dSkin);
      text(st ? `Style ${st.id}` : "Fenetre message", m.pos[0] + 2, m.pos[1] + 1, m.size[0] - 4, dFont);
      const c = st ? st.choice ?? m : lay.choice;
      if (c.pos[0] !== m.pos[0] || c.pos[1] !== m.pos[1]) {
        win(c.pos[0], c.pos[1], c.size[0], c.size[1], dSkin);
        text("> Choix", c.pos[0] + 2, c.pos[1] + 1, c.size[0] - 4, dFont);
      }
    }
    // selection: a white/black frame + a resize handle
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
  }, [lay, flat, font, skin, icons, iconCount, selId, scopeIds, styleIdx, stSkin, stFont, fontMap, props.mode]);

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

  // ---- dialogue styles (S1, "dialogs" mode) ----------------------------
  const patchStyle = (patch: Partial<DialogStyle>) => {
    if (styleIdx === 0) return;
    setLay({
      ...lay,
      styles: lay.styles.map((s, i) => (i === styleIdx - 1 ? { ...s, ...patch } : s)),
    });
  };
  // the style's window: reads the EFFECTIVE one (inherited from the
  // default when absent), writes a window owned by the style
  const patchStyleWin = (key: "message" | "choice", i: number, axis: "pos" | "size", v: number) => {
    if (!curStyle) return;
    const eff = key === "message" ? curStyle.message ?? lay.message : curStyle.choice ?? curStyle.message ?? lay.message;
    const w = { pos: [...eff.pos] as [number, number], size: [...eff.size] as [number, number] };
    w[axis][i] = v;
    patchStyle({ [key]: w });
  };
  const addStyle = () => {
    let i = 1;
    while (lay.styles.some((s) => s.id === `style${i}`)) i++;
    const st: DialogStyle = {
      id: `style${i}`,
      message: { pos: [...lay.message.pos] as [number, number], size: [...lay.message.size] as [number, number] },
    };
    setLay({ ...lay, styles: [...lay.styles, st] });
    setStyleIdx(lay.styles.length + 1);
  };

  // depth of a node (hit-test: we take the DEEPEST)
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
      // scoped designer: the other widgets are not drawn, so they are
      // not clickable either
      if (scopeIds && !scopeIds.has(id)) continue;
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
    // resize handle of the selected node?
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

  // first FREE position for a new root widget — avoids the existing
  // roots and the dialogue's windows, so two widgets do not land in the
  // same place
  const freeSpot = (w: number, h: number): [number, number] => {
    const taken = rootsOf(lay.nodes)
      .filter((r) => r.pos && flat.rects[r.id])
      .map((r) => flat.rects[r.id]);
    taken.push({ x: lay.message.pos[0], y: lay.message.pos[1], w: lay.message.size[0], h: lay.message.size[1] });
    taken.push({ x: lay.choice.pos[0], y: lay.choice.pos[1], w: lay.choice.size[0], h: lay.choice.size[1] });
    for (let y = 0; y + h <= 28; y++)
      for (let x = 1; x + w <= 32; x++) {
        const r = { x, y, w, h };
        if (!taken.some((t) => !(r.x + r.w <= t.x || t.x + t.w <= r.x || r.y + r.h <= t.y || t.y + t.h <= r.y)))
          return [x, y];
      }
    return [1, 1];
  };

  // ---- palette: adding a node -----------------------------------------
  const addNode = (kind: NodeKind, asRoot = false) => {
    let i = 1;
    while (lay.nodes.some((n) => n.id === `${kind}${i}`)) i++;
    const node: UiNode = { id: `${kind}${i}`, type: kind, ...newNode(kind) };
    // into the selected container, otherwise as a sibling, otherwise into
    // the widget being edited, otherwise a new root widget on a free spot
    const scopeNode = scope ? lay.nodes.find((n) => n.id === scope) : undefined;
    const target = asRoot
      ? undefined
      : sel && isContainer(sel)
        ? sel.id
        : sel?.parent
          ? sel.parent
          : scopeNode && isContainer(scopeNode)
            ? scopeNode.id
            : undefined;
    if (target) node.parent = target;
    else {
      const s = node.size ?? [
        kind === "label" ? 5 : kind === "value" ? 3 : kind === "icon_value" ? 5 : 3,
        1,
      ];
      node.pos = freeSpot(s[0], s[1]);
    }
    setLay({ ...lay, nodes: [...lay.nodes, node] });
    setSelId(node.id);
    if (!target) {
      setScope(node.id); // a new widget: the designer opens onto it
      setView("design");
    }
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
    if (scope && doomed.has(scope)) setScope(null);
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
    if (scope === sel.id) setScope(newId);
    setSelId(newId);
  };

  // ---- tree ------------------------------------------------------------
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
    <div className="modal-backdrop">
      <div className="modal uitheme" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">
          {props.mode === "dialogs"
            ? "UI — Dialogues et choix"
            : view === "list"
              ? "UI — Widgets"
              : `UI — Designer « ${scope ?? "écran"} »`}
        <button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button></div>
        {props.mode === "dialogs" && (
          <div className="uitheme-listview">
            <div className="uitheme-listcol">
              <fieldset className="evedit-box">
                <legend>Boîtes de dialogue ({1 + lay.styles.length})</legend>
                <div className="uitheme-treelist">
                  <div
                    className={"tree-row" + (styleIdx === 0 ? " active" : "")}
                    onClick={() => setStyleIdx(0)}
                  >
                    🗔 (défaut) ★
                  </div>
                  {lay.styles.map((st, i) => (
                    <div
                      key={st.id}
                      className={"tree-row uitheme-widgetrow" + (styleIdx === i + 1 ? " active" : "")}
                      onClick={() => setStyleIdx(i + 1)}
                    >
                      <span style={{ flex: 1 }}>🗔 {st.id}</span>
                      <button title="Renommer le style"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newId = prompt(`Nouveau nom du style « ${st.id} »`, st.id)?.trim();
                          if (!newId || newId === st.id) return;
                          if (!/^[ -~]+$/.test(newId)) {
                            alert("Nom ASCII uniquement (pas d'accents).");
                            return;
                          }
                          if (lay.styles.some((s) => s.id === newId)) {
                            alert(`Le style « ${newId} » existe déjà.`);
                            return;
                          }
                          setLay({
                            ...lay,
                            styles: lay.styles.map((s) => (s.id === st.id ? { ...s, id: newId } : s)),
                          });
                        }}>
                        ✎
                      </button>
                      <button className="danger" title="Supprimer le style"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!confirm(`Supprimer le style « ${st.id} » ? Les messages qui l'utilisent devront être corrigés.`)) return;
                          setLay({ ...lay, styles: lay.styles.filter((s) => s.id !== st.id) });
                          setStyleIdx(0);
                        }}>
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
                <button disabled={lay.styles.length >= 3} onClick={addStyle}
                  title={lay.styles.length >= 3 ? "Max 3 styles en plus du défaut" : undefined}>
                  ✧ Nouveau style
                </button>
                <span className="hint">
                  Le style se choisit sur chaque commande Message / Choix
                  (défaut si rien). Budget BG3 : 256 caractères — chaque
                  windowskin en ajoute 9, chaque fonte 96.
                </span>
              </fieldset>
              {styleIdx === 0 && (
              <>
              <fieldset className="evedit-box">
                <legend>Thème des dialogues</legend>
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
                  Vitesse du texte (frames/caractère, 0 = instantané)
                  <input
                    type="number" min={0} max={10} value={ui.text_speed ?? 0}
                    onChange={(e) => setUi({ ...ui, text_speed: Number(e.target.value) || undefined })}
                  />
                </label>
                <span className="hint">Import de windowskins : Gestionnaire de ressources.</span>
              </fieldset>
              <fieldset className="evedit-box">
                <legend>Fenêtres (en tiles — écran 32x28)</legend>
                {(["message", "choice"] as const).map((k) => (
                  <div className="row" key={k}>
                    <span style={{ width: 62, alignSelf: "flex-end", paddingBottom: 5 }} className="hint">
                      {k}
                    </span>
                    {([0, 1] as const).map((i) =>
                      num(i ? "y" : "x", lay[k].pos[i], (v) => patchWin(k, i, "pos", v ?? 0))
                    )}
                    {([0, 1] as const).map((i) =>
                      num(i ? "hauteur" : "largeur", lay[k].size[i], (v) => patchWin(k, i, "size", v ?? 8))
                    )}
                  </div>
                ))}
                <span className="hint">
                  Cadre compris (le texte garde une marge de 2 colonnes /
                  1 rangée). Les widgets sont affichés en contexte — un
                  chevauchement est une erreur.
                </span>
              </fieldset>
              </>
              )}
              {curStyle && (
              <>
              <fieldset className="evedit-box">
                <legend>Style « {curStyle.id} »</legend>
                <label>
                  Windowskin
                  <select
                    value={curStyle.windowskin ?? ""}
                    onChange={(e) => patchStyle({ windowskin: e.target.value || undefined })}
                  >
                    <option value="">(celui du thème)</option>
                    {props.windowskins.map((rel) => (
                      <option key={rel} value={rel}>{assetStem(rel)}</option>
                    ))}
                    {curStyle.windowskin && !props.windowskins.includes(curStyle.windowskin) && (
                      <option value={curStyle.windowskin}>{assetStem(curStyle.windowskin)} (hors registre)</option>
                    )}
                  </select>
                </label>
                <label>
                  Fonte
                  <select
                    value={curStyle.font ?? ""}
                    onChange={(e) => patchStyle({ font: e.target.value || undefined })}
                  >
                    <option value="">(fonte du projet ★)</option>
                    {props.fonts
                      .filter((rel) => rel !== props.project.assets.font)
                      .map((rel) => (
                        <option key={rel} value={rel}>{assetStem(rel)}</option>
                      ))}
                    {curStyle.font &&
                      curStyle.font !== props.project.assets.font &&
                      !props.fonts.includes(curStyle.font) && (
                        <option value={curStyle.font}>{assetStem(curStyle.font)} (hors registre)</option>
                      )}
                  </select>
                </label>
                <span className="hint">
                  Import de fontes : Gestionnaire de ressources (FontSet,
                  bande 768x8). Toutes les fontes partagent la palette de
                  la fonte du projet.
                </span>
              </fieldset>
              <fieldset className="evedit-box">
                <legend>Fenêtres du style (en tiles)</legend>
                <div className="row">
                  <span style={{ width: 62, alignSelf: "flex-end", paddingBottom: 5 }} className="hint">
                    message
                  </span>
                  {([0, 1] as const).map((i) =>
                    num(i ? "y" : "x", (curStyle.message ?? lay.message).pos[i], (v) =>
                      patchStyleWin("message", i, "pos", v ?? 0))
                  )}
                  {([0, 1] as const).map((i) =>
                    num(i ? "hauteur" : "largeur", (curStyle.message ?? lay.message).size[i], (v) =>
                      patchStyleWin("message", i, "size", v ?? 8))
                  )}
                </div>
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={!!curStyle.choice}
                    onChange={(e) =>
                      patchStyle({
                        choice: e.target.checked
                          ? {
                              pos: [...(curStyle.message ?? lay.message).pos] as [number, number],
                              size: [...(curStyle.message ?? lay.message).size] as [number, number],
                            }
                          : undefined,
                      })
                    }
                  />
                  Fenêtre de choix distincte (sinon : celle du message)
                </label>
                {curStyle.choice && (
                  <div className="row">
                    <span style={{ width: 62, alignSelf: "flex-end", paddingBottom: 5 }} className="hint">
                      choice
                    </span>
                    {([0, 1] as const).map((i) =>
                      num(i ? "y" : "x", curStyle.choice!.pos[i], (v) =>
                        patchStyleWin("choice", i, "pos", v ?? 0))
                    )}
                    {([0, 1] as const).map((i) =>
                      num(i ? "hauteur" : "largeur", curStyle.choice!.size[i], (v) =>
                        patchStyleWin("choice", i, "size", v ?? 8))
                    )}
                  </div>
                )}
                <span className="hint">
                  Min 8x3 dans l'écran 32x28. Les widgets ne doivent
                  chevaucher AUCUNE fenêtre de dialogue (tous styles).
                </span>
              </fieldset>
              </>
              )}
            </div>
            <div className="uitheme-preview">
              <span className="hint">Preview (rendu tiles fidèle)</span>
              <canvas ref={canvasRef} width={256} height={224} />
              {flat.errors.length > 0 && (
                <div className="hint uitheme-errors">
                  {flat.errors.map((e, i) => (
                    <div key={i}>⚠ {e}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {props.mode === "widgets" && view === "list" && (
          <div className="uitheme-listview">
            <div className="uitheme-listcol">
              <fieldset className="evedit-box">
                <legend>Planche d'icônes des widgets</legend>
                <select
                  value={ui.icons ?? ""}
                  onChange={(e) => setUi({ ...ui, icons: e.target.value || undefined })}
                >
                  <option value="">(aucune)</option>
                  {props.iconsets.map((rel) => (
                    <option key={rel} value={rel}>{assetStem(rel)}</option>
                  ))}
                </select>
                <span className="hint">
                  Import : Gestionnaire de ressources (IconSet). Les
                  dialogues et le windowskin s'éditent dans Tools → UI →
                  Dialogues et choix.
                </span>
              </fieldset>
            </div>
            <fieldset className="evedit-box uitheme-widgetlist">
              <legend>Widgets du projet ({rootsOf(lay.nodes).length})</legend>
              <button onClick={() => addNode("window", true)}>✧ Nouveau widget</button>
              <div className="uitheme-treelist">
                {rootsOf(lay.nodes).map((r) => (
                  <div key={r.id} className="tree-row uitheme-widgetrow"
                    onDoubleClick={() => {
                      setScope(r.id);
                      setSelId(r.id);
                      setView("design");
                    }}>
                    <span
                      title={r.visible
                        ? "Visible au démarrage (clic : cacher — affichable par event)"
                        : "Caché au démarrage (clic : visible dès le boot) — s'affiche par la commande d'event « Afficher un widget UI »"}
                      onClick={() => patchNode(r.id, { visible: !r.visible })}
                      style={{ cursor: "pointer" }}
                    >
                      {r.visible ? "👁" : "▫"}
                    </span>
                    <span style={{ flex: 1 }}>
                      {KIND_LABELS[r.type].split(" ")[0]} {r.id}
                    </span>
                    <button onClick={() => {
                      setScope(r.id);
                      setSelId(r.id);
                      setView("design");
                    }}>
                      Éditer…
                    </button>
                    <button title="Renommer le widget"
                      onClick={() => {
                        const newId = prompt(`Nouveau nom du widget « ${r.id} »`, r.id)?.trim();
                        if (!newId || newId === r.id) return;
                        if (lay.nodes.some((n) => n.id === newId)) {
                          alert(`Le nom « ${newId} » est déjà pris.`);
                          return;
                        }
                        setLay({
                          ...lay,
                          nodes: lay.nodes.map((n) =>
                            n.id === r.id
                              ? { ...n, id: newId }
                              : n.parent === r.id
                                ? { ...n, parent: newId }
                                : n
                          ),
                        });
                        if (scope === r.id) setScope(newId);
                        if (selId === r.id) setSelId(newId);
                      }}>
                      ✎
                    </button>
                    <button className="danger" title="Supprimer le widget (et son contenu)"
                      onClick={() => {
                        setSelId(r.id);
                        setScope(r.id);
                        // direct deletion of the widget and its children
                        const doomed = new Set([r.id]);
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
                        setScope(null);
                      }}>
                      🗑
                    </button>
                  </div>
                ))}
                {rootsOf(lay.nodes).length === 0 && (
                  <span className="hint">Aucun widget — ✧ Nouveau widget pour commencer.</span>
                )}
              </div>
              <button onClick={() => {
                setScope(null);
                setSelId(null);
                setView("design");
              }}>
                ⛶ Vue d'ensemble de l'écran…
              </button>
              <span className="hint">
                Double-clic (ou Éditer…) ouvre le designer. 👁 = visible au
                démarrage ; sinon le widget est CACHÉ jusqu'à la commande
                d'event « Afficher un widget UI ».
              </span>
            </fieldset>
          </div>
        )}
        {props.mode === "widgets" && view === "design" && (
        <div className="uitheme-body">
          {/* left column: back + palette + structure */}
          <div className="uitheme-left">
            <button onClick={() => setView("list")}>← Widgets</button>
            <fieldset className="evedit-box">
              <legend>Palette (clic = ajouter)</legend>
              <div className="uitheme-palette">
                {(Object.keys(KIND_LABELS) as NodeKind[]).map((k) => (
                  <button key={k} onClick={() => addNode(k)} title={
                    sel && isContainer(sel)
                      ? `Ajouter dans « ${sel.id} »`
                      : sel?.parent
                        ? `Ajouter à côté de « ${sel.id} »`
                        : "Ajouter sur le canvas (nouveau widget)"
                  }>
                    {KIND_LABELS[k]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="evedit-box uitheme-tree">
              <legend>
                {scope ? `Structure de « ${scope} »` : "Arborescence"}
              </legend>
              <div className="uitheme-treelist">
                {(scope
                  ? lay.nodes.filter((n) => n.id === scope)
                  : rootsOf(lay.nodes)
                ).map((r) => (
                  <TreeRow key={r.id} n={r} depth={0} />
                ))}
                {lay.nodes.length === 0 && (
                  <span className="hint">Vide — ✧ Nouveau widget, ou un objet de la palette.</span>
                )}
              </div>
            </fieldset>
          </div>

          {/* central canvas */}
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

          {/* inspector */}
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
                  {!sel.parent && (
                    <label className="checkline">
                      <input type="checkbox" checked={!!sel.visible}
                        onChange={(e) => patchNode(sel.id, { visible: e.target.checked || undefined })} />
                      Visible au démarrage (sinon : commande « Afficher un widget UI »)
                    </label>
                  )}
                  {!sel.parent && (
                    <label>Fonte du widget
                      <select
                        value={sel.font ?? ""}
                        onChange={(e) => patchNode(sel.id, { font: e.target.value || undefined })}
                      >
                        <option value="">(fonte du projet ★)</option>
                        {props.fonts
                          .filter((rel) => rel !== props.project.assets.font)
                          .map((rel) => (
                            <option key={rel} value={rel}>{assetStem(rel)}</option>
                          ))}
                        {sel.font &&
                          sel.font !== props.project.assets.font &&
                          !props.fonts.includes(sel.font) && (
                            <option value={sel.font}>{assetStem(sel.font)} (hors registre)</option>
                          )}
                      </select>
                      <span className="hint">
                        Tout le texte du widget (import : Ressources → FontSet).
                      </span>
                    </label>
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
                  {sel.type === "value" && (
                    <label>Alignement
                      <select value={sel.align ?? "right"}
                        onChange={(e) =>
                          patchNode(sel.id, { align: e.target.value === "left" ? "left" : undefined })
                        }>
                        <option value="right">Droite (chiffres calés au bord)</option>
                        <option value="left">Gauche (collée au texte d'avant)</option>
                      </select>
                    </label>
                  )}
                  {sel.type === "variable_display" && (
                    <label>Libellé
                      <input value={sel.label ?? ""}
                        onChange={(e) => patchNode(sel.id, { label: e.target.value })} />
                    </label>
                  )}
                  {sel.type === "list" && (
                    <>
                    <label>Items (un par ligne, 2-32)
                      <textarea rows={6} value={(sel.items ?? []).join("\n")}
                        onChange={(e) =>
                          patchNode(sel.id, {
                            items: e.target.value.split("\n").map((t) => t.trimEnd()),
                          })
                        } />
                      <span className="hint">
                        La commande d'event « Choix dans une liste » ouvre ce menu :
                        haut/bas naviguent, A écrit l'index (0-{Math.max((sel.items ?? []).length - 1, 0)})
                        dans une variable, B = 255 (annulé).
                      </span>
                    </label>
                    {num("Lignes visibles (vide = toutes)", sel.rows ?? "", (v) =>
                      patchNode(sel.id, { rows: v && v >= 1 ? v : undefined }),
                      { min: 1, max: 26, empty: true })}
                    {(sel.rows ?? 0) >= 1 && (sel.rows ?? 0) < (sel.items ?? []).length && (
                      <span className="hint">
                        Liste déroulante : {(sel.items ?? []).length} items sur {sel.rows} lignes —
                        le curseur fait défiler, les flèches ^ / v s'affichent au bord.
                      </span>
                    )}
                    <label>Curseur
                      <select
                        value={sel.cursor_icon !== undefined ? "icon" : "text"}
                        onChange={(e) =>
                          patchNode(sel.id, {
                            cursor_icon: e.target.value === "icon" ? 0 : undefined,
                          })
                        }>
                        <option value="text">Chevron « &gt; » (fonte)</option>
                        <option value="icon" disabled={iconCount === 0}>
                          Icône de la planche{iconCount === 0 ? " (aucune planche)" : ""}
                        </option>
                      </select>
                    </label>
                    {sel.cursor_icon !== undefined && iconCount > 0 && (
                      <div className="iconpick">
                        {iconUrls.map((u, i) => (
                          <button key={i}
                            className={i === sel.cursor_icon ? "sel" : undefined}
                            title={`icône ${i}`}
                            onClick={() => patchNode(sel.id, { cursor_icon: i })}>
                            <img src={u} alt={`icône ${i}`} />
                          </button>
                        ))}
                      </div>
                    )}
                    </>
                  )}
                  {(sel.type === "value" || (sel.type === "image" && !sel.pic) || sel.type === "icon_value") &&
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
                    sel.type === "variable_display" ||
                    sel.type === "list") && (
                    <label className="checkline">
                      <input type="checkbox"
                        checked={sel.type === "list" ? sel.frame ?? true : nodeFramed(sel)}
                        onChange={(e) => patchNode(sel.id, { frame: e.target.checked })} />
                      Cadre
                    </label>
                  )}
                  {sel.type === "image" && (
                    <>
                      <label>
                        Source
                        <select
                          value={sel.pic ? "pic" : "icon"}
                          onChange={(e) =>
                            patchNode(sel.id, {
                              pic:
                                e.target.value === "pic"
                                  ? Object.keys(pics)[0] ?? ""
                                  : undefined,
                            })
                          }
                        >
                          <option value="icon">Icônes de la planche</option>
                          <option value="pic">Image du projet</option>
                        </select>
                      </label>
                      {sel.pic !== undefined && (
                        <>
                          <label>
                            Image
                            <select
                              value={sel.pic}
                              onChange={(e) => patchNode(sel.id, { pic: e.target.value })}
                            >
                              {Object.keys(pics).length === 0 && (
                                <option value="">aucune image dans le projet</option>
                              )}
                              {Object.keys(pics).map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </label>
                          <span className="hint">
                            {pics[sel.pic]
                              ? `${pics[sel.pic].width}x${pics[sel.pic].height} px = ${Math.ceil(
                                  pics[sel.pic].width / 8
                                )}x${Math.ceil(pics[sel.pic].height / 8)} tuiles.`
                              : ""}{" "}
                            La couche UI n'a que 4 couleurs : l'image y est ramenée à
                            celles de la fonte, comme les icônes. Prépare-la dans ces
                            teintes (sinon elle ressortira en aplats).
                          </span>
                        </>
                      )}
                    </>
                  )}
                  {(sel.type === "gauge" || sel.type === "icon_row" || sel.type === "icon_value" ||
                    (sel.type === "image" && sel.pic === undefined)) && (
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
        )}
        <div className="row">
          <button
            disabled={flat.errors.length > 0}
            title={flat.errors.length ? "Corriger les erreurs d'abord" : undefined}
            onClick={() => {
              void (async () => {
                // write THEN notify: the caller reloads the widget list —
                // the write/reload race has bitten once already
                await ensureProjectDir(props.root, "ui");
                await writeProjectText(props.root, "ui/layout.toml", layoutToToml(lay));
                props.onOk(
                  ui.windowskin || ui.text_speed || ui.icons ? ui : undefined,
                  rootsOf(lay.nodes).map((n) => n.id),
                  lay.styles.map((s) => s.id)
                );
              })();
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
