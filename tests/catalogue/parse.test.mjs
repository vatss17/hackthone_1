// Pure tests: deterministic catalogue extraction. No network, no AI, nothing stored.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CATALOGUE, LIMITS, detectDelimiter, materialsIn, parseCatalogue, parseCsv, parseMaterialField, splitValueUnit, weightToGrams } from "../../src/lib/catalogue/parse.ts";

describe("csv parsing", () => {
  it("handles quotes, doubled quotes, embedded newlines, BOM and CRLF", () => {
    const rows = parseCsv('﻿Name,Description\r\n"Crate, large","Says ""tough""\nand strong"\r\nBox,Plain\r\n');
    assert.deepEqual(rows, [["Name", "Description"], ["Crate, large", 'Says "tough"\nand strong'], ["Box", "Plain"]]);
  });
  it("detects comma, semicolon, tab and pipe, and ignores prose", () => {
    assert.equal(detectDelimiter("Name,Material\nCrate,PP\nBox,HDPE"), ",");
    assert.equal(detectDelimiter("Name;Material\nCrate;PP\nBox;HDPE"), ";");
    assert.equal(detectDelimiter("Name\tMaterial\nCrate\tPP\nBox\tHDPE"), "\t");
    assert.equal(detectDelimiter("Name|Material\nCrate|PP\nBox|HDPE"), "|");
    assert.equal(detectDelimiter("Just a sentence.\nAnother sentence."), null);
  });
});

describe("units, weights and materials", () => {
  it("splits a value from its unit", () => {
    assert.deepEqual(splitValueUnit("750 ml"), { value: "750", unit: "ml" });
    assert.deepEqual(splitValueUnit("2,5 kg"), { value: "2.5", unit: "kg" });
    assert.deepEqual(splitValueUnit("12", "pieces"), { value: "12", unit: "pieces" });
    assert.deepEqual(splitValueUnit("Grey and blue"), { value: "Grey and blue", unit: null });
  });
  it("converts only plain mass units to grams", () => {
    assert.equal(weightToGrams("1.1 kg", null), 1100);
    assert.equal(weightToGrams("85", "g"), 85);
    assert.equal(weightToGrams("85 g", null), 85);
    assert.equal(weightToGrams("3 litres", null), null);
    assert.equal(weightToGrams("-2 kg", null), null);
    assert.equal(weightToGrams("heavy", null), null);
  });
  it("finds material codes and names without false hits", () => {
    assert.deepEqual(materialsIn("Made of polypropylene, with HDPE lid"), ["PP", "HDPE"]);
    assert.deepEqual(materialsIn("High-density polyethylene body"), ["HDPE"]);
    assert.deepEqual(materialsIn("Linear low-density polyethylene film"), ["LLDPE"]);
    assert.deepEqual(materialsIn("PPE and PPM are not materials; neither is APPLE"), []);
    assert.deepEqual(materialsIn("nylon gears"), ["PA"]);
  });
  it("maps a Material cell to codes and custom names, without duplicates", () => {
    assert.deepEqual(parseMaterialField("PP / HDPE, recycled regrind, pp"), [
      { code: "PP", label: "PP" },
      { code: "HDPE", label: "HDPE" },
      { code: null, label: "recycled regrind" },
    ]);
  });
});

describe("csv catalogues", () => {
  const csv = [
    "Product Name,Category,Material,Weight (g),Capacity (ml),Colour,SKU,HS Code,Use",
    'Round Container,Food containers,Polypropylene,95,750 ml,"Clear, white",RC-750,3924.10,Storing food',
    "Square Box,,HDPE,1.2 kg,,Grey,SB-1,not a code,",
  ].join("\n");
  const out = parseCatalogue(csv);
  it("maps columns to product fields and the rest to specifications with units", () => {
    assert.equal(out.format, "csv");
    assert.equal(out.products.length, 2);
    const p = out.products[0];
    assert.equal(p.name, "Round Container");
    assert.equal(p.category, "Food containers");
    assert.deepEqual(p.materials, [{ code: "PP", label: "PP" }]);
    assert.equal(p.unitWeightG, 95);
    assert.equal(p.internalCode, "RC-750");
    assert.equal(p.hsCode, "3924.10");
    assert.equal(p.intendedUse, "Storing food");
    assert.deepEqual(p.specs.find((s) => s.name === "Capacity"), { name: "Capacity", value: "750", unit: "ml" });
    assert.deepEqual(p.specs.find((s) => s.name === "Colour"), { name: "Colour", value: "Clear, white", unit: null });
    assert.equal(p.source.category, "file");
  });
  it("converts kilograms, drops an invalid HS code with a note, and suggests a category by rule", () => {
    const p = out.products[1];
    assert.equal(p.unitWeightG, 1200);
    assert.equal(p.hsCode, null);
    assert.ok(p.notes.some((n) => /HS/.test(n)));
    assert.equal(p.source.category, "rule");
    assert.ok(p.notes.some((n) => /Category suggested by a rule/.test(n)));
  });
  it("uses the first column when no column is called Name", () => {
    const o = parseCatalogue("Thing,Material\nCrate,PP\nBox,HDPE");
    assert.equal(o.products.length, 2);
    assert.ok(o.warnings.some((w) => /first column/.test(w)));
  });
  it("skips empty rows and flags a repeated name", () => {
    const o = parseCatalogue("Name,Material\nCrate,PP\n,\nCrate,HDPE");
    assert.equal(o.products.length, 2);
    assert.equal(o.products[1].duplicateInFile, true);
  });
});

describe("structured text catalogues (the demo sample)", () => {
  const out = parseCatalogue(DEMO_CATALOGUE);
  it("finds the four sample products and ignores the heading", () => {
    assert.equal(out.format, "text");
    assert.deepEqual(out.products.map((p) => p.name), ["Stackable Storage Crate 40L", "Seedling Tray 24 Cell", "Laundry Hanger Set of 12", "Drip Irrigation Tubing 16mm"]);
  });
  it("extracts fields, materials, weight and specifications", () => {
    const crate = out.products[0];
    assert.equal(crate.category, "Household storage");
    assert.deepEqual(crate.materials, [{ code: "HDPE", label: "HDPE" }]);
    assert.equal(crate.unitWeightG, 1100);
    assert.equal(crate.internalCode, "SC-40");
    assert.deepEqual(crate.specs.find((s) => s.name === "Capacity"), { name: "Capacity", value: "40", unit: "litres" });
    assert.match(crate.description, /Ventilated stackable crate/);
    assert.equal(out.products[1].materials[0].code, "PP");
    assert.equal(out.products[3].materials[0].code, "LLDPE");
    assert.deepEqual(out.products[3].specs.find((s) => s.name === "Diameter"), { name: "Diameter", value: "16", unit: "mm" });
  });
  it("suggests a category by rule only where the file gave none, and says so", () => {
    const hanger = out.products[2];
    assert.equal(hanger.source.category, "rule");
    assert.equal(out.products[0].source.category, "file");
  });
  it("is deterministic", () => {
    assert.deepEqual(parseCatalogue(DEMO_CATALOGUE), out);
  });
});

describe("text lifted from a PDF", () => {
  const pdfText = "Acme Plastics Product Guide\n\nRound Bucket 10L\nMaterial: PP\nStrong handle, nestable.\n\nGarden Pot 25cm\nMaterial: HDPE\nUV stabilised.";
  const out = parseCatalogue(pdfText, { fromPdf: true });
  it("extracts what it can and never rates the result as high confidence", () => {
    assert.deepEqual(out.products.map((p) => p.name), ["Round Bucket 10L", "Garden Pot 25cm"]);
    assert.ok(out.products.every((p) => p.confidence !== "high"));
    assert.ok(out.products.every((p) => p.notes.some((n) => /PDF/.test(n))));
  });
});

describe("hostile and awkward input", () => {
  it("returns nothing, not a crash, for empty or junk input", () => {
    assert.equal(parseCatalogue("").format, "empty");
    assert.equal(parseCatalogue("   \n\n  ").products.length, 0);
    assert.equal(parseCatalogue("\u0000\u0001\u0002").products.length, 0);
  });
  it("clips field lengths to the database limits and strips control characters", () => {
    const long = "x".repeat(5000);
    const o = parseCatalogue(`Name,Description,Category\n${"N".repeat(500)},${long},${"C".repeat(500)}\n`);
    const p = o.products[0];
    assert.ok(p.name.length <= LIMITS.name && p.description.length <= LIMITS.description && p.category.length <= LIMITS.category);
    const c = parseCatalogue("Name,Description\nCrate,Bad\u0000text\u0007here");
    assert.ok(!/[\u0000-\u0008]/.test(c.products[0].description));
  });
  it("caps very large inputs and says so", () => {
    const rows = ["Name"].concat(Array.from({ length: 300 }, (_, i) => `Product ${i}`)).join("\n");
    const o = parseCatalogue(`Name,Material\n` + rows.split("\n").slice(1).map((n) => `${n},PP`).join("\n"));
    assert.equal(o.products.length, LIMITS.products);
    assert.equal(o.truncated, true);
    const big = parseCatalogue("a".repeat(LIMITS.chars + 1000));
    assert.equal(big.truncated, true);
  });
  it("keeps markup as inert text", () => {
    const o = parseCatalogue('Name,Description\n"<script>alert(1)</script> Crate","<img src=x onerror=alert(1)>"');
    assert.match(o.products[0].name, /<script>/);
  });
  it("does not treat a heading-only block as a product", () => {
    const o = parseCatalogue("Containers\n\nProduct: Lunch Box\nMaterial: PP");
    assert.deepEqual(o.products.map((p) => p.name), ["Lunch Box"]);
  });
});

// ---- PDF text extraction (the code runs in the browser; the library is exercised here in Node) ----
import { extractPdfText, looksLikePdf, MAX_PDF_BYTES } from "../../src/lib/catalogue/pdf.ts";

/** A tiny, valid one-page PDF whose text is the given lines. Built here so no fixture file is needed. */
function tinyPdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, "\\$&");
  const content = `BT /F1 12 Tf 14 TL 50 740 Td ${lines.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

describe("pdf text extraction", () => {
  it("recognises PDFs and rejects other files", () => {
    assert.equal(looksLikePdf(new TextEncoder().encode("%PDF-1.7\n...")), true);
    assert.equal(looksLikePdf(new TextEncoder().encode("PK\u0003\u0004 zip file")), false);
  });
  it("extracts text from a PDF and the parser then finds the products", async () => {
    const bytes = tinyPdf(["Round Bucket 10L", "Material: PP", "Strong handle", "", "Garden Pot 25cm", "Material: HDPE", "UV stabilised"]);
    const { text, pages } = await extractPdfText(bytes);
    assert.equal(pages, 1);
    assert.match(text, /Round Bucket 10L/);
    const out = parseCatalogue(text, { fromPdf: true });
    assert.ok(out.products.length >= 1, JSON.stringify(text));
    assert.ok(out.products.every((p) => p.confidence !== "high"));
  });
  it("refuses non-PDF bytes and oversized files before doing any work", async () => {
    await assert.rejects(() => extractPdfText(new TextEncoder().encode("not a pdf")), /PDF/);
    await assert.rejects(() => extractPdfText(new Uint8Array(MAX_PDF_BYTES + 1)), /8 MB/);
  });
});
