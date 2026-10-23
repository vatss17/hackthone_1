import type { Metadata } from "next";
import { StartProductFlow } from "@/components/start/start-product-flow";
import { requireOrganization } from "@/lib/organization";

export const metadata: Metadata = { title: "Add a product · Atlas" };
export const instant = false;

export default async function StartAPage({ searchParams }: PageProps<"/start/a">) {
  await requireOrganization();
  const sp = await searchParams;
  return <StartProductFlow error={typeof sp.error === "string" ? sp.error : undefined} />;
}
