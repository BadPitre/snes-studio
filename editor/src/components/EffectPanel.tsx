// Onglet « Couche d'effet » (S11) : le motif dérivant de la scène (S9)
// avec toutes ses options — image, vitesses, mélange, suivi caméra.
// La couche sup de la scène est désactivée tant qu'un motif est choisi.

import type { Scene, SceneEffect } from "../types";

interface Props {
  scene: Scene;
  pictures: string[]; // stems des images (registre Picture)
  onSetEffect: (effect: SceneEffect | undefined) => void;
}

export default function EffectPanel({ scene, pictures, onSetEffect }: Props) {
  const eff = scene.effect;

  return (
    <div className="panel">
      <div className="panel-title">Couche d'effet — « {scene.name} »</div>

      <div className="palette-title">Motif</div>
      <div className="scene-section">
        <select
          value={eff?.pic ?? ""}
          onChange={(e) =>
            onSetEffect(
              e.target.value === ""
                ? undefined
                : { blend: "half", dx: -8, dy: 2, ...eff, pic: e.target.value }
            )
          }
          title="Motif dérivant au-dessus du jeu (nuages, brume) — une image à TRANSPARENCE du Gestionnaire de ressources"
        >
          <option value="">— aucune —</option>
          {pictures.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {!eff && (
          <p className="hint">
            Un motif (image à transparence, ≤ 256 tiles 8x8 uniques —
            réutiliser 2-4 formes posées sur des positions multiples de
            8 px) dérive au-dessus du jeu pendant qu'il se joue : nuages,
            brume, ombres. La couche supérieure de la scène sera
            désactivée : le plan qui la portait affiche le motif.
          </p>
        )}
      </div>

      {eff && (
        <>
          <div className="palette-title">Dérive automatique</div>
          <div className="scene-section">
            <div className="row">
              <label>
                Vitesse X (px/s)
                <input
                  type="number" min={-64} max={64} step={0.25}
                  value={eff.dx ?? 0}
                  onChange={(e) => onSetEffect({ ...eff, dx: Number(e.target.value) })}
                />
              </label>
              <label>
                Vitesse Y (px/s)
                <input
                  type="number" min={-64} max={64} step={0.25}
                  value={eff.dy ?? 0}
                  onChange={(e) => onSetEffect({ ...eff, dy: Number(e.target.value) })}
                />
              </label>
            </div>
            <p className="hint">
              Négatif = vers la gauche / le haut. Le motif dérive même
              caméra immobile — 0,5 px/s pour du très lent.
            </p>
          </div>

          <div className="palette-title">Suivi de la caméra (parallaxe)</div>
          <div className="scene-section">
            <select
              value={eff.parallax ?? "none"}
              onChange={(e) =>
                onSetEffect({
                  ...eff,
                  parallax:
                    e.target.value === "none"
                      ? undefined
                      : (e.target.value as "half" | "quarter" | "full"),
                })
              }
            >
              <option value="none">Aucun — fixe à l'écran (très lointain)</option>
              <option value="quarter">¼ de la caméra (lointain)</option>
              <option value="half">½ de la caméra (proche)</option>
              <option value="full">Collé au décor (1:1 — ombres au sol)</option>
            </select>
            <p className="hint">
              Visible UNIQUEMENT quand la caméra bouge : en marchant, le
              motif glisse à cette fraction de la vitesse du décor
              (profondeur). « Collé au décor » : le motif fait partie du
              sol — le bon choix pour des OMBRES de nuages. « Aucun » =
              ciel fixe à l'écran, seule la dérive joue.
            </p>
          </div>

          <div className="palette-title">Mélange</div>
          <div className="scene-section">
            <select
              value={eff.blend ?? "none"}
              onChange={(e) =>
                onSetEffect({
                  ...eff,
                  blend:
                    e.target.value === "none"
                      ? undefined
                      : (e.target.value as "half" | "add" | "sub"),
                })
              }
            >
              <option value="none">Opaque</option>
              <option value="half">Semi-transparent (50 %)</option>
              <option value="add">Additif (lueur)</option>
              <option value="sub">Soustractif (ombre)</option>
            </select>
            <p className="hint">
              Semi-transparent : voile de nuages (image claire) ou ombres
              douces (image sombre). En mélange, la teinte d'écran est
              suspendue dans cette scène. Personnages et dialogues restent
              visibles quel que soit le mode.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
