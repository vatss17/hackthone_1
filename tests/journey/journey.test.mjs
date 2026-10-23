// Pure and static tests: one journey model, with compliance and CEPA, that carries the chosen product, family and topic everywhere.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JOURNEY, neighbours, workspaceHref } from "../../src/config/journey.ts";

const PRODUCT = "cfe770de-f7c2-4001-a583-0b12fcc911d9";
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const step = (id) => JOURNEY.find((s) => s.id === id);

describe("the journey model", () => {
  it("has compliance and CEPA as steps of their own, once each, in a sensible order", () => {
    const ids = JOURNEY.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const need of ["catalogue", "factory", "opportunities", "explore", "evidence", "cost", "compliance", "cepa", "roadmap", "documents", "expert"]) assert.ok(ids.includes(need), need);
    assert.ok(ids.indexOf("cost") < ids.indexOf("compliance") && ids.indexOf("compliance") < ids.indexOf("cepa") && ids.indexOf("cepa") < ids.indexOf("roadmap"));
  });
  it("carries the selected product through every step that can use one", () => {
    for (const id of ["explore", "evidence", "cost", "compliance", "cepa", "feasibility", "roadmap", "documents", "expert", "catalogue"]) {
      assert.ok(step(id).href({ ref: PRODUCT }).includes(PRODUCT), id);
    }
    assert.equal(workspaceHref({ ref: PRODUCT }), `/workspace/${PRODUCT}`);
  });
  it("a catalogue product (not one of yours) is carried too, but never sent to a page that would 404", () => {
    assert.equal(step("cost").href({ ref: "pipes-and-fittings" }), "/viability?product=pipes-and-fittings");
    assert.equal(step("catalogue").href({ ref: "pipes-and-fittings" }), "/products");
  });
  it("with no product it stays general, without dangling parameters", () => {
    for (const s of JOURNEY) assert.ok(!/[?&]$/.test(s.href({ ref: null })) && !/undefined|null/.test(s.href({ ref: null })), s.id);
    assert.equal(step("cost").href({ ref: null }), "/viability");
  });
  it("keeps a hand-chosen screening family when there is no product, and the expert topic", () => {
    assert.equal(step("compliance").href({ ref: null, family: "food-contact" }), "/compliance?family=food-contact");
    assert.equal(step("cepa").href({ ref: null, family: "food-contact" }), "/schemes?family=food-contact");
    assert.equal(step("expert").href({ ref: PRODUCT, topic: "cepa" }), `/services?product=${PRODUCT}&topic=cepa`);
    assert.equal(step("compliance").href({ ref: PRODUCT, family: "food-contact" }), `/compliance?product=${PRODUCT}`, "a product wins over a family");
  });
  it("knows the neighbouring steps for the narrow-screen controls", () => {
    assert.equal(neighbours("catalogue").prev, null);
    assert.equal(neighbours("expert").next, null);
    assert.equal(neighbours("compliance").next.id, "cepa");
  });
});

describe("the interface uses the single model", () => {
  it("the overview's guide is built from the journey, so the two cannot drift apart", () => {
    const page = src("src/app/(app)/page.tsx");
    assert.match(page, /JOURNEY\.map/);
    assert.ok(!/const journey: Step\[\]/.test(page));
  });
  it("the step bar uses real links, marks the current step, and offers a selector for narrow screens", () => {
    const bar = src("src/components/journey-bar.tsx");
    assert.match(bar, /aria-current/);
    assert.match(bar, /md:hidden/);
    assert.match(bar, /<details/);
    assert.match(bar, /Next step/);
    assert.ok(!/overflow-x-auto/.test(bar), "no hidden sideways scroll");
  });
  it("screening pages pass the family and the topic to the bar and to their links", () => {
    const s = src("src/components/compliance/screening.tsx");
    assert.match(s, /family=\{family\?\.id \?\? null\}/);
    assert.match(s, /topic=\{kind === "compliance" \? "regulatory" : "cepa"\}/);
    assert.match(s, /\?family=\$\{chosen\.id\}/);
  });
  it("exploration links to each expert topic and to both screening pages with the product", () => {
    const s = src("src/app/(app)/opportunities/[ref]/page.tsx");
    for (const t of ["hs", "regulatory", "cepa"]) assert.ok(s.includes(`/services?topic=${t}&product=\${ref}`), t);
    assert.ok(s.includes("/compliance?product=${ref}") && s.includes("/schemes?product=${ref}"));
  });
});
