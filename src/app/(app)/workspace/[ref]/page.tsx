import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { WorkspaceOverview } from "@/components/workspace/workspace-overview";
import { requireOrganization } from "@/lib/organization";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { evidenceForEntry } from "@/lib/trade/evidence";
import { ProductExplanationPanel } from "@/components/explain/product-explanation";
import { aiStatus } from "@/lib/ai/provider";
import { WorkspaceBackupPanel } from "@/components/workspace/backup-panel";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Export Workspace · Atlas" };
export const instant = false;

export default async function WorkspacePage({ params }: PageProps<"/workspace/[ref]">) {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const { ref } = await params;
  const { facts, defaults, entry, match } = await loadWorkspaceFacts(organization, ref);
  return (
    <>
      <PageHeader
        eyebrow={t("Export Workspace")}
        title={facts.product ? t("Getting {product} export-ready", { product: facts.product.name }) : t("Your standalone export workspace")}
        description={t("Everything in one place: what you have told us, what we found, what it costs, what blocks you, and the single next thing to do.")}
        action={
          <Button asChild variant="outline">
            <Link href="/workspace">{t("Switch product")}</Link>
          </Button>
        }
      />
      <JourneyBar current="workspace" reference={facts.standalone ? null : facts.ref} />
      <WorkspaceOverview scope={organization.id} facts={facts} defaults={defaults} />
      <div className="mt-10">
        <ProductExplanationPanel scope={organization.id} facts={facts} defaults={defaults} entry={entry} match={match} ai={aiStatus(process.env)} evidence={evidenceForEntry(entry?.id)} />
      </div>
      <div className="mt-10">
        <WorkspaceBackupPanel scope={organization.id} />
      </div>
    </>
  );
}
