import type { Metadata } from "next";
import { ScreeningPage } from "@/components/compliance/screening";
import { requireOrganization } from "@/lib/organization";

export const metadata: Metadata = { title: "Benefits Studio · Atlas" };
export const instant = false;

export default async function SchemesPage({ searchParams }: PageProps<"/schemes">) {
  // Verified here as well as inside the screening page: every protected page checks the user itself.
  await requireOrganization();
  return <ScreeningPage kind="schemes" searchParams={searchParams} />;
}
