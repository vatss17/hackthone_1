import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/organization";
import { listFactories } from "@/lib/factories";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ResumeJourney } from "@/components/overview/resume";
import { listProducts, loadEngineInput } from "@/lib/capabilities";
import { GOAL_COOKIE, goalHref, parseGoal } from "@/lib/start/goal";
import { CATALOGUE } from "@/lib/opportunities/catalogue";
import { FIT_LABEL, discover } from "@/lib/opportunities/engine";
import { nextStep } from "@/lib/overview/next-step";
import { getT } from "@/lib/i18n/server";
import { nFactories, nMachines, nMaterials, nProcesses, tr } from "@/lib/opportunities/localize";
import { JOURNEY } from "@/config/journey";
import { FlaskConical, Globe2, Rocket, Sparkles } from "lucide-react";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { MissionCard } from "@/components/mission/mission-card";
import { AskPanel } from "@/components/atlas/ask-panel";

const STUDIOS = [
  { href: "/mission", icon: Rocket, title: "Mission Control", body: "The journey map, a task board and what depends on what, per export." },
  { href: "/world", icon: Globe2, title: "Factory to World", body: "Your capabilities, the products they make and where those products can go." },
  { href: "/what-if", icon: FlaskConical, title: "What-If Studio", body: "Move price, freight, exchange rate and duty. Your saved numbers stay as they are." },
  { href: "/workbench", icon: Sparkles, title: "AI Workbench", body: "Ask Atlas AI, watch each tool run, approve what it proposes, see its history." },
];

const demoPath: [string, string][] = JOURNEY.map((s) => [s.guide, s.href({ ref: null })]);

const steps = [
  ["1", "Tell us what you make", "Your processes, machines and materials. A few short steps, and you can finish the detail later."],
  ["2", "See what you could export", "Products your factory could make, with the reasons why and what is missing."],
  ["3", "Know what to do next", "One clear next step at a time, from first look to a first export shipment."],
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
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const { active: factories } = await listFactories(organization.id);
  // A company with no factory and no products that has not chosen a starting point is asked once. The start pages never redirect back here, so there is no loop.
  const goal = parseGoal((await cookies()).get(GOAL_COOKIE)?.value);
  const products = await listProducts(organization.id);
  if (factories.length === 0 && products.length === 0 && !goal) redirect("/start");
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
  const names: Record<string, string> = { ...Object.fromEntries(CATALOGUE.map((e) => [e.id, t(e.name)])), ...Object.fromEntries((found?.yourProducts ?? []).map((p) => [p.product.id, p.product.name])) };

  const missions = await Promise.all(products.slice(0, 3).map((p) => loadWorkspaceFacts(organization, p.id)));

  return (
    <>
      <section className="rise pt-1 sm:pt-3" aria-labelledby="hero-h">
        <p className="text-xs font-medium tracking-[0.14em] text-(--brand-teal)">{t("Command Center")} · {organization.name}</p>
        <h1 id="hero-h" className="t-display mt-3 max-w-3xl">
          {t("Every export, one view.")}
        </h1>
        <p className="t-lead mt-4 max-w-2xl text-muted-foreground">{t("Where each export stands, what is blocking it and the one thing to do next. Atlas AI can run any step for you.")}</p>
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="rise flex flex-col rounded-lg border bg-card p-6 sm:p-7" aria-labelledby="next-h" style={{ animationDelay: "60ms" }}>
          <p className="text-xs font-medium tracking-[0.14em] text-(--brand-teal)">{t("Your next step")}</p>
          <h2 id="next-h" className="mt-2 max-w-2xl text-xl font-semibold tracking-tight sm:text-2xl">
            {step.kind === "explore" && top[0] ? t("Take a look at {name}", { name: t(top[0].entry.name) }) : t(step.title)}
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-foreground/80">{tr(t, step.why)}</p>
          <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 pt-6">
            <Button asChild size="lg">
              <Link href={step.cta.href}>{t(step.cta.label)}</Link>
            </Button>
            <nav aria-label={t("Jump to")} className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
              <Link href="/opportunities" className="text-link underline-offset-4 hover:underline">{t("Opportunity Studio")}</Link>
              <Link href="/world" className="text-link underline-offset-4 hover:underline">{t("Factory to World")}</Link>
            </nav>
          </div>
        </section>
        <AskPanel ids={["find_opportunities", "explain_blockers", "calculate_landed_cost", "create_next_tasks"]} />
      </div>

      {missions.length > 0 && (
        <section className="mt-12" aria-labelledby="proj-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="proj-h" className="text-lg font-semibold tracking-tight">{t("Active export missions")}</h2>
            <Link href="/mission" className="text-sm font-medium text-link underline-offset-4 hover:underline">{t("All {count} in Mission Control", { count: products.length })}</Link>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {missions.map((m) => (
              <MissionCard key={m.facts.ref} scope={organization.id} facts={m.facts} defaults={m.defaults} />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("Progress counts the roadmap steps you have recorded as done. It is not a readiness score or an approval.")}</p>
        </section>
      )}

      {factories.length === 0 && products.length === 0 && (
        <section className="mt-12 rounded-lg border border-dashed bg-card/60 p-4 sm:p-5">
          <h2 className="text-base font-medium">{t("You have no export missions yet")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{goal === "B" ? t("Tell us about your factory to see what it could make.") : t("Add a product to get a first look, or register your factory to check manufacturing fit.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link href={goal ? goalHref(goal) : "/start"}>{goal === "B" ? t("Start with my factory") : t("Add a product")}</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/start">{t("Choose a different start")}</Link></Button>
            <Button asChild size="sm" variant="ghost"><Link href={goal ? goalHref(goal) : "/start"}>{t("Set up by chatting")}</Link></Button>
          </div>
        </section>
      )}

      <section className="mt-12" aria-labelledby="sig-h">
        <h2 id="sig-h" className="text-lg font-semibold tracking-tight">{t("Studios")}</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STUDIOS.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="group flex h-full flex-col rounded-lg border bg-card p-5 transition-colors hover:border-(--brand-teal)">
                <s.icon aria-hidden className="size-5 text-(--brand-teal)" />
                <span className="mt-3 font-semibold">{t(s.title)}</span>
                <span className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(s.body)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ResumeJourney scope={organization.id} names={names} />

      {isNew ? (
        <section className="mt-12" aria-labelledby="how-h">
          <h2 id="how-h" className="text-sm font-medium tracking-[0.12em] text-muted-foreground">
            {t("How it works")}
          </h2>
          <ol className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-3">
            {steps.map(([n, title, d]) => (
              <li key={n}>
                <span className="tnum text-sm text-primary">{n}</span>
                <h3 className="mt-1 text-lg font-medium tracking-tight">{t(title)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(d)}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="mt-12" aria-labelledby="opp-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="opp-h" className="text-sm font-medium tracking-[0.12em] text-muted-foreground">
              {t("What your factory could also make")}
            </h2>
            <Link href="/opportunities" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              {t("See all {count}", { count: top.length })}
            </Link>
          </div>
          <ul className="mt-3 divide-y rounded-lg border bg-card">
            {top.slice(0, 3).map((m) => (
              <li key={m.entry.id}>
                <Link href={`/opportunities/${m.entry.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 transition-colors hover:bg-muted/60 sm:px-5">
                  <span className="font-medium">{t(m.entry.name)}</span>
                  <span className="text-sm text-muted-foreground">{t(FIT_LABEL[m.level])}</span>
                </Link>
              </li>
            ))}
          </ul>
          {counts && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Worked out by rules from {processes}, {machines} and {materials} you declared. Manufacturing fit only, not demand.", { processes: nProcesses(t, counts.processes), machines: nMachines(t, counts.machines), materials: nMaterials(t, counts.materials) })}
            </p>
          )}
        </section>
      )}

      {isDemo && (
        <details className="mt-12 rounded-lg border border-dashed bg-card/60 p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-medium">{t("Demo guide: a five-minute path (sample data)")}</summary>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {demoPath.map(([label, href], i) => (
              <li key={`${i}-${label}`} className="flex gap-2">
                <span className="w-4 shrink-0 tnum text-primary">{i + 1}</span>
                <Link href={href} className="underline-offset-4 hover:underline">{t(label)}</Link>
              </li>
            ))}
          </ol>
        </details>
      )}

      <details className="mt-12 rounded-lg border bg-card/60 p-4 sm:p-5">
        <summary className="cursor-pointer text-sm font-medium">{t("How we label information")}</summary>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("Regulatory, tariff and financial information carries one of these labels, so you can see what is verified, what is estimated and what is missing.")}</p>
        <dl className="mt-3 divide-y">
          {labels.map(({ kind, text }) => (
            <div key={kind} className="grid gap-1.5 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt>
                <StatusBadge kind={kind} />
              </dt>
              <dd className="text-sm text-muted-foreground">{t(text)}</dd>
            </div>
          ))}
        </dl>
      </details>

      <p className="mt-10 text-xs text-muted-foreground">
        {organization.legalName ?? organization.name} · {organization.role === "owner" ? t("Owner") : t("Member")} · {t("Registered {date}", { date: registeredOn.format(new Date(organization.createdAt)) })} · {nFactories(t, factories.length)}: {factories.map((f) => f.name).join(", ")} ·{" "}
        <Link href="/factories" className="underline underline-offset-2">
          {t("Manage factories")}
        </Link>
      </p>
    </>
  );
}
