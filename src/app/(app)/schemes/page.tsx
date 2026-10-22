import type { Metadata } from "next";
import { FeaturePreview } from "@/components/preview/feature-preview";
import { requireOrganization } from "@/lib/organization";

export const metadata: Metadata = { title: "CEPA & Incentives · Export Enablement Platform" };
export const instant = false;

export default async function SchemesPage() {
  await requireOrganization();
  return (
    <FeaturePreview
      eyebrow="CEPA & Incentives"
      title="Which trade benefits could apply?"
      intro="This step will explain how the India–UAE trade agreement and Indian export incentives may apply to a product, and what evidence each one needs."
      does={[
        "Check whether a product could qualify for preferential treatment, using verified sources and showing the rule behind each answer.",
        "Explain rules of origin in plain language and list the records you would need to show origin.",
        "List Indian export incentives that may be relevant, what they require and which ones need a specialist.",
      ]}
      needs={[
        { label: "Verified HS classification", kind: "missing", note: "Eligibility depends on it." },
        { label: "Bill of materials and origin of inputs", kind: "missing", note: "Needed to test rules of origin. Material origin can be recorded but is not collected yet." },
        { label: "Official scheme and agreement texts", kind: "missing", note: "Not connected, so no eligibility is claimed." },
      ]}
      sources={["India–UAE agreement texts and tariff schedules", "Rules-of-origin provisions by product", "Indian export incentive scheme notifications"]}
      next={{ href: "/services", label: "See expert assistance", note: "Trade-benefit questions are often best settled with a specialist. The expert page shows how that help will be requested." }}
    />
  );
}
