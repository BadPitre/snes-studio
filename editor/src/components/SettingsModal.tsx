// Réglages locaux de la machine (stockés en localStorage, pas dans le
// projet) : bash MSYS2 pour make, émulateur pour le bouton Jouer.

import { useState } from "react";
import { pickFile } from "../io";

export interface PlayConfig {
  bash: string;
  emulator: string;
  /* S6 : « Jouer » compile une ROM de test avec le menu de debug
     (Start+Select+R en jeu) — jamais appliqué au build cartouche */
  debug: boolean;
}

interface Props {
  config: PlayConfig;
  onSave: (c: PlayConfig) => void;
  onClose: () => void;
}

export default function SettingsModal({ config, onSave, onClose }: Props) {
  const [bash, setBash] = useState(config.bash);
  const [emulator, setEmulator] = useState(config.emulator);
  const [debug, setDebug] = useState(config.debug);

  async function browse(setter: (v: string) => void, title: string) {
    const f = await pickFile(title, "Exécutable", ["exe", "*"]);
    if (f) setter(f);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Réglages (cette machine)<button className="modal-x" title="Fermer" onClick={onClose}>✕</button></div>
        <label>
          Bash MSYS2 (pour « make »)
          <div className="row">
            <input
              value={bash}
              onChange={(e) => setBash(e.target.value)}
              placeholder="C:\msys64\usr\bin\bash.exe"
            />
            <button
              className="browse"
              onClick={() => browse(setBash, "Choisir bash.exe (MSYS2)")}
            >
              …
            </button>
          </div>
        </label>
        <p className="hint">
          Le bouton « Jouer » compile le projet via ce shell (datagen puis
          make) et lance la ROM dans l'émulateur. La variable
          d'environnement <code>PVSNESLIB_HOME</code> doit être définie dans
          votre profil MSYS2.
        </p>
        <label>
          Émulateur (chemin du .exe)
          <div className="row">
            <input
              value={emulator}
              onChange={(e) => setEmulator(e.target.value)}
              placeholder="C:\...\Mesen.exe"
            />
            <button
              className="browse"
              onClick={() => browse(setEmulator, "Choisir l'émulateur (Mesen.exe)")}
            >
              …
            </button>
          </div>
        </label>
        <label
          className="check"
          title="En jeu, Start + Select + R affiche/cache le panneau (FPS, lag, occupation des banks). Jamais inclus dans le build cartouche."
        >
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => setDebug(e.target.checked)}
          />
          Menu de debug dans la ROM de test (Start + Select + R)
        </label>
        <div className="row">
          <button onClick={() => onSave({ bash, emulator, debug })}>Enregistrer</button>
          <button onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
