// Gestionnaire de ressources façon RPG Maker 2003 : catégories à gauche,
// liste des ressources au centre, actions à droite (Importer / Exporter /
// Renommer / Supprimer) + aperçu. Catégories : CharSet (personnages,
// blocs de la feuille de sprites), ChipSet (tilesets) et WindowSkin
// (cadres 9-slice 24x24 de la Phase 11 — le thème actif se choisit dans
// Tools → UI / Thème).

import { useEffect, useRef, useState } from "react";
import { loadAssetPng } from "../io";
import { assetStem } from "../types";

type Cat = "charset" | "chipset" | "windowskin" | "iconset" | "fontset" | "picture";

interface Props {
  root: string;
  tilesetNames: string[]; // stems, ordre du projet
  tilesets: Record<string, ImageBitmap>;
  sprites: ImageBitmap | null;
  blockCount: number;
  blockNames: string[];
  windowskins: string[]; // chemins relatifs (assets/xxx.png)
  activeSkin?: string; // thème actif (project.ui.windowskin)
  iconsets: string[]; // planches d'icônes des widgets (W1)
  activeIcons?: string; // planche active (project.ui.icons)
  fonts: string[]; // fontes 768x8 (S1) — la défaut (assets.font) en tête
  defaultFont: string; // project.assets.font (★, non supprimable)
  pictures: string[]; // images S3 (PNG ≤ 16 couleurs, ≤ 256x224)
  // ressource -> scènes qui l'utilisent (pour bloquer la suppression)
  usedCharsets: Record<number, string[]>;
  usedChipsets: Record<string, string[]>;
  canWrite: boolean;
  onImportCharset: () => void;
  onImportChipset: () => void;
  onImportWindowskin: () => void;
  onImportIconset: () => void;
  onImportFont: () => void;
  onImportPicture: () => void;
  onExportCharset: (b: number) => void;
  onExportChipset: (stem: string) => void;
  onExportWindowskin: (rel: string) => void;
  onExportIconset: (rel: string) => void;
  onExportFont: (rel: string) => void;
  onExportPicture: (rel: string) => void;
  onRenameCharset: (b: number, name: string) => void;
  onRenameChipset: (stem: string, newStem: string) => void;
  onRenameWindowskin: (rel: string, newName: string) => void;
  onRenameIconset: (rel: string, newName: string) => void;
  onRenameFont: (rel: string, newName: string) => void;
  onRenamePicture: (rel: string, newName: string) => void;
  onDeleteCharset: (b: number) => void;
  onDeleteChipset: (stem: string) => void;
  onDeleteWindowskin: (rel: string) => void;
  onDeleteIconset: (rel: string) => void;
  onDeleteFont: (rel: string) => void;
  onDeletePicture: (rel: string) => void;
  onClose: () => void;
}

export default function ResourceManagerModal(p: Props) {
  const [cat, setCat] = useState<Cat>("charset");
  const [selBloc, setSelBloc] = useState(0);
  const [selChip, setSelChip] = useState(p.tilesetNames[0] ?? "");
  const [selSkin, setSelSkin] = useState(p.windowskins[0] ?? "");
  const [selIcons, setSelIcons] = useState(p.iconsets[0] ?? "");
  const [selFont, setSelFont] = useState(p.fonts[0] ?? "");
  const [selPic, setSelPic] = useState(p.pictures[0] ?? "");
  const [skinBmp, setSkinBmp] = useState<ImageBitmap | null>(null);
  const [iconsBmp, setIconsBmp] = useState<ImageBitmap | null>(null);
  const [fontBmp, setFontBmp] = useState<ImageBitmap | null>(null);
  const [picBmp, setPicBmp] = useState<ImageBitmap | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const charsetUsers = p.usedCharsets[selBloc] ?? [];
  const chipUsers = p.usedChipsets[selChip] ?? [];
  const skinActive = !!selSkin && selSkin === p.activeSkin;
  const iconsActive = !!selIcons && selIcons === p.activeIcons;
  const fontDefault = !!selFont && selFont === p.defaultFont;

  // la liste peut changer sous nos pieds (import/suppression)
  useEffect(() => {
    if (!p.windowskins.includes(selSkin)) setSelSkin(p.windowskins[0] ?? "");
  }, [p.windowskins, selSkin]);
  useEffect(() => {
    if (!p.iconsets.includes(selIcons)) setSelIcons(p.iconsets[0] ?? "");
  }, [p.iconsets, selIcons]);
  useEffect(() => {
    setSkinBmp(null);
    if (cat === "windowskin" && selSkin)
      void loadAssetPng(p.root, selSkin).then(setSkinBmp).catch(() => {});
  }, [cat, selSkin, p.root, p.windowskins]);
  useEffect(() => {
    setIconsBmp(null);
    if (cat === "iconset" && selIcons)
      void loadAssetPng(p.root, selIcons).then(setIconsBmp).catch(() => {});
  }, [cat, selIcons, p.root, p.iconsets]);
  useEffect(() => {
    if (!p.fonts.includes(selFont)) setSelFont(p.fonts[0] ?? "");
  }, [p.fonts, selFont]);
  useEffect(() => {
    setFontBmp(null);
    if (cat === "fontset" && selFont)
      void loadAssetPng(p.root, selFont).then(setFontBmp).catch(() => {});
  }, [cat, selFont, p.root, p.fonts]);
  useEffect(() => {
    if (!p.pictures.includes(selPic)) setSelPic(p.pictures[0] ?? "");
  }, [p.pictures, selPic]);
  useEffect(() => {
    setPicBmp(null);
    if (cat === "picture" && selPic)
      void loadAssetPng(p.root, selPic).then(setPicBmp).catch(() => {});
  }, [cat, selPic, p.root, p.pictures]);

  // aperçu : charset = les 4 frames de repos du bloc ; chipset = haut de la
  // grille de tiles
  useEffect(() => {
    const cv = previewRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#16181c";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (cat === "charset" && p.sprites) {
      for (let d = 0; d < 4; d++) {
        const f = selBloc * 12 + d * 3;
        if ((f + 1) * 16 > p.sprites.width) break;
        ctx.drawImage(p.sprites, f * 16, 0, 16, 24, 8 + d * 56, 12, 48, 72);
      }
    } else if (cat === "chipset") {
      const bmp = p.tilesets[selChip];
      if (bmp) {
        const h = Math.min(bmp.height, 96);
        ctx.drawImage(bmp, 0, 0, 96, h, 8, 2, 96, h);
        ctx.fillStyle = "#9aa0a8";
        ctx.font = "11px system-ui";
        ctx.fillText(`${(bmp.width / 16) * (bmp.height / 16)} tiles`, 116, 14);
      }
    } else if (cat === "windowskin" && skinBmp) {
      // la planche 24x24 en 3x, puis une fenêtre 9-slice d'exemple 12x4
      // tiles en 2x — le rendu qu'aura le cadre en jeu
      ctx.drawImage(skinBmp, 0, 0, 24, 24, 8, 14, 72, 72);
      for (let ty = 0; ty < 4; ty++)
        for (let tx = 0; tx < 12; tx++) {
          const sx = tx === 0 ? 0 : tx === 11 ? 2 : 1;
          const sy = ty === 0 ? 0 : ty === 3 ? 2 : 1;
          ctx.drawImage(skinBmp, sx * 8, sy * 8, 8, 8, 116 + tx * 16, 18 + ty * 16, 16, 16);
        }
      ctx.fillStyle = "#9aa0a8";
      ctx.font = "11px system-ui";
      ctx.fillText("24x24 (9 tiles)", 8, 10);
      ctx.fillText("aperçu 9-slice" + (skinActive ? " — thème actif ★" : ""), 116, 10);
    } else if (cat === "iconset" && iconsBmp) {
      // la bande d'icônes en 3x avec l'index sous chaque icône
      const n = Math.floor(iconsBmp.width / 8);
      ctx.fillStyle = "#9aa0a8";
      ctx.font = "11px system-ui";
      ctx.fillText(
        `${n} icônes 8x8` + (iconsActive ? " — planche active ★" : ""), 8, 10);
      for (let i = 0; i < n && i < 20; i++) {
        ctx.drawImage(iconsBmp, i * 8, 0, 8, 8, 8 + i * 25, 22, 24, 24);
        ctx.fillText(String(i), 14 + i * 25, 58);
      }
      if (n > 20) ctx.fillText("…", 8 + 20 * 25, 40);
    } else if (cat === "picture" && picBmp) {
      // l'image réduite pour tenir dans l'aperçu + ses dimensions
      const sc = Math.min(1, 96 / picBmp.height, 240 / picBmp.width);
      ctx.drawImage(picBmp, 8, 2, picBmp.width * sc, picBmp.height * sc);
      ctx.fillStyle = "#9aa0a8";
      ctx.font = "11px system-ui";
      ctx.fillText(
        `${picBmp.width}x${picBmp.height}` +
          (picBmp.width <= 256 && picBmp.height <= 224 &&
           picBmp.width % 8 === 0 && picBmp.height % 8 === 0
            ? "" : " ⚠ attendu ≤ 256x224, multiples de 8"),
        260, 14);
      ctx.fillText("≤ 16 couleurs (PNG indexé),", 260, 32);
      ctx.fillText("≤ 512 tiles 8x8 uniques (build)", 260, 46);
    } else if (cat === "fontset" && fontBmp) {
      // texte d'exemple rendu avec la fonte (2x) + la bande des 96 glyphes
      ctx.fillStyle = "#9aa0a8";
      ctx.font = "11px system-ui";
      ctx.fillText(
        "96 glyphes 8x8 (bande 768x8)" + (fontDefault ? " — fonte du projet ★" : ""), 8, 10);
      const sample = "Le vif zephyr 0123456789 !?";
      for (let i = 0; i < sample.length; i++) {
        const k = sample.charCodeAt(i) - 32;
        if (k > 0 && k < 96) ctx.drawImage(fontBmp, k * 8, 0, 8, 8, 8 + i * 17, 18, 16, 16);
      }
      for (let half = 0; half < 2; half++)
        ctx.drawImage(fontBmp, half * 384, 0, 384, 8, 8, 48 + half * 20, 384, 8);
    }
  }, [cat, selBloc, selChip, p.sprites, p.tilesets, skinBmp, skinActive, iconsBmp, iconsActive, fontBmp, fontDefault, picBmp]);

  const rename = () => {
    if (renaming === null) return;
    const v = renaming.trim();
    if (v) {
      if (cat === "charset") p.onRenameCharset(selBloc, v);
      else if (cat === "chipset") p.onRenameChipset(selChip, v);
      else if (cat === "windowskin") p.onRenameWindowskin(selSkin, v);
      else if (cat === "iconset") p.onRenameIconset(selIcons, v);
      else if (cat === "fontset") p.onRenameFont(selFont, v);
      else p.onRenamePicture(selPic, v);
    }
    setRenaming(null);
  };

  return (
    <div className="modal-backdrop" onClick={p.onClose}>
      <div className="modal resmgr" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Gestionnaire de ressources</div>
        <div className="resmgr-body">
          <div className="resmgr-cats">
            <div
              className={"tree-row" + (cat === "charset" ? " active" : "")}
              onClick={() => {
                setCat("charset");
                setRenaming(null);
              }}
            >
              🗀 CharSet (Personnages)
            </div>
            <div
              className={"tree-row" + (cat === "chipset" ? " active" : "")}
              onClick={() => {
                setCat("chipset");
                setRenaming(null);
              }}
            >
              🗀 ChipSet (Tilesets)
            </div>
            <div
              className={"tree-row" + (cat === "windowskin" ? " active" : "")}
              onClick={() => {
                setCat("windowskin");
                setRenaming(null);
              }}
            >
              🗀 WindowSkin (Cadres)
            </div>
            <div
              className={"tree-row" + (cat === "iconset" ? " active" : "")}
              onClick={() => {
                setCat("iconset");
                setRenaming(null);
              }}
            >
              🗀 IconSet (Widgets)
            </div>
            <div
              className={"tree-row" + (cat === "fontset" ? " active" : "")}
              onClick={() => {
                setCat("fontset");
                setRenaming(null);
              }}
            >
              🗀 FontSet (Fontes)
            </div>
            <div
              className={"tree-row" + (cat === "picture" ? " active" : "")}
              onClick={() => {
                setCat("picture");
                setRenaming(null);
              }}
            >
              🗀 Picture (Images)
            </div>
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
                : cat === "windowskin"
                  ? p.windowskins.map((rel) => (
                      <div
                        key={rel}
                        className={"tree-row" + (rel === selSkin ? " active" : "")}
                        onClick={() => {
                          setSelSkin(rel);
                          setRenaming(null);
                        }}
                      >
                        ▦ {assetStem(rel)}
                        {rel === p.activeSkin ? " ★" : ""}
                      </div>
                    ))
                  : cat === "iconset"
                    ? p.iconsets.map((rel) => (
                        <div
                          key={rel}
                          className={"tree-row" + (rel === selIcons ? " active" : "")}
                          onClick={() => {
                            setSelIcons(rel);
                            setRenaming(null);
                          }}
                        >
                          ▦ {assetStem(rel)}
                          {rel === p.activeIcons ? " ★" : ""}
                        </div>
                      ))
                    : cat === "fontset"
                      ? p.fonts.map((rel) => (
                          <div
                            key={rel}
                            className={"tree-row" + (rel === selFont ? " active" : "")}
                            onClick={() => {
                              setSelFont(rel);
                              setRenaming(null);
                            }}
                          >
                            ▦ {assetStem(rel)}
                            {rel === p.defaultFont ? " ★" : ""}
                          </div>
                        ))
                      : p.pictures.map((rel) => (
                          <div
                            key={rel}
                            className={"tree-row" + (rel === selPic ? " active" : "")}
                            onClick={() => {
                              setSelPic(rel);
                              setRenaming(null);
                            }}
                          >
                            ▦ {assetStem(rel)}
                          </div>
                        ))}
          </div>
          <div className="resmgr-actions">
            <button
              disabled={!p.canWrite}
              onClick={
                cat === "charset"
                  ? p.onImportCharset
                  : cat === "chipset"
                    ? p.onImportChipset
                    : cat === "windowskin"
                      ? p.onImportWindowskin
                      : cat === "iconset"
                        ? p.onImportIconset
                        : cat === "fontset"
                          ? p.onImportFont
                          : p.onImportPicture
              }
            >
              Importer…
            </button>
            <button
              disabled={
                !p.canWrite ||
                (cat === "chipset" && !selChip) ||
                (cat === "windowskin" && !selSkin) ||
                (cat === "iconset" && !selIcons) ||
                (cat === "fontset" && !selFont) ||
                (cat === "picture" && !selPic)
              }
              onClick={() =>
                cat === "charset"
                  ? p.onExportCharset(selBloc)
                  : cat === "chipset"
                    ? p.onExportChipset(selChip)
                    : cat === "windowskin"
                      ? p.onExportWindowskin(selSkin)
                      : cat === "iconset"
                        ? p.onExportIconset(selIcons)
                        : cat === "fontset"
                          ? p.onExportFont(selFont)
                          : p.onExportPicture(selPic)
              }
            >
              Exporter…
            </button>
            <button
              disabled={
                !p.canWrite ||
                (cat === "chipset" && !selChip) ||
                (cat === "windowskin" && !selSkin) ||
                (cat === "iconset" && !selIcons) ||
                (cat === "fontset" && !selFont) ||
                (cat === "picture" && !selPic)
              }
              onClick={() =>
                setRenaming(
                  cat === "charset"
                    ? p.blockNames[selBloc] ?? `Bloc ${selBloc}`
                    : cat === "chipset"
                      ? selChip
                      : cat === "windowskin"
                        ? assetStem(selSkin)
                        : cat === "iconset"
                          ? assetStem(selIcons)
                          : cat === "fontset"
                            ? assetStem(selFont)
                            : assetStem(selPic)
                )
              }
            >
              Renommer
            </button>
            <button
              className="danger"
              disabled={
                !p.canWrite ||
                (cat === "charset" &&
                  (selBloc === 0 || charsetUsers.length > 0 || selBloc >= p.blockCount)) ||
                (cat === "chipset" && (chipUsers.length > 0 || p.tilesetNames.length <= 1)) ||
                (cat === "windowskin" && (!selSkin || skinActive)) ||
                (cat === "iconset" && (!selIcons || iconsActive)) ||
                (cat === "fontset" && (!selFont || fontDefault)) ||
                (cat === "picture" && !selPic)
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
                    : cat === "windowskin"
                      ? skinActive
                        ? "Thème actif du projet (changer dans Tools → UI / Thème)"
                        : "Supprimer le windowskin et son fichier"
                      : cat === "iconset"
                        ? iconsActive
                          ? "Planche active du projet (changer dans Tools → UI / Thème)"
                          : "Supprimer la planche d'icônes et son fichier"
                        : cat === "fontset"
                          ? fontDefault
                            ? "Fonte du projet (assets.font) — non supprimable"
                            : "Supprimer la fonte et son fichier (refusé si un style l'utilise)"
                          : "Supprimer l'image et son fichier (le build signale les pic_show orphelins)"
              }
              onClick={() =>
                cat === "charset"
                  ? p.onDeleteCharset(selBloc)
                  : cat === "chipset"
                    ? p.onDeleteChipset(selChip)
                    : cat === "windowskin"
                      ? p.onDeleteWindowskin(selSkin)
                      : cat === "iconset"
                        ? p.onDeleteIconset(selIcons)
                        : cat === "fontset"
                          ? p.onDeleteFont(selFont)
                          : p.onDeletePicture(selPic)
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
          <button onClick={p.onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
