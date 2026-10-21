import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { getSupabaseConfig, sessionCookieOptions } from "./config";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers, memoized
 * per request. It runs as the signed-in user (publishable key + the user's session),
 * so every query is subject to the same grants and Row Level Security as any API client.
 *
 * The session is READ from the request's Cookie header, and cookies() is only used
 * to WRITE (inside setAll). Reading through cookies() trips an internal error in
 * Next.js 16.4.2 development mode when a page re-renders in the same request as a
 * Server Action (for example a form returning validation errors without JavaScript):
 * "Received an underlying cookies object that does not match either cookies or
 * mutableCookies". The Cookie header holds exactly the same data, including any
 * values refreshed by the proxy, and headers() has no such problem.
 */
export const createClient = cache(async () => {
  const requestCookies = parseCookieHeader((await headers()).get("cookie") ?? "").map((c) => ({
    name: c.name,
    value: c.value ?? "",
  }));
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    global: {
      // Next.js memoizes identical GET fetches within one request. After a Server Action
      // writes data and redirects, the target page renders in the SAME request, so a read
      // made earlier in the action (for example "how many factories are there?") would be
      // replayed stale and the page would act on out-of-date data. Aborting-signal fetches
      // are never memoized, and no-store keeps the data cache out of it too.
      fetch: (input, init) =>
        fetch(input, { ...init, cache: "no-store", signal: init?.signal ?? new AbortController().signal }),
    },
    cookies: {
      getAll() {
        return requestCookies;
      },
      async setAll(cookiesToSet) {
        try {
          const store = await cookies();
          cookiesToSet.forEach(({ name, value, options }) =>
            store.set(name, value, { ...options, ...sessionCookieOptions }),
          );
        } catch {
          // Called while rendering a Server Component, which cannot set cookies. Safe to
          // ignore: the proxy refreshes the session on every request.
        }
      },
    },
  });
});
