import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { CompanyForm } from "@/components/onboarding/company-form";
import { requireUser } from "@/lib/auth";
import { getCurrentOrganization } from "@/lib/organization";

export const metadata: Metadata = { title: "Register your company · Export Enablement Platform" };
export const instant = false;

export default async function OnboardingPage() {
  await requireUser();
  // An existing owner never sees registration again.
  if (await getCurrentOrganization()) redirect("/");

  return (
    <>
      <PageHeader
        eyebrow="Get started"
        title="Register your company"
        description="Tell us which business you are exporting for. This creates your company account, and you become its owner."
      />
      <div className="mt-6 rounded-md border bg-card p-5 sm:p-6">
        <CompanyForm />
      </div>

      <section className="mt-8" aria-labelledby="next-heading">
        <h2 id="next-heading" className="text-base font-semibold tracking-tight">
          What happens next
        </h2>
        <ol className="mt-3 divide-y rounded-md border bg-card text-sm">
          {[
            "Your company account is created and you become its owner.",
            "You go to your dashboard, which shows your company name.",
            "Factory details, products and documents come in later steps. For now we store only the names above.",
          ].map((text, i) => (
            <li key={text} className="flex gap-4 px-4 py-3 sm:px-5">
              <span className="w-4 shrink-0 font-mono text-primary">{i + 1}</span>
              <span className="text-muted-foreground">{text}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
