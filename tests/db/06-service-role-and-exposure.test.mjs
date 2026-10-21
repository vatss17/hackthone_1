// PRIVILEGED assertions about what service_role can and cannot do, plus checks
// that the private schema is not exposed through the Data API.
// The secret key is used only to assert limits, never to make a test pass.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { enabled } from "./lib/env.mjs";
import { isDenied } from "./lib/api.mjs";
import { rawPrivileged } from "./lib/admin.mjs";
import { createFixture } from "./lib/fixture.mjs";

describe("service_role limits and API exposure", { skip: !enabled }, () => {
  let f;
  before(async () => {
    f = await createFixture(["a"]);
  });
  after(async () => f?.cleanup());

  it("service_role can read audit_log", async () => {
    const r = await rawPrivileged("GET", "/rest/v1/audit_log?limit=1");
    assert.equal(r.status, 200);
  });

  it("service_role cannot insert, update or delete audit_log rows", async () => {
    const ins = await rawPrivileged("POST", "/rest/v1/audit_log", {
      actor_kind: "system",
      action: "fake.insert",
      entity_type: "fake",
    });
    const up = await rawPrivileged("PATCH", "/rest/v1/audit_log?id=gt.0", { action: "x.y" });
    const del = await rawPrivileged("DELETE", "/rest/v1/audit_log?id=gt.0");
    for (const [name, r] of [["insert", ins], ["update", up], ["delete", del]]) {
      assert.ok(isDenied(r), `${name}: status ${r.status}`);
    }
  });

  // Observed on the dev project: Supabase's default ACL gives service_role EXECUTE on
  // new functions in public, so the privilege itself is NOT revoked. The security
  // property that matters is that service_role still cannot create an organization,
  // because the function derives the user from auth.uid(), which is null for it.
  it("service_role cannot create an organization (function rejects a caller without auth.uid())", async () => {
    const r = await rawPrivileged("POST", "/rest/v1/rpc/create_organization", {
      p_name: `M13B2 TEST service-role attempt`,
    });
    assert.equal(r.ok, false, `unexpectedly succeeded: status ${r.status}`);
    assert.match(JSON.stringify(r.body), /not authenticated|permission denied/i);
    const orgs = await rawPrivileged("GET", "/rest/v1/organizations?name=eq.M13B2%20TEST%20service-role%20attempt");
    assert.deepEqual(orgs.body, [], "an organization was created");
  });

  it("the private schema is not selectable through the Data API", async () => {
    for (const token of [undefined, f.users.a.token]) {
      const r = await f.api.rest(token, "GET", "is_org_member?limit=1", {
        headers: { "Accept-Profile": "private" },
      });
      assert.ok([404, 406].includes(r.status), `status ${r.status}`);
    }
  });

  // Both checks assert on a definite, observed response; neither can pass by returning early.
  // On the dev project: the REST root document is refused to non-secret keys (401), and
  // pg_graphql is not enabled. If either behaviour changes, the test falls through to the
  // content assertions instead of passing silently, and fails on any other status.
  const OUR_TABLES = ["profiles", "organizations", "memberships", "factories", "audit_log", "platform_staff"];

  it("the REST root (OpenAPI) document is not served to a publishable key, or lists none of our tables or private functions", async (t) => {
    const r = await f.api.rest(undefined, "GET", "", { headers: { Accept: "application/openapi+json" } });
    if (r.status === 200 && r.body?.paths) {
      const paths = Object.keys(r.body.paths);
      assert.ok(paths.length > 0, "empty OpenAPI document: nothing was inspected");
      for (const table of OUR_TABLES) assert.ok(!paths.includes(`/${table}`), `anon OpenAPI lists /${table}`);
      assert.ok(!paths.some((p) => /is_org_|is_platform_admin/.test(p)), "anon OpenAPI lists private functions");
      t.diagnostic(`OpenAPI document served; ${paths.length} paths inspected`);
    } else {
      assert.equal(r.status, 401, `unexpected status ${r.status}; cannot treat as not-served`);
      assert.match(JSON.stringify(r.body), /secret api key required/i);
      t.diagnostic("OpenAPI root refused to a publishable key (401): nothing to enumerate");
    }
  });

  it("GraphQL does not expose our tables (not enabled, or introspection lists none)", async (t) => {
    const cfg = (await import("./lib/env.mjs")).loadConfig();
    const res = await fetch(`${cfg.url}/graphql/v1`, {
      method: "POST",
      headers: { apikey: cfg.publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __schema { types { name } } }" }),
    });
    const body = await res.json().catch(() => null);
    const types = body?.data?.__schema?.types?.map((x) => x.name) ?? [];
    if (types.length > 0) {
      const leaked = types.filter((n) => /profile|organization|membership|factor|audit_?log|platform_?staff/i.test(n));
      assert.deepEqual(leaked, [], `anon GraphQL exposes: ${leaked.join(",")}`);
      t.diagnostic(`GraphQL introspection returned ${types.length} types; none match our tables`);
    } else {
      assert.match(JSON.stringify(body), /pg_graphql extension is not enabled/i, `unexpected GraphQL response: status ${res.status}`);
      t.diagnostic("pg_graphql is not enabled on the project: nothing exposed through GraphQL");
    }
  });
});
