// Fenêtre « UI / Thème » (Tools →, Phase 11 — docs/SPEC_SYSTEME_UI.md §7) :
// import du windowskin (PNG 24x24 validé), vitesse de la machine à
// écrire, édition du layout uigen (fenêtres message/choix + overlays,
// EN TILES) avec la MÊME validation que le compilateur, et une preview
// temps réel fidèle tiles (fonte et windowskin réels du projet).

import { useEffect, useRef, useState } from "react";
import { parse } from "smol-toml";
import type { Project, UiLayout, UiOverlay, UiWin } from "../types";
import { defaultUiLayout } from "../types";
import {
  ensureProjectDir,
  loadAssetPng,
  pickPngFile,
  readBinaryFile,
  readProjectText,
  writeBinaryFile,
  writeProjectText,
} from "../io";

interface Props {
  root: string;
  project: Project;
  varNames: string[];
  // (ui du projet, layout écrit dans ui/layout.toml par la fenêtre)
  onOk: (ui: Project["ui"]) => void;
  onClose: () => void;
}

const SCREEN_W = 32;
const SCREEN_H = 28;
const OV_ROWS = 4;
const OV_MAX = 8;

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
  let s = `# Layout UI du projet (uigen v1 — docs/SPEC_SYSTEME_UI.md §3).\n# Positions et tailles EN TILES (unités de 8 px, écran 32x28).\n\n[message]\npos = [${l.message.pos}]\nsize = [${l.message.size}]\n\n[choice]\npos = [${l.choice.pos}]\nsize = [${l.choice.size}]\n`;
  for (const ov of l.overlay) {
    s += `\n[[overlay]]\nid = ${JSON.stringify(ov.id)}\npos = [${ov.pos}]\nsize = [${ov.size}]\ncontent = ${JSON.stringify(ov.content)}\nvar = ${ov.var ?? 0}\nlabel = ${JSON.stringify(ov.label)}\n`;
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

function layoutErrors(l: UiLayout): string[] {
  const errs: string[] = [];
  const em = winError(l.message);
  if (em) errs.push(`message : ${em}`);
  const ec = winError(l.choice);
  if (ec) errs.push(`choice : ${ec}`);
  if (l.overlay.length > OV_MAX) errs.push(`${l.overlay.length} overlays (max ${OV_MAX})`);
  l.overlay.forEach((ov, i) => {
    const e = winError({ pos: ov.pos, size: ov.size }, 4, 3);
    if (e) errs.push(`overlay « ${ov.id} » : ${e}`);
    if (ov.pos[1] + ov.size[1] > OV_ROWS)
      errs.push(`overlay « ${ov.id} » : hors zone HUD (rangées 0-${OV_ROWS - 1})`);
    if (!/^[ -~]*$/.test(ov.label)) errs.push(`overlay « ${ov.id} » : label non-ASCII`);
    if (ov.label.length > ov.size[0] - 2)
      errs.push(`overlay « ${ov.id} » : label trop long (${ov.size[0] - 2} tiles utiles)`);
    for (const prev of l.overlay.slice(0, i)) {
      const sep =
        ov.pos[0] + ov.size[0] <= prev.pos[0] ||
        prev.pos[0] + prev.size[0] <= ov.pos[0] ||
        ov.pos[1] + ov.size[1] <= prev.pos[1] ||
        prev.pos[1] + prev.size[1] <= ov.pos[1];
      if (!sep) errs.push(`overlays « ${prev.id} » et « ${ov.id} » se chevauchent`);
    }
  });
  if (l.overlay.length) {
    if (l.message.pos[1] < OV_ROWS) errs.push("message : mord sur la zone HUD (rangées 0-3)");
    if (l.choice.pos[1] < OV_ROWS) errs.push("choice : mord sur la zone HUD (rangées 0-3)");
  }
  return errs;
}

export default function UiThemeModal(props: Props) {
  const [ui, setUi] = useState<NonNullable<Project["ui"]>>(() => ({
    ...(props.project.ui ?? {}),
  }));
  const [layout, setLayout] = useState<UiLayout | null>(null);
  const [font, setFont] = useState<ImageBitmap | null>(null);
  const [skin, setSkin] = useState<ImageBitmap | null>(null);
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

  const errs = layout ? layoutErrors(layout) : [];

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

    // overlays (HUD)
    for (const ov of layout.overlay) {
      win(ov.pos[0], ov.pos[1], ov.size[0], ov.size[1]);
      text(ov.label, ov.pos[0] + 1, ov.pos[1] + 1, ov.size[0] - 2);
      const val = "12";
      text(val, ov.pos[0] + ov.size[0] - 1 - val.length, ov.pos[1] + 1, 5);
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
  }, [layout, font, skin]);

  // ---- import du windowskin (validation 24x24, copie dans assets/) ----
  async function importSkin() {
    const file = await pickPngFile("Importer un windowskin (PNG 24x24, 9-slice)");
    if (!file) return;
    const bytes = await readBinaryFile(file);
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart]));
    if (bmp.width !== 24 || bmp.height !== 24) {
      alert(`Windowskin : attendu 24x24 (9 tiles 8x8), reçu ${bmp.width}x${bmp.height}`);
      return;
    }
    const name = file.split(/[\\/]/).pop()!;
    await writeBinaryFile(`${props.root}/assets/${name}`, bytes);
    setUi({ ...ui, windowskin: `assets/${name}` });
  }

  if (!layout) return null;
  const ov: UiOverlay | undefined = layout.overlay[selOv];
  const patchWin = (key: "message" | "choice", i: number, axis: "pos" | "size", v: number) => {
    const w = { ...layout[key], [axis]: [...layout[key][axis]] as [number, number] };
    w[axis][i] = v;
    setLayout({ ...layout, [key]: w });
  };

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal uitheme" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">UI / Thème</div>
        <div className="uitheme-body">
          <div className="uitheme-form">
            <fieldset className="evedit-box">
              <legend>Thème</legend>
              <div className="row">
                <button onClick={() => void importSkin()}>
                  Importer un windowskin… (24x24)
                </button>
                {ui.windowskin && (
                  <button
                    className="danger"
                    title="Revenir à la boîte pleine historique"
                    onClick={() => setUi({ ...ui, windowskin: undefined })}
                  >
                    ✕
                  </button>
                )}
              </div>
              <span className="hint">
                {ui.windowskin
                  ? `Windowskin : ${ui.windowskin} (palette de la fonte : 0 transparent, 1 fond, 2 bord, 3 accent)`
                  : "Pas de windowskin — boîte pleine historique."}
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
                  <span style={{ width: 70 }} className="hint">{k}</span>
                  {([0, 1] as const).map((i) => (
                    <input key={"p" + i} type="number" title={i ? "y" : "x"}
                      value={layout[k].pos[i]}
                      onChange={(e) => patchWin(k, i, "pos", Number(e.target.value))} />
                  ))}
                  {([0, 1] as const).map((i) => (
                    <input key={"s" + i} type="number" title={i ? "hauteur" : "largeur"}
                      value={layout[k].size[i]}
                      onChange={(e) => patchWin(k, i, "size", Number(e.target.value))} />
                  ))}
                </div>
              ))}
              <span className="hint">x, y, largeur, hauteur — cadre compris (texte : marge de 2/1).</span>
            </fieldset>
            <fieldset className="evedit-box">
              <legend>HUD permanent (4 rangées du haut, {layout.overlay.length}/8)</legend>
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
                    <label>id
                      <input value={ov.id} onChange={(e) => {
                        ov.id = e.target.value;
                        setLayout({ ...layout });
                      }} />
                    </label>
                    <label>Libellé
                      <input value={ov.label} onChange={(e) => {
                        ov.label = e.target.value;
                        setLayout({ ...layout });
                      }} />
                    </label>
                    <label>Variable
                      <input type="number" min={0} max={255} value={ov.var ?? 0}
                        onChange={(e) => {
                          ov.var = Number(e.target.value);
                          setLayout({ ...layout });
                        }} />
                    </label>
                  </div>
                  <div className="row">
                    {(["pos", "size"] as const).map((axis) =>
                      ([0, 1] as const).map((i) => (
                        <input key={axis + i} type="number"
                          title={axis === "pos" ? (i ? "y" : "x") : i ? "hauteur" : "largeur"}
                          value={ov[axis][i]}
                          onChange={(e) => {
                            ov[axis] = [...ov[axis]] as [number, number];
                            ov[axis][i] = Number(e.target.value);
                            setLayout({ ...layout });
                          }} />
                      ))
                    )}
                    <span className="hint">{props.varNames[ov.var ?? 0] || ""}</span>
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
                ui.windowskin || ui.text_speed ? ui : undefined
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
