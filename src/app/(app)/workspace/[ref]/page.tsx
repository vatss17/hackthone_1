import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { WorkspaceOverview } from "@/components/workspace/workspace-overview";
import { requireOrganization } from "@/lib/organization";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";

export const metadata: Metadata = { title: "Export Workspace · Export Enablement Platform" };
export const instant = false;

export default async function WorkspacePage({ params }: PageProps<"/workspace/[ref]">) {
  const { organization } = await requireOrganization();
  const { ref } = await params;
  const { facts, defaults } = await loadWorkspaceFacts(organization, ref);
  return (
    <>
      <PageHeader
        eyebrow="Export Workspace"
        title={facts.product ? `Getting ${facts.product.name} export-ready` : "Your standalone export workspace"}
        description="Everything in one place: what you have told us, what we found, what it costs, what blocks you, and the single next thing to do."
        action={
          <Button asChild variant="outline">
            <Link href="/workspace">Switch product</Link>
          </Button>
        }
      />
      <JourneyBar current="workspace" reference={facts.standalone ? null : facts.ref} />
      <WorkspaceOverview scope={organization.id} facts={facts} defaults={defaults} />
    </>
  );
}
