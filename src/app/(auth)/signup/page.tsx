import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create account · Export Enablement Platform" };

export default function SignupPage() {
  return (
    <>
      <PageHeader
        title="Create your account"
        description="For manufacturers exporting finished plastic products. We will email you a link to confirm your address."
      />
      <div className="mt-6 rounded-md border bg-card p-5 sm:p-6">
        <SignupForm />
      </div>
    </>
  );
}
