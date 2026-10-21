import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * Landing point when a protected page finds a session cookie that the Auth server
 * no longer accepts (signed out elsewhere, revoked, expired).
 *
 * Server Components cannot clear cookies, and the proxy only checks the token
 * locally, so without this step a stale cookie would bounce between /login and the
 * dashboard. This handler clears this device's session, then shows the sign-in page.
 * It only acts when there is NO valid user, so it cannot be used to sign anyone out.
 */
export async function GET() {
  if (await getCurrentUser()) redirect("/");
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?notice=session_expired");
}
