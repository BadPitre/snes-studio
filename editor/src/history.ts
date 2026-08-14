// Undo/redo: a stack of project snapshots (immutable structures -> the
// snapshots only cost shared references).

import { useCallback, useRef } from "react";
import type { ProjectData } from "./types";

// Each entry RETAINS one copied grid per paint stroke (the state ops
// share every untouched subtree). A normal map grid is ~70 KB; a
// 255x255 worldmap grid is ~530 KB, so the cap is what bounds memory:
// 64 entries is generous for mapping and keeps the worldmap worst
// case near 30 MB where 200 entries flirted with 100 MB.
const MAX_HISTORY = 64;

export function useHistory() {
  const past = useRef<ProjectData[]>([]);
  const future = useRef<ProjectData[]>([]);

  // To be called BEFORE every mutation, with the current state.
  // The identity dedupe is a REQUIREMENT, not an optimisation:
  // mutate() records from inside a setData updater, and React's
  // StrictMode double-invokes updaters in dev — without it every
  // stroke was pushed twice, so the first Ctrl+Z looked like a no-op
  // (two presses per undo, dev only, which is why it survived).
  const record = useCallback((current: ProjectData) => {
    if (past.current[past.current.length - 1] === current) return;
    past.current.push(current);
    if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
  }, []);

  const undo = useCallback((current: ProjectData): ProjectData | null => {
    const prev = past.current.pop();
    if (!prev) return null;
    future.current.push(current);
    return prev;
  }, []);

  const redo = useCallback((current: ProjectData): ProjectData | null => {
    const next = future.current.pop();
    if (!next) return null;
    past.current.push(current);
    return next;
  }, []);

  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
  }, []);

  return { record, undo, redo, reset };
}
