// Fenêtre de diagnostic du projet (Tools → Vérifier le projet) : état des
// données du jeu et de la ROM — statistiques, problèmes bloquants,
// avertissements, et le verdict réel de datagen (tailles des banks,
// compression, warnings de génération).

import type { Diag } from "../diagnostics";
import type { ProjectData } from "../types";
import { SCENE_SPRITE_BLOCKS_MAX, sceneSpriteBlocks } from "../types";

export interface DatagenReport {
  running: boolean;
  ok?: boolean;
  scenesBytes?: number;
  textsBytes?: number;
  compression: string[]; // lignes « grilles : … » / « textes : … »
  warnings: string[]; // lignes « attention : … »
  errorTail?: string; // sortie en cas d'échec
  romBytes?: number; // taille du dernier ROM compilé, si présent
}

interface Props {
  data: ProjectData;
  diags: Diag[];
  report: DatagenReport | null; // null = datagen indisponible (navigateur)
  onClose: () => void;
}

const BANK = 32768;

export default function DiagnosticsModal({ data, diags, report, onClose }: Props) {
  const errors = diags.filter((d) => d.level === "error");
  const warns = diags.filter((d) => d.level === "warn");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal resmgr" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Vérification du projet « {data.project.name} »</div>
        <div className="diag-body">
          <div className="palette-title">Scènes</div>
          <table className="diag-table">
            <thead>
              <tr>
                <th>Scène</th>
                <th>Taille</th>
                <th>Tiles</th>
                <th>Charsets</th>
                <th>Acteurs</th>
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
                    <td>{sc.actors.length}</td>
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
                <p className={report.scenesBytes > BANK ? "diag-bad" : ""}>
                  Bank scènes : {report.scenesBytes} / {BANK} octets (
                  {Math.round((report.scenesBytes / BANK) * 100)}%)
                </p>
              )}
              {report.textsBytes !== undefined && (
                <p className={report.textsBytes > BANK ? "diag-bad" : ""}>
                  Bank textes : {report.textsBytes} / {BANK} octets (
                  {Math.round((report.textsBytes / BANK) * 100)}%)
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
