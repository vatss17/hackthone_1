"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { CostBreakdown, MarginBars } from "@/components/landed-cost/charts";
import { useAssessment } from "@/components/landed-cost/use-assessment";
import { calculate, validateInputs } from "@/lib/landed-cost/calc";
import { compareScenarios, VERDICT_LABEL } from "@/lib/landed-cost/scenarios";
import { formatAed, formatInr, formatPct } from "@/lib/landed-cost/format";
import { executiveSummary, inputsAreSample, missingInformation, nextActions, topDrivers } from "@/lib/landed-cost/summary";
import type { Inputs } from "@/lib/landed-cost/types";
import type { FitLevel } from "@/lib/opportunities/types";
import { cn } from "@/lib/utils";

/**
 * The parts of the feasibility page that depend on the user's saved landed-cost assessment. That
 * assessment lives in this browser, so these pieces render on the client and say plainly when no
 * assessment exists yet.
 */

type Shared = { scope: string; assessmentRef: string; defaults: Inputs };

const FIT_TEXT: Record<FitLevel, string> = {
  strong: "Strong capability fit",
  good: "Good capability fit",
  possible: "Possible fit, with gaps",
  stretch: "A stretch: needs a new process",
};

function useSaved(p: Shared) {
  const a = useAssessment({ scope: p.scope, assessmentRef: p.assessmentRef, defaults: p.defaults });
  const valid = Object.keys(validateInputs(a.assessment.inputs).errors).length === 0;
  return { ...a, valid, hasAssessment: a.saved && valid };
}

export function ExecutiveSummaryCard(p: Shared & { fit: FitLevel | null }) {
  const { assessment, hasAssessment, hydrated } = useSaved(p);
  const s = executiveSummary({ fit: p.fit, assessment: hasAssessment ? assessment : null, format: { aed: formatAed, pct: formatPct } });
  return (
    <section
      aria-labelledby="exec-h"
      className={cn("mt-6 rounded-md border p-5 sm:p-6", s.tone === "positive" ? "border-primary/40 bg-(--status-verified-bg)" : s.tone === "mixed" ? "border-primary/25 bg-(--status-verified-bg)" : "border-(--status-estimate-border) bg-(--status-estimate-bg)")}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Executive summary</p>
      <h2 id="exec-h" className="sr-only">
        Executive summary
      </h2>
      <p className="mt-2 max-w-3xl text-lg font-medium leading-snug tracking-tight sm:text-xl">{hydrated ? s.sentences.join(" ") : "Loading your saved assessment…"}</p>
      {s.numbers && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {s.numbers.map((n) => (
            <div key={n.label} className="rounded-md border bg-card px-3 py-2">
              <dt className="text-xs text-muted-foreground">{n.label}</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums">{n.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
        A first assessment to guide your next steps. It is not a regulatory approval, a compliance opinion or a forecast of profit. {hasAssessment ? "The figures come from your own saved assumptions." : ""}
      </p>
    </section>
  );
}

export function SixQuestions(
  p: Shared & { fit: FitLevel | null; fitScore: number | null; productRef: string; checksTotal: number; hasProduct: boolean },
) {
  const { assessment, hasAssessment, hydrated } = useSaved(p);
  const checksResolved = Object.keys(assessment.checks).length;
  const r = hasAssessment ? calculate(assessment.inputs) : null;
  const rows = hasAssessment ? compareScenarios(assessment.inputs, assessment.scenarios).filter((x) => x.result) : [];
  const margins = rows.map((x) => x.result!.grossMarginPct).filter((m): m is number => m !== null);
  const sample = inputsAreSample(hasAssessment ? assessment : null);
  const calcHref = p.hasProduct ? `/viability?product=${p.productRef}` : "/viability";
  const q = [
    {
      n: 1,
      q: "Can my factory make this?",
      a: p.fit ? `${FIT_TEXT[p.fit]} (${p.fitScore}/100), judged from the processes, materials and machinery you declared.` : "Not assessed: there is no rules profile for this product.",
      kind: p.fit ? ("inferred" as const) : ("missing" as const),
      href: p.hasProduct ? `/opportunities/${p.productRef}#match` : "/factories",
      link: "See the match",
    },
    {
      n: 2,
      q: "How much would it cost to export to the UAE?",
      a: r ? `About ${formatAed(r.landedPerUnitAed)} per unit landed (${formatInr(r.landedPerUnitInr)}), ${formatInr(r.totalCostInr)} for the consignment${sample ? ", using sample inputs" : ""}.` : "Not estimated yet. Start the calculator.",
      kind: r ? (sample ? ("assumption" as const) : ("estimate" as const)) : ("missing" as const),
      href: calcHref,
      link: "Open the calculator",
    },
    {
      n: 3,
      q: "What selling price would make commercial sense?",
      a: r
        ? `Break-even is ${Number.isFinite(r.breakEvenPriceAed) ? formatAed(r.breakEvenPriceAed) : "not reachable"}. For your ${assessment.inputs.targetMarginPercent}% target margin you would need ${r.priceForTargetMarginAed === null ? "a price that cannot be reached" : formatAed(r.priceForTargetMarginAed)} per unit. You proposed ${formatAed(assessment.inputs.sellingPriceAed)}. Market price levels are not connected.`
        : "Needs the calculator. Market price levels are not connected either way.",
      kind: r ? ("estimate" as const) : ("missing" as const),
      href: `${calcHref}#results`,
      link: "See the price ladder",
    },
    {
      n: 4,
      q: "What could my gross margin be?",
      a: r ? `${formatPct(r.grossMarginPct)} in your base case${margins.length > 1 ? `, between ${formatPct(Math.min(...margins))} and ${formatPct(Math.max(...margins))} across your scenarios` : ""}.` : "Needs the calculator.",
      kind: r ? ("estimate" as const) : ("missing" as const),
      href: `${calcHref}#scenarios`,
      link: "Compare scenarios",
    },
    {
      n: 5,
      q: "What regulatory, tariff and documentation questions must I resolve?",
      a: `${p.checksTotal > 0 ? `${p.checksTotal} screening questions for this product type, ${checksResolved} marked resolved by you. ` : ""}UAE requirements, the duty rate, classification and CEPA eligibility are all unverified. Export documents are a preview.`,
      kind: "unknown" as const,
      href: p.hasProduct ? `/compliance?product=${p.productRef}` : "/compliance",
      link: "Open compliance screening",
    },
    {
      n: 6,
      q: "What should I do next?",
      a: "Replace sample inputs, get a freight quote, close the compliance questions, and ask an expert to confirm classification. The list below puts them in order.",
      kind: "inferred" as const,
      href: "#next",
      link: "Jump to next steps",
    },
  ];
  return (
    <section className="mt-10" aria-labelledby="six-h">
      <h2 id="six-h" className="text-lg font-semibold tracking-tight">
        The six questions
      </h2>
      <ol className="mt-3 divide-y rounded-md border bg-card">
        {q.map((x) => (
          <li key={x.n} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[2rem_1fr_auto] sm:items-start sm:gap-4 sm:px-5">
            <span className="font-mono text-sm text-primary">{x.n}</span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold">{x.q}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{hydrated ? x.a : "…"}</p>
              <Link href={x.href} className="mt-1 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
                {x.link}
              </Link>
            </div>
            <StatusBadge kind={x.kind} className="self-start" />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function CostSnapshot(p: Shared & { productRef: string; hasProduct: boolean }) {
  const { assessment, hasAssessment, hydrated } = useSaved(p);
  const calcHref = p.hasProduct ? `/viability?product=${p.productRef}` : "/viability";
  if (!hydrated) return null;
  if (!hasAssessment) {
    return (
      <section className="mt-10" aria-labelledby="cs-h">
        <h2 id="cs-h" className="text-lg font-semibold tracking-tight">
          Landed cost and margin
        </h2>
        <div className="mt-3 rounded-md border border-dashed border-input/60 bg-card px-5 py-6">
          <h3 className="text-[15px] font-semibold">No landed-cost estimate yet</h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Open the calculator, adjust the inputs and compare scenarios. Your numbers will appear here automatically.</p>
          <Button asChild className="mt-4">
            <Link href={calcHref}>Calculate landed cost</Link>
          </Button>
        </div>
      </section>
    );
  }
  const i = assessment.inputs;
  const r = calculate(i);
  const rows = compareScenarios(i, assessment.scenarios);
  const drivers = topDrivers(i, 3);
  return (
    <section className="mt-10" aria-labelledby="cs-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="cs-h" className="text-lg font-semibold tracking-tight">
          Landed cost and margin
        </h2>
        <div className="flex gap-1.5">
          <StatusBadge kind={inputsAreSample(assessment) ? "assumption" : "estimate"} />
          <StatusBadge kind="user" />
        </div>
      </div>
      <div className="mt-3 grid gap-5 md:grid-cols-2">
        <div className="rounded-md border bg-card p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Landed cost per unit</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums">{formatAed(r.landedPerUnitAed)}</dd>
              <dd className="font-mono text-xs text-muted-foreground">{formatInr(r.landedPerUnitInr)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Gross margin (target {i.targetMarginPercent}%)</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums">{formatPct(r.grossMarginPct)}</dd>
              <dd className="font-mono text-xs text-muted-foreground">markup {formatPct(r.markupPct)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Selling price</dt>
              <dd className="font-mono tabular-nums">{formatAed(i.sellingPriceAed)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Break-even price</dt>
              <dd className="font-mono tabular-nums">{Number.isFinite(r.breakEvenPriceAed) ? formatAed(r.breakEvenPriceAed) : "not reachable"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">Margin moves most with {drivers.join(", ")}.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Exchange rate: 1 AED = INR {i.inrPerAed}, user-entered{i.fxNote.trim() ? ` (${i.fxNote.trim()})` : ", source not noted"}. Duty {i.duty.ratePercent}% is an unverified assumption.
          </p>
          <Link href={calcHref} className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
            Edit assumptions
          </Link>
        </div>
        <div className="rounded-md border bg-card p-4 sm:p-5">
          <CostBreakdown lines={r.lines} totalInr={r.totalCostInr} inrPerAed={i.inrPerAed} />
        </div>
      </div>
      <div className="mt-5 rounded-md border bg-card p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold">Margin across your scenarios</h3>
        <MarginBars items={rows.filter((x) => x.result).map((x) => ({ name: x.scenario.name, margin: x.result!.grossMarginPct, hypothetical: x.scenario.preferentialDuty }))} target={i.targetMarginPercent} />
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {rows
            .filter((x) => x.verdict && x.scenario.kind !== "base")
            .map((x) => (
              <li key={x.scenario.id}>
                {x.scenario.name}: {VERDICT_LABEL[x.verdict!].toLowerCase()}.
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}

export function MissingAndNext(p: Shared & { productRef: string; hasProduct: boolean; hsClaimed: boolean; capabilityGaps: number; checksTotal: number }) {
  const { assessment, hasAssessment, hydrated } = useSaved(p);
  if (!hydrated) return null;
  const a = hasAssessment ? assessment : null;
  const ref = p.hasProduct ? p.productRef : "standalone";
  const missing = missingInformation({ assessment: a, hsClaimed: p.hsClaimed, capabilityGaps: p.capabilityGaps, ref });
  const acts = nextActions({ assessment: a, ref, checksResolved: Object.keys(assessment.checks).length, checksTotal: p.checksTotal });
  return (
    <>
      <section className="mt-10" aria-labelledby="miss-h">
        <h2 id="miss-h" className="text-lg font-semibold tracking-tight">
          Missing information needed for an informed decision
        </h2>
        <ul className="mt-3 divide-y rounded-md border bg-card">
          {missing.map((m) => (
            <li key={m.id} className="grid gap-1.5 px-4 py-3 sm:grid-cols-[1fr_auto] sm:gap-4 sm:px-5">
              <div className="min-w-0">
                <Link href={m.href} className="text-sm font-medium underline-offset-4 hover:underline">
                  {m.label}
                </Link>
                <p className="text-sm text-muted-foreground">{m.why}</p>
              </div>
              <StatusBadge kind={m.kind === "assumption" ? "assumption" : m.kind === "unknown" ? "unknown" : "missing"} className="self-start" />
            </li>
          ))}
        </ul>
      </section>

      <section id="next" className="mt-10 scroll-mt-20" aria-labelledby="next-h">
        <h2 id="next-h" className="text-lg font-semibold tracking-tight">
          What to do next
        </h2>
        <ol className="mt-3 divide-y rounded-md border bg-card">
          {acts.map((x, idx) => (
            <li key={x.label} className="flex items-start gap-3 px-4 py-3 sm:px-5">
              <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs", x.done ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")} aria-hidden>
                {x.done ? "✓" : idx + 1}
              </span>
              <div className="min-w-0">
                <Link href={x.href} className={cn("text-sm font-medium underline-offset-4 hover:underline", x.done && "text-muted-foreground line-through")}>
                  {x.label}
                </Link>
                <span className="sr-only">{x.done ? " (done)" : " (not yet)"}</span>
                <p className="text-sm text-muted-foreground">{x.note}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5">
          <Button asChild size="lg" className="h-10">
            <Link href={p.hasProduct ? `/roadmap?product=${p.productRef}` : "/roadmap"}>Continue to your Export Readiness Roadmap</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

export function PrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      Print or save as PDF
    </Button>
  );
}

/** The ordered next-actions list on its own, for the roadmap page. */
export function RoadmapActions(p: Shared & { productRef: string; hasProduct: boolean; checksTotal: number }) {
  const { assessment, hasAssessment, hydrated } = useSaved(p);
  if (!hydrated) return null;
  const ref = p.hasProduct ? p.productRef : "standalone";
  const acts = nextActions({ assessment: hasAssessment ? assessment : null, ref, checksResolved: Object.keys(assessment.checks).length, checksTotal: p.checksTotal });
  return (
    <ol className="mt-3 divide-y rounded-md border bg-card">
      {acts.map((x, idx) => (
        <li key={x.label} className="flex items-start gap-3 px-4 py-3 sm:px-5">
          <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs", x.done ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")} aria-hidden>
            {x.done ? "✓" : idx + 1}
          </span>
          <div className="min-w-0">
            <Link href={x.href} className={cn("text-sm font-medium underline-offset-4 hover:underline", x.done && "text-muted-foreground line-through")}>
              {x.label}
            </Link>
            <span className="sr-only">{x.done ? " (done)" : " (not yet)"}</span>
            <p className="text-sm text-muted-foreground">{x.note}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
