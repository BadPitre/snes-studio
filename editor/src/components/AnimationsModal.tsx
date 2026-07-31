// Fenêtre « Animations » (Tools →, A1-c) : éditeur image par image façon
// « Battle Animation » de RPG Maker 2003. L'auteur compose une suite de
// frames en choisissant à chaque frame la CELLULE affichée, sa POSITION
// (à la souris sur le canevas) et le SON joué.
//
// La planche de cellules est une VIGNETTE du projet : pas de second
// pipeline graphique côté moteur, l'animation n'ajoute que la piste de
// frames (voir docs/PLANNING_SYSTEME_ANIMATIONS.md).
//
// Le canevas applique EXACTEMENT la règle du moteur (anim.c) :
//   ancrage écran  -> coin de la cellule = (112 + x, 96 + y)
//   ancrage héros  -> coin de la cellule = (coin de tile du héros + x, y)
// C'est ce qui garantit que ce qu'on place ici est ce que le jeu affiche.

import { useEffect, useRef, useState } from "react";
import type { AnimationDef, AnimFrame } from "../types";
import { loadAssetPng } from "../io";
import AudioPreviewButton, { previewSound } from "./AudioPreview";

// origine des décalages, en pixels écran (miroir de anim.c)
const SCR_X = 112;
const SCR_Y = 96;
// tile du héros de référence : son centre visuel tombe au milieu de l'écran
const HERO_X = 120;
const HERO_Y = 104;
const OVERLAP = 8; // SPRITE_Y_OVERLAP — le sprite dépasse au-dessus de sa tile

interface Props {
  root: string;
  animations: AnimationDef[];
  vigNames: string[]; // stems des vignettes (planches)
  vigPaths: Record<string, string>; // stem -> chemin assets/
  soundNames: string[]; // stems des sons
  soundPaths: Record<string, string>; // stem -> chemin assets/
  sprites: ImageBitmap | null; // feuille de personnages (silhouette du héros)
  onOk: (list: AnimationDef[]) => void;
  onClose: () => void;
}

export default function AnimationsModal(props: Props) {
  const [draft, setDraft] = useState<AnimationDef[]>(() =>
    structuredClone(props.animations)
  );
  const [sel, setSel] = useState(0);
  const [fsel, setFsel] = useState(0);
  const [bmps, setBmps] = useState<Record<string, ImageBitmap>>({});
  const [ref, setRef] = useState<"screen" | "hero">("screen");
  const [playing, setPlaying] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const playRef = useRef<{ i: number; left: number } | null>(null);

  const cur = draft[sel] as AnimationDef | undefined;
  const sheet = cur ? bmps[cur.vignette] : undefined;
  const cells = sheet ? Math.max(1, Math.floor(sheet.width / 32)) : 0;
  const frame = cur?.frames[fsel] as AnimFrame | undefined;

  const patch = (p: Partial<AnimationDef>) => {
    if (!cur) return;
    setDraft(draft.map((a, i) => (i === sel ? { ...a, ...p } : a)));
  };
  const patchFrame = (p: Partial<AnimFrame>) => {
    if (!cur) return;
    patch({ frames: cur.frames.map((f, i) => (i === fsel ? { ...f, ...p } : f)) });
  };

  // planches des animations (cache par stem de vignette)
  useEffect(() => {
    for (const a of draft) {
      const rel = props.vigPaths[a.vignette];
      if (!a.vignette || bmps[a.vignette] || !rel) continue;
      void loadAssetPng(props.root, rel)
        .then((b) => setBmps((m) => ({ ...m, [a.vignette]: b })))
        .catch(() => {});
    }
  }, [draft, bmps, props.root, props.vigPaths]);

  // ---- lecture à la vitesse réelle (60 images/seconde) -----------------
  useEffect(() => {
    if (!playing || !cur || cur.frames.length === 0) return;
    playRef.current = { i: 0, left: cur.frames[0].dur };
    setFsel(0);
    const sfx0 = cur.frames[0].sfx;
    if (sfx0 && props.soundPaths[sfx0]) previewSound(props.soundPaths[sfx0], props.root);
    const id = setInterval(() => {
      const st = playRef.current;
      if (!st) return;
      if (--st.left > 0) return;
      st.i++;
      if (st.i >= cur.frames.length) {
        if (!cur.loop) {
          setPlaying(false);
          return;
        }
        st.i = 0;
      }
      const f = cur.frames[st.i];
      st.left = f.dur;
      setFsel(st.i);
      if (f.sfx && props.soundPaths[f.sfx]) previewSound(props.soundPaths[f.sfx], props.root);
    }, 1000 / 60);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, sel]);

  // toute modification pendant la lecture l'arrête (sinon le playhead se
  // bat avec la sélection de l'auteur)
  const stopPlay = () => {
    if (playing) setPlaying(false);
  };

  const cellPos = (f: AnimFrame, r: "screen" | "hero"): [number, number] =>
    r === "hero" ? [HERO_X + f.x, HERO_Y + f.y] : [SCR_X + f.x, SCR_Y + f.y];

  // ---- canevas ---------------------------------------------------------
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    // fond : damier sombre (l'animation passe par-dessus le décor du jeu)
    ctx.fillStyle = "#20222a";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#282b34";
    for (let y = 0; y < 224; y += 16)
      for (let x = 0; x < 256; x += 16)
        if (((x >> 4) + (y >> 4)) & 1) ctx.fillRect(x * 2, y * 2, 32, 32);

    if (ref === "hero") {
      if (props.sprites)
        ctx.drawImage(
          props.sprites, 0, 0, 16, 24,
          HERO_X * 2, (HERO_Y - OVERLAP) * 2, 32, 48
        );
      else {
        ctx.fillStyle = "rgba(255,255,255,.45)";
        ctx.fillRect(HERO_X * 2, (HERO_Y - OVERLAP) * 2, 32, 48);
      }
    }
    // croix d'ancrage
    const [ax, ay] = ref === "hero" ? [HERO_X, HERO_Y] : [SCR_X + 16, SCR_Y + 16];
    ctx.strokeStyle = "rgba(255,210,74,.6)";
    ctx.beginPath();
    ctx.moveTo(ax * 2 - 12, ay * 2 + 0.5);
    ctx.lineTo(ax * 2 + 12, ay * 2 + 0.5);
    ctx.moveTo(ax * 2 + 0.5, ay * 2 - 12);
    ctx.lineTo(ax * 2 + 0.5, ay * 2 + 12);
    ctx.stroke();

    if (!cur || !frame) return;
    const [cx, cy] = cellPos(frame, ref);
    if (sheet && frame.cell < cells)
      ctx.drawImage(sheet, frame.cell * 32, 0, 32, 32, cx * 2, cy * 2, 64, 64);
    ctx.strokeStyle = "rgba(255,210,74,.9)";
    ctx.strokeRect(cx * 2 + 0.5, cy * 2 + 0.5, 63, 63);
  }, [cur, frame, sheet, cells, ref, props.sprites]);

  const clamp = (v: number) => Math.max(-128, Math.min(127, v));

  // ---- opérations sur la liste ----------------------------------------
  const addAnim = () => {
    let i = 1;
    while (draft.some((a) => a.name === `animation${i}`)) i++;
    const n: AnimationDef = {
      name: `animation${i}`,
      vignette: props.vigNames[0] ?? "",
      loop: false,
      frames: [{ cell: 0, x: 0, y: 0, dur: 4 }],
    };
    setDraft([...draft, n]);
    setSel(draft.length);
    setFsel(0);
  };

  const addFrame = (dup: boolean) => {
    if (!cur) return;
    stopPlay();
    const base: AnimFrame = dup && frame
      ? { ...frame }
      : { cell: 0, x: frame?.x ?? 0, y: frame?.y ?? 0, dur: 4 };
    const at = cur.frames.length === 0 ? 0 : fsel + 1;
    const list = [...cur.frames];
    list.splice(at, 0, base);
    patch({ frames: list });
    setFsel(at);
  };

  const moveFrame = (d: -1 | 1) => {
    if (!cur) return;
    const j = fsel + d;
    if (j < 0 || j >= cur.frames.length) return;
    stopPlay();
    const list = [...cur.frames];
    [list[fsel], list[j]] = [list[j], list[fsel]];
    patch({ frames: list });
    setFsel(j);
  };

  // ---- ce que datagen refusera : dit ICI, pas au build -----------------
  const problems: string[] = [];
  if (cur) {
    if (draft.filter((a) => a.name === cur.name).length > 1)
      problems.push(`Le nom « ${cur.name} » est utilisé par une autre animation.`);
    if (!cur.vignette) problems.push("Aucune planche choisie (vignette du projet).");
    else if (!props.vigPaths[cur.vignette])
      problems.push(`La planche « ${cur.vignette} » n'existe plus dans le projet.`);
    if (cur.frames.length === 0) problems.push("Aucune frame — l'animation n'a rien à jouer.");
    if (sheet && cur.frames.some((f) => f.cell >= cells))
      problems.push(`Une frame pointe une cellule au-delà de la planche (${cells} cellule(s)).`);
    const bad = cur.frames.find((f) => f.sfx && !props.soundNames.includes(f.sfx));
    if (bad) problems.push(`Le son « ${bad.sfx} » n'existe plus dans le projet.`);
  }

  const total = cur ? cur.frames.reduce((n, f) => n + f.dur, 0) : 0;

  return (
    <div className="modal-backdrop">
      <div className="modal cevents screens anims" onClick={(e) => e.stopPropagation()}>
        <div className="palette-title">
          Animations
          <button className="modal-x" title="Fermer" onClick={props.onClose}>✕</button>
        </div>
        <div className="cevents-body">
          <div className="cevents-list">
            <div className="evedit-cmds" style={{ flex: 1 }}>
              {draft.map((a, i) => (
                <div
                  key={i}
                  className={"evedit-line" + (i === sel ? " active" : "")}
                  onClick={() => {
                    setSel(i);
                    setFsel(0);
                    setPlaying(false);
                    setRenaming(null);
                  }}
                >
                  ✨ {a.name}
                </div>
              ))}
            </div>
            <div className="row">
              <button
                onClick={addAnim}
                disabled={props.vigNames.length === 0}
                title={
                  props.vigNames.length === 0
                    ? "Aucune vignette dans le projet — importer d'abord une planche de cellules 32x32 (Gestionnaire de ressources)"
                    : "Ajouter une animation"
                }
              >
                ＋
              </button>
              <button
                className="danger"
                disabled={!cur}
                onClick={() => {
                  if (!cur) return;
                  if (!confirm(`Supprimer l'animation « ${cur.name} » ? Les commandes « Jouer une animation » qui l'utilisent seront signalées au build.`))
                    return;
                  setDraft(draft.filter((_, i) => i !== sel));
                  setSel(0);
                  setFsel(0);
                }}
              >
                🗑
              </button>
            </div>
            {cur && renaming === null && (
              <button onClick={() => setRenaming(cur.name)}>Renommer…</button>
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
                      if (v && !draft.some((a) => a.name === v)) patch({ name: v });
                      setRenaming(null);
                    }
                  }}
                />
              </div>
            )}
          </div>

          <div className="cevents-form" style={{ overflow: "auto" }}>
            {!cur ? (
              <span className="hint">
                Aucune animation — ＋ pour en créer une. Une animation joue
                une suite de cellules 32x32 (une planche de vignette) avec
                une position et un son par image : coup d'épée, explosion,
                soin, émoticône animée.
              </span>
            ) : (
              <>
                <div className="row">
                  <label title="La planche de cellules : une vignette du projet, bande horizontale de blocs 32x32 (16 couleurs).">
                    Planche (vignette)
                    <select
                      value={cur.vignette}
                      onChange={(e) => {
                        stopPlay();
                        patch({ vignette: e.target.value });
                      }}
                    >
                      <option value="">(choisir une planche…)</option>
                      {props.vigNames.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label title="Repère affiché derrière la cellule. Ne change QUE l'aperçu : la cible réelle est choisie dans la commande d'event.">
                    Repère
                    <select
                      value={ref}
                      onChange={(e) => setRef(e.target.value as "screen" | "hero")}
                    >
                      <option value="screen">Centre de l'écran</option>
                      <option value="hero">Héros / event</option>
                    </select>
                  </label>
                  <label className="checkline" style={{ alignSelf: "end" }}>
                    <input
                      type="checkbox"
                      checked={!!cur.loop}
                      onChange={(e) => {
                        stopPlay();
                        patch({ loop: e.target.checked });
                      }}
                    />
                    En boucle
                  </label>
                  <button
                    style={{ flex: "0 0 auto", alignSelf: "end" }}
                    disabled={cur.frames.length === 0}
                    onClick={() => setPlaying(!playing)}
                    title="Joue l'animation à la vitesse réelle (60 images/seconde), sons compris"
                  >
                    {playing ? "⏹ Stop" : "▶ Lecture"}
                  </button>
                </div>

                <div className="compo-body">
                  <canvas
                    ref={canvasRef}
                    width={512}
                    height={448}
                    className="compo-canvas"
                    title="Glisser la cellule à la souris pour fixer son décalage (au pixel). La croix marque le point d'ancrage."
                    onMouseDown={(e) => {
                      if (!frame) return;
                      const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                      const px = Math.floor((e.clientX - r.left) / 2);
                      const py = Math.floor((e.clientY - r.top) / 2);
                      const [cx, cy] = cellPos(frame, ref);
                      if (px < cx || px >= cx + 32 || py < cy || py >= cy + 32) return;
                      stopPlay();
                      dragRef.current = { dx: px - cx, dy: py - cy };
                    }}
                    onMouseMove={(e) => {
                      const d = dragRef.current;
                      if (!d || !frame) return;
                      const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                      const px = Math.floor((e.clientX - r.left) / 2);
                      const py = Math.floor((e.clientY - r.top) / 2);
                      const [ox, oy] = ref === "hero" ? [HERO_X, HERO_Y] : [SCR_X, SCR_Y];
                      patchFrame({
                        x: clamp(px - d.dx - ox),
                        y: clamp(py - d.dy - oy),
                      });
                    }}
                    onMouseUp={() => (dragRef.current = null)}
                    onMouseLeave={() => (dragRef.current = null)}
                  />
                  <div className="compo-side">
                    {!frame ? (
                      <span className="hint">Aucune frame — ＋ sous la timeline.</span>
                    ) : (
                      <>
                        <span className="palette-title" style={{ margin: 0 }}>
                          Frame {fsel + 1} / {cur.frames.length}
                        </span>
                        <label>
                          Cellule de la planche
                          <div className="anim-cells">
                            {Array.from({ length: cells }, (_, c) => (
                              <button
                                key={c}
                                className={"anim-cell" + (c === frame.cell ? " active" : "")}
                                title={`Cellule ${c}`}
                                onClick={() => {
                                  stopPlay();
                                  patchFrame({ cell: c });
                                }}
                              >
                                <CellThumb sheet={sheet} cell={c} />
                              </button>
                            ))}
                            {cells === 0 && (
                              <span className="hint">
                                Planche non chargée — choisir une vignette.
                              </span>
                            )}
                          </div>
                        </label>
                        <label title="Durée d'affichage, en images écran (60 par seconde). Les jeux de l'époque tiennent 4 à 10 images par cellule.">
                          Durée (images écran)
                          <input
                            type="number" min={1} max={255} value={frame.dur}
                            onChange={(e) => {
                              stopPlay();
                              patchFrame({
                                dur: Math.max(1, Math.min(255, Number(e.target.value) || 1)),
                              });
                            }}
                          />
                        </label>
                        <label title="Son joué à L'ENTRÉE de cette frame — c'est ce qui cale un impact sur l'image exacte.">
                          Son
                          <div className="row">
                            <select
                              value={frame.sfx ?? ""}
                              onChange={(e) => {
                                stopPlay();
                                patchFrame({ sfx: e.target.value || undefined });
                              }}
                            >
                              <option value="">(aucun)</option>
                              {props.soundNames.map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                            {frame.sfx && props.soundPaths[frame.sfx] && (
                              <AudioPreviewButton
                                path={props.soundPaths[frame.sfx]}
                                root={props.root}
                              />
                            )}
                          </div>
                        </label>
                        <div className="row">
                          <label>
                            Décalage X
                            <input
                              type="number" min={-128} max={127} value={frame.x}
                              onChange={(e) => {
                                stopPlay();
                                patchFrame({ x: clamp(Number(e.target.value) || 0) });
                              }}
                            />
                          </label>
                          <label>
                            Décalage Y
                            <input
                              type="number" min={-128} max={127} value={frame.y}
                              onChange={(e) => {
                                stopPlay();
                                patchFrame({ y: clamp(Number(e.target.value) || 0) });
                              }}
                            />
                          </label>
                        </div>
                        <span className="hint">
                          Décalages SIGNÉS (−128 à 127) par rapport au point
                          d'ancrage — la croix jaune. Sur le héros ou sur un
                          event, l'animation le SUIT s'il se déplace.
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* timeline : une colonne par frame, largeur ∝ durée */}
                <div className="anim-tl-head">
                  <span className="palette-title" style={{ margin: 0 }}>
                    Timeline — {cur.frames.length} frame(s), {total} images
                    {" "}({(total / 60).toFixed(2)} s){cur.loop ? ", en boucle" : ""}
                  </span>
                  <div className="row" style={{ flex: "0 0 auto", gap: 4 }}>
                    <button onClick={() => addFrame(false)} title="Ajouter une frame après la sélection">＋</button>
                    <button onClick={() => addFrame(true)} disabled={!frame} title="Dupliquer la frame">⧉</button>
                    <button onClick={() => moveFrame(-1)} disabled={fsel <= 0} title="Reculer la frame">◀</button>
                    <button
                      onClick={() => moveFrame(1)}
                      disabled={fsel >= cur.frames.length - 1}
                      title="Avancer la frame"
                    >
                      ▶
                    </button>
                    <button
                      className="danger"
                      disabled={!frame}
                      title="Supprimer la frame"
                      onClick={() => {
                        stopPlay();
                        patch({ frames: cur.frames.filter((_, i) => i !== fsel) });
                        setFsel(Math.max(0, fsel - 1));
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
                <div className="anim-tl">
                  {cur.frames.map((f, i) => (
                    <div
                      key={i}
                      className={"anim-tl-f" + (i === fsel ? " active" : "")}
                      style={{ width: Math.max(28, Math.min(120, 10 + f.dur * 4)) }}
                      title={`Frame ${i + 1} — cellule ${f.cell}, ${f.dur} images${f.sfx ? `, son « ${f.sfx} »` : ""}`}
                      onClick={() => {
                        stopPlay();
                        setFsel(i);
                      }}
                    >
                      <CellThumb sheet={sheet} cell={f.cell} />
                      <span className="anim-tl-n">
                        {i + 1}
                        {f.sfx ? " ●" : ""}
                      </span>
                    </div>
                  ))}
                  {cur.frames.length === 0 && (
                    <span className="hint">Aucune frame — ＋ pour en ajouter une.</span>
                  )}
                </div>

                {problems.length > 0 && (
                  <div className="anim-warn">
                    {problems.map((p, i) => (
                      <div key={i}>⚠ {p}</div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={() => props.onOk(draft)}>OK</button>
          <button onClick={props.onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

// Vignette d'une cellule (32x32 réduit) — timeline et grille de l'inspecteur
function CellThumb(props: { sheet: ImageBitmap | undefined; cell: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    if (props.sheet && props.cell * 32 < props.sheet.width)
      ctx.drawImage(props.sheet, props.cell * 32, 0, 32, 32, 0, 0, 32, 32);
  }, [props.sheet, props.cell]);
  return <canvas ref={ref} width={32} height={32} className="anim-thumb" />;
}
