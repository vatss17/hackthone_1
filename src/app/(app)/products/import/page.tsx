import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ImportWorkspace } from "@/components/catalogue/import-workspace";
import { Notice } from "@/components/auth/notice";
import { requireOrganization } from "@/lib/organization";
import { listFactories } from "@/lib/factories";
import { listProducts } from "@/lib/capabilities";
import { aiStatus } from "@/lib/ai/provider";

export const metadata: Metadata = { title: "Import product catalogue · Export Enablement Platform" };
export const instant = false;

export default async function ImportPage() {
  const { organization } = await requireOrganization();
  const [{ active }, products] = await Promise.all([listFactories(organization.id), listProducts(organization.id)]);
  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="Import your product catalogue"
        description="Bring in the products you already describe in a catalogue, with almost no typing. Review every suggestion, correct what is wrong, and save only what you accept."
      />
      <div className="mt-6">
        {organization.role !== "owner" ? (
          <Notice tone="error">Only company owners can add products.</Notice>
        ) : (
          <ImportWorkspace factories={active.map((f) => ({ id: f.id, name: f.name }))} existingNames={products.map((p) => p.name)} ai={aiStatus(process.env)} />
        )}
      </div>
    </>
  );
}
