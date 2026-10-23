import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { FIT_LABEL, MATERIAL_NAMES, PROCESS_NAMES } from "@/lib/opportunities/engine";
import { AssessmentStrip, CommercialDimension, DimensionBox, RegulatoryDimension } from "@/components/opportunities/dimensions";
import { allItemIds, familyForEntry } from "@/lib/compliance/content";
import { evidenceForEntry } from "@/lib/trade/evidence";
import { fmtUsd } from "@/lib/trade/format";
import type { FitPart, MatchResult, Provenance } from "@/lib/opportunities/types";
import { getT } from "@/lib/i18n/server";
import { joinItems, tr, trUsd } from "@/lib/opportunities/localize";
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
export async function FitMeter({ score, level }: { score: number; level: MatchResult["level"] }) {
  const { t } = await getT();
  return (
    <div className="flex items-center gap-3" role="img" aria-label={t("Capability fit {score} out of 100: {label}", { score, label: t(FIT_LABEL[level]) })}>
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", level === "stretch" ? "bg-amber" : "bg-primary")} style={{ width: `${score}%` }} />
      </div>
      <span className="tnum text-sm">{score}/100</span>
    </div>
  );
}

/** `title` arrives already translated. The items are the engine's own sentences, translated here. */
export async function LabelledList({ title, items, badge }: { title: string; items: string[]; badge?: Provenance }) {
  if (items.length === 0) return null;
  const { t } = await getT();
  return (
    <div>
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
        {badge && <StatusBadge kind={PROVENANCE_BADGE[badge]} />}
      </div>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm marker:text-muted-foreground">
        {items.map((i) => (
          <li key={i}>{tr(t, i)}</li>
        ))}
      </ul>
    </div>
  );
}

export async function ScoreBreakdown({ parts }: { parts: FitPart[] }) {
  const { t } = await getT();
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{t("How the capability-fit score was calculated")}</caption>
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th scope="col" className="py-1 pr-3 font-medium">{t("Factor")}</th>
          <th scope="col" className="py-1 pr-3 font-medium">{t("Points")}</th>
          <th scope="col" className="py-1 font-medium">{t("What was found")}</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {parts.map((p) => (
          <tr key={p.key} className="align-top">
            <td className="py-1.5 pr-3 font-medium">{t(p.label)}</td>
            <td className="py-1.5 pr-3 tnum">
              {p.points}/{p.max}
            </td>
            <td className="py-1.5 text-muted-foreground">{tr(t, p.detail)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One suggested product. Four separate assessments, never merged into one score. */
export async function OpportunityCard({ m, href, scope }: { m: MatchResult; href: string; scope: string }) {
  const { t } = await getT();
  const e = m.entry;
  const ev = evidenceForEntry(e.id);
  const family = familyForEntry(e.id);
  const ids = family ? allItemIds(family) : [];
  const ref = href.split("/").pop() as string;
  return (
    <article className="flex flex-col rounded-lg border bg-card" aria-labelledby={`opp-${e.id}`}>
      <div className="border-b p-4 sm:p-5">
        <p className="text-xs font-medium text-primary">{t(e.group)}</p>
        <h3 id={`opp-${e.id}`} className="mt-0.5 text-lg font-semibold tracking-tight">
          {t(e.name)}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{t(e.summary)}</p>
        {m.putsToWork.length > 0 && (
          <p className="mt-3 inline-block rounded-sm border border-primary/30 bg-(--status-verified-bg) px-2 py-1 text-xs font-medium text-(--status-verified-fg)">
            {t("Puts your {list} capability to work: none of your current products uses it.", { list: joinItems(t, m.putsToWork.map((p) => PROCESS_NAMES[p].toLowerCase())) })}
          </p>
        )}
      </div>

      <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2">
        <DimensionBox title={t("Manufacturing fit")} status={`${t(FIT_LABEL[m.level])} · ${m.score}/100`} badge="inferred">
          <FitMeter score={m.score} level={m.level} />
          <ul className="list-disc space-y-0.5 pl-4">
            {m.reasons.slice(0, 3).map((r) => (
              <li key={r}>{tr(t, r)}</li>
            ))}
          </ul>
          <p className="pt-1 text-xs">
            {t("Capability only, from your declared machinery, processes and materials.")} <span className="font-medium text-foreground">{t("Unverified:")}</span> {t("that your moulds, tolerances and quality can meet a buyer's specification.")}
          </p>
        </DimensionBox>

        <DimensionBox title={t("Destination demand evidence")} status={ev.hasData ? t("Reported trade for broad headings") : ev.loaded ? t("No data") : t("Not loaded here")} badge={ev.hasData ? "reported" : "missing"} href={`/opportunities/${ref}?stage=4`} cta={t("See the evidence and its limits")}>
          {ev.hasData ? (
            <>
              {ev.headings.slice(0, 2).map((h) => (
                <p key={h.heading} className="text-xs">
                  <span className="tnum text-foreground">HS {h.heading}</span>: {t("destination-reported imports")} {h.latestUae ? `${trUsd(t, fmtUsd(h.latestUae.valueUsd))} (${h.latestUae.year})` : t("n/a")}
                </p>
              ))}
              <p className="text-xs">{t("Market evidence for a broad heading. Not demand for this product, buyer intent or a forecast.")}</p>
            </>
          ) : (
            <p>{ev.loaded ? t("No reported trade data for this product type.") : t("Trade evidence is not loaded in this deployment. No figure is shown or estimated.")}</p>
          )}
        </DimensionBox>

        <CommercialDimension scope={scope} assessmentRef={ref} />
        <RegulatoryDimension scope={scope} assessmentRef={ref} ids={ids} />
      </div>

      <div className="grid gap-5 border-t p-4 sm:p-5 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground">{t("What supports it on your side")}</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {e.processes.requiredAll.map((p) => (
              <Chip key={p} tone={m.matchedProcesses.includes(p) ? "have" : "gap"}>
                {t(PROCESS_NAMES[p])}
                {m.matchedProcesses.includes(p) ? " ✓" : ` · ${t("new")}`}
              </Chip>
            ))}
            {e.materials.preferred.map((c) => (
              <Chip key={c} tone={m.matchedMaterials.includes(c) ? "have" : "plain"}>
                {c}
                {m.matchedMaterials.includes(c) ? " ✓" : ""}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{t("Green means you declared it. {material} is the usual primary material.", { material: t(MATERIAL_NAMES[e.materials.preferred[0]]) })}</p>
          <h4 className="mt-3 text-xs font-semibold text-muted-foreground">{t("Tooling or equipment you may need")}</h4>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
            {e.tooling.map((x) => (
              <li key={x}>{t(x)}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground">{t("Customer industries that could use it")}</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {e.industries.map((i) => (
              <Chip key={i.name}>{t(i.name)}</Chip>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{t("Categories of buyer, a hypothesis to test. Not named companies and not confirmed demand.")}</p>
          {m.gaps.length > 0 && <LabelledList title={t("Gaps in your profile for this product")} items={m.gaps} badge="inferred" />}
          {m.optional.length > 0 && <LabelledList title={t("Optional or alternative (not required)")} items={m.optional} />}
          {m.guidance.purchasedInputs.length > 0 && <LabelledList title={t("Usually bought in")} items={m.guidance.purchasedInputs} />}
        </div>
      </div>

      <details className="border-t px-4 py-3 text-sm sm:px-5">
        <summary className="cursor-pointer font-medium">{t("Validations to plan, hypotheses to test and the score breakdown")}</summary>
        <div className="mt-3 grid gap-5 md:grid-cols-2">
          <LabelledList title={t("Validations to plan for")} items={e.validations} badge="inferred" />
          <LabelledList title={t("Why the destination market may be worth a look (hypotheses)")} items={e.whyUae} badge="inferred" />
        </div>
        <div className="mt-4 overflow-x-auto">
          <ScoreBreakdown parts={m.parts} />
        </div>
      </details>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 p-4 sm:px-5">
        <p className="max-w-md text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{m.confidence.level === "medium" ? t("Confidence in the fit: medium.") : t("Confidence in the fit: low.")}</span> {tr(t, m.confidence.why)}
        </p>
        <Button asChild>
          <Link href={href}>{t("Explore export potential")}</Link>
        </Button>
      </div>
    </article>
  );
}

/**
 * The answer first: what the product is, why it suits the factory, what is missing, the four assessments in one line each,
 * and one clear next step. Everything else (full assessments, score breakdown, tooling, validations) is one click away.
 */
export async function OpportunityRow({ m, href, scope }: { m: MatchResult; href: string; scope: string }) {
  const { t } = await getT();
  const e = m.entry;
  const ev = evidenceForEntry(e.id);
  const family = familyForEntry(e.id);
  const ids = family ? allItemIds(family) : [];
  const ref = href.split("/").pop() as string;
  const toConfirm = m.gaps[0] ? tr(t, m.gaps[0]) : t(e.tooling[0]);
  const idle = joinItems(t, m.putsToWork.map((p) => PROCESS_NAMES[p].toLowerCase()));
  return (
    <article className="rounded-lg border bg-card" aria-labelledby={`row-${e.id}`}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-2xl">
            <p className="text-xs font-medium tracking-[0.12em] text-primary">{t(e.group)}</p>
            <h3 id={`row-${e.id}`} className="mt-1 text-xl font-medium tracking-tight">
              {t(e.name)}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed">{m.reasons[0] ? tr(t, m.reasons[0]) : null}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("To confirm: {item}", { item: toConfirm })}</p>
            {m.putsToWork.length > 0 && <p className="mt-2 inline-block rounded-md bg-mint px-2.5 py-1 text-xs font-medium">{t("Puts your {list} capability to work", { list: idle })}</p>}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <FitMeter score={m.score} level={m.level} />
            <Button asChild className="h-10 px-4">
              <Link href={href}>{t("Explore this opportunity")}</Link>
            </Button>
          </div>
        </div>
        <AssessmentStrip scope={scope} assessmentRef={ref} ids={ids} fit={t(FIT_LABEL[m.level])} evidence={ev.hasData ? t("Reported trade data available") : ev.loaded ? t("No data for this type") : t("Not loaded here")} />
      </div>
      <details className="border-t">
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-primary sm:px-6 [&::-webkit-details-marker]:hidden">{t("See the full assessments and the score breakdown")}</summary>
        <div className="border-t p-3 sm:p-4">
          <OpportunityCard m={m} href={href} scope={scope} />
        </div>
      </details>
    </article>
  );
}
