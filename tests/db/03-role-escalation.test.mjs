// Attempts by manufacturers to gain roles, and checks of staff read-only access.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { enabled } from "./lib/env.mjs";
import { isDenied } from "./lib/api.mjs";
import { createFixture } from "./lib/fixture.mjs";

describe("role escalation", { skip: !enabled }, () => {
  let f, orgA, orgB;
  before(async () => {
    f = await createFixture(["a", "b", "admin", "rev"], { staff: { admin: "admin", rev: "reviewer" } });
    orgA = (await f.createOrg("a")).body;
    orgB = (await f.createOrg("b")).body;
  });
  after(async () => f?.cleanup());

  it("a manufacturer cannot add themselves to another organization or become owner", async () => {
    const r = await f.api.rest(f.users.b.token, "POST", "memberships", {
      body: { organization_id: orgA, user_id: f.users.b.id, role: "owner" },
    });
    assert.ok(isDenied(r), `status ${r.status}`);
  });

  it("a manufacturer cannot change role or membership rows", async () => {
    const up = await f.api.rest(f.users.a.token, "PATCH", `memberships?user_id=eq.${f.users.a.id}`, {
      body: { role: "member" },
    });
    const del = await f.api.rest(f.users.a.token, "DELETE", `memberships?user_id=eq.${f.users.a.id}`);
    assert.ok(isDenied(up), `update status ${up.status}`);
    assert.ok(isDenied(del), `delete status ${del.status}`);
  });

  it("a manufacturer cannot create, change or delete platform_staff rows", async () => {
    const ins = await f.api.rest(f.users.a.token, "POST", "platform_staff", {
      body: { user_id: f.users.a.id, role: "admin" },
    });
    const up = await f.api.rest(f.users.admin.token, "PATCH", `platform_staff?user_id=eq.${f.users.rev.id}`, {
      body: { role: "admin" },
    });
    assert.ok(isDenied(ins), `insert status ${ins.status}`);
    assert.ok(isDenied(up), `even an admin cannot update through the API: status ${up.status}`);
    const read = await f.api.rest(f.users.a.token, "GET", "platform_staff");
    assert.deepEqual(read.body, []);
  });

  it("private helper functions are not reachable through the API", async () => {
    for (const fn of ["is_org_member", "is_org_owner", "is_platform_admin"]) {
      const r = await f.api.rpc(f.users.a.token, fn, { p_org: orgA });
      assert.ok([404, 406].includes(r.status), `${fn}: status ${r.status}`);
      const p = await f.api.rpc(f.users.a.token, fn, { p_org: orgA }, { headers: { "Content-Profile": "private" } });
      assert.ok([404, 406].includes(p.status), `${fn} via profile: status ${p.status}`);
    }
  });

  it("self-service user metadata cannot grant any access", async () => {
    const meta = await f.api.auth(f.users.a.token, "PUT", "user", {
      data: { role: "admin", platform_role: "admin", is_admin: true },
    });
    assert.ok(meta.status < 500);
    const audit = await f.api.rest(f.users.a.token, "GET", "audit_log?limit=1");
    const orgs = await f.api.rest(f.users.a.token, "GET", "organizations");
    assert.ok(isDenied(audit) || (audit.ok && audit.body.length === 0));
    assert.deepEqual(orgs.body.map((o) => o.id), [orgA]);
  });

  it("a platform admin can read all organizations but cannot change them", async () => {
    const orgs = await f.api.rest(f.users.admin.token, "GET", "organizations");
    const ids = orgs.body.map((o) => o.id);
    assert.ok(ids.includes(orgA) && ids.includes(orgB));
    const w = await f.api.rest(f.users.admin.token, "PATCH", `organizations?id=eq.${orgA}`, {
      body: { name: "Admin Edit" },
    });
    assert.deepEqual(w.body, []);
    const ins = await f.api.rest(f.users.admin.token, "POST", "memberships", {
      body: { organization_id: orgA, user_id: f.users.admin.id, role: "owner" },
    });
    assert.ok(isDenied(ins), `status ${ins.status}`);
  });

  it("a reviewer sees no tenant data in M1", async () => {
    for (const t of ["organizations", "factories", "memberships", "audit_log"]) {
      const r = await f.api.rest(f.users.rev.token, "GET", t);
      assert.ok(isDenied(r) || (r.ok && r.body.length === 0), `${t}: status ${r.status}`);
    }
  });
});
