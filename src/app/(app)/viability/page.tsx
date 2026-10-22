import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { FeaturePreview } from "@/components/preview/feature-preview";
import { requireOrganization } from "@/lib/organization";
import { resolveSubject } from "@/lib/subject";

export const metadata: Metadata = { title: "Landed Cost & Viability · Export Enablement Platform" };
export const instant = false;

const LINES: { line: string; from: string; kind: StatusKind }[] = [
  { line: "Ex-works price per unit", from: "You provide your cost and target price", kind: "user" },
  { line: "Packing, cartons and palletising", from: "Your carton data, once entered on the product", kind: "user" },
  { line: "Inland freight, India to port", from: "Live freight rates not connected", kind: "missing" },
  { line: "Ocean or air freight to the UAE", from: "Live freight rates not connected", kind: "missing" },
  { line: "Insurance", from: "Assumption you can set", kind: "estimate" },
  { line: "UAE customs duty", from: "Verified tariff data not connected", kind: "missing" },
  { line: "Other taxes and port charges", from: "Verified source not connected", kind: "missing" },
  { line: "Landed cost per unit and margin scenarios", from: "Calculated from the lines above, with every assumption shown", kind: "estimate" },
];

export default async function ViabilityPage({ searchParams }: PageProps<"/viability">) {
  const { organization } = await requireOrganization();
  const subject = await resolveSubject(organization.id, (await searchParams).product);
  return (
    <FeaturePreview
      eyebrow="Landed Cost & Commercial Viability"
      title="Would it pay to export this?"
      intro="This step will turn a product into a landed-cost estimate in the UAE and compare it with what buyers might pay, with every assumption visible."
      does={[
        "Build a landed-cost estimate per unit from price, packing, freight, insurance, duty and charges.",
        "Show margin under several pricing scenarios and what would have to be true for each.",
        "Label every number as your input, an estimate or verified data, so nothing looks more certain than it is.",
      ]}
      needs={[
        { label: "A product", kind: subject ? (subject.own ? "user" : "inferred") : "missing", note: subject ? `${subject.name} is selected.` : "Choose a product on the Export Opportunities page." },
        { label: "Your cost and target price", kind: "missing", note: "Entered by you. Not collected yet." },
        { label: "Carton and weight data", kind: "missing", note: "Part of the product record. Add it when this step opens." },
        { label: "Verified duty and freight data", kind: "missing", note: "Needs connected sources, so no figures are shown." },
      ]}
      sources={["Verified UAE tariff and duty data", "Live or quoted freight rates", "UAE import price benchmarks"]}
      next={{
        href: subject ? `/opportunities/${subject.ref}` : "/opportunities",
        label: subject ? `Back to ${subject.name}` : "Go to Export Opportunities",
        note: "Keep improving your factory and product records. Everything you enter here will feed this step.",
      }}
    >
      <section className="mt-10" aria-labelledby="shape-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="shape-h" className="text-lg font-semibold tracking-tight">
            {subject ? `Cost build-up for ${subject.name}` : "Cost build-up"}
          </h2>
          <StatusBadge kind="demo" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">The structure of the estimate. No amounts are shown because no real inputs or data sources exist yet.</p>
        <ul className="mt-3 divide-y rounded-md border bg-card">
          {LINES.map((l) => (
            <li key={l.line} className="grid gap-1.5 px-4 py-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:gap-4 sm:px-5">
              <p className="text-sm font-medium">{l.line}</p>
              <p className="text-sm text-muted-foreground">{l.from}</p>
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">—</span>
                <StatusBadge kind={l.kind} />
              </span>
            </li>
          ))}
        </ul>
        {subject && (
          <p className="mt-3 text-sm">
            <Link href={`/compliance?product=${subject.ref}`} className="font-medium text-primary underline-offset-4 hover:underline">
              Next: compliance and testing for {subject.name}
            </Link>
          </p>
        )}
      </section>
    </FeaturePreview>
  );
}
