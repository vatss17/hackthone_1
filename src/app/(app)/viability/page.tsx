import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { LandedCostWorkspace } from "@/components/landed-cost/workspace";
import { requireOrganization } from "@/lib/organization";
import { loadEngineInput } from "@/lib/capabilities";
import { resolveSubject } from "@/lib/subject";
import { discover } from "@/lib/opportunities/engine";
import { factFields, sampleInputs } from "@/lib/landed-cost/defaults";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Export Economics · Atlas" };
export const instant = false;

export default async function ViabilityPage({ searchParams }: PageProps<"/viability">) {
  const { organization } = await requireOrganization();
  const { t } = await getT();
  const sp = await searchParams;
  const subject = await resolveSubject(organization.id, sp.product);
  const { input } = await loadEngineInput(organization.id);
  const found = discover(input);
  const assessmentRef = subject?.ref ?? "standalone";
  const defaults = sampleInputs(subject ? { ...subject.facts, label: subject.name } : undefined);

  return (
    <>
      <PageHeader
        eyebrow={t("Landed Cost & Commercial Viability")}
        title={subject ? t("Would it pay to export {name}?", { name: subject.name }) : t("Landed-cost calculator")}
        description={t("Work out what it would cost to land your product in the destination market, what price makes sense, and what margin you could earn. Every number is yours to edit, and every assumption is labelled.")}
        action={
          <Button asChild variant="outline">
            <Link href={subject ? `/opportunities/${subject.ref}` : "/opportunities"}>{subject ? t("Back to exploration") : t("Export Opportunities")}</Link>
          </Button>
        }
      />
      <JourneyBar current="cost" reference={subject?.ref ?? null} />

      <details className="mt-5 rounded-lg border bg-card px-4 py-3 text-sm sm:px-5" open={!subject}>
        <summary className="cursor-pointer font-medium">{subject ? t("Calculate for a different product") : t("Choose what to calculate")}</summary>
        <div className="mt-3 grid gap-5 sm:grid-cols-3">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground">{t("Your products")}</h3>
            <ul className="mt-2 space-y-1">
              {found.yourProducts.length === 0 && <li className="text-muted-foreground">{t("None yet.")}</li>}
              {found.yourProducts.map((p) => (
                <li key={p.product.id}>
                  <Link href={`/viability?product=${p.product.id}`} className="text-primary underline-offset-4 hover:underline">
                    {p.product.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground">{t("Suggested for you")}</h3>
            <ul className="mt-2 space-y-1">
              {found.adjacent.slice(0, 5).map((m) => (
                <li key={m.entry.id}>
                  <Link href={`/viability?product=${m.entry.id}`} className="text-primary underline-offset-4 hover:underline">
                    {m.entry.name}
                  </Link>
                </li>
              ))}
              {found.adjacent.length === 0 && <li className="text-muted-foreground">{t("Declare a process to see suggestions.")}</li>}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground">{t("Something else")}</h3>
            <p className="mt-2 text-muted-foreground">{t("Exploring a new idea? Use the standalone calculator and name it yourself.")}</p>
            <Link href="/viability" className="mt-1 inline-block text-primary underline-offset-4 hover:underline">
              {t("Standalone calculator")}
            </Link>
          </div>
        </div>
      </details>

      <LandedCostWorkspace
        key={assessmentRef}
        scope={organization.id}
        assessmentRef={assessmentRef}
        defaults={defaults}
        factFields={subject ? factFields(subject.facts) : []}
        subjectName={subject?.name ?? null}
      />

      <section className="mt-14 rounded-lg border bg-card p-4 sm:p-5" aria-labelledby="next-h">
        <h2 id="next-h" className="text-base font-semibold tracking-tight">
          {t("Next")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("Bring the numbers together with the manufacturing fit, the open regulatory questions and a short action list.")}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-10">
            <Link href={`/feasibility/${subject?.ref ?? "standalone"}`}>{t("Review export feasibility")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-10">
            <Link href={subject ? `/compliance?product=${subject.ref}` : "/compliance"}>{t("Compliance screening")}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
