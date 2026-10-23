import type { Metadata } from "next";
import { ResetPasswordHead } from "@/components/auth/page-heads";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password · Atlas" };
export const instant = false;

export default async function ResetPasswordPage() {
  // Only a signed-in recovery session can be here (the proxy sends everyone else to sign in); the action re-checks that it is a RECENT recovery.
  await requireUser();
  return (
    <>
      <ResetPasswordHead />
      <div className="mt-6 rounded-lg border bg-card p-5 sm:p-6">
        <ResetPasswordForm />
      </div>
    </>
  );
}
