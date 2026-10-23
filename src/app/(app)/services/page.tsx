import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { JourneyBar } from "@/components/journey-bar";
import { ExpertsWorkspace } from "@/components/experts/experts-workspace";
import { requireOrganization } from "@/lib/organization";
import { listProducts } from "@/lib/capabilities";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { TOPICS } from "@/lib/experts/brief";
import type { RequestTopic } from "@/lib/workspace/types";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Assistance Hub · Atlas" };
export const instant = false;

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const sp = await searchParams;
  const product = typeof sp.product === "string" && sp.product ? sp.product : "standalone";
  const topicRaw = typeof sp.topic === "string" ? sp.topic : "";
  const topic = (TOPICS.some((tp) => tp.id === topicRaw) ? topicRaw : "review") as RequestTopic;
  const [{ facts, defaults }, products] = await Promise.all([loadWorkspaceFacts(organization, product), listProducts(organization.id)]);
  return (
    <>
      <PageHeader
        eyebrow={t("Expert assistance")}
        title={t("Ask an expert, with your context already filled in")}
        description={t("Pick what you need help with. The platform assembles a brief from your factory, product and assessment so you do not retype it. You review it and share it yourself.")}
      />
      <JourneyBar current="expert" reference={facts.standalone ? null : facts.ref} topic={topic} />
      <ExpertsWorkspace scope={organization.id} facts={facts} defaults={defaults} initialTopic={topic} products={products.map((p) => ({ ref: p.id, name: p.name }))} />
    </>
  );
}
