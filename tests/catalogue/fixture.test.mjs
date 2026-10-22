// Pure test: the second demo catalogue (docs/fixtures) reads cleanly and contains only unfamiliar products.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCatalogue } from "../../src/lib/catalogue/parse.ts";
import { recognise } from "../../src/lib/opportunities/engine.ts";

const text = readFileSync(new URL("../../docs/fixtures/demo-catalogue-new-products.txt", import.meta.url), "utf8");
const r = parseCatalogue(text);
const existing = ["plastic containers", "plastic storage products", "stackable storage crate 40l", "seedling tray 24 cell", "drip irrigation tubing 16mm", "laundry hanger set of 12"];

describe("demo catalogue 2", () => {
  it("yields five products, none of them in the demo manufacturer's list", () => {
    assert.equal(r.products.length, 5);
    for (const p of r.products) assert.ok(!existing.includes(p.name.toLowerCase()), p.name);
  });
  it("extracts name, category, use and material for every product, and leaves unstated weights empty", () => {
    for (const p of r.products) {
      assert.ok(p.name && p.category && p.intendedUse && p.materials.length > 0, p.name);
    }
    assert.equal(r.products.filter((p) => p.unitWeightG).length, 3);
    assert.ok(r.products.every((p) => p.unitWeightG === null || p.unitWeightG > 0));
  });
  it("is clearly fictional and contains no identifiers", () => {
    assert.match(text, /fictional/);
    assert.ok(!/@|https?:|\b\d{10}\b/.test(text));
  });
  it("is recognised by the opportunities engine as catalogue products", () => {
    const hits = r.products.map((p) => recognise({ name: p.name, category: p.category, description: p.description }));
    assert.ok(hits.filter(Boolean).length >= 4, JSON.stringify(hits.map((h) => h?.id ?? null)));
  });
});
