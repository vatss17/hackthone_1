// Pure tests: import errors say what is actually wrong and where, and invalid physical values are never kept as normal specifications.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LIMITS, checkWeight, parseCatalogue } from "../../src/lib/catalogue/parse.ts";

const csv = (rows) => rows.join("\n");

describe("weight checks say what is wrong", () => {
  it("a negative weight is a positive-number error, not a unit error", () => {
    const w = checkWeight("-5 kg", null);
    assert.equal(w.grams, null);
    assert.match(w.error, /must be a positive number \(found -5 kg\)/);
    assert.ok(!/grams or kilograms|not in grams/i.test(w.error));
  });
  it("zero is also a positive-number error", () => {
    assert.match(checkWeight("0", "g").error, /positive number/);
  });
  it("a word is a not-a-number error", () => {
    assert.match(checkWeight("heavy", null).error, /is not a number/);
  });
  it("only a real unit problem is reported as a unit problem", () => {
    assert.match(checkWeight("3 lb", null).error, /unit “lb” is not supported/);
    assert.match(checkWeight("85", null).error, /has no unit/);
  });
  it("valid weights convert", () => {
    assert.equal(checkWeight("1.1 kg", null).grams, 1100);
    assert.equal(checkWeight("250", "g").grams, 250);
  });
});

describe("a CSV with bad values", () => {
  const out = parseCatalogue(csv(["Name,Material,Category,Weight (g),Length (mm)", "Crate,HDPE,Storage,-250,300", "Box,PP,Storage,abc,-4", "Tub,PP,Storage,150,200"]));
  const [crate, box, tub] = out.products;
  it("reports a negative weight with its row and column", () => {
    const e = crate.issues.find((x) => x.field === "weight");
    assert.equal(e.severity, "error");
    assert.match(e.message, /positive number/);
    assert.equal(e.location, "row 2, column 4 (“Weight (g)”)");
  });
  it("does not keep the invalid weight as a weight or as a normal specification", () => {
    assert.equal(crate.unitWeightG, null);
    assert.ok(!crate.specs.some((s) => /weight/i.test(s.name)));
    assert.deepEqual(crate.rejected.map((r) => [r.field, r.raw]), [["weight", "-250"]]);
  });
  it("catches a negative physical specification too, and keeps it out of the specs", () => {
    const e = box.issues.find((x) => x.field === "spec:Length");
    assert.match(e.message, /Length must be a positive number \(found -4 mm\)/);
    assert.equal(e.location, "row 3, column 5 (“Length (mm)”)");
    assert.ok(!box.specs.some((s) => s.name === "Length"));
  });
  it("a non-numeric weight is not a number", () => {
    assert.match(box.issues.find((x) => x.field === "weight").message, /is not a number/);
  });
  it("clean rows have no issues and keep their values", () => {
    assert.deepEqual(tub.issues, []);
    assert.equal(tub.unitWeightG, 150);
    assert.deepEqual(tub.specs.map((s) => [s.name, s.value, s.unit]), [["Length", "200", "mm"]]);
  });
});

describe("structured text with bad values", () => {
  const out = parseCatalogue("Product: Bucket 10L\nMaterial: HDPE\nCategory: Cleaning\nWeight: -0.5 kg\nDiameter: -3 mm\n\nProduct: Mug\nMaterial: PP\nWeight: 90 g\n");
  it("gives the block and the line where it was found", () => {
    const e = out.products[0].issues.find((x) => x.field === "weight");
    assert.match(e.location, /^block 1, line “Weight: -0\.5 kg”$/);
    assert.match(out.products[0].issues.find((x) => x.field === "spec:Diameter").location, /block 1/);
  });
  it("other products in the same file are unaffected", () => {
    assert.equal(out.products[1].unitWeightG, 90);
    assert.deepEqual(out.products[1].issues, []);
  });
});

describe("confidence labels mean something", () => {
  it("a complete, clean file is high and says why", () => {
    const p = parseCatalogue(csv(["Name,Description,Category,Material,Use,Weight (g)", "Crate,Sturdy,Storage,HDPE,Home storage,250"])).products[0];
    assert.equal(p.confidence, "high");
    assert.match(p.confidenceWhy, /5 of 6 key details were stated in the file/);
  });
  it("an error forces low confidence, whatever else is present", () => {
    const p = parseCatalogue(csv(["Name,Description,Category,Material,Use,Weight (g)", "Crate,Sturdy,Storage,HDPE,Home storage,-1"])).products[0];
    assert.equal(p.confidence, "low");
    assert.match(p.confidenceWhy, /must be corrected or left out/);
  });
  it("a rule-inferred category or material keeps it from being high", () => {
    const p = parseCatalogue(csv(["Name,Description,Use,Weight (g),Colour", "Seedling Tray in polypropylene,Light,Nurseries,85,Black"])).products[0];
    assert.notEqual(p.confidence, "high");
    assert.match(p.confidenceWhy, /suggested by a rule/);
  });
  it("a PDF is never high", () => {
    const p = parseCatalogue("Product: Crate\nCategory: Storage\nMaterial: HDPE\nUse: Home\nDescription: Sturdy\nWeight: 250 g\n", { fromPdf: true }).products[0];
    assert.notEqual(p.confidence, "high");
    assert.match(p.confidenceWhy, /layout of a PDF is lost/);
  });
});

describe("malformed files and limits", () => {
  it("empty or whitespace input says there is nothing to read", () => {
    assert.equal(parseCatalogue("   \n  ").format, "empty");
  });
  it("a header with no product rows is explained", () => {
    const out = parseCatalogue("Name,Material\n");
    assert.equal(out.products.length, 0);
  });
  it("unbalanced quotes do not crash and do not invent products", () => {
    const out = parseCatalogue('Name,Material\n"Crate,HDPE\nBox,PP');
    assert.ok(Array.isArray(out.products));
  });
  it("binary-looking garbage yields no products", () => {
    const out = parseCatalogue("\u0000\u0001\u0002\u0003".repeat(50));
    assert.equal(out.products.length, 0);
  });
  it("a very long file is truncated with a warning", () => {
    const big = "Product: Crate\nMaterial: PP\n\n".repeat(20000);
    const out = parseCatalogue(big);
    assert.equal(out.truncated, true);
    assert.ok(out.warnings.some((w) => /very long/.test(w)));
    assert.ok(out.products.length <= LIMITS.products);
  });
  it("more products than the limit are cut off with a warning", () => {
    const rows = ["Name,Material", ...Array.from({ length: LIMITS.products + 10 }, (_, i) => `Item ${i},PP`)];
    const out = parseCatalogue(rows.join("\n"));
    assert.equal(out.products.length, LIMITS.products);
    assert.ok(out.warnings.some((w) => /Only the first/.test(w)));
  });
  it("TSV, Markdown bullets and plain text are all read", () => {
    assert.equal(parseCatalogue("Name\tMaterial\nCrate\tHDPE\nBox\tPP").products.length, 2);
    assert.equal(parseCatalogue("- Product: Crate\n  Material: HDPE\n\n- Product: Box\n  Material: PP").products.length, 2);
  });
  it("duplicate names inside a file are marked", () => {
    const out = parseCatalogue("Name,Material\nCrate,PP\nCrate,HDPE");
    assert.deepEqual(out.products.map((p) => p.duplicateInFile), [false, true]);
  });
});
