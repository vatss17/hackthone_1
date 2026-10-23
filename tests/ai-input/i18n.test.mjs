// Everything the voice and photo features show, in all three languages, with technical tokens intact.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DICTIONARIES } from "../../src/lib/i18n/messages/index.ts";
import { FIELD_TABLE } from "../../src/lib/ai-input/vision.ts";
import { PRODUCT_FIELDS } from "../../src/lib/ai-input/voice.ts";
import { MATERIAL_NAMES, PROCESS_NAMES } from "../../src/lib/opportunities/engine.ts";

const keysOf = (file) => {
  const s = readFileSync(file, "utf8");
  return [...s.matchAll(/(?<![A-Za-z0-9_.])t\(\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
};

describe("voice and photo screens are translated", () => {
  const keys = ["shared", "image-assist", "voice-assist"].flatMap((f) => keysOf(`src/components/ai-input/${f}.tsx`));
  for (const loc of ["hi", "gu"]) {
    it(`every sentence the screens show has a ${loc} translation`, () => {
      assert.ok(keys.length > 60);
      assert.deepEqual(keys.filter((k) => !DICTIONARIES[loc][k]), []);
    });
    it(`field labels, process names and material names are translated into ${loc}`, () => {
      const labels = [
        ...Object.values(FIELD_TABLE).flatMap((t) => Object.values(t)),
        ...Object.values(PRODUCT_FIELDS).map((f) => f.label),
        ...Object.values(PROCESS_NAMES),
        ...Object.values(MATERIAL_NAMES),
      ];
      assert.deepEqual([...new Set(labels)].filter((k) => !DICTIONARIES[loc][k]), []);
    });
  }
  it("polymer codes survive inside translated material names", () => {
    for (const name of Object.values(MATERIAL_NAMES)) {
      const code = name.match(/\(([A-Z]+)\)\s*$/)?.[1];
      if (code) for (const loc of ["hi", "gu"]) assert.ok(DICTIONARIES[loc][name].includes(`(${code})`), `${loc}: ${name}`);
    }
  });
});
