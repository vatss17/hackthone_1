import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { DecisionBlockers } from "@/components/feasibility/decision-blockers";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { JourneyBar } from "@/components/journey-bar";
import { TradeEvidencePanel } from "@/components/evidence/trade-panel";
import { evidenceForEntry } from "@/lib/trade/evidence";
import { Chip, FitMeter, LabelledList } from "@/components/opportunities/parts";
import { CostSnapshot, ExecutiveSummaryCard, MissingAndNext, PrintButton, SixQuestions } from "@/components/feasibility/client-parts";
import { requireOrganization } from "@/lib/organization";
import { loadEngineInput } from "@/lib/capabilities";
import { resolveSubject } from "@/lib/subject";
import { matchEntry, FIT_LABEL } from "@/lib/opportunities/engine";
import { sampleInputs } from "@/lib/landed-cost/defaults";
import { getT } from "@/lib/i18n/server";
import { tr } from "@/lib/opportunities/localize";
import { ALL_SECTIONS, allItemIds, familyForEntry, itemsFor, EVIDENCE_ORDER, type Evidence } from "@/lib/compliance/content";

export const metadata: Metadata = { title: "Export feasibility · Atlas" };
export const instant = false;


export default async function FeasibilityPage({ params }: PageProps<"/feasibility/[ref]">) {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const { ref } = await params;
  const standalone = ref === "standalone";
  const subject = standalone ? null : await resolveSubject(organization.id, ref);
  if (!standalone && !subject) notFound();

  const wf = await loadWorkspaceFacts(organization, standalone ? "standalone" : ref);
  const { input } = await loadEngineInput(organization.id);
  const entry = subject?.entry ?? null;
  const match = entry ? matchEntry(entry, input) : null;
  const family = familyForEntry(entry?.id);
  const defaults = sampleInputs(subject ? { ...subject.facts, label: subject.name } : undefined);
  const ids = family ? allItemIds(family) : [];
  const name = subject?.name ?? t("Standalone assessment");
  const shared = { scope: organization.id, assessmentRef: standalone ? "standalone" : ref, defaults };

  const counts = new Map<Evidence, number>();
  if (family) for (const s of ALL_SECTIONS) for (const it of itemsFor(family, s)) counts.set(it.evidence, (counts.get(it.evidence) ?? 0) + 1);
  const taxQuestions = family ? [...itemsFor(family, "cepa"), ...itemsFor(family, "schemes")] : [];

  return (
    <>
      <PageHeader
        eyebrow={t("Export feasibility")}
        title={subject ? t("{name}: first-pass export feasibility", { name: subject.name }) : t("Standalone export feasibility")}
        description={t("Manufacturing fit, landed cost, market, gaps and open questions in one place, with what is known, assumed and missing kept apart.")}
        action={<PrintButton />}
      />
      <JourneyBar current="feasibility" reference={standalone ? null : ref} />

      <ExecutiveSummaryCard {...shared} fit={match?.level ?? null} />
      <DecisionBlockers scope={organization.id} facts={wf.facts} defaults={wf.defaults} />
      <SixQuestions {...shared} fit={match?.level ?? null} fitScore={match?.score ?? null} productRef={standalone ? "standalone" : ref} checksTotal={ids.length} hasProduct={!standalone} />

      <details className="mt-8 rounded-lg border bg-card/60 px-4 py-3 sm:px-6" id="detail">
        <summary className="cursor-pointer text-base font-medium">{t("Supporting detail: capability, cost, market evidence, gaps, regulation and incentives")}</summary>
        <div className="-mt-2">
      {/* ---------------- capability ---------------- */}
      <section className="mt-10" aria-labelledby="cap-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="cap-h" className="text-lg font-semibold tracking-tight">
            {t("Manufacturing capability fit")}
          </h2>
          <StatusBadge kind={match ? "inferred" : "missing"} />
        </div>
        {match ? (
          <div className="mt-3 rounded-lg border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FitMeter score={match.score} level={match.level} />
              <span className="text-sm font-medium">{t(FIT_LABEL[match.level])}</span>
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <LabelledList title={t("Why it matches your factory")} items={match.reasons.length ? match.reasons : [t("No declared capability lines up with this product yet.")]} />
              <LabelledList title={t("Gaps to close")} items={match.gaps.length ? match.gaps : [t("No gaps found in the declared profile.")]} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {match.confidence.level === "medium" ? t("Confidence: medium.") : t("Confidence: low.")} {tr(t, match.confidence.why)}{" "}
              <Link href={`/opportunities/${ref}#match`} className="font-medium text-primary underline-offset-4 hover:underline">
                {t("See the score breakdown")}
              </Link>
            </p>
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-dashed border-input/60 bg-card px-4 py-3 text-sm text-muted-foreground">
            {standalone ? t("A standalone assessment is not tied to a product, so there is no manufacturing fit to show.") : t("There is no rules profile for this product type, so no capability score is shown.")}
          </p>
        )}
      </section>

      <CostSnapshot {...shared} productRef={standalone ? "standalone" : ref} hasProduct={!standalone} />

      {/* ---------------- market ---------------- */}
      <section className="mt-10" aria-labelledby="mkt-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="mkt-h" className="text-lg font-semibold tracking-tight">
            {t("Market evidence")}
          </h2>
          <StatusBadge kind="reported" />
        </div>
        <div className="mt-3 space-y-4">
          {entry && (
            <div className="rounded-lg border bg-card p-4 sm:p-5">
              <div className="grid gap-5 md:grid-cols-2">
                <LabelledList title={t("Why it may be worth investigating (hypotheses)")} items={entry.whyUae.map((x) => t(x))} />
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground">{t("Buyer industries (categories, not companies)")}</h4>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {entry.industries.map((x) => (
                      <Chip key={x.name}>{t(x.name)}</Chip>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          <TradeEvidencePanel evidence={evidenceForEntry(entry?.id)} />
        </div>
      </section>

      {/* ---------------- gaps ---------------- */}
      {entry && (
        <section className="mt-10" aria-labelledby="gap-h">
          <div className="flex items-center justify-between gap-2">
            <h2 id="gap-h" className="text-lg font-semibold tracking-tight">
              {t("Potential manufacturing gaps")}
            </h2>
            <StatusBadge kind="inferred" />
          </div>
          <div className="mt-3 grid gap-5 rounded-lg border bg-card p-4 sm:p-5 md:grid-cols-3">
            <LabelledList title={t("From your profile")} items={match?.gaps.length ? match.gaps : [t("None found.")]} />
            <LabelledList title={t("Tooling to plan for")} items={entry.tooling} />
            <LabelledList title={t("Validations to plan for")} items={entry.validations} />
          </div>
        </section>
      )}

      {/* ---------------- compliance ---------------- */}
      <section className="mt-10" aria-labelledby="comp-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="comp-h" className="text-lg font-semibold tracking-tight">
            {t("Preliminary compliance considerations")}
          </h2>
          <StatusBadge kind="unknown" />
        </div>
        <div className="mt-3 rounded-lg border bg-card p-4 sm:p-5">
          {family ? (
            <>
              <p className="text-sm">
                <span className="font-medium">{t(family.name)}.</span> {t("{count} screening questions across Indian export checks, Destination import checks, testing, packaging, classification, CEPA origin and export schemes.", { count: ids.length })}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                {EVIDENCE_ORDER.filter((e) => counts.get(e)).map((e) => (
                  <li key={e} className="flex items-center gap-1.5">
                    <StatusBadge kind={e} />
                    <span className="tnum">{counts.get(e)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">{t("None of these has been verified against a primary official source. They are questions to settle, not requirements.")}</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href={`/compliance?product=${ref}`}>{t("Work through the screening questions")}</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("No product-family screening is available here. See the")}{" "}
              <Link href={standalone ? "/compliance" : `/compliance?product=${ref}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {t("general screening page")}
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      {/* ---------------- tariff and incentives ---------------- */}
      <section className="mt-10" aria-labelledby="tax-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="tax-h" className="text-lg font-semibold tracking-tight">
            {t("Tariff and incentive questions")}
          </h2>
          <StatusBadge kind="unknown" />
        </div>
        <div className="mt-3 rounded-lg border bg-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">{t("Eligibility for CEPA preference or any Indian scheme is not determined by this platform, and the calculator treats the preferential-duty scenario as a what-if only.")}</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
            {(taxQuestions.length ? taxQuestions.slice(0, 5) : []).map((q) => (
              <li key={q.id}>{t(q.text)}</li>
            ))}
            {taxQuestions.length === 0 && <li>{t("Which duty rate and which preferences could apply to this product?")}</li>}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={standalone ? "/schemes" : `/schemes?product=${ref}`}>{t("CEPA and incentives")}</Link>
            </Button>
          </div>
        </div>
      </section>

        </div>
      </details>

      <MissingAndNext {...shared} productRef={standalone ? "standalone" : ref} hasProduct={!standalone} hsClaimed={subject?.hsClaimed ?? false} capabilityGaps={match?.gaps.length ?? 0} checksTotal={ids.length} />

      <p className="mt-10 border-t pt-4 text-xs text-muted-foreground">
        {t("This is a first-pass assessment built from information you provided, rule-based inferences and clearly labelled assumptions. It is not a regulatory approval, a legal or tax opinion, or a forecast of profit.")} {name}
      </p>
    </>
  );
}
