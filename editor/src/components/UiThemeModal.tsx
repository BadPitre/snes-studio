// Fenêtre « UI / Thème » (Tools →, Phase 11 §7 + Phase 12 W1) :
// windowskin et planche d'icônes choisis parmi les RESSOURCES du projet,
// vitesse de la machine à écrire, édition du layout uigen (fenêtres
// message/choix + widgets permanents à placement LIBRE, EN TILES) avec
// la MÊME validation que le compilateur, et une preview temps réel
// fidèle tiles (fonte, windowskin et icônes réels du projet).

import { useEffect, useMemo, useRef, useState } from "react";
import { parse } from "smol-toml";
import type { Project, UiLayout, UiOverlay, UiWin } from "../types";
import { assetStem, defaultUiLayout, overlayFramed } from "../types";
import {
  ensureProjectDir,
  loadAssetPng,
  readProjectText,
  writeProjectText,
} from "../io";

interface Props {
  root: string;
  project: Project;
  windowskins: string[]; // ressources importées (Gestionnaire de ressources)
  iconsets: string[]; // planches d'icônes importées (idem)
  varNames: string[];
  // (ui du projet, layout écrit dans ui/layout.toml par la fenêtre)
  onOk: (ui: Project["ui"]) => void;
  onClose: () => void;
}

const SCREEN_W = 32;
const SCREEN_H = 28;
const OV_MAX = 8;

const CONTENT_LABELS: Record<string, string> = {
  variable_display: "Libellé + valeur",
  gauge: "Jauge (barre)",
  icon_row: "Rangée d'icônes (cœurs)",
  icon_value: "Icône + compteur",
};

export async function loadUiLayout(root: string): Promise<UiLayout> {
  try {
    const raw = parse(await readProjectText(root, "ui/layout.toml")) as Partial<UiLayout>;
    const d = defaultUiLayout();
    return {
      message: (raw.message as UiWin) ?? d.message,
      choice: (raw.choice as UiWin) ?? (raw.message as UiWin) ?? d.choice,
      overlay: (raw.overlay as UiOverlay[]) ?? [],
    };
  } catch {
    return defaultUiLayout();
  }
}

function layoutToToml(l: UiLayout): string {
  let s = `# Layout UI du projet (uigen — docs/SPEC_SYSTEME_UI.md §3 + W1).\n# Positions et tailles EN TILES (unités de 8 px, écran 32x28).\n\n[message]\npos = [${l.message.pos}]\nsize = [${l.message.size}]\n\n[choice]\npos = [${l.choice.pos}]\nsize = [${l.choice.size}]\n`;
  for (const ov of l.overlay) {
    s += `\n[[overlay]]\nid = ${JSON.stringify(ov.id)}\npos = [${ov.pos}]\nsize = [${ov.size}]\ncontent = ${JSON.stringify(ov.content)}\nvar = ${ov.var ?? 0}\n`;
    if (ov.content === "variable_display") s += `label = ${JSON.stringify(ov.label)}\n`;
    if (ov.frame !== undefined && ov.frame !== overlayFramed({ ...ov, frame: undefined }))
      s += `frame = ${ov.frame}\n`;
    if (ov.content === "gauge" || ov.content === "icon_row") {
      if (ov.max_var !== undefined) s += `max_var = ${ov.max_var}\n`;
      else s += `max = ${ov.max ?? 1}\n`;
    }
    if (ov.content !== "variable_display") s += `icon = ${ov.icon ?? 0}\n`;
    if (ov.content === "gauge" && ov.dir === "v") s += `dir = "v"\n`;
    if (ov.content === "icon_value" && (ov.pad ?? 0) > 0) s += `pad = ${ov.pad}\n`;
  }
  return s;
}

// mêmes règles que uigen (ui.rs) — le designer ne peut pas produire
// d'invalide (règle §9.3)
function winError(w: UiWin, minW = 8, minH = 3): string | null {
  const [x, y] = w.pos;
  const [ww, hh] = w.size;
  if (x < 0 || y < 0 || ww < minW || hh < minH || x + ww > SCREEN_W || y + hh > SCREEN_H)
    return `fenêtre invalide (écran 32x28, minimum ${minW}x${minH})`;
  return null;
}

function rectsOverlap(a: { pos: number[]; size: number[] }, b: { pos: number[]; size: number[] }) {
  return !(
    a.pos[0] + a.size[0] <= b.pos[0] ||
    b.pos[0] + b.size[0] <= a.pos[0] ||
    a.pos[1] + a.size[1] <= b.pos[1] ||
    b.pos[1] + b.size[1] <= a.pos[1]
  );
}

function layoutErrors(l: UiLayout, iconCount: number): string[] {
  const errs: string[] = [];
  const em = winError(l.message);
  if (em) errs.push(`message : ${em}`);
  const ec = winError(l.choice);
  if (ec) errs.push(`choice : ${ec}`);
  if (l.overlay.length > OV_MAX) errs.push(`${l.overlay.length} widgets (max ${OV_MAX})`);
  l.overlay.forEach((ov, i) => {
    const f = overlayFramed(ov);
    const [minW, minH] =
      ov.content === "variable_display"
        ? f ? [4, 3] : [3, 1]
        : f ? [3, 3]
          : ov.content === "icon_value" ? [2, 1] : [1, 1];
    const e = winError({ pos: ov.pos, size: ov.size }, minW, minH);
    if (e) errs.push(`« ${ov.id} » : ${e}`);
    const innerW = ov.size[0] - (f ? 2 : 0);
    if (ov.content === "variable_display") {
      if (!/^[ -~]*$/.test(ov.label)) errs.push(`« ${ov.id} » : libellé non-ASCII`);
      if (ov.label.length > innerW - 1)
        errs.push(`« ${ov.id} » : libellé trop long (${innerW - 1} tiles utiles)`);
    } else {
      if (iconCount === 0)
        errs.push(`« ${ov.id} » : les widgets demandent une planche d'icônes (Thème)`);
      const span = ov.content === "icon_value" ? 1 : 3;
      if ((ov.icon ?? 0) + span > iconCount && iconCount > 0)
        errs.push(`« ${ov.id} » : icône ${ov.icon ?? 0} hors planche (${iconCount} icônes)`);
    }
    if (ov.content === "gauge" || ov.content === "icon_row") {
      if (ov.max_var === undefined && !(ov.max && ov.max > 0))
        errs.push(`« ${ov.id} » : max (> 0) ou variable max requis`);
    }
    if (ov.content === "icon_value" && (ov.pad ?? 0) > Math.min(5, innerW - 1))
      errs.push(`« ${ov.id} » : pad trop grand (max ${Math.min(5, innerW - 1)})`);
    for (const prev of l.overlay.slice(0, i)) {
      if (rectsOverlap(ov, prev)) errs.push(`« ${prev.id} » et « ${ov.id} » se chevauchent`);
    }
    // placement libre (W1) — mais jamais sous les fenêtres du dialogue
    if (rectsOverlap(ov, l.message))
      errs.push(`« ${ov.id} » : chevauche la fenêtre message (les dialogues l'écraseraient)`);
    if (rectsOverlap(ov, l.choice))
      errs.push(`« ${ov.id} » : chevauche la fenêtre choice`);
  });
  return errs;
}

export default function UiThemeModal(props: Props) {
  const [ui, setUi] = useState<NonNullable<Project["ui"]>>(() => ({
    ...(props.project.ui ?? {}),
  }));
  const [layout, setLayout] = useState<UiLayout | null>(null);
  const [font, setFont] = useState<ImageBitmap | null>(null);
  const [skin, setSkin] = useState<ImageBitmap | null>(null);
  const [icons, setIcons] = useState<ImageBitmap | null>(null);
  const [selOv, setSelOv] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    void loadUiLayout(props.root).then(setLayout);
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
  const errs = layout ? layoutErrors(layout, iconCount) : [];

  // vignettes de la planche pour le sélecteur d'icônes (une <img> par
  // icône — dessinées une fois, rendu pixelisé)
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

  // ---- preview fidèle tiles (256x224, upscalée en CSS pixelisé) --------
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !layout) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#4a8a4c"; // herbe factice : le jeu derrière l'UI
    ctx.fillRect(0, 0, 256, 224);
    ctx.fillStyle = "#3d7440";
    for (let y = 0; y < 28; y++)
      for (let x = 0; x < 32; x++)
        if ((x + y) % 2) ctx.fillRect(x * 8, y * 8, 8, 8);

    const glyph = (c: string, dx: number, dy: number) => {
      const k = c.charCodeAt(0);
      if (k < 32 || k > 126 || !font) return;
      ctx.drawImage(font, (k - 32) * 8, 0, 8, 8, dx, dy, 8, 8);
    };
    const icon = (n: number, dx: number, dy: number) => {
      if (!icons || n < 0 || n >= iconCount) return;
      ctx.drawImage(icons, n * 8, 0, 8, 8, dx, dy, 8, 8);
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
    const text = (s: string, tx: number, ty: number, max: number) => {
      for (let i = 0; i < s.length && i < max; i++) glyph(s[i], (tx + i) * 8, ty * 8);
    };

    // widgets permanents (placement libre, W1) — valeur d'exemple à 58 %
    for (const ov of layout.overlay) {
      const f = overlayFramed(ov);
      if (f) win(ov.pos[0], ov.pos[1], ov.size[0], ov.size[1]);
      const x0 = ov.pos[0] + (f ? 1 : 0);
      const y0 = ov.pos[1] + (f ? 1 : 0);
      const cw = ov.size[0] - (f ? 2 : 0);
      const ch = ov.size[1] - (f ? 2 : 0);
      if (ov.content === "gauge" || ov.content === "icon_row") {
        const cells = ov.dir === "v" ? ch : cw;
        const fill = Math.floor(cells * 2 * 0.58);
        for (let k = 0; k < cells; k++) {
          const d = Math.max(0, Math.min(2, fill - k * 2));
          const n = (ov.icon ?? 0) + 2 - d;
          if (ov.dir === "v") icon(n, x0 * 8, (y0 + ch - 1 - k) * 8);
          else icon(n, (x0 + k) * 8, y0 * 8);
        }
      } else if (ov.content === "icon_value") {
        icon(ov.icon ?? 0, x0 * 8, y0 * 8);
        const val = String(72).padStart(ov.pad ?? 0, "0");
        text(val, x0 + cw - val.length, y0, 5);
      } else {
        text(ov.label, x0, y0, cw - 1);
        const val = "12";
        text(val, x0 + cw - val.length, y0, 5);
      }
    }
    // fenêtre message avec un texte d'exemple wrappé comme le moteur
    const m = layout.message;
    win(m.pos[0], m.pos[1], m.size[0], m.size[1]);
    const cols = m.size[0] - 4;
    const rows = m.size[1] - 2;
    const words = "Bonjour ! Voici la fenetre de dialogue de ton jeu.".split(" ");
    let line = "", r = 0;
    for (const w of words) {
      if ((line + (line ? " " : "") + w).length > cols) {
        if (r < rows) text(line, m.pos[0] + 2, m.pos[1] + 1 + r, cols);
        r++;
        line = w;
      } else line = line ? line + " " + w : w;
    }
    if (r < rows) text(line, m.pos[0] + 2, m.pos[1] + 1 + r, cols);
    // fenêtre choix si distincte
    const c = layout.choice;
    if (c.pos[0] !== m.pos[0] || c.pos[1] !== m.pos[1]) {
      win(c.pos[0], c.pos[1], c.size[0], c.size[1]);
      text("> Oui", c.pos[0] + 2, c.pos[1] + 1, c.size[0] - 4);
      text("  Non", c.pos[0] + 2, c.pos[1] + 2, c.size[0] - 4);
    }
  }, [layout, font, skin, icons, iconCount]);

  if (!layout) return null;
  const ov: UiOverlay | undefined = layout.overlay[selOv];
  const patchWin = (key: "message" | "choice", i: number, axis: "pos" | "size", v: number) => {
    const w = { ...layout[key], [axis]: [...layout[key][axis]] as [number, number] };
    w[axis][i] = v;
    setLayout({ ...layout, [key]: w });
  };
  const patchOv = (patch: Partial<UiOverlay>) => {
    if (!ov) return;
    Object.assign(ov, patch);
    setLayout({ ...layout });
  };

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal uitheme" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">UI / Thème</div>
        <div className="uitheme-body">
          <div className="uitheme-form">
            <fieldset className="evedit-box">
              <legend>Thème</legend>
              <label>
                Windowskin (ressources du projet)
                <select
                  value={ui.windowskin ?? ""}
                  onChange={(e) =>
                    setUi({ ...ui, windowskin: e.target.value || undefined })
                  }
                >
                  <option value="">(aucun — boîte pleine)</option>
                  {props.windowskins.map((rel) => (
                    <option key={rel} value={rel}>
                      {assetStem(rel)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Planche d'icônes des widgets (IconSet)
                <select
                  value={ui.icons ?? ""}
                  onChange={(e) => setUi({ ...ui, icons: e.target.value || undefined })}
                >
                  <option value="">(aucune)</option>
                  {props.iconsets.map((rel) => (
                    <option key={rel} value={rel}>
                      {assetStem(rel)}
                    </option>
                  ))}
                </select>
              </label>
              <span className="hint">
                Import de nouveaux cadres/icônes : Gestionnaire de ressources
                (catégories WindowSkin et IconSet).
                {iconCount > 0 && ` Planche : ${iconCount} icônes (0-${iconCount - 1}).`}
              </span>
              <label>
                Vitesse du texte (frames/caractère, 0 = instantané)
                <input
                  type="number" min={0} max={10} value={ui.text_speed ?? 0}
                  onChange={(e) =>
                    setUi({ ...ui, text_speed: Number(e.target.value) || undefined })
                  }
                />
              </label>
            </fieldset>
            <fieldset className="evedit-box">
              <legend>Fenêtres (en tiles — écran 32x28)</legend>
              {(["message", "choice"] as const).map((k) => (
                <div className="row" key={k}>
                  <span style={{ width: 70, alignSelf: "flex-end", paddingBottom: 5 }} className="hint">
                    {k}
                  </span>
                  {([0, 1] as const).map((i) => (
                    <label key={"p" + i} className="uitheme-num">
                      {i ? "y" : "x"}
                      <input type="number" value={layout[k].pos[i]}
                        onChange={(e) => patchWin(k, i, "pos", Number(e.target.value))} />
                    </label>
                  ))}
                  {([0, 1] as const).map((i) => (
                    <label key={"s" + i} className="uitheme-num">
                      {i ? "hauteur" : "largeur"}
                      <input type="number" value={layout[k].size[i]}
                        onChange={(e) => patchWin(k, i, "size", Number(e.target.value))} />
                    </label>
                  ))}
                </div>
              ))}
              <span className="hint">Cadre compris (le texte garde une marge de 2 colonnes / 1 rangée).</span>
            </fieldset>
            <fieldset className="evedit-box">
              <legend>Widgets permanents ({layout.overlay.length}/8 — placement libre)</legend>
              <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
                {layout.overlay.map((o, i) => (
                  <button key={i} style={i === selOv ? { background: "#31547a" } : undefined}
                    onClick={() => setSelOv(i)}>
                    {o.id || `hud${i + 1}`}
                  </button>
                ))}
                <button
                  disabled={layout.overlay.length >= OV_MAX}
                  onClick={() => {
                    setLayout({
                      ...layout,
                      overlay: [
                        ...layout.overlay,
                        {
                          id: `hud${layout.overlay.length + 1}`,
                          pos: [1, 0], size: [12, 3],
                          content: "variable_display", var: 0, label: "Compteur",
                        },
                      ],
                    });
                    setSelOv(layout.overlay.length);
                  }}
                >
                  ＋
                </button>
                <button className="danger" disabled={!ov}
                  onClick={() => {
                    setLayout({ ...layout, overlay: layout.overlay.filter((_, i) => i !== selOv) });
                    setSelOv(Math.max(0, selOv - 1));
                  }}>
                  🗑
                </button>
              </div>
              {ov && (
                <>
                  <div className="row">
                    <label>Type
                      <select value={ov.content}
                        onChange={(e) => {
                          const content = e.target.value;
                          const patch: Partial<UiOverlay> = { content };
                          if (content === "gauge" || content === "icon_row") {
                            patch.max = ov.max ?? 10;
                            patch.icon = ov.icon ?? 0;
                            if (content === "icon_row") patch.dir = undefined;
                          }
                          if (content === "icon_value") patch.icon = ov.icon ?? 0;
                          patchOv(patch);
                        }}>
                        {Object.entries(CONTENT_LABELS).map(([v, t]) => (
                          <option key={v} value={v}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label>id
                      <input value={ov.id} onChange={(e) => patchOv({ id: e.target.value })} />
                    </label>
                    <label className="checkline" style={{ alignSelf: "flex-end", paddingBottom: 6 }}>
                      <input type="checkbox" checked={overlayFramed(ov)}
                        onChange={(e) => patchOv({ frame: e.target.checked })} />
                      Cadre
                    </label>
                  </div>
                  <div className="row">
                    <label>Variable
                      <input type="number" min={0} max={255} value={ov.var ?? 0}
                        onChange={(e) => patchOv({ var: Number(e.target.value) })} />
                    </label>
                    {ov.content === "variable_display" && (
                      <label>Libellé
                        <input value={ov.label}
                          onChange={(e) => patchOv({ label: e.target.value })} />
                      </label>
                    )}
                    {(ov.content === "gauge" || ov.content === "icon_row") && (
                      <>
                        <label>Max{ov.max_var !== undefined ? " (ignoré)" : ""}
                          <input type="number" min={1} value={ov.max ?? 1}
                            onChange={(e) => patchOv({ max: Number(e.target.value) })} />
                        </label>
                        <label>Max depuis var (vide = constante)
                          <input type="number" min={0} max={255}
                            value={ov.max_var ?? ""}
                            onChange={(e) =>
                              patchOv({
                                max_var: e.target.value === "" ? undefined : Number(e.target.value),
                              })
                            } />
                        </label>
                      </>
                    )}
                    {ov.content === "gauge" && (
                      <label>Direction
                        <select value={ov.dir ?? "h"}
                          onChange={(e) =>
                            patchOv({ dir: e.target.value === "v" ? "v" : undefined })
                          }>
                          <option value="h">Horizontale</option>
                          <option value="v">Verticale (remplie du bas)</option>
                        </select>
                      </label>
                    )}
                    {ov.content === "icon_value" && (
                      <label>Zéros de tête (pad)
                        <input type="number" min={0} max={5} value={ov.pad ?? 0}
                          onChange={(e) => patchOv({ pad: Number(e.target.value) || undefined })} />
                      </label>
                    )}
                  </div>
                  {ov.content !== "variable_display" && (
                    <>
                      <span className="hint">
                        Icône : {ov.icon ?? 0}
                        {ov.content !== "icon_value" &&
                          ` (+ ${(ov.icon ?? 0) + 1} demie, ${(ov.icon ?? 0) + 2} vide — 3 consécutives)`}
                        {iconCount === 0 && " — choisis d'abord une planche d'icônes (Thème)."}
                      </span>
                      {iconCount > 0 && (
                        <div className="iconpick">
                          {iconUrls.map((u, i) => {
                            const span = ov.content === "icon_value" ? 1 : 3;
                            const sel = i === (ov.icon ?? 0);
                            const inSpan = i > (ov.icon ?? 0) && i < (ov.icon ?? 0) + span;
                            return (
                              <button key={i}
                                className={sel ? "sel" : inSpan ? "sel2" : undefined}
                                title={`icône ${i}`}
                                onClick={() => patchOv({ icon: i })}>
                                <img src={u} alt={`icône ${i}`} />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                  <div className="row">
                    {(["pos", "size"] as const).map((axis) =>
                      ([0, 1] as const).map((i) => (
                        <label key={axis + i} className="uitheme-num">
                          {axis === "pos" ? (i ? "y" : "x") : i ? "hauteur" : "largeur"}
                          <input type="number" value={ov[axis][i]}
                            onChange={(e) => {
                              ov[axis] = [...ov[axis]] as [number, number];
                              ov[axis][i] = Number(e.target.value);
                              setLayout({ ...layout });
                            }} />
                        </label>
                      ))
                    )}
                    <span className="hint" style={{ alignSelf: "flex-end", paddingBottom: 5 }}>
                      {props.varNames[ov.var ?? 0] || ""}
                    </span>
                  </div>
                </>
              )}
            </fieldset>
            {errs.length > 0 && (
              <div className="hint" style={{ color: "#ff7070" }}>
                {errs.map((e, i) => (
                  <div key={i}>⚠ {e}</div>
                ))}
              </div>
            )}
          </div>
          <div className="uitheme-preview">
            <span className="hint">Preview (rendu tiles fidèle)</span>
            <canvas ref={canvasRef} width={256} height={224} />
          </div>
        </div>
        <div className="row">
          <button
            disabled={errs.length > 0}
            title={errs.length ? "Corriger les erreurs de layout d'abord" : undefined}
            onClick={() => {
              void (async () => {
                await ensureProjectDir(props.root, "ui");
                await writeProjectText(props.root, "ui/layout.toml", layoutToToml(layout));
              })();
              props.onOk(
                ui.windowskin || ui.text_speed || ui.icons ? ui : undefined
              );
            }}
          >
            OK
          </button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
