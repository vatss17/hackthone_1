import type { Metadata } from "next";
import { FeaturePreview } from "@/components/preview/feature-preview";
import { requireOrganization } from "@/lib/organization";

export const metadata: Metadata = { title: "Export Documents · Export Enablement Platform" };
export const instant = false;

export default async function DocumentationPage() {
  await requireOrganization();
  return (
    <FeaturePreview
      eyebrow="Export Documents"
      title="Be ready with the right paperwork"
      intro="This step will give you a personalised checklist of export documents, draft the commercial ones for you to review, and show what is still missing."
      does={[
        "Build a checklist from your product, buyer and route, with the reason each document is needed.",
        "Draft commercial documents such as an invoice and packing list from your records, for a person to check and correct.",
        "Track which documents you have, which are missing and which are expiring.",
      ]}
      needs={[
        { label: "Product and packing data", kind: "missing", note: "Weights, cartons and descriptions from the product record." },
        { label: "Buyer and shipment details", kind: "missing", note: "Entered by you when you prepare a shipment." },
        { label: "Verified document requirements", kind: "missing", note: "Official sources not connected, so requirements are not stated yet." },
      ]}
      sources={["Verified export and import documentation requirements", "Private, access-controlled document storage", "Document reading to pre-fill details, always reviewed by a person"]}
      next={{ href: "/roadmap", label: "See your readiness roadmap", note: "The roadmap shows how your profile progress leads to this step." }}
    />
  );
}
