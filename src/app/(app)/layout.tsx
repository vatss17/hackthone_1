import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireOrganization } from "@/lib/organization";


// Opt this area out of Next's instant-navigation validation. Every navigation into it
// must ask the Auth server whether the session is still valid, and that cannot be
// prerendered. Caching the user lookup (use cache: private) would make a sign-out or
// a revoked session keep working for minutes, which is not acceptable for authorization.
// Cost: entering the authenticated area waits for one Auth round trip.
export const instant = false;

/**
 * Authenticated area. Reading the session happens at request time, so it sits
 * behind a Suspense boundary (required with Cache Components) and the shell
 * streams in once the Auth server has validated the user.
 *
 * This layout check is one layer. Every protected page and Server Action also
 * calls requireUser(), because layouts do not re-render on client navigation.
 */
async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  // Validates the user on the server, then sends users without a company to /onboarding.
  const { user } = await requireOrganization();
  return <AppShell user={user}>{children}</AppShell>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
