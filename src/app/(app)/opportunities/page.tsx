import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Chip, FitMeter, OpportunityCard, ScoreBreakdown } from "@/components/opportunities/parts";
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
        eyebrow="Export Opportunities"
        title="What could you take to the UAE?"
        description="Starting from what your factory can actually do, the platform shows products you already make and products your machines, materials and processes could also make, and helps you investigate each one."
      />

      <section className="mt-6 rounded-md border bg-card p-4 sm:p-5" aria-labelledby="basis-h">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="basis-h" className="text-sm font-semibold">
              Built from your factory profile
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {counts.processes} process{counts.processes === 1 ? "" : "es"}, {counts.machines} machine{counts.machines === 1 ? "" : "s"}, {counts.materials} material
              {counts.materials === 1 ? "" : "s"}, {counts.products} product{counts.products === 1 ? "" : "s"} across {factories.length} factor{factories.length === 1 ? "y" : "ies"}.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={profileHref}>Edit factory profile</Link>
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {input.processes.map((p) => (
            <Chip key={p.label} tone="have">
              {p.label}
              {p.capacityText ? ` · ${p.capacityText}` : ""}
            </Chip>
          ))}
          {input.materials.map((m) => (
            <Chip key={m.label}>{m.code ?? m.label}</Chip>
          ))}
          {input.processes.length + input.materials.length === 0 && <span className="text-sm text-muted-foreground">Nothing declared yet.</span>}
        </div>
        <div className="mt-4 grid gap-2 border-t pt-3 text-xs text-muted-foreground sm:grid-cols-3">
          <p>
            <StatusBadge kind="inferred" /> <span className="ml-1">Worked out by transparent rules from your data.</span>
          </p>
          <p>
            <StatusBadge kind="demo" /> <span className="ml-1">Illustrative sample, never real market data.</span>
          </p>
          <p>
            <StatusBadge kind="missing" /> <span className="ml-1">Needed but not yet connected or provided.</span>
          </p>
        </div>
      </section>

      {/* ---------------- 1. your products ---------------- */}
      <section className="mt-12" aria-labelledby="yours-h">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">1</p>
        <h2 id="yours-h" className="text-xl font-semibold tracking-tight">
          Your Products
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Products you already make. Start here to see how each could be positioned for the UAE.</p>
        <div className="mt-5">
          {d.yourProducts.length === 0 ? (
            <EmptyState
              title="No products yet"
              description="Add a finished product you make, linked to a factory, to explore its export potential."
              action={
                <Button asChild>
                  <Link href="/products/new">Add a product</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {d.yourProducts.map(({ product, entry, match }) => (
                <li key={product.id} className="flex flex-col rounded-md border bg-card p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-semibold">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">{product.category ?? "No category set"}</p>
                    </div>
                    <StatusBadge kind="user" />
                  </div>
                  {match && entry ? (
                    <>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <FitMeter score={match.score} level={match.level} />
                        <span className="text-xs text-muted-foreground">{FIT_LABEL[match.level]}</span>
                      </div>
                      <p className="mt-2 text-sm">
                        Recognised as <span className="font-medium">{entry.name.toLowerCase()}</span>. {match.reasons[0]}
                      </p>
                      {match.gaps[0] && <p className="mt-1.5 text-sm text-muted-foreground">To firm up: {match.gaps[0]}</p>}
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      We do not have a rules profile for this product type yet, so you will get general guidance only. Nothing here implies it cannot be exported.
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
                    <Button asChild>
                      <Link href={`/opportunities/${product.id}`}>Explore export potential</Link>
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href={`/products/${product.id}`}>View product</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------------- 2. what else could you make ---------------- */}
      <section className="mt-14" aria-labelledby="else-h">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">2</p>
        <h2 id="else-h" className="text-xl font-semibold tracking-tight">
          What Else Could You Make?
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Products your declared machinery, materials and processes could plausibly support, beyond what you make today. These are starting points to investigate, not confirmed demand and not a promise that you can manufacture them.
        </p>

        {d.underusedProcesses.length > 0 && d.adjacent.some((m) => m.putsToWork.length > 0) && (
          <div className="mt-4 rounded-md border border-primary/30 bg-(--status-verified-bg) px-4 py-3 text-sm sm:px-5">
            <p className="font-medium">An insight from your own data</p>
            <p className="mt-0.5">
              Your current products do not use your {d.underusedProcesses.map((p) => PROCESS_NAMES[p].toLowerCase()).join(" or ")} capability.{" "}
              {d.adjacent.filter((m) => m.putsToWork.length > 0).length} of the suggestions below would put it to work. <span className="text-muted-foreground">(Inferred from what you declared, not from market data.)</span>
            </p>
          </div>
        )}

        <details className="mt-4 rounded-md border bg-card px-4 py-3 text-sm sm:px-5">
          <summary className="cursor-pointer font-medium">How these suggestions are worked out</summary>
          <div className="mt-3 space-y-3 text-muted-foreground">
            <p>
              Each product in a hand-written starter catalogue ({CATALOGUE_VERSION}) is compared with your profile using fixed rules. The score covers capability fit only: processes {WEIGHTS.processes}, materials {WEIGHTS.materials}, machinery{" "}
              {WEIGHTS.machines}, capacity {WEIGHTS.capacity}, and closeness to what you make {WEIGHTS.adjacency}, out of 100. Strong is {THRESHOLDS.strong} and above, good {THRESHOLDS.good} and above, possible {THRESHOLDS.possible} and above. Products that need a
              process you have not declared are shown separately as stretch options.
            </p>
            <p>
              The score does not use market demand, prices, tariffs or regulations, because none of that data is connected yet. Verified UAE trade data and expert review would add to these rules without replacing them. The catalogue text is general knowledge and has not been checked against official sources.
            </p>
          </div>
        </details>

        <div className="mt-5">
          {d.profileTooThin ? (
            <EmptyState
              title="Describe your factory to see suggestions"
              description="Suggestions come from your declared processes, materials and machinery. Declare at least one manufacturing process to begin."
              action={
                <Button asChild>
                  <Link href={profileHref}>Open factory profile</Link>
                </Button>
              }
            />
          ) : d.adjacent.length === 0 ? (
            <EmptyState title="No close matches yet" description="Nothing in the starter catalogue lines up well with your declared profile. Adding machinery ratings and materials can change that." />
          ) : (
            <ul className="grid gap-5">
              {d.adjacent.map((m) => (
                <li key={m.entry.id}>
                  <OpportunityCard m={m} href={`/opportunities/${m.entry.id}`} />
                  <details className="mt-1 px-1 text-sm">
                    <summary className="cursor-pointer py-1 text-xs text-muted-foreground">Show the score breakdown</summary>
                    <div className="mt-1 rounded-md border bg-card p-3">
                      <ScoreBreakdown parts={m.parts} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!d.profileTooThin && d.stretch.length > 0 && (
          <div className="mt-10">
            <h3 className="text-base font-semibold tracking-tight">Stretch options: would need a new process</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              These would need a manufacturing process you have not declared. Investing in new equipment is a major decision, so treat them as questions to explore, not recommendations.
            </p>
            <ul className="mt-4 divide-y rounded-md border bg-card">
              {d.stretch.map((m) => (
                <li key={m.entry.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <h4 className="text-[15px] font-semibold">{m.entry.name}</h4>
                    <p className="text-sm text-muted-foreground">{m.gaps[0]}</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/opportunities/${m.entry.id}`}>Explore export potential</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
