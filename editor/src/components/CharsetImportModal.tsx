// Import d'un charset RPG Maker 2003 : aperçu de la feuille (288x256 =
// 8 personnages, ou 72x128 = un seul), choix du personnage au clic, du
// bloc de destination (existant ou nouveau) et du nom du personnage.

import { useEffect, useRef, useState } from "react";
import { PROJECT_SPRITE_BLOCKS_MAX } from "../types";

interface Props {
  bitmap: ImageBitmap; // 288x256 ou 72x128 (déjà validé)
  blockCount: number; // blocs existants dans la feuille de sprites
  blockNames: string[]; // noms affichés (index = bloc)
  defaultBloc: number;
  onImport: (perso: number, bloc: number, name: string) => void;
  onClose: () => void;
}

export default function CharsetImportModal(props: Props) {
  const { bitmap, blockCount, blockNames, onImport, onClose } = props;
  const full = bitmap.width === 288; // sinon : un personnage seul
  const [perso, setPerso] = useState(0);
  const [bloc, setBloc] = useState(props.defaultBloc);
  const [name, setName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // destinations : blocs existants + « nouveau bloc » en fin de feuille
  const choices = Math.min(blockCount + 1, PROJECT_SPRITE_BLOCKS_MAX);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#16181c";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(bitmap, 0, 0);
    if (full) {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      for (let c = 1; c < 4; c++) {
        ctx.strokeRect(c * 72 + 0.5, 0, 0, 256);
      }
      ctx.strokeRect(0, 128.5, 288, 0);
      ctx.strokeStyle = "#ffe020";
      ctx.lineWidth = 2;
      ctx.strokeRect((perso % 4) * 72 + 1, Math.floor(perso / 4) * 128 + 1, 70, 126);
    }
  }, [bitmap, full, perso]);

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 340 }} onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Importer un charset RM2003<button className="modal-x" title="Fermer" onClick={onClose}>✕</button></div>
        <canvas
          ref={canvasRef}
          width={bitmap.width}
          height={bitmap.height}
          style={{ cursor: full ? "pointer" : "default", alignSelf: "center" }}
          onClick={(e) => {
            if (!full) return;
            const r = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - r.left;
            const y = e.clientY - r.top;
            setPerso(Math.min(3, Math.floor(x / 72)) + (y >= 128 ? 4 : 0));
          }}
        />
        {full && <span className="hint">Cliquer sur le personnage à importer.</span>}
        <label>
          Bloc de destination (dans la feuille de sprites)
          <select value={bloc} onChange={(e) => setBloc(Number(e.target.value))}>
            {Array.from({ length: choices }, (_, b) => (
              <option key={b} value={b}>
                {b >= blockCount
                  ? `Bloc ${b} — nouveau`
                  : `Bloc ${b} — ${blockNames[b] ?? ""}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nom du personnage (facultatif)
          <input
            value={name}
            placeholder={blockNames[bloc] ?? `Bloc ${bloc}`}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="row">
          <button onClick={() => onImport(perso, bloc, name.trim())}>Importer</button>
          <button onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
