// Pure tests: available capacity is derived only from reported figures and never sums sequential stages.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateFactory, estimateProcess, formatQuantity, isValidUtilisation } from "../../src/lib/capacity/available.ts";

const proc = (id, quantity, utilisationPct, unit = "tonnes", period = "month") => ({ id, label: id, quantity, unit, period, utilisationPct });

describe("process capacity", () => {
  it("multiplies reported capacity by the unused fraction", () => {
    const e = estimateProcess(proc("inj", 180, 65));
    assert.deepEqual(e.available, { quantity: 63, unit: "tonnes", period: "month" });
    assert.equal(e.provenance, "calculated");
  });
  it("handles the extremes", () => {
    assert.equal(estimateProcess(proc("a", 100, 0)).available.quantity, 100);
    assert.equal(estimateProcess(proc("a", 100, 100)).available.quantity, 0);
  });
  it("derives nothing without capacity, without utilisation, or with an invalid utilisation", () => {
    assert.equal(estimateProcess(proc("a", null, 50)).available, null);
    assert.match(estimateProcess(proc("a", null, 50)).missing, /No capacity/);
    assert.equal(estimateProcess(proc("a", 100, null)).available, null);
    assert.match(estimateProcess(proc("a", 100, null)).missing, /utilisation/i);
    for (const bad of [-1, 101, NaN]) assert.equal(estimateProcess(proc("a", 100, bad)).available, null);
    assert.equal(estimateProcess({ ...proc("a", 100, 10), unit: null }).available, null);
  });
  it("never invents or converts units and periods", () => {
    const e = estimateProcess(proc("a", 5000, 20, "pieces", "day"));
    assert.deepEqual(e.available, { quantity: 4000, unit: "pieces", period: "day" });
  });
  it("validates utilisation", () => {
    assert.ok(isValidUtilisation(0) && isValidUtilisation(100) && isValidUtilisation(42.5));
    assert.ok(!isValidUtilisation(-0.1) && !isValidUtilisation(100.1) && !isValidUtilisation("50") && !isValidUtilisation(null));
  });
});

describe("factory-wide capacity", () => {
  const inj = estimateProcess(proc("inj", 180, 50)); // 90
  const ext = estimateProcess(proc("ext", 90, 50)); // 45
  it("does NOT sum sequential stages: the confirmed bottleneck governs", () => {
    const f = estimateFactory([inj, ext], "sequential", "ext");
    assert.equal(f.value.quantity, 45);
    assert.equal(f.basis, "bottleneck");
    assert.notEqual(f.value.quantity, 135);
  });
  it("proposes the smallest stage but derives no figure until it is confirmed", () => {
    const f = estimateFactory([inj, ext], "sequential", null);
    assert.equal(f.value, null);
    assert.equal(f.governing.id, "ext");
    assert.match(f.ask, /Confirm/);
  });
  it("flags a chosen bottleneck that is not the smallest figure", () => {
    const f = estimateFactory([inj, ext], "sequential", "inj");
    assert.equal(f.value.quantity, 90);
    assert.match(f.ask, /smaller figure/);
  });
  it("adds only separate lines the manufacturer said are parallel, and only with identical units", () => {
    assert.equal(estimateFactory([inj, ext], "parallel").value.quantity, 135);
    const other = estimateProcess(proc("x", 1000, 0, "pieces", "day"));
    const f = estimateFactory([inj, other], "parallel");
    assert.equal(f.value, null);
    assert.match(f.ask, /different units/);
  });
  it("derives nothing when the relationship is unknown", () => {
    const f = estimateFactory([inj, ext], "unknown");
    assert.equal(f.value, null);
    assert.equal(f.provenance, "unavailable");
  });
  it("derives nothing when no process has a figure", () => {
    assert.equal(estimateFactory([estimateProcess(proc("a", null, null))], "sequential").value, null);
    assert.equal(estimateFactory([], "parallel").value, null);
  });
  it("formats a figure with its unit and period", () => {
    assert.equal(formatQuantity({ quantity: 63, unit: "tonnes", period: "month" }), "63 tonnes per month");
  });
});
