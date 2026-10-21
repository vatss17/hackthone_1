// Pure unit tests (no server, no network): error mapping and redirect safety.
// Imports the TypeScript sources directly (Node strips the types).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapLogInError, mapSignUpError } from "../../src/lib/auth-errors.ts";
import { safeNextPath } from "../../src/lib/safe-redirect.ts";

const email = "someone@example.com";

describe("sign-up error mapping", () => {
  it("rate limit (over_email_send_rate_limit): says no email was sent and never claims one was", () => {
    const state = mapSignUpError({ code: "over_email_send_rate_limit", status: 429, message: "email rate limit exceeded" }, email);
    assert.equal(state.confirmationSent, undefined, "must not show the 'check your email' panel");
    assert.match(state.error, /No confirmation email was sent/);
    assert.match(state.error, /Wait a few minutes/);
    assert.equal(state.email, email, "keeps the typed address so the user can retry");
  });

  it("any HTTP 429 or request rate limit is treated as a rate limit", () => {
    for (const e of [{ status: 429 }, { code: "over_request_rate_limit" }]) {
      const state = mapSignUpError(e, email);
      assert.equal(state.confirmationSent, undefined);
      assert.match(state.error, /No confirmation email was sent/);
    }
  });

  it("explicit delivery failures say the email could not be delivered", () => {
    for (const e of [
      { code: "email_address_not_authorized", status: 400, message: "Email address not authorized" },
      { code: "unexpected_failure", status: 500, message: "Error sending confirmation email" },
      { code: "smtp_failed", message: "smtp error" },
    ]) {
      const state = mapSignUpError(e, email);
      assert.equal(state.confirmationSent, undefined, JSON.stringify(e));
      assert.match(state.error, /No confirmation email was sent/, JSON.stringify(e));
    }
  });

  it("unknown errors are a plain failure, never a success", () => {
    const state = mapSignUpError({ code: "something_new", status: 500, message: "boom" }, email);
    assert.equal(state.confirmationSent, undefined);
    assert.match(state.error, /could not create your account/);
  });

  it("field-level errors for weak passwords and invalid emails", () => {
    assert.ok(mapSignUpError({ code: "weak_password" }, email).fieldErrors.password);
    assert.ok(mapSignUpError({ code: "email_address_invalid" }, email).fieldErrors.email);
  });

  it("no message depends on whether an account exists and none leaks the raw Supabase text", () => {
    const raw = "User already registered";
    const state = mapSignUpError({ code: "user_already_exists", status: 422, message: raw }, email);
    assert.ok(!JSON.stringify(state).includes(raw));
    assert.equal(state.confirmationSent, undefined);
  });
});

describe("sign-in error mapping", () => {
  it("unknown email and wrong password give the same message", () => {
    const wrong = mapLogInError({ code: "invalid_credentials" }, email);
    assert.equal(wrong.error, "The email or password is incorrect.");
  });
  it("unconfirmed and rate-limited are distinct, honest messages", () => {
    assert.match(mapLogInError({ code: "email_not_confirmed" }, email).error, /not confirmed yet/);
    assert.match(mapLogInError({ status: 429 }, email).error, /Too many attempts/);
  });
  it("never echoes the raw upstream message", () => {
    assert.ok(!mapLogInError({ code: "x", message: "database exploded: secret detail" }, email).error.includes("secret detail"));
  });
});

describe("safeNextPath (post-login redirect safety)", () => {
  const FALLBACK = "/";
  it("rejects every way of leaving the site", () => {
    for (const bad of [
      "https://evil.example", "http://evil.example/x", "//evil.example", "///evil.example", "/\\evil.example",
      "\\\\evil.example", "javascript:alert(1)", "data:text/html,x", "evil.example", "", "   ", "/\t/evil.example",
      "/\n/evil.example", "/\u0000", "/ok\u007f", "/" + "a".repeat(600),
    ]) {
      assert.equal(safeNextPath(bad), FALLBACK, JSON.stringify(bad));
    }
  });
  it("rejects non-strings", () => {
    for (const bad of [undefined, null, 5, {}, [], ["/x"]]) assert.equal(safeNextPath(bad), FALLBACK);
  });
  it("never redirects into the auth pages or endpoints (no loops)", () => {
    for (const p of ["/login", "/signup", "/auth/confirm", "/auth/session-expired"]) assert.equal(safeNextPath(p), FALLBACK, p);
  });
  it("keeps genuine internal paths", () => {
    for (const ok of ["/", "/factory", "/a/b", "/a/b?x=1&y=2", "/a#section"]) assert.equal(safeNextPath(ok), ok);
  });
});
