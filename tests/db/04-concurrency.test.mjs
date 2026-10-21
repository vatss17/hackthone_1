// Concurrent organization creation: the per-user row lock plus unique(user_id).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { enabled } from "./lib/env.mjs";
import { createFixture } from "./lib/fixture.mjs";

describe("concurrent organization creation", { skip: !enabled }, () => {
  let f;
  before(async () => {
    f = await createFixture(["c", "d1", "d2", "d3"]);
  });
  after(async () => f?.cleanup());

  it("8 parallel calls by one user: exactly one succeeds, the rest are rejected", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        f.api.rpc(f.users.c.token, "create_organization", { p_name: `M13B2 TEST ${f.runId} c-${i}` }),
      ),
    );
    const ok = results.filter((r) => r.ok);
    ok.forEach((r) => f.trackOrg(r.body));
    assert.equal(ok.length, 1, `successes: ${ok.length}`);
    for (const r of results.filter((x) => !x.ok)) {
      assert.match(r.text, /already belongs/, `unexpected rejection: status ${r.status}`);
    }
    const orgs = await f.api.rest(f.users.c.token, "GET", "organizations");
    const memberships = await f.api.rest(f.users.c.token, "GET", "memberships");
    assert.equal(orgs.body.length, 1);
    assert.equal(memberships.body.length, 1);
  });

  it("different users creating organizations in parallel all succeed", async () => {
    const results = await Promise.all(
      ["d1", "d2", "d3"].map((l) => f.createOrg(l, `M13B2 TEST ${f.runId} ${l}`)),
    );
    assert.ok(results.every((r) => r.ok), results.map((r) => r.status).join(","));
  });
});
