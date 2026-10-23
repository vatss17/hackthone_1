"use client";

import { statusLabel } from "@/config/status";
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
import { useT } from "@/lib/i18n/client";
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
  const t = useT();
  const { assessment, hasAssessment, hydrated } = useSaved(p);
  const s = executiveSummary({ fit: p.fit, assessment: hasAssessment ? assessment : null, format: { aed: formatAed, pct: formatPct } });
  return (
    <section
      aria-labelledby="exec-h"
      className={cn("mt-6 rounded-md border p-5 sm:p-6", s.tone === "positive" ? "border-primary/40 bg-(--status-verified-bg)" : s.tone === "mixed" ? "border-primary/25 bg-(--status-verified-bg)" : "border-(--status-estimate-border) bg-(--status-estimate-bg)")}
    >
      <p className="text-xs font-medium text-primary">{t("Executive summary")}</p>
      <h2 id="exec-h" className="sr-only">
        {t("Executive summary")}
      </h2>
      <p className="mt-2 max-w-3xl text-lg font-medium leading-snug tracking-tight sm:text-xl">{hydrated ? s.sentences.map((x) => t(x)).join(" ") : t("Loading your saved assessment…")}</p>
      {s.numbers && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {s.numbers.map((n) => (
            <div key={n.label} className="rounded-lg border bg-card px-3 py-2">
              <dt className="text-xs text-muted-foreground">{t(n.label)}</dt>
              <dd className="tnum text-lg font-semibold">{n.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-4 max-w-3xl text-xs text-muted-foreground">
        {t("A first assessment to guide your next steps. It is not a regulatory approval, a compliance opinion or a forecast of profit.")} {hasAssessment ? t("The figures come from your own saved assumptions.") : ""}
      </p>
    </section>
  );
}

export function SixQuestions(
  p: Shared & { fit: FitLevel | null; fitScore: number | null; productRef: string; checksTotal: number; hasProduct: boolean },
) {
  const t = useT();
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
      q: t("Can my factory make this?"),
      a: p.fit ? t("{fit} ({score}/100), judged from the processes, materials and machinery you declared.", { fit: t(FIT_TEXT[p.fit]), score: p.fitScore ?? 0 }) : t("Not assessed: there is no rules profile for this product."),
      kind: p.fit ? ("inferred" as const) : ("missing" as const),
      href: p.hasProduct ? `/opportunities/${p.productRef}#match` : "/factories",
      link: t("See the match"),
    },
    {
      n: 2,
      q: t("How much would it cost to export to the destination market?"),
      a: r ? (sample ? t("About {landed} per unit landed ({inr}), {total} for the consignment, using sample inputs.", { landed: formatAed(r.landedPerUnitAed), inr: formatInr(r.landedPerUnitInr), total: formatInr(r.totalCostInr) }) : t("About {landed} per unit landed ({inr}), {total} for the consignment.", { landed: formatAed(r.landedPerUnitAed), inr: formatInr(r.landedPerUnitInr), total: formatInr(r.totalCostInr) })) : t("Not estimated yet. Start the calculator."),
      kind: r ? (sample ? ("assumption" as const) : ("estimate" as const)) : ("missing" as const),
      href: calcHref,
      link: t("Open the calculator"),
    },
    {
      n: 3,
      q: t("What selling price would make commercial sense?"),
      a: r
        ? t("Break-even is {breakEven}. For your {target}% target margin you would need {needed} per unit. You proposed {proposed}. Market price levels are not connected.", { breakEven: Number.isFinite(r.breakEvenPriceAed) ? formatAed(r.breakEvenPriceAed) : t("not reachable"), target: assessment.inputs.targetMarginPercent, needed: r.priceForTargetMarginAed === null ? t("a price that cannot be reached") : formatAed(r.priceForTargetMarginAed), proposed: formatAed(assessment.inputs.sellingPriceAed) })
        : t("Needs the calculator. Market price levels are not connected either way."),
      kind: r ? ("estimate" as const) : ("missing" as const),
      href: `${calcHref}#results`,
      link: t("See the price ladder"),
    },
    {
      n: 4,
      q: t("What could my gross margin be?"),
      a: r ? (margins.length > 1 ? t("{margin} in your base case, between {min} and {max} across your scenarios.", { margin: formatPct(r.grossMarginPct), min: formatPct(Math.min(...margins)), max: formatPct(Math.max(...margins)) }) : t("{margin} in your base case.", { margin: formatPct(r.grossMarginPct) })) : t("Needs the calculator."),
      kind: r ? ("estimate" as const) : ("missing" as const),
      href: `${calcHref}#scenarios`,
      link: t("Compare scenarios"),
    },
    {
      n: 5,
      q: t("What regulatory, tariff and documentation questions must I resolve?"),
      a: `${p.checksTotal > 0 ? `${t("{total} screening questions for this product type, {done} marked resolved by you.", { total: p.checksTotal, done: checksResolved })} ` : ""}${t("Destination requirements, the duty rate, classification and CEPA eligibility are all unverified. Export documents: {status}, and not submitted anywhere.", { status: t(statusLabel("documents")).toLowerCase() })}`,
      kind: "unknown" as const,
      href: p.hasProduct ? `/compliance?product=${p.productRef}` : "/compliance",
      link: t("Open compliance screening"),
    },
    {
      n: 6,
      q: t("What should I do next?"),
      a: t("Replace sample inputs, get a freight quote, close the compliance questions, and ask an expert to confirm classification. The list below puts them in order."),
      kind: "inferred" as const,
      href: "#next",
      link: t("Jump to next steps"),
    },
  ];
  return (
    <section className="mt-10" aria-labelledby="six-h">
      <h2 id="six-h" className="text-lg font-semibold tracking-tight">
        {t("The six questions")}
      </h2>
      <ol className="mt-3 divide-y rounded-lg border bg-card">
        {q.map((x) => (
          <li key={x.n} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[2rem_1fr_auto] sm:items-start sm:gap-4 sm:px-5">
            <span className="tnum text-sm text-primary">{x.n}</span>
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
  const t = useT();
  const { assessment, hasAssessment, hydrated } = useSaved(p);
  const calcHref = p.hasProduct ? `/viability?product=${p.productRef}` : "/viability";
  if (!hydrated) return null;
  if (!hasAssessment) {
    return (
      <section className="mt-10" aria-labelledby="cs-h">
        <h2 id="cs-h" className="text-lg font-semibold tracking-tight">
          {t("Landed cost and margin")}
        </h2>
        <div className="mt-3 rounded-md border border-dashed border-input/60 bg-card px-5 py-6">
          <h3 className="text-[15px] font-semibold">{t("No landed-cost estimate yet")}</h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t("Open the calculator, adjust the inputs and compare scenarios. Your numbers will appear here automatically.")}</p>
          <Button asChild className="mt-4">
            <Link href={calcHref}>{t("Calculate landed cost")}</Link>
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
          {t("Landed cost and margin")}
        </h2>
        <div className="flex gap-1.5">
          <StatusBadge kind={inputsAreSample(assessment) ? "assumption" : "estimate"} />
          <StatusBadge kind="user" />
        </div>
      </div>
      <div className="mt-3 grid gap-5 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{t("Landed cost per unit")}</dt>
              <dd className="tnum text-lg font-semibold">{formatAed(r.landedPerUnitAed)}</dd>
              <dd className="tnum text-xs text-muted-foreground">{formatInr(r.landedPerUnitInr)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("Gross margin (target {target}%)", { target: i.targetMarginPercent })}</dt>
              <dd className="tnum text-lg font-semibold">{formatPct(r.grossMarginPct)}</dd>
              <dd className="tnum text-xs text-muted-foreground">{t("markup {pct}", { pct: formatPct(r.markupPct) })}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("Selling price")}</dt>
              <dd className="tnum">{formatAed(i.sellingPriceAed)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("Break-even price")}</dt>
              <dd className="tnum">{Number.isFinite(r.breakEvenPriceAed) ? formatAed(r.breakEvenPriceAed) : t("not reachable")}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">{t("Margin moves most with {drivers}.", { drivers: drivers.map((d) => t(d)).join(", ") })}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {i.fxNote.trim() ? t("Exchange rate: 1 AED = INR {rate}, user-entered ({note}). Duty {duty}% is an unverified assumption.", { rate: i.inrPerAed, note: i.fxNote.trim(), duty: i.duty.ratePercent }) : t("Exchange rate: 1 AED = INR {rate}, user-entered, source not noted. Duty {duty}% is an unverified assumption.", { rate: i.inrPerAed, duty: i.duty.ratePercent })}
          </p>
          <Link href={calcHref} className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("Edit assumptions")}
          </Link>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-5">
          <CostBreakdown lines={r.lines} totalInr={r.totalCostInr} inrPerAed={i.inrPerAed} />
        </div>
      </div>
      <div className="mt-5 rounded-lg border bg-card p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold">{t("Margin across your scenarios")}</h3>
        <MarginBars items={rows.filter((x) => x.result).map((x) => ({ name: t(x.scenario.name), margin: x.result!.grossMarginPct, hypothetical: x.scenario.preferentialDuty }))} target={i.targetMarginPercent} />
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {rows
            .filter((x) => x.verdict && x.scenario.kind !== "base")
            .map((x) => (
              <li key={x.scenario.id}>
                {t("{scenario}: {verdict}.", { scenario: t(x.scenario.name), verdict: t(VERDICT_LABEL[x.verdict!]).toLowerCase() })}
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}

export function MissingAndNext(p: Shared & { productRef: string; hasProduct: boolean; hsClaimed: boolean; capabilityGaps: number; checksTotal: number }) {
  const t = useT();
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
          {t("Missing information needed for an informed decision")}
        </h2>
        <ul className="mt-3 divide-y rounded-lg border bg-card">
          {missing.map((m) => (
            <li key={m.id} className="grid gap-1.5 px-4 py-3 sm:grid-cols-[1fr_auto] sm:gap-4 sm:px-5">
              <div className="min-w-0">
                <Link href={m.href} className="text-sm font-medium underline-offset-4 hover:underline">
                  {t(m.label)}
                </Link>
                <p className="text-sm text-muted-foreground">{t(m.why)}</p>
              </div>
              <StatusBadge kind={m.kind === "assumption" ? "assumption" : m.kind === "unknown" ? "unknown" : "missing"} className="self-start" />
            </li>
          ))}
        </ul>
      </section>

      <section id="next" className="mt-10 scroll-mt-20" aria-labelledby="next-h">
        <h2 id="next-h" className="text-lg font-semibold tracking-tight">
          {t("What to do next")}
        </h2>
        <ol className="mt-3 divide-y rounded-lg border bg-card">
          {acts.map((x, idx) => (
            <li key={x.label} className="flex items-start gap-3 px-4 py-3 sm:px-5">
              <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs", x.done ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")} aria-hidden>
                {x.done ? "✓" : idx + 1}
              </span>
              <div className="min-w-0">
                <Link href={x.href} className={cn("text-sm font-medium underline-offset-4 hover:underline", x.done && "text-muted-foreground line-through")}>
                  {t(x.label)}
                </Link>
                <span className="sr-only">{x.done ? ` (${t("done")})` : ` (${t("not yet")})`}</span>
                <p className="text-sm text-muted-foreground">{t(x.note)}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5">
          <Button asChild size="lg" className="h-10">
            <Link href={p.hasProduct ? `/roadmap?product=${p.productRef}` : "/roadmap"}>{t("Continue to your Export Readiness Roadmap")}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

export function PrintButton() {
  const t = useT();
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        // A closed disclosure is not printed, so open every one first and put them back afterwards.
        const closed = [...document.querySelectorAll<HTMLDetailsElement>("main details:not([open])")];
        closed.forEach((d) => (d.open = true));
        window.addEventListener("afterprint", () => closed.forEach((d) => (d.open = false)), { once: true });
        window.print();
      }}
    >
      {t("Print or save as PDF")}
    </Button>
  );
}

/** The ordered next-actions list on its own, for the roadmap page. */
export function RoadmapActions(p: Shared & { productRef: string; hasProduct: boolean; checksTotal: number }) {
  const t = useT();
  const { assessment, hasAssessment, hydrated } = useSaved(p);
  if (!hydrated) return null;
  const ref = p.hasProduct ? p.productRef : "standalone";
  const acts = nextActions({ assessment: hasAssessment ? assessment : null, ref, checksResolved: Object.keys(assessment.checks).length, checksTotal: p.checksTotal });
  return (
    <ol className="mt-3 divide-y rounded-lg border bg-card">
      {acts.map((x, idx) => (
        <li key={x.label} className="flex items-start gap-3 px-4 py-3 sm:px-5">
          <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs", x.done ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")} aria-hidden>
            {x.done ? "✓" : idx + 1}
          </span>
          <div className="min-w-0">
            <Link href={x.href} className={cn("text-sm font-medium underline-offset-4 hover:underline", x.done && "text-muted-foreground line-through")}>
              {t(x.label)}
            </Link>
            <span className="sr-only">{x.done ? ` (${t("done")})` : ` (${t("not yet")})`}</span>
            <p className="text-sm text-muted-foreground">{t(x.note)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
