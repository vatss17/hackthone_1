// The "discover" section keeps its English text in data (catalogue, journey, status, engine sentences) and translates it when it is drawn.
// This checks that every such string has a Hindi and a Gujarati entry in the right script, and that the sentences the engine and the
// explanation build come back translated, with their numbers and names kept.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DICTIONARIES } from "../../src/lib/i18n/messages/index.ts";
import { placeholders, translate } from "../../src/lib/i18n/translate.ts";
import { CATALOGUE, COMMON_CONSIDERATIONS } from "../../src/lib/opportunities/catalogue.ts";
import { FIT_LABEL, MATERIAL_NAMES, PROCESS_NAMES, RATING_UNIT_LABELS, matchEntry } from "../../src/lib/opportunities/engine.ts";
import { JOURNEY } from "../../src/config/journey.ts";
import { CAPABILITY_STATUS } from "../../src/config/status.ts";
import { nextStep } from "../../src/lib/overview/next-step.ts";
import { HEADING_LABELS } from "../../src/lib/trade/headings.ts";
import { CONFIRM_TEXT, findCandidates } from "../../src/lib/classification/candidates.ts";
import { GENERAL_LIMITATIONS, NOT_LOADED_REASON, SOURCE, createEvidence } from "../../src/lib/trade/evidence.ts";
import { explainProduct } from "../../src/lib/explain/product.ts";
import { tr, joinItems } from "../../src/lib/opportunities/localize.ts";

const DEVANAGARI = /[ऀ-ॿ]/;
const GUJARATI = /[઀-૿]/;
const SCRIPT = { hi: DEVANAGARI, gu: GUJARATI };
const PROTECTED = /\b(?:HS|HSN|HDPE|LDPE|PP|PVC|PET|ABS|CBM|AED|INR|USD|CEPA|RoDTEP|GST|IEC|FOB|CIF|EXW|LCL|FCL|kg|mm|ISO|PIN)\b|\d+(?:[.,]\d+)*/g;
const read = (f) => readFileSync(f, "utf8");
const tFor = (loc) => (s, v) => translate(DICTIONARIES, loc, s, v);

/** Every English string that reaches t() through data rather than as a literal. */
function dataStrings() {
  const out = new Set();
  const add = (...xs) => xs.flat().forEach((x) => typeof x === "string" && x.trim() && !x.includes("· Atlas") && out.add(x));
  for (const e of CATALOGUE) {
    add(e.name, e.group, e.summary, e.tooling, e.validations, e.whyUae, e.regulatoryFocus, e.purchasedInputs ?? []);
    for (const i of e.industries) add(i.name, i.applications);
  }
  for (const c of COMMON_CONSIDERATIONS) add(c.topic, c.note);
  add("Applicability to this product has not been assessed.");
  for (const s of JOURNEY) add(s.label, s.guide);
  for (const c of Object.values(CAPABILITY_STATUS)) add(c.label, c.detail);
  add(Object.values(PROCESS_NAMES), Object.values(PROCESS_NAMES).map((p) => p.toLowerCase()), Object.values(MATERIAL_NAMES), Object.values(RATING_UNIT_LABELS), Object.values(FIT_LABEL));
  add(Object.values(HEADING_LABELS), CONFIRM_TEXT, "the product type", SOURCE.name, SOURCE.publisher, SOURCE.licence, NOT_LOADED_REASON, GENERAL_LIMITATIONS);
  // Journey bar tabs, status labels, the exploration stages and the Command Center lists are written in the components themselves.
  const grab = (file, re) => [...read(file).matchAll(re)].map((m) => m[1]);
  add(grab("src/components/journey-bar.tsx", /label: "([^"]+)"/g));
  add(grab("src/components/status-badge.tsx", /label: "([^"]+)"/g));
  add(grab("src/app/(app)/opportunities/[ref]/page.tsx", /(?:short|title|lead|headline|text): "([^"]+)"/g));
  const page = read("src/app/(app)/page.tsx");
  add([...page.matchAll(/(?:title|body|text): "([^"]+)"/g)].map((m) => m[1]));
  add([...page.matchAll(/\["\d", "([^"]+)", "([^"]+)"\]/g)].flatMap((m) => [m[1], m[2]]));
  // Next-step copy.
  const steps = [
    nextStep({ factories: [], profileTooThin: true, ownProducts: 0, topOpportunity: null }),
    nextStep({ factories: [{ id: "f", name: "F" }], profileTooThin: true, ownProducts: 0, topOpportunity: null }),
    nextStep({ factories: [{ id: "f", name: "F" }], profileTooThin: false, ownProducts: 0, topOpportunity: null }),
    nextStep({ factories: [{ id: "f", name: "F" }], profileTooThin: false, ownProducts: 2, topOpportunity: { id: "x", name: "X", reason: null } }),
    nextStep({ factories: [{ id: "f", name: "F" }], profileTooThin: false, ownProducts: 2, topOpportunity: null }),
  ];
  for (const s of steps) {
    if (s.kind !== "explore") add(s.title);
    add(s.why, s.cta.label);
  }
  return [...out];
}

describe("discover data strings", () => {
  const strings = dataStrings();
  it("finds the data it is supposed to check", () => {
    assert.ok(strings.length > 400, `only ${strings.length}`);
  });
  for (const loc of ["hi", "gu"]) {
    it(`every data string has a ${loc} translation in the right script, with its placeholders and protected tokens`, () => {
      const bad = [];
      for (const k of strings) {
        const v = DICTIONARIES[loc][k];
        if (!v) { bad.push(`missing: ${k}`); continue; }
        if (!SCRIPT[loc].test(v) && /[A-Za-z]{3,}/.test(k.replace(PROTECTED, ""))) bad.push(`script: ${k}`);
        if (placeholders(k).join() !== placeholders(v).join()) bad.push(`placeholders: ${k}`);
        for (const tok of k.match(PROTECTED) ?? []) if (!v.includes(tok)) bad.push(`token ${tok}: ${k}`);
      }
      assert.deepEqual(bad.slice(0, 20), [], `${bad.length} problems`);
    });
  }
});

/** A few factories that between them walk every branch of the engine. */
const factories = () => {
  const proc = (code, label, capacityText = null) => ({ code, label, capacityText });
  const machine = (processCode, name, ratingValue, ratingUnit = "tonnes_clamp_force", quantity = 1) => ({ processCode, name, quantity, ratingValue, ratingUnit });
  const base = { processes: [], materials: [], machines: [], factoryWideCapacity: null, products: [] };
  return [
    base,
    { ...base, processes: [proc("injection_moulding", "Injection moulding", "200 tonnes per month")], materials: [{ code: "PP", label: "PP" }, { code: "HDPE", label: "HDPE" }], machines: [machine("injection_moulding", "Haitian 250T", 250, "tonnes_clamp_force", 2)], products: [{ id: "p1", name: "Lunch box", category: "Household", description: null }] },
    { ...base, processes: [proc("injection_moulding", "Injection moulding"), proc("extrusion", "Extrusion")], materials: [{ code: "PET", label: "PET" }, { code: null, label: "Recycled blend" }], machines: [machine("injection_moulding", "Press", null), machine("extrusion", "Extruder", 65, "mm_screw_diameter")], factoryWideCapacity: "300 tonnes per month" },
    { ...base, processes: [proc("injection_moulding", "Injection moulding"), proc("blow_moulding", "Blow moulding"), proc("thermoforming", "Thermoforming")], materials: [{ code: "ABS", label: "ABS" }], machines: [], products: [{ id: "p2", name: "Plastic chair", category: "Furniture", description: "stackable chair" }] },
    { ...base, processes: [proc("extrusion", "Extrusion"), proc("rotational_moulding", "Rotational moulding", "50 tonnes per month")], materials: [{ code: "LLDPE", label: "LLDPE" }, { code: "PVC", label: "PVC" }], machines: [machine("extrusion", "Line 1", 90, "kg_per_hour"), machine("rotational_moulding", "Roto", null)] },
    { ...base, processes: [proc("injection_moulding", "Injection moulding", "80 tonnes per month")], materials: [{ code: "PS", label: "PS" }], machines: [machine("injection_moulding", "Press A", 500, "tonnes_clamp_force"), machine("injection_moulding", "Press B", 120, "tonnes_clamp_force")] },
  ];
};

function sentences() {
  const out = new Set();
  for (const f of factories()) {
    for (const e of CATALOGUE) {
      const m = matchEntry(e, f);
      for (const s of [...m.reasons, ...m.gaps, ...m.optional, m.confidence.why]) out.add(s);
      for (const p of m.parts) { out.add(p.label); out.add(p.detail); }
    }
  }
  return [...out];
}

/** Strings the translator was never given a template or an entry for stay in English. */
const KEPT_ENGLISH = new Set();

describe("sentences built by the engine", () => {
  const all = sentences();
  it("generates a broad set of sentences", () => assert.ok(all.length > 80, `only ${all.length}`));
  it("come back unchanged in English", () => {
    const en = tFor("en");
    for (const s of all) assert.equal(tr(en, s), s);
  });
  for (const loc of ["hi", "gu"]) {
    it(`are translated into ${loc}, with every number kept`, () => {
      const t = tFor(loc);
      const bad = [];
      for (const s of all) {
        const r = tr(t, s);
        if (!SCRIPT[loc].test(r)) { bad.push(`English left: ${s}`); continue; }
        if (/\{\w+\}/.test(r)) bad.push(`placeholder left: ${s}`);
        for (const n of s.match(/\d+(?:\.\d+)?/g) ?? []) if (!r.includes(n)) bad.push(`lost ${n}: ${s}`);
      }
      assert.deepEqual(bad.slice(0, 15), [], `${bad.length} problems`);
    });
  }
});

describe("sentences built by the explanation, the classifier and the evidence module", () => {
  const evidence = createEvidence({
    source: { name: SOURCE.name, publisher: SOURCE.publisher, url: SOURCE.url, retrieved: "2025-01-01", licence: SOURCE.licence },
    flows: {
      uaeImportsFromWorld: { data: { 3924: { 2022: { valueUsd: 12_500_000, netWeightKg: 3_000_000, classification: "H5", isAggregate: false }, 2023: { valueUsd: 15_000_000, netWeightKg: null, classification: "H6", isAggregate: false } } } },
      indiaExportsToUae: { data: { 3924: { 2023: { valueUsd: 2_100_000, netWeightKg: 500_000, classification: "H6", isAggregate: false } } } },
    },
  });
  const set = new Set();
  const entry = CATALOGUE.find((e) => e.id === "food-storage-containers");
  const f = factories()[1];
  const match = matchEntry(entry, f);
  const none = createEvidence(null).evidenceForEntry(entry.id);
  for (const ev of [evidence.evidenceForEntry(entry.id), none]) {
    for (const commercial of [null, { landedPerUnitAed: 4.2, sellingPriceAed: 5, grossMarginPct: 16, targetMarginPct: 20, sample: true }, { landedPerUnitAed: 4.2, sellingPriceAed: 5, grossMarginPct: null, targetMarginPct: 20, sample: false }]) {
      for (const e of [explainProduct({ entry, match, commercial, screening: { total: 12, resolved: 3 }, evidence: ev }), explainProduct({ entry: null, match: null, commercial, screening: { total: 0, resolved: 0 }, evidence: ev })]) {
        for (const d of e.dimensions) { set.add(d.title); set.add(d.status); d.lines.forEach((l) => set.add(l)); }
        e.why.forEach((w) => set.add(w));
        e.uncertain.forEach((w) => set.add(w));
        set.add(e.plausible.text);
      }
    }
  }
  for (const lvl of ["stretch", "possible", "good"]) {
    const m = { ...match, level: lvl, missingProcesses: lvl === "stretch" ? ["blow_moulding"] : [], gaps: [], reasons: [], matchedProcesses: ["injection_moulding", "extrusion"], putsToWork: ["extrusion"], matchedMaterials: ["PP", "HDPE"] };
    const e = explainProduct({ entry, match: m, commercial: null, screening: { total: 1, resolved: 0 }, evidence: none });
    for (const d of e.dimensions) { set.add(d.status); d.lines.forEach((l) => set.add(l)); }
    e.why.forEach((w) => set.add(w));
    e.plausible && set.add(e.plausible.text);
  }
  for (const input of [{ name: "Pipe and tube" }, { name: "Plastic bottle box tray" }, { name: "pallet", catalogueId: "pipes-and-fittings" }, { name: "zzz" }]) {
    const r = findCandidates(input);
    r.candidates.forEach((c) => { set.add(c.label); set.add(c.rationale); set.add(c.ambiguity); });
    set.add(r.confirm);
    if (r.none) set.add(r.none);
  }
  const ev = evidence.headingEvidence("3924");
  ev.notes.forEach((n) => set.add(n));
  set.add(evidence.evidenceForEntry(entry.id).freshness);
  set.add(evidence.evidenceForEntry(entry.id).mappingNote);
  set.add(none.freshness);
  set.add(none.emptyReason);
  set.add(evidence.evidenceForEntry("unknown-entry").emptyReason);
  const all = [...set].filter((s) => /[A-Za-z]/.test(s));
  it("exercises plenty of sentences", () => assert.ok(all.length > 40, `only ${all.length}`));
  it("come back unchanged in English", () => {
    const en = tFor("en");
    for (const s of all) assert.equal(tr(en, s), s);
  });
  for (const loc of ["hi", "gu"]) {
    it(`are translated into ${loc}`, () => {
      const t = tFor(loc);
      const bad = [];
      for (const s of all) {
        if (KEPT_ENGLISH.has(s)) continue;
        const r = tr(t, s);
        if (!SCRIPT[loc].test(r)) { bad.push(`English left: ${s}`); continue; }
        if (/\{\w+\}/.test(r)) bad.push(`placeholder left: ${s}`);
        for (const n of s.match(/\d+(?:\.\d+)?/g) ?? []) if (!r.includes(n)) bad.push(`lost ${n}: ${s}`);
      }
      assert.deepEqual(bad.slice(0, 15), [], `${bad.length} problems`);
    });
  }
});

describe("catalogue hypotheses that the explanation trims", () => {
  for (const loc of ["hi", "gu"]) {
    it(`stay translated and lose the bracketed suffix in ${loc}`, () => {
      const t = tFor(loc);
      const bad = [];
      for (const e of CATALOGUE) {
        for (const w of e.whyUae) {
          const trimmed = w.replace(/ \((?:hypothesis|to be assessed)[^)]*\)\.?$/i, ".");
          const r = tr(t, trimmed);
          if (!SCRIPT[loc].test(r)) bad.push(`English left: ${trimmed}`);
          else if (trimmed !== w && /\([^()]*\)\.?$/.test(r)) bad.push(`suffix kept: ${trimmed}`);
        }
      }
      assert.deepEqual(bad.slice(0, 10), [], `${bad.length} problems`);
    });
  }
});

describe("lists are joined in the reader's language", () => {
  it("English keeps commas and 'and'", () => {
    assert.equal(joinItems(tFor("en"), ["a", "b", "c"]), "a, b and c");
    assert.equal(joinItems(tFor("en"), ["a"]), "a");
  });
  it("Hindi and Gujarati translate the items and the joiner", () => {
    assert.match(joinItems(tFor("hi"), ["extrusion", "printing"]), /एक्सट्रूज़न और प्रिंटिंग/);
    assert.match(joinItems(tFor("gu"), ["extrusion", "printing"]), /એક્સ્ટ્રુઝન અને પ્રિન્ટિંગ/);
  });
});
