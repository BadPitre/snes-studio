// SNES Studio — éditeur.
// Ouvre un dossier projet (les JSON/PNG que tools/datagen consomme) et
// édite maps (2 couches + autotiles + passabilité, modèle RPG Maker 2003),
// acteurs, warps, textes, scripts ; undo/redo, gestion des scènes,
// sauvegarde, génération des données moteur.

import { useCallback, useEffect, useState } from "react";
import type { Actor, Layer, ProjectData, Scene, TilesetMeta, Warp } from "./types";
import { assetStem, musicStem, projectTilesets } from "./types";
import {
  canWriteFiles,
  importTilesetPng,
  loadAssetPng,
  loadAutotiles,
  loadProject,
  pickProjectDir,
  saveProject,
} from "./io";
import type { Tool } from "./state";
import {
  cyclePassability,
  newScene,
  paintStamp,
  placeActor,
  placeWarp,
  removeActor,
  removeWarp,
  resizeScene,
  setPlayerStart,
  updateActor,
  updateWarp,
} from "./state";
import { useHistory } from "./history";
import { canBuild, runDatagen } from "./build";
import MapCanvas from "./components/MapCanvas";
import TilePalette from "./components/TilePalette";
import ResizeSceneModal from "./components/ResizeSceneModal";
import ActorPanel from "./components/ActorPanel";
import TextsPanel from "./components/TextsPanel";
import ScriptPanel from "./components/ScriptPanel";
import WarpsPanel from "./components/WarpsPanel";
import NewSceneModal from "./components/NewSceneModal";

type Tab = "actors" | "warps" | "script" | "texts";

export default function App() {
  const [data, setData] = useState<ProjectData | null>(null);
  const [sceneName, setSceneName] = useState<string>("");
  const [tilesets, setTilesets] = useState<Record<string, ImageBitmap>>({});
  const [autoImgs, setAutoImgs] = useState<Record<string, ImageBitmap[]>>({});
  const [sprites, setSprites] = useState<ImageBitmap | null>(null);
  const [tool, setTool] = useState<Tool>({ kind: "tile", tiles: [[0]] });
  const [layer, setLayer] = useState<Layer>("lower");
  const [passMode, setPassMode] = useState(false);
  const [tab, setTab] = useState<Tab>("actors");
  const [selActor, setSelActor] = useState<number | null>(null);
  const [showCollision, setShowCollision] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("Ouvre un dossier projet (ex. demo/)");
  const [showNewScene, setShowNewScene] = useState(false);
  const [showResize, setShowResize] = useState(false);
  const [building, setBuilding] = useState(false);

  const history = useHistory();
  const scene: Scene | null = data && sceneName ? data.scenes[sceneName] ?? null : null;
  // tileset de la scène : stem déclaré, sinon le premier du projet
  const tilesetPaths = data ? projectTilesets(data.project) : [];
  const tilesetNames = tilesetPaths.map(assetStem);
  const tsStem = scene ? scene.tileset ?? tilesetNames[0] : "";
  const tileset = tilesets[tsStem] ?? null;
  const emptyMeta: TilesetMeta = { autotiles: [], solid: [], above: [] };
  const meta = (data && data.tilesetMeta[tsStem]) || emptyMeta;
  const autotiles = autoImgs[tsStem] ?? [];

  async function openProject() {
    const root = await pickProjectDir();
    if (!root) return;
    try {
      const d = await loadProject(root);
      const bitmaps: Record<string, ImageBitmap> = {};
      const autos: Record<string, ImageBitmap[]> = {};
      for (const p of projectTilesets(d.project)) {
        const stem = assetStem(p);
        bitmaps[stem] = await loadAssetPng(root, p);
        autos[stem] = await loadAutotiles(root, d.tilesetMeta[stem]);
      }
      setData(d);
      setSceneName(d.project.boot_scene);
      setTilesets(bitmaps);
      setAutoImgs(autos);
      setSprites(await loadAssetPng(root, d.project.assets.sprites));
      setSelActor(null);
      setLayer("lower");
      setPassMode(false);
      setDirty(false);
      history.reset();
      setStatus(`Projet « ${d.project.name} » — ${d.project.scenes.length} scènes`);
    } catch (e) {
      setStatus(`Erreur d'ouverture : ${e}`);
    }
  }

  // import d'un PNG : copié dans assets/, ajouté à project.tilesets
  async function importTileset() {
    if (!data) return;
    try {
      const rel = await importTilesetPng(data.root);
      if (!rel) return;
      const stem = assetStem(rel);
      const bmp = await loadAssetPng(data.root, rel);
      setTilesets((t) => ({ ...t, [stem]: bmp }));
      mutate((d) => {
        const cur = projectTilesets(d.project);
        if (cur.includes(rel)) return d; // ré-import : bitmap rafraîchie, liste inchangée
        return { ...d, project: { ...d.project, tilesets: [...cur, rel] } };
      });
      setStatus(`Tileset importé : ${stem}`);
    } catch (e) {
      setStatus(`Import tileset : ${e}`);
    }
  }

  function setSceneTileset(stem: string) {
    // le premier tileset du projet est le défaut : on ne sérialise pas le champ
    setScene((sc) => ({
      ...sc,
      tileset: stem === tilesetNames[0] ? undefined : stem,
    }));
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

  function handlePaint(tx: number, ty: number, ox: number, oy: number) {
    switch (tool.kind) {
      case "tile":
        setScene((sc) => paintStamp(sc, layer, tx, ty, ox, oy, tool.tiles));
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
        setScene((sc) => placeWarp(sc, meta, tx, ty, other));
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

  // cycle O → X → ☆ du sidecar du tileset courant (undo/redo comme le reste)
  function cyclePass(id: number) {
    if (!tsStem) return;
    mutate((d) => ({
      ...d,
      tilesetMeta: {
        ...d.tilesetMeta,
        [tsStem]: cyclePassability(d.tilesetMeta[tsStem] ?? emptyMeta, id),
      },
    }));
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
              onClick={() => setShowResize(true)}
              disabled={!scene}
              title="Redimensionner cette scène"
            >
              Redim.
            </button>
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
          <span className="layer-switch" title="Couche éditée (modèle RPG Maker 2003)">
            <button
              className={layer === "lower" ? "active" : ""}
              onClick={() => setLayer("lower")}
            >
              Couche inf.
            </button>
            <button
              className={layer === "upper" ? "active" : ""}
              onClick={() => setLayer("upper")}
            >
              Couche sup.
            </button>
          </span>
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
          <TilePalette
            tileset={tileset}
            autotiles={autotiles}
            meta={meta}
            tilesetNames={tilesetNames}
            current={tsStem}
            canImport={canWriteFiles()}
            tool={tool}
            layer={layer}
            passMode={passMode}
            onTool={setTool}
            onSelectTileset={setSceneTileset}
            onImport={importTileset}
            onPassMode={setPassMode}
            onCyclePassability={cyclePass}
          />
          <div className="map-scroll">
            <MapCanvas
              scene={scene}
              tileset={tileset}
              autotiles={autotiles}
              meta={meta}
              sprites={sprites}
              tool={tool}
              layer={layer}
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
      {showResize && scene && (
        <ResizeSceneModal
          width={scene.width}
          height={scene.height}
          onResize={(w, h) => {
            setScene((sc) => resizeScene(sc, w, h));
            setShowResize(false);
          }}
          onClose={() => setShowResize(false)}
        />
      )}
    </div>
  );
}
