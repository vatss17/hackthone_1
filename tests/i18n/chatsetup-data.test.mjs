// The chat setup's sentences are produced in library code (src/lib/start/chat-flow.ts) as English templates and translated when
// they are drawn. Every template needs a Hindi and a Gujarati entry in the right script with the same {placeholders}, and the
// bot's sentences must keep the person's own numbers, units and polymer codes untouched.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CHAT_TEMPLATES, QUESTIONS, TEMPLATES, describeFactoryDelta, describeProductDelta, mergeFactory } from "../../src/lib/start/chat-flow.ts";
import { PROCESS_NAMES, MATERIAL_NAMES } from "../../src/lib/opportunities/engine.ts";
import { DICTIONARIES } from "../../src/lib/i18n/messages/index.ts";
import { placeholders, translate } from "../../src/lib/i18n/translate.ts";

const SCRIPT = { hi: /[ऀ-ॿ]/, gu: /[઀-૿]/ };
const strings = [...new Set(CHAT_TEMPLATES)];

describe("chat setup templates are translated", () => {
  it("finds the templates", () => assert.ok(strings.length > 40, `only ${strings.length}`));
  for (const lang of ["hi", "gu"]) {
    it(`${lang}: every template has an entry in the right script with the same placeholders`, () => {
      const bad = [];
      for (const s of strings) {
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
  it("polymer chips are codes and are never translated", () => {
    const codes = QUESTIONS.materials.chips.filter((c) => c.plain).map((c) => c.label);
    assert.deepEqual(codes, ["PP", "HDPE", "LDPE", "PET", "PVC", "ABS"]);
    for (const c of QUESTIONS.follow_both.chips.filter((x) => x.plain)) assert.equal(c.label, c.value);
  });
});

describe("the bot's sentences in Hindi and Gujarati", () => {
  const say = (lang) => {
    const t = (s, v) => translate(DICTIONARIES, lang, s, v);
    return { t, process: (c) => t(PROCESS_NAMES[c]), material: (c) => t(MATERIAL_NAMES[c]) };
  };
  const { delta } = mergeFactory({ processes: [], materials: [], machines: [], products: [] }, [
    { kind: "machine", process: "injection_moulding", count: 3, size: "150 tonnes", quote: null },
    { kind: "material", code: "HDPE", quote: null },
    { kind: "product", name: "Crate", quote: null },
  ]);
  for (const lang of ["hi", "gu"]) {
    it(`${lang}: names, numbers and units stay as the person said them`, () => {
      const out = describeFactoryDelta(delta, say(lang));
      assert.match(out, SCRIPT[lang]);
      for (const keep of ["3", "150 tonnes", "Crate", "HDPE"]) assert.ok(out.includes(keep), `${keep} in ${out}`);
      assert.doesNotMatch(out, /\{\w+\}/);
      const p = describeProductDelta({ material: "PP", weight: "1.9", size: "600 x 400 x 250" }, say(lang));
      for (const keep of ["PP", "1.9 kg", "600 x 400 x 250 mm"]) assert.ok(p.includes(keep), `${keep} in ${p}`);
    });
  }
  it("the honest fallback line says the AI is not available, and the consent line says it is optional", () => {
    assert.match(TEMPLATES.noteAiOff, /AI service is not available/);
    assert.match(TEMPLATES.noteNoConsent, /as you chose/);
  });
});
