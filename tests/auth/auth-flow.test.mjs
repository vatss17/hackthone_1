// End-to-end authentication tests against a RUNNING app (npm run dev) and the
// designated Supabase development project. Synthetic users only.
//
// Run:  npm run dev   (in one terminal)   then   npm run test:auth
//
// Privileged setup (creating confirmed users, generating a confirmation link without
// sending email, cleanup) uses tests/db/lib/admin.mjs. Nothing the app does depends on it.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { enabled } from "../db/lib/env.mjs";
import { createTestUser, deleteUser, newRunId, rawPrivileged } from "../db/lib/admin.mjs";
import { APP_URL, Browser, appIsUp } from "./lib/http.mjs";

const strongPassword = () => `${randomUUID()}${randomBytes(6).toString("hex")}`;
const created = []; // user ids to delete afterwards

async function findUserIdByEmail(email) {
  const r = await rawPrivileged("GET", "/auth/v1/admin/users?per_page=200");
  return r.body?.users?.find((u) => u.email === email)?.id;
}

describe("manufacturer authentication (end to end)", { skip: !enabled }, () => {
  const runId = newRunId();
  let confirmed; // { email, password } confirmed user created by the admin API
  before(async () => {
    assert.ok(await appIsUp(), `app not reachable at ${APP_URL}; start it with npm run dev`);
    const u = await createTestUser(runId, "auth");
    created.push(u.id);
    confirmed = u;
  });
  after(async () => {
    for (const id of created) await deleteUser(id).catch(() => {});
  });

  it("signed-out visitors are redirected from the dashboard and from unknown protected paths", async () => {
    const b = new Browser();
    const home = await b.get("/");
    assert.equal(home.status, 307);
    assert.match(home.location, /\/login$/);
    const deep = await b.get("/factory");
    assert.equal(deep.status, 307);
    assert.match(deep.location, /\/login\?next=%2Ffactory$/);
  });

  it("login and signup pages render with their forms", async () => {
    const b = new Browser();
    const login = await b.get("/login");
    const signup = await b.get("/signup");
    assert.equal(login.status, 200);
    assert.match(login.text, /Sign in/);
    assert.match(login.text, /name="email"/);
    assert.match(login.text, /name="password"/);
    assert.equal(signup.status, 200);
    assert.match(signup.text, /Create your account/);
    assert.match(signup.text, /name="confirmPassword"/);
  });

  it("login validation messages for empty fields", async () => {
    const b = new Browser();
    const r = await b.submit("/login", 'name="email"', { email: "", password: "" });
    assert.equal(r.status, 200);
    assert.match(r.text, /Enter your email address\./);
    assert.match(r.text, /Enter your password\./);
    assert.equal(b.hasAuthCookie(), false);
  });

  it("invalid credentials: same message for a wrong password and an unknown email, no session", async () => {
    const b = new Browser();
    const wrong = await b.submit("/login", 'name="email"', { email: confirmed.email, password: `${strongPassword()}x` });
    assert.equal(wrong.status, 200);
    assert.match(wrong.text, /The email or password is incorrect\./);
    assert.equal(b.hasAuthCookie(), false);
    const unknown = await b.submit("/login", 'name="email"', { email: `m13c-nobody-${runId}@example.com`, password: strongPassword() });
    assert.match(unknown.text, /The email or password is incorrect\./);
    assert.equal(b.hasAuthCookie(), false);
  });

  it("signup validation: short password and mismatched confirmation", async () => {
    const b = new Browser();
    const short = await b.submit("/signup", 'name="confirmPassword"', {
      email: `m13c-${runId}-v@example.com`, password: "short", confirmPassword: "short",
    });
    assert.match(short.text, /Use at least 12 characters\./);
    const pw = strongPassword();
    const mismatch = await b.submit("/signup", 'name="confirmPassword"', {
      email: `m13c-${runId}-v@example.com`, password: pw, confirmPassword: `${pw}x`,
    });
    assert.match(mismatch.text, /The passwords do not match\./);
    const bad = await b.submit("/signup", 'name="confirmPassword"', { email: "not-an-email", password: pw, confirmPassword: pw });
    assert.match(bad.text, /Enter a valid email address\./);
  });

  it("signup request cannot ask for a role: extra fields are ignored and no metadata is sent", async (t) => {
    // The action reads only email, password and confirmPassword. Prove no privileged account results.
    const b = new Browser();
    const email = `m13c-${runId}-signup@example.com`;
    const pw = strongPassword();
    const r = await b.submit("/signup", 'name="confirmPassword"', {
      email, password: pw, confirmPassword: pw, role: "admin", platform_role: "admin", organization_id: randomUUID(),
    });
    assert.equal(r.status, 200);
    // Either the confirmation panel (email accepted) or a defined, non-500 failure message.
    assert.match(r.text, /Check your email|We could not create your account|No confirmation email was sent|Enter a valid email address/);
    const outcome = /Check your email/.test(r.text) ? "confirmation panel shown (signup accepted)"
      : /No confirmation email was sent/.test(r.text) ? "email rate limit / delivery failure message"
      : /Enter a valid email address/.test(r.text) ? "email rejected as invalid"
      : "generic failure message (account not created)";
    t.diagnostic(`real signup attempt outcome: ${outcome}`);
    const id = await findUserIdByEmail(email);
    t.diagnostic(`user row exists after signup attempt: ${Boolean(id)}`);
    // Regression: the "Check your email" panel must only appear when Supabase accepted the signup.
    // When it did not (rate limit, delivery failure) there must be no claim that an email was sent.
    if (/Check your email/.test(r.text)) {
      assert.ok(id, "claimed a confirmation email was sent but no account was created");
    } else {
      assert.ok(!/confirmation link to/.test(r.text), "claims an email was sent although signup failed");
    }
    if (id) {
      created.push(id);
      const staff = await rawPrivileged("GET", `/rest/v1/platform_staff?user_id=eq.${id}`);
      assert.deepEqual(staff.body, [], "signup created a staff row");
      const user = (await rawPrivileged("GET", `/auth/v1/admin/users/${id}`)).body;
      assert.equal(user.email_confirmed_at ?? null, null, "new signup must be unconfirmed");
      assert.equal(JSON.stringify(user.user_metadata ?? {}).includes("admin"), false);
    }
  });

  describe("email confirmation (link generated with the admin API, no email delivery)", () => {
    let email, password, tokenHash, userId;
    before(async () => {
      email = `m13c-${runId}-confirm@example.com`;
      password = strongPassword();
      const r = await rawPrivileged("POST", "/auth/v1/admin/generate_link", { type: "signup", email, password });
      assert.equal(r.status, 200, `generate_link failed: ${r.status}`);
      tokenHash = r.body.hashed_token;
      userId = r.body.id ?? r.body.user?.id;
      assert.ok(tokenHash, "no hashed_token returned");
      created.push(userId ?? (await findUserIdByEmail(email)));
    });

    it("an unconfirmed user cannot sign in", async () => {
      const b = new Browser();
      const r = await b.submit("/login", 'name="email"', { email, password });
      assert.equal(r.status, 200);
      assert.match(r.text, /not confirmed yet/);
      assert.equal(b.hasAuthCookie(), false);
    });

    it("tampered, wrong-type and malformed links are rejected", async () => {
      const b = new Browser();
      for (const q of [
        `token_hash=${tokenHash.slice(0, -2)}xx&type=signup`,
        `token_hash=${tokenHash}&type=recovery`,
        `token_hash=${tokenHash}&type=invite`,
        `token_hash=&type=signup`,
        `code=not-a-real-code`,
        ``,
      ]) {
        const r = await b.get(`/auth/confirm?${q}`);
        assert.equal(r.status, 307, q);
        assert.match(r.location, /\/login\?error=confirmation_failed$/, q);
        assert.equal(b.hasAuthCookie(), false, `session started by: ${q}`);
      }
    });

    it("a valid link confirms the account, starts a session and lands on the dashboard", async () => {
      const b = new Browser();
      const r = await b.get(`/auth/confirm?token_hash=${tokenHash}&type=signup&next=https://evil.example/x`);
      assert.equal(r.status, 307);
      assert.equal(new URL(r.location, APP_URL).pathname, "/", "open redirect not neutralised");
      assert.equal(new URL(r.location, APP_URL).origin, APP_URL);
      assert.equal(b.hasAuthCookie(), true);
      const home = await b.get("/");
      assert.equal(home.status, 200);
      assert.match(home.text, /Welcome/);
      assert.ok(home.text.includes(email), "signed-in email not shown in the header");
    });

    it("the same link cannot be used twice", async () => {
      const b = new Browser();
      const r = await b.get(`/auth/confirm?token_hash=${tokenHash}&type=signup`);
      assert.match(r.location, /confirmation_failed$/);
      assert.equal(b.hasAuthCookie(), false);
    });
  });

  describe("sign in, session persistence, sign out", () => {
    const b = new Browser();
    let signedInSnapshot;

    it("valid credentials sign in and redirect to the dashboard with HttpOnly session cookies", async () => {
      const r = await b.submit("/login", 'name="email"', { email: confirmed.email, password: confirmed.password });
      assert.equal(r.status, 303);
      assert.equal(new URL(r.location, APP_URL).pathname, "/");
      const auth = r.setCookies.filter((c) => c.startsWith("sb-"));
      assert.ok(auth.length > 0, "no session cookie set");
      for (const c of auth) {
        assert.match(c, /HttpOnly/i, "session cookie readable by browser scripts");
        assert.match(c, /SameSite=lax/i);
        assert.match(c, /Path=\//i);
        // Secure is only set in production builds (cookies cannot be Secure over http://localhost).
        if (process.env.EXPECT_SECURE_COOKIES === "1") assert.match(c, /;\s*Secure/i, "session cookie not Secure in production");
        else assert.doesNotMatch(c, /;\s*Secure/i);
      }
      signedInSnapshot = b.snapshot();
    });

    it("an attacker-supplied next= can never redirect off-site after login", async () => {
      for (const next of ["https://evil.example/phish", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) {
        const x = new Browser();
        const r = await x.submit("/login", 'name="email"', { email: confirmed.email, password: confirmed.password, next });
        assert.equal(r.status, 303, next);
        const to = new URL(r.location, APP_URL);
        assert.equal(to.origin, APP_URL, `left the site: ${next}`);
        assert.equal(to.pathname, "/", next);
      }
    });

    it("the dashboard shows the signed-in user and the session persists across requests (refresh)", async () => {
      for (let i = 0; i < 3; i++) {
        const home = await b.get("/");
        assert.equal(home.status, 200);
        assert.match(home.text, /Welcome/);
        assert.ok(home.text.includes(confirmed.email));
      }
    });

    it("signed-in users are sent away from the login and signup pages", async () => {
      for (const p of ["/login", "/signup"]) {
        const r = await b.get(p);
        assert.equal(r.status, 307, p);
        assert.equal(new URL(r.location, APP_URL).pathname, "/", p);
      }
    });

    it("sign out clears the session and protects the dashboard again", async () => {
      const out = await b.submit("/", "Sign out", {});
      assert.equal(out.status, 303);
      assert.match(out.location, /\/login\?notice=signed_out$/);
      assert.equal(b.hasAuthCookie(), false);
      const home = await b.get("/");
      assert.equal(home.status, 307);
      const login = await b.get("/login?notice=signed_out");
      assert.match(login.text, /You have been signed out\./);
    });

    it("a session cookie replayed after sign out is rejected by the server and ends cleanly on the sign-in page (no leak, no redirect loop)", async () => {
      b.restore(signedInSnapshot);
      // 1) The first response must not contain the dashboard or the user's email. The redirect may
      //    be an HTTP 307 or a streamed meta-refresh, because the check runs inside Suspense.
      const first = await b.get("/");
      assert.ok(!first.text.includes(confirmed.email), "user email leaked to a revoked session");
      assert.ok(!/The export journey|Planned modules/.test(first.text), "dashboard content leaked to a revoked session");
      // 2) Following redirects like a browser must settle on /login with the cookie cleared.
      b.restore(signedInSnapshot);
      const end = await b.browse("/");
      assert.equal(end.looped, false, `redirect loop: ${JSON.stringify(end.trail)}`);
      assert.equal(end.finalPath.split("?")[0], "/login", JSON.stringify(end.trail));
      assert.equal(end.status, 200);
      assert.match(end.text, /session has expired/i);
      assert.equal(b.hasAuthCookie(), false, "stale session cookie was not cleared");
    });

    it("visiting /login directly with a revoked-session cookie also settles without a loop", async () => {
      b.restore(signedInSnapshot);
      const end = await b.browse("/login");
      assert.equal(end.looped, false, `redirect loop: ${JSON.stringify(end.trail)}`);
      assert.equal(end.finalPath.split("?")[0], "/login");
      assert.equal(b.hasAuthCookie(), false);
    });

    it("the session-expired endpoint cannot sign out a user whose session is valid", async () => {
      const v = new Browser();
      await v.submit("/login", 'name="email"', { email: confirmed.email, password: confirmed.password });
      const r = await v.get("/auth/session-expired");
      assert.equal(r.status, 307);
      assert.equal(new URL(r.location, APP_URL).pathname, "/");
      assert.equal(v.hasAuthCookie(), true);
      const home = await v.get("/");
      assert.equal(home.status, 200);
    });

    it("garbage cookies never grant access", async () => {
      const g = new Browser();
      g.jar.set("sb-bylxvgtxxaghmceutrjq-auth-token", "base64-not-a-real-session");
      const r = await g.get("/");
      assert.equal(r.status, 307);
      assert.match(r.location, /\/login/);
    });
  });
});
