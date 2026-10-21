// Thin fetch helpers for Supabase Auth and PostgREST. No dependencies.
//
// Everything here uses the PUBLISHABLE key plus a user's own access token, so
// requests are subject to the same grants and RLS as the real application.
// The privileged key lives only in admin.mjs.

import { loadConfig } from "./env.mjs";

function headersFor(key, token, extra = {}) {
  const headers = { apikey: key, "Content-Type": "application/json", ...extra };
  // New-style keys (sb_*) are not JWTs and must not be sent as a bearer token.
  const bearer = token ?? (key.startsWith("sb_") ? undefined : key);
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return headers;
}

async function call(method, url, { key, token, body, headers } = {}) {
  const res = await fetch(url, {
    method,
    headers: headersFor(key, token, headers),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, body: json, text };
}

export function client() {
  const { url, publishableKey } = loadConfig();
  return {
    url,
    /** Password sign-in. Returns { token, userId } for a real session. */
    async signIn(email, password) {
      const r = await call("POST", `${url}/auth/v1/token?grant_type=password`, {
        key: publishableKey,
        body: { email, password },
      });
      if (!r.ok) throw new Error(`sign-in failed with status ${r.status}`);
      return { token: r.body.access_token, userId: r.body.user.id };
    },
    /** PostgREST request. token = a user session, or undefined for anon. */
    rest(token, method, path, { body, headers } = {}) {
      return call(method, `${url}/rest/v1/${path}`, {
        key: publishableKey,
        token,
        body,
        headers: { Prefer: "return=representation", ...headers },
      });
    },
    rpc(token, fn, args = {}, { headers } = {}) {
      return call("POST", `${url}/rest/v1/rpc/${fn}`, {
        key: publishableKey,
        token,
        body: args,
        headers,
      });
    },
    /** Auth API call as the signed-in user (e.g. update own metadata). */
    auth(token, method, path, body) {
      return call(method, `${url}/auth/v1/${path}`, { key: publishableKey, token, body });
    },
  };
}

/** True when the response means "not allowed" (grant or policy), not success. */
export function isDenied(r) {
  return [401, 403].includes(r.status) || r.body?.code === "42501";
}
