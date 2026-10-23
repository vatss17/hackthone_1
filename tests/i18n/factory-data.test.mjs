// Factory, machinery, capacity, product and catalogue-import text that reaches t() through data (validation and server messages,
// reference names, the catalogue reader's sentences) rather than a literal in a component. Every such string needs a Hindi and a
// Gujarati entry in the right script, with the same {placeholders}; the reader's sentences must translate with the file's words intact.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAPACITY_PERIODS, CAPACITY_UNITS, ERROR_MESSAGES, NOTICE_MESSAGES, RATING_UNITS } from "../../src/lib/capability-validation.ts";
import { validateFactory } from "../../src/lib/factory-validation.ts";
import { mapFactoryWriteError } from "../../src/lib/factory-errors.ts";
import { PROVENANCE_LABEL, estimateFactory, estimateProcess, formatQuantity, translateEstimateMessage } from "../../src/lib/capacity/available.ts";
import { DEMO_CATALOGUE, parseCatalogue } from "../../src/lib/catalogue/parse.ts";
import { localizeMessage } from "../../src/lib/catalogue/localize.ts";
import { DICTIONARIES } from "../../src/lib/i18n/messages/index.ts";
import { placeholders, translate } from "../../src/lib/i18n/translate.ts";

const SCRIPT = { hi: /[ऀ-ॿ]/, gu: /[઀-૿]/ };
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const lits = (src, re) => [...src.matchAll(re)].map((m) => m[1] ?? m[2] ?? m[3]).filter(Boolean);

// ---- strings that arrive as data -------------------------------------------------------------------------------------------
const proc = (id, q, u) => ({ id, label: id, quantity: q, unit: q === null ? null : "kg", period: q === null ? null : "day", utilisationPct: u });
const est = [proc("a", null, 50), proc("b", 100, null), proc("c", 100, 150)].map(estimateProcess);
const two = [estimateProcess(proc("Moulding", 100, 50)), estimateProcess(proc("Extrusion", 200, 50))];
const mixed = [estimateProcess(proc("x", 100, 50)), estimateProcess({ ...proc("y", 100, 50), unit: "tonnes" })];
const asks = [
  estimateFactory([], "unknown").ask,
  estimateFactory(two, "unknown").ask,
  estimateFactory(mixed, "sequential").ask,
  estimateFactory(two, "parallel").ask,
];
const dynamicAsks = [estimateFactory(two, "sequential").ask, estimateFactory(two, "sequential", "Extrusion").ask];

const validation = [
  ...Object.values(validateFactory({}).fieldErrors),
  ...Object.values(validateFactory({ factoryName: "a", addressLine1: "x".repeat(201), city: "y".repeat(101), state: "Nowhere", postalCode: "012345" }).fieldErrors),
  ...Object.values(validateFactory({ factoryName: "!!", addressLine1: "--", city: "ok\u0001", state: "", postalCode: "" }).fieldErrors),
];
const writeErrors = [{ code: "23505" }, { code: "42501" }, { code: "XX000" }].flatMap((e) => {
  const r = mapFactoryWriteError(e, {});
  return [r.error, ...Object.values(r.fieldErrors ?? {})].filter(Boolean);
});

const importAction = read("src/lib/actions/catalogue-import.ts");
const ai = read("src/lib/ai/provider.ts");
const aiBlock = ai.slice(ai.indexOf("AI_ERROR_MESSAGES: Record"), ai.indexOf("/** An image, PDF or audio"));
const parseSrc = read("src/lib/catalogue/parse.ts");
const workspace = read("src/components/catalogue/import-workspace.tsx");

const strings = [
  ...Object.values(ERROR_MESSAGES),
  ...Object.values(NOTICE_MESSAGES),
  ...CAPACITY_UNITS.filter((u) => ["pieces", "metres"].includes(u.value)).map((u) => u.label),
  ...CAPACITY_PERIODS.map((p) => p.label),
  ...RATING_UNITS.map((r) => r.label),
  ...Object.values(PROVENANCE_LABEL),
  ...est.map((e) => e.missing).filter(Boolean),
  ...asks,
  ...validation,
  ...writeErrors,
  ...lits(read("src/app/(app)/factories/page.tsx"), /text: "((?:[^"\\]|\\.)*)"/g),
  ...lits(importAction, /(?:duplicate|invalid|failed): "((?:[^"\\]|\\.)*)"|error: "((?:[^"\\]|\\.)*)"|reason: "((?:[^"\\]|\\.)*)"/g),
  ...lits(parseSrc, /(?:notes\.push\(|message: |warnings: \[|warnings\.push\()"((?:[^"\\]|\\.)*)"/g),
  "The weight could not be read.",
  "The weight has no unit. Say whether it is in grams (g) or kilograms (kg).",
  ...lits(read("src/lib/catalogue/pdf.ts"), /Error\("((?:[^"\\]|\\.)*)"/g),
  ...lits(workspace, /(?:new Error\(|\?\? |setAiNote\(r\.ok \? )"((?:[^"\\]|\\.)*)"/g),
  ...lits(aiBlock, /: "((?:[^"\\]|\\.)*)",\n/g),
  // Reference data shown from the database (supabase seed) and the fit labels.
  "Injection moulding", "Blow moulding", "Extrusion", "Thermoforming", "Rotational moulding", "Compression moulding", "Additive manufacturing", "Printing", "Finishing",
  "Polypropylene", "High-density polyethylene", "Low-density polyethylene", "Linear low-density polyethylene", "Polyethylene terephthalate", "Polyvinyl chloride", "Polystyrene",
  "High-impact polystyrene", "Acrylonitrile butadiene styrene", "Polycarbonate", "Polyamide (nylon)", "Poly(methyl methacrylate)", "Thermoplastic elastomer", "Thermoplastic polyurethane",
  "Strong capability fit", "Good capability fit", "Possible fit", "Stretch: needs a new process",
  "tonnes clamp force", "g shot weight", "kg per hour", "pieces per hour", "mm screw diameter",
  "high", "medium", "low",
  // Realised by plural() in the import workspace, which passes the keys on to t().
  ...[...workspace.matchAll(/plural\([^,]+,\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"/g)].flatMap((m) => [m[1], m[2]]),
].filter((s) => /[A-Za-z]/.test(s));

describe("factory section data strings are translated", () => {
  it("finds the strings", () => assert.ok(strings.length > 150, `only ${strings.length}`));
  for (const lang of ["hi", "gu"]) {
    it(`${lang}: every string has an entry in the right script with the same placeholders`, () => {
      const bad = [];
      for (const s of new Set(strings)) {
        const v = DICTIONARIES[lang][s];
        if (!v || !v.trim()) bad.push(`missing: ${s}`);
        else {
          if (!SCRIPT[lang].test(v)) bad.push(`script: ${s}`);
          if (placeholders(s).join() !== placeholders(v).join()) bad.push(`placeholders: ${s}`);
        }
      }
      assert.deepEqual(bad, []);
    });
  }
});

describe("capacity text in the reader's language", () => {
  const t = (lang) => (s, v) => translate(DICTIONARIES, lang, s, v);
  it("keeps the number and unit codes and translates the period", () => {
    assert.equal(formatQuantity({ quantity: 63, unit: "tonnes", period: "month" }), "63 tonnes per month");
    assert.equal(formatQuantity({ quantity: 63, unit: "tonnes", period: "month" }, t("en")), "63 tonnes per month");
    const hi = formatQuantity({ quantity: 63, unit: "kg", period: "day" }, t("hi"));
    assert.match(hi, /^63 kg /);
    assert.match(hi, /[ऀ-ॿ]/);
    assert.match(formatQuantity({ quantity: 5, unit: "pieces", period: "year" }, t("gu")), /^5 [઀-૿]+ [઀-૿ ]+$/);
  });
  it("translates the sentences that name a process without touching the name", () => {
    for (const ask of dynamicAsks.filter(Boolean)) {
      for (const lang of ["hi", "gu"]) {
        const out = translateEstimateMessage(ask, t(lang));
        assert.notEqual(out, ask);
        assert.ok(SCRIPT[lang].test(out));
        assert.ok(out.includes("Moulding") || out.includes("Extrusion"), out);
      }
    }
  });
});

describe("the catalogue reader's messages translate with the file's own words intact", () => {
  const t = (lang) => (s, v) => translate(DICTIONARIES, lang, s, v);
  const L = (lang) => (m) => localizeMessage(m, t(lang), lang);
  const out = parseCatalogue("Product: Crate\nMaterial: PP\nWeight: -5 kg\nHS: 12\nCapacity: 0 litres\n\nProduct: Pail\nWeight: heavy\nWeight (g): 40 stone\n");
  const messages = [
    ...out.warnings,
    ...out.products.flatMap((p) => [...p.notes, p.confidenceWhy, ...p.issues.flatMap((i) => [i.message, i.location]), ...p.rejected.flatMap((r) => [r.reason, r.location])]),
    ...parseCatalogue(DEMO_CATALOGUE).products.map((p) => p.confidenceWhy),
    ...parseCatalogue("a,b\n").warnings,
    ...parseCatalogue("   ").warnings,
    ...parseCatalogue("Name,Weight (g)\nCrate,-4\nPail,abc\n").products.flatMap((p) => p.rejected.flatMap((r) => [r.reason, r.location])),
  ].filter(Boolean);

  it("produces a useful set of messages to check", () => assert.ok(messages.length >= 10, `only ${messages.length}`));
  for (const lang of ["hi", "gu"]) {
    it(`${lang}: every message the reader produces is translated`, () => {
      const untranslated = messages.filter((m) => L(lang)(m) === m);
      assert.deepEqual([...new Set(untranslated)], []);
    });
  }
  it("English is returned unchanged", () => {
    for (const m of messages) assert.equal(localizeMessage(m, t("en"), "en"), m);
  });
  it("puts the person's own values back untouched", () => {
    const m = "The weight “heavy” is not a number.";
    for (const lang of ["hi", "gu"]) assert.ok(L(lang)(m).includes("“heavy”"));
    const n = "Wall thickness must be a positive number (found -2 mm).";
    for (const lang of ["hi", "gu"]) {
      const v = L(lang)(n);
      assert.ok(v.includes("Wall thickness") && v.includes("-2 mm"), v);
    }
    const loc = "row 4, column 3 (“Weight”)";
    for (const lang of ["hi", "gu"]) assert.ok(L(lang)(loc).includes("“Weight”") && L(lang)(loc).includes("4") && L(lang)(loc).includes("3"));
  });
});
