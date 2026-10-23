import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { DocumentsWorkspace } from "@/components/documents/documents-workspace";
import { requireOrganization } from "@/lib/organization";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Export documents · Atlas" };
export const instant = false;

export default async function DocumentsPage({ params }: PageProps<"/documentation/[ref]">) {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const { ref } = await params;
  const { facts, defaults, familyId } = await loadWorkspaceFacts(organization, ref);
  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow={t("Export documents")}
          title={facts.product ? t("Draft documents for {product}", { product: facts.product.name }) : t("Draft export documents")}
          description={t("Editable drafts of a commercial invoice, a packing list and a product-specific documentation checklist, prefilled from what you have already told the platform.")}
          action={
            <Button asChild variant="outline">
              <Link href={`/workspace/${facts.ref}`}>{t("Export workspace")}</Link>
            </Button>
          }
        />
        <JourneyBar current="documents" reference={facts.standalone ? null : facts.ref} />
      </div>
      <DocumentsWorkspace scope={organization.id} facts={facts} defaults={defaults} familyId={familyId} />
    </>
  );
}
