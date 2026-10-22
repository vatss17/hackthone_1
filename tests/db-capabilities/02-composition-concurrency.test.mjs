// Concurrency tests for the M1.4B constraints, using PARALLEL AUTHENTICATED REQUESTS.
//
// Each request is its own database transaction on its own pooled connection, so firing two or more
// at once is a genuine multi-connection race. RUN ONLY AFTER the migration has been applied to the
// hosted development project (they skip, never pass, until then).
//
// What this can and cannot show: the outcome of a race is not deterministic, so each scenario is
// repeated ROUNDS times and asserts INVARIANTS (never more than 100 percent, never two winners for a
// unique key). Passing makes a lost-update bug much less likely; it is evidence, not a proof. For a
// controlled, deterministic interleaving use the manual two-session script in
// docs/m1.4b-security-review.md section E.
//
//   Run:  npm run test:db:capabilities     (CONCURRENCY_ROUNDS=25 for a longer run)
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { enabled } from "../db/lib/env.mjs";
import { createFixture } from "../db/lib/fixture.mjs";
import { SKIP_REASON, codeOf, factoryBody, migrationApplied, referenceIds, rowsOf } from "./lib.mjs";

const ROUNDS = Number(process.env.CONCURRENCY_ROUNDS ?? 10);
const parallel = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));
const oks = (rs) => rs.filter((r) => r.ok && (r.status !== 200 || rowsOf(r).length > 0));

describe("composition and uniqueness under concurrency", { skip: !enabled }, () => {
  let f, ready = false, ref, orgA, FA, run = 0;
  const token = () => f.users.a.token;
  const rest = (m, p, body) => f.api.rest(token(), m, p, body === undefined ? {} : { body });
  const skipIfNot = (t) => { if (!ready) { t.skip(SKIP_REASON); return true; } return false; };
  const newProduct = async (label) =>
    rowsOf(await rest("POST", "products", { organization_id: orgA, name: `M14B ${f.runId} ${label} ${run++}` }))[0].id;
  const addShare = (productId, materialIdOrName, share) =>
    rest("POST", "product_materials", {
      organization_id: orgA,
      product_id: productId,
      ...(materialIdOrName.length === 36 ? { material_id: materialIdOrName } : { custom_name: materialIdOrName }),
      share_percent: share,
    });
  const total = async (productId) =>
    rowsOf(await rest("GET", `product_materials?product_id=eq.${productId}&select=share_percent`)).reduce((s, r) => s + Number(r.share_percent), 0);

  before(async () => {
    f = await createFixture(["a"]);
    ready = await migrationApplied(f.api, token());
    if (!ready) return;
    orgA = (await f.createOrg("a")).body;
    ref = await referenceIds(f.api, token());
    FA = rowsOf(await rest("POST", "factories", factoryBody(orgA, `M14B ${f.runId} concurrency`)))[0].id;
  });
  after(async () => f?.cleanup());

  it("two parallel inserts of 60 percent: exactly one succeeds (repeated)", async (t) => {
    if (skipIfNot(t)) return;
    for (let i = 0; i < ROUNDS; i++) {
      const p = await newProduct("ins60");
      const rs = await Promise.all([addShare(p, ref.mat.PP, 60), addShare(p, ref.mat.HDPE, 60)]);
      assert.equal(oks(rs).length, 1, `round ${i}: ${rs.map((r) => r.status).join(",")}`);
      assert.equal(codeOf(rs.find((r) => !r.ok)), "23514");
      assert.equal(await total(p), 60, `round ${i}: total ${await total(p)}`);
    }
  });

  it("two parallel updates (40 -> 60 on two rows): exactly one succeeds, total never exceeds 100 (repeated)", async (t) => {
    if (skipIfNot(t)) return;
    for (let i = 0; i < ROUNDS; i++) {
      const p = await newProduct("upd");
      assert.ok((await addShare(p, ref.mat.PP, 40)).ok && (await addShare(p, ref.mat.HDPE, 40)).ok);
      const rs = await Promise.all([
        rest("PATCH", `product_materials?product_id=eq.${p}&material_id=eq.${ref.mat.PP}`, { share_percent: 60 }),
        rest("PATCH", `product_materials?product_id=eq.${p}&material_id=eq.${ref.mat.HDPE}`, { share_percent: 60 }),
      ]);
      assert.equal(oks(rs).length, 1, `round ${i}: ${rs.map((r) => `${r.status}/${rowsOf(r).length}`).join(",")}`);
      assert.equal(await total(p), 100, `round ${i}`);
    }
  });

  it("eight parallel inserts of 20 percent: exactly five succeed and the total is exactly 100", async (t) => {
    if (skipIfNot(t)) return;
    for (let i = 0; i < Math.max(3, Math.floor(ROUNDS / 2)); i++) {
      const p = await newProduct("many");
      const rs = await parallel(8, (k) => addShare(p, `Material ${k}`, 20));
      assert.equal(oks(rs).length, 5, `round ${i}: ${oks(rs).length} succeeded`);
      assert.equal(await total(p), 100);
      for (const r of rs.filter((x) => !x.ok)) assert.equal(codeOf(r), "23514");
    }
  });

  it("an insert racing an update of the same product never pushes the total past 100 (repeated)", async (t) => {
    if (skipIfNot(t)) return;
    for (let i = 0; i < ROUNDS; i++) {
      const p = await newProduct("mixed");
      assert.ok((await addShare(p, ref.mat.PP, 50)).ok);
      const rs = await Promise.all([
        addShare(p, ref.mat.HDPE, 50),
        rest("PATCH", `product_materials?product_id=eq.${p}&material_id=eq.${ref.mat.PP}`, { share_percent: 60 }),
      ]);
      const sum = await total(p);
      assert.ok(sum <= 100, `round ${i}: total ${sum}`);
      assert.ok(oks(rs).length >= 1, `round ${i}: nothing succeeded`);
    }
  });

  it("compositions of DIFFERENT products do not block or deadlock each other", async (t) => {
    if (skipIfNot(t)) return;
    const products = await parallel(6, (k) => newProduct(`indep${k}`));
    const rs = await parallel(6, (k) => addShare(products[k], ref.mat.PP, 60));
    assert.equal(oks(rs).length, 6, rs.map((r) => `${r.status}:${codeOf(r) ?? ""}`).join(","));
  });

  it("eight parallel creations of one product name: exactly one succeeds (unique index)", async (t) => {
    if (skipIfNot(t)) return;
    const name = `M14B ${f.runId} same-name`;
    const rs = await parallel(8, () => rest("POST", "products", { organization_id: orgA, name }));
    assert.equal(oks(rs).length, 1);
    for (const r of rs.filter((x) => !x.ok)) assert.equal(codeOf(r), "23505");
  });

  it("six parallel factory-wide capacity rows for one factory: exactly one succeeds", async (t) => {
    if (skipIfNot(t)) return;
    const rs = await parallel(6, () =>
      rest("POST", "factory_processes", { organization_id: orgA, factory_id: FA, scope: "factory_wide", capacity_quantity: 100, capacity_unit: "tonnes", capacity_period: "month" }));
    assert.equal(oks(rs).length, 1);
    for (const r of rs.filter((x) => !x.ok)) assert.equal(codeOf(r), "23505");
  });

  it("parallel duplicate links and capabilities: one winner each", async (t) => {
    if (skipIfNot(t)) return;
    const p = await newProduct("link");
    const links = await parallel(6, () => rest("POST", "factory_products", { organization_id: orgA, factory_id: FA, product_id: p }));
    assert.equal(oks(links).length, 1);
    const caps = await parallel(6, () => rest("POST", "factory_processes", { organization_id: orgA, factory_id: FA, process_id: ref.proc.blow_moulding }));
    assert.equal(oks(caps).length, 1);
  });
});
