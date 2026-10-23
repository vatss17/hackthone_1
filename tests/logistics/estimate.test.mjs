// The AI logistics estimate: shipment planning, reference-rate pricing, honesty about quality, and destination-neutral wording.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estimateLogistics, planShipment, toLinePatch } from "../../src/lib/logistics/estimate.ts";
import { REF, CONTAINERS, USD_INR, AED_PER_USD } from "../../src/lib/logistics/reference.ts";
import { RESEARCH, hasResearch } from "../../src/lib/research/answers.ts";
import { FAMILIES, itemsFor, ALL_SECTIONS } from "../../src/lib/compliance/content.ts";

const input = { volumeCbm: 50.1, grossKg: 5417, distanceKm: 300 };

describe("shipment planning", () => {
  it("plans one 40 ft container for a 50 m3 consignment", () => {
    const p = planShipment(50.1, 5417);
    assert.equal(p.mode, "FCL");
    assert.deepEqual(p.containers, [{ type: "40GP", count: 1 }]);
  });
  it("uses a shared load for a small consignment and says why", () => {
    const p = planShipment(4, 800);
    assert.equal(p.mode, "LCL");
    assert.match(p.summary, /shared/);
  });
  it("adds containers when volume or weight needs them, never exceeding payload", () => {
    const heavy = planShipment(20, 60000);
    const kg = heavy.containers.reduce((t, c) => t + c.count * CONTAINERS[c.type === "20GP" ? "20GP" : "40GP"].payloadKg, 0);
    assert.ok(kg >= 60000);
    const big = planShipment(120, 9000);
    assert.ok(big.containers.reduce((t, c) => t + c.count, 0) >= 2);
  });
});

describe("the estimate", () => {
  const e = estimateLogistics(input);
  it("covers the six logistics lines, each with low <= typical <= high", () => {
    assert.equal(e.ok, true);
    assert.deepEqual(e.lines.map((l) => l.key), ["inlandFreight", "exportHandling", "internationalFreight", "insurance", "destinationClearing", "otherDestination"]);
    for (const l of e.lines) assert.ok(l.low <= l.typical && l.typical <= l.high && l.typical > 0, l.key);
  });
  it("prices ocean freight from the reference rate at the stated exchange rate", () => {
    const f = e.lines.find((l) => l.key === "internationalFreight");
    assert.equal(f.typical, Math.round((REF.ocean40.typical * USD_INR) / 500) * 500);
  });
  it("is deterministic", () => {
    assert.deepEqual(estimateLogistics(input), estimateLogistics(input));
  });
  it("never claims more than an estimate: nothing is confirmed, every line has reasoning, and weak bases are labelled", () => {
    for (const p of toLinePatch(e, "typical")) assert.equal(p.confirmed, false);
    for (const l of e.lines) {
      assert.ok(l.how.length > 30, l.key);
      assert.ok(["medium", "low"].includes(l.confidence), "no line is ever high confidence");
    }
    assert.equal(e.lines.find((l) => l.key === "inlandFreight").quality, "model assumption");
  });
  it("suggests the market exchange rate from the USD rate and the fixed peg, without applying it", () => {
    assert.equal(e.inrPerAed, Math.round((USD_INR / AED_PER_USD) * 100) / 100);
  });
  it("a longer haul costs more inland, and low is never above high", () => {
    const far = estimateLogistics({ ...input, distanceKm: 900 });
    assert.ok(far.lines[0].typical > e.lines[0].typical);
  });
  it("refuses without volume and weight, or with a silly distance, and says what is missing", () => {
    assert.equal(estimateLogistics({ volumeCbm: null, grossKg: null, distanceKm: 300 }).ok, false);
    assert.match(estimateLogistics({ volumeCbm: null, grossKg: null, distanceKm: 300 }).problem, /carton size and weight/);
    assert.equal(estimateLogistics({ ...input, distanceKm: -5 }).ok, false);
    assert.equal(estimateLogistics({ ...input, distanceKm: 99999 }).ok, false);
  });
});

describe("destination-neutral wording", () => {
  const BANNED = /\b(UAE|Emirates|Emirati|Dubai|Abu Dhabi|Sharjah|Jebel Ali|Gulf|GCC|Arab)\b/i;
  it("no estimate text, reference note or research answer names the destination country", () => {
    const e = estimateLogistics(input);
    const text = JSON.stringify([e.lines.map((l) => [l.label, l.how, l.sources.map((s) => [s.title, s.publisher])]), e.plan, Object.values(REF).map((r) => [r.note, r.sources.map((s) => [s.title, s.publisher])])]);
    assert.ok(!BANNED.test(text), text.match(BANNED)?.[0]);
    for (const [id, r] of Object.entries(RESEARCH)) assert.ok(!BANNED.test(JSON.stringify([r.answer, r.keyPoints, r.whatToConfirm, r.sources.map((s) => [s.title, s.publisher])])), id);
  });
  it("the screens and copy a visitor reads no longer name the destination country", () => {
    // The landing page names the one live market (Atlas brief: UAE first, without pretending other markets are live); see the next test.
    for (const f of ["src/components/auth/auth-shell.tsx", "src/app/(app)/viability/page.tsx", "src/app/(app)/page.tsx", "src/components/landed-cost/workspace.tsx", "src/lib/compliance/content.ts", "src/lib/documents/generate.ts", "src/components/compliance/screening.tsx", "src/config/navigation.ts", "src/config/journey.ts"]) {
      const t = readFileSync(new URL(`../../${f}`, import.meta.url), "utf8").replace(/uae-[a-z-]+|uaeImport|sharjah|roedl[^"]*|pwc\.com[^"]*|\.uae\./g, "");
      assert.ok(!/\bUAE\b|United Arab|Emirates|Dubai/.test(t), f);
    }
  });
});

describe("the one live market is named honestly", () => {
  it("the landing names the UAE only beside the statement that other markets are not live", () => {
    const l = readFileSync(new URL("../../src/components/public/landing.tsx", import.meta.url), "utf8");
    assert.match(l, /Live now/);
    assert.match(l, /Not yet/);
  });
});

describe("research answers for the questions that needed expert confirmation", () => {
  it("covers every screening question that is unknown or inferred, with sources or an honest low confidence", () => {
    const missing = [];
    for (const f of FAMILIES) for (const s of ALL_SECTIONS) for (const it of itemsFor(f, s)) {
      if (it.evidence === "unknown" || it.evidence === "inferred") {
        if (!hasResearch(it.id)) missing.push(it.id);
      }
    }
    assert.deepEqual([...new Set(missing)], []);
  });
  it("each answer states its confidence and what to confirm, and cites a source unless it is low confidence", () => {
    for (const [id, r] of Object.entries(RESEARCH)) {
      assert.ok(["high", "medium", "low"].includes(r.confidence), id);
      assert.ok(r.answer.length > 40 && r.whatToConfirm.length > 10, id);
      assert.ok(r.sources.length > 0 || r.confidence === "low", id);
      for (const s of r.sources) assert.match(s.url, /^https?:\/\//, id);
    }
  });
  it("no answer claims certainty, approval or compliance", () => {
    for (const [id, r] of Object.entries(RESEARCH)) assert.ok(!/\b(guaranteed|certified compliant|you are compliant|is approved|will be approved)\b/i.test(r.answer), id);
  });
});

describe("the AI features in the interface", () => {
  const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
  it("the checklist offers an AI answer per question and records it as a draft, never as verified", () => {
    const c = read("src/components/compliance/checklist.tsx");
    assert.match(c, /Get AI answer/);
    assert.match(c, /Get AI answers for all/);
    assert.match(c, /source: `AI research draft/);
    assert.ok(!/evidence: "verified"/.test(c));
    const p = read("src/components/compliance/ai-answer.tsx");
    assert.match(p, /not advice or an approval/);
    assert.match(p, /Still to confirm/);
  });
  it("the calculator fills AI estimates as accepted estimates, tags them, and never marks them confirmed", () => {
    const w = read("src/components/landed-cost/workspace.tsx");
    assert.match(w, /AI estimate/);
    assert.match(w, /\["confirmed", false\]/);
    assert.match(w, /accepted\.add\(`lines\.\$\{p\.key\}\.amount`\)/);
    const l = read("src/components/landed-cost/ai-logistics.tsx");
    assert.match(l, /not quotes from a carrier, forwarder, broker or insurer/);
    assert.match(l, /none is marked confirmed/);
  });
  it("the docs say plainly that nothing is a live model call", () => {
    assert.match(read("docs/ai-research.md"), /Not a live model call/);
  });
});
