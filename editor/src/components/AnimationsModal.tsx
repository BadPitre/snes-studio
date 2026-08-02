// "Animations" window (Tools >, A1-c/A1-e): a frame-by-frame editor in
// the style of RPG Maker 2003's "Battle Animation". The author composes
// a sequence of frames, choosing for each one the CELLS shown (one per
// LAYER), their POSITION (with the mouse on the canvas) and the SOUND
// played.
//
// The cell sheet is a project VIGNETTE: no second graphics pipeline on
// the engine side, an animation only adds the frame track (see
// docs/PLANNING_SYSTEME_ANIMATIONS.md).
//
// The canvas applies the engine's rule EXACTLY (anim.c):
//   screen anchor -> the cell's corner = (112 + x, 96 + y)
//   hero anchor   -> the cell's corner = (the hero's tile corner + x, y)
// That is what guarantees what you place here is what the game shows.
// Layer order identical to the engine: layer 1 is BEHIND, the following
// ones come in front (their OAM entries have higher priority).

import { useEffect, useRef, useState } from "react";
import type { AnimationDef, AnimCell, AnimFrame } from "../types";
import { ANIM_LAYERS_MAX, animFrameCells } from "../types";
import { loadAssetPng } from "../io";
import AudioPreviewButton, { previewSound } from "./AudioPreview";

// origin of the offsets, in screen pixels (mirrors anim.c)
const SCR_X = 112;
const SCR_Y = 96;
// reference hero tile: its visual centre falls in the middle of the screen
const HERO_X = 120;
const HERO_Y = 104;
const OVERLAP = 8; // SPRITE_Y_OVERLAP — the sprite sticks out above its tile

interface Props {
  root: string;
  animations: AnimationDef[];
  vigNames: string[]; // vignette stems (sheets)
  vigPaths: Record<string, string>; // stem -> assets/ path
  soundNames: string[]; // sound stems
  soundPaths: Record<string, string>; // stem -> assets/ path
  sprites: ImageBitmap | null; // character sheet (the hero's silhouette)
  onOk: (list: AnimationDef[]) => void;
  onClose: () => void;
}

export default function AnimationsModal(props: Props) {
  const [draft, setDraft] = useState<AnimationDef[]>(() =>
    structuredClone(props.animations)
  );
  const [sel, setSel] = useState(0);
  const [fsel, setFsel] = useState(0);
  const [lsel, setLsel] = useState(0);
  const [bmps, setBmps] = useState<Record<string, ImageBitmap>>({});
  const [ref, setRef] = useState<"screen" | "hero">("screen");
  const [playing, setPlaying] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ layer: number; dx: number; dy: number } | null>(null);
  const playRef = useRef<{ i: number; left: number } | null>(null);

  const cur = draft[sel] as AnimationDef | undefined;
  const nl = Math.max(1, Math.min(ANIM_LAYERS_MAX, cur?.layers ?? 1));
  const sheet = cur ? bmps[cur.vignette] : undefined;
  const cells = sheet ? Math.max(1, Math.floor(sheet.width / 32)) : 0;
  const frame = cur?.frames[fsel] as AnimFrame | undefined;
  const posed = frame ? animFrameCells(frame, nl) : [];
  const lay = Math.min(lsel, nl - 1);

  const patch = (p: Partial<AnimationDef>) => {
    if (!cur) return;
    setDraft(draft.map((a, i) => (i === sel ? { ...a, ...p } : a)));
  };
  const patchFrame = (p: Partial<AnimFrame>) => {
    if (!cur) return;
    patch({ frames: cur.frames.map((f, i) => (i === fsel ? { ...f, ...p } : f)) });
  };
  // writes a laid cell — ALWAYS normalises the frame to the multi-layer
  // shape, the inherited shape is never written back
  const patchCell = (l: number, p: Partial<AnimCell>) => {
    if (!frame) return;
    const list = animFrameCells(frame, nl);
    list[l] = { ...list[l], ...p };
    patchFrame({ cells: list, cell: undefined, x: undefined, y: undefined });
  };

  // animation sheets (cached by vignette stem)
  useEffect(() => {
    for (const a of draft) {
      const rel = props.vigPaths[a.vignette];
      if (!a.vignette || bmps[a.vignette] || !rel) continue;
      void loadAssetPng(props.root, rel)
        .then((b) => setBmps((m) => ({ ...m, [a.vignette]: b })))
        .catch(() => {});
    }
  }, [draft, bmps, props.root, props.vigPaths]);

  // ---- playback at the real speed (60 frames per second) ---------------
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

  // any edit during playback stops it (otherwise the playhead fights the
  // author's selection)
  const stopPlay = () => {
    if (playing) setPlaying(false);
  };

  const cellPos = (c: AnimCell, r: "screen" | "hero"): [number, number] =>
    r === "hero" ? [HERO_X + c.x, HERO_Y + c.y] : [SCR_X + c.x, SCR_Y + c.y];

  // ---- canvas ----------------------------------------------------------
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    // background: a dark chequerboard (the animation plays over the game)
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
    // anchor cross
    const [ax, ay] = ref === "hero" ? [HERO_X, HERO_Y] : [SCR_X + 16, SCR_Y + 16];
    ctx.strokeStyle = "rgba(255,210,74,.6)";
    ctx.beginPath();
    ctx.moveTo(ax * 2 - 12, ay * 2 + 0.5);
    ctx.lineTo(ax * 2 + 12, ay * 2 + 0.5);
    ctx.moveTo(ax * 2 + 0.5, ay * 2 - 12);
    ctx.lineTo(ax * 2 + 0.5, ay * 2 + 12);
    ctx.stroke();

    if (!frame) return;
    // layer 1 at the back, the following ones on top — as in the engine
    posed.forEach((c, l) => {
      if (c.cell < 0) return;
      const [cx, cy] = cellPos(c, ref);
      if (sheet && c.cell < cells) {
        ctx.globalAlpha = l === lay ? 1 : 0.55;
        ctx.drawImage(sheet, c.cell * 32, 0, 32, 32, cx * 2, cy * 2, 64, 64);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = l === lay ? "rgba(255,210,74,.9)" : "rgba(255,255,255,.3)";
      ctx.strokeRect(cx * 2 + 0.5, cy * 2 + 0.5, 63, 63);
    });
  }, [cur, frame, posed, sheet, cells, ref, lay, props.sprites]);

  const clamp = (v: number) => Math.max(-128, Math.min(127, v));

  // ---- operations on the list -----------------------------------------
  const addAnim = () => {
    let i = 1;
    while (draft.some((a) => a.name === `animation${i}`)) i++;
    const n: AnimationDef = {
      name: `animation${i}`,
      vignette: props.vigNames[0] ?? "",
      loop: false,
      layers: 1,
      frames: [{ cells: [{ cell: 0, x: 0, y: 0 }], dur: 4 }],
    };
    setDraft([...draft, n]);
    setSel(draft.length);
    setFsel(0);
    setLsel(0);
  };

  const setLayers = (n: number) => {
    if (!cur) return;
    stopPlay();
    // every frame is normalised in one go: an added layer arrives EMPTY
    // everywhere, the author fills it in where they want it
    patch({
      layers: n,
      frames: cur.frames.map((f) => ({
        ...f,
        cells: animFrameCells(f, n),
        cell: undefined,
        x: undefined,
        y: undefined,
      })),
    });
    setLsel(Math.min(lsel, n - 1));
  };

  const addFrame = (dup: boolean) => {
    if (!cur) return;
    stopPlay();
    const base: AnimFrame =
      dup && frame
        ? { cells: animFrameCells(frame, nl), dur: frame.dur, sfx: frame.sfx }
        : {
            cells: frame
              ? animFrameCells(frame, nl).map((c) => ({ ...c, cell: -1 }))
              : Array.from({ length: nl }, () => ({ cell: -1, x: 0, y: 0 })),
            dur: 4,
          };
    if (!dup && base.cells.length) base.cells[0] = { ...base.cells[0], cell: 0 };
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

  // ---- what datagen will refuse (or flag): said HERE, not at build ------
  const problems: string[] = [];
  const warnings: string[] = [];
  if (cur) {
    if (draft.filter((a) => a.name === cur.name).length > 1)
      problems.push(`Le nom « ${cur.name} » est utilisé par une autre animation.`);
    if (!cur.vignette) problems.push("Aucune planche choisie (vignette du projet).");
    else if (!props.vigPaths[cur.vignette])
      problems.push(`La planche « ${cur.vignette} » n'existe plus dans le projet.`);
    if (cur.frames.length === 0) problems.push("Aucune frame — l'animation n'a rien à jouer.");
    if (sheet && cur.frames.some((f) => animFrameCells(f, nl).some((c) => c.cell >= cells)))
      problems.push(`Une cellule pointe au-delà de la planche (${cells} cellule(s)).`);
    const bad = cur.frames.find((f) => f.sfx && !props.soundNames.includes(f.sfx));
    if (bad) problems.push(`Le son « ${bad.sfx} » n'existe plus dans le projet.`);
    if (cur.frames.some((f) => animFrameCells(f, nl).every((c) => c.cell < 0)))
      warnings.push("Une frame n'affiche aucune cellule : l'animation aura un blanc.");
    // VBlank budget: only one cell is transferred per screen frame
    for (let i = 1; i < cur.frames.length; i++) {
      const a = animFrameCells(cur.frames[i - 1], nl);
      const b = animFrameCells(cur.frames[i], nl);
      const changed = b.filter((c, l) => c.cell !== a[l].cell).length;
      if (changed > cur.frames[i].dur)
        warnings.push(
          `Frame ${i + 1} : ${changed} cellules changent pour ${cur.frames[i].dur} image(s) — ` +
            "une cellule s'affichera avec du retard (allonger la durée, ou échelonner les changements)."
        );
    }
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
                    setLsel(0);
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
                  <label title="Cellules affichées EN MÊME TEMPS. Elles viennent toutes de la planche, donc partagent sa palette : un calque ne coûte pas de couleur, seulement un emplacement de sprite (4 en tout, partagés avec les vignettes des scripts).">
                    Calques
                    <select
                      value={nl}
                      onChange={(e) => setLayers(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4].map((n) => (
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
                    title="Glisser une cellule à la souris pour fixer son décalage (au pixel) — cliquer sur une cellule sélectionne son calque. La croix marque le point d'ancrage."
                    onMouseDown={(e) => {
                      if (!frame) return;
                      const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                      const px = Math.floor((e.clientX - r.left) / 2);
                      const py = Math.floor((e.clientY - r.top) / 2);
                      // from the FRONTMOST layer backwards, as on screen:
                      // you grab what you can see
                      for (let l = posed.length - 1; l >= 0; l--) {
                        const c = posed[l];
                        if (c.cell < 0) continue;
                        const [cx, cy] = cellPos(c, ref);
                        if (px < cx || px >= cx + 32 || py < cy || py >= cy + 32) continue;
                        stopPlay();
                        setLsel(l);
                        dragRef.current = { layer: l, dx: px - cx, dy: py - cy };
                        return;
                      }
                    }}
                    onMouseMove={(e) => {
                      const d = dragRef.current;
                      if (!d) return;
                      const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                      const px = Math.floor((e.clientX - r.left) / 2);
                      const py = Math.floor((e.clientY - r.top) / 2);
                      const [ox, oy] = ref === "hero" ? [HERO_X, HERO_Y] : [SCR_X, SCR_Y];
                      patchCell(d.layer, {
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
                        {nl > 1 && (
                          <div className="cmdpick-tabs anim-lay-tabs">
                            {posed.map((c, l) => (
                              <button
                                key={l}
                                className={l === lay ? "active" : ""}
                                title={
                                  l === 0
                                    ? "Calque 1 — le plus en ARRIÈRE"
                                    : `Calque ${l + 1} — devant le calque ${l}`
                                }
                                onClick={() => setLsel(l)}
                              >
                                {l + 1}{c.cell < 0 ? " ·" : ""}
                              </button>
                            ))}
                          </div>
                        )}
                        <label>
                          Cellule {nl > 1 ? `du calque ${lay + 1}` : "de la planche"}
                          <div className="anim-cells">
                            <button
                              className={
                                "anim-cell anim-cell-none" +
                                (posed[lay]?.cell < 0 ? " active" : "")
                              }
                              title="Ce calque n'affiche rien sur cette frame"
                              onClick={() => {
                                stopPlay();
                                patchCell(lay, { cell: -1 });
                              }}
                            >
                              ∅
                            </button>
                            {Array.from({ length: cells }, (_, c) => (
                              <button
                                key={c}
                                className={
                                  "anim-cell" + (c === posed[lay]?.cell ? " active" : "")
                                }
                                title={`Cellule ${c}`}
                                onClick={() => {
                                  stopPlay();
                                  patchCell(lay, { cell: c });
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
                        <label title="Son joué à L'ENTRÉE de cette frame — c'est ce qui cale un impact sur l'image exacte. Un son par frame, quel que soit le nombre de calques.">
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
                              type="number" min={-128} max={127}
                              value={posed[lay]?.x ?? 0}
                              disabled={(posed[lay]?.cell ?? -1) < 0}
                              onChange={(e) => {
                                stopPlay();
                                patchCell(lay, { x: clamp(Number(e.target.value) || 0) });
                              }}
                            />
                          </label>
                          <label>
                            Décalage Y
                            <input
                              type="number" min={-128} max={127}
                              value={posed[lay]?.y ?? 0}
                              disabled={(posed[lay]?.cell ?? -1) < 0}
                              onChange={(e) => {
                                stopPlay();
                                patchCell(lay, { y: clamp(Number(e.target.value) || 0) });
                              }}
                            />
                          </label>
                        </div>
                        <span className="hint">
                          Décalages SIGNÉS (−128 à 127) par rapport au point
                          d'ancrage — la croix jaune. Sur le héros ou sur un
                          event, l'animation le SUIT s'il se déplace.
                          {nl > 1 && " Le calque 1 est au fond, les suivants passent devant."}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* timeline: one column per frame, width ∝ duration */}
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
                  {cur.frames.map((f, i) => {
                    const pc = animFrameCells(f, nl);
                    const shown = pc.filter((c) => c.cell >= 0);
                    return (
                      <div
                        key={i}
                        className={"anim-tl-f" + (i === fsel ? " active" : "")}
                        style={{ width: Math.max(28, Math.min(120, 10 + f.dur * 4)) }}
                        title={
                          `Frame ${i + 1} — ${shown.length} cellule(s) : ` +
                          pc.map((c, l) => `calque ${l + 1} = ${c.cell < 0 ? "rien" : c.cell}`).join(", ") +
                          `, ${f.dur} images${f.sfx ? `, son « ${f.sfx} »` : ""}`
                        }
                        onClick={() => {
                          stopPlay();
                          setFsel(i);
                        }}
                      >
                        <CellThumb sheet={sheet} cell={shown[0]?.cell ?? -1} />
                        <span className="anim-tl-n">
                          {i + 1}
                          {shown.length > 1 ? `×${shown.length}` : ""}
                          {f.sfx ? " ●" : ""}
                        </span>
                      </div>
                    );
                  })}
                  {cur.frames.length === 0 && (
                    <span className="hint">Aucune frame — ＋ pour en ajouter une.</span>
                  )}
                </div>

                {(problems.length > 0 || warnings.length > 0) && (
                  <div className="anim-warn">
                    {problems.map((p, i) => (
                      <div key={`e${i}`}>⚠ {p}</div>
                    ))}
                    {warnings.map((p, i) => (
                      <div key={`w${i}`} className="soft">ℹ {p}</div>
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

// Thumbnail of a cell (32x32 scaled down) — timeline and inspector grid
function CellThumb(props: { sheet: ImageBitmap | undefined; cell: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    if (props.cell >= 0 && props.sheet && props.cell * 32 < props.sheet.width)
      ctx.drawImage(props.sheet, props.cell * 32, 0, 32, 32, 0, 0, 32, 32);
  }, [props.sheet, props.cell]);
  return <canvas ref={ref} width={32} height={32} className="anim-thumb" />;
}
