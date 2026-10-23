import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { TradeEvidencePanel } from "@/components/evidence/trade-panel";
import { ProductExplanationPanel } from "@/components/explain/product-explanation";
import { evidenceForEntry } from "@/lib/trade/evidence";
import { aiStatus } from "@/lib/ai/provider";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { StatusBadge } from "@/components/status-badge";
import { Flash } from "@/components/profile/form-bits";
import { HsHelper } from "@/components/classification/hs-helper";
import { CommercialDimension } from "@/components/opportunities/dimensions";
import { Chip, FitMeter, LabelledList, ScoreBreakdown } from "@/components/opportunities/parts";
import { requireOrganization } from "@/lib/organization";
import { getProductDetail, loadEngineInput, type ProductDetail } from "@/lib/capabilities";
import { isUuid } from "@/lib/factory-validation";
import { CATALOGUE_BY_ID, COMMON_CONSIDERATIONS } from "@/lib/opportunities/catalogue";
import { FIT_LABEL, MATERIAL_NAMES, matchEntry, recognise } from "@/lib/opportunities/engine";
import type { CatalogueEntry, MatchResult } from "@/lib/opportunities/types";
import { getT } from "@/lib/i18n/server";
import { tr } from "@/lib/opportunities/localize";

export const metadata: Metadata = { title: "Explore export potential · Atlas" };
export const instant = false;

function Block({ id, title, badges, children }: { id?: string; title: string; badges?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-label={title} className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        <div className="flex flex-wrap gap-1.5">{badges}</div>
      </div>
      {children}
    </section>
  );
}

const STAGES = [
  { n: 1, short: "Product", title: "Your starting point", lead: "What the product is, why it suits your factory, and what is still uncertain." },
  { n: 2, short: "Details", title: "Confirm the product and its specifications", lead: "The better these are, the better the guidance. Anything missing is listed, and you can add it later." },
  { n: 3, short: "Classification", title: "Find the right product code", lead: "The HS/HSN code decides duty, rules of origin and which requirements apply." },
  { n: 4, short: "Market evidence", title: "What the evidence says about the destination market", lead: "Five plain questions, answered with what is actually available, and honest about what is not." },
  { n: 5, short: "Economics", title: "Would it pay?", lead: "Landed cost, price and margin, with every assumption yours to change." },
  { n: 6, short: "Next steps", title: "What is still unknown, and what to do next", lead: "The few things to settle first, what you can do now and what needs an expert." },
] as const;

function verdict(match: MatchResult | null): { headline: string; text: string } {
  if (!match) return { headline: "Not enough information to judge", text: "There is no rules profile for this product type yet. Use the steps below to investigate it." };
  if (match.level === "stretch") return { headline: "A stretch: needs a process you have not declared", text: "Worth understanding, but it would depend on new capability. Not recommended as a first export." };
  if (match.level === "possible") return { headline: "Possible, with gaps to close", text: "Some of your capabilities line up. Close the gaps listed below before investing time in it." };
  return { headline: "Worth investigating", text: "Your declared capabilities line up well. That is the only thing assessed so far." };
}

export default async function ExplorePage({ params, searchParams }: PageProps<"/opportunities/[ref]">) {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const [{ ref }, sp] = await Promise.all([params, searchParams]);

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
  const ev = evidenceForEntry(entry?.id);
  const stage = typeof sp.stage === "string" && /^[1-6]$/.test(sp.stage) ? Number(sp.stage) : 1;
  const meta = STAGES[stage - 1];
  const here = `/opportunities/${ref}`;
  const regTopics = [...(entry?.regulatoryFocus.map((topic) => ({ topic, note: "Applicability to this product has not been assessed." })) ?? []), ...COMMON_CONSIDERATIONS].map((c) => ({ topic: t(c.topic), note: t(c.note) }));
  const uaeHeadings = ev.headings;

  const questions: { q: string; a: string; note?: string }[] = [
    {
      q: t("Is there evidence of destination imports of this product category?"),
      a: ev.hasData ? (uaeHeadings.length > 1 ? t("Yes, for the broad headings {headings}. See the figures below. A heading covers many products, so this shows that trade exists, not that your product sells.", { headings: uaeHeadings.map((h) => h.heading).join(", ") }) : t("Yes, for the broad heading {headings}. See the figures below. A heading covers many products, so this shows that trade exists, not that your product sells.", { headings: uaeHeadings.map((h) => h.heading).join(", ") })) : ev.loaded ? t("Nothing reported for this product type in the loaded data.") : t("Not available here. Reported import figures are not loaded in this deployment, and none are estimated."),
    },
    {
      q: t("What historical India-to-destination exports are reported?"),
      a: ev.hasData && uaeHeadings.some((h) => h.latestIndia) ? t("India reports exports to the destination market under the same headings (see the figures). It is India's own record, valued differently from the destination market's, so the two are shown side by side and never subtracted.") : t("Not available here. India-reported figures are not loaded in this deployment."),
    },
    {
      q: t("Is a comparable approximate unit value supported by valid data?"),
      a: t("No unit value is shown. The data gives total value and weight for a whole heading, and dividing them gives an average across everything in it, which says little about the price of your product. A real price needs quotes or buyer enquiries."),
    },
    {
      q: t("What does this tell you, and what does it not?"),
      a: t("It can show that a category is traded and roughly how large and steady the trade is. It cannot show demand for your product, who would buy it, at what price, after what duty, or whether it meets destination requirements."),
    },
    {
      q: t("What next step would improve confidence?"),
      a: ev.hasData ? t("Confirm your product code in the previous step so the figures narrow from a broad heading to your tariff line, then test price with two or three importers or distributors.") : t("Obtain licensed trade data for your heading, or ask an expert or trade body for it, and in parallel speak to two or three importers or distributors in the industries below. Both are things you can start now."),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("Explore export potential")}
        title={product ? title : t(title)}
        description={product ? t("One of your products.") : t("A product your factory could plausibly make.")}
        action={
          <Button asChild variant="outline">
            <Link href="/opportunities">{t("All opportunities")}</Link>
          </Button>
        }
      />

      <nav aria-label={t("Where you are")} className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        <Link href={`/workspace/${ref}`} className="underline-offset-4 hover:text-foreground hover:underline">
          {t("My exports")}
        </Link>
        <span aria-hidden>›</span>
        <Link href="/opportunities" className="underline-offset-4 hover:text-foreground hover:underline">
          {t("Opportunities")}
        </Link>
        <span aria-hidden>›</span>
        <span className="text-foreground">{product ? title : t(title)}</span>
      </nav>

      <nav aria-label={t("Exploration steps")} className="mt-6">
        <ol className="flex flex-wrap gap-x-1 gap-y-1 text-sm">
          {STAGES.map((s) => (
            <li key={s.n}>
              <Link
                href={`${here}?stage=${s.n}`}
                aria-current={s.n === stage ? "step" : undefined}
                className={s.n === stage ? "inline-flex h-8 items-center rounded-md bg-mint px-3 font-medium" : "inline-flex h-8 items-center rounded-md px-3 text-muted-foreground hover:bg-muted hover:text-foreground"}
              >
                <span className="mr-1.5 tnum text-xs text-primary">{s.n}</span>
                {t(s.short)}
              </Link>
            </li>
          ))}
        </ol>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={6} aria-valuenow={stage} aria-label={t("Step {stage} of 6", { stage })}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(stage / 6) * 100}%` }} />
        </div>
      </nav>

      <div className="mt-8">
        <h2 className="text-xl font-semibold tracking-tight">{t(meta.title)}</h2>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t(meta.lead)}</p>
      </div>

      <div className="mt-8 space-y-10">
        {/* ------------------------------------------------ 1 product and why */}
        {stage === 1 && (
          <>
            <div className="rounded-lg bg-mint p-5 sm:p-6">
              <p className="text-xs font-medium tracking-[0.14em] text-primary">{t("Where it stands")}</p>
              <p className="mt-1 text-xl font-medium tracking-tight">{t(v.headline)}</p>
              <p className="mt-1 max-w-2xl text-sm">
                {t(v.text)} <span className="font-medium">{t("Not yet validated:")}</span> {t("demand, cost, compliance and incentives have not been assessed.")}
              </p>
              {!product && (
                <p className="mt-3 text-sm">
                  {t("Suggested from your capabilities.")}{" "}
                  <Link href="/products/new" className="font-medium text-primary underline underline-offset-4">
                    {t("Add it to your catalogue")}
                  </Link>{" "}
                  {t("to keep your own details.")}
                </p>
              )}
            </div>
            <ProductExplanationPanel scope={organization.id} facts={wf.facts} defaults={wf.defaults} entry={wf.entry} match={wf.match} ai={aiStatus(process.env)} evidence={evidenceForEntry(wf.entry?.id)} />
            <details id="match" className="rounded-lg border bg-card px-4 py-3 text-sm sm:px-5">
              <summary className="cursor-pointer font-medium">{t("Capability match in detail")}</summary>
              {match ? (
                <div className="mt-4 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <FitMeter score={match.score} level={match.level} />
                    <span className="font-medium">{t(FIT_LABEL[match.level])}</span>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <LabelledList title={t("Why it matches your factory")} items={match.reasons.length ? match.reasons : [t("No declared capability lines up with this product yet.")]} />
                    <LabelledList title={t("Gaps in your profile for this product")} items={match.gaps} />
                  </div>
                  {(match.optional.length > 0 || match.guidance.purchasedInputs.length > 0) && (
                    <div className="grid gap-5 md:grid-cols-2">
                      <LabelledList title={t("Optional or alternative (not required)")} items={match.optional} />
                      <LabelledList title={t("Usually bought in")} items={match.guidance.purchasedInputs} />
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <ScoreBreakdown parts={match.parts} />
                  </div>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">{match.confidence.level === "medium" ? t("Confidence: medium.") : t("Confidence: low.")}</span> {tr(t, match.confidence.why)}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-muted-foreground">{t("There is no rules profile for this product type yet, so no capability score is shown. Nothing here implies the product cannot be made or exported.")}</p>
              )}
            </details>
            <p className="text-sm text-muted-foreground">
              {t("Want to look at another product?")}{" "}
              <Link href="/opportunities" className="font-medium text-primary underline-offset-4 hover:underline">
                {t("Choose one")}
              </Link>{" "}
              {t("or")}{" "}
              <Link href="/products/import" className="font-medium text-primary underline-offset-4 hover:underline">
                {t("import a catalogue")}
              </Link>
              .
            </p>
          </>
        )}

        {/* ------------------------------------------------ 2 identity */}
        {stage === 2 && (
          <>
            {product ? (
              <div className="space-y-4 text-sm">
                <p className="whitespace-pre-line text-[15px]">{product.description ?? t("No description provided.")}</p>
                <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {(
                    [
                      [t("Category"), product.category ?? t("Not set")],
                      [t("Intended use"), product.intendedUse ?? t("Not provided")],
                      [t("Made at"), product.factories.map((f) => f.name).join(", ") || t("Not linked to a factory")],
                      [t("HS code you entered"), product.hsCodeClaimed ? t("{code}, unverified", { code: product.hsCodeClaimed }) : t("Not provided")],
                    ] as [string, string][]
                  ).map(([k, val]) => (
                    <div key={k}>
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{val}</dd>
                    </div>
                  ))}
                </dl>
                {product.specs.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {product.specs.map((sp2) => (
                      <Chip key={sp2.id}>
                        {sp2.name}: {sp2.value}
                        {sp2.unit ? ` ${sp2.unit}` : ""}
                      </Chip>
                    ))}
                  </ul>
                ) : null}
                {(() => {
                  const missing = [!product.description && t("a description"), !product.intendedUse && t("the intended use"), product.specs.length === 0 && t("at least one specification"), !product.factories.length && t("the factory that makes it")].filter(Boolean) as string[];
                  return missing.length ? (
                    <p className="rounded-lg bg-muted px-4 py-3">
                      {t("To sharpen the guidance, add {items}.", { items: missing.join(", ") })}
                    </p>
                  ) : (
                    <p className="rounded-lg bg-mint px-4 py-3">{t("The product record is complete enough for a first assessment.")}</p>
                  );
                })()}
                {entry && (
                  <p className="text-muted-foreground">
                    {t("Recognised as")} <span className="font-medium text-foreground">{t(entry.name).toLowerCase()}</span>{t(", so the guidance uses that product type. If that is wrong, treat the type-specific parts with caution.")}
                  </p>
                )}
                <Button asChild variant="outline">
                  <Link href={`/products/${product.id}`}>{t("Edit product details")}</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-[15px]">{t(entry!.summary)}</p>
                <p className="text-muted-foreground">
                  {t("Product family: {family}. Typical size: {size}. Usual materials: {materials}.", { family: t(entry!.group), size: entry!.sizeClass === "small" ? t("small") : entry!.sizeClass === "medium" ? t("medium") : t("large"), materials: entry!.materials.preferred.map((m) => t(MATERIAL_NAMES[m])).join(", ") })}
                </p>
                <Button asChild variant="outline">
                  <Link href="/products/new">{t("Add it as one of your products")}</Link>
                </Button>
              </div>
            )}
          </>
        )}

        {/* ------------------------------------------------ 3 classification */}
        {stage === 3 && (
          <>
          <Flash params={sp} />
          <HsHelper
            defaults={{ name: title, category: product?.category ?? entry?.group ?? "", description: product?.description ?? entry?.summary ?? "", use: product?.intendedUse ?? "", specs: product?.specs.map((x) => `${x.name} ${x.value}${x.unit ? ` ${x.unit}` : ""}`).join(", ") ?? "" }}
            catalogueId={entry?.id ?? null}
            claimedCode={product?.hsCodeClaimed ?? null}
            productId={product?.id ?? null}
          />
          </>
        )}

        {/* ------------------------------------------------ 4 evidence */}
        {stage === 4 && (
          <>
            <ol className="divide-y rounded-lg border bg-card">
              {questions.map((x, i) => (
                <li key={x.q} className="grid gap-1 px-5 py-4 sm:grid-cols-[2rem_1fr] sm:px-6">
                  <span className="tnum text-sm text-primary">{i + 1}</span>
                  <div>
                    <h3 className="font-medium">{x.q}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{x.a}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Block id="uae" title={t("The figures")} badges={<StatusBadge kind={ev.hasData ? "reported" : "missing"} />}>
              <p className="text-sm text-muted-foreground">{t("Figures are data with a source and a date. Any AI commentary is separate and is labelled as such.")}</p>
              <TradeEvidencePanel evidence={ev} />
            </Block>
            {entry && (
              <Block title={t("Who might buy it (hypotheses to test)")} badges={<StatusBadge kind="inferred" />}>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {entry.industries.map((i) => (
                    <li key={i.name} className="rounded-lg border bg-card p-4">
                      <h3 className="text-sm font-medium">{t(i.name)}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{t(i.applications)}</p>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">{t("Categories of buyer, not named companies and not confirmed demand.")}</p>
              </Block>
            )}
          </>
        )}

        {/* ------------------------------------------------ 5 economics */}
        {stage === 5 && (
          <>
            <div className="max-w-xl">
              <CommercialDimension scope={organization.id} assessmentRef={ref} />
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{t("The calculator starts from sample values and says so until you replace them with your own costs and quotes. The duty rate is an unverified assumption and no live exchange rate is connected.")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-10 px-5">
                <Link href={`/viability?product=${ref}`}>{t("Open the landed-cost calculator")}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-10 px-4">
                <Link href={`/viability?product=${ref}#scenarios`}>{t("Compare scenarios")}</Link>
              </Button>
            </div>
          </>
        )}

        {/* ------------------------------------------------ 6 unknowns and next */}
        {stage === 6 && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-lg border bg-card p-5" aria-label={t("What we know")}>
                <h3 className="text-sm font-medium tracking-[0.1em] text-muted-foreground">{t("What we know")}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  <li>{match ? t("Manufacturing fit: {fit}, from your declared factory data.", { fit: t(FIT_LABEL[match.level]).toLowerCase() }) : t("No rules profile for this product type.")}</li>
                  <li>{product ? t("You made this product record yourself.") : t("This is a suggestion, not one of your products yet.")}</li>
                </ul>
              </section>
              <section className="rounded-lg border bg-card p-5" aria-label={t("What needs checking")}>
                <h3 className="text-sm font-medium tracking-[0.1em] text-muted-foreground">{t("What needs checking first")}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {regTopics.slice(0, 3).map((c) => (
                    <li key={c.topic}>{c.topic}</li>
                  ))}
                </ul>
              </section>
              <section className="rounded-lg border bg-card p-5" aria-label={t("What you can do now")}>
                <h3 className="text-sm font-medium tracking-[0.1em] text-muted-foreground">{t("What you can do now")}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>
                    <Link href={`${here}?stage=3`} className="text-primary underline-offset-4 hover:underline">{t("Narrow down the product code")}</Link>
                  </li>
                  <li>
                    <Link href={`/viability?product=${ref}`} className="text-primary underline-offset-4 hover:underline">{t("Replace the sample costs with your own")}</Link>
                  </li>
                  <li>
                    <Link href={`/compliance?product=${ref}`} className="text-primary underline-offset-4 hover:underline">{t("Work through the compliance questions")}</Link>
                  </li>
                  <li>
                    <Link href={`/schemes?product=${ref}`} className="text-primary underline-offset-4 hover:underline">{t("Work through the CEPA and incentive questions")}</Link>
                  </li>
                </ul>
              </section>
              <section className="rounded-lg border bg-card p-5" aria-label={t("What needs an expert")}>
                <h3 className="text-sm font-medium tracking-[0.1em] text-muted-foreground">{t("What needs an expert")}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>
                    <Link href={`/services?topic=hs&product=${ref}`} className="text-primary underline-offset-4 hover:underline">{t("Confirm the product code (HS classification)")}</Link>
                  </li>
                  <li>
                    <Link href={`/services?topic=regulatory&product=${ref}`} className="text-primary underline-offset-4 hover:underline">{t("Destination requirements, testing and approvals")}</Link>
                  </li>
                  <li>
                    <Link href={`/services?topic=cepa&product=${ref}`} className="text-primary underline-offset-4 hover:underline">{t("CEPA origin rules and incentive eligibility")}</Link>
                  </li>
                </ul>
              </section>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{t("None of this has been checked against official destination-market sources, and no requirement is confirmed. These are topics to check, not findings.")}</p>
            <details className="rounded-lg border bg-card px-4 py-3 text-sm sm:px-5">
              <summary className="cursor-pointer font-medium">{t("View all regulatory considerations and production gaps")}</summary>
              <ul className="mt-3 divide-y rounded-md border">
                {regTopics.map((c) => (
                  <li key={c.topic} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4">
                    <p className="font-medium">{c.topic}</p>
                    <p className="text-muted-foreground">{c.note}</p>
                  </li>
                ))}
              </ul>
              {entry && (
                <div className="mt-4 grid gap-5 md:grid-cols-3">
                  <LabelledList title={t("From your profile")} items={match?.gaps.length ? match.gaps : [t("No gaps found in the declared profile.")]} />
                  <LabelledList title={t("Optional or alternative")} items={match?.optional ?? []} />
                  <LabelledList title={t("Tooling this product may need")} items={entry.tooling} />
                  <LabelledList title={t("Validations to plan for")} items={entry.validations} />
                </div>
              )}
              {entry && (
                <p className="mt-3 text-muted-foreground">
                  {t("Rule-of-thumb qualification effort:")} <span className="font-medium text-foreground">{entry.qualificationEffort === "lighter" ? t("lighter") : entry.qualificationEffort === "moderate" ? t("moderate") : t("heavier")}</span>. {t("A planning guess, not a regulatory finding.")}
                </p>
              )}
            </details>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-10 px-5">
                <Link href={`/workspace/${ref}`}>{t("Go to my export workspace")}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-10 px-4">
                <Link href={`/feasibility/${ref}`}>{t("Open the feasibility summary")}</Link>
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        {stage > 1 ? (
          <Button asChild variant="ghost" className="h-10 px-3">
            <Link href={`${here}?stage=${stage - 1}`}>← {t("Back")}</Link>
          </Button>
        ) : (
          <span />
        )}
        {stage < 6 && (
          <Button asChild size="lg" className="h-10 px-5">
            <Link href={`${here}?stage=${stage + 1}`}>{t("Next: {step}", { step: t(STAGES[stage].short) })}</Link>
          </Button>
        )}
      </div>
    </>
  );
}
