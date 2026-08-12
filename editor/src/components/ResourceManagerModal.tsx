// RPG Maker 2003 style resource manager: categories on the left, the
// resource list in the middle, actions on the right (Import / Export /
// Rename / Delete) plus a preview.
//
// Seven of the nine categories are ordinary project registers and go
// through the descriptors of resources.ts — the window only says which
// list to show and hands the action back as (kind, act). CharSet (blocks
// of the sprite sheet) and ChipSet (tilesets) are not registers of paths:
// a charset is an index into a sheet and a chipset drags its sidecar
// along, so both keep their own callbacks.

import { useEffect, useRef, useState } from "react";
import { mode7Preview } from "../build";
import { loadAssetPng } from "../io";
import { assetStem } from "../types";
import type { ResKind } from "../resources";
import AudioPreviewButton, { stopPreview } from "./AudioPreview";

type Cat =
  | "charset" | "chipset" | "windowskin" | "iconset" | "fontset"
  | "picture" | "sound" | "music" | "vignette" | "mode7";

export type ResAct = "import" | "export" | "rename" | "delete";

interface Props {
  root: string;
  tilesetNames: string[]; // stems, project order
  tilesets: Record<string, ImageBitmap>;
  sprites: ImageBitmap | null;
  blockCount: number;
  blockNames: string[];
  windowskins: string[]; // relative paths (assets/xxx.png)
  activeSkin?: string; // active theme (project.ui.windowskin)
  iconsets: string[]; // widget icon sheets (W1)
  activeIcons?: string; // active sheet (project.ui.icons)
  fonts: string[]; // 768x8 fonts (S1) — the default (assets.font) first
  defaultFont: string; // project.assets.font (★, cannot be deleted)
  pictures: string[]; // S3 images (PNG <= 16 colours, <= 256x224)
  sounds: string[]; // WAV sounds (B1) — assets/sounds/*.wav paths
  musics: string[]; // IT music — assets/music/*.it paths
  vignettes: string[]; // strips of 32x32 frames (B5)
  mode7Images: string[]; // Mode 7 images (M7) — assets/mode7/*.png
  // resource -> the scenes using it (to block deletion)
  usedCharsets: Record<number, string[]>;
  usedChipsets: Record<string, string[]>;
  canWrite: boolean;
  // the eight register-backed categories, in one call
  onRes: (kind: ResKind, act: ResAct, rel?: string, name?: string) => void;
  onImportCharset: () => void;
  // H4: builds a 12-frame vignette strip from a charset block.
  onVignetteFromCharset: (block: number, name: string) => void;
  onImportChipset: () => void;
  onImportTilesetPng: () => void; // a free PNG grid (not an RM2003 chipset)
  onExportCharset: (b: number) => void;
  onExportChipset: (stem: string) => void;
  onRenameCharset: (b: number, name: string) => void;
  onRenameChipset: (stem: string, newStem: string) => void;
  onDeleteCharset: (b: number) => void;
  onDeleteChipset: (stem: string) => void;
  onClose: () => void;
}

// What the window needs to know about a register-backed category: the
// list to show, which entry wears the ★ (and can therefore not be
// deleted), and the wording of the delete button.
interface CatDef {
  cat: Cat;
  kind: ResKind;
  label: string;
  bullet: string;
  items: (p: Props) => string[];
  star?: (p: Props) => string | undefined;
  audio?: boolean;
  deleteTitle: (starred: boolean) => string;
}

const CATS: CatDef[] = [
  {
    cat: "windowskin",
    kind: "windowskin",
    label: "WindowSkin (Cadres)",
    bullet: "▦",
    items: (p) => p.windowskins,
    star: (p) => p.activeSkin,
    deleteTitle: (s) =>
      s
        ? "Thème actif du projet (changer dans Tools → UI / Thème)"
        : "Supprimer le windowskin et son fichier",
  },
  {
    cat: "iconset",
    kind: "iconset",
    label: "IconSet (Widgets)",
    bullet: "▦",
    items: (p) => p.iconsets,
    star: (p) => p.activeIcons,
    deleteTitle: (s) =>
      s
        ? "Planche active du projet (changer dans Tools → UI / Thème)"
        : "Supprimer la planche d'icônes et son fichier",
  },
  {
    cat: "fontset",
    kind: "font",
    label: "FontSet (Fontes)",
    bullet: "▦",
    items: (p) => p.fonts,
    star: (p) => p.defaultFont,
    deleteTitle: (s) =>
      s
        ? "Fonte du projet (assets.font) — non supprimable"
        : "Supprimer la fonte et son fichier (refusé si un style l'utilise)",
  },
  {
    cat: "picture",
    kind: "picture",
    label: "Picture (Images)",
    bullet: "▦",
    items: (p) => p.pictures,
    deleteTitle: () =>
      "Supprimer l'image et son fichier (le build signale les pic_show orphelins)",
  },
  {
    cat: "sound",
    kind: "sound",
    label: "Son (Effets WAV)",
    bullet: "♪",
    items: (p) => p.sounds,
    audio: true,
    deleteTitle: () =>
      "Supprimer le son et son fichier (le build signale les « Jouer un son » orphelins)",
  },
  {
    cat: "music",
    kind: "music",
    label: "Musique (Modules IT)",
    bullet: "♫",
    items: (p) => p.musics,
    audio: true,
    deleteTitle: () =>
      "Supprimer la musique et son fichier (les scènes qui l'utilisent repassent en silence au build)",
  },
  {
    cat: "vignette",
    kind: "vignette",
    label: "Sprite animé (32×32)",
    bullet: "▦",
    items: (p) => p.vignettes,
    deleteTitle: () =>
      "Supprimer le sprite animé et son fichier (le build signale les « Afficher un sprite animé » orphelins)",
  },
  {
    cat: "mode7",
    kind: "mode7",
    label: "Image zoomable",
    bullet: "▦",
    items: (p) => p.mode7Images,
    deleteTitle: () =>
      "Supprimer l'image zoomable et son fichier (le build signale les « Zoom cinématique » orphelins)",
  },
];

export default function ResourceManagerModal(p: Props) {
  const [cat, setCat] = useState<Cat>("charset");
  const [selBloc, setSelBloc] = useState(0);
  const [selChip, setSelChip] = useState(p.tilesetNames[0] ?? "");
  // one selection per register category — only the current one is shown,
  // but the others are remembered while the window stays open
  const [sel, setSel] = useState<Record<string, string>>({});
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  // What the GAME will show for a Mode 7 image, converted by datagen —
  // never recomputed here (see build.ts mode7Preview).
  const [m7, setM7] = useState<{ bmp: ImageBitmap; summary: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const def = CATS.find((c) => c.cat === cat);
  const items = def ? def.items(p) : [];
  const cur = def ? (items.includes(sel[cat] ?? "") ? sel[cat] : items[0] ?? "") : "";
  const starred = !!def?.star && !!cur && def.star(p) === cur;

  const charsetUsers = p.usedCharsets[selBloc] ?? [];
  const chipUsers = p.usedChipsets[selChip] ?? [];

  const pick = (rel: string) => {
    setSel((s) => ({ ...s, [cat]: rel }));
    setRenaming(null);
  };

  // Preview bitmap: only the current image category is decoded, and it is
  // dropped as soon as the selection moves so a stale image never shows
  // under a new name.
  useEffect(() => {
    setBmp(null);
    if (!def || def.audio || !cur) return;
    let dead = false;
    void loadAssetPng(p.root, cur)
      .then((b) => {
        if (!dead) setBmp(b);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [def, cur, p.root]);

  // The Mode 7 preview. Silent on failure: in browser mode there is no
  // sidecar at all, and the panel must still open — the smoke test walks
  // every category.
  useEffect(() => {
    setM7(null);
    if (cat !== "mode7" || !cur) return;
    let dead = false;
    void mode7Preview(p.root, cur)
      .then(async (r) => {
        const b = await loadAssetPng(p.root, r.rel);
        if (!dead) setM7({ bmp: b, summary: r.summary });
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [cat, cur, p.root]);

  // preview: charset = the block's 4 idle frames; chipset = the top of
  // the tile grid
  useEffect(() => {
    const cv = previewRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#16181c";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#9aa0a8";
    ctx.font = "11px system-ui";
    if (cat === "charset" && p.sprites) {
      for (let d = 0; d < 4; d++) {
        const f = selBloc * 12 + d * 3;
        if ((f + 1) * 16 > p.sprites.width) break;
        ctx.drawImage(p.sprites, f * 16, 0, 16, 24, 8 + d * 56, 12, 48, 72);
      }
    } else if (cat === "chipset") {
      const b = p.tilesets[selChip];
      if (b) {
        const h = Math.min(b.height, 96);
        ctx.drawImage(b, 0, 0, 96, h, 8, 2, 96, h);
        ctx.fillText(`${(b.width / 16) * (b.height / 16)} tiles`, 116, 14);
      }
    } else if (cat === "windowskin" && bmp) {
      // the 24x24 sheet at 3x, then a sample 9-slice window 12x4 tiles at
      // 2x — the rendering the frame will have in game
      ctx.drawImage(bmp, 0, 0, 24, 24, 8, 14, 72, 72);
      for (let ty = 0; ty < 4; ty++)
        for (let tx = 0; tx < 12; tx++) {
          const sx = tx === 0 ? 0 : tx === 11 ? 2 : 1;
          const sy = ty === 0 ? 0 : ty === 3 ? 2 : 1;
          ctx.drawImage(bmp, sx * 8, sy * 8, 8, 8, 116 + tx * 16, 18 + ty * 16, 16, 16);
        }
      ctx.fillText("24x24 (9 tiles)", 8, 10);
      ctx.fillText("aperçu 9-slice" + (starred ? " — thème actif ★" : ""), 116, 10);
    } else if (cat === "iconset" && bmp) {
      // the icon strip at 3x with the index under each icon
      const n = Math.floor(bmp.width / 8);
      ctx.fillText(`${n} icônes 8x8` + (starred ? " — planche active ★" : ""), 8, 10);
      for (let i = 0; i < n && i < 20; i++) {
        ctx.drawImage(bmp, i * 8, 0, 8, 8, 8 + i * 25, 22, 24, 24);
        ctx.fillText(String(i), 14 + i * 25, 58);
      }
      if (n > 20) ctx.fillText("…", 8 + 20 * 25, 40);
    } else if (cat === "picture" && bmp) {
      // the image scaled down to fit the preview + its dimensions
      const sc = Math.min(1, 96 / bmp.height, 240 / bmp.width);
      ctx.drawImage(bmp, 8, 2, bmp.width * sc, bmp.height * sc);
      ctx.fillStyle = "#9aa0a8";
      ctx.fillText(
        `${bmp.width}x${bmp.height}` +
          (bmp.width <= 256 && bmp.height <= 224 &&
           bmp.width % 8 === 0 && bmp.height % 8 === 0
            ? "" : " ⚠ attendu ≤ 256x224, multiples de 8"),
        260, 14);
      ctx.fillText("≤ 16 couleurs (PNG indexé),", 260, 32);
      ctx.fillText("≤ 512 tiles 8x8 uniques (build)", 260, 46);
    } else if (cat === "mode7" && bmp) {
      // Before and after, side by side. The author is shown the real
      // result rather than told a tile count (section 8.3).
      const half = 116;
      const fit = (b: ImageBitmap) => Math.min(1, 84 / b.height, half / b.width);
      const s1 = fit(bmp);
      ctx.drawImage(bmp, 8, 14, bmp.width * s1, bmp.height * s1);
      ctx.fillStyle = "#9aa0a8";
      ctx.fillText("source", 8, 10);
      if (m7) {
        const s2 = fit(m7.bmp);
        ctx.drawImage(m7.bmp, 8 + half + 12, 14, m7.bmp.width * s2, m7.bmp.height * s2);
        ctx.fillStyle = "#9aa0a8";
        ctx.fillText("en jeu", 8 + half + 12, 10);
        ctx.fillText(m7.summary, 8, 108);
      } else {
        ctx.fillText("aperçu en cours…", 8 + half + 12, 24);
      }
    } else if (cat === "vignette" && bmp) {
      const n = bmp.width / 32;
      ctx.fillText(`${n} frame(s) 32x32 — jouées par « Animer le sprite animé »`, 8, 12);
      for (let i = 0; i < n; i++) {
        ctx.drawImage(bmp, i * 32, 0, 32, 32, 8 + i * 74, 22, 64, 64);
        ctx.fillText(String(i + 1), 34 + i * 74, 96);
      }
    } else if (cat === "sound") {
      ctx.fillText(`♪ ${p.sounds.length} son(s) — WAV converti en BRR 8 kHz au build`, 8, 14);
      ctx.fillText("~2 secondes max par son, 16 sons max — joués par la", 8, 32);
      ctx.fillText("commande d'event « Jouer un son » (par-dessus la musique).", 8, 46);
    } else if (cat === "music") {
      ctx.fillText(`♫ ${p.musics.length} musique(s) — modules Impulse Tracker (.it)`, 8, 14);
      ctx.fillText("Choisies par scène (onglet Scène) ou par la commande", 8, 32);
      ctx.fillText("« Changer la musique » (combat, boss…).", 8, 46);
    } else if (cat === "fontset" && bmp) {
      // sample text rendered with the font (2x) + the strip of 96 glyphs
      ctx.fillText(
        "96 glyphes 8x8 (bande 768x8)" + (starred ? " — fonte du projet ★" : ""), 8, 10);
      const sample = "Le vif zephyr 0123456789 !?";
      for (let i = 0; i < sample.length; i++) {
        const k = sample.charCodeAt(i) - 32;
        if (k > 0 && k < 96) ctx.drawImage(bmp, k * 8, 0, 8, 8, 8 + i * 17, 18, 16, 16);
      }
      for (let half = 0; half < 2; half++)
        ctx.drawImage(bmp, half * 384, 0, 384, 8, 8, 48 + half * 20, 384, 8);
    }
  }, [cat, selBloc, selChip, bmp, starred, p.sprites, p.tilesets, p.sounds.length, p.musics.length]);

  const rename = () => {
    if (renaming === null) return;
    const v = renaming.trim();
    if (v) {
      if (cat === "charset") p.onRenameCharset(selBloc, v);
      else if (cat === "chipset") p.onRenameChipset(selChip, v);
      else if (def) p.onRes(def.kind, "rename", cur, v);
    }
    setRenaming(null);
  };

  // no selection to act on (an empty register, or a chipset list not yet
  // loaded) — Export / Rename / Delete stay out of reach
  const noSel = def ? !cur : cat === "chipset" && !selChip;

  const catRow = (c: Cat, label: string) => (
    <div
      key={c}
      className={"tree-row" + (cat === c ? " active" : "")}
      onClick={() => {
        setCat(c);
        setRenaming(null);
      }}
    >
      🗀 {label}
    </div>
  );

  return (
    <div className="modal-backdrop">
      <div className="modal resmgr" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Gestionnaire de ressources<button className="modal-x" title="Fermer" onClick={() => { stopPreview(); p.onClose(); }}>✕</button></div>
        <div className="resmgr-body">
          <div className="resmgr-cats">
            {catRow("charset", "CharSet (Personnages)")}
            {catRow("chipset", "ChipSet (Tilesets)")}
            {CATS.map((c) => catRow(c.cat, c.label))}
          </div>
          <div className="resmgr-list">
            {cat === "charset"
              ? Array.from({ length: p.blockCount }, (_, b) => (
                  <div
                    key={b}
                    className={"tree-row" + (b === selBloc ? " active" : "")}
                    onClick={() => {
                      setSelBloc(b);
                      setRenaming(null);
                    }}
                  >
                    ▦ {p.blockNames[b] ?? `Bloc ${b}`}
                    {b === 0 ? " ★" : ""}
                  </div>
                ))
              : cat === "chipset"
                ? p.tilesetNames.map((n) => (
                    <div
                      key={n}
                      className={"tree-row" + (n === selChip ? " active" : "")}
                      onClick={() => {
                        setSelChip(n);
                        setRenaming(null);
                      }}
                    >
                      ▦ {n}
                    </div>
                  ))
                : items.map((rel) => (
                    <div
                      key={rel}
                      className={"tree-row" + (rel === cur ? " active" : "")}
                      onClick={() => pick(rel)}
                    >
                      {def!.bullet} {assetStem(rel)}
                      {def!.star?.(p) === rel ? " ★" : ""}
                      {def!.audio && (
                        <>
                          <span style={{ flex: 1 }} />
                          <AudioPreviewButton path={rel} root={p.root} />
                        </>
                      )}
                    </div>
                  ))}
          </div>
          <div className="resmgr-actions">
            <button
              disabled={!p.canWrite}
              onClick={() =>
                cat === "charset"
                  ? p.onImportCharset()
                  : cat === "chipset"
                    ? p.onImportChipset()
                    : p.onRes(def!.kind, "import")
              }
            >
              {cat === "chipset" ? "Chipset RM2003…" : "Importer…"}
            </button>
            {cat === "vignette" && (
              <button
                disabled={!p.canWrite || p.blockCount === 0}
                title="Fabriquer une planche de sprite animé 32x32 à partir des 12 frames d'un personnage (4 directions x 3 pas) — un personnage de carte devient un battler en un clic"
                onClick={() => {
                  const pick = prompt(
                    "Numéro du charset (1-" + p.blockCount + ") :\n" +
                      p.blockNames.map((n, i) => `${i + 1}. ${n}`).join("\n")
                  );
                  const b = pick === null ? NaN : Number(pick) - 1;
                  if (!Number.isInteger(b) || b < 0 || b >= p.blockCount) return;
                  const nm = prompt(
                    "Nom du sprite animé :",
                    (p.blockNames[b] || "battler").toLowerCase().replace(/[^a-z0-9_]/g, "_")
                  );
                  if (nm) p.onVignetteFromCharset(b, nm);
                }}
              >
                Depuis un charset…
              </button>
            )}
            {cat === "chipset" && (
              <button
                disabled={!p.canWrite}
                title="Importer une grille PNG libre (multiple de 16, ≤ 16 couleurs)"
                onClick={p.onImportTilesetPng}
              >
                PNG libre…
              </button>
            )}
            <button
              disabled={!p.canWrite || noSel}
              onClick={() =>
                cat === "charset"
                  ? p.onExportCharset(selBloc)
                  : cat === "chipset"
                    ? p.onExportChipset(selChip)
                    : p.onRes(def!.kind, "export", cur)
              }
            >
              Exporter…
            </button>
            <button
              disabled={!p.canWrite || noSel}
              onClick={() =>
                setRenaming(
                  cat === "charset"
                    ? p.blockNames[selBloc] ?? `Bloc ${selBloc}`
                    : cat === "chipset"
                      ? selChip
                      : assetStem(cur)
                )
              }
            >
              Renommer
            </button>
            <button
              className="danger"
              disabled={
                !p.canWrite ||
                noSel ||
                starred ||
                (cat === "charset" &&
                  (selBloc === 0 || charsetUsers.length > 0 || selBloc >= p.blockCount)) ||
                (cat === "chipset" && (chipUsers.length > 0 || p.tilesetNames.length <= 1))
              }
              title={
                cat === "charset"
                  ? selBloc === 0
                    ? "Le bloc 0 est le héros"
                    : charsetUsers.length
                      ? `Utilisé par : ${charsetUsers.join(", ")}`
                      : "Supprimer le personnage (les blocs suivants sont décalés)"
                  : cat === "chipset"
                    ? chipUsers.length
                      ? `Utilisé par : ${chipUsers.join(", ")}`
                      : "Supprimer le tileset et ses fichiers"
                    : def!.deleteTitle(starred)
              }
              onClick={() =>
                cat === "charset"
                  ? p.onDeleteCharset(selBloc)
                  : cat === "chipset"
                    ? p.onDeleteChipset(selChip)
                    : p.onRes(def!.kind, "delete", cur)
              }
            >
              ✕ Supprimer
            </button>
            {renaming !== null && (
              <div className="resmgr-rename">
                <input
                  autoFocus
                  value={renaming}
                  onChange={(e) => setRenaming(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rename();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
                <button onClick={rename}>OK</button>
              </div>
            )}
            {cat !== "charset" && renaming !== null && (
              <span className="hint">a-z, 0-9, _ (renomme les fichiers)</span>
            )}
          </div>
        </div>
        <canvas ref={previewRef} width={520} height={100} className="resmgr-preview" />
        <div className="row">
          <button onClick={() => { stopPreview(); p.onClose(); }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
