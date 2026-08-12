// AudioPreview (B7) — a play/pause button to listen to a WAV sound or an
// IT module from the editor (Database, resource manager).
// One preview at a time: starting a new sound cuts the previous one.
//
// WAV: an HTMLAudioElement on a blob. IT: a libopenmpt worklet (files
// VENDORED in public/worklets/, from the chiptune3 project — MIT, see
// LICENSE-chiptune3) driven directly by messages: the preview gives the
// libopenmpt rendering, faithful to the source module (the SNES
// rendering goes through snesmod and differs a little).

import { useEffect, useState } from "react";
import { readBinaryFile } from "../io";

type State = "off" | "loading" | "playing" | "paused";

// ---- singleton: a single player, shared by every button --------------
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
  if (curKey !== key) return; // another preview took over
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

// Plays a sound once, without a button — PLAYING an animation (A1-c)
// triggers its frames' sounds as the playhead goes.
export function previewSound(path: string, root: string) {
  void start(path, path, root).catch(() => setState(null, "off"));
}

// ---- a module that is not a file yet ---------------------------------
//
// The ROM ripper transcribes a song into memory and the author wants to
// hear it BEFORE deciding whether it earns a place in the project. The
// worklet already takes an ArrayBuffer, so nothing has to be written to
// disk — only an entry point that does not go through readBinaryFile.
// Same singleton, so the same rule holds: one preview at a time.

async function startBytes(key: string, bytes: Uint8Array) {
  stopPreview();
  setState(key, "loading");
  const node = await ensureIt();
  if (curKey !== key) return; // another preview took over
  node.port.postMessage({ cmd: "play", val: bytes.slice().buffer });
  setState(key, "playing");
}

// Play / pause an in-memory module. `make` is called only when playback
// actually has to START, so the caller can produce the bytes lazily —
// the ripper transcribes on the first click instead of up front.
export function toggleBytes(key: string, make: () => Uint8Array | null) {
  if (curKey === key && curState === "playing") {
    itNode?.port.postMessage({ cmd: "pause" });
    setState(key, "paused");
    return;
  }
  if (curKey === key && curState === "paused") {
    itNode?.port.postMessage({ cmd: "unpause" });
    setState(key, "playing");
    return;
  }
  const b = make();
  if (b) void startBytes(key, b).catch(() => setState(null, "off"));
}

// Subscribes a component to the shared player. "off" whenever something
// else is playing, which is what a button wants to show.
export function usePreviewState(key: string): State {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return curKey === key ? curState : "off";
}

function toggle(key: string, path: string, root: string) {
  if (curKey !== key) {
    void start(key, path, root).catch(() => setState(null, "off"));
    return;
  }
  // same resource: play/pause
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

// ---- the button ------------------------------------------------------
interface Props {
  path: string; // project path ("assets/sounds/x.wav" | "assets/music/x.it")
  root: string; // the project root
  title?: string;
}

export default function AudioPreviewButton(props: Props) {
  const key = props.path;
  const st = usePreviewState(key);
  const icon = st === "playing" ? "⏸" : st === "loading" ? "…" : "▶";
  return (
    <button
      className="browse"
      title={props.title ?? (st === "playing" ? "Pause" : "Écouter")}
      onClick={(e) => {
        e.stopPropagation(); // do not select the row behind
        toggle(key, props.path, props.root);
      }}
    >
      {icon}
    </button>
  );
}
