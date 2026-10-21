// Two-user tenant isolation and factory rules. All requests use each user's own session.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { enabled } from "./lib/env.mjs";
import { isDenied } from "./lib/api.mjs";
import { createFixture, factoryBody } from "./lib/fixture.mjs";

describe("tenant isolation and factory rules", { skip: !enabled }, () => {
  let f, orgA, orgB, factoryA, factoryB;
  before(async () => {
    f = await createFixture(["a", "b"]);
    orgA = (await f.createOrg("a")).body;
    orgB = (await f.createOrg("b")).body;
    const fa = await f.api.rest(f.users.a.token, "POST", "factories", { body: factoryBody(orgA) });
    const fb = await f.api.rest(f.users.b.token, "POST", "factories", { body: factoryBody(orgB) });
    factoryA = fa.body[0];
    factoryB = fb.body[0];
  });
  after(async () => f?.cleanup());

  it("each owner can create and read their own factory", () => {
    assert.ok(factoryA?.id && factoryB?.id);
    assert.equal(factoryA.created_by, f.users.a.id, "created_by defaults to the session user");
  });

  it("B cannot read A's organization, memberships or factories", async () => {
    const o = await f.api.rest(f.users.b.token, "GET", `organizations?id=eq.${orgA}`);
    const m = await f.api.rest(f.users.b.token, "GET", `memberships?organization_id=eq.${orgA}`);
    const fa = await f.api.rest(f.users.b.token, "GET", `factories?organization_id=eq.${orgA}`);
    for (const r of [o, m, fa]) {
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, []);
    }
  });

  it("unfiltered lists return only the caller's own rows", async () => {
    const orgs = await f.api.rest(f.users.b.token, "GET", "organizations");
    const factories = await f.api.rest(f.users.b.token, "GET", "factories");
    assert.deepEqual(orgs.body.map((r) => r.id), [orgB]);
    assert.deepEqual(factories.body.map((r) => r.id), [factoryB.id]);
  });

  it("B cannot insert a factory into A's organization", async () => {
    const r = await f.api.rest(f.users.b.token, "POST", "factories", {
      body: factoryBody(orgA, "Intruder Plant"),
    });
    assert.ok(isDenied(r), `status ${r.status}`);
  });

  it("B cannot update A's organization or factory (no rows affected)", async () => {
    const o = await f.api.rest(f.users.b.token, "PATCH", `organizations?id=eq.${orgA}`, {
      body: { name: "Hijacked" },
    });
    const fa = await f.api.rest(f.users.b.token, "PATCH", `factories?id=eq.${factoryA.id}`, {
      body: { name: "Hijacked Plant" },
    });
    assert.deepEqual(o.body, []);
    assert.deepEqual(fa.body, []);
    const check = await f.api.rest(f.users.a.token, "GET", `organizations?id=eq.${orgA}`);
    assert.notEqual(check.body[0].name, "Hijacked");
  });

  it("B cannot move own factory into A's organization (organization_id not updatable)", async () => {
    const r = await f.api.rest(f.users.b.token, "PATCH", `factories?id=eq.${factoryB.id}`, {
      body: { organization_id: orgA },
    });
    assert.ok(isDenied(r), `status ${r.status}`);
  });

  it("client cannot supply created_by on insert", async () => {
    const r = await f.api.rest(f.users.a.token, "POST", "factories", {
      body: { ...factoryBody(orgA, "Spoof Plant"), created_by: f.users.b.id },
    });
    assert.ok(isDenied(r), `status ${r.status}`);
  });

  it("duplicate active factory name in the same organization is rejected; archived names are reusable", async () => {
    const dup = await f.api.rest(f.users.a.token, "POST", "factories", {
      body: factoryBody(orgA, factoryA.name.toUpperCase()),
    });
    assert.equal(dup.status, 409);
    const arch = await f.api.rest(f.users.a.token, "PATCH", `factories?id=eq.${factoryA.id}`, {
      body: { archived_at: new Date().toISOString() },
    });
    assert.equal(arch.status, 200);
    const again = await f.api.rest(f.users.a.token, "POST", "factories", {
      body: factoryBody(orgA, factoryA.name),
    });
    assert.equal(again.status, 201, again.text);
  });

  it("the same factory name in another organization is allowed", async () => {
    const r = await f.api.rest(f.users.b.token, "POST", "factories", {
      body: factoryBody(orgB, "Synthetic Plant 2"),
    });
    assert.equal(r.status, 201);
  });

  it("owners cannot hard-delete factories or organizations", async () => {
    const a = await f.api.rest(f.users.a.token, "DELETE", `factories?id=eq.${factoryA.id}`);
    const b = await f.api.rest(f.users.a.token, "DELETE", `organizations?id=eq.${orgA}`);
    assert.ok(isDenied(a), `factory delete status ${a.status}`);
    assert.ok(isDenied(b), `organization delete status ${b.status}`);
  });

  it("owner can edit name/legal_name but not archived_at or created_by", async () => {
    const ok = await f.api.rest(f.users.a.token, "PATCH", `organizations?id=eq.${orgA}`, {
      body: { legal_name: "Synthetic Legal Name Ltd" },
    });
    assert.equal(ok.status, 200);
    for (const body of [{ archived_at: new Date().toISOString() }, { created_by: f.users.b.id }]) {
      const r = await f.api.rest(f.users.a.token, "PATCH", `organizations?id=eq.${orgA}`, { body });
      assert.ok(isDenied(r), `status ${r.status}`);
    }
  });

  it("users can edit own profile but not another user's", async () => {
    const own = await f.api.rest(f.users.a.token, "PATCH", `profiles?id=eq.${f.users.a.id}`, {
      body: { full_name: "Synthetic A" },
    });
    assert.equal(own.status, 200);
    const other = await f.api.rest(f.users.a.token, "PATCH", `profiles?id=eq.${f.users.b.id}`, {
      body: { full_name: "Hijacked" },
    });
    assert.deepEqual(other.body, []);
    const read = await f.api.rest(f.users.a.token, "GET", `profiles?id=eq.${f.users.b.id}`);
    assert.deepEqual(read.body, []);
  });
});
