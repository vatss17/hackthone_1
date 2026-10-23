"use client";

import { VoiceAssist } from "@/components/ai-input/voice-assist";
import { LoadingBlock } from "@/components/ui/skeleton";
import Link from "next/link";
import { useState } from "react";
import { Circle, CircleAlert, CircleCheck, CircleDot, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { T, useT } from "@/lib/i18n/client";
import { tx } from "@/lib/workspace/dynamic-text";
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

const STATUS_ICON: Record<TaskStatus, LucideIcon> = { not_started: Circle, in_progress: CircleDot, completed: CircleCheck, needs_review: CircleAlert };

export function StatusPill({ status }: { status: TaskStatus }) {
  const t = useT();
  const Icon = STATUS_ICON[status];
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded border px-1.5 text-xs font-medium", STATUS_STYLE[status])}>
      <Icon aria-hidden className="size-3 shrink-0" />
      {t(STATUS_LABEL[status])}
    </span>
  );
}

function SupportBadge({ support }: { support: Support }) {
  const t = useT();
  if (support === "data") return <span className="inline-flex h-5 items-center rounded-sm border border-(--status-user-border) bg-(--status-user-bg) px-1.5 text-xs font-medium text-(--status-user-fg)">{t("Backed by your data")}</span>;
  return <StatusBadge kind={support === "assumption" ? "assumption" : "unknown"} />;
}

/** The signature answer: the one thing to do next, and why. */
export function NextBestAction({ roadmap, productName }: { roadmap: Roadmap; productName: string | null }) {
  const t = useT();
  const n = roadmap.next;
  return (
    <section aria-labelledby="nba-h" className="rounded-lg border border-(--status-ai-border) bg-selected p-5 sm:p-6">
      <p className="text-[13px] font-medium text-primary-hover">{t("Next action")}{productName ? <span className="font-normal text-muted-foreground"> · {productName}</span> : ""}</p>
      <h2 id="nba-h" className="sr-only">
        {t("Next best action")}
      </h2>
      {n ? (
        <>
          <p className="mt-2 max-w-3xl text-xl font-semibold leading-snug tracking-tight">{t(n.task.title)}</p>
          <p className="mt-2 max-w-3xl text-sm"><span className="font-medium">{t("Why this one:")} </span>{tx(t, n.reason)}</p>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{tx(t, n.task.supportNote)}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href={n.task.next.href}>{t(n.task.next.label)}</Link>
            </Button>
            <StatusPill status={n.task.status} />
            <SupportBadge support={n.task.support} />
          </div>
        </>
      ) : (
        <p className="mt-2 max-w-3xl text-lg font-semibold tracking-tight">{t("Every roadmap task is marked completed. That records your progress. It does not mean any requirement has been met or approved: check the items resting on your word or assumptions.")}</p>
      )}
    </section>
  );
}

export function ProgressCounts({ roadmap }: { roadmap: Roadmap }) {
  const t = useT();
  const c = roadmap.counts;
  const cells: [string, number][] = [
    [t("Completed"), c.completed],
    [t("In progress"), c.inProgress],
    [t("Needs review"), c.needsReview],
    [t("Not started"), c.notStarted],
  ];
  return (
    <div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
        {cells.map(([k, v]) => (
          <div key={k} className="bg-card px-4 py-2.5">
            <dt className="text-[13px] text-muted-foreground">{k}</dt>
            <dd className="tnum text-xl font-semibold">
              {v}
              <span className="text-sm font-normal text-muted-foreground"> {t("of {total}", { total: c.total })}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("Counts of tasks, not a score.")}{" "}
        {c.resting > 0 ? (c.resting === 1 ? t("{n} completed task rests on your word or on assumptions rather than on saved data.", { n: c.resting }) : t("{n} completed tasks rest on your word or on assumptions rather than on saved data.", { n: c.resting })) : t("Completed tasks here are backed by your saved data.")}
      </p>
    </div>
  );
}

function TaskCard({ t: task, onStatus, onNote }: { t: RoadmapTask; onStatus: (id: string, s: TaskStatus | null) => void; onNote: (id: string, note: string) => void }) {
  const t = useT();
  const [note, setNote] = useState(task.note);
  const title = t(task.title);
  return (
    <li className="px-4 py-4 sm:px-5" id={`task-${task.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-[15px] font-medium leading-snug">{title}</h4>
          <p className="mt-0.5 text-sm text-muted-foreground">{tx(t, task.why)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {task.blocker && <span className="rounded-sm border border-(--status-missing-border) bg-(--status-missing-bg) px-1.5 py-0.5 text-xs text-(--status-missing-fg)">{t("Blocker")}</span>}
          <StatusPill status={task.status} />
        </div>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{tx(t, task.supportNote)}</p>
      {task.disclaimer && <p className="mt-1 text-xs text-(--status-estimate-fg)">{t(task.disclaimer)}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button asChild size="sm">
          <Link href={task.next.href}>{t(task.next.label)}</Link>
        </Button>
        <details className="group">
          <summary className="cursor-pointer list-none text-sm text-muted-foreground underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">{t("Update status or add a note")}</summary>
          <div className="mt-3 space-y-3 rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t("Status")}</span>
                <select
                  aria-label={t("Status of {task}", { task: title })}
                  value={task.status}
                  onChange={(e) => onStatus(task.id, e.target.value as TaskStatus)}
                  className="h-8 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(STATUS_LABEL[s])}
                    </option>
                  ))}
                </select>
              </label>
              <SupportBadge support={task.support} />
              <span className="text-xs text-muted-foreground">{task.statusSource === "you" ? t("Set by you") : t("From your saved data")}</span>
              {task.statusSource === "you" && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onStatus(task.id, null)}>
                  <T>Use the automatic status</T>
                </Button>
              )}
            </div>
            <textarea
              id={`note-${task.id}`}
              aria-label={t("Note for {task}", { task: title })}
              value={note}
              maxLength={300}
              placeholder={t("A note for yourself")}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== task.note && onNote(task.id, note)}
              className="min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <VoiceAssist target="text" fieldId={`note-${task.id}`} />
          </div>
        </details>
      </div>
    </li>
  );
}

export function RoadmapBoard({ scope, facts, defaults }: { scope: string; facts: WorkspaceFacts; defaults: Inputs }) {
  const t = useT();
  const w = useWorkspace({ scope, facts, defaults });
  const { roadmap } = w;
  const onStatus = (id: string, s: TaskStatus | null) => w.setTaskStatus(id, s);
  const onNote = (id: string, note: string) => w.setTaskNote(id, note);
  if (!w.hydrated) return <LoadingBlock label={t("Loading your roadmap…")} />;
  const c = roadmap.counts;
  const nextPhase = roadmap.next ? roadmap.phases.find((ph) => ph.tasks.some((x) => x.id === roadmap.next!.task.id)) : undefined;
  return (
    <div className="mt-6 space-y-8">
      <NextBestAction roadmap={roadmap} productName={facts.product?.name ?? null} />
      {roadmap.tasks.some((x) => x.status !== "completed") && (
        <details className="-mt-4 rounded-lg border bg-card/60 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-primary">{roadmap.next?.chosenByYou ? t("You chose this focus. Change it") : t("Work on something else first")}</summary>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5">
              <span className="text-muted-foreground">{t("Make this my focus")}</span>
              <select
                aria-label={t("Choose your own focus task")}
                className="h-9 max-w-xs rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                value={roadmap.next?.chosenByYou ? roadmap.next.task.id : ""}
                onChange={(e) => w.setFocus(e.target.value || null)}
              >
                <option value="">{t("The platform's recommendation")}</option>
                {roadmap.tasks
                  .filter((x) => x.status !== "completed")
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {t(x.title)}
                    </option>
                  ))}
              </select>
            </label>
            {roadmap.next?.chosenByYou && (
              <Button type="button" variant="outline" size="sm" onClick={() => w.setFocus(null)}>
                <T>Use the recommendation</T>
              </Button>
            )}
          </div>
          {roadmap.recommended && roadmap.next?.chosenByYou && <p className="mt-2 text-muted-foreground">{t("The platform recommends: {title}.", { title: t(roadmap.recommended.task.title) })}</p>}
        </details>
      )}
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{t("{done} of {total} tasks completed", { done: c.completed, total: c.total })}</span>
        {c.inProgress ? ` · ${t("{n} in progress", { n: c.inProgress })}` : ""}
        {c.needsReview ? ` · ${t("{n} need review", { n: c.needsReview })}` : ""}. {t("Counted in tasks, not scored.")}{" "}
        {c.resting > 0 ? (c.resting === 1 ? t("{n} completed rests on your word or on assumptions.", { n: c.resting }) : t("{n} completed rest on your word or on assumptions.", { n: c.resting })) : t("Completed tasks here are backed by your saved data.")}
      </p>

      {roadmap.blockers.length > 0 && (
        <section aria-labelledby="blk-h">
          <h2 id="blk-h" className="text-lg font-medium tracking-tight">
            {t("What is holding you back")}
          </h2>
          <ul className="mt-3 divide-y rounded-lg border bg-card">
            {roadmap.blockers.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-5">
                <a href={`#task-${x.id}`} className="min-w-0 font-medium underline-offset-4 hover:underline">
                  {t(x.title)}
                </a>
                <StatusPill status={x.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="plan-h" className="space-y-3">
        <h2 id="plan-h" className="text-lg font-medium tracking-tight">
          {t("Your plan, in five phases")}
        </h2>
        {roadmap.phases.map((ph) => (
          <details key={ph.id} open={nextPhase ? ph.id === nextPhase.id : ph.id === roadmap.phases[0]?.id} className="rounded-lg border bg-card" id={`phase-${ph.id}`}>
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 font-medium">
                <span className="mr-2 tnum text-primary">{ph.id}</span>
                {t(ph.title)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("{done} of {total} completed", { done: ph.counts.completed, total: ph.counts.total })}
                {ph.counts.needsReview ? ` · ${t("{n} need review", { n: ph.counts.needsReview })}` : ""}
              </span>
            </summary>
            <div className="border-t">
              <p className="px-4 pt-3 text-sm text-muted-foreground sm:px-5">{t(ph.blurb)}</p>
              <ul className="mt-1 divide-y">
                {ph.tasks.map((x) => (
                  <TaskCard key={x.id} t={x} onStatus={onStatus} onNote={onNote} />
                ))}
              </ul>
            </div>
          </details>
        ))}
      </section>
      <p className="text-xs text-muted-foreground">{t("Task progress is saved in this browser. Marking a task completed records your progress only: it is never a regulatory approval and nothing is submitted to any authority.")}</p>
    </div>
  );
}
