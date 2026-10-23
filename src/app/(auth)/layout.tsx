import { AuthShell } from "@/components/auth/auth-shell";

/** Shell for sign-in, sign-up and recovery. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
