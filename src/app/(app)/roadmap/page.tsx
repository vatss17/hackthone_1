import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, CircleDashedIcon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { FeaturePreview } from "@/components/preview/feature-preview";
import { requireOrganization } from "@/lib/organization";
import { loadEngineInput } from "@/lib/capabilities";
import { resolveSubject } from "@/lib/subject";
import { JourneyBar } from "@/components/journey-bar";
import { RoadmapActions } from "@/components/feasibility/client-parts";
import { sampleInputs } from "@/lib/landed-cost/defaults";
import { allItemIds, familyForEntry } from "@/lib/compliance/content";

export const metadata: Metadata = { title: "Export Readiness Roadmap · Export Enablement Platform" };
export const instant = false;

export default async function RoadmapPage({ searchParams }: PageProps<"/roadmap">) {
  const { organization } = await requireOrganization();
  const subject = await resolveSubject(organization.id, (await searchParams).product);
  const family = familyForEntry(subject?.entry?.id);
  const { counts, factories } = await loadEngineInput(organization.id);
  const profileHref = factories[0] ? `/factories/${factories[0].id}` : "/factories";
  const steps = [
    { label: "Register your company", done: true, href: "/" },
    { label: "Register a factory", done: factories.length > 0, href: "/factories/new" },
    { label: "Declare manufacturing processes", done: counts.processes > 0, href: `${profileHref}#processes` },
    { label: "Declare machinery", done: counts.machines > 0, href: `${profileHref}#machinery` },
    { label: "Declare materials", done: counts.materials > 0, href: `${profileHref}#materials` },
    { label: "Add a finished product", done: counts.products > 0, href: "/products/new" },
  ];
  const done = steps.filter((s) => s.done).length;
  const later = [
    { label: "Explore a product's export potential", href: "/opportunities", note: "Available now" },
    { label: "Estimate landed cost and margin", href: "/viability", note: "Available now" },
    { label: "Review export feasibility", href: "/feasibility", note: "Available now" },
    { label: "Screen compliance and plan testing", href: "/compliance", note: "First-pass questions" },
    { label: "Check CEPA and incentives", href: "/schemes", note: "First-pass questions" },
    { label: "Prepare export documents", href: "/documentation", note: "Preview" },
    { label: "Request expert help for gaps", href: "/services", note: "Preview" },
  ];
  return (
    <FeaturePreview
      topBar={<JourneyBar current="roadmap" reference={subject?.ref ?? null} />}
      eyebrow="Export Readiness Roadmap"
      title="Your path to a first export"
      intro="This step will turn everything the platform learns into a prioritised action plan with progress you can track and share. The profile steps below are real and reflect your saved records."
      does={[
        "Rank the next actions by what unlocks the most progress for the product you choose.",
        "Track progress as your profile, evidence and documents improve.",
        "Produce a readiness summary you can share with partners or advisers.",
      ]}
      needs={[
        { label: "A completed factory profile", kind: done === steps.length ? "user" : "missing", note: `${done} of ${steps.length} profile steps done.` },
        { label: "A product under investigation", kind: counts.products > 0 ? "user" : "missing", note: "Chosen from Export Opportunities." },
        { label: "Results from the document steps", kind: "missing", note: "Export documents are a preview today. Cost and screening results feed the actions above." },
      ]}
      sources={["Verified requirements and costs that rank the actions", "Expert review status of each item"]}
      next={{ href: "/opportunities", label: "Go to Export Opportunities", note: "The fastest way to move forward today is to explore a product." }}
    >
      {subject && (
        <section className="mt-10" aria-labelledby="prod-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="prod-h" className="text-lg font-semibold tracking-tight">
              Next actions for {subject.name}
            </h2>
            <StatusBadge kind="inferred" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Ordered from the things that unlock the most. Progress reflects what you have done in the calculator and screening pages in this browser.</p>
          <RoadmapActions
            scope={organization.id}
            assessmentRef={subject.ref}
            defaults={sampleInputs({ ...subject.facts, label: subject.name })}
            productRef={subject.ref}
            hasProduct
            checksTotal={family ? allItemIds(family).length : 0}
          />
          <p className="mt-3 text-sm">
            <Link href={`/feasibility/${subject.ref}`} className="font-medium text-primary underline-offset-4 hover:underline">
              Back to the feasibility workspace
            </Link>
          </p>
        </section>
      )}

      <section className="mt-10" aria-labelledby="steps-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="steps-h" className="text-lg font-semibold tracking-tight">
            Profile progress: {done} of {steps.length}
          </h2>
          <StatusBadge kind="user" />
        </div>
        <ul className="mt-3 divide-y rounded-md border bg-card">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
              <span className="flex items-center gap-2">
                {s.done ? <CheckIcon className="size-4 text-primary" aria-hidden /> : <CircleDashedIcon className="size-4 text-muted-foreground" aria-hidden />}
                <span className={s.done ? "" : "text-muted-foreground"}>{s.label}</span>
                <span className="sr-only">{s.done ? "(done)" : "(not yet)"}</span>
              </span>
              {!s.done && (
                <Link href={s.href} className="font-medium text-primary underline-offset-4 hover:underline">
                  Do this
                </Link>
              )}
            </li>
          ))}
        </ul>
        <h2 className="mt-8 text-lg font-semibold tracking-tight">Then</h2>
        <ul className="mt-3 divide-y rounded-md border bg-card">
          {later.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
              <Link href={s.href} className="font-medium underline-offset-4 hover:underline">
                {s.label}
              </Link>
              <span className="text-xs text-muted-foreground">{s.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </FeaturePreview>
  );
}
