// uilayout.ts — model and FLATTENER of the UI layout (D1 designer), the
// TypeScript mirror of tools/datagen/src/ui.rs: the same
// sizing/placement/validation rules, so that the editor's canvas shows
// exactly what the compiler will produce (rule §9.3).
//
// Unlike the Rust (which stops at the first error), the editor COLLECTS
// the errors and renders as best it can anyway — the designer must stay
// usable while the user fixes things.

import { parse } from "smol-toml";
import type { UiWin } from "./types";

export const SCREEN_W = 32;
export const SCREEN_H = 28;
export const PRIM_MAX = 32;
export const NODE_KINDS = [
  "window",
  "vbox",
  "hbox",
  "label",
  "value",
  "image",
  "gauge",
  "icon_row",
  "icon_value",
  "variable_display",
  "list",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** Sizes IN TILES of the project's pictures, filled in by the UI window
 *  (it alone can load the images) — the size computation of an "image"
 *  widget in picture mode refers to it. */
let picSizes: Record<string, [number, number]> = {};
export function setPicSizes(m: Record<string, [number, number]>) {
  picSizes = m;
}

/** Database tables a list can source its rows on, filled in by the UI
 *  window — the canvas must show the rows the engine will draw. */
let dbTables: Record<string, { cols: string[]; names: string[] }> = {};
export function setDbTables(m: Record<string, { cols: string[]; names: string[] }>) {
  dbTables = m;
}

export interface UiNode {
  id: string;
  parent?: string;
  type: NodeKind;
  pos?: [number, number]; // roots
  size?: [number, number]; // window/gauge/icon_row/variable_display
  margin?: [number, number]; // window (default [1,1])
  gap?: number; // vbox/hbox
  text?: string; // label
  width?: number; // value (1-5) / image (icons) / icon_value
  // image: the name of a project PICTURE instead of icons. The widget's
  // size then comes from the image (brought back to the UI layer's 4
  // colours at compile time, like the icons — see gfx::to_ui_image).
  pic?: string;
  var?: number;
  label?: string; // variable_display
  frame?: boolean;
  max?: number;
  max_var?: number;
  icon?: number;
  dir?: string; // gauge: "h" | "v"
  pad?: number; // icon_value: leading zeros
  align?: string; // value: "left" (default: value right-aligned)
  // roots: visible at startup (default FALSE — widgets are shown through
  // the "Afficher un widget UI" event command)
  visible?: boolean;
  // roots: the WIDGET's font (S2 — a 768x8 PNG, default: assets.font)
  font?: string;
  // list (B6): items of the cursor menu, one per row
  items?: string[];
  // list: visible rows — fewer than the item count makes the list
  // SCROLL (an extra column carries the ^ / v indicators)
  rows?: number;
  // list: icon from the ui.icons sheet used as the cursor instead of '>'
  cursor_icon?: number;
  // list: the rows ARE the entries of this database TABLE (their names).
  // `items` is then ignored and `size` is required — the table grows
  // without the layout knowing.
  source?: string;
  // list + source: a u8 column holding a VARIABLE NUMBER; the row hides
  // while that variable is 0 (an inventory shows what you own)
  source_filter?: string;
  // list + source: same, but the variable's VALUE is drawn right-aligned
  source_count?: string;
}

// Dialogue box style (S1) — style 0 (the default) = theme + [message]
export interface DialogStyle {
  id: string;
  windowskin?: string; // default: the theme's
  font?: string; // default: assets.font
  message?: UiWin; // default: [message]
  choice?: UiWin; // default: the style's message
}

export interface UiLayout2 {
  message: UiWin;
  choice: UiWin;
  nodes: UiNode[];
  styles: DialogStyle[];
}

// Flattened primitive (what the engine draws) + the node it came from
export interface Prim {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: number; // 0-8 (8 = image in picture mode)
  frame: boolean;
  var: number;
  icon: number;
  vertical: boolean;
  pad: number;
  max: number;
  maxVar?: number;
  /** kind 8: name of the picture shown (designer preview) */
  pic?: string;
  bg: boolean;
  text: string;
  nodeId: string;
  font?: string; // the root's font (S2) — the preview loads it
}

export interface Flat {
  prims: Prim[];
  // absolute rect of EVERY node (canvas selection/hit-test)
  rects: Record<string, { x: number; y: number; w: number; h: number }>;
  errors: string[];
}

export function nodeFramed(n: UiNode): boolean {
  return n.frame ?? n.type === "variable_display";
}

export function isContainer(n: UiNode): boolean {
  return n.type === "window" || n.type === "vbox" || n.type === "hbox";
}

export function childrenOf(nodes: UiNode[], id: string): UiNode[] {
  return nodes.filter((n) => n.parent === id);
}

export function rootsOf(nodes: UiNode[]): UiNode[] {
  return nodes.filter((n) => !n.parent);
}

export function rootAncestor(nodes: UiNode[], id: string): UiNode | undefined {
  let n = nodes.find((k) => k.id === id);
  for (let guard = 0; n && n.parent && guard < 16; guard++)
    n = nodes.find((k) => k.id === n!.parent);
  return n;
}

// Intrinsic size (the same rules as size_of on the Rust side) —
// tolerant: missing sizes fall back to a default, the error is reported
export function sizeOf(nodes: UiNode[], n: UiNode, errors?: string[]): [number, number] {
  const kids = childrenOf(nodes, n.id);
  switch (n.type) {
    case "window":
      if (!n.size) errors?.push(`« ${n.id} » : size requis`);
      return n.size ?? [5, 3];
    case "gauge":
    case "icon_row":
    case "variable_display":
      if (!n.size) errors?.push(`« ${n.id} » : size requis`);
      return n.size ?? [4, n.type === "variable_display" ? 3 : 1];
    case "vbox": {
      if (kids.length === 0) {
        errors?.push(`conteneur « ${n.id} » vide`);
        return [2, 1];
      }
      const gap = n.gap ?? 0;
      let w = 1,
        h = 0;
      kids.forEach((c, k) => {
        const s = sizeOf(nodes, c, errors);
        w = Math.max(w, s[0]);
        h += s[1] + (k > 0 ? gap : 0);
      });
      return [w, h];
    }
    case "hbox": {
      if (kids.length === 0) {
        errors?.push(`conteneur « ${n.id} » vide`);
        return [2, 1];
      }
      const gap = n.gap ?? 0;
      let w = 0,
        h = 1;
      kids.forEach((c, k) => {
        const s = sizeOf(nodes, c, errors);
        h = Math.max(h, s[1]);
        w += s[0] + (k > 0 ? gap : 0);
      });
      return [w, h];
    }
    case "label":
      return [Math.max((n.text ?? "").length, 1), 1];
    case "value":
      return [Math.min(Math.max(n.width ?? 3, 1), 5), 1];
    case "image":
      if (n.pic) {
        const s = picSizes[n.pic];
        if (!s) errors?.push(`« ${n.id} » : image « ${n.pic} » introuvable`);
        return s ?? [1, 1];
      }
      return [Math.max(n.width ?? 1, 1), 1];
    case "icon_value":
      return [Math.max(n.width ?? 4, 2), 1];
    case "list": {
      if (n.source) {
        // sourced on a table: the row count is a RUNTIME thing
        if (!n.size) errors?.push(`« ${n.id} » : size requis (liste sur une table)`);
        return n.size ?? [12, 5];
      }
      // AUTO size: 1 cursor column + the longest item (+ the frame);
      // `rows` below the item count = a SCROLLING list, one extra
      // column for the ^ / v indicators
      const items = n.items ?? [];
      const f = (n.frame ?? true) ? 2 : 0;
      const wmax = items.reduce((m, t) => Math.max(m, t.length), 1);
      const total = Math.max(items.length, 1);
      const vis = n.rows && n.rows >= 1 && n.rows < total ? n.rows : total;
      return [1 + wmax + (vis < total ? 1 : 0) + f, vis + f];
    }
  }
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

// Flattens the tree — the same rules as place() on the Rust side
export function flatten(lay: UiLayout2, iconCount: number): Flat {
  const errors: string[] = [];
  const prims: Prim[] = [];
  const rects: Flat["rects"] = {};
  const nodes = lay.nodes;

  if (lay.styles.length > 3) errors.push(`${lay.styles.length} styles de dialogue (max 3)`);
  {
    const sids = new Set<string>();
    for (const st of lay.styles) {
      if (!st.id || !/^[ -~]+$/.test(st.id)) errors.push("style de dialogue sans id ASCII");
      if (sids.has(st.id)) errors.push(`style « ${st.id} » en double`);
      sids.add(st.id);
      const m = st.message ?? lay.message;
      const c = st.choice ?? m;
      for (const [what, w] of [["message", m], ["choice", c]] as const) {
        if (w.pos[0] < 0 || w.pos[1] < 0 || w.size[0] < 8 || w.size[1] < 3 ||
            w.pos[0] + w.size[0] > SCREEN_W || w.pos[1] + w.size[1] > SCREEN_H)
          errors.push(`style « ${st.id} » : fenêtre ${what} invalide (écran 32x28, min 8x3)`);
      }
    }
  }
  const ids = new Set<string>();
  for (const n of nodes) {
    if (!n.id) errors.push("nœud sans id");
    else if (ids.has(n.id)) errors.push(`id « ${n.id} » en double`);
    ids.add(n.id);
    if (n.parent && !nodes.some((k) => k.id === n.parent))
      errors.push(`« ${n.id} » : parent « ${n.parent} » introuvable`);
    if (n.parent && n.font)
      errors.push(`« ${n.id} » : la fonte se pose sur la RACINE du widget`);
  }

  const needIcon = (n: UiNode, span: number) => {
    if (n.icon === undefined) errors.push(`« ${n.id} » : icône requise`);
    if (iconCount === 0) errors.push(`« ${n.id} » : demande une planche d'icônes (Thème)`);
    else if ((n.icon ?? 0) + span > iconCount)
      errors.push(`« ${n.id} » : icônes hors planche (${iconCount})`);
  };

  // font of the root being placed (S2) — stamped on every primitive so
  // the preview draws with the right font
  let curFont: string | undefined;
  const emit = (p: Prim) => {
    if (p.x < 0 || p.y < 0 || p.x + p.w > SCREEN_W || p.y + p.h > SCREEN_H)
      errors.push(`« ${p.nodeId} » : sort de l'écran 32x28`);
    p.font = curFont;
    prims.push(p);
  };

  const place = (n: UiNode, x: number, y: number, inWindow: boolean, depth: number) => {
    if (depth > 6) {
      errors.push(`arbre trop profond autour de « ${n.id} »`);
      return;
    }
    const size = sizeOf(nodes, n, undefined);
    rects[n.id] = { x, y, w: size[0], h: size[1] };
    const kids = childrenOf(nodes, n.id);
    const base = {
      var: n.var ?? 0,
      icon: n.icon ?? 0,
      vertical: n.dir === "v",
      pad: 0,
      max: n.max ?? 0,
      maxVar: n.max_var,
      bg: inWindow,
      text: "",
      nodeId: n.id,
    };
    switch (n.type) {
      case "window": {
        if (size[0] < 3 || size[1] < 3) errors.push(`« ${n.id} » : une window fait au moins 3x3`);
        emit({ x, y, w: size[0], h: size[1], kind: 4, frame: true, ...base, var: 0 });
        const m = n.margin ?? [1, 1];
        let cy = y + m[1];
        for (const c of kids) {
          const cs = sizeOf(nodes, c, undefined);
          if (cy + cs[1] > y + size[1] - m[1] || m[0] + cs[0] > size[0] - m[0])
            errors.push(`« ${c.id} » déborde de la window « ${n.id} »`);
          place(c, x + m[0], cy, true, depth + 1);
          cy += cs[1];
        }
        break;
      }
      case "vbox": {
        let cy = y;
        for (const c of kids) {
          const cs = sizeOf(nodes, c, undefined);
          place(c, x, cy, inWindow, depth + 1);
          cy += cs[1] + (n.gap ?? 0);
        }
        break;
      }
      case "hbox": {
        let cx = x;
        for (const c of kids) {
          const cs = sizeOf(nodes, c, undefined);
          place(c, cx, y, inWindow, depth + 1);
          cx += cs[0] + (n.gap ?? 0);
        }
        break;
      }
      case "label": {
        const t = n.text ?? "";
        if (!/^[ -~]*$/.test(t)) errors.push(`« ${n.id} » : texte non-ASCII`);
        emit({ x, y, w: size[0], h: 1, kind: 5, frame: false, ...base, text: t });
        break;
      }
      case "value":
        if (n.var === undefined) errors.push(`« ${n.id} » : variable requise`);
        // the type 0 vertical flag carries left alignment (uigen likewise)
        emit({ x, y, w: size[0], h: 1, kind: 0, frame: false, ...base, vertical: n.align === "left" });
        break;
      case "image":
        if (n.pic) {
          // picture mode: the widget takes the image's size
          emit({ x, y, w: size[0], h: size[1], kind: 8, frame: false, ...base, pic: n.pic });
        } else {
          needIcon(n, size[0]);
          emit({ x, y, w: size[0], h: 1, kind: 6, frame: false, ...base });
        }
        break;
      case "variable_display": {
        if (n.var === undefined) errors.push(`« ${n.id} » : variable requise`);
        const f = nodeFramed(n);
        const label = n.label ?? "";
        if (!/^[ -~]*$/.test(label)) errors.push(`« ${n.id} » : libellé non-ASCII`);
        const innerW = size[0] - (f ? 2 : 0);
        const [mw, mh] = f ? [4, 3] : [3, 1];
        if (size[0] < mw || size[1] < mh) errors.push(`« ${n.id} » : minimum ${mw}x${mh}`);
        if (label.length > innerW - 1)
          errors.push(`« ${n.id} » : libellé trop long (${innerW - 1} tiles utiles)`);
        emit({ x, y, w: size[0], h: size[1], kind: 0, frame: f, ...base, text: label });
        break;
      }
      case "gauge":
      case "icon_row": {
        if (n.var === undefined) errors.push(`« ${n.id} » : variable requise`);
        if (n.max_var === undefined && !(n.max && n.max > 0))
          errors.push(`« ${n.id} » : max (> 0) ou variable max requis`);
        needIcon(n, 3);
        if (n.type === "icon_row" && n.dir === "v")
          errors.push(`« ${n.id} » : icon_row est horizontal`);
        const f = nodeFramed(n);
        const [mw, mh] = f ? [3, 3] : [1, 1];
        if (size[0] < mw || size[1] < mh) errors.push(`« ${n.id} » : minimum ${mw}x${mh}`);
        emit({
          x, y, w: size[0], h: size[1],
          kind: n.type === "gauge" ? 1 : 2, frame: f, ...base,
        });
        break;
      }
      case "icon_value": {
        if (n.var === undefined) errors.push(`« ${n.id} » : variable requise`);
        needIcon(n, 1);
        const f = nodeFramed(n);
        const pad = n.pad ?? 0;
        const innerW = size[0] - (f ? 2 : 0);
        if (pad > 5 || pad > innerW - 1) errors.push(`« ${n.id} » : pad invalide`);
        emit({
          x, y, w: size[0], h: f ? 3 : 1, kind: 3, frame: f, ...base,
          pad,
        });
        break;
      }
      case "list": {
        if (n.source) {
          const tbl = dbTables[n.source];
          if (!tbl) errors.push(`« ${n.id} » : table « ${n.source} » inconnue`);
          for (const [f, what] of [
            [n.source_filter, "filtre"],
            [n.source_count, "quantité"],
          ] as [string | undefined, string][]) {
            if (f && tbl && !tbl.cols.includes(f))
              errors.push(`« ${n.id} » : colonne ${what} « ${f} » absente de ${n.source}`);
          }
          if (n.cursor_icon !== undefined) needIcon({ ...n, icon: n.cursor_icon }, 1);
          emit({
            x, y, w: size[0], h: size[1], kind: 7, frame: n.frame ?? true,
            ...base, icon: n.cursor_icon ?? 0,
            pad: n.cursor_icon !== undefined ? 1 : 0,
            // the preview shows what the table holds today
            text: (tbl?.names ?? []).join("\n"),
          });
          break;
        }
        const items = n.items ?? [];
        if (items.length < 2 || items.length > 32)
          errors.push(`« ${n.id} » : la liste demande 2 à 32 items`);
        for (const t of items)
          if (!t || !/^[ -~]+$/.test(t)) errors.push(`« ${n.id} » : item vide ou non-ASCII`);
        if (n.cursor_icon !== undefined) needIcon({ ...n, icon: n.cursor_icon }, 1);
        // the unused pad flag says "the cursor is an icon" (uigen likewise)
        emit({
          x, y, w: size[0], h: size[1], kind: 7, frame: n.frame ?? true,
          ...base, icon: n.cursor_icon ?? 0,
          pad: n.cursor_icon !== undefined ? 1 : 0,
          text: items.join("\n"),
        });
        break;
      }
    }
  };

  const rootRects: { id: string; x: number; y: number; w: number; h: number }[] = [];
  for (const r of rootsOf(nodes)) {
    if (!r.pos) {
      errors.push(`racine « ${r.id} » : position requise`);
      continue;
    }
    const size = sizeOf(nodes, r, errors);
    const rect = { id: r.id, x: r.pos[0], y: r.pos[1], w: size[0], h: size[1] };
    for (const prev of rootRects)
      if (rectsOverlap(rect, prev)) errors.push(`« ${prev.id} » et « ${r.id} » se chevauchent`);
    const allWins: [string, UiWin][] = [
      ["message", lay.message],
      ["choice", lay.choice],
    ];
    for (const st of lay.styles) {
      const m = st.message ?? lay.message;
      allWins.push([`message du style « ${st.id} »`, m]);
      allWins.push([`choice du style « ${st.id} »`, st.choice ?? m]);
    }
    for (const [name, w] of allWins) {
      if (rectsOverlap(rect, { x: w.pos[0], y: w.pos[1], w: w.size[0], h: w.size[1] }))
        errors.push(`« ${r.id} » : chevauche la fenêtre ${name} (les dialogues l'écraseraient)`);
    }
    rootRects.push(rect);
    curFont = r.font;
    place(r, r.pos[0], r.pos[1], false, 0);
  }
  if (prims.length > PRIM_MAX)
    errors.push(`${prims.length} primitives (max ${PRIM_MAX}) — simplifier le layout`);
  return { prims, rects, errors };
}

// ---- reading / writing ui/layout.toml -------------------------------------

interface RawOverlay {
  id?: string;
  pos: [number, number];
  size: [number, number];
  content: string;
  var?: number;
  label?: string;
  frame?: boolean;
  max?: number;
  max_var?: number;
  icon?: number;
  dir?: string;
  pad?: number;
}

export function parseLayoutToml(src: string): UiLayout2 {
  const raw = parse(src) as {
    message?: UiWin;
    choice?: UiWin;
    overlay?: RawOverlay[];
    node?: UiNode[];
    dialog_style?: DialogStyle[];
  };
  const message = raw.message ?? { pos: [0, 20], size: [32, 8] };
  const choice = raw.choice ?? message;
  const nodes: UiNode[] = [...(raw.node ?? [])];
  // migration: the flat [[overlay]] entries (W1) become leaf roots
  (raw.overlay ?? []).forEach((ov, i) => {
    nodes.push({
      id: ov.id || `overlay${i + 1}`,
      type: (ov.content as NodeKind) ?? "variable_display",
      pos: ov.pos,
      size: ov.size,
      var: ov.var,
      label: ov.label,
      frame: ov.frame,
      max: ov.max,
      max_var: ov.max_var,
      icon: ov.icon,
      dir: ov.dir,
      pad: ov.pad,
      visible: true, // W1 compat: the flat overlays stay visible
    });
  });
  return { message: { ...message }, choice: { ...choice }, nodes, styles: raw.dialog_style ?? [] };
}

export function layoutToToml(l: UiLayout2): string {
  let s = `# Layout UI du projet (designer D1 — docs/SPEC_SYSTEME_UI.md).\n# Positions et tailles EN TILES (unités de 8 px, écran 32x28).\n\n[message]\npos = [${l.message.pos}]\nsize = [${l.message.size}]\n\n[choice]\npos = [${l.choice.pos}]\nsize = [${l.choice.size}]\n`;
  for (const st of l.styles) {
    s += `\n[[dialog_style]]\nid = ${JSON.stringify(st.id)}\n`;
    if (st.windowskin) s += `windowskin = ${JSON.stringify(st.windowskin)}\n`;
    if (st.font) s += `font = ${JSON.stringify(st.font)}\n`;
    if (st.message) s += `message = { pos = [${st.message.pos}], size = [${st.message.size}] }\n`;
    if (st.choice) s += `choice = { pos = [${st.choice.pos}], size = [${st.choice.size}] }\n`;
  }
  // preorder: roots then descendants (parents always come first)
  const emitNode = (n: UiNode) => {
    s += `\n[[node]]\nid = ${JSON.stringify(n.id)}\n`;
    if (n.parent) s += `parent = ${JSON.stringify(n.parent)}\n`;
    s += `type = ${JSON.stringify(n.type)}\n`;
    if (n.pos) s += `pos = [${n.pos}]\n`;
    if (n.size) s += `size = [${n.size}]\n`;
    if (n.margin) s += `margin = [${n.margin}]\n`;
    if (n.gap !== undefined && n.gap !== 0) s += `gap = ${n.gap}\n`;
    if (n.text !== undefined) s += `text = ${JSON.stringify(n.text)}\n`;
    if (n.width !== undefined && !n.pic) s += `width = ${n.width}\n`;
    if (n.pic) s += `pic = ${JSON.stringify(n.pic)}\n`;
    if (n.var !== undefined) s += `var = ${n.var}\n`;
    if (n.label) s += `label = ${JSON.stringify(n.label)}\n`;
    if (
      n.frame !== undefined &&
      n.frame !== (n.type === "variable_display" || n.type === "list")
    )
      s += `frame = ${n.frame}\n`;
    if (n.max_var !== undefined) s += `max_var = ${n.max_var}\n`;
    else if (n.max !== undefined) s += `max = ${n.max}\n`;
    if (n.icon !== undefined) s += `icon = ${n.icon}\n`;
    if (n.dir === "v") s += `dir = "v"\n`;
    if (n.pad) s += `pad = ${n.pad}\n`;
    if (n.items && !n.source)
      s += `items = [${n.items.map((t) => JSON.stringify(t)).join(", ")}]\n`;
    if (n.source) s += `source = ${JSON.stringify(n.source)}\n`;
    if (n.source_filter) s += `source_filter = ${JSON.stringify(n.source_filter)}\n`;
    if (n.source_count) s += `source_count = ${JSON.stringify(n.source_count)}\n`;
    if (n.rows) s += `rows = ${n.rows}\n`;
    if (n.cursor_icon !== undefined) s += `cursor_icon = ${n.cursor_icon}\n`;
    if (n.align === "left") s += `align = "left"\n`;
    if (!n.parent && n.visible) s += `visible = true\n`;
    if (!n.parent && n.font) s += `font = ${JSON.stringify(n.font)}\n`;
    for (const c of childrenOf(l.nodes, n.id)) emitNode(c);
  };
  for (const r of rootsOf(l.nodes)) emitNode(r);
  return s;
}
