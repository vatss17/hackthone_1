// Pure tests: the deterministic explanation keeps four dimensions apart and never overstates.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { explainProduct } from "../../src/lib/explain/product.ts";
import { CATALOGUE_BY_ID } from "../../src/lib/opportunities/catalogue.ts";
import { discover, matchEntry } from "../../src/lib/opportunities/engine.ts";
import { noEvidence, syntheticEvidence } from "./fixture.mjs";

const factory = {
  processes: [{ code: "injection_moulding", label: "Injection moulding", capacityText: "180 tonnes per month" }, { code: "extrusion", label: "Extrusion", capacityText: null }],
  materials: [{ code: "PP", label: "PP" }, { code: "HDPE", label: "HDPE" }],
  machines: [{ processCode: "injection_moulding", name: "Press 150T", quantity: 2, ratingValue: 150, ratingUnit: "tonnes_clamp_force" }, { processCode: "extrusion", name: "Extruder", quantity: 1, ratingValue: 65, ratingUnit: "mm_screw_diameter" }],
  factoryWideCapacity: null,
  products: [{ id: "p", name: "Plastic containers", category: null, description: null }],
};
const entry = CATALOGUE_BY_ID["irrigation-drip"];
const match = discover(factory).adjacent.find((m) => m.entry.id === "irrigation-drip");
const base = () => explainProduct({ entry, match, commercial: null, screening: { total: 28, resolved: 3 }, evidence: syntheticEvidence.evidenceForEntry("irrigation-drip") });

describe("four separate dimensions", () => {
  it("returns manufacturing fit, UAE evidence, commercial feasibility and regulatory readiness, in that order, with no combined score", () => {
    const e = base();
    assert.deepEqual(e.dimensions.map((d) => d.key), ["fit", "evidence", "commercial", "regulatory"]);
    assert.ok(!("score" in e) && !("overall" in e));
    assert.equal(new Set(e.dimensions.map((d) => d.title)).size, 4);
  });
  it("only the fit dimension carries a score, and it says it is capability only", () => {
    const [fit, evd, com, reg] = base().dimensions;
    assert.match(fit.status, /\d+\/100 on capability only/);
    for (const d of [evd, com, reg]) assert.doesNotMatch(d.status, /\d+\/100/);
  });
  it("labels each dimension's provenance honestly", () => {
    const [fit, evd, com, reg] = base().dimensions;
    assert.equal(fit.provenance, "inferred");
    assert.equal(evd.provenance, "reported");
    assert.equal(com.provenance, "missing");
    assert.equal(reg.provenance, "unknown");
  });
});

describe("evidence", () => {
  it("quotes reported figures (synthetic here) with their year and keeps them to broad headings", () => {
    const evd = base().dimensions[1];
    assert.match(evd.lines.join(" "), /HS 3917/);
    assert.match(evd.lines.join(" "), /the UAE reported USD 4\.0 million of imports from all countries in \d{4}/);
    assert.match(evd.lines.join(" "), /not demand for this product, not buyer intent and not a forecast/);
  });
  it("says so plainly when there is no data", () => {
    const e = explainProduct({ entry: null, match: null, commercial: null, screening: { total: 0, resolved: 0 }, evidence: syntheticEvidence.evidenceForEntry(null) });
    assert.equal(e.dimensions[1].provenance, "missing");
    assert.match(e.dimensions[1].lines[0], /no evidence either way/);
    assert.equal(e.plausible.verdict, "unknown");
  });
});

describe("evidence not loaded", () => {
  it("says it is not loaded, shows no figures and invents none", () => {
    const e = explainProduct({ entry, match, commercial: null, screening: { total: 28, resolved: 0 }, evidence: noEvidence.evidenceForEntry("irrigation-drip") });
    const evd = e.dimensions[1];
    assert.equal(evd.provenance, "missing");
    assert.match(evd.status, /Not loaded/);
    assert.ok(!/USD/.test(evd.lines.join(" ")));
    assert.match(evd.lines.join(" "), /not loaded in this deployment/);
  });
});

describe("commercial and regulatory", () => {
  it("treats sample numbers as illustrative and your own as assumptions", () => {
    const sample = explainProduct({ entry, match, commercial: { landedPerUnitAed: 4.46, sellingPriceAed: 6, grossMarginPct: 25.7, targetMarginPct: 20, sample: true }, screening: { total: 28, resolved: 0 }, evidence: syntheticEvidence.evidenceForEntry("irrigation-drip") }).dimensions[2];
    assert.equal(sample.provenance, "assumption");
    assert.match(sample.status, /Illustrative/);
    assert.match(sample.lines.join(" "), /sample values/);
    const own = explainProduct({ entry, match, commercial: { landedPerUnitAed: 4.14, sellingPriceAed: 5.5, grossMarginPct: 24.77, targetMarginPct: 20, sample: false }, screening: { total: 28, resolved: 0 }, evidence: syntheticEvidence.evidenceForEntry("irrigation-drip") }).dimensions[2];
    assert.equal(own.provenance, "user");
    assert.match(own.lines.join(" "), /not tested against the market/);
  });
  it("never claims compliance, approval, eligibility or a guarantee, and says nothing is verified", () => {
    const e = base();
    const text = JSON.stringify(e);
    assert.doesNotMatch(text, /\b(is compliant|are compliant|approved|certified|guaranteed|you qualify|eligible for)\b/i);
    assert.match(e.dimensions[3].lines.join(" "), /None has been verified/);
    assert.match(e.dimensions[3].lines.join(" "), /does not assess compliance/);
  });
});

describe("why, uncertainty and plausibility", () => {
  it("explains the recommendation from the factory's own processes and materials", () => {
    const e = base();
    assert.ok(e.why.some((w) => /injection moulding|extrusion/i.test(w)));
    assert.ok(e.why.some((w) => /already work with/.test(w)));
    assert.ok(e.why.some((w) => /put your extrusion capability to work/.test(w)));
  });
  it("always lists what remains uncertain, including the unverified HS code", () => {
    const u = base().uncertain.join(" ");
    assert.match(u, /UAE buyer would pay/);
    assert.match(u, /HS code/);
  });
  it("states plausibility as an inference, and a stretch as a stretch", () => {
    assert.equal(base().plausible.verdict, "plausible");
    assert.match(base().plausible.text, /inference/);
    const blow = CATALOGUE_BY_ID["blow-moulded-bottles"];
    const e = explainProduct({ entry: blow, match: matchEntry(blow, factory), commercial: null, screening: { total: 0, resolved: 0 }, evidence: syntheticEvidence.evidenceForEntry(null) });
    assert.equal(e.plausible.verdict, "stretch");
    assert.match(e.dimensions[0].lines.join(" "), /Blow moulding/i);
  });
});
