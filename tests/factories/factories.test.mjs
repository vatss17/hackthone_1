// End to end factory-management tests against a RUNNING app (npm run dev) and the designated
// Supabase development project. Synthetic users, companies and factories only.
//
// Run:  npm run dev   then   npm run test:factories
//
// Everything is driven through the real forms with real sessions. The service key
// (tests/db/lib/admin.mjs) is used only to create/delete test users and to READ rows for assertions.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { enabled } from "../db/lib/env.mjs";
import { archiveOrganization, createTestUser, deleteUser, newRunId, rawPrivileged } from "../db/lib/admin.mjs";
import { APP_URL, Browser, appIsUp } from "../auth/lib/http.mjs";

const runId = newRunId();
const users = {};
const sessions = {}; // one login per user, reused across tests (keeps Auth sign-ins low)
const RAW_DB_TEXT = /PGRST|SQLSTATE|violates|permission denied|duplicate key|factories_org_name_active_idx|stack trace/i;

const fac = (label) => `M13C3 TEST ${runId} ${label}`;
const valid = (name, extra = {}) => ({
  factoryName: name, addressLine1: "1 Test Road", addressLine2: "", city: "Testville", state: "Gujarat", postalCode: "380001", ...extra,
});

const orgIdOf = async (userId) => ((await rawPrivileged("GET", `/rest/v1/memberships?user_id=eq.${userId}&select=organization_id`)).body[0] ?? {}).organization_id;
const factoriesOf = async (orgId) =>
  (await rawPrivileged("GET", `/rest/v1/factories?organization_id=eq.${orgId}&select=*&order=created_at.asc`)).body;
const allFactoriesNamed = async (name) =>
  (await rawPrivileged("GET", `/rest/v1/factories?name=eq.${encodeURIComponent(name)}&select=id,organization_id`)).body;

async function login(label, { withCompany }) {
  const u = await createTestUser(runId, label);
  users[label] = u;
  const b = new Browser();
  const r = await b.submit("/login", 'name="email"', { email: u.email, password: u.password });
  assert.equal(r.status, 303, `sign-in failed for ${label}`);
  if (withCompany) {
    const reg = await b.submit("/onboarding", 'name="companyName"', { companyName: `M13C3 TEST ${runId} company ${label}`, legalName: "" });
    assert.equal(reg.status, 303, `company registration failed for ${label}`);
  }
  sessions[label] = b;
  return b;
}

describe("factory registration and management (end to end)", { skip: !enabled }, () => {
  let orgC, orgB;
  before(async () => {
    assert.ok(await appIsUp(), `app not reachable at ${APP_URL}; start it with npm run dev`);
    await login("b", { withCompany: true }); // another company: isolation checks
    await login("c", { withCompany: true }); // company under test
    await login("d", { withCompany: false }); // signed in, no company
    orgB = await orgIdOf(users.b.id);
    orgC = await orgIdOf(users.c.id);
  });
  after(async () => {
    for (const u of Object.values(users)) {
      for (const m of (await rawPrivileged("GET", `/rest/v1/memberships?user_id=eq.${u.id}&select=organization_id`)).body ?? []) {
        await archiveOrganization(m.organization_id).catch(() => {});
      }
      await deleteUser(u.id).catch(() => {});
    }
  });

  it("signed-out visitors are sent to sign-in from every factory page", async () => {
    const anon = new Browser();
    for (const path of ["/factories", "/factories/new", `/factories/${randomUUID()}/edit`]) {
      const r = await anon.get(path);
      assert.equal(r.status, 307, path);
      assert.match(r.location, /\/login\?next=/, path);
    }
  });

  it("a signed-in user with no company is sent to company registration from the factory pages", async () => {
    for (const path of ["/factories", "/factories/new"]) {
      const end = await sessions.d.browse(path);
      assert.equal(end.looped, false, JSON.stringify(end.trail));
      assert.equal(end.finalPath, "/onboarding", `${path}: ${JSON.stringify(end.trail)}`);
    }
  });

  it("a company with no factory and no products is asked where to start (Path A or B), and the factory list does not redirect (no loop)", async () => {
    const guided = await sessions.c.browse("/");
    assert.equal(guided.looped, false, JSON.stringify(guided.trail));
    assert.equal(guided.finalPath, "/start", JSON.stringify(guided.trail));
    assert.match(guided.text, /What would you like to do first/);

    const list = await sessions.c.get("/factories");
    assert.equal(list.status, 200, "the list page must stay reachable with zero factories");
    assert.match(list.text, /No active factories/);
    assert.match(list.text, /href="\/factories\/new"/, "no way to add a factory from the empty state");
  });

  it("the form has labelled fields, a fixed country and all 36 states, and no country input", async () => {
    const page = await sessions.c.get("/factories/new");
    assert.equal(page.status, 200);
    for (const [name, label] of [["factoryName", "Factory name"], ["addressLine1", "Address line 1"], ["addressLine2", "Address line 2"], ["city", "City"], ["state", "State or union territory"], ["postalCode", "PIN code"]]) {
      assert.match(page.text, new RegExp(`<label[^>]*for="${name}"[^>]*>${label}`), name);
    }
    const names = [...page.text.matchAll(/<(?:input|select)[^>]*name="([^"]*)"/g)].map((m) => m[1]).filter((n) => !n.startsWith("$"));
    assert.deepEqual(names.sort(), ["addressLine1", "addressLine2", "city", "factoryName", "postalCode", "state"]);
    assert.equal((page.text.match(/<option value="[^"]+"/g) ?? []).length, 36);
    assert.match(page.text, />India</);
    assert.ok(/Fixed for now/.test(page.text));
  });

  it("invalid input shows specific messages and creates nothing", async () => {
    const cases = [
      [valid(""), /Enter the factory name\./],
      [valid("A"), /Use at least 2 characters\./],
      [valid("B".repeat(201)), /Use at most 200 characters\./],
      [valid(fac("x"), { addressLine1: "" }), /Enter the address\./],
      [valid(fac("x"), { city: "" }), /Enter the city\./],
      [valid(fac("x"), { state: "" }), /Choose the state or union territory\./],
      [valid(fac("x"), { state: "Atlantis" }), /Choose a state or union territory from the list\./],
      [valid(fac("x"), { postalCode: "12345" }), /6-digit PIN code/],
      [valid(fac("x"), { postalCode: "012345" }), /6-digit PIN code/],
      [valid(fac("x"), { factoryName: "Bad\u0001Name" }), /Remove line breaks and control characters\./],
    ];
    for (const [fields, expected] of cases) {
      const r = await sessions.c.submit("/factories/new", 'name="factoryName"', fields);
      assert.equal(r.status, 200, JSON.stringify(fields).slice(0, 70));
      assert.match(r.text, expected);
      assert.ok(!RAW_DB_TEXT.test(r.text), "raw technical text shown");
    }
    assert.deepEqual(await factoriesOf(orgC), []);
  });

  it("adding the first valid factory saves it to the user's company and lands on the dashboard", async () => {
    const r = await sessions.c.submit("/factories/new", 'name="factoryName"', valid(fac("one"), { addressLine2: "Near the test depot" }));
    assert.equal(r.status, 303);
    assert.equal(new URL(r.location, APP_URL).pathname, "/");
    const rows = await factoriesOf(orgC);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, fac("one"));
    assert.equal(rows[0].address_line2, "Near the test depot");
    assert.equal(rows[0].organization_id, orgC);
    assert.equal(rows[0].created_by, users.c.id);
    assert.equal(rows[0].country, "IN");
    assert.equal(rows[0].archived_at, null);
    const home = await sessions.c.browse("/");
    assert.equal(home.finalPath, "/");
    assert.ok(home.text.includes(fac("one")), "dashboard does not list the factory");
  });

  it("client-supplied organization, user, country and id fields are ignored", async () => {
    const r = await sessions.c.submit("/factories/new", 'name="factoryName"', {
      ...valid(fac("two")),
      organization_id: orgB, created_by: users.b.id, country: "US", id: randomUUID(), archived_at: new Date().toISOString(), role: "owner",
    });
    assert.equal(r.status, 303);
    const row = (await factoriesOf(orgC)).find((f) => f.name === fac("two"));
    assert.ok(row, "factory not saved");
    assert.equal(row.organization_id, orgC);
    assert.equal(row.created_by, users.c.id);
    assert.equal(row.country, "IN");
    assert.equal(row.archived_at, null);
    assert.deepEqual((await factoriesOf(orgB)).filter((f) => f.name === fac("two")), [], "factory leaked into another company");
  });

  it("duplicate active names are rejected within a company (case and spacing ignored) but allowed in another company", async () => {
    const before = (await factoriesOf(orgC)).length;
    for (const dup of [fac("one"), fac("one").toUpperCase(), `  ${fac("one").replace(/ /g, "   ")}  `]) {
      const r = await sessions.c.submit("/factories/new", 'name="factoryName"', valid(dup));
      assert.equal(r.status, 200, dup);
      assert.match(r.text, /already have an active factory with this name/);
      assert.ok(!RAW_DB_TEXT.test(r.text));
    }
    assert.equal((await factoriesOf(orgC)).length, before, "a duplicate was saved");
    const other = await sessions.b.submit("/factories/new", 'name="factoryName"', valid(fac("one")));
    assert.equal(other.status, 303, "another company must be allowed the same name");
    assert.equal((await factoriesOf(orgB)).length, 1);
  });

  it("a company can register multiple factories and the list shows them all", async () => {
    const r = await sessions.c.submit("/factories/new", 'name="factoryName"', valid(fac("three"), { city: "Otherville", state: "Maharashtra", postalCode: "400001" }));
    assert.equal(r.status, 303);
    assert.match(r.location, /\/factories\?notice=factory_added$/);
    const landing = new URL(r.location, APP_URL);
    const list = await sessions.c.get(landing.pathname + landing.search);
    for (const n of ["one", "two", "three"]) assert.ok(list.text.includes(fac(n)), `missing ${n}`);
    assert.match(list.text, /Factory added\./);
    assert.match(list.text, /Active factories/);
    assert.equal((await factoriesOf(orgC)).length, 3);
  });

  it("editing saves to the database, persists across refresh, and respects duplicate names", async () => {
    const rows = await factoriesOf(orgC);
    const two = rows.find((f) => f.name === fac("two"));
    const page = await sessions.c.get(`/factories/${two.id}/edit`);
    assert.equal(page.status, 200);
    assert.ok(page.text.includes(`value="${fac("two")}"`), "edit form not pre-filled");
    const r = await sessions.c.submit(`/factories/${two.id}/edit`, 'name="factoryName"', valid(fac("two"), { city: "Editville", state: "Kerala", postalCode: "682001", addressLine2: "Unit 5" }));
    assert.equal(r.status, 303);
    assert.match(r.location, /factory_updated$/);
    const after = (await factoriesOf(orgC)).find((f) => f.id === two.id);
    assert.equal(after.city, "Editville");
    assert.equal(after.state, "Kerala");
    assert.equal(after.postal_code, "682001");
    assert.equal(after.address_line2, "Unit 5");
    assert.equal(after.organization_id, orgC, "organization changed by an edit");
    for (let i = 0; i < 2; i++) {
      const again = await sessions.c.get(`/factories/${two.id}/edit`);
      assert.ok(again.text.includes('value="Editville"'), "edit not persisted across refresh");
    }
    const clash = await sessions.c.submit(`/factories/${two.id}/edit`, 'name="factoryName"', valid(fac("one")));
    assert.equal(clash.status, 200);
    assert.match(clash.text, /already have an active factory with this name/);
    assert.equal((await factoriesOf(orgC)).find((f) => f.id === two.id).name, fac("two"));
  });

  it("another company cannot view, edit or archive these factories", async () => {
    const two = (await factoriesOf(orgC)).find((f) => f.name === fac("two"));
    const snapshot = JSON.stringify(await factoriesOf(orgC));
    // View: looks exactly like "not found".
    const view = await sessions.b.get(`/factories/${two.id}/edit`);
    assert.ok(!view.text.includes(fac("two")) && !view.text.includes("Editville"), "another company's factory data was shown");
    // Edit with a forged id, using B's own valid form identifiers.
    const mine = (await factoriesOf(orgB))[0];
    const editHidden = await sessions.b.hiddenFields(`/factories/${mine.id}/edit`, 'name="factoryName"');
    const archHidden = await sessions.b.hiddenFields(`/factories/${mine.id}/edit`, "Yes, archive it");
    const forgedEdit = await sessions.b.postForm(`/factories/${mine.id}/edit`, editHidden, { ...valid("Hijacked"), id: two.id });
    assert.equal(forgedEdit.status, 303);
    assert.match(forgedEdit.location, /factory_missing$/, "a forged edit must be refused as 'not found'");
    const forgedArchive = await sessions.b.postForm(`/factories/${mine.id}/edit`, archHidden, { id: two.id });
    assert.equal(forgedArchive.status, 303);
    assert.match(forgedArchive.location, /factory_missing$/, "a forged archive must be refused as 'not found'");
    assert.equal((await factoriesOf(orgB)).find((f) => f.id === mine.id).name, fac("one"), "B's own factory was altered");
    assert.equal(JSON.stringify(await factoriesOf(orgC)), snapshot, "another company changed these factories");
    // And the list never shows them.
    const list = await sessions.b.get("/factories");
    assert.ok(!list.text.includes(fac("two")) && !list.text.includes(fac("three")));
  });

  it("unauthenticated replays of edit and archive forms change nothing", async () => {
    const two = (await factoriesOf(orgC)).find((f) => f.name === fac("two"));
    const snapshot = JSON.stringify(await factoriesOf(orgC));
    const editHidden = await sessions.c.hiddenFields(`/factories/${two.id}/edit`, 'name="factoryName"');
    const archHidden = await sessions.c.hiddenFields(`/factories/${two.id}/edit`, "Yes, archive it");
    const anon = new Browser();
    const e = await anon.postForm(`/factories/${two.id}/edit`, editHidden, { ...valid("Anon edit"), id: two.id });
    const a = await anon.postForm(`/factories/${two.id}/edit`, archHidden, { id: two.id });
    for (const r of [e, a]) {
      assert.ok([303, 307].includes(r.status), `status ${r.status}`);
      assert.match(r.location ?? "", /\/login/);
    }
    assert.equal(JSON.stringify(await factoriesOf(orgC)), snapshot);
  });

  it("archiving soft-deletes: the row stays, it leaves the active list, shows under archived (read only), and cannot be edited", async () => {
    const three = (await factoriesOf(orgC)).find((f) => f.name === fac("three"));
    const r = await sessions.c.submit(`/factories/${three.id}/edit`, "Yes, archive it", {});
    assert.equal(r.status, 303);
    assert.match(r.location, /factory_archived$/);
    const row = (await factoriesOf(orgC)).find((f) => f.id === three.id);
    assert.ok(row, "the factory row was deleted: it must only be archived");
    assert.ok(row.archived_at, "archived_at not set");
    const list = await sessions.c.get("/factories");
    const activeSection = list.text.split("Archived factories")[0];
    assert.ok(!activeSection.includes(fac("three")), "archived factory still in the active list");
    assert.match(list.text, /Archived factories/);
    const shown = await sessions.c.get("/factories?show=archived");
    assert.ok(shown.text.includes(fac("three")));
    assert.match(shown.text, /Read only/);
    const edit = await sessions.c.get(`/factories/${three.id}/edit`);
    assert.ok(!edit.text.includes('value="' + fac("three")), "an archived factory is editable");
    const again = await sessions.c.submit(`/factories/${(await factoriesOf(orgC)).find((f) => f.name === fac("one")).id}/edit`, "Yes, archive it", { id: three.id });
    assert.match(again.location, /factory_missing$/, "re-archiving must be a safe no-op");
    assert.ok((await factoriesOf(orgC)).find((f) => f.name === fac("one")).archived_at === null, "archived the wrong factory");
  });

  it("a name freed by archiving can be reused", async () => {
    const r = await sessions.c.submit("/factories/new", 'name="factoryName"', valid(fac("three")));
    assert.equal(r.status, 303);
    const same = (await factoriesOf(orgC)).filter((f) => f.name === fac("three"));
    assert.equal(same.length, 2);
    assert.equal(same.filter((f) => !f.archived_at).length, 1);
  });

  it("archiving every factory sends the user to register a replacement with no redirect loop", async () => {
    for (const f of (await factoriesOf(orgC)).filter((x) => !x.archived_at)) {
      const r = await sessions.c.submit(`/factories/${f.id}/edit`, "Yes, archive it", {});
      assert.equal(r.status, 303);
    }
    assert.equal((await factoriesOf(orgC)).filter((f) => !f.archived_at).length, 0);
    const dash = await sessions.c.browse("/");
    assert.equal(dash.looped, false, `redirect loop: ${JSON.stringify(dash.trail)}`);
    assert.equal(dash.finalPath, "/start", JSON.stringify(dash.trail));
    const list = await sessions.c.get("/factories");
    assert.equal(list.status, 200);
    assert.match(list.text, /All your factories are archived/);
    assert.match(list.text, /Register a factory/);
    // The replacement: back to the dashboard.
    const add = await sessions.c.submit("/factories/new", 'name="factoryName"', valid(fac("replacement")));
    assert.equal(add.status, 303);
    assert.equal(new URL(add.location, APP_URL).pathname, "/");
    const home = await sessions.c.browse("/");
    assert.equal(home.finalPath, "/");
    assert.ok(home.text.includes(fac("replacement")));
  });

  it("factory names are escaped (no markup injection)", async () => {
    const evil = `${fac("x")} <img src=x onerror=alert(1)> & "q"`;
    const r = await sessions.c.submit("/factories/new", 'name="factoryName"', valid(evil));
    assert.equal(r.status, 303);
    const list = await sessions.c.get("/factories");
    assert.ok(!list.text.includes("<img src=x"), "unescaped markup in the page");
    assert.ok(list.text.includes("&lt;img src=x"));
  });

  it("the navigation links to the factory page and the data is isolated per company", async () => {
    const list = await sessions.c.get("/factories");
    assert.match(list.text, /<a[^>]*href="\/factories"[^>]*>(?:<[^>]+>)*My factory/, "the navigation link to the factory page");
    const b = await sessions.b.get("/factories");
    assert.ok(!b.text.includes(fac("replacement")) && !b.text.includes(fac("two")));
    assert.ok(b.text.includes(fac("one")), "company B cannot see its own factory");
  });

  it("nothing from these flows is attributed to the wrong company in the database", async () => {
    for (const n of ["replacement", "two", "three"]) {
      for (const row of await allFactoriesNamed(fac(n))) assert.equal(row.organization_id, orgC, n);
    }
    assert.equal((await factoriesOf(orgB)).length, 1);
  });
});
