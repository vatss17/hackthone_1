"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";
import { useWorkspace } from "@/components/workspace/use-workspace";
import { T, useT } from "@/lib/i18n/client";
import { PHASES } from "@/lib/roadmap/engine";
import type { Inputs } from "@/lib/landed-cost/types";
import type { WorkspaceFacts } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

/**
 * One export as a mission: steps done out of the total, the phase it is in, blockers and the next step.
 * Progress is a count of roadmap steps, never a readiness score: a finished step records your work, not an approval.
 */
export function MissionCard({ scope, facts, defaults }: { scope: string; facts: WorkspaceFacts; defaults: Inputs }) {
  const t = useT();
  const { roadmap, hydrated } = useWorkspace({ scope, facts, defaults });
  const { counts, blockers, next, phases } = roadmap;
  const current = phases.find((p) => p.counts.completed < p.counts.total) ?? phases[phases.length - 1];
  const share = counts.total ? counts.completed / counts.total : 0;
  const name = facts.product?.name ?? t("Standalone workspace");

  return (
    <article className="flex min-w-0 flex-col rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold">{name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("India to UAE · Phase {phase}: {title}", { phase: current?.id ?? "", title: t(PHASES.find((p) => p.id === current?.id)?.title ?? "") })}</p>
        </div>
        <span className={cn("shrink-0 rounded px-2 py-0.5 text-[11px] font-medium", blockers.length ? "bg-(--status-missing-bg) text-(--status-missing-fg)" : "bg-(--status-verified-bg) text-(--status-verified-fg)")}>
          {blockers.length ? t("{n} blocking", { n: blockers.length }) : t("Nothing blocking")}
        </span>
      </div>
      <div className="mt-4" aria-hidden={!hydrated}>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">{t("Steps done")}</span>
          <span className="tnum font-medium">
            {t("{done} of {total}", { done: counts.completed, total: counts.total })}
          </span>
        </div>
        <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          {phases.map((p) => (
            <span key={p.id} className="relative flex-1 bg-muted" style={{ flexGrow: Math.max(1, p.counts.total) }}>
              <span className="absolute inset-y-0 left-0 bg-(--brand-teal) transition-[width] duration-500" style={{ width: `${p.counts.total ? (p.counts.completed / p.counts.total) * 100 : 0}%` }} />
            </span>
          ))}
        </div>
        <p className="sr-only">{t("{pct} percent of roadmap steps recorded as done.", { pct: Math.round(share * 100) })}</p>
      </div>
      {next && (
        <p className="mt-4 flex gap-2 text-sm">
          {next.task.blocker ? <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-(--status-missing-fg)" /> : <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0 text-(--brand-teal)" />}
          <span>
            <span className="text-muted-foreground">{t("Next:")} </span>
            {t(next.task.title)}
          </span>
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-sm font-medium">
        <Link href={`/mission/${facts.ref}`} className="text-link underline-offset-4 hover:underline">
          <T>Mission Control</T>
        </Link>
        <Link href={`/workspace/${facts.ref}`} className="text-link underline-offset-4 hover:underline">
          <T>Workspace</T>
        </Link>
      </div>
    </article>
  );
}
