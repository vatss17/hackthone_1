import type { Metadata } from "next";
import { SignupHead } from "@/components/auth/page-heads";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create account · Atlas" };

export default function SignupPage() {
  return (
    <>
      <SignupHead />
      <div className="mt-6 rounded-lg border bg-card p-5 sm:p-6">
        <SignupForm />
      </div>
    </>
  );
}
