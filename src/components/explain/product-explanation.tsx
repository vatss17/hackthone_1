"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { DimensionBox } from "@/components/opportunities/dimensions";
import { AiExplainer } from "@/components/explain/ai-explainer";
import { useWorkspace } from "@/components/workspace/use-workspace";
import { calculate, validateInputs } from "@/lib/landed-cost/calc";
import { explainProduct, type Commercial, type Provenance } from "@/lib/explain/product";
import type { EntryEvidence } from "@/lib/trade/evidence";
import type { AiStatus } from "@/lib/ai/provider";
import type { Inputs } from "@/lib/landed-cost/types";
import type { CatalogueEntry, MatchResult } from "@/lib/opportunities/types";
import type { WorkspaceFacts } from "@/lib/workspace/types";
import { useT } from "@/lib/i18n/client";
import { tr } from "@/lib/opportunities/localize";

const BADGE: Record<Provenance, StatusKind> = { user: "user", inferred: "inferred", reported: "reported", assumption: "assumption", missing: "missing", unknown: "unknown" };

/**
 * "Why is the platform recommending this?" for one product: the four separate assessments, why, what
 * remains uncertain, whether the factory could plausibly make it, and the next best action. The
 * explanation is deterministic and always available. The optional AI explanation sits underneath it.
 */
export function ProductExplanationPanel({ scope, facts, defaults, entry, match, ai, evidence }: { evidence: EntryEvidence; scope: string; facts: WorkspaceFacts; defaults: Inputs; entry: CatalogueEntry | null; match: MatchResult | null; ai: AiStatus }) {
  const t = useT();
  const w = useWorkspace({ scope, facts, defaults });
  if (!w.hydrated) return <p className="mt-6 text-sm text-muted-foreground">{t("Loading the explanation…")}</p>;
  const a = w.assessment;
  const valid = Object.keys(validateInputs(a.inputs).errors).length === 0;
  const r = valid ? calculate(a.inputs) : null;
  const commercial: Commercial | null = r ? { landedPerUnitAed: r.landedPerUnitAed, sellingPriceAed: a.inputs.sellingPriceAed, grossMarginPct: r.grossMarginPct, targetMarginPct: a.inputs.targetMarginPercent, sample: a.edited.length === 0 } : null;
  const resolved = facts.questions.all.filter((id) => a.checks[id]).length;
  const e = explainProduct({ entry, match, commercial, screening: { total: facts.questions.all.length, resolved }, evidence });
  const next = w.roadmap.next;
  const hrefFor = { fit: `/opportunities/${facts.ref}#match`, evidence: `/opportunities/${facts.ref}?stage=4`, commercial: facts.standalone ? "/viability" : `/viability?product=${facts.ref}`, regulatory: facts.standalone ? "/compliance" : `/compliance?product=${facts.ref}` };
  const cta = { fit: t("See the match and score breakdown"), evidence: t("See the evidence and its limits"), commercial: t("Open the calculator"), regulatory: t("Open the screening") };

  return (
    <section className="space-y-5" aria-labelledby="why-h">
      <div>
        <h2 id="why-h" className="text-lg font-medium tracking-tight">
          {t("Why this opportunity?")}
        </h2>
        <div className="mt-3 rounded-lg border bg-card p-5">
          <p className="text-[15px] leading-relaxed">{tr(t, e.why[0] ?? e.dimensions[0].lines[0])}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{t("Main thing to check:")} </span>
            {tr(t, e.dimensions[0].lines.find((l) => l.startsWith("Needs ")) ?? e.dimensions[0].lines.find((l) => l.startsWith("Tooling to confirm")) ?? e.uncertain[0])}
          </p>
        </div>
      </div>
      <details className="rounded-lg border bg-card/60 px-4 py-3 sm:px-5">
        <summary className="cursor-pointer text-sm font-medium text-primary">{t("See detailed reasoning")}</summary>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t("Four separate assessments. They are deliberately not combined into one score: a good manufacturing fit says nothing about demand, margin or regulation.")}</p>
        <div className="mt-4 space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        {e.dimensions.map((d) => (
          <DimensionBox key={d.key} title={t(d.title)} status={tr(t, d.status)} badge={BADGE[d.provenance]} href={hrefFor[d.key]} cta={cta[d.key]}>
            {d.lines.map((l) => (
              <p key={l} className="text-sm">
                {tr(t, l)}
              </p>
            ))}
          </DimensionBox>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t("Could your factory plausibly make it?")}</h3>
            <StatusBadge kind="inferred" />
          </div>
          <p className="mt-1.5 text-sm">{t(e.plausible.text)}</p>
          {e.why.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold">{t("Why it is recommended")}</h3>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
                {e.why.map((x) => (
                  <li key={x}>{tr(t, x)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t("What remains uncertain")}</h3>
            <StatusBadge kind="unknown" />
          </div>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
            {e.uncertain.map((x) => (
              <li key={x}>{tr(t, x)}</li>
            ))}
          </ul>
        </div>
      </div>

        </div>
      </details>

      {next && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/40 bg-(--status-verified-bg) p-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">{t("Next best action")}</p>
            <p className="mt-0.5 font-semibold">{t(next.task.title)}</p>
            <p className="text-sm text-muted-foreground">{t(next.task.supportNote)}</p>
          </div>
          <Button asChild>
            <Link href={next.task.next.href}>{t(next.task.next.label)}</Link>
          </Button>
        </div>
      )}

      <AiExplainer productRef={facts.ref} status={ai} commercial={commercial} />
    </section>
  );
}
