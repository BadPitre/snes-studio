// Machine-local settings (stored in localStorage, not in the project):
// where PVSnesLib lives, and the emulator for the Play button.

import { useState } from "react";
import { pickFile, pickProjectDir } from "../io";

export interface PlayConfig {
  /* PVSnesLib root, passed to snesbuild. Empty = let it fall back to the
     PVSNESLIB_HOME environment variable, which is what a checkout does. */
  toolchain: string;
  emulator: string;
  /* S6: "Jouer" compiles a test ROM with the debug menu (Start+Select+R
     in game) — never applied to the cartridge build */
  debug: boolean;
}

interface Props {
  config: PlayConfig;
  onSave: (c: PlayConfig) => void;
  onClose: () => void;
}

export default function SettingsModal({ config, onSave, onClose }: Props) {
  const [toolchain, setToolchain] = useState(config.toolchain);
  const [emulator, setEmulator] = useState(config.emulator);
  const [debug, setDebug] = useState(config.debug);

  async function browse(setter: (v: string) => void, title: string) {
    const f = await pickFile(title, "Exécutable", ["exe", "*"]);
    if (f) setter(f);
  }

  async function browseDir(setter: (v: string) => void) {
    const d = await pickProjectDir();
    if (d) setter(d);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-title">Réglages (cette machine)<button className="modal-x" title="Fermer" onClick={onClose}>✕</button></div>
        <label>
          Dossier PVSnesLib
          <div className="row">
            <input
              value={toolchain}
              onChange={(e) => setToolchain(e.target.value)}
              placeholder="C:\snesdev\pvsneslib"
            />
            <button className="browse" onClick={() => browseDir(setToolchain)}>
              …
            </button>
          </div>
        </label>
        <p className="hint">
          Le bouton « Jouer » génère les données puis compile la ROM et la
          lance dans l'émulateur. Plus besoin de MSYS2 ni de Rust : les
          outils voyagent avec l'éditeur. Laisser vide pour utiliser la
          variable d'environnement <code>PVSNESLIB_HOME</code>.
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
          <button onClick={() => onSave({ toolchain, emulator, debug })}>Enregistrer</button>
          <button onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
