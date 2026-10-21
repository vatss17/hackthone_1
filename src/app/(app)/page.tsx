import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/organization";
import { listFactories } from "@/lib/factories";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const journey = [
  {
    title: "Map your factory",
    text: "Record machinery, materials, capacity, products and certifications, and upload catalogues and documents.",
  },
  {
    title: "Find UAE opportunities",
    text: "Review UAE import demand, competing supplier countries and adjacent products your factory could make, using official trade data.",
  },
  {
    title: "Test commercial viability",
    text: "Estimate landed cost, duties and freight, and compare pricing scenarios with every assumption visible.",
  },
  {
    title: "Qualify the product",
    text: "Screen against UAE product requirements, find testing and certification gaps, and list the evidence needed.",
  },
  {
    title: "Check trade benefits",
    text: "Understand India–UAE CEPA, rules of origin and Indian export incentives, and the documents each one needs.",
  },
  {
    title: "Prepare documentation",
    text: "Get a personalised checklist, draft commercial documents and track what is still missing.",
  },
  {
    title: "Plan and request help",
    text: "Follow a prioritised roadmap, download readiness reports and request testing, freight or specialist support.",
  },
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
  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`Welcome, ${organization.name}`}
        description="A guided path from factory capabilities to a first export, starting with Indian manufacturers of finished plastic products and the UAE."
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

      <Section
        title="The export journey"
        description="The intended sequence for the platform. The platform is under construction and none of these stages is available yet."
        aside={<StatusBadge kind="planned" />}
      >
        <ol className="divide-y rounded-md border bg-card">
          {journey.map((step, i) => (
            <li key={step.title} className="flex gap-4 px-4 py-3.5 sm:px-5">
              <span className="w-5 shrink-0 pt-0.5 font-mono text-sm text-primary">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold">{step.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {step.text}
                </p>
              </div>
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
              <h3 className="break-words text-[15px] font-semibold">{f.name}</h3>
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

      <Section
        title="Interface preview"
        description="Static styling samples for forms and tables. Nothing here is functional and no values are real."
        aside={<StatusBadge kind="demo" />}
      >
        <div className="grid gap-6 rounded-md border border-dashed border-input/60 p-4 sm:p-5">
          <div className="grid max-w-sm gap-1.5">
            <Label htmlFor="sample-field">Sample field</Label>
            <Input
              id="sample-field"
              disabled
              placeholder="Disabled design sample"
            />
            <p className="text-xs text-muted-foreground">
              Help text appears here, below the field.
            </p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Label</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {["Placeholder row A", "Placeholder row B"].map((row) => (
                  <TableRow key={row}>
                    <TableCell>{row}</TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell>
                      <StatusBadge kind="demo" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Section>
    </>
  );
}
