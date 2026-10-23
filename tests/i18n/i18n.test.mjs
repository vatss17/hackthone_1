// Localization: English source strings are the keys; every key used in the source needs Hindi and Gujarati, in the right script,
// with placeholders and technical tokens intact. Missing entries fall back to English, never to a blank.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { LOCALES, LOCALE_NAMES, parseLocale } from "../../src/lib/i18n/config.ts";
import { interpolate, placeholders, translate } from "../../src/lib/i18n/translate.ts";
import { DICTIONARIES } from "../../src/lib/i18n/messages/index.ts";
import { navigation } from "../../src/config/navigation.ts";

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const src = walk("src").filter((f) => /\.(tsx?|ts)$/.test(f) && !f.includes("ux-preview") && !f.includes("lib/i18n/messages"));
const STR = String.raw`"((?:[^"\\]|\\.)*)"`;
const unescape = (s) => s.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");

/** Every English literal handed to t(...) or written as <T>…</T> in the source. */
export function usedKeys() {
  const keys = new Set();
  for (const f of src) {
    const t = readFileSync(f, "utf8");
    for (const m of t.matchAll(new RegExp(String.raw`(?<![A-Za-z0-9_.])t\(\s*${STR}`, "g"))) keys.add(unescape(m[1]));
    for (const m of t.matchAll(/<T(?:\s[^>]*)?>([^<{}]+)<\/T>/g)) keys.add(m[1].trim());
  }
  // Labels that reach t() through data rather than a literal.
  for (const n of navigation) keys.add(n.label);
  for (const k of ["Command", "Discover", "Execute", "Ask Atlas AI", "Go to", "Products"]) keys.add(k);
  return [...keys].filter((k) => /[A-Za-z]/.test(k));
}

const DEVANAGARI = /[ऀ-ॿ]/;
const GUJARATI = /[઀-૿]/;
const PROTECTED = /\b(?:HS|HSN|HDPE|LDPE|PP|PVC|PET|ABS|CBM|AED|INR|USD|CEPA|RoDTEP|GST|IEC|FOB|CIF|EXW|LCL|FCL|kg|mm|ISO|PIN)\b|\d+(?:[.,]\d+)*/g;

describe("configuration", () => {
  it("supports English, Hindi and Gujarati with native names and speech tags", () => {
    assert.deepEqual([...LOCALES], ["en", "hi", "gu"]);
    assert.equal(LOCALE_NAMES.hi.native, "हिन्दी");
    assert.equal(LOCALE_NAMES.gu.native, "ગુજરાતી");
    assert.deepEqual(Object.values(LOCALE_NAMES).map((l) => l.bcp47), ["en-IN", "hi-IN", "gu-IN"]);
  });
  it("accepts only known languages and defaults to English", () => {
    assert.equal(parseLocale("hi"), "hi");
    for (const bad of ["fr", "", null, undefined, "HI", "hi;x"]) assert.equal(parseLocale(bad), "en");
  });
});

describe("translate", () => {
  const d = { hi: { Save: "सहेजें", "{n} items": "{n} वस्तुएँ", Empty: "  " } };
  it("returns the translation, interpolating placeholders", () => {
    assert.equal(translate(d, "hi", "Save"), "सहेजें");
    assert.equal(translate(d, "hi", "{n} items", { n: 3 }), "3 वस्तुएँ");
  });
  it("falls back to the English source when a translation is missing or blank, and for English", () => {
    assert.equal(translate(d, "gu", "Save"), "Save");
    assert.equal(translate(d, "hi", "Unknown text"), "Unknown text");
    assert.equal(translate(d, "hi", "Empty"), "Empty");
    assert.equal(translate(d, "en", "Save"), "Save");
  });
  it("leaves an unfilled placeholder visible and never throws", () => {
    assert.equal(interpolate("Hello {name}", {}), "Hello {name}");
    assert.equal(interpolate("Hello"), "Hello");
  });
});

describe("dictionary coverage", () => {
  const keys = usedKeys();
  it("finds the keys the interface uses", () => {
    assert.ok(keys.length > 40, `only ${keys.length} keys found`);
  });
  for (const [loc, script] of [["hi", DEVANAGARI], ["gu", GUJARATI]]) {
    it(`every key used in the source has a ${loc} translation`, () => {
      const missing = keys.filter((k) => !DICTIONARIES[loc][k]);
      assert.deepEqual(missing.slice(0, 25), [], `${missing.length} of ${keys.length} missing in ${loc}`);
    });
    it(`${loc} translations are in the right script, keep placeholders and keep technical tokens`, () => {
      const bad = [];
      for (const [k, v] of Object.entries(DICTIONARIES[loc])) {
        if (!script.test(v) && /[A-Za-z]{3,}/.test(k.replace(/\{\w+\}/g, "").replace(PROTECTED, ""))) bad.push(`script: ${k}`);
        if (placeholders(k).join() !== placeholders(v).join()) bad.push(`placeholders: ${k}`);
        for (const tok of k.match(PROTECTED) ?? []) if (!v.includes(tok)) bad.push(`token ${tok}: ${k}`);
      }
      assert.deepEqual(bad.slice(0, 25), [], `${bad.length} problems`);
    });
  }
  it("Hindi and Gujarati cover the same keys", () => {
    const h = new Set(Object.keys(DICTIONARIES.hi));
    const g = new Set(Object.keys(DICTIONARIES.gu));
    assert.deepEqual([...h].filter((k) => !g.has(k)).slice(0, 20), []);
    assert.deepEqual([...g].filter((k) => !h.has(k)).slice(0, 20), []);
  });
});

describe("language handling in the interface", () => {
  const client = readFileSync("src/lib/i18n/client.tsx", "utf8");
  it("persists the choice in a cookie the server also reads, and refreshes without a reload", () => {
    assert.match(client, /document\.cookie = `\$\{LOCALE_COOKIE\}=/);
    assert.match(client, /router\.refresh\(\)/);
    assert.doesNotMatch(client, /location\.(reload|href)/);
  });
  it("keeps the selector in both headers and sets the document language", () => {
    assert.match(readFileSync("src/components/public/public-header.tsx", "utf8"), /LanguageSelect/);
    assert.match(readFileSync("src/components/atlas/header-actions.tsx", "utf8"), /LanguageSelect/);
    assert.match(client, /documentElement\.lang = locale/);
  });
  it("loads Devanagari and Gujarati fonts", () => {
    const l = readFileSync("src/app/layout.tsx", "utf8");
    assert.match(l, /Noto_Sans_Devanagari/);
    assert.match(l, /Noto_Sans_Gujarati/);
  });
});
