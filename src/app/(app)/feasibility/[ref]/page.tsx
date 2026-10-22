import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { JourneyBar } from "@/components/journey-bar";
import { Chip, FitMeter, LabelledList } from "@/components/opportunities/parts";
import { CostSnapshot, ExecutiveSummaryCard, MissingAndNext, PrintButton, SixQuestions } from "@/components/feasibility/client-parts";
import { requireOrganization } from "@/lib/organization";
import { loadEngineInput } from "@/lib/capabilities";
import { resolveSubject } from "@/lib/subject";
import { matchEntry, FIT_LABEL } from "@/lib/opportunities/engine";
import { sampleInputs } from "@/lib/landed-cost/defaults";
import { ALL_SECTIONS, allItemIds, familyForEntry, itemsFor, EVIDENCE_ORDER, type Evidence } from "@/lib/compliance/content";

export const metadata: Metadata = { title: "Export feasibility · Export Enablement Platform" };
export const instant = false;

const DEMAND = { broad: "Broad", moderate: "Moderate", niche: "Niche" } as const;

export default async function FeasibilityPage({ params }: PageProps<"/feasibility/[ref]">) {
  const { organization } = await requireOrganization();
  const { ref } = await params;
  const standalone = ref === "standalone";
  const subject = standalone ? null : await resolveSubject(organization.id, ref);
  if (!standalone && !subject) notFound();

  const { input } = await loadEngineInput(organization.id);
  const entry = subject?.entry ?? null;
  const match = entry ? matchEntry(entry, input) : null;
  const family = familyForEntry(entry?.id);
  const defaults = sampleInputs(subject ? { ...subject.facts, label: subject.name } : undefined);
  const ids = family ? allItemIds(family) : [];
  const name = subject?.name ?? "Standalone assessment";
  const shared = { scope: organization.id, assessmentRef: standalone ? "standalone" : ref, defaults };

  const counts = new Map<Evidence, number>();
  if (family) for (const s of ALL_SECTIONS) for (const it of itemsFor(family, s)) counts.set(it.evidence, (counts.get(it.evidence) ?? 0) + 1);
  const taxQuestions = family ? [...itemsFor(family, "cepa"), ...itemsFor(family, "schemes")] : [];

  return (
    <>
      <PageHeader
        eyebrow="Export feasibility"
        title={subject ? `${subject.name}: first-pass export feasibility` : "Standalone export feasibility"}
        description="Manufacturing fit, landed cost, market, gaps and open questions in one place, with what is known, assumed and missing kept apart."
        action={<PrintButton />}
      />
      <JourneyBar current="feasibility" reference={standalone ? null : ref} />

      <ExecutiveSummaryCard {...shared} fit={match?.level ?? null} />
      <SixQuestions {...shared} fit={match?.level ?? null} fitScore={match?.score ?? null} productRef={standalone ? "standalone" : ref} checksTotal={ids.length} hasProduct={!standalone} />

      {/* ---------------- capability ---------------- */}
      <section className="mt-10" aria-labelledby="cap-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="cap-h" className="text-lg font-semibold tracking-tight">
            Manufacturing capability fit
          </h2>
          <StatusBadge kind={match ? "inferred" : "missing"} />
        </div>
        {match ? (
          <div className="mt-3 rounded-md border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FitMeter score={match.score} level={match.level} />
              <span className="text-sm font-medium">{FIT_LABEL[match.level]}</span>
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <LabelledList title="Why it matches your factory" items={match.reasons.length ? match.reasons : ["No declared capability lines up with this product yet."]} />
              <LabelledList title="Gaps to close" items={match.gaps.length ? match.gaps : ["No gaps found in the declared profile."]} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Confidence: {match.confidence.level}. {match.confidence.why}{" "}
              <Link href={`/opportunities/${ref}#match`} className="font-medium text-primary underline-offset-4 hover:underline">
                See the score breakdown
              </Link>
            </p>
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-dashed border-input/60 bg-card px-4 py-3 text-sm text-muted-foreground">
            {standalone ? "A standalone assessment is not tied to a product, so there is no manufacturing fit to show." : "There is no rules profile for this product type, so no capability score is shown."}
          </p>
        )}
      </section>

      <CostSnapshot {...shared} productRef={standalone ? "standalone" : ref} hasProduct={!standalone} />

      {/* ---------------- market ---------------- */}
      <section className="mt-10" aria-labelledby="mkt-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="mkt-h" className="text-lg font-semibold tracking-tight">
            UAE market opportunity summary
          </h2>
          <div className="flex gap-1.5">
            <StatusBadge kind="inferred" />
            <StatusBadge kind="demo" />
          </div>
        </div>
        {entry ? (
          <div className="mt-3 rounded-md border bg-card p-4 sm:p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <LabelledList title="Why it may be worth investigating" items={entry.whyUae} />
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buyer industries (categories, not companies)</h4>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {entry.industries.map((x) => (
                    <Chip key={x.name}>{x.name}</Chip>
                  ))}
                </ul>
                <p className="mt-3 flex items-center gap-2 text-sm">
                  <StatusBadge kind="demo" />
                  Illustrative demand signal: {DEMAND[entry.demandSignal]}. A placeholder, not market data.
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Verified UAE import volumes, supplier countries and price levels are not connected, so nothing here tests your selling price against the market.</p>
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-dashed border-input/60 bg-card px-4 py-3 text-sm text-muted-foreground">No market view is available without a product type. UAE demand data is not connected in any case.</p>
        )}
      </section>

      {/* ---------------- gaps ---------------- */}
      {entry && (
        <section className="mt-10" aria-labelledby="gap-h">
          <div className="flex items-center justify-between gap-2">
            <h2 id="gap-h" className="text-lg font-semibold tracking-tight">
              Potential manufacturing gaps
            </h2>
            <StatusBadge kind="inferred" />
          </div>
          <div className="mt-3 grid gap-5 rounded-md border bg-card p-4 sm:p-5 md:grid-cols-3">
            <LabelledList title="From your profile" items={match?.gaps.length ? match.gaps : ["None found."]} />
            <LabelledList title="Tooling to plan for" items={entry.tooling} />
            <LabelledList title="Validations to plan for" items={entry.validations} />
          </div>
        </section>
      )}

      {/* ---------------- compliance ---------------- */}
      <section className="mt-10" aria-labelledby="comp-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="comp-h" className="text-lg font-semibold tracking-tight">
            Preliminary compliance considerations
          </h2>
          <StatusBadge kind="unknown" />
        </div>
        <div className="mt-3 rounded-md border bg-card p-4 sm:p-5">
          {family ? (
            <>
              <p className="text-sm">
                <span className="font-medium">{family.name}.</span> {ids.length} screening questions across Indian export checks, UAE import checks, testing, packaging, classification, CEPA origin and export schemes.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                {EVIDENCE_ORDER.filter((e) => counts.get(e)).map((e) => (
                  <li key={e} className="flex items-center gap-1.5">
                    <StatusBadge kind={e} />
                    <span className="font-mono tabular-nums">{counts.get(e)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">None of these has been verified against a primary official source. They are questions to settle, not requirements.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href={`/compliance?product=${ref}`}>Work through the screening questions</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No product-family screening is available here. See the{" "}
              <Link href="/compliance" className="font-medium text-primary underline-offset-4 hover:underline">
                general screening page
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
            Tariff and incentive questions
          </h2>
          <StatusBadge kind="unknown" />
        </div>
        <div className="mt-3 rounded-md border bg-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Eligibility for CEPA preference or any Indian scheme is not determined by this platform, and the calculator treats the preferential-duty scenario as a what-if only.</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
            {(taxQuestions.length ? taxQuestions.slice(0, 5) : []).map((q) => (
              <li key={q.id}>{q.text}</li>
            ))}
            {taxQuestions.length === 0 && <li>Which duty rate and which preferences could apply to this product?</li>}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={standalone ? "/schemes" : `/schemes?product=${ref}`}>CEPA and incentives</Link>
            </Button>
          </div>
        </div>
      </section>

      <MissingAndNext {...shared} productRef={standalone ? "standalone" : ref} hasProduct={!standalone} hsClaimed={subject?.hsClaimed ?? false} capabilityGaps={match?.gaps.length ?? 0} checksTotal={ids.length} />

      <p className="mt-10 border-t pt-4 text-xs text-muted-foreground">
        This is a first-pass assessment built from information you provided, rule-based inferences and clearly labelled assumptions. It is not a regulatory approval, a legal or tax opinion, or a forecast of profit. {name}
      </p>
    </>
  );
}
