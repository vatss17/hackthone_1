// Security tests for the M1.4B tables and the archived-factory policy, as real signed-in users.
// RUN ONLY AFTER the migration has been applied to the hosted development project.
// Run:  npm run test:db:capabilities
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { enabled } from "../db/lib/env.mjs";
import { isDenied } from "../db/lib/api.mjs";
import { createFixture } from "../db/lib/fixture.mjs";
import { SKIP_REASON, auditActions, codeOf, factoryBody, migrationApplied, referenceIds, rowsOf } from "./lib.mjs";

describe("capabilities and products: security", { skip: !enabled }, () => {
  let f, ready = false, ref, orgA, orgB, FA, FA2, FB, PA, PB;
  const tokenA = () => f.users.a.token;
  const tokenB = () => f.users.b.token;
  const rest = (t, m, p, body) => f.api.rest(t, m, p, body === undefined ? {} : { body });
  const skipIfNot = (t) => { if (!ready) { t.skip(SKIP_REASON); return true; } return false; };

  before(async () => {
    f = await createFixture(["a", "b"]);
    ready = await migrationApplied(f.api, tokenA());
    if (!ready) return;
    orgA = (await f.createOrg("a")).body;
    orgB = (await f.createOrg("b")).body;
    ref = await referenceIds(f.api, tokenA());
    const mk = async (t, path, body) => rowsOf(await rest(t, "POST", path, body))[0];
    FA = (await mk(tokenA(), "factories", factoryBody(orgA, `M14B ${f.runId} FA`))).id;
    FA2 = (await mk(tokenA(), "factories", factoryBody(orgA, `M14B ${f.runId} FA2`))).id;
    FB = (await mk(tokenB(), "factories", factoryBody(orgB, `M14B ${f.runId} FB`))).id;
    PA = (await mk(tokenA(), "products", { organization_id: orgA, name: `M14B ${f.runId} PA` })).id;
    PB = (await mk(tokenB(), "products", { organization_id: orgB, name: `M14B ${f.runId} PB` })).id;
  });
  after(async () => f?.cleanup());

  it("reference data: readable by signed-in users, read-only, invisible to anonymous", async (t) => {
    if (skipIfNot(t)) return;
    assert.ok(rowsOf(await rest(tokenA(), "GET", "ref_processes")).length === 9);
    assert.ok(rowsOf(await rest(tokenA(), "GET", "ref_materials")).length === 14);
    for (const r of [
      await rest(tokenA(), "POST", "ref_processes", { code: "x_custom", name: "Custom" }),
      await rest(tokenA(), "PATCH", "ref_processes?code=eq.extrusion", { name: "Hacked" }),
      await rest(tokenA(), "DELETE", "ref_materials?code=eq.PP"),
    ]) assert.ok(isDenied(r), `status ${r.status}`);
    assert.ok(isDenied(await rest(undefined, "GET", "ref_processes")) || rowsOf(await rest(undefined, "GET", "ref_processes")).length === 0);
  });

  it("capabilities: duplicates, custom entries, capacity and the factory-wide row", async (t) => {
    if (skipIfNot(t)) return;
    const ins = (b) => rest(tokenA(), "POST", "factory_processes", { organization_id: orgA, factory_id: FA, ...b });
    assert.ok((await ins({ process_id: ref.proc.injection_moulding, capacity_quantity: 5000, capacity_unit: "pieces", capacity_period: "month" })).ok);
    assert.equal(codeOf(await ins({ process_id: ref.proc.injection_moulding })), "23505");
    assert.ok((await ins({ custom_name: "Solvent welding" })).ok);
    assert.equal(codeOf(await ins({ custom_name: "SOLVENT WELDING" })), "23505");
    assert.equal(codeOf(await ins({ process_id: ref.proc.extrusion, custom_name: "both" })), "23514");
    assert.equal(codeOf(await ins({ custom_name: "no unit", capacity_quantity: 10 })), "23514");
    assert.equal(codeOf(await ins({ custom_name: "zero", capacity_quantity: 0, capacity_unit: "kg", capacity_period: "day" })), "23514");
    assert.ok((await ins({ scope: "factory_wide", capacity_quantity: 900, capacity_unit: "tonnes", capacity_period: "month" })).ok);
    assert.equal(codeOf(await ins({ scope: "factory_wide", capacity_quantity: 1, capacity_unit: "tonnes", capacity_period: "day" })), "23505");
    assert.equal(codeOf(await ins({ scope: "factory_wide" })), "23514");
  });

  it("products: HS code is shape-checked and permanently unverified; protected columns are not client-writable", async (t) => {
    if (skipIfNot(t)) return;
    const ins = (b) => rest(tokenA(), "POST", "products", { organization_id: orgA, ...b });
    assert.ok((await ins({ name: `HS ok ${f.runId}`, hs_code_claimed: "3923.10" })).ok);
    assert.equal(codeOf(await ins({ name: `HS bad ${f.runId}`, hs_code_claimed: "39231" })), "23514");
    const row = rowsOf(await rest(tokenA(), "GET", `products?name=eq.HS ok ${f.runId}&select=hs_code_status`))[0];
    assert.equal(row.hs_code_status, "unverified");
    for (const r of [
      await ins({ name: `x1 ${f.runId}`, hs_code_status: "unverified" }),
      await ins({ name: `x2 ${f.runId}`, source: "ai_assisted" }),
      await ins({ name: `x3 ${f.runId}`, created_by: f.users.b.id }),
      await rest(tokenA(), "PATCH", `products?id=eq.${PA}`, { organization_id: orgB }),
      await rest(tokenA(), "PATCH", `products?id=eq.${PA}`, { hs_code_status: "unverified" }),
    ]) assert.ok(isDenied(r), `status ${r.status} ${codeOf(r)}`);

    assert.equal(codeOf(await ins({ name: `M14B ${f.runId} PA`.toUpperCase() })), "23505", "duplicate active product name must be rejected");
    assert.equal(codeOf(await ins({ name: `Dims ${f.runId}`, carton_length_mm: 100, carton_width_mm: 100 })), "23514");
  });

  it("certifications: nobody on the API can mark a certificate verified", async (t) => {
    if (skipIfNot(t)) return;
    const ins = (b) => rest(tokenA(), "POST", "certifications", { organization_id: orgA, name: `Cert ${f.runId}`, kind: "other", issuer: "Test Body", ...b });
    const made = rowsOf(await ins({ certificate_number: `N-${f.runId}` }))[0];
    assert.equal(made.verification_status, "unverified");
    for (const r of [
      await ins({ name: "v1", verification_status: "verified" }),
      await ins({ name: "v2", verified_by: f.users.a.id }),
      await rest(tokenA(), "PATCH", `certifications?id=eq.${made.id}`, { verification_status: "verified", verified_at: new Date().toISOString() }),
      await rest(tokenA(), "PATCH", `certifications?id=eq.${made.id}`, { verified_by: f.users.a.id }),
      await rest(tokenB(), "PATCH", `certifications?id=eq.${made.id}`, { verification_status: "verified" }),
      await rest(tokenA(), "POST", "certifications?on_conflict=id", { id: made.id, organization_id: orgA, name: "up", kind: "other", issuer: "Test Body", verification_status: "verified" }, undefined),
    ]) assert.ok(isDenied(r) || (Array.isArray(r.body) && r.body.length === 0), `status ${r.status}`);
    assert.equal(rowsOf(await rest(tokenA(), "GET", "certifications?verification_status=neq.unverified")).length, 0);
    assert.equal(codeOf(await ins({ name: "bad dates", issued_on: "2026-05-01", expires_on: "2026-01-01" })), "23514");
    assert.equal(codeOf(await ins({ certificate_number: `n-${f.runId}`.toUpperCase(), name: "dup number" })), "23505");
  });

  it("isolation: another company cannot link, read, change or delete these rows", async (t) => {
    if (skipIfNot(t)) return;
    assert.equal(codeOf(await rest(tokenB(), "POST", "machines", { organization_id: orgB, factory_id: FA, name: "Sneaky" })), "23503");
    assert.ok(isDenied(await rest(tokenB(), "POST", "machines", { organization_id: orgA, factory_id: FA, name: "Sneaky" })));
    assert.equal(codeOf(await rest(tokenB(), "POST", "factory_products", { organization_id: orgB, factory_id: FB, product_id: PA })), "23503");
    assert.equal(codeOf(await rest(tokenB(), "POST", "certifications", { organization_id: orgB, product_id: PA, name: "Sneaky cert", kind: "other", issuer: "Z Body" })), "23503");
    assert.equal(codeOf(await rest(tokenB(), "POST", "certifications", { organization_id: orgB, factory_id: FA, name: "Sneaky cert", kind: "other", issuer: "Z Body" })), "23503");
    for (const tbl of ["factory_processes", "machines", "factory_materials", "products", "product_specifications", "product_materials", "factory_products", "certifications"]) {
      assert.equal(rowsOf(await rest(tokenB(), "GET", `${tbl}?organization_id=eq.${orgA}`)).length, 0, `B saw A's ${tbl}`);
      assert.equal(rowsOf(await rest(undefined, "GET", `${tbl}?select=id&limit=1`)).length, 0, `anon saw ${tbl}`);
    }
    assert.equal(rowsOf(await rest(tokenB(), "PATCH", `products?id=eq.${PA}`, { description: "x" })).length, 0);
    // and the other way round: A cannot see or change B's product
    assert.equal(rowsOf(await rest(tokenA(), "GET", `products?id=eq.${PB}`)).length, 0, "A saw B's product");
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `products?id=eq.${PB}`, { description: "x" })).length, 0);
    assert.equal(rowsOf(await rest(tokenB(), "GET", `products?id=eq.${PB}`)).length, 1, "B cannot see its own product");
    assert.equal(rowsOf(await rest(tokenB(), "DELETE", `factory_processes?organization_id=eq.${orgA}`)).length, 0);
    assert.ok(rowsOf(await rest(tokenA(), "GET", `factory_processes?organization_id=eq.${orgA}`)).length >= 1, "A's rows were removed");
  });

  it("composition: shares cannot add up to more than 100 percent (sequential)", async (t) => {
    if (skipIfNot(t)) return;
    const ins = (b) => rest(tokenA(), "POST", "product_materials", { organization_id: orgA, product_id: PA, ...b });
    assert.ok((await ins({ material_id: ref.mat.PP, share_percent: 60 })).ok);
    assert.equal(codeOf(await ins({ material_id: ref.mat.HDPE, share_percent: 50 })), "23514");
    assert.ok((await ins({ custom_name: "Masterbatch", share_percent: 40 })).ok);
    assert.equal(codeOf(await ins({ custom_name: "Over", share_percent: 1 })), "23514");
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `product_materials?product_id=eq.${PA}&custom_name=eq.Masterbatch`, { share_percent: 70 })).length, 0);
  });

  it("archived factory policy: owners can archive an active factory but not edit or restore an archived one", async (t) => {
    if (skipIfNot(t)) return;
    const get = async () => rowsOf(await rest(tokenA(), "GET", `factories?id=eq.${FA2}&select=name,city,archived_at`))[0];
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `factories?id=eq.${FA2}`, { city: "Edited" })).length, 1, "active factory must be editable");
    const archived = await rest(tokenA(), "PATCH", `factories?id=eq.${FA2}`, { archived_at: new Date().toISOString() });
    assert.equal(rowsOf(archived).length, 1, "owner must be able to archive an active factory");
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `factories?id=eq.${FA2}`, { city: "Hacked" })).length, 0, "archived factory was edited");
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `factories?id=eq.${FA2}`, { archived_at: null })).length, 0, "archived factory was restored");
    const row = await get();
    assert.ok(row.archived_at && row.city === "Edited", "archived factory changed");
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `factories?id=eq.${FA2}`, { archived_at: new Date().toISOString() })).length, 0);
    assert.equal(rowsOf(await rest(tokenB(), "PATCH", `factories?id=eq.${FA2}`, { city: "x" })).length, 0);
    // a replacement with the same name works (the name is reusable once archived)
    assert.ok((await rest(tokenA(), "POST", "factories", factoryBody(orgA, row.name))).ok, "replacement factory could not be registered");
    // dependents of the archived factory are frozen
    const late = await rest(tokenA(), "POST", "machines", { organization_id: orgA, factory_id: FA2, name: "Late" });
    assert.equal(codeOf(late), "55000");
  });

  it("independent records are archived, never deleted; archived ones can be neither edited nor restored", async (t) => {
    if (skipIfNot(t)) return;
    const m = rowsOf(await rest(tokenA(), "POST", "machines", { organization_id: orgA, factory_id: FA, name: "IM-1", quantity: 2 }))[0];
    for (const tbl of ["machines", "products", "certifications"]) {
      assert.ok(isDenied(await rest(tokenA(), "DELETE", `${tbl}?organization_id=eq.${orgA}`)), `${tbl} must not be deletable`);
    }
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `machines?id=eq.${m.id}`, { archived_at: new Date().toISOString() })).length, 1);
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `machines?id=eq.${m.id}`, { notes: "x" })).length, 0);
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `machines?id=eq.${m.id}`, { archived_at: null })).length, 0);
    assert.equal(rowsOf(await rest(tokenA(), "GET", `machines?id=eq.${m.id}`)).length, 1, "archived machine must stay readable");
    // an archived product freezes its dependents and keeps its links readable
    const p = rowsOf(await rest(tokenA(), "POST", "products", { organization_id: orgA, name: `M14B ${f.runId} to-archive` }))[0];
    assert.ok((await rest(tokenA(), "POST", "factory_products", { organization_id: orgA, factory_id: FA, product_id: p.id })).ok);
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `products?id=eq.${p.id}`, { archived_at: new Date().toISOString() })).length, 1);
    assert.equal(codeOf(await rest(tokenA(), "POST", "product_specifications", { organization_id: orgA, product_id: p.id, name: "late", value_text: "x" })), "55000");
    assert.equal(codeOf(await rest(tokenA(), "DELETE", `factory_products?product_id=eq.${p.id}`)), "55000");
    assert.equal(rowsOf(await rest(tokenA(), "GET", `factory_products?product_id=eq.${p.id}`)).length, 1);
    assert.equal(rowsOf(await rest(tokenA(), "PATCH", `products?id=eq.${p.id}`, { archived_at: null })).length, 0, "archived product was restored");
  });

  it("audit: every table is audited and every link-row deletion is recorded with the acting owner", async (t) => {
    if (skipIfNot(t)) return;
    const mk = async (path, body) => rowsOf(await rest(tokenA(), "POST", path, body))[0];
    const fm = await mk("factory_materials", { organization_id: orgA, factory_id: FA, material_id: ref.mat.PET });
    const spec = await mk("product_specifications", { organization_id: orgA, product_id: PA, name: "Colour", value_text: "Natural" });
    const link = await mk("factory_products", { organization_id: orgA, factory_id: FA, product_id: PA });
    const fp = rowsOf(await rest(tokenA(), "GET", `factory_processes?factory_id=eq.${FA}&custom_name=eq.Solvent welding`))[0];
    const pm = rowsOf(await rest(tokenA(), "GET", `product_materials?product_id=eq.${PA}&custom_name=eq.Masterbatch`))[0];
    for (const [tbl, id] of [["factory_materials", fm.id], ["product_specifications", spec.id], ["factory_products", link.id], ["factory_processes", fp.id], ["product_materials", pm.id]]) {
      assert.equal(rowsOf(await rest(tokenA(), "DELETE", `${tbl}?id=eq.${id}`)).length, 1, `${tbl} delete failed`);
    }
    const acts = await auditActions(`organization_id=eq.${orgA}`);
    const seen = new Set(acts.map((a) => a.action));
    for (const tbl of ["factory_processes", "machines", "factory_materials", "products", "product_specifications", "product_materials", "factory_products", "certifications"]) {
      assert.ok(seen.has(`${tbl}.insert`), `${tbl}.insert not audited`);
    }
    for (const tbl of ["factory_materials", "product_specifications", "factory_products", "factory_processes", "product_materials"]) {
      assert.ok(acts.some((a) => a.action === `${tbl}.delete` && a.actor_id === f.users.a.id), `${tbl} deletion not audited with the owner`);
    }
    assert.ok(!JSON.stringify(acts).match(/Masterbatch|Solvent welding|Natural/), "audit rows contain business values");
  });
});
