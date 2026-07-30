// SNES Studio — éditeur.
// Ouvre un dossier projet (les JSON/PNG que tools/datagen consomme) et
// édite maps (2 couches + autotiles + passabilité, modèle RPG Maker 2003),
// acteurs, warps, textes, scripts ; undo/redo, gestion des scènes,
// sauvegarde, génération des données moteur.

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEvent, Layer, ProjectData, Scene, TilesetMeta } from "./types";
import {
  assetStem,
  charsetName,
  eventAt,
  musicStem,
  projectFonts,
  projectIconsets,
  picPath,
  projectPictures,
  projectTilesetDefs,
  projectTilesets,
  projectWindowskins,
  spriteBlockCount,
} from "./types";
import {
  canWriteFiles,
  importTilesetPng,
  pickFile,
  loadAssetPng,
  loadAutotiles,
  loadPngBitmap,
  loadProject,
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
import ScenePanel from "./components/ScenePanel";
import EffectPanel from "./components/EffectPanel";
import SceneTree from "./components/SceneTree";
import EventEditorModal from "./components/EventEditorModal";
import VarListModal from "./components/VarListModal";
import CommonEventsModal from "./components/CommonEventsModal";
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

// Acteurs / Warps / Textes ont quitté la sidebar (demande Bertrand) :
// events et warps se gèrent sur la carte (double-clic, clic droit),
// les textes dans Tools → Textes… (fenêtre à catégories)
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
    bash: localStorage.getItem("snesstudio.bash") ?? "C:\\msys64\\usr\\bin\\bash.exe",
    emulator: localStorage.getItem("snesstudio.emulator") ?? "mesen",
    debug: localStorage.getItem("snesstudio.debug") === "1",
  }));
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<Tab>("scene");
  const [selEvent, setSelEvent] = useState<number | null>(null);
  // menu contextuel de la couche Événements + Event Editor + mini-modal warp
  const [evMenu, setEvMenu] = useState<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [evEdit, setEvEdit] = useState<{ index: number; ev: GameEvent } | null>(null);
  const [warpEdit, setWarpEdit] = useState<number | null>(null);
  const [showCollision, setShowCollision] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [hoverPos, setHoverPos] = useState<[number, number] | null>(null);
  // zoom façon RM2003 : 1/1, 1/2, 1/4, 1/8 (taille de tile à l'écran)
  const [zoomIdx, setZoomIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("Ouvre un dossier projet (ex. demo/)");
  const [showNewScene, setShowNewScene] = useState(false);
  const [newSceneParent, setNewSceneParent] = useState<string | null>(null);
  // import de charset en cours (fichier choisi, en attente du personnage/bloc)
  // Picker de couleur transparente à l'import (S4) : l'image validée
  // attend le choix de la couleur (ou « sans transparence »)
  const [transPick, setTransPick] = useState<null | {
    kind: "iconset" | "picture" | "charset";
    file: string;
    bytes: Uint8Array;
    bmp: ImageBitmap;
  }>(null);
  const [charsetImport, setCharsetImport] = useState<{ path: string; bmp: ImageBitmap } | null>(
    null
  );
  // gestionnaire de ressources (façon RM2003)
  const [showResources, setShowResources] = useState(false);
  // menu Aide → À propos
  const [showAbout, setShowAbout] = useState(false);
  // fenêtre de diagnostic (Tools → Vérifier le projet)
  const [diags, setDiags] = useState<Diag[] | null>(null);
  const [varMgr, setVarMgr] = useState(false); // fenêtre Switches/Variables
  const [commonEvOpen, setCommonEvOpen] = useState(false); // Common events (v0.16)
  const [screensOpen, setScreensOpen] = useState(false); // Écrans composés (B6bis)
  // prefabs (v0.16) : enregistrement (event source), création (position
  // cible) et gestionnaire (Tools)
  const [prefabSave, setPrefabSave] = useState<GameEvent | null>(null);
  const [prefabPickAt, setPrefabPickAt] = useState<{ tx: number; ty: number } | null>(null);
  const [prefabMgr, setPrefabMgr] = useState(false);
  // curseur de CELLULE de la couche Événements (v0.16) : cible du Ctrl+V
  const [evCursor, setEvCursor] = useState<[number, number] | null>(null);
  // Database (Phase 10) : schémas + instances (null = pas de schemas/)
  const [db, setDb] = useState<Database | null>(null);
  const [dbOpen, setDbOpen] = useState(false);
  const [tilesetsOpen, setTilesetsOpen] = useState(false); // fenêtre Tilesets (T1)
  // fenêtre Textes (Tools →) — remplace l'onglet de la sidebar
  const [textsOpen, setTextsOpen] = useState(false);
  // fenêtre UI (Phase 12) : null = fermée, sinon le mode demandé
  const [uiMode, setUiMode] = useState<null | "widgets" | "dialogs">(null);
  // widgets du layout (racines) — pour la commande « Afficher un widget UI »
  const [uiWidgets, setUiWidgets] = useState<string[]>([]);
  // styles de dialogue (S1) — pour le champ « Boîte de dialogue » de msg/choice
  const [uiStyles, setUiStyles] = useState<string[]>([]);
  const [diagReport, setDiagReport] = useState<DatagenReport | null>(null);
  // presse-papier d'événement (menu Edit + clic droit)
  const [evClipboard, setEvClipboard] = useState<GameEvent | null>(null);
  // hauteur de la palette (séparateur palette / arborescence, persisté)
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
  // tileset de la scène : stem déclaré, sinon le premier du projet
  const tilesetPaths = data ? projectTilesets(data.project) : [];
  const tilesetNames = tilesetPaths.map(assetStem);
  const tsStem = scene ? scene.tileset ?? tilesetNames[0] : "";
  // T2 — entrées tileset nommées (fenêtre Tilesets, RM2003) : les scènes
  // stockent le STEM du fichier, l'entrée est le visage éditeur
  const tsDefs = data ? projectTilesetDefs(data.project) : [];
  const tsChoices = tsDefs.filter((d) => d.file);
  const tsCurrentDef =
    tsChoices.find((d) => assetStem(d.file) === tsStem)?.name ?? tsStem;
  const tileset = tilesets[tsStem] ?? null;
  const emptyMeta: TilesetMeta = { autotiles: [], solid: [], above: [] };
  const meta = (data && data.tilesetMeta[tsStem]) || emptyMeta;
  const autotiles = autoImgs[tsStem] ?? [];

  // Blocs de personnage de la feuille de sprites (v0.5 : le projet n'est
  // plus limité — datagen compile un set par scène, 5 blocs max chacune)
  const spriteBlocks = spriteBlockCount(sprites);
  const blockNames = data
    ? Array.from({ length: spriteBlocks }, (_, b) => charsetName(data.project, b))
    : [];
  // ressource → scènes qui l'utilisent (suppression bloquée si utilisé)
  const usedCharsets: Record<number, string[]> = {};
  const usedChipsets: Record<string, string[]> = {};
  if (data) {
    for (const [n, sc] of Object.entries(data.scenes)) {
      for (const e of sc.events) {
        if (e.sprite < 0) continue; // invisibles
        (usedCharsets[e.sprite] ??= []).includes(n) || usedCharsets[e.sprite].push(n);
      }
      const stem = sc.tileset ?? tilesetNames[0];
      (usedChipsets[stem] ??= []).push(n);
    }
  }

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
    // Database (Phase 10) : schémas + instances, si le projet en a une
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

  // ---- Menu Projet ---------------------------------------------------------

  // Nouveau projet : dossier choisi (vide) → projet minimal généré (une
  // scène 30x20, tileset/personnages/fonte de démarrage embarqués)
  async function newProject() {
    const root = await pickProjectDir();
    if (!root) return;
    try {
      let taken = false;
      try {
        await readBinaryFile(`${root}/project.json`);
        taken = true;
      } catch {
        /* pas de project.json : dossier libre */
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
      window.close(); // mode navigateur
    }
  }

  // ---- Tools : vérification du projet --------------------------------------

  async function openDiagnostics() {
    if (!data) return;
    setDiags(checkProject(data, spriteBlocks));
    if (!canBuild()) {
      setDiagReport(null);
      return;
    }
    setDiagReport({ running: true, compression: [], warnings: [] });
    try {
      await saveProject(data); // datagen lit le disque
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
        // multi-bank (M1) : datagen imprime les totaux des pools
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
        /* pas encore de ROM compilé */
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

  // ---- Menu Edit + clic droit : presse-papier d'événement -------------------

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

  // colle sur (tx,ty) si fourni, sinon première tile libre autour de l'origine
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

  // ---- couche Événements : création / édition / prefabs --------------------

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

  // Enregistre l'event comme prefab (nom + catégorie choisis dans la
  // fenêtre SavePrefabModal — v0.16)
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

  // Ctrl+C / Ctrl+X / Ctrl+V / Suppr sur la COUCHE ÉVÉNEMENTS de la carte
  // (v0.16) — inactifs dès qu'une fenêtre ou un champ a le focus
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
          // colle sur la cellule sélectionnée (curseur), sinon près de
          // l'origine de la copie
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

  // Import d'un charset RPG Maker 2003 : choix du fichier, puis modal
  // d'aperçu (personnage + bloc de destination) → datagen import-charset
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
      // le nom du personnage part dans project.json (charsets[bloc]) avant
      // la sauvegarde — l'import CLI ne réécrit que assets/sprites.png
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

  // ---- Gestionnaire de ressources (façon RM2003) --------------------------

  async function exportCharset(b: number) {
    if (!data || !sprites) return;
    const path = await pickSavePath(
      "Exporter le charset (format RM2003, 72x128)",
      `${blockNames[b] ?? "charset"}.png`
    );
    if (!path) return;
    try {
      // recomposition d'une feuille RM2003 d'un personnage : nos frames
      // 16x24 recollées au centre-bas des cases 24x32, ordre RM des
      // rangées (haut, droite, bas, gauche) et colonnes (gauche, repos, droit)
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
      // fichiers : la grille est renommée, l'ancien sidecar retiré (le
      // nouveau est réécrit par la sauvegarde), les refs mises à jour
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
        /* pas de sidecar */
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
      // bande réécrite sans les 12 frames du bloc
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
      // autotiles partagés avec un autre tileset : conservés
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
          /* déjà absent */
        }
      }
      for (const a of tsMeta?.autotiles ?? []) {
        if (shared.has(a)) continue;
        try {
          await removePath(`${root}/${a}`);
        } catch {
          /* déjà absent */
        }
      }
      await reloadProject(root, keep);
      setStatus(`Tileset supprimé : « ${stem} »`);
    } catch (e) {
      setStatus(`Suppression : ${e}`);
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

  // Windowskins (Phase 11) : PNG 24x24 9-slice importés via le
  // Gestionnaire de ressources — registre project.windowskins (éditeur
  // seulement), le thème actif se choisit dans Tools → UI / Thème.
  async function importWindowskin() {
    if (!data) return;
    try {
      const file = await pickPngFile("Importer un windowskin (PNG 24x24, 9-slice)");
      if (!file) return;
      const bytes = await readBinaryFile(file);
      const bmp = await createImageBitmap(
        new Blob([bytes as BlobPart], { type: "image/png" })
      );
      if (bmp.width !== 24 || bmp.height !== 24) {
        setStatus(`Windowskin : attendu 24x24 (9 tiles 8x8), reçu ${bmp.width}x${bmp.height}`);
        return;
      }
      const name = file.split(/[\\/]/).pop()!;
      const rel = `assets/${name}`;
      await writeBinaryFile(`${data.root}/${rel}`, bytes);
      if (!projectWindowskins(data.project).includes(rel)) {
        mutate((d) => ({
          ...d,
          project: {
            ...d.project,
            windowskins: [...projectWindowskins(d.project), rel],
          },
        }));
      }
      setStatus(`Windowskin importé : ${name}`);
    } catch (e) {
      setStatus(`Import windowskin : ${e}`);
    }
  }

  async function exportWindowskin(rel: string) {
    if (!data) return;
    const path = await pickSavePath("Exporter le windowskin (PNG 24x24)", `${assetStem(rel)}.png`);
    if (!path) return;
    try {
      await writeBinaryFile(path, await readBinaryFile(`${data.root}/${rel}`));
      setStatus(`Windowskin exporté : ${path}`);
    } catch (e) {
      setStatus(`Export windowskin : ${e}`);
    }
  }

  async function renameWindowskin(oldRel: string, newName: string) {
    if (!data) return;
    const newStem = newName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!newStem || newStem === assetStem(oldRel)) return;
    const newRel = `assets/${newStem}.png`;
    if (projectWindowskins(data.project).includes(newRel)) {
      setStatus(`Renommage : le windowskin « ${newStem} » existe déjà`);
      return;
    }
    const keep = sceneName;
    try {
      // fichier renommé + refs (registre et thème actif) dans le même
      // geste, projet sauvegardé pour que le disque reste cohérent
      const windowskins = projectWindowskins(data.project).map((r) =>
        r === oldRel ? newRel : r
      );
      const ui =
        data.project.ui?.windowskin === oldRel
          ? { ...data.project.ui, windowskin: newRel }
          : data.project.ui;
      const d2: ProjectData = {
        ...data,
        project: { ...data.project, windowskins, ui },
      };
      await renamePath(`${data.root}/${oldRel}`, `${data.root}/${newRel}`);
      await saveProject(d2);
      await reloadProject(data.root, keep);
      setStatus(`Windowskin renommé : ${assetStem(oldRel)} → ${newStem}`);
    } catch (e) {
      setStatus(`Renommage : ${e}`);
    }
  }

  async function deleteWindowskin(rel: string) {
    if (!data || data.project.ui?.windowskin === rel) return; // thème actif
    if (!confirm(`Supprimer le windowskin « ${assetStem(rel)} » et son fichier ?`)) return;
    const keep = sceneName;
    try {
      const windowskins = projectWindowskins(data.project).filter((r) => r !== rel);
      const d2: ProjectData = {
        ...data,
        project: {
          ...data.project,
          windowskins: windowskins.length ? windowskins : undefined,
        },
      };
      await saveProject(d2);
      try {
        await removePath(`${data.root}/${rel}`);
      } catch {
        /* déjà absent */
      }
      await reloadProject(data.root, keep);
      setStatus(`Windowskin supprimé : ${assetStem(rel)}`);
    } catch (e) {
      setStatus(`Suppression : ${e}`);
    }
  }

  // Planches d'icônes des widgets (W1) : PNG bande Nx8 (largeur multiple
  // de 8, max 64 icônes) — même modèle de registre que les windowskins.
  async function importIconset() {
    if (!data) return;
    try {
      const file = await pickPngFile("Importer une planche d'icônes (PNG Nx8, largeur multiple de 8)");
      if (!file) return;
      const bytes = await readBinaryFile(file);
      const bmp = await createImageBitmap(
        new Blob([bytes as BlobPart], { type: "image/png" })
      );
      if (bmp.height !== 8 || bmp.width % 8 !== 0 || bmp.width === 0 || bmp.width > 512) {
        setStatus(
          `Planche d'icônes : attendu une bande Nx8 (largeur multiple de 8, max 64 icônes), reçu ${bmp.width}x${bmp.height}`
        );
        return;
      }
      setTransPick({ kind: "iconset", file, bytes, bmp });
    } catch (e) {
      setStatus(`Import planche d'icônes : ${e}`);
    }
  }

  async function exportIconset(rel: string) {
    if (!data) return;
    const path = await pickSavePath("Exporter la planche d'icônes (PNG)", `${assetStem(rel)}.png`);
    if (!path) return;
    try {
      await writeBinaryFile(path, await readBinaryFile(`${data.root}/${rel}`));
      setStatus(`Planche d'icônes exportée : ${path}`);
    } catch (e) {
      setStatus(`Export planche d'icônes : ${e}`);
    }
  }

  async function renameIconset(oldRel: string, newName: string) {
    if (!data) return;
    const newStem = newName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!newStem || newStem === assetStem(oldRel)) return;
    const newRel = `assets/${newStem}.png`;
    if (projectIconsets(data.project).includes(newRel)) {
      setStatus(`Renommage : la planche « ${newStem} » existe déjà`);
      return;
    }
    const keep = sceneName;
    try {
      const iconsets = projectIconsets(data.project).map((r) => (r === oldRel ? newRel : r));
      const ui =
        data.project.ui?.icons === oldRel
          ? { ...data.project.ui, icons: newRel }
          : data.project.ui;
      const d2: ProjectData = { ...data, project: { ...data.project, iconsets, ui } };
      await renamePath(`${data.root}/${oldRel}`, `${data.root}/${newRel}`);
      await saveProject(d2);
      await reloadProject(data.root, keep);
      setStatus(`Planche d'icônes renommée : ${assetStem(oldRel)} → ${newStem}`);
    } catch (e) {
      setStatus(`Renommage : ${e}`);
    }
  }

  async function deleteIconset(rel: string) {
    if (!data || data.project.ui?.icons === rel) return; // planche active
    if (!confirm(`Supprimer la planche d'icônes « ${assetStem(rel)} » et son fichier ?`)) return;
    const keep = sceneName;
    try {
      const iconsets = projectIconsets(data.project).filter((r) => r !== rel);
      const d2: ProjectData = {
        ...data,
        project: { ...data.project, iconsets: iconsets.length ? iconsets : undefined },
      };
      await saveProject(d2);
      try {
        await removePath(`${data.root}/${rel}`);
      } catch {
        /* déjà absent */
      }
      await reloadProject(data.root, keep);
      setStatus(`Planche d'icônes supprimée : ${assetStem(rel)}`);
    } catch (e) {
      setStatus(`Suppression : ${e}`);
    }
  }

  // Fontes (S1) : PNG bande 768x8 (96 glyphes ASCII 32-127) — même modèle
  // de registre. assets.font est la fonte du projet (★) ; les autres
  // servent aux styles de dialogue. Export demandé explicitement par
  // Bertrand (« la font soit exportable depuis le ressource »).
  async function importFont() {
    if (!data) return;
    try {
      const file = await pickPngFile("Importer une fonte (PNG 768x8 — 96 glyphes 8x8)");
      if (!file) return;
      const bytes = await readBinaryFile(file);
      const bmp = await createImageBitmap(
        new Blob([bytes as BlobPart], { type: "image/png" })
      );
      if (bmp.width !== 768 || bmp.height !== 8) {
        setStatus(
          `Fonte : attendu une bande 768x8 (96 glyphes 8x8, ASCII 32-127), reçu ${bmp.width}x${bmp.height}`
        );
        return;
      }
      const name = file.split(/[\\/]/).pop()!;
      const rel = `assets/${name}`;
      await writeBinaryFile(`${data.root}/${rel}`, bytes);
      if (!projectFonts(data.project).includes(rel)) {
        mutate((d) => ({
          ...d,
          project: { ...d.project, fonts: [...(d.project.fonts ?? []), rel] },
        }));
      }
      setStatus(`Fonte importée : ${name}`);
    } catch (e) {
      setStatus(`Import fonte : ${e}`);
    }
  }

  async function exportFont(rel: string) {
    if (!data) return;
    const path = await pickSavePath("Exporter la fonte (PNG)", `${assetStem(rel)}.png`);
    if (!path) return;
    try {
      await writeBinaryFile(path, await readBinaryFile(`${data.root}/${rel}`));
      setStatus(`Fonte exportée : ${path}`);
    } catch (e) {
      setStatus(`Export fonte : ${e}`);
    }
  }

  async function renameFont(oldRel: string, newName: string) {
    if (!data) return;
    const newStem = newName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!newStem || newStem === assetStem(oldRel)) return;
    const newRel = `assets/${newStem}.png`;
    if (projectFonts(data.project).includes(newRel)) {
      setStatus(`Renommage : la fonte « ${newStem} » existe déjà`);
      return;
    }
    const keep = sceneName;
    try {
      const fonts = (data.project.fonts ?? []).map((r) => (r === oldRel ? newRel : r));
      const assets =
        data.project.assets.font === oldRel
          ? { ...data.project.assets, font: newRel }
          : data.project.assets;
      await renamePath(`${data.root}/${oldRel}`, `${data.root}/${newRel}`);
      // les styles de dialogue ET les widgets qui pointaient l'ancienne
      // fonte suivent (S2)
      const l = await loadUiLayout2(data.root);
      if (
        l.styles.some((s) => s.font === oldRel) ||
        l.nodes.some((n) => n.font === oldRel)
      ) {
        l.styles = l.styles.map((s) => (s.font === oldRel ? { ...s, font: newRel } : s));
        l.nodes = l.nodes.map((n) => (n.font === oldRel ? { ...n, font: newRel } : n));
        await writeProjectText(data.root, "ui/layout.toml", layoutToToml(l));
      }
      const d2: ProjectData = {
        ...data,
        project: { ...data.project, fonts: fonts.length ? fonts : undefined, assets },
      };
      await saveProject(d2);
      await reloadProject(data.root, keep);
      setStatus(`Fonte renommée : ${assetStem(oldRel)} → ${newStem}`);
    } catch (e) {
      setStatus(`Renommage : ${e}`);
    }
  }

  async function deleteFont(rel: string) {
    if (!data || data.project.assets.font === rel) return; // fonte du projet ★
    try {
      // refusé si un style de dialogue OU un widget l'utilise
      const l = await loadUiLayout2(data.root);
      const users = [
        ...l.styles.filter((s) => s.font === rel).map((s) => `style ${s.id}`),
        ...l.nodes.filter((n) => n.font === rel).map((n) => `widget ${n.id}`),
      ];
      if (users.length) {
        setStatus(`Fonte utilisée par : ${users.join(", ")} — changer d'abord dans Tools → UI.`);
        return;
      }
      if (!confirm(`Supprimer la fonte « ${assetStem(rel)} » et son fichier ?`)) return;
      const keep = sceneName;
      const fonts = (data.project.fonts ?? []).filter((r) => r !== rel);
      const d2: ProjectData = {
        ...data,
        project: { ...data.project, fonts: fonts.length ? fonts : undefined },
      };
      await saveProject(d2);
      try {
        await removePath(`${data.root}/${rel}`);
      } catch {
        /* déjà absent */
      }
      await reloadProject(data.root, keep);
      setStatus(`Fonte supprimée : ${assetStem(rel)}`);
    } catch (e) {
      setStatus(`Suppression : ${e}`);
    }
  }


  // Pictures (S3) : PNG indexé <= 16 couleurs, <= 256x224 (multiples de
  // 8) — affichées plein écran par « Afficher une image ». Registre
  // project.pictures LU par datagen (l'ordre donne les pic_id).
  async function importPicture() {
    if (!data) return;
    try {
      const file = await pickPngFile("Importer une image (PNG indexé ≤ 16 couleurs, ≤ 256x224)");
      if (!file) return;
      const bytes = await readBinaryFile(file);
      const bmp = await createImageBitmap(
        new Blob([bytes as BlobPart], { type: "image/png" })
      );
      if (
        bmp.width === 0 || bmp.height === 0 ||
        bmp.width > 256 || bmp.height > 224 ||
        bmp.width % 8 !== 0 || bmp.height % 8 !== 0
      ) {
        setStatus(
          `Image : attendu ≤ 256x224 avec dimensions multiples de 8, reçu ${bmp.width}x${bmp.height}`
        );
        return;
      }
      setTransPick({ kind: "picture", file, bytes, bmp });
    } catch (e) {
      setStatus(`Import image : ${e}`);
    }
  }

  // Phase 2 des imports à picker (S4) : la couleur transparente est
  // connue — transformer (alpha 0), valider, écrire, enregistrer
  async function finishTransPick(color: Rgb | null) {
    const t = transPick;
    setTransPick(null);
    if (!data || !t) return;
    try {
      const bytes = color ? await applyTransparency(t.bytes, color) : t.bytes;
      const name = t.file.split(/[\\/]/).pop()!;
      const rel = `assets/${name}`;
      if (t.kind === "iconset") {
        await writeBinaryFile(`${data.root}/${rel}`, bytes);
        if (!projectIconsets(data.project).includes(rel)) {
          mutate((d) => ({
            ...d,
            project: { ...d.project, iconsets: [...projectIconsets(d.project), rel] },
          }));
        }
        setStatus(`Planche d'icônes importée : ${name} (${t.bmp.width / 8} icônes)`);
      } else if (t.kind === "picture") {
        // comptage des couleurs OPAQUES restantes : ≤ 16 sans
        // transparence (PNG indexé conservé tel quel), ≤ 15 avec (le
        // PNG réécrit passe par l'indexation alpha de datagen, index 0
        // réservé au transparent). Un PNG DÉJÀ troué (pixels alpha)
        // est une image à transparence même sans couleur cliquée —
        // sinon le drapeau trans manquait et la couche d'effet (S9) ou
        // le décor-au-travers refusaient l'image au build.
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
              trans = true; // trou alpha : transparence automatique
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
        await writeBinaryFile(`${data.root}/${rel}`, bytes);
        const entry = trans ? { path: rel, trans: true } : rel;
        if (!projectPictures(data.project).some((e) => picPath(e) === rel)) {
          mutate((d) => ({
            ...d,
            project: { ...d.project, pictures: [...projectPictures(d.project), entry] },
          }));
        }
        setStatus(
          `Image importée : ${name} (${t.bmp.width}x${t.bmp.height}${trans ? ", avec transparence — le décor se verra à travers" : ""})`
        );
      } else {
        // charset : datagen import-charset lit un FICHIER — copie
        // temporaire avec la transparence percée, consommée par la
        // fenêtre d'import (remplacée à chaque import)
        const tmp = `${data.root}/assets/_charset_import.png`;
        await writeBinaryFile(tmp, bytes);
        const bmp2 = color ? await createImageBitmap(new Blob([bytes as BlobPart], { type: "image/png" })) : t.bmp;
        setCharsetImport({ path: tmp, bmp: bmp2 });
      }
    } catch (e) {
      setStatus(`Import : ${e}`);
    }
  }

  async function exportPicture(rel: string) {
    if (!data) return;
    const path = await pickSavePath("Exporter l'image (PNG)", `${assetStem(rel)}.png`);
    if (!path) return;
    try {
      await writeBinaryFile(path, await readBinaryFile(`${data.root}/${rel}`));
      setStatus(`Image exportée : ${path}`);
    } catch (e) {
      setStatus(`Export image : ${e}`);
    }
  }

  async function renamePicture(oldRel: string, newName: string) {
    if (!data) return;
    const newStem = newName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!newStem || newStem === assetStem(oldRel)) return;
    const newRel = `assets/${newStem}.png`;
    if (projectPictures(data.project).some((e) => picPath(e) === newRel)) {
      setStatus(`Renommage : l'image « ${newStem} » existe déjà`);
      return;
    }
    const keep = sceneName;
    try {
      const pictures = projectPictures(data.project).map((e) =>
        picPath(e) !== oldRel ? e : typeof e === "string" ? newRel : { ...e, path: newRel }
      );
      await renamePath(`${data.root}/${oldRel}`, `${data.root}/${newRel}`);
      const d2: ProjectData = {
        ...data,
        project: { ...data.project, pictures },
      };
      await saveProject(d2);
      await reloadProject(data.root, keep);
      setStatus(
        `Image renommée : ${assetStem(oldRel)} → ${newStem} — corriger les « Afficher une image » qui l'utilisaient (le build les signale)`
      );
    } catch (e) {
      setStatus(`Renommage : ${e}`);
    }
  }

  async function deletePicture(rel: string) {
    if (!data) return;
    if (!confirm(`Supprimer l'image « ${assetStem(rel)} » et son fichier ? Les commandes « Afficher une image » qui l'utilisent seront signalées au build.`)) return;
    const keep = sceneName;
    try {
      const pictures = projectPictures(data.project).filter((e) => picPath(e) !== rel);
      const d2: ProjectData = {
        ...data,
        project: { ...data.project, pictures: pictures.length ? pictures : undefined },
      };
      await saveProject(d2);
      try {
        await removePath(`${data.root}/${rel}`);
      } catch {
        /* déjà absent */
      }
      await reloadProject(data.root, keep);
      setStatus(`Image supprimée : ${assetStem(rel)}`);
    } catch (e) {
      setStatus(`Suppression : ${e}`);
    }
  }

  // Sons & musiques (B1) : fichiers copiés dans assets/, listes du
  // project.json (l'ordre donne les sfx_id / music_id)
  async function importAudio(kind: "sound" | "music") {
    if (!data) return;
    try {
      const file =
        kind === "sound"
          ? await pickFile("Importer un son (WAV, ~2 s max — converti en BRR au build)", "WAV", ["wav"])
          : await pickFile("Importer une musique (module Impulse Tracker)", "IT", ["it"]);
      if (!file) return;
      const name = file.split(/[\\/]/).pop()!.toLowerCase().replace(/[^a-z0-9_.]/g, "_");
      const rel = kind === "sound" ? `assets/sounds/${name}` : `assets/music/${name}`;
      const list = kind === "sound" ? (data.project.sounds ?? []) : (data.project.musics ?? []);
      if (list.includes(rel)) {
        setStatus(`Import : « ${musicStem(rel)} » existe déjà dans le projet`);
        return;
      }
      await writeBinaryFile(`${data.root}/${rel}`, await readBinaryFile(file));
      mutate((d) => ({
        ...d,
        project:
          kind === "sound"
            ? { ...d.project, sounds: [...(d.project.sounds ?? []), rel] }
            : { ...d.project, musics: [...(d.project.musics ?? []), rel] },
      }));
      setStatus(
        kind === "sound"
          ? `Son importé : ${musicStem(rel)} — à jouer via la commande « Jouer un son »`
          : `Musique importée : ${musicStem(rel)} — à choisir dans l'onglet Scène ou « Changer la musique »`
      );
    } catch (e) {
      setStatus(`Import audio : ${e}`);
    }
  }

  async function exportAudio(kind: "sound" | "music", rel: string) {
    if (!data) return;
    const ext = kind === "sound" ? "wav" : "it";
    const path = await pickSavePath(
      kind === "sound" ? "Exporter le son (WAV)" : "Exporter la musique (IT)",
      `${musicStem(rel)}.${ext}`
    );
    if (!path) return;
    try {
      await writeBinaryFile(path, await readBinaryFile(`${data.root}/${rel}`));
      setStatus(`Exporté : ${path}`);
    } catch (e) {
      setStatus(`Export : ${e}`);
    }
  }

  async function renameAudio(kind: "sound" | "music", oldRel: string, newName: string) {
    if (!data) return;
    const newStem = newName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!newStem || newStem === musicStem(oldRel)) return;
    const ext = kind === "sound" ? "wav" : "it";
    const dir = kind === "sound" ? "assets/sounds" : "assets/music";
    const newRel = `${dir}/${newStem}.${ext}`;
    const list = kind === "sound" ? (data.project.sounds ?? []) : (data.project.musics ?? []);
    if (list.includes(newRel)) {
      setStatus(`Renommage : « ${newStem} » existe déjà`);
      return;
    }
    const keep = sceneName;
    try {
      const next = list.map((r) => (r === oldRel ? newRel : r));
      await renamePath(`${data.root}/${oldRel}`, `${data.root}/${newRel}`);
      const d2: ProjectData = {
        ...data,
        project:
          kind === "sound"
            ? { ...data.project, sounds: next }
            : { ...data.project, musics: next },
      };
      await saveProject(d2);
      await reloadProject(data.root, keep);
      setStatus(
        `Renommé : ${musicStem(oldRel)} → ${newStem}` +
          (kind === "sound"
            ? " — corriger les « Jouer un son » qui l'utilisaient (le build les signale)"
            : " — corriger les scènes et « Changer la musique » qui l'utilisaient")
      );
    } catch (e) {
      setStatus(`Renommage : ${e}`);
    }
  }

  async function deleteAudio(kind: "sound" | "music", rel: string) {
    if (!data) return;
    const what = kind === "sound" ? "le son" : "la musique";
    if (!confirm(`Supprimer ${what} « ${musicStem(rel)} » et son fichier ?`)) return;
    const keep = sceneName;
    try {
      const list = (kind === "sound" ? (data.project.sounds ?? []) : (data.project.musics ?? []))
        .filter((r) => r !== rel);
      const d2: ProjectData = {
        ...data,
        project:
          kind === "sound"
            ? { ...data.project, sounds: list.length ? list : undefined }
            : { ...data.project, musics: list.length ? list : undefined },
      };
      await saveProject(d2);
      try {
        await removePath(`${data.root}/${rel}`);
      } catch {
        /* déjà absent */
      }
      await reloadProject(data.root, keep);
      setStatus(`Supprimé : ${musicStem(rel)}`);
    } catch (e) {
      setStatus(`Suppression : ${e}`);
    }
  }

  // Vignettes (B5) : bandes de frames 32x32 (PNG à transparence)
  async function importVignette() {
    if (!data) return;
    try {
      const file = await pickPngFile("Importer une vignette (bande de frames 32x32, PNG à transparence)");
      if (!file) return;
      const bytes = await readBinaryFile(file);
      const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: "image/png" }));
      if (bmp.height !== 32 || bmp.width % 32 !== 0 || bmp.width === 0 || bmp.width > 256) {
        setStatus(`Vignette : attendu une bande 32 px de haut, largeur multiple de 32 (1-8 frames) — reçu ${bmp.width}x${bmp.height}`);
        return;
      }
      const name = file.split(/[\\/]/).pop()!.toLowerCase().replace(/[^a-z0-9_.]/g, "_");
      const rel = `assets/vignettes/${name}`;
      if ((data.project.vignettes ?? []).includes(rel)) {
        setStatus(`Vignette « ${musicStem(rel)} » : existe déjà`);
        return;
      }
      await writeBinaryFile(`${data.root}/${rel}`, bytes);
      mutate((d) => ({
        ...d,
        project: { ...d.project, vignettes: [...(d.project.vignettes ?? []), rel] },
      }));
      setStatus(`Vignette importée : ${musicStem(rel)} (${bmp.width / 32} frame(s))`);
    } catch (e) {
      setStatus(`Import vignette : ${e}`);
    }
  }

  async function exportVignette(rel: string) {
    if (!data) return;
    const path = await pickSavePath("Exporter la vignette (PNG)", `${musicStem(rel)}.png`);
    if (!path) return;
    try {
      await writeBinaryFile(path, await readBinaryFile(`${data.root}/${rel}`));
      setStatus(`Vignette exportée : ${path}`);
    } catch (e) {
      setStatus(`Export : ${e}`);
    }
  }

  async function renameVignette(oldRel: string, newName: string) {
    if (!data) return;
    const newStem = newName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!newStem || newStem === musicStem(oldRel)) return;
    const newRel = `assets/vignettes/${newStem}.png`;
    if ((data.project.vignettes ?? []).includes(newRel)) {
      setStatus(`Renommage : « ${newStem} » existe déjà`);
      return;
    }
    const keep = sceneName;
    try {
      const list = (data.project.vignettes ?? []).map((r) => (r === oldRel ? newRel : r));
      await renamePath(`${data.root}/${oldRel}`, `${data.root}/${newRel}`);
      const d2: ProjectData = { ...data, project: { ...data.project, vignettes: list } };
      await saveProject(d2);
      await reloadProject(data.root, keep);
      setStatus(`Vignette renommée : ${musicStem(oldRel)} → ${newStem} — corriger les « Afficher une vignette » qui l'utilisaient (le build les signale)`);
    } catch (e) {
      setStatus(`Renommage : ${e}`);
    }
  }

  async function deleteVignette(rel: string) {
    if (!data) return;
    if (!confirm(`Supprimer la vignette « ${musicStem(rel)} » et son fichier ?`)) return;
    const keep = sceneName;
    try {
      const list = (data.project.vignettes ?? []).filter((r) => r !== rel);
      const d2: ProjectData = {
        ...data,
        project: { ...data.project, vignettes: list.length ? list : undefined },
      };
      await saveProject(d2);
      try {
        await removePath(`${data.root}/${rel}`);
      } catch {
        /* déjà absent */
      }
      await reloadProject(data.root, keep);
      setStatus(`Vignette supprimée : ${musicStem(rel)}`);
    } catch (e) {
      setStatus(`Suppression : ${e}`);
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
      const res = await runDatagen(data.root, playCfg.debug);
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
    if (layer === "events") return; // la couche Événements ne se peint pas
    if (layer === "upper" && scene?.effect) return; // couche d'effet (S9)
    setScene((sc) => paintStamp(sc, layer, tx, ty, ox, oy, tool.tiles), first);
  }

  // rectangle / ellipse / pot de peinture : un geste = une entrée d'undo
  function applyPattern(cells: Array<[number, number]>, ax: number, ay: number) {
    if (layer === "events") return;
    if (layer === "upper" && scene?.effect) return;
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
      const gen = await runDatagen(data.root, playCfg.debug);
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

  // Build « cartouche » : .smc prêt pour flashcart (Super UFO Pro 8 & co) —
  // miroité à 512 Ko minimum, checksum recalculé (tools/mkcart.sh)
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
      setStatus("Build cartouche (make cart)…");
      const mk = await runMakeCart(data.root, playCfg.bash);
      setStatus(
        mk.ok
          ? "Cartouche prête : engine/snesstudio.smc (512 Ko, à copier sur la flashcart)."
          : `make cart a échoué : ${mk.output.slice(-400)}`
      );
    } catch (e) {
      setStatus(`Build cartouche : ${e}`);
    } finally {
      setBuilding(false);
    }
  }

  // Recompilation complète : make clean + make (à utiliser après une mise à
  // jour du moteur — évite tout mélange d'objets compilés obsolètes)
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
      setStatus("Recompilation complète du ROM (make clean + make)…");
      const mk = await runMake(data.root, playCfg.bash, true);
      setStatus(mk.ok ? "ROM recompilé de zéro." : `make a échoué : ${mk.output.slice(-400)}`);
    } catch (e) {
      setStatus(`Recompilation : ${e}`);
    } finally {
      setBuilding(false);
    }
  }

  function savePlayCfg(c: PlayConfig) {
    setPlayCfg(c);
    localStorage.setItem("snesstudio.bash", c.bash);
    localStorage.setItem("snesstudio.emulator", c.emulator);
    localStorage.setItem("snesstudio.debug", c.debug ? "1" : "0");
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
    const parent = newSceneParent ?? undefined;
    mutate((d) => ({
      ...d,
      project: { ...d.project, scenes: [...d.project.scenes, name] },
      scenes: { ...d.scenes, [name]: { ...newScene(name, width, height), parent } },
    }));
    setSceneName(name);
    setSelEvent(null);
    setShowNewScene(false);
  }

  // déplacement dans l'arborescence (organisationnel — datagen l'ignore)
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
        // les enfants de la scène supprimée remontent d'un cran
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

  useEffect(() => {
    localStorage.setItem("snesstudio.paletteH", String(paletteH));
  }, [paletteH]);

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
      setSelEvent(null);
    }
  }, [data, sceneName]);

  // changement de scène : le curseur de cellule ne survit pas
  useEffect(() => {
    setEvCursor(null);
  }, [sceneName]);

  // Barre de menus (façon RM2003)
  const menus = [
    {
      label: "Projet",
      items: [
        { label: "Nouveau projet…", action: newProject, disabled: !canWriteFiles() },
        { label: "Ouvrir un projet…", action: openProject },
        { label: "Fermer le projet", action: closeProject, disabled: !data },
        { sep: true },
        {
          label: "Explorer le dossier du projet",
          action: () => {
            if (data) void openProjectFolder(data.root);
          },
          disabled: !data || !canWriteFiles(),
        },
        { sep: true },
        { label: "Quitter", action: () => void quitApp() },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Annuler", hint: "Ctrl+Z", action: doUndo, disabled: !data },
        { label: "Rétablir", hint: "Ctrl+Y", action: doRedo, disabled: !data },
        { sep: true },
        { label: "Couper l'événement sélectionné", action: cutEvent, disabled: !selectedEvent },
        { label: "Copier l'événement sélectionné", action: copyEvent, disabled: !selectedEvent },
        { label: "Coller l'événement", action: () => pasteEvent(), disabled: !data || !evClipboard },
        { label: "Supprimer l'événement sélectionné", action: deleteSelEvent, disabled: !selectedEvent },
        { sep: true },
        {
          label: "Réglages du projet…",
          action: () => setShowSettings(true),
          disabled: !canBuild(),
        },
      ],
    },
    {
      label: "Tools",
      items: [
        {
          label: "Switches et variables…",
          action: () => setVarMgr(true),
          disabled: !data,
        },
        {
          label: "Common events…",
          action: () => setCommonEvOpen(true),
          disabled: !data,
        },
        {
          label: "Écrans composés…",
          action: () => setScreensOpen(true),
          disabled: !data,
        },
        {
          label: "Prefabs…",
          action: () => setPrefabMgr(true),
          disabled: !data,
        },
        {
          label: "Tilesets…",
          action: () => setTilesetsOpen(true),
          disabled: !data,
        },
        {
          label: "Database…",
          action: () => setDbOpen(true),
          disabled: !data,
        },
        {
          label: "Textes…",
          action: () => setTextsOpen(true),
          disabled: !data,
        },
        {
          label: "UI",
          disabled: !data,
          sub: [
            {
              label: "Widgets…",
              action: () => setUiMode("widgets"),
              disabled: !data,
            },
            {
              label: "Dialogues et choix…",
              action: () => setUiMode("dialogs"),
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
          action: play,
          disabled: !data || !canBuild() || playing || building,
        },
        {
          label: "Vérifier le projet…",
          action: () => void openDiagnostics(),
          disabled: !data,
        },
        {
          label: "Générer les données",
          action: generate,
          disabled: !data || !canBuild() || playing || building,
        },
        {
          label: "Build cartouche (.smc)",
          hint: "flashcart",
          action: () => void buildCart(),
          disabled: !data || !canBuild() || playing || building,
        },
        {
          label: "Recompiler tout (clean)",
          hint: "après mise à jour",
          action: () => void rebuildAll(),
          disabled: !data || !canBuild() || playing || building,
        },
      ],
    },
    {
      label: "Help",
      items: [{ label: "Version…", action: () => setShowAbout(true) }],
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
        {/* gestion des scènes : arborescence sous la palette (façon RM2003) */}
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
              onClick={() => !scene.effect && setLayer("upper")}
              disabled={!!scene.effect}
              title={
                scene.effect
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
        {data && (
          <button
            onClick={() => setShowResources(true)}
            title="Gestionnaire de ressources (charsets, chipsets) — importer, exporter, renommer, supprimer"
          >
            🗂 Ressources
          </button>
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
        <span className="status">{status}</span>
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
              <button className={tab === "effect" ? "active" : ""} onClick={() => setTab("effect")}>
                Couche d'effet
              </button>
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
          <p>SNES Studio — éditeur (Phase 3b)</p>
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
          onImportSound={() => void importAudio("sound")}
          onImportMusic={() => void importAudio("music")}
          onExportSound={(rel) => void exportAudio("sound", rel)}
          onExportMusic={(rel) => void exportAudio("music", rel)}
          onRenameSound={(rel, n) => void renameAudio("sound", rel, n)}
          onRenameMusic={(rel, n) => void renameAudio("music", rel, n)}
          onDeleteSound={(rel) => void deleteAudio("sound", rel)}
          onDeleteMusic={(rel) => void deleteAudio("music", rel)}
          vignettes={data.project.vignettes ?? []}
          onImportVignette={() => void importVignette()}
          onExportVignette={(rel) => void exportVignette(rel)}
          onRenameVignette={(rel, n) => void renameVignette(rel, n)}
          onDeleteVignette={(rel) => void deleteVignette(rel)}
          pictures={projectPictures(data.project).map(picPath)}
          usedCharsets={usedCharsets}
          usedChipsets={usedChipsets}
          canWrite={canWriteFiles()}
          onImportCharset={importCharset}
          onImportChipset={importChipset}
          onImportWindowskin={() => void importWindowskin()}
          onImportIconset={() => void importIconset()}
          onImportFont={() => void importFont()}
          onImportPicture={() => void importPicture()}
          onExportCharset={exportCharset}
          onExportChipset={exportChipset}
          onExportWindowskin={(rel) => void exportWindowskin(rel)}
          onExportIconset={(rel) => void exportIconset(rel)}
          onExportFont={(rel) => void exportFont(rel)}
          onExportPicture={(rel) => void exportPicture(rel)}
          onRenameCharset={renameCharset}
          onRenameChipset={renameChipset}
          onRenameWindowskin={(rel, n) => void renameWindowskin(rel, n)}
          onRenameIconset={(rel, n) => void renameIconset(rel, n)}
          onRenameFont={(rel, n) => void renameFont(rel, n)}
          onRenamePicture={(rel, n) => void renamePicture(rel, n)}
          onDeleteCharset={deleteCharset}
          onDeleteChipset={deleteChipset}
          onDeleteWindowskin={(rel) => void deleteWindowskin(rel)}
          onDeleteIconset={(rel) => void deleteIconset(rel)}
          onDeleteFont={(rel) => void deleteFont(rel)}
          onDeletePicture={(rel) => void deletePicture(rel)}
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
      {dbOpen && data && (
        <DatabaseModal
          db={db ?? { schemas: [], entries: {} }}
          textNames={data.texts.map((t) => t.name)}
          root={data.root}
          pictures={(data.project.pictures ?? []).map(picPath)}
          sounds={data.project.sounds ?? []}
          musics={data.project.musics ?? []}
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
          root={data.root}
          mode={uiMode}
          project={data.project}
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
          tintPresets={data.project.tint_presets ?? []}
          soundNames={(data.project.sounds ?? []).map(musicStem)}
          musicNames={(data.project.musics ?? []).map(musicStem)}
          vigNames={(data.project.vignettes ?? []).map(musicStem)}
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
      {commonEvOpen && data && (
        <CommonEventsModal
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
                tintPresets={data.project.tint_presets ?? []}
                soundNames={(data.project.sounds ?? []).map(musicStem)}
                musicNames={(data.project.musics ?? []).map(musicStem)}
                vigNames={(data.project.vignettes ?? []).map(musicStem)}
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
          db={db}
          uiWidgets={uiWidgets}
          uiStyles={uiStyles}
          texts={data.texts}
          pictures={projectPictures(data.project).map((e) => assetStem(picPath(e)))}
                tintPresets={data.project.tint_presets ?? []}
                soundNames={(data.project.sounds ?? []).map(musicStem)}
                musicNames={(data.project.musics ?? []).map(musicStem)}
                vigNames={(data.project.vignettes ?? []).map(musicStem)}
                screenNames={data.project.screens ?? []}
                onTintPresets={(list) =>
                  mutate((d) => ({ ...d, project: { ...d.project, tint_presets: list } }))
                }
          onRenameVars={(sw, va) =>
            mutate((d) => ({ ...d, project: { ...d.project, switches: sw, variables: va } }))
          }
          sprites={sprites}
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
        <div className="modal-backdrop" onClick={() => setShowAbout(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-title">SNES Studio — éditeur</div>
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
      {/* rendu APRÈS le gestionnaire de ressources : s'empile au-dessus */}
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

// Icônes de couches façon RM2003 (deux tuiles empilées en perspective —
// la couche éditée est surlignée ; la couche Événements porte un
// petit personnage)
function LayerIcon({ kind }: { kind: "lower" | "upper" | "events" }) {
  const on = "#ffd76a"; // couche active (jaune RM2003)
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
