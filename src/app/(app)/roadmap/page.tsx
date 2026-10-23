import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { RoadmapBoard } from "@/components/workspace/roadmap-board";
import { requireOrganization } from "@/lib/organization";
import { loadEngineInput } from "@/lib/capabilities";
import { discover } from "@/lib/opportunities/engine";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Export Readiness Roadmap · Atlas" };
export const instant = false;

export default async function RoadmapPage({ searchParams }: PageProps<"/roadmap">) {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const raw = (await searchParams).product;
  const ref = typeof raw === "string" && raw ? raw : null;

  if (!ref) {
    const { input } = await loadEngineInput(organization.id);
    const d = discover(input);
    return (
      <>
        <PageHeader eyebrow={t("Export Readiness Roadmap")} title={t("Which product is the roadmap for?")} description={t("The roadmap is personal to a product: its tasks and priorities come from what you have told the platform.")} />
        <JourneyBar current="roadmap" reference={null} />
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">{t("Your products")}</h2>
          <ul className="mt-3 divide-y rounded-lg border bg-card">
            {d.yourProducts.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">{t("No products yet. Import a catalogue first.")}</li>}
            {d.yourProducts.map((p) => (
              <li key={p.product.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                <span className="text-sm font-medium">{p.product.name}</span>
                <Button asChild size="sm">
                  <Link href={`/roadmap?product=${p.product.id}`}>{t("Open roadmap")}</Link>
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/products/import" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("Import a catalogue")}
            </Link>
            <Link href="/roadmap?product=standalone" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("Roadmap for a standalone assessment")}
            </Link>
          </div>
        </section>
      </>
    );
  }

  const { facts, defaults } = await loadWorkspaceFacts(organization, ref);
  return (
    <>
      <PageHeader
        eyebrow={t("Export Readiness Roadmap")}
        title={facts.product ? t("Your roadmap for {product}", { product: facts.product.name }) : t("Your roadmap")}
        description={t("Tasks built from what you have actually told the platform. They change as you complete work and fill gaps.")}
        action={
          <Button asChild variant="outline">
            <Link href={`/workspace/${facts.ref}`}>{t("Export workspace")}</Link>
          </Button>
        }
      />
      <JourneyBar current="roadmap" reference={facts.standalone ? null : facts.ref} />
      <RoadmapBoard scope={organization.id} facts={facts} defaults={defaults} />
    </>
  );
}
