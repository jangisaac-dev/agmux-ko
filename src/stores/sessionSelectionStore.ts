import { create } from "zustand";

interface State {
  projectId: string | null;
  ids: readonly string[];
  anchorId: string | null;
  /** A bulk archive/delete is running (any project); selection changes wait for it. */
  busy: boolean;
  setSelection: (projectId: string, ids: readonly string[], anchorId: string | null) => void;
  clear: () => void;
  setBusy: (busy: boolean) => void;
}

export const useSessionSelectionStore = create<State>((set) => ({
  projectId: null,
  ids: [],
  anchorId: null,
  busy: false,
  setBusy: (busy) => set({ busy }),
  setSelection: (projectId, ids, anchorId) => set(
    ids.length ? { projectId, ids, anchorId } : { projectId: null, ids: [], anchorId: null },
  ),
  clear: () => set({ projectId: null, ids: [], anchorId: null }),
}));
