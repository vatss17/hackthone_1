import Link from "next/link";
import { requireOrganization } from "@/lib/organization";
import { listFactories } from "@/lib/factories";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ResumeJourney } from "@/components/overview/resume";
import { loadEngineInput } from "@/lib/capabilities";
import { CATALOGUE } from "@/lib/opportunities/catalogue";
import { FIT_LABEL, discover } from "@/lib/opportunities/engine";
import { nextStep } from "@/lib/overview/next-step";

const demoPath: [string, string][] = [
  ["Import a catalogue", "/products/import"],
  ["See what the factory could also make", "/opportunities"],
  ["Open a product: why it matches", "/opportunities"],
  ["Evidence and its limits", "/evidence"],
  ["Landed-cost scenarios", "/viability"],
  ["Compliance and incentive screening", "/compliance"],
  ["Roadmap and next best action", "/roadmap"],
  ["Draft documents", "/documentation"],
  ["Expert brief", "/services"],
];

const steps = [
  ["1", "Tell us what you make", "Your processes, machines and materials. A few short steps, and you can finish the detail later."],
  ["2", "See what you could export", "Products your factory could make, with the reasons why and what is missing."],
  ["3", "Know what to do next", "One clear next step at a time, from first look to a first UAE shipment."],
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
  const { active: factories } = await listFactories(organization.id);
  const isDemo = organization.name.startsWith("DEMO");
  const { input, counts } = factories.length ? await loadEngineInput(organization.id) : { input: null, counts: null };
  const found = input ? discover(input) : null;
  const top = found?.adjacent ?? [];
  const ownProducts = found?.yourProducts.length ?? 0;
  const step = nextStep({
    factories: factories.map((f) => ({ id: f.id, name: f.name })),
    profileTooThin: found?.profileTooThin ?? true,
    ownProducts,
    topOpportunity: top[0] ? { id: top[0].entry.id, name: top[0].entry.name, reason: top[0].reasons[0] ?? null } : null,
  });
  const isNew = !found || found.profileTooThin || ownProducts === 0;
  const names: Record<string, string> = { ...Object.fromEntries(CATALOGUE.map((e) => [e.id, e.name])), ...Object.fromEntries((found?.yourProducts ?? []).map((p) => [p.product.id, p.product.name])) };

  return (
    <>
      <section className="rise pt-2 sm:pt-6" aria-labelledby="hero-h">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{organization.name}</p>
        <h1 id="hero-h" className="t-display mt-4 max-w-3xl">
          From what you make to where you can grow.
        </h1>
        <p className="t-lead mt-5 max-w-2xl text-muted-foreground">Tell us what your factory makes. We show what else it could export to the UAE, why it suits you, and exactly what to do next.</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Button asChild size="lg" className="h-11 px-5 text-[15px]">
            <Link href="/opportunities">Explore export potential</Link>
          </Button>
          <nav aria-label="Jump to" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            <Link href="/factories" className="text-primary underline-offset-4 hover:underline">My factory</Link>
            <Link href="/products" className="text-primary underline-offset-4 hover:underline">My products</Link>
            <Link href="/workspace" className="text-primary underline-offset-4 hover:underline">My export workspace</Link>
          </nav>
        </div>
      </section>

      <section className="rise mt-12 rounded-xl bg-mint p-6 sm:p-8" aria-labelledby="next-h" style={{ animationDelay: "80ms" }}>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Your next step</p>
        <h2 id="next-h" className="mt-2 max-w-2xl text-2xl font-medium tracking-tight sm:text-3xl">
          {step.title}
        </h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-foreground/80">{step.why}</p>
        <div className="mt-5">
          <Button asChild size="lg" variant="outline" className="h-10 bg-card px-4">
            <Link href={step.cta.href}>{step.cta.label}</Link>
          </Button>
        </div>
      </section>

      <ResumeJourney scope={organization.id} names={names} />

      {isNew ? (
        <section className="mt-12" aria-labelledby="how-h">
          <h2 id="how-h" className="text-sm font-medium uppercase tracking-[0.12em] text-muted-foreground">
            How it works
          </h2>
          <ol className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-3">
            {steps.map(([n, t, d]) => (
              <li key={n}>
                <span className="font-mono text-sm text-primary">{n}</span>
                <h3 className="mt-1 text-lg font-medium tracking-tight">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="mt-12" aria-labelledby="opp-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="opp-h" className="text-sm font-medium uppercase tracking-[0.12em] text-muted-foreground">
              What your factory could also make
            </h2>
            <Link href="/opportunities" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              See all {top.length}
            </Link>
          </div>
          <ul className="mt-3 divide-y rounded-lg border bg-card">
            {top.slice(0, 3).map((m) => (
              <li key={m.entry.id}>
                <Link href={`/opportunities/${m.entry.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 transition-colors hover:bg-muted/60 sm:px-5">
                  <span className="font-medium">{m.entry.name}</span>
                  <span className="text-sm text-muted-foreground">{FIT_LABEL[m.level]}</span>
                </Link>
              </li>
            ))}
          </ul>
          {counts && (
            <p className="mt-2 text-xs text-muted-foreground">
              Worked out by rules from {counts.processes} process{counts.processes === 1 ? "" : "es"}, {counts.machines} machine{counts.machines === 1 ? "" : "s"} and {counts.materials} material{counts.materials === 1 ? "" : "s"} you declared. Manufacturing fit only, not demand.
            </p>
          )}
        </section>
      )}

      {isDemo && (
        <details className="mt-12 rounded-lg border border-dashed bg-card/60 p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-medium">Demo guide: a five-minute path (sample data)</summary>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {demoPath.map(([label, href], i) => (
              <li key={`${i}-${label}`} className="flex gap-2">
                <span className="w-4 shrink-0 font-mono text-primary">{i + 1}</span>
                <Link href={href} className="underline-offset-4 hover:underline">{label}</Link>
              </li>
            ))}
          </ol>
        </details>
      )}

      <details className="mt-12 rounded-lg border bg-card/60 p-4 sm:p-5">
        <summary className="cursor-pointer text-sm font-medium">How we label information</summary>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Regulatory, tariff and financial information carries one of these labels, so you can see what is verified, what is estimated and what is missing.</p>
        <dl className="mt-3 divide-y">
          {labels.map(({ kind, text }) => (
            <div key={kind} className="grid gap-1.5 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt>
                <StatusBadge kind={kind} />
              </dt>
              <dd className="text-sm text-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </details>

      <p className="mt-10 text-xs text-muted-foreground">
        {organization.legalName ?? organization.name} · {organization.role === "owner" ? "Owner" : "Member"} · Registered {registeredOn.format(new Date(organization.createdAt))} ·{" "}
        <Link href="/factories" className="underline underline-offset-2">
          Manage factories
        </Link>
      </p>
    </>
  );
}
