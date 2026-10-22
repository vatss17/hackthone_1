// Pure tests: expert briefs fill in context, stay honest about status, and saved requests are untrusted input.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LOCAL_NOTICE, TOPICS, composeBrief, parseRequests } from "../../src/lib/experts/brief.ts";
import { newAssessment } from "../../src/lib/landed-cost/assessment.ts";
import { sampleInputs } from "../../src/lib/landed-cost/defaults.ts";

const facts = {
  ref: "p1", standalone: false,
  company: { name: "DEMO Co", legalName: "DEMO Co Private Limited", address: null },
  product: { name: "Plastic containers", own: true, description: true, category: true, intendedUse: true, specCount: 2, hsCode: "3924.10", unitWeightG: 95, unitsPerCarton: 24, cartonWeightKg: null, cartonDims: false, linkedFactories: ["Plant 1"],
    details: { description: "Lidded containers.\nMore.", category: "Household storage", intendedUse: "Food storage", specs: [{ name: "Capacity", value: "750", unit: "ml" }], materials: ["PP"] } },
  fit: { level: "strong", score: 100, gaps: ["Check mould size"], missingProcesses: [] },
  profile: { processNames: ["Injection moulding", "Extrusion"], materialNames: ["PP", "HDPE"], factories: 1, processes: 2, machines: 5, ratedMachines: 5, materials: 2, capacity: true },
  questions: { family: "food-contact", all: [], compliance: [], testing: [], hs: [], cepa: [], schemes: [] },
  opportunities: { count: 3, top: [] },
};
const input = (over = {}) => ({ topic: "hs", facts, assessment: null, docs: null, openQuestions: [], preparedOn: "2026-11-02", ...over });

describe("brief composition", () => {
  it("includes the product, company, what is needed and what is unverified", () => {
    const { title, summary } = composeBrief(input());
    assert.match(title, /HS classification: Plastic containers/);
    for (const part of ["Plastic containers", "DEMO Co Private Limited", "Injection moulding", "Capacity: 750 ml", "WHAT I NEED", "Which 6-digit HS heading", "WHAT IS NOT VERIFIED"]) assert.ok(summary.includes(part), part);
    assert.match(summary, /3924\.10 \(unverified, please confirm\)/);
  });
  it("is labelled a draft, not sent, and warns about sharing", () => {
    const { summary } = composeBrief(input());
    assert.match(summary, /DRAFT, prepared by the exporter, not yet shared/);
    assert.match(summary, /Share it only with an expert you trust/);
  });
  it("marks sample commercial values as sample and your own as estimates", () => {
    const sample = composeBrief(input({ assessment: newAssessment("p1", sampleInputs()) })).summary;
    assert.match(sample, /SAMPLE VALUES, NOT REAL/);
    const own = { ...newAssessment("p1", sampleInputs()), edited: ["quantity"] };
    const t = composeBrief(input({ assessment: own })).summary;
    assert.match(t, /our own estimates/);
    assert.match(t, /Customs duty assumed: 5% \(our assumption, not verified\)/);
    assert.match(t, /1 AED = INR 23 \(typed by us\)/);
  });
  it("reports freight as an estimate unless a quote is held", () => {
    const a = { ...newAssessment("p1", sampleInputs()), edited: ["quantity"] };
    assert.match(composeBrief(input({ assessment: a })).summary, /an estimate, no quote yet/);
    a.inputs.lines.internationalFreight.confirmed = true;
    assert.match(composeBrief(input({ assessment: a })).summary, /we hold a quote/);
  });
  it("describes the fit as an inference and lists open questions only when given", () => {
    const s = composeBrief(input({ openQuestions: ["Is a conformity scheme needed?"] })).summary;
    assert.match(s, /rule-based inference/);
    assert.match(s, /Is a conformity scheme needed\?/);
    assert.ok(!composeBrief(input()).summary.includes("OPEN QUESTIONS"));
  });
  it("adds document status for the documents topic only", () => {
    const docs = { invoice: { missing: 4, total: 10, complete: false }, packing: { missing: 0, total: 8, complete: true }, checklist: { answered: 3, total: 10 } };
    assert.match(composeBrief(input({ topic: "documents", docs })).summary, /4 required items still missing/);
    assert.ok(!composeBrief(input({ topic: "hs", docs })).summary.includes("DOCUMENT DRAFTS"));
  });
  it("works with no product (a general question) and for every topic", () => {
    for (const t of TOPICS) {
      const { summary } = composeBrief(input({ topic: t.id, facts: { ...facts, product: null, standalone: true } }));
      assert.match(summary, /No specific product selected/);
      assert.ok(summary.includes(t.asks[0]));
    }
  });
  it("never includes secrets or buyer details, and never claims a request was sent", () => {
    const { summary } = composeBrief(input({ assessment: newAssessment("p1", sampleInputs()) }));
    assert.ok(!/SUPABASE|secret|password|token|api[_ -]?key/i.test(summary));
    assert.ok(!/\bhas been sent\b|\bwe sent\b|\bsubmitted to\b/i.test(summary));
    assert.match(LOCAL_NOTICE, /not sent it to any expert/);
  });
});

describe("saved requests are untrusted input", () => {
  const good = { id: "req-abc123", topic: "hs", productRef: "p1", productName: "x", title: "t", summary: "s", status: "draft", reply: "", createdAt: "2026-11-02", updatedAt: "2026-11-02" };
  it("keeps valid requests and drops bad ones", () => {
    const out = parseRequests(JSON.stringify([good, { ...good, id: "bad id!" }, { ...good, id: "req-xyz999", topic: "nope" }, { ...good, id: "req-zzz111", status: "approved" }, "junk", null]));
    assert.deepEqual(out.map((r) => r.id), ["req-abc123"]);
  });
  it("bounds text, strips control characters and rejects non-arrays", () => {
    const out = parseRequests(JSON.stringify([{ ...good, summary: "a\u0000b" + "x".repeat(20000), productRef: "bad ref!" }]));
    assert.ok(out[0].summary.length <= 8000 && !out[0].summary.includes("\u0000"));
    assert.equal(out[0].productRef, null);
    for (const bad of ["not json", "{}", "null", "", null]) assert.deepEqual(parseRequests(bad), []);
  });
  it("caps the list length", () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ ...good, id: `req-${String(i).padStart(6, "0")}` }));
    assert.equal(parseRequests(JSON.stringify(many)).length, 100);
  });
});
