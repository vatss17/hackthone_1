import type { Metadata } from "next";
import { ForgotPasswordHead } from "@/components/auth/page-heads";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password · Atlas" };

export default function ForgotPasswordPage() {
  return (
    <>
      <ForgotPasswordHead />
      <div className="mt-6 rounded-lg border bg-card p-5 sm:p-6">
        <ForgotPasswordForm />
      </div>
    </>
  );
}
