// Onglet « Couche d'effet » (S11/S17) : une image de scène en OVERLAY
// (motif dérivant au-dessus du jeu — nuages, brume, S9) ou en PANORAMA
// (fond derrière la carte, vu par les tuiles gommées). Les explications
// vivent en INFO-BULLES (survol souris) — l'interface reste épurée.
// La couche sup de la scène est désactivée tant qu'une image est choisie.

import type { Scene, SceneEffect } from "../types";

interface Props {
  scene: Scene;
  pictures: string[]; // stems des images (registre Picture)
  onSetEffect: (effect: SceneEffect | undefined) => void;
}

export default function EffectPanel({ scene, pictures, onSetEffect }: Props) {
  const eff = scene.effect;
  const isBack = eff?.mode === "back";

  return (
    <div className="panel">
      <div className="panel-title">Couche d'effet — « {scene.name} »</div>

      <div className="palette-title">Image</div>
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
          title={
            "Image du Gestionnaire de ressources (≤ 256 tiles 8x8 uniques — " +
            "réutiliser 2-4 formes posées à des positions multiples de 8 px). " +
            "Overlay : motif dérivant au-dessus du jeu (nuages, brume) — à " +
            "importer AVEC transparence. Panorama : fond derrière la carte, vu " +
            "par les tuiles gommées. La couche supérieure de la scène est " +
            "désactivée : le plan qui la portait affiche l'image."
          }
        >
          <option value="">— aucune —</option>
          {pictures.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {eff && (
        <>
          <div className="palette-title">Type d'effet</div>
          <div className="scene-section">
            <select
              value={eff.mode ?? "front"}
              onChange={(e) =>
                onSetEffect({
                  ...eff,
                  mode: e.target.value === "back" ? "back" : undefined,
                })
              }
              title={
                "Overlay : l'image passe AU-DESSUS du jeu (personnages " +
                "compris) — nuages, brume, avec un mélange. Panorama : " +
                "l'image passe DERRIÈRE la carte (façon RPG Maker), visible " +
                "là où la couche basse est GOMMÉE (outil gomme) ; décor et " +
                "personnages restent devant, l'index 0 de l'image reste " +
                "transparent."
              }
            >
              <option value="front">Overlay (au-dessus du jeu)</option>
              <option value="back">Panorama (derrière la carte)</option>
            </select>
          </div>

          {isBack && (
            <div className="scene-section">
              <label
                className="check"
                title="Coché : l'image boucle et peut défiler (dérive + parallaxe). Décoché : image fixe unique, sans défilement ni parallaxe."
              >
                <input
                  type="checkbox"
                  checked={eff.repeat !== false}
                  onChange={(e) =>
                    onSetEffect({ ...eff, repeat: e.target.checked ? undefined : false })
                  }
                />
                Répéter l'image
              </label>
            </div>
          )}

          {(!isBack || eff.repeat !== false) && (
            <>
              <div className="palette-title">Dérive automatique</div>
              <div
                className="scene-section"
                title="L'image dérive même caméra immobile. Négatif = vers la gauche / le haut. 0,5 px/s pour du très lent."
              >
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
                  title="Visible UNIQUEMENT quand la caméra bouge : en marchant, l'image glisse à cette fraction de la vitesse du décor (profondeur). « Aucun » = fond fixe à l'écran, seule la dérive joue."
                >
                  <option value="none">Aucun — fixe à l'écran (très lointain)</option>
                  <option value="quarter">¼ de la caméra (lointain)</option>
                  <option value="half">½ de la caméra (proche)</option>
                  <option value="full">Collé au décor (1:1 — ombres au sol)</option>
                </select>
              </div>
            </>
          )}

          {!isBack && (
            <>
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
                  title="Semi-transparent : voile de nuages (image claire) ou ombres douces (image sombre). En mélange, la teinte d'écran est suspendue dans cette scène ; personnages et dialogues restent visibles. (Le panorama est toujours opaque.)"
                >
                  <option value="none">Opaque</option>
                  <option value="half">Semi-transparent (50 %)</option>
                  <option value="add">Additif (lueur)</option>
                  <option value="sub">Soustractif (ombre)</option>
                </select>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
