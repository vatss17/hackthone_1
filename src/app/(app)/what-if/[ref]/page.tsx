import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { WhatIfStudio } from "@/components/whatif/what-if-studio";
import { requireOrganization } from "@/lib/organization";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "What-If Studio · Atlas" };
export const instant = false;

export default async function WhatIfPage({ params }: PageProps<"/what-if/[ref]">) {
  const { organization } = await requireOrganization();
  const { t } = await getT();
  const { ref } = await params;
  const { facts, defaults } = await loadWorkspaceFacts(organization, ref);
  return (
    <>
      <PageHeader
        eyebrow={t("What-If Studio")}
        title={facts.product ? t("What if, for {name}?", { name: facts.product.name }) : t("What if?")}
        description={t("Every number starts from your saved calculator. Changes here are hypothetical: nothing is saved unless you approve a scenario.")}
      />
      <JourneyBar current="whatif" reference={facts.standalone ? null : facts.ref} />
      <div className="mt-8">
        <WhatIfStudio scope={organization.id} facts={facts} defaults={defaults} />
      </div>
    </>
  );
}
