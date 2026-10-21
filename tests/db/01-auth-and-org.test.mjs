// Auth, profile creation and organization creation, as real signed-in users.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { enabled } from "./lib/env.mjs";
import { isDenied } from "./lib/api.mjs";
import { createFixture } from "./lib/fixture.mjs";

const TABLES = ["profiles", "organizations", "memberships", "factories", "audit_log", "platform_staff"];

describe("auth and organization creation", { skip: !enabled }, () => {
  let f;
  before(async () => {
    f = await createFixture(["a", "v"]);
  });
  after(async () => f?.cleanup());

  it("anonymous users cannot read any protected table", async () => {
    for (const t of TABLES) {
      const r = await f.api.rest(undefined, "GET", `${t}?select=*&limit=1`);
      assert.ok(isDenied(r) || (r.ok && r.body.length === 0), `${t}: anon got status ${r.status}`);
    }
  });

  it("anonymous users cannot call create_organization", async () => {
    const r = await f.api.rpc(undefined, "create_organization", { p_name: "Anon Org Attempt" });
    assert.ok(isDenied(r), `status ${r.status}`);
  });

  it("a new auth user received a profile row (only id populated)", async () => {
    const r = await f.api.rest(f.users.a.token, "GET", `profiles?id=eq.${f.users.a.id}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 1);
    assert.equal(r.body[0].full_name, null);
  });

  it("rejects invalid organization names", async () => {
    for (const name of ["", " ", "x", "y".repeat(201)]) {
      const r = await f.api.rpc(f.users.v.token, "create_organization", { p_name: name });
      assert.equal(r.ok, false, `name length ${name.length} should fail`);
    }
  });

  it("a confirmed user can create one organization and becomes its owner", async () => {
    const r = await f.createOrg("a");
    assert.equal(r.status, 200, r.text);
    const orgId = r.body;
    const org = await f.api.rest(f.users.a.token, "GET", `organizations?id=eq.${orgId}`);
    assert.equal(org.body.length, 1);
    assert.equal(org.body[0].created_by, f.users.a.id);
    const m = await f.api.rest(f.users.a.token, "GET", `memberships?organization_id=eq.${orgId}`);
    assert.equal(m.body.length, 1);
    assert.equal(m.body[0].role, "owner");
    assert.equal(m.body[0].user_id, f.users.a.id);
  });

  it("a second organization for the same user is rejected", async () => {
    const r = await f.createOrg("a", `M13B2 TEST ${f.runId} a-second`);
    assert.equal(r.ok, false);
    assert.match(r.text, /already belongs/);
  });

  it("create_organization ignores unexpected arguments (no way to pass a user or role)", async () => {
    const r = await f.api.rpc(f.users.v.token, "create_organization", {
      p_name: `M13B2 TEST ${f.runId} v`,
      p_user_id: f.users.a.id,
      p_role: "owner",
    });
    // PostgREST rejects unknown named arguments (no matching function).
    assert.equal(r.ok, false);
  });
});
