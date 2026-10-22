"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { useWorkspace } from "@/components/workspace/use-workspace";
import { STATUS_LABEL, type Roadmap, type RoadmapTask, type Support } from "@/lib/roadmap/engine";
import { TASK_STATUSES, type TaskStatus, type WorkspaceFacts } from "@/lib/workspace/types";
import type { Inputs } from "@/lib/landed-cost/types";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<TaskStatus, string> = {
  not_started: "border-border bg-muted text-muted-foreground",
  in_progress: "border-(--status-ai-border) bg-(--status-ai-bg) text-(--status-ai-fg)",
  completed: "border-(--status-verified-border) bg-(--status-verified-bg) text-(--status-verified-fg)",
  needs_review: "border-(--status-estimate-border) bg-(--status-estimate-bg) text-(--status-estimate-fg)",
};

export function StatusPill({ status }: { status: TaskStatus }) {
  return <span className={cn("inline-flex h-5 items-center whitespace-nowrap rounded-sm border px-1.5 text-xs font-medium", STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

function SupportBadge({ support }: { support: Support }) {
  if (support === "data") return <span className="inline-flex h-5 items-center rounded-sm border border-(--status-user-border) bg-(--status-user-bg) px-1.5 text-xs font-medium text-(--status-user-fg)">Backed by your data</span>;
  return <StatusBadge kind={support === "assumption" ? "assumption" : "unknown"} />;
}

/** The signature answer: the one thing to do next, and why. */
export function NextBestAction({ roadmap, productName }: { roadmap: Roadmap; productName: string | null }) {
  const n = roadmap.next;
  return (
    <section aria-labelledby="nba-h" className="rounded-md border border-primary/40 bg-(--status-verified-bg) p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Next best action{productName ? ` for ${productName}` : ""}</p>
      <h2 id="nba-h" className="sr-only">
        Next best action
      </h2>
      {n ? (
        <>
          <p className="mt-2 max-w-3xl text-xl font-semibold leading-snug tracking-tight sm:text-2xl">{n.task.title}</p>
          <p className="mt-2 max-w-3xl text-sm">{n.reason}</p>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{n.task.supportNote}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-10">
              <Link href={n.task.next.href}>{n.task.next.label}</Link>
            </Button>
            <StatusPill status={n.task.status} />
            <SupportBadge support={n.task.support} />
          </div>
        </>
      ) : (
        <p className="mt-2 max-w-3xl text-lg font-semibold tracking-tight">Every roadmap task is marked completed. That records your progress. It does not mean any requirement has been met or approved: check the items resting on your word or assumptions.</p>
      )}
    </section>
  );
}

export function ProgressCounts({ roadmap }: { roadmap: Roadmap }) {
  const c = roadmap.counts;
  const cells: [string, number][] = [
    ["Completed", c.completed],
    ["In progress", c.inProgress],
    ["Needs review", c.needsReview],
    ["Not started", c.notStarted],
  ];
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map(([k, v]) => (
          <div key={k} className="rounded-md border bg-card px-3 py-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-mono text-xl font-semibold tabular-nums">
              {v}
              <span className="text-sm font-normal text-muted-foreground"> of {c.total}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Counts of tasks, not a score. {c.resting > 0 ? `${c.resting} completed task${c.resting === 1 ? "" : "s"} rest${c.resting === 1 ? "s" : ""} on your word or on assumptions rather than on saved data.` : "Completed tasks here are backed by your saved data."}
      </p>
    </div>
  );
}

function TaskCard({ t, onStatus, onNote }: { t: RoadmapTask; onStatus: (id: string, s: TaskStatus | null) => void; onNote: (id: string, note: string) => void }) {
  const [note, setNote] = useState(t.note);
  return (
    <li className="px-4 py-4 sm:px-5" id={`task-${t.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-[15px] font-semibold leading-snug">{t.title}</h4>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.why}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-sm border px-1.5 py-0.5 text-xs", t.priority === "high" ? "border-primary/50 text-primary" : "border-border text-muted-foreground")}>{t.priority} priority</span>
          {t.blocker && <span className="rounded-sm border border-(--status-missing-border) bg-(--status-missing-bg) px-1.5 py-0.5 text-xs text-(--status-missing-fg)">Blocker</span>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill status={t.status} />
        <SupportBadge support={t.support} />
        <span className="text-xs text-muted-foreground">{t.statusSource === "you" ? "Set by you" : "From your saved data"}</span>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{t.supportNote}</p>
      {t.disclaimer && <p className="mt-1 text-xs text-(--status-estimate-fg)">{t.disclaimer}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button asChild size="sm">
          <Link href={t.next.href}>{t.next.label}</Link>
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            aria-label={`Status of ${t.title}`}
            value={t.status}
            onChange={(e) => onStatus(t.id, e.target.value as TaskStatus)}
            className="h-8 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {t.statusSource === "you" && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onStatus(t.id, null)}>
            Use the automatic status
          </Button>
        )}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">{t.note ? "Your note" : "Add a note"}</summary>
        <textarea
          aria-label={`Note for ${t.title}`}
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== t.note && onNote(t.id, note)}
          className="mt-1 min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </details>
    </li>
  );
}

export function RoadmapBoard({ scope, facts, defaults }: { scope: string; facts: WorkspaceFacts; defaults: Inputs }) {
  const w = useWorkspace({ scope, facts, defaults });
  const { roadmap } = w;
  const onStatus = (id: string, s: TaskStatus | null) => w.setTask(id, s);
  const onNote = (id: string, note: string) => {
    const cur = roadmap.tasks.find((t) => t.id === id);
    w.setTask(id, cur?.statusSource === "you" ? cur.status : (cur?.status ?? "not_started"), note);
  };
  if (!w.hydrated) return <p className="mt-8 text-sm text-muted-foreground">Loading your roadmap…</p>;
  return (
    <div className="mt-6 space-y-8">
      <NextBestAction roadmap={roadmap} productName={facts.product?.name ?? null} />
      <ProgressCounts roadmap={roadmap} />

      {roadmap.blockers.length > 0 && (
        <section aria-labelledby="blk-h">
          <h2 id="blk-h" className="text-lg font-semibold tracking-tight">
            Outstanding blockers
          </h2>
          <ul className="mt-3 divide-y rounded-md border bg-card">
            {roadmap.blockers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-5">
                <a href={`#task-${t.id}`} className="font-medium underline-offset-4 hover:underline">
                  {t.title}
                </a>
                <StatusPill status={t.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {roadmap.phases.map((ph) => (
        <section key={ph.id} aria-labelledby={`ph-${ph.id}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`ph-${ph.id}`} className="text-lg font-semibold tracking-tight">
              <span className="mr-2 font-mono text-primary">{ph.id}</span>
              {ph.title}
            </h2>
            <span className="text-xs text-muted-foreground">
              {ph.counts.completed} of {ph.counts.total} completed{ph.counts.needsReview ? ` · ${ph.counts.needsReview} need review` : ""}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{ph.blurb}</p>
          <ul className="mt-3 divide-y rounded-md border bg-card">
            {ph.tasks.map((t) => (
              <TaskCard key={`${t.id}:${t.note}:${t.status}`} t={t} onStatus={onStatus} onNote={onNote} />
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">Task progress is saved in this browser. Marking a task completed records your progress only: it is never a regulatory approval and nothing is submitted to any authority.</p>
    </div>
  );
}
