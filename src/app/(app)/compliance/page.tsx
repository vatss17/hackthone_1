import type { Metadata } from "next";
import { ScreeningPage } from "@/components/compliance/screening";
import { requireOrganization } from "@/lib/organization";

export const metadata: Metadata = { title: "Compliance Engine · Atlas" };
export const instant = false;

export default async function CompliancePage({ searchParams }: PageProps<"/compliance">) {
  // Verified here as well as inside the screening page: every protected page checks the user itself.
  await requireOrganization();
  return <ScreeningPage kind="compliance" searchParams={searchParams} />;
}
