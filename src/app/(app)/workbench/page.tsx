import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Workbench } from "@/components/atlas/workbench";
import { requireOrganization } from "@/lib/organization";
import { listProducts } from "@/lib/capabilities";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "AI Workbench · Atlas" };
export const instant = false;

export default async function WorkbenchPage() {
  const { organization } = await requireOrganization();
  const products = await listProducts(organization.id);
  const { t } = await getT();
  return (
    <>
      <PageHeader eyebrow={t("AI Workbench")} title={t("Ask Atlas. Watch it work.")} description={t("Atlas AI turns a request into a real tool run on your factory, products and saved work. It shows each step and its sources, and asks before it changes anything.")} />
      <div className="mt-8">
        <Workbench scope={organization.id} products={products.map((p) => ({ id: p.id, name: p.name }))} />
      </div>
    </>
  );
}
