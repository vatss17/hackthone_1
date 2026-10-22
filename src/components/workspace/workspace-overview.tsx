"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { NextBestAction, ProgressCounts, StatusPill } from "@/components/workspace/roadmap-board";
import { useWorkspace } from "@/components/workspace/use-workspace";
import { calculate, validateInputs } from "@/lib/landed-cost/calc";
import { formatAed, formatPct } from "@/lib/landed-cost/format";
import { STATUS_LABEL as REQUEST_STATUS, TOPIC_BY_ID } from "@/lib/experts/brief";
import { FIT_LABEL } from "@/lib/opportunities/engine";
import type { Inputs } from "@/lib/landed-cost/types";
import type { WorkspaceFacts } from "@/lib/workspace/types";

function Card({ title, badge, children, href, cta }: { title: string; badge?: StatusKind; children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <section className="flex flex-col rounded-md border bg-card" aria-label={title}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {badge && <StatusBadge kind={badge} />}
      </div>
      <div className="flex-1 space-y-2 p-4 text-sm">{children}</div>
      {href && cta && (
        <div className="border-t px-4 py-2.5">
          <Link href={href} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
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
    <span className="text-right font-medium">{v}</span>
  </div>
);

/**
 * The Export Workspace: one page that answers "what is the next best action to get this product
 * export-ready?" and shows, with facts rather than a score, what has been told, found, calculated,
 * blocked, drafted and requested.
 */
export function WorkspaceOverview({ scope, facts, defaults }: { scope: string; facts: WorkspaceFacts; defaults: Inputs }) {
  const w = useWorkspace({ scope, facts, defaults });
  if (!w.hydrated) return <p className="mt-8 text-sm text-muted-foreground">Loading your workspace…</p>;
  const { roadmap, assessment: a, docs } = w;
  const p = facts.product;
  const ref = facts.ref;
  const valid = Object.keys(validateInputs(a.inputs).errors).length === 0;
  const r = valid ? calculate(a.inputs) : null;
  const sample = a.edited.length === 0;
  const recordParts = p ? [p.description, p.category, p.intendedUse, p.specCount > 0].filter(Boolean).length : 0;
  const calcHref = facts.standalone ? "/viability" : `/viability?product=${ref}`;
  const reqs = w.relevantRequests;

  return (
    <div className="mt-6 space-y-6">
      <NextBestAction roadmap={roadmap} productName={p?.name ?? null} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Progress is counted in tasks and named blockers, not scored.</p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/roadmap?product=${ref}`}>Open the full roadmap</Link>
        </Button>
      </div>
      <ProgressCounts roadmap={roadmap} />

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="What you have told us" badge="user" href={p?.own ? `/products/${ref}` : "/products"} cta={p?.own ? "Open the product" : "Open your catalogue"}>
          <Row k="Factories" v={facts.profile.factories} />
          <Row k="Processes · materials" v={`${facts.profile.processes} · ${facts.profile.materials}`} />
          <Row k="Machines (rated)" v={`${facts.profile.machines} (${facts.profile.ratedMachines})`} />
          <Row k="Capacity declared" v={facts.profile.capacity ? "Yes" : "No"} />
          {p ? (
            <>
              <Row k="Product" v={p.name} />
              <Row k="Product record" v={p.own ? `${recordParts} of 4 parts` : "Not in your catalogue yet"} />
              <Row k="Made at" v={p.linkedFactories.length ? p.linkedFactories.join(", ") : "Not linked"} />
            </>
          ) : (
            <p className="text-muted-foreground">No product selected. This is a standalone assessment.</p>
          )}
          <p className="pt-1 text-xs text-muted-foreground">
            <Link href="/products/import" className="font-medium text-primary underline-offset-4 hover:underline">
              Import more products from a catalogue
            </Link>
          </p>
        </Card>

        <Card title="Opportunities discovered" badge="inferred" href="/opportunities" cta="Open Export Opportunities">
          {facts.fit.level && (
            <Row k={p?.name ?? "This product"} v={`${FIT_LABEL[facts.fit.level]} (${facts.fit.score}/100)`} />
          )}
          <Row k="Adjacent products your factory could make" v={facts.opportunities.count} />
          <ul className="space-y-1 pt-1">
            {facts.opportunities.top.map((t) => (
              <li key={t.id}>
                <Link href={`/opportunities/${t.id}`} className="text-primary underline-offset-4 hover:underline">
                  {t.name}
                </Link>{" "}
                <span className="text-xs text-muted-foreground">{t.score}/100</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Inferred from your declared capabilities. Not confirmed demand.</p>
        </Card>

        <Card title="Commercial feasibility" badge={r ? (sample ? "assumption" : "estimate") : "missing"} href={calcHref} cta={r ? "Open the calculator" : "Start the calculator"}>
          {r ? (
            <>
              <Row k="Landed cost per unit" v={formatAed(r.landedPerUnitAed)} />
              <Row k="Selling price" v={formatAed(a.inputs.sellingPriceAed)} />
              <Row k={`Gross margin (target ${a.inputs.targetMarginPercent}%)`} v={formatPct(r.grossMarginPct)} />
              <p className="text-xs text-muted-foreground">{sample ? "These figures use SAMPLE inputs. Replace them with your own." : "Your own estimates. UAE prices, duty and freight are not verified."}</p>
            </>
          ) : (
            <p className="text-muted-foreground">No valid landed-cost estimate yet.</p>
          )}
          <p className="text-xs">
            <Link href={`/feasibility/${ref}`} className="font-medium text-primary underline-offset-4 hover:underline">
              Open the feasibility assessment
            </Link>
          </p>
        </Card>

        <Card title="Outstanding blockers" badge="unknown">
          {roadmap.blockers.length === 0 ? (
            <p className="text-muted-foreground">No open blockers. That is not an approval: check the items that rest on your word.</p>
          ) : (
            <ul className="space-y-1.5">
              {roadmap.blockers.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2">
                  <Link href={t.next.href} className="font-medium underline-offset-4 hover:underline">
                    {t.title}
                  </Link>
                  <StatusPill status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Roadmap progress" href={`/roadmap?product=${ref}`} cta="Open the roadmap">
          <ul className="space-y-1">
            {roadmap.phases.map((ph) => (
              <li key={ph.id} className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">
                  <span className="mr-1.5 font-mono text-primary">{ph.id}</span>
                  {ph.title}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums">
                  {ph.counts.completed}/{ph.counts.total}
                  {ph.counts.needsReview ? ` · ${ph.counts.needsReview} to review` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Documents prepared" badge="inferred" href={`/documentation/${ref}`} cta="Open the document drafts">
          <Row k="Commercial invoice" v={docs.invoice.complete ? "Fields complete (draft)" : `${docs.invoice.missing} items missing`} />
          <Row k="Packing list" v={docs.packing.complete ? "Fields complete (draft)" : `${docs.packing.missing} items missing`} />
          <Row k="Checklist answered" v={`${docs.checklist.answered} of ${docs.checklist.total}`} />
          <p className="text-xs text-muted-foreground">All are drafts for you to review. Nothing is submitted anywhere.</p>
        </Card>

        <Card title="Expert requests" badge="user" href={`/services${facts.standalone ? "" : `?product=${ref}`}`} cta="Prepare an expert brief">
          {reqs.length === 0 ? (
            <p className="text-muted-foreground">No briefs saved. Preparing one fills in your context for you.</p>
          ) : (
            <ul className="space-y-1.5">
              {reqs.slice(0, 4).map((q) => (
                <li key={q.id} className="flex items-start justify-between gap-2">
                  <span>{TOPIC_BY_ID[q.topic].label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{REQUEST_STATUS[q.status]}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Saved in this browser only. Nothing has been sent to any expert.</p>
        </Card>
      </div>
    </div>
  );
}
