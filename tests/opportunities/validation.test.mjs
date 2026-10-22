// Pure unit tests: the manufacturing-profile form validation and error mapping.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ERROR_MESSAGES, errorCodeFor, oneOf, positiveNumber, specValue, text, yearOrNull, CAPACITY_UNITS } from "../../src/lib/capability-validation.ts";

describe("form validation", () => {
  it("text enforces bounds and rejects control characters", () => {
    assert.deepEqual(text("  Press   150T ", { min: 2, max: 200, required: true }), { ok: true, value: "Press 150T" });
    assert.equal(text("", { max: 10, required: true }).ok, false);
    assert.deepEqual(text("", { max: 10 }), { ok: true, value: null });
    assert.equal(text("a", { min: 2, max: 10 }).ok, false);
    assert.equal(text("x".repeat(11), { max: 10 }).ok, false);
    assert.equal(text("bad\u0000text", { max: 50 }).ok, false);
    assert.equal(text("line1\nline2", { max: 50, long: true }).ok, true);
  });

  it("positive numbers: no zero, negatives, junk or overflow; thousands separators accepted", () => {
    assert.deepEqual(positiveNumber("1,500", { max: 1e9 }), { ok: true, value: 1500 });
    assert.deepEqual(positiveNumber("2.5", { max: 10 }), { ok: true, value: 2.5 });
    for (const bad of ["0", "-1", "abc", "1e3", "1.2345", "11"]) assert.equal(positiveNumber(bad, { max: 10 }).ok, false, bad);
    assert.equal(positiveNumber("2.5", { max: 10, integer: true }).ok, false);
    assert.deepEqual(positiveNumber("", { max: 10 }), { ok: true, value: null });
    assert.equal(positiveNumber("", { max: 10, required: true }).ok, false);
  });

  it("selects accept only listed values", () => {
    assert.equal(oneOf("tonnes", CAPACITY_UNITS), "tonnes");
    assert.equal(oneOf("gallons", CAPACITY_UNITS), null);
  });

  it("year is four digits within range", () => {
    assert.deepEqual(yearOrNull("2019"), { ok: true, value: 2019 });
    assert.deepEqual(yearOrNull(""), { ok: true, value: null });
    for (const bad of ["19", "1800", "2101", "20x1"]) assert.equal(yearOrNull(bad).ok, false, bad);
  });

  it("a specification is a number when it looks like one, otherwise text, and a unit needs a number", () => {
    assert.deepEqual(specValue("750", "ml"), { ok: true, value: { text: null, number: 750, unit: "ml" } });
    assert.deepEqual(specValue("Polypropylene", ""), { ok: true, value: { text: "Polypropylene", number: null, unit: null } });
    assert.equal(specValue("Polypropylene", "kg").ok, false);
    assert.equal(specValue("", "ml").ok, false);
  });
});

describe("database error mapping", () => {
  it("maps known codes and never leaks raw text", () => {
    assert.equal(errorCodeFor({ code: "23505" }), "duplicate");
    assert.equal(errorCodeFor({ code: "23514" }), "invalid");
    assert.equal(errorCodeFor({ code: "23503" }), "invalid");
    assert.equal(errorCodeFor({ code: "42501" }), "not_owner");
    assert.equal(errorCodeFor({ message: 'new row violates row-level security policy for table "machines"' }), "not_owner");
    assert.equal(errorCodeFor({ code: "55000" }), "frozen");
    assert.equal(errorCodeFor({ code: "XX000", message: "secret internal detail" }), "failed");
    for (const m of Object.values(ERROR_MESSAGES)) assert.ok(!/constraint|policy|violates|sql|postgres/i.test(m), m);
  });
});
