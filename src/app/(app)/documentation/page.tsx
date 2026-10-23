import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { requireOrganization } from "@/lib/organization";
import { loadEngineInput } from "@/lib/capabilities";
import { discover } from "@/lib/opportunities/engine";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Export documents · Atlas" };
export const instant = false;

export default async function DocumentationIndexPage() {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const { input } = await loadEngineInput(organization.id);
  const d = discover(input);
  return (
    <>
      <PageHeader eyebrow={t("Export documents")} title={t("Which product are the documents for?")} description={t("Draft a commercial invoice and packing list, and see a documentation checklist, for one product. Everything is a draft for you to review.")} />
      <JourneyBar current="documents" reference={null} />
      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">{t("Your products")}</h2>
        <ul className="mt-3 divide-y rounded-lg border bg-card">
          {d.yourProducts.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">{t("No products yet. Import a catalogue first.")}</li>}
          {d.yourProducts.map((p) => (
            <li key={p.product.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <span className="text-sm font-medium">{p.product.name}</span>
              <Button asChild size="sm">
                <Link href={`/documentation/${p.product.id}`}>{t("Open documents")}</Link>
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm">
          <Link href="/documentation/standalone" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("Draft documents for a standalone shipment")}
          </Link>
        </p>
      </section>
    </>
  );
}
