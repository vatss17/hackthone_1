"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { subscribe } from "@/components/landed-cost/use-assessment";
import { ASSESSMENT_VERSION } from "@/lib/landed-cost/assessment";

type Seen = { ref: string; updatedAt: string; tasksDone: number; touched: boolean };

/** Reads this browser's saved assessments for the company. Returns a stable string so React can compare snapshots. */
function snapshot(scope: string): string {
  const prefix = `export-enablement:assessment:v${ASSESSMENT_VERSION}:${scope}:`;
  const out: Seen[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const a = JSON.parse(window.localStorage.getItem(k) ?? "null");
      if (!a || typeof a !== "object") continue;
      const tasks = a.tasks && typeof a.tasks === "object" ? Object.values(a.tasks as Record<string, { status?: string }>) : [];
      const touched = (Array.isArray(a.edited) && a.edited.length > 0) || tasks.length > 0 || (a.checks && Object.keys(a.checks).length > 0);
      out.push({ ref: k.slice(prefix.length), updatedAt: String(a.updatedAt ?? ""), tasksDone: tasks.filter((t) => t?.status === "completed").length, touched: Boolean(touched) });
    }
  } catch {
    return "[]";
  }
  return JSON.stringify(out);
}

/**
 * "Pick up where you left off". Shown ONLY when this browser holds saved work for the company.
 * Saved work lives in the browser, so it is never shown to anyone on another device.
 */
export function ResumeJourney({ scope, names }: { scope: string; names: Record<string, string> }) {
  const raw = useSyncExternalStore(subscribe, () => snapshot(scope), () => "[]");
  const items = useMemo(() => (JSON.parse(raw) as Seen[]).filter((s) => s.touched && names[s.ref]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3), [raw, names]);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="resume-h" className="mt-12">
      <h2 id="resume-h" className="text-sm font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Pick up where you left off
      </h2>
      <ul className="mt-3 divide-y rounded-lg border bg-card">
        {items.map((s) => (
          <li key={s.ref}>
            <Link href={`/workspace/${s.ref}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 transition-colors hover:bg-muted/60 sm:px-5">
              <span className="font-medium">{names[s.ref]}</span>
              <span className="text-sm text-muted-foreground">
                {s.tasksDone > 0 ? `${s.tasksDone} roadmap task${s.tasksDone === 1 ? "" : "s"} completed · ` : ""}Open workspace →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
