// Audit trigger behaviour and account-deletion lifecycle.
// Audit rows are read as a platform admin session (RLS allows only admins).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { enabled } from "./lib/env.mjs";
import { isDenied } from "./lib/api.mjs";
import { archiveOrganization, deleteUser } from "./lib/admin.mjs";
import { createFixture, factoryBody } from "./lib/fixture.mjs";

describe("audit logging and account lifecycle", { skip: !enabled }, () => {
  let f, orgA, factoryA, orgName;
  const auditFor = async (orgId) => {
    const r = await f.api.rest(
      f.users.admin.token,
      "GET",
      `audit_log?organization_id=eq.${orgId}&order=id.asc`,
    );
    assert.equal(r.status, 200, r.text);
    return r.body;
  };

  before(async () => {
    f = await createFixture(["a", "lone", "admin"], { staff: { admin: "admin" } });
    orgName = f.orgName("a");
    orgA = (await f.createOrg("a", orgName)).body;
    const fr = await f.api.rest(f.users.a.token, "POST", "factories", {
      body: factoryBody(orgA, "Audit Plant"),
    });
    factoryA = fr.body[0];
    await f.api.rest(f.users.a.token, "PATCH", `organizations?id=eq.${orgA}`, {
      body: { name: `${orgName} renamed` },
    });
  });
  after(async () => f?.cleanup());

  it("successful changes are recorded with actor, entity and changed column names", async () => {
    const rows = await auditFor(orgA);
    const actions = rows.map((r) => r.action);
    for (const a of ["organizations.insert", "memberships.insert", "factories.insert", "organizations.update"]) {
      assert.ok(actions.includes(a), `missing ${a}; got ${actions.join(",")}`);
    }
    const upd = rows.find((r) => r.action === "organizations.update");
    assert.deepEqual(upd.details.changed_columns, ["name"]);
    assert.equal(upd.actor_id, f.users.a.id);
    assert.equal(upd.actor_kind, "user");
    const mem = rows.find((r) => r.action === "memberships.insert");
    assert.equal(mem.details.role, "owner");
  });

  it("audit details contain no business or personal values", async () => {
    const blob = JSON.stringify(await auditFor(orgA));
    for (const secret of [orgName, "Audit Plant", "1 Test Road", "Testville", "400001", f.users.a.email]) {
      assert.ok(!blob.includes(secret), `audit log leaks: ${secret}`);
    }
  });

  it("a no-op update writes no audit row", async () => {
    const before = (await auditFor(orgA)).length;
    await f.api.rest(f.users.a.token, "PATCH", `factories?id=eq.${factoryA.id}`, {
      body: { name: "Audit Plant" },
    });
    assert.equal((await auditFor(orgA)).length, before);
  });

  it("a failed (rejected) change writes no audit row", async () => {
    const before = (await auditFor(orgA)).length;
    const r = await f.api.rest(f.users.a.token, "POST", "factories", {
      body: factoryBody(orgA, "Audit Plant"), // duplicate active name
    });
    assert.equal(r.status, 409);
    assert.equal((await auditFor(orgA)).length, before);
  });

  it("owners and admins cannot read-write audit rows beyond what is allowed", async () => {
    const own = await f.api.rest(f.users.a.token, "GET", "audit_log");
    assert.ok(isDenied(own) || (own.ok && own.body.length === 0));
    for (const token of [f.users.a.token, f.users.admin.token]) {
      const up = await f.api.rest(token, "PATCH", "audit_log?id=gt.0", { body: { action: "x.y" } });
      const del = await f.api.rest(token, "DELETE", "audit_log?id=gt.0");
      const ins = await f.api.rest(token, "POST", "audit_log", {
        body: { actor_kind: "user", action: "fake.insert", entity_type: "fake" },
      });
      assert.ok(isDenied(up), `update status ${up.status}`);
      assert.ok(isDenied(del), `delete status ${del.status}`);
      assert.ok(isDenied(ins), `insert status ${ins.status}`);
    }
  });

  it("an active organization's only owner cannot be deleted; the user and organization survive", async () => {
    const orgLone = (await f.createOrg("lone")).body;
    const r = await deleteUser(f.users.lone.id);
    assert.equal(r.ok, false, `deletion unexpectedly succeeded (status ${r.status})`);
    const stillThere = await f.api.signIn(f.users.lone.email, f.users.lone.password);
    assert.ok(stillThere.token);
    const org = await f.api.rest(f.users.admin.token, "GET", `organizations?id=eq.${orgLone}`);
    assert.equal(org.body.length, 1);
  });

  it("after the organization is archived, the owner's account can be deleted; org, factories and audit remain", async () => {
    const orgLone = (await f.api.rest(f.users.admin.token, "GET", `memberships?user_id=eq.${f.users.lone.id}`)).body[0]
      .organization_id;
    await archiveOrganization(orgLone);
    const del = await deleteUser(f.users.lone.id);
    assert.ok(del.ok, `status ${del.status}`);
    const org = await f.api.rest(f.users.admin.token, "GET", `organizations?id=eq.${orgLone}`);
    assert.equal(org.body.length, 1);
    assert.equal(org.body[0].created_by, null);
    const rows = await auditFor(orgLone);
    const del_m = rows.find((r) => r.action === "memberships.delete");
    assert.ok(del_m, "memberships.delete not audited");
    assert.equal(del_m.actor_kind, "system");
    const setnull = rows.find(
      (r) => r.action === "organizations.update" && r.details.changed_columns?.includes("created_by"),
    );
    assert.ok(setnull, "created_by set-null not audited");
  });

  it("a user with no organization can delete their account", async () => {
    // Fresh user created inside the test so the fixture's cleanup is unaffected.
    const { createTestUser } = await import("./lib/admin.mjs");
    const u = await createTestUser(f.runId, "noorg");
    const del = await deleteUser(u.id);
    assert.ok(del.ok, `status ${del.status}`);
  });
});
