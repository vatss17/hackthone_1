"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, Link2, Sparkles, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace/use-workspace";
import { usePlan } from "@/components/atlas/use-atlas-store";
import { useAtlas } from "@/components/atlas/atlas-provider";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { tx } from "@/lib/workspace/dynamic-text";
import { STATUS_LABEL, type RoadmapTask } from "@/lib/roadmap/engine";
import { MISSION_COLUMNS } from "@/lib/workspace/labels";
import { removePlanItem, togglePlanItem } from "@/lib/atlas/plan";
import { TASK_STATUSES, type TaskStatus, type WorkspaceFacts } from "@/lib/workspace/types";
import type { Inputs } from "@/lib/landed-cost/types";
import { cn } from "@/lib/utils";

/** Open blockers in earlier phases. A step depends on them: the journey runs in order, so later work rests on what is settled first. */
export function dependenciesOf(task: RoadmapTask, all: RoadmapTask[]): RoadmapTask[] {
  return all.filter((t) => t.phase < task.phase && t.blocker && t.status !== "completed");
}

export function MissionBoard({ scope, facts, defaults }: { scope: string; facts: WorkspaceFacts; defaults: Inputs }) {
  const t = useT();
  const { roadmap, setTaskStatus, hydrated } = useWorkspace({ scope, facts, defaults });
  const [plan, setPlan] = usePlan(scope);
  const { openCopilot } = useAtlas();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<number | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  const mine = plan.filter((p) => p.ref === facts.ref);
  const planned = new Set(mine.map((p) => p.taskId).filter(Boolean));
  const tasks = useMemo(() => roadmap.tasks.filter((x) => phase === null || x.phase === phase), [roadmap.tasks, phase]);
  const currentPhase = roadmap.phases.find((p) => p.counts.completed < p.counts.total)?.id ?? 5;

  const move = (id: string, status: TaskStatus) => {
    const found = roadmap.tasks.find((x) => x.id === id);
    if (found && found.status !== status) setTaskStatus(id, status);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Journey map */}
      <section aria-labelledby="map-h" className="rounded-lg border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="map-h" className="text-[15px] font-semibold">{t("Journey map")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("{done} of {total} steps done", { done: roadmap.counts.completed, total: roadmap.counts.total })} · {t("{n} blocking", { n: roadmap.blockers.length })}
          </p>
        </div>
        <ol className="mt-5 grid gap-3 md:grid-cols-5">
          {roadmap.phases.map((p, i) => {
            const done = p.counts.total > 0 && p.counts.completed === p.counts.total;
            const state = done ? "done" : p.id === currentPhase ? "current" : "upcoming";
            const blocked = p.tasks.filter((x) => x.blocker && x.status !== "completed").length;
            return (
              <li key={p.id} className="relative">
                {i < roadmap.phases.length - 1 && (
                  <span aria-hidden className="absolute left-[calc(50%+1.25rem)] right-[calc(-50%+1.25rem)] top-5 hidden h-0.5 bg-muted md:block">
                    <motion.span className="block h-full origin-left bg-(--brand-teal)" initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: done ? 1 : 0 }} transition={{ duration: 0.6, delay: i * 0.12 }} />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPhase(phase === p.id ? null : p.id)}
                  aria-pressed={phase === p.id}
                  className={cn("flex w-full gap-3 rounded-md p-2 text-left transition-colors md:flex-col md:items-center md:text-center", phase === p.id ? "bg-selected" : "hover:bg-secondary")}
                >
                  <span
                    className={cn(
                      "relative z-10 grid size-10 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold tnum",
                      state === "done" ? "border-(--brand-teal) bg-(--brand-teal) text-white" : state === "current" ? "border-(--brand-teal) bg-card text-(--brand-teal)" : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {state === "done" ? <Check aria-hidden className="size-4" /> : p.id}
                    {state === "current" && !reduce && <span aria-hidden className="absolute inset-0 animate-ping rounded-full border-2 border-(--brand-teal) opacity-30" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-snug">{t(p.title)}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground tnum">
                      {t("{done}/{total} done", { done: p.counts.completed, total: p.counts.total })}{blocked ? ` · ${t("{n} blocking", { n: blocked })}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {phase !== null && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("Showing phase {phase} only.", { phase })}{" "}
            <button type="button" className="font-medium text-link underline underline-offset-2" onClick={() => setPhase(null)}>
              {t("Show every phase")}
            </button>
          </p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Kanban */}
        <section aria-labelledby="board-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="board-h" className="text-[15px] font-semibold">{t("Task board")}</h2>
            <p className="text-xs text-muted-foreground">{t("Drag a card, or use its menu. Your mark is saved in this browser.")}</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4" aria-busy={!hydrated}>
            {MISSION_COLUMNS.map((col) => {
              const list = tasks.filter((x) => x.status === col.status);
              return (
                <div
                  key={col.status}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(col.status);
                  }}
                  onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) move(id, col.status);
                    setOver(null);
                    setDragging(null);
                  }}
                  className={cn("flex min-h-40 flex-col rounded-lg border bg-muted/40 p-2 transition-colors", over === col.status && "border-(--brand-teal) bg-selected")}
                >
                  <h3 className="flex items-center justify-between px-1.5 pb-2 pt-1 text-xs font-semibold text-muted-foreground">
                    {t(col.title)} <span className="tnum">{list.length}</span>
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {list.map((task) => {
                      const deps = dependenciesOf(task, roadmap.tasks);
                      return (
                        <li
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", task.id);
                            setDragging(task.id);
                          }}
                          onDragEnd={() => setDragging(null)}
                          className={cn("cursor-grab rounded-md border bg-card p-3 shadow-xs active:cursor-grabbing", dragging === task.id && "opacity-50", task.blocker && task.status !== "completed" && "border-l-2 border-l-(--status-missing-fg)")}
                        >
                          <div className="flex flex-wrap gap-1">
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">{t("Phase {phase}", { phase: task.phase })}</span>
                            {task.blocker && task.status !== "completed" && <span className="rounded bg-(--status-missing-bg) px-1.5 py-0.5 text-[10px] font-medium text-(--status-missing-fg)">{t("Blocker")}</span>}
                            {planned.has(task.id) && <span className="rounded bg-(--status-ai-bg) px-1.5 py-0.5 text-[10px] font-medium text-(--status-ai-fg)">{t("In your plan")}</span>}
                            {task.priority === "high" && <span className="rounded bg-(--status-estimate-bg) px-1.5 py-0.5 text-[10px] font-medium text-(--status-estimate-fg)">{t("High")}</span>}
                          </div>
                          <Link href={task.next.href} className="mt-1.5 block text-[13px] font-medium leading-snug underline-offset-2 hover:underline">
                            {t(task.title)}
                          </Link>
                          {deps.length > 0 && task.status !== "completed" && (
                            <p className="mt-1.5 flex gap-1 text-[11px] text-muted-foreground">
                              <Link2 aria-hidden className="mt-px size-3 shrink-0" /> {deps.length === 1 ? t("Waits on \"{title}\"", { title: t(deps[0].title) }) : t("Waits on {n} earlier blockers", { n: deps.length })}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-muted-foreground">{task.statusSource === "you" ? t("Marked by you") : t("From your data")}</p>
                          <label className="mt-2 block">
                            <span className="sr-only">{t("Status of {task}", { task: t(task.title) })}</span>
                            <select
                              value={task.status}
                              onChange={(e) => move(task.id, e.target.value as TaskStatus)}
                              className="h-8 w-full rounded border border-input bg-background px-1.5 text-xs"
                            >
                              {TASK_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {t(STATUS_LABEL[s])}
                                </option>
                              ))}
                            </select>
                          </label>
                          {task.statusSource === "you" && (
                            <button type="button" onClick={() => setTaskStatus(task.id, null)} className="mt-1.5 text-[11px] font-medium text-link underline underline-offset-2">
                              {t("Go back to what the data shows")}
                            </button>
                          )}
                          {task.disclaimer && task.status === "completed" && <p className="mt-1.5 text-[11px] text-muted-foreground">{t(task.disclaimer)}</p>}
                        </li>
                      );
                    })}
                    {list.length === 0 && <li className="px-1.5 py-3 text-xs text-muted-foreground">{t("Nothing here.")}</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <section aria-labelledby="blk-h" className="rounded-lg border bg-card p-4">
            <h2 id="blk-h" className="flex items-center gap-2 text-sm font-semibold">
              <CircleAlert aria-hidden className="size-4 text-(--status-missing-fg)" /> {t("Blockers")}
            </h2>
            {roadmap.blockers.length ? (
              <ul className="mt-2 flex flex-col gap-2">
                {roadmap.blockers.map((b) => (
                  <li key={b.id} className="text-[13px]">
                    <Link href={b.next.href} className="font-medium underline-offset-2 hover:underline">
                      {t(b.title)}
                    </Link>
                    <p className="text-muted-foreground">{tx(t, b.why)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">{t("Nothing is blocking this export.")}</p>
            )}
            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => openCopilot("Explain what's stopping me from exporting", facts.ref)}>
              <Sparkles aria-hidden /> {t("Explain with Atlas AI")}
            </Button>
          </section>

          <section aria-labelledby="plan-h" className="rounded-lg border bg-card p-4">
            <h2 id="plan-h" className="text-sm font-semibold">{t("Your plan")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("Tasks you approved from Atlas AI. Saved in this browser.")}</p>
            {mine.length ? (
              <ul className="mt-2 flex flex-col divide-y">
                {mine.map((p) => (
                  <li key={p.id} className="flex items-start gap-2 py-2">
                    <input
                      type="checkbox"
                      checked={p.done}
                      onChange={() => setPlan((cur) => togglePlanItem(cur, facts.ref, p.id))}
                      aria-label={t("Done: {task}", { task: p.title })}
                      className="mt-1 accent-(--brand-teal)"
                    />
                    <Link href={p.href} className={cn("min-w-0 flex-1 text-[13px] font-medium underline-offset-2 hover:underline", p.done && "text-muted-foreground line-through")}>
                      {p.title}
                    </Link>
                    <button type="button" onClick={() => setPlan((cur) => removePlanItem(cur, facts.ref, p.id))} aria-label={t("Remove from plan: {task}", { task: p.title })} className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-secondary">
                      <Trash2 aria-hidden className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">{t("Nothing yet.")}</p>
            )}
            <Button size="sm" className="mt-3 w-full" onClick={() => openCopilot("Create my next five tasks", facts.ref)}>
              <Sparkles aria-hidden /> {t("Plan my next five tasks")}
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
