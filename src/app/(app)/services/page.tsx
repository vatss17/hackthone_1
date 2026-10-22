import type { Metadata } from "next";
import { StatusBadge } from "@/components/status-badge";
import { FeaturePreview } from "@/components/preview/feature-preview";
import { requireOrganization } from "@/lib/organization";

export const metadata: Metadata = { title: "Expert Assistance · Export Enablement Platform" };
export const instant = false;

const EXPERTS = [
  { name: "Testing and certification", does: "Arrange product tests and certificates identified as gaps." },
  { name: "Customs and trade compliance", does: "Confirm classification, origin and documentation." },
  { name: "Freight and logistics", does: "Obtain freight quotes and routing advice." },
  { name: "Product and tooling engineering", does: "Judge whether your machines and moulds can make a new product." },
];

export default async function ServicesPage() {
  await requireOrganization();
  return (
    <FeaturePreview
      eyebrow="Expert Assistance"
      title="Get help with what you cannot do alone"
      intro="This step will let you send a clear request, with your context attached, to a qualified expert. The platform coordinates the request. It does not provide the advice itself."
      does={[
        "Turn a gap found elsewhere (for example a missing test) into a ready-to-send request with the relevant facts attached.",
        "Show which expert type suits the question and what to expect back.",
        "Keep the request and its status in one place.",
      ]}
      needs={[
        { label: "A reason to ask", kind: "missing", note: "A gap or question from the opportunity, compliance or cost steps." },
        { label: "Your consent to share details", kind: "missing", note: "Nothing is shared without your explicit approval." },
        { label: "Connected experts", kind: "missing", note: "No experts are connected yet, so requests cannot be sent." },
      ]}
      sources={["Vetted expert and laboratory directory", "Request and quote tracking", "Expert review labels shown on reviewed items (none are in use today)"]}
      next={{ href: "/opportunities", label: "Go to Export Opportunities", note: "Start by finding a product worth investigating. Gaps you find will become expert requests." }}
    >
      <section className="mt-10" aria-labelledby="types-h">
        <h2 id="types-h" className="text-lg font-semibold tracking-tight">
          Kinds of help planned
        </h2>
        <ul className="mt-3 divide-y rounded-md border bg-card">
          {EXPERTS.map((e) => (
            <li key={e.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <div>
                <p className="text-sm font-medium">{e.name}</p>
                <p className="text-sm text-muted-foreground">{e.does}</p>
              </div>
              <StatusBadge kind="planned" />
            </li>
          ))}
        </ul>
      </section>
    </FeaturePreview>
  );
}
