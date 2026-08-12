// SNES Studio — the editor.
// Opens a project folder (the JSON/PNG files tools/datagen consumes) and
// edits maps (2 layers + autotiles + passability, RPG Maker 2003 model),
// actors, warps, texts, scripts; undo/redo, scene management, saving,
// generation of the engine data.

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEvent, Layer, ProjectData, Scene, SceneKind, TilesetMeta } from "./types";
import {
  assetStem,
  charsetName,
  eventAt,
  musicStem,
  projectFonts,
  projectIconsets,
  picPath,
  projectMode7,
  projectPictures,
  projectTilesetDefs,
  projectTilesets,
  projectWindowskins,
  spriteBlockCount,
} from "./types";
import {
  canWriteFiles,
  ensureProjectDir,
  importTilesetPng,
  loadAssetPng,
  loadAutotiles,
  loadPngBitmap,
  loadProject,
  pickFile,
  pickPngFile,
  pickProjectDir,
  pickSavePath,
  readBinaryFile,
  removePath,
  renamePath,
  saveProject,
  writeBinaryFile,
  writeProjectText,
} from "./io";
import type { ResCtx, ResKind } from "./resources";
import { RESOURCES, runDelete, runExport, runImport, runRename } from "./resources";
import RomRipModal, { type RipTarget } from "./components/RomRipModal";
import { loadSpc } from "./brr";
import { looksLikeState } from "./s9xstate";
import { openProjectFolder, runImportCharset, runImportChipset } from "./build";
import type { DrawMode, Tool } from "./state";
import {
  addEvent,
  cyclePassability,
  newScene,
  nextEventName,
  paintCells,
  paintStamp,
  placeWarp,
  removeEvent,
  removeWarp,
  resizeScene,
  setPlayerStart,
  updateEvent,
  updateWarp,
} from "./state";
import { scriptLabels } from "./state";
import { useHistory } from "./history";
import { canBuild, launchEmulator, runDatagen, runMake, runMakeCart } from "./build";
import SettingsModal from "./components/SettingsModal";
import type { PlayConfig } from "./components/SettingsModal";
import MapCanvas from "./components/MapCanvas";
import TilePalette from "./components/TilePalette";
import TilesetsModal from "./components/TilesetsModal";
import AnimationsModal from "./components/AnimationsModal";
import ScenePanel from "./components/ScenePanel";
import M7PreviewModal from "./components/M7PreviewModal";
import EffectPanel from "./components/EffectPanel";
import SceneTree from "./components/SceneTree";
import EventEditorModal from "./components/EventEditorModal";
import VarListModal from "./components/VarListModal";
import CommonEventsModal from "./components/CommonEventsModal";
import FunctionsModal from "./components/FunctionsModal";
import { migrateFunctions } from "./migrate";
import ScreensModal from "./components/ScreensModal";
import { PrefabsModal, SavePrefabModal } from "./components/PrefabModals";
import TransferPlayerModal from "./components/TransferPlayerModal";
import DatabaseModal from "./components/DatabaseModal";
import TextsModal from "./components/TextsModal";
import UiThemeModal, { loadUiLayout2 } from "./components/UiThemeModal";
import { layoutToToml, rootsOf } from "./uilayout";
import { loadDatabase, saveDatabase } from "./db";
import type { Database } from "./db";
import ScriptPanel from "./components/ScriptPanel";
import NewSceneModal from "./components/NewSceneModal";
import CharsetImportModal from "./components/CharsetImportModal";
import ResourceManagerModal from "./components/ResourceManagerModal";
import TransparencyPickModal, { applyTransparency } from "./components/TransparencyPickModal";
import type { Rgb } from "./components/TransparencyPickModal";
import MenuBar from "./components/MenuBar";
import DiagnosticsModal from "./components/DiagnosticsModal";
import type { DatagenReport } from "./components/DiagnosticsModal";
import { checkProject } from "./diagnostics";
import type { Diag } from "./diagnostics";
import { scaffoldProject } from "./template";
import pkg from "../package.json";

// Actors / Warps / Texts have left the sidebar: events and warps are
// handled on the map (double-click, right-click), and the texts live in
// Tools > Textes… (a window with categories)
type Tab = "scene" | "effect" | "script";

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
    toolchain: localStorage.getItem("snesstudio.toolchain") ?? "",
    emulator: localStorage.getItem("snesstudio.emulator") ?? "mesen",
    debug: localStorage.getItem("snesstudio.debug") === "1",
  }));
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<Tab>("scene");
  const [selEvent, setSelEvent] = useState<number | null>(null);
  // context menu of the Events layer + Event Editor + warp mini-modal
  const [evMenu, setEvMenu] = useState<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [evEdit, setEvEdit] = useState<{ index: number; ev: GameEvent } | null>(null);
  const [warpEdit, setWarpEdit] = useState<number | null>(null);
  const [showCollision, setShowCollision] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [hoverPos, setHoverPos] = useState<[number, number] | null>(null);
  // RM2003-style zoom: 1/1, 1/2, 1/4, 1/8 (tile size on screen)
  const [zoomIdx, setZoomIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("Ouvre un dossier projet (ex. demo/)");
  // Editor theme (light D by default / dark E) — remembered
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("snesstudio-theme") === "dark" ? "dark" : "light")
  );
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("snesstudio-theme", theme);
  }, [theme]);
  const [showNewScene, setShowNewScene] = useState(false);
  const [newSceneParent, setNewSceneParent] = useState<string | null>(null);
  // charset import in progress (file chosen, awaiting the character/block)
  // Transparent colour picker at import (S4): the validated image waits
  // for the colour to be chosen (or "sans transparence")
  const [transPick, setTransPick] = useState<null | {
    kind: "iconset" | "picture" | "charset";
    file: string;
    bytes: Uint8Array;
    bmp: ImageBitmap;
  }>(null);
  const [charsetImport, setCharsetImport] = useState<{ path: string; bmp: ImageBitmap } | null>(
    null
  );
  // resource manager (RM2003 style)
  const [showResources, setShowResources] = useState(false);
  // Aide > À propos menu
  const [showAbout, setShowAbout] = useState(false);
  // diagnostics window (Tools > Vérifier le projet)
  const [diags, setDiags] = useState<Diag[] | null>(null);
  const [varMgr, setVarMgr] = useState(false); // Switches/Variables window
  const [commonEvOpen, setCommonEvOpen] = useState(false); // Common events (v0.16)
  const [fnOpen, setFnOpen] = useState(false); // Fonctions (F1)
  const [screensOpen, setScreensOpen] = useState(false); // Composed screens (B6bis)
  // prefabs (v0.16): saving (the source event), creating (the target
  // position) and managing (Tools)
  const [prefabSave, setPrefabSave] = useState<GameEvent | null>(null);
  const [prefabPickAt, setPrefabPickAt] = useState<{ tx: number; ty: number } | null>(null);
  const [prefabMgr, setPrefabMgr] = useState(false);
  // CELL cursor of the Events layer (v0.16): the target of Ctrl+V
  const [evCursor, setEvCursor] = useState<[number, number] | null>(null);
  // Database (Phase 10): schemas + instances (null = no schemas/)
  const [db, setDb] = useState<Database | null>(null);
  // Battle data (C5): the fixed-format files of data/ (null = none)
  const [dbOpen, setDbOpen] = useState(false);
  const [tilesetsOpen, setTilesetsOpen] = useState(false); // Tilesets window (T1)
  const [animsOpen, setAnimsOpen] = useState(false); // Animations window (A1-c)
  // ROM ripper (X1/X2/X5): "rom" opens on the tile viewer, "music" is
  // entered by its audio side and carries the .spc already picked.
  const [ripOpen, setRipOpen] = useState<null | "rom" | "music">(null);
  const [ripFile, setRipFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  // Mode 7 preview (world maps): the flat map says nothing about the pitch
  const [m7Preview, setM7Preview] = useState(false);
  const [m7Sky, setM7Sky] = useState<ImageBitmap | null>(null);
  // Textes window (Tools >) — replaces the sidebar tab
  const [textsOpen, setTextsOpen] = useState(false);
  // UI window (Phase 12): null = closed, otherwise the requested mode
  const [uiMode, setUiMode] = useState<null | "widgets" | "dialogs">(null);
  // widgets of the layout (roots) — for the "Afficher un widget UI" command
  const [uiWidgets, setUiWidgets] = useState<string[]>([]);
  // dialogue styles (S1) — for the msg/choice "Boîte de dialogue" field
  const [uiStyles, setUiStyles] = useState<string[]>([]);
  const [diagReport, setDiagReport] = useState<DatagenReport | null>(null);
  // event clipboard (Edit menu + right-click)
  const [evClipboard, setEvClipboard] = useState<GameEvent | null>(null);
  // palette height (palette / tree splitter, persisted)
  const [paletteH, setPaletteH] = useState(() =>
    Number(localStorage.getItem("snesstudio.paletteH") ?? 460)
  );
  const splitDrag = useRef<{ y: number; h: number } | null>(null);
  const [building, setBuilding] = useState(false);

  const ZOOMS = [32, 16, 8, 4];
  const ZOOM_LABELS = ["1/1", "1/2", "1/4", "1/8"];
  const mapColRef = useRef<HTMLDivElement>(null);

  const history = useHistory();
  const scene: Scene | null = data && sceneName ? data.scenes[sceneName] ?? null : null;
  // the scene's tileset: the declared stem, otherwise the project's first
  const tilesetPaths = data ? projectTilesets(data.project) : [];
  const tilesetNames = tilesetPaths.map(assetStem);
  const tsStem = scene ? scene.tileset ?? tilesetNames[0] : "";
  // T2 — named tileset entries (Tilesets window, RM2003): the scenes
  // store the FILE's STEM, the entry is the editor-side face of it
  const tsDefs = data ? projectTilesetDefs(data.project) : [];
  const tsChoices = tsDefs.filter((d) => d.file);
  const tsCurrentDef =
    tsChoices.find((d) => assetStem(d.file) === tsStem)?.name ?? tsStem;
  const tileset = tilesets[tsStem] ?? null;
  const emptyMeta: TilesetMeta = { autotiles: [], solid: [], above: [] };
  const meta = (data && data.tilesetMeta[tsStem]) || emptyMeta;
  const autotiles = autoImgs[tsStem] ?? [];

  // Character blocks of the sprite sheet (v0.5: the project is no longer
  // limited — datagen compiles one set per scene, 5 blocks each at most)
  const spriteBlocks = spriteBlockCount(sprites);
  const blockNames = data
    ? Array.from({ length: spriteBlocks }, (_, b) => charsetName(data.project, b))
    : [];
  // resource -> scenes using it (deletion blocked while it is used)
  const usedCharsets: Record<number, string[]> = {};
  const usedChipsets: Record<string, string[]> = {};
  if (data) {
    for (const [n, sc] of Object.entries(data.scenes)) {
      for (const e of sc.events) {
        if (e.sprite < 0) continue; // invisible ones
        (usedCharsets[e.sprite] ??= []).includes(n) || usedCharsets[e.sprite].push(n);
      }
      const stem = sc.tileset ?? tilesetNames[0];
      (usedChipsets[stem] ??= []).push(n);
    }
  }

  // full (re)load of the project from disk
  async function reloadProject(root: string, keepScene?: string) {
    const d = migrateFunctions(await loadProject(root));
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
    // Database (Phase 10): schemas + instances, if the project has one
    try {
      setDb(await loadDatabase(root));
    } catch (e) {
      setDb(null);
      setStatus(`Database illisible : ${e}`);
    }
    try {
      const l = await loadUiLayout2(root);
      setUiWidgets(rootsOf(l.nodes).map((n) => n.id));
      setUiStyles(l.styles.map((s) => s.id));
    } catch {
      setUiWidgets([]);
      setUiStyles([]);
    }
    setSelEvent(null);
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

  // ---- Projet menu ---------------------------------------------------------

  // New project: a chosen (empty) folder -> a minimal project generated (a
  // 30x20 scene, with a starter tileset/characters/font embedded)
  async function newProject() {
    const root = await pickProjectDir();
    if (!root) return;
    try {
      let taken = false;
      try {
        await readBinaryFile(`${root}/project.json`);
        taken = true;
      } catch {
        /* no project.json: a free folder */
      }
      if (taken) {
        setStatus("Ce dossier contient déjà un projet — l'ouvrir plutôt");
        return;
      }
      await scaffoldProject(root);
      const d = await reloadProject(root);
      setStatus(`Projet « ${d.project.name} » créé — bon courage !`);
    } catch (e) {
      setStatus(`Nouveau projet : ${e}`);
    }
  }

  function closeProject() {
    if (!data) return;
    if (dirty && !confirm("Modifications non sauvegardées — fermer quand même ?")) return;
    setData(null);
    setSceneName("");
    setTilesets({});
    setAutoImgs({});
    setSprites(null);
    setSelEvent(null);
    setDirty(false);
    history.reset();
    setStatus("Ouvre un dossier projet (ex. demo/)");
  }

  async function quitApp() {
    if (dirty && !confirm("Modifications non sauvegardées — quitter quand même ?")) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch {
      window.close(); // browser mode
    }
  }

  // ---- Tools: project check ------------------------------------------------

  async function openDiagnostics() {
    if (!data) return;
    setDiags(checkProject(data, spriteBlocks));
    if (!canBuild()) {
      setDiagReport(null);
      return;
    }
    setDiagReport({ running: true, compression: [], warnings: [] });
    try {
      await saveProject(data); // datagen reads the disk
      const res = await runDatagen(data.root);
      const rep: DatagenReport = {
        running: false,
        ok: res.ok,
        compression: [],
        warnings: [],
      };
      for (const line of res.output.split("\n")) {
        const l = line.trim();
        if (l.startsWith("attention :")) rep.warnings.push(l.replace("attention :", "").trim());
        if (l.startsWith("grilles :") || l.startsWith("textes :")) rep.compression.push(l);
        // multi-bank (M1): datagen prints the pool totals
        const ms = l.match(/banks scenes : (\d+)\/(\d+) octets \((\d+) bank/);
        if (ms) {
          rep.scenesBytes = Number(ms[1]);
          rep.scenesCap = Number(ms[2]);
        }
        const mt = l.match(/banks textes : (\d+)\/(\d+) octets \((\d+) bank/);
        if (mt) {
          rep.textsBytes = Number(mt[1]);
          rep.textsCap = Number(mt[2]);
        }
      }
      if (!res.ok) rep.errorTail = res.output.slice(-500);
      try {
        const repo = data.root.replace(/[\\/][^\\/]+$/, "");
        rep.romBytes = (await readBinaryFile(`${repo}/engine/snesstudio.sfc`)).length;
      } catch {
        /* no ROM compiled yet */
      }
      setDiagReport(rep);
    } catch (e) {
      setDiagReport({
        running: false,
        ok: false,
        compression: [],
        warnings: [],
        errorTail: String(e),
      });
    }
  }

  // ---- Edit menu + right-click: the event clipboard -------------------------

  const selectedEvent = scene && selEvent !== null ? scene.events[selEvent] ?? null : null;

  function copyEvent() {
    if (selectedEvent) setEvClipboard(structuredClone(selectedEvent));
  }

  function deleteSelEvent() {
    if (selEvent === null) return;
    setScene((sc) => removeEvent(sc, selEvent));
    setSelEvent(null);
  }

  function cutEvent() {
    copyEvent();
    deleteSelEvent();
  }

  // pastes on (tx,ty) when given, otherwise the first free tile near the origin
  function pasteEvent(tx?: number, ty?: number) {
    if (!scene || !evClipboard) return;
    const free = (x: number, y: number) => eventAt(scene, x, y) < 0;
    let placed: [number, number] | null =
      tx !== undefined && ty !== undefined && free(tx, ty) ? [tx, ty] : null;
    if (!placed) {
      outer: for (let r = 0; r < Math.max(scene.width, scene.height); r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = evClipboard.x + dx;
            const y = evClipboard.y + dy;
            if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) continue;
            if (free(x, y)) {
              placed = [x, y];
              break outer;
            }
          }
        }
      }
    }
    if (!placed) return;
    const [px, py] = placed;
    const count = scene.events.length;
    setScene((sc) => addEvent(sc, { ...structuredClone(evClipboard), x: px, y: py }));
    setSelEvent(count);
  }

  // ---- Events layer: creation / editing / prefabs --------------------------

  function newEventAt(tx: number, ty: number, base?: Omit<GameEvent, "x" | "y">) {
    if (!scene) return;
    const ev: GameEvent = base
      ? { ...structuredClone(base), x: tx, y: ty }
      : {
          name: nextEventName(scene),
          x: tx,
          y: ty,
          trigger: "action",
          sprite: Math.min(1, spriteBlocks - 1),
          dir: "down",
          commands: [],
        };
    const index = scene.events.length;
    setScene((sc) => addEvent(sc, ev));
    setSelEvent(index);
    setEvEdit({ index, ev });
  }

  // Saves the event as a prefab (name + category chosen in the
  // SavePrefabModal window — v0.16)
  function doSavePrefab(ev: GameEvent, name: string, category: string | undefined) {
    const cp = structuredClone(ev) as Partial<GameEvent>;
    delete cp.x;
    delete cp.y;
    mutate((d) => ({
      ...d,
      project: {
        ...d.project,
        prefabs: [
          ...(d.project.prefabs ?? []).filter((pf) => pf.name !== name),
          { name, category, event: cp as Omit<GameEvent, "x" | "y"> },
        ],
      },
    }));
    setStatus(`Prefab « ${name} » enregistré${category ? ` (${category})` : ""}.`);
  }

  // Ctrl+C / Ctrl+X / Ctrl+V / Del on the map's EVENTS LAYER (v0.16) —
  // inactive as soon as a window or a field has focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!data || !scene || layer !== "events") return;
      if (document.querySelector(".modal-backdrop, .ctx-backdrop")) return;
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selectedEvent) {
          copyEvent();
          e.preventDefault();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        if (selectedEvent) {
          cutEvent();
          e.preventDefault();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (evClipboard) {
          // pastes on the selected cell (the cursor), otherwise near the
          // origin of the copy
          pasteEvent(evCursor?.[0], evCursor?.[1]);
          e.preventDefault();
        }
      } else if (e.key === "Delete") {
        if (selectedEvent) {
          deleteSelEvent();
          e.preventDefault();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Import of an RPG Maker 2003 chipset (480x256): sliced through datagen
  // then the project is reloaded (project.json and assets changed on disk)
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
      await saveProject(data); // the import rewrites project.json on disk
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

  // Import of an RPG Maker 2003 charset: file choice, then a preview modal
  // (character + destination block) -> datagen import-charset
  async function importCharset() {
    if (!data) return;
    const file = await pickPngFile("Importer un charset RPG Maker 2003 (288x256 ou 72x128)");
    if (!file) return;
    try {
      const bmp = await loadPngBitmap(file);
      const ok =
        (bmp.width === 288 && bmp.height === 256) ||
        (bmp.width === 72 && bmp.height === 128);
      if (!ok) {
        setStatus(
          `Import charset : attendu 288x256 (8 personnages) ou 72x128 (recu ${bmp.width}x${bmp.height})`
        );
        return;
      }
      const bytes = await readBinaryFile(file);
      setTransPick({ kind: "charset", file, bytes, bmp });
    } catch (e) {
      setStatus(`Import charset : ${e}`);
    }
  }

  async function doImportCharset(perso: number, bloc: number, name: string) {
    if (!data || !charsetImport) return;
    const root = data.root;
    const scene = sceneName;
    setCharsetImport(null);
    try {
      // the character's name goes into project.json (charsets[block]) before
      // saving — the CLI import only rewrites assets/sprites.png
      const charsets = Array.from(
        { length: Math.max(spriteBlocks, bloc + 1) },
        (_, i) => data.project.charsets?.[i] ?? (i === 0 ? "Héros" : `Bloc ${i}`)
      );
      if (name) charsets[bloc] = name;
      const d2 = { ...data, project: { ...data.project, charsets } };
      await saveProject(d2);
      setStatus("Import du charset…");
      const res = await runImportCharset(root, charsetImport.path, perso, bloc);
      if (!res.ok) {
        setStatus(`Import charset : ${res.output.slice(-300)}`);
        return;
      }
      await reloadProject(root, scene);
      setStatus(`Charset importé : « ${name || charsets[bloc]} » (bloc ${bloc})`);
    } catch (e) {
      setStatus(`Import charset : ${e}`);
    }
  }

  // ---- Resource manager (RM2003 style) ------------------------------------

  async function exportCharset(b: number) {
    if (!data || !sprites) return;
    const path = await pickSavePath(
      "Exporter le charset (format RM2003, 72x128)",
      `${blockNames[b] ?? "charset"}.png`
    );
    if (!path) return;
    try {
      // recomposing an RM2003 sheet for a character: our 16x24 frames
      // glued back to the bottom-centre of the 24x32 cells, in RM's row
      // order (up, right, down, left) and column order (left, idle, right)
      const RM_ROW = [2, 0, 3, 1];
      const RM_COL = [1, 0, 2];
      const cv = new OffscreenCanvas(72, 128);
      const ctx = cv.getContext("2d")!;
      for (let d = 0; d < 4; d++) {
        for (let s = 0; s < 3; s++) {
          const f = b * 12 + d * 3 + s;
          if ((f + 1) * 16 > sprites.width) continue;
          ctx.drawImage(
            sprites, f * 16, 0, 16, 24,
            RM_COL[s] * 24 + 4, RM_ROW[d] * 32 + 8, 16, 24
          );
        }
      }
      const blob = await cv.convertToBlob({ type: "image/png" });
      await writeBinaryFile(path, new Uint8Array(await blob.arrayBuffer()));
      setStatus(`Charset exporté : ${path}`);
    } catch (e) {
      setStatus(`Export charset : ${e}`);
    }
  }

  async function exportChipset(stem: string) {
    if (!data) return;
    const rel = tilesetPaths[tilesetNames.indexOf(stem)];
    if (!rel) return;
    const path = await pickSavePath("Exporter le tileset (grille PNG)", `${stem}.png`);
    if (!path) return;
    try {
      await writeBinaryFile(path, await readBinaryFile(`${data.root}/${rel}`));
      setStatus(`Tileset exporté : ${path}`);
    } catch (e) {
      setStatus(`Export tileset : ${e}`);
    }
  }

  function renameCharset(b: number, name: string) {
    mutate((d) => {
      const charsets = Array.from(
        { length: Math.max(spriteBlocks, b + 1) },
        (_, i) => d.project.charsets?.[i] ?? (i === 0 ? "Héros" : `Bloc ${i}`)
      );
      charsets[b] = name;
      return { ...d, project: { ...d.project, charsets } };
    });
  }

  async function renameChipset(oldStem: string, newName: string) {
    if (!data) return;
    const newStem = newName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!newStem || newStem === oldStem) return;
    if (tilesetNames.includes(newStem)) {
      setStatus(`Renommage : le tileset « ${newStem} » existe déjà`);
      return;
    }
    const root = data.root;
    const keep = sceneName;
    const oldRel = tilesetPaths[tilesetNames.indexOf(oldStem)];
    const newRel = oldRel.replace(/[^\\/]+$/, `${newStem}.png`);
    try {
      // files: the grid is renamed, the old sidecar removed (the new one
      // is rewritten by the save), and the references updated
      const scenes = Object.fromEntries(
        Object.entries(data.scenes).map(([n, sc]) => [
          n,
          sc.tileset === oldStem ? { ...sc, tileset: newStem } : sc,
        ])
      );
      const tilesets = projectTilesets(data.project).map((p) => (p === oldRel ? newRel : p));
      const tsMeta = { ...data.tilesetMeta };
      if (tsMeta[oldStem]) {
        tsMeta[newStem] = tsMeta[oldStem];
        delete tsMeta[oldStem];
      }
      const assets =
        data.project.assets.tileset === oldRel
          ? { ...data.project.assets, tileset: newRel }
          : data.project.assets;
      const defs = projectTilesetDefs(data.project).map((df) =>
        df.file === oldRel
          ? { ...df, file: newRel, name: df.name === oldStem ? newStem : df.name }
          : df
      );
      const d2: ProjectData = {
        ...data,
        scenes,
        tilesetMeta: tsMeta,
        project: { ...data.project, tilesets, assets, tileset_defs: defs },
      };
      await renamePath(`${root}/${oldRel}`, `${root}/${newRel}`);
      try {
        await removePath(`${root}/${oldRel.replace(/\.[^.]+$/, ".json")}`);
      } catch {
        /* no sidecar */
      }
      await saveProject(d2);
      await reloadProject(root, keep);
      setStatus(`Tileset renommé : ${oldStem} → ${newStem}`);
    } catch (e) {
      setStatus(`Renommage : ${e}`);
    }
  }

  async function deleteCharset(b: number) {
    if (!data || !sprites || b === 0 || (usedCharsets[b] ?? []).length > 0) return;
    if (
      !confirm(
        `Supprimer le personnage « ${blockNames[b]} » ?\nLes personnages suivants seront décalés d'un bloc.`
      )
    )
      return;
    const root = data.root;
    const keep = sceneName;
    try {
      // strip rewritten without the block's 12 frames
      const cut0 = b * 12 * 16;
      const cut1 = Math.min((b + 1) * 12 * 16, sprites.width);
      const w2 = sprites.width - (cut1 - cut0);
      const cv = new OffscreenCanvas(w2, 24);
      const ctx = cv.getContext("2d")!;
      ctx.drawImage(sprites, 0, 0, cut0, 24, 0, 0, cut0, 24);
      if (cut1 < sprites.width) {
        const w = sprites.width - cut1;
        ctx.drawImage(sprites, cut1, 0, w, 24, cut0, 0, w, 24);
      }
      const blob = await cv.convertToBlob({ type: "image/png" });
      const scenes = Object.fromEntries(
        Object.entries(data.scenes).map(([n, sc]) => [
          n,
          {
            ...sc,
            events: sc.events.map((e) => (e.sprite > b ? { ...e, sprite: e.sprite - 1 } : e)),
          },
        ])
      );
      const charsets = blockNames.filter((_, i) => i !== b);
      const d2 = { ...data, scenes, project: { ...data.project, charsets } };
      await saveProject(d2);
      await writeBinaryFile(
        `${root}/${data.project.assets.sprites}`,
        new Uint8Array(await blob.arrayBuffer())
      );
      await reloadProject(root, keep);
      setStatus(`Personnage supprimé : « ${blockNames[b]} »`);
    } catch (e) {
      setStatus(`Suppression : ${e}`);
    }
  }

  async function deleteChipset(stem: string) {
    if (!data || (usedChipsets[stem] ?? []).length > 0 || tilesetNames.length <= 1) return;
    if (!confirm(`Supprimer le tileset « ${stem} » et ses fichiers (grille, sidecar, autotiles) ?`))
      return;
    const root = data.root;
    const keep = sceneName;
    try {
      const rel = tilesetPaths[tilesetNames.indexOf(stem)];
      const tsMeta = data.tilesetMeta[stem];
      // autotiles shared with another tileset: kept
      const shared = new Set(
        Object.entries(data.tilesetMeta)
          .filter(([k]) => k !== stem)
          .flatMap(([, m]) => m.autotiles)
      );
      const tilesets = projectTilesets(data.project).filter((p) => p !== rel);
      const metaCopy = { ...data.tilesetMeta };
      delete metaCopy[stem];
      const assets =
        data.project.assets.tileset === rel
          ? { ...data.project.assets, tileset: tilesets[0] }
          : data.project.assets;
      const defs = projectTilesetDefs(data.project).map((df) =>
        df.file === rel ? { ...df, file: "" } : df
      );
      const d2: ProjectData = {
        ...data,
        tilesetMeta: metaCopy,
        project: { ...data.project, tilesets, assets, tileset_defs: defs },
      };
      await saveProject(d2);
      for (const f of [rel, rel.replace(/\.[^.]+$/, ".json")]) {
        try {
          await removePath(`${root}/${f}`);
        } catch {
          /* already gone */
        }
      }
      for (const a of tsMeta?.autotiles ?? []) {
        if (shared.has(a)) continue;
        try {
          await removePath(`${root}/${a}`);
        } catch {
          /* already gone */
        }
      }
      await reloadProject(root, keep);
      setStatus(`Tileset supprimé : « ${stem} »`);
    } catch (e) {
      setStatus(`Suppression : ${e}`);
    }
  }

  // import of a PNG: copied into assets/, added to project.tilesets
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
        if (cur.includes(rel)) return d; // re-import: bitmap refreshed, list unchanged
        return { ...d, project: { ...d.project, tilesets: [...cur, rel] } };
      });
      setStatus(`Tileset importé : ${stem}`);
    } catch (e) {
      setStatus(`Import tileset : ${e}`);
    }
  }

  // ---- Resources: windowskins, icon sheets, fonts, pictures, sounds,
  // music, vignettes ---------------------------------------------------
  // Seven registers, four actions each. The flows live once in
  // resources.ts; what is left here is the context they need and the two
  // reference rewrites that do not fit in project.json.
  function resCtx(): ResCtx | null {
    if (!data) return null;
    return {
      data,
      sceneName,
      setStatus,
      mutate,
      reload: reloadProject,
      beginTransPick: setTransPick,
      // A font is also named by the dialogue styles and by the widgets
      // (S2), and those live in ui/layout.toml, not project.json.
      renameInLayout: async (root, oldRel, newRel) => {
        const l = await loadUiLayout2(root);
        if (
          l.styles.some((s) => s.font === oldRel) ||
          l.nodes.some((n) => n.font === oldRel)
        ) {
          l.styles = l.styles.map((s) => (s.font === oldRel ? { ...s, font: newRel } : s));
          l.nodes = l.nodes.map((n) => (n.font === oldRel ? { ...n, font: newRel } : n));
          await writeProjectText(root, "ui/layout.toml", layoutToToml(l));
        }
      },
      layoutUsers: async (root, rel) => {
        const l = await loadUiLayout2(root);
        return [
          ...l.styles.filter((s) => s.font === rel).map((s) => `style ${s.id}`),
          ...l.nodes.filter((n) => n.font === rel).map((n) => `widget ${n.id}`),
        ];
      },
    };
  }

  function resAction(
    kind: ResKind,
    act: "import" | "export" | "rename" | "delete",
    rel?: string,
    name?: string
  ) {
    const ctx = resCtx();
    if (!ctx) return;
    const res = RESOURCES[kind];
    if (act === "import") void runImport(ctx, res);
    else if (act === "export") void runExport(ctx, res, rel!);
    else if (act === "rename") void runRename(ctx, res, rel!, name!);
    else void runDelete(ctx, res, rel!);
  }

  // "Extraire une musique" asks for the .spc BEFORE showing anything: the
  // window has exactly one prerequisite, and an empty shell holding a
  // single button in front of the file dialog is a step for nothing.
  async function openMusicRip() {
    const file = await pickFile(
      "Ouvrir un instantané SPC ou une savestate",
      "SPC / savestate",
      [
        "spc",
        "state",
        ...Array.from({ length: 9 }, (_, i) => `state${i + 1}`),
        "auto",
        "oops",
        ...Array.from({ length: 9 }, (_, i) => `00${i}`),
      ]
    );
    if (!file) return;
    try {
      const bytes = await readBinaryFile(file);
      const name = file.split(/[\\/]/).pop() ?? "musique.spc";
      if (!loadSpc(bytes) && !looksLikeState(bytes)) {
        setStatus(
          `${name} n'est ni un instantané SPC ni une savestate. Un émulateur produit un .spc avec « Save SPC » ; RetroArch produit une savestate avec F2, pendant que le morceau joue.`
        );
        return;
      }
      setRipFile({ name, bytes });
      setRipOpen("music");
    } catch (e) {
      setStatus(`Ouverture : ${e}`);
    }
  }

  // An extraction from the ROM ripper (X2). The register categories go
  // through the shared import flow with bytes instead of a file, so a rip
  // is validated and recorded exactly like a browsed PNG. A tileset is not
  // a register in resources.ts, so it reuses importTileset's own path.
  async function ripSend(
    target: RipTarget,
    fileName: string,
    bytes: Uint8Array,
    trans: boolean
  ) {
    if (!data) return;
    if (target !== "tileset") {
      const ctx = resCtx();
      if (!ctx) return;
      await runImport(ctx, RESOURCES[target], { name: fileName, bytes, trans });
      return;
    }
    try {
      const rel = `assets/tilesets/${fileName}`;
      await ensureProjectDir(data.root, "assets/tilesets");
      await writeBinaryFile(`${data.root}/${rel}`, bytes);
      const stem = assetStem(rel);
      const bmp = await loadAssetPng(data.root, rel);
      setTilesets((t2) => ({ ...t2, [stem]: bmp }));
      mutate((d) => {
        const cur = projectTilesets(d.project);
        if (cur.includes(rel)) return d;
        return { ...d, project: { ...d.project, tilesets: [...cur, rel] } };
      });
      setStatus(`Tileset extrait : ${stem}`);
    } catch (e) {
      setStatus(`Extraction tileset : ${e}`);
    }
  }

  // Phase 2 of the picker imports (S4): the transparent colour is known
  // — transform it (alpha 0), validate, write, save
  async function finishTransPick(color: Rgb | null) {
    const t = transPick;
    setTransPick(null);
    if (!data || !t) return;
    try {
      const bytes = color ? await applyTransparency(t.bytes, color) : t.bytes;
      const name = t.file.split(/[\\/]/).pop()!;
      // One folder per resource type, the same landing spot runImport uses
      // — this branch used to drop the file in the assets/ root, where the
      // registered path pointed at nothing datagen would find later.
      const dir = t.kind === "iconset" ? RESOURCES.iconset.dir : RESOURCES.picture.dir;
      const rel = `${dir}/${name}`;
      if (t.kind !== "charset") await ensureProjectDir(data.root, dir);
      if (t.kind === "iconset") {
        const res = RESOURCES.iconset;
        await writeBinaryFile(`${data.root}/${rel}`, bytes);
        if (!res.list(data.project).includes(rel)) {
          mutate((d) => ({ ...d, project: res.add(d.project, rel) }));
        }
        setStatus(res.imported(assetStem(rel), t.bmp));
      } else if (t.kind === "picture") {
        // counting the remaining OPAQUE colours: <= 16 without
        // transparency (the indexed PNG is kept as is), <= 15 with it (the
        // rewritten PNG goes through datagen's alpha indexing, index 0
        // reserved for transparent). A PNG that ALREADY has holes (alpha
        // pixels) is a transparent image even without a clicked colour —
        // otherwise the trans flag was missing and the effect layer (S9)
        // or the see-through scenery refused the image at build time.
        let trans = !!color;
        {
          const cv = document.createElement("canvas");
          cv.width = t.bmp.width;
          cv.height = t.bmp.height;
          const ctx = cv.getContext("2d")!;
          ctx.drawImage(t.bmp, 0, 0);
          const d4 = ctx.getImageData(0, 0, t.bmp.width, t.bmp.height).data;
          const seen = new Set<number>();
          for (let i = 0; i < d4.length; i += 4) {
            if (d4[i + 3] < 128) {
              trans = true; // alpha hole: automatic transparency
              continue;
            }
            const c = (d4[i] << 16) | (d4[i + 1] << 8) | d4[i + 2];
            if (color && d4[i] === color[0] && d4[i + 1] === color[1] && d4[i + 2] === color[2])
              continue;
            seen.add(c);
          }
          const max = trans ? 15 : 16;
          if (seen.size > max) {
            setStatus(
              `Image : plus de ${max} couleurs opaques${trans ? " (en plus de la transparente)" : ""} — réduire la palette avant l'import`
            );
            return;
          }
        }
        const res = RESOURCES.picture;
        await writeBinaryFile(`${data.root}/${rel}`, bytes);
        if (!res.list(data.project).includes(rel)) {
          mutate((d) => ({ ...d, project: res.add(d.project, rel, { trans }) }));
        }
        setStatus(res.imported(assetStem(rel), t.bmp, { trans }));
      } else {
        // charset: datagen import-charset reads a FILE — a temporary copy
        // with the transparency punched, consumed by the import window
        // (replaced on every import)
        // A scratch file, not an asset: kept under assets/charsets so the
        // assets/ root stays one folder per resource type.
        await ensureProjectDir(data.root, "assets/charsets");
        const tmp = `${data.root}/assets/charsets/_charset_import.png`;
        await writeBinaryFile(tmp, bytes);
        const bmp2 = color ? await createImageBitmap(new Blob([bytes as BlobPart], { type: "image/png" })) : t.bmp;
        setCharsetImport({ path: tmp, bmp: bmp2 });
      }
    } catch (e) {
      setStatus(`Import : ${e}`);
    }
  }

  function setSceneTileset(stem: string) {
    // the project's first tileset is the default: the field is not serialised
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
      const res = await runDatagen(data.root, playCfg.debug);
      setStatus(
        res.ok
          ? "Données moteur regénérées — reste à compiler la ROM."
          : `datagen a échoué : ${res.output.slice(-400)}`
      );
    } catch (e) {
      setStatus(`datagen : ${e}`);
    } finally {
      setBuilding(false);
    }
  }

  // mutation recorded in the history — record=false for the following
  // steps of one gesture (a pencil stroke = one undo entry)
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
    if (layer === "events") return; // the Events layer is not painted
    if (layer === "upper" && scene?.effect) return; // effect layer (S9)
    setScene((sc) => paintStamp(sc, layer, tx, ty, ox, oy, tool.tiles), first);
  }

  // rectangle / ellipse / paint bucket: one gesture = one undo entry
  function applyPattern(cells: Array<[number, number]>, ax: number, ay: number) {
    if (layer === "events") return;
    if (layer === "upper" && scene?.effect) return;
    setScene((sc) => paintCells(sc, layer, cells, ax, ay, tool.tiles));
  }

  // eyedropper (right-click): the block copied from the map becomes the stamp
  function pickBlock(tiles: number[][]) {
    if (tiles.length === 0 || tiles[0].length === 0) return;
    setTool({ kind: "tile", tiles });
  }

  // Play: save -> datagen -> snesbuild -> emulator
  async function play() {
    if (!data || playing) return;
    setPlaying(true);
    try {
      await save();
      setStatus("datagen…");
      const gen = await runDatagen(data.root, playCfg.debug);
      if (!gen.ok) {
        setStatus(`datagen a échoué : ${gen.output.slice(-300)}`);
        return;
      }
      setStatus("Compilation du ROM…");
      const mk = await runMake(data.root, playCfg.toolchain);
      if (!mk.ok) {
        setStatus(`La compilation a échoué : ${mk.output.slice(-400)}`);
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

  // "Cartridge" build: a .smc ready for a flashcart (Super UFO Pro 8 & co)
  // — mirrored to 512 KB minimum, checksum recomputed (tools/mkcart.sh)
  async function buildCart() {
    if (!data || building || playing) return;
    setBuilding(true);
    try {
      await save();
      setStatus("datagen…");
      const gen = await runDatagen(data.root);
      if (!gen.ok) {
        setStatus(`datagen a échoué : ${gen.output.slice(-300)}`);
        return;
      }
      setStatus("Build cartouche…");
      const mk = await runMakeCart(data.root, playCfg.toolchain);
      setStatus(
        mk.ok
          ? "Cartouche prête : engine/snesstudio.smc (512 Ko, à copier sur la flashcart)."
          : `Le build cartouche a échoué : ${mk.output.slice(-400)}`
      );
    } catch (e) {
      setStatus(`Build cartouche : ${e}`);
    } finally {
      setBuilding(false);
    }
  }

  // Full rebuild: clean + build (to be used after an engine update —
  // avoids any mix of stale compiled objects)
  async function rebuildAll() {
    if (!data || building || playing) return;
    setBuilding(true);
    try {
      await save();
      setStatus("datagen…");
      const gen = await runDatagen(data.root);
      if (!gen.ok) {
        setStatus(`datagen a échoué : ${gen.output.slice(-300)}`);
        return;
      }
      setStatus("Recompilation complète du ROM…");
      const mk = await runMake(data.root, playCfg.toolchain, true);
      setStatus(mk.ok ? "ROM recompilé de zéro." : `La compilation a échoué : ${mk.output.slice(-400)}`);
    } catch (e) {
      setStatus(`Recompilation : ${e}`);
    } finally {
      setBuilding(false);
    }
  }

  function savePlayCfg(c: PlayConfig) {
    setPlayCfg(c);
    localStorage.setItem("snesstudio.toolchain", c.toolchain);
    localStorage.setItem("snesstudio.emulator", c.emulator);
    localStorage.setItem("snesstudio.debug", c.debug ? "1" : "0");
    setShowSettings(false);
  }

  // O -> X -> ☆ cycle of the current tileset's sidecar (undo/redo like the rest)
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

  // A world map is projected on ONE plane: the upper layer and the
  // effect layer both want a second BG that Mode 7 does not have, and
  // datagen refuses them outright. Removing the controls is how the
  // author finds out while editing rather than at build time (§8.2).
  const isWorldmap = scene?.kind === "worldmap";

  function createScene(
    name: string,
    width: number,
    height: number,
    kind: SceneKind = "map"
  ) {
    const parent = newSceneParent ?? undefined;
    mutate((d) => ({
      ...d,
      project: { ...d.project, scenes: [...d.project.scenes, name] },
      scenes: {
        ...d.scenes,
        [name]: {
          ...newScene(name, width, height),
          parent,
          // "map" is the default everywhere, so it is not written out —
          // an ordinary scene's JSON stays byte-identical to what every
          // existing project already has.
          ...(kind === "worldmap" ? { kind } : {}),
        },
      },
    }));
    setSceneName(name);
    setSelEvent(null);
    setShowNewScene(false);
  }

  // move within the tree (organisational — datagen ignores it)
  function reparentScene(name: string, parent: string | null) {
    mutate((d) => ({
      ...d,
      scenes: {
        ...d.scenes,
        [name]: { ...d.scenes[name], parent: parent ?? undefined },
      },
    }));
  }

  function deleteScene(name: string) {
    if (!data || !name) return;
    if (name === data.project.boot_scene) {
      setStatus("Impossible de supprimer la scène de boot.");
      return;
    }
    if (data.project.scenes.length <= 1) return;
    const remaining = data.project.scenes.filter((s) => s !== name);
    mutate((d) => {
      const dead = d.scenes[name];
      const scenes: Record<string, Scene> = {};
      for (const [n, sc] of Object.entries(d.scenes)) {
        if (n === name) continue;
        // the children of the deleted scene move up one level
        scenes[n] = sc.parent === name ? { ...sc, parent: dead.parent } : sc;
      }
      return { ...d, project: { ...d.project, scenes: remaining }, scenes };
    });
    if (sceneName === name) setSceneName(remaining[0]);
    setSelEvent(null);
  }

  function setBootScene(name: string) {
    if (!data || !name) return;
    mutate((d) => ({ ...d, project: { ...d.project, boot_scene: name } }));
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

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "s") {
        e.preventDefault();
        void save();
      } else if (e.key === "z" && !e.shiftKey) {
        // no interception inside text fields (they handle their own undo)
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

  useEffect(() => {
    localStorage.setItem("snesstudio.paletteH", String(paletteH));
  }, [paletteH]);

  // The world map's sky image, loaded on demand: it is an ordinary
  // project picture, so it is not in the always-loaded set.
  useEffect(() => {
    const rel = scene?.m7_sky_image;
    if (!m7Preview || !data || !rel) {
      setM7Sky(null);
      return;
    }
    let live = true;
    loadAssetPng(data.root, rel)
      .then((b) => { if (live) setM7Sky(b); })
      .catch(() => { if (live) setM7Sky(null); });
    return () => { live = false; };
  }, [m7Preview, data?.root, scene?.m7_sky_image]);

  // Ctrl + wheel on the map: RM2003 zoom (a non-passive listener so the
  // browser's own zoom can be blocked)
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

  // guard: the displayed scene may have vanished after an undo
  useEffect(() => {
    if (data && !data.scenes[sceneName]) {
      setSceneName(data.project.boot_scene);
      setSelEvent(null);
    }
  }, [data, sceneName]);

  // scene change: the cell cursor does not survive it
  useEffect(() => {
    setEvCursor(null);
  }, [sceneName]);

  // Menu bar (RM2003 style)
  const menus = [
    {
      label: "Projet",
      items: [
        {
          label: "Nouveau projet…",
          tip: "Créer un projet vierge (dossier + project.json + assets de départ)",
          action: newProject,
          disabled: !canWriteFiles(),
        },
        {
          label: "Ouvrir un projet…",
          tip: "Ouvrir un projet existant (choisir son project.json)",
          action: openProject,
        },
        {
          label: "Fermer le projet",
          tip: "Fermer le projet en cours (propose d'enregistrer si besoin)",
          action: closeProject,
          disabled: !data,
        },
        { sep: true },
        {
          label: "Explorer le dossier du projet",
          tip: "Ouvrir le dossier du projet dans l'explorateur de fichiers",
          action: () => {
            if (data) void openProjectFolder(data.root);
          },
          disabled: !data || !canWriteFiles(),
        },
        { sep: true },
        {
          label: "Quitter",
          tip: "Fermer SNES Studio",
          action: () => void quitApp(),
        },
      ],
    },
    {
      label: "Edit",
      items: [
        {
          label: "Annuler",
          hint: "Ctrl+Z",
          tip: "Annuler la dernière modification du projet",
          action: doUndo,
          disabled: !data,
        },
        {
          label: "Rétablir",
          hint: "Ctrl+Y",
          tip: "Rejouer la modification annulée",
          action: doRedo,
          disabled: !data,
        },
        { sep: true },
        {
          label: "Couper l'événement sélectionné",
          tip: "Retirer l'événement de la carte et le mettre dans le presse-papiers",
          action: cutEvent,
          disabled: !selectedEvent,
        },
        {
          label: "Copier l'événement sélectionné",
          tip: "Copier l'événement dans le presse-papiers (Ctrl+C sur la carte)",
          action: copyEvent,
          disabled: !selectedEvent,
        },
        {
          label: "Coller l'événement",
          tip: "Poser l'événement du presse-papiers sur la case sélectionnée",
          action: () => pasteEvent(),
          disabled: !data || !evClipboard,
        },
        {
          label: "Supprimer l'événement sélectionné",
          tip: "Effacer l'événement de la carte (Suppr sur la carte)",
          action: deleteSelEvent,
          disabled: !selectedEvent,
        },
        { sep: true },
        {
          label: "Réglages du projet…",
          tip: "Réglages de cette machine : dossier PVSnesLib, émulateur, menu de debug",
          action: () => setShowSettings(true),
          disabled: !canBuild(),
        },
      ],
    },
    {
      label: "Tools",
      // Nine flat entries were a LIST, not a menu: nothing in it said
      // what went with what. They are now filed by what you are DOING —
      // holding the game's state, building a map, staging a scene,
      // dressing the interface, filling tables. No group of one: a
      // submenu holding a single entry groups nothing, it just adds a
      // click.
      items: [
        {
          label: "Logique",
          tip: "Ce que le jeu retient et ce qu'il exécute : switches, variables, scripts partagés",
          disabled: !data,
          sub: [
            {
              label: "Switches et variables…",
              tip: "Nommer les 512 switches (ON/OFF) et 256 variables (nombres) du jeu",
              action: () => setVarMgr(true),
              disabled: !data,
            },
            {
              // A common event and a function are two faces of the same
              // idea — a script belonging to no map — and differ by what
              // you do with them: one is triggered, the other is
              // computed.
              label: "Common events…",
              tip: "Blocs de commandes appelés depuis n'importe quel event, ou lancés en auto par un switch",
              action: () => setCommonEvOpen(true),
              disabled: !data,
            },
            {
              label: "Fonctions…",
              tip: "Calculs réutilisables : la fonction prend des paramètres, peut retourner un résultat, et s'appelle depuis n'importe quel event",
              action: () => setFnOpen(true),
              disabled: !data,
            },
          ],
        },
        {
          label: "Cartes",
          tip: "De quoi bâtir une carte : comportement des tiles et modèles d'events",
          disabled: !data,
          sub: [
            {
              label: "Tilesets…",
              tip: "Passabilité, côtés fermés et tiles animées des chipsets (façon Database RM2003)",
              action: () => setTilesetsOpen(true),
              disabled: !data,
            },
            {
              label: "Prefabs…",
              tip: "Modèles d'events réutilisables (coffre, porte, PNJ…) à poser sur les cartes",
              action: () => setPrefabMgr(true),
              disabled: !data,
            },
          ],
        },
        {
          label: "Mise en scène",
          tip: "Ce qui se joue hors de la carte : écrans composés et animations",
          disabled: !data,
          sub: [
            {
              label: "Écrans composés…",
              tip: "Écrans hors carte (combat, titre, carte du monde…) : fond + images posées + scripts, joués par « Aller à l'écran »",
              action: () => setScreensOpen(true),
              disabled: !data,
            },
            {
              label: "Animations…",
              tip: "Animations image par image (coup d'épée, explosion, soin) : cellule, position et son par frame — jouées par « Jouer une animation »",
              action: () => setAnimsOpen(true),
              disabled: !data,
            },
          ],
        },
        {
          label: "Interface",
          tip: "Ce que le joueur a sous les yeux : HUD et boîtes de dialogue",
          disabled: !data,
          sub: [
            {
              label: "Widgets…",
              tip: "Designer du HUD : jauges, icônes, labels, menus à curseur…",
              action: () => setUiMode("widgets"),
              disabled: !data,
            },
            {
              label: "Dialogues et choix…",
              tip: "Styles des boîtes de message et de choix : windowskin, fonte, géométrie",
              action: () => setUiMode("dialogs"),
              disabled: !data,
            },
          ],
        },
        {
          label: "Ressources",
          tip: "D'où viennent les images et les sons du projet",
          disabled: !data,
          sub: [
            {
              label: "Extraire d'une ROM…",
              tip: "Visualiseur de tuiles sur une ROM : repérer des graphismes bruts et les envoyer dans une catégorie de ressource du projet",
              action: () => setRipOpen("rom"),
              disabled: !data,
            },
            {
              label: "Extraire une musique…",
              tip: "Depuis un instantané SPC : les instruments du morceau, et sa transcription en module jouable par le moteur",
              action: () => void openMusicRip(),
              disabled: !data,
            },
          ],
        },
        {
          label: "Données",
          tip: "Les tables du projet : valeurs chiffrées et textes",
          disabled: !data,
          sub: [
            {
              label: "Database…",
              tip: "Tables de données du jeu (monstres, objets…) : schémas et valeurs, lues en jeu par « Lire la database »",
              action: () => setDbOpen(true),
              disabled: !data,
            },
            {
              label: "Textes…",
              tip: "Catalogue des textes du jeu par catégories — utilisés par les commandes Message",
              action: () => setTextsOpen(true),
              disabled: !data,
            },
          ],
        },
      ],
    },
    {
      label: "Game",
      items: [
        {
          label: "▶ Lancer le jeu",
          tip: "Compiler le projet et lancer la ROM de test dans l'émulateur",
          action: play,
          disabled: !data || !canBuild() || playing || building,
        },
        {
          label: "Vérifier le projet…",
          tip: "Diagnostic du projet : références cassées, budgets mémoire, avertissements",
          action: () => void openDiagnostics(),
          disabled: !data,
        },
        {
          label: "Générer les données",
          tip: "Lancer datagen seul (données C depuis le projet), sans compiler ni jouer",
          action: generate,
          disabled: !data || !canBuild() || playing || building,
        },
        {
          label: "Build cartouche (.smc)",
          hint: "flashcart",
          tip: "ROM finale sans menu de debug, taille et checksum corrects — pour flashcart ou distribution",
          action: () => void buildCart(),
          disabled: !data || !canBuild() || playing || building,
        },
        {
          label: "Recompiler tout (clean)",
          hint: "après mise à jour",
          tip: "Rebuild complet du moteur, intermédiaires jetés — utile après une mise à jour de SNES Studio",
          action: () => void rebuildAll(),
          disabled: !data || !canBuild() || playing || building,
        },
      ],
    },
    {
      label: "Help",
      items: [
        {
          label: "Version…",
          tip: "Version de SNES Studio et informations sur le build",
          action: () => setShowAbout(true),
        },
      ],
    },
  ];

  return (
    <div className="app">
      <MenuBar menus={menus} />
      <div className="toolbar">
        <button
          onClick={save}
          disabled={!data || !dirty}
          title="Sauvegarder le projet (Ctrl+S)"
        >
          💾{dirty ? " *" : ""}
        </button>
        {/* scene management: the tree under the palette (RM2003 style) */}
        {data && scene && (
          <span className="layer-switch" title="Couche éditée (modèle RPG Maker 2003)">
            <button
              className={layer === "lower" ? "active" : ""}
              onClick={() => setLayer("lower")}
              title="Couche inférieure"
            >
              <LayerIcon kind="lower" />
            </button>
            <button
              className={layer === "upper" ? "active" : ""}
              onClick={() => !scene.effect && !isWorldmap && setLayer("upper")}
              disabled={!!scene.effect || isWorldmap}
              title={
                isWorldmap
                  ? "Carte du monde : un seul plan en Mode 7, pas de couche supérieure"
                  : scene.effect
                  ? "Couche supérieure désactivée : la couche d'effet de la scène occupe ce plan (onglet Scène)"
                  : "Couche supérieure"
              }
            >
              <LayerIcon kind="upper" />
            </button>
            <button
              className={layer === "events" ? "active" : ""}
              onClick={() => setLayer("events")}
              title="Couche des événements : events, warps, départ du joueur — clic droit pour créer, Ctrl+C/X/V et Suppr sur l'event sélectionné"
            >
              <LayerIcon kind="events" />
            </button>
          </span>
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
        {data && canBuild() && (
          <button onClick={generate} disabled={building || playing}>
            {building ? "Génération…" : "Générer les données"}
          </button>
        )}
        {data && canBuild() && (
          <button
            onClick={play}
            disabled={playing || building}
            title="Sauvegarder, régénérer les données, compiler le ROM et le lancer dans l'émulateur (chemins : Edit → Réglages du projet)"
          >
            {playing ? "…" : "▶ Jouer"}
          </button>
        )}
        {data && (
          <button
            onClick={() => setShowResources(true)}
            title="Gestionnaire de ressources (charsets, chipsets) — importer, exporter, renommer, supprimer"
          >
            🗂 Ressources
          </button>
        )}
        <span className="status">{status}</span>
        <button
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          title={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
        >
          {theme === "dark" ? "☀" : "🌙"}
        </button>
      </div>

      {data && scene ? (
        <div className="workspace">
          <div className="left-col">
            <div className="palette-box" style={{ height: paletteH }}>
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
            </div>
            <div
              className="v-split"
              title="Glisser pour redimensionner palette / scènes"
              onPointerDown={(e) => {
                splitDrag.current = { y: e.clientY, h: paletteH };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (splitDrag.current) {
                  setPaletteH(
                    Math.max(120, splitDrag.current.h + e.clientY - splitDrag.current.y)
                  );
                }
              }}
              onPointerUp={() => (splitDrag.current = null)}
            />
            <SceneTree
              project={data.project}
              scenes={data.scenes}
              current={sceneName}
              onSelect={(n) => {
                setSceneName(n);
                setSelEvent(null);
              }}
              onCreate={(parent) => {
                setNewSceneParent(parent);
                setShowNewScene(true);
              }}
              onDelete={deleteScene}
              onSetBoot={setBootScene}
              onReparent={reparentScene}
            />
          </div>
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
                selectedEvent={selEvent}
                onSelectEvent={setSelEvent}
                cursor={layer === "events" ? evCursor : null}
                onSelectCell={(tx, ty) => setEvCursor([tx, ty])}
                onOpenEvent={(i) => {
                  setSelEvent(i);
                  setEvEdit({ index: i, ev: scene.events[i] });
                }}
                onEventMenu={(tx, ty, cx, cy) => {
                  const hit = eventAt(scene, tx, ty);
                  setSelEvent(hit >= 0 ? hit : null);
                  setEvCursor([tx, ty]);
                  setEvMenu({ x: cx, y: cy, tx, ty });
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
              {!isWorldmap && (
                <button className={tab === "effect" ? "active" : ""} onClick={() => setTab("effect")}>
                  Couche d'effet
                </button>
              )}
              <button className={tab === "script" ? "active" : ""} onClick={() => setTab("script")}>
                Script
              </button>
            </div>
            {tab === "scene" && (
              <ScenePanel
                scene={scene}
                tilesetNames={tsChoices.map((d) => d.name)}
                current={tsCurrentDef}
                musicNames={(data.project.musics ?? []).map(musicStem)}
                passMode={passMode}
                onSelectTileset={(name) => {
                  const df = tsChoices.find((x) => x.name === name);
                  if (df) setSceneTileset(assetStem(df.file));
                }}
                onSelectMusic={(m) => setScene((sc) => ({ ...sc, music: m }))}
                onPassMode={setPassMode}
                onResize={(w, h) => setScene((sc) => resizeScene(sc, w, h))}
                onView={(m7_horizon, m7_anchor) =>
                  setScene((sc) => ({ ...sc, m7_horizon, m7_anchor }))
                }
                onRotate={(m7_rotate) =>
                  setScene((sc) => ({ ...sc, m7_rotate: m7_rotate || undefined }))
                }
                pictures={projectPictures(data.project).map(
                  (e) => [assetStem(picPath(e)), picPath(e)] as [string, string]
                )}
                onPreview={() => setM7Preview(true)}
                onSky={(m7_sky, m7_sky_top, m7_sky_bottom, m7_sky_image) =>
                  setScene((sc) => ({
                    ...sc,
                    m7_sky,
                    m7_sky_top,
                    m7_sky_bottom,
                    m7_sky_image,
                  }))
                }
              />
            )}
            {tab === "effect" && (
              <EffectPanel
                scene={scene}
                pictures={projectPictures(data.project).map((e) => assetStem(picPath(e)))}
                onSetEffect={(eff) => {
                  if (eff && layer === "upper") setLayer("lower");
                  setScene((sc) => ({ ...sc, effect: eff }));
                }}
              />
            )}
            {tab === "script" && (
              <ScriptPanel
                script={scene.script}
                onChange={(script) => setScene((sc) => ({ ...sc, script }))}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="empty">
          <p>SNES Studio {__APP_VERSION__}</p>
          <button onClick={openProject}>Ouvrir un projet…</button>
        </div>
      )}

      {showNewScene && data && (
        <NewSceneModal
          existing={data.project.scenes}
          parent={newSceneParent}
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
      {ripOpen && data && (
        <RomRipModal
          mode={ripOpen}
          initial={ripFile ?? undefined}
          root={data.root}
          assetPngs={[
            ...projectPictures(data.project).map(picPath),
            ...projectIconsets(data.project),
            ...projectWindowskins(data.project),
            ...projectTilesets(data.project),
          ]}
          onSend={(target, fileName, bytes, trans) =>
            void ripSend(target, fileName, bytes, trans)
          }
          onSendSound={(fileName, wav) => {
            const ctx = resCtx();
            if (ctx) void runImport(ctx, RESOURCES.sound, { name: fileName, bytes: wav });
          }}
          onSendMusic={(fileName, itBytes) => {
            const ctx = resCtx();
            if (ctx) void runImport(ctx, RESOURCES.music, { name: fileName, bytes: itBytes });
          }}
          setStatus={setStatus}
          onClose={() => {
            setRipOpen(null);
            setRipFile(null);
          }}
        />
      )}
      {transPick && data && (
        <TransparencyPickModal
          bmp={transPick.bmp}
          onOk={(color) => void finishTransPick(color)}
          onClose={() => {
            setTransPick(null);
            setStatus("Import annulé.");
          }}
        />
      )}
      {showResources && data && (
        <ResourceManagerModal
          root={data.root}
          tilesetNames={tilesetNames}
          tilesets={tilesets}
          sprites={sprites}
          blockCount={spriteBlocks}
          blockNames={blockNames}
          windowskins={projectWindowskins(data.project)}
          activeSkin={data.project.ui?.windowskin}
          iconsets={projectIconsets(data.project)}
          activeIcons={data.project.ui?.icons}
          fonts={projectFonts(data.project)}
          defaultFont={data.project.assets.font}
          sounds={data.project.sounds ?? []}
          musics={data.project.musics ?? []}
          onImportTilesetPng={importTileset}
          vignettes={data.project.vignettes ?? []}
          mode7Images={projectMode7(data.project)}
          pictures={projectPictures(data.project).map(picPath)}
          usedCharsets={usedCharsets}
          usedChipsets={usedChipsets}
          canWrite={canWriteFiles()}
          onImportCharset={importCharset}
          onImportChipset={importChipset}
          onExportCharset={exportCharset}
          onExportChipset={exportChipset}
          onRenameCharset={renameCharset}
          onRenameChipset={renameChipset}
          onDeleteCharset={deleteCharset}
          onDeleteChipset={deleteChipset}
          onRes={resAction}
          onClose={() => setShowResources(false)}
        />
      )}
      {diags && data && (
        <DiagnosticsModal
          data={data}
          diags={diags}
          report={diagReport}
          onClose={() => {
            setDiags(null);
            setDiagReport(null);
          }}
        />
      )}
      {evMenu && scene && (
        <div
          className="ctx-backdrop"
          onClick={() => setEvMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setEvMenu(null);
          }}
        >
          <div className="ctx-menu" style={{ left: evMenu.x, top: evMenu.y }} onClick={(e) => e.stopPropagation()}>
            {(() => {
              const hit = eventAt(scene, evMenu.tx, evMenu.ty);
              const warpHit = scene.warps.findIndex((w) => w.x === evMenu.tx && w.y === evMenu.ty);
              const close = () => setEvMenu(null);
              if (hit >= 0) {
                const ev = scene.events[hit];
                return (
                  <>
                    <button
                      onClick={() => {
                        close();
                        setSelEvent(hit);
                        setEvEdit({ index: hit, ev });
                      }}
                    >
                      Éditer « {ev.name} »…
                    </button>
                    <button
                      onClick={() => {
                        close();
                        setSelEvent(hit);
                        setEvClipboard(structuredClone(ev));
                        setScene((sc) => removeEvent(sc, hit));
                        setSelEvent(null);
                      }}
                    >
                      Couper
                    </button>
                    <button
                      onClick={() => {
                        close();
                        setEvClipboard(structuredClone(ev));
                      }}
                    >
                      Copier
                    </button>
                    <button
                      onClick={() => {
                        close();
                        setPrefabSave(structuredClone(ev));
                      }}
                    >
                      Enregistrer comme prefab…
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        close();
                        setScene((sc) => removeEvent(sc, hit));
                        setSelEvent(null);
                      }}
                    >
                      Supprimer
                    </button>
                  </>
                );
              }
              return (
                <>
                  <button
                    onClick={() => {
                      close();
                      newEventAt(evMenu.tx, evMenu.ty);
                    }}
                  >
                    ＋ Nouvel événement…
                  </button>
                  <button
                    disabled={(data?.project.prefabs ?? []).length === 0}
                    title={
                      (data?.project.prefabs ?? []).length === 0
                        ? "Aucun prefab — clic droit sur un event → Enregistrer comme prefab…"
                        : undefined
                    }
                    onClick={() => {
                      close();
                      setPrefabPickAt({ tx: evMenu.tx, ty: evMenu.ty });
                    }}
                  >
                    ＋ Nouvel événement depuis un prefab…
                  </button>
                  {evClipboard && (
                    <button
                      onClick={() => {
                        close();
                        pasteEvent(evMenu.tx, evMenu.ty);
                      }}
                    >
                      Coller l'événement ici
                    </button>
                  )}
                  {warpHit >= 0 ? (
                    <>
                      <button
                        onClick={() => {
                          close();
                          setWarpEdit(warpHit);
                        }}
                      >
                        Éditer le warp…
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          close();
                          setScene((sc) => removeWarp(sc, warpHit));
                        }}
                      >
                        Supprimer le warp
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={(data?.project.scenes.length ?? 0) < 2}
                      onClick={() => {
                        close();
                        const other = data!.project.scenes.find((n) => n !== sceneName)!;
                        const count = scene.warps.length;
                        setScene((sc) => placeWarp(sc, meta, evMenu.tx, evMenu.ty, other));
                        setWarpEdit(count);
                      }}
                    >
                      ＋ Nouveau warp…
                    </button>
                  )}
                  <button
                    onClick={() => {
                      close();
                      setScene((sc) => setPlayerStart(sc, evMenu.tx, evMenu.ty));
                    }}
                  >
                    ★ Départ du joueur ici
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {prefabSave && data && (
        <SavePrefabModal
          defaultName={prefabSave.name}
          existingCategories={[
            ...new Set(
              (data.project.prefabs ?? [])
                .map((pf) => pf.category?.trim())
                .filter((c): c is string => !!c)
            ),
          ]}
          onOk={(name, category) => {
            doSavePrefab(prefabSave, name, category);
            setPrefabSave(null);
          }}
          onClose={() => setPrefabSave(null)}
        />
      )}
      {(prefabPickAt || prefabMgr) && data && (
        <PrefabsModal
          prefabs={data.project.prefabs ?? []}
          pick={!!prefabPickAt}
          onPick={(pf) => {
            if (prefabPickAt) newEventAt(prefabPickAt.tx, prefabPickAt.ty, pf.event);
            setPrefabPickAt(null);
          }}
          onOk={(prefabs) => {
            mutate((d) => ({
              ...d,
              project: { ...d.project, prefabs: prefabs.length ? prefabs : undefined },
            }));
            if (prefabMgr) setPrefabMgr(false);
          }}
          onClose={() => {
            setPrefabPickAt(null);
            setPrefabMgr(false);
          }}
        />
      )}
      {m7Preview && data && scene && (
        <M7PreviewModal
          scene={scene}
          tileset={tileset}
          autotiles={autotiles}
          meta={meta}
          sprites={sprites}
          skyImage={m7Sky}
          onApplyView={(m7_horizon, m7_anchor) =>
            setScene((sc) => ({ ...sc, m7_horizon, m7_anchor }))
          }
          onClose={() => setM7Preview(false)}
        />
      )}
      {textsOpen && data && (
        <TextsModal
          texts={data.texts}
          onOk={(texts) => {
            mutate((d) => ({ ...d, texts }));
            setTextsOpen(false);
          }}
          onClose={() => setTextsOpen(false)}
        />
      )}
      {tilesetsOpen && data && (
        <TilesetsModal
          defs={tsDefs}
          files={tilesetPaths}
          tilesets={tilesets}
          autoImgs={autoImgs}
          meta={data.tilesetMeta}
          onOk={(defsNext, metaNext) => {
            mutate((d) => ({
              ...d,
              tilesetMeta: metaNext,
              project: { ...d.project, tileset_defs: defsNext },
            }));
            setTilesetsOpen(false);
          }}
          onClose={() => setTilesetsOpen(false)}
        />
      )}
      {animsOpen && data && (
        <AnimationsModal
          root={data.root}
          animations={data.project.animations ?? []}
          vigNames={(data.project.vignettes ?? []).map(musicStem)}
          vigPaths={Object.fromEntries(
            (data.project.vignettes ?? []).map((p) => [musicStem(p), p])
          )}
          soundNames={(data.project.sounds ?? []).map(musicStem)}
          soundPaths={Object.fromEntries(
            (data.project.sounds ?? []).map((p) => [musicStem(p), p])
          )}
          sprites={sprites}
          onOk={(list) => {
            mutate((d) => ({
              ...d,
              project: { ...d.project, animations: list.length ? list : undefined },
            }));
            setAnimsOpen(false);
          }}
          onClose={() => setAnimsOpen(false)}
        />
      )}
      {dbOpen && data && (
        <DatabaseModal
          db={db ?? { schemas: [], entries: {} }}
          textNames={data.texts.map((t) => t.name)}
          root={data.root}
          pictures={(data.project.pictures ?? []).map(picPath)}
          sounds={data.project.sounds ?? []}
          musics={data.project.musics ?? []}
          charsets={data.project.charsets ?? []}
          onOk={(next, removedTables) => {
            setDb(next);
            setDbOpen(false);
            void saveDatabase(data.root, next, removedTables)
              .then(() => setStatus("Database sauvegardée (schemas/ + data/)."))
              .catch((e) => setStatus(`Database : ${e}`));
          }}
          onClose={() => setDbOpen(false)}
        />
      )}
      {uiMode && data && (
        <UiThemeModal
          db={db}
          root={data.root}
          mode={uiMode}
          project={data.project}
          sceneNames={data.project.scenes}
          scenes={data.scenes}
          charsetNames={Array.from({ length: spriteBlocks }, (_, b) =>
            charsetName(data.project, b)
          )}
          texts={data.texts}
          pictures={projectPictures(data.project).map((e) => assetStem(picPath(e)))}
          mode7Images={projectMode7(data.project).map(assetStem)}
          tintPresets={data.project.tint_presets ?? []}
          soundNames={(data.project.sounds ?? []).map(musicStem)}
          musicNames={(data.project.musics ?? []).map(musicStem)}
          vigNames={(data.project.vignettes ?? []).map(musicStem)}
          animNames={(data.project.animations ?? []).map((a) => a.name)}
          screenNames={data.project.screens ?? []}
          onTintPresets={(list) =>
            mutate((d) => ({ ...d, project: { ...d.project, tint_presets: list } }))
          }
          windowskins={projectWindowskins(data.project)}
          iconsets={projectIconsets(data.project)}
          fonts={projectFonts(data.project)}
          varNames={data.project.variables ?? []}
          switchNames={data.project.switches ?? []}
          onRenameVars={(sw, va) =>
            mutate((d) => ({ ...d, project: { ...d.project, switches: sw, variables: va } }))
          }
          onOk={(ui, widgets, styles) => {
            mutate((d) => ({ ...d, project: { ...d.project, ui } }));
            setUiWidgets(widgets);
            setUiStyles(styles);
            setUiMode(null);
            setStatus("UI sauvegardée (project.json + ui/layout.toml).");
          }}
          onClose={() => setUiMode(null)}
        />
      )}
      {screensOpen && data && (
        <ScreensModal
          root={data.root}
          screenNames={data.project.screens ?? []}
          screens={data.screens}
          picturePaths={Object.fromEntries(
            projectPictures(data.project).map((e) => [assetStem(picPath(e)), picPath(e)])
          )}
          sceneNames={data.project.scenes}
          scenes={data.scenes}
          switchNames={data.project.switches ?? []}
          varNames={data.project.variables ?? []}
          charsetNames={Array.from({ length: spriteBlocks }, (_, b) =>
            charsetName(data.project, b)
          )}
          db={db}
          uiWidgets={uiWidgets}
          uiStyles={uiStyles}
          texts={data.texts}
          pictures={projectPictures(data.project).map((e) => assetStem(picPath(e)))}
          mode7Images={projectMode7(data.project).map(assetStem)}
          tintPresets={data.project.tint_presets ?? []}
          soundNames={(data.project.sounds ?? []).map(musicStem)}
          musicNames={(data.project.musics ?? []).map(musicStem)}
          vigNames={(data.project.vignettes ?? []).map(musicStem)}
          animNames={(data.project.animations ?? []).map((a) => a.name)}
          onTintPresets={(list) =>
            mutate((d) => ({ ...d, project: { ...d.project, tint_presets: list } }))
          }
          onRenameVars={(sw, va) =>
            mutate((d) => ({ ...d, project: { ...d.project, switches: sw, variables: va } }))
          }
          onOk={(names, screens) => {
            mutate((d) => ({
              ...d,
              project: { ...d.project, screens: names.length ? names : undefined },
              screens,
            }));
            setScreensOpen(false);
          }}
          onClose={() => setScreensOpen(false)}
        />
      )}
      {fnOpen && data && (
        <FunctionsModal
          functions={data.project.functions ?? []}
          commons={data.project.common_events ?? []}
          sceneNames={data.project.scenes}
          scenes={data.scenes}
          switchNames={data.project.switches ?? []}
          varNames={data.project.variables ?? []}
          charsetNames={Array.from({ length: spriteBlocks }, (_, b) =>
            charsetName(data.project, b)
          )}
          db={db}
          uiWidgets={uiWidgets}
          uiStyles={uiStyles}
          texts={data.texts}
          pictures={projectPictures(data.project).map((e) => assetStem(picPath(e)))}
          mode7Images={projectMode7(data.project).map(assetStem)}
          tintPresets={data.project.tint_presets ?? []}
          soundNames={(data.project.sounds ?? []).map(musicStem)}
          musicNames={(data.project.musics ?? []).map(musicStem)}
          vigNames={(data.project.vignettes ?? []).map(musicStem)}
          animNames={(data.project.animations ?? []).map((a) => a.name)}
          screenNames={data.project.screens ?? []}
          onTintPresets={(list) =>
            mutate((d) => ({ ...d, project: { ...d.project, tint_presets: list } }))
          }
          onRenameVars={(sw, va) =>
            mutate((d) => ({ ...d, project: { ...d.project, switches: sw, variables: va } }))
          }
          onOk={(functions) => {
            mutate((d) => ({
              ...d,
              project: {
                ...d.project,
                functions: functions.length ? functions : undefined,
              },
            }));
            setFnOpen(false);
          }}
          onClose={() => setFnOpen(false)}
        />
      )}
      {commonEvOpen && data && (
        <CommonEventsModal
          commons={data.project.common_events ?? []}
          fnSigs={(data.project.functions ?? []).map((f, i) => ({
            name: f.name || `F ${i + 1}`,
            params: f.params,
            returns: f.returns,
          }))}
          sceneNames={data.project.scenes}
          scenes={data.scenes}
          switchNames={data.project.switches ?? []}
          varNames={data.project.variables ?? []}
          charsetNames={Array.from({ length: spriteBlocks }, (_, b) =>
            charsetName(data.project, b)
          )}
          db={db}
          uiWidgets={uiWidgets}
          uiStyles={uiStyles}
          texts={data.texts}
          pictures={projectPictures(data.project).map((e) => assetStem(picPath(e)))}
          mode7Images={projectMode7(data.project).map(assetStem)}
                tintPresets={data.project.tint_presets ?? []}
                soundNames={(data.project.sounds ?? []).map(musicStem)}
                musicNames={(data.project.musics ?? []).map(musicStem)}
                vigNames={(data.project.vignettes ?? []).map(musicStem)}
                animNames={(data.project.animations ?? []).map((a) => a.name)}
                screenNames={data.project.screens ?? []}
                onTintPresets={(list) =>
                  mutate((d) => ({ ...d, project: { ...d.project, tint_presets: list } }))
                }
          onRenameVars={(sw, va) =>
            mutate((d) => ({ ...d, project: { ...d.project, switches: sw, variables: va } }))
          }
          onOk={(commons) => {
            mutate((d) => ({
              ...d,
              project: {
                ...d.project,
                common_events: commons.length ? commons : undefined,
              },
            }));
            setCommonEvOpen(false);
          }}
          onClose={() => setCommonEvOpen(false)}
        />
      )}
      {varMgr && data && (
        <VarListModal
          kind="var"
          switches={data.project.switches ?? []}
          variables={data.project.variables ?? []}
          onClose={() => setVarMgr(false)}
          onOk={(r) => {
            mutate((d) => ({
              ...d,
              project: { ...d.project, switches: r.switches, variables: r.variables },
            }));
            setVarMgr(false);
          }}
        />
      )}
      {evEdit && scene && data && (
        <EventEditorModal
          event={evEdit.ev}
          sceneNames={data.project.scenes}
          scenes={data.scenes}
          blockCount={spriteBlocks}
          blockNames={blockNames}
          usedBlocks={[...new Set([0, ...scene.events.filter((_, i) => i !== evEdit.index).map((e) => e.sprite).filter((b) => b >= 0)])]}
          switchNames={data.project.switches ?? []}
          varNames={data.project.variables ?? []}
          charsetNames={Array.from({ length: spriteBlocks }, (_, b) => charsetName(data.project, b))}
          entryNames={scene.events.flatMap((ev) => {
            const n = 1 + (ev.extraPages?.length ?? 0);
            return Array.from({ length: n }, (_, k) =>
              n > 1 ? `${ev.name} (page ${k + 1})` : ev.name
            );
          })}
          commonNames={(data.project.common_events ?? []).map(
            (ce, i) => ce.name || `CE ${i + 1}`
          )}
          fnSigs={(data.project.functions ?? []).map((f, i) => ({
            name: f.name || `F ${i + 1}`,
            params: f.params,
            returns: f.returns,
          }))}
          db={db}
          uiWidgets={uiWidgets}
          uiStyles={uiStyles}
          texts={data.texts}
          pictures={projectPictures(data.project).map((e) => assetStem(picPath(e)))}
          mode7Images={projectMode7(data.project).map(assetStem)}
                tintPresets={data.project.tint_presets ?? []}
                soundNames={(data.project.sounds ?? []).map(musicStem)}
                musicNames={(data.project.musics ?? []).map(musicStem)}
                vigNames={(data.project.vignettes ?? []).map(musicStem)}
                animNames={(data.project.animations ?? []).map((a) => a.name)}
                screenNames={data.project.screens ?? []}
                onTintPresets={(list) =>
                  mutate((d) => ({ ...d, project: { ...d.project, tint_presets: list } }))
                }
          onRenameVars={(sw, va) =>
            mutate((d) => ({ ...d, project: { ...d.project, switches: sw, variables: va } }))
          }
          sprites={sprites}
          tilesetBmp={tilesets[scene.tileset ?? tilesetNames[0] ?? ""] ?? null}
          upperCells={(() => {
            // T4: tiles from the upper-layer section of the scene's chipset
            const stem = scene.tileset ?? tilesetNames[0] ?? "";
            const us = data.tilesetMeta[stem]?.upper_start;
            const bmp = tilesets[stem];
            if (us === undefined || !bmp) return [];
            const count =
              Math.max(1, Math.floor(bmp.width / 16)) *
              Math.max(1, Math.floor(bmp.height / 16));
            return Array.from({ length: Math.max(0, count - us) }, (_, i) => us + i);
          })()}
          labels={scriptLabels(scene.script)}
          onSave={(ev) => {
            setScene((sc) => updateEvent(sc, evEdit.index, ev));
            setEvEdit(null);
          }}
          onClose={() => setEvEdit(null)}
        />
      )}
      {warpEdit !== null && scene && data && scene.warps[warpEdit] && (
        <TransferPlayerModal
          warp={scene.warps[warpEdit]}
          sceneNames={data.project.scenes}
          scenes={data.scenes}
          tilesets={tilesets}
          autoImgs={autoImgs}
          tilesetMeta={data.tilesetMeta}
          defaultTileset={tilesetNames[0] ?? ""}
          onOk={(patch) => {
            setScene((sc) => updateWarp(sc, warpEdit, patch));
            setWarpEdit(null);
          }}
          onClose={() => setWarpEdit(null)}
        />
      )}
      {showAbout && (
        <div className="modal-backdrop">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-title">SNES Studio — éditeur<button className="modal-x" title="Fermer" onClick={() => setShowAbout(false)}>✕</button></div>
            <p>Version {pkg.version}</p>
            <p className="hint">
              Créateur de jeux Super Nintendo sans code, dans l'esprit de
              RPG Maker 2003 et GB Studio. Éditeur Tauri + React, moteur C
              (PVSnesLib), outils Rust. Les jeux sont des données.
            </p>
            <button onClick={() => setShowAbout(false)}>Fermer</button>
          </div>
        </div>
      )}
      {/* rendered AFTER the resource manager: stacks above it */}
      {charsetImport && (
        <CharsetImportModal
          bitmap={charsetImport.bmp}
          blockCount={spriteBlocks}
          blockNames={blockNames}
          defaultBloc={Math.min(spriteBlocks, 63)}
          onImport={doImportCharset}
          onClose={() => setCharsetImport(null)}
        />
      )}
    </div>
  );
}

// RM2003-style layer icons (two tiles stacked in perspective — the
// edited layer is highlighted; the Events layer carries a little
// character)
function LayerIcon({ kind }: { kind: "lower" | "upper" | "events" }) {
  const on = "#ffd76a"; // active layer (RM2003 yellow)
  const off = "#5a6472";
  const top = kind === "upper" ? on : off;
  const bottom = kind === "lower" ? on : kind === "events" ? "#7fb0e0" : off;
  return (
    <svg width="20" height="18" viewBox="0 0 15 14" style={{ verticalAlign: "-4px" }}>
      <polygon points="4.5,1 13.5,1 10.5,5.5 1.5,5.5" fill={top} stroke="#14161a" strokeWidth="1" />
      <polygon points="4.5,7.5 13.5,7.5 10.5,12 1.5,12" fill={bottom} stroke="#14161a" strokeWidth="1" />
      {kind === "events" && (
        <>
          <rect x="6" y="6" width="3.6" height="4.4" rx="0.8" fill="#ffd76a" stroke="#14161a" strokeWidth="0.8" />
          <rect x="6.6" y="4.6" width="2.4" height="2.2" rx="1" fill="#f7be94" stroke="#14161a" strokeWidth="0.8" />
        </>
      )}
    </svg>
  );
}
