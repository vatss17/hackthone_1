import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { MissionBoard } from "@/components/mission/mission-board";
import { requireOrganization } from "@/lib/organization";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Mission Control · Atlas" };
export const instant = false;

export default async function MissionPage({ params }: PageProps<"/mission/[ref]">) {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const { ref } = await params;
  const { facts, defaults } = await loadWorkspaceFacts(organization, ref);
  return (
    <>
      <PageHeader
        eyebrow={t("Mission Control · India to UAE")}
        title={facts.product ? t("{product}: export mission", { product: facts.product.name }) : t("Standalone export mission")}
        description={t("The journey map, the task board and the blockers come from the same roadmap as your workspace. Moving a card records your progress; it is never an approval.")}
        action={
          <Button asChild variant="outline">
            <Link href="/mission">{t("All missions")}</Link>
          </Button>
        }
      />
      <JourneyBar current="mission" reference={facts.standalone ? null : facts.ref} />
      <div className="mt-8">
        <MissionBoard scope={organization.id} facts={facts} defaults={defaults} />
      </div>
    </>
  );
}
