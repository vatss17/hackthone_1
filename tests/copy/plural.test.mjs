// Pure tests: counts read correctly, with no stray spaces inside a word.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { count, noun, pluralOf } from "../../src/lib/plural.ts";

describe("plurals", () => {
  it("handles the irregular nouns this product uses", () => {
    for (const [one, many] of [["process", "processes"], ["factory", "factories"], ["specification", "specifications"], ["gap", "gaps"], ["match", "matches"], ["capability", "capabilities"], ["box", "boxes"]]) assert.equal(pluralOf(one), many);
  });
  it("handles regular nouns", () => {
    assert.equal(pluralOf("machine"), "machines");
    assert.equal(pluralOf("material"), "materials");
    assert.equal(pluralOf("day"), "days");
    assert.equal(pluralOf("brush"), "brushes");
  });
  it("one is singular, zero and many are plural", () => {
    assert.equal(count(1, "process"), "1 process");
    assert.equal(count(0, "process"), "0 processes");
    assert.equal(count(2, "factory"), "2 factories");
    assert.equal(noun(1, "specification"), "specification");
  });
  it("never leaves a space inside a word", () => {
    for (const n of ["process", "specification", "factory", "machine", "material", "product", "assumption", "task", "statement"]) for (const k of [0, 1, 2, 11]) assert.ok(!/\b\w+ (es|s|y|ies)\b/.test(count(k, n)), `${k} ${n}`);
  });
  it("accepts an explicit plural for a one-off noun", () => {
    assert.equal(count(2, "person", "people"), "2 people");
  });
});
