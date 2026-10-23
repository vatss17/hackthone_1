import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingHead, OnboardingNext } from "@/components/auth/page-heads";
import { CompanyForm } from "@/components/onboarding/company-form";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganization } from "@/lib/organization";

export const metadata: Metadata = { title: "Register your company · Atlas" };
export const instant = false;

export default async function OnboardingPage() {
  await requireUser();
  // An existing owner never sees registration again.
  if (await getCurrentOrganization()) redirect("/");

  return (
    <>
      <OnboardingHead />
      <div className="mt-6 rounded-lg border bg-card p-5 sm:p-6">
        <CompanyForm />
      </div>

      <OnboardingNext />
    </>
  );
}
