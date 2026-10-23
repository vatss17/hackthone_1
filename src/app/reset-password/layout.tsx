import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

// Reading the session happens at request time (see the (app) layout for why), so the page sits behind Suspense and opts out of instant validation.
export const instant = false;

export default function ResetLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-64" aria-busy="true" />}>{children}</Suspense>
    </AuthShell>
  );
}
