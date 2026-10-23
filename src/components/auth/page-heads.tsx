"use client";

import { PageHeader } from "@/components/page-header";
import { useT } from "@/lib/i18n/client";

/** Page titles for the public auth pages. They are client components so the wording follows the visitor's language without reading cookies on the server. */

export function LoginHead() {
  const t = useT();
  return <PageHeader title={t("Sign in")} description={t("Sign in to continue to your export readiness workspace.")} />;
}

export function SignupHead() {
  const t = useT();
  return <PageHeader title={t("Create your account")} description={t("For manufacturers exporting finished plastic products. We will email you a link to confirm your address.")} />;
}

export function ForgotPasswordHead() {
  const t = useT();
  return <PageHeader title={t("Reset your password")} description={t("Enter the email you signed up with and we will send a link to choose a new password.")} />;
}

export function ResetPasswordHead() {
  const t = useT();
  return <PageHeader title={t("Choose a new password")} description={t("You opened a reset link, so you can set a new password without the old one. After this you sign in again.")} />;
}

export function OnboardingHead() {
  const t = useT();
  return <PageHeader eyebrow={t("Get started")} title={t("Register your company")} description={t("Tell us which business you are exporting for. This creates your company account, and you become its owner.")} />;
}

export function OnboardingNext() {
  const t = useT();
  const steps = [
    t("Your company account is created and you become its owner."),
    t("You go to your dashboard, which shows your company name."),
    t("Factory details, products and documents come in later steps. For now we store only the names above."),
  ];
  return (
    <section className="mt-8" aria-labelledby="next-heading">
      <h2 id="next-heading" className="text-base font-semibold tracking-tight">
        {t("What happens next")}
      </h2>
      <ol className="mt-3 divide-y rounded-lg border bg-card text-sm">
        {steps.map((text, i) => (
          <li key={i} className="flex gap-4 px-4 py-3 sm:px-5">
            <span className="w-4 shrink-0 tnum text-primary">{i + 1}</span>
            <span className="min-w-0 text-muted-foreground">{text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
