// Undo/redo : pile de snapshots du projet (structures immuables → les
// snapshots ne coûtent que des références partagées).

import { useCallback, useRef } from "react";
import type { ProjectData } from "./types";

const MAX_HISTORY = 200;

export function useHistory() {
  const past = useRef<ProjectData[]>([]);
  const future = useRef<ProjectData[]>([]);

  // à appeler AVANT chaque mutation, avec l'état courant
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
