import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Chip, OpportunityRow } from "@/components/opportunities/parts";
import { requireOrganization } from "@/lib/organization";
import { loadEngineInput } from "@/lib/capabilities";
import { CATALOGUE_VERSION } from "@/lib/opportunities/catalogue";
import { FIT_LABEL, PROCESS_NAMES, THRESHOLDS, WEIGHTS, discover } from "@/lib/opportunities/engine";

export const metadata: Metadata = { title: "Export Opportunities · Export Enablement Platform" };
export const instant = false;

export default async function OpportunitiesPage() {
  const { organization } = await requireOrganization();
  const { input, factories, counts } = await loadEngineInput(organization.id);
  const d = discover(input);
  const profileHref = factories[0] ? `/factories/${factories[0].id}` : "/factories";

  return (
    <>
      <PageHeader
        eyebrow="Export opportunities"
        title="What could you export?"
        description="Products your factory could make for the UAE, why each one suits it, and what to do next."
      />

      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
        Built from {counts.processes} process{counts.processes === 1 ? "" : "es"}, {counts.machines} machine{counts.machines === 1 ? "" : "s"} and {counts.materials} material{counts.materials === 1 ? "" : "s"} across {factories.length} factor{factories.length === 1 ? "y" : "ies"}.{" "}
        <Link href={profileHref} className="font-medium text-primary underline-offset-4 hover:underline">
          Refine my factory profile
        </Link>
      </p>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Each product is judged on four separate things and never given one combined score. Only manufacturing fit is worked out so far, from your own data. The rest says what is still needed.</p>

      {/* ---------------- what else could you make ---------------- */}
      <section className="mt-10" aria-labelledby="else-h">
        <h2 id="else-h" className="text-2xl font-medium tracking-tight">
          What your factory could also make
        </h2>

        {d.underusedProcesses.length > 0 && d.adjacent.some((m) => m.putsToWork.length > 0) && (
          <p className="mt-3 max-w-2xl rounded-lg bg-mint px-4 py-3 text-sm">
            Your current products do not use your {d.underusedProcesses.map((p) => PROCESS_NAMES[p].toLowerCase()).join(" or ")} capability. {d.adjacent.filter((m) => m.putsToWork.length > 0).length} of these would put it to work.
          </p>
        )}

        <div className="mt-6">
          {d.profileTooThin ? (
            <EmptyState
              title="Describe your factory to see suggestions"
              description="Suggestions come from your declared processes, materials and machinery. Name at least one manufacturing process to begin."
              action={
                <Button asChild>
                  <Link href={factories[0] ? `/factories/${factories[0].id}/setup` : "/factories/new"}>Describe my factory</Link>
                </Button>
              }
            />
          ) : d.adjacent.length === 0 ? (
            <EmptyState title="No close matches yet" description="Nothing in the starter catalogue lines up well with your declared profile. Adding machinery ratings and materials can change that." />
          ) : (
            <ul className="grid gap-5">
              {d.adjacent.slice(0, 5).map((m) => (
                <li key={m.entry.id}>
                  <OpportunityRow m={m} href={`/opportunities/${m.entry.id}`} scope={organization.id} />
                </li>
              ))}
            </ul>
          )}
          {d.adjacent.length > 5 && (
            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-medium text-primary">Show {d.adjacent.length - 5} more</summary>
              <ul className="mt-4 grid gap-5">
                {d.adjacent.slice(5).map((m) => (
                  <li key={m.entry.id}>
                    <OpportunityRow m={m} href={`/opportunities/${m.entry.id}`} scope={organization.id} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {!d.profileTooThin && d.stretch.length > 0 && (
          <details className="mt-8 rounded-lg border bg-card px-4 py-3 sm:px-5">
            <summary className="cursor-pointer text-sm font-medium">Stretch options that would need a new process ({d.stretch.length})</summary>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">New equipment is a major decision, so treat these as questions to explore, not recommendations.</p>
            <ul className="mt-3 divide-y">
              {d.stretch.map((m) => (
                <li key={m.entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <h4 className="text-[15px] font-medium">{m.entry.name}</h4>
                    <p className="text-sm text-muted-foreground">{m.gaps[0]}</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/opportunities/${m.entry.id}`}>Explore</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ---------------- your products ---------------- */}
      <section className="mt-14" aria-labelledby="yours-h">
        <h2 id="yours-h" className="text-2xl font-medium tracking-tight">
          Products you make today
        </h2>
        <div className="mt-5">
          {d.yourProducts.length === 0 ? (
            <EmptyState
              title="No products yet"
              description="Import a catalogue or add a product you make, linked to a factory, to explore its export potential."
              action={
                <Button asChild>
                  <Link href="/products/import">Import a catalogue</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {d.yourProducts.map(({ product, entry, match }) => (
                <li key={product.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-6">
                  <div className="min-w-0 max-w-xl">
                    <h3 className="break-words text-base font-medium">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {match && entry ? `${FIT_LABEL[match.level]} · recognised as ${entry.name.toLowerCase()}. ${match.reasons[0] ?? ""}` : "No rules profile for this product type yet, so only general guidance. That does not mean it cannot be exported."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" className="h-9 px-3">
                      <Link href={`/products/${product.id}`}>View</Link>
                    </Button>
                    <Button asChild className="h-10 px-4">
                      <Link href={`/opportunities/${product.id}`}>Explore export potential</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <details className="mt-14 rounded-lg border bg-card/60 px-4 py-3 text-sm sm:px-5">
        <summary className="cursor-pointer font-medium">How these suggestions are worked out</summary>
        <div className="mt-3 space-y-3 text-muted-foreground">
          <p>
            Each product in a hand-written starter catalogue ({CATALOGUE_VERSION}) is compared with your profile using fixed rules. The 0 to 100 score covers manufacturing fit only: processes {WEIGHTS.processes}, materials {WEIGHTS.materials}, machinery {WEIGHTS.machines}, capacity {WEIGHTS.capacity}, and closeness to what you make {WEIGHTS.adjacency}. Strong is {THRESHOLDS.strong} and above, good {THRESHOLDS.good} and above, possible {THRESHOLDS.possible} and above.
          </p>
          <p>It does not use market demand, prices, tariffs or regulations, because none of that data is connected. The catalogue text is general knowledge and has not been checked against official sources.</p>
          <div className="flex flex-wrap gap-1.5">
            {input.processes.map((p) => (
              <Chip key={p.label} tone="have">
                {p.label}
                {p.capacityText ? ` · ${p.capacityText}` : ""}
              </Chip>
            ))}
            {input.materials.map((m) => (
              <Chip key={m.label}>{m.code ?? m.label}</Chip>
            ))}
          </div>
        </div>
      </details>
    </>
  );
}
