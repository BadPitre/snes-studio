// Gestionnaire de ressources façon RPG Maker 2003 : catégories à gauche,
// liste des ressources au centre, actions à droite (Importer / Exporter /
// Renommer / Supprimer) + aperçu. Catégories : CharSet (personnages,
// blocs de la feuille de sprites), ChipSet (tilesets) et WindowSkin
// (cadres 9-slice 24x24 de la Phase 11 — le thème actif se choisit dans
// Tools → UI / Thème).

import { useEffect, useRef, useState } from "react";
import { loadAssetPng } from "../io";
import { assetStem } from "../types";

type Cat = "charset" | "chipset" | "windowskin";

interface Props {
  root: string;
  tilesetNames: string[]; // stems, ordre du projet
  tilesets: Record<string, ImageBitmap>;
  sprites: ImageBitmap | null;
  blockCount: number;
  blockNames: string[];
  windowskins: string[]; // chemins relatifs (assets/xxx.png)
  activeSkin?: string; // thème actif (project.ui.windowskin)
  // ressource -> scènes qui l'utilisent (pour bloquer la suppression)
  usedCharsets: Record<number, string[]>;
  usedChipsets: Record<string, string[]>;
  canWrite: boolean;
  onImportCharset: () => void;
  onImportChipset: () => void;
  onImportWindowskin: () => void;
  onExportCharset: (b: number) => void;
  onExportChipset: (stem: string) => void;
  onExportWindowskin: (rel: string) => void;
  onRenameCharset: (b: number, name: string) => void;
  onRenameChipset: (stem: string, newStem: string) => void;
  onRenameWindowskin: (rel: string, newName: string) => void;
  onDeleteCharset: (b: number) => void;
  onDeleteChipset: (stem: string) => void;
  onDeleteWindowskin: (rel: string) => void;
  onClose: () => void;
}

export default function ResourceManagerModal(p: Props) {
  const [cat, setCat] = useState<Cat>("charset");
  const [selBloc, setSelBloc] = useState(0);
  const [selChip, setSelChip] = useState(p.tilesetNames[0] ?? "");
  const [selSkin, setSelSkin] = useState(p.windowskins[0] ?? "");
  const [skinBmp, setSkinBmp] = useState<ImageBitmap | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const charsetUsers = p.usedCharsets[selBloc] ?? [];
  const chipUsers = p.usedChipsets[selChip] ?? [];
  const skinActive = !!selSkin && selSkin === p.activeSkin;

  // la liste peut changer sous nos pieds (import/suppression)
  useEffect(() => {
    if (!p.windowskins.includes(selSkin)) setSelSkin(p.windowskins[0] ?? "");
  }, [p.windowskins, selSkin]);
  useEffect(() => {
    setSkinBmp(null);
    if (cat === "windowskin" && selSkin)
      void loadAssetPng(p.root, selSkin).then(setSkinBmp).catch(() => {});
  }, [cat, selSkin, p.root, p.windowskins]);

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
    }
  }, [cat, selBloc, selChip, p.sprites, p.tilesets, skinBmp, skinActive]);

  const rename = () => {
    if (renaming === null) return;
    const v = renaming.trim();
    if (v) {
      if (cat === "charset") p.onRenameCharset(selBloc, v);
      else if (cat === "chipset") p.onRenameChipset(selChip, v);
      else p.onRenameWindowskin(selSkin, v);
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
                : p.windowskins.map((rel) => (
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
                    : p.onImportWindowskin
              }
            >
              Importer…
            </button>
            <button
              disabled={
                !p.canWrite ||
                (cat === "chipset" && !selChip) ||
                (cat === "windowskin" && !selSkin)
              }
              onClick={() =>
                cat === "charset"
                  ? p.onExportCharset(selBloc)
                  : cat === "chipset"
                    ? p.onExportChipset(selChip)
                    : p.onExportWindowskin(selSkin)
              }
            >
              Exporter…
            </button>
            <button
              disabled={
                !p.canWrite ||
                (cat === "chipset" && !selChip) ||
                (cat === "windowskin" && !selSkin)
              }
              onClick={() =>
                setRenaming(
                  cat === "charset"
                    ? p.blockNames[selBloc] ?? `Bloc ${selBloc}`
                    : cat === "chipset"
                      ? selChip
                      : assetStem(selSkin)
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
                (cat === "windowskin" && (!selSkin || skinActive))
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
                    : skinActive
                      ? "Thème actif du projet (changer dans Tools → UI / Thème)"
                      : "Supprimer le windowskin et son fichier"
              }
              onClick={() =>
                cat === "charset"
                  ? p.onDeleteCharset(selBloc)
                  : cat === "chipset"
                    ? p.onDeleteChipset(selChip)
                    : p.onDeleteWindowskin(selSkin)
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
