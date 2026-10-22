import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/organization";
import { listFactories } from "@/lib/factories";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { loadEngineInput } from "@/lib/capabilities";
import { FIT_LABEL, discover } from "@/lib/opportunities/engine";

type Step = { title: string; text: string; href: string; status: "available" | "preview" };

const journey: Step[] = [
  { title: "Map your factory", text: "Declare processes, capacity, machinery, materials and products.", href: "/factories", status: "available" },
  { title: "Find UAE opportunities", text: "See products you make and products your factory could also make, and explore each one.", href: "/opportunities", status: "available" },
  { title: "Test commercial viability", text: "Estimate landed cost and margin with every assumption visible.", href: "/viability", status: "preview" },
  { title: "Qualify the product", text: "Screen requirements and find testing and certification gaps.", href: "/compliance", status: "preview" },
  { title: "Check trade benefits", text: "Understand CEPA, rules of origin and Indian export incentives.", href: "/schemes", status: "preview" },
  { title: "Prepare documentation", text: "A personalised checklist and drafts for you to review.", href: "/documentation", status: "preview" },
  { title: "Plan and request help", text: "A prioritised roadmap, and requests to experts for what you cannot do alone.", href: "/roadmap", status: "preview" },
];

const labels: { kind: StatusKind; text: string }[] = [
  {
    kind: "verified",
    text: "Read from an official source. The source, passage and retrieval date are shown.",
  },
  {
    kind: "secondary",
    text: "From a non-official source such as news or a trade body. Needs a primary source.",
  },
  {
    kind: "user",
    text: "Entered or uploaded by the manufacturer. Not checked by us.",
  },
  {
    kind: "estimate",
    text: "Calculated from stated assumptions. Not a quote and not a guarantee.",
  },
  {
    kind: "inferred",
    text: "Worked out by transparent rules from your own data. A starting point to investigate, not a fact about the market.",
  },
  {
    kind: "ai",
    text: "Drafted by AI for a person to accept or reject. AI is an assistant, not an authority.",
  },
  {
    kind: "expert",
    text: "Checked by a named qualified reviewer, with reviewer and date shown. No reviewer is appointed yet, so this label is not in use.",
  },
  {
    kind: "missing",
    text: "Required information that has not been provided or found.",
  },
  {
    kind: "demo",
    text: "An illustrative placeholder. Never real market, tariff, regulatory or scheme data.",
  },
];

// Reads the session on every request (see the layout for why this opts out of instant validation).
export const instant = false;

const registeredOn = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function OverviewPage() {
  const { organization } = await requireOrganization();
  // Journey: company -> at least one active factory -> dashboard. The factory pages never
  // redirect back here, so archiving the last factory cannot loop.
  const { active: factories } = await listFactories(organization.id);
  if (factories.length === 0) redirect("/factories/new");
  const { input, counts } = await loadEngineInput(organization.id);
  const found = discover(input);
  const top = found.adjacent.slice(0, 3);
  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`Welcome, ${organization.name}`}
        description="Make exporting effortless. Start from what your factory can make, find what it could make next, and work toward a first export to the UAE."
      />

      <Section title="Your company">
        <dl className="divide-y rounded-md border bg-card">
          {[
            ["Company name", organization.name],
            ["Registered legal name", organization.legalName ?? "Not provided"],
            ["Your role", organization.role === "owner" ? "Owner" : "Member"],
            ["Registered", registeredOn.format(new Date(organization.createdAt))],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4 sm:px-5">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <section className="mt-8 rounded-md border bg-card" aria-labelledby="next-h">
        <div className="border-b px-4 py-3 sm:px-5">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Where the value is</p>
          <h2 id="next-h" className="text-lg font-semibold tracking-tight">
            {found.profileTooThin ? "Describe your factory to unlock opportunities" : `${found.adjacent.length} products your factory could also make`}
          </h2>
        </div>
        <div className="p-4 sm:p-5">
          {found.profileTooThin ? (
            <p className="text-sm text-muted-foreground">
              Declare at least one manufacturing process on your factory profile. The platform then suggests finished products your machinery and materials could support, and helps you investigate each for the UAE.
            </p>
          ) : (
            <>
              <ul className="divide-y rounded-md border">
                {top.map((m) => (
                  <li key={m.entry.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{m.entry.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {FIT_LABEL[m.level]} · {m.score}/100
                      </p>
                    </div>
                    <StatusBadge kind="inferred" />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Inferred from {counts.processes} process{counts.processes === 1 ? "" : "es"}, {counts.machines} machine{counts.machines === 1 ? "" : "s"} and {counts.materials} material{counts.materials === 1 ? "" : "s"} you declared. Not confirmed demand.
              </p>
            </>
          )}
          <div className="mt-4">
            <Button asChild size="lg" className="h-10">
              <Link href={found.profileTooThin ? "/factories" : "/opportunities"}>{found.profileTooThin ? "Open my factories" : "See Export Opportunities"}</Link>
            </Button>
          </div>
        </div>
      </section>

      <Section
        title="The export journey"
        description="From what your factory can make to a first export. Steps marked Preview show what they will do but are not working yet."
      >
        <ol className="divide-y rounded-md border bg-card">
          {journey.map((step, i) => (
            <li key={step.title} className="flex gap-4 px-4 py-3.5 sm:px-5">
              <span className="w-5 shrink-0 pt-0.5 font-mono text-sm text-primary">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold">
                  <Link href={step.href} className="underline-offset-4 hover:underline">
                    {step.title}
                  </Link>
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{step.text}</p>
              </div>
              {step.status === "preview" && <StatusBadge kind="planned" className="self-start" />}
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title="Your factories"
        aside={
          <Link href="/factories" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Manage factories
          </Link>
        }
      >
        <ul className="divide-y rounded-md border bg-card">
          {factories.map((f) => (
            <li key={f.id} className="px-4 py-3 sm:px-5">
              <h3 className="break-words text-[15px] font-semibold">
                <Link href={`/factories/${f.id}`} className="underline-offset-4 hover:underline">
                  {f.name}
                </Link>
              </h3>
              <p className="break-words text-sm text-muted-foreground">
                {f.city}, {f.state}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="How information is labelled"
        description="Regulatory, tariff and financial information on this platform will carry one of these labels, so you can see what is verified, what is estimated and what is missing."
      >
        <dl className="divide-y rounded-md border bg-card">
          {labels.map(({ kind, text }) => (
            <div
              key={kind}
              className="grid gap-1.5 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4 sm:px-5"
            >
              <dt>
                <StatusBadge kind={kind} />
              </dt>
              <dd className="text-sm text-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </Section>

    </>
  );
}
