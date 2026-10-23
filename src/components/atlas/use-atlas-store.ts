"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { EVENT, read, subscribe, write } from "@/components/landed-cost/use-assessment";
import { parseAssessment, storageKey } from "@/lib/landed-cost/assessment";
import { parseRequests, requestsKey } from "@/lib/experts/brief";
import { activityKey, parseActivity, parsePlan, planKey, type Activity, type SavedPlanItem } from "@/lib/atlas/plan";
import type { AtlasProduct } from "@/lib/atlas/tools";

/** The plan and activity log Atlas keeps in this browser, kept in step across components through the same event as the assessment. */
function useStored<T>(key: string, parse: (raw: string | null) => T) {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const value = useMemo(() => parse(raw), [raw, parse]);
  const mutate = useCallback(
    (fn: (current: T) => T) => {
      write(key, JSON.stringify(fn(parse(read(key)))));
      window.dispatchEvent(new Event(EVENT));
    },
    [key, parse],
  );
  return [value, mutate] as const;
}

export const usePlan = (scope: string) => useStored<SavedPlanItem[]>(planKey(scope), parsePlan);
export const useActivity = (scope: string) => useStored<Activity[]>(activityKey(scope), parseActivity);

/** Adds what this browser has saved for a product to the server's facts. */
export function withLocal(scope: string, p: Omit<AtlasProduct, "assessment" | "requests">): AtlasProduct {
  const raw = read(storageKey(scope, p.ref)) ?? read(storageKey(scope, p.ref, 1));
  return { ...p, assessment: raw ? parseAssessment(raw, p.ref, p.defaults) : null, requests: parseRequests(read(requestsKey(scope))) };
}
