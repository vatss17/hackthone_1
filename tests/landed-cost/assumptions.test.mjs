// Pure tests: sample versus entered values, price comparison direction and zero safety.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sampleInputs } from "../../src/lib/landed-cost/defaults.ts";
import { newAssessment } from "../../src/lib/landed-cost/assessment.ts";
import { summariseAssumptions, relevantAssumptions } from "../../src/lib/landed-cost/assumptions.ts";
import { priceGap } from "../../src/lib/landed-cost/price-gap.ts";

const fresh = () => newAssessment("r", sampleInputs());

describe("assumptions: samples versus the person's own values", () => {
  it("a fresh assessment has every relevant assumption still a sample", () => {
    const s = summariseAssumptions(fresh());
    assert.equal(s.total, 13);
    assert.equal(s.samples.length, 13);
    assert.equal(s.complete, false);
  });
  it("editing a few fields does not complete cost preparation", () => {
    const a = fresh();
    a.edited = ["unitProductionCostInr", "sellingPriceAed", "quantity"];
    const s = summariseAssumptions(a);
    assert.equal(s.entered, 3);
    assert.equal(s.samples.length, 10);
    assert.equal(s.complete, false);
  });
  it("a confirmed quote counts as examined, an accepted sample counts as examined, product facts count as examined", () => {
    const a = fresh();
    a.inputs.lines.internationalFreight.confirmed = true;
    a.acceptedSamples = ["duty.ratePercent"];
    const s = summariseAssumptions(a, ["unitsPerCarton"]);
    assert.equal(s.confirmed, 1);
    assert.equal(s.accepted, 1);
    assert.equal(s.fromProduct, 1);
    assert.equal(s.samples.length, 10);
  });
  it("is complete only when every relevant assumption is replaced, confirmed, from the product or explicitly accepted", () => {
    const a = fresh();
    a.edited = relevantAssumptions(a).map((x) => x.path).slice(0, 8);
    a.acceptedSamples = relevantAssumptions(a).map((x) => x.path).slice(8);
    const s = summariseAssumptions(a);
    assert.equal(s.complete, true);
    assert.equal(s.samples.length, 0);
    assert.equal(s.accepted, 5);
  });
  it("changing a line's basis or currency counts as entering that line", () => {
    const a = fresh();
    a.edited = ["lines.inlandFreight.currency"];
    assert.equal(relevantAssumptions(a).find((x) => x.path === "lines.inlandFreight.amount").status, "entered");
  });
});

describe("price comparison", () => {
  it("names the direction and the reference", () => {
    assert.equal(priceGap(6.3, 6).text, "Your price is 5.0% above the required price.");
    assert.equal(priceGap(5.4, 6).text, "Your price is 10.0% below the required price.");
    assert.equal(priceGap(6.3, 6).short, "5.0% above");
  });
  it("uses the required price as the reference", () => {
    // 6 vs 5: 20% above the required price (NOT 16.7%, which would use the proposed price as the reference)
    assert.equal(priceGap(6, 5).pct, 20);
    assert.equal(priceGap(5, 6).pct, -16.7);
  });
  it("is the same when equal", () => {
    assert.equal(priceGap(6, 6).direction, "equal");
  });
  it("never divides by zero or uses missing values", () => {
    for (const [p, r] of [[6, 0], [6, -1], [6, null], [null, 6], [NaN, 6], [6, Infinity], [-2, 6]]) {
      const g = priceGap(p, r);
      assert.equal(g.pct, null, `${p} vs ${r}`);
      assert.equal(g.direction, "unavailable");
    }
    assert.equal(priceGap(0, 6).pct, -100);
  });
});
