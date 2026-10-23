import { DEFAULT_CALC } from "./calc.ts";
import type { ScenarioKey } from "./data.ts";

/**
 * Browser-local state for the wireframes. Fictional values only.
 * One key in localStorage; falls back to memory when storage is blocked.
 */
export type PreviewState = {
  scenario: ScenarioKey;
  goal: "A" | "B" | null;
  opportunity: string | null;
  calc: { price: number; freight: number; reference: number };
  pathA: { step: number; tab: "describe" | "upload" | "none"; name: string; desc: string; material: string; use: string; hs: string; later: string[]; saved: boolean };
  pathB: { step: number; processes: string[]; materials: string[]; machines: { type: string; size: string }[]; products: string; refine: { tooling: string; capacity: string; utilisation: string } };
  savedProjects: string[];
  notes: Record<string, string>;
};

export const DEFAULT_STATE: PreviewState = {
  scenario: "default",
  goal: null,
  opportunity: null,
  calc: DEFAULT_CALC,
  pathA: { step: 1, tab: "describe", name: "", desc: "", material: "", use: "", hs: "", later: [], saved: false },
  pathB: { step: 1, processes: [], materials: [], machines: [{ type: "injection", size: "" }], products: "", refine: { tooling: "", capacity: "", utilisation: "" } },
  savedProjects: [],
  notes: {},
};

const KEY = "ux-preview:v1";
let memory: PreviewState = DEFAULT_STATE;
let loaded = false;
let listeners: (() => void)[] = [];

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) memory = { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    /* storage blocked or corrupt: keep defaults */
  }
}

export function getSnapshot(): PreviewState {
  load();
  return memory;
}
export const getServerSnapshot = () => DEFAULT_STATE;

export function subscribe(fn: () => void) {
  listeners = [...listeners, fn];
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function update(patch: Partial<PreviewState> | ((s: PreviewState) => Partial<PreviewState>)) {
  load();
  const next = { ...memory, ...(typeof patch === "function" ? patch(memory) : patch) };
  memory = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* in-memory only */
  }
  listeners.forEach((l) => l());
}

export function reset() {
  memory = DEFAULT_STATE;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
