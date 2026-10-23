import Link from "next/link";
import { AskPanel } from "@/components/atlas/ask-panel";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { JourneyBar } from "@/components/journey-bar";
import { Checklist, Progress } from "@/components/compliance/checklist";
import { requireOrganization } from "@/lib/organization";
import { getT } from "@/lib/i18n/server";
import type { Tr } from "@/lib/landed-cost/labels";
import { resolveSubject } from "@/lib/subject";
import { sampleInputs } from "@/lib/landed-cost/defaults";
import {
  EVIDENCE_EXPLANATION,
  EVIDENCE_ORDER,
  FAMILIES,
  SECTION_TITLES,
  SOURCES,
  allItemIds,
  familyById,
  familyForEntry,
  itemsFor,
  type SectionKey,
} from "@/lib/compliance/content";

type Kind = "compliance" | "schemes";

const SECTIONS: Record<Kind, SectionKey[]> = {
  compliance: ["indianExport", "uaeImport", "testing", "packaging", "hs"],
  schemes: ["cepa", "schemes"],
};

const BADGE: Record<string, StatusKind> = { verified: "verified", secondary: "secondary", user: "user", inferred: "inferred", assumption: "assumption", unknown: "unknown" };

const copyFor = (t: Tr): Record<Kind, { eyebrow: string; title: (n: string | null) => string; intro: string; path: string; other: { href: string; label: string } }> => ({
  compliance: {
    eyebrow: t("Compliance Engine"),
    title: (n) => (n ? t("What would {name} have to meet?", { name: n }) : t("Compliance screening by product family")),
    intro: t("First-pass screening questions for your product type: Indian export checks, Destination import checks, testing, packaging and classification. These are questions to settle, not statements of what the law requires."),
    path: "/compliance",
    other: { href: "/schemes", label: t("CEPA and incentives") },
  },
  schemes: {
    eyebrow: t("Benefits Studio"),
    title: (n) => (n ? t("Which trade benefits might apply to {name}?", { name: n }) : t("CEPA and export-scheme screening by product family")),
    intro: t("Rules-of-origin questions for the bilateral trade agreement and Indian export schemes worth investigating. Eligibility is not decided here and no amounts are shown."),
    path: "/schemes",
    other: { href: "/compliance", label: t("Compliance screening") },
  },
});

/**
 * Product-aware screening page, shared by Compliance & Testing and CEPA & Incentives.
 * It responds to the selected product (or a chosen product family) and keeps five kinds of
 * information visibly apart: verified, manufacturer-provided, rule-based inference, assumption,
 * and unknown or needing expert confirmation.
 */
export async function ScreeningPage({ kind, searchParams }: { kind: Kind; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { organization } = await requireOrganization();
  const { t } = await getT();
  const sp = await searchParams;
  const copy = copyFor(t)[kind];
  const subject = await resolveSubject(organization.id, sp.product);
  const chosen = typeof sp.family === "string" ? familyById(sp.family) : null;
  const matched = familyForEntry(subject?.entry?.id);
  const family = matched ?? chosen;
  const reference = subject?.ref ?? (family ? `family-${family.id}` : "standalone");
  const defaults = sampleInputs(subject ? { ...subject.facts, label: subject.name } : undefined);
  const shared = { scope: organization.id, assessmentRef: reference, defaults };
  const ids = family ? allItemIds(family) : [];
  // The first question of each section, in an order that puts the importer, product code and testing ahead of paperwork.
  const ORDER: Record<Kind, SectionKey[]> = { compliance: ["uaeImport", "hs", "testing", "indianExport"], schemes: ["cepa", "schemes"] };
  const priority = family ? ORDER[kind].flatMap((sec) => itemsFor(family, sec).slice(0, kind === "schemes" ? 2 : 1)).slice(0, 4) : [];
  const sources = SOURCES.filter((s) => (kind === "compliance" ? ["uae-duty-general", "uae-vat"].includes(s.id) : ["cepa-in-force", "rodtep"].includes(s.id)));

  return (
    <>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title(subject?.name ?? null)}
        description={copy.intro}
        action={
          <Button asChild variant="outline">
            <Link href={subject ? `${copy.other.href}?product=${subject.ref}` : chosen ? `${copy.other.href}?family=${chosen.id}` : copy.other.href}>{copy.other.label}</Link>
          </Button>
        }
      />
      <JourneyBar current={kind === "compliance" ? "compliance" : "cepa"} reference={subject?.ref ?? null} family={family?.id ?? null} topic={kind === "compliance" ? "regulatory" : "cepa"} />

      <p className="mt-5 max-w-2xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{t("One thing to know for this whole page:")}</span> {t("nothing here has been checked against a primary official source. Treat every item as a question to put to an expert or the authority, not as a requirement or an approval.")}
      </p>

      {!family ? (
        <section className="mt-8" aria-labelledby="fam-h">
          <h2 id="fam-h" className="text-lg font-semibold tracking-tight">
            {subject ? t("Choose the closest product family") : t("Choose a product family")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {subject ? t("We could not match {name} to one of our product families automatically.", { name: subject.name }) : t("For screening that responds to a specific product, start from a product on the Export Opportunities page.")}
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {FAMILIES.map((f) => (
              <li key={f.id} className="flex flex-col rounded-lg border bg-card p-4 sm:p-5">
                <h3 className="text-base font-semibold">{t(f.name)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t(f.covers)}</p>
                <div className="mt-4 pt-1">
                  <Button asChild size="sm">
                    <Link href={`${copy.path}?${subject ? `product=${subject.ref}&` : ""}family=${f.id}`}>{t("Screen this family")}</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link href="/opportunities" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("Pick a product on Export Opportunities")}
            </Link>
          </p>
        </section>
      ) : (
        <>
          <section className="mt-8" aria-labelledby="ctx-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="ctx-h" className="text-xl font-semibold tracking-tight">
                {subject ? subject.name : t(family.name)}
              </h2>
              <span className="text-sm text-muted-foreground">{t("Screening family: {name}", { name: t(family.name) })}</span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t(family.covers)} {subject ? (matched ? t("Matched by simple rules from the product type.") : t("You chose this family.")) : ""}
            </p>
            <div className="mt-3">
              <Progress {...shared} ids={ids} />
            </div>
          </section>

          <section className="mt-8" aria-labelledby="start-h">
            <h2 id="start-h" className="text-lg font-medium tracking-tight">
              {t("Start with these {count}", { count: priority.length })}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("The few questions that unlock the most. Tick one when you have an answer. The rest are one click away.")}</p>
            <div className="mt-3">
              <Checklist {...shared} items={priority} />
            </div>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-2" aria-label={t("Where you stand")}>
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-medium tracking-[0.1em] text-muted-foreground">{t("What we know")}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                <li>{t("Your product matches the {family} family by simple rules.", { family: t(family.name).toLowerCase() })}</li>
                <li>{t("HS code you entered: {code}.", { code: subject?.hsCode ? t("{code} (unverified)", { code: subject.hsCode }) : t("none yet") })}</li>
                <li>{t("{count} screening questions apply, none verified.", { count: ids.length })}</li>
              </ul>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-medium tracking-[0.1em] text-muted-foreground">{t("What you can do now")}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                <li>{t("Answer the questions you already know, such as your IEC and who clears exports.")}</li>
                <li>{t("Ask your buyer who the importer of record is.")}</li>
                <li>
                  <Link href={subject ? `/opportunities/${subject.ref}?stage=3` : "/opportunities"} className="text-primary underline-offset-4 hover:underline">
                    {t("Narrow down your product code")}
                  </Link>
                  .
                </li>
              </ul>
            </div>
            <div className="rounded-lg border bg-card p-5 md:col-span-2">
              <h3 className="text-sm font-medium tracking-[0.1em] text-muted-foreground">{t("What needs an expert")}</h3>
              <p className="mt-2 text-sm">{t("Confirming the product code, destination technical requirements and CEPA origin rules. The platform cannot settle these.")}</p>
              <p className="mt-2 text-sm">
                <Link href={`/services?topic=${kind === "compliance" ? "regulatory" : "cepa"}${subject ? `&product=${subject.ref}` : ""}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {t("Prepare an expert brief")}
                </Link>
              </p>
            </div>
          </section>

          <details className="mt-10 rounded-lg border bg-card px-4 py-3 sm:px-5">
            <summary className="cursor-pointer text-base font-medium">{t("View all requirements ({count})", { count: ids.length })}</summary>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium">{t("How to read the labels")}</summary>
            <ul className="mt-3 space-y-2">
              {EVIDENCE_ORDER.map((e) => (
                <li key={e} className="grid gap-1 sm:grid-cols-[12rem_1fr] sm:gap-3">
                  <span>
                    <StatusBadge kind={BADGE[e]} />
                  </span>
                  <span className="text-muted-foreground">{t(EVIDENCE_EXPLANATION[e])}</span>
                </li>
              ))}
            </ul>
          </details>

          {SECTIONS[kind].map((s) => (
            <section key={s} id={s} className="mt-8 scroll-mt-20" aria-labelledby={`${s}-h`}>
              <h2 id={`${s}-h`} className="text-lg font-semibold tracking-tight">
                {t(SECTION_TITLES[s].title)}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t(SECTION_TITLES[s].blurb)}</p>
              {s === "hs" && (
                <div className="mt-3 rounded-lg border bg-card p-4 text-sm sm:p-5">
                  <p className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="inferred" />
                    <span>{t("Plastic articles are generally classified in HS chapter 39, with furniture in chapter 94. Candidate headings for a classifier to consider:")}</span>
                  </p>
                  <ul className="mt-2 space-y-1">
                    {family.hsCandidates.map((h) => (
                      <li key={h.heading}>
                        <span className="tnum font-semibold">{h.heading}</span> <span className="text-muted-foreground">{t(h.description)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">{t("These are candidates only, not a classification. The 6-digit code and the national tariff line decide duty and origin, and only a classifier or customs authority can settle them.")}</p>
                </div>
              )}
              <div className="mt-3">
                <Checklist {...shared} items={itemsFor(family, s)} />
              </div>
            </section>
          ))}

          </details>

          {kind === "schemes" && (
            <div className="mt-6">
              <AskPanel ids={["apply_schemes"]} refFor={subject?.ref ?? null} title={t("Let Atlas AI prepare your scheme steps")} />
              <Button asChild variant="outline" className="mt-3">
                <Link href="/schemes/finder">{t("Open Scheme Finder")}</Link>
              </Button>
            </div>
          )}

          {kind === "schemes" && (
            <div className="mt-6 rounded-lg border bg-card p-4 text-sm sm:p-5">
              <p className="font-medium">{t("Preferential duty in the calculator")}</p>
              <p className="mt-1 text-muted-foreground">{t("The landed-cost calculator has a preferential-tariff scenario so you can see the effect of a lower duty. It is a what-if. This page does not tell you whether you qualify.")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={subject ? `/viability?product=${subject.ref}#scenarios` : "/viability#scenarios"}>{t("Try the scenario in the calculator")}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={subject ? `/what-if/${subject.ref}` : "/what-if"}>{t("Open What-If Studio")}</Link>
                </Button>
              </div>
            </div>
          )}

          <details className="mt-8 rounded-lg border bg-card px-4 py-3 sm:px-5">
            <summary className="cursor-pointer text-sm font-medium">{t("Sources behind the few concrete facts")}</summary>
          <div className="mt-3">
            <ul className="mt-3 divide-y rounded-lg border bg-card">
              {sources.map((s) => (
                <li key={s.id} className="px-4 py-3 text-sm sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="secondary" />
                    <span className="font-medium">{t(s.fact)}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {t(s.publisher)}.{" "}
                    <Link href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {t("Open source")}
                    </Link>
                    . {t("Retrieved {date}. Official text opened by us: no.", { date: s.retrieved })}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(s.caveat)}</p>
                </li>
              ))}
            </ul>
          </div>

          </details>

          <div className="mt-10 flex flex-wrap items-center gap-3 border-t pt-5">
            <Button asChild size="lg" className="h-10 px-5">
              <Link href={kind === "compliance" ? `/schemes${subject ? `?product=${subject.ref}` : family ? `?family=${family.id}` : ""}` : subject ? `/roadmap?product=${subject.ref}` : "/roadmap"}>{kind === "compliance" ? t("Next: CEPA and incentives") : t("Next: your roadmap")}</Link>
            </Button>
            <Button asChild variant="ghost" className="h-10 px-3">
              <Link href={subject ? `/workspace/${subject.ref}` : "/workspace"}>{t("Back to my export workspace")}</Link>
            </Button>
          </div>
        </>
      )}
    </>
  );
}

