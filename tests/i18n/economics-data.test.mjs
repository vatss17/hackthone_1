// Text in the economics section that reaches the screen as data (compliance questions, calculator labels and messages, the logistics
// estimate's sentences) is translated when it is shown, so the "every t(...) literal" test cannot see it. This checks each string has a
// Hindi and a Gujarati entry in the right script with the same placeholders, and that the helpers that rebuild sentences with numbers
// really translate every sentence the calculation code can produce.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DICTIONARIES } from "../../src/lib/i18n/messages/index.ts";
import { placeholders, translate } from "../../src/lib/i18n/translate.ts";
import { SOURCES, SECTION_TITLES, FAMILIES, ALL_SECTIONS, itemsFor, EVIDENCE_EXPLANATION } from "../../src/lib/compliance/content.ts";
import { LINE_LABELS, TWEAKS, validateInputs, calculate } from "../../src/lib/landed-cost/calc.ts";
import { DEFAULT_SCENARIOS, VERDICT_LABEL, scenarioApplicable, compareScenarios } from "../../src/lib/landed-cost/scenarios.ts";
import { relevantAssumptions } from "../../src/lib/landed-cost/assumptions.ts";
import { sampleInputs } from "../../src/lib/landed-cost/defaults.ts";
import { priceGap } from "../../src/lib/landed-cost/price-gap.ts";
import { lineNote, priceGapShort, priceGapText } from "../../src/lib/landed-cost/labels.ts";
import { estimateLogistics, planShipment } from "../../src/lib/logistics/estimate.ts";
import { LANE } from "../../src/lib/logistics/reference.ts";
import { howEstimated, planSummary } from "../../src/lib/logistics/labels.ts";

const DEVANAGARI = /[ऀ-ॿ]/;
const GUJARATI = /[઀-૿]/;
const LATIN_WORD = /[A-Za-z]{3,}/;
const PROTECTED = /\b(?:HS|HSN|HDPE|LDPE|PP|PVC|PET|ABS|CBM|AED|INR|USD|CEPA|RoDTEP|GST|IEC|FOB|CIF|EXW|LCL|FCL|kg|mm|ISO|PIN)\b|\d+(?:[.,]\d+)*/g;

function check(label, strings) {
  const list = [...new Set(strings.filter(Boolean))];
  assert.ok(list.length > 0, `${label}: nothing collected`);
  for (const [loc, script] of [["hi", DEVANAGARI], ["gu", GUJARATI]]) {
    const dict = DICTIONARIES[loc];
    const missing = list.filter((s) => !dict[s]);
    assert.deepEqual(missing, [], `${label}: missing ${loc}`);
    const bad = [];
    for (const s of list) {
      const v = dict[s];
      if (placeholders(s).join() !== placeholders(v).join()) bad.push(`placeholders: ${s}`);
      if (LATIN_WORD.test(s.replace(PROTECTED, "")) && !script.test(v)) bad.push(`script: ${s}`);
      for (const tok of s.match(PROTECTED) ?? []) if (!v.includes(tok)) bad.push(`token ${tok}: ${s}`);
    }
    assert.deepEqual(bad, [], `${label}: problems in ${loc}`);
  }
}

describe("compliance screening content is translated", () => {
  it("every source fact, publisher and caveat", () => {
    check("sources", SOURCES.flatMap((s) => [s.fact, s.publisher, s.caveat]));
  });
  it("section titles, blurbs and the evidence explanations", () => {
    check("sections", Object.values(SECTION_TITLES).flatMap((s) => [s.title, s.blurb]));
    check("evidence", Object.values(EVIDENCE_EXPLANATION));
  });
  it("family names, descriptions and candidate headings", () => {
    check("families", FAMILIES.flatMap((f) => [f.name, f.covers, ...f.hsCandidates.map((h) => h.description)]));
  });
  it("every screening question and its why-text", () => {
    const all = FAMILIES.flatMap((f) => ALL_SECTIONS.flatMap((s) => itemsFor(f, s).flatMap((i) => [i.text, i.why])));
    assert.ok(all.length > 100, "questions found");
    check("questions", all);
  });
});

describe("calculator labels and messages are translated", () => {
  it("cost line labels, groups and result labels", () => {
    const r = calculate(sampleInputs());
    check("lines", [...Object.values(LINE_LABELS), ...r.lines.flatMap((l) => [l.label, l.group])]);
  });
  it("sensitivity labels", () => {
    check("tweaks", TWEAKS.map((t) => t.label));
  });
  it("scenario names, verdicts and reasons", () => {
    const base = sampleInputs();
    const tariff = { ...base, duty: { ...base.duty, preferentialRatePercent: 9, ratePercent: 5 } };
    const reasons = DEFAULT_SCENARIOS.map((s) => scenarioApplicable(tariff, s).reason).filter(Boolean);
    const broken = compareScenarios({ ...base, inrPerAed: 1 }, [{ ...DEFAULT_SCENARIOS[0] }, { ...DEFAULT_SCENARIOS[1], fxPct: -100 }]).map((r) => r.reason);
    check("scenarios", [...DEFAULT_SCENARIOS.map((s) => s.name), ...Object.values(VERDICT_LABEL), ...reasons, ...broken]);
  });
  it("assumption labels", () => {
    check("assumptions", relevantAssumptions({ inputs: sampleInputs(), edited: [], acceptedSamples: [] }).map((a) => a.label));
  });
  it("every validation error and warning", () => {
    const base = sampleInputs();
    const lines = (over) => ({ ...base.lines, ...over });
    const variants = [
      { ...base, quantity: 0, unitsPerCarton: 0, unitProductionCostInr: -1, inrPerAed: 0, sellingPriceAed: -1, targetMarginPercent: 100, duty: { ...base.duty, ratePercent: 101, preferentialRatePercent: 101 } },
      { ...base, cartonGrossWeightKg: -1, cartonLengthMm: 100, cartonWidthMm: null, cartonHeightMm: null },
      { ...base, cartonGrossWeightKg: null, cartonLengthMm: null, cartonWidthMm: null, cartonHeightMm: null, lines: lines({ internationalFreight: { ...base.lines.internationalFreight, basis: "per_kg", amount: 5 }, otherCharges: { ...base.lines.otherCharges, basis: "per_cbm", amount: 5 } }) },
      { ...base, lines: lines({ packaging: { ...base.lines.packaging, basis: "percent_of_goods", amount: 200 }, insurance: { ...base.lines.insurance, amount: -1 } }) },
      { ...base, sellingPriceAed: 0, duty: { ...base.duty, ratePercent: 0, applyPreference: true }, cartonGrossWeightKg: null, cartonLengthMm: null, cartonWidthMm: null, cartonHeightMm: null },
    ];
    const msgs = variants.flatMap((v) => {
      const r = validateInputs(v);
      return [...Object.values(r.errors), ...r.warnings];
    });
    assert.ok(msgs.length >= 12, `collected ${msgs.length} messages`);
    check("validation", msgs);
  });
  it("price gap sentences", () => {
    check("price gap", [priceGap(5, 0).text, priceGap(null, 5).text, priceGap(-1, 5).text, priceGap(5, 5).text]);
  });
});

describe("helpers translate sentences that carry numbers", () => {
  const hi = (s, v) => translate(DICTIONARIES, "hi", s, v);
  const gu = (s, v) => translate(DICTIONARIES, "gu", s, v);
  const fx = [
    ["hi", hi, DEVANAGARI],
    ["gu", gu, GUJARATI],
  ];
  it("cost line notes", () => {
    const r = calculate(sampleInputs());
    for (const [loc, t, script] of fx) {
      for (const l of r.lines) assert.match(lineNote(t, l.note), script, `${loc}: ${l.note}`);
    }
    assert.match(lineNote(hi, "85 units x INR 85"), /85/);
  });
  it("price gaps", () => {
    for (const [, t, script] of fx) {
      for (const g of [priceGap(6, 5), priceGap(4, 5), priceGap(5, 5), priceGap(5, 0)]) {
        assert.match(priceGapShort(t, g), script);
        assert.match(priceGapText(t, g), script);
      }
    }
    assert.match(priceGapShort(hi, priceGap(6, 5)), /20\.0%/);
  });
  it("the shipment plan and each charge's explanation, for shared and full-container loads", () => {
    const cases = [
      { volumeCbm: 4, grossKg: 900, distanceKm: 300 },
      { volumeCbm: 28, grossKg: 8000, distanceKm: 300 },
      { volumeCbm: 60, grossKg: 20000, distanceKm: 120 },
      { volumeCbm: 140, grossKg: 40000, distanceKm: 500 },
    ];
    let plans = 0;
    for (const c of cases) {
      const est = estimateLogistics(c);
      assert.ok(est.ok);
      for (const [loc, t, script] of fx) {
        assert.match(planSummary(t, est.plan.summary), script, `${loc} plan: ${est.plan.summary}`);
        plans++;
        for (const l of est.lines) {
          assert.match(howEstimated(t, l.how), script, `${loc} how: ${l.how}`);
          assert.match(t(l.label), script, `${loc} label: ${l.label}`);
        }
      }
    }
    assert.ok(plans >= 8);
    assert.match(planSummary(hi, planShipment(900, 99999999).summary), DEVANAGARI);
  });
  it("the estimate's own problems, qualities and the lane name", () => {
    const e1 = estimateLogistics({ volumeCbm: null, grossKg: null, distanceKm: 300 });
    const e2 = estimateLogistics({ volumeCbm: 10, grossKg: 1000, distanceKm: 99999 });
    const est = estimateLogistics({ volumeCbm: 28, grossKg: 8000, distanceKm: 300 });
    check("estimate", [e1.problem, e2.problem, LANE, ...est.lines.map((l) => l.quality)]);
  });
});
