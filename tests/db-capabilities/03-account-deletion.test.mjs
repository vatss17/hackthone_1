// Account deletion under archived parents (migration 20261022170000), against the hosted DEVELOPMENT project.
// Needs both M1.4B migrations and the corrective one. Synthetic users only.
// Run:  npm run test:db:capabilities
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { enabled } from "../db/lib/env.mjs";
import { isDenied } from "../db/lib/api.mjs";
import { archiveOrganization, deleteUser, rawPrivileged } from "../db/lib/admin.mjs";
import { createFixture } from "../db/lib/fixture.mjs";
import { SKIP_REASON, auditActions, codeOf, factoryBody, migrationApplied, referenceIds, rowsOf } from "./lib.mjs";

const CHILD = ["factory_processes", "machines", "factory_materials", "product_specifications", "product_materials", "factory_products", "certifications"];
const ALL = [...CHILD, "products"];
const strip = (r) => { const { created_by, updated_at, ...rest } = r; return rest; };

describe("account deletion beneath archived parents", { skip: !enabled }, () => {
  let f, ready = false, orgA, orgB, F1, F2, P1, P2, snapshot, auditBefore;
  const tokenA = () => f.users.a.token;
  const tokenB = () => f.users.b.token;
  const rest = (t, m, p, body) => f.api.rest(t, m, p, body === undefined ? {} : { body });
  const priv = async (table, orgId) => rowsOf(await rawPrivileged("GET", `/rest/v1/${table}?organization_id=eq.${orgId}&select=*&order=id.asc`));

  before(async () => {
    f = await createFixture(["a", "b"]);
    ready = await migrationApplied(f.api, tokenA());
    if (!ready) return;
    orgA = (await f.createOrg("a")).body;
    orgB = (await f.createOrg("b")).body;
    const ref = await referenceIds(f.api, tokenA());
    const mk = async (t, path, body) => { const r = await rest(t, "POST", path, body); assert.ok(r.ok, `${path}: ${r.status} ${codeOf(r)}`); return rowsOf(r)[0]; };
    F1 = (await mk(tokenA(), "factories", factoryBody(orgA, `M14B1 ${f.runId} F1`))).id;
    F2 = (await mk(tokenA(), "factories", factoryBody(orgA, `M14B1 ${f.runId} F2`))).id;
    P1 = (await mk(tokenA(), "products", { organization_id: orgA, name: `M14B1 ${f.runId} P1` })).id;
    P2 = (await mk(tokenA(), "products", { organization_id: orgA, name: `M14B1 ${f.runId} P2` })).id;
    for (const fid of [F1, F2]) {
      await mk(tokenA(), "factory_processes", { organization_id: orgA, factory_id: fid, process_id: ref.proc.injection_moulding });
      await mk(tokenA(), "machines", { organization_id: orgA, factory_id: fid, name: `Press ${fid.slice(0, 4)}` });
      await mk(tokenA(), "factory_materials", { organization_id: orgA, factory_id: fid, material_id: ref.mat.PP });
      await mk(tokenA(), "certifications", { organization_id: orgA, factory_id: fid, name: `Plant cert ${fid.slice(0, 4)}`, kind: "licence", issuer: "Test Body" });
    }
    for (const pid of [P1, P2]) {
      await mk(tokenA(), "product_specifications", { organization_id: orgA, product_id: pid, name: "Colour", value_text: "Natural" });
      await mk(tokenA(), "product_materials", { organization_id: orgA, product_id: pid, material_id: ref.mat.PP, share_percent: 60 });
      await mk(tokenA(), "certifications", { organization_id: orgA, product_id: pid, name: `Product cert ${pid.slice(0, 4)}`, kind: "product_test", issuer: "Test Lab" });
    }
    for (const [fid, pid] of [[F1, P1], [F2, P1], [F1, P2]]) await mk(tokenA(), "factory_products", { organization_id: orgA, factory_id: fid, product_id: pid });
    // archive one factory and one product through the real API
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `factories?id=eq.${F2}`, { archived_at: new Date().toISOString() })).length, 1);
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `products?id=eq.${P2}`, { archived_at: new Date().toISOString() })).length, 1);
  });
  after(async () => f?.cleanup());

  it("before deletion: archived records are protected from the owner (edit, move, restore, delete, created_by)", async (t) => {
    if (!ready) return t.skip(SKIP_REASON);
    const machine = rowsOf(await rest(tokenA(), "GET", `machines?factory_id=eq.${F2}&select=id`))[0].id;
    assert.equal(codeOf(await rest(tokenA(), "PATCH", `machines?id=eq.${machine}`, { notes: "x" })), "55000");
    assert.equal(codeOf(await rest(tokenA(), "DELETE", `factory_products?factory_id=eq.${F2}`)), "55000");
    assert.equal(codeOf(await rest(tokenA(), "PATCH", `product_specifications?product_id=eq.${P2}`, { value_text: "x" })), "55000");
    assert.ok(isDenied(await rest(tokenA(), "PATCH", `machines?id=eq.${machine}`, { factory_id: F1 })), "moving a machine must be denied");
    assert.ok(isDenied(await rest(tokenA(), "PATCH", `machines?id=eq.${machine}`, { created_by: f.users.b.id })), "created_by must not be writable");
    assert.ok(isDenied(await rest(tokenA(), "PATCH", `machines?id=eq.${machine}`, { created_by: null })), "created_by must not be writable");
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `factories?id=eq.${F2}`, { archived_at: null })).length, 0, "archived factory restored");
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `products?id=eq.${P2}`, { archived_at: null })).length, 0, "archived product restored");
  });

  it("a privileged caller still cannot edit, move, re-attribute or delete frozen rows while the creator exists", async (t) => {
    if (!ready) return t.skip(SKIP_REASON);
    const machine = rowsOf(await rawPrivileged("GET", `/rest/v1/machines?factory_id=eq.${F2}&select=id`))[0].id;
    const patch = (b) => rawPrivileged("PATCH", `/rest/v1/machines?id=eq.${machine}`, b);
    assert.equal(codeOf(await patch({ created_by: null })), "55000", "nulling a live user's attribution must be refused");
    assert.equal(codeOf(await patch({ created_by: f.users.b.id })), "55000");
    assert.equal(codeOf(await patch({ notes: "tampered" })), "55000");
    assert.equal(codeOf(await patch({ factory_id: F1 })), "55000", "moving a frozen row into an active factory must be refused");
    assert.equal(codeOf(await rawPrivileged("DELETE", `/rest/v1/machines?id=eq.${machine}`)), "55000");
    assert.equal(codeOf(await rawPrivileged("POST", "/rest/v1/machines", { organization_id: orgA, factory_id: F2, name: "late" })), "55000");
  });

  it("deleting the account succeeds; business data stays; created_by becomes NULL; audit still records it", async (t) => {
    if (!ready) return t.skip(SKIP_REASON);
    snapshot = {};
    for (const tbl of ALL) snapshot[tbl] = await priv(tbl, orgA);
    snapshot.factories = await priv("factories", orgA);
    const total = ALL.reduce((n, tbl) => n + snapshot[tbl].length, 0);
    assert.ok(total >= 17, `fixture too small: ${total}`);
    assert.ok(CHILD.every((tbl) => snapshot[tbl].some((r) => r.created_by === f.users.a.id)), "every child table must hold a row created by the user");
    auditBefore = (await auditActions(`organization_id=eq.${orgA}`)).length;

    await archiveOrganization(orgA); // a sole owner of an ACTIVE company cannot be deleted (foundation rule)
    const del = await deleteUser(f.users.a.id);
    assert.ok(del.ok, `account deletion failed: ${del.status} ${JSON.stringify(del.body)}`);

    for (const tbl of ALL) {
      const after = await priv(tbl, orgA);
      assert.equal(after.length, snapshot[tbl].length, `${tbl}: row count changed`);
      assert.deepEqual(after.map(strip), snapshot[tbl].map(strip), `${tbl}: business data changed`);
      assert.ok(after.every((r) => r.created_by === null), `${tbl}: created_by not cleared`);
    }
    const factories = await priv("factories", orgA);
    assert.deepEqual(factories.map(strip), snapshot.factories.map(strip), "factories changed");
    assert.ok(factories.some((r) => r.archived_at) && (await priv("products", orgA)).some((r) => r.archived_at), "archive state lost");
    assert.equal(rowsOf(await rawPrivileged("GET", `/rest/v1/profiles?id=eq.${f.users.a.id}&select=id`)).length, 0, "profile still exists");

    const audit = await auditActions(`organization_id=eq.${orgA}`);
    const cleanup = audit.slice(auditBefore).filter((a) => a.action.endsWith(".update") && JSON.stringify(a.details?.changed_columns) === '["created_by"]');
    assert.ok(cleanup.length >= total - 0, `expected cleanup audit rows, found ${cleanup.length}`);
    assert.ok(cleanup.every((a) => a.actor_id === null), "cleanup entries must carry no actor");
    assert.ok(!JSON.stringify(cleanup).includes(f.users.a.id), "user id leaked into audit details");
  });

  it("after deletion: frozen rows stay frozen, another company cannot reach them", async (t) => {
    if (!ready) return t.skip(SKIP_REASON);
    const machine = rowsOf(await rawPrivileged("GET", `/rest/v1/machines?factory_id=eq.${F2}&select=id`))[0].id;
    assert.equal(codeOf(await rawPrivileged("PATCH", `/rest/v1/machines?id=eq.${machine}`, { notes: "tampered" })), "55000");
    assert.equal(codeOf(await rawPrivileged("PATCH", `/rest/v1/machines?id=eq.${machine}`, { factory_id: F1 })), "55000");
    assert.equal(codeOf(await rawPrivileged("DELETE", `/rest/v1/machines?id=eq.${machine}`)), "55000");
    for (const tbl of ALL) {
      assert.equal(rowsOf(await rest(tokenB(), "GET", `${tbl}?organization_id=eq.${orgA}`)).length, 0, `B saw ${tbl}`);
      assert.equal(rowsOf(await rest(tokenB(), "PATCH", `${tbl}?organization_id=eq.${orgA}`, { notes: "x" })).length, 0);
    }
    assert.equal(rowsOf(await rest(tokenB(), "PATCH", `factories?organization_id=eq.${orgA}`, { archived_at: null })).length, 0);
  });
});
