// SNES Studio — éditeur.
// Ouvre un dossier projet (les JSON/PNG que tools/datagen consomme) et
// édite maps (2 couches + autotiles + passabilité, modèle RPG Maker 2003),
// acteurs, warps, textes, scripts ; undo/redo, gestion des scènes,
// sauvegarde, génération des données moteur.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Actor, Layer, ProjectData, Scene, TilesetMeta, Warp } from "./types";
import { assetStem, musicStem, projectTilesets } from "./types";
import {
  canWriteFiles,
  importTilesetPng,
  loadAssetPng,
  loadAutotiles,
  loadProject,
  pickPngFile,
  pickProjectDir,
  saveProject,
} from "./io";
import { runImportChipset } from "./build";
import type { DrawMode, Tool } from "./state";
import {
  cyclePassability,
  newScene,
  paintCells,
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
import { canBuild, launchEmulator, runDatagen, runMake } from "./build";
import SettingsModal from "./components/SettingsModal";
import type { PlayConfig } from "./components/SettingsModal";
import MapCanvas from "./components/MapCanvas";
import TilePalette from "./components/TilePalette";
import ScenePanel from "./components/ScenePanel";
import ActorPanel from "./components/ActorPanel";
import TextsPanel from "./components/TextsPanel";
import ScriptPanel from "./components/ScriptPanel";
import WarpsPanel from "./components/WarpsPanel";
import NewSceneModal from "./components/NewSceneModal";

type Tab = "scene" | "actors" | "warps" | "script" | "texts";

export default function App() {
  const [data, setData] = useState<ProjectData | null>(null);
  const [sceneName, setSceneName] = useState<string>("");
  const [tilesets, setTilesets] = useState<Record<string, ImageBitmap>>({});
  const [autoImgs, setAutoImgs] = useState<Record<string, ImageBitmap[]>>({});
  const [sprites, setSprites] = useState<ImageBitmap | null>(null);
  const [tool, setTool] = useState<Tool>({ kind: "tile", tiles: [[0]] });
  const [drawMode, setDrawMode] = useState<DrawMode>("pen");
  const [layer, setLayer] = useState<Layer>("lower");
  const [passMode, setPassMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playCfg, setPlayCfg] = useState<PlayConfig>(() => ({
    bash: localStorage.getItem("snesstudio.bash") ?? "C:\\msys64\\usr\\bin\\bash.exe",
    emulator: localStorage.getItem("snesstudio.emulator") ?? "mesen",
  }));
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<Tab>("scene");
  const [selActor, setSelActor] = useState<number | null>(null);
  const [showCollision, setShowCollision] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [hoverPos, setHoverPos] = useState<[number, number] | null>(null);
  // zoom façon RM2003 : 1/1, 1/2, 1/4, 1/8 (taille de tile à l'écran)
  const [zoomIdx, setZoomIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("Ouvre un dossier projet (ex. demo/)");
  const [showNewScene, setShowNewScene] = useState(false);
  const [building, setBuilding] = useState(false);

  const ZOOMS = [32, 16, 8, 4];
  const ZOOM_LABELS = ["1/1", "1/2", "1/4", "1/8"];
  const mapColRef = useRef<HTMLDivElement>(null);

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

  // (re)chargement complet du projet depuis le disque
  async function reloadProject(root: string, keepScene?: string) {
    const d = await loadProject(root);
    const bitmaps: Record<string, ImageBitmap> = {};
    const autos: Record<string, ImageBitmap[]> = {};
    for (const p of projectTilesets(d.project)) {
      const stem = assetStem(p);
      bitmaps[stem] = await loadAssetPng(root, p);
      autos[stem] = await loadAutotiles(root, d.tilesetMeta[stem]);
    }
    setData(d);
    setSceneName(keepScene && d.scenes[keepScene] ? keepScene : d.project.boot_scene);
    setTilesets(bitmaps);
    setAutoImgs(autos);
    setSprites(await loadAssetPng(root, d.project.assets.sprites));
    setSelActor(null);
    setLayer("lower");
    setPassMode(false);
    setDirty(false);
    history.reset();
    return d;
  }

  async function openProject() {
    const root = await pickProjectDir();
    if (!root) return;
    try {
      const d = await reloadProject(root);
      setStatus(`Projet « ${d.project.name} » — ${d.project.scenes.length} scènes`);
    } catch (e) {
      setStatus(`Erreur d'ouverture : ${e}`);
    }
  }

  // Import d'un chipset RPG Maker 2003 (480x256) : découpe via datagen
  // puis rechargement du projet (project.json et assets modifiés sur disque)
  async function importChipset() {
    if (!data) return;
    const file = await pickPngFile("Importer un chipset RPG Maker 2003 (480x256)");
    if (!file) return;
    const name =
      (file.split(/[\\/]/).pop() ?? "chipset")
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_") || "chipset";
    const root = data.root;
    const scene = sceneName;
    try {
      await saveProject(data); // l'import réécrit project.json sur disque
      setStatus("Import du chipset…");
      const res = await runImportChipset(root, file, name);
      if (!res.ok) {
        setStatus(`Import chipset : ${res.output.slice(-300)}`);
        return;
      }
      await reloadProject(root, scene);
      setStatus(`Chipset importé : tileset « ${name} » (288 tiles + 13 autotiles)`);
    } catch (e) {
      setStatus(`Import chipset : ${e}`);
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

  // mutation avec enregistrement dans l'historique — record=false pour les
  // pas suivants d'un même geste (un tracé au crayon = une entrée d'undo)
  const mutate = useCallback(
    (updater: (d: ProjectData) => ProjectData, record = true) => {
      setData((d) => {
        if (!d) return d;
        const next = updater(d);
        if (next === d) return d;
        if (record) history.record(d);
        return next;
      });
      setDirty(true);
    },
    [history]
  );

  const setScene = useCallback(
    (updater: (sc: Scene) => Scene, record = true) => {
      mutate((d) => {
        if (!sceneName) return d;
        const sc = d.scenes[sceneName];
        const next = updater(sc);
        if (next === sc) return d;
        return { ...d, scenes: { ...d.scenes, [sceneName]: next } };
      }, record);
    },
    [mutate, sceneName]
  );

  function handlePaint(tx: number, ty: number, ox: number, oy: number, first: boolean) {
    switch (tool.kind) {
      case "tile":
        setScene((sc) => paintStamp(sc, layer, tx, ty, ox, oy, tool.tiles), first);
        break;
      case "actor":
        setScene((sc) => placeActor(sc, tx, ty), first);
        setTab("actors");
        break;
      case "warp": {
        const other = data?.project.scenes.find((s) => s !== sceneName);
        if (!other) {
          setStatus("Il faut au moins deux scènes pour poser un warp.");
          break;
        }
        setScene((sc) => placeWarp(sc, meta, tx, ty, other), first);
        setTab("warps");
        break;
      }
      case "player_start":
        setScene((sc) => setPlayerStart(sc, tx, ty), first);
        break;
      case "select":
        break;
    }
  }

  // rectangle / ellipse / pot de peinture : un geste = une entrée d'undo
  function applyPattern(cells: Array<[number, number]>, ax: number, ay: number) {
    if (tool.kind !== "tile") return;
    setScene((sc) => paintCells(sc, layer, cells, ax, ay, tool.tiles));
  }

  // pipette (clic droit) : le bloc copié depuis la map devient le tampon
  function pickBlock(tiles: number[][]) {
    if (tiles.length === 0 || tiles[0].length === 0) return;
    setTool({ kind: "tile", tiles });
  }

  // Jouer : sauvegarde → datagen → make (MSYS2) → émulateur
  async function play() {
    if (!data || playing) return;
    setPlaying(true);
    try {
      await save();
      setStatus("datagen…");
      const gen = await runDatagen(data.root);
      if (!gen.ok) {
        setStatus(`datagen a échoué : ${gen.output.slice(-300)}`);
        return;
      }
      setStatus("Compilation du ROM (make)…");
      const mk = await runMake(data.root, playCfg.bash);
      if (!mk.ok) {
        setStatus(`make a échoué : ${mk.output.slice(-400)}`);
        return;
      }
      setStatus("Lancement de l'émulateur…");
      const em = await launchEmulator(data.root, playCfg.emulator);
      setStatus(em.ok ? "ROM compilé et lancé dans l'émulateur." : `Émulateur : ${em.output.slice(-200)}`);
    } catch (e) {
      setStatus(`Jouer : ${e}`);
    } finally {
      setPlaying(false);
    }
  }

  function savePlayCfg(c: PlayConfig) {
    setPlayCfg(c);
    localStorage.setItem("snesstudio.bash", c.bash);
    localStorage.setItem("snesstudio.emulator", c.emulator);
    setShowSettings(false);
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

  // Ctrl + molette sur la map : zoom RM2003 (listener non-passif pour
  // pouvoir bloquer le zoom du navigateur)
  useEffect(() => {
    const el = mapColRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoomIdx((z) => Math.max(0, Math.min(3, z + (e.deltaY > 0 ? 1 : -1))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [data, sceneName]);

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
          <button onClick={generate} disabled={building || playing}>
            {building ? "Génération…" : "Générer les données"}
          </button>
        )}
        {data && canBuild() && (
          <button
            onClick={play}
            disabled={playing || building}
            title="Sauvegarder, régénérer les données, compiler le ROM et le lancer dans l'émulateur (chemins : ⚙)"
          >
            {playing ? "…" : "▶ Jouer"}
          </button>
        )}
        {canBuild() && (
          <button onClick={() => setShowSettings(true)} title="Réglages (bash MSYS2, émulateur)">
            ⚙
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
            tool={tool}
            layer={layer}
            passMode={passMode}
            drawMode={drawMode}
            onTool={setTool}
            onDrawMode={setDrawMode}
            onCyclePassability={cyclePass}
          />
          <div className="map-col" ref={mapColRef}>
            <div className="map-scroll">
              <MapCanvas
                scene={scene}
                tileset={tileset}
                autotiles={autotiles}
                meta={meta}
                sprites={sprites}
                tool={tool}
                layer={layer}
                drawMode={drawMode}
                ts={ZOOMS[zoomIdx]}
                showCollision={showCollision}
                showGrid={showGrid}
                onPaint={handlePaint}
                onApplyPattern={applyPattern}
                onPickBlock={pickBlock}
                onHover={setHoverPos}
                onSelectActor={(i) => {
                  setSelActor(i);
                  setTab("actors");
                }}
              />
            </div>
            <div className="map-status">
              <span>{hoverPos ? `${hoverPos[0]}, ${hoverPos[1]}` : " "}</span>
              <span className="zoom-group" title="Zoom (Ctrl + molette)">
                {ZOOM_LABELS.map((l, i) => (
                  <button
                    key={l}
                    className={zoomIdx === i ? "active" : ""}
                    onClick={() => setZoomIdx(i)}
                  >
                    {l}
                  </button>
                ))}
              </span>
            </div>
          </div>
          <div className="sidebar">
            <div className="tabs">
              <button className={tab === "scene" ? "active" : ""} onClick={() => setTab("scene")}>
                Scène
              </button>
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
            {tab === "scene" && (
              <ScenePanel
                scene={scene}
                tilesetNames={tilesetNames}
                current={tsStem}
                canImport={canWriteFiles()}
                passMode={passMode}
                onSelectTileset={setSceneTileset}
                onImport={importTileset}
                onImportChipset={importChipset}
                onPassMode={setPassMode}
                onResize={(w, h) => setScene((sc) => resizeScene(sc, w, h))}
              />
            )}
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
      {showSettings && (
        <SettingsModal
          config={playCfg}
          onSave={savePlayCfg}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
