import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in · Export Enablement Platform" };

// Fixed messages only: nothing from the query string is ever shown to the user.
const NOTICES: Record<string, { tone: "error" | "info" | "success"; text: string }> = {
  confirmation_failed: {
    tone: "error",
    text: "That confirmation link is invalid or has expired. Sign up again with the same email to receive a new one.",
  },
  session_expired: { tone: "info", text: "Your session has expired. Sign in again to continue." },
  signed_out: { tone: "success", text: "You have been signed out." },
};

async function LoginPanel({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const key = pick(params.error) ?? pick(params.notice);
  return <LoginForm next={safeNextPath(pick(params.next))} notice={key ? NOTICES[key] : undefined} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <PageHeader
        title="Sign in"
        description="Sign in to continue to your export readiness workspace."
      />
      <div className="mt-6 rounded-md border bg-card p-5 sm:p-6">
        {/* Reading the query string happens at request time, so it sits behind Suspense. */}
        <Suspense fallback={<div className="h-64" aria-busy="true" />}>
          <LoginPanel searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
