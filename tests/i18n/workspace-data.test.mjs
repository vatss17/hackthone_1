// Localization of the workspace section's data tables: roadmap tasks, document labels and checks, expert topics, backup messages.
// These strings are rendered later with t(...), so the coverage test cannot see them as literals. Every one needs a Hindi and a
// Gujarati entry in the right script, with the same {placeholders}.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DICTIONARIES } from "../../src/lib/i18n/messages/index.ts";
import { placeholders, translate } from "../../src/lib/i18n/translate.ts";
import { TEMPLATES, sample, tx } from "../../src/lib/workspace/dynamic-text.ts";
import { PHASES, STATUS_LABEL as TASK_STATUS_LABEL } from "../../src/lib/roadmap/engine.ts";
import { TOPICS, STATUS_LABEL as REQUEST_STATUS_LABEL, LOCAL_NOTICE } from "../../src/lib/experts/brief.ts";
import { GROUPS, LABELS, SOURCE_TEXT } from "../../src/lib/documents/labels.ts";
import { MISSION_COLUMNS, REQUEST_NEXT } from "../../src/lib/workspace/labels.ts";
import { checklistFor } from "../../src/lib/documents/generate.ts";

const DEVANAGARI = /[ऀ-ॿ]/;
const GUJARATI = /[઀-૿]/;
const SCRIPT = { hi: DEVANAGARI, gu: GUJARATI };
const PROTECTED = /\b(?:HS|HSN|CEPA|RoDTEP|GST|GSTIN|IEC|FOB|CIF|EXW|kg|mm|ISO|PIN|INR|AED|UV|PDF|JSON)\b|\d+(?:[.,]\d+)*/g;

const lines = (f) => readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const grab = (text, re) => [...text.matchAll(re)].map((m) => m[1]);

// Roadmap: every sentence-like literal in the engine (titles, why text, next-step labels, notes, phases, disclaimer).
const engine = lines("src/lib/roadmap/engine.ts");
const engineStrings = [...engine.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).filter((s) => /^[A-Z]/.test(s) && /[a-z]+ [a-z]/i.test(s));

// Documents: labels used in "Missing: ..." messages, review notes, checklist items, validation messages.
const gen = lines("src/lib/documents/generate.ts");
const val = lines("src/lib/documents/validate.ts");
const docStrings = [
  ...grab(gen, /\bf\("\w+",\s*"([^"]+)"/g),
  ...grab(gen, /(?:missing|review)\.push\("([^"]+)"/g),
  ...grab(gen, /message: "([^"]+)"/g),
  ...grab(gen, /\b(?:title|why|who): "([^"]+)"/g),
  ...grab(val, /\b(?:err|warn)\("\w+",\s*"([^"]+)"/g),
  ...grab(val, /message: "([^"]+)"/g),
];
const backupStrings = grab(lines("src/lib/workspace/backup.ts"), /(?:error: |warnings\.push\()"([^"]+)"/g);

const dataStrings = [
  ...new Set([
    ...engineStrings,
    ...Object.values(TASK_STATUS_LABEL),
    ...PHASES.flatMap((p) => [p.title, p.blurb]),
    ...TOPICS.flatMap((t) => [t.label, t.blurb]),
    ...Object.values(REQUEST_STATUS_LABEL),
    LOCAL_NOTICE,
    ...GROUPS.map((g) => g.title),
    ...Object.values(LABELS),
    ...Object.values(SOURCE_TEXT),
    ...MISSION_COLUMNS.map((c) => c.title),
    ...Object.values(REQUEST_NEXT).filter(Boolean).map((n) => n.label),
    ...docStrings,
    ...backupStrings,
    ...checklistFor(null).flatMap((i) => [i.title, i.why, i.who]),
    ...checklistFor("food-contact").flatMap((i) => [i.title, i.why, i.who]),
    ...checklistFor("water-irrigation").flatMap((i) => [i.title, i.why, i.who]),
    ...checklistFor("electrical-construction").flatMap((i) => [i.title, i.why, i.who]),
    ...checklistFor("household-general").flatMap((i) => [i.title, i.why, i.who]),
    ...TEMPLATES,
  ]),
].filter((s) => /[A-Za-z]/.test(s));

describe("workspace data tables", () => {
  it("finds the data it is supposed to check", () => {
    assert.ok(engineStrings.length > 80, `only ${engineStrings.length} roadmap strings`);
    assert.ok(docStrings.length > 40, `only ${docStrings.length} document strings`);
    assert.ok(backupStrings.length >= 7, `only ${backupStrings.length} backup strings`);
    assert.ok(dataStrings.length > 200);
  });
  for (const loc of ["hi", "gu"]) {
    it(`every data string has a ${loc} translation in the right script with its placeholders and protected tokens`, () => {
      const dict = DICTIONARIES[loc];
      const missing = dataStrings.filter((k) => !dict[k]);
      assert.deepEqual(missing.slice(0, 25), [], `${missing.length} of ${dataStrings.length} missing in ${loc}`);
      const bad = [];
      for (const k of dataStrings) {
        const v = dict[k];
        if (!SCRIPT[loc].test(v)) bad.push(`script: ${k}`);
        if (placeholders(k).join() !== placeholders(v).join()) bad.push(`placeholders: ${k}`);
        for (const tok of k.match(PROTECTED) ?? []) if (!v.includes(tok)) bad.push(`token ${tok}: ${k}`);
      }
      assert.deepEqual(bad.slice(0, 25), [], `${bad.length} problems`);
    });
  }
});

describe("sentences built at run time", () => {
  const en = (s, v) => translate({}, "en", s, v);
  it("a built sentence is recognised by its shape and comes back unchanged in English", () => {
    for (const tpl of TEMPLATES) {
      const text = sample(tpl, { why: "Duty depends on the code.", note: "Source noted.", what: "check every line against the agreed order.", review: "You have recorded a review.", title: "Resolve regulations and incentives", item: "Buyer address" });
      assert.equal(tx(en, text), text, tpl);
    }
  });
  for (const loc of ["hi", "gu"]) {
    it(`a built sentence is translated into ${loc} with its numbers and names kept`, () => {
      const t = (s, v) => translate(DICTIONARIES, loc, s, v);
      const cases = [
        ["3 of 4 record parts present.", "3"],
        ["Linked to Pune Plant.", "Pune Plant"],
        ["7 of 12 assumptions are still sample values. Replace each, confirm it with a quote, or accept it as it is.", "12"],
        ["You claim 3923.10. It is unverified.", "3923.10"],
        ["2 required items missing.", "2"],
        ["Missing: Buyer address", ""],
        ["The invoice quantity (500) does not match the packing list units (400).", "500"],
        ["HS code 3923.10 is your own claim. It has not been verified.", "3923.10"],
        ["Gross margin 12% meets your 20% target, but 3 assumptions are still samples, so this is not settled.", "12%"],
        ["Your own numbers show a problem here, so it comes before everything else.", ""],
      ];
      for (const [text, keep] of cases) {
        const out = tx(t, text);
        assert.notEqual(out, text, `not translated: ${text}`);
        assert.ok(SCRIPT[loc].test(out), `wrong script: ${out}`);
        if (keep) assert.ok(out.includes(keep), `lost ${keep}: ${out}`);
        assert.ok(!/\{\w+\}/.test(out), `placeholder left: ${out}`);
      }
      // The factory name inside a sentence is the user's own text and is never translated.
      assert.ok(tx(t, "Linked to Pune Plant, Surat Unit.").includes("Pune Plant, Surat Unit"));
      // A phase title is lower-cased inside the roadmap's "why" sentence in English; it still finds its translation.
      const why = tx(t, "Replace each. It is the earliest open high-priority step, in phase 3: resolve regulations and incentives.");
      assert.ok(!/resolve regulations/i.test(why), why);
    });
  }
});
export { dataStrings };
