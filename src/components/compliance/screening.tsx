import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { JourneyBar } from "@/components/journey-bar";
import { Checklist, Progress } from "@/components/compliance/checklist";
import { requireOrganization } from "@/lib/organization";
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

const COPY: Record<Kind, { eyebrow: string; title: (n: string | null) => string; intro: string; path: string; other: { href: string; label: string } }> = {
  compliance: {
    eyebrow: "Compliance & Testing",
    title: (n) => (n ? `What would ${n} have to meet?` : "Compliance screening by product family"),
    intro: "First-pass screening questions for your product type: Indian export checks, UAE import checks, testing, packaging and classification. These are questions to settle, not statements of what the law requires.",
    path: "/compliance",
    other: { href: "/schemes", label: "CEPA and incentives" },
  },
  schemes: {
    eyebrow: "CEPA & Incentives",
    title: (n) => (n ? `Which trade benefits might apply to ${n}?` : "CEPA and export-scheme screening by product family"),
    intro: "Rules-of-origin questions for the India–UAE agreement and Indian export schemes worth investigating. Eligibility is not decided here and no amounts are shown.",
    path: "/schemes",
    other: { href: "/compliance", label: "Compliance screening" },
  },
};

/**
 * Product-aware screening page, shared by Compliance & Testing and CEPA & Incentives.
 * It responds to the selected product (or a chosen product family) and keeps five kinds of
 * information visibly apart: verified, manufacturer-provided, rule-based inference, assumption,
 * and unknown or needing expert confirmation.
 */
export async function ScreeningPage({ kind, searchParams }: { kind: Kind; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { organization } = await requireOrganization();
  const sp = await searchParams;
  const copy = COPY[kind];
  const subject = await resolveSubject(organization.id, sp.product);
  const chosen = typeof sp.family === "string" ? familyById(sp.family) : null;
  const matched = familyForEntry(subject?.entry?.id);
  const family = matched ?? chosen;
  const reference = subject?.ref ?? (family ? `family-${family.id}` : "standalone");
  const defaults = sampleInputs(subject ? { ...subject.facts, label: subject.name } : undefined);
  const shared = { scope: organization.id, assessmentRef: reference, defaults };
  const ids = family ? allItemIds(family) : [];
  const sources = SOURCES.filter((s) => (kind === "compliance" ? ["uae-duty-general", "uae-vat"].includes(s.id) : ["cepa-in-force", "rodtep"].includes(s.id)));

  return (
    <>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title(subject?.name ?? null)}
        description={copy.intro}
        action={
          <Button asChild variant="outline">
            <Link href={subject ? `${copy.other.href}?product=${subject.ref}` : copy.other.href}>{copy.other.label}</Link>
          </Button>
        }
      />
      <JourneyBar current="feasibility" reference={subject?.ref ?? null} />

      <div className="mt-5 rounded-md border border-(--status-estimate-border) bg-(--status-estimate-bg) px-4 py-3 text-sm text-(--status-estimate-fg) sm:px-5">
        <p className="font-medium">Nothing on this page has been verified against a primary official source.</p>
        <p className="mt-0.5">We could not open the official pages during this build. A few background facts are drawn from secondary sources and marked as such. Treat everything as a prompt to ask an expert or the authority, not as a requirement or an approval.</p>
      </div>

      {!family ? (
        <section className="mt-8" aria-labelledby="fam-h">
          <h2 id="fam-h" className="text-lg font-semibold tracking-tight">
            {subject ? "Choose the closest product family" : "Choose a product family"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {subject ? `We could not match ${subject.name} to one of our product families automatically.` : "For screening that responds to a specific product, start from a product on the Export Opportunities page."}
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {FAMILIES.map((f) => (
              <li key={f.id} className="flex flex-col rounded-md border bg-card p-4 sm:p-5">
                <h3 className="text-base font-semibold">{f.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.covers}</p>
                <div className="mt-4 pt-1">
                  <Button asChild size="sm">
                    <Link href={`${copy.path}?${subject ? `product=${subject.ref}&` : ""}family=${f.id}`}>Screen this family</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link href="/opportunities" className="font-medium text-primary underline-offset-4 hover:underline">
              Pick a product on Export Opportunities
            </Link>
          </p>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-md border bg-card p-4 sm:p-5" aria-labelledby="ctx-h">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 id="ctx-h" className="text-base font-semibold tracking-tight">
                  {subject ? subject.name : family.name}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Screening family: <span className="font-medium text-foreground">{family.name}</span>. {family.covers}
                </p>
              </div>
              <StatusBadge kind={subject ? "inferred" : "user"} />
            </div>
            {subject && (
              <p className="mt-2 text-xs text-muted-foreground">
                {matched ? "Matched to this family by simple rules from the product type. If that is wrong, choose another family below." : "You chose this family."}{" "}
                HS code you claimed: {subject.hsCode ? `${subject.hsCode} (unverified)` : "none yet"}.
              </p>
            )}
            <div className="mt-3 border-t pt-3">
              <Progress {...shared} ids={ids} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {FAMILIES.filter((f) => f.id !== family.id).map((f) => (
                <Link key={f.id} href={`${copy.path}?${subject ? `product=${subject.ref}&` : ""}family=${f.id}`} className="text-primary underline-offset-4 hover:underline">
                  Use {f.name} instead
                </Link>
              ))}
            </div>
          </section>

          <details className="mt-5 rounded-md border bg-card px-4 py-3 text-sm sm:px-5">
            <summary className="cursor-pointer font-medium">How to read the labels</summary>
            <ul className="mt-3 space-y-2">
              {EVIDENCE_ORDER.map((e) => (
                <li key={e} className="grid gap-1 sm:grid-cols-[12rem_1fr] sm:gap-3">
                  <span>
                    <StatusBadge kind={BADGE[e]} />
                  </span>
                  <span className="text-muted-foreground">{EVIDENCE_EXPLANATION[e]}</span>
                </li>
              ))}
            </ul>
          </details>

          {SECTIONS[kind].map((s) => (
            <section key={s} id={s} className="mt-10 scroll-mt-20" aria-labelledby={`${s}-h`}>
              <h2 id={`${s}-h`} className="text-lg font-semibold tracking-tight">
                {SECTION_TITLES[s].title}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{SECTION_TITLES[s].blurb}</p>
              {s === "hs" && (
                <div className="mt-3 rounded-md border bg-card p-4 text-sm sm:p-5">
                  <p className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="inferred" />
                    <span>Plastic articles are generally classified in HS chapter 39, with furniture in chapter 94. Candidate headings for a classifier to consider:</span>
                  </p>
                  <ul className="mt-2 space-y-1">
                    {family.hsCandidates.map((h) => (
                      <li key={h.heading}>
                        <span className="font-mono font-semibold">{h.heading}</span> <span className="text-muted-foreground">{h.description}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">These are candidates only, not a classification. The 6-digit code and the national tariff line decide duty and origin, and only a classifier or customs authority can settle them.</p>
                </div>
              )}
              <div className="mt-3">
                <Checklist {...shared} items={itemsFor(family, s)} />
              </div>
            </section>
          ))}

          {kind === "schemes" && (
            <div className="mt-6 rounded-md border bg-card p-4 text-sm sm:p-5">
              <p className="font-medium">Preferential duty in the calculator</p>
              <p className="mt-1 text-muted-foreground">The landed-cost calculator has a preferential-tariff scenario so you can see the effect of a lower duty. It is a what-if. This page does not tell you whether you qualify.</p>
              <Button asChild variant="outline" className="mt-3">
                <Link href={subject ? `/viability?product=${subject.ref}#scenarios` : "/viability#scenarios"}>Try the scenario in the calculator</Link>
              </Button>
            </div>
          )}

          <section className="mt-10" aria-labelledby="src-h">
            <h2 id="src-h" className="text-lg font-semibold tracking-tight">
              Sources behind the few concrete facts
            </h2>
            <ul className="mt-3 divide-y rounded-md border bg-card">
              {sources.map((s) => (
                <li key={s.id} className="px-4 py-3 text-sm sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="secondary" />
                    <span className="font-medium">{s.fact}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {s.publisher}.{" "}
                    <Link href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      Open source
                    </Link>
                    . Retrieved {s.retrieved}. Official text opened by us: no.
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.caveat}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10 rounded-md border bg-card p-4 sm:p-5" aria-labelledby="go-h">
            <h2 id="go-h" className="text-base font-semibold tracking-tight">
              Keep going
            </h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/feasibility/${subject?.ref ?? "standalone"}`}>Back to export feasibility</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/services">Ask an expert (preview)</Link>
              </Button>
            </div>
          </section>
        </>
      )}
    </>
  );
}

