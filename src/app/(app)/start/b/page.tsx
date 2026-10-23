import type { Metadata } from "next";
import { StartFactoryFlow } from "@/components/start/start-factory-flow";
import { requireOrganization } from "@/lib/organization";

export const metadata: Metadata = { title: "Discover products · Atlas" };
export const instant = false;

export default async function StartBPage({ searchParams }: PageProps<"/start/b">) {
  await requireOrganization();
  const sp = await searchParams;
  return <StartFactoryFlow error={typeof sp.error === "string" ? sp.error : undefined} />;
}
