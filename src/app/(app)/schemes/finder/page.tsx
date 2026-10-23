import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SchemeFinder, type SchemeInfo } from "@/components/schemes/scheme-finder";
import { requireOrganization } from "@/lib/organization";
import { aiStatus } from "@/lib/ai/provider";
import { schemeFinderContext } from "@/lib/actions/schemes";
import { SCHEMES } from "@/lib/schemes/finder";
import { RESEARCH } from "@/lib/research/answers";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Scheme Finder · Atlas" };
export const instant = false;

export default async function SchemeFinderPage() {
  const { organization } = await requireOrganization();
  const { t } = await getT();
  const ctx = await schemeFinderContext();
  const info: Record<string, SchemeInfo> = {};
  for (const s of SCHEMES) {
    const r = RESEARCH[s.researchIds[0]];
    if (r) info[s.researchIds[0]] = { answer: r.answer, keyPoints: r.keyPoints, confidence: r.confidence, whatToConfirm: r.whatToConfirm, sources: r.sources };
  }
  return (
    <>
      <PageHeader
        eyebrow={t("Benefits Studio")}
        title={t("Which schemes are worth checking for your product?")}
        description={t("Atlas looks at what you export and where, then lists the researched Indian export schemes and trade-agreement benefits that may matter, with why, what to confirm and the sources. It never decides eligibility.")}
      />
      <div className="mt-8">
        <SchemeFinder scope={organization.id} products={ctx.products} state={ctx.state} info={info} aiOn={aiStatus(process.env).configured} />
      </div>
    </>
  );
}
