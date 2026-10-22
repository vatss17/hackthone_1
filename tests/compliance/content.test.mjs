// Pure tests: the compliance and incentives screening content never overstates what is known.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../../src/lib/opportunities/catalogue.ts";
import { ALL_SECTIONS, FAMILIES, SOURCES, SOURCE_BY_ID, allItemIds, familyForEntry, itemsFor } from "../../src/lib/compliance/content.ts";

const allItems = FAMILIES.flatMap((f) => ALL_SECTIONS.flatMap((s) => itemsFor(f, s).map((it) => ({ f, s, it }))));

describe("screening content structure", () => {
  it("covers three to four product families", () => {
    assert.ok(FAMILIES.length >= 3 && FAMILIES.length <= 4);
  });
  it("every catalogue product belongs to exactly one family", () => {
    for (const e of CATALOGUE) {
      const hits = FAMILIES.filter((f) => f.entryIds.includes(e.id));
      assert.equal(hits.length, 1, `${e.id} is in ${hits.length} families`);
      assert.equal(familyForEntry(e.id).id, hits[0].id);
    }
  });
  it("item ids are unique within a family and prefixed so they never collide", () => {
    for (const f of FAMILIES) {
      const ids = allItemIds(f);
      assert.equal(new Set(ids).size, ids.length, f.id);
    }
  });
  it("every family answers the sections the product promises", () => {
    for (const f of FAMILIES) {
      for (const s of ["indianExport", "uaeImport", "testing", "packaging", "hs", "cepa", "schemes"]) assert.ok(itemsFor(f, s).length > 0, `${f.id}.${s}`);
      assert.ok(f.hsCandidates.length > 0 && f.hsCandidates.every((h) => /^\d{4}$/.test(h.heading)));
    }
  });
});

describe("screening content honesty", () => {
  it("nothing is labelled verified, because no primary source was opened", () => {
    assert.ok(SOURCES.every((s) => s.primaryOpened === false));
    assert.ok(allItems.every(({ it }) => it.evidence !== "verified"));
  });
  it("every secondary item names a source with a date and a caveat", () => {
    for (const { it } of allItems.filter((x) => x.it.evidence === "secondary")) {
      assert.ok(it.sourceId && SOURCE_BY_ID[it.sourceId], it.id);
      assert.match(SOURCE_BY_ID[it.sourceId].retrieved, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(SOURCE_BY_ID[it.sourceId].caveat.length > 20);
    }
    for (const s of SOURCES) assert.match(s.url, /^https:\/\//);
  });
  it("items are questions or background, never requirements, rates, amounts or eligibility decisions", () => {
    const text = allItems.map(({ it }) => `${it.text} ${it.why}`).join(" ");
    assert.ok(!/\d+\s?%/.test(text), "a percentage appears in an item");
    assert.ok(!/(AED|INR|Rs\.?|₹|\$)\s?\d/.test(text), "an amount appears in an item");
    assert.ok(!/\b(you must|is required|are required|is mandatory|you are eligible|you qualify|will qualify|is exempt|is banned|is prohibited)\b/i.test(text), "definitive legal language");
  });
  it("unknown and inferred items are phrased as questions, not statements", () => {
    for (const { it } of allItems.filter((x) => ["unknown", "inferred"].includes(x.it.evidence))) assert.match(it.text, /\?/, it.id);
  });
  it("the hypothetical CEPA discussion never says the product qualifies", () => {
    for (const f of FAMILIES) {
      const t = itemsFor(f, "cepa").map((i) => i.text + i.why).join(" ");
      assert.ok(!/qualif(y|ies) for|is eligible/i.test(t));
    }
  });
});
