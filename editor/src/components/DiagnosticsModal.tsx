// Project diagnostics window (Tools > Vérifier le projet): the state of
// the game data and of the ROM — statistics, blocking problems,
// warnings, and datagen's real verdict (bank sizes, compression,
// generation warnings).

import type { Diag } from "../diagnostics";
import type { ProjectData } from "../types";
import { SCENE_SPRITE_BLOCKS_MAX, sceneSpriteBlocks } from "../types";

export interface DatagenReport {
  running: boolean;
  ok?: boolean;
  scenesBytes?: number;
  scenesCap?: number; // capacity of the multi-bank pool (M1)
  textsBytes?: number;
  textsCap?: number;
  compression: string[]; // "grilles : …" / "textes : …" lines
  warnings: string[]; // "attention : …" lines
  errorTail?: string; // output on failure
  romBytes?: number; // size of the last compiled ROM, when present
}

interface Props {
  data: ProjectData;
  diags: Diag[];
  report: DatagenReport | null; // null = datagen unavailable (browser)
  onClose: () => void;
}

const BANK = 32768;

export default function DiagnosticsModal({ data, diags, report, onClose }: Props) {
  const errors = diags.filter((d) => d.level === "error");
  const warns = diags.filter((d) => d.level === "warn");

  return (
    <div className="modal-backdrop">
      <div className="modal resmgr" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Vérification du projet « {data.project.name} »<button className="modal-x" title="Fermer" onClick={onClose}>✕</button></div>
        <div className="diag-body">
          <div className="palette-title">Scènes</div>
          <table className="diag-table">
            <thead>
              <tr>
                <th>Scène</th>
                <th>Taille</th>
                <th>Tiles</th>
                <th>Charsets</th>
                <th>Events</th>
                <th>Warps</th>
              </tr>
            </thead>
            <tbody>
              {data.project.scenes.map((n) => {
                const sc = data.scenes[n];
                if (!sc) return null;
                const cells = sc.width * sc.height;
                const used = sceneSpriteBlocks(sc).length;
                return (
                  <tr key={n}>
                    <td>
                      {n}
                      {n === data.project.boot_scene ? " ★" : ""}
                    </td>
                    <td>
                      {sc.width}x{sc.height}
                    </td>
                    <td className={cells > 8192 ? "diag-bad" : ""}>{cells}/8192</td>
                    <td className={used > SCENE_SPRITE_BLOCKS_MAX ? "diag-bad" : ""}>
                      {used}/{SCENE_SPRITE_BLOCKS_MAX}
                    </td>
                    <td>{sc.events.length}</td>
                    <td>{sc.warps.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="palette-title">Problèmes</div>
          {errors.length === 0 && warns.length === 0 && (
            <p className="diag-ok">✓ Aucun problème détecté dans les données du projet.</p>
          )}
          {errors.map((d, i) => (
            <p key={`e${i}`} className="diag-bad">
              ✗ [{d.where}] {d.msg}
            </p>
          ))}
          {warns.map((d, i) => (
            <p key={`w${i}`} className="diag-warn">
              ⚠ [{d.where}] {d.msg}
            </p>
          ))}

          <div className="palette-title">Génération (datagen)</div>
          {!report && <p className="hint">Indisponible en mode navigateur.</p>}
          {report?.running && <p className="hint">Génération en cours…</p>}
          {report && !report.running && (
            <>
              {report.ok ? (
                <p className="diag-ok">✓ Données générées sans erreur.</p>
              ) : (
                <>
                  <p className="diag-bad">✗ datagen a refusé le projet :</p>
                  <pre className="diag-out">{report.errorTail}</pre>
                </>
              )}
              {report.scenesBytes !== undefined && (
                <p className={report.scenesBytes > (report.scenesCap ?? BANK) ? "diag-bad" : ""}>
                  Scènes : {report.scenesBytes} / {report.scenesCap ?? BANK} octets (
                  {Math.round((report.scenesBytes / (report.scenesCap ?? BANK)) * 100)}%,
                  {" "}{Math.ceil((report.scenesCap ?? BANK) / 32768)} bank(s))
                </p>
              )}
              {report.textsBytes !== undefined && (
                <p className={report.textsBytes > (report.textsCap ?? BANK) ? "diag-bad" : ""}>
                  Textes : {report.textsBytes} / {report.textsCap ?? BANK} octets (
                  {Math.round((report.textsBytes / (report.textsCap ?? BANK)) * 100)}%,
                  {" "}{Math.ceil((report.textsCap ?? BANK) / 32768)} bank(s))
                </p>
              )}
              {report.compression.map((l, i) => (
                <p key={i} className="hint">
                  {l}
                </p>
              ))}
              {report.romBytes !== undefined && (
                <p className="hint">Dernier ROM compilé : {Math.round(report.romBytes / 1024)} Ko</p>
              )}
              {report.warnings.map((w, i) => (
                <p key={i} className="diag-warn">
                  ⚠ {w}
                </p>
              ))}
            </>
          )}
        </div>
        <div className="row">
          <button onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
