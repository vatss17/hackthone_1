import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { LoginHead } from "@/components/auth/page-heads";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in · Atlas" };

// Fixed messages only: nothing from the query string is ever shown to the user. The wording is in LoginForm (it is translated there).
const NOTICES: Record<string, { tone: "error" | "info" | "success"; id: string }> = {
  confirmation_failed: { tone: "error", id: "confirmation_failed" },
  session_expired: { tone: "info", id: "session_expired" },
  signed_out: { tone: "success", id: "signed_out" },
  password_updated: { tone: "success", id: "password_updated" },
  reset_failed: { tone: "error", id: "reset_failed" },
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
      <LoginHead />
      <div className="mt-6 rounded-lg border bg-card p-5 sm:p-6">
        {/* Reading the query string happens at request time, so it sits behind Suspense. */}
        <Suspense fallback={<div className="h-64" aria-busy="true" />}>
          <LoginPanel searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
