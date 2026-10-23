import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// The UX wireframes (fictional data, no backend) are public outside production only.
const PREVIEW_PREFIX = process.env.NODE_ENV === "production" ? [] : ["/ux-preview"];
const PUBLIC_PREFIXES = ["/login", "/signup", "/forgot-password", "/welcome", "/sample", "/auth/", "/api/whatsapp", ...PREVIEW_PREFIX];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`));
}

/**
 * Refreshes the Supabase session on every request and applies an OPTIMISTIC
 * redirect for signed-out visitors.
 *
 * This is a convenience and a first line of defence, not the security boundary:
 * the proxy only checks the session token's claims. Real authorization happens in
 * the data-access layer (src/lib/auth.ts), which asks the Auth server to validate
 * the user on every protected render and Server Action.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    return new NextResponse("Authentication is not configured.", { status: 500 });
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
          }),
        );
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it validates the
  // token and refreshes it (writing new cookies through setAll above) when expired.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  const redirectTo = (target: string, search = "") => {
    const redirect = NextResponse.redirect(new URL(`${target}${search}`, request.url));
    // Keep any refreshed session cookies on the redirect response.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  // Visitors who are not signed in see the public homepage at "/" (same URL, no redirect to sign-in).
  if (!signedIn && pathname === "/") {
    const rewrite = NextResponse.rewrite(new URL("/welcome", request.url));
    response.cookies.getAll().forEach((c) => rewrite.cookies.set(c));
    return rewrite;
  }
  if (!signedIn && !isPublic(pathname)) {
    const next = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return redirectTo("/login", next);
  }
  if (signedIn && AUTH_PAGES.includes(pathname)) {
    return redirectTo("/");
  }
  return response;
}
