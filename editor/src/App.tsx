// SNES Studio — éditeur (Phase 3a MVP).
// Ouvre un dossier projet (les JSON/PNG que tools/datagen consomme),
// édite maps / collision / acteurs / textes / scripts, sauvegarde.

import { useCallback, useEffect, useState } from "react";
import type { Actor, ProjectData, Scene } from "./types";
import { loadAssetPng, loadProject, pickProjectDir, saveProject } from "./io";
import type { Tool } from "./state";
import {
  paintCollision,
  paintTile,
  placeActor,
  removeActor,
  setPlayerStart,
  updateActor,
} from "./state";
import MapCanvas from "./components/MapCanvas";
import TilePalette from "./components/TilePalette";
import ActorPanel from "./components/ActorPanel";
import TextsPanel from "./components/TextsPanel";
import ScriptPanel from "./components/ScriptPanel";

type Tab = "actors" | "script" | "texts";

export default function App() {
  const [data, setData] = useState<ProjectData | null>(null);
  const [sceneName, setSceneName] = useState<string>("");
  const [tileset, setTileset] = useState<ImageBitmap | null>(null);
  const [sprites, setSprites] = useState<ImageBitmap | null>(null);
  const [tool, setTool] = useState<Tool>({ kind: "tile", index: 0 });
  const [tab, setTab] = useState<Tab>("actors");
  const [selActor, setSelActor] = useState<number | null>(null);
  const [showCollision, setShowCollision] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("Ouvre un dossier projet (ex. demo/)");

  const scene: Scene | null = data && sceneName ? data.scenes[sceneName] : null;

  async function openProject() {
    const root = await pickProjectDir();
    if (!root) return;
    try {
      const d = await loadProject(root);
      setData(d);
      setSceneName(d.project.boot_scene);
      setTileset(await loadAssetPng(root, d.project.assets.tileset));
      setSprites(await loadAssetPng(root, d.project.assets.sprites));
      setSelActor(null);
      setDirty(false);
      setStatus(`Projet « ${d.project.name} » — ${d.project.scenes.length} scènes`);
    } catch (e) {
      setStatus(`Erreur d'ouverture : ${e}`);
    }
  }

  async function save() {
    if (!data) return;
    try {
      await saveProject(data);
      setDirty(false);
      setStatus("Sauvegardé. Regénère les données moteur avec « make data ».");
    } catch (e) {
      setStatus(`Erreur de sauvegarde : ${e}`);
    }
  }

  const setScene = useCallback(
    (updater: (sc: Scene) => Scene) => {
      setData((d) => {
        if (!d || !sceneName) return d;
        const sc = d.scenes[sceneName];
        const next = updater(sc);
        if (next === sc) return d;
        return { ...d, scenes: { ...d.scenes, [sceneName]: next } };
      });
      setDirty(true);
    },
    [sceneName]
  );

  function handlePaint(tx: number, ty: number) {
    switch (tool.kind) {
      case "tile":
        setScene((sc) => paintTile(sc, tx, ty, tool.index));
        break;
      case "collision":
        setScene((sc) => paintCollision(sc, tx, ty, tool.solid));
        break;
      case "actor":
        setScene((sc) => placeActor(sc, tx, ty));
        setTab("actors");
        break;
      case "player_start":
        setScene((sc) => setPlayerStart(sc, tx, ty));
        break;
      case "select":
        break;
    }
  }

  // Ctrl+S
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="app">
      <div className="toolbar">
        <button onClick={openProject}>Ouvrir…</button>
        <button onClick={save} disabled={!data || !dirty}>
          Sauvegarder{dirty ? " *" : ""}
        </button>
        {data && (
          <select value={sceneName} onChange={(e) => { setSceneName(e.target.value); setSelActor(null); }}>
            {data.project.scenes.map((s) => (
              <option key={s} value={s}>
                {s}
                {s === data.project.boot_scene ? " (boot)" : ""}
              </option>
            ))}
          </select>
        )}
        <label>
          <input
            type="checkbox"
            checked={showCollision}
            onChange={(e) => setShowCollision(e.target.checked)}
          />
          Collision
        </label>
        <label>
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
          Grille
        </label>
        <span className="status">{status}</span>
      </div>

      {data && scene ? (
        <div className="workspace">
          <TilePalette tileset={tileset} tool={tool} onTool={setTool} />
          <div className="map-scroll">
            <MapCanvas
              scene={scene}
              tileset={tileset}
              sprites={sprites}
              tool={tool}
              showCollision={showCollision}
              showGrid={showGrid}
              onPaint={handlePaint}
              onSelectActor={(i) => {
                setSelActor(i);
                setTab("actors");
              }}
            />
          </div>
          <div className="sidebar">
            <div className="tabs">
              <button className={tab === "actors" ? "active" : ""} onClick={() => setTab("actors")}>
                Acteurs
              </button>
              <button className={tab === "script" ? "active" : ""} onClick={() => setTab("script")}>
                Script
              </button>
              <button className={tab === "texts" ? "active" : ""} onClick={() => setTab("texts")}>
                Textes
              </button>
            </div>
            {tab === "actors" && (
              <ActorPanel
                scene={scene}
                selected={selActor}
                onSelect={setSelActor}
                onUpdate={(i, patch: Partial<Actor>) => setScene((sc) => updateActor(sc, i, patch))}
                onRemove={(i) => {
                  setScene((sc) => removeActor(sc, i));
                  setSelActor(null);
                }}
              />
            )}
            {tab === "script" && (
              <ScriptPanel
                script={scene.script}
                onChange={(script) => setScene((sc) => ({ ...sc, script }))}
              />
            )}
            {tab === "texts" && (
              <TextsPanel
                texts={data.texts}
                onChange={(texts) => {
                  setData((d) => (d ? { ...d, texts } : d));
                  setDirty(true);
                }}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="empty">
          <p>SNES Studio — éditeur (Phase 3a)</p>
          <button onClick={openProject}>Ouvrir un projet…</button>
        </div>
      )}
    </div>
  );
}
