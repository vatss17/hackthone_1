import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { FIT_LABEL, MATERIAL_NAMES, PROCESS_NAMES } from "@/lib/opportunities/engine";
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

/** One suggested product, with the reasoning shown, not hidden. */
export function OpportunityCard({ m, href }: { m: MatchResult; href: string }) {
  const e = m.entry;
  return (
    <article className="flex flex-col rounded-md border bg-card" aria-labelledby={`opp-${e.id}`}>
      <div className="border-b p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">{e.group}</p>
            <h3 id={`opp-${e.id}`} className="mt-0.5 text-lg font-semibold tracking-tight">
              {e.name}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <FitMeter score={m.score} level={m.level} />
            <span className="text-xs text-muted-foreground">{FIT_LABEL[m.level]}</span>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{e.summary}</p>
        {m.putsToWork.length > 0 && (
          <p className="mt-3 inline-block rounded-sm border border-primary/30 bg-(--status-verified-bg) px-2 py-1 text-xs font-medium text-(--status-verified-fg)">
            Puts your {m.putsToWork.map((p) => PROCESS_NAMES[p].toLowerCase()).join(" and ")} capability to work: none of your current products uses it.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StatusBadge kind="inferred" />
          <span className="text-xs text-muted-foreground">Capability fit from your profile.</span>
          <StatusBadge kind="missing" />
          <span className="text-xs text-muted-foreground">UAE demand not yet verified.</span>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-2">
        <LabelledList title="Why it matches your factory" items={m.reasons} badge="inferred" />
        <LabelledList title="Why look at the UAE" items={e.whyUae} badge="inferred" />
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Processes and materials</h4>
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
        </div>
        <LabelledList title="Extra tooling you may need" items={e.tooling} badge="inferred" />
        <LabelledList title="Validations to plan for" items={e.validations} badge="inferred" />
        {m.gaps.length > 0 && <LabelledList title="Gaps in your profile for this product" items={m.gaps} badge="inferred" />}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 p-4 sm:px-5">
        <p className="max-w-md text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Confidence: {m.confidence.level}.</span> {m.confidence.why}
        </p>
        <Button asChild>
          <Link href={href}>Explore export potential</Link>
        </Button>
      </div>
    </article>
  );
}
