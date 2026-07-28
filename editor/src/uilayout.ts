// uilayout.ts — modèle et APLATISSEUR du layout UI (designer D1),
// miroir TypeScript de tools/datagen/src/ui.rs : mêmes règles de
// taille/placement/validation, pour que le canvas de l'éditeur montre
// exactement ce que le compilateur produira (règle §9.3).
//
// Contrairement au Rust (qui refuse à la première erreur), l'éditeur
// COLLECTE les erreurs et rend quand même du mieux possible — le
// designer doit rester manipulable pendant que l'utilisateur corrige.

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
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface UiNode {
  id: string;
  parent?: string;
  type: NodeKind;
  pos?: [number, number]; // racines
  size?: [number, number]; // window/gauge/icon_row/variable_display
  margin?: [number, number]; // window (défaut [1,1])
  gap?: number; // vbox/hbox
  text?: string; // label
  width?: number; // value (1-5) / image (icônes) / icon_value
  var?: number;
  label?: string; // variable_display
  frame?: boolean;
  max?: number;
  max_var?: number;
  icon?: number;
  dir?: string; // gauge : "h" | "v"
  pad?: number; // icon_value : zéros de tête
  align?: string; // value : "left" (défaut : valeur alignée à droite)
  // racines : visible au démarrage (défaut FALSE — les widgets
  // s'affichent via la commande d'event « Afficher un widget UI »)
  visible?: boolean;
}

export interface UiLayout2 {
  message: UiWin;
  choice: UiWin;
  nodes: UiNode[];
}

// Primitive aplatie (ce que le moteur dessine) + le nœud d'origine
export interface Prim {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: number; // 0-6
  frame: boolean;
  var: number;
  icon: number;
  vertical: boolean;
  pad: number;
  max: number;
  maxVar?: number;
  bg: boolean;
  text: string;
  nodeId: string;
}

export interface Flat {
  prims: Prim[];
  // rect absolu de CHAQUE nœud (sélection/hit-test du canvas)
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

// Taille intrinsèque (mêmes règles que size_of côté Rust) — tolérante :
// les tailles manquantes retombent sur un défaut, l'erreur est signalée
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
      return [Math.max(n.width ?? 1, 1), 1];
    case "icon_value":
      return [Math.max(n.width ?? 4, 2), 1];
  }
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

// Aplatit l'arbre — mêmes règles que place() côté Rust
export function flatten(lay: UiLayout2, iconCount: number): Flat {
  const errors: string[] = [];
  const prims: Prim[] = [];
  const rects: Flat["rects"] = {};
  const nodes = lay.nodes;

  const ids = new Set<string>();
  for (const n of nodes) {
    if (!n.id) errors.push("nœud sans id");
    else if (ids.has(n.id)) errors.push(`id « ${n.id} » en double`);
    ids.add(n.id);
    if (n.parent && !nodes.some((k) => k.id === n.parent))
      errors.push(`« ${n.id} » : parent « ${n.parent} » introuvable`);
  }

  const needIcon = (n: UiNode, span: number) => {
    if (n.icon === undefined) errors.push(`« ${n.id} » : icône requise`);
    if (iconCount === 0) errors.push(`« ${n.id} » : demande une planche d'icônes (Thème)`);
    else if ((n.icon ?? 0) + span > iconCount)
      errors.push(`« ${n.id} » : icônes hors planche (${iconCount})`);
  };

  const emit = (p: Prim) => {
    if (p.x < 0 || p.y < 0 || p.x + p.w > SCREEN_W || p.y + p.h > SCREEN_H)
      errors.push(`« ${p.nodeId} » : sort de l'écran 32x28`);
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
        // le flag vertical du type 0 porte l'alignement gauche (uigen idem)
        emit({ x, y, w: size[0], h: 1, kind: 0, frame: false, ...base, vertical: n.align === "left" });
        break;
      case "image":
        needIcon(n, size[0]);
        emit({ x, y, w: size[0], h: 1, kind: 6, frame: false, ...base });
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
    for (const [name, w] of [
      ["message", lay.message],
      ["choice", lay.choice],
    ] as const) {
      if (rectsOverlap(rect, { x: w.pos[0], y: w.pos[1], w: w.size[0], h: w.size[1] }))
        errors.push(`« ${r.id} » : chevauche la fenêtre ${name} (les dialogues l'écraseraient)`);
    }
    rootRects.push(rect);
    place(r, r.pos[0], r.pos[1], false, 0);
  }
  if (prims.length > PRIM_MAX)
    errors.push(`${prims.length} primitives (max ${PRIM_MAX}) — simplifier le layout`);
  return { prims, rects, errors };
}

// ---- lecture / écriture de ui/layout.toml ---------------------------------

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
  };
  const message = raw.message ?? { pos: [0, 20], size: [32, 8] };
  const choice = raw.choice ?? message;
  const nodes: UiNode[] = [...(raw.node ?? [])];
  // migration : les [[overlay]] plats (W1) deviennent des racines feuilles
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
      visible: true, // compat W1 : les overlays plats restent visibles
    });
  });
  return { message: { ...message }, choice: { ...choice }, nodes };
}

export function layoutToToml(l: UiLayout2): string {
  let s = `# Layout UI du projet (designer D1 — docs/SPEC_SYSTEME_UI.md).\n# Positions et tailles EN TILES (unités de 8 px, écran 32x28).\n\n[message]\npos = [${l.message.pos}]\nsize = [${l.message.size}]\n\n[choice]\npos = [${l.choice.pos}]\nsize = [${l.choice.size}]\n`;
  // préordre : racines puis descendants (les parents précèdent toujours)
  const emitNode = (n: UiNode) => {
    s += `\n[[node]]\nid = ${JSON.stringify(n.id)}\n`;
    if (n.parent) s += `parent = ${JSON.stringify(n.parent)}\n`;
    s += `type = ${JSON.stringify(n.type)}\n`;
    if (n.pos) s += `pos = [${n.pos}]\n`;
    if (n.size) s += `size = [${n.size}]\n`;
    if (n.margin) s += `margin = [${n.margin}]\n`;
    if (n.gap !== undefined && n.gap !== 0) s += `gap = ${n.gap}\n`;
    if (n.text !== undefined) s += `text = ${JSON.stringify(n.text)}\n`;
    if (n.width !== undefined) s += `width = ${n.width}\n`;
    if (n.var !== undefined) s += `var = ${n.var}\n`;
    if (n.label) s += `label = ${JSON.stringify(n.label)}\n`;
    if (n.frame !== undefined && n.frame !== (n.type === "variable_display"))
      s += `frame = ${n.frame}\n`;
    if (n.max_var !== undefined) s += `max_var = ${n.max_var}\n`;
    else if (n.max !== undefined) s += `max = ${n.max}\n`;
    if (n.icon !== undefined) s += `icon = ${n.icon}\n`;
    if (n.dir === "v") s += `dir = "v"\n`;
    if (n.pad) s += `pad = ${n.pad}\n`;
    if (n.align === "left") s += `align = "left"\n`;
    if (!n.parent && n.visible) s += `visible = true\n`;
    for (const c of childrenOf(l.nodes, n.id)) emitNode(c);
  };
  for (const r of rootsOf(l.nodes)) emitNode(r);
  return s;
}
