// SNES Studio — éditeur (Phase 3b).
// Ouvre un dossier projet (les JSON/PNG que tools/datagen consomme),
// édite maps / collision / acteurs / textes / scripts, undo/redo,
// gestion des scènes, sauvegarde, génération des données moteur.

import { useCallback, useEffect, useState } from "react";
import type { Actor, ProjectData, Scene, Warp } from "./types";
import { musicStem } from "./types";
import { loadAssetPng, loadProject, pickProjectDir, saveProject } from "./io";
import type { Tool } from "./state";
import {
  newScene,
  paintCollision,
  paintTile,
  placeActor,
  placeWarp,
  removeActor,
  removeWarp,
  setPlayerStart,
  updateActor,
  updateWarp,
} from "./state";
import { useHistory } from "./history";
import { canBuild, runDatagen } from "./build";
import MapCanvas from "./components/MapCanvas";
import TilePalette from "./components/TilePalette";
import ActorPanel from "./components/ActorPanel";
import TextsPanel from "./components/TextsPanel";
import ScriptPanel from "./components/ScriptPanel";
import WarpsPanel from "./components/WarpsPanel";
import NewSceneModal from "./components/NewSceneModal";

type Tab = "actors" | "warps" | "script" | "texts";

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
  const [showNewScene, setShowNewScene] = useState(false);
  const [building, setBuilding] = useState(false);

  const history = useHistory();
  const scene: Scene | null = data && sceneName ? data.scenes[sceneName] ?? null : null;

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
      history.reset();
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
      setStatus("Sauvegardé.");
    } catch (e) {
      setStatus(`Erreur de sauvegarde : ${e}`);
    }
  }

  async function generate() {
    if (!data) return;
    await save();
    setBuilding(true);
    setStatus("datagen en cours…");
    try {
      const res = await runDatagen(data.root);
      setStatus(
        res.ok
          ? "Données moteur regénérées — reste « make » dans engine/."
          : `datagen a échoué : ${res.output.slice(-400)}`
      );
    } catch (e) {
      setStatus(`datagen : ${e}`);
    } finally {
      setBuilding(false);
    }
  }

  // mutation avec enregistrement dans l'historique
  const mutate = useCallback(
    (updater: (d: ProjectData) => ProjectData) => {
      setData((d) => {
        if (!d) return d;
        const next = updater(d);
        if (next === d) return d;
        history.record(d);
        return next;
      });
      setDirty(true);
    },
    [history]
  );

  const setScene = useCallback(
    (updater: (sc: Scene) => Scene) => {
      mutate((d) => {
        if (!sceneName) return d;
        const sc = d.scenes[sceneName];
        const next = updater(sc);
        if (next === sc) return d;
        return { ...d, scenes: { ...d.scenes, [sceneName]: next } };
      });
    },
    [mutate, sceneName]
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
      case "warp": {
        const other = data?.project.scenes.find((s) => s !== sceneName);
        if (!other) {
          setStatus("Il faut au moins deux scènes pour poser un warp.");
          break;
        }
        setScene((sc) => placeWarp(sc, tx, ty, other));
        setTab("warps");
        break;
      }
      case "player_start":
        setScene((sc) => setPlayerStart(sc, tx, ty));
        break;
      case "select":
        break;
    }
  }

  function createScene(name: string, width: number, height: number) {
    mutate((d) => ({
      ...d,
      project: { ...d.project, scenes: [...d.project.scenes, name] },
      scenes: { ...d.scenes, [name]: newScene(name, width, height) },
    }));
    setSceneName(name);
    setSelActor(null);
    setShowNewScene(false);
  }

  function deleteScene() {
    if (!data || !sceneName) return;
    if (sceneName === data.project.boot_scene) {
      setStatus("Impossible de supprimer la scène de boot.");
      return;
    }
    if (data.project.scenes.length <= 1) return;
    const remaining = data.project.scenes.filter((s) => s !== sceneName);
    mutate((d) => {
      const scenes = { ...d.scenes };
      delete scenes[sceneName];
      return { ...d, project: { ...d.project, scenes: remaining }, scenes };
    });
    setSceneName(remaining[0]);
    setSelActor(null);
  }

  function setBootScene() {
    if (!data || !sceneName) return;
    mutate((d) => ({ ...d, project: { ...d.project, boot_scene: sceneName } }));
  }

  const doUndo = useCallback(() => {
    setData((d) => {
      if (!d) return d;
      const prev = history.undo(d);
      if (!prev) return d;
      setDirty(true);
      return prev;
    });
  }, [history]);

  const doRedo = useCallback(() => {
    setData((d) => {
      if (!d) return d;
      const next = history.redo(d);
      if (!next) return d;
      setDirty(true);
      return next;
    });
  }, [history]);

  // raccourcis clavier
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "s") {
        e.preventDefault();
        void save();
      } else if (e.key === "z" && !e.shiftKey) {
        // pas d'interception dans les champs texte (ils gèrent leur propre undo)
        const t = e.target as HTMLElement;
        if (t.tagName === "TEXTAREA" || t.tagName === "INPUT") return;
        e.preventDefault();
        doUndo();
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        const t = e.target as HTMLElement;
        if (t.tagName === "TEXTAREA" || t.tagName === "INPUT") return;
        e.preventDefault();
        doRedo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // garde-fou : la scène affichée peut avoir disparu après un undo
  useEffect(() => {
    if (data && !data.scenes[sceneName]) {
      setSceneName(data.project.boot_scene);
      setSelActor(null);
    }
  }, [data, sceneName]);

  return (
    <div className="app">
      <div className="toolbar">
        <button onClick={openProject}>Ouvrir…</button>
        <button onClick={save} disabled={!data || !dirty}>
          Sauvegarder{dirty ? " *" : ""}
        </button>
        {data && canBuild() && (
          <button onClick={generate} disabled={building}>
            {building ? "Génération…" : "Générer les données"}
          </button>
        )}
        {data && (
          <>
            <select
              value={sceneName}
              onChange={(e) => {
                setSceneName(e.target.value);
                setSelActor(null);
              }}
            >
              {data.project.scenes.map((s) => (
                <option key={s} value={s}>
                  {s}
                  {s === data.project.boot_scene ? " ★" : ""}
                </option>
              ))}
            </select>
            <button onClick={() => setShowNewScene(true)}>+ Scène</button>
            <button
              onClick={setBootScene}
              disabled={!sceneName || sceneName === data.project.boot_scene}
              title="Définir comme scène de boot"
            >
              ★ Boot
            </button>
            <button
              className="danger"
              onClick={deleteScene}
              disabled={!sceneName || sceneName === data.project.boot_scene}
              title="Supprimer cette scène"
            >
              Suppr. scène
            </button>
          </>
        )}
        {data && scene && (
          <label title="Musique de la scène">
            ♪
            <select
              value={scene.music ?? ""}
              onChange={(e) =>
                setScene((sc) => ({
                  ...sc,
                  music: e.target.value === "" ? undefined : e.target.value,
                }))
              }
            >
              <option value="">aucune</option>
              {(data.project.musics ?? []).map((m) => (
                <option key={m} value={musicStem(m)}>
                  {musicStem(m)}
                </option>
              ))}
            </select>
          </label>
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
              <button className={tab === "warps" ? "active" : ""} onClick={() => setTab("warps")}>
                Warps
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
            {tab === "warps" && (
              <WarpsPanel
                scene={scene}
                sceneNames={data.project.scenes}
                onUpdate={(i, patch: Partial<Warp>) => setScene((sc) => updateWarp(sc, i, patch))}
                onRemove={(i) => setScene((sc) => removeWarp(sc, i))}
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
                onChange={(texts) => mutate((d) => ({ ...d, texts }))}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="empty">
          <p>SNES Studio — éditeur (Phase 3b)</p>
          <button onClick={openProject}>Ouvrir un projet…</button>
        </div>
      )}

      {showNewScene && data && (
        <NewSceneModal
          existing={data.project.scenes}
          onCreate={createScene}
          onClose={() => setShowNewScene(false)}
        />
      )}
    </div>
  );
}
