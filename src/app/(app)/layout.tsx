import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireOrganization } from "@/lib/organization";
import { listProducts } from "@/lib/capabilities";


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
  const { user, organization } = await requireOrganization();
  const products = await listProducts(organization.id);
  // The synthetic demo company is always named with this prefix (see scripts/demo-scenario.mjs).
  return (
    <AppShell user={user} scope={organization.id} products={products.map((p) => ({ id: p.id, name: p.name }))} isDemo={organization.name.startsWith("DEMO")}>
      {children}
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
