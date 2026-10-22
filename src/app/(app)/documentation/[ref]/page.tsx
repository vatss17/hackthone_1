import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { DocumentsWorkspace } from "@/components/documents/documents-workspace";
import { requireOrganization } from "@/lib/organization";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";

export const metadata: Metadata = { title: "Export documents · Export Enablement Platform" };
export const instant = false;

export default async function DocumentsPage({ params }: PageProps<"/documentation/[ref]">) {
  const { organization } = await requireOrganization();
  const { ref } = await params;
  const { facts, defaults, familyId } = await loadWorkspaceFacts(organization, ref);
  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="Export documents"
          title={facts.product ? `Draft documents for ${facts.product.name}` : "Draft export documents"}
          description="Editable drafts of a commercial invoice, a packing list and a product-specific documentation checklist, prefilled from what you have already told the platform."
          action={
            <Button asChild variant="outline">
              <Link href={`/workspace/${facts.ref}`}>Export workspace</Link>
            </Button>
          }
        />
        <JourneyBar current="documents" reference={facts.standalone ? null : facts.ref} />
      </div>
      <DocumentsWorkspace scope={organization.id} facts={facts} defaults={defaults} familyId={familyId} />
    </>
  );
}
