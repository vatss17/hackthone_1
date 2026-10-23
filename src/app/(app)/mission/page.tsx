import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MissionCard } from "@/components/mission/mission-card";
import { requireOrganization } from "@/lib/organization";
import { listProducts } from "@/lib/capabilities";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Mission Control · Atlas" };
export const instant = false;

export default async function MissionIndexPage() {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const products = await listProducts(organization.id);
  if (products.length === 1) redirect(`/mission/${products[0].id}`);
  const missions = await Promise.all(products.slice(0, 12).map((p) => loadWorkspaceFacts(organization, p.id)));
  return (
    <>
      <PageHeader eyebrow={t("Mission Control")} title={t("Every export, as a mission")} description={t("Each product you want to export is a mission: a journey map, a task board, what depends on what, and what is blocking it.")} />
      <div className="mt-8">
        {missions.length === 0 ? (
          <EmptyState
            title={t("No missions yet")}
            description={t("Add a product to start its first export mission.")}
            action={
              <Button asChild>
                <Link href="/start">{t("Add a product")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {missions.map((m) => (
              <MissionCard key={m.facts.ref} scope={organization.id} facts={m.facts} defaults={m.defaults} />
            ))}
          </div>
        )}
        {products.length > 12 && <p className="mt-3 text-sm text-muted-foreground">{t("Showing the first 12 of {count} products. Use search (⌘K) to open any other.", { count: products.length })}</p>}
      </div>
    </>
  );
}
