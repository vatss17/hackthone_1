import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { FactoryToWorld, type WorldData } from "@/components/world/factory-to-world";
import { AskPanel } from "@/components/atlas/ask-panel";
import { requireOrganization } from "@/lib/organization";
import { loadEngineInput } from "@/lib/capabilities";
import { discover } from "@/lib/opportunities/engine";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Factory to World · Atlas" };
export const instant = false;

export default async function WorldPage() {
  const { t } = await getT();
  const SHORT = { strong: t("Strong"), good: t("Good"), possible: t("Possible"), stretch: t("Stretch") } as const;
  const { organization } = await requireOrganization();
  const { input } = await loadEngineInput(organization.id);
  const found = discover(input);
  const declared = new Set(input.processes.map((p) => p.code).filter(Boolean));

  const own = found.yourProducts.slice(0, 4).map((y) => ({
    id: `own-${y.product.id}`,
    label: y.product.name,
    href: `/workspace/${y.product.id}`,
    own: true,
    fit: y.match ? SHORT[y.match.level] : null,
    uses: (y.match?.matchedProcesses ?? []).filter((c) => declared.has(c)),
  }));
  const adjacent = found.adjacent.slice(0, Math.max(3, 9 - own.length)).map((m) => ({
    id: m.entry.id,
    label: t(m.entry.name),
    href: `/opportunities/${m.entry.id}`,
    own: false,
    fit: SHORT[m.level],
    uses: m.matchedProcesses.filter((c) => declared.has(c)),
  }));
  const data: WorldData = {
    capabilities: [
      ...input.processes.filter((p) => p.code).slice(0, 9).map((p) => ({ id: p.code as string, label: t(p.label), kind: "process" as const })),
      ...input.materials.slice(0, 8).map((m) => ({ id: `mat-${m.code ?? m.label}`, label: t(m.label), kind: "material" as const })),
    ],
    products: [...own, ...adjacent],
  };

  return (
    <>
      <PageHeader
        eyebrow={t("Factory to World")}
        title={t("From your factory floor to the world")}
        description={t("What your factory can do, the products that capability makes, and where those products can go. Every link comes from the processes you declared.")}
      />
      <div className="mt-8">
        {found.profileTooThin || data.products.length === 0 ? (
          <EmptyState
            title={t("Your factory profile is too thin to draw the map")}
            description={t("Add the processes and materials your factory uses. Atlas draws each link from those facts.")}
            action={
              <Button asChild>
                <Link href="/factories">{t("Complete my factory")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-6">
            <FactoryToWorld data={data} />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
              <AskPanel ids={["find_opportunities", "compare_opportunities"]} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("Fit is manufacturing fit from your own data, not demand. Atlas is live for exports from India to the UAE. Other markets will be added one at a time, each with its own checked rules.")}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
