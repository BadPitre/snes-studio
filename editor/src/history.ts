// Undo/redo: a stack of project snapshots (immutable structures -> the
// snapshots only cost shared references).

import { useCallback, useRef } from "react";
import type { ProjectData } from "./types";

const MAX_HISTORY = 200;

export function useHistory() {
  const past = useRef<ProjectData[]>([]);
  const future = useRef<ProjectData[]>([]);

  // to be called BEFORE every mutation, with the current state
  const record = useCallback((current: ProjectData) => {
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
