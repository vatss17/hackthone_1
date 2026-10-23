"use client";

import Link from "next/link";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { useAssessment } from "@/components/landed-cost/use-assessment";
import { calculate, validateInputs } from "@/lib/landed-cost/calc";
import { sampleInputs } from "@/lib/landed-cost/defaults";
import { formatAed, formatPct } from "@/lib/landed-cost/format";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** One of the four separate assessments. They are never added up or averaged into a single score. */
export function DimensionBox({ title, status, badge, children, href, cta }: { title: string; status: string; badge: StatusKind; children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <section className="flex flex-col rounded-md border bg-background/60 p-3.5" aria-label={title}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
        <StatusBadge kind={badge} />
      </div>
      <p className="mt-1 text-sm font-semibold leading-snug">{status}</p>
      <div className="mt-1.5 flex-1 space-y-1 text-sm text-muted-foreground">{children}</div>
      {href && cta && (
        <Link href={href} className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
          {cta}
        </Link>
      )}
    </section>
  );
}

/** Commercial feasibility for this product, read from the user's own saved landed-cost assessment. */
export function CommercialDimension({ scope, assessmentRef }: { scope: string; assessmentRef: string }) {
  const t = useT();
  const { assessment, saved, hydrated } = useAssessment({ scope, assessmentRef, defaults: sampleInputs() });
  const href = `/viability?product=${assessmentRef}`;
  const valid = Object.keys(validateInputs(assessment.inputs).errors).length === 0;
  if (!hydrated || !saved || !valid) {
    return (
      <DimensionBox title={t("Commercial feasibility")} status={t("Not assessed")} badge="missing" href={href} cta={t("Open the calculator")}>
        <p>{t("No landed-cost estimate yet. Margin depends on your costs, freight and price.")}</p>
      </DimensionBox>
    );
  }
  const r = calculate(assessment.inputs);
  const sample = assessment.edited.length === 0;
  const target = assessment.inputs.targetMarginPercent;
  return (
    <DimensionBox title={t("Commercial feasibility")} status={sample ? t("Illustrative (sample inputs)") : r.grossProfitInr < 0 ? t("Loss at your assumptions") : (r.grossMarginPct ?? 0) < target ? t("Below your target at your assumptions") : t("Meets your target at your assumptions")} badge={sample ? "assumption" : "user"} href={href} cta={t("Open the calculator")}>
      <p className={cn("tnum text-xs text-foreground")}>
        {t("{landed} landed · {price} price · {margin} margin", { landed: formatAed(r.landedPerUnitAed), price: formatAed(assessment.inputs.sellingPriceAed), margin: formatPct(r.grossMarginPct) })}
      </p>
      <p>{sample ? t("Sample values: replace them with your own.") : t("Your estimates. Not tested against the market.")}</p>
    </DimensionBox>
  );
}

/** Regulatory readiness: how many screening questions the user has answered. Nothing here is verified. */
export function RegulatoryDimension({ scope, assessmentRef, ids }: { scope: string; assessmentRef: string; ids: string[] }) {
  const t = useT();
  const { assessment, hydrated } = useAssessment({ scope, assessmentRef, defaults: sampleInputs() });
  const done = hydrated ? ids.filter((i) => assessment.checks[i]).length : 0;
  return (
    <DimensionBox title={t("Regulatory readiness")} status={t("Not assessed")} badge="unknown" href={`/compliance?product=${assessmentRef}`} cta={t("Open the screening")}>
      <p>{ids.length ? t("{done} of {total} screening questions marked answered by you.", { done, total: ids.length }) : t("No screening questions for this product type.")}</p>
      <p>{t("Destination requirements, duty, HS code and CEPA eligibility are unverified.")}</p>
    </DimensionBox>
  );
}

/**
 * The four separate assessments on one line each, for the answer-first opportunity list. Still four things,
 * never one score. The full boxes with their reasons sit one click away on the same card.
 */
export function AssessmentStrip({ scope, assessmentRef, ids, fit, evidence }: { scope: string; assessmentRef: string; ids: string[]; fit: string; evidence: string }) {
  const t = useT();
  const { assessment, saved, hydrated } = useAssessment({ scope, assessmentRef, defaults: sampleInputs() });
  const valid = Object.keys(validateInputs(assessment.inputs).errors).length === 0;
  const sample = assessment.edited.length === 0;
  const commercial = !hydrated || !saved || !valid ? t("Not assessed") : sample ? t("Sample inputs only") : t("Margin {margin} at your assumptions", { margin: formatPct(calculate(assessment.inputs).grossMarginPct) });
  const done = hydrated ? ids.filter((i) => assessment.checks[i]).length : 0;
  const regulatory = ids.length ? t("{done} of {total} questions answered", { done, total: ids.length }) : t("Not assessed");
  const cells: [string, string][] = [
    [t("Manufacturing fit"), fit],
    [t("Market evidence"), evidence],
    [t("Commercial feasibility"), commercial],
    [t("Regulatory readiness"), regulatory],
  ];
  return (
    <dl className="mt-4 grid gap-x-6 gap-y-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
      {cells.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 text-sm font-medium leading-snug">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
