import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { FIT_LABEL, MATERIAL_NAMES, PROCESS_NAMES } from "@/lib/opportunities/engine";
import { AssessmentStrip, CommercialDimension, DimensionBox, RegulatoryDimension } from "@/components/opportunities/dimensions";
import { allItemIds, familyForEntry } from "@/lib/compliance/content";
import { evidenceForEntry } from "@/lib/trade/evidence";
import { fmtUsd } from "@/lib/trade/format";
import type { FitPart, MatchResult, Provenance } from "@/lib/opportunities/types";
import { cn } from "@/lib/utils";

export const PROVENANCE_BADGE: Record<Provenance, StatusKind> = {
  user: "user",
  inferred: "inferred",
  illustrative: "demo",
  missing: "missing",
};

export function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "have" | "gap" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs",
        tone === "have" && "border-(--status-verified-border) bg-(--status-verified-bg) text-(--status-verified-fg)",
        tone === "gap" && "border-(--status-estimate-border) bg-(--status-estimate-bg) text-(--status-estimate-fg)",
        tone === "plain" && "border-border bg-muted text-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** Horizontal bar with the number in text, so colour is never the only signal. */
export function FitMeter({ score, level }: { score: number; level: MatchResult["level"] }) {
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`Capability fit ${score} out of 100: ${FIT_LABEL[level]}`}>
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", level === "stretch" ? "bg-amber" : "bg-primary")} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-sm tabular-nums">{score}/100</span>
    </div>
  );
}

export function LabelledList({ title, items, badge }: { title: string; items: string[]; badge?: Provenance }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        {badge && <StatusBadge kind={PROVENANCE_BADGE[badge]} />}
      </div>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm marker:text-muted-foreground">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

export function ScoreBreakdown({ parts }: { parts: FitPart[] }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">How the capability-fit score was calculated</caption>
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="py-1 pr-3 font-medium">Factor</th>
          <th className="py-1 pr-3 font-medium">Points</th>
          <th className="py-1 font-medium">What was found</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {parts.map((p) => (
          <tr key={p.key} className="align-top">
            <td className="py-1.5 pr-3 font-medium">{p.label}</td>
            <td className="py-1.5 pr-3 font-mono tabular-nums">
              {p.points}/{p.max}
            </td>
            <td className="py-1.5 text-muted-foreground">{p.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One suggested product. Four separate assessments, never merged into one score. */
export function OpportunityCard({ m, href, scope }: { m: MatchResult; href: string; scope: string }) {
  const e = m.entry;
  const ev = evidenceForEntry(e.id);
  const family = familyForEntry(e.id);
  const ids = family ? allItemIds(family) : [];
  const ref = href.split("/").pop() as string;
  return (
    <article className="flex flex-col rounded-md border bg-card" aria-labelledby={`opp-${e.id}`}>
      <div className="border-b p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">{e.group}</p>
        <h3 id={`opp-${e.id}`} className="mt-0.5 text-lg font-semibold tracking-tight">
          {e.name}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{e.summary}</p>
        {m.putsToWork.length > 0 && (
          <p className="mt-3 inline-block rounded-sm border border-primary/30 bg-(--status-verified-bg) px-2 py-1 text-xs font-medium text-(--status-verified-fg)">
            Puts your {m.putsToWork.map((p) => PROCESS_NAMES[p].toLowerCase()).join(" and ")} capability to work: none of your current products uses it.
          </p>
        )}
      </div>

      <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2">
        <DimensionBox title="Manufacturing fit" status={`${FIT_LABEL[m.level]} · ${m.score}/100`} badge="inferred">
          <FitMeter score={m.score} level={m.level} />
          <ul className="list-disc space-y-0.5 pl-4">
            {m.reasons.slice(0, 3).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="pt-1 text-xs">
            Capability only, from your declared machinery, processes and materials. <span className="font-medium text-foreground">Unverified:</span> that your moulds, tolerances and quality can meet a buyer&apos;s specification.
          </p>
        </DimensionBox>

        <DimensionBox title="UAE demand evidence" status={ev.hasData ? "Reported trade for broad headings" : ev.loaded ? "No data" : "Not loaded here"} badge={ev.hasData ? "reported" : "missing"} href={`/opportunities/${ref}?stage=4`} cta="See the evidence and its limits">
          {ev.hasData ? (
            <>
              {ev.headings.slice(0, 2).map((h) => (
                <p key={h.heading} className="text-xs">
                  <span className="font-mono text-foreground">HS {h.heading}</span>: UAE-reported imports {h.latestUae ? `${fmtUsd(h.latestUae.valueUsd)} (${h.latestUae.year})` : "n/a"}
                </p>
              ))}
              <p className="text-xs">Market evidence for a broad heading. Not demand for this product, buyer intent or a forecast.</p>
            </>
          ) : (
            <p>{ev.loaded ? "No reported trade data for this product type." : "Trade evidence is not loaded in this deployment. No figure is shown or estimated."}</p>
          )}
        </DimensionBox>

        <CommercialDimension scope={scope} assessmentRef={ref} />
        <RegulatoryDimension scope={scope} assessmentRef={ref} ids={ids} />
      </div>

      <div className="grid gap-5 border-t p-4 sm:p-5 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What supports it on your side</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {e.processes.requiredAll.map((p) => (
              <Chip key={p} tone={m.matchedProcesses.includes(p) ? "have" : "gap"}>
                {PROCESS_NAMES[p]}
                {m.matchedProcesses.includes(p) ? " ✓" : " · new"}
              </Chip>
            ))}
            {e.materials.preferred.map((c) => (
              <Chip key={c} tone={m.matchedMaterials.includes(c) ? "have" : "plain"}>
                {c}
                {m.matchedMaterials.includes(c) ? " ✓" : ""}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">Green means you declared it. {MATERIAL_NAMES[e.materials.preferred[0]]} is the usual primary material.</p>
          <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tooling or equipment you may need</h4>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
            {e.tooling.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">UAE customer industries that could use it</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {e.industries.map((i) => (
              <Chip key={i.name}>{i.name}</Chip>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">Categories of buyer, a hypothesis to test. Not named companies and not confirmed demand.</p>
          {m.gaps.length > 0 && <LabelledList title="Gaps in your profile for this product" items={m.gaps} badge="inferred" />}
        </div>
      </div>

      <details className="border-t px-4 py-3 text-sm sm:px-5">
        <summary className="cursor-pointer font-medium">Validations to plan, hypotheses to test and the score breakdown</summary>
        <div className="mt-3 grid gap-5 md:grid-cols-2">
          <LabelledList title="Validations to plan for" items={e.validations} badge="inferred" />
          <LabelledList title="Why the UAE may be worth a look (hypotheses)" items={e.whyUae} badge="inferred" />
        </div>
        <div className="mt-4 overflow-x-auto">
          <ScoreBreakdown parts={m.parts} />
        </div>
      </details>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 p-4 sm:px-5">
        <p className="max-w-md text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Confidence in the fit: {m.confidence.level}.</span> {m.confidence.why}
        </p>
        <Button asChild>
          <Link href={href}>Explore export potential</Link>
        </Button>
      </div>
    </article>
  );
}

/**
 * The answer first: what the product is, why it suits the factory, what is missing, the four assessments in one line each,
 * and one clear next step. Everything else (full assessments, score breakdown, tooling, validations) is one click away.
 */
export function OpportunityRow({ m, href, scope }: { m: MatchResult; href: string; scope: string }) {
  const e = m.entry;
  const ev = evidenceForEntry(e.id);
  const family = familyForEntry(e.id);
  const ids = family ? allItemIds(family) : [];
  const ref = href.split("/").pop() as string;
  const gap = m.gaps[0] ?? `Tooling to confirm: ${e.tooling[0]}`;
  return (
    <article className="rounded-xl border bg-card" aria-labelledby={`row-${e.id}`}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">{e.group}</p>
            <h3 id={`row-${e.id}`} className="mt-1 text-xl font-medium tracking-tight">
              {e.name}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed">{m.reasons[0]}</p>
            <p className="mt-1 text-sm text-muted-foreground">To confirm: {gap.replace(/^Tooling to confirm: /, "")}</p>
            {m.putsToWork.length > 0 && <p className="mt-2 inline-block rounded-md bg-mint px-2.5 py-1 text-xs font-medium">Puts your {m.putsToWork.map((p) => PROCESS_NAMES[p].toLowerCase()).join(" and ")} capability to work</p>}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <FitMeter score={m.score} level={m.level} />
            <Button asChild className="h-10 px-4">
              <Link href={href}>Explore this opportunity</Link>
            </Button>
          </div>
        </div>
        <AssessmentStrip scope={scope} assessmentRef={ref} ids={ids} fit={FIT_LABEL[m.level]} evidence={ev.hasData ? "Reported trade data available" : ev.loaded ? "No data for this type" : "Not loaded here"} />
      </div>
      <details className="border-t">
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-primary sm:px-6 [&::-webkit-details-marker]:hidden">See the full assessments and the score breakdown</summary>
        <div className="border-t p-3 sm:p-4">
          <OpportunityCard m={m} href={href} scope={scope} />
        </div>
      </details>
    </article>
  );
}
