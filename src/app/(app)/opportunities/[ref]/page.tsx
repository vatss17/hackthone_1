import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { TradeEvidencePanel } from "@/components/evidence/trade-panel";
import { ProductExplanationPanel } from "@/components/explain/product-explanation";
import { evidenceForEntry } from "@/lib/trade/evidence";
import { aiStatus } from "@/lib/ai/provider";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { StatusBadge } from "@/components/status-badge";
import { Chip, FitMeter, LabelledList, ScoreBreakdown } from "@/components/opportunities/parts";
import { requireOrganization } from "@/lib/organization";
import { getProductDetail, loadEngineInput, type ProductDetail } from "@/lib/capabilities";
import { isUuid } from "@/lib/factory-validation";
import { CATALOGUE_BY_ID, COMMON_CONSIDERATIONS } from "@/lib/opportunities/catalogue";
import { FIT_LABEL, MATERIAL_NAMES, PROCESS_NAMES, matchEntry, recognise } from "@/lib/opportunities/engine";
import type { CatalogueEntry, MatchResult } from "@/lib/opportunities/types";

export const metadata: Metadata = { title: "Explore export potential · Export Enablement Platform" };
export const instant = false;

const EFFORT_LABEL = { lighter: "lighter", moderate: "moderate", heavier: "heavier" } as const;

function Panel({ id, title, badges, children }: { id: string; title: string; badges?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8 rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <h2 id={id} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        <div className="flex flex-wrap gap-1.5">{badges}</div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function verdict(match: MatchResult | null): { headline: string; text: string } {
  if (!match) return { headline: "Not enough information to judge", text: "There is no rules profile for this product type yet. Use the steps below to investigate it." };
  if (match.level === "stretch") return { headline: "A stretch: needs a process you have not declared", text: "Worth understanding, but it would depend on new capability. Not recommended as a first export." };
  if (match.level === "possible") return { headline: "Possible, with gaps to close", text: "Some of your capabilities line up. Close the gaps listed below before investing time in it." };
  return { headline: "Worth investigating", text: "Your declared capabilities line up well. That is the only thing assessed so far." };
}

export default async function ExplorePage({ params }: PageProps<"/opportunities/[ref]">) {
  const { organization } = await requireOrganization();
  const { ref } = await params;

  let entry: CatalogueEntry | null = null;
  let product: ProductDetail | null = null;
  if (CATALOGUE_BY_ID[ref]) {
    entry = CATALOGUE_BY_ID[ref];
  } else if (isUuid(ref)) {
    product = await getProductDetail(organization.id, ref);
    if (!product) notFound();
    entry = recognise({ name: product.name, category: product.category, description: product.description });
  } else {
    notFound();
  }

  const { input } = await loadEngineInput(organization.id);
  const wf = await loadWorkspaceFacts(organization, ref);
  const match = entry ? matchEntry(entry, input) : null;
  const v = verdict(match);
  const title = product?.name ?? entry!.name;

  return (
    <>
      <PageHeader
        eyebrow="Product exploration"
        title={title}
        description={product ? "One of your products. This page shows what is known, what is inferred and what is still missing about taking it to the UAE." : "A product your factory could plausibly make. This page shows what is inferred and what is still missing about taking it to the UAE."}
        action={
          <Button asChild variant="outline">
            <Link href="/opportunities">All opportunities</Link>
          </Button>
        }
      />

      <JourneyBar current="explore" reference={ref} />

      <div className="mt-6 rounded-md border border-primary/30 bg-(--status-verified-bg) p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Export feasibility status</p>
        <p className="mt-1 text-lg font-semibold tracking-tight">{v.headline}</p>
        <p className="mt-1 max-w-2xl text-sm">
          {v.text} <span className="font-medium">Overall: not yet validated.</span> Demand, cost, compliance and incentives have not been assessed.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <StatusBadge kind={product ? "user" : "inferred"} />
          <span className="text-xs text-muted-foreground">{product ? "Your own product." : "Suggested from your capabilities."}</span>
        </div>
      </div>

      <div className="mt-8">
        <ProductExplanationPanel scope={organization.id} facts={wf.facts} defaults={wf.defaults} entry={wf.entry} match={wf.match} ai={aiStatus(process.env)} evidence={evidenceForEntry(wf.entry?.id)} />
      </div>

      {/* ---------------- overview ---------------- */}
      <Panel id="overview" title="Product overview" badges={<StatusBadge kind={product ? "user" : "inferred"} />}>
        {product ? (
          <div className="space-y-3 text-sm">
            <p className="whitespace-pre-line">{product.description ?? "No description provided."}</p>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <div>
                <dt className="inline text-muted-foreground">Category: </dt>
                <dd className="inline">{product.category ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground">Intended use: </dt>
                <dd className="inline">{product.intendedUse ?? "Not provided"}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground">Made at: </dt>
                <dd className="inline">{product.factories.map((f) => f.name).join(", ") || "Not linked to a factory"}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground">HS code (claimed): </dt>
                <dd className="inline">{product.hsCodeClaimed ? `${product.hsCodeClaimed}, unverified` : "Not provided"}</dd>
              </div>
            </dl>
            {product.specs.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {product.specs.map((s) => (
                  <Chip key={s.id}>
                    {s.name}: {s.value}
                    {s.unit ? ` ${s.unit}` : ""}
                  </Chip>
                ))}
              </ul>
            )}
            {entry && (
              <p className="text-muted-foreground">
                Recognised as <span className="font-medium text-foreground">{entry.name.toLowerCase()}</span>, so the guidance below uses that product type. If that is wrong, treat the type-specific sections with caution.
              </p>
            )}
            <Link href={`/products/${product.id}`} className="inline-block font-medium text-primary underline-offset-4 hover:underline">
              Edit product details
            </Link>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p>{entry!.summary}</p>
            <p className="text-muted-foreground">
              Product family: {entry!.group}. Typical size: {entry!.sizeClass}. Usual materials: {entry!.materials.preferred.map((m) => MATERIAL_NAMES[m]).join(", ")}.
            </p>
          </div>
        )}
      </Panel>

      {/* ---------------- capability match ---------------- */}
      <Panel id="match" title="Capability match" badges={<StatusBadge kind="inferred" />}>
        {match ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FitMeter score={match.score} level={match.level} />
              <span className="text-sm font-medium">{FIT_LABEL[match.level]}</span>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <LabelledList title="Why it matches your factory" items={match.reasons.length ? match.reasons : ["No declared capability lines up with this product yet."]} />
              <LabelledList title="Gaps in your profile for this product" items={match.gaps} />
            </div>
            <div className="overflow-x-auto">
              <ScoreBreakdown parts={match.parts} />
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Confidence: {match.confidence.level}.</span> {match.confidence.why}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            There is no rules profile for this product type yet, so no capability score is shown. Nothing here implies the product cannot be made or exported.
          </p>
        )}
      </Panel>

      {/* ---------------- UAE summary ---------------- */}
      <Panel id="uae" title="UAE market evidence" badges={<><StatusBadge kind="reported" /><StatusBadge kind="inferred" /></>}>
        <div className="space-y-5">
          {entry && <LabelledList title="Why it may be worth investigating (hypotheses to test)" items={entry.whyUae} />}
          <TradeEvidencePanel evidence={evidenceForEntry(entry?.id)} />
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What this evidence cannot tell you</h4>
            <ul className="mt-2 divide-y rounded-md border">
              {[
                "Whether buyers would pay your price after freight and duty",
                "Which countries compete in your exact product, and at what unit prices",
                "The duty and tax treatment for your tariff line",
                "Whether your product would meet UAE technical requirements",
              ].map((t) => (
                <li key={t} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>{t}</span>
                  <StatusBadge kind="missing" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      {/* ---------------- buyers ---------------- */}
      <Panel id="buyers" title="Potential buyers and applications by industry" badges={<StatusBadge kind="inferred" />}>
        {entry ? (
          <>
            <ul className="grid gap-3 sm:grid-cols-3">
              {entry.industries.map((i) => (
                <li key={i.name} className="rounded-md border p-3">
                  <h3 className="text-sm font-semibold">{i.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{i.applications}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">These are categories of buyer, not named companies. Finding actual buyers is outside this platform.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Industries and applications have not been worked out for this product type yet.</p>
        )}
      </Panel>

      {/* ---------------- production gaps ---------------- */}
      <Panel id="gaps" title="Potential production gaps" badges={<StatusBadge kind="inferred" />}>
        {entry ? (
          <div className="grid gap-5 md:grid-cols-3">
            <LabelledList title="From your profile" items={match?.gaps.length ? match.gaps : ["No gaps found in the declared profile."]} />
            <LabelledList title="Tooling this product may need" items={entry.tooling} />
            <LabelledList title="Validations to plan for" items={entry.validations} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Typical tooling and validation needs are not available for this product type yet.</p>
        )}
      </Panel>

      {/* ---------------- regulatory ---------------- */}
      <Panel id="regulatory" title="Preliminary regulatory considerations" badges={<StatusBadge kind="missing" />}>
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          These are topics to check, not findings. Nothing has been checked against official UAE or GCC sources, and no requirement is confirmed. A compliance review would settle each one.
        </p>
        <ul className="mt-4 divide-y rounded-md border">
          {[...(entry?.regulatoryFocus.map((t) => ({ topic: t, note: "Applicability to this product has not been assessed." })) ?? []), ...COMMON_CONSIDERATIONS].map((c) => (
            <li key={c.topic} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4">
              <p className="text-sm font-medium">{c.topic}</p>
              <p className="text-sm text-muted-foreground">{c.note}</p>
            </li>
          ))}
        </ul>
        {entry && (
          <p className="mt-3 text-sm text-muted-foreground">
            Rule-of-thumb qualification effort for this kind of product: <span className="font-medium text-foreground">{EFFORT_LABEL[entry.qualificationEffort]}</span> <StatusBadge kind="inferred" />. This is a planning guess, not a regulatory finding.
          </p>
        )}
      </Panel>

      {/* ---------------- status table and next step ---------------- */}
      <Panel id="status" title="Where this product stands on the export journey">
        <ul className="divide-y rounded-md border">
          {[
            { label: "Capability fit", badge: <StatusBadge kind={match ? "inferred" : "missing"} />, text: match ? FIT_LABEL[match.level] : "Not assessed", href: null as string | null },
            { label: "UAE demand and competition", badge: <StatusBadge kind="missing" />, text: "Verified trade data not connected", href: null },
            { label: "Landed cost and margin", badge: <StatusBadge kind="estimate" />, text: "Calculator available", href: `/viability?product=${ref}` },
            { label: "Compliance and testing", badge: <StatusBadge kind="unknown" />, text: "Screening questions available", href: `/compliance?product=${ref}` },
            { label: "CEPA and incentives", badge: <StatusBadge kind="unknown" />, text: "Screening questions available", href: `/schemes?product=${ref}` },
            { label: "Export feasibility", badge: <StatusBadge kind="inferred" />, text: "Combined first assessment", href: `/feasibility/${ref}` },
            { label: "Export documents", badge: <StatusBadge kind="planned" />, text: "Preview available", href: "/documentation" },
          ].map((r) => (
            <li key={r.label} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                {r.text}
                {r.badge}
                {r.href && (
                  <Link href={r.href} className="font-medium text-primary underline-offset-4 hover:underline">
                    Open
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="h-10">
            <Link href={`/viability?product=${ref}`}>Continue to landed-cost assessment</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-10">
            <Link href={`/feasibility/${ref}`}>Open export feasibility</Link>
          </Button>
        </div>
        {match && match.entry.processes.requiredAll.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            Needs {match.entry.processes.requiredAll.map((p) => PROCESS_NAMES[p].toLowerCase()).join(" and ")}. The calculator starts from sample values you replace with your own.
          </p>
        )}
      </Panel>
    </>
  );
}
