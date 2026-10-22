// Pure tests: draft export documents. They prove what is prefilled, what is never invented, and
// that every draft says it needs review.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DRAFT_LABEL, checklistFor, documentStatus, effectiveDetails, invoiceModel, packingModel } from "../../src/lib/documents/generate.ts";
import { sampleInputs } from "../../src/lib/landed-cost/defaults.ts";

const company = { name: "DEMO Sample Polymers", legalName: "DEMO Sample Polymers Private Limited", address: "Plot 00, Sample Estate, Vapi, Gujarat 396195, India" };
const product = { name: "Plastic containers", description: "Lidded containers.\nSecond line.", hsCode: "3924.10", unitWeightG: 95 };
const ctx = (over = {}) => ({ company, product, inputs: { ...sampleInputs(), quantity: 10000, unitsPerCarton: 25, cartonGrossWeightKg: 5, cartonLengthMm: 500, cartonWidthMm: 400, cartonHeightMm: 300, sellingPriceAed: 6 }, inputsAreSample: false, details: {}, ...over });
const full = {
  iec: "TESTIEC123", buyerName: "Sample Buyer LLC", buyerAddress: "Sample Street, Dubai", invoiceNumber: "INV-TEST-1", invoiceDate: "2026-11-01",
  incoterm: "FOB", paymentTerms: "30 days", portLoading: "Mundra", portDischarge: "Jebel Ali",
};

describe("prefill", () => {
  it("fills only the user's own records: company, address, country facts", () => {
    const { values, sources } = effectiveDetails(ctx());
    assert.equal(values.sellerName, "DEMO Sample Polymers Private Limited");
    assert.equal(values.sellerAddress, company.address);
    assert.equal(values.buyerCountry, "United Arab Emirates");
    assert.equal(values.countryOrigin, "India");
    assert.equal(sources.sellerName, "prefilled");
  });
  it("never invents buyer details, identifiers, dates, terms or ports", () => {
    const { values, sources } = effectiveDetails(ctx());
    for (const k of ["iec", "gstin", "buyerName", "buyerAddress", "buyerTrn", "invoiceNumber", "invoiceDate", "incoterm", "paymentTerms", "portLoading", "portDischarge"]) {
      assert.equal(values[k], "", k);
      assert.equal(sources[k], "missing", k);
    }
  });
  it("user input wins, and clearing a prefilled field makes it missing again", () => {
    assert.equal(effectiveDetails(ctx({ details: { sellerName: "Other Ltd" } })).values.sellerName, "Other Ltd");
    const cleared = effectiveDetails(ctx({ details: { sellerAddress: "" } }));
    assert.equal(cleared.values.sellerAddress, "");
    assert.equal(cleared.sources.sellerAddress, "missing");
  });
});

describe("commercial invoice", () => {
  it("is labelled a draft needing review and starts incomplete", () => {
    const inv = invoiceModel(ctx());
    assert.equal(inv.label, DRAFT_LABEL);
    assert.equal(inv.label, "DRAFT — REVIEW REQUIRED");
    assert.equal(inv.complete, false);
    for (const needed of ["Buyer (consignee)", "Invoice number", "Invoice date", "Terms of delivery (Incoterm)", "Importer-Exporter Code (IEC)", "Port of loading"]) assert.ok(inv.missing.includes(needed), needed);
  });
  it("prefills quantity, unit price and the total from the calculator", () => {
    const inv = invoiceModel(ctx());
    assert.equal(inv.line.quantity, 10000);
    assert.equal(inv.line.unitPrice, 6);
    assert.equal(inv.line.amount, 60000);
    assert.equal(inv.currency, "AED");
    assert.match(inv.totalText, /AED 60,000.00/);
    assert.equal(inv.line.description, "Plastic containers — Lidded containers.");
  });
  it("converts to INR with the user's rate when asked", () => {
    const inv = invoiceModel(ctx({ details: { currency: "INR" } }));
    assert.equal(inv.currency, "INR");
    assert.equal(inv.line.unitPrice, 138); // 6 AED x 23
  });
  it("becomes complete only when every required field is supplied, and is still a draft", () => {
    const inv = invoiceModel(ctx({ details: full }));
    assert.deepEqual(inv.missing, []);
    assert.equal(inv.complete, true);
    assert.equal(inv.label, DRAFT_LABEL);
  });
  it("warns about sample values, an unverified HS code and the price terms", () => {
    const review = invoiceModel(ctx({ inputsAreSample: true, details: full })).review.join(" ");
    assert.match(review, /SAMPLE/);
    assert.match(review, /not verified/);
    assert.match(review, /terms you agreed/);
  });
  it("says so when no HS code exists and never supplies one", () => {
    const inv = invoiceModel(ctx({ product: { ...product, hsCode: null }, details: full }));
    assert.equal(inv.line.hsCode, "");
    assert.match(inv.review.join(" "), /No HS code/);
  });
  it("flags a zero price as missing instead of printing a zero invoice", () => {
    const inv = invoiceModel(ctx({ inputs: { ...ctx().inputs, sellingPriceAed: 0 }, details: full }));
    assert.equal(inv.line, null);
    assert.equal(inv.complete, false);
  });
});

describe("packing list", () => {
  it("computes cartons, net, gross weight and volume from the product and carton data", () => {
    const p = packingModel(ctx({ details: full }));
    assert.equal(p.line.cartons, 400);
    assert.equal(p.line.netPerCartonKg, 2.38); // 25 x 95 g
    assert.equal(p.line.netTotalKg, 950); // 400 x 2.375 = 950 (to 2 d.p. per carton first)
    assert.equal(p.line.grossTotalKg, 2000);
    assert.equal(p.line.volumeCbm, 24);
    assert.equal(p.line.dims, "500 × 400 × 300 mm");
    assert.equal(p.label, DRAFT_LABEL);
  });
  it("reports missing weight and size data rather than guessing", () => {
    const p = packingModel(ctx({ product: { ...product, unitWeightG: null }, inputs: { ...ctx().inputs, cartonGrossWeightKg: null, cartonLengthMm: null, cartonWidthMm: null, cartonHeightMm: null }, details: full }));
    assert.equal(p.complete, false);
    assert.ok(p.missing.some((m) => /Unit weight/.test(m)));
    assert.ok(p.missing.some((m) => /gross weight/.test(m)));
    assert.ok(p.missing.some((m) => /dimensions/.test(m)));
    assert.equal(p.line.netTotalKg, null);
  });
  it("is complete only with buyer, references and ports as well as the data", () => {
    assert.equal(packingModel(ctx()).complete, false);
    assert.equal(packingModel(ctx({ details: full })).complete, true);
  });
});

describe("checklist and status", () => {
  it("is product-specific: the family adds its own evidence items", () => {
    const base = checklistFor(null).map((i) => i.id);
    assert.ok(base.includes("invoice") && base.includes("export-declaration") && base.includes("conformity"));
    assert.ok(checklistFor("food-contact").some((i) => i.id === "food-contact"));
    assert.ok(checklistFor("water-irrigation").some((i) => i.id === "potable"));
    assert.ok(!checklistFor("household-general").some((i) => i.id === "food-contact"));
  });
  it("never says a document is required, and platform drafts exist only for invoice and packing", () => {
    const items = checklistFor("food-contact");
    assert.deepEqual(items.filter((i) => i.draft).map((i) => i.draft).sort(), ["invoice", "packing"]);
    const text = items.map((i) => i.title + i.why).join(" ");
    assert.ok(!/\b(is required|are required|must be submitted|mandatory)\b/i.test(text));
  });
  it("summarises completeness for the roadmap and workspace", () => {
    const s = documentStatus(ctx({ details: full }), "household-general", { invoice: "have", packing: "have" });
    assert.equal(s.invoice.complete, true);
    assert.equal(s.packing.complete, true);
    assert.equal(s.checklist.answered, 2);
    assert.equal(s.checklist.total, checklistFor("household-general").length);
    assert.equal(documentStatus(ctx(), null, {}).invoice.complete, false);
  });
});
