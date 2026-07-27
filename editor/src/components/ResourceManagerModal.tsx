// Gestionnaire de ressources façon RPG Maker 2003 : catégories à gauche,
// liste des ressources au centre, actions à droite (Importer / Exporter /
// Renommer / Supprimer) + aperçu. Catégories v1 : CharSet (personnages,
// blocs de la feuille de sprites) et ChipSet (tilesets).

import { useEffect, useRef, useState } from "react";

type Cat = "charset" | "chipset";

interface Props {
  tilesetNames: string[]; // stems, ordre du projet
  tilesets: Record<string, ImageBitmap>;
  sprites: ImageBitmap | null;
  blockCount: number;
  blockNames: string[];
  // ressource -> scènes qui l'utilisent (pour bloquer la suppression)
  usedCharsets: Record<number, string[]>;
  usedChipsets: Record<string, string[]>;
  canWrite: boolean;
  onImportCharset: () => void;
  onImportChipset: () => void;
  onExportCharset: (b: number) => void;
  onExportChipset: (stem: string) => void;
  onRenameCharset: (b: number, name: string) => void;
  onRenameChipset: (stem: string, newStem: string) => void;
  onDeleteCharset: (b: number) => void;
  onDeleteChipset: (stem: string) => void;
  onClose: () => void;
}

export default function ResourceManagerModal(p: Props) {
  const [cat, setCat] = useState<Cat>("charset");
  const [selBloc, setSelBloc] = useState(0);
  const [selChip, setSelChip] = useState(p.tilesetNames[0] ?? "");
  const [renaming, setRenaming] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const charsetUsers = p.usedCharsets[selBloc] ?? [];
  const chipUsers = p.usedChipsets[selChip] ?? [];

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
    }
  }, [cat, selBloc, selChip, p.sprites, p.tilesets]);

  const rename = () => {
    if (renaming === null) return;
    const v = renaming.trim();
    if (v) {
      if (cat === "charset") p.onRenameCharset(selBloc, v);
      else p.onRenameChipset(selChip, v);
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
              : p.tilesetNames.map((n) => (
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
                ))}
          </div>
          <div className="resmgr-actions">
            <button
              disabled={!p.canWrite}
              onClick={cat === "charset" ? p.onImportCharset : p.onImportChipset}
            >
              Importer…
            </button>
            <button
              disabled={!p.canWrite || (cat === "chipset" && !selChip)}
              onClick={() =>
                cat === "charset" ? p.onExportCharset(selBloc) : p.onExportChipset(selChip)
              }
            >
              Exporter…
            </button>
            <button
              disabled={!p.canWrite || (cat === "chipset" && !selChip)}
              onClick={() =>
                setRenaming(
                  cat === "charset" ? p.blockNames[selBloc] ?? `Bloc ${selBloc}` : selChip
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
                (cat === "chipset" && (chipUsers.length > 0 || p.tilesetNames.length <= 1))
              }
              title={
                cat === "charset"
                  ? selBloc === 0
                    ? "Le bloc 0 est le héros"
                    : charsetUsers.length
                      ? `Utilisé par : ${charsetUsers.join(", ")}`
                      : "Supprimer le personnage (les blocs suivants sont décalés)"
                  : chipUsers.length
                    ? `Utilisé par : ${chipUsers.join(", ")}`
                    : "Supprimer le tileset et ses fichiers"
              }
              onClick={() =>
                cat === "charset" ? p.onDeleteCharset(selBloc) : p.onDeleteChipset(selChip)
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
            {cat === "chipset" && renaming !== null && (
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
