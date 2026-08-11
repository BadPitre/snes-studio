// Tools -> Extraire d'une ROM (X1/X2): a tile viewer over a byte range,
// whose selection lands in a project resource category already validated.
//
// The window owns the interaction only. Decoding lives in rom.ts (pure),
// and what happens after "Envoyer vers" lives in resources.ts — the same
// import flow the resource manager uses, reached through its `src` seam.
// Nothing here writes to project.json.
//
// One thing the layout is built around: an author scanning a ROM spends
// their time on FOUR controls — offset, bpp, width, and the +-1 byte
// nudge — so those sit together on the left and answer to the keyboard.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BPPS,
  type Bpp,
  type Cut,
  type Rgb,
  type Rom,
  type View,
  bppDef,
  compactCut,
  cutPixels,
  decodeView,
  encodeIndexedPng,
  greyPalette,
  hex,
  hexToRgb,
  hiRomAddr,
  loRomAddr,
  loadRom,
  parseOffset,
  readPalette,
  rgbToHex,
  scanPalettes,
  skipBlank,
  usedColors,
  withHeader,
} from "../rom";
import { type Spc, loadSpc } from "../brr";
import RomAudioPanel from "./RomAudioPanel";
import { RESOURCES, type ResKind } from "../resources";
import { loadAssetPalette, pickFile, readBinaryFile } from "../io";
import { assetStem } from "../types";

// Where an extraction can go. CharSet and ChipSet are deliberately absent:
// both expect an RPG Maker 2003 sheet layout (288x256, 480x256), which is
// an authoring convention no SNES ROM stores — offering them would only
// produce a size refusal every time. A ripped decor goes to Tileset, a
// ripped character to Picture or Vignette.
export type RipTarget = ResKind | "tileset";

type Tab = "gfx" | "audio";

interface TargetDef {
  id: RipTarget;
  label: string;
  maxColors: number;
  extra?: (w: number, h: number) => string | null;
}

const TARGETS: TargetDef[] = [
  { id: "picture", label: "Image (Picture)", maxColors: 16 },
  {
    id: "tileset",
    label: "Tileset (grille 16×16)",
    maxColors: 16,
    extra: (w, h) =>
      w % 16 !== 0 || h % 16 !== 0 || w === 0 || h === 0
        ? `Tileset : dimensions multiples de 16 attendues, sélection ${w}×${h}`
        : null,
  },
  { id: "iconset", label: "Planche d'icônes", maxColors: 16 },
  { id: "vignette", label: "Vignette", maxColors: 16 },
  { id: "font", label: "Fonte", maxColors: 4 },
  { id: "windowskin", label: "Windowskin", maxColors: 4 },
  { id: "mode7", label: "Image zoomable (Mode 7)", maxColors: 256 },
];

// Why this target cannot take the current selection — or null when it can.
// The size rules are NOT restated here: they are read from the resource
// descriptors, so the window and the import can never disagree.
function refusal(t: TargetDef, w: number, h: number, colors: number): string | null {
  if (w === 0 || h === 0) return "Aucune sélection";
  if (t.extra) {
    const e = t.extra(w, h);
    if (e) return e;
  }
  if (t.id !== "tileset") {
    const e = RESOURCES[t.id].badSize?.({ width: w, height: h });
    if (e) return e;
  }
  if (colors > t.maxColors)
    return `${t.label} : ${t.maxColors} couleurs max, la sélection en compte ${colors}`;
  return null;
}

interface Props {
  root: string;
  // Project PNGs, to borrow a palette the project already uses.
  assetPngs: string[];
  onSend: (
    target: RipTarget,
    name: string,
    bytes: Uint8Array,
    trans: boolean
  ) => void;
  // A ripped sample: already a WAV, which the sound register takes as is.
  onSendSound: (name: string, wav: Uint8Array) => void;
  // A transcribed song: already an .it, which the music register takes.
  onSendMusic: (name: string, it: Uint8Array) => void;
  setStatus: (s: string) => void;
  onClose: () => void;
}

const ZOOMS = [1, 2, 3, 4, 6, 8];

export default function RomRipModal(p: Props) {
  const [rom, setRom] = useState<Rom | null>(null);
  const [spc, setSpc] = useState<Spc | null>(null);
  const [tab, setTab] = useState<Tab>("gfx");
  const [offset, setOffset] = useState(0);
  const [bpp, setBpp] = useState<Bpp>("4bpp");
  const [widthTiles, setWidthTiles] = useState(16);
  const [rowsTiles, setRowsTiles] = useState(24);
  const [blocks16, setBlocks16] = useState(false);
  const [grid, setGrid] = useState(false);
  const [zoom, setZoom] = useState(3);

  const [palette, setPalette] = useState<Rgb[]>(() => greyPalette(16));
  const [palOff, setPalOff] = useState(0);
  const [palSel, setPalSel] = useState(0);
  const [transIndex, setTransIndex] = useState(-1);
  const [hits, setHits] = useState<number[] | null>(null);
  const [hitIdx, setHitIdx] = useState(0);

  const [cut, setCut] = useState<Cut | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<RipTarget>("picture");
  const [name, setName] = useState("");
  const [jump, setJump] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef<HTMLCanvasElement | null>(null);

  const def = bppDef(bpp);
  const rowBytes = widthTiles * def.bytes;
  // 16x16 blocks consume tiles four at a time, so an odd width would drop
  // a column on every row.
  const effWidth = blocks16 ? Math.max(2, widthTiles & ~1) : widthTiles;

  const view: View | null = useMemo(
    () =>
      rom
        ? decodeView(rom, { offset, bpp, widthTiles: effWidth, rowsTiles, blocks16 })
        : null,
    [rom, offset, bpp, effWidth, rowsTiles, blocks16]
  );

  // The palette must always be at least as long as the format can address,
  // otherwise a 4bpp pixel of index 12 has no colour to draw with.
  useEffect(() => {
    setPalette((cur) =>
      cur.length >= def.colors ? cur : [...cur, ...greyPalette(def.colors).slice(cur.length)]
    );
    setPalSel((s) => Math.min(s, def.colors - 1));
    setTransIndex((t) => (t >= def.colors ? -1 : t));
  }, [def.colors]);

  // ---- drawing -------------------------------------------------------

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !view) return;
    if (!bufRef.current) bufRef.current = document.createElement("canvas");
    const buf = bufRef.current;
    buf.width = view.w;
    buf.height = view.h;
    const bctx = buf.getContext("2d")!;
    const img = bctx.createImageData(view.w, view.h);
    const d = img.data;
    for (let i = 0; i < view.px.length; i++) {
      const c = palette[view.px[i]] ?? [0, 0, 0];
      const o = i * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
    bctx.putImageData(img, 0, 0);

    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(buf, 0, 0, view.w * zoom, view.h * zoom);

    if (grid && zoom >= 2) {
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1;
      const step = (blocks16 ? 16 : 8) * zoom;
      ctx.beginPath();
      for (let x = step; x < view.w * zoom; x += step) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, view.h * zoom);
      }
      for (let y = step; y < view.h * zoom; y += step) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(view.w * zoom, y + 0.5);
      }
      ctx.stroke();
    }
    if (cut) {
      const s = 8 * zoom;
      ctx.strokeStyle = "#ff3b3b";
      ctx.lineWidth = 2;
      ctx.strokeRect(cut.x * s + 1, cut.y * s + 1, cut.w * s - 2, cut.h * s - 2);
    }
  }, [view, palette, zoom, grid, cut, blocks16]);

  // ---- navigation ----------------------------------------------------

  const maxOff = rom ? Math.max(0, rom.bytes.length - 1) : 0;
  const move = (delta: number) =>
    setOffset((o) => Math.max(0, Math.min(maxOff, o + delta)));

  // An .spc is accepted alongside a ROM: it is not a cart, but its 64 KB
  // of ARAM is a byte range like any other — and the best audio source
  // there is, because the DSP registers point at a real sample directory.
  async function openRom() {
    const file = await pickFile(
      "Ouvrir une ROM (SFC / SMC) ou un instantané SPC",
      "ROM SNES / SPC",
      ["sfc", "smc", "fig", "swc", "spc", "bin", "rom"]
    );
    if (!file) return;
    try {
      const bytes = await readBinaryFile(file);
      const base = file.split(/[\\/]/).pop() ?? "rom";
      const snap = loadSpc(bytes);
      const r = snap ? loadRom(base, snap.aram) : loadRom(base, bytes);
      setRom(r);
      setSpc(snap);
      setTab(snap ? "audio" : "gfx");
      setOffset(0);
      setCut(null);
      setHits(null);
      setName(base.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9_]/g, "_"));
      p.setStatus(
        snap
          ? `SPC ouvert : ${base} — 64 Ko d'ARAM${snap.game ? `, ${snap.game}` : ""}`
          : `ROM ouverte : ${base} — ${(bytes.length / 1024) | 0} Ko${
              r.header ? ", en-tête copieur de 512 o détecté" : ""
            }`
      );
    } catch (e) {
      p.setStatus(`Ouverture : ${e}`);
    }
  }

  // ---- palette -------------------------------------------------------

  function paletteFromRom(off: number) {
    if (!rom) return;
    setPalOff(off);
    setPalette(readPalette(rom, off, def.colors));
  }

  function runScan() {
    if (!rom) return;
    const h = scanPalettes(rom);
    setHits(h);
    setHitIdx(0);
    if (h.length) paletteFromRom(h[0]);
    p.setStatus(
      h.length
        ? `Palettes : ${h.length} candidate(s) — parcourir avec ◀ ▶`
        : "Palettes : aucune candidate (le jeu les compresse peut-être)"
    );
  }

  function gotoHit(i: number) {
    if (!hits || !hits.length) return;
    const k = (i + hits.length) % hits.length;
    setHitIdx(k);
    paletteFromRom(hits[k]);
  }

  async function paletteFromAsset(rel: string) {
    if (!rel) return;
    try {
      const cols = await loadAssetPalette(p.root, rel);
      const rgb = cols.map(hexToRgb);
      setPalette([...rgb, ...greyPalette(def.colors).slice(rgb.length)].slice(0, Math.max(def.colors, rgb.length)));
      p.setStatus(`Palette reprise de ${assetStem(rel)} (${rgb.length} couleurs)`);
    } catch (e) {
      p.setStatus(`Palette depuis un asset : ${e}`);
    }
  }

  function setSwatch(i: number, hexColor: string) {
    setPalette((cur) => cur.map((c, k) => (k === i ? hexToRgb(hexColor) : c)));
  }

  // ---- selection -----------------------------------------------------

  const tileAt = (e: React.MouseEvent): { x: number; y: number } | null => {
    const cv = canvasRef.current;
    if (!cv || !view) return null;
    const b = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - b.left) / (8 * zoom));
    const y = Math.floor((e.clientY - b.top) / (8 * zoom));
    if (x < 0 || y < 0 || x >= effWidth || y >= rowsTiles) return null;
    return { x, y };
  };

  const rectOf = (a: { x: number; y: number }, b: { x: number; y: number }): Cut => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x) + 1,
    h: Math.abs(a.y - b.y) + 1,
  });

  // ---- what the selection holds --------------------------------------

  const sel = useMemo(() => {
    if (!view || !cut) return null;
    const px = cutPixels(view, cut);
    const used = usedColors(px.px);
    if (transIndex >= 0) used.delete(transIndex);
    return { ...px, colors: used.size };
  }, [view, cut, transIndex]);

  const targetDef = TARGETS.find((t) => t.id === target)!;
  const why = sel ? refusal(targetDef, sel.w, sel.h, sel.colors) : "Aucune sélection";

  function send() {
    if (!view || !cut || !sel || why) return;
    const raw = cutPixels(view, cut);
    const c = compactCut(raw.px, palette, transIndex);
    const bytes = encodeIndexedPng(raw.w, raw.h, c.px, c.palette, c.transIndex);
    const stem = (name || "rip").toLowerCase().replace(/[^a-z0-9_]/g, "_");
    p.onSend(target, `${stem}.png`, bytes, transIndex >= 0);
  }

  // ---- render --------------------------------------------------------

  const swatches = palette.slice(0, def.colors);

  return (
    <div className="modal-backdrop" onClick={p.onClose}>
      <div className="modal romrip" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Extraire d'une ROM</div>

        <div className="row romrip-head">
          <button onClick={() => void openRom()}>📂 Ouvrir une ROM…</button>
          {rom ? (
            <>
              <span className="hint">
                {rom.name} — {(rom.raw.length / 1024) | 0} Ko{spc ? " d'ARAM" : ""}
              </span>
              {!spc && (
                <>
                  <label className="hint" title="512 octets collés devant certains dumps">
                    <input
                      type="checkbox"
                      checked={rom.header > 0}
                      onChange={(e) => setRom(withHeader(rom, e.target.checked ? 512 : 0))}
                    />
                    en-tête copieur
                  </label>
                  <span className="hint">
                    LoROM {loRomAddr(offset)} · HiROM {hiRomAddr(offset)}
                  </span>
                </>
              )}
              <span className="romrip-tabs">
                <button
                  className={tab === "gfx" ? "sel" : ""}
                  onClick={() => setTab("gfx")}
                >
                  Graphismes
                </button>
                <button
                  className={tab === "audio" ? "sel" : ""}
                  onClick={() => setTab("audio")}
                >
                  Sons
                </button>
              </span>
            </>
          ) : (
            <span className="hint">
              Aucun fichier. Le fichier n'est jamais copié dans le projet : c'est une
              source, pas une ressource.
            </span>
          )}
        </div>

        {!rom ? (
          <div className="hint romrip-empty">
            Un visualiseur de tuiles : on fait défiler l'offset jusqu'à voir apparaître
            des pixels, on corrige le format, on donne une palette, puis on sélectionne
            au rectangle. La plupart des jeux commerciaux compressent leurs graphismes —
            ce qui reste brut, ce sont surtout les fontes, les cadres de menu, les jeux
            de 1990-92 et les homebrews. Les sons, eux, se trouvent presque à coup
            sûr : un échantillon BRR se décrit lui-même.
          </div>
        ) : tab === "audio" ? (
          <RomAudioPanel
            bytes={rom.bytes}
            spc={spc}
            stem={name || "rip"}
            onSend={p.onSendSound}
            onSendMusic={p.onSendMusic}
            setStatus={p.setStatus}
          />
        ) : (
          <div className="romrip-body">
            {/* ---- format ------------------------------------------- */}
            <div className="romrip-col">
              <div className="panel-title">Format</div>
              <label className="hint">
                Codage
                <select value={bpp} onChange={(e) => setBpp(e.target.value as Bpp)}>
                  {BPPS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hint">
                Largeur (tuiles)
                <input
                  type="number"
                  min={1}
                  max={64}
                  value={widthTiles}
                  onChange={(e) =>
                    setWidthTiles(Math.max(1, Math.min(64, +e.target.value || 1)))
                  }
                />
              </label>
              <label className="hint">
                Lignes visibles
                <input
                  type="number"
                  min={1}
                  max={64}
                  value={rowsTiles}
                  onChange={(e) =>
                    setRowsTiles(Math.max(1, Math.min(64, +e.target.value || 1)))
                  }
                />
              </label>
              <label
                className="hint"
                title="Les sprites SNES sont rangés par groupes de 2x2 tuiles : sans ça, chaque personnage apparaît écartelé"
              >
                <input
                  type="checkbox"
                  checked={blocks16}
                  onChange={(e) => setBlocks16(e.target.checked)}
                />
                blocs 16×16 (sprites)
              </label>
              <label className="hint">
                <input
                  type="checkbox"
                  checked={grid}
                  onChange={(e) => setGrid(e.target.checked)}
                />
                grille
              </label>
              <label className="hint">
                Zoom
                <select value={zoom} onChange={(e) => setZoom(+e.target.value)}>
                  {ZOOMS.map((z) => (
                    <option key={z} value={z}>
                      ×{z}
                    </option>
                  ))}
                </select>
              </label>

              <div className="panel-title">Offset</div>
              <div className="hint romrip-off">${hex(offset, 6)}</div>
              <div className="row romrip-nav">
                <button title="Page précédente" onClick={() => move(-rowBytes * rowsTiles)}>
                  ◀◀
                </button>
                <button title="Ligne précédente" onClick={() => move(-rowBytes)}>
                  ◀
                </button>
                <button title="Ligne suivante" onClick={() => move(rowBytes)}>
                  ▶
                </button>
                <button title="Page suivante" onClick={() => move(rowBytes * rowsTiles)}>
                  ▶▶
                </button>
              </div>
              <div className="row romrip-nav">
                <button
                  title="Reculer d'un octet — un décalage de 1 suffit à brouiller toute l'image"
                  onClick={() => move(-1)}
                >
                  −1 o
                </button>
                <button title="Avancer d'un octet" onClick={() => move(1)}>
                  +1 o
                </button>
              </div>
              <div className="row romrip-nav">
                <button
                  title="Sauter la prochaine zone non uniforme — une ROM est surtout du remplissage"
                  onClick={() => rom && setOffset(skipBlank(rom, offset, rowBytes))}
                >
                  ⏭ zone suivante
                </button>
              </div>
              <div className="row">
                <input
                  className="romrip-jump"
                  placeholder="1A8000 ou C2:8000"
                  value={jump}
                  onChange={(e) => setJump(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const o = parseOffset(jump);
                    if (o === null) p.setStatus("Offset : hexadécimal, ou banque:adresse LoROM");
                    else setOffset(Math.max(0, Math.min(maxOff, o)));
                  }}
                />
                <button
                  onClick={() => {
                    const o = parseOffset(jump);
                    if (o === null) p.setStatus("Offset : hexadécimal, ou banque:adresse LoROM");
                    else setOffset(Math.max(0, Math.min(maxOff, o)));
                  }}
                >
                  Aller
                </button>
              </div>
            </div>

            {/* ---- the view ----------------------------------------- */}
            <div className="romrip-view">
              <canvas
                ref={canvasRef}
                width={(view?.w ?? 0) * zoom}
                height={(view?.h ?? 0) * zoom}
                style={{ cursor: "crosshair" }}
                onWheel={(e) => move(e.deltaY > 0 ? rowBytes : -rowBytes)}
                onMouseDown={(e) => {
                  const t = tileAt(e);
                  if (!t) return;
                  setDrag(t);
                  setCut({ x: t.x, y: t.y, w: 1, h: 1 });
                }}
                onMouseMove={(e) => {
                  if (!drag) return;
                  const t = tileAt(e);
                  if (t) setCut(rectOf(drag, t));
                }}
                onMouseUp={() => setDrag(null)}
                onMouseLeave={() => setDrag(null)}
              />
            </div>

            {/* ---- palette + selection ------------------------------ */}
            <div className="romrip-col">
              <div className="panel-title">Palette</div>
              <div className="row romrip-nav">
                <button onClick={() => setPalette(greyPalette(def.colors))}>Gris</button>
                <button onClick={() => paletteFromRom(offset)} title="Lire la palette ici">
                  Ici
                </button>
                <button onClick={runScan} title="Chercher des palettes plausibles">
                  Scanner
                </button>
              </div>
              <div className="row romrip-nav">
                <button onClick={() => paletteFromRom(Math.max(0, palOff - 2))}>◀ 2 o</button>
                <span className="hint">${hex(palOff, 6)}</span>
                <button onClick={() => paletteFromRom(palOff + 2)}>2 o ▶</button>
              </div>
              {hits && hits.length > 0 && (
                <div className="row romrip-nav">
                  <button onClick={() => gotoHit(hitIdx - 1)}>◀</button>
                  <span className="hint">
                    candidate {hitIdx + 1}/{hits.length}
                  </span>
                  <button onClick={() => gotoHit(hitIdx + 1)}>▶</button>
                </div>
              )}
              <select
                defaultValue=""
                onChange={(e) => void paletteFromAsset(e.target.value)}
                title="Reprendre la palette d'une image déjà dans le projet"
              >
                <option value="">Depuis un asset…</option>
                {p.assetPngs.map((rel) => (
                  <option key={rel} value={rel}>
                    {assetStem(rel)}
                  </option>
                ))}
              </select>

              <div className="romrip-swatches">
                {swatches.map((c, i) => (
                  <button
                    key={i}
                    className={`romrip-sw${i === palSel ? " sel" : ""}${
                      i === transIndex ? " trans" : ""
                    }`}
                    style={{ background: rgbToHex(c) }}
                    title={`index ${i}${i === transIndex ? " — transparent" : ""}`}
                    onClick={() => setPalSel(i)}
                  />
                ))}
              </div>
              <div className="row">
                <input
                  type="color"
                  value={rgbToHex(swatches[palSel] ?? [0, 0, 0])}
                  onChange={(e) => setSwatch(palSel, e.target.value)}
                  title={`Couleur de l'index ${palSel}`}
                />
                <button
                  onClick={() => setTransIndex((t) => (t === palSel ? -1 : palSel))}
                  title="L'index transparent devient l'index 0 à l'export (convention fonte/windowskin)"
                >
                  {transIndex === palSel ? "✓ transparent" : "Transparent"}
                </button>
              </div>

              <div className="panel-title">Sélection</div>
              {sel ? (
                <div className="hint">
                  {cut!.w}×{cut!.h} tuiles — {sel.w}×{sel.h} px, {sel.colors} couleur(s)
                  {transIndex >= 0 ? " + transparente" : ""}
                </div>
              ) : (
                <div className="hint">Glisser un rectangle dans la vue.</div>
              )}
              <select value={target} onChange={(e) => setTarget(e.target.value as RipTarget)}>
                {TARGETS.map((t) => {
                  const r = sel ? refusal(t, sel.w, sel.h, sel.colors) : null;
                  return (
                    <option key={t.id} value={t.id}>
                      {t.label}
                      {r ? " — ✕" : ""}
                    </option>
                  );
                })}
              </select>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="nom du fichier"
              />
              {why && <div className="hint romrip-why">{why}</div>}
              <button disabled={!!why} onClick={send}>
                ⬇ Envoyer vers {targetDef.label}
              </button>
            </div>
          </div>
        )}

        <div className="row">
          <button onClick={p.onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
