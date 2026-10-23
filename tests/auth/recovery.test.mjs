// Pure and static tests: password recovery on the existing auth provider never reveals accounts and only works right after a recovery link.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapResetRequestError, mapUpdatePasswordError } from "../../src/lib/auth-errors.ts";
import { isRecentRecoverySession, RECOVERY_WINDOW_SECONDS } from "../../src/lib/recovery.ts";
import { safeNextPath } from "../../src/lib/safe-redirect.ts";

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const email = "someone@example.com";
const NOW = 1_800_000_000;

describe("requesting a reset", () => {
  it("says the same thing when the provider accepts the request, so an unknown address looks like a known one", () => {
    const s = mapResetRequestError(null, email);
    assert.equal(s.resetSent, true);
    assert.equal(s.error, undefined);
    assert.equal(s.email, email);
  });
  it("reports only problems that do not depend on the address", () => {
    assert.match(mapResetRequestError({ status: 429 }, email).error, /Too many reset emails/);
    assert.match(mapResetRequestError({ code: "over_email_send_rate_limit" }, email).error, /Wait a few minutes/);
    assert.match(mapResetRequestError({ code: "smtp_failed" }, email).error, /No email was sent/);
    assert.equal(mapResetRequestError({ code: "email_address_invalid" }, email).fieldErrors.email, "Enter a valid email address.");
    assert.ok(!mapResetRequestError({ code: "whatever", status: 500 }, email).resetSent, "an unknown failure is never shown as success");
  });
  it("no message mentions whether an account exists", () => {
    for (const e of [null, { status: 429 }, { code: "smtp_failed" }, { code: "x" }]) assert.ok(!/no account|not registered|doesn't exist|does not exist|unknown (user|email)/i.test(JSON.stringify(mapResetRequestError(e, email))));
  });
});

describe("setting the new password", () => {
  it("maps weak, repeated, rate-limited and expired cases to clear messages", () => {
    assert.match(mapUpdatePasswordError({ code: "weak_password" }).fieldErrors.password, /too easy to guess/);
    assert.match(mapUpdatePasswordError({ code: "same_password" }).fieldErrors.password, /not used before/);
    assert.match(mapUpdatePasswordError({ status: 429 }).error, /Too many attempts/);
    const expired = mapUpdatePasswordError({ code: "session_not_found" });
    assert.equal(expired.linkExpired, true);
    assert.match(expired.error, /no longer valid/);
  });
});

describe("only a fresh recovery session may reset a password without the old one", () => {
  it("accepts a session started by a recovery link a moment ago", () => {
    assert.equal(isRecentRecoverySession({ amr: [{ method: "otp", timestamp: NOW - 60 }] }, NOW), true);
    assert.equal(isRecentRecoverySession({ amr: [{ method: "recovery", timestamp: NOW - 5 }] }, NOW), true);
  });
  it("refuses an ordinary password sign-in, however recent", () => {
    assert.equal(isRecentRecoverySession({ amr: [{ method: "password", timestamp: NOW - 10 }] }, NOW), false);
  });
  it("refuses a recovery session that has gone stale", () => {
    assert.equal(isRecentRecoverySession({ amr: [{ method: "otp", timestamp: NOW - RECOVERY_WINDOW_SECONDS - 1 }] }, NOW), false);
  });
  it("refuses a link session that was followed by a password sign-in", () => {
    assert.equal(isRecentRecoverySession({ amr: [{ method: "otp", timestamp: NOW - 300 }, { method: "password", timestamp: NOW - 100 }] }, NOW), false);
  });
  it("refuses missing, malformed or future-dated claims", () => {
    for (const bad of [null, undefined, {}, { amr: "otp" }, { amr: [null] }, { amr: [{ method: "otp" }] }, { amr: [{ method: "otp", timestamp: NOW + 100000 }] }]) assert.equal(isRecentRecoverySession(bad, NOW), false);
  });
});

describe("wiring", () => {
  it("the confirm route handles recovery links and always sends them to the reset page", () => {
    const r = src("src/app/auth/confirm/route.ts");
    assert.match(r, /"recovery"/);
    assert.match(r, /redirect\(recovery \? "\/reset-password" : next\)/);
    assert.match(r, /reset_failed/);
  });
  it("the forgot-password page is public and the reset page is not", () => {
    const p = src("src/lib/supabase/proxy.ts");
    assert.match(p, /PUBLIC_PREFIXES = \[[^\]]*"\/forgot-password"/);
    assert.ok(!/PUBLIC_PREFIXES = \[[^\]]*"\/reset-password"/.test(p));
  });
  it("the reset action re-checks the session and ends every session afterwards", () => {
    const a = src("src/lib/actions/auth.ts");
    assert.match(a, /isRecentRecoverySession/);
    assert.match(a, /signOut\(\{ scope: "global" \}\)/);
    assert.match(a, /getSiteUrl\(\)\}\/auth\/confirm\?next=\/reset-password/);
  });
  it("neither new page can be used as a post-login destination", () => {
    assert.equal(safeNextPath("/forgot-password"), "/");
    assert.equal(safeNextPath("/auth/confirm"), "/");
  });
  it("the sign-in page links to recovery and shows the outcomes", () => {
    assert.match(src("src/components/auth/login-form.tsx"), /href="\/forgot-password"/);
    const l = src("src/app/(auth)/login/page.tsx");
    assert.match(l, /password_updated/);
    assert.match(l, /reset_failed/);
  });
});
