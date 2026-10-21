import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string };

/**
 * The current user, validated by the Supabase Auth server (not just decoded from a
 * cookie). Memoized per request. Never cached across requests, so a sign-out or a
 * revoked session takes effect immediately.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Validating a session is inherently per-request (it asks the Auth server and compares
  // token expiry with the current time), so it must never be prerendered or prefetched.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
});

/**
 * Data-access-layer guard. Call it in every protected Server Component, Server
 * Action and Route Handler: layouts do not re-render on navigation, and the proxy
 * redirect is only optimistic.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;

  // A leftover Supabase cookie with no valid user means the session expired or was
  // revoked. Route through /auth/session-expired, which clears the stale cookie
  // (a Server Component cannot), so the proxy does not bounce the user back here.
  const hadSession = (await cookies()).getAll().some((c) => c.name.startsWith("sb-"));
  redirect(hadSession ? "/auth/session-expired" : "/login");
}
