// The Atlas AI tool descriptions and the navigation hints are English data rendered through t() at display time.
// Every one needs a Hindi and a Gujarati entry in the right script, with the same {placeholders}.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INTENTS } from "../../src/lib/atlas/intents.ts";
import { navigation } from "../../src/config/navigation.ts";
import { DICTIONARIES } from "../../src/lib/i18n/messages/index.ts";
import { placeholders } from "../../src/lib/i18n/translate.ts";

const SCRIPT = { hi: /[ऀ-ॿ]/, gu: /[઀-૿]/ };
const strings = [
  ...INTENTS.flatMap((i) => [i.prompt, i.does]),
  ...navigation.map((n) => n.description),
];

describe("Atlas data strings are translated", () => {
  it("covers every intent prompt and description and every navigation hint", () => {
    assert.ok(strings.length >= 25);
  });
  for (const lang of ["hi", "gu"]) {
    it(`${lang}: every string has a non-empty ${lang} entry in the right script with the same placeholders`, () => {
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
  it("Hindi and Gujarati suggested prompts are distinct from each other and from English", () => {
    for (const i of INTENTS) {
      const h = DICTIONARIES.hi[i.prompt];
      const g = DICTIONARIES.gu[i.prompt];
      assert.notEqual(h, g);
      assert.notEqual(h, i.prompt);
    }
  });
});
