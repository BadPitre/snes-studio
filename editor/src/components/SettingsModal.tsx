// Réglages locaux de la machine (stockés en localStorage, pas dans le
// projet) : bash MSYS2 pour make, émulateur pour le bouton Jouer.

import { useState } from "react";
import { pickFile } from "../io";

export interface PlayConfig {
  bash: string;
  emulator: string;
}

interface Props {
  config: PlayConfig;
  onSave: (c: PlayConfig) => void;
  onClose: () => void;
}

export default function SettingsModal({ config, onSave, onClose }: Props) {
  const [bash, setBash] = useState(config.bash);
  const [emulator, setEmulator] = useState(config.emulator);

  async function browse(setter: (v: string) => void, title: string) {
    const f = await pickFile(title, "Exécutable", ["exe", "*"]);
    if (f) setter(f);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Réglages (cette machine)</div>
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
        <p className="hint">
          « Jouer » enchaîne datagen → make (MSYS2) → émulateur sur le ROM
          compilé. PVSNESLIB_HOME doit être défini dans ton profil MSYS2.
        </p>
        <div className="row">
          <button onClick={() => onSave({ bash, emulator })}>Enregistrer</button>
          <button onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
