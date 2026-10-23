import { Suspense } from "react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { T } from "@/lib/i18n/client";
import { requireUser } from "@/lib/auth";
import { logOut } from "@/lib/actions/auth";

// Validates the session on every request (see the (app) layout for why this cannot be prerendered).
export const instant = false;

async function OnboardingFrame({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between gap-3 border-b bg-card px-4 text-foreground sm:px-6 lg:px-8">
        <Brand />
        <div className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
          <span className="hidden max-w-56 truncate text-foreground sm:inline" title={user.email}>
            {user.email}
          </span>
          <form action={logOut}>
            <Button type="submit" variant="outline" size="sm">
              <T>Sign out</T>
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[34rem] flex-1 px-4 py-10 sm:py-14">{children}</main>
      <footer className="border-t px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
        <T>Pre-release build. Use test data only: no real company or customer information.</T>
      </footer>
    </div>
  );
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <OnboardingFrame>{children}</OnboardingFrame>
    </Suspense>
  );
}
