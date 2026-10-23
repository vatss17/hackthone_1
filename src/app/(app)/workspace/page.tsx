import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { EmptyState } from "@/components/empty-state";
import { WorkspaceBackupPanel } from "@/components/workspace/backup-panel";
import { requireOrganization } from "@/lib/organization";
import { listProducts } from "@/lib/capabilities";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Export Workspace · Atlas" };
export const instant = false;

export default async function WorkspaceIndexPage() {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const products = await listProducts(organization.id);
  if (products.length === 1) redirect(`/workspace/${products[0].id}`);
  return (
    <>
      <PageHeader eyebrow={t("Export Workspace")} title={t("Which product do you want to get export-ready?")} description={t("Each product has its own workspace: next best action, feasibility, roadmap, documents and expert requests.")} />
      <JourneyBar current="workspace" reference={null} />
      <div className="mt-8">
        {products.length === 0 ? (
          <EmptyState
            title={t("No products yet")}
            description={t("Import your catalogue to start with almost no typing, or work on a standalone idea.")}
            action={
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/products/import">{t("Import a catalogue")}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/workspace/standalone">{t("Start a standalone assessment")}</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {products.map((p) => (
              <li key={p.id} className="flex flex-col rounded-lg border bg-card p-4 sm:p-5">
                <h2 className="break-words text-base font-semibold">{p.name}</h2>
                {p.category && <p className="text-sm text-muted-foreground">{p.category}</p>}
                <div className="mt-4 pt-1">
                  <Button asChild size="sm">
                    <Link href={`/workspace/${p.id}`}>{t("Open workspace")}</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-10">
          <WorkspaceBackupPanel scope={organization.id} />
        </div>
        <p className="mt-6 text-sm">
          <Link href="/workspace/standalone" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("Or start a standalone assessment")}
          </Link>
        </p>
      </div>
    </>
  );
}
