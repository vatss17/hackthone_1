import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireOrganization } from "@/lib/organization";
import { listProducts } from "@/lib/capabilities";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "What-If Studio · Atlas" };
export const instant = false;

export default async function WhatIfIndexPage() {
  const { organization } = await requireOrganization();
  const { t } = await getT();
  const products = await listProducts(organization.id);
  if (products.length === 1) redirect(`/what-if/${products[0].id}`);
  return (
    <>
      <PageHeader eyebrow={t("What-If Studio")} title={t("Test a change before you make it")} description={t("Pick a product. Move price, freight, cost, exchange rate and duty, and see what happens to the margin. Your saved numbers stay as they are.")} />
      <div className="mt-8">
        {products.length === 0 ? (
          <EmptyState title={t("No products yet")} description={t("Add a product to try what-ifs on its economics.")} action={<Button asChild><Link href="/start">{t("Add a product")}</Link></Button>} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`/what-if/${p.id}`} className="flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:border-(--brand-teal)">
                  <span className="font-semibold">{p.name}</span>
                  <span className="mt-1 text-sm text-muted-foreground">{t("Open What-If Studio")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
