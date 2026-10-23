import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { StatusBadge } from "@/components/status-badge";
import { HeadingBlock } from "@/components/evidence/trade-panel";
import { requireOrganization } from "@/lib/organization";
import { CATALOGUE } from "@/lib/opportunities/catalogue";
import { getT } from "@/lib/i18n/server";
import { ALL_HEADINGS, GENERAL_LIMITATIONS, HEADINGS_FOR_ENTRY, SOURCE, headingEvidence, snapshotLoaded, snapshotRetrieved } from "@/lib/trade/evidence";

export const metadata: Metadata = { title: "Market evidence · Atlas" };
export const instant = false;

export default async function EvidencePage() {
  const { t } = await getT();
  await requireOrganization();
  const loaded = snapshotLoaded();
  return (
    <>
      <PageHeader
        eyebrow={t("Market evidence")}
        title={t("What the destination market reports importing in plastics")}
        description={loaded ? t("Reported trade values for the plastic product headings behind your opportunities. This is market evidence from a dated public snapshot, not demand for your product and not live data.") : t("Where destination trade evidence for the plastic product headings behind your opportunities will appear, with its source and limits. No figures are loaded in this deployment, and none are estimated.")}
      />
      <JourneyBar current="evidence" reference={null} />

      <section className="mt-6 rounded-lg border bg-card p-4 sm:p-5" aria-labelledby="src-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="src-h" className="text-base font-semibold tracking-tight">
            {t("Where this comes from")}
          </h2>
          <StatusBadge kind={loaded ? "reported" : "missing"} />
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">{t("Source")}</dt>
          <dd>
            {t("{name}, published by the {publisher}.", { name: t(SOURCE.name), publisher: t(SOURCE.publisher) })}{" "}
            <Link href={SOURCE.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              comtradeplus.un.org
            </Link>
          </dd>
          <dt className="text-muted-foreground">{t("Retrieved")}</dt>
          <dd>{loaded ? t("{date}. A dated snapshot, not a live feed.", { date: snapshotRetrieved() ?? "" }) : t("No snapshot is loaded in this deployment.")}</dd>
          <dt className="text-muted-foreground">{t("Coverage")}</dt>
          <dd>{t("Annual reported values in US dollars, by 4-digit HS heading: destination-reported imports from all countries, and India-reported exports to the destination.")}</dd>
          <dt className="text-muted-foreground">{t("Licence")}</dt>
          <dd className="text-(--status-estimate-fg)">{t(SOURCE.licence)}</dd>
        </dl>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">{t("How to read it, and what it cannot tell you")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {GENERAL_LIMITATIONS.map((l) => (
              <li key={l}>{t(l)}</li>
            ))}
          </ul>
        </details>
      </section>

      {!loaded && (
        <section className="mt-6 rounded-md border border-dashed border-input/60 bg-card p-5" aria-labelledby="empty-h">
          <h2 id="empty-h" className="text-base font-semibold tracking-tight">
            {t("Trade figures are not loaded in this deployment")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("The figures come from UN Comtrade. Permission to redistribute that data with this project has not been confirmed, so it is kept out of the code and shown only on a machine where an operator has opted in for an internal demonstration. Nothing is estimated or filled in here. Opportunities, the calculator, screening and the roadmap work without it.")}
          </p>
          <p className="mt-3 text-sm">
            <Link href="/opportunities" className="text-primary underline underline-offset-4">
              {t("Back to your opportunities")}
            </Link>
          </p>
        </section>
      )}

      <div className="mt-8 grid gap-5">
        {ALL_HEADINGS.map((hs) => {
          const h = headingEvidence(hs);
          if (!h) return null;
          const products = CATALOGUE.filter((e) => HEADINGS_FOR_ENTRY[e.id]?.includes(hs));
          return (
            <section key={hs} id={`hs-${hs}`} className="scroll-mt-20">
              <HeadingBlock h={h} />
              {products.length > 0 && (
                <p className="mt-2 px-1 text-xs text-muted-foreground">
                  {t("Candidate products under this heading (an inference, not a classification):")}{" "}
                  {products.map((e, i) => (
                    <span key={e.id}>
                      <Link href={`/opportunities/${e.id}`} className="text-primary underline-offset-4 hover:underline">
                        {t(e.name)}
                      </Link>
                      {i < products.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
