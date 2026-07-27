// Réglages locaux de la machine (stockés en localStorage, pas dans le
// projet) : bash MSYS2 pour make, émulateur pour le bouton Jouer.

import { useState } from "react";

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Réglages (cette machine)</div>
        <label>
          Bash MSYS2 (pour « make »)
          <input
            value={bash}
            onChange={(e) => setBash(e.target.value)}
            placeholder="C:\msys64\usr\bin\bash.exe"
          />
        </label>
        <label>
          Émulateur (commande ou chemin du .exe)
          <input
            value={emulator}
            onChange={(e) => setEmulator(e.target.value)}
            placeholder="C:\...\Mesen.exe"
          />
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
