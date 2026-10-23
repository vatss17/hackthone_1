// Pure tests: presence, format, shipment consistency and review are four separate answers.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fingerprint, validateInvoice, validatePacking, errorsOf } from "../../src/lib/documents/validate.ts";
import { documentStatus } from "../../src/lib/documents/generate.ts";
import { sampleInputs } from "../../src/lib/landed-cost/defaults.ts";

const NOW = new Date("2026-11-05T00:00:00Z");
const company = { name: "DEMO Co", legalName: "DEMO Co Pvt Ltd", address: "Plot 1, Vapi, Gujarat, India" };
const product = { name: "Containers", description: "Lidded.", hsCode: "3924.10", unitWeightG: 250 };
const good = { iec: "TESTIEC123", buyerCountry: "Testland", buyerName: "Sample Buyer LLC", buyerAddress: "Sample Street, Dubai", invoiceNumber: "INV-2026-001", invoiceDate: "2026-11-01", incoterm: "FOB", paymentTerms: "30 days", portLoading: "Mundra", portDischarge: "Jebel Ali" };
const ctx = (details = {}, over = {}) => ({ company, product, inputs: { ...sampleInputs(), quantity: 1000, unitsPerCarton: 24, cartonGrossWeightKg: 6.5, cartonLengthMm: 500, cartonWidthMm: 400, cartonHeightMm: 300, sellingPriceAed: 6 }, inputsAreSample: false, details: { ...good, ...details }, ...over });
const fields = (v) => v.format.map((x) => x.field);

describe("the four checks are independent", () => {
  it("a draft can have every field present and still fail format", () => {
    const v = validateInvoice(ctx({ iec: "12" }), undefined, NOW);
    assert.equal(v.presence.length, 0);
    assert.ok(fields(v).includes("iec"));
  });
  it("a well-formed draft passes presence, format and consistency yet is still not reviewed", () => {
    const v = validateInvoice(ctx(), undefined, NOW);
    assert.equal(v.presence.length, 0);
    assert.equal(errorsOf(v.format).length, 0);
    assert.equal(errorsOf(v.consistency).length, 0);
    assert.equal(v.review, "not_reviewed");
  });
});

describe("format validation", () => {
  it("accepts well-formed identifiers", () => {
    const v = validateInvoice(ctx({ iec: "0123456789", gstin: "22AAAAA0000A1Z5", buyerTrn: "100123456700003" }), undefined, NOW);
    assert.equal(errorsOf(v.format).length, 0);
  });
  it("rejects malformed IEC, GSTIN and UAE TRN", () => {
    const v = validateInvoice(ctx({ iec: "ABC", gstin: "NOTAGSTIN", buyerTrn: "12345" }), undefined, NOW);
    for (const f of ["iec", "gstin", "buyerTrn"]) assert.ok(fields(v).includes(f), f);
  });
  it("flags placeholders as placeholders", () => {
    const v = validateInvoice(ctx({ buyerName: "TBD", invoiceNumber: "XXXX", iec: "test", portLoading: "n/a" }), undefined, NOW);
    for (const f of ["buyerName", "invoiceNumber", "iec", "portLoading"]) assert.ok(v.format.some((x) => x.field === f && /placeholder/.test(x.message)), f);
  });
  it("checks dates are real, and warns about future or very old dates", () => {
    assert.ok(fields(validateInvoice(ctx({ invoiceDate: "2026-02-30" }), undefined, NOW)).includes("invoiceDate"));
    assert.ok(fields(validateInvoice(ctx({ invoiceDate: "01/11/2026" }), undefined, NOW)).includes("invoiceDate"));
    assert.ok(validateInvoice(ctx({ invoiceDate: "2027-01-01" }), undefined, NOW).format.some((x) => x.severity === "warning" && /future/.test(x.message)));
    assert.ok(validateInvoice(ctx({ invoiceDate: "2020-01-01" }), undefined, NOW).format.some((x) => /two years/.test(x.message)));
  });
  it("rejects an Incoterm that is not standard", () => {
    assert.ok(fields(validateInvoice(ctx({ incoterm: "SHIPPED" }), undefined, NOW)).includes("incoterm"));
  });
  it("always says whether classification is missing, and never supplies one", () => {
    const none = validateInvoice(ctx({}, { product: { ...product, hsCode: null } }), undefined, NOW);
    assert.ok(none.format.some((x) => x.field === "hsCode" && /No classification/.test(x.message)));
    const bad = validateInvoice(ctx({}, { product: { ...product, hsCode: "39" } }), undefined, NOW);
    assert.ok(bad.format.some((x) => x.field === "hsCode" && x.severity === "error"));
    const claimed = validateInvoice(ctx(), undefined, NOW);
    assert.ok(claimed.format.some((x) => /your own claim/.test(x.message)));
  });
});

describe("consistency", () => {
  it("invoice and packing quantities agree for the same shipment", () => {
    assert.equal(errorsOf(validateInvoice(ctx(), undefined, NOW).consistency).length, 0);
    assert.equal(errorsOf(validatePacking(ctx(), undefined, NOW).consistency).length, 0);
  });
  it("sample calculator values are called out as a consistency warning", () => {
    const v = validateInvoice(ctx({}, { inputsAreSample: true }), undefined, NOW);
    assert.ok(v.consistency.some((x) => /sample/i.test(x.message)));
  });
  it("the packing check flags the partial carton weight as an assumption, not an error", () => {
    const v = validatePacking(ctx(), undefined, NOW);
    assert.ok(v.consistency.some((x) => x.severity === "warning" && /ASSUMPTION/.test(x.message)));
    assert.equal(errorsOf(v.consistency).length, 0);
  });
});

describe("review", () => {
  it("is not reviewed until the person records it, and goes stale when the draft changes", () => {
    const fp = validateInvoice(ctx(), undefined, NOW).fingerprint;
    const review = { by: "A. Person", on: "2026-11-02", fingerprint: fp };
    const same = validateInvoice(ctx(), review, NOW);
    assert.equal(same.review, "reviewed");
    assert.equal(same.reviewedBy, "A. Person");
    const changed = validateInvoice(ctx({ buyerName: "Another Buyer LLC" }), review, NOW);
    assert.equal(changed.review, "stale");
  });
  it("the fingerprint is stable and sensitive", () => {
    assert.equal(fingerprint("a"), fingerprint("a"));
    assert.notEqual(fingerprint("a"), fingerprint("b"));
  });
});

describe("status for the roadmap", () => {
  it("separates fields present from format errors and mismatches", () => {
    const s = documentStatus(ctx({ iec: "12" }), null, {}, {}, NOW);
    assert.equal(s.invoice.missing, 0);
    assert.equal(s.invoice.complete, true);
    assert.equal(s.invoice.invalid, 1);
    assert.equal(s.invoice.review, "not_reviewed");
  });
});
