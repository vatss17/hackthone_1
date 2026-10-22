"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { newAssessment, parseAssessment, storageKey, type Assessment } from "@/lib/landed-cost/assessment";
import type { Inputs } from "@/lib/landed-cost/types";

/**
 * The saved local assessment for one company and one product, kept in this browser's localStorage.
 * Several components on one page (calculator, scenarios, checklist, summary) stay in step through a
 * custom event. If storage is blocked (private window, policy), the assessment lives in memory for
 * the session and the interface says so.
 */

const EVENT = "export-enablement:assessment-changed";
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    const v = window.localStorage.getItem(key);
    if (v !== null) return v;
  } catch {
    /* storage blocked: fall through to memory */
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string): boolean {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

const noop = () => () => {};

export function useAssessment({ scope, assessmentRef, defaults }: { scope: string; assessmentRef: string; defaults: Inputs }) {
  const key = storageKey(scope, assessmentRef);
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);

  const assessment: Assessment = useMemo(
    () => (raw ? parseAssessment(raw, assessmentRef, defaults) : null) ?? newAssessment(assessmentRef, defaults),
    [raw, assessmentRef, defaults],
  );
  const saved = raw !== null;

  const save = useCallback(
    (next: Assessment) => {
      const ok = write(key, JSON.stringify({ ...next, updatedAt: new Date().toISOString() }));
      window.dispatchEvent(new Event(EVENT));
      return ok;
    },
    [key],
  );

  const update = useCallback((fn: (a: Assessment) => Assessment) => save(fn(assessment)), [assessment, save]);

  const reset = useCallback(() => {
    memory.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);

  const importJson = useCallback(
    (text: string): boolean => {
      const parsed = parseAssessment(text, assessmentRef, defaults);
      if (!parsed) return false;
      save(parsed);
      return true;
    },
    [assessmentRef, defaults, save],
  );

  return { assessment, hydrated, saved, update, reset, importJson };
}
