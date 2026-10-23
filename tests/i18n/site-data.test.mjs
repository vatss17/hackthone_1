// The landing page's departments (header menu and "Services by department") and the scheme-finder demo keep their text in lib files, so the
// "every t(...) literal" test cannot see it. This checks each such string has a Hindi and a Gujarati entry, and that the demo states no figures.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DICTIONARIES } from "../../src/lib/i18n/messages/index.ts";
import { placeholders } from "../../src/lib/i18n/translate.ts";
import { DEPARTMENTS, departmentStrings, deptHref } from "../../src/lib/landing/departments.ts";
import { SCHEME_DEMO_FAMILIES, schemeDemoStrings, DEMO_DESTINATION } from "../../src/lib/landing/scheme-demo.ts";

const DEVANAGARI = /[ऀ-ॿ]/;
const GUJARATI = /[઀-૿]/;
const PROTECTED = /\b(?:HS|HSN|CEPA|RoDTEP|GST|IEC|DGFT|CBIC|UAE)\b|\d+/g;

function check(label, strings) {
  const list = [...new Set(strings.filter(Boolean))];
  assert.ok(list.length > 0, `${label}: nothing collected`);
  for (const [loc, script] of [["hi", DEVANAGARI], ["gu", GUJARATI]]) {
    const dict = DICTIONARIES[loc];
    assert.deepEqual(list.filter((s) => !dict[s]), [], `${label}: missing ${loc}`);
    const bad = list.filter((s) => placeholders(s).join() !== placeholders(dict[s]).join() || (/[A-Za-z]{3,}/.test(s.replace(PROTECTED, "")) && !script.test(dict[s])) || (s.match(PROTECTED) ?? []).some((tok) => !dict[s].includes(tok)));
    assert.deepEqual(bad, [], `${label}: wrong script, placeholders or technical tokens in ${loc}`);
  }
}

describe("landing departments and scheme demo are translated", () => {
  it("department titles, summaries and sub-services", () => {
    check("departments", departmentStrings());
  });
  it("scheme demo names, reasons and what to confirm", () => {
    check("scheme demo", [...schemeDemoStrings(), DEMO_DESTINATION]);
  });
  it("has the six departments and links every service to a landing anchor", () => {
    assert.deepEqual(DEPARTMENTS.map((d) => d.id), ["discover", "economics", "compliance", "schemes", "documents", "execution"]);
    for (const d of DEPARTMENTS) for (const s of d.services) assert.match(deptHref(d.id, s.anchor), /^\/welcome#(dept-[a-z]+|schemes-ai)$/);
    assert.equal(deptHref("schemes", DEPARTMENTS[3].services[0].anchor), "/welcome#schemes-ai");
  });
  it("the demo covers four families and states no rate, amount or approval", () => {
    assert.equal(SCHEME_DEMO_FAMILIES.length, 4);
    for (const s of schemeDemoStrings()) assert.ok(!/\d+(\.\d+)?\s*%|\b(?:INR|AED|USD|Rs\.?)\b|₹|you (?:are|will be) eligible|approved/i.test(s), `figure or approval claim: ${s}`);
  });
});
