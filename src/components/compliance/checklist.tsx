"use client";

import Link from "next/link";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { useAssessment } from "@/components/landed-cost/use-assessment";
import { SOURCE_BY_ID, type Evidence, type Item } from "@/lib/compliance/content";
import type { Inputs } from "@/lib/landed-cost/types";

const BADGE: Record<Evidence, StatusKind> = {
  verified: "verified",
  secondary: "secondary",
  user: "user",
  inferred: "inferred",
  assumption: "assumption",
  unknown: "unknown",
};

/**
 * Screening questions the manufacturer can tick off as resolved. Ticking saves to the same local
 * assessment as the calculator. A ticked question means "I have an answer", not "this passes":
 * the platform does not judge the answers.
 */
export function Checklist({ scope, assessmentRef, defaults, items }: { scope: string; assessmentRef: string; defaults: Inputs; items: Item[] }) {
  const { assessment, update, hydrated } = useAssessment({ scope, assessmentRef, defaults });
  return (
    <ul className="divide-y rounded-md border bg-card">
      {items.map((it) => {
        const done = assessment.checks[it.id] === true;
        const source = it.sourceId ? SOURCE_BY_ID[it.sourceId] : null;
        const id = `chk-${it.id}`;
        return (
          <li key={it.id} className="px-4 py-3 sm:px-5">
            <div className="flex items-start gap-3">
              <input
                id={id}
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-primary"
                checked={hydrated && done}
                disabled={!hydrated}
                onChange={(e) =>
                  update((a) => {
                    const checks = { ...a.checks };
                    if (e.target.checked) checks[it.id] = true;
                    else delete checks[it.id];
                    return { ...a, checks };
                  })
                }
              />
              <div className="min-w-0 flex-1">
                <label htmlFor={id} className="cursor-pointer text-sm font-medium">
                  {it.text}
                </label>
                <p className="mt-0.5 text-sm text-muted-foreground">{it.why}</p>
                {source && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Source: {source.publisher}.{" "}
                    <Link href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      Open source
                    </Link>
                    , retrieved {source.retrieved}. {source.caveat}
                  </p>
                )}
              </div>
              <StatusBadge kind={BADGE[it.evidence]} className="shrink-0" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Progress({ scope, assessmentRef, defaults, ids }: { scope: string; assessmentRef: string; defaults: Inputs; ids: string[] }) {
  const { assessment, hydrated } = useAssessment({ scope, assessmentRef, defaults });
  const done = hydrated ? ids.filter((id) => assessment.checks[id]).length : 0;
  return (
    <p className="text-sm">
      <span className="font-mono font-semibold tabular-nums">
        {done} of {ids.length}
      </span>{" "}
      questions marked as resolved, across the compliance and CEPA pages. <span className="text-muted-foreground">Saved in this browser. Resolved means you have an answer, not that the answer passes.</span>
    </p>
  );
}
