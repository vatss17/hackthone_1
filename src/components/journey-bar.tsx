import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { JOURNEY, neighbours, workspaceHref, type JourneyStepId } from "@/config/journey";
import { CATALOGUE } from "@/lib/opportunities/catalogue";
import { getProductName } from "@/lib/capabilities";
import { requireOrganization } from "@/lib/organization";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/** Older names for steps, still accepted so every page keeps working. */
export type JourneyStep = JourneyStepId | "workspace" | "profile" | "scenarios" | "mission" | "whatif";
const ALIAS: Record<string, JourneyStepId | null> = { workspace: null, profile: "catalogue", scenarios: "cost", mission: null, whatif: null };

/**
 * Where you are in the export journey, and which product you are working on.
 *  - The product line stays visible on every product page: its name, whether it is yours or a suggestion, and a way to change it.
 *  - From a tablet width up, every step is shown and wraps onto more lines instead of hiding behind a sideways scroll.
 *  - On a narrow screen one selector opens a list of every step, with Previous and Next beside it.
 * All steps are real links, so keyboard and screen-reader users reach each of them; the current one carries aria-current.
 * `reference` is a product id, a catalogue id, or null for a general view.
 */
export async function JourneyBar({ current, reference, family = null, topic = null }: { current: JourneyStep; reference: string | null; family?: string | null; topic?: string | null }) {
  const { t } = await getT();
  const id = (current in ALIAS ? ALIAS[current] : current) as JourneyStepId | null;
  const ref = reference && reference !== "standalone" ? reference : null;
  const ctx = { ref, family, topic };
  const { prev, next, index } = id ? neighbours(id) : { prev: null, next: null, index: -1 };
  const here = index >= 0 ? JOURNEY[index] : null;

  let product: { name: string; own: boolean } | null = null;
  if (ref) {
    const { organization } = await requireOrganization();
    const own = await getProductName(organization.id, ref);
    const suggested = CATALOGUE.find((e) => e.id === ref)?.name;
    product = own ? { name: own, own: true } : suggested ? { name: suggested, own: false } : null;
  }

  const step = (sid: JourneyStepId) => JOURNEY.find((x) => x.id === sid)!.href(ctx);
  const tabs: { label: string; href: string; on: boolean }[] = [
    { label: "Overview", href: workspaceHref(ctx), on: id === null ? current !== "mission" && current !== "whatif" : ["catalogue", "factory", "opportunities", "explore", "evidence", "feasibility"].includes(id) },
    { label: "Mission", href: ref ? `/mission/${ref}` : "/mission", on: current === "mission" },
    { label: "Economics", href: step("cost"), on: id === "cost" },
    { label: "What-if", href: ref ? `/what-if/${ref}` : "/what-if", on: current === "whatif" },
    { label: "Requirements", href: step("compliance"), on: id === "compliance" || id === "cepa" },
    { label: "Action plan", href: step("roadmap"), on: id === "roadmap" },
    { label: "Documents", href: step("documents"), on: id === "documents" },
    { label: "Expert help", href: step("expert"), on: id === "expert" },
  ];

  return (
    <nav aria-label={t("Export journey")} className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        {product ? (
          <p className="flex min-w-0 items-center gap-2">
            <Package aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="sr-only text-muted-foreground sm:not-sr-only">{t("Working on")}</span>
            <span className="min-w-0 truncate font-semibold" title={product.name}>{product.name}</span>
            <span className="shrink-0 rounded border px-1.5 text-xs text-muted-foreground">{product.own ? t("Your product") : t("Suggested")}</span>
          </p>
        ) : (
          <p className="text-muted-foreground">{ref ? t("Export journey") : t("General view: no product selected")}</p>
        )}
        <Link href="/workspace" className="text-[13px] font-medium text-primary underline-offset-4 hover:underline">
          {product ? t("Change product") : t("Choose a product")}
        </Link>
      </div>

      <ul className="mt-2 grid grid-cols-4 border-b sm:flex sm:flex-wrap sm:gap-x-1" aria-label={t("Product sections")}>
        {tabs.map((tab) => (
          <li key={tab.label} className="min-w-0">
            <Link href={tab.href} aria-current={tab.on ? "page" : undefined} className={cn("-mb-px inline-flex min-h-11 w-full items-center justify-center border-b-2 px-2 text-center text-[13px] sm:w-auto sm:justify-start sm:px-3 sm:text-sm md:min-h-10", tab.on ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t(tab.label)}
            </Link>
          </li>
        ))}
      </ul>

      <details className="group mt-2" open={false}>
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRight aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-90" />
          <span>
            {t("Export journey")}
            {here ? <>: <span className="font-medium text-foreground">{t("step {n} of {total}, {label}", { n: index + 1, total: JOURNEY.length, label: t(here.label) })}</span></> : `: ${t("all 12 steps")}`}
          </span>
        </summary>
        <ol className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNEY.map((s, i) => (
            <li key={s.id}>
              <Link href={s.href(ctx)} aria-current={s.id === id ? "step" : undefined} className={cn("flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm transition-colors hover:bg-secondary", s.id === id ? "border-primary bg-mint font-medium" : "bg-card")}>
                <span className="tnum w-5 text-xs text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 truncate">{t(s.label)}</span>
                {s.id === id && <span className="ml-auto text-xs text-muted-foreground">{t("You are here")}</span>}
              </Link>
            </li>
          ))}
        </ol>
        <div className="mt-2 flex gap-2">
          {prev && <Link href={prev.href(ctx)} aria-label={`${t("Previous step")}: ${t(prev.label)}`} className="inline-flex h-10 items-center rounded-md border bg-card px-3 text-[13px] hover:bg-secondary md:hidden">←</Link>}
          {next && <Link href={next.href(ctx)} aria-label={`${t("Next step")}: ${t(next.label)}`} className="inline-flex h-10 items-center rounded-md border bg-card px-3 text-[13px] hover:bg-secondary md:hidden">→</Link>}
          {prev && <Link href={prev.href(ctx)} className="hidden h-9 items-center rounded-md border bg-card px-3 text-[13px] hover:bg-secondary md:inline-flex">← {t(prev.label)}</Link>}
          {next && <Link href={next.href(ctx)} className="hidden h-9 items-center rounded-md border bg-card px-3 text-[13px] hover:bg-secondary md:inline-flex">{t(next.label)} →</Link>}
        </div>
      </details>
    </nav>
  );
}
