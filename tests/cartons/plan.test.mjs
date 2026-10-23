// Pure tests: full and partial cartons always reconcile with the shipment total.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cartonPlan } from "../../src/lib/cartons/plan.ts";

describe("carton plan", () => {
  it("1,000 units at 24 per carton and 250 g: 41 full cartons of 984 units plus one partial carton of 16", () => {
    const p = cartonPlan({ units: 1000, unitsPerCarton: 24, unitWeightG: 250, cartonGrossKg: 6.5 });
    assert.equal(p.rows.length, 2);
    assert.deepEqual({ ...p.rows[0] }, { kind: "full", cartons: 41, unitsPerCarton: 24, units: 984, netKg: 246, grossKg: 266.5, grossBasis: "entered" });
    assert.equal(p.rows[1].kind, "partial");
    assert.equal(p.rows[1].cartons, 1);
    assert.equal(p.rows[1].units, 16);
    assert.equal(p.rows[1].netKg, 4);
    assert.equal(p.totals.cartons, 42);
    assert.equal(p.totals.units, 1000);
    assert.equal(p.totals.netKg, 250);
    assert.ok(p.hasPartial);
  });
  it("the partial carton's gross weight is an explicit assumption unless entered", () => {
    const est = cartonPlan({ units: 1000, unitsPerCarton: 24, unitWeightG: 250, cartonGrossKg: 6.5 }).rows[1];
    assert.equal(est.grossBasis, "scaled_estimate");
    assert.equal(est.grossKg, 4.33);
    const entered = cartonPlan({ units: 1000, unitsPerCarton: 24, unitWeightG: 250, cartonGrossKg: 6.5, partialGrossKg: 4.6 }).rows[1];
    assert.equal(entered.grossBasis, "entered");
    assert.equal(entered.grossKg, 4.6);
  });
  it("total gross is the sum of the rows", () => {
    const p = cartonPlan({ units: 1000, unitsPerCarton: 24, unitWeightG: 250, cartonGrossKg: 6.5, partialGrossKg: 4.6 });
    assert.equal(p.totals.grossKg, 271.1);
  });
  it("an exact multiple has no partial carton", () => {
    const p = cartonPlan({ units: 960, unitsPerCarton: 24, unitWeightG: 250, cartonGrossKg: 6.5 });
    assert.equal(p.rows.length, 1);
    assert.equal(p.hasPartial, false);
    assert.equal(p.totals.cartons, 40);
  });
  it("fewer units than one carton is a single partial carton", () => {
    const p = cartonPlan({ units: 10, unitsPerCarton: 24, unitWeightG: 100, cartonGrossKg: 3 });
    assert.equal(p.rows.length, 1);
    assert.equal(p.rows[0].kind, "partial");
    assert.equal(p.totals.units, 10);
  });
  it("never invents weights: unknown inputs give null totals", () => {
    const p = cartonPlan({ units: 1000, unitsPerCarton: 24, unitWeightG: null, cartonGrossKg: null });
    assert.equal(p.totals.netKg, null);
    assert.equal(p.totals.grossKg, null);
    assert.equal(p.rows[1].grossBasis, "unknown");
    assert.equal(p.totals.units, 1000);
  });
  it("rejects nonsense safely", () => {
    for (const bad of [{ units: 0, unitsPerCarton: 24 }, { units: 100, unitsPerCarton: 0 }, { units: 10.5, unitsPerCarton: 2 }, { units: -4, unitsPerCarton: 2 }]) {
      assert.deepEqual(cartonPlan({ ...bad, unitWeightG: 1, cartonGrossKg: 1 }).rows, []);
    }
  });
  it("units always reconcile over a range of shipments", () => {
    for (const [u, n] of [[1, 1], [7, 3], [1000, 24], [999, 24], [24, 24], [25, 24], [100000, 37]]) {
      const p = cartonPlan({ units: u, unitsPerCarton: n, unitWeightG: 13, cartonGrossKg: 5 });
      assert.equal(p.totals.units, u, `${u}/${n}`);
      assert.equal(p.totals.netKg, Math.round(u * 13) / 1000, `${u}/${n} net`);
    }
  });
});
