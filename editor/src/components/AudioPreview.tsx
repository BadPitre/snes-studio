// AudioPreview (B7) — bouton play/pause pour écouter un son WAV ou une
// musique IT depuis l'éditeur (Database, Gestionnaire de ressources).
// Un seul aperçu à la fois : lancer un nouveau son coupe le précédent.
//
// WAV : HTMLAudioElement sur un blob. IT : worklet libopenmpt (fichiers
// VENDORISÉS dans public/worklets/, projet chiptune3 — MIT, voir
// LICENSE-chiptune3) piloté en direct par messages : l'aperçu donne le
// rendu libopenmpt, fidèle au module source (le rendu SNES passe par
// snesmod et diffère un peu).

import { useEffect, useState } from "react";
import { readBinaryFile } from "../io";

type State = "off" | "loading" | "playing" | "paused";

// ---- singleton : un seul lecteur, partagé par tous les boutons --------
let wav: HTMLAudioElement | null = null;
let itCtx: AudioContext | null = null;
let itNode: AudioWorkletNode | null = null;
let curKey: string | null = null;
let curState: State = "off";
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function setState(key: string | null, st: State) {
  curKey = key;
  curState = st;
  notify();
}

async function ensureIt(): Promise<AudioWorkletNode> {
  if (itNode && itCtx) {
    if (itCtx.state === "suspended") void itCtx.resume();
    return itNode;
  }
  itCtx = new AudioContext();
  await itCtx.audioWorklet.addModule("/worklets/chiptune3.worklet.js");
  itNode = new AudioWorkletNode(itCtx, "libopenmpt-processor", {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  itNode.port.postMessage({
    cmd: "config",
    val: { repeatCount: -1, stereoSeparation: 100, interpolationFilter: 0 },
  });
  itNode.port.onmessage = (msg: MessageEvent) => {
    if (msg.data?.cmd === "err") setState(null, "off");
  };
  itNode.connect(itCtx.destination);
  return itNode;
}

export function stopPreview() {
  if (wav) {
    wav.pause();
    wav = null;
  }
  if (itNode) itNode.port.postMessage({ cmd: "stop" });
  setState(null, "off");
}

async function start(key: string, path: string, root: string) {
  stopPreview();
  setState(key, "loading");
  const bytes = await readBinaryFile(`${root}/${path}`);
  if (curKey !== key) return; // un autre aperçu a pris la main
  if (path.toLowerCase().endsWith(".wav")) {
    const url = URL.createObjectURL(
      new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" })
    );
    wav = new Audio(url);
    wav.onended = () => {
      if (curKey === key) setState(null, "off");
      URL.revokeObjectURL(url);
    };
    await wav.play();
    if (curKey === key) setState(key, "playing");
  } else {
    const node = await ensureIt();
    if (curKey !== key) return;
    node.port.postMessage({ cmd: "play", val: bytes.buffer });
    setState(key, "playing");
  }
}

// Joue un son une fois, sans bouton — la LECTURE d'une animation (A1-c)
// déclenche les sons de ses frames au fil du playhead.
export function previewSound(path: string, root: string) {
  void start(path, path, root).catch(() => setState(null, "off"));
}

function toggle(key: string, path: string, root: string) {
  if (curKey !== key) {
    void start(key, path, root).catch(() => setState(null, "off"));
    return;
  }
  // même ressource : play/pause
  if (curState === "playing") {
    if (wav) wav.pause();
    else if (itNode) itNode.port.postMessage({ cmd: "pause" });
    setState(key, "paused");
  } else if (curState === "paused") {
    if (wav) void wav.play();
    else if (itNode) itNode.port.postMessage({ cmd: "unpause" });
    setState(key, "playing");
  }
}

// ---- le bouton -------------------------------------------------------
interface Props {
  path: string; // chemin projet ("assets/sounds/x.wav" | "assets/music/x.it")
  root: string; // racine du projet
  title?: string;
}

export default function AudioPreviewButton(props: Props) {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const key = props.path;
  const mine = curKey === key;
  const icon =
    mine && curState === "playing" ? "⏸" : mine && curState === "loading" ? "…" : "▶";
  return (
    <button
      className="browse"
      title={props.title ?? (mine && curState === "playing" ? "Pause" : "Écouter")}
      onClick={(e) => {
        e.stopPropagation(); // ne pas sélectionner la ligne derrière
        toggle(key, props.path, props.root);
      }}
    >
      {icon}
    </button>
  );
}
