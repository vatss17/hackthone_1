// Pure tests: shipment weight uses full and partial cartons, and invalid inputs are explained rather than replaced.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculate, validateInputs } from "../../src/lib/landed-cost/calc.ts";
import { sampleInputs } from "../../src/lib/landed-cost/defaults.ts";

const base = (over = {}) => ({ ...sampleInputs(), quantity: 1000, quantityUnit: "units", unitsPerCarton: 24, cartonGrossWeightKg: 6.5, cartonLengthMm: 500, cartonWidthMm: 400, cartonHeightMm: 300, ...over });

describe("shipment weight with a partial carton", () => {
  it("1,000 units at 24 per carton: 42 cartons, full cartons at the entered weight plus one scaled partial carton", () => {
    const r = calculate(base());
    assert.equal(r.cartons, 42);
    assert.equal(r.grossWeightKg, 270.83); // 41 x 6.5 = 266.5, plus 6.5 x 16/24 = 4.33
  });
  it("an entered partial-carton weight replaces the scaled estimate", () => {
    assert.equal(calculate(base({ partialCartonGrossKg: 4.7 })).grossWeightKg, 271.2);
  });
  it("freight charged per kg follows the real weight, not 42 full cartons", () => {
    const withLine = (over) => base({ lines: { ...sampleInputs().lines, internationalFreight: { amount: 10, currency: "INR", basis: "per_kg", confirmed: false } }, ...over });
    const r = calculate(withLine({}));
    const freight = r.lines.find((l) => l.key === "internationalFreight").totalInr;
    assert.equal(freight, 2708.3); // 270.83 kg x INR 10
    assert.notEqual(freight, 42 * 6.5 * 10);
  });
  it("an exact multiple of the carton size has no partial carton", () => {
    assert.equal(calculate(base({ quantity: 960 })).grossWeightKg, 260);
  });
  it("shipping in cartons has no partial carton", () => {
    assert.equal(calculate(base({ quantity: 40, quantityUnit: "cartons" })).grossWeightKg, 260);
  });
  it("unknown carton weight stays unknown", () => {
    assert.equal(calculate(base({ cartonGrossWeightKg: null })).grossWeightKg, null);
  });
  it("rejects a non-positive partial carton weight", () => {
    assert.ok("partialCartonGrossKg" in validateInputs(base({ partialCartonGrossKg: -1 })).errors);
    assert.ok("partialCartonGrossKg" in validateInputs(base({ partialCartonGrossKg: 0 })).errors);
  });
});

describe("zero and negative inputs are explained", () => {
  it("zero quantity, zero exchange rate and a negative cost each produce their own message", () => {
    const v = validateInputs(base({ quantity: 0, inrPerAed: 0, unitProductionCostInr: -5 }));
    assert.match(v.errors.quantity, /whole number of at least 1/);
    assert.match(v.errors.inrPerAed, /more than 0/);
    assert.match(v.errors.unitProductionCostInr, /0 or more/);
  });
  it("calculating with an invalid model refuses, so a wrong number is never shown", () => {
    assert.throws(() => calculate(base({ quantity: 0 })), /Invalid inputs: quantity/);
    assert.throws(() => calculate(base({ inrPerAed: 0 })), /inrPerAed/);
  });
  it("margin and markup stay different, and zero revenue is handled", () => {
    const r = calculate(base());
    assert.notEqual(r.grossMarginPct, r.markupPct);
    assert.equal(calculate(base({ sellingPriceAed: 0 })).grossMarginPct, null);
  });
});
