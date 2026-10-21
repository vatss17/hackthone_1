// End to end company-registration tests against a RUNNING app (npm run dev) and the
// designated Supabase development project. Synthetic users and company names only.
//
// Run:  npm run dev   then   npm run test:onboarding
//
// Registration is exercised through the real forms. The service key (tests/db/lib/admin.mjs)
// is used only to create/delete test users and to COUNT rows for assertions.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { enabled } from "../db/lib/env.mjs";
import { archiveOrganization, createTestUser, deleteUser, newRunId, rawPrivileged } from "../db/lib/admin.mjs";
import { APP_URL, Browser, appIsUp } from "../auth/lib/http.mjs";

const runId = newRunId();
const users = {}; // label -> { id, email, password }
const RAW_DB_TEXT = /PGRST|SQLSTATE|violates|permission denied|duplicate key|create_organization|memberships_user_id_key|stack trace/i;

const orgsOf = async (userId) =>
  (await rawPrivileged("GET", `/rest/v1/organizations?created_by=eq.${userId}&select=id,name,legal_name,archived_at`)).body;
const membershipsOf = async (userId) =>
  (await rawPrivileged("GET", `/rest/v1/memberships?user_id=eq.${userId}&select=id,organization_id,user_id,role`)).body;
const orgsNamed = async (name) =>
  (await rawPrivileged("GET", `/rest/v1/organizations?name=eq.${encodeURIComponent(name)}&select=id`)).body;

async function newUser(label) {
  const u = await createTestUser(runId, label);
  users[label] = u;
  return u;
}
async function signIn(label) {
  const b = new Browser();
  const r = await b.submit("/login", 'name="email"', { email: users[label].email, password: users[label].password });
  assert.equal(r.status, 303, `sign-in failed for ${label}`);
  return b;
}
const company = (label) => `M13C2 TEST ${runId} ${label}`;

describe("manufacturer company registration (end to end)", { skip: !enabled }, () => {
  before(async () => {
    assert.ok(await appIsUp(), `app not reachable at ${APP_URL}; start it with npm run dev`);
    for (const l of ["a", "b", "c", "d", "e", "target"]) await newUser(l);
  });
  after(async () => {
    // An owner of an ACTIVE organization cannot be deleted: archive their organizations first.
    for (const u of Object.values(users)) {
      for (const m of (await membershipsOf(u.id)) ?? []) await archiveOrganization(m.organization_id).catch(() => {});
      await deleteUser(u.id).catch(() => {});
    }
  });

  it("a signed-out visitor is sent to sign-in from /onboarding", async () => {
    const r = await new Browser().get("/onboarding");
    assert.equal(r.status, 307);
    assert.match(r.location, /\/login\?next=%2Fonboarding$/);
  });

  it("a signed-in user without a company is guided to registration (from the dashboard and by direct visit)", async () => {
    const b = await signIn("a");
    const viaDashboard = await b.browse("/");
    assert.equal(viaDashboard.looped, false);
    assert.equal(viaDashboard.finalPath, "/onboarding", JSON.stringify(viaDashboard.trail));
    assert.match(viaDashboard.text, /Register your company/);
    assert.match(viaDashboard.text, /What happens next/);
    const direct = await b.get("/onboarding");
    assert.equal(direct.status, 200);
    assert.ok(direct.text.includes(users.a.email), "signed-in email not shown on the onboarding page");
  });

  it("the form has accessible fields and a clear explanation, and collects only the two names", async () => {
    const b = await signIn("a");
    const page = await b.get("/onboarding");
    assert.match(page.text, /<label[^>]*for="companyName"[^>]*>Company or trading name/);
    assert.match(page.text, /<label[^>]*for="legalName"[^>]*>Registered legal name \(optional\)/);
    const inputs = [...page.text.matchAll(/<input[^>]*>/g)].map((m) => m[0]).filter((i) => !/type="hidden"/.test(i));
    const names = inputs.map((i) => i.match(/name="([^"]*)"/)?.[1]).sort();
    assert.deepEqual(names, ["companyName", "legalName"]);
    assert.ok(!/GSTIN|IEC|address|certification/i.test(page.text.replace(/<script[\s\S]*?<\/script>/g, "")), "unexpected extra fields");
  });

  it("invalid or missing company information shows accessible validation and creates nothing", async () => {
    const b = await signIn("a");
    const cases = [
      [{ companyName: "", legalName: "" }, /Enter your company name\./],
      [{ companyName: "   ", legalName: "" }, /Enter your company name\./],
      [{ companyName: "A", legalName: "" }, /Use at least 2 characters\./],
      [{ companyName: "B".repeat(201), legalName: "" }, /Use at most 200 characters\./],
      [{ companyName: "!!!", legalName: "" }, /Include at least one letter or number\./],
      [{ companyName: "Valid Name Ltd", legalName: "X" }, /Use at least 2 characters\./],
      [{ companyName: "Valid\u0001Name", legalName: "" }, /Remove line breaks and control characters\./],
    ];
    for (const [fields, expected] of cases) {
      const r = await b.submit("/onboarding", 'name="companyName"', fields);
      assert.equal(r.status, 200, JSON.stringify(fields).slice(0, 60));
      assert.match(r.text, expected); // in the markup (dev) or the streamed payload (production)
      assert.ok(!RAW_DB_TEXT.test(r.text), "raw database/technical text shown");
      // Production returns only the streamed part of the page to a no-JavaScript POST (a documented
      // limitation), so markup-level accessibility is asserted when a full document comes back and is
      // otherwise covered by the real-browser check.
      if (/<html/i.test(r.text)) {
        assert.match(r.text, /aria-invalid="true"/);
        assert.match(r.text, /aria-describedby="(companyName|legalName)-error"/);
      }
    }
    assert.deepEqual(await orgsOf(users.a.id), []);
    assert.deepEqual(await membershipsOf(users.a.id), []);
  });

  it("entered values are kept after a validation error", async () => {
    const b = await signIn("a");
    const r = await b.submit("/onboarding", 'name="companyName"', { companyName: "Kept Name Ltd", legalName: "L" });
    assert.match(r.text, /Kept Name Ltd/, "typed value was not echoed back");
    assert.match(r.text, /Use at least 2 characters\./);
  });

  it("anonymous registration is rejected: a replayed form with no session creates nothing", async () => {
    const signedIn = await signIn("a");
    const hidden = await signedIn.hiddenFields("/onboarding", 'name="companyName"');
    const anon = new Browser();
    const r = await anon.postForm("/onboarding", hidden, { companyName: company("anon-attempt"), legalName: "" });
    assert.ok([303, 307].includes(r.status), `status ${r.status}`);
    assert.match(r.location ?? "", /\/login/);
    assert.deepEqual(await orgsNamed(company("anon-attempt")), []);
  });

  it("registration creates exactly one organization and one owner membership for the session user", async () => {
    const b = await signIn("a");
    const r = await b.submit("/onboarding", 'name="companyName"', { companyName: company("a"), legalName: `${company("a")} Legal` });
    assert.equal(r.status, 303);
    assert.equal(new URL(r.location, APP_URL).pathname, "/");
    const orgs = await orgsOf(users.a.id);
    const memberships = await membershipsOf(users.a.id);
    assert.equal(orgs.length, 1);
    assert.equal(orgs[0].name, company("a"));
    assert.equal(orgs[0].legal_name, `${company("a")} Legal`);
    assert.equal(memberships.length, 1);
    assert.equal(memberships[0].role, "owner");
    assert.equal(memberships[0].user_id, users.a.id);
    assert.equal(memberships[0].organization_id, orgs[0].id);
  });

  it("the personalised dashboard shows the company; a refresh keeps the state and /onboarding no longer shows", async () => {
    const b = await signIn("a");
    for (let i = 0; i < 3; i++) {
      const home = await b.get("/");
      assert.equal(home.status, 200);
      assert.match(home.text, new RegExp(`Welcome, ${company("a")}`));
      assert.match(home.text, /Your company/);
      assert.match(home.text, /Owner/);
      assert.ok(home.text.includes(`${company("a")} Legal`), "legal name not shown");
    }
    const again = await b.browse("/onboarding");
    assert.equal(again.finalPath, "/", `existing owner saw registration again: ${JSON.stringify(again.trail)}`);
    assert.match(again.text, /Welcome, /);
  });

  it("an existing owner cannot create a second company; replaying the form changes nothing", async () => {
    // Harvest the registration form's identifiers from a user who has no company yet.
    const fresh = await signIn("b");
    const hidden = await fresh.hiddenFields("/onboarding", 'name="companyName"');
    const owner = await signIn("a");
    const r = await owner.postForm("/onboarding", hidden, { companyName: company("a-second"), legalName: "" });
    assert.equal(r.status, 303);
    assert.equal(new URL(r.location, APP_URL).pathname, "/");
    const orgs = await orgsOf(users.a.id);
    assert.equal(orgs.length, 1, "second organization created");
    assert.equal(orgs[0].name, company("a"), "organization changed");
    assert.equal((await membershipsOf(users.a.id)).length, 1);
    assert.deepEqual(await orgsNamed(company("a-second")), []);
  });

  it("a user cannot register a company on someone else's behalf: client-supplied ids and roles are ignored", async () => {
    const before = await membershipsOf(users.target.id);
    assert.deepEqual(before, []);
    const b = await signIn("d");
    const r = await b.submit("/onboarding", 'name="companyName"', {
      companyName: company("d"),
      legalName: "",
      user_id: users.target.id,
      userId: users.target.id,
      created_by: users.target.id,
      organization_id: randomUUID(),
      role: "owner",
      platform_role: "admin",
    });
    assert.equal(r.status, 303);
    const dOrgs = await orgsOf(users.d.id);
    assert.equal(dOrgs.length, 1);
    const dMem = await membershipsOf(users.d.id);
    assert.equal(dMem.length, 1);
    assert.equal(dMem[0].user_id, users.d.id);
    assert.deepEqual(await membershipsOf(users.target.id), [], "the other user was given a membership");
    assert.deepEqual(await orgsOf(users.target.id), [], "an organization was attributed to the other user");
    const staff = await rawPrivileged("GET", `/rest/v1/platform_staff?user_id=eq.${users.d.id}`);
    assert.deepEqual(staff.body, [], "platform role granted");
  });

  it("concurrent and repeated submissions create exactly one organization and one membership", async () => {
    const b = await signIn("c");
    const hidden = await b.hiddenFields("/onboarding", 'name="companyName"');
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => b.postForm("/onboarding", hidden, { companyName: company(`c-${i}`), legalName: "" })),
    );
    for (const r of results) {
      assert.equal(r.status, 303, `status ${r.status}`);
      assert.equal(new URL(r.location, APP_URL).pathname, "/");
      assert.ok(!RAW_DB_TEXT.test(r.text));
    }
    assert.equal((await orgsOf(users.c.id)).length, 1, "duplicate organizations");
    assert.equal((await membershipsOf(users.c.id)).length, 1, "duplicate memberships");
    // And a late repeat of the same submission after success.
    const late = await b.postForm("/onboarding", hidden, { companyName: company("c-late"), legalName: "" });
    assert.equal(late.status, 303);
    assert.equal((await orgsOf(users.c.id)).length, 1);
  });

  it("sign out and sign in again: owners return to the dashboard, users without a company to registration", async () => {
    // Owner (a)
    const owner = await signIn("a");
    const out = await owner.submit("/", "Sign out", {});
    assert.equal(out.status, 303);
    assert.equal((await owner.get("/")).status, 307);
    const back = await signIn("a");
    const landing = await back.browse("/");
    assert.equal(landing.finalPath, "/");
    assert.match(landing.text, new RegExp(`Welcome, ${company("a")}`));
    // Never-registered user (b): stays unregistered, still sent to registration after a round trip.
    const first = await signIn("b");
    assert.equal((await first.browse("/")).finalPath, "/onboarding");
    await first.submit("/onboarding", "Sign out", {});
    const second = await signIn("b");
    const again = await second.browse("/");
    assert.equal(again.finalPath, "/onboarding");
    assert.match(again.text, /Register your company/);
    assert.deepEqual(await membershipsOf(users.b.id), []);
  });

  it("company names are escaped on the dashboard (no markup injection)", async () => {
    const evil = `M13C2 TEST ${runId} <img src=x onerror=alert(1)> & "q"`;
    const b = await signIn("e");
    const r = await b.submit("/onboarding", 'name="companyName"', { companyName: evil, legalName: "" });
    assert.equal(r.status, 303);
    const home = await b.get("/");
    assert.equal(home.status, 200);
    assert.ok(!home.text.includes("<img src=x"), "unescaped markup in the page");
    assert.ok(home.text.includes("&lt;img src=x"), "name not rendered (escaped)");
  });

  it("one user's session never shows another user's company", async () => {
    const dashboard = (await (await signIn("d")).get("/")).text;
    assert.match(dashboard, new RegExp(company("d")));
    for (const other of ["a", "c", "e"]) assert.ok(!dashboard.includes(company(other)), `saw ${other}'s company`);
  });
});
