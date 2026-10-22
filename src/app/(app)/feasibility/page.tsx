import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganization } from "@/lib/organization";
import { loadEngineInput } from "@/lib/capabilities";
import { discover } from "@/lib/opportunities/engine";

export const metadata: Metadata = { title: "Export feasibility · Export Enablement Platform" };
export const instant = false;

export default async function FeasibilityIndexPage() {
  const { organization } = await requireOrganization();
  const { input } = await loadEngineInput(organization.id);
  const d = discover(input);
  return (
    <>
      <PageHeader
        eyebrow="Export feasibility"
        title="Which product do you want a first assessment for?"
        description="A feasibility workspace brings together manufacturing fit, landed cost, market, gaps and open regulatory questions for one product."
      />
      <JourneyBar current="feasibility" reference={null} />
      <section className="mt-8" aria-labelledby="yp">
        <h2 id="yp" className="text-lg font-semibold tracking-tight">
          Your products
        </h2>
        <ul className="mt-3 divide-y rounded-md border bg-card">
          {d.yourProducts.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No products yet.</li>}
          {d.yourProducts.map((p) => (
            <li key={p.product.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <span className="text-sm font-medium">{p.product.name}</span>
              <Button asChild size="sm">
                <Link href={`/feasibility/${p.product.id}`}>Open feasibility</Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8" aria-labelledby="sg">
        <div className="flex items-center justify-between gap-2">
          <h2 id="sg" className="text-lg font-semibold tracking-tight">
            Suggested for you
          </h2>
          <StatusBadge kind="inferred" />
        </div>
        <ul className="mt-3 divide-y rounded-md border bg-card">
          {d.adjacent.slice(0, 6).map((m) => (
            <li key={m.entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <span className="text-sm font-medium">{m.entry.name}</span>
              <Button asChild size="sm" variant="outline">
                <Link href={`/feasibility/${m.entry.id}`}>Open feasibility</Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-6 text-sm">
        Exploring something new?{" "}
        <Link href="/feasibility/standalone" className="font-medium text-primary underline-offset-4 hover:underline">
          Start a standalone assessment
        </Link>
        .
      </p>
    </>
  );
}
