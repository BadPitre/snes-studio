// SNES Studio — éditeur.
// Ouvre un dossier projet (les JSON/PNG que tools/datagen consomme) et
// édite maps (2 couches + autotiles + passabilité, modèle RPG Maker 2003),
// acteurs, warps, textes, scripts ; undo/redo, gestion des scènes,
// sauvegarde, génération des données moteur.

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEvent, Layer, ProjectData, Scene, TilesetMeta, Warp } from "./types";
import {
  assetStem,
  charsetName,
  eventAt,
  musicStem,
  projectTilesets,
  spriteBlockCount,
} from "./types";
import {
  canWriteFiles,
  importTilesetPng,
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
import { canBuild, launchEmulator, runDatagen, runMake } from "./build";
import SettingsModal from "./components/SettingsModal";
import type { PlayConfig } from "./components/SettingsModal";
import MapCanvas from "./components/MapCanvas";
import TilePalette from "./components/TilePalette";
import ScenePanel from "./components/ScenePanel";
import SceneTree from "./components/SceneTree";
import EventsPanel from "./components/EventsPanel";
import EventEditorModal from "./components/EventEditorModal";
import VarListModal from "./components/VarListModal";
import CommonEventsModal from "./components/CommonEventsModal";
import { PrefabsModal, SavePrefabModal } from "./components/PrefabModals";
import TransferPlayerModal from "./components/TransferPlayerModal";
import DatabaseModal from "./components/DatabaseModal";
import { loadDatabase, saveDatabase } from "./db";
import type { Database } from "./db";
import TextsPanel from "./components/TextsPanel";
import ScriptPanel from "./components/ScriptPanel";
import WarpsPanel from "./components/WarpsPanel";
import NewSceneModal from "./components/NewSceneModal";
import CharsetImportModal from "./components/CharsetImportModal";
import ResourceManagerModal from "./components/ResourceManagerModal";
import MenuBar from "./components/MenuBar";
import DiagnosticsModal from "./components/DiagnosticsModal";
import type { DatagenReport } from "./components/DiagnosticsModal";
import { checkProject } from "./diagnostics";
import type { Diag } from "./diagnostics";
import { scaffoldProject } from "./template";
import pkg from "../package.json";

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
        const ms = l.match(/scenes\.bin \((\d+) octets\)/);
        if (ms) rep.scenesBytes = Number(ms[1]);
        const mt = l.match(/texts\.bin \((\d+) octets\)/);
        if (mt) rep.textsBytes = Number(mt[1]);
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
      setCharsetImport({ path: file, bmp });
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
      const d2: ProjectData = {
        ...data,
        scenes,
        tilesetMeta: tsMeta,
        project: { ...data.project, tilesets, assets },
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
      const d2: ProjectData = {
        ...data,
        tilesetMeta: metaCopy,
        project: { ...data.project, tilesets, assets },
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
    if (layer === "events") return; // la couche Événements ne se peint pas
    setScene((sc) => paintStamp(sc, layer, tx, ty, ox, oy, tool.tiles), first);
  }

  // rectangle / ellipse / pot de peinture : un geste = une entrée d'undo
  function applyPattern(cells: Array<[number, number]>, ax: number, ay: number) {
    if (layer === "events") return;
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
          label: "Prefabs…",
          action: () => setPrefabMgr(true),
          disabled: !data,
        },
        {
          label: "Database…",
          hint: db ? undefined : "ajouter schemas/",
          action: () => setDbOpen(true),
          disabled: !data || !db,
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
              onClick={() => setLayer("upper")}
              title="Couche supérieure"
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
                musicNames={(data.project.musics ?? []).map(musicStem)}
                canImport={canWriteFiles()}
                passMode={passMode}
                onSelectTileset={setSceneTileset}
                onSelectMusic={(m) => setScene((sc) => ({ ...sc, music: m }))}
                onImport={importTileset}
                onImportChipset={importChipset}
                onPassMode={setPassMode}
                onResize={(w, h) => setScene((sc) => resizeScene(sc, w, h))}
              />
            )}
            {tab === "actors" && (
              <EventsPanel
                scene={scene}
                selected={selEvent}
                canImport={canWriteFiles()}
                blockNames={blockNames}
                onImportCharset={importCharset}
                onSelect={setSelEvent}
                onOpen={(i) => setEvEdit({ index: i, ev: scene.events[i] })}
                onRemove={(i) => {
                  setScene((sc) => removeEvent(sc, i));
                  setSelEvent(null);
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
      {showResources && data && (
        <ResourceManagerModal
          tilesetNames={tilesetNames}
          tilesets={tilesets}
          sprites={sprites}
          blockCount={spriteBlocks}
          blockNames={blockNames}
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
      {dbOpen && data && db && (
        <DatabaseModal
          db={db}
          textNames={data.texts.map((t) => t.name)}
          onOk={(next) => {
            setDb(next);
            setDbOpen(false);
            void saveDatabase(data.root, next)
              .then(() => setStatus("Database sauvegardée (data/*.toml)."))
              .catch((e) => setStatus(`Database : ${e}`));
          }}
          onClose={() => setDbOpen(false)}
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
