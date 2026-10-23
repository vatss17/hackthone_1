"use client";

import { useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, reset, subscribe, update, type PreviewState } from "./store.ts";

export function usePreview() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { state, set: update, reset } as { state: PreviewState; set: typeof update; reset: typeof reset };
}
