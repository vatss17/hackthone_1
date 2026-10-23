"use client";

import { LoadingBlock } from "@/components/ui/skeleton";
import Link from "next/link";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { useT } from "@/lib/i18n/client";
import { tx } from "@/lib/workspace/dynamic-text";
import { NextBestAction, StatusPill } from "@/components/workspace/roadmap-board";
import { useWorkspace } from "@/components/workspace/use-workspace";
import { calculate, validateInputs } from "@/lib/landed-cost/calc";
import { formatAed, formatPct } from "@/lib/landed-cost/format";
import { STATUS_LABEL as REQUEST_STATUS, TOPIC_BY_ID } from "@/lib/experts/brief";
import { FIT_LABEL } from "@/lib/opportunities/engine";
import type { Inputs } from "@/lib/landed-cost/types";
import type { WorkspaceFacts } from "@/lib/workspace/types";

function Panel({ title, badge, children, href, cta }: { title: string; badge?: StatusKind; children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <section className="rounded-lg border bg-card" aria-label={title}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {badge && <StatusBadge kind={badge} />}
      </div>
      <div className="space-y-1.5 px-4 pb-3 pt-2 text-sm">{children}</div>
      {href && cta && (
        <div className="border-t px-4 py-2.5">
          <Link href={href} className="text-[13px] font-medium text-primary underline-offset-4 hover:underline">
            {cta}
          </Link>
        </div>
      )}
    </section>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-muted-foreground">{k}</span>
    <span className="tnum min-w-0 break-words text-right font-medium">{v}</span>
  </div>
);

/** A titled block of the main column. A rule, not a box: the page reads top to bottom. */
function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-4">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * The Export Workspace: one page that answers "what is the next best action to get this product
 * export-ready?" and shows, with facts rather than a score, what has been told, found, calculated,
 * blocked, drafted and requested.
 */
export function WorkspaceOverview({ scope, facts, defaults }: { scope: string; facts: WorkspaceFacts; defaults: Inputs }) {
  const t = useT();
  const w = useWorkspace({ scope, facts, defaults });
  if (!w.hydrated) return <LoadingBlock label={t("Loading your workspace…")} />;
  const { roadmap, assessment: a, docs } = w;
  const p = facts.product;
  const ref = facts.ref;
  const valid = Object.keys(validateInputs(a.inputs).errors).length === 0;
  const r = valid ? calculate(a.inputs) : null;
  const sample = a.edited.length === 0;
  const recordParts = p ? [p.description, p.category, p.intendedUse, p.specCount > 0].filter(Boolean).length : 0;
  const calcHref = facts.standalone ? "/viability" : `/viability?product=${ref}`;
  const reqs = w.relevantRequests;

  const open = roadmap.tasks.filter((t) => t.status !== "completed");
  const nextId = roadmap.next?.task.id;
  const rank = (t: (typeof open)[number]) => (t.id === nextId ? 0 : t.demonstrated ? 1 : t.blocker ? 2 : 3);
  const queue = [...open].sort((x, y) => rank(x) - rank(y) || x.phase - y.phase).slice(0, 8);

  const answers: { q: string; a: string; note: string; badge: StatusKind; href: string }[] = [
    {
      q: t("Could my factory make it?"),
      a: facts.fit.level ? t(FIT_LABEL[facts.fit.level]) : facts.profile.processes === 0 ? t("We cannot tell yet") : t("Not assessed"),
      note: facts.fit.level ? t("By rules, from the processes, materials and machines you declared.") : t("Tell us your processes and machines to check this."),
      badge: facts.fit.level ? "inferred" : "missing",
      href: facts.standalone ? "/opportunities" : `/opportunities/${ref}`,
    },
    {
      q: t("Is there evidence of a destination market?"),
      a: t("No evidence connected"),
      note: t("No licensed trade-data source is connected, so no demand figures are shown."),
      badge: "nodata",
      href: "/evidence",
    },
    {
      q: t("Could exporting make financial sense?"),
      a: r ? ((r.grossMarginPct ?? 0) < 0 ? t("Not at these inputs") : sample ? t("Looks workable on sample inputs") : t("{margin} margin on your inputs", { margin: formatPct(r.grossMarginPct) })) : t("Needs valid inputs"),
      note: r ? (sample ? t("Sample values: replace them with your own costs and price.") : t("Your own estimates. Duty and freight are not verified.")) : t("Open the calculator and fix the highlighted inputs."),
      badge: r ? (sample ? "assumption" : "estimate") : "missing",
      href: calcHref,
    },
    {
      q: t("What requirements or unknowns remain?"),
      a: roadmap.blockers.length === 0 ? t("No named blockers") : roadmap.blockers.length === 1 ? t("{n} open blocker", { n: 1 }) : t("{n} open blockers", { n: roadmap.blockers.length }),
      note: t("Compliance and scheme items are unverified questions, not findings."),
      badge: "unknown",
      href: `/compliance${facts.standalone ? "" : `?product=${ref}`}`,
    },
  ];

  return (
    <div className="mt-6 space-y-6">
      <NextBestAction roadmap={roadmap} productName={p?.name ?? null} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-8">
          <Block title={t("Work queue")} hint={t("What is still open for this product, most urgent first. A blocker stops a sound decision until it is resolved.")}>
            {queue.length === 0 ? (
              <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{t("Every task is marked completed. That records your progress; it does not mean any requirement has been met.")}</p>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                <ul className="divide-y sm:hidden">
                  {queue.map((task) => (
                    <li key={task.id} className="px-4 py-3">
                      <p className="font-medium">{t(task.title)}</p>
                      <p className="text-[13px] text-muted-foreground">{tx(t, task.supportNote)}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
                        <StatusPill status={task.status} />
                        {task.blocker && <span className="font-medium text-error">{t("Blocker")}</span>}
                        <Link href={task.next.href} className="ml-auto inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">{t(task.next.label)}</Link>
                      </p>
                    </li>
                  ))}
                </ul>
                <table className="hidden w-full text-sm sm:table">
                  <caption className="sr-only">{t("Open tasks: task, what is unresolved, status and action")}</caption>
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-[13px] text-muted-foreground">
                      <th scope="col" className="px-4 py-2 font-medium">{t("Task")}</th>
                      <th scope="col" className="px-2 py-2 font-medium">{t("Unresolved")}</th>
                      <th scope="col" className="px-2 py-2 font-medium">{t("Status")}</th>
                      <th scope="col" className="px-4 py-2"><span className="sr-only">{t("Action")}</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {queue.map((task) => (
                      <tr key={task.id} className="align-top">
                        <td className="max-w-[16rem] px-4 py-3 font-medium">
                          {t(task.title)}
                          {task.blocker && <span className="mt-0.5 block text-[13px] font-medium text-error">{t("Blocker")}</span>}
                        </td>
                        <td className="max-w-[18rem] px-2 py-3 text-muted-foreground">{tx(t, task.supportNote)}</td>
                        <td className="px-2 py-3"><StatusPill status={task.status} /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Link href={task.next.href} className="font-medium text-primary underline-offset-4 hover:underline">{t(task.next.label)}</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t px-4 py-2.5 text-[13px] text-muted-foreground">
                  {t("Showing {shown} of {total} open tasks.", { shown: queue.length, total: open.length })}{" "}
                  <Link href={`/roadmap?product=${ref}`} className="font-medium text-primary underline-offset-4 hover:underline">{t("Open the full roadmap")}</Link>
                </p>
              </div>
            )}
          </Block>

          <Block title={t("The decision at a glance")} hint={t("Four questions, each with where the answer comes from. Nothing here is an approval.")}>
            <ul className="divide-y rounded-lg border bg-card">
              {answers.map((c) => (
                <li key={c.q}>
                  <Link href={c.href} className="grid gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-secondary/60 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-baseline">
                    <span className="text-[13px] text-muted-foreground">{c.q}</span>
                    <span className="min-w-0">
                      <span className="block font-medium">{c.a}</span>
                      <span className="block text-[13px] text-muted-foreground">{c.note}</span>
                    </span>
                    <span className="sm:justify-self-end"><StatusBadge kind={c.badge} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </Block>
        </div>

        <aside className="min-w-0 space-y-4" aria-label={t("Product context")}>
          <Panel title={t("Commercial summary")} badge={r ? (sample ? "assumption" : "estimate") : "missing"} href={calcHref} cta={r ? t("Open the calculator") : t("Start the calculator")}>
            {r ? (
              <>
                <Row k={t("Landed cost per unit")} v={formatAed(r.landedPerUnitAed)} />
                <Row k={t("Selling price")} v={formatAed(a.inputs.sellingPriceAed)} />
                <Row k={t("Gross margin (target {target}%)", { target: a.inputs.targetMarginPercent })} v={<span className={(r.grossMarginPct ?? 0) < 0 ? "text-error" : ""}>{formatPct(r.grossMarginPct)}{(r.grossMarginPct ?? 0) < 0 ? ` ${t("(loss)")}` : ""}</span>} />
                <p className="pt-1 text-xs text-muted-foreground">{sample ? t("These figures use SAMPLE inputs. Replace them with your own.") : t("Your own estimates. Destination prices, duty and freight are not verified.")}</p>
              </>
            ) : (
              <p className="text-muted-foreground">{t("No valid landed-cost estimate yet.")}</p>
            )}
            <p className="pt-1 text-[13px]">
              <Link href={`/feasibility/${ref}`} className="font-medium text-primary underline-offset-4 hover:underline">{t("Open the feasibility assessment")}</Link>
            </p>
          </Panel>

          <Panel title={t("Readiness")} href={`/roadmap?product=${ref}`} cta={t("Open the roadmap")}>
            <Row k={t("Completed")} v={t("{done} of {total}", { done: roadmap.counts.completed, total: roadmap.counts.total })} />
            <Row k={t("In progress")} v={roadmap.counts.inProgress} />
            <Row k={t("Needs review")} v={roadmap.counts.needsReview} />
            <Row k={t("Not started")} v={roadmap.counts.notStarted} />
            <p className="pt-1 text-xs text-muted-foreground">{t("Counts of tasks, not a score.")} {roadmap.counts.resting > 0 ? (roadmap.counts.resting === 1 ? t("{n} completed task rests on your word or on assumptions.", { n: 1 }) : t("{n} completed tasks rest on your word or on assumptions.", { n: roadmap.counts.resting })) : t("Completed tasks are backed by your saved data.")}</p>
          </Panel>

          <Panel title={t("What you have told us")} badge="user" href={p?.own ? `/products/${ref}` : "/products"} cta={p?.own ? t("Open the product") : t("Open your catalogue")}>
            <Row k={t("Factories")} v={facts.profile.factories} />
            <Row k={t("Processes · materials")} v={`${facts.profile.processes} · ${facts.profile.materials}`} />
            <Row k={t("Machines (rated)")} v={`${facts.profile.machines} (${facts.profile.ratedMachines})`} />
            <Row k={t("Capacity declared")} v={facts.profile.capacity ? t("Yes") : t("No")} />
            {p ? (
              <>
                <Row k={t("Product")} v={p.name} />
                <Row k={t("Product record")} v={p.own ? t("{n} of 4 parts", { n: recordParts }) : t("Not in your catalogue yet")} />
                <Row k={t("Made at")} v={p.linkedFactories.length ? p.linkedFactories.join(", ") : t("Not linked")} />
              </>
            ) : (
              <p className="text-muted-foreground">{t("No product selected. This is a standalone assessment.")}</p>
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              <Link href="/products/import" className="font-medium text-primary underline-offset-4 hover:underline">
                {t("Import more products from a catalogue")}
              </Link>
            </p>
          </Panel>

          <Panel title={t("Opportunities discovered")} badge="inferred" href="/opportunities" cta={t("Open Opportunities")}>
            {facts.fit.level && <Row k={p?.name ?? t("This product")} v={`${t(FIT_LABEL[facts.fit.level])} (${facts.fit.score}/100)`} />}
            <Row k={t("Adjacent products")} v={facts.opportunities.count} />
            <ul className="space-y-1 pt-1">
              {facts.opportunities.top.map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-2">
                  <Link href={`/opportunities/${t.id}`} className="min-w-0 truncate text-primary underline-offset-4 hover:underline">
                    {t.name}
                  </Link>
                  <span className="tnum shrink-0 text-xs text-muted-foreground">{t.score}/100</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{t("Inferred from your declared capabilities. Not confirmed demand.")}</p>
          </Panel>

          <Panel title={t("Documents prepared")} badge="inferred" href={`/documentation/${ref}`} cta={t("Open the document drafts")}>
            <Row k={t("Commercial invoice")} v={docs.invoice.complete ? t("Fields complete (draft)") : t("{n} items missing", { n: docs.invoice.missing })} />
            <Row k={t("Packing list")} v={docs.packing.complete ? t("Fields complete (draft)") : t("{n} items missing", { n: docs.packing.missing })} />
            <Row k={t("Checklist answered")} v={t("{done} of {total}", { done: docs.checklist.answered, total: docs.checklist.total })} />
            <p className="text-xs text-muted-foreground">{t("All are drafts for you to review. Nothing is submitted anywhere.")}</p>
          </Panel>

          <Panel title={t("Expert requests")} badge="manual" href={`/services${facts.standalone ? "" : `?product=${ref}`}`} cta={t("Prepare an expert brief")}>
            {reqs.length === 0 ? (
              <p className="text-muted-foreground">{t("No briefs saved. Preparing one fills in your context for you.")}</p>
            ) : (
              <ul className="space-y-1.5">
                {reqs.slice(0, 4).map((q) => (
                  <li key={q.id} className="flex items-start justify-between gap-2">
                    <span>{t(TOPIC_BY_ID[q.topic].label)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{t(REQUEST_STATUS[q.status])}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">{t("Saved in this browser only. No expert is connected and nothing has been sent.")}</p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
