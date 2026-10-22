import type { Metadata } from "next";
import { StatusBadge } from "@/components/status-badge";
import { FeaturePreview } from "@/components/preview/feature-preview";
import { requireOrganization } from "@/lib/organization";
import { resolveSubject } from "@/lib/subject";
import { COMMON_CONSIDERATIONS } from "@/lib/opportunities/catalogue";

export const metadata: Metadata = { title: "Compliance & Testing · Export Enablement Platform" };
export const instant = false;

export default async function CompliancePage({ searchParams }: PageProps<"/compliance">) {
  const { organization } = await requireOrganization();
  const subject = await resolveSubject(organization.id, (await searchParams).product);
  const topics = [...(subject?.entry?.regulatoryFocus.map((t) => ({ topic: t, note: "Applicability to this product has not been assessed." })) ?? []), ...COMMON_CONSIDERATIONS];
  return (
    <FeaturePreview
      eyebrow="Compliance & Testing"
      title="What would this product have to meet?"
      intro="This step will screen a product against UAE requirements that are backed by official sources, and list the testing and certification gaps between what you hold and what is needed."
      does={[
        "Show which requirements apply to your product, with the official source, passage and retrieval date for each.",
        "Compare them with the tests and certificates you have recorded and list what is missing.",
        "Say plainly when something is unknown or unverified. It will never present a guess as a requirement.",
      ]}
      needs={[
        { label: "A product and its materials", kind: subject ? (subject.own ? "user" : "inferred") : "missing", note: subject ? `${subject.name} is selected.` : "Choose a product on the Export Opportunities page." },
        { label: "Verified HS classification", kind: "missing", note: "Any code you enter is your own claim until confirmed." },
        { label: "Existing tests and certificates", kind: "missing", note: "Certificates are not collected yet." },
        { label: "Official UAE and GCC requirement sources", kind: "missing", note: "Not connected, so no requirement is stated as fact." },
      ]}
      sources={["Official UAE and GCC technical regulation and conformity sources", "Accredited laboratory and certification body information", "Verified tariff classification references"]}
      next={{
        href: subject ? `/opportunities/${subject.ref}` : "/opportunities",
        label: subject ? `Back to ${subject.name}` : "Go to Export Opportunities",
        note: "Meanwhile, the product exploration page lists topics to check for each product, clearly marked as not assessed.",
      }}
    >
      <section className="mt-10" aria-labelledby="topics-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="topics-h" className="text-lg font-semibold tracking-tight">
            {subject ? `Topics to check for ${subject.name}` : "Topics that apply to most plastic products"}
          </h2>
          <StatusBadge kind="missing" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Questions to settle, not findings. None has been checked against official sources.</p>
        <ul className="mt-3 divide-y rounded-md border bg-card">
          {topics.map((c) => (
            <li key={c.topic} className="grid gap-1 px-4 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4 sm:px-5">
              <p className="text-sm font-medium">{c.topic}</p>
              <p className="text-sm text-muted-foreground">{c.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </FeaturePreview>
  );
}
